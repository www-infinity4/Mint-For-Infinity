# Infinity Royalty Ledger

The Infinity Royalty Ledger is the accounting contract between a verified content view,
the content-rights payable, the talent payable, and any restricted public-benefit
programs connected to Infinity Mint.

## What this first release does

This release provides a deterministic, testable protocol and a browser simulator. It does not
claim to be an authenticated bank, a rights registry, or a payment processor.

- Registers a content asset with a user-defined perceived value.
- Records rights-owner and talent stakeholders independently.
- Distinguishes `UNCLAIMED`, `PENDING`, `VERIFIED`, and `DISPUTED` claim states.
- Converts an eligible view receipt into balanced double-entry postings.
- Rejects duplicate view-event IDs.
- Stores unknown recipients in asset-specific unclaimed payable accounts.
- Links every event to the previous event with SHA-256.
- Detects changed history through full-chain verification.
- Records program proposals without creating spendable balances.
- Keeps ordinary spending, content royalties, production, and planting grants in separate lanes.

## Default $1 reference-view allocation

The ledger stores **10,000 integer units per 1 Infinity**, allowing a one-cent talent pool to be
split without floating-point arithmetic.

| Allocation | Default | Ledger treatment |
|---|---:|---|
| Rights-owner pool | 10% / 10¢ | Verified wallet payable or protected unclaimed payable |
| Talent pool | 1% / 1¢ | Split by the asset's talent schedule; otherwise unclaimed |
| Viewer charge or automatic reward | 0¢ | No viewer posting for a qualified view |
| Remaining reference value | 89¢ | Not allocated by this legacy reference policy and not silently claimed |

An asset-specific agreement can replace the default percentages. Stakeholder shares within each
pool must total exactly 10,000 basis points.

## View receipt boundary

The static page creates `SIMULATED` receipts only. An authoritative receipt must eventually carry:

- a globally unique and idempotent event ID;
- asset ID and viewer-wallet ID;
- watched seconds and asset duration;
- a completion ratio satisfying the applicable policy;
- a SHA-256 evidence digest;
- the verifier's identity;
- a verifier signature; and
- a trusted server timestamp.

The authoritative service must validate the signature, session evidence, replay protection,
privacy rules, and asset policy before calling the ledger in `AUTHORITATIVE` mode.

## Rights and claimant verification

Finding a file or stream on the Internet Archive does not, by itself, establish the copyright
status or identify every payable stakeholder. A captured URL is therefore stored as source
metadata, not as proof of rights.

The release path is:

1. Locate the asset-specific unclaimed payable.
2. Submit a claimant identity and role.
3. Submit rights, contract, credit, or representation evidence.
4. Review conflicts and duplicate claims.
5. Verify the claimant through an appropriate identity/compliance provider.
6. Bind the approved claimant to an authenticated wallet.
7. Route future obligations to that wallet and process prior reserves under an approved release.

AI may organize documents, compare names and dates, flag conflicts, and summarize evidence. It
must not independently declare legal ownership or silently release a disputed payable.

## Account classes

- `ledger:expense:view-distribution` — authoritative distribution expense.
- `payable:wallet:{walletId}:rights_owner` — verified rights-owner obligation.
- `payable:wallet:{walletId}:talent` — verified talent obligation.
- `payable:unclaimed:{role}:{assetId}:{stakeholderId}` — protected unknown or pending obligation.
- `ledger:wallet:{walletId}:viewer-reward` — retained compatibility lane; default posting is zero.
- `simulation:*` — browser-only demonstration accounts with no spendable value.

Every financial event must have equal integer debits and credits.

## Separated limits and programs

The currently stated Infinity lanes are preserved independently:

- up to 10 one-Infinity notes per account day;
- up to 90 Infinity from qualified activity per account day;
- up to 300 Infinity of ordinary retail spending per account day; and
- a proposed 1,000 Infinity verified tree-planting grant.

The page also records a proposed 5,000 Infinity Grant Cardone allocation. It is intentionally
`PROPOSED`, identifies the beneficiary as unverified, and creates no balance. Identity,
permission, wallet binding, program terms, and authorization are required before activation.

Royalty payables and approved production budgets require their own controls. They must not be
misclassified as ordinary retail shopping merely to force them through a consumer spending cap.

## Next server milestone

The next implementation should add an authenticated service and durable database with:

- append-only `view_receipts`, `ledger_events`, and `ledger_postings` tables;
- content assets, rights schedules, talent schedules, claims, evidence references, and disputes;
- passkey or comparable account authentication;
- provider-backed identity verification for payable release;
- signed verifier keys with rotation and revocation;
- replay, bot, device-farm, and abnormal-velocity detection;
- privacy-preserving viewer identifiers and retention limits;
- daily-lane counters enforced centrally rather than through browser storage;
- exportable stakeholder statements and audit proofs; and
- regulated payout integration only after legal and compliance review.

## Verification

```bash
node royalty-ledger.test.js
```

The regression test covers balanced posting totals, the 10¢/1¢/0¢ legacy default, verified versus
unclaimed routing, duplicate views, authoritative receipt rejection, proposal non-funding,
daily-limit constants, and hash-chain tamper detection.
