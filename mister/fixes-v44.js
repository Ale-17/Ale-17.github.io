(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=name=>clean(name).split(/\s+/).map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'?';
let lineups=null,universe=null,loading=null,activeSide='home',rendering=false;

async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
async function ensure(force=false){
  if(loading&&!force)return loading;
  if(lineups&&universe&&!force)return {lineups,universe};
  loading=Promise.all([get('./data/probable_lineups.json'),get('./data/player_universe.json')]).then(([a,b])=>{
    lineups=a||{matches:[]};universe=b||{players:{}};return{lineups,universe};
  }).finally(()=>loading=null);
  return loading;
}
function sameTeam(a,b){
  const A=norm(a),B=norm(b);if(A===B)return true;
  const aliases=[
    ['athletic','athletic club'],['betis','real betis'],['atletico','atletico de madrid'],['barcelona','fc barcelona'],
    ['rayo vallecano','rayo vallecano de madrid'],['deportivo da coruna','rc deportivo'],['deportivo','rc deportivo'],
    ['racing de santander','r racing club'],['alaves','deportivo alaves'],['malaga','malaga cf'],['espanyol','rcd espanyol de barcelona']
  ];
  return aliases.some(([x,y])=>(A===x&&B===y)||(A===y&&B===x));
}
function currentTeams(){return $$('.v36-match .v36-teams>div:not(.v36-score) strong').map(x=>clean(x.textContent)).filter(Boolean)}
function currentProbable(){
  const names=currentTeams();if(names.length<2)return null;
  return arr(lineups?.matches).find(m=>sameTeam(m.home,names[0])&&sameTeam(m.away,names[1]))||null;
}
function sheetLogos(){
  const nodes=$$('.v36-match .v36-teams>div:not(.v36-score) .v36-team-logo img');
  return {home:nodes[0]?.src||'',away:nodes[1]?.src||''};
}
function nameMatches(a,b){
  const A=norm(a),B=norm(b);if(!A||!B)return false;if(A===B)return true;
  const aa=A.split(' '),bb=B.split(' '),as=aa.at(-1),bs=bb.at(-1);
  if(as!==bs||as.length<3)return false;
  if(aa.length===1||bb.length===1)return true;
  const af=aa[0],bf=bb[0];return af===bf||af.length===1||bf.length===1;
}
function resolvePlayer(name,team){
  const players=Object.values(universe?.players||{});
  const teamRows=players.filter(p=>sameTeam(p?.team_name,team));
  return teamRows.find(p=>nameMatches(p?.name,name))||players.find(p=>nameMatches(p?.name,name))||null;
}
function playerNode(name,rowIndex,rowCount,index,count,team){
  const p=resolvePlayer(name,team),pid=clean(p?.player_id),src=clean(p?.image_url||arr(p?.image_urls)[0]);
  const x=((index+1)/(count+1))*100;
  const y=rowCount<=1?50:88-(rowIndex/(rowCount-1))*76;
  return `<button type="button" class="v44-player ${pid?'resolved':''}" style="--x:${x.toFixed(3)}%;--y:${y.toFixed(3)}%" ${pid?`data-v44-player="${esc(pid)}"`:''} aria-label="${esc(clean(name))}">
    <span class="v44-player-avatar"><i>${esc(initials(name))}</i>${src?`<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>
    <strong>${esc(clean(name))}</strong>
  </button>`;
}
function pitch(lineup,team){
  const rows=arr(lineup?.rows).filter(r=>arr(r).length),count=rows.length;
  return `<div class="v44-pitch" data-v44-pitch>
    <div class="v44-pitch-lines"><i class="half"></i><i class="circle"></i><i class="area top"></i><i class="area bottom"></i><i class="goal top"></i><i class="goal bottom"></i></div>
    <span class="v44-side-label top">ATAQUE</span><span class="v44-side-label bottom">PORTERÍA</span>
    ${rows.map((row,ri)=>arr(row).map((name,pi)=>playerNode(name,ri,count,pi,row.length,team)).join('')).join('')}
  </div>`;
}
function freshness(){
  const raw=clean(lineups?.source_updated)||clean(lineups?.updated_at);if(!raw)return'Actualización automática';
  const d=new Date(raw);if(Number.isNaN(d.getTime()))return raw;
  return `Actualizado ${new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)}`;
}
function teamTab(side,lineup,logo){
  return `<button type="button" class="v44-team-tab ${activeSide===side?'active':''}" data-v44-side="${side}">
    <span class="v44-tab-logo">${logo?`<img src="${esc(logo)}" alt="">`:''}</span>
    <span><strong>${esc(clean(lineup?.team))}</strong><small>${esc(clean(lineup?.formation)||'Formación probable')}</small></span>
  </button>`;
}
function renderInto(sec,match){
  const logos=sheetLogos(),home=match?.home_lineup,away=match?.away_lineup;
  if(!home||!away)return;
  const active=activeSide==='away'?away:home,team=clean(active?.team),resolved=arr(active?.rows).flat().filter(name=>resolvePlayer(name,team)).length;
  sec.className='v37-lineups v44-lineups';
  sec.innerHTML=`<div class="v44-head">
    <div><span>PREPARTIDO</span><h3>Onces probables</h3><p>Vista táctica · toca un jugador para abrir su ficha</p></div>
    <div class="v44-source"><strong>${esc(clean(match?.source_label)||'LaLigaExpert')}</strong><small>${esc(freshness())}</small></div>
  </div>
  <div class="v44-tabs">${teamTab('home',home,logos.home)}${teamTab('away',away,logos.away)}</div>
  <div class="v44-active-team"><div><span class="v44-active-logo">${activeSide==='away'?(logos.away?`<img src="${esc(logos.away)}" alt="">`:''):(logos.home?`<img src="${esc(logos.home)}" alt="">`:'')}</span><div><small>ONCE PROBABLE</small><strong>${esc(team)}</strong></div></div><b>${esc(clean(active?.formation)||'—')}</b></div>
  ${pitch(active,team)}
  <div class="v44-foot"><span><i></i> Predicción prepartido</span><span>${resolved}/11 fichas enlazadas</span></div>`;
  sec.dataset.v44Side=activeSide;
  sec.dataset.v44Ready='1';
}
async function enhance(){
  if(rendering)return;const sec=$('.v36-match .v37-lineups');if(!sec)return;
  rendering=true;
  try{await ensure();const match=currentProbable();if(!match)return;const desired=activeSide;if(sec.dataset.v44Ready==='1'&&sec.dataset.v44Side===desired)return;renderInto(sec,match)}finally{rendering=false}
}
function openProfile(id){
  if(!id)return;
  const bridge=document.createElement('span');bridge.className='v36-match v44-profile-bridge';
  const target=document.createElement('button');target.type='button';target.dataset.v38PlayerId=String(id);bridge.appendChild(target);document.body.appendChild(bridge);
  target.click();setTimeout(()=>bridge.remove(),0);
}
function bind(){
  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('[data-v44-side]');if(tab){e.preventDefault();e.stopPropagation();activeSide=tab.dataset.v44Side==='away'?'away':'home';const sec=tab.closest('.v44-lineups');if(sec){sec.dataset.v44Ready='0';enhance()}return}
    const p=e.target.closest?.('.v44-player');if(p){e.preventDefault();e.stopPropagation();if(typeof window.FantasyOSOpenProbableProfile==='function'){window.FantasyOSOpenProbableProfile(p);return}const id=p.dataset.v44Player;if(id)openProfile(id)}
  },true);
  const content=$('#sheetContent');if(content)new MutationObserver(()=>requestAnimationFrame(enhance)).observe(content,{childList:true,subtree:true});
}
async function init(){bind();await ensure();enhance();setTimeout(enhance,700);window.addEventListener('fantasy:ready',()=>setTimeout(()=>{ensure(true).then(enhance)},100))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();