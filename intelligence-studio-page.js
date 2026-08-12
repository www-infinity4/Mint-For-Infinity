(() => {
  'use strict';
  const { InfinityAdvertisingNetwork, UNITS_PER_INFINITY, ONE_INFINITY_CENT } = globalThis.InfinityAdNetwork;
  const { InfinityWorkforce, WORKERS } = globalThis.InfinityAIWorkforce;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  let manifest = null;
  let network = null;
  let impressionNumber = 0;

  function format(units) { return (Number(units || 0) / UNITS_PER_INFINITY).toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' Infinity'; }

  async function loadManifest() {
    const response = await fetch('catalogs/starquest-provenance.json');
    if (!response.ok) throw new Error('Catalog manifest returned HTTP ' + response.status + '.');
    manifest = await response.json();
    $('#showCount').textContent = manifest.summary.showsScanned.toLocaleString();
    $('#tokenCount').textContent = manifest.summary.contentTokens.toLocaleString();
    $('#claimantCount').textContent = manifest.summary.claimantCandidates.toLocaleString();
    $('#catalogList').innerHTML = manifest.contentTokens.slice(0, 40).map(token => `<article class="row"><div class="row-head"><b>${esc(token.title)}</b><span class="tag">${esc(token.kind)}</span></div><p>${esc(token.sourceRepository)} · ${esc(token.sourcePath)} @ ${esc(token.sourceRef)}</p>${(token.tags || []).slice(0, 4).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</article>`).join('');
    $('#rightsList').innerHTML = manifest.claimantCandidates.slice(0, 40).map(item => `<article class="row"><div class="row-head"><b>${esc(item.name)}</b><span class="tag gold">UNCLAIMED</span></div><p>${esc(item.role)} · ${esc(item.provenance?.[0]?.fieldPath || 'source pending')}</p><span class="tag">${Number(item.provenance?.length || 0)} provenance record(s)</span><span class="tag">evidence required</span><span class="tag">no endorsement recorded</span></article>`).join('');
    $('#runStatus').textContent = 'Manifest loaded. Run the workforce to create system-wide proposals.';
  }

  async function runWorkers() {
    if (!manifest) return;
    const button = $('#runWorkers');
    button.disabled = true;
    $('#runStatus').textContent = 'Seven workers are reading 993 provenance-backed content tokens…';
    try {
      const run = await new InfinityWorkforce({ rateUnits: ONE_INFINITY_CENT }).run({ manifest, instruction: 'Build the full catalog, claimant, advertising, page and royalty system.' });
      $('#runStatus').textContent = `${run.state} · ${run.outputs.summary.contentTokenCount} tokens · ${run.outputs.rightsQueue.length} claim records · ${run.outputs.ledgerPlans.length} ledger plans · ${run.audit.blockers.join(', ') || 'no blockers'}`;
      $('#pagePlans').innerHTML = run.outputs.pagePlans.map(page => `<article class="row"><b>${esc(page.title)}</b><p>${esc(page.purpose)}</p>${page.components.map(item => `<span class="tag green">${esc(item)}</span>`).join('')}</article>`).join('');
    } catch (error) { $('#runStatus').textContent = 'Worker run failed: ' + error.message; }
    finally { button.disabled = false; }
  }

  async function seedNetwork() {
    network = new InfinityAdvertisingNetwork({ mode: 'SIMULATION' });
    await network.createOrganizationAccount({ id: 'company:context-demo', displayName: 'Example beverage company — provisional', claimStatus: 'UNCLAIMED', fundingSource: 'TREASURY_ISSUANCE', openingUnits: 100 * UNITS_PER_INFINITY, tags: ['beverage', 'culture'] });
    await network.registerContentToken({ id: 'content:cardone-art-demo', title: 'Cardone art card demonstration', kind: 'TRADING_CARD', tags: ['art', 'business'], evidenceState: 'DEMONSTRATION_ONLY', participants: [
      { id: 'company:production-demo', name: 'Production company — unclaimed', role: 'PRODUCTION_COMPANY', beneficiaryClass: 'COMPANY', shareBps: 0, claimStatus: 'UNCLAIMED' },
      { id: 'person:gary-cardone', name: 'Gary Cardone — unclaimed', role: 'FEATURED_SUBJECT', beneficiaryClass: 'PERSON', shareBps: 0, claimStatus: 'UNCLAIMED' },
      { id: 'creator:goudey-demo', name: 'Card creator — unclaimed', role: 'CREATOR', beneficiaryClass: 'PERSON', shareBps: 0, claimStatus: 'UNCLAIMED' },
    ] });
    await network.createCampaign({ id: 'campaign:context-demo', name: 'Art and business contextual demonstration', sponsorOrganizationId: 'company:context-demo', budgetUnits: 10 * UNITS_PER_INFINITY, targetTags: ['art', 'business'], costPerImpressionUnits: 2_000, royaltyPerImpressionUnits: ONE_INFINITY_CENT, frequencyCapPerDay: 20 });
    renderBalances();
  }

  function renderBalances() {
    $('#balanceRows').innerHTML = Object.entries(network.balances()).filter(([, units]) => units > 0).map(([account, units]) => `<tr><td>${esc(account)}</td><td>${esc(format(units))}</td></tr>`).join('');
  }

  async function simulateImpression() {
    impressionNumber += 1;
    const day = new Date().toISOString().slice(0, 10);
    try {
      const event = await network.recordImpression({ eventId: 'demo-impression:' + impressionNumber, campaignId: 'campaign:context-demo', contentTokenId: 'content:cardone-art-demo', visibleMs: 1_500, visiblePercent: 80,
        verification: { status: 'SIMULATED' }, placement: { viewerPseudonym: 'local-demo', day, contextTags: ['art'], consentScopes: [] } });
      $('#ledgerStatus').textContent = `Balanced event ${event.sequence} · 0.20 Infinity campaign charge · 0.10 production company · 0.01 each credited person · viewer charged 0`;
      renderBalances();
    } catch (error) { $('#ledgerStatus').textContent = 'Impression rejected: ' + error.message; }
  }

  $('#workers').innerHTML = WORKERS.map(worker => `<article class="worker"><b>${esc(worker.name)}</b><code>${worker.verbs.join(' · ')}</code><p>${esc(worker.boundary)}</p></article>`).join('');
  $('#runWorkers').addEventListener('click', runWorkers);
  $('#simulateImpression').addEventListener('click', simulateImpression);
  Promise.all([loadManifest(), seedNetwork()]).catch(error => { $('#runStatus').textContent = 'Studio initialization failed: ' + error.message; });
})();
