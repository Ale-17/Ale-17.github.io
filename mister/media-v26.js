(()=>{
'use strict';
const $=s=>document.querySelector(s),arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).toLocaleLowerCase('es-ES');
let latest=null,lineup=null,catalog={players:{}},insights={by_key:{}};
async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
function tkey(t){return [String(t?.created||''),clean(t?.from),clean(t?.to),String(Math.round(Number(t?.price)||0))].join('|')}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T')))}
function resolved(t){const meta=insights?.by_key?.[tkey(t)]||{},r=t?.player_resolution||{};return{player_id:meta.player_id||t?.player_id||r.player_id||null,name:clean(meta.name||t?.player||t?.player_name||r.player_name||r.resolved_player_name||r.name||'')}}
function candidates(id){const s=String(id||'');if(!s)return[];return[...new Set([catalog?.players?.[s]?.image_url,lineup?.player_media?.[s],arr(lineup?.players).find(p=>String(p.player_id)===s)?.image_url,`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(s)}.png`].filter(Boolean))]}
function loadCandidate(img,list,i=0){if(i>=list.length)return;img.onerror=()=>loadCandidate(img,list,i+1);img.src=list[i]}
function transferBadge(t){return norm(t?.from)==='mister'?'+':norm(t?.to)==='mister'?'−':'↔'}
function setFeedPhoto(icon,t,id,name){
  if(!icon||!id)return;
  const existing=icon.querySelector('img');
  if(existing&&icon.dataset.v26PlayerId===String(id)){
    [...icon.querySelectorAll('img')].slice(1).forEach(x=>x.remove());return;
  }
  const list=candidates(id);if(!list.length)return;
  const img=new Image();img.alt=name||'';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';
  img.onload=()=>{
    if(icon.dataset.v26PlayerId===String(id)&&icon.querySelector('img'))return;
    icon.className='feed-icon feed-player-photo';
    const badge=document.createElement('span');badge.className='feed-transfer-badge';badge.textContent=transferBadge(t);
    icon.replaceChildren(img,badge);icon.dataset.v26PlayerId=String(id);
  };
  loadCandidate(img,list);
}
function hydrateFeed(hostSelector,limit){
  const host=$(hostSelector);if(!host||!latest)return;
  const data=transfers().slice(0,limit),rows=[...host.querySelectorAll('.feed-row')];
  rows.forEach((row,i)=>{const t=data[i],icon=row.querySelector('.feed-icon');if(!t||!icon)return;const r=resolved(t);if(r.player_id)setFeedPhoto(icon,t,r.player_id,r.name)});
}
function render(){hydrateFeed('#homeFeed',8);hydrateFeed('#activityList',40)}
function watchHost(selector,limit){const host=$(selector);if(!host)return;new MutationObserver(()=>hydrateFeed(selector,limit)).observe(host,{childList:true})}
async function load(){const[d,l,c,i]=await Promise.all([get('./data/latest.json'),get('./data/current_lineup.json'),get('./data/player_catalog.json'),get('./data/transfer_insights.json')]);if(d)latest=d;if(l)lineup=l;if(c)catalog=c;if(i)insights=i;render();watchHost('#homeFeed',8);watchHost('#activityList',40)}
window.addEventListener('DOMContentLoaded',()=>setTimeout(load,60));
window.addEventListener('fantasy:ready',render);
})();
