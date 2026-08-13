(function (root) {
  'use strict';
  const HUB_URL = 'https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.html';
  function engine() {
    if (!root.InfinityUnifiedWallet) throw new Error('Infinity unified wallet engine is not loaded.');
    return new root.InfinityUnifiedWallet.UnifiedInfinityWallet();
  }
  function connectLocal(displayName) {
    const wallet = engine();
    if (wallet.state.currentWalletId && wallet.state.wallets[wallet.state.currentWalletId]) return wallet.wallet();
    return wallet.createWallet({ displayName: displayName || 'Infinity Wallet' });
  }
  function connectByPopup() {
    return new Promise((resolve, reject) => {
      const url = HUB_URL + '?connect=1&origin=' + encodeURIComponent(location.origin);
      const popup = window.open(url, 'infinity-unified-wallet', 'width=520,height=760');
      if (!popup) return reject(new Error('Wallet popup was blocked.'));
      const timeout = setTimeout(() => { window.removeEventListener('message', onMessage); reject(new Error('Wallet connection timed out.')); }, 120000);
      function onMessage(event) {
        if (event.origin !== new URL(HUB_URL).origin || !event.data || event.data.type !== 'INFINITY_WALLET_CONNECTED') return;
        clearTimeout(timeout); window.removeEventListener('message', onMessage); resolve(event.data.wallet);
      }
      window.addEventListener('message', onMessage);
    });
  }
  async function connect(options = {}) {
    return location.origin === new URL(HUB_URL).origin ? connectLocal(options.displayName) : connectByPopup();
  }
  root.InfinityWalletClient = { HUB_URL, connect, connectLocal, engine };
})(typeof globalThis !== 'undefined' ? globalThis : this);
