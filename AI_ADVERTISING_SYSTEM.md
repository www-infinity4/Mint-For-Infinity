# Infinity AI Advertising and Royalty System

This release expands Infinity Mint from a view-allocation demonstration into a catalog-scale
advertising, attribution, claimant, and AI-workforce system.

## Native accounting rule

- A qualified advertising impression charges the campaign **0.20 Infinity** by default.
- Each credited production company receives **0.10 Infinity**.
- Each credited person receives **0.01 Infinity**.
- The viewer is not charged and receives no automatic impression payment.
- Any remainder after all scheduled company and person credits is recorded as campaign/platform
  revenue; a campaign is rejected when its price cannot cover the attached credit schedule.
- Both rates are integer native-Infinity amounts and can be replaced by an approved campaign
  agreement without changing the accounting engine.

The system never labels treasury issuance as outside advertising revenue. An organization opening
balance has a `TREASURY_ISSUANCE` or `EXTERNAL_ADVERTISER` funding source that remains visible in
the event and account history.

## Provisional company accounts

Infinity may create a system-stewarded, provisional record for a company before that company
participates. The record is explicitly marked:

- `UNCLAIMED`;
- `SYSTEM_PROVISIONAL`;
- `NOT_CLAIMED_OR_ENDORSED`; and
- funded from a named source.

Claiming control requires identity, authority, conflict review, verification record, and wallet
binding. Until then, rights allocations remain in content-specific unclaimed payable accounts.

Organization campaign balances may run below zero against a visible, configurable Infinity credit
line. The statement reports positive availability, debt, and remaining credit separately. Debt can
be reduced through verified product purchases, product-specific Infinity coins, or activity tokens
that a user explicitly directs to that organization. A collection robot may route no more than 100
Infinity of a user's authorized activity per day and cannot silently take wallet funds.

## Seven-worker system

`ai-workforce.js` provides seven bounded workers:

1. **Atlas Reader** reads and indexes every record without inventing missing metadata.
2. **Provenance Mapper** connects names, roles, source fields, links, and claim candidates.
3. **Context Steward** plans contextual or explicitly consented placements with frequency caps.
4. **Page Writer** turns structured facts into labeled, complete page proposals.
5. **System Designer** creates reusable mobile and accessible interface plans.
6. **Soban Ledger Robot** builds native-unit posting plans.
7. **Sentinel Auditor** blocks missing provenance, unbalanced rates, and improper releases.

The deterministic engine works without an API key. `LocalModelAdapter` can ask a locally hosted
model for a structured proposal, but model prose never posts money or verifies ownership.

## StarQuest scan completed

The generated manifest at `catalogs/starquest-provenance.json` was built from
`www-infinity4/TV-Database/js/data.js` on the `main` ref.

| Scan result | Count |
|---|---:|
| Top-level StarQuest records | 356 |
| Episode or presentation records | 637 |
| Total content tokens | 993 |
| Unique provisional claimant/source candidates | 357 |
| Field-level claimant provenance records | 1,507 |

The StarQuest opening-account snapshot creates 357 protected provisional accounts and credits
35.70 Infinity from the explicitly labeled catalog-discovery treasury lane. These are discovery
credits, not falsely labeled AI movie-view events.

## Goudey card scan completed

The Goudey adapter now reads the actual `cards` array in the repository's `app.js`. It currently
finds 77 card records and creates unique provisional accounts for structured players, featured
subjects, other card subjects, and the catalog publisher. Repeated appearances add provenance to
one account instead of creating duplicate identities.

Every token preserves repository, file, ref, record ID, field-level provenance, known links,
catalog tags, and provisional claimant references. An Internet Archive identifier is recorded as
a linked source record, not automatically treated as proof of copyright ownership.

Run the scan again after StarQuest changes:

```bash
npm run scan:starquest
```

## Trading-card adapter

`scanCardCatalog()` accepts structured Goudey card records and extracts each attached player,
subject, artist, photographer, team, league, brand, publisher, company, studio, and named rights
holder. Each becomes a separate provenance-backed claimant candidate. A card image by itself is
not enough to infer every printed name accurately; image OCR and visual-credit review remain a
separate ingestion step.

## Cosmo watched-media intelligence

`media-intelligence.js` requires a signed-style `AI_WATCHED_MEDIA` receipt containing the content
token, model ID, start and finish time, media digest, analysis digest, and timestamped cues. From
those cues Cosmo can create:

- scene observations and details a viewer may have missed;
- educational notes;
- product-placement scripts tied to visible scene context;
- useful local-service recommendations when an open household need matches; and
- explicit suppression when the viewer dislikes or blocks a product or already completed the need.

A catalog scan alone is never mislabeled as a watched-media receipt.

## Household Sweep and value controls

`household-sweep.html` creates a local private repair ledger for roof, plumbing, sink/cabinet,
electrical, heating/cooling, moisture, windows, appliances, structure, and safety. Renters route
repair responsibility through landlord review first. Location matching, personalization, and
contact permission are separate switches.

`economy-controls.js` keeps ordinary daily spending separate from external-asset withdrawal. The
default example permits 300 Infinity of ordinary spending per day and one silver-dime roll, up to
300 Infinity of recorded external-asset value, per week. These are configurable protocol limits,
not statements about the current market price of silver.

## Placement intelligence

The network supports two modes:

- `CONTEXTUAL` uses the content and page context only.
- `CONSENTED_PERSONALIZATION` may use profile tags only when the receipt includes the
  `AD_PERSONALIZATION` consent scope.

Every recommendation returns its matched tags, blocked tags, mode used, score, frequency key, and
reason codes. Excluded context and daily frequency limits reject the placement before posting.

## Qualified impression boundary

The browser studio creates simulations only. An authoritative impression additionally requires a
verified status, verifier identity, SHA-256 evidence hash, signature, visibility threshold,
idempotent event ID, active campaign, sufficient campaign budget, and sufficient sponsor balance.

## Verification

```bash
npm run test:protocols
```

The tests cover balanced funding and impression postings, one-Infinity-cent rights pools, split
claimants, provisional organizations, non-endorsement labels, contextual privacy, consent
boundaries, frequency caps, duplicate events, hash verification, catalog provenance, card entity
extraction, AI-worker boundaries, and zero viewer charge.
