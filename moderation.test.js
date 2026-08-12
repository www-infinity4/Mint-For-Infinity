const assert = require("node:assert/strict");
const moderation = require("./moderation.js");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

async function approvedFetch(url) {
  if (url.endsWith("/v1/moderate/text")) {
    return response(200, {
      role: "TEXT_SAFETY",
      model: "shieldgemma-text-test",
      decision: "APPROVED",
      reasons: []
    });
  }
  if (url.endsWith("/v1/moderate/image")) {
    return response(200, {
      role: "IMAGE_SAFETY",
      model: "shieldgemma-image-test",
      decision: "APPROVED",
      reasons: []
    });
  }
  return response(404, { error: "unknown endpoint" });
}

(async () => {
  assert.equal(moderation.deterministicCheck("ordinary creative note", []).allowed, true);
  assert.equal(
    moderation.deterministicCheck("", [{ name: "payload.exe", type: "application/octet-stream", size: 10 }]).allowed,
    false
  );
  assert.equal(
    moderation.deterministicCheck("", [{ name: "large.mp4", type: "video/mp4", size: 26 * 1024 * 1024 }]).allowed,
    false
  );

  const approved = await moderation.moderate({
    text: "Original poem and product description",
    files: [{
      id: "poem-file",
      name: "poem.md",
      type: "text/markdown",
      size: 28,
      provenance: "USER_SUPPLIED",
      async text() { return "Complete uploaded poem content"; }
    }],
    images: [{
      id: "art-pad-1",
      dataUrl: "data:image/png;base64,dGVzdA==",
      provenance: "USER_CREATED"
    }]
  }, approvedFetch);
  assert.equal(approved.allowed, true);
  assert.equal(approved.decision, "APPROVED");
  assert.equal(approved.source, "infinity-ai-runtime");
  assert.ok(approved.records.some(record => record.assetId === "assembled-package"));
  assert.ok(approved.records.some(record => record.assetId === "poem-file" && record.decision === "APPROVED"));
  assert.ok(approved.records.every(record => record.policyVersion === moderation.POLICY_VERSION));

  const offline = await moderation.moderate(
    { text: "normal note", files: [], images: [] },
    async () => { throw new Error("offline"); }
  );
  assert.equal(offline.allowed, false);
  assert.equal(offline.decision, "REVIEW_REQUIRED");
  assert.match(offline.reasons.join(" "), /unavailable/i);

  const audio = await moderation.moderate({
    text: "Spoken poem",
    files: [{
      id: "audio-1",
      name: "poem.webm",
      type: "audio/webm",
      size: 120,
      provenance: "USER_RECORDED"
    }],
    images: []
  }, approvedFetch);
  assert.equal(audio.allowed, false);
  assert.equal(audio.decision, "REVIEW_REQUIRED");
  assert.ok(audio.records.some(record => record.scannerRole === "MEDIA_SAFETY"));

  const blocked = await moderation.moderate({
    text: "",
    files: [{ name: "payload.js", type: "text/javascript", size: 20 }],
    images: []
  }, approvedFetch);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.decision, "BLOCKED");

  console.log("Infinity Mint shared moderation, provenance, package gate, and fail-closed behavior: ok");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
