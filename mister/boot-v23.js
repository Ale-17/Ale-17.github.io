(()=>{
'use strict';
window.num=window.num||((v)=>Number.isFinite(Number(v))?Number(v):0);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).toLocaleLowerCase('es-ES');
let latest=null,lineup=null,catalog={players:{}},insights={by_key:{}},queued=false;
async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(r.ok)return await r.json()}catch{}return null}
function tkey(t){return [String(t?.created||''),clean(t?.from),clean(t?.to),String(Math.round(Number(t?.price)||0))].join('|')}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T')))}
function resolved(t){const meta=insights?.by_key?.[tkey(t)]||{},r=t?.player_resolution||{};return{player_id:meta.player_id||t?.player_id||r.player_id||null,name:clean(meta.name||t?.player||t?.player_name||r.player_name||r.resolved_player_name||r.name||'')}}
function imageCandidates(id){const s=String(id||'');if(!s)return[];const out=[catalog?.players?.[s]?.image_url,lineup?.player_media?.[s],arr(lineup?.players).find(p=>String(p.player_id)===s)?.image_url,`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(s)}.png`].filter(Boolean);return[...new Set(out)]}
function loadFirst(img,candidates,i=0){if(i>=candidates.length)return;img.onerror=()=>loadFirst(img,candidates,i+1);img.src=candidates[i]}
function hydrateFeed(selector,limit){const host=$(selector);if(!host||!latest)return;const data=transfers().slice(0,limit),rows=[...host.querySelectorAll('.feed-row')];rows.forEach((row,i)=>{if(row.querySelector('.feed-player-photo img'))return;const t=data[i],icon=row.querySelector('.feed-icon');if(!t||!icon)return;const r=resolved(t);if(!r.player_id)return;const candidates=imageCandidates(r.player_id);if(!candidates.length)return;const img=new Image();img.alt=r.name||'';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{icon.className='feed-icon feed-player-photo';icon.textContent='';icon.appendChild(img);const badge=document.createElement('span');badge.className='feed-transfer-badge';badge.textContent=norm(t.from)==='mister'?'+':norm(t.to)==='mister'?'−':'↔';icon.appendChild(badge)};loadFirst(img,candidates)})}
function hydrateMarket(hostSelector){$$(hostSelector+' .market-row').forEach(row=>{const photo=row.querySelector('.player-photo');if(!photo||photo.querySelector('img'))return;const id=row.dataset.playerId||row.querySelector('[data-player-id]')?.dataset.playerId;if(!id)return;const candidates=imageCandidates(id);if(!candidates.length)return;const old=photo.querySelector('.player-initial');const img=new Image();img.alt='';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{old?.remove();photo.prepend(img)};loadFirst(img,candidates)})}
function render(){hydrateFeed('#homeFeed',8);hydrateFeed('#activityList',40);hydrateMarket('#homeMarket');hydrateMarket('#marketList')}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
async function load(){const [d,l,c,i]=await Promise.all([get('./data/latest.json'),get('./data/current_lineup.json'),get('./data/player_catalog.json'),get('./data/transfer_insights.json')]);if(d)latest=d;if(l)lineup=l;if(c)catalog=c;if(i)insights=i;render();setTimeout(render,350);setTimeout(render,1000);setTimeout(render,2200)}
window.addEventListener('DOMContentLoaded',()=>{setTimeout(load,80);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});$$('.nav-tab').forEach(b=>b.addEventListener('click',()=>setTimeout(queue,80)))});
})();
