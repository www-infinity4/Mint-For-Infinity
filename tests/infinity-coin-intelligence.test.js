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

test('coin documents bound large attachment packets before indexing', () => {
  const documents = intelligence.coinDocuments({ tokens: {
    'token:large': {
      tokenId: 'token:large', title: 'Bounded research',
      attachments: [{ type: 'RESEARCH', title: 'Large packet', content: 'x'.repeat(50000) }]
    }
  }});
  assert.ok(documents[0].text.length <= 12000);
});

test('coin inventory values can be rendered without executing supplied markup', () => {
  assert.equal(intelligence.escapeHtml('<img src=x onerror="steal()">'), '&lt;img src=x onerror=&quot;steal()&quot;&gt;');
});

test('generic question words do not select an unrelated attachment', () => {
  const state = { tokens: { one: { tokenId: 'one', attachments: [{ type: 'LINK', title: 'Weather archive' }] } } };
  assert.equal(intelligence.conciseCoinAnswer('What is attached to the coin?', state), null);
});


test('coin questions return a concise matching attachment instead of dumping the whole packet', () => {
  const answer = intelligence.conciseCoinAnswer('What Coin Intelligence implementation record is attached?', { tokens: {
    'token:1': {
      tokenId: 'token:1',
      title: 'Research Coin',
      attachments: [{
        type: 'RESEARCH',
        title: 'Coin Intelligence implementation record',
        description: 'Ownership checked hashed attachment',
        sourceUrl: 'https://example.test/pull/16',
        contentDigest: 'cbbada934325d39bf3442efb04edeede'
      }]
    }
  }});
  assert.match(answer, /^RESEARCH: Coin Intelligence implementation record\./);
  assert.match(answer, /Attached to Research Coin/);
  assert.match(answer, /SHA-256: cbbada934325d39b/);
  assert.ok(answer.length < 300);
});
