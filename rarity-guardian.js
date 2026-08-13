(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityRarityGuardian = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function assessRarity(input = {}) {
    const impressions = Math.max(0, Number(input.impressions || 0));
    const editionSize = Math.max(1, Number(input.editionSize || 1));
    const verifiedAttachments = Math.max(0, Number(input.verifiedAttachments || 0));
    const authenticContribution = input.authenticContribution === true;
    const searchDemand = Math.max(0, Number(input.searchDemand || 0));
    let score = Math.min(40, Math.floor(Math.log10(impressions + 1) * 10));
    if (editionSize === 1) score += 25; else if (editionSize <= 10) score += 15;
    score += Math.min(20, verifiedAttachments * 5);
    if (authenticContribution) score += 20;
    score += Math.min(15, Math.floor(searchDemand / 10));
    const protectedCollectible = score >= 45 || authenticContribution || editionSize <= 10 && verifiedAttachments > 0;
    return { score, tier: score >= 80 ? 'HEIRLOOM' : score >= 60 ? 'RARE' : score >= 45 ? 'PROTECTED' : 'STANDARD',
      protectedCollectible, ordinarySpendAllowed: !protectedCollectible,
      discoveryListingState: protectedCollectible ? 'AUTO_LIST_DISCOVERY_ELIGIBLE' : 'NOT_LISTED',
      saleExecutionRequires: ['current owner approval', 'passkey user verification', 'authenticity checks when attributed', 'atomic payment and token transfer'],
      reasonCodes: [impressions >= 10000 ? 'HIGH_IMPRESSIONS' : null, editionSize <= 10 ? 'LIMITED_EDITION' : null,
        verifiedAttachments ? 'VERIFIED_ATTACHMENTS' : null, authenticContribution ? 'AUTHENTIC_CONTRIBUTION' : null,
        searchDemand >= 10 ? 'ACTIVE_SEARCH_DEMAND' : null].filter(Boolean) };
  }
  function createDiscoveryListing(input) {
    const assessment = input.assessment || {};
    if (!assessment.protectedCollectible) throw new Error('Only protected collectibles enter automatic discovery listings.');
    if (input.authenticityState !== 'RIGHTS_VERIFIED' && input.containsAttributedContribution) throw new Error('Attributed contribution is not verified.');
    return { listingId: String(input.listingId), tokenId: String(input.tokenId), state: 'DISCOVERY_ONLY',
      matchedSearchTerms: Array.from(new Set((input.matchedSearchTerms || []).map(String))), ownerApproval: 'REQUIRED_BEFORE_SALE',
      ordinarySpendAllowed: false, createdAt: input.createdAt || new Date().toISOString() };
  }
  return { assessRarity, createDiscoveryListing };
});
