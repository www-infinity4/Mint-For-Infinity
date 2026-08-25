'use strict';
const assert = require('node:assert/strict');
const { createCardsForCoin } = require('./media-card');

(async () => {
  const base = { coinId: 'coin:1', capturedAt: '2026-08-25T12:00:00.000Z' };
  const cards = await createCardsForCoin({ coinId: base.coinId, media: [
    { ...base, mediaKind: 'MOVIE', mediaId: 'movie:1', title: 'Movie One', frame: { status: 'CAPTURED', imageUrl: 'data:image/jpeg;base64,AA==', contentDigest: 'sha256:movie', playbackSeconds: 42, sourceUrl: 'https://example.test/movie', captureAgent: 'SONA' } },
    { ...base, mediaKind: 'SONG', mediaId: 'song:1', title: 'Song One', frame: { status: 'PENDING_SOURCE_PERMISSION', failureReason: 'Cross-origin player blocks canvas capture.', captureAgent: 'SONA' } }
  ] });
  assert.equal(cards.length, 2);
  assert.equal(cards[0].edition, '1/1');
  assert.equal(cards[0].frame.captureAgent, 'SONA');
  assert.notEqual(cards[0].cardId, cards[1].cardId);
  await assert.rejects(() => createCardsForCoin({ coinId: 'coin:2', media: [] }), /movie or song/);
  console.log('Infinity media cards: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
