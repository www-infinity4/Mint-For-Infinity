(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityCoinIntelligence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function textFrom(value, depth) {
    if (value == null || depth > 4) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(item => textFrom(item, depth + 1)).filter(Boolean).join(' ');
    if (typeof value === 'object') return Object.entries(value).map(([key, item]) => key + ' ' + textFrom(item, depth + 1)).join(' ');
    return '';
  }

  function attachmentText(attachment) {
    return [
      attachment && attachment.type,
      attachment && attachment.title,
      attachment && attachment.name,
      attachment && attachment.description,
      attachment && attachment.sourceUrl,
      attachment && attachment.contentDigest,
      textFrom(attachment && attachment.metadata, 0),
      textFrom(attachment && attachment.content, 0)
    ].filter(Boolean).join(' · ');
  }

  function coinDocuments(state) {
    return Object.values(state && state.tokens || {}).map(token => {
      const attachments = Array.isArray(token.attachments) ? token.attachments : [];
      return {
        id: 'coin:' + token.tokenId,
        title: token.title || token.tokenId,
        tags: [token.kind, token.state, token.sourceSystem].concat(attachments.map(item => item.type)).filter(Boolean),
        text: [
          'Token ' + token.tokenId,
          token.title,
          token.kind,
          token.state,
          token.sourceSystem,
          token.contentDigest,
          attachments.length + ' attachments',
          attachments.map(attachmentText).join(' ')
        ].filter(Boolean).join(' · '),
        updatedAt: token.mintedAt || new Date().toISOString()
      };
    });
  }

  function optionHtml(value, label) {
    const escape = input => String(input == null ? '' : input).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
    return '<option value="' + escape(value) + '">' + escape(label) + '</option>';
  }

  async function mount(options) {
    const doc = options && options.document || root.document;
    const page = options && options.page || root.infinityUnifiedWalletPage;
    const Kernel = options && options.Kernel || root.InfinityAIKernel;
    if (!doc || !page || !Kernel) return null;

    const tokenSelect = doc.getElementById('coinIntelToken');
    const typeSelect = doc.getElementById('coinIntelType');
    const titleInput = doc.getElementById('coinIntelTitle');
    const urlInput = doc.getElementById('coinIntelUrl');
    const descriptionInput = doc.getElementById('coinIntelDescription');
    const attachButton = doc.getElementById('coinIntelAttach');
    const status = doc.getElementById('coinIntelStatus');
    const question = doc.getElementById('coinIntelQuestion');
    const askButton = doc.getElementById('coinIntelAsk');
    const answer = doc.getElementById('coinIntelAnswer');
    const inventory = doc.getElementById('coinIntelInventory');
    if (![tokenSelect,typeSelect,titleInput,urlInput,descriptionInput,attachButton,status,question,askButton,answer,inventory].every(Boolean)) return null;

    const engine = new Kernel.InfinityLanguageEngine();
    const bus = new Kernel.InfinitySiteBus();

    function refresh() {
      const wallet = page.wallet;
      const current = page.current();
      const tokens = current ? current.tokenIds.map(id => wallet.state.tokens[id]).filter(Boolean) : [];
      tokenSelect.innerHTML = tokens.length
        ? tokens.map(token => optionHtml(token.tokenId, token.title + ' · ' + token.kind)).join('')
        : optionHtml('', 'No owned tokens yet');
      attachButton.disabled = !tokens.length;
      const documents = coinDocuments(wallet.state);
      if (documents.length) engine.addDocuments(documents);
      inventory.innerHTML = tokens.length ? tokens.map(token => {
        const attachments = Array.isArray(token.attachments) ? token.attachments : [];
        return '<article class="token"><b>' + token.title + '</b><span>' + attachments.length + ' attachment' + (attachments.length === 1 ? '' : 's') + '</span>' +
          attachments.map(item => '<p>' + String(item.type || 'LINK').replaceAll('_',' ') + ' · ' + (item.title || item.name || item.sourceUrl || item.contentDigest) + '</p>').join('') + '</article>';
      }).join('') : '<p class="empty">Mint or receive a complete token before adding attachments.</p>';
      status.textContent = documents.length + ' owned coin document' + (documents.length === 1 ? '' : 's') + ' indexed on this device.';
    }

    async function attach() {
      const owner = page.current();
      if (!owner || !tokenSelect.value) return;
      const record = {
        type: typeSelect.value,
        title: titleInput.value.trim(),
        sourceUrl: urlInput.value.trim(),
        description: descriptionInput.value.trim()
      };
      if (!record.title || (!record.sourceUrl && !record.description)) {
        status.textContent = 'Give the attachment a title and a source URL or description.';
        return;
      }
      attachButton.disabled = true;
      try {
        const contentDigest = await Kernel.sha256(record);
        const attachmentId = 'attachment:' + contentDigest.slice(0, 24);
        const timestamp = new Date().toISOString();
        await page.wallet.attachToToken({
          eventId: 'wallet:' + attachmentId,
          tokenId: tokenSelect.value,
          ownerWalletId: owner.walletId,
          attachmentId,
          type: record.type,
          title: record.title,
          sourceUrl: record.sourceUrl || null,
          description: record.description || null,
          contentDigest,
          metadata: { addedFrom: location.pathname },
          timestamp
        });
        const siteEvent = await bus.append({
          eventId: 'site:' + attachmentId,
          type: 'TOKEN_ATTACHMENT_ADDED',
          sourceSite: 'UNIFIED_INFINITY_WALLET',
          actorWalletId: owner.walletId,
          timestamp,
          payload: { tokenId: tokenSelect.value, attachmentId, title: record.title, attachmentType: record.type, contentDigest }
        });
        engine.learnFromEvent(siteEvent);
        page.render();
        titleInput.value = '';
        urlInput.value = '';
        descriptionInput.value = '';
        refresh();
        status.textContent = record.type.replaceAll('_',' ') + ' attached with SHA-256 provenance.';
      } catch (error) {
        status.textContent = 'Attachment failed: ' + error.message;
      } finally {
        attachButton.disabled = false;
      }
    }

    function ask() {
      const query = question.value.trim();
      if (!query) return;
      const result = engine.answer(query, { surface: 'UNIFIED_WALLET_COIN_INTELLIGENCE' });
      answer.textContent = result.text;
    }

    attachButton.addEventListener('click', attach);
    askButton.addEventListener('click', ask);
    question.addEventListener('keydown', event => { if (event.key === 'Enter') ask(); });
    refresh();
    const mounted = { engine, bus, refresh, attach, ask };
    root.infinityCoinIntelligence = mounted;
    return mounted;
  }

  if (root.document) {
    const start = () => mount();
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  return { textFrom, attachmentText, coinDocuments, mount };
});
