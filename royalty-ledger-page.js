(() => {
  'use strict';
  const { RoyaltyLedger, UNITS_PER_INFINITY, PROGRAM_LIMITS, formatUnits, sha256 } = globalThis.InfinityRoyaltyLedger;
  const STORAGE_KEY = 'infinity-royalty-ledger-simulation-v1';
  const $ = selector => document.querySelector(selector);
  let ledger;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger.toJSON()));
  }

  async function initialize() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    ledger = new RoyaltyLedger(saved || { mode: 'SIMULATION' });
    if (!Object.keys(ledger.assets).length) {
      await ledger.registerAsset({
        id: 'catalog:example-film', title: 'Example catalog film', perceivedValueUnits: UNITS_PER_INFINITY,
        sourceUrl: '', evidenceState: 'USER_DEFINED',
        rightsOwners: [{ id: 'rights:unknown', name: 'Rights owner — unclaimed', role: 'RIGHTS_OWNER', shareBps: 10_000, claimStatus: 'UNCLAIMED' }],
        talent: [{ id: 'talent:unknown', name: 'Featured talent — unclaimed', role: 'TALENT', shareBps: 10_000, claimStatus: 'UNCLAIMED' }],
      });
      await ledger.recordProgramProposal({
        id: 'program:tree-planting', name: 'Verified tree-planting grant', beneficiary: 'Verified planter',
        amountUnits: PROGRAM_LIMITS.verifiedTreePlantingGrantUnits,
        requirements: ['identity', 'species', 'location', 'time-stamped planting evidence', 'review'],
      });
      await ledger.recordProgramProposal({
        id: 'program:grant-cardone', name: 'Grant Cardone proposed allocation', beneficiary: 'Grant Cardone — claimant unverified',
        amountUnits: 5_000 * UNITS_PER_INFINITY,
        requirements: ['identity', 'permission', 'wallet binding', 'program terms', 'authorization'],
      });
      save();
    }
    await render();
  }

  function sumBalances(pattern) {
    return Object.entries(ledger.balances()).reduce((sum, [account, units]) => pattern.test(account) && units > 0 ? sum + units : sum, 0);
  }

  async function render() {
    const balances = ledger.balances();
    $('#viewCount').textContent = ledger.events.filter(event => event.type === 'VIEW_ALLOCATION_SIMULATION').length;
    $('#rightsTotal').textContent = formatUnits(sumBalances(/:(rights_owner)(:|$)/));
    $('#talentTotal').textContent = formatUnits(sumBalances(/:talent(:|$)/));
    $('#viewerTotal').textContent = formatUnits(sumBalances(/:viewer-reward$/));

    $('#assetList').innerHTML = Object.values(ledger.assets).map(asset => {
      const rights = asset.rightsOwners.length ? asset.rightsOwners : [{ name: 'Unknown rights owner', claimStatus: 'UNCLAIMED' }];
      const talent = asset.talent.length ? asset.talent : [{ name: 'Unknown talent', claimStatus: 'UNCLAIMED' }];
      return `<article class="asset">
        <div class="asset-top"><div><h3>${escapeHtml(asset.title)}</h3><p>${asset.sourceUrl ? `<a href="${escapeHtml(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(asset.sourceUrl)}</a>` : 'No external source URL captured'}</p></div><button data-view="${escapeHtml(asset.id)}">Create test view</button></div>
        <div class="tags"><span class="tag">${formatUnits(asset.perceivedValueUnits)} reference</span>${rights.map(item => `<span class="tag ${item.claimStatus.toLowerCase()}">Rights: ${escapeHtml(item.name)} · ${item.claimStatus}</span>`).join('')}${talent.map(item => `<span class="tag ${item.claimStatus.toLowerCase()}">Talent: ${escapeHtml(item.name)} · ${item.claimStatus}</span>`).join('')}</div>
      </article>`;
    }).join('');
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => simulateView(button.dataset.view, button)));

    const unclaimed = [];
    Object.values(ledger.assets).forEach(asset => {
      [...asset.rightsOwners, ...asset.talent].forEach(person => {
        if (person.claimStatus !== 'VERIFIED') unclaimed.push({ asset, person });
      });
    });
    $('#claimQueue').innerHTML = unclaimed.length ? unclaimed.map(({ asset, person }) => `<div class="asset"><h3>${escapeHtml(person.name)}</h3><p>${escapeHtml(asset.title)} · ${person.role.replace('_', ' ')} · ${person.claimStatus}</p><span class="badge">RESERVED; NOT RELEASED</span></div>`).join('') : '<p class="sub">No unresolved claims.</p>';

    $('#proposalList').innerHTML = ledger.proposals.map(item => `<div class="asset"><div class="asset-top"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.beneficiary)}</p></div><b>${formatUnits(item.amountUnits)}</b></div><div class="tags"><span class="tag unclaimed">${item.status}</span><span class="tag">creates balance: ${item.createsSpendableBalance}</span></div><p>${item.requirements.map(escapeHtml).join(' · ')}</p></div>`).join('');

    $('#eventRows').innerHTML = ledger.events.slice().reverse().slice(0, 30).map(event => `<tr><td>${event.sequence}</td><td>${escapeHtml(event.type)}<br><span class="${event.mode === 'SIMULATION' ? 'warn' : 'ok'}">${event.mode}</span></td><td><code>${event.hash}</code></td></tr>`).join('');
    const valid = await ledger.verifyChain();
    $('#chainStatus').className = 'status ' + (valid ? 'ok' : 'warn');
    $('#chainStatus').textContent = valid ? `Chain verified · ${ledger.events.length} events · latest ${ledger.events.at(-1)?.hash.slice(0, 16) || 'none'}…` : 'Chain verification failed · local event data was altered.';
  }

  async function simulateView(assetId, button) {
    button.disabled = true;
    try {
      const eventId = 'simulated-view:' + crypto.randomUUID();
      const evidenceHash = await sha256({ eventId, assetId, simulated: true, timestamp: new Date().toISOString() });
      await ledger.recordView({
        eventId, assetId, viewerWalletId: 'local-demo-viewer', watchedSeconds: 95, durationSeconds: 100,
        verification: { status: 'SIMULATED', evidenceHash, verifierId: 'browser-protocol-demo' },
      });
      save();
      await render();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  $('#assetForm').addEventListener('submit', async event => {
    event.preventDefault();
    const title = $('#assetTitle').value.trim();
    const sourceUrl = $('#assetSource').value.trim();
    const ownerName = $('#ownerName').value.trim();
    const talentName = $('#talentName').value.trim();
    const perceivedValueUnits = Math.round(Number($('#assetValue').value) * UNITS_PER_INFINITY);
    try {
      const id = 'catalog:' + (await sha256({ title, sourceUrl, created: Date.now() })).slice(0, 20);
      await ledger.registerAsset({
        id, title, sourceUrl, perceivedValueUnits, evidenceState: 'USER_DEFINED',
        rightsOwners: [{ id: id + ':rights', name: ownerName, role: 'RIGHTS_OWNER', shareBps: 10_000, claimStatus: 'UNCLAIMED' }],
        talent: [{ id: id + ':talent', name: talentName, role: 'TALENT', shareBps: 10_000, claimStatus: 'UNCLAIMED' }],
      });
      save();
      event.target.reset();
      $('#assetValue').value = '1.00';
      $('#ownerName').value = 'Rights owner — unclaimed';
      $('#talentName').value = 'Featured talent — unclaimed';
      await render();
    } catch (error) {
      alert(error.message);
    }
  });

  initialize().catch(error => {
    $('#chainStatus').className = 'status warn';
    $('#chainStatus').textContent = 'Ledger failed to initialize: ' + error.message;
  });
})();
