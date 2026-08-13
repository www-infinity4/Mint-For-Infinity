(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfinityVerificationGateway = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VALID = new Set(['NOT_CONFIGURED', 'PENDING', 'VERIFIED', 'FAILED']);
  function state(value) { const result = String(value || 'NOT_CONFIGURED').toUpperCase(); if (!VALID.has(result)) throw new Error('Verification state is invalid.'); return result; }
  function evaluateVerification(input = {}) {
    const result = {
      passkey: state(input.passkey),
      stripeIdentity: state(input.stripeIdentity),
      plaidAccount: state(input.plaidAccount),
      githubProvenance: state(input.githubProvenance),
      contributorIdentity: state(input.contributorIdentity),
      contributionRights: state(input.contributionRights),
    };
    result.phoneUserVerification = result.passkey === 'VERIFIED';
    result.paymentReady = result.passkey === 'VERIFIED' && result.stripeIdentity === 'VERIFIED';
    result.bankReady = result.passkey === 'VERIFIED' && result.plaidAccount === 'VERIFIED';
    result.authenticContribution = result.contributorIdentity === 'VERIFIED' && result.contributionRights === 'VERIFIED' && result.githubProvenance === 'VERIFIED';
    result.publicFigureSignatureAllowed = result.authenticContribution;
    result.blockers = Object.entries(result).filter(([key, value]) => ['passkey', 'stripeIdentity', 'plaidAccount', 'githubProvenance', 'contributorIdentity', 'contributionRights'].includes(key) && value !== 'VERIFIED').map(([key, value]) => key + ':' + value);
    result.disclosure = 'Passkeys may ask the phone to verify its user, including with a device fingerprint, but Infinity never receives or stores fingerprint data. Stripe and Plaid require separately configured approved accounts and credentials; GitHub provenance cannot replace them.';
    return result;
  }
  function validateAttributedSignature(input) {
    const verification = evaluateVerification(input.verification || {});
    const namedPerson = String(input.namedPerson || '').trim();
    if (!namedPerson) throw new Error('Named contributor is required.');
    if (!verification.publicFigureSignatureAllowed) return { allowed: false, label: namedPerson + ' attribution blocked', state: 'UNVERIFIED_ATTRIBUTION', verification };
    return { allowed: true, label: namedPerson + ' — verified contribution', state: 'RIGHTS_VERIFIED', verification };
  }
  return { evaluateVerification, validateAttributedSignature };
});
