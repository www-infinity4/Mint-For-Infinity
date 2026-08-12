'use strict';

const assert = require('node:assert/strict');
const { InfinityWorkforce, WORKERS } = require('./ai-workforce');

(async () => {
  const manifest = {
    schema: 'infinity/catalog-provenance-manifest/v1', scope: 'TEST',
    contentTokens: [{ id: 'content:1', title: 'Test', kind: 'MOVIE', tags: ['film'], claimantCandidateIds: ['claimant:1'], provenance: [{ sourcePath: 'data.js' }] }],
    claimantCandidates: [{ id: 'claimant:1', name: 'Unknown rights holder', role: 'RIGHTS_HOLDER', claimStatus: 'UNCLAIMED', provenance: { sourcePath: 'data.js' } }],
  };
  const workforce = new InfinityWorkforce({ rateUnits: 100 });
  const run = await workforce.run({ manifest, instruction: 'Build the royalty system', startedAt: '2026-08-12T00:00:00.000Z', finishedAt: '2026-08-12T00:00:01.000Z' });
  assert.equal(WORKERS.length, 7);
  assert.equal(run.outputs.ledgerPlans[0].productionCompanyUnitsEach, 1_000);
  assert.equal(run.outputs.ledgerPlans[0].creditedPersonUnitsEach, 100);
  assert.equal(run.outputs.ledgerPlans[0].viewerChargeUnits, 0);
  assert.equal(run.outputs.rightsQueue[0].releaseAllowed, false);
  assert.equal(run.outputs.campaignPlans[0].defaultCostPerQualifiedImpressionUnits, 2_000);
  assert.equal(run.outputs.pagePlans.length, 5);
  assert.equal(run.modelStatus, 'DETERMINISTIC_ENGINE_ONLY');
  assert.ok(run.audit.blockers.includes('UNVERIFIED_CLAIMANTS_HELD'));
  console.log('Infinity AI workforce: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
