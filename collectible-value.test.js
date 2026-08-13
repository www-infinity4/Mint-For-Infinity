'use strict';

const assert = require('node:assert/strict');
const { createCollectibleNote, addAttachment, recordMarketObservation, valueStatement } = require('./collectible-value');

(() => {
  const note = createCollectibleNote({ tokenId: 'note:example:1', serial: 'commit:abc123', faceUnits: 10_000 });
  addAttachment(note, { id: 'signature:1', type: 'SIGNATURE', creatorName: 'Example signer', contentDigest: 'sha256:signature', createdAt: '2026-08-12T00:00:00.000Z', verificationState: 'PENDING' });
  addAttachment(note, { id: 'video:1', type: 'VIDEO', creatorName: 'Example signer', contentDigest: 'sha256:video', createdAt: '2026-08-12T00:01:00.000Z' });
  recordMarketObservation(note, { id: 'sale:1', kind: 'COMPLETED_SALE', amount: 1_000, currency: 'USD', source: 'marketplace:example', observedAt: '2026-08-12T00:02:00.000Z' });
  const statement = valueStatement(note);
  assert.equal(statement.faceUnits, 10_000);
  assert.equal(statement.attachmentCount, 2);
  assert.equal(statement.marketObservations[0].binding, false);
  assert.match(statement.rule, /do not alter ledger face units/);
  console.log('Infinity collectible value records: PASS');
})();
