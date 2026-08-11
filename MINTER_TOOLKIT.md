# Infinity Mint — Creative Minter Toolkit

A minted note can act as a small creative package rather than a plain image. Minters should be able to combine original work, licensed/user-owned media, product information, provenance, and interactive metadata before minting.

## Mandatory AI publication gate

**AI filtering is mandatory before any user-supplied or generated content can become part of a transferable/public token.** This is a publication-safety gate, not merely an organization feature.

Every proposed attachment or field passes through a staged state machine:

`LOCAL_DRAFT -> SCANNING -> APPROVED | BLOCKED | REVIEW_REQUIRED -> MINTABLE`

Content that is `BLOCKED` or still `REVIEW_REQUIRED` must never be embedded in the public note render, copied into the token package, placed in another user's feed, offered for transfer, or exposed through public token URLs. A blocked item may be removed/replaced by the creator, but the system must not simply hide a thumbnail while retaining public access to the underlying file.

The moderation gate applies to:

- images and artwork, including the art pad and uploaded photographs;
- video, including representative frame sampling and metadata;
- audio, including speech/transcript analysis where available;
- typed text, poems, product advertisements, titles, captions, URLs, and QR destinations;
- uploaded files and extractable text/metadata;
- AI-generated or AI-curated selections before publication.

At minimum, the gate should prevent explicit sexual imagery, sexual content involving minors, graphic abuse/exploitation, prohibited violent/extremist material, malicious files/links, doxxing/private information, and other material barred by the platform's publication policy. The exact policy and classifiers should be versioned so a moderation decision has an auditable `policyVersion`.

A moderation record should include `assetId`, cryptographic digest, media type, decision, policy version, scan timestamp, reason/category codes suitable for the creator UI, scanner/model version, and optional appeal/review state. Do not expose private model reasoning to downstream viewers.

**Fail closed:** if the moderation service is unavailable, the item remains a private local draft and cannot be minted publicly until screening succeeds.

## Core creation tools

- Art Pad — draw, sketch, annotate, stamp shapes, choose brush width, undo/redo, clear, and submit the finished art to the AI publication gate.
- Signature Pad — finger/stylus signature stored with the note record; scanned before public token publication.
- Writing Studio — title, caption, story, poem, product copy, provenance note, instructions, dedication, or free-form text; scanned before minting.
- Audio Recorder — record a voice note, sound, music demo, spoken poem, product pitch, or other original/licensed audio clip; scanned before minting.
- Image Upload — attach user-owned/licensed images with local preview, then scan before publication.
- Video Upload — attach user-owned/licensed video clips with local preview and metadata, then scan before publication.
- File Vault — attach documents and supporting files; files remain private until screening completes.
- AI Curator — optional organizer for **already screened** material. It may label, summarize, rank, or lay out approved assets and must never silently replace the minter's source material.

## Additional tools

- Product / Ad Card — product name, brand, description, price text, call-to-action, destination URL, promo code, and optional expiry. Advertising claims remain the minter's responsibility and are screened before publication.
- Link / QR Payload — attach a URL and render a scannable/linkable destination in later renderers; destination safety should be checked before public activation.
- Location Tag — optional place label and coordinates supplied/approved by the minter; warn users before publishing precise personal locations.
- Date / Event Tag — event name, start/end date, release date, anniversary, or expiration metadata.
- Contact Card — optional public-facing creator/business contact fields chosen by the minter; private contact data must not be inferred or exposed automatically.
- Credits & Rights — creator, collaborator, source, license, copyright/permission note, and attribution.
- Provenance Note — why the item was created, where it came from, and supporting reference text/files.
- Coupon / Offer Builder — offer text, code, terms, start/end dates, merchant, and redemption link; must not claim merchant authorization unless supplied by the merchant/minter.
- Collection / Edition Tag — collection name, edition label, sequence, category, and tags.
- Color / Theme Controls — note accent, frame treatment, typography preset, and background treatment without imitating real legal tender.
- Sticker / Symbol Layer — reusable decorative icons and labels.
- Photo Caption / Alt Text — accessibility and searchable description.
- Hash Preview — show the provisional identity inputs before minting and the final hash/serial afterward.
- Attachment Manifest — list every attachment, its type, size, source/rights note, digest, and moderation state.

## Creative combinations

A minter can combine tools, for example:

1. draw cover art + record a spoken poem + add the written poem;
2. upload a product photo + create an ad card + attach a coupon and destination link;
3. sign an artwork + add provenance + supporting document + creator credits;
4. upload a short video + record an introduction + add event/date/location metadata;
5. use AI Curator to organize **approved** images/text/audio into a proposed attachment layout, then let the minter approve/edit it before minting.

Each component is screened independently, and the assembled package receives a final package-level check before the Mint button becomes active.

## Safety and authenticity

The Mint must distinguish user-provided material, AI-assisted metadata, automatically suggested material, and moderation decisions. Uploading or minting something should not itself assert copyright ownership, merchant authorization, authenticity, investment value, or legal-tender status. Those claims need their own evidence/authorization fields.
