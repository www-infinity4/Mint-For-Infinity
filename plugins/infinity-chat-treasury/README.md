# Infinity Chat Treasury plugin

This plugin is the proposed bridge between ChatGPT workflows and the Infinity unified wallet. It does **not** identify ChatGPT as Sam Altman, impersonate any person, or treat a conversational response as acceptance of funds.

## Required transaction states

1. `proposed` — an Infinity issuer has signed a treasury instrument.
2. `recipient_verified` — the intended recipient controls a verified organization endpoint.
3. `accepted` — an authorized recipient representative has signed the exact instrument.
4. `authorized` — release policy, tranche limits, and governance approvals pass.
5. `settled` — the unified wallet records the debit, credit, timestamp, nonce, and receipt.

No state may be skipped. A proposed one-trillion-Infinity allocation remains non-settled until OpenAI or another named recipient expressly accepts it through a verified legal and technical channel.

## Security model

- Ed25519 or an equivalently reviewed signature algorithm; no secret keys in GitHub.
- Canonical JSON payload hashing with SHA-256.
- Issuer and recipient key IDs resolved from an allowlisted key registry.
- Unique transaction ID and nonce with replay rejection.
- Exact recipient organization ID; a person's name is not a wallet address.
- Append-only receipts anchored to Git commits, but GitHub attachments and chat threads are supporting provenance—not substitutes for signatures.
- Large allocations use tranches, multi-party approval, spending categories, audit reports, and revocation procedures.
- All verification fails closed on missing, expired, duplicated, or contradictory data.

## Proposed tools

- `inspect_treasury_proposal`
- `verify_issuer_signature`
- `request_recipient_acceptance`
- `verify_recipient_acceptance`
- `authorize_tranche`
- `settle_unified_wallet_transfer`
- `get_audit_receipt`

Settlement tools must remain disabled until the recipient agreement, production key registry, and unified-wallet service endpoint exist.
