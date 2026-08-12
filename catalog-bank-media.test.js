'use strict';
const assert = require('node:assert/strict');
const { buildOpeningAccounts } = require('./catalog-bank');
const { createCosmoPlan } = require('./media-intelligence');
(async () => {
  const manifest = { schema: 'infinity/catalog-provenance-manifest/v1', source: { repository: 'test/repo', path: 'data.js', ref: 'main' }, scope: 'TEST', claimantCandidates: [
    { id: 'claimant:studio', name: 'Example Studio', role: 'PRODUCTION_COMPANY', provenance: [{ sourcePath: 'data.js' }] },
    { id: 'claimant:actor', name: 'Example Actor', role: 'PERFORMER', provenance: [{ sourcePath: 'data.js' }] },
  ] };
  const bank = await buildOpeningAccounts(manifest, { createdAt: '2026-08-12T00:00:00.000Z' });
  assert.equal(bank.summary.companyAccounts, 1);
  assert.equal(bank.summary.personAccounts, 1);
  assert.equal(bank.summary.totalOpeningUnits, 1_100);
  assert.equal(bank.accounts[0].availableToClaimUnits, 0);
  assert.equal(bank.accounts[0].protectedPendingUnits, 1_000);
  assert.equal(bank.accounts[0].businessAllowancePolicy.dailyCapUnits, 10_000_000);
  assert.equal(bank.accounts[0].businessAllowancePolicy.unusedBalanceAccumulates, true);
  assert.equal(bank.accounts[1].businessAllowancePolicy, null);
  assert.equal(bank.evidenceClass, 'CATALOG_DISCOVERY_NOT_AI_WATCH_RECEIPT');
  assert.equal(bank.event.postings.reduce((sum, p) => sum + p.debitUnits, 0), bank.event.postings.reduce((sum, p) => sum + p.creditUnits, 0));

  const digest = 'a'.repeat(64);
  const plan = createCosmoPlan({ watchReceipt: { contentTokenId: 'movie:1', status: 'AI_WATCHED_MEDIA', modelId: 'local-gemma', startedAt: '2026-08-12T00:00:00Z', finishedAt: '2026-08-12T01:30:00Z', mediaDigest: digest, analysisDigest: digest, cues: [
    { startSeconds: 40, endSeconds: 55, observation: 'A kitchen sink cabinet is damaged.', tags: ['cabinet', 'plumbing'], missedDetail: 'Water staining below the trap.' },
    { startSeconds: 90, endSeconds: 95, observation: 'A soft-drink can appears.', tags: ['soft drink'] },
  ] }, products: [
    { id: 'cabinet:local', name: 'Local cabinet installation', brand: 'Local Cabinet Co', tags: ['cabinet', 'plumbing'], local: true, helpText: 'A local cabinet and plumbing estimate may solve this open need.' },
    { id: 'drink:mt-dew', name: 'Mountain Dew', brand: 'Mountain Dew', tags: ['soft drink', 'mountain dew'] },
  ], viewerProfile: { openNeeds: ['cabinet'], dislikes: ['mountain dew'], blocked: [], likes: [], completedPurchases: [], locationConsent: true } });
  assert.equal(plan.summary.recommendations, 1);
  assert.equal(plan.moments[0].recommendation.productId, 'cabinet:local');
  assert.equal(plan.moments[1].recommendation, null);
  console.log('Infinity catalog bank and Cosmo media intelligence: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
