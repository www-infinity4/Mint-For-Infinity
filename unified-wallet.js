(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityUnifiedWallet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'infinity_unified_wallet_v1';
  const SCHEMA = 'infinity/unified-wallet/v1';
  const ASSET_CODES = new Set(['INFINITY', 'ALIEN_COIN', 'BITCOIN_CRUSHER_COIN', 'INFINITY_MINT_COIN']);

  function invariant(condition, message) { if (!condition) throw new Error(message); }
  function clean(value, label) { const result = String(value || '').trim(); invariant(result, label + ' is required.'); return result; }
  function integer(value, label) { const result = Number(value); invariant(Number.isSafeInteger(result) && result >= 0, label + ' must be a non-negative safe integer.'); return result; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function sha256(value) {
    const input = canonical(value);
    if (typeof require === 'function') return require('node:crypto').createHash('sha256').update(input).digest('hex');
    invariant(globalThis.crypto && globalThis.crypto.subtle, 'SHA-256 is unavailable.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function memoryStorage() {
    const values = {};
    return { getItem: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
      setItem: (key, value) => { values[key] = String(value); }, removeItem: key => { delete values[key]; } };
  }
  function emptyState() {
    return { schema: SCHEMA, currentWalletId: null, wallets: {}, tokens: {}, sales: {}, payableAccounts: {}, events: [], updatedAt: null };
  }

  class UnifiedInfinityWallet {
    constructor(options = {}) {
      this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
      this.state = this.load();
      this.processedEventIds = new Set(this.state.events.map(event => event.eventId));
    }
    load() {
      try {
        const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) || 'null');
        if (parsed && parsed.schema === SCHEMA) return { ...emptyState(), ...parsed, payableAccounts: parsed.payableAccounts || {} };
      } catch (_) {}
      return emptyState();
    }
    save() {
      this.state.updatedAt = new Date().toISOString();
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      return this.snapshot();
    }
    snapshot() { return clone(this.state); }
    createWallet(input = {}) {
      const walletId = clean(input.walletId || ('infinity-wallet:' + Math.random().toString(36).slice(2) + Date.now().toString(36)), 'walletId');
      if (!this.state.wallets[walletId]) this.state.wallets[walletId] = { walletId, displayName: String(input.displayName || 'Infinity Wallet'),
        createdAt: input.createdAt || new Date().toISOString(), balances: {}, tokenIds: [], sourceSystems: [] };
      this.state.currentWalletId = walletId;
      this.save();
      return clone(this.state.wallets[walletId]);
    }
    createProvisionalWallet(input = {}) {
      const walletId = clean(input.walletId, 'walletId');
      if (!this.state.wallets[walletId]) this.state.wallets[walletId] = { walletId, displayName: String(input.displayName || 'Provisional Infinity Wallet'),
        createdAt: input.createdAt || new Date().toISOString(), claimStatus: 'UNCLAIMED', balances: {}, tokenIds: [], sourceSystems: [] };
      this.save(); return clone(this.state.wallets[walletId]);
    }
    connectWallet(walletId) {
      invariant(this.state.wallets[walletId], 'Wallet is not registered on this device.');
      this.state.currentWalletId = walletId;
      this.save();
      return clone(this.state.wallets[walletId]);
    }
    wallet(walletId) { const wallet = this.state.wallets[walletId || this.state.currentWalletId]; invariant(wallet, 'Connected Infinity wallet is required.'); return wallet; }
    balance(walletId, assetCode) { return Number(this.wallet(walletId).balances[String(assetCode || '').toUpperCase()] || 0); }
    async append(eventId, type, payload, timestamp) {
      eventId = clean(eventId, 'eventId');
      invariant(!this.processedEventIds.has(eventId), 'Duplicate wallet event.');
      const prevHash = this.state.events.length ? this.state.events[this.state.events.length - 1].hash : null;
      const body = { schema: 'infinity/unified-wallet-event/v1', sequence: this.state.events.length + 1, eventId, type,
        timestamp: timestamp || new Date().toISOString(), prevHash, payload: clone(payload) };
      const event = { ...body, hash: await sha256(body) };
      this.state.events.push(event);
      this.processedEventIds.add(eventId);
      this.save();
      return clone(event);
    }
    async creditSourceCoin(input) {
      const wallet = this.wallet(input.walletId);
      const assetCode = clean(input.assetCode, 'assetCode').toUpperCase();
      invariant(ASSET_CODES.has(assetCode), 'Asset code is not supported.');
      const amount = integer(input.amount, 'amount');
      invariant(amount > 0, 'Credit amount must be positive.');
      const sourceSystem = clean(input.sourceSystem, 'sourceSystem');
      const payload = { walletId: wallet.walletId, assetCode, amount, sourceSystem,
        sourceEventId: clean(input.sourceEventId, 'sourceEventId'), proof: clone(input.proof || {}) };
      await this.append(input.eventId, 'SOURCE_COIN_CREDITED', payload, input.timestamp);
      wallet.balances[assetCode] = Number(wallet.balances[assetCode] || 0) + amount;
      if (!wallet.sourceSystems.includes(sourceSystem)) wallet.sourceSystems.push(sourceSystem);
      this.save();
      return clone(payload);
    }
    async receiveStarCoin(input) {
      const wallet = this.wallet(input.toWalletId);
      const payload = { fromWalletId: clean(input.fromWalletId, 'fromWalletId'), toWalletId: wallet.walletId,
        sourceSystem: clean(input.sourceSystem || 'STARQUEST', 'sourceSystem'), sourceEventId: clean(input.sourceEventId, 'sourceEventId'),
        sourceContentId: input.sourceContentId ? String(input.sourceContentId) : null,
        receivedAt: input.timestamp || new Date().toISOString() };
      const digest = await sha256(payload);
      const tokenId = 'infinity:blank:' + digest.slice(0, 24);
      invariant(!this.state.tokens[tokenId], 'Star Coin receipt was already converted.');
      await this.append(input.eventId, 'STAR_COIN_CONVERTED_TO_BLANK_TOKEN', { ...payload, tokenId }, input.timestamp);
      this.state.tokens[tokenId] = { tokenId, kind: 'BLANK_INFINITY_TOKEN', state: 'BLANK', ownerWalletId: wallet.walletId,
        mintedAt: payload.receivedAt, sourceAsset: 'STAR_COIN', sourceEventId: payload.sourceEventId, sourceContentId: payload.sourceContentId,
        title: 'Blank Infinity Token', attachments: [], provenanceEventIds: [input.eventId] };
      wallet.tokenIds.push(tokenId);
      if (!wallet.sourceSystems.includes(payload.sourceSystem)) wallet.sourceSystems.push(payload.sourceSystem);
      this.save();
      return clone(this.state.tokens[tokenId]);
    }
    async recordNormalExchange(input) {
      const wallet = this.wallet(input.walletId);
      const participants = Array.isArray(input.participants) ? input.participants.map(item => ({
        id: clean(item.id, 'participant id'), name: clean(item.name, 'participant name'),
        beneficiaryClass: String(item.beneficiaryClass || 'PERSON').toUpperCase(),
        units: integer(item.units, 'participant units'), claimStatus: String(item.claimStatus || 'UNCLAIMED').toUpperCase(),
      })) : [];
      invariant(participants.length > 0, 'Normal exchange requires at least one payable participant or unresolved reserve.');
      participants.forEach(item => invariant(item.beneficiaryClass === 'COMPANY' || item.beneficiaryClass === 'PERSON', 'Participant class is invalid.'));
      const consideration = { assetCode: clean(input.consideration && input.consideration.assetCode, 'consideration assetCode').toUpperCase(),
        amount: integer(input.consideration && input.consideration.amount, 'consideration amount') };
      const payload = { walletId: wallet.walletId, sourceSystem: clean(input.sourceSystem, 'sourceSystem'),
        sourceEventId: clean(input.sourceEventId, 'sourceEventId'), exchangeKind: clean(input.exchangeKind, 'exchangeKind').toUpperCase(),
        contentTokenId: clean(input.contentTokenId, 'contentTokenId'), consideration, participants };
      await this.append(input.eventId, 'NORMAL_EXCHANGE_ROYALTIES_RECORDED', payload, input.timestamp);
      participants.forEach(item => {
        const accountId = (item.claimStatus === 'VERIFIED' ? 'payable:' : 'unclaimed:') + item.id;
        this.state.payableAccounts[accountId] = Number(this.state.payableAccounts[accountId] || 0) + item.units;
      });
      this.save(); return clone(payload);
    }
    async formatBlankToken(input) {
      const token = this.state.tokens[input.tokenId];
      invariant(token && token.kind === 'BLANK_INFINITY_TOKEN', 'Blank Infinity token is required.');
      invariant(token.ownerWalletId === input.ownerWalletId, 'Only the current owner can format this token.');
      const payload = { tokenId: token.tokenId, ownerWalletId: token.ownerWalletId, title: clean(input.title, 'title'),
        contentDigest: clean(input.contentDigest, 'contentDigest'), attachments: Array.isArray(input.attachments) ? clone(input.attachments) : [] };
      await this.append(input.eventId, 'BLANK_TOKEN_FORMATTED', payload, input.timestamp);
      token.state = 'FORMATTED'; token.title = payload.title; token.contentDigest = payload.contentDigest;
      token.attachments = payload.attachments; token.provenanceEventIds.push(input.eventId);
      this.save(); return clone(token);
    }
    async importCollectible(input) {
      const wallet = this.wallet(input.ownerWalletId);
      const tokenId = clean(input.tokenId, 'tokenId');
      invariant(!this.state.tokens[tokenId], 'Collectible token already exists.');
      const payload = { tokenId, ownerWalletId: wallet.walletId, kind: clean(input.kind, 'kind').toUpperCase(),
        sourceSystem: clean(input.sourceSystem, 'sourceSystem'), sourceEventId: clean(input.sourceEventId, 'sourceEventId'),
        title: clean(input.title, 'title'), contentDigest: clean(input.contentDigest, 'contentDigest'),
        verificationState: String(input.verificationState || 'UNVERIFIED_SOURCE_IMPORT').toUpperCase() };
      await this.append(input.eventId, 'COLLECTIBLE_IMPORTED', payload, input.timestamp);
      this.state.tokens[tokenId] = { ...payload, state: 'COLLECTIBLE', mintedAt: input.timestamp || new Date().toISOString(),
        attachments: clone(input.attachments || []), provenanceEventIds: [input.eventId] };
      wallet.tokenIds.push(tokenId);
      if (!wallet.sourceSystems.includes(payload.sourceSystem)) wallet.sourceSystems.push(payload.sourceSystem);
      this.save(); return clone(this.state.tokens[tokenId]);
    }
    async attachToToken(input) {
      const token = this.state.tokens[input.tokenId];
      invariant(token, 'Owned Infinity token is required.');
      invariant(token.ownerWalletId === input.ownerWalletId, 'Only the current owner can attach material to this token.');
      const attachment = {
        attachmentId: clean(input.attachmentId, 'attachmentId'),
        type: clean(input.type, 'attachment type').toUpperCase(),
        title: clean(input.title, 'attachment title'),
        sourceUrl: input.sourceUrl ? String(input.sourceUrl) : null,
        description: input.description ? String(input.description) : null,
        contentDigest: clean(input.contentDigest, 'contentDigest'),
        metadata: clone(input.metadata || {}),
        addedAt: input.timestamp || new Date().toISOString()
      };
      invariant(!token.attachments.some(item => item.attachmentId === attachment.attachmentId), 'Attachment already exists on this token.');
      const payload = { tokenId: token.tokenId, ownerWalletId: token.ownerWalletId, attachment };
      await this.append(input.eventId, 'TOKEN_ATTACHMENT_ADDED', payload, input.timestamp);
      token.attachments.push(attachment);
      token.provenanceEventIds.push(input.eventId);
      this.save();
      return clone(attachment);
    }
    async createSale(input) {
      const token = this.state.tokens[input.tokenId];
      invariant(token && token.ownerWalletId === input.sellerWalletId, 'Seller must own the complete token.');
      invariant(!Object.values(this.state.sales).some(sale => sale.tokenId === token.tokenId && sale.state === 'OPEN'), 'Token already has an open sale.');
      const saleId = clean(input.saleId, 'saleId');
      const priceAsset = clean(input.priceAsset || 'INFINITY', 'priceAsset').toUpperCase();
      invariant(ASSET_CODES.has(priceAsset), 'Sale asset is not supported.');
      const sale = { saleId, tokenId: token.tokenId, sellerWalletId: token.ownerWalletId, priceAsset,
        priceAmount: integer(input.priceAmount, 'priceAmount'), state: 'OPEN', createdAt: input.timestamp || new Date().toISOString() };
      await this.append(input.eventId, 'COLLECTIBLE_LISTED', sale, input.timestamp);
      this.state.sales[saleId] = sale; this.save(); return clone(sale);
    }
    async purchaseCollectible(input) {
      const sale = this.state.sales[input.saleId];
      invariant(sale && sale.state === 'OPEN', 'Open collectible sale is required.');
      const token = this.state.tokens[sale.tokenId];
      const buyer = this.wallet(input.buyerWalletId);
      const seller = this.wallet(sale.sellerWalletId);
      invariant(buyer.walletId !== seller.walletId, 'Buyer and seller must be different wallets.');
      invariant(token.ownerWalletId === seller.walletId, 'Seller no longer owns the token.');
      invariant(Number(buyer.balances[sale.priceAsset] || 0) >= sale.priceAmount, 'Buyer balance is insufficient.');
      const payload = { saleId: sale.saleId, tokenId: token.tokenId, fromWalletId: seller.walletId,
        toWalletId: buyer.walletId, payment: { assetCode: sale.priceAsset, amount: sale.priceAmount } };
      await this.append(input.eventId, 'COLLECTIBLE_SALE_SETTLED', payload, input.timestamp);
      buyer.balances[sale.priceAsset] -= sale.priceAmount;
      seller.balances[sale.priceAsset] = Number(seller.balances[sale.priceAsset] || 0) + sale.priceAmount;
      seller.tokenIds = seller.tokenIds.filter(id => id !== token.tokenId);
      buyer.tokenIds.push(token.tokenId);
      token.ownerWalletId = buyer.walletId;
      token.provenanceEventIds.push(input.eventId);
      sale.state = 'SETTLED'; sale.settledAt = input.timestamp || new Date().toISOString(); sale.buyerWalletId = buyer.walletId;
      this.save(); return { token: clone(token), sale: clone(sale) };
    }
    async verifyChain() {
      let prevHash = null;
      for (let index = 0; index < this.state.events.length; index += 1) {
        const event = this.state.events[index]; const { hash, ...body } = event;
        if (event.sequence !== index + 1 || event.prevHash !== prevHash || await sha256(body) !== hash) return false;
        prevHash = hash;
      }
      return true;
    }
  }

  return { UnifiedInfinityWallet, STORAGE_KEY, ASSET_CODES, memoryStorage, sha256 };
});
