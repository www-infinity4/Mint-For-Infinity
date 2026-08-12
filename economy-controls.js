(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityEconomyControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNITS_PER_INFINITY = 10_000;
  const DEFAULT_LIMITS = Object.freeze({
    dailyOrdinarySpendUnits: 300 * UNITS_PER_INFINITY,
    weeklyExternalAssetWithdrawalUnits: 300 * UNITS_PER_INFINITY,
    weeklySilverDimeRolls: 1,
    royaltyCollectionUnits: null,
    verifiedBusinessPurchaseUnits: null,
  });

  function integer(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error(label + ' must be a non-negative safe integer.');
    return number;
  }

  class SpendingController {
    constructor(options = {}) {
      this.limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
      this.events = Array.isArray(options.events) ? options.events.map(item => ({ ...item })) : [];
    }

    usage(accountId, lane, periodKey) {
      return this.events.filter(event => event.accountId === accountId && event.lane === lane && event.periodKey === periodKey && event.state !== 'REVERSED')
        .reduce((sum, event) => sum + event.amountUnits, 0);
    }

    authorize(input) {
      const lane = String(input.lane || '').toUpperCase();
      const accountId = String(input.accountId || '').trim();
      const periodKey = String(input.periodKey || '').trim();
      const amountUnits = integer(input.amountUnits, 'amountUnits');
      if (!accountId || !periodKey) throw new Error('Account and period key are required.');
      const limitKey = lane === 'ORDINARY_SPEND' ? 'dailyOrdinarySpendUnits' : lane === 'EXTERNAL_ASSET_WITHDRAWAL' ? 'weeklyExternalAssetWithdrawalUnits' : null;
      if (!limitKey) return { allowed: false, reason: 'LANE_REQUIRES_SEPARATE_POLICY' };
      const used = this.usage(accountId, lane, periodKey);
      const limit = this.limits[limitKey];
      const allowed = used + amountUnits <= limit;
      if (allowed) this.events.push({ id: String(input.eventId || 'control:' + (this.events.length + 1)), accountId, lane, periodKey, amountUnits, assetType: String(input.assetType || 'INFINITY'), state: 'AUTHORIZED' });
      return { allowed, lane, limitUnits: limit, usedUnits: used, requestedUnits: amountUnits, remainingUnits: Math.max(0, limit - used - (allowed ? amountUnits : 0)), reason: allowed ? 'WITHIN_LANE_LIMIT' : 'LANE_LIMIT_EXCEEDED' };
    }

    authorizeSilverDimeRoll(input) {
      const accountId = String(input.accountId || '').trim();
      const periodKey = String(input.weekKey || '').trim();
      const priorRolls = this.events.filter(event => event.accountId === accountId && event.lane === 'SILVER_DIME_ROLL' && event.periodKey === periodKey && event.state !== 'REVERSED').length;
      if (priorRolls >= this.limits.weeklySilverDimeRolls) return { allowed: false, reason: 'WEEKLY_ROLL_LIMIT_REACHED', remainingRolls: 0 };
      const result = this.authorize({ ...input, lane: 'EXTERNAL_ASSET_WITHDRAWAL', periodKey, assetType: 'SILVER_DIME_ROLL' });
      if (!result.allowed) return { ...result, remainingRolls: 0 };
      this.events.push({ id: String(input.eventId || 'silver-roll:' + (this.events.length + 1)), accountId, lane: 'SILVER_DIME_ROLL', periodKey, amountUnits: 0, assetType: 'SILVER_DIME_ROLL', state: 'AUTHORIZED' });
      return { ...result, remainingRolls: this.limits.weeklySilverDimeRolls - priorRolls - 1 };
    }
  }

  return { SpendingController, DEFAULT_LIMITS, UNITS_PER_INFINITY };
});
