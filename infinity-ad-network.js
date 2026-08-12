(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityAdNetwork = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNITS_PER_INFINITY = 10_000;
  const ONE_INFINITY_CENT = 100;
  const DEFAULT_IMPRESSION_COST_UNITS = 2_000;
  const PRODUCTION_COMPANY_RATE_UNITS = 1_000;
  const CREDITED_PERSON_RATE_UNITS = 100;
  const CLAIM_STATES = new Set(['UNCLAIMED', 'PENDING', 'VERIFIED', 'DISPUTED', 'DECLINED']);
  const FUNDING_SOURCES = new Set(['TREASURY_ISSUANCE', 'EXTERNAL_ADVERTISER']);
  const CAMPAIGN_STATES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED']);
  const ORGANIZATION_CREDIT_SOURCES = new Set(['PRODUCT_PURCHASE', 'USER_DIRECTED_ACTIVITY', 'PRODUCT_INFINITY_COIN']);

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function integer(value, label) {
    const number = Number(value);
    invariant(Number.isSafeInteger(number), label + ' must be a safe integer.');
    return number;
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function sha256(value) {
    const input = canonical(value);
    if (typeof require === 'function') {
      try {
        return require('node:crypto').createHash('sha256').update(input).digest('hex');
      } catch (_) {}
    }
    invariant(globalThis.crypto && globalThis.crypto.subtle, 'SHA-256 is unavailable.');
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function posting(accountId, debitUnits, creditUnits, memo) {
    const debit = integer(debitUnits, 'debitUnits');
    const credit = integer(creditUnits, 'creditUnits');
    invariant(debit >= 0 && credit >= 0 && !(debit && credit), 'A posting must be one-sided and non-negative.');
    return { accountId: String(accountId), debitUnits: debit, creditUnits: credit, memo: String(memo || '') };
  }

  function normalizeTags(tags) {
    return Array.from(new Set((Array.isArray(tags) ? tags : []).map(tag => String(tag).trim().toLowerCase()).filter(Boolean))).sort();
  }

  function normalizeParticipants(participants) {
    const list = Array.isArray(participants) ? participants.map(item => ({
      id: String(item.id || '').trim(),
      name: String(item.name || '').trim(),
      role: String(item.role || 'RIGHTS_HOLDER').trim().toUpperCase(),
      beneficiaryClass: String(item.beneficiaryClass || (/COMPANY|STUDIO|NETWORK|DISTRIBUTOR|PUBLISHER|PRODUCTION/.test(String(item.role || '').toUpperCase()) ? 'COMPANY' : 'PERSON')).trim().toUpperCase(),
      shareBps: integer(item.shareBps, 'participant shareBps'),
      claimStatus: String(item.claimStatus || 'UNCLAIMED').trim().toUpperCase(),
      walletId: item.walletId ? String(item.walletId).trim() : null,
      verificationRecordId: item.verificationRecordId ? String(item.verificationRecordId).trim() : null,
      evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map(String) : [],
    })) : [];
    list.forEach(item => {
      invariant(item.id && item.name, 'Participant id and name are required.');
      invariant(item.shareBps >= 0 && item.shareBps <= 10_000, 'Participant share must be 0–10000 bps.');
      invariant(CLAIM_STATES.has(item.claimStatus), 'Participant claim status is invalid.');
      invariant(item.beneficiaryClass === 'COMPANY' || item.beneficiaryClass === 'PERSON', 'Participant beneficiary class is invalid.');
      if (item.claimStatus === 'VERIFIED') {
        invariant(item.walletId && item.verificationRecordId, 'Verified participant requires wallet and verification record.');
      }
    });
    if (list.length && list.some(item => item.shareBps > 0)) invariant(list.reduce((sum, item) => sum + item.shareBps, 0) === 10_000, 'Participant shares must total 10000 bps when percentage sharing is used.');
    return list;
  }

  function splitUnits(totalUnits, participants) {
    if (!participants.length) return [];
    let allocated = 0;
    return participants.map((participant, index) => {
      const units = index === participants.length - 1
        ? totalUnits - allocated
        : Math.floor(totalUnits * participant.shareBps / 10_000);
      allocated += units;
      return { participant, units };
    });
  }

  class InfinityAdvertisingNetwork {
    constructor(options = {}) {
      this.mode = options.mode === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'SIMULATION';
      this.organizations = { ...(options.organizations || {}) };
      this.contentTokens = { ...(options.contentTokens || {}) };
      this.campaigns = { ...(options.campaigns || {}) };
      this.events = Array.isArray(options.events) ? options.events.map(event => ({ ...event })) : [];
      this.processedImpressionIds = new Set(options.processedImpressionIds || []);
      this.processedFundingIds = new Set(options.processedFundingIds || []);
      this.frequency = { ...(options.frequency || {}) };
    }

    async createOrganizationAccount(input) {
      invariant(input && /^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(input.id || ''), 'Organization id is invalid.');
      invariant(!this.organizations[input.id], 'Organization already exists.');
      const claimStatus = String(input.claimStatus || 'UNCLAIMED').toUpperCase();
      const fundingSource = String(input.fundingSource || 'TREASURY_ISSUANCE').toUpperCase();
      invariant(CLAIM_STATES.has(claimStatus), 'Organization claim status is invalid.');
      invariant(FUNDING_SOURCES.has(fundingSource), 'Funding source is invalid.');
      const organization = {
        id: input.id,
        displayName: String(input.displayName || '').trim(),
        claimStatus,
        fundingSource,
        walletId: input.walletId ? String(input.walletId).trim() : null,
        verificationRecordId: input.verificationRecordId ? String(input.verificationRecordId).trim() : null,
        stewardship: claimStatus === 'VERIFIED' ? 'CLAIMANT_CONTROLLED' : 'SYSTEM_PROVISIONAL',
        endorsement: claimStatus === 'VERIFIED' ? 'NOT_RECORDED' : 'NOT_CLAIMED_OR_ENDORSED',
        tags: normalizeTags(input.tags),
        allowNegative: input.allowNegative !== false,
        creditLineUnits: integer(input.creditLineUnits ?? 100 * UNITS_PER_INFINITY, 'creditLineUnits'),
      };
      invariant(organization.displayName, 'Organization display name is required.');
      if (claimStatus === 'VERIFIED') invariant(organization.walletId && organization.verificationRecordId, 'Verified organization requires wallet and verification record.');
      this.organizations[input.id] = organization;

      const openingUnits = integer(input.openingUnits || 0, 'openingUnits');
      invariant(openingUnits >= 0, 'Opening units cannot be negative.');
      const postings = openingUnits ? [
        posting('issuance:' + fundingSource.toLowerCase(), openingUnits, 0, 'Recorded funding source'),
        posting('organization:' + input.id + ':available', 0, openingUnits, 'Opening campaign balance'),
      ] : [];
      await this.append('ORGANIZATION_ACCOUNT_CREATED', { organization, openingUnits }, postings, input.timestamp);
      return organization;
    }

    userDirectedUsage(userId, dayKey) {
      return this.events.filter(event => event.type === 'ORGANIZATION_ACCOUNT_CREDITED' && event.payload.sourceType === 'USER_DIRECTED_ACTIVITY' &&
        event.payload.userId === userId && event.payload.dayKey === dayKey).reduce((sum, event) => sum + event.payload.amountUnits, 0);
    }

    async creditOrganization(input) {
      invariant(input && typeof input.eventId === 'string' && input.eventId.trim(), 'Funding event id is required.');
      invariant(!this.processedFundingIds.has(input.eventId), 'Duplicate funding event.');
      const organization = this.organizations[input.organizationId];
      invariant(organization, 'Organization is not registered.');
      const sourceType = String(input.sourceType || '').toUpperCase();
      invariant(ORGANIZATION_CREDIT_SOURCES.has(sourceType), 'Organization credit source is invalid.');
      const amountUnits = integer(input.amountUnits, 'amountUnits');
      invariant(amountUnits > 0, 'Organization credit must be positive.');
      const payload = { eventId: input.eventId, organizationId: organization.id, sourceType, amountUnits };
      if (sourceType === 'PRODUCT_PURCHASE') {
        invariant(typeof input.orderId === 'string' && input.orderId.trim(), 'Product purchase requires orderId.');
        payload.orderId = input.orderId;
        payload.productTokenId = String(input.productTokenId || '').trim();
      } else if (sourceType === 'PRODUCT_INFINITY_COIN') {
        invariant(typeof input.productTokenId === 'string' && input.productTokenId.trim(), 'Product coin credit requires productTokenId.');
        payload.productTokenId = input.productTokenId;
      } else {
        invariant(input.userAuthorization === true, 'User-directed activity requires explicit authorization.');
        payload.userId = String(input.userId || '').trim();
        payload.dayKey = String(input.dayKey || '').trim();
        invariant(payload.userId && payload.dayKey, 'User-directed activity requires userId and dayKey.');
        const dailyLimit = 100 * UNITS_PER_INFINITY;
        invariant(this.userDirectedUsage(payload.userId, payload.dayKey) + amountUnits <= dailyLimit, 'User-directed activity exceeds the 100 Infinity daily limit.');
      }
      const sourceAccount = sourceType === 'PRODUCT_PURCHASE' ? 'clearing:verified-product-purchases' :
        sourceType === 'PRODUCT_INFINITY_COIN' ? 'clearing:product-infinity-coins' : 'clearing:user-directed-activity';
      const event = await this.append('ORGANIZATION_ACCOUNT_CREDITED', payload, [
        posting(sourceAccount, amountUnits, 0, sourceType),
        posting('organization:' + organization.id + ':available', 0, amountUnits, 'Organization balance recovery'),
      ], input.timestamp);
      this.processedFundingIds.add(input.eventId);
      return event;
    }

    async registerContentToken(input) {
      invariant(input && /^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(input.id || ''), 'Content token id is invalid.');
      invariant(!this.contentTokens[input.id], 'Content token already exists.');
      const token = {
        id: input.id,
        title: String(input.title || '').trim(),
        kind: String(input.kind || 'CONTENT').trim().toUpperCase(),
        sourceUrl: String(input.sourceUrl || '').trim(),
        tags: normalizeTags(input.tags),
        participants: normalizeParticipants(input.participants),
        evidenceState: String(input.evidenceState || 'USER_ASSERTED').trim().toUpperCase(),
      };
      invariant(token.title, 'Content title is required.');
      invariant(!token.sourceUrl || /^https:\/\//i.test(token.sourceUrl), 'Content source URL must be HTTPS.');
      this.contentTokens[input.id] = token;
      await this.append('CONTENT_TOKEN_REGISTERED', { token }, [], input.timestamp);
      return token;
    }

    async createCampaign(input) {
      invariant(input && /^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(input.id || ''), 'Campaign id is invalid.');
      invariant(!this.campaigns[input.id], 'Campaign already exists.');
      invariant(this.organizations[input.sponsorOrganizationId], 'Sponsor organization is not registered.');
      const costPerImpressionUnits = integer(input.costPerImpressionUnits ?? DEFAULT_IMPRESSION_COST_UNITS, 'costPerImpressionUnits');
      const royaltyPerImpressionUnits = integer(input.royaltyPerImpressionUnits ?? ONE_INFINITY_CENT, 'royaltyPerImpressionUnits');
      const budgetUnits = integer(input.budgetUnits, 'budgetUnits');
      invariant(costPerImpressionUnits > 0 && royaltyPerImpressionUnits > 0, 'Impression rates must be positive.');
      invariant(royaltyPerImpressionUnits <= costPerImpressionUnits, 'Royalty cannot exceed campaign impression cost.');
      invariant(budgetUnits >= costPerImpressionUnits, 'Campaign budget must fund at least one impression.');
      const campaign = {
        id: input.id,
        name: String(input.name || '').trim(),
        sponsorOrganizationId: input.sponsorOrganizationId,
        state: input.state && CAMPAIGN_STATES.has(input.state) ? input.state : 'ACTIVE',
        costPerImpressionUnits,
        royaltyPerImpressionUnits,
        productionCompanyRateUnits: integer(input.productionCompanyRateUnits ?? PRODUCTION_COMPANY_RATE_UNITS, 'productionCompanyRateUnits'),
        creditedPersonRateUnits: integer(input.creditedPersonRateUnits ?? CREDITED_PERSON_RATE_UNITS, 'creditedPersonRateUnits'),
        budgetUnits,
        spentUnits: 0,
        targetTags: normalizeTags(input.targetTags),
        excludedTags: normalizeTags(input.excludedTags),
        frequencyCapPerDay: integer(input.frequencyCapPerDay ?? 3, 'frequencyCapPerDay'),
        placementMode: input.placementMode === 'CONSENTED_PERSONALIZATION' ? 'CONSENTED_PERSONALIZATION' : 'CONTEXTUAL',
        createdBy: String(input.createdBy || 'infinity-system-steward'),
      };
      invariant(campaign.name, 'Campaign name is required.');
      invariant(campaign.productionCompanyRateUnits > 0 && campaign.creditedPersonRateUnits > 0, 'Beneficiary rates must be positive.');
      invariant(campaign.frequencyCapPerDay > 0 && campaign.frequencyCapPerDay <= 100, 'Frequency cap is invalid.');
      this.campaigns[input.id] = campaign;
      await this.append('CAMPAIGN_CREATED', { campaign }, [], input.timestamp);
      return campaign;
    }

    recommendPlacement(input) {
      const campaign = this.campaigns[input.campaignId];
      const token = this.contentTokens[input.contentTokenId];
      invariant(campaign && token, 'Campaign and content token are required.');
      const contextTags = normalizeTags(input.contextTags).concat(token.tags);
      const hasConsent = Array.isArray(input.consentScopes) && input.consentScopes.includes('AD_PERSONALIZATION');
      const profileTags = hasConsent && campaign.placementMode === 'CONSENTED_PERSONALIZATION'
        ? normalizeTags(input.profileTags) : [];
      const allSignals = new Set(contextTags.concat(profileTags));
      const matchedTags = campaign.targetTags.filter(tag => allSignals.has(tag));
      const blockedTags = campaign.excludedTags.filter(tag => allSignals.has(tag));
      const frequencyKey = [String(input.viewerPseudonym || 'anonymous'), campaign.id, String(input.day || '')].join(':');
      const seen = Number(this.frequency[frequencyKey] || 0);
      const eligible = campaign.state === 'ACTIVE' && !blockedTags.length && seen < campaign.frequencyCapPerDay && matchedTags.length > 0;
      return {
        eligible,
        score: eligible ? Math.min(100, 40 + matchedTags.length * 18 + (profileTags.length ? 8 : 0)) : 0,
        matchedTags,
        blockedTags,
        modeUsed: profileTags.length ? 'CONSENTED_PERSONALIZATION' : 'CONTEXTUAL',
        reasonCodes: eligible ? ['CONTEXT_MATCH', profileTags.length ? 'CONSENTED_PROFILE_MATCH' : 'NO_PROFILE_DATA_USED']
          : [campaign.state !== 'ACTIVE' ? 'CAMPAIGN_INACTIVE' : blockedTags.length ? 'EXCLUDED_CONTEXT' : seen >= campaign.frequencyCapPerDay ? 'FREQUENCY_CAP' : 'NO_RELEVANT_MATCH'],
        frequencyKey,
      };
    }

    participantAccount(token, participant) {
      const modePrefix = this.mode === 'SIMULATION' ? 'simulation' : 'payable';
      if (participant && participant.claimStatus === 'VERIFIED') {
        return modePrefix + ':wallet:' + participant.walletId + ':' + participant.role.toLowerCase();
      }
      return modePrefix + ':unclaimed:' + token.id + ':' + (participant ? participant.id : 'unknown');
    }

    distributionFor(token, campaign) {
      if (!token.participants.length) return [{ participant: null, units: campaign.royaltyPerImpressionUnits }];
      return token.participants.map(participant => ({
        participant,
        units: participant.beneficiaryClass === 'COMPANY' ? campaign.productionCompanyRateUnits : campaign.creditedPersonRateUnits,
      }));
    }

    async recordImpression(receipt) {
      invariant(receipt && typeof receipt.eventId === 'string' && receipt.eventId.trim(), 'Impression event id is required.');
      invariant(!this.processedImpressionIds.has(receipt.eventId), 'Duplicate impression event.');
      const campaign = this.campaigns[receipt.campaignId];
      const token = this.contentTokens[receipt.contentTokenId];
      invariant(campaign && token, 'Campaign and content token are required.');
      invariant(campaign.state === 'ACTIVE', 'Campaign is not active.');
      invariant(campaign.spentUnits + campaign.costPerImpressionUnits <= campaign.budgetUnits, 'Campaign budget is exhausted.');
      const sponsorAccount = 'organization:' + campaign.sponsorOrganizationId + ':available';
      const sponsorBalance = this.balances()[sponsorAccount] || 0;
      const sponsor = this.organizations[campaign.sponsorOrganizationId];
      const projectedBalance = sponsorBalance - campaign.costPerImpressionUnits;
      invariant(projectedBalance >= 0 || sponsor.allowNegative && projectedBalance >= -sponsor.creditLineUnits, 'Sponsor credit line is exhausted.');
      const visibleMs = integer(receipt.visibleMs, 'visibleMs');
      const visiblePercent = integer(receipt.visiblePercent, 'visiblePercent');
      invariant(visibleMs >= 1_000 && visiblePercent >= 50 && visiblePercent <= 100, 'Impression did not meet visibility policy.');
      const verification = receipt.verification || {};
      if (this.mode === 'AUTHORITATIVE') {
        invariant(verification.status === 'VERIFIED', 'Authoritative impression requires VERIFIED status.');
        invariant(verification.verifierId && verification.signature, 'Authoritative impression requires verifier identity and signature.');
        invariant(/^[a-f0-9]{64}$/i.test(verification.evidenceHash || ''), 'Authoritative impression requires SHA-256 evidence hash.');
      } else invariant(verification.status === 'SIMULATED', 'Simulator accepts SIMULATED impressions only.');

      const decision = this.recommendPlacement({ ...receipt.placement, campaignId: campaign.id, contentTokenId: token.id });
      invariant(decision.eligible, 'Placement is not eligible: ' + decision.reasonCodes.join(', '));
      const royaltySplits = this.distributionFor(token, campaign);
      const distributionUnits = royaltySplits.reduce((sum, item) => sum + item.units, 0);
      invariant(distributionUnits <= campaign.costPerImpressionUnits, 'Campaign impression cost does not cover the company and credited-person schedule.');
      const postings = [posting(sponsorAccount, campaign.costPerImpressionUnits, 0, 'Qualified advertising impression')];
      royaltySplits.forEach(({ participant, units }) => postings.push(posting(this.participantAccount(token, participant), 0, units, participant ? participant.name : 'Unresolved rights reserve')));
      postings.push(posting(
        (this.mode === 'SIMULATION' ? 'simulation' : 'revenue') + ':platform:campaign:' + campaign.id,
        0,
        campaign.costPerImpressionUnits - distributionUnits,
        'Campaign remainder after rights allocation'
      ));

      const event = await this.append(this.mode === 'SIMULATION' ? 'AD_IMPRESSION_SIMULATED' : 'AD_IMPRESSION_POSTED', {
        eventId: receipt.eventId, campaignId: campaign.id, contentTokenId: token.id,
        visibleMs, visiblePercent, decision, verification, distributionUnits,
      }, postings, receipt.timestamp);
      campaign.spentUnits += campaign.costPerImpressionUnits;
      this.frequency[decision.frequencyKey] = Number(this.frequency[decision.frequencyKey] || 0) + 1;
      if (campaign.spentUnits + campaign.costPerImpressionUnits > campaign.budgetUnits) campaign.state = 'EXHAUSTED';
      this.processedImpressionIds.add(receipt.eventId);
      return event;
    }

    async append(type, payload, postings, timestamp) {
      const debit = postings.reduce((sum, item) => sum + item.debitUnits, 0);
      const credit = postings.reduce((sum, item) => sum + item.creditUnits, 0);
      invariant(debit === credit, 'Ledger event is not balanced.');
      const prevHash = this.events.length ? this.events[this.events.length - 1].hash : null;
      const body = { schema: 'infinity/ad-ledger-event/v1', sequence: this.events.length + 1, type, mode: this.mode,
        timestamp: timestamp || new Date().toISOString(), prevHash, payload: clone(payload), postings: clone(postings) };
      const event = { ...body, hash: await sha256(body) };
      this.events.push(event);
      return event;
    }

    balances() {
      const balances = {};
      this.events.forEach(event => event.postings.forEach(item => {
        balances[item.accountId] = (balances[item.accountId] || 0) + item.creditUnits - item.debitUnits;
      }));
      return balances;
    }

    organizationStatement(organizationId) {
      const organization = this.organizations[organizationId];
      invariant(organization, 'Organization is not registered.');
      const balanceUnits = this.balances()['organization:' + organizationId + ':available'] || 0;
      return { organizationId, balanceUnits, debtUnits: Math.max(0, -balanceUnits), availableUnits: Math.max(0, balanceUnits),
        creditLineUnits: organization.creditLineUnits, remainingCreditUnits: Math.max(0, organization.creditLineUnits + Math.min(0, balanceUnits)),
        claimStatus: organization.claimStatus, stewardship: organization.stewardship };
    }

    async verifyChain() {
      let prevHash = null;
      for (let index = 0; index < this.events.length; index += 1) {
        const event = this.events[index];
        if (event.sequence !== index + 1 || event.prevHash !== prevHash) return false;
        const { hash, ...body } = event;
        if (await sha256(body) !== hash) return false;
        if (event.postings.reduce((sum, item) => sum + item.debitUnits, 0) !== event.postings.reduce((sum, item) => sum + item.creditUnits, 0)) return false;
        prevHash = hash;
      }
      return true;
    }

    toJSON() {
      return { schema: 'infinity/ad-network-state/v1', mode: this.mode, organizations: this.organizations,
        contentTokens: this.contentTokens, campaigns: this.campaigns, events: this.events,
        processedImpressionIds: Array.from(this.processedImpressionIds), processedFundingIds: Array.from(this.processedFundingIds), frequency: this.frequency };
    }
  }

  return { InfinityAdvertisingNetwork, UNITS_PER_INFINITY, ONE_INFINITY_CENT, DEFAULT_IMPRESSION_COST_UNITS,
    PRODUCTION_COMPANY_RATE_UNITS, CREDITED_PERSON_RATE_UNITS, sha256 };
});
