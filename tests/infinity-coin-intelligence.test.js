'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const intelligence = require('../infinity-coin-intelligence.js');

test('coin documents include movie, song, artwork, and research attachment content', () => {
  const documents = intelligence.coinDocuments({ tokens: {
    'token:1': {
      tokenId: 'token:1', title: 'Collected Culture', kind: 'INFINITY_CAPITAL_NOTE', state: 'COLLECTIBLE',
      sourceSystem: 'INFINITY_MINT', contentDigest: 'digest-1', mintedAt: '2026-08-14T00:00:00Z',
      attachments: [
        { type: 'MOVIE', title: 'Film One', sourceUrl: 'https://example.test/movie' },
        { type: 'SONG', title: 'Song One', description: 'Audio recording' },
        { type: 'ARTWORK', title: 'Painting One', metadata: { artist: 'Artist' } },
        { type: 'RESEARCH', title: 'Paper One', content: { abstract: 'Evidence text' } }
      ]
    }
  }});
  assert.equal(documents.length, 1);
  assert.match(documents[0].text, /Film One/);
  assert.match(documents[0].text, /Song One/);
  assert.match(documents[0].text, /Painting One/);
  assert.match(documents[0].text, /Evidence text/);
});

test('attachment text safely flattens nested research records', () => {
  const text = intelligence.attachmentText({ type: 'RESEARCH', content: { sources: [{ title: 'Source A' }] } });
  assert.match(text, /Source A/);
});
