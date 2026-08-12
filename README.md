# Infinity Mint

Infinity Mint renders one local $1 Infinity token-note at a time and limits each browser wallet to 10 newly minted notes per UTC day.

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

The wallet and daily limit remain browser-local. Shared-wallet synchronization and Git commit binding are separate future services; the interface continues to mark new records as provisional until those services exist.
