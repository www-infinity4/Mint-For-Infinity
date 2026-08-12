const assert = require("node:assert/strict");
const moderation = require("./moderation.js");

assert.equal(moderation.deterministicCheck("ordinary creative note", []).allowed, true);
assert.equal(
  moderation.deterministicCheck("", [{ name: "payload.exe", type: "application/octet-stream", size: 10 }]).allowed,
  false
);
assert.equal(
  moderation.deterministicCheck("", [{ name: "large.mp4", type: "video/mp4", size: 26 * 1024 * 1024 }]).allowed,
  false
);

assert.deepEqual(
  moderation.parseModelDecision('{"decision":"allow","reason":"safe","categories":[]}'),
  { decision: "allow", reason: "safe", categories: [] }
);
assert.equal(moderation.parseModelDecision("not json").decision, "review");

moderation.moderate("normal note", [], async () => { throw new Error("offline"); }).then(result => {
  assert.equal(result.allowed, true);
  assert.equal(result.source, "local-rules-ai-offline");
  console.log("Infinity Mint moderation gate: ok");
});
