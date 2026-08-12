(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityRoyaltyLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNITS_PER_INFINITY = 10_000;
  const CLAIM_STATES = new Set(['UNCLAIMED', 'PENDING', 'VERIFIED', 'DISPUTED']);
  const ROLES = new Set(['RIGHTS_OWNER', 'TALENT']);
  const DEFAULT_POLICY = Object.freeze({
    rightsOwnerBps: 1_000,
    talentBps: 100,
    viewerRewardUnits: 100,
    minimumCompletionBps: 5_000,
  });
  const PROGRAM_LIMITS = Object.freeze({
    dailyNoteMintUnits: 10 * UNITS_PER_INFINITY,
    dailyActivityUnits: 90 * UNITS_PER_INFINITY,
    dailyRetailSpendUnits: 300 * UNITS_PER_INFINITY,
    verifiedTreePlantingGrantUnits: 1_000 * UNITS_PER_INFINITY,
  });

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const input = canonical(value);
    if (typeof require === 'function') {
      try {
        return require('node:crypto').createHash('sha256').update(input).digest('hex');
      } catch (_) {}
    }
    invariant(globalThis.crypto && globalThis.crypto.subtle, 'SHA-256 is unavailable in this environment.');
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function integer(value, label) {
    const number = Number(value);
    invariant(Number.isSafeInteger(number), label + ' must be a safe integer.');
    return number;
  }

  function formatUnits(units) {
    const amount = integer(units, 'units') / UNITS_PER_INFINITY;
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' Infinity';
  }

  function normalizeStakeholder(value, expectedRole) {
    const stakeholder = { ...value };
    invariant(typeof stakeholder.id === 'string' && stakeholder.id.trim(), 'Stakeholder id is required.');
    invariant(typeof stakeholder.name === 'string' && stakeholder.name.trim(), 'Stakeholder name is required.');
    invariant(ROLES.has(stakeholder.role) && stakeholder.role === expectedRole, 'Stakeholder role is invalid.');
    invariant(CLAIM_STATES.has(stakeholder.claimStatus), 'Claim status is invalid.');
    stakeholder.shareBps = integer(stakeholder.shareBps, 'stakeholder shareBps');
    invariant(stakeholder.shareBps >= 0 && stakeholder.shareBps <= 10_000, 'Stakeholder share must be 0–10000 bps.');
    if (stakeholder.claimStatus === 'VERIFIED') {
      invariant(typeof stakeholder.walletId === 'string' && stakeholder.walletId.trim(), 'Verified claimant requires walletId.');
      invariant(typeof stakeholder.verificationRecordId === 'string' && stakeholder.verificationRecordId.trim(), 'Verified claimant requires verificationRecordId.');
    }
    return stakeholder;
  }

  function normalizeStakeholders(values, role) {
    const list = Array.isArray(values) ? values.map(value => normalizeStakeholder(value, role)) : [];
    if (list.length) invariant(list.reduce((sum, item) => sum + item.shareBps, 0) === 10_000, role + ' shares must total 10000 bps.');
    return list;
  }

  function splitUnits(total, stakeholders) {
    if (!stakeholders.length) return [];
    let allocated = 0;
    return stakeholders.map((stakeholder, index) => {
      const amount = index === stakeholders.length - 1
        ? total - allocated
        : Math.floor(total * stakeholder.shareBps / 10_000);
      allocated += amount;
      return { stakeholder, units: amount };
    });
  }

  function posting(accountId, debitUnits, creditUnits, memo) {
    return {
      accountId,
      debitUnits: integer(debitUnits, 'debitUnits'),
      creditUnits: integer(creditUnits, 'creditUnits'),
      memo: String(memo || ''),
    };
  }

  class RoyaltyLedger {
    constructor(options = {}) {
      this.mode = options.mode === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'SIMULATION';
      this.policy = { ...DEFAULT_POLICY, ...(options.policy || {}) };
      this.assets = { ...(options.assets || {}) };
      this.events = Array.isArray(options.events) ? options.events.map(event => ({ ...event })) : [];
      this.processedViewIds = new Set(options.processedViewIds || []);
      this.proposals = Array.isArray(options.proposals) ? options.proposals.map(item => ({ ...item })) : [];
    }

    async registerAsset(input) {
      invariant(input && typeof input.id === 'string' && /^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(input.id), 'Asset id is invalid.');
      invariant(!this.assets[input.id], 'Asset is already registered.');
      const asset = {
        id: input.id,
        title: String(input.title || '').trim(),
        sourceUrl: String(input.sourceUrl || '').trim(),
        perceivedValueUnits: integer(input.perceivedValueUnits, 'perceivedValueUnits'),
        rightsOwners: normalizeStakeholders(input.rightsOwners, 'RIGHTS_OWNER'),
        talent: normalizeStakeholders(input.talent, 'TALENT'),
        evidenceState: input.evidenceState || 'USER_DEFINED',
      };
      invariant(asset.title, 'Asset title is required.');
      invariant(asset.perceivedValueUnits > 0, 'Perceived value must be positive.');
      invariant(!asset.sourceUrl || /^https:\/\//i.test(asset.sourceUrl), 'Source URL must be HTTPS.');
      this.assets[asset.id] = asset;
      await this.append('ASSET_REGISTERED', { asset }, [], input.timestamp);
      return asset;
    }

    allocationAccount(assetId, stakeholder, role) {
      const prefix = this.mode === 'SIMULATION' ? 'simulation' : 'payable';
      if (stakeholder && stakeholder.claimStatus === 'VERIFIED') {
        return prefix + ':wallet:' + stakeholder.walletId + ':' + role.toLowerCase();
      }
      return prefix + ':unclaimed:' + role.toLowerCase() + ':' + assetId + ':' + (stakeholder ? stakeholder.id : 'unknown');
    }

    allocationPostings(asset, viewerWalletId) {
      const rightsUnits = Math.floor(asset.perceivedValueUnits * this.policy.rightsOwnerBps / 10_000);
      const talentUnits = Math.floor(asset.perceivedValueUnits * this.policy.talentBps / 10_000);
      const viewerUnits = integer(this.policy.viewerRewardUnits, 'viewerRewardUnits');
      const total = rightsUnits + talentUnits + viewerUnits;
      const prefix = this.mode === 'SIMULATION' ? 'simulation' : 'ledger';
      const postings = [posting(prefix + ':expense:view-distribution', total, 0, 'Verified-view distribution')];

      const rightsSplits = splitUnits(rightsUnits, asset.rightsOwners);
      if (!rightsSplits.length) {
        postings.push(posting(this.allocationAccount(asset.id, null, 'RIGHTS_OWNER'), 0, rightsUnits, 'Unclaimed rights-owner reserve'));
      } else {
        rightsSplits.forEach(({ stakeholder, units }) => postings.push(posting(
          this.allocationAccount(asset.id, stakeholder, 'RIGHTS_OWNER'), 0, units, stakeholder.name
        )));
      }

      const talentSplits = splitUnits(talentUnits, asset.talent);
      if (!talentSplits.length) {
        postings.push(posting(this.allocationAccount(asset.id, null, 'TALENT'), 0, talentUnits, 'Unclaimed talent reserve'));
      } else {
        talentSplits.forEach(({ stakeholder, units }) => postings.push(posting(
          this.allocationAccount(asset.id, stakeholder, 'TALENT'), 0, units, stakeholder.name
        )));
      }
      postings.push(posting(prefix + ':wallet:' + viewerWalletId + ':viewer-reward', 0, viewerUnits, 'Viewer reward'));
      return postings;
    }

    async recordView(receipt) {
      invariant(receipt && typeof receipt.eventId === 'string' && receipt.eventId.trim(), 'View eventId is required.');
      invariant(!this.processedViewIds.has(receipt.eventId), 'Duplicate view event.');
      const asset = this.assets[receipt.assetId];
      invariant(asset, 'Asset is not registered.');
      invariant(typeof receipt.viewerWalletId === 'string' && receipt.viewerWalletId.trim(), 'Viewer wallet is required.');
      const watched = integer(receipt.watchedSeconds, 'watchedSeconds');
      const duration = integer(receipt.durationSeconds, 'durationSeconds');
      invariant(duration > 0 && watched >= 0 && watched <= duration, 'Watch duration is invalid.');
      invariant(Math.floor(watched * 10_000 / duration) >= this.policy.minimumCompletionBps, 'View did not meet completion policy.');

      const verification = receipt.verification || {};
      if (this.mode === 'AUTHORITATIVE') {
        invariant(verification.status === 'VERIFIED', 'Authoritative view requires VERIFIED status.');
        invariant(typeof verification.verifierId === 'string' && verification.verifierId.trim(), 'Authoritative view requires verifierId.');
        invariant(/^[a-f0-9]{64}$/i.test(verification.evidenceHash || ''), 'Authoritative view requires SHA-256 evidenceHash.');
        invariant(typeof verification.signature === 'string' && verification.signature.trim(), 'Authoritative view requires verifier signature.');
      } else {
        invariant(verification.status === 'SIMULATED', 'Simulator accepts SIMULATED receipts only.');
      }

      const payload = {
        eventId: receipt.eventId,
        assetId: asset.id,
        viewerWalletId: receipt.viewerWalletId,
        watchedSeconds: watched,
        durationSeconds: duration,
        verification,
      };
      const postings = this.allocationPostings(asset, receipt.viewerWalletId);
      const event = await this.append(
        this.mode === 'SIMULATION' ? 'VIEW_ALLOCATION_SIMULATION' : 'VIEW_ALLOCATION_POSTED',
        payload,
        postings,
        receipt.timestamp
      );
      this.processedViewIds.add(receipt.eventId);
      return event;
    }

    async recordProgramProposal(proposal) {
      const item = {
        id: String(proposal.id || '').trim(),
        name: String(proposal.name || '').trim(),
        amountUnits: integer(proposal.amountUnits, 'proposal amountUnits'),
        beneficiary: String(proposal.beneficiary || '').trim(),
        status: 'PROPOSED',
        createsSpendableBalance: false,
        requirements: Array.isArray(proposal.requirements) ? proposal.requirements.map(String) : [],
      };
      invariant(item.id && item.name && item.beneficiary && item.amountUnits > 0, 'Proposal fields are incomplete.');
      this.proposals.push(item);
      await this.append('PROGRAM_PROPOSAL_RECORDED', { proposal: item }, [], proposal.timestamp);
      return item;
    }

    async append(type, payload, postings, timestamp) {
      const debit = postings.reduce((sum, item) => sum + item.debitUnits, 0);
      const credit = postings.reduce((sum, item) => sum + item.creditUnits, 0);
      invariant(debit === credit, 'Ledger event is not balanced.');
      const prevHash = this.events.length ? this.events[this.events.length - 1].hash : null;
      const body = {
        schema: 'infinity/royalty-ledger-event/v1',
        sequence: this.events.length + 1,
        type,
        mode: this.mode,
        timestamp: timestamp || new Date().toISOString(),
        prevHash,
        payload,
        postings,
      };
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

    async verifyChain() {
      let prevHash = null;
      for (let index = 0; index < this.events.length; index += 1) {
        const event = this.events[index];
        if (event.sequence !== index + 1 || event.prevHash !== prevHash) return false;
        const { hash, ...body } = event;
        if (await sha256(body) !== hash) return false;
        if (event.postings.reduce((sum, item) => sum + item.debitUnits, 0) !==
            event.postings.reduce((sum, item) => sum + item.creditUnits, 0)) return false;
        prevHash = hash;
      }
      return true;
    }

    toJSON() {
      return {
        schema: 'infinity/royalty-ledger-state/v1',
        mode: this.mode,
        policy: this.policy,
        assets: this.assets,
        events: this.events,
        processedViewIds: Array.from(this.processedViewIds),
        proposals: this.proposals,
      };
    }
  }

  return { RoyaltyLedger, UNITS_PER_INFINITY, DEFAULT_POLICY, PROGRAM_LIMITS, formatUnits, sha256 };
});
