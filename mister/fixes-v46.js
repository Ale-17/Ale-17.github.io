(()=>{
'use strict';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],arr=v=>Array.isArray(v)?v:[];
const STORE_KEY='fantasy-os-watchlist-v1';
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>valid(v)?Number(v):null;
const money=v=>{if(!valid(v))return'—';const x=Number(v),a=Math.abs(x),sg=x<0?'−':'';if(a>=1e6)return`${sg}${(a/1e6).toLocaleString('es-ES',{minimumFractionDigits:a>=10e6?1:2,maximumFractionDigits:2})} M€`;if(a>=1e3)return`${sg}${Math.round(a/1e3).toLocaleString('es-ES')}k €`;return`${sg}${Math.round(a).toLocaleString('es-ES')} €`};
const signedMoney=v=>valid(v)?`${Number(v)>0?'+':Number(v)<0?'−':''}${money(Math.abs(Number(v)))}`:'—';
const pct=v=>valid(v)?`${Number(v)>0?'+':''}${Number(v).toLocaleString('es-ES',{maximumFractionDigits:1})}%`:'—';
const initials=name=>clean(name).split(/\s+/).map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'?';
const pos=v=>({1:'PT',2:'DF',3:'MC',4:'DL'}[Number(v)]||'');

let dataCache=null,dataPromise=null,rendering=false,queued=false;

async function json(path){
  try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}
}
async function ensure(force=false){
  if(dataCache&&!force)return dataCache;
  if(dataPromise&&!force)return dataPromise;
  dataPromise=Promise.all([
    json('./data/clause_radar.json'),
    json('./data/player_universe.json'),
    json('./data/player_details.json'),
    json('./data/series.json'),
    json('./data/clause_news.json')
  ]).then(([radar,universe,details,series,news])=>dataCache={
    radar:radar||{players:[]},
    universe:universe||{players:{}},
    details:details||{players:{}},
    series:series||{players:{}},
    news:news||{players:{}}
  }).finally(()=>dataPromise=null);
  return dataPromise;
}

function readStore(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    return {version:1,items:raw&&typeof raw.items==='object'&&raw.items?raw.items:{}};
  }catch{return{version:1,items:{}}}
}
function saveStore(store){
  try{localStorage.setItem(STORE_KEY,JSON.stringify({version:1,items:store.items||{}}))}catch{}
}

