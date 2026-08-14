# Unified Infinity Wallet menu integration

Every `www-infinity4.github.io` project can load the same wallet menu component:

```html
<script src="https://www-infinity4.github.io/Mint-For-Infinity/infinity-wallet-menu.js?v=20260814-menu1"></script>
```

For exact hamburger placement, add an empty slot beside the site's existing wallet links:

```html
<div data-infinity-wallet-slot></div>
```

The component is normal document flow. It never uses fixed positioning and never creates a modal or overlay. If no explicit slot exists, it looks for an existing wallet, hamburger drawer, sidebar, navigation element, footer, and finally the end of the body—in that order.

It reads the shared same-origin unified wallet state, displays the connected wallet suffix and real recorded balances, and links to the full wallet/scanner. It does not mint, award, transfer, or invent coins.
