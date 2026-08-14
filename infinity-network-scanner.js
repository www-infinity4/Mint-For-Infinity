(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityNetworkScanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function summarizeEvent(event) {
    const payload = event && event.payload ? event.payload : {};
    return {
      sequence: Number(event && event.sequence || 0),
      eventId: String(event && event.eventId || ''),
      type: String(event && event.type || 'UNKNOWN'),
      sourceSite: String(event && event.sourceSite || 'UNKNOWN'),
      timestamp: String(event && event.timestamp || ''),
      actorWalletId: event && event.actorWalletId ? String(event.actorWalletId) : 'No wallet actor',
      hash: String(event && event.hash || ''),
      previousHash: event && event.previousHash ? String(event.previousHash) : 'GENESIS',
      title: String(payload.title || payload.serial || payload.tokenId || payload.intent || 'Recorded Infinity event'),
      payload
    };
  }

  function filterEvents(events, filters) {
    const source = String(filters && filters.sourceSite || '').toUpperCase();
    const type = String(filters && filters.type || '').toUpperCase();
    return (events || []).filter(event =>
      (!source || String(event.sourceSite || '').toUpperCase() === source) &&
      (!type || String(event.type || '').toUpperCase() === type)
    );
  }

  function optionValues(events, key) {
    return Array.from(new Set(events.map(event => String(event[key] || '')).filter(Boolean))).sort();
  }

  function mount(options) {
    const doc = options && options.document || root.document;
    const Kernel = options && options.Kernel || root.InfinityAIKernel;
    if (!doc) return null;

    const list = doc.getElementById('networkEvents');
    const status = doc.getElementById('networkStatus');
    const sourceFilter = doc.getElementById('networkSource');
    const typeFilter = doc.getElementById('networkType');
    const verifyButton = doc.getElementById('verifyNetwork');
    const count = doc.getElementById('networkCount');
    if (!list || !status || !sourceFilter || !typeFilter || !verifyButton || !count) return null;

    if (!Kernel || !Kernel.InfinitySiteBus) {
      status.textContent = 'Infinity Site Bus is unavailable.';
      return null;
    }

    const bus = options && options.bus || new Kernel.InfinitySiteBus();

    function fillFilters() {
      const events = bus.snapshot();
      const selectedSource = sourceFilter.value;
      const selectedType = typeFilter.value;
      sourceFilter.innerHTML = '<option value="">All source sites</option>' + optionValues(events, 'sourceSite').map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value.replaceAll('_', ' ')) + '</option>').join('');
      typeFilter.innerHTML = '<option value="">All event types</option>' + optionValues(events, 'type').map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value.replaceAll('_', ' ')) + '</option>').join('');
      sourceFilter.value = selectedSource;
      typeFilter.value = selectedType;
    }

    function render() {
      const events = filterEvents(bus.snapshot(), {
        sourceSite: sourceFilter.value,
        type: typeFilter.value
      }).slice().reverse();
      count.textContent = events.length.toLocaleString() + ' visible';
      list.innerHTML = events.length ? events.map(raw => {
        const event = summarizeEvent(raw);
        return '<article class="network-event">' +
          '<div class="network-event-head"><b>#' + event.sequence + ' · ' + escapeHtml(event.type.replaceAll('_', ' ')) + '</b><span>' + escapeHtml(event.sourceSite) + '</span></div>' +
          '<p>' + escapeHtml(event.title) + '</p>' +
          '<small>' + escapeHtml(event.timestamp) + ' · ' + escapeHtml(event.actorWalletId) + '</small>' +
          '<code>hash ' + escapeHtml(event.hash) + '</code>' +
          '<code>previous ' + escapeHtml(event.previousHash) + '</code>' +
          '</article>';
      }).join('') : '<p class="empty">No Infinity site events match this view yet. Create a real Mint note, Crusher research token, or StarQuest event and it will appear here.</p>';
    }

    async function verify() {
      verifyButton.disabled = true;
      status.textContent = 'Verifying the local hash chain…';
      try {
        const valid = await bus.verify();
        status.textContent = valid
          ? 'Chain verified · every visible event retains its stored SHA-256 link.'
          : 'Chain verification failed · one or more stored events no longer matches its hash link.';
        status.dataset.state = valid ? 'valid' : 'invalid';
      } catch (error) {
        status.textContent = 'Chain verification error: ' + error.message;
        status.dataset.state = 'invalid';
      } finally {
        verifyButton.disabled = false;
      }
    }

    sourceFilter.addEventListener('change', render);
    typeFilter.addEventListener('change', render);
    verifyButton.addEventListener('click', verify);
    bus.subscribe(function () { fillFilters(); render(); });
    fillFilters();
    render();
    verify();

    const mounted = { bus, render, verify };
    root.infinityNetworkScanner = mounted;
    return mounted;
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }

  return { escapeHtml, summarizeEvent, filterEvents, mount };
});
