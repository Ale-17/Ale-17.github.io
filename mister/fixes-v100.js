(()=>{
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLocaleLowerCase('es-ES');
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
let latest=null,insights={by_key:{}},loading=null,queued=false,bound=false;
async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
async function ensure(force=false){if(!force&&latest&&insights?.by_key)return;if(loading)return loading;loading=Promise.all([get('./data/latest.json'),get('./data/transfer_insights.json')]).then(([a,b])=>{latest=a||{};insights=b||{by_key:{}}}).finally(()=>loading=null);return loading}
function key(t){return[String(t?.created||''),clean(t?.from),clean(t?.to),String(Math.round(finite(t?.price)||0))].join('|')}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b?.created||'').replace(' ','T'))-new Date(String(a?.created||'').replace(' ','T')))}
function directName(t){const r=t?.player_resolution||{};return clean(t?.player||t?.player_name||r?.resolved_player_name||r?.player_name||r?.name)}
function labelFor(t){const info=insights?.by_key?.[key(t)]||{};if(clean(info?.name))return{name:clean(info.name),ambiguous:false,info};const display=clean(info?.display_name);if(display)return{name:display,ambiguous:info?.identity_status==='ambiguous_batch'||info?.identity_confidence==='ambiguous'||arr(info?.candidate_names).length>1,info};const candidates=[...new Set([...arr(info?.candidate_names),...arr(t?.player_resolution?.candidate_names)].map(clean).filter(Boolean))];if(candidates.length)return{name:candidates.join(' / '),ambiguous:candidates.length>1,info};const direct=directName(t);if(direct&&norm(direct)!=='movimiento por confirmar')return{name:direct,ambiguous:false,info};return null}
function patchHost(selector){const host=document.querySelector(selector);if(!host)return;const rows=[...host.querySelectorAll('.feed-row')],data=transfers().slice(0,rows.length);rows.forEach((row,i)=>{const t=data[i];if(!t)return;const resolved=labelFor(t);if(!resolved?.name)return;const title=row.querySelector('.feed-copy strong');if(title&&clean(title.textContent)!==resolved.name)title.textContent=resolved.name;row.classList.toggle('v100-ambiguous-transfer',!!resolved.ambiguous);if(resolved.ambiguous){row.dataset.identityCandidates=resolved.name;const icon=row.querySelector('.feed-icon');if(icon)icon.title='Se conocen los jugadores vendidos, pero Mister no conserva qué importe corresponde a cada uno';if(title)title.title='Jugadores identificados; importe individual no atribuible con certeza'}})}
function patch(){queued=false;patchHost('#homeFeed');patchHost('#activityList')}
function queue(){if(queued)return;queued=true;requestAnimationFrame(patch)}
function bind(){if(bound)return;bound=true;const app=document.querySelector('.app-shell')||document.body;new MutationObserver(queue).observe(app,{childList:true,subtree:true});window.addEventListener('fantasy:ready',()=>setTimeout(async()=>{await ensure(true);patch()},120));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(async()=>{await ensure(true);patch()},60)})}
async function init(){bind();await ensure();patch();setTimeout(patch,500);setTimeout(patch,1400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.FantasyOSV100={patch,refresh:async()=>{await ensure(true);patch()}};
})();
