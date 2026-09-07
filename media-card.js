(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityMediaCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'infinity/media-card/v1';
  const EDITION = '1/1';
  const MEDIA_KINDS = new Set(['MOVIE', 'SONG']);

  function required(value, label) {
    const result = String(value || '').trim();
    if (!result) throw new Error(label + ' is required.');
    return result;
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const input = typeof value === 'string' ? value : canonical(value);
    if (typeof require === 'function') return require('node:crypto').createHash('sha256').update(input).digest('hex');
    if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('SHA-256 is unavailable.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function createMediaCard(input) {
    const mediaKind = required(input.mediaKind, 'mediaKind').toUpperCase();
    if (!MEDIA_KINDS.has(mediaKind)) throw new Error('mediaKind must be MOVIE or SONG.');
    const coinId = required(input.coinId, 'coinId');
    const mediaId = required(input.mediaId, 'mediaId');
    const title = required(input.title, 'title');
    const capturedAt = required(input.capturedAt, 'capturedAt');
    const frame = {
      status: required(input.frame && input.frame.status, 'frame.status').toUpperCase(),
      imageUrl: input.frame && input.frame.imageUrl ? String(input.frame.imageUrl) : null,
      contentDigest: input.frame && input.frame.contentDigest ? String(input.frame.contentDigest) : null,
      playbackSeconds: Math.max(0, Number(input.frame && input.frame.playbackSeconds) || 0),
      sourceUrl: input.frame && input.frame.sourceUrl ? String(input.frame.sourceUrl) : null,
      captureAgent: String(input.frame && input.frame.captureAgent || 'SONA'),
      failureReason: input.frame && input.frame.failureReason ? String(input.frame.failureReason) : null
    };
    if (!['CAPTURED', 'PENDING_SOURCE_PERMISSION'].includes(frame.status)) throw new Error('Unsupported frame status.');
    if (frame.status === 'CAPTURED' && (!frame.imageUrl || !frame.contentDigest)) {
      throw new Error('A captured card requires its frame image and digest.');
    }
    const identity = { schema: SCHEMA, coinId, mediaKind, mediaId, edition: EDITION, capturedAt, frameDigest: frame.contentDigest };
    const digest = await sha256(identity);
    return {
      schema: SCHEMA,
      cardId: 'infinity-card:' + digest.slice(0, 32),
      coinId,
      mediaKind,
      mediaId,
      title,
      subtitle: input.subtitle ? String(input.subtitle) : null,
      edition: EDITION,
      displayMark: 'Infinity 2026®',
      capturedAt,
      frame,
      provenance: {
        generator: 'INFINITY_MEDIA_CARD_FACTORY',
        sourceRecordUrl: input.sourceRecordUrl ? String(input.sourceRecordUrl) : null,
        cardDigest: digest
      }
    };
  }

  async function createCardsForCoin(input) {
    const media = Array.isArray(input.media) ? input.media : [];
    const eligible = media.filter(item => MEDIA_KINDS.has(String(item.mediaKind || '').toUpperCase()));
    if (!eligible.length) throw new Error('At least one movie or song is required.');
    const cards = await Promise.all(eligible.map(item => createMediaCard({ ...item, coinId: input.coinId })));
    const unique = new Set(cards.map(card => card.mediaKind + ':' + card.mediaId));
    if (unique.size !== cards.length) throw new Error('A coin cannot contain duplicate media cards.');
    return cards;
  }

  return { SCHEMA, EDITION, createMediaCard, createCardsForCoin, sha256 };
});
