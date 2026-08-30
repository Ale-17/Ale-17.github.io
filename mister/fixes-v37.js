(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], arr=v=>Array.isArray(v)?v:[];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=v=>{const x=num(v),a=Math.abs(x),sg=x<0?'−':'';if(a>=1e6)return`${sg}${(a/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;if(a>=1e3)return`${sg}${Math.round(a/1e3).toLocaleString('es-ES')}k`;return`${sg}${Math.round(a).toLocaleString('es-ES')} €`};
const pos=p=>({1:'PT',2:'DF',3:'MC',4:'DL'}[Number(p)]||'');
let latest=null,live=null,details={players:{}},catalog={players:{}},lineups={matches:[]},loading=null;

async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
async function ensure(force=false){
  if(loading)return loading;
  if(!force&&latest&&live)return;
  loading=Promise.all([
    get('./data/latest.json'),
    get('./data/gameweek_live.json'),
    get('./data/player_details.json'),
    get('./data/player_catalog.json'),
    get('./data/probable_lineups.json')
  ]).then(([a,b,c,d,e])=>{if(a)latest=a;if(b)live=b;if(c)details=c;if(d)catalog=d;if(e)lineups=e;loading=null;return true}).catch(()=>{loading=null});
  return loading;
}
function privacyActive(){
  try{return document.documentElement.classList.contains('privacy-mode')||document.body?.classList.contains('privacy-mode')||localStorage.getItem('fantasy-os-incognito')==='1'}catch{return document.documentElement.classList.contains('privacy-mode')}
}
function closeSheet(clear=false){
  const sheet=$('#playerSheet'),back=$('#sheetBackdrop'),content=$('#sheetContent');
  sheet?.classList.remove('open');sheet?.setAttribute('aria-hidden','true');
  back?.classList.add('hidden');document.body?.classList.remove('v28-sheet-open');
  if(clear&&content)content.innerHTML='';
}
function sameTeam(a,b){
  const A=norm(a),B=norm(b);if(A===B)return true;
  const aliases=[
    ['athletic','athletic club'],['betis','real betis'],['atletico','atletico de madrid'],
    ['barcelona','fc barcelona'],['rayo vallecano','rayo vallecano de madrid'],
    ['deportivo da coruna','rc deportivo'],['racing de santander','r racing club'],
    ['alaves','deportivo alaves'],['malaga','malaga cf']
  ];
  return aliases.some(([x,y])=>(A===x&&B===y)||(A===y&&B===x));
}
function currentSheetMatch(){
  const names=$$('.v36-match .v36-teams>div:not(.v36-score) strong').map(x=>clean(x.textContent));
  if(names.length<2)return null;
  return arr(live?.matches).find(m=>sameTeam(names[0],m?.home_team?.name)&&sameTeam(names[1],m?.away_team?.name))||null;
}
function probableFor(m){
  return arr(lineups?.matches).find(x=>sameTeam(x.home,m?.home_team?.name)&&sameTeam(x.away,m?.away_team?.name))||null;
}
function allPlayer(id){
  for(const m of arr(live?.matches)){const p=arr(m?.all_players).find(x=>String(x?.player_id)===String(id));if(p)return p}
  return null;
}
function detailsRows(id){
  return arr(details?.players?.[String(id)]?.matches).slice();
}
function catalogPlayer(id){return catalog?.players?.[String(id)]||{}}
function playerPosition(p){return Number(p?.position||catalogPlayer(p?.player_id)?.position)||null}
function owner(p){const o=clean(p?.owner_name);if(p?.is_mine||norm(o)==='ale')return'Ale';if(!o||/libre|mister/.test(norm(o)))return'Libre';return o}
function image(p){return p?.image_url||catalogPlayer(p?.player_id)?.image_url||`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(String(p?.player_id||''))}.png`}
function teamLogo(p){return p?.team_logo_url||catalogPlayer(p?.player_id)?.team_logo_url||''}
function mergedMatches(p){
  const map=new Map();
  for(const r of [...arr(p?.recent),...detailsRows(p?.player_id)]){
    const key=String(r?.gameweek_id||r?.gameweek||map.size);
    const old=map.get(key)||{};
    map.set(key,{...old,...r,stats:{...(old.stats||{}),...(r?.stats||{})}});
  }
  return [...map.values()].sort((a,b)=>Number(String(a?.gameweek||a?.gameweek_id||'').match(/\d+/)?.[0]||0)-Number(String(b?.gameweek||b?.gameweek_id||'').match(/\d+/)?.[0]||0));
}
function eventCounts(p){const toks=[...arr(p?.event_tokens),...arr(p?.events)].map(x=>String(x||'').toLowerCase());return{goals:toks.filter(x=>/events-goal(?!assist)|#goal(?!assist)/.test(x)).length,assists:toks.filter(x=>/assist/.test(x)).length}}
function openShell(html,cls=''){
  const sheet=$('#playerSheet'),content=$('#sheetContent'),back=$('#sheetBackdrop');if(!sheet||!content||!back)return;
  content.innerHTML=html;sheet.className=`player-sheet open v37-sheet ${cls}`.trim();sheet.setAttribute('aria-hidden','false');
  sheet.scrollTop=0;sheet.style.removeProperty('transform');back.classList.remove('hidden');document.body.classList.add('v28-sheet-open');
}
function matchStatsLine(r){
  const bits=[];
  if(r?.starter===true)bits.push('Titular');else if(r?.starter===false||String(r?.role||'').toLowerCase()==='bench')bits.push('Suplente');
  if(r?.minutes!==null&&r?.minutes!==undefined)bits.push(`${num(r.minutes)} min`);
  if(r?.sofascore_rating!==null&&r?.sofascore_rating!==undefined)bits.push(`Sofascore ${num(r.sofascore_rating).toLocaleString('es-ES',{maximumFractionDigits:1})}`);
  if(num(r?.stats?.goals))bits.push(`${num(r.stats.goals)} gol${num(r.stats.goals)===1?'':'es'}`);
  if(num(r?.stats?.goalAssist))bits.push(`${num(r.stats.goalAssist)} asist.`);
  return bits.join(' · ');
}
function openGenericPlayer(p){
  if(!p?.player_id)return;
  const id=String(p.player_id),rows=mergedMatches(p),last=rows.slice(-5).reverse(),vals=rows.filter(x=>x?.points!==null&&x?.points!==undefined).map(x=>num(x.points));
  const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,starts=rows.filter(x=>x?.starter===true||String(x?.role||'').toLowerCase()==='starter').length;
  const photo=image(p),logo=teamLogo(p),ev=eventCounts(p),current=p?.points!==null&&p?.points!==undefined?num(p.points):null;
  openShell(`<section class="v37-player">
    <div class="v37-player-hero">
      <div class="v37-player-photo">${photo?`<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer">`:''}${logo?`<i><img src="${esc(logo)}" alt=""></i>`:''}</div>
      <div><span class="section-kicker">${esc([pos(playerPosition(p)),owner(p)].filter(Boolean).join(' · '))}</span><h2>${esc(clean(p.name))}</h2>
      <div class="v37-player-headline">${p?.market_value?`<strong>${compact(p.market_value)}</strong>`:''}${p?.displayed_points!==null&&p?.displayed_points!==undefined?`<span>${num(p.displayed_points)} pts temporada</span>`:''}</div></div>
    </div>
    <div class="v37-player-grid">
      <div><span>Jornada ${esc(live?.gameweek_number||'')}</span><strong>${current!==null?`${current} pts`:'—'}</strong></div>
      <div><span>Propietario</span><strong>${esc(owner(p))}</strong></div>
      <div><span>Media reciente</span><strong>${avg!==null?avg.toLocaleString('es-ES',{maximumFractionDigits:1}):'—'}</strong></div>
      <div><span>Titularidades</span><strong>${rows.length?`${starts}/${rows.length}`:'—'}</strong></div>
    </div>
    ${ev.goals||ev.assists?`<div class="v37-events">${ev.goals?`<span>⚽ ${ev.goals}</span>`:''}${ev.assists?`<span>A ${ev.assists}</span>`:''}</div>`:''}
    <section class="v37-player-section"><div class="v37-section-title"><span>RENDIMIENTO</span><h3>Últimos partidos</h3></div>
      <div class="v37-games">${last.length?last.map(r=>`<div class="v37-game"><div><strong>${esc(r?.gameweek||`J${String(r?.gameweek_id||'').slice(-1)}`)}</strong><small>${esc(matchStatsLine(r)||'Jornada')}</small></div><b>${r?.points!==null&&r?.points!==undefined?`${num(r.points)} pts`:'—'}</b></div>`).join(''):'<div class="v37-empty">Sin partidos recientes</div>'}</div>
    </section>
  </section>`,'v37-player-sheet');
}
function openMatchPlayer(id){
  const p=allPlayer(id);if(!p)return;
  const own=$(`#teamList .market-row[data-player-id="${String(id).replace(/"/g,'')}"]`);
  if(own&&!privacyActive()){own.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return}
  openGenericPlayer(p);
}
function decorateMatchRows(){
  const m=currentSheetMatch();if(!m)return;
  for(const row of $$('.v36-match .v36-static-row')){
    const name=clean(row.querySelector('.v34-intel-name strong')?.textContent);if(!name)continue;
    const p=arr(m?.all_players).find(x=>norm(x?.name)===norm(name));if(!p?.player_id)continue;
    row.dataset.v37Player=String(p.player_id);row.classList.add('v37-player-clickable');row.setAttribute('role','button');row.setAttribute('tabindex','0');
  }
}
function pitch(lineup,logoUrl){
  if(!lineup)return'';
  const rows=arr(lineup.rows);
  return `<article class="v37-lineup-card"><header><div>${logoUrl?`<img src="${esc(logoUrl)}" alt="">`:''}<strong>${esc(lineup.team)}</strong></div><span>${esc(lineup.formation||'')}</span></header>
    <div class="v37-mini-pitch">${rows.map((r,i)=>`<div class="v37-pitch-row row-${i}">${arr(r).map(name=>`<span>${esc(name)}</span>`).join('')}</div>`).join('')}</div>
  </article>`;
}
function enhanceFixture(){
  const m=currentSheetMatch();if(!m||m.status!=='fixture')return;
  const root=$('.v36-match');if(!root||root.querySelector('.v37-lineups'))return;
  root.querySelector('.v36-match-copy')?.remove();root.querySelector('.v36-match-stats')?.remove();root.querySelectorAll('.v36-section').forEach(x=>x.remove());
  const d=probableFor(m);if(!d)return;
  const sec=document.createElement('section');sec.className='v37-lineups';
  sec.innerHTML=`<div class="v37-lineups-head"><div><span>PREPARTIDO</span><h3>Alineaciones probables</h3></div><small>${esc(d.source_label||'')} · ${esc(d.source_updated||'')}</small></div>
  <div class="v37-lineup-grid">${pitch(d.home_lineup,m?.home_team?.logo_url)}${pitch(d.away_lineup,m?.away_team?.logo_url)}</div>`;
  root.appendChild(sec);
}
function naturalize(){
  $$('.v36-match-copy,.v36-manager>p,.v24-note').forEach(x=>x.remove());
  $$('.v36-match .v34-intel-title h3').forEach(x=>{if(norm(x.textContent)==='destacados reales')x.textContent='Destacados'});
  $$('.v36-match .v34-intel-title>small').forEach(x=>{if(/top por|todos los jugadores|calculad|capturad/i.test(x.textContent||''))x.remove()});
  $$('.v36-match .v34-intel-copy>small').forEach(x=>{if(/puntuaci[oó]n real capturada/i.test(x.textContent||''))x.textContent=`Jornada ${live?.gameweek_number||''}`});
  const stats=$$('.v36-match .v36-match-stats>div');if(stats.length>=3){const m=currentSheetMatch();if(m&&m.status!=='fixture'){stats[2].querySelector('span').textContent='DESTACADOS';stats[2].querySelector('strong').textContent=String(arr(m.all_players).filter(p=>p?.points!==null&&p?.points!==undefined).sort((a,b)=>num(b.points)-num(a.points)).slice(0,5).length)}}
  $$('.v36-manager .v34-rival-wealth span').forEach(x=>{if(/patrimonio estimado real/i.test(x.textContent||''))x.textContent='PATRIMONIO REAL'});
}
function decorateManagers(){
  for(const row of $$('#leagueTable .table-row')){
    const name=clean(row.querySelector('.table-manager strong')?.textContent);if(!name)continue;
    row.dataset.v37Manager=name;
    const mine=norm(name)==='ale',blocked=mine&&privacyActive();
    row.classList.toggle('v37-private-manager',blocked);
    if(blocked){row.setAttribute('aria-disabled','true');row.removeAttribute('tabindex');row.title='Oculto en modo incógnito'}
    else{row.removeAttribute('aria-disabled');row.removeAttribute('title')}
  }
}
function enforcePrivacy(){
  decorateManagers();
  if(privacyActive()&&norm($('.v36-manager h2')?.textContent)==='ale')closeSheet(true);
}
function refreshSheet(){
  naturalize();decorateMatchRows();enhanceFixture();enforcePrivacy();
}
function observe(){
  const content=$('#sheetContent');if(content)new MutationObserver(()=>requestAnimationFrame(refreshSheet)).observe(content,{childList:true,subtree:true});
  const table=$('#leagueTable');if(table)new MutationObserver(()=>requestAnimationFrame(decorateManagers)).observe(table,{childList:true,subtree:true});
  new MutationObserver(()=>requestAnimationFrame(enforcePrivacy)).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  if(document.body)new MutationObserver(()=>requestAnimationFrame(enforcePrivacy)).observe(document.body,{attributes:true,attributeFilter:['class']});
}
document.addEventListener('click',e=>{
  const row=e.target.closest?.('.v36-match .v36-static-row[data-v37-player]');if(!row)return;
  e.preventDefault();e.stopPropagation();openMatchPlayer(row.dataset.v37Player);
},true);
document.addEventListener('keydown',e=>{
  if(!['Enter',' '].includes(e.key))return;
  const row=e.target.closest?.('.v36-match .v36-static-row[data-v37-player]');if(!row)return;
  e.preventDefault();openMatchPlayer(row.dataset.v37Player);
});
async function init(){await ensure();decorateManagers();observe();refreshSheet();setTimeout(refreshSheet,500);setTimeout(refreshSheet,1500)}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>setTimeout(init,180),{once:true});else setTimeout(init,180);
})();