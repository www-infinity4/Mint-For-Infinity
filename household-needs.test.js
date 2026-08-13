'use strict';

const assert = require('node:assert/strict');
const { buildHouseSweep, buildServiceOpportunities } = require('./household-needs');
const { SpendingController, UNITS_PER_INFINITY } = require('./economy-controls');

const sweep = buildHouseSweep({ occupancy: 'RENTER', localStorageOnly: true, areas: {
  roof: { condition: 'WATCH', notes: 'Resident reports an old stain.', residentConfirmed: true },
  'sink-cabinet': { condition: 'REPAIR', notes: 'Cabinet needs replacement.', residentConfirmed: true },
}, landlord: { displayName: 'Property manager', maintenanceHistory: 'No repair record supplied.', contactPermission: false }, createdAt: '2026-08-12T00:00:00.000Z' });
assert.equal(sweep.needs.length, 2);
assert.ok(sweep.needs.every(need => need.responsibilityLane === 'LANDLORD_REVIEW_FIRST'));
assert.equal(sweep.sharing.locationShared, false);
const opportunities = buildServiceOpportunities(sweep);
assert.ok(opportunities.some(item => item.tradeType === 'plumber'));
assert.ok(opportunities.every(item => item.placement.contactAllowed === false));
assert.ok(opportunities.every(item => item.advertiserAccountTemplate.claimStatus === 'UNCLAIMED'));

const controls = new SpendingController();
assert.equal(controls.authorize({ eventId: 'spend:1', accountId: 'wallet:1', lane: 'ORDINARY_SPEND', periodKey: '2026-08-12', amountUnits: 300 * UNITS_PER_INFINITY }).allowed, true);
assert.equal(controls.authorize({ eventId: 'spend:2', accountId: 'wallet:1', lane: 'ORDINARY_SPEND', periodKey: '2026-08-12', amountUnits: 1 }).allowed, false);
assert.equal(controls.authorizeSilverDimeRoll({ eventId: 'roll:1', accountId: 'wallet:1', weekKey: '2026-W33', amountUnits: 300 * UNITS_PER_INFINITY }).allowed, true);
assert.equal(controls.authorizeSilverDimeRoll({ eventId: 'roll:2', accountId: 'wallet:1', weekKey: '2026-W33', amountUnits: 300 * UNITS_PER_INFINITY }).allowed, false);
console.log('Infinity household needs and spending controls: PASS');
