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

## Local moderation

Minting now runs through `moderation.js` before a note is stored:

1. Local rules reject executable/active-content uploads, unsupported file types, files above 25 MB, combined uploads above 50 MB, and text above 20,000 characters.
2. The browser checks `http://127.0.0.1:8080/v1/models` for a keyless local model.
3. ShieldGemma is preferred. Another local Gemma model is used when ShieldGemma is not installed.
4. Text and one image of at most 4 MB are classified locally. The model must return `allow`, `review`, or `block` JSON.
5. If the AI server is offline, only the deterministic file and size checks run. The interface states that clearly instead of recording a false AI approval.
6. The result and timestamp are included in the local note record and its canonical hash input.

No API key is required and the moderation integration does not send note content to a cloud service.

## Run the regression test

```bash
node moderation.test.js
```

The wallet and $10-per-local-calendar-day limit remain browser-local. Shared-wallet synchronization and Git commit binding are separate future services; the interface continues to mark new records as provisional until those services exist.
