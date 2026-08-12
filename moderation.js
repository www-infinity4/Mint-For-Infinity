(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.InfinityMintModeration = api;
  if (root.document) api.install(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:8080/v1";
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
  const IMAGE_AI_BYTES = 4 * 1024 * 1024;
  const BLOCKED_EXTENSIONS = /\.(?:apk|app|bat|cmd|com|dll|dmg|exe|hta|html?|jar|js|msi|ps1|scr|sh|svg|vbs)$/i;
  const ALLOWED_TYPES = /^(?:image|audio|video|text)\//i;

  function deterministicCheck(text, files) {
    const cleanText = String(text || "").trim();
    const list = Array.from(files || []);
    const totalBytes = list.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const reasons = [];

    if (cleanText.length > 20000) reasons.push("Text is longer than 20,000 characters.");
    if (totalBytes > MAX_TOTAL_BYTES) reasons.push("Uploads exceed the 50 MB total limit.");

    list.forEach((file) => {
      const name = String(file.name || "unnamed file");
      const type = String(file.type || "");
      if (Number(file.size || 0) > MAX_FILE_BYTES) reasons.push(name + " exceeds 25 MB.");
      if (BLOCKED_EXTENSIONS.test(name)) reasons.push(name + " is an executable or active-content file.");
      if (type && !ALLOWED_TYPES.test(type) && type !== "application/pdf") {
        reasons.push(name + " has an unsupported file type (" + type + ").");
      }
    });

    return {
      allowed: reasons.length === 0,
      decision: reasons.length ? "block" : "allow",
      source: "local-rules",
      reasons
    };
  }

  function parseModelDecision(value) {
    const raw = String(value || "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { decision: "review", reason: "The local model returned an unreadable decision." };
      try { parsed = JSON.parse(match[0]); }
      catch (_) { return { decision: "review", reason: "The local model returned invalid JSON." }; }
    }
    const decision = ["allow", "review", "block"].includes(parsed.decision) ? parsed.decision : "review";
    return {
      decision,
      reason: String(parsed.reason || "No reason supplied."),
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String).slice(0, 8) : []
    };
  }

  async function discoverModel(fetchImpl) {
    const response = await fetchImpl(ENDPOINT + "/models", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error("Local model list returned " + response.status);
    const payload = await response.json();
    const ids = Array.isArray(payload.data) ? payload.data.map(item => String(item.id || "")).filter(Boolean) : [];
    return ids.find(id => /shieldgemma/i.test(id)) || ids.find(id => /gemma/i.test(id)) || ids[0] || "local-model";
  }

  function readImage(file) {
    if (!file || !/^image\//i.test(file.type || "") || file.size > IMAGE_AI_BYTES) return Promise.resolve(null);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function modelCheck(text, files, fetchImpl) {
    const model = await discoverModel(fetchImpl);
    const image = await readImage(Array.from(files || []).find(file => /^image\//i.test(file.type || "")));
    const prompt = [
      "You are the local safety classifier for Infinity Mint.",
      "Return JSON only: {\"decision\":\"allow|review|block\",\"reason\":\"short reason\",\"categories\":[]}.",
      "Block only clear sexual content involving minors, credible targeted threats, instructions intended to cause serious harm, or malicious executable content.",
      "Use review for ambiguous high-risk material. Allow fiction, news, criticism, personal beliefs, scientific discussion, and ordinary creative work unless they clearly cross a blocked category.",
      "Text to classify:",
      String(text || "").slice(0, 12000) || "(no text)",
      "Uploaded files:",
      Array.from(files || []).map(file => file.name + " [" + (file.type || "unknown") + ", " + file.size + " bytes]").join("\n") || "(none)"
    ].join("\n");
    const content = image
      ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }]
      : prompt;
    const response = await fetchImpl(ENDPOINT + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 220, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error("Local moderation returned " + response.status);
    const payload = await response.json();
    const result = parseModelDecision(payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content);
    return { ...result, allowed: result.decision === "allow", source: /shieldgemma/i.test(model) ? "shieldgemma-local" : "gemma-local", model };
  }

  async function moderate(text, files, fetchImpl) {
    const local = deterministicCheck(text, files);
    if (!local.allowed) return local;
    try {
      return await modelCheck(text, files, fetchImpl || fetch);
    } catch (error) {
      return {
        allowed: true,
        decision: "allow",
        source: "local-rules-ai-offline",
        reasons: [],
        warning: "Local Gemma moderation is offline; file and size safety checks passed.",
        error: String(error && error.message || error)
      };
    }
  }

  function collectFiles(doc) {
    return ["imageFile", "audioFile", "videoFile", "docFile"]
      .flatMap(id => Array.from((doc.getElementById(id) || {}).files || []));
  }

  function install(doc) {
    const button = doc.getElementById("mintBtn");
    const status = doc.getElementById("moderationStatus");
    const intent = doc.getElementById("intent");
    if (!button || !status || button.dataset.moderationInstalled === "true") return false;
    button.dataset.moderationInstalled = "true";
    const mint = button.onclick;
    button.onclick = async function (event) {
      event.preventDefault();
      button.disabled = true;
      status.textContent = "Checking note with local safety rules and Gemma…";
      status.dataset.state = "checking";
      const result = await moderate(intent ? intent.value : "", collectFiles(doc));
      status.dataset.state = result.allowed ? "allowed" : "blocked";
      status.textContent = result.allowed
        ? (result.warning || "Approved by " + result.source + (result.model ? " (" + result.model + ")" : "") + ".")
        : "Mint paused: " + ((result.reasons && result.reasons.join(" ")) || result.reason || "Local moderation requires review.");
      button.disabled = false;
      if (!result.allowed) return;
      root.__infinityMintModerationResult = { ...result, checkedAt: new Date().toISOString() };
      if (typeof mint === "function") await mint.call(button, event);
    };
    return true;
  }

  return { deterministicCheck, parseModelDecision, moderate, install };
});
