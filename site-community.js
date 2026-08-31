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
  bar.innerHTML = `<div class="ic-row"><a class="ic-wallet" href="${walletUrl}">Unified wallet · <strong data-balance>0.00</strong> StarCoin</a><button type="button" data-share>Share · +0.1 StarCoin</button><a data-x target="_blank" rel="noopener noreferrer">Post to X ↗</a><button type="button" data-connect>Connect wallet</button></div><p data-status role="status"></p><div data-confirm-box hidden><p>After you have posted or sent the link, confirm your share. Opening a draft or copying a link alone earns nothing.</p><input data-link aria-label="Site sharing link" readonly><button type="button" data-confirm>I shared the link · claim 0.1</button><button type="button" data-cancel>Cancel</button></div><details><summary>How rewards work</summary><p>One 0.1 StarCoin reward per site per wallet. Repeat shares do not pay again. Shares are confirmed by your browser or by you; they are not independently verified. Uses the same device-local unified wallet linked from StarQuest. These credits are not yet synced to StarQuest’s cloud ledger or other browsers. Keep your site data to preserve your wallet.</p></details>`;
  const style=document.createElement('style');style.textContent=`#infinity-community{font:14px/1.5 Arial,sans-serif;background:#10151b;color:#f3f0e7;border-bottom:1px solid #48505c;padding:12px max(18px,4vw);position:relative;z-index:30}#infinity-community .ic-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#infinity-community a,#infinity-community button{font:inherit;color:inherit;text-decoration:none;border:1px solid #65717e;border-radius:7px;padding:9px 13px;min-height:44px;display:inline-flex;align-items:center;background:#202b35;cursor:pointer}#infinity-community .ic-wallet{margin-right:auto;background:none;border-color:transparent;gap:5px}#infinity-community strong{color:#ffe19c}#infinity-community button:disabled{opacity:.6;cursor:wait}#infinity-community p{margin:8px 0;max-width:980px;font-size:13px}#infinity-community p:empty{display:none}#infinity-community summary{cursor:pointer;color:#b9c2cb;font-size:12px;margin-top:8px}#infinity-community input{display:block;width:min(100%,650px);box-sizing:border-box;padding:10px;margin:8px 0;background:#fff;color:#111;border:1px solid #777}#infinity-community [hidden]{display:none!important}#infinity-community :focus-visible{outline:3px solid #ffe19c;outline-offset:3px}@media(max-width:600px){#infinity-community .ic-wallet{width:100%;padding-left:0}#infinity-community .ic-row{gap:7px}#infinity-community a,#infinity-community button{font-size:13px}}`;
  document.head.append(style);document.body.prepend(bar);
  const $=s=>bar.querySelector(s);const status=t=>$('[data-status]').textContent=t;
  $('[data-link]').value=url;
  $('[data-link]').addEventListener('focus',e=>e.target.select());
  $('[data-x]').href='https://twitter.com/intent/tweet?'+new URLSearchParams({text:title,url}).toString();
  const wallet=()=>{if(!window.InfinityUnifiedWallet?.UnifiedInfinityWallet)throw Error('Wallet did not load. Reload to retry; confirmed rewards remain pending.');return new window.InfinityUnifiedWallet.UnifiedInfinityWallet();};
  const eventId=id=>'game-reward:'+ [id,site,'GAME_SHARED','site'].map(encodeURIComponent).join(':');
  function render(){try{const w=wallet(),id=w.state.currentWalletId;
    $('[data-balance]').textContent=id?w.balance(id,'STAR_COIN').toFixed(2):'0.00';
    $('[data-connect]').textContent=id?'Sync wallet':'Connect wallet';
    if(id&&w.processedEventIds.has(eventId(id)))$('[data-share]').textContent='Share · reward already claimed';
    else $('[data-share]').textContent='Share · +0.1 StarCoin';
  }catch(e){status(e.message);}}
  let queue=Promise.resolve();
  function exclusive(fn){const run=()=>navigator.locks?navigator.locks.request('infinity-site-share:'+site,fn):fn();const p=queue.then(run,run);queue=p.catch(()=>{});return p;}
  async function flush(){const raw=localStorage.getItem(pendingKey);if(!raw){render();return;}const record=JSON.parse(raw);let w=wallet(),id=w.state.currentWalletId;
    if(record.walletId&&record.walletId!==id){status('A pending reward belongs to another wallet. Open that wallet to collect it.');return;}
    if(!id)id=w.createWallet({displayName:'Unified Infinity Wallet'}).walletId;
    record.walletId=id;localStorage.setItem(pendingKey,JSON.stringify(record));
    if(!w.creditStarCoinReward)throw Error('Reload to load wallet reward support. Your share is saved.');
    const result=await w.creditStarCoinReward({walletId:id,gameId:site,rewardKind:'GAME_SHARED',rewardId:'site',proof:{method:record.method,url,verification:'DEVICE_LOCAL'}});
    localStorage.removeItem(pendingKey);render();status(result.credited?'Added 0.1 StarCoin to your unified wallet.':'This site’s share reward is already in your wallet. No duplicate credit added.');}
  function claim(method){return exclusive(async()=>{let id=null;try{id=wallet().state.currentWalletId;}catch(_){}
    const prior=localStorage.getItem(pendingKey);if(prior&&JSON.parse(prior).walletId&&JSON.parse(prior).walletId!==id)throw Error('A pending reward belongs to another wallet. Switch to it before claiming.');
    if(!prior)localStorage.setItem(pendingKey,JSON.stringify({walletId:id,method,createdAt:new Date().toISOString()}));await flush();
  }).catch(e=>status('Reward not confirmed: '+e.message));}
  function confirmation(){ $('[data-confirm-box]').hidden=false; }
  $('[data-x]').addEventListener('click',()=>{confirmation();status('Finish posting on X, then confirm your share here.');});
  $('[data-cancel]').addEventListener('click',()=>{$('[data-confirm-box]').hidden=true;status('Share confirmation canceled. No reward added.');});
  $('[data-confirm]').addEventListener('click',()=>{$('[data-confirm-box]').hidden=true;claim('user-confirmed-link-share');});
  $('[data-share]').addEventListener('click',async()=>{const b=$('[data-share]');b.disabled=true;$('[data-confirm-box]').hidden=true;
    try{if(navigator.share){await navigator.share({title,url});await claim('native-share');}
      else{try{await navigator.clipboard.writeText(url);status('Link copied. Share it, then confirm below.');}catch(_){status('Copy the link below, share it, then confirm.');}confirmation();}}
    catch(e){status(e.name==='AbortError'?'Share canceled. No reward added.':'Sharing did not finish. Try Post to X or copy the link.');}
    finally{b.disabled=false;render();}});
  $('[data-connect]').addEventListener('click',()=>exclusive(async()=>{const w=wallet();if(!w.state.currentWalletId)w.createWallet({displayName:'Unified Infinity Wallet'});await flush();render();}).catch(e=>status(e.message)));
  function recover(){exclusive(flush).catch(e=>status('Could not sync: '+e.message));}
  window.addEventListener('storage',render);window.addEventListener('focus',recover);render();recover();
})();
