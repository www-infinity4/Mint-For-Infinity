(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityCatalogBank = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMPANY_OPENING_UNITS = 1_000;
  const PERSON_OPENING_UNITS = 100;
  const COMPANY_PATTERN = /COMPANY|STUDIO|NETWORK|DISTRIBUTOR|PUBLISHER|PRODUCTION|BRAND|TEAM|LEAGUE|LINKED_SOURCE|RIGHTS_HOLDER/;

  function sha256(value) {
    const input = JSON.stringify(value);
    if (typeof require === 'function') return require('node:crypto').createHash('sha256').update(input).digest('hex');
    return globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then(bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''));
  }

  function beneficiaryClass(role) {
    return COMPANY_PATTERN.test(String(role || '').toUpperCase()) ? 'COMPANY' : 'PERSON';
  }

  async function buildOpeningAccounts(manifest, options = {}) {
    if (!manifest || manifest.schema !== 'infinity/catalog-provenance-manifest/v1') throw new Error('A catalog provenance manifest is required.');
    const createdAt = options.createdAt || new Date().toISOString();
    const accounts = [];
    const postings = [];
    for (const claimant of manifest.claimantCandidates || []) {
      const classification = beneficiaryClass(claimant.role);
      const amountUnits = classification === 'COMPANY' ? COMPANY_OPENING_UNITS : PERSON_OPENING_UNITS;
      const account = {
        id: 'provisional:' + claimant.id,
        claimantId: claimant.id,
        displayName: claimant.name,
        proposedRole: claimant.role,
        beneficiaryClass: classification,
        claimStatus: 'UNCLAIMED',
        openingUnits: amountUnits,
        availableToClaimUnits: 0,
        protectedPendingUnits: amountUnits,
        endorsement: 'NOT_CLAIMED_OR_ENDORSED',
        provenance: claimant.provenance || [],
        releaseRequirements: ['identity', 'authority or credit evidence', 'conflict review', 'wallet binding'],
      };
      accounts.push(account);
      postings.push({ accountId: account.id, debitUnits: 0, creditUnits: amountUnits, memo: 'Catalog-discovery opening credit; protected pending claim' });
    }
    const totalUnits = postings.reduce((sum, item) => sum + item.creditUnits, 0);
    postings.unshift({ accountId: 'issuance:catalog-discovery-opening-credit', debitUnits: totalUnits, creditUnits: 0, memo: 'Explicit treasury source for opening credits' });
    const body = {
      schema: 'infinity/catalog-opening-accounts/v1', createdAt,
      sourceManifest: manifest.source, sourceScope: manifest.scope,
      evidenceClass: 'CATALOG_DISCOVERY_NOT_AI_WATCH_RECEIPT',
      rates: { companyUnits: COMPANY_OPENING_UNITS, personUnits: PERSON_OPENING_UNITS },
      summary: { accountsCreated: accounts.length, companyAccounts: accounts.filter(item => item.beneficiaryClass === 'COMPANY').length,
        personAccounts: accounts.filter(item => item.beneficiaryClass === 'PERSON').length, totalOpeningUnits: totalUnits },
      accounts, event: { type: 'CATALOG_DISCOVERY_OPENING_CREDITS', postings },
    };
    return { ...body, hash: await sha256(body) };
  }

  return { buildOpeningAccounts, beneficiaryClass, COMPANY_OPENING_UNITS, PERSON_OPENING_UNITS };
});
