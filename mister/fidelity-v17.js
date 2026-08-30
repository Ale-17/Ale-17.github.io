(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=v=>String(v??'').replace(/\s*💥\s*/g,'').trim().toLocaleLowerCase('es-ES');
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const arr=v=>Array.isArray(v)?v:[];
let latest=null,lineup=null,catalog={players:{}};
let queued=false;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
function transferId(t){const r=t?.player_resolution||{};return t?.player_id||r?.player_id||null}
function transferName(t){const r=t?.player_resolution||{};return clean(t?.player||t?.player_name||r?.player_name||r?.resolved_player_name||'')}
function playerCatalog(id){return catalog?.players?.[String(id)]||null}
function playerAsset(id){if(!id)return null;const key=String(id),cat=playerCatalog(key),lp=lineup?.player_media?.[key];return cat?.image_url||lp||`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${key}.png`}
function teamAsset(id){if(!id)return null;const key=String(id),cat=playerCatalog(key),logo=lineup?.player_team_logos?.[key];return cat?.team_logo_url||logo||null}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T')))}
function marker(t){const from=norm(t?.from),to=norm(t?.to);if(from==='mister')return'+';if(to==='mister')return'−';return'↔'}
function decorateFeed(selector,limit){if(!latest)return;const host=$(selector);if(!host)return;const rows=[...host.querySelectorAll('.feed-row')],data=transfers().slice(0,limit);rows.forEach((row,i)=>{const t=data[i],id=transferId(t),icon=row.querySelector('.feed-icon');if(!t||!id||!icon)return;const key=String(id);if(icon.dataset.fidelityId===key)return;const src=playerAsset(key);if(!src)return;const img=new Image();img.alt=transferName(t)||'';img.loading='lazy';img.referrerPolicy='no-referrer';img.onload=()=>{icon.className='feed-icon feed-player-photo';icon.textContent='';icon.appendChild(img);const badge=document.createElement('span');badge.className='feed-transfer-badge';badge.textContent=marker(t);icon.appendChild(badge);icon.dataset.fidelityId=key};img.onerror=()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src=`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${key}.png`}};img.src=src})}
function pitchPlayerData(el){const name=norm(el.querySelector('.pitch-player__name')?.textContent);return arr(lineup?.players).find(p=>norm(p.name)===name)||null}
function fixPitch(){if(!lineup)return;$$('.pitch-player').forEach(el=>{const p=pitchPlayerData(el);if(!p)return;el.querySelectorAll('.pitch-club').forEach(x=>x.remove());let badge=el.querySelector('.pitch-team-badge');const logo=teamAsset(p.player_id)||p.team_logo_url;if(logo&&!badge){badge=document.createElement('span');badge.className='pitch-team-badge';badge.innerHTML=`<img src="${esc(logo)}" alt="" referrerpolicy="no-referrer">`;el.appendChild(badge)}const portrait=el.querySelector('.pitch-player__portrait'),img=portrait?.querySelector('img:not(.pitch-club)');if(portrait&&(!img||!img.getAttribute('src'))){const src=playerAsset(p.player_id)||p.image_url;if(src){const ni=new Image();ni.alt='';ni.loading='lazy';ni.referrerPolicy='no-referrer';ni.src=src;portrait.textContent='';portrait.appendChild(ni)}}})}
function decorateRows(){$$('.market-row').forEach(row=>{const id=row.dataset.playerId;if(!id)return;const stack=row.querySelector('.market-club-stack');if(!stack)return;const img=stack.querySelector('.club-badge'),logo=teamAsset(id);if(logo&&!img){const ph=stack.querySelector('.club-placeholder');const el=document.createElement('img');el.className='club-badge';el.alt='';el.loading='lazy';el.referrerPolicy='no-referrer';el.src=logo;if(ph)ph.replaceWith(el);else stack.prepend(el)}})}
function render(){decorateFeed('#homeFeed',6);decorateFeed('#activityList',30);fixPitch();decorateRows()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
async function load(){const [l,c,d]=await Promise.all([get('./data/current_lineup.json'),get('./data/player_catalog.json'),get('./data/latest.json')]);if(l)lineup=l;if(c)catalog=c;if(d)latest=d;render()}
window.addEventListener('DOMContentLoaded',()=>{setTimeout(load,80);setTimeout(queue,500);setTimeout(queue,1200);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true})});
})();