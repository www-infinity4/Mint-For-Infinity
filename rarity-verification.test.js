'use strict';
const assert = require('node:assert/strict');
const { evaluateVerification, validateAttributedSignature } = require('./verification-gateway');
const { assessRarity, createDiscoveryListing } = require('./rarity-guardian');
(() => {
  const blocked = validateAttributedSignature({ namedPerson: 'Example public figure', verification: { passkey: 'VERIFIED', githubProvenance: 'VERIFIED', contributorIdentity: 'FAILED', contributionRights: 'NOT_CONFIGURED' } });
  assert.equal(blocked.allowed, false);
  const verified = evaluateVerification({ passkey: 'VERIFIED', stripeIdentity: 'VERIFIED', plaidAccount: 'VERIFIED', githubProvenance: 'VERIFIED', contributorIdentity: 'VERIFIED', contributionRights: 'VERIFIED' });
  assert.equal(verified.authenticContribution, true);
  assert.match(verified.disclosure, /never receives or stores fingerprint data/);
  const rarity = assessRarity({ impressions: 200000, editionSize: 10, verifiedAttachments: 2, authenticContribution: true, searchDemand: 80 });
  assert.equal(rarity.protectedCollectible, true);
  assert.equal(rarity.ordinarySpendAllowed, false);
  const listing = createDiscoveryListing({ listingId: 'listing:1', tokenId: 'alien:1', assessment: rarity, containsAttributedContribution: true, authenticityState: 'RIGHTS_VERIFIED', matchedSearchTerms: ['signed collectible'], createdAt: '2026-08-12T00:00:00.000Z' });
  assert.equal(listing.state, 'DISCOVERY_ONLY');
  assert.equal(listing.ownerApproval, 'REQUIRED_BEFORE_SALE');
  console.log('Infinity rarity and verification gateway: PASS');
})();
