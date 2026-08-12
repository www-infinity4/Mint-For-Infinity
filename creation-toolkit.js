(function (root) {
  "use strict";

  const doc = root.document;
  const draft = root.InfinityMintDraft;
  if (!doc || !draft) return;

  const byId = id => doc.getElementById(id);
  const canvas = byId("artCanvas");
  const stateLabel = byId("draftState");
  const audioStatus = byId("audioRecordStatus");
  const inputs = [
    "writingTitle", "writingBody", "productName", "productBrand", "productDescription",
    "productPrice", "productCta", "productUrl", "promoCode", "rightsNote", "licenseType"
  ].map(byId).filter(Boolean);

  function invalidate() {
    draft.invalidate("LOCAL_DRAFT");
  }

  inputs.forEach(input => input.addEventListener("input", invalidate));

  doc.querySelectorAll("[data-tool-panel]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = byId(button.dataset.toolPanel);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
    });
  });

  if (stateLabel) {
    doc.addEventListener("infinity-mint:draft-state", event => {
      stateLabel.textContent = event.detail.state.replaceAll("_", " ");
      stateLabel.dataset.state = event.detail.state;
    });
  }

  if (canvas) {
    const context = canvas.getContext("2d");
    let drawing = false;
    let undoStack = [];
    let redoStack = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = root.devicePixelRatio || 1;
      const prior = canvas.width && canvas.height ? canvas.toDataURL() : null;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = byId("brushColor").value;
      context.lineWidth = Number(byId("brushWidth").value);
      context.fillStyle = "#f7f2dc";
      context.fillRect(0, 0, rect.width, rect.height);
      if (prior) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = prior;
      }
    }

    function snapshot() {
      undoStack.push(canvas.toDataURL("image/png"));
      if (undoStack.length > 20) undoStack.shift();
      redoStack = [];
    }

    function restore(dataUrl) {
      const image = new Image();
      image.onload = () => {
        const rect = canvas.getBoundingClientRect();
        context.fillStyle = "#f7f2dc";
        context.fillRect(0, 0, rect.width, rect.height);
        context.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = dataUrl;
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    }

    canvas.addEventListener("pointerdown", event => {
      snapshot();
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      context.strokeStyle = byId("brushColor").value;
      context.lineWidth = Number(byId("brushWidth").value);
      const [x, y] = point(event);
      context.beginPath();
      context.moveTo(x, y);
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", event => {
      if (!drawing) return;
      const [x, y] = point(event);
      context.lineTo(x, y);
      context.stroke();
      invalidate();
      event.preventDefault();
    });
    canvas.addEventListener("pointerup", () => { drawing = false; });
    canvas.addEventListener("pointercancel", () => { drawing = false; });

    byId("artUndo").addEventListener("click", () => {
      if (!undoStack.length) return;
      redoStack.push(canvas.toDataURL("image/png"));
      restore(undoStack.pop());
      invalidate();
    });
    byId("artRedo").addEventListener("click", () => {
      if (!redoStack.length) return;
      undoStack.push(canvas.toDataURL("image/png"));
      restore(redoStack.pop());
      invalidate();
    });
    byId("artClear").addEventListener("click", () => {
      snapshot();
      const rect = canvas.getBoundingClientRect();
      context.fillStyle = "#f7f2dc";
      context.fillRect(0, 0, rect.width, rect.height);
      invalidate();
    });
    byId("artAttach").addEventListener("click", () => {
      draft.addGeneratedImage({
        id: "art-" + Date.now().toString(36),
        name: "Art Pad creation.png",
        dataUrl: canvas.toDataURL("image/png"),
        provenance: "USER_CREATED"
      });
      byId("artStatus").textContent = "Art attached as a private draft and queued for image moderation.";
    });

    resize();
    root.addEventListener("resize", resize);
  }

  let recorder = null;
  let stream = null;
  let chunks = [];

  byId("audioStart").addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        const extension = /ogg/i.test(mime) ? "ogg" : /mp4/i.test(mime) ? "m4a" : "webm";
        const file = typeof File === "function"
          ? new File([blob], "Infinity voice note " + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension, { type: mime })
          : Object.assign(blob, { name: "Infinity voice note." + extension });
        draft.addFile(file, "audio", "USER_RECORDED");
        if (audioStatus) audioStatus.textContent = "Recording saved as a private draft. Audio requires a content-capable local scanner before public minting.";
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      });
      recorder.start();
      byId("audioStart").disabled = true;
      byId("audioStop").disabled = false;
      if (audioStatus) audioStatus.textContent = "Recording… tap Stop when finished.";
    } catch (error) {
      if (audioStatus) audioStatus.textContent = "Microphone unavailable: " + String(error && error.message || error);
    }
  });

  byId("audioStop").addEventListener("click", () => {
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    byId("audioStart").disabled = false;
    byId("audioStop").disabled = true;
  });

  root.InfinityMintToolkit = {
    textManifest() {
      return {
        writing: {
          title: byId("writingTitle").value.trim(),
          body: byId("writingBody").value.trim()
        },
        productAd: {
          name: byId("productName").value.trim(),
          brand: byId("productBrand").value.trim(),
          description: byId("productDescription").value.trim(),
          priceText: byId("productPrice").value.trim(),
          callToAction: byId("productCta").value.trim(),
          destinationUrl: byId("productUrl").value.trim(),
          promoCode: byId("promoCode").value.trim()
        },
        rights: {
          license: byId("licenseType").value,
          note: byId("rightsNote").value.trim()
        }
      };
    }
  };
})(window);
