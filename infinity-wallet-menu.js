(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityWalletMenu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const WIDGET_ID = 'infinity-unified-wallet-menu';
  const STYLE_ID = 'infinity-unified-wallet-menu-style';
  const WALLET_SCRIPT = 'https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260814-menu1';
  const WALLET_PAGE = 'https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.html';
  const STORAGE_KEY = 'infinity_unified_wallet_v1';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function walletSummary(state) {
    const walletId = state && state.currentWalletId;
    const wallet = walletId && state.wallets ? state.wallets[walletId] : null;
    if (!wallet) return {
      connected: false,
      label: 'Unified Infinity Wallet',
      detail: 'Open or create wallet',
      walletId: null,
      balances: {},
      tokenCount: 0
    };
    const balances = wallet.balances || {};
    const balanceText = Object.entries(balances)
      .filter(([, amount]) => Number(amount) !== 0)
      .map(([code, amount]) => code.replaceAll('_', ' ') + ' ' + Number(amount).toLocaleString())
      .join(' · ');
    return {
      connected: true,
      label: 'Unified Wallet · ' + wallet.walletId.slice(-8),
      detail: balanceText || (wallet.tokenIds || []).length + ' whole token' + ((wallet.tokenIds || []).length === 1 ? '' : 's'),
      walletId: wallet.walletId,
      balances,
      tokenCount: (wallet.tokenIds || []).length
    };
  }

  function findPlacement(doc) {
    const explicit = doc.querySelector('[data-infinity-wallet-slot]');
    if (explicit) return { container: explicit, mode: 'slot' };

    const existingWallet = Array.from(doc.querySelectorAll('a,button,[role="button"]')).find(element =>
      element.id !== WIDGET_ID && /wallet/i.test((element.textContent || '') + ' ' + (element.id || '') + ' ' + (element.className || ''))
    );
    const menuSelectors = ['#hamDrawer', '.ham-drawer', '[data-menu-drawer]', '.menu-drawer', '#sidebar', '.sidebar'];
    const menu = menuSelectors.map(selector => doc.querySelector(selector)).find(Boolean);
    if (existingWallet && existingWallet.parentElement && menu && typeof menu.contains === 'function' && menu.contains(existingWallet)) {
      return { container: existingWallet.parentElement, mode: 'beside-wallet', after: existingWallet };
    }
    if (menu) return { container: menu, mode: 'menu' };
    if (existingWallet && existingWallet.parentElement) {
      return { container: existingWallet.parentElement, mode: 'beside-wallet', after: existingWallet };
    }

    const selectors = ['[role="navigation"]', 'nav', 'footer', 'body'];
    for (const selector of selectors) {
      const container = doc.querySelector(selector);
      if (container) return { container, mode: selector === 'body' || selector === 'footer' ? 'flow' : 'menu' };
    }
    return null;
  }

  function installStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.infinity-wallet-menu-item{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:10px;position:static!important;inset:auto!important;max-width:100%;min-width:0;margin:8px 0;padding:10px 12px;border:1px solid rgba(130,170,255,.4);border-radius:12px;background:rgba(10,24,52,.92);color:#f7f9ff!important;text-decoration:none!important;font:700 13px/1.25 system-ui,sans-serif;z-index:auto!important}',
      '.infinity-wallet-menu-item:hover,.infinity-wallet-menu-item:focus-visible{border-color:#77d9ff;background:#122d5a;outline:none}',
      '.infinity-wallet-menu-copy{display:block;min-width:0;overflow:hidden}',
      '.infinity-wallet-menu-title,.infinity-wallet-menu-detail{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.infinity-wallet-menu-detail{margin-top:3px;color:#aebfe0;font-size:10px;font-weight:600}',
      '.infinity-wallet-menu-mark{flex:0 0 auto;color:#74e0b0;font-size:18px}',
      '.infinity-wallet-menu-flow{width:min(720px,calc(100% - 24px));margin:18px auto;position:static!important}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function loadWalletScript(doc) {
    if (root.InfinityUnifiedWallet) return Promise.resolve(root.InfinityUnifiedWallet);
    return new Promise((resolve, reject) => {
      const existing = doc.querySelector('script[data-infinity-unified-wallet-core]');
      if (existing) {
        existing.addEventListener('load', () => resolve(root.InfinityUnifiedWallet), { once: true });
        existing.addEventListener('error', () => reject(new Error('Unified wallet core failed to load.')), { once: true });
        return;
      }
      const script = doc.createElement('script');
      script.src = WALLET_SCRIPT;
      script.async = true;
      script.dataset.infinityUnifiedWalletCore = 'true';
      script.onload = () => resolve(root.InfinityUnifiedWallet);
      script.onerror = () => reject(new Error('Unified wallet core failed to load.'));
      (doc.head || doc.documentElement).appendChild(script);
    });
  }

  function buildLink(doc, placement) {
    const link = doc.createElement('a');
    link.id = WIDGET_ID;
    link.className = 'infinity-wallet-menu-item' + (placement.mode === 'flow' ? ' infinity-wallet-menu-flow' : '');
    link.href = WALLET_PAGE;
    link.setAttribute('aria-label', 'Open Unified Infinity Wallet');
    link.innerHTML = '<span class="infinity-wallet-menu-copy"><span class="infinity-wallet-menu-title">Unified Infinity Wallet</span><span class="infinity-wallet-menu-detail">Checking this device…</span></span><span class="infinity-wallet-menu-mark" aria-hidden="true">◈</span>';
    if (placement.after && placement.after.nextSibling) placement.container.insertBefore(link, placement.after.nextSibling);
    else placement.container.appendChild(link);
    return link;
  }

  function render(link, state) {
    const summary = walletSummary(state);
    const title = link.querySelector('.infinity-wallet-menu-title');
    const detail = link.querySelector('.infinity-wallet-menu-detail');
    if (title) title.textContent = summary.label;
    if (detail) detail.textContent = summary.detail;
    link.dataset.connected = summary.connected ? 'true' : 'false';
    return summary;
  }

  async function mount(options) {
    const doc = options && options.document || root.document;
    if (!doc) return null;
    const existing = doc.getElementById(WIDGET_ID);
    if (existing) return root.infinityWalletMenu || { element: existing };

    const placement = options && options.placement || findPlacement(doc);
    if (!placement || !placement.container) return null;
    installStyles(doc);
    const link = buildLink(doc, placement);

    try {
      const api = options && options.walletApi || await loadWalletScript(doc);
      const Wallet = api && api.UnifiedInfinityWallet;
      if (!Wallet) throw new Error('Unified wallet API is unavailable.');
      let wallet = new Wallet();
      render(link, wallet.state);

      function refresh() {
        wallet = new Wallet();
        render(link, wallet.state);
      }
      if (root.addEventListener) root.addEventListener('storage', event => {
        if (!event || event.key === STORAGE_KEY) refresh();
      });
      const mounted = { element: link, wallet, refresh, placement };
      root.infinityWalletMenu = mounted;
      if (root.dispatchEvent && typeof root.CustomEvent === 'function') {
        root.dispatchEvent(new root.CustomEvent('infinity:wallet-menu-ready', { detail: walletSummary(wallet.state) }));
      }
      return mounted;
    } catch (error) {
      const detail = link.querySelector('.infinity-wallet-menu-detail');
      if (detail) detail.textContent = 'Wallet unavailable · open to repair';
      link.dataset.connected = 'error';
      return { element: link, error, placement };
    }
  }

  function autoMount() {
    const script = root.document && root.document.currentScript;
    if (script && script.dataset.infinityWalletAuto === 'false') return;
    mount();
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', autoMount, { once: true });
    else autoMount();
  }

  return { WIDGET_ID, WALLET_PAGE, STORAGE_KEY, escapeHtml, walletSummary, findPlacement, mount };
});
