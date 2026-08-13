(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityCatalogProvenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function slug(value) {
    return clean(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'unknown';
  }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function provenance(sourceRepository, sourcePath, sourceRef, fieldPath, observedValue) {
    return { sourceRepository, sourcePath, sourceRef, fieldPath, observedValue, evidenceClass: 'OBSERVED_REPOSITORY_METADATA' };
  }

  function candidate(input) {
    return {
      id: 'claimant:' + slug(input.role) + ':' + slug(input.name),
      name: clean(input.name) || 'Unknown claimant',
      role: clean(input.role || 'LINKED_ENTITY').toUpperCase(),
      claimStatus: 'UNCLAIMED',
      walletId: null,
      verificationRecordId: null,
      endorsement: 'NOT_CLAIMED_OR_ENDORSED',
      provenance: input.provenance ? [input.provenance] : [],
    };
  }

  function linkedSourceCandidates(item, base) {
    const results = [];
    const archiveId = clean(item.archiveId);
    if (archiveId) results.push(candidate({ name: 'Internet Archive source record', role: 'LINKED_SOURCE', provenance: provenance(base.sourceRepository, base.sourcePath, base.sourceRef, base.fieldPath + '.archiveId', archiveId) }));
    (Array.isArray(item.linkedEntities) ? item.linkedEntities : []).forEach((entity, index) => {
      if (!clean(entity && entity.name)) return;
      results.push(candidate({ name: entity.name, role: entity.role || 'LINKED_ENTITY', provenance: provenance(base.sourceRepository, base.sourcePath, base.sourceRef, base.fieldPath + '.linkedEntities[' + index + ']', entity.name) }));
    });
    return results;
  }

  function scanStarQuestCatalog(shows, options = {}) {
    if (!Array.isArray(shows)) throw new Error('StarQuest shows must be an array.');
    const sourceRepository = clean(options.sourceRepository || 'www-infinity4/TV-Database');
    const sourcePath = clean(options.sourcePath || 'js/data.js');
    const sourceRef = clean(options.sourceRef || 'main');
    const tokens = [];
    const claimants = new Map();
    const addCandidate = item => {
      if (!claimants.has(item.id)) claimants.set(item.id, item);
      else {
        const existing = claimants.get(item.id);
        item.provenance.forEach(record => {
          const key = [record.sourceRepository, record.sourcePath, record.sourceRef, record.fieldPath, record.observedValue].join('|');
          if (!existing.provenance.some(prior => [prior.sourceRepository, prior.sourcePath, prior.sourceRef, prior.fieldPath, prior.observedValue].join('|') === key)) existing.provenance.push(record);
        });
      }
    };

    shows.forEach((show, showIndex) => {
      if (!show || !clean(show.id) || !clean(show.title)) return;
      const showPath = 'SHOWS[' + showIndex + ']';
      const showProvenance = provenance(sourceRepository, sourcePath, sourceRef, showPath + '.title', show.title);
      const showCandidates = [candidate({ name: 'Rights holders for ' + show.title, role: 'RIGHTS_HOLDER', provenance: showProvenance })]
        .concat(linkedSourceCandidates(show, { sourceRepository, sourcePath, sourceRef, fieldPath: showPath }));
      showCandidates.forEach(addCandidate);
      tokens.push({
        id: 'starquest:show:' + clean(show.id), title: clean(show.title), kind: show.type === 'movie' ? 'MOVIE' : 'SERIES',
        sourceRepository, sourcePath, sourceRef, sourceRecordId: clean(show.id),
        links: unique([show.url, show.archiveUrl, show.archiveId && 'https://archive.org/details/' + show.archiveId].map(clean)),
        tags: unique([].concat(show.genre || [], show.years || [], show.rating || []).map(value => clean(value).toLowerCase())),
        claimantCandidateIds: showCandidates.map(item => item.id), provenance: [showProvenance],
      });

      (Array.isArray(show.episodes) ? show.episodes : []).forEach((episode, episodeIndex) => {
        if (!episode || !clean(episode.id) || !clean(episode.title)) return;
        const episodePath = showPath + '.episodes[' + episodeIndex + ']';
        const episodeProvenance = provenance(sourceRepository, sourcePath, sourceRef, episodePath + '.title', episode.title);
        const episodeCandidates = [candidate({ name: 'Rights holders for ' + show.title, role: 'RIGHTS_HOLDER', provenance: episodeProvenance })]
          .concat(linkedSourceCandidates(episode, { sourceRepository, sourcePath, sourceRef, fieldPath: episodePath }));
        episodeCandidates.forEach(addCandidate);
        tokens.push({
          id: 'starquest:episode:' + clean(episode.id), title: clean(show.title) + ' — ' + clean(episode.title), kind: show.type === 'movie' ? 'MOVIE_PRESENTATION' : 'EPISODE',
          parentTokenId: 'starquest:show:' + clean(show.id), sourceRepository, sourcePath, sourceRef,
          sourceRecordId: clean(episode.id), archiveId: clean(episode.archiveId), archiveFile: clean(episode.archiveFile),
          links: unique([episode.url, episode.embedUrl, episode.archiveId && 'https://archive.org/details/' + episode.archiveId].map(clean)),
          tags: unique([].concat(show.genre || [], show.title, episode.year || '', episode.season == null ? '' : 'season-' + episode.season).map(value => clean(value).toLowerCase())),
          claimantCandidateIds: episodeCandidates.map(item => item.id), provenance: [episodeProvenance],
        });
      });
    });

    return {
      schema: 'infinity/catalog-provenance-manifest/v1', generatedAt: options.generatedAt || new Date().toISOString(),
      scope: 'STARQUEST_FULL_CATALOG', source: { repository: sourceRepository, path: sourcePath, ref: sourceRef },
      summary: { showsScanned: shows.length, contentTokens: tokens.length, claimantCandidates: claimants.size,
        movieOrSeriesTokens: tokens.filter(token => token.kind === 'MOVIE' || token.kind === 'SERIES').length,
        episodeOrPresentationTokens: tokens.filter(token => token.kind === 'EPISODE' || token.kind === 'MOVIE_PRESENTATION').length },
      contentTokens: tokens, claimantCandidates: Array.from(claimants.values()),
    };
  }

  function scanCardCatalog(cards, options = {}) {
    if (!Array.isArray(cards)) throw new Error('Cards must be an array.');
    const sourceRepository = clean(options.sourceRepository || 'www-infinity4/Goudey-Tradition-Trading-Card-Company-LLC');
    const sourcePath = clean(options.sourcePath || 'catalog.json');
    const sourceRef = clean(options.sourceRef || 'main');
    const fields = ['subject', 'player', 'artist', 'photographer', 'team', 'league', 'brand', 'publisher', 'company', 'studio', 'rightsHolder'];
    const tokens = [];
    const claimants = new Map();
    cards.forEach((card, index) => {
      const title = clean(card && (card.title || card.name || card.player || card.subject));
      if (!title) return;
      const path = 'cards[' + index + ']';
      const ids = [];
      fields.forEach(field => {
        const values = Array.isArray(card[field]) ? card[field] : [card[field]];
        values.map(clean).filter(Boolean).forEach(name => {
          const role = field === 'player'
            ? (clean(card.sport).toLowerCase() === 'other' ? 'CARD_SUBJECT' : clean(card.sport).toLowerCase() === 'entertainment' ? 'FEATURED_SUBJECT' : 'PLAYER')
            : field.replace(/([A-Z])/g, '_$1').toUpperCase();
          const item = candidate({ name, role, provenance: provenance(sourceRepository, sourcePath, sourceRef, path + '.' + field, name) });
          if (!claimants.has(item.id)) claimants.set(item.id, item);
          else claimants.get(item.id).provenance.push(...item.provenance);
          ids.push(item.id);
        });
      });
      if (clean(options.defaultPublisher)) {
        const publisher = candidate({ name: options.defaultPublisher, role: 'PUBLISHER', provenance: provenance(sourceRepository, sourcePath, sourceRef, path, 'Repository catalog publisher') });
        if (!claimants.has(publisher.id)) claimants.set(publisher.id, publisher);
        else claimants.get(publisher.id).provenance.push(...publisher.provenance);
        ids.push(publisher.id);
      }
      tokens.push({ id: 'goudey:card:' + slug(card.id || title + '-' + index), title, kind: 'TRADING_CARD', sourceRepository, sourcePath, sourceRef,
        sourceRecordId: clean(card.id || index), links: unique([].concat(card.links || [], card.url || []).map(clean)),
        tags: unique([].concat(card.tags || [], card.set || [], card.year || []).map(value => clean(value).toLowerCase())),
        claimantCandidateIds: unique(ids), provenance: [provenance(sourceRepository, sourcePath, sourceRef, path + '.title', title)] });
    });
    return { schema: 'infinity/catalog-provenance-manifest/v1', generatedAt: options.generatedAt || new Date().toISOString(),
      scope: 'GOUDEY_CARD_CATALOG', source: { repository: sourceRepository, path: sourcePath, ref: sourceRef },
      summary: { cardsScanned: cards.length, contentTokens: tokens.length, claimantCandidates: claimants.size },
      contentTokens: tokens, claimantCandidates: Array.from(claimants.values()) };
  }

  return { scanStarQuestCatalog, scanCardCatalog, slug };
});
