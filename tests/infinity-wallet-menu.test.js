'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const widget = require('../infinity-wallet-menu.js');

test('wallet summary reports a connected wallet without changing balances', () => {
  const state = {
    currentWalletId: 'infinity-wallet:abcdefgh',
    wallets: {
      'infinity-wallet:abcdefgh': {
        walletId: 'infinity-wallet:abcdefgh',
        balances: { INFINITY_MINT_COIN: 2, BITCOIN_CRUSHER_COIN: 1 },
        tokenIds: ['token:1']
      }
    }
  };
  const summary = widget.walletSummary(state);
  assert.equal(summary.connected, true);
  assert.equal(summary.label, 'Unified Wallet · abcdefgh');
  assert.match(summary.detail, /INFINITY MINT COIN 2/);
  assert.equal(state.wallets[state.currentWalletId].balances.INFINITY_MINT_COIN, 2);
});

test('wallet summary never invents a wallet or coin balance', () => {
  const summary = widget.walletSummary({ currentWalletId: null, wallets: {} });
  assert.equal(summary.connected, false);
  assert.equal(summary.walletId, null);
  assert.deepEqual(summary.balances, {});
});

test('placement prefers an explicit hamburger wallet slot', () => {
  const slot = {};
  const doc = {
    querySelector(selector) {
      if (selector === '[data-infinity-wallet-slot]') return slot;
      return null;
    },
    querySelectorAll() { return []; }
  };
  assert.deepEqual(widget.findPlacement(doc), { container: slot, mode: 'slot' });
});


test('hamburger drawer outranks a wallet button outside the menu', () => {
  const drawer = { contains() { return false; } };
  const walletParent = {};
  const walletButton = { id: 'walletButton', className: 'wallet', textContent: 'Wallet', parentElement: walletParent };
  const doc = {
    querySelector(selector) {
      if (selector === '[data-infinity-wallet-slot]') return null;
      if (selector === '#hamDrawer') return drawer;
      return null;
    },
    querySelectorAll() { return [walletButton]; }
  };
  assert.deepEqual(widget.findPlacement(doc), { container: drawer, mode: 'menu' });
});
