(()=>{
'use strict';
/* Fantasy OS V26 startup coordinator.
 * - Deduplicates simultaneous reads of the same public JSON payload.
 * - Coalesces legacy MutationObservers so stacked enhancement layers cannot thrash the DOM.
 * - Keeps the native loading screen visible until the first useful home render is complete.
 */
const realFetch=window.fetch.bind(window);
const inflight=new Map();
function dataKey(input){
  if(typeof input!=='string')return null;
  try{const u=new URL(input,location.href);if(u.origin!==location.origin||!u.pathname.includes('/mister/data/')||!u.pathname.endsWith('.json'))return null;return u.pathname}catch{return null}
}
window.fetch=function(input,init){
  const key=dataKey(input),method=String(init?.method||'GET').toUpperCase();
  if(!key||method!=='GET')return realFetch(input,init);
  const now=Date.now(),old=inflight.get(key);
  if(old&&now-old.ts<1800)return old.promise.then(x=>new Response(x.body,{status:x.status,statusText:x.statusText,headers:x.headers}));
  let cleanUrl;try{cleanUrl=new URL(input,location.href);cleanUrl.search=''}catch{return realFetch(input,init)}
  const promise=realFetch(cleanUrl.toString(),{...(init||{}),cache:'no-store'}).then(async r=>({body:await r.text(),status:r.status,statusText:r.statusText,headers:[...r.headers.entries()]})).catch(e=>{inflight.delete(key);throw e});
  inflight.set(key,{ts:now,promise});
  return promise.then(x=>new Response(x.body,{status:x.status,statusText:x.statusText,headers:x.headers}));
};

const NativeMO=window.MutationObserver;
if(NativeMO){
  class CoalescedMutationObserver{
    constructor(cb){this.cb=cb;this.records=[];this.timer=0;this.inner=new NativeMO(records=>{this.records.push(...records);if(this.timer)return;this.timer=setTimeout(()=>{this.timer=0;const batch=this.records.splice(0);try{this.cb(batch,this)}catch(e){console.error('[Fantasy OS observer]',e)}},32)})}
    observe(...args){return this.inner.observe(...args)}
    disconnect(){if(this.timer){clearTimeout(this.timer);this.timer=0}this.records.length=0;return this.inner.disconnect()}
    takeRecords(){return this.records.splice(0).concat(this.inner.takeRecords())}
  }
  window.MutationObserver=CoalescedMutationObserver;
}

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let ready=false,started=Date.now(),stableSince=0;
function useful(){
  const balance=$('#headerBalance')?.textContent?.trim(),stats=$$('#homeStats .summary-stat').length,snap=$('#snapshotLine')?.textContent||'';
  const feed=$$('#homeFeed .feed-row').length,market=$$('#homeMarket .market-row').length,feedPhotos=$$('#homeFeed .feed-player-photo img').length;
  const mediaReady=feed===0||feedPhotos>=Math.min(2,feed)||Date.now()-started>2600;
  return balance&&balance!=='—'&&stats>=3&&!/Conectando/i.test(snap)&&(feed>0||market>0)&&mediaReady;
}
function finish(){if(ready)return;ready=true;document.documentElement.classList.add('fantasy-ready');const boot=$('#appBoot');if(boot){boot.classList.add('done');setTimeout(()=>boot.remove(),320)}window.dispatchEvent(new CustomEvent('fantasy:ready'))}
function watch(){
  if(ready)return;
  if(useful()){if(!stableSince)stableSince=performance.now();if(performance.now()-stableSince>180){finish();return}}else stableSince=0;
  if(Date.now()-started>9000){const label=$('#appBootStatus');if(label)label.textContent='Los datos están tardando más de lo normal…';const retry=$('#appBootRetry');if(retry)retry.hidden=false}
  requestAnimationFrame(watch);
}
window.addEventListener('DOMContentLoaded',()=>{$('#appBootRetry')?.addEventListener('click',()=>location.reload());requestAnimationFrame(watch)});
})();
