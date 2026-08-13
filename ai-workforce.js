(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityAIWorkforce = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WORKERS = Object.freeze([
    { id: 'reader', name: 'Atlas Reader', verbs: ['READ', 'INDEX'], boundary: 'Never invent a missing credit or source.' },
    { id: 'rights', name: 'Provenance Mapper', verbs: ['TRACE', 'LINK'], boundary: 'Proposes claimants; never declares ownership.' },
    { id: 'campaign', name: 'Context Steward', verbs: ['MATCH', 'BUDGET'], boundary: 'Uses consented or contextual signals and obeys frequency caps.' },
    { id: 'writer', name: 'Page Writer', verbs: ['WRITE', 'EXPLAIN'], boundary: 'Labels inference, simulation, sponsorship and unclaimed status.' },
    { id: 'designer', name: 'System Designer', verbs: ['LAYOUT', 'ACCESSIBILITY'], boundary: 'Creates reusable components, not one-off decoration.' },
    { id: 'ledger', name: 'Soban Ledger Robot', verbs: ['POST', 'RECONCILE'], boundary: 'Only balanced integer postings may pass.' },
    { id: 'auditor', name: 'Sentinel Auditor', verbs: ['VERIFY', 'BLOCK'], boundary: 'Can stop a run; cannot waive evidence requirements.' },
  ]);

  function invariant(condition, message) { if (!condition) throw new Error(message); }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function uniq(values) { return Array.from(new Set(values.filter(Boolean))); }

  function summarizeManifest(manifest) {
    const tokens = Array.isArray(manifest.contentTokens) ? manifest.contentTokens : [];
    const claimants = Array.isArray(manifest.claimantCandidates) ? manifest.claimantCandidates : [];
    const kinds = {};
    const roles = {};
    tokens.forEach(token => { kinds[token.kind || 'UNKNOWN'] = (kinds[token.kind || 'UNKNOWN'] || 0) + 1; });
    claimants.forEach(item => { roles[item.role || 'UNKNOWN'] = (roles[item.role || 'UNKNOWN'] || 0) + 1; });
    return {
      contentTokenCount: tokens.length,
      claimantCandidateCount: claimants.length,
      contentKinds: kinds,
      claimantRoles: roles,
      missingProvenance: tokens.filter(token => !Array.isArray(token.provenance) || !token.provenance.length).map(token => token.id),
      missingClaimantCandidates: tokens.filter(token => !Array.isArray(token.claimantCandidateIds) || !token.claimantCandidateIds.length).map(token => token.id),
    };
  }

  function buildRightsQueue(manifest) {
    return (manifest.claimantCandidates || []).map(item => ({
      claimantId: item.id,
      displayName: item.name,
      proposedRole: item.role,
      state: item.claimStatus === 'VERIFIED' ? 'VERIFIED' : 'EVIDENCE_REQUIRED',
      releaseAllowed: item.claimStatus === 'VERIFIED' && Boolean(item.walletId && item.verificationRecordId),
      evidence: Array.isArray(item.provenance) ? item.provenance : item.provenance ? [item.provenance] : [],
      requiredNext: item.claimStatus === 'VERIFIED' ? ['periodic verification review'] : ['identity', 'role or rights evidence', 'conflict search', 'wallet binding'],
    }));
  }

  function buildLedgerPlans(manifest, rateUnits) {
    return (manifest.contentTokens || []).map(token => ({
      contentTokenId: token.id,
      eventTrigger: 'QUALIFIED_IMPRESSION',
      productionCompanyUnitsEach: 1_000,
      creditedPersonUnitsEach: rateUnits,
      denomination: 'INFINITY_NATIVE_UNITS',
      viewerChargeUnits: 0,
      candidateAccounts: (token.claimantCandidateIds || []).map(id => 'unclaimed:' + id),
      unresolvedPolicy: 'HOLD_IN_TOKEN_SPECIFIC_UNCLAIMED_PAYABLE',
      openingCreditState: 'CATALOG_DISCOVERY_PROTECTED_PENDING_CLAIM',
      postingState: 'PROPOSED_UNTIL_CAMPAIGN_AND_EVENT_VERIFICATION',
    }));
  }

  function buildPagePlans(manifest) {
    const scope = clean(manifest.scope || 'CATALOG');
    return [
      { id: 'catalog-intelligence', title: scope + ' Intelligence', purpose: 'Search every scanned token and inspect its provenance.', components: ['coverage metrics', 'filters', 'token cards', 'source trail'] },
      { id: 'claim-center', title: 'Rights Claim Center', purpose: 'Let a person or company find and support a claim.', components: ['claim search', 'evidence upload', 'conflict state', 'verification timeline'] },
      { id: 'organization-ledger', title: 'Organization Ledger', purpose: 'Show opening source, campaign activity, royalties and restrictions.', components: ['balance lanes', 'funding-source labels', 'campaign controls', 'statements'] },
      { id: 'campaign-studio', title: 'Advertising Intelligence Studio', purpose: 'Plan contextual placements and budgets.', components: ['context map', 'rate card', 'frequency cap', 'placement explanation'] },
      { id: 'audit-room', title: 'Public Audit Room', purpose: 'Verify event hashes, balanced postings and provenance.', components: ['chain status', 'event explorer', 'reconciliation', 'export'] },
    ].map(page => ({ ...page, accessibility: ['keyboard navigation', 'visible focus', 'plain-language status', 'mobile-first tables'] }));
  }

  function buildCampaignPlans(manifest) {
    const tags = {};
    (manifest.contentTokens || []).forEach(token => (token.tags || []).forEach(tag => { tags[tag] = (tags[tag] || 0) + 1; }));
    return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([tag, count]) => ({
      contextTag: tag,
      eligibleInventory: count,
      placementMode: 'CONTEXTUAL',
      defaultCostPerQualifiedImpressionUnits: 2_000,
      productionCompanyUnitsEach: 1_000,
      creditedPersonUnitsEach: 100,
      viewerChargeUnits: 0,
      frequencyCapPerDay: 3,
      state: 'PLAN_ONLY',
    }));
  }

  class LocalModelAdapter {
    constructor(options = {}) {
      this.endpoint = options.endpoint || 'http://127.0.0.1:11435/v1/worker';
      this.fetch = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    }
    async propose(task) {
      invariant(this.fetch, 'No fetch implementation is available for the local model adapter.');
      const response = await this.fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(task) });
      invariant(response.ok, 'Local model returned HTTP ' + response.status + '.');
      const result = await response.json();
      invariant(result && result.proposal && typeof result.proposal === 'object', 'Local model response is missing a proposal object.');
      return { provider: clean(result.provider || 'LOCAL_MODEL'), model: clean(result.model || 'UNSPECIFIED'), proposal: result.proposal };
    }
  }

  class InfinityWorkforce {
    constructor(options = {}) {
      this.rateUnits = Number.isSafeInteger(options.rateUnits) ? options.rateUnits : 100;
      this.modelAdapter = options.modelAdapter || null;
      this.runs = [];
    }

    async run(input) {
      invariant(input && input.manifest && input.manifest.schema === 'infinity/catalog-provenance-manifest/v1', 'A catalog provenance manifest is required.');
      const manifest = input.manifest;
      const startedAt = input.startedAt || new Date().toISOString();
      const summary = summarizeManifest(manifest);
      const rightsQueue = buildRightsQueue(manifest);
      const ledgerPlans = buildLedgerPlans(manifest, this.rateUnits);
      const campaignPlans = buildCampaignPlans(manifest);
      const pagePlans = buildPagePlans(manifest);
      const audit = {
        balancedRatePlan: ledgerPlans.every(plan => plan.productionCompanyUnitsEach === 1_000 && plan.creditedPersonUnitsEach === this.rateUnits && plan.viewerChargeUnits === 0),
        provenanceComplete: summary.missingProvenance.length === 0,
        releaseViolations: rightsQueue.filter(item => item.releaseAllowed && item.state !== 'VERIFIED').map(item => item.claimantId),
        blockers: uniq([].concat(summary.missingProvenance.length ? ['MISSING_PROVENANCE'] : [], summary.missingClaimantCandidates.length ? ['MISSING_CLAIMANT_CANDIDATES'] : [],
          rightsQueue.some(item => item.state === 'EVIDENCE_REQUIRED') ? ['UNVERIFIED_CLAIMANTS_HELD'] : [])),
      };

      let modelProposal = null;
      let modelStatus = this.modelAdapter ? 'NOT_RUN' : 'DETERMINISTIC_ENGINE_ONLY';
      if (this.modelAdapter && input.useLocalModel) {
        try {
          modelProposal = await this.modelAdapter.propose({
            schema: 'infinity/worker-task/v1', instruction: clean(input.instruction), catalogSummary: summary,
            constraints: ['Never invent credits', 'Never release unverified payables', 'Return structured proposals only'],
          });
          modelStatus = 'LOCAL_MODEL_PROPOSAL_RECEIVED';
        } catch (error) {
          modelStatus = 'LOCAL_MODEL_UNAVAILABLE';
          modelProposal = { error: error.message };
        }
      }

      const run = {
        schema: 'infinity/ai-workforce-run/v1', id: 'run:' + startedAt + ':' + this.runs.length,
        startedAt, finishedAt: input.finishedAt || new Date().toISOString(), instruction: clean(input.instruction),
        workers: WORKERS, outputs: { summary, rightsQueue, ledgerPlans, campaignPlans, pagePlans, modelProposal },
        modelStatus, audit, state: audit.releaseViolations.length || !audit.provenanceComplete ? 'REVIEW_REQUIRED' : 'PROPOSALS_READY',
        authority: 'PROPOSAL_ONLY_NO_AUTONOMOUS_PAYOUT',
      };
      this.runs.push(run);
      return run;
    }
  }

  return { InfinityWorkforce, LocalModelAdapter, WORKERS, summarizeManifest };
});
