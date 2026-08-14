(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityAIKernel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const EVENT_KEY = 'infinity-site-events-v1';
  const DOCUMENT_KEY = 'infinity-language-documents-v1';
  const CHANNEL = 'infinity-site-bus-v1';
  const SCHEMA = 'infinity/site-event/v1';
  const MAX_EVENTS = 5000;
  const stopWords = new Set('a an and are as at be by for from has have how i in is it of on or that the this to was what when where who why with you your'.split(' '));

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clean(value, label) {
    const text = String(value || '').trim();
    if (!text) throw new Error((label || 'value') + ' is required.');
    return text;
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function sha256(value) {
    const input = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
    const bytes = await root.crypto.subtle.digest('SHA-256', input);
    return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function memoryStorage() {
    const values = new Map();
    return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)) };
  }
  function loadList(storage, key) {
    try { const value = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function tokens(value) {
    return [...new Set(String(value || '').toLowerCase().replace(/[^a-z0-9$]+/g, ' ').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word)))];
  }

  class InfinitySiteBus {
    constructor(options = {}) {
      this.storage = options.storage || root.localStorage || memoryStorage();
      this.events = loadList(this.storage, EVENT_KEY);
      this.listeners = new Set();
      this.channel = typeof root.BroadcastChannel === 'function' ? new root.BroadcastChannel(CHANNEL) : null;
      if (this.channel) this.channel.onmessage = event => this.receive(event.data);
      if (root.addEventListener) root.addEventListener('storage', event => {
        if (event.key === EVENT_KEY) this.reload();
      });
    }
    reload() {
      this.events = loadList(this.storage, EVENT_KEY);
      this.notify(this.events[this.events.length - 1] || null);
      return this.snapshot();
    }
    snapshot() { return clone(this.events); }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    notify(event) {
      if (!event) return;
      this.listeners.forEach(listener => { try { listener(clone(event)); } catch (_) {} });
      if (root.document) root.document.dispatchEvent(new CustomEvent('infinity:site-event', { detail: clone(event) }));
    }
    receive(event) {
      if (!event || this.events.some(item => item.eventId === event.eventId)) return;
      this.events.push(clone(event));
      this.events = this.events.slice(-MAX_EVENTS);
      this.storage.setItem(EVENT_KEY, JSON.stringify(this.events));
      this.notify(event);
    }
    async append(input = {}) {
      const eventId = clean(input.eventId, 'eventId');
      const existing = this.events.find(event => event.eventId === eventId);
      if (existing) return clone(existing);
      const previous = this.events[this.events.length - 1] || null;
      const body = {
        schema: SCHEMA,
        sequence: previous ? previous.sequence + 1 : 1,
        eventId,
        type: clean(input.type, 'type').toUpperCase(),
        sourceSite: clean(input.sourceSite, 'sourceSite').toUpperCase(),
        timestamp: input.timestamp || new Date().toISOString(),
        previousHash: previous ? previous.hash : null,
        actorWalletId: input.actorWalletId ? String(input.actorWalletId) : null,
        payload: clone(input.payload || {})
      };
      const event = { ...body, hash: await sha256(body) };
      this.events.push(event);
      this.events = this.events.slice(-MAX_EVENTS);
      this.storage.setItem(EVENT_KEY, JSON.stringify(this.events));
      if (this.channel) this.channel.postMessage(event);
      this.notify(event);
      return clone(event);
    }
    query(filter = {}) {
      return this.events.filter(event =>
        (!filter.type || event.type === String(filter.type).toUpperCase()) &&
        (!filter.sourceSite || event.sourceSite === String(filter.sourceSite).toUpperCase()) &&
        (!filter.actorWalletId || event.actorWalletId === filter.actorWalletId)
      ).map(clone);
    }
    async verify() {
      let previousHash = null;
      let expectedSequence = Math.max(1, this.events.length ? this.events[0].sequence : 1);
      for (const event of this.events) {
        const { hash, ...body } = event;
        if (event.sequence !== expectedSequence || event.previousHash !== previousHash && expectedSequence !== this.events[0].sequence || await sha256(body) !== hash) return false;
        previousHash = hash;
        expectedSequence += 1;
      }
      return true;
    }
  }

  class InfinityLanguageEngine {
    constructor(options = {}) {
      this.storage = options.storage || root.localStorage || memoryStorage();
      this.documents = loadList(this.storage, DOCUMENT_KEY);
      if (!this.documents.length) this.addDocuments(InfinityLanguageEngine.coreDocuments(), false);
    }
    static coreDocuments() {
      return [
        { id: 'infinity-wallet', title: 'Unified Infinity Wallet', tags: ['wallet','ledger','coins'], text: 'The unified Infinity wallet keeps identifiable tokens, balances, source systems and hash-chained events together on the same device.' },
        { id: 'infinity-mint', title: 'Infinity Mint', tags: ['mint','$1','daily limit'], text: 'Infinity Mint creates one $1 Infinity note at a time. A wallet may mint up to $10 Infinity per local calendar day. Each note has a unique content hash and serial.' },
        { id: 'starquest-cosmo', title: 'StarQuest Cosmo', tags: ['starquest','cosmo','television'], text: 'Cosmo is the StarQuest companion. It can answer from the catalogue, viewer-controlled history, live playback context and verified research sources.' },
        { id: 'site-bus', title: 'Infinity Site Bus', tags: ['sites','events','communication'], text: 'Infinity GitHub Pages projects share same-origin browser storage. The Infinity Site Bus publishes hash-chained events through localStorage, storage events and BroadcastChannel without a private application server.' }
      ];
    }
    save() { this.storage.setItem(DOCUMENT_KEY, JSON.stringify(this.documents)); }
    addDocuments(documents, persist = true) {
      for (const input of documents || []) {
        const document = { id: clean(input.id, 'document id'), title: clean(input.title, 'document title'), text: clean(input.text, 'document text'), tags: Array.from(input.tags || []).map(String), updatedAt: input.updatedAt || new Date().toISOString() };
        const index = this.documents.findIndex(item => item.id === document.id);
        if (index >= 0) this.documents[index] = document; else this.documents.push(document);
      }
      if (persist) this.save();
      return this.documents.length;
    }
    retrieve(query, limit = 3) {
      const queryTokens = tokens(query);
      return this.documents.map(document => {
        const titleTokens = tokens(document.title + ' ' + document.tags.join(' '));
        const bodyTokens = tokens(document.text);
        let score = 0;
        queryTokens.forEach(token => {
          if (titleTokens.includes(token)) score += 4;
          if (bodyTokens.includes(token)) score += 1;
          if (document.text.toLowerCase().includes(token)) score += 0.5;
        });
        return { document: clone(document), score };
      }).filter(match => match.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    }
    answer(query, context = {}) {
      const matches = this.retrieve(query, 3);
      if (!matches.length) return { text: 'I do not have enough Infinity project evidence for that yet. Add the relevant research or site event and I will use it.', confidence: 0, sources: [] };
      const best = matches[0];
      const related = matches.slice(1).map(match => match.document.title);
      const suffix = related.length ? ' Related: ' + related.join(', ') + '.' : '';
      return {
        text: best.document.text + suffix,
        confidence: Math.min(1, best.score / Math.max(4, tokens(query).length * 4)),
        sources: matches.map(match => ({ id: match.document.id, title: match.document.title, score: match.score })),
        context: clone(context)
      };
    }
    learnFromEvent(event) {
      if (!event || !event.eventId) return null;
      const payload = event.payload || {};
      const text = [event.type, event.sourceSite, payload.title, payload.serial, payload.intent].filter(Boolean).join(' · ');
      this.addDocuments([{ id: 'event:' + event.eventId, title: event.type + ' from ' + event.sourceSite, tags: [event.type, event.sourceSite], text, updatedAt: event.timestamp }]);
      return 'event:' + event.eventId;
    }
  }

  return { InfinitySiteBus, InfinityLanguageEngine, EVENT_KEY, DOCUMENT_KEY, SCHEMA, sha256, memoryStorage };
});