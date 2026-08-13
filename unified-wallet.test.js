'use strict';
const assert = require('node:assert/strict');
const { UnifiedInfinityWallet, memoryStorage } = require('./unified-wallet');

(async () => {
  const wallet = new UnifiedInfinityWallet({ storage: memoryStorage() });
  wallet.createWallet({ walletId: 'wallet:seller', displayName: 'Seller' });
  wallet.createWallet({ walletId: 'wallet:buyer', displayName: 'Buyer' });
  await wallet.creditSourceCoin({ eventId: 'credit:buyer:1', walletId: 'wallet:buyer', assetCode: 'INFINITY', amount: 100_000,
    sourceSystem: 'INFINITY_MINT', sourceEventId: 'mint:buyer:1', timestamp: '2026-08-12T00:00:00.000Z' });
  await wallet.creditSourceCoin({ eventId: 'credit:seller:crusher:1', walletId: 'wallet:seller', assetCode: 'BITCOIN_CRUSHER_COIN', amount: 3,
    sourceSystem: 'BITCOIN_CRUSHER', sourceEventId: 'spin:1', timestamp: '2026-08-12T00:01:00.000Z' });
  const blank = await wallet.receiveStarCoin({ eventId: 'star:receipt:1', fromWalletId: 'wallet:fan', toWalletId: 'wallet:seller',
    sourceEventId: 'starquest:share:1', sourceContentId: 'show:1|episode:1', timestamp: '2026-08-12T00:02:00.000Z' });
  assert.equal(blank.state, 'BLANK');
  const formatted = await wallet.formatBlankToken({ eventId: 'format:1', tokenId: blank.tokenId, ownerWalletId: 'wallet:seller',
    title: 'Point-in-time StarQuest token', contentDigest: 'sha256:formatted', attachments: [{ type: 'NOTE', text: 'Exact point preserved' }], timestamp: '2026-08-12T00:03:00.000Z' });
  assert.equal(formatted.sourceEventId, 'starquest:share:1');
  assert.equal(formatted.mintedAt, '2026-08-12T00:02:00.000Z');
  await wallet.createSale({ eventId: 'listing:1', saleId: 'sale:1', tokenId: blank.tokenId, sellerWalletId: 'wallet:seller', priceAsset: 'INFINITY', priceAmount: 25_000, timestamp: '2026-08-12T00:04:00.000Z' });
  const settled = await wallet.purchaseCollectible({ eventId: 'purchase:1', saleId: 'sale:1', buyerWalletId: 'wallet:buyer', timestamp: '2026-08-12T00:05:00.000Z' });
  assert.equal(settled.token.tokenId, blank.tokenId);
  assert.equal(settled.token.ownerWalletId, 'wallet:buyer');
  assert.equal(wallet.state.tokens[blank.tokenId].state, 'FORMATTED');
  assert.equal(wallet.balance('wallet:buyer', 'INFINITY'), 75_000);
  assert.equal(wallet.balance('wallet:seller', 'INFINITY'), 25_000);
  assert.equal(wallet.balance('wallet:seller', 'BITCOIN_CRUSHER_COIN'), 3);
  await wallet.recordNormalExchange({ eventId: 'exchange:unlock:1', walletId: 'wallet:buyer', sourceSystem: 'STARQUEST', sourceEventId: 'unlock:1',
    exchangeKind: 'MEDIA_UNLOCK', contentTokenId: 'show:1', consideration: { assetCode: 'STAR_COIN', amount: 1 }, timestamp: '2026-08-12T00:06:00.000Z', participants: [
      { id: 'company:movie-maker', name: 'Movie maker — unclaimed', beneficiaryClass: 'COMPANY', units: 1_000, claimStatus: 'UNCLAIMED' },
      { id: 'person:performer', name: 'Performer — unclaimed', beneficiaryClass: 'PERSON', units: 100, claimStatus: 'UNCLAIMED' },
    ] });
  assert.equal(wallet.state.payableAccounts['unclaimed:company:movie-maker'], 1_000);
  assert.equal(wallet.state.payableAccounts['unclaimed:person:performer'], 100);
  assert.equal(wallet.balance('wallet:buyer', 'INFINITY'), 75_000);
  assert.equal(await wallet.verifyChain(), true);
  await assert.rejects(() => wallet.receiveStarCoin({ eventId: 'star:receipt:1', fromWalletId: 'wallet:fan', toWalletId: 'wallet:seller', sourceEventId: 'starquest:share:1' }), /Duplicate/);
  console.log('Infinity unified wallet: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
