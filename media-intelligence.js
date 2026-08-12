(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityMediaIntelligence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function tags(value) { return Array.from(new Set((Array.isArray(value) ? value : []).map(item => clean(item).toLowerCase()).filter(Boolean))); }
  function intersects(a, b) { const right = new Set(b); return a.filter(item => right.has(item)); }
  function invariant(condition, message) { if (!condition) throw new Error(message); }

  function verifyWatchReceipt(receipt) {
    invariant(receipt && clean(receipt.contentTokenId), 'Content token is required.');
    invariant(clean(receipt.status) === 'AI_WATCHED_MEDIA', 'Receipt must be an AI_WATCHED_MEDIA record.');
    invariant(clean(receipt.modelId) && clean(receipt.startedAt) && clean(receipt.finishedAt), 'Model and watch timestamps are required.');
    invariant(/^[a-f0-9]{64}$/i.test(clean(receipt.mediaDigest)), 'A SHA-256 media digest is required.');
    invariant(/^[a-f0-9]{64}$/i.test(clean(receipt.analysisDigest)), 'A SHA-256 analysis digest is required.');
    invariant(Array.isArray(receipt.cues), 'Watch receipt cues are required.');
    return true;
  }

  function rankProduct(product, context, profile) {
    const productTags = tags(product.tags);
    const contextMatches = intersects(productTags, tags(context.tags));
    const likes = intersects(productTags, tags(profile.likes));
    const needs = intersects(productTags, tags(profile.openNeeds));
    const dislikes = intersects(productTags.concat([clean(product.brand).toLowerCase()]), tags(profile.dislikes));
    const blocked = intersects(productTags.concat([clean(product.brand).toLowerCase()]), tags(profile.blocked));
    const purchased = tags(profile.completedPurchases).includes(clean(product.id).toLowerCase());
    if (blocked.length || dislikes.length || purchased) return { eligible: false, score: 0, reasonCodes: blocked.length ? ['BLOCKED_BY_VIEWER'] : dislikes.length ? ['KNOWN_DISLIKE'] : ['NEED_ALREADY_COMPLETED'] };
    if (!contextMatches.length) return { eligible: false, score: 0, reasonCodes: ['NO_SCENE_RELEVANCE'] };
    const score = Math.min(100, contextMatches.length * 18 + likes.length * 18 + needs.length * 30 + (product.local && profile.locationConsent ? 10 : 0));
    return { eligible: score >= 25, score, reasonCodes: [].concat(['SCENE_CONTEXT_MATCH'], likes.length ? ['CONSENTED_LIKE_MATCH'] : [], needs.length ? ['OPEN_NEED_MATCH'] : [], product.local && profile.locationConsent ? ['LOCAL_WITH_LOCATION_CONSENT'] : []) };
  }

  function createCosmoPlan(input) {
    verifyWatchReceipt(input.watchReceipt);
    const products = Array.isArray(input.products) ? input.products : [];
    const profile = input.viewerProfile || {};
    const cues = input.watchReceipt.cues;
    const moments = [];
    cues.forEach((cue, cueIndex) => {
      const context = { tags: tags([].concat(cue.tags || [], cue.objects || [], cue.topics || [])) };
      const ranked = products.map(product => ({ product, result: rankProduct(product, context, profile) })).filter(item => item.result.eligible).sort((a, b) => b.result.score - a.result.score);
      const best = ranked[0];
      moments.push({
        id: 'cosmo-moment:' + cueIndex,
        startSeconds: Number(cue.startSeconds || 0),
        endSeconds: Number(cue.endSeconds || cue.startSeconds || 0),
        observation: clean(cue.observation || cue.transcript),
        missedDetail: clean(cue.missedDetail),
        educationalValue: clean(cue.educationalValue),
        recommendation: best ? { productId: best.product.id, brand: best.product.brand, score: best.result.score, reasonCodes: best.result.reasonCodes,
          script: 'Cosmo noticed ' + clean(cue.observation || 'something useful in this scene') + '. ' + clean(best.product.helpText || best.product.name) } : null,
        suppression: best ? null : 'No relevant, consent-compatible product found.',
      });
    });
    return {
      schema: 'infinity/cosmo-media-plan/v1', contentTokenId: input.watchReceipt.contentTokenId,
      watchReceipt: input.watchReceipt, moments,
      summary: { cuesAnalyzed: cues.length, recommendations: moments.filter(item => item.recommendation).length, suppressed: moments.filter(item => !item.recommendation).length },
      controls: { whyThis: true, dismiss: true, blockBrand: true, reduceFrequency: true, noPurchaseRequired: true },
    };
  }

  return { verifyWatchReceipt, rankProduct, createCosmoPlan };
});
