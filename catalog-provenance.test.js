'use strict';

const assert = require('node:assert/strict');
const { scanStarQuestCatalog, scanCardCatalog } = require('./catalog-provenance');

const generatedAt = '2026-08-12T12:00:00.000Z';
const starquest = scanStarQuestCatalog([{ id: 'show-1', title: 'Example Show', genre: ['Drama'], episodes: [
  { id: 'ep-1', title: 'Pilot', archiveId: 'example-show-pilot' },
] }], { generatedAt });
assert.equal(starquest.summary.showsScanned, 1);
assert.equal(starquest.summary.contentTokens, 2);
assert.equal(starquest.contentTokens[1].links[0], 'https://archive.org/details/example-show-pilot');
assert.ok(starquest.claimantCandidates.some(item => item.role === 'RIGHTS_HOLDER'));
assert.ok(starquest.claimantCandidates.every(item => item.claimStatus === 'UNCLAIMED'));
assert.ok(starquest.claimantCandidates.every(item => item.provenance.every(record => record.sourcePath === 'js/data.js')));

const cards = scanCardCatalog([{ id: 'card-1', title: 'Example Player 1/1', player: 'Example Player', team: 'Example Team', brand: 'Example Brand' }], { generatedAt });
assert.equal(cards.summary.cardsScanned, 1);
assert.equal(cards.summary.claimantCandidates, 3);
assert.deepEqual(cards.claimantCandidates.map(item => item.role).sort(), ['BRAND', 'PLAYER', 'TEAM']);
assert.ok(cards.contentTokens[0].claimantCandidateIds.length === 3);
console.log('Infinity catalog provenance scanner: PASS');
