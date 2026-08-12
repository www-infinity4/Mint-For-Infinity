'use strict';

const assert = require('node:assert/strict');
const {
  RoyaltyLedger,
  UNITS_PER_INFINITY,
  PROGRAM_LIMITS,
} = require('./royalty-ledger');

(async () => {
  const ledger = new RoyaltyLedger({ mode: 'SIMULATION' });
  await ledger.registerAsset({
    id: 'film:example-001',
    title: 'Example Catalog Film',
    sourceUrl: 'https://archive.org/details/example',
    perceivedValueUnits: UNITS_PER_INFINITY,
    evidenceState: 'USER_DEFINED',
    rightsOwners: [{
      id: 'rights:unknown', name: 'Rights owner — unclaimed', role: 'RIGHTS_OWNER',
      shareBps: 10_000, claimStatus: 'UNCLAIMED',
    }],
    talent: [{
      id: 'talent:verified', name: 'Verified performer', role: 'TALENT',
      shareBps: 10_000, claimStatus: 'VERIFIED', walletId: 'wallet:performer',
      verificationRecordId: 'verification:performer:1',
    }],
    timestamp: '2026-08-12T00:00:00.000Z',
  });

  const event = await ledger.recordView({
    eventId: 'view:001', assetId: 'film:example-001', viewerWalletId: 'viewer:001',
    watchedSeconds: 95, durationSeconds: 100,
    verification: { status: 'SIMULATED', evidenceHash: 'test-only' },
    timestamp: '2026-08-12T00:01:00.000Z',
  });
  assert.equal(event.type, 'VIEW_ALLOCATION_SIMULATION');
  assert.equal(event.postings.reduce((sum, item) => sum + item.debitUnits, 0), 1_100);
  assert.equal(event.postings.reduce((sum, item) => sum + item.creditUnits, 0), 1_100);

  const balances = ledger.balances();
  assert.equal(balances['simulation:unclaimed:rights_owner:film:example-001:rights:unknown'], 1_000);
  assert.equal(balances['simulation:wallet:wallet:performer:talent'], 100);
  assert.equal(balances['simulation:wallet:viewer:001:viewer-reward'], 0);

  await assert.rejects(() => ledger.recordView({
    eventId: 'view:001', assetId: 'film:example-001', viewerWalletId: 'viewer:001',
    watchedSeconds: 95, durationSeconds: 100, verification: { status: 'SIMULATED' },
  }), /Duplicate/);

  const authoritative = new RoyaltyLedger({ mode: 'AUTHORITATIVE' });
  await authoritative.registerAsset({
    id: 'film:authoritative', title: 'Authoritative Example', perceivedValueUnits: UNITS_PER_INFINITY,
    rightsOwners: [], talent: [], timestamp: '2026-08-12T00:00:00.000Z',
  });
  await assert.rejects(() => authoritative.recordView({
    eventId: 'view:bad', assetId: 'film:authoritative', viewerWalletId: 'viewer:001',
    watchedSeconds: 100, durationSeconds: 100, verification: { status: 'SIMULATED' },
  }), /VERIFIED/);

  await ledger.recordProgramProposal({
    id: 'tree-grant', name: 'Verified tree planting', beneficiary: 'Verified planter',
    amountUnits: PROGRAM_LIMITS.verifiedTreePlantingGrantUnits,
    requirements: ['identity', 'planting evidence', 'species and location review'],
    timestamp: '2026-08-12T00:02:00.000Z',
  });
  assert.equal(ledger.proposals[0].createsSpendableBalance, false);
  assert.equal(await ledger.verifyChain(), true);

  const tampered = new RoyaltyLedger(ledger.toJSON());
  tampered.events[1].postings[0].debitUnits += 1;
  assert.equal(await tampered.verifyChain(), false);
  assert.equal(PROGRAM_LIMITS.dailyNoteMintUnits, 100_000);
  assert.equal(PROGRAM_LIMITS.dailyRetailSpendUnits, 3_000_000);
  console.log('Infinity royalty ledger contract: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
