'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnifiedInfinityWallet, memoryStorage } = require('../unified-wallet.js');

test('only the owner can add a typed hashed attachment to a complete token', async () => {
  const wallet = new UnifiedInfinityWallet({ storage: memoryStorage() });
  const owner = wallet.createWallet({ walletId: 'wallet:owner' });
  await wallet.importCollectible({
    eventId: 'event:import',
    tokenId: 'token:collected-culture',
    ownerWalletId: owner.walletId,
    kind: 'INFINITY_CAPITAL_NOTE',
    sourceSystem: 'INFINITY_MINT',
    sourceEventId: 'mint:1',
    title: 'Collected Culture',
    contentDigest: 'digest:token',
    timestamp: '2026-08-14T00:00:00Z'
  });

  const attachment = await wallet.attachToToken({
    eventId: 'event:attachment',
    tokenId: 'token:collected-culture',
    ownerWalletId: owner.walletId,
    attachmentId: 'attachment:movie-1',
    type: 'movie',
    title: 'Movie One',
    sourceUrl: 'https://example.test/movie',
    description: 'Preserved movie source',
    contentDigest: 'digest:movie',
    timestamp: '2026-08-14T00:01:00Z'
  });

  assert.equal(attachment.type, 'MOVIE');
  assert.equal(wallet.state.tokens['token:collected-culture'].attachments.length, 1);
  assert.equal(wallet.state.tokens['token:collected-culture'].provenanceEventIds.at(-1), 'event:attachment');
  assert.equal(wallet.state.events.at(-1).type, 'TOKEN_ATTACHMENT_ADDED');
  assert.equal(await wallet.verifyChain(), true);

  await assert.rejects(() => wallet.attachToToken({
    eventId: 'event:wrong-owner',
    tokenId: 'token:collected-culture',
    ownerWalletId: 'wallet:other',
    attachmentId: 'attachment:song-1',
    type: 'SONG',
    title: 'Song One',
    contentDigest: 'digest:song'
  }), /Only the current owner/);
});