function parseMoney(v){
  if(valid(v))return Number(v);
  let s=clean(v);if(!s)return null;
  const mult=/\bM(?:€|\b)/i.test(s)?1e6:/\bk(?:€|\b)/i.test(s)?1e3:1;
  s=s.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
  return s&&Number.isFinite(Number(s))?Number(s)*mult:null;
}
function gameweek(row){
  const m=String(row?.gameweek||row?.gameweek_id||'').match(/\d+/);return m?Number(m[0]):0;
}
function mergeMatches(...groups){
  const map=new Map();
  for(const group of groups)for(const row of arr(group)){
    if(!row||typeof row!=='object')continue;
    const key=String(row.gameweek_id||row.gameweek||`x${map.size}`);
    const old=map.get(key)||{};
    map.set(key,{...old,...row,stats:{...(old.stats||{}),...(row.stats||{})}});
  }
  return[...map.values()].sort((a,b)=>gameweek(a)-gameweek(b));
}
function seriesRows(id){
  return arr(dataCache?.series?.players?.[String(id)]?.points)
    .filter(r=>valid(r?.market_value)&&Number(r.market_value)>0)
    .map(r=>({...r,_time:new Date(r.captured_at||0).getTime()||0}))
    .sort((a,b)=>a._time-b._time);
}
function seriesTrend(id,currentValue){
  const rows=seriesRows(id);if(rows.length<2)return{pct:null,delta:null};
  const end=rows.at(-1),endTime=end._time||Date.now(),cut=endTime-7*864e5;
  const start=rows.find(r=>r._time>=cut)||rows[0];
  const current=valid(currentValue)?Number(currentValue):Number(end.market_value);
  const base=Number(start.market_value);
  if(!base||!current)return{pct:null,delta:null};
  return{delta:current-base,pct:(current-base)/base*100};
}
function ownerName(...values){
  const raw=values.map(clean).find(Boolean)||'Libre';
  return /^(mister|libre|free)$/i.test(raw)?'Libre':raw;
}
function radarById(id){return arr(dataCache?.radar?.players).find(r=>String(r?.player_id)===String(id))||null}
function universeById(id){return dataCache?.universe?.players?.[String(id)]||null}
function detailById(id){return dataCache?.details?.players?.[String(id)]||null}
function newsById(id,row){
  const a=row?.news&&typeof row.news==='object'?row.news:null;
  const b=dataCache?.news?.players?.[String(id)]||null;
  const source=(arr(a?.items).length?a:b)||a||b||{};
  return{level:clean(row?.news_level||source?.level)||'unknown',items:arr(source?.items)};
}
function statusInfo(row,owner){
  if(row?.status==='opportunity')return{key:'opportunity',label:'OPORTUNIDAD'};
  if(row?.status==='watch')return{key:'watch',label:'VIGILAR'};
  if(row?.status==='out_of_reach')return{key:'out',label:'FUERA DE ALCANCE'};
  if(owner==='Libre')return{key:'free',label:'LIBRE'};
  return{key:'quiet',label:'SEGUIMIENTO'};
}
function currentPlayer(id){
  const row=radarById(id)||{},u=universeById(id)||{},d=detailById(id)||{},sp=seriesRows(id);
  const profile=u.profile_stats||{};
  const marketValue=num(row.market_value)??num(u.market_value)??num(d.market_value)??parseMoney(profile.valor)??(sp.length?Number(sp.at(-1).market_value):null);
  const owner=ownerName(row.owner_name,u.owner_name,d.owner_name,d?._fantasy_v35?.owner_name);
  const clauseValue=owner==='Libre'?null:(num(row.clause_value)??num(row.clause));
  const seriesT=seriesTrend(id,marketValue);
  const trendPct=num(row.trend_pct)??num(row.weekly_pct)??seriesT.pct;
  const trendDelta=num(row.weekly_delta)??num(row.trend_delta)??seriesT.delta;
  const matches=mergeMatches(u.recent,u.matches,d.matches);
  const recent=matches.filter(m=>valid(m?.points)).slice(-5);
  const news=newsById(id,row);
  const image=clean(row.image_url||u.image_url||arr(u.image_urls)[0]);
  const name=clean(row.name||u.name||d.name)||`Jugador ${id}`;
  const team=clean(row.team_name||u.team_name||d.team_name);
  const status=statusInfo(row,owner);
  return{
    id:String(id),name,team,position:row.position??u.position??d.position,image,
    owner,marketValue,clauseValue,clauseSetting:num(row.clause_setting_pct)??num(row.clause_percent),
    trendPct,trendDelta,recent,news,status,
    score:num(row.score),decisionReason:clean(row.decision_reason),confidence:clean(row.decision_confidence)
  };
}
function snapshot(player){
  return{
    market_value:player.marketValue,
    clause_value:player.clauseValue,
    owner_name:player.owner,
    name:player.name,
    team_name:player.team,
    image_url:player.image
  };
}
async function toggleWatch(id){
  id=String(id||'').trim();if(!id)return;
  await ensure();
  const store=readStore();
  if(store.items[id])delete store.items[id];
  else{
    const p=currentPlayer(id),now=new Date().toISOString();
    store.items[id]={player_id:id,started_at:now,baseline:snapshot(p),name:p.name,team_name:p.team,image_url:p.image};
  }
  saveStore(store);
  syncStars();
  renderWatchlist();
  renderHomeAlert();
  window.dispatchEvent(new CustomEvent('fantasy:watchlist-change',{detail:{player_id:id,watched:!!store.items[id]}}));
}
function sinceText(iso){
  const t=new Date(iso||0).getTime();if(!t)return'';
  const days=Math.max(0,(Date.now()-t)/864e5);
  if(days<1)return'Desde hoy';
  if(days<2)return'Desde ayer';
  if(days<7)return`Desde hace ${Math.floor(days)} días`;
  return`Desde ${new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit'}).format(new Date(t))}`;
}
function pointsClass(v){const x=Number(v);return x>=8?'hot':x>=5?'good':x<=1?'low':'mid'}
function recentHtml(rows){
  const r=arr(rows).slice(-5);
  if(!r.length)return'<span class="v46-no-recent">Sin jornadas registradas</span>';
  return r.map(x=>`<span class="v46-point ${pointsClass(x.points)}"><b>${Math.round(Number(x.points))}</b><small>J${gameweek(x)||'·'}</small></span>`).join('');
}
function newsLevelLabel(level){
  return({strong_positive:'Muy positivas',positive:'Positivas',neutral:'Neutras',negative:'Riesgo',unknown:'Sin señal'}[clean(level)]||'Sin señal');
}
function newsHtml(player){
  const items=arr(player.news?.items).slice(0,2);
  if(!items.length)return`<div class="v46-news-empty"><span>Noticias</span><strong>${esc(newsLevelLabel(player.news?.level))}</strong></div>`;
  return`<div class="v46-news-head"><span>NOTICIAS</span><strong>${esc(newsLevelLabel(player.news?.level))}</strong></div>${items.map(item=>`<a class="v46-news-item" href="${esc(item.url||'#')}" target="_blank" rel="noopener"><span><strong>${esc(clean(item.title).replace(/\s+-\s+[^-]+$/,''))}</strong><small>${esc(clean(item.source)||'Fuente reciente')}</small></span><b>↗</b></a>`).join('')}`;
}
function clauseLabel(player){
  if(player.owner==='Libre')return'Libre';
  return valid(player.clauseValue)?money(player.clauseValue):'—';
}
function clauseSub(player,base){
  if(player.owner==='Libre')return'Sin cláusula';
  if(valid(player.clauseValue)&&valid(base?.clause_value)){
    const d=Number(player.clauseValue)-Number(base.clause_value);
    if(Math.abs(d)>=1)return`${signedMoney(d)} desde ⭐`;
  }
  if(valid(player.clauseSetting))return`${Math.round(Number(player.clauseSetting))}% sobre VM`;
  return'Cláusula actual';
}
function watchedCard(entry){
  const p=currentPlayer(entry.player_id),base=entry.baseline||{},marketDelta=valid(p.marketValue)&&valid(base.market_value)?Number(p.marketValue)-Number(base.market_value):null;
  const marketPct=marketDelta!==null&&Number(base.market_value)>0?marketDelta/Number(base.market_value)*100:null;
  const ownerChanged=clean(base.owner_name)&&clean(base.owner_name)!==p.owner;
  return`<article class="v46-card v46-${p.status.key}" data-v46-card="${esc(p.id)}">
    <div class="v46-card-top">
      <button type="button" class="v46-card-main" data-v46-open="${esc(p.id)}" aria-label="Abrir ficha de ${esc(p.name)}">
        <span class="v46-photo"><i>${esc(initials(p.name))}</i>${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>
        <span class="v46-copy">
          <span class="v46-name-row"><strong>${esc(p.name)}</strong><em>${esc(p.status.label)}</em></span>
          <small>${esc([p.owner,p.team,pos(p.position)].filter(Boolean).join(' · '))}</small>
          ${ownerChanged?`<span class="v46-owner-change">${esc(base.owner_name)} → ${esc(p.owner)}</span>`:''}
        </span>
        <span class="v46-open-arrow">›</span>
      </button>
      <button type="button" class="v46-remove active" data-v46-star="${esc(p.id)}" aria-label="Dejar de seguir a ${esc(p.name)}">★</button>
    </div>
    <div class="v46-metrics">
      <div><span>Valor</span><strong>${money(p.marketValue)}</strong><small>${valid(p.trendDelta)?`${signedMoney(p.trendDelta)} · 7d`:'VM actual'}</small></div>
      <div><span>Cláusula</span><strong>${clauseLabel(p)}</strong><small>${esc(clauseSub(p,base))}</small></div>
      <div><span>Subida 7d</span><strong class="${Number(p.trendPct)>0?'up':Number(p.trendPct)<0?'down':''}">${pct(p.trendPct)}</strong><small>${valid(p.trendDelta)?signedMoney(p.trendDelta):'Sin serie suficiente'}</small></div>
      <div><span>Desde ⭐</span><strong class="${Number(marketDelta)>0?'up':Number(marketDelta)<0?'down':''}">${marketDelta===null?'—':signedMoney(marketDelta)}</strong><small>${marketPct===null?esc(sinceText(entry.started_at)):`${pct(marketPct)} · ${esc(sinceText(entry.started_at))}`}</small></div>
    </div>
    <div class="v46-lower">
      <div class="v46-form"><div class="v46-mini-head"><span>ÚLTIMAS JORNADAS</span><small>${p.recent.length?`${p.recent.length} registradas`:''}</small></div><div class="v46-points">${recentHtml(p.recent)}</div></div>
      <div class="v46-news">${newsHtml(p)}</div>
    </div>
    ${p.decisionReason?`<div class="v46-radar-note"><span>RADAR</span><strong>${esc(p.decisionReason)}</strong></div>`:''}
  </article>`;
}
function sortEntries(entries){
  const weight={opportunity:5,watch:4,free:3,out:2,quiet:1};
  return entries.sort((a,b)=>{
    const pa=currentPlayer(a.player_id),pb=currentPlayer(b.player_id);
    return (weight[pb.status.key]||0)-(weight[pa.status.key]||0)||(num(pb.trendPct)||-999)-(num(pa.trendPct)||-999)||new Date(b.started_at||0)-new Date(a.started_at||0);
  });
}
function ensureSection(){
  const more=$('.screen[data-screen="more"]');if(!more)return null;
  let details=$('#v46WatchlistDetails');if(details)return details;
  details=document.createElement('details');
  details.id='v46WatchlistDetails';
  details.className='native-details v46-watchlist-details';
  details.innerHTML=`<summary><span><i class="v46-summary-star">★</i> Watchlist</span><b id="v46WatchCount" class="v46-summary-count">0</b><span>›</span></summary><div id="v46Watchlist" class="v46-watchlist"></div>`;
  const clause=$('#clauseList')?.closest('details');
  if(clause)clause.before(details);else more.appendChild(details);
  return details;
}
function renderWatchlist(){
  if(rendering||!dataCache)return;
  const details=ensureSection(),host=$('#v46Watchlist');if(!details||!host)return;
  rendering=true;
  try{
    const store=readStore(),entries=sortEntries(Object.values(store.items||{}));
    const players=entries.map(e=>currentPlayer(e.player_id)),hot=players.filter(p=>p.status.key==='opportunity').length,rising=players.filter(p=>valid(p.trendPct)&&Number(p.trendPct)>0).length,total=players.reduce((s,p)=>s+(num(p.marketValue)||0),0);
    const count=$('#v46WatchCount');if(count){count.textContent=String(entries.length);count.classList.toggle('hot',hot>0)}
    if(!entries.length){
      host.innerHTML=`<div class="v46-empty"><span>☆</span><strong>Aún no sigues a ningún jugador</strong><small>Marca la estrella en una ficha o directamente en el radar de cláusulas.</small></div>`;
      details.open=false;
      return;
    }
    if(!details.dataset.v46Opened){details.open=true;details.dataset.v46Opened='1'}
    host.innerHTML=`<div class="v46-head"><div><span>SEGUIMIENTO PERSONAL</span><h3>Tu watchlist</h3></div><small>${entries.length} jugador${entries.length===1?'':'es'}</small></div>
      <div class="v46-summary">
        <div><span>Seguidos</span><strong>${entries.length}</strong></div>
        <div><span>Oportunidad</span><strong class="${hot?'up':''}">${hot}</strong></div>
        <div><span>Subiendo</span><strong>${rising}</strong></div>
        <div><span>VM conjunto</span><strong>${money(total)}</strong></div>
      </div>
      <div class="v46-list">${entries.map(watchedCard).join('')}</div>`;
  }finally{rendering=false}
}
function syncStars(){
  const store=readStore(),items=store.items||{};
  for(const node of $$('[data-v46-star]')){
    const active=!!items[String(node.dataset.v46Star)],state=active?'1':'0';
    node.classList.toggle('active',active);
    if(node.classList.contains('v46-radar-star')){
      const text=active?'★':'☆';if(node.textContent!==text)node.textContent=text;
    }
    if(node.classList.contains('v46-profile-star')&&node.dataset.v46State!==state){
      node.dataset.v46State=state;
      node.innerHTML=`<span>${active?'★':'☆'}</span><small>${active?'Siguiendo':'Seguir'}</small>`;
    }
    node.setAttribute('aria-pressed',String(active));
  }
  for(const card of $$('[data-v40-player]'))card.classList.toggle('v46-starred',!!items[String(card.dataset.v40Player)]);
}
function decorateProfiles(root=document){
  const nodes=[];
  if(root.matches?.('.v39-player-shell[data-v39-profile]'))nodes.push(root);
  nodes.push(...(root.querySelectorAll?.('.v39-player-shell[data-v39-profile]')||[]));
  for(const article of nodes){
    const id=String(article.dataset.v39Profile||'');if(!id)continue;
    let star=article.querySelector('.v46-profile-star');
    if(!star){
      star=document.createElement('button');star.type='button';star.className='v46-profile-star';star.dataset.v46Star=id;star.setAttribute('aria-label','Añadir o quitar de la watchlist');
      const pills=article.querySelector('.v39-pills'),hero=article.querySelector('.v39-hero');if(pills)pills.appendChild(star);else if(hero)hero.appendChild(star);
    }else star.dataset.v46Star=id;
  }
}
function decorateRadar(root=document){
  const nodes=[];
  if(root.matches?.('[data-v40-player]'))nodes.push(root);
  nodes.push(...(root.querySelectorAll?.('[data-v40-player]')||[]));
  for(const card of nodes){
    const id=String(card.dataset.v40Player||'');if(!id)continue;
    if(!card.querySelector('.v46-radar-star')){
      const star=document.createElement('span');star.className='v46-radar-star';star.dataset.v46Star=id;star.setAttribute('role','button');star.setAttribute('tabindex','0');star.setAttribute('aria-label','Añadir o quitar de la watchlist');card.appendChild(star);
    }
  }
}
function decorate(root=document){decorateProfiles(root);decorateRadar(root);syncStars()}
function openProfile(id){
  id=String(id||'').trim();if(!id)return;
  const bridge=document.createElement('span');bridge.className='v36-match v46-profile-bridge';
  const target=document.createElement('button');target.type='button';target.dataset.v38PlayerId=id;
  bridge.appendChild(target);document.body.appendChild(bridge);target.click();setTimeout(()=>bridge.remove(),0);
}
function openWatchlist(){
  $('.nav-tab[data-screen-target="more"]')?.click();
  setTimeout(()=>{const d=ensureSection();if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'})}},80);
}
function renderHomeAlert(){
  $('#v46WatchAlert')?.remove();
  const store=readStore(),entries=Object.values(store.items||{});if(!entries.length||!dataCache)return;
  const hot=entries.map(e=>currentPlayer(e.player_id)).filter(p=>p.status.key==='opportunity');
  if(!hot.length)return;
  const home=$('.screen[data-screen="home"]');if(!home)return;
  const card=document.createElement('button');card.type='button';card.id='v46WatchAlert';card.className='v46-home-alert';card.dataset.v46OpenWatchlist='1';
  card.innerHTML=`<span class="v46-alert-star">★</span><span><small>WATCHLIST</small><strong>${hot.length===1?`${esc(hot[0].name)} está en oportunidad`:`${hot.length} seguidos están en oportunidad`}</strong><em>El radar de cláusulas ha elevado la señal.</em></span><b>›</b>`;
  const radar=$('#v40ClauseAlert');if(radar)radar.insertAdjacentElement('afterend',card);else home.querySelector('.action-card')?.insertAdjacentElement('afterend',card);
}
async function rerender(force=false){
  await ensure(force);ensureSection();renderWatchlist();decorate();renderHomeAlert();
}
function queueDecorate(){
  if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()});
}
function bind(){
  document.addEventListener('click',e=>{
    const star=e.target.closest?.('[data-v46-star]');
    if(star){e.preventDefault();e.stopImmediatePropagation();toggleWatch(star.dataset.v46Star);return}
    const open=e.target.closest?.('[data-v46-open]');
    if(open){e.preventDefault();e.stopImmediatePropagation();openProfile(open.dataset.v46Open);return}
    const watch=e.target.closest?.('[data-v46-open-watchlist]');
    if(watch){e.preventDefault();e.stopImmediatePropagation();openWatchlist()}
  },true);
  document.addEventListener('keydown',e=>{
    const star=e.target.closest?.('.v46-radar-star[data-v46-star]');if(!star||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();toggleWatch(star.dataset.v46Star);
  },true);
  window.addEventListener('storage',e=>{if(e.key===STORE_KEY){renderWatchlist();decorate();renderHomeAlert()}});
  window.addEventListener('fantasy:ready',()=>setTimeout(()=>rerender(true),120));
  window.addEventListener('focus',()=>rerender(true));
  new MutationObserver(mutations=>{
    for(const m of mutations)for(const node of m.addedNodes)if(node.nodeType===1)decorate(node);
    queueDecorate();
  }).observe(document.body,{childList:true,subtree:true});
}
async function init(){
  bind();await rerender(false);setTimeout(()=>rerender(false),700);setInterval(()=>rerender(true),240000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
