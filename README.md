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

## Shared local moderation and private drafts

Minting now runs through the shared Infinity AI runtime at `http://127.0.0.1:11435`:

1. Local envelope rules reject executable/active-content uploads, unsupported types, files above 25 MB, combined uploads above 50 MB, and oversized text.
2. Text, writing, product/ad copy, rights notes, and the final assembled manifest pass through `TEXT_SAFETY`.
3. Uploaded images, Art Pad creations, and the signature pass through `IMAGE_SAFETY`.
4. Every moderation record preserves asset ID, digest when available, media type, provenance, policy version, decision, scan time, role, and model.
5. `BLOCKED` and `REVIEW_REQUIRED` packages remain `LOCAL_DRAFT` and cannot mint.
6. If the local runtime or a required ShieldGemma role is unavailable, moderation fails closed. The Mint never records a false AI approval.
7. Locally minted records remain private and non-transferable until the future authenticated ledger and Git binding promote them.

Audio, video, and PDF uploads are accepted into the private draft vault, but remain `REVIEW_REQUIRED` until a content-capable local scanner is connected. File-name and type inspection alone is not represented as full content approval.

## Creation toolkit

The page now includes:

- Art Pad with finger/stylus drawing, brush controls, undo, redo, clear, and private attachment;
- Writing Studio for complete text, license, and provenance notes;
- direct microphone recording;
- Product / Ad Builder with product, brand, description, price text, call-to-action, destination, and promo code;
- existing image, audio, video, document, signature, and AI-curation tools;
- visible draft states: `LOCAL_DRAFT`, `SCANNING`, `APPROVED`/`BLOCKED`/`REVIEW_REQUIRED`, `MINTABLE`, and `MINTED_LOCAL_PRIVATE`.

User-supplied, user-created, user-recorded, user-signature, and AI-suggested provenance are kept distinct in the package manifest.

## Run the regression test

```bash
node moderation.test.js
```

The wallet and $10-per-local-calendar-day limit remain browser-local. Shared-wallet synchronization and Git commit binding are separate future services; the interface continues to mark new records as provisional until those services exist.

## Royalty Ledger protocol

Open [`royalty-ledger.html`](royalty-ledger.html) to inspect the mobile Royalty Ledger page.
It turns each eligible view receipt into balanced viewer, rights-owner, and talent allocations,
while unknown recipients remain in asset-specific unclaimed payable accounts.

The first release is deliberately a browser simulator:

- a $1 reference view defaults to a 10¢ rights-owner pool, 1¢ talent pool, and 1¢ viewer reward;
- amounts use 10,000 integer units per Infinity instead of floating-point money arithmetic;
- duplicate event IDs are rejected;
- events are SHA-256 linked and the full chain is revalidated;
- `UNCLAIMED`, `PENDING`, `VERIFIED`, and `DISPUTED` claims remain distinct;
- source URLs are captured metadata, not automatic proof of copyright ownership;
- proposals, including the $1,000 tree-planting program and proposed $5,000 Grant Cardone
  allocation, create no spendable balance until their stated requirements are satisfied; and
- ordinary retail, activity, minting, royalty, production, and planting lanes remain separate.

Read [`ROYALTY_LEDGER.md`](ROYALTY_LEDGER.md) for the accounting contract, authoritative receipt
requirements, claimant flow, account classes, and server/database milestone.

Run the regression test:

```bash
npm run test:royalty
```

The test covers balanced postings, default allocations, unclaimed routing, duplicate rejection,
authoritative-receipt requirements, non-funding proposals, daily limits, and tamper detection.
