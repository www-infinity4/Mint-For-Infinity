'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const scanner = require('../infinity-network-scanner.js');

const events = [
  { sequence: 1, eventId: 'mint:1', type: 'MINT_COMPLETED', sourceSite: 'INFINITY_MINT', timestamp: '2026-08-14T10:00:00Z', hash: 'a', previousHash: null, payload: { serial: 'IC-1' } },
  { sequence: 2, eventId: 'crusher:1', type: 'RESEARCH_TOKEN_CREATED', sourceSite: 'BITCOIN_CRUSHER', timestamp: '2026-08-14T10:01:00Z', hash: 'b', previousHash: 'a', actorWalletId: 'wallet:1', payload: { title: 'Evidence brief', tokenId: 'research-1' } }
];

test('scanner filters site events without changing the ledger', () => {
  const filtered = scanner.filterEvents(events, { sourceSite: 'bitcoin_crusher' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].eventId, 'crusher:1');
  assert.equal(events.length, 2);
});

test('scanner creates an auditable event summary', () => {
  const summary = scanner.summarizeEvent(events[1]);
  assert.equal(summary.sequence, 2);
  assert.equal(summary.title, 'Evidence brief');
  assert.equal(summary.actorWalletId, 'wallet:1');
  assert.equal(summary.previousHash, 'a');
});

test('scanner escapes event text before rendering', () => {
  assert.equal(scanner.escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
