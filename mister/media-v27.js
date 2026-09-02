(()=>{
'use strict';
const $=s=>document.querySelector(s),arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).toLocaleLowerCase('es-ES');
let latest=null,lineup=null,catalog={players:{}},universe={players:{}},insights={by_key:{}};
const watched=new Set();
async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
function tkey(t){return [String(t?.created||''),clean(t?.from),clean(t?.to),String(Math.round(Number(t?.price)||0))].join('|')}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T')))}
function resolved(t){const meta=insights?.by_key?.[tkey(t)]||{},r=t?.player_resolution||{};return{player_id:meta.player_id||t?.player_id||r.player_id||null,name:clean(meta.name||t?.player||t?.player_name||r.player_name||r.resolved_player_name||r.name||'')}}
function currentPlayer(id){const s=String(id||'');return [...arr(latest?.market_players),...arr(latest?.my_team)].find(p=>String(p?.player_id)===s)||null}
function candidates(id){
  const s=String(id||'');if(!s)return[];
  const current=currentPlayer(s)||{},u=universe?.players?.[s]||{},cat=catalog?.players?.[s]||{},lp=arr(lineup?.players).find(p=>String(p?.player_id)===s)||{};
  const urls=[...arr(current?.image_urls),current?.image_url,...arr(u?.image_urls),u?.image_url,...arr(cat?.image_urls),cat?.image_url,lineup?.player_media?.[s],...arr(lp?.image_urls),lp?.image_url,`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(s)}.png`];
  return[...new Set(urls.map(clean).filter(Boolean))];
}
function loadCandidate(img,list,i=0,onFail=null){if(i>=list.length){onFail?.();img.dispatchEvent(new CustomEvent('fantasy-media-failed'));return}img.onerror=()=>loadCandidate(img,list,i+1,onFail);img.src=list[i]}
function transferBadge(t){return norm(t?.from)==='mister'?'+':norm(t?.to)==='mister'?'−':'↔'}
function mediaTick(){window.dispatchEvent(new CustomEvent('fantasy:media-progress'))}
function setFeedPhoto(icon,t,id,name){
  if(!icon||!id)return;
  const key=String(id),existing=[...icon.querySelectorAll('img')];
  if(existing.length){existing.slice(1).forEach(x=>x.remove());icon.dataset.v27PlayerId=key;return}
  const list=candidates(key);if(!list.length)return;
  const img=new Image();img.alt=name||'';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';
  img.onload=()=>{
    const now=[...icon.querySelectorAll('img')];
    if(now.length){now.slice(1).forEach(x=>x.remove());icon.dataset.v27PlayerId=key;mediaTick();return}
    icon.className='feed-icon feed-player-photo';
    const badge=document.createElement('span');badge.className='feed-transfer-badge';badge.textContent=transferBadge(t);
    icon.replaceChildren(img,badge);icon.dataset.v27PlayerId=key;mediaTick();
  };
  loadCandidate(img,list);
}
function hydrateFeed(hostSelector,limit){
  const host=$(hostSelector);if(!host||!latest)return;
  const data=transfers().slice(0,limit),rows=[...host.querySelectorAll('.feed-row')];
  rows.forEach((row,i)=>{const t=data[i],icon=row.querySelector('.feed-icon');if(!t||!icon)return;const r=resolved(t);if(r.player_id)setFeedPhoto(icon,t,r.player_id,r.name)});
}
function ensurePlayerPhoto(row,eager=false){
  const id=row?.dataset?.playerId||row?.querySelector('[data-player-id]')?.dataset?.playerId,photo=row?.querySelector('.player-photo');if(!id||!photo)return;
  const key=String(id),existing=[...photo.querySelectorAll('img')];
  if(existing.length){existing.slice(1).forEach(x=>x.remove());photo.dataset.v27PlayerId=key;return}
  if(photo.dataset.v27Loading===key)return;
  const list=candidates(key);if(!list.length)return;photo.dataset.v27Loading=key;
  const img=new Image();img.alt='';img.loading=eager?'eager':'lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  img.onload=()=>{
    photo.dataset.v27Loading='';
    const now=[...photo.querySelectorAll('img')];if(now.length){now.slice(1).forEach(x=>x.remove());photo.dataset.v27PlayerId=key;mediaTick();return}
    photo.querySelector('.player-initial')?.remove();photo.prepend(img);photo.dataset.v27PlayerId=key;mediaTick();
  };
  loadCandidate(img,list,0,()=>{photo.dataset.v27Loading=''});
}
function hydrateRows(selector,eagerCount=0){const host=$(selector);if(!host)return;[...host.querySelectorAll('.market-row')].forEach((row,i)=>ensurePlayerPhoto(row,i<eagerCount))}
function hydratePitch(){
  if(!lineup)return;
  [...document.querySelectorAll('.pitch-player')].forEach(el=>{const portrait=el.querySelector('.pitch-player__portrait');if(!portrait)return;const imgs=[...portrait.querySelectorAll('img:not(.pitch-club)')];if(imgs.length){imgs.slice(1).forEach(x=>x.remove());return}const name=clean(el.querySelector('.pitch-player__name')?.textContent),p=arr(lineup.players).find(x=>norm(x.name)===norm(name));if(!p)return;const list=candidates(p.player_id);if(!list.length)return;const img=new Image();img.alt='';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{if(!portrait.querySelector('img:not(.pitch-club)')){portrait.querySelector('span')?.remove();portrait.prepend(img);mediaTick()}};loadCandidate(img,list)})
}
function render(){hydrateFeed('#homeFeed',8);hydrateFeed('#activityList',40);hydrateRows('#homeMarket',3);hydrateRows('#marketList',4);hydrateRows('#teamList',3);hydratePitch()}
function watch(selector,fn){const host=$(selector);if(!host||watched.has(host))return;watched.add(host);new MutationObserver(()=>requestAnimationFrame(fn)).observe(host,{childList:true})}
async function load(){
  const[d,l,c,u,i]=await Promise.all([get('./data/latest.json'),get('./data/current_lineup.json'),get('./data/player_catalog.json'),get('./data/player_universe.json'),get('./data/transfer_insights.json')]);
  if(d)latest=d;if(l)lineup=l;if(c)catalog=c;if(u)universe=u;if(i)insights=i;
  render();
  watch('#homeFeed',()=>hydrateFeed('#homeFeed',8));watch('#activityList',()=>hydrateFeed('#activityList',40));watch('#homeMarket',()=>hydrateRows('#homeMarket',3));watch('#marketList',()=>hydrateRows('#marketList',4));watch('#teamList',()=>hydrateRows('#teamList',3));watch('#lineupPlayers',hydratePitch);
  setTimeout(render,180);
}
window.FantasyMediaV27={hydrate:render,candidates};
window.addEventListener('DOMContentLoaded',()=>setTimeout(load,20));
window.addEventListener('fantasy:ready',render);
})();
