'use strict';

const assert = require('node:assert/strict');
const { InfinityAdvertisingNetwork, UNITS_PER_INFINITY, ONE_INFINITY_CENT, BUSINESS_DAILY_ALLOWANCE_UNITS } = require('./infinity-ad-network');

(async () => {
  const network = new InfinityAdvertisingNetwork({ mode: 'SIMULATION' });
  await network.createOrganizationAccount({
    id: 'company:example', displayName: 'Example Company — provisional', claimStatus: 'UNCLAIMED',
    fundingSource: 'TREASURY_ISSUANCE', openingUnits: 0,
    tags: ['classic television'], timestamp: '2026-08-12T00:00:00.000Z',
  });
  assert.equal(network.organizations['company:example'].endorsement, 'NOT_CLAIMED_OR_ENDORSED');
  await network.collectBusinessDailyAllowance({ eventId: 'allowance:company:example:2026-08-12', organizationId: 'company:example', dayKey: '2026-08-12' });
  assert.equal(network.organizationStatement('company:example').balanceUnits, BUSINESS_DAILY_ALLOWANCE_UNITS);
  await assert.rejects(() => network.collectBusinessDailyAllowance({ eventId: 'allowance:extra', organizationId: 'company:example', dayKey: '2026-08-12', amountUnits: 1 }), /daily account limit/);
  await network.registerContentToken({
    id: 'content:painting-card', title: 'Example painting card', kind: 'TRADING_CARD', tags: ['art', 'business'],
    participants: [
      { id: 'creator:unclaimed', name: 'Creator — unclaimed', role: 'CREATOR', shareBps: 7_000, claimStatus: 'UNCLAIMED' },
      { id: 'publisher:verified', name: 'Verified publisher', role: 'PUBLISHER', shareBps: 3_000, claimStatus: 'VERIFIED', walletId: 'wallet:publisher', verificationRecordId: 'verify:publisher:1' },
    ], timestamp: '2026-08-12T00:01:00.000Z',
  });
  await network.createCampaign({
    id: 'campaign:example', name: 'Contextual art campaign', sponsorOrganizationId: 'company:example',
    budgetUnits: UNITS_PER_INFINITY, targetTags: ['art'], excludedTags: ['blocked'], frequencyCapPerDay: 1,
    costPerImpressionUnits: 2_000, royaltyPerImpressionUnits: ONE_INFINITY_CENT,
    timestamp: '2026-08-12T00:02:00.000Z',
  });
  await network.createOrganizationAccount({ id: 'company:empty', displayName: 'Empty Business', openingUnits: 0 });
  await network.createCampaign({ id: 'campaign:empty', name: 'Unfunded campaign', sponsorOrganizationId: 'company:empty',
    budgetUnits: UNITS_PER_INFINITY, targetTags: ['art'], costPerImpressionUnits: 2_000 });
  await assert.rejects(() => network.recordImpression({ eventId: 'impression:unfunded', campaignId: 'campaign:empty', contentTokenId: 'content:painting-card',
    visibleMs: 1_500, visiblePercent: 75, verification: { status: 'SIMULATED' },
    placement: { viewerPseudonym: 'viewer:empty', day: '2026-08-12', contextTags: ['art'], consentScopes: [] } }), /credit line is exhausted/);
  const decision = network.recommendPlacement({ campaignId: 'campaign:example', contentTokenId: 'content:painting-card',
    viewerPseudonym: 'viewer:opaque', day: '2026-08-12', profileTags: ['business'], consentScopes: [] });
  assert.equal(decision.eligible, true);
  assert.equal(decision.modeUsed, 'CONTEXTUAL');
  assert.ok(decision.reasonCodes.includes('NO_PROFILE_DATA_USED'));

  const event = await network.recordImpression({
    eventId: 'impression:1', campaignId: 'campaign:example', contentTokenId: 'content:painting-card',
    visibleMs: 1_500, visiblePercent: 75, verification: { status: 'SIMULATED' }, timestamp: '2026-08-12T00:03:00.000Z',
    placement: { viewerPseudonym: 'viewer:opaque', day: '2026-08-12', contextTags: ['art'], consentScopes: [] },
  });
  assert.equal(event.postings.reduce((sum, item) => sum + item.debitUnits, 0), 2_000);
  assert.equal(event.postings.reduce((sum, item) => sum + item.creditUnits, 0), 2_000);
  const balances = network.balances();
  assert.equal(balances['simulation:unclaimed:content:painting-card:creator:unclaimed'], 100);
  assert.equal(balances['simulation:wallet:wallet:publisher:publisher'], 1_000);
  assert.equal(balances['simulation:platform:campaign:campaign:example'], 900);
  assert.equal(balances['organization:company:example:available'], BUSINESS_DAILY_ALLOWANCE_UNITS - 2_000);
  assert.equal(network.organizationStatement('company:example').debtUnits, 0);
  await network.creditOrganization({ eventId: 'funding:purchase:1', organizationId: 'company:example', sourceType: 'PRODUCT_PURCHASE', amountUnits: 1_500, orderId: 'order:1', productTokenId: 'product:1' });
  assert.equal(network.organizationStatement('company:example').balanceUnits, BUSINESS_DAILY_ALLOWANCE_UNITS - 500);
  await assert.rejects(() => network.creditOrganization({ eventId: 'funding:user:1', organizationId: 'company:example', sourceType: 'USER_DIRECTED_ACTIVITY', amountUnits: 500 }), /credit source is invalid/);
  await network.collectBusinessDailyAllowance({ eventId: 'allowance:company:example:2026-08-13', organizationId: 'company:example', dayKey: '2026-08-13' });
  assert.equal(network.organizationStatement('company:example').balanceUnits, 2 * BUSINESS_DAILY_ALLOWANCE_UNITS - 500);
  assert.equal(await network.verifyChain(), true);
  await assert.rejects(() => network.recordImpression({ ...event.payload, eventId: 'impression:1' }), /Duplicate/);
  const capped = network.recommendPlacement({ campaignId: 'campaign:example', contentTokenId: 'content:painting-card',
    viewerPseudonym: 'viewer:opaque', day: '2026-08-12', contextTags: ['art'], consentScopes: [] });
  assert.equal(capped.eligible, false);
  assert.ok(capped.reasonCodes.includes('FREQUENCY_CAP'));
  console.log('Infinity advertising network: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
