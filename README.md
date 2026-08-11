# Infinity Mint

Infinity Mint is a browser-based renderer for living **$1 Infinity** token-notes.

## Current implementation

- **Wallet:** local device wallet stored in browser localStorage.
- **Daily mint limit:** $10 Infinity per local calendar day.
- **Mint unit:** one $1 Infinity note at a time, up to ten notes.
- **Note identity:** every note receives a SHA-256-derived serial and provisional full hash.
- **Attachments:** image, audio, video, document, poem, coupon, coin, tree, gemstone, and other curated references.
- **Signature:** phone-friendly signature canvas stored with the local note.
- **Living Token actions:** Engineer, Import, Research, Decide, Route/Fork, and Assimilate proposals.
- **Artwork:** portrait-free engraved note at [`assets/infinity-one-note.svg`](assets/infinity-one-note.svg).

## Important status

The current wallet and limit are enforced locally in the browser. They are **not yet synchronized to an authenticated account or shared ledger**, so another browser/device or cleared site storage starts a separate local wallet.

Minted notes currently use `PROVISIONAL_AWAITING_GIT_BIND` until a shared ledger service binds the full note hash to a Git commit or other permanent ledger record.

## Run

Open [`index.html`](index.html) through GitHub Pages or any static web server. No build step is required.

## Note design

The Infinity Capital note uses:

- BANK OF THE NWO RESERVE
- INFINITY CAPITAL NOTES
- ONE INFINITY
- IC monogram instead of George Washington or another portrait
- reserved commit-serial and holder-signature areas
- no Infinity symbol
