(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityHouseholdNeeds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AREAS = Object.freeze([
    { id: 'roof', label: 'Roof and gutters', trades: ['roofer', 'gutter service'] },
    { id: 'plumbing', label: 'Plumbing and drains', trades: ['plumber'] },
    { id: 'sink-cabinet', label: 'Sink and cabinet', trades: ['cabinet installer', 'plumber'] },
    { id: 'electrical', label: 'Electrical', trades: ['licensed electrician'] },
    { id: 'heating-cooling', label: 'Heating and cooling', trades: ['HVAC service'] },
    { id: 'water-moisture', label: 'Leaks, mold signs and moisture', trades: ['plumber', 'water-damage service'] },
    { id: 'windows-doors', label: 'Windows and doors', trades: ['carpenter', 'window service'] },
    { id: 'appliances', label: 'Appliances', trades: ['appliance repair'] },
    { id: 'structure', label: 'Foundation, floors and walls', trades: ['qualified building inspector'] },
    { id: 'safety', label: 'Smoke, carbon monoxide and exits', trades: ['safety equipment supplier', 'qualified inspector'] },
  ]);

  const CONDITIONS = new Set(['UNKNOWN', 'GOOD', 'WATCH', 'REPAIR', 'URGENT']);
  const OCCUPANCY = new Set(['OWNER', 'RENTER', 'OTHER']);

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function invariant(condition, message) { if (!condition) throw new Error(message); }

  function normalizeArea(input, definition) {
    const condition = clean(input && input.condition || 'UNKNOWN').toUpperCase();
    invariant(CONDITIONS.has(condition), definition.label + ' condition is invalid.');
    return {
      id: definition.id,
      label: definition.label,
      condition,
      notes: clean(input && input.notes),
      lastRepair: clean(input && input.lastRepair),
      photos: Array.isArray(input && input.photos) ? input.photos.map(item => ({ id: clean(item.id), digest: clean(item.digest), capturedAt: clean(item.capturedAt) })).filter(item => item.id && item.digest) : [],
      trades: definition.trades,
      residentConfirmed: Boolean(input && input.residentConfirmed),
    };
  }

  function buildHouseSweep(input = {}) {
    const occupancy = clean(input.occupancy || 'OTHER').toUpperCase();
    invariant(OCCUPANCY.has(occupancy), 'Occupancy is invalid.');
    const answers = input.areas && typeof input.areas === 'object' ? input.areas : {};
    const areas = AREAS.map(definition => normalizeArea(answers[definition.id], definition));
    const needs = areas.filter(area => area.condition === 'WATCH' || area.condition === 'REPAIR' || area.condition === 'URGENT').map(area => ({
      id: 'need:' + area.id,
      areaId: area.id,
      title: area.label,
      urgency: area.condition,
      evidenceState: area.residentConfirmed ? 'RESIDENT_CONFIRMED' : 'SELF_REPORTED_UNCONFIRMED',
      notes: area.notes,
      recommendedTradeTypes: area.trades,
      responsibilityLane: occupancy === 'RENTER' ? 'LANDLORD_REVIEW_FIRST' : occupancy === 'OWNER' ? 'OWNER_DECISION' : 'RESPONSIBILITY_REVIEW',
      state: 'OPEN',
    }));
    const priorRepairs = areas.filter(area => area.lastRepair).map(area => ({ areaId: area.id, description: area.lastRepair }));
    return {
      schema: 'infinity/household-needs-ledger/v1',
      householdId: clean(input.householdId || 'local-private-household'),
      createdAt: input.createdAt || new Date().toISOString(),
      occupancy,
      landlord: occupancy === 'RENTER' ? {
        displayName: clean(input.landlord && input.landlord.displayName),
        contactPermission: Boolean(input.landlord && input.landlord.contactPermission),
        maintenanceHistory: clean(input.landlord && input.landlord.maintenanceHistory),
      } : null,
      areas,
      needs,
      priorRepairs,
      sharing: {
        localStorageOnly: input.localStorageOnly !== false,
        locationShared: Boolean(input.locationShared),
        advertiserPersonalization: Boolean(input.advertiserPersonalization),
        serviceProviderContact: Boolean(input.serviceProviderContact),
      },
      truthBoundary: 'AI records reported conditions and images; it does not certify unseen conditions or replace a qualified inspection.',
    };
  }

  function buildServiceOpportunities(sweep) {
    invariant(sweep && sweep.schema === 'infinity/household-needs-ledger/v1', 'A household needs ledger is required.');
    return sweep.needs.flatMap(need => need.recommendedTradeTypes.map(trade => ({
      id: 'opportunity:' + need.areaId + ':' + trade.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      needId: need.id,
      tradeType: trade,
      urgency: need.urgency,
      advertiserAccountTemplate: {
        displayName: 'Local ' + trade + ' — provisional',
        claimStatus: 'UNCLAIMED',
        fundingSource: 'TREASURY_ISSUANCE',
        stewardship: 'SYSTEM_PROVISIONAL',
        endorsement: 'NOT_CLAIMED_OR_ENDORSED',
      },
      placement: {
        mode: sweep.sharing.advertiserPersonalization ? 'CONSENTED_PERSONALIZATION' : 'PRIVATE_NEEDS_MATCH',
        revealLocation: sweep.sharing.locationShared,
        contactAllowed: sweep.sharing.serviceProviderContact,
        explanation: 'Matched because the resident marked ' + need.title + ' as ' + need.urgency + '.',
      },
      state: 'PROPOSAL_ONLY',
    })));
  }

  return { AREAS, buildHouseSweep, buildServiceOpportunities };
});
