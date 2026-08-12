(() => {
  'use strict';
  const wallet = new InfinityUnifiedWallet.UnifiedInfinityWallet();
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const uid = prefix => prefix + ':' + crypto.getRandomValues(new Uint32Array(2)).join('-');
  const now = () => new Date().toISOString();

  function current() { return wallet.state.currentWalletId ? wallet.state.wallets[wallet.state.currentWalletId] : null; }
  function render() {
    const connected = current();
    $('#walletId').textContent = connected ? connected.walletId : 'No wallet connected';
    $('#connect').textContent = connected ? 'Wallet connected' : 'Create Infinity wallet';
    $('#connect').disabled = Boolean(connected);
    const balances = connected ? Object.entries(connected.balances) : [];
    $('#balances').innerHTML = balances.length ? balances.map(([code, amount]) => `<article><b>${esc(code.replaceAll('_', ' '))}</b><strong>${Number(amount).toLocaleString()}</strong></article>`).join('') : '<p class="empty">No source coins recorded yet.</p>';
    const tokens = connected ? connected.tokenIds.map(id => wallet.state.tokens[id]).filter(Boolean) : [];
    $('#tokens').innerHTML = tokens.length ? tokens.map(token => `<article class="token"><div><b>${esc(token.title)}</b><span>${esc(token.kind)} · ${esc(token.state)}</span></div><code>${esc(token.tokenId)}</code><p>Owner: ${esc(token.ownerWalletId)}</p><p>Created: ${esc(token.mintedAt)}</p><p>Source event: ${esc(token.sourceEventId)}</p></article>`).join('') : '<p class="empty">No collectible or blank tokens yet.</p>';
    $('#eventCount').textContent = wallet.state.events.length.toLocaleString();
    $('#sourceCount').textContent = connected ? connected.sourceSystems.length.toLocaleString() : '0';
    $('#tokenCount').textContent = tokens.length.toLocaleString();
  }

  $('#connect').onclick = () => { wallet.createWallet({ displayName: 'Unified Infinity Wallet' }); render(); };
  $('#mintCredit').onclick = async () => {
    const owner = current(); if (!owner) return;
    await wallet.creditSourceCoin({ eventId: uid('wallet-event'), walletId: owner.walletId, assetCode: 'INFINITY_MINT_COIN', amount: 1, sourceSystem: 'INFINITY_MINT', sourceEventId: uid('mint'), timestamp: now() }); render();
  };
  $('#crusherCredit').onclick = async () => {
    const owner = current(); if (!owner) return;
    await wallet.creditSourceCoin({ eventId: uid('wallet-event'), walletId: owner.walletId, assetCode: 'BITCOIN_CRUSHER_COIN', amount: 1, sourceSystem: 'BITCOIN_CRUSHER', sourceEventId: uid('spin'), timestamp: now() }); render();
  };
  $('#alienCredit').onclick = async () => {
    const owner = current(); if (!owner) return;
    const id = uid('alien-coin');
    await wallet.importCollectible({ eventId: uid('wallet-event'), tokenId: id, ownerWalletId: owner.walletId, kind: 'ALIEN_COIN', sourceSystem: 'ALIEN_COIN', sourceEventId: uid('alien-mint'), title: 'Alien Coin collectible', contentDigest: 'demo:' + id, timestamp: now() }); render();
  };
  $('#starCredit').onclick = async () => {
    const owner = current(); if (!owner) return;
    await wallet.receiveStarCoin({ eventId: uid('wallet-event'), fromWalletId: 'wallet:star-sender', toWalletId: owner.walletId, sourceSystem: 'STARQUEST', sourceEventId: uid('star-share'), sourceContentId: 'starquest:demonstration', timestamp: now() }); render();
  };

  const params = new URLSearchParams(location.search);
  if (params.get('connect') === '1') {
    $('#approval').hidden = false;
    $('#approve').onclick = () => {
      const connected = current() || wallet.createWallet({ displayName: 'Unified Infinity Wallet' });
      const requestedOrigin = params.get('origin');
      const action = params.get('action');
      const finish = async () => {
        let importedTokenId = null;
        if (action === 'import-collectible') {
          importedTokenId = String(params.get('tokenId') || '');
          if (importedTokenId && !wallet.state.tokens[importedTokenId]) await wallet.importCollectible({
            eventId: 'wallet-import:' + importedTokenId, tokenId: importedTokenId, ownerWalletId: connected.walletId,
            kind: params.get('kind') || 'COLLECTIBLE', sourceSystem: params.get('sourceSystem') || 'EXTERNAL_INFINITY_PAGE',
            sourceEventId: params.get('sourceEventId') || importedTokenId, title: params.get('title') || 'Infinity collectible',
            contentDigest: params.get('contentDigest') || ('token-id:' + importedTokenId), timestamp: params.get('timestamp') || new Date().toISOString(),
          });
        }
        if (window.opener && requestedOrigin && /^https?:\/\//.test(requestedOrigin)) window.opener.postMessage({ type: 'INFINITY_WALLET_CONNECTED', wallet: { walletId: connected.walletId, displayName: connected.displayName }, importedTokenId }, requestedOrigin);
        $('#approvalStatus').textContent = importedTokenId ? 'Collectible added to the unified wallet. You may close this window.' : 'Connected. You may close this window.';
        render();
      };
      finish().catch(error => { $('#approvalStatus').textContent = 'Wallet action failed: ' + error.message; });
    };
  }
  render();
})();
