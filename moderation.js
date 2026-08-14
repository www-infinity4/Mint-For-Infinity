(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.InfinityMintModeration = api;
  if (root.document) api.install(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const RUNTIME = "http://127.0.0.1:11435";
  const POLICY_VERSION = "infinity-publication-v1";
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
  const IMAGE_SCAN_BYTES = 4 * 1024 * 1024;
  const BLOCKED_EXTENSIONS = /\.(?:apk|app|bat|cmd|com|dll|dmg|exe|hta|html?|jar|js|msi|ps1|scr|sh|svg|vbs)$/i;
  const ALLOWED_TYPES = /^(?:image|audio|video|text)\//i;

  function normalizeDecision(value) {
    const decision = String(value || "").toUpperCase();
    return ["APPROVED", "BLOCKED", "REVIEW_REQUIRED"].includes(decision)
      ? decision
      : "REVIEW_REQUIRED";
  }

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
      decision: reasons.length ? "BLOCKED" : "APPROVED",
      source: "local-envelope-rules",
      policyVersion: POLICY_VERSION,
      reasons
    };
  }

  function withTimeout(milliseconds) {
    if (typeof AbortController === "undefined") return { signal: undefined, cancel() {} };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), milliseconds);
    return { signal: controller.signal, cancel() { clearTimeout(timer); } };
  }

  async function runtimeRequest(path, body, fetchImpl) {
    const timeout = withTimeout(3500);
    try {
      const response = await fetchImpl(RUNTIME + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeout.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !payload.decision) {
        throw new Error(payload.error || "Runtime returned " + response.status);
      }
      return payload;
    } finally {
      timeout.cancel();
    }
  }

  function readImage(file) {
    if (!file || !/^image\//i.test(file.type || "") || Number(file.size || 0) > IMAGE_SCAN_BYTES) {
      return Promise.resolve(null);
    }
    if (typeof file.dataUrl === "string") return Promise.resolve(file.dataUrl);
    if (typeof FileReader === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function digestFile(file) {
    if (!file || typeof file.arrayBuffer !== "function" || !root.crypto || !root.crypto.subtle) return null;
    try {
      const bytes = await file.arrayBuffer();
      const digest = await root.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      return null;
    }
  }

  function moderationRecord(asset, decision, details) {
    return {
      assetId: String(asset.id || asset.name || "asset"),
      digest: details.digest || null,
      mediaType: String(asset.type || asset.kind || "text/plain"),
      decision: normalizeDecision(decision),
      policyVersion: POLICY_VERSION,
      scannedAt: new Date().toISOString(),
      reasonCodes: Array.isArray(details.reasons) ? details.reasons.map(String).slice(0, 12) : [],
      scannerModel: details.model || null,
      scannerRole: details.role || null,
      provenance: asset.provenance || "USER_SUPPLIED",
      scope: details.scope || "full-content"
    };
  }

  async function scanText(asset, fetchImpl) {
    try {
      const response = await runtimeRequest("/v1/moderate/text", { input: asset.text }, fetchImpl);
      return moderationRecord(asset, response.decision, {
        reasons: response.reasons,
        model: response.model,
        role: response.role || "TEXT_SAFETY"
      });
    } catch (error) {
      return moderationRecord(asset, "REVIEW_REQUIRED", {
        reasons: ["Local text safety role unavailable: " + String(error && error.message || error)],
        role: "TEXT_SAFETY"
      });
    }
  }

  async function scanImage(asset, fetchImpl) {
    const dataUrl = asset.dataUrl || await readImage(asset.file || asset);
    const digest = await digestFile(asset.file || asset);
    if (!dataUrl) {
      return moderationRecord(asset, "REVIEW_REQUIRED", {
        digest,
        reasons: ["Image could not be prepared for local ShieldGemma review."],
        role: "IMAGE_SAFETY"
      });
    }
    try {
      const response = await runtimeRequest("/v1/moderate/image", {
        image: dataUrl,
        prompt: "Review this Infinity Mint asset for public token publication."
      }, fetchImpl);
      return moderationRecord(asset, response.decision, {
        digest,
        reasons: response.reasons,
        model: response.model,
        role: response.role || "IMAGE_SAFETY"
      });
    } catch (error) {
      return moderationRecord(asset, "REVIEW_REQUIRED", {
        digest,
        reasons: ["Local image safety role unavailable: " + String(error && error.message || error)],
        role: "IMAGE_SAFETY"
      });
    }
  }

  async function scanTextFile(asset, fetchImpl) {
    let content = "";
    try {
      const file = asset.file || asset;
      if (file && typeof file.text === "function") content = await file.text();
    } catch (_) {
      content = "";
    }
    if (!content) {
      return moderationRecord(asset, "REVIEW_REQUIRED", {
        digest: await digestFile(asset.file || asset),
        reasons: ["Text attachment could not be read for local content review."],
        role: "TEXT_SAFETY"
      });
    }
    const record = await scanText({ ...asset, text: content.slice(0, 20000) }, fetchImpl);
    record.digest = await digestFile(asset.file || asset);
    return record;
  }

  async function scanUnsupportedMedia(asset) {
    return moderationRecord(asset, "REVIEW_REQUIRED", {
      digest: await digestFile(asset.file || asset),
      reasons: ["This media type needs a content-capable local scanner before public minting."],
      role: "MEDIA_SAFETY",
      scope: "envelope-only"
    });
  }

  function normalizePackage(input, legacyFiles) {
    if (typeof input === "string") {
      return {
        text: input,
        files: Array.from(legacyFiles || []),
        images: [],
        provenance: []
      };
    }
    const value = input && typeof input === "object" ? input : {};
    return {
      text: String(value.text || ""),
      files: Array.from(value.files || []),
      images: Array.from(value.images || []),
      provenance: Array.from(value.provenance || [])
    };
  }

  async function moderate(input, filesOrFetch, maybeFetch) {
    const legacy = typeof input === "string";
    const packageInput = normalizePackage(input, legacy ? filesOrFetch : null);
    const fetchImpl = (legacy ? maybeFetch : filesOrFetch) || root.fetch;
    const deterministic = deterministicCheck(packageInput.text, packageInput.files);
    if (!deterministic.allowed) {
      return {
        ...deterministic,
        allowed: false,
        records: packageInput.files.map((file, index) => moderationRecord(
          { id: "file-" + index, ...file },
          "BLOCKED",
          { reasons: deterministic.reasons, scope: "file-envelope" }
        ))
      };
    }
    if (typeof fetchImpl !== "function") {
      return {
        ...deterministic,
        allowed: true,
        decision: "APPROVED",
        publicationDecision: "REVIEW_REQUIRED",
        source: "local-envelope-private-mint",
        records: [],
        reasons: ["Local AI review is offline; safe local minting is enabled and public publication remains pending."]
      };
    }

    const records = [];
    records.push(await scanText({
      id: "package-text",
      type: "text/plain",
      text: packageInput.text || "(blank note)",
      provenance: "PACKAGE_MANIFEST"
    }, fetchImpl));

    for (let index = 0; index < packageInput.files.length; index += 1) {
      const file = packageInput.files[index];
      const asset = {
        id: file.id || "file-" + index,
        name: file.name || "attachment-" + index,
        type: file.type || "",
        size: Number(file.size || 0),
        file,
        provenance: file.provenance || "USER_SUPPLIED"
      };
      if (/^image\//i.test(asset.type)) records.push(await scanImage(asset, fetchImpl));
      else if (/^text\//i.test(asset.type) || /\.(?:md|txt|csv|json)$/i.test(asset.name)) {
        records.push(await scanTextFile(asset, fetchImpl));
      } else if (/^(?:audio|video)\//i.test(asset.type) || asset.type === "application/pdf") {
        records.push(await scanUnsupportedMedia(asset));
      } else {
        records.push(moderationRecord(asset, "REVIEW_REQUIRED", {
          reasons: ["Attachment content could not be classified by an available local role."],
          role: "FILE_SAFETY",
          scope: "envelope-only"
        }));
      }
    }

    for (let index = 0; index < packageInput.images.length; index += 1) {
      records.push(await scanImage({
        id: packageInput.images[index].id || "generated-image-" + index,
        type: "image/png",
        provenance: packageInput.images[index].provenance || "USER_CREATED",
        dataUrl: packageInput.images[index].dataUrl
      }, fetchImpl));
    }

    const prePackageDecision = records.some(record => record.decision === "BLOCKED")
      ? "BLOCKED"
      : records.some(record => record.decision === "REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED"
        : "APPROVED";

    let packageRecord;
    if (prePackageDecision === "APPROVED") {
      packageRecord = await scanText({
        id: "assembled-package",
        type: "application/vnd.infinity.note+json",
        provenance: "PACKAGE_MANIFEST",
        text: JSON.stringify({
          text: packageInput.text,
          assets: records.map(record => ({
            assetId: record.assetId,
            mediaType: record.mediaType,
            provenance: record.provenance,
            decision: record.decision,
            digest: record.digest
          }))
        })
      }, fetchImpl);
      records.push(packageRecord);
    }

    const decision = records.some(record => record.decision === "BLOCKED")
      ? "BLOCKED"
      : records.some(record => record.decision === "REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED"
        : "APPROVED";

    const scannerUnavailableOnly = decision === "REVIEW_REQUIRED" && records.every((record) =>
      record.decision === "APPROVED" || (
        record.decision === "REVIEW_REQUIRED" &&
        !record.scannerModel &&
        record.reasonCodes.every((reason) => /unavailable|could not|needs a content-capable local scanner/i.test(reason))
      )
    );
    if (scannerUnavailableOnly) {
      return {
        allowed: true,
        decision: "APPROVED",
        publicationDecision: "REVIEW_REQUIRED",
        source: "local-envelope-private-mint",
        policyVersion: POLICY_VERSION,
        records,
        reasons: ["Safe local envelope checks passed. AI publication review is unavailable, so the note remains private."]
      };
    }

    return {
      allowed: decision === "APPROVED",
      decision,
      publicationDecision: decision,
      source: "infinity-ai-runtime",
      policyVersion: POLICY_VERSION,
      records,
      reasons: records
        .filter(record => record.decision !== "APPROVED")
        .flatMap(record => record.reasonCodes)
        .slice(0, 12)
    };
  }

  function collectFiles(doc) {
    const inputs = ["imageFile", "audioFile", "videoFile", "docFile"]
      .flatMap(id => Array.from((doc.getElementById(id) || {}).files || []));
    const draft = root.InfinityMintDraft;
    if (!draft || typeof draft.getFiles !== "function") return inputs;
    const seen = new Set(inputs);
    return inputs.concat(draft.getFiles().filter(file => !seen.has(file)));
  }

  function collectPackage(doc) {
    const draft = root.InfinityMintDraft;
    if (draft && typeof draft.getModerationPackage === "function") {
      const value = draft.getModerationPackage();
      return { ...value, files: collectFiles(doc) };
    }
    const intent = doc.getElementById("intent");
    return { text: intent ? intent.value : "", files: collectFiles(doc), images: [] };
  }

  function install(doc) {
    const button = doc.getElementById("mintBtn");
    const status = doc.getElementById("moderationStatus");
    if (!button || !status || button.dataset.moderationInstalled === "true") return false;
    button.dataset.moderationInstalled = "true";
    const mint = button.onclick;
    button.onclick = async function (event) {
      event.preventDefault();
      button.disabled = true;
      delete root.__infinityMintModerationResult;
      if (root.InfinityMintDraft && root.InfinityMintDraft.setState) root.InfinityMintDraft.setState("SCANNING");
      status.textContent = "Checking every package component with the shared local Gemma safety gateway…";
      status.dataset.state = "checking";
      const result = await moderate(collectPackage(doc));
      status.dataset.state = result.decision.toLowerCase();
      if (result.allowed) {
        status.textContent = result.publicationDecision === "REVIEW_REQUIRED"
          ? "LOCAL MINT APPROVED · this private note can be created now; AI review remains pending only for public publication."
          : "APPROVED · package and assets passed local text/image safety roles.";
      } else {
        status.textContent = result.decision + " · " + (result.reasons.join(" ") || "Draft remains private until local screening succeeds.");
      }
      button.disabled = false;
      if (!result.allowed) {
        if (root.InfinityMintDraft && root.InfinityMintDraft.setState) root.InfinityMintDraft.setState(result.decision);
        return;
      }
      root.__infinityMintModerationResult = { ...result, checkedAt: new Date().toISOString() };
      if (root.InfinityMintDraft && root.InfinityMintDraft.setState) root.InfinityMintDraft.setState("MINTABLE");
      if (typeof mint === "function") await mint.call(button, event);
    };
    return true;
  }

  return {
    POLICY_VERSION,
    deterministicCheck,
    normalizeDecision,
    moderate,
    collectPackage,
    install
  };
});
