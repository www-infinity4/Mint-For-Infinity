(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityCollectibleValue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ATTACHMENT_TYPES = new Set(['SIGNATURE', 'VIDEO', 'AUDIO', 'ARTWORK', 'DOCUMENT', 'PRODUCT', 'PROVENANCE']);

  function required(value, label) {
    const result = String(value || '').trim();
    if (!result) throw new Error(label + ' is required.');
    return result;
  }

  function nonNegativeInteger(value, label) {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0) throw new Error(label + ' must be a non-negative safe integer.');
    return result;
  }

  function createCollectibleNote(input) {
    const note = {
      schema: 'infinity/collectible-note/v1',
      tokenId: required(input && input.tokenId, 'tokenId'),
      serial: required(input && input.serial, 'serial'),
      faceUnits: nonNegativeInteger(input && input.faceUnits, 'faceUnits'),
      attachments: [],
      marketObservations: [],
    };
    return note;
  }

  function addAttachment(note, input) {
    const type = required(input && input.type, 'attachment type').toUpperCase();
    if (!ATTACHMENT_TYPES.has(type)) throw new Error('Attachment type is invalid.');
    const attachment = {
      id: required(input.id, 'attachment id'), type,
      creatorName: required(input.creatorName, 'creatorName'),
      contentDigest: required(input.contentDigest, 'contentDigest'),
      createdAt: required(input.createdAt, 'createdAt'),
      verificationState: String(input.verificationState || 'UNVERIFIED').toUpperCase(),
    };
    if (note.attachments.some(item => item.id === attachment.id)) throw new Error('Duplicate attachment.');
    note.attachments.push(attachment);
    return attachment;
  }

  function recordMarketObservation(note, input) {
    const observation = {
      id: required(input && input.id, 'observation id'),
      kind: required(input && input.kind, 'observation kind').toUpperCase(),
      amount: Number(input && input.amount),
      currency: required(input && input.currency, 'currency').toUpperCase(),
      source: required(input && input.source, 'source'),
      observedAt: required(input && input.observedAt, 'observedAt'),
      binding: false,
    };
    if (!Number.isFinite(observation.amount) || observation.amount < 0) throw new Error('Observation amount must be non-negative.');
    if (note.marketObservations.some(item => item.id === observation.id)) throw new Error('Duplicate market observation.');
    note.marketObservations.push(observation);
    return observation;
  }

  function valueStatement(note) {
    return {
      tokenId: note.tokenId,
      faceUnits: note.faceUnits,
      attachmentCount: note.attachments.length,
      marketObservations: note.marketObservations.slice(),
      rule: 'Attachments and market observations do not alter ledger face units or guarantee a future exchange value.',
    };
  }

  return { createCollectibleNote, addAttachment, recordMarketObservation, valueStatement };
});
