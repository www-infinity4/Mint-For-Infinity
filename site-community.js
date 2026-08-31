/* Shared, device-local Infinity wallet and site-sharing rewards. */
'use strict';
(() => {
  const script = document.currentScript;
  const site = script.dataset.siteId;
  const title = script.dataset.siteTitle;
  const url = script.dataset.shareUrl;
  if (!site || !title || !url || document.getElementById('infinity-community')) return;
  const walletUrl = 'https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.html';
  const pendingKey = 'infinity_site_share_pending_v1:' + site;
  const bar = document.createElement('aside');
  bar.id = 'infinity-community'; bar.setAttribute('aria-label','Sharing and unified wallet');
  bar.innerHTML = `<div class="ic-row"><a class="ic-wallet" href="${walletUrl}">Unified wallet · <strong data-balance>0.00</strong> StarCoin</a><button type="button" data-share>Share · +0.1 StarCoin</button><a data-x target="_blank" rel="noopener noreferrer">Post to X ↗</a><button type="button" data-connect>Connect wallet</button></div><p data-status role="status"></p><div data-recovery hidden><p data-help></p><button type="button" data-retry>Retry saving reward</button> <a data-open target="_blank" rel="noopener noreferrer">Open site in browser ↗</a><p>Do not clear site data: that can erase your existing wallet. If saving is blocked, keep this page open until your claim is saved.</p><details><summary>Error details</summary><code data-error></code></details></div><div data-confirm-box hidden><p>After you have posted or sent the link, confirm your share. Opening a draft or copying a link alone earns nothing.</p><input data-link aria-label="Site sharing link" readonly><button type="button" data-confirm>I shared the link · claim 0.1</button><button type="button" data-cancel>Cancel</button></div><details><summary>How rewards work</summary><p>One 0.1 StarCoin reward per site per wallet. Repeat shares do not pay again. Shares are confirmed by your browser or by you; they are not independently verified. Uses the same device-local unified wallet linked from StarQuest. These credits are not yet synced to StarQuest’s cloud ledger or other browsers. Keep your site data to preserve your wallet.</p></details>`;
  const style=document.createElement('style');style.textContent=`#infinity-community{font:14px/1.5 Arial,sans-serif;background:#10151b;color:#f3f0e7;border-bottom:1px solid #48505c;padding:12px max(18px,4vw);position:relative;z-index:30}#infinity-community .ic-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#infinity-community a,#infinity-community button{font:inherit;color:inherit;text-decoration:none;border:1px solid #65717e;border-radius:7px;padding:9px 13px;min-height:44px;display:inline-flex;align-items:center;background:#202b35;cursor:pointer}#infinity-community .ic-wallet{margin-right:auto;background:none;border-color:transparent;gap:5px}#infinity-community strong{color:#ffe19c}#infinity-community button:disabled{opacity:.6;cursor:wait}#infinity-community p{margin:8px 0;max-width:980px;font-size:13px}#infinity-community p:empty{display:none}#infinity-community summary{cursor:pointer;color:#b9c2cb;font-size:12px;margin-top:8px}#infinity-community input{display:block;width:min(100%,650px);box-sizing:border-box;padding:10px;margin:8px 0;background:#fff;color:#111;border:1px solid #777}#infinity-community [hidden]{display:none!important}#infinity-community :focus-visible{outline:3px solid #ffe19c;outline-offset:3px}@media(max-width:600px){#infinity-community .ic-wallet{width:100%;padding-left:0}#infinity-community .ic-row{gap:7px}#infinity-community a,#infinity-community button{font-size:13px}}`;
  document.head.append(style);document.body.prepend(bar);
  const $=s=>bar.querySelector(s);const status=t=>$('[data-status]').textContent=t;
  let volatileClaim=null,lastWalletId=null;
  $('[data-open]').href=url;
  function failure(error){
    $('[data-recovery]').hidden=false;
    $('[data-error]').textContent=(error.name||'Error')+': '+error.message;
    const denied=error.name==='SecurityError'||/denied|disallowed|access.*storage/i.test(error.message);
    const full=error.name==='QuotaExceededError'||/quota/i.test(error.message);
    $('[data-help]').textContent=denied?'This browser is blocking wallet storage or coordination. Open this site directly in Safari, Chrome, or Firefox with site storage allowed, then retry.':full?'Browser storage is full. No new StarCoin credit has been confirmed. Preserve your existing wallet data; retry after storage is available.':'The reward could not be saved. Retry below. Error details are available if the problem continues.';
    status(volatileClaim?'Share confirmed, but credit is not saved yet. Keep this page open and retry.':'Wallet storage is unavailable. No new credit was confirmed.');
  }
  $('[data-link]').value=url;
  $('[data-link]').addEventListener('focus',e=>e.target.select());
  $('[data-x]').href='https://twitter.com/intent/tweet?'+new URLSearchParams({text:title,url}).toString();
  const wallet=()=>{
    if(!window.InfinityUnifiedWallet?.UnifiedInfinityWallet)throw Error('Wallet did not load. Keep this page open and retry.');
    // Do not let the older engine treat unreadable/corrupt data as a new empty wallet.
    const raw=localStorage.getItem('infinity_unified_wallet_v1');
    if(raw!==null){let state;try{state=JSON.parse(raw);}catch(_){throw Error('Existing wallet data could not be read. It has been left unchanged.');}
      if(state?.schema!=='infinity/unified-wallet/v1'||!state.wallets||!Array.isArray(state.events))throw Error('Existing wallet data has an unsupported format. It has been left unchanged.');}
    return new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
  };
  const eventId=id=>'game-reward:'+ [id,site,'GAME_SHARED','site'].map(encodeURIComponent).join(':');
  function render(){try{const w=wallet(),id=w.state.currentWalletId;lastWalletId=id;
    $('[data-balance]').textContent=id?w.balance(id,'STAR_COIN').toFixed(2):'0.00';
    $('[data-connect]').textContent=id?'Sync wallet':'Connect wallet';
    if(id&&w.processedEventIds.has(eventId(id)))$('[data-share]').textContent='Share · reward already claimed';
    else $('[data-share]').textContent='Share · +0.1 StarCoin';
  }catch(e){$('[data-balance]').textContent='unavailable';failure(e);}}
  let queue=Promise.resolve();
  function exclusive(fn){const run=()=>navigator.locks?navigator.locks.request('infinity-site-share:'+site,fn):fn();const p=queue.then(run,run);queue=p.catch(()=>{});return p;}
  async function flush(){const raw=localStorage.getItem(pendingKey);if(!raw&&!volatileClaim){wallet();$('[data-recovery]').hidden=true;render();return;}const record=raw?JSON.parse(raw):volatileClaim;let w=wallet(),id=w.state.currentWalletId;
    if(!record||typeof record!=='object'||typeof record.method!=='string')throw Error('Saved share claim is unreadable. It has been left unchanged.');
    if(record.walletId&&record.walletId!==id){status('A pending reward belongs to another wallet. Open that wallet to collect it.');return;}
    if(!id)id=w.createWallet({displayName:'Unified Infinity Wallet'}).walletId;
    record.walletId=id;localStorage.setItem(pendingKey,JSON.stringify(record));
    if(!w.creditStarCoinReward)throw Error('Reload to load wallet reward support. Your share is saved.');
    const result=await w.creditStarCoinReward({walletId:id,gameId:site,rewardKind:'GAME_SHARED',rewardId:'site',proof:{method:record.method,url,verification:'DEVICE_LOCAL'}});
    localStorage.removeItem(pendingKey);volatileClaim=null;$('[data-recovery]').hidden=true;render();status(result.credited?'Added 0.1 StarCoin to your unified wallet.':'This site’s share reward is already in your wallet. No duplicate credit added.');}
  function claim(method){
    if(!volatileClaim)volatileClaim={walletId:lastWalletId,method,createdAt:new Date().toISOString()};
    return exclusive(async()=>{
      const w=wallet(),id=w.state.currentWalletId;
      const prior=localStorage.getItem(pendingKey);
      if(prior&&JSON.parse(prior).walletId&&JSON.parse(prior).walletId!==id)throw Error('A pending reward belongs to another wallet. Switch to it before claiming.');
      if(volatileClaim.walletId&&volatileClaim.walletId!==id)throw Error('This confirmed share belongs to another wallet. Switch back before retrying.');
      if(!prior)localStorage.setItem(pendingKey,JSON.stringify(volatileClaim));await flush();
    }).catch(failure);
  }
  function confirmation(){ $('[data-confirm-box]').hidden=false; }
  $('[data-x]').addEventListener('click',()=>{confirmation();status('Finish posting on X, then confirm your share here.');});
  $('[data-cancel]').addEventListener('click',()=>{$('[data-confirm-box]').hidden=true;status('Share confirmation canceled. No reward added.');});
  $('[data-confirm]').addEventListener('click',()=>{$('[data-confirm-box]').hidden=true;claim('user-confirmed-link-share');});
  $('[data-share]').addEventListener('click',async()=>{const b=$('[data-share]');b.disabled=true;$('[data-confirm-box]').hidden=true;
    try{if(navigator.share){await navigator.share({title,url});await claim('native-share');}
      else{try{await navigator.clipboard.writeText(url);status('Link copied. Share it, then confirm below.');}catch(_){status('Copy the link below, share it, then confirm.');}confirmation();}}
    catch(e){status(e.name==='AbortError'?'Share canceled. No reward added.':'Sharing did not finish. Try Post to X or copy the link.');}
    finally{b.disabled=false;render();}});
  $('[data-connect]').addEventListener('click',()=>exclusive(async()=>{const w=wallet();if(!w.state.currentWalletId)w.createWallet({displayName:'Unified Infinity Wallet'});await flush();render();}).catch(failure));
  function recover(){exclusive(flush).catch(failure);}
  $('[data-retry]').addEventListener('click',recover);
  window.addEventListener('storage',render);window.addEventListener('focus',recover);render();recover();
})();
