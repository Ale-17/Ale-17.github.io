(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let lineup=null, latest=null, renderQueued=false, retryTimer=null;
const arr=v=>Array.isArray(v)?v:[];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).toLocaleLowerCase('es-ES');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const compact=v=>{const x=num(v),a=Math.abs(x),sign=x<0?'−':'';if(a>=1e6)return`${sign}${(a/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;if(a>=1e3)return`${sign}${Math.round(a/1e3).toLocaleString('es-ES')}k`;return`${sign}${Math.round(a)} €`};
function normalizeAsset(value){
  let v=String(value||'').trim();if(!v)return null;
  if(v.startsWith('cdn://'))return `https://cdn-mister.mundodeportivo.com/file/${v.slice(6).replace(/^\/+/, '')}`;
  const broken=v.match(/\/cdn:\/(.+)$/);if(broken)return `https://cdn-mister.mundodeportivo.com/file/${broken[1].replace(/^\/+/, '')}`;
  return v;
}
function playerData(id){
  const own=arr(latest?.my_team).find(p=>String(p.player_id)===String(id));
  const market=arr(latest?.market_players).find(p=>String(p.player_id)===String(id));
  return own||market?{...(market||{}),...(own||{})}:null;
}
function playerImage(id,p=null){
  const key=String(id||p?.player_id||'');if(!key)return null;
  return normalizeAsset(lineup?.player_media?.[key]||lineup?.players?.find(x=>String(x.player_id)===key)?.image_url||p?.image_url)||`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(key)}.png`;
}
function logoFor(id){return normalizeAsset(lineup?.player_team_logos?.[String(id)]||lineup?.players?.find(p=>String(p.player_id)===String(id))?.team_logo_url)}
function positionFor(id,row){const p=lineup?.roster_positions?.[String(id)]||lineup?.players?.find(x=>String(x.player_id)===String(id))?.position||playerData(id)?.position;return Number(p)||({'PT':1,'DF':2,'MC':3,'DL':4}[row?.querySelector('.position-tag')?.textContent?.trim()]||null)}
function pointsFor(row){return row?.querySelector('.score-pill')?.textContent?.trim()||'0'}
function daily(p){return num(p?.daily_market_change)}
function weekly(p){return num(p?.weekly_market_change)}
function points(p){return num(p?.displayed_points)}
function value(p){return Math.max(num(p?.market_value),1)}
function dailyPct(p){return Number.isFinite(Number(p?.daily_market_change_pct))?Number(p.daily_market_change_pct):daily(p)/value(p)*100}
function weeklyPct(p){return Number.isFinite(Number(p?.weekly_market_change_pct))?Number(p.weekly_market_change_pct):weekly(p)/value(p)*100}
function investmentScore(p){
  if(!p)return 50;let s=42;
  s+=clamp(dailyPct(p),-8,12)*2.8;
  s+=clamp(weeklyPct(p),-25,50)*.45;
  s+=clamp(points(p),0,18)*1.15;
  s+=clamp(daily(p)/100000,-1.5,1.8)*8;
  if(daily(p)<0)s-=12;if(weekly(p)<0)s-=8;
  return Math.round(clamp(s,0,100));
}
function marketAdvice(p){
  const score=investmentScore(p),d=daily(p),w=weekly(p);
  if(d<0||w<0||score<42)return{kind:'bad',label:'PASAR',icon:'×',reason:'Tendencia negativa o eficiencia insuficiente',score};
  if(score>=88)return{kind:'top',label:'IR A POR ÉL',icon:'🔥',reason:'Mejor combinación de revalorización, eficiencia y puntos',score};
  if(score>=64)return{kind:'good',label:'RECOMENDADO',icon:'✓',reason:'Señales positivas de mercado y rendimiento',score};
  if(score>=53)return{kind:'watch',label:'VIGILAR',icon:'👀',reason:'Interesante, pero sin ventaja suficiente para forzar la puja',score};
  return{kind:'neutral',label:'NO PRIORITARIO',icon:'·',reason:'Hay mejores usos del capital en este mercado',score};
}
function startingIds(){return new Set(arr(lineup?.players).map(p=>String(p.player_id)))}
function teamScoreRows(){return arr(latest?.my_team).map(p=>({p,score:investmentScore(p)})).sort((a,b)=>b.score-a.score)}
function teamAdvice(p){
  if(!p)return{kind:'hold',label:'MANTENER',icon:'✓',reason:'Sin señal suficiente para moverlo'};
  const rows=teamScoreRows(),idx=Math.max(0,rows.findIndex(x=>String(x.p.player_id)===String(p.player_id))),n=Math.max(rows.length,1);
  const top=Math.max(4,Math.ceil(n*.30)),bottom=Math.max(3,Math.ceil(n*.20));
  const pos=Number(lineup?.roster_positions?.[String(p.player_id)]||lineup?.players?.find(x=>String(x.player_id)===String(p.player_id))?.position||p.position||0);
  const posCount=arr(latest?.my_team).filter(x=>Number(lineup?.roster_positions?.[String(x.player_id)]||x.position||0)===pos).length;
  const starter=startingIds().has(String(p.player_id)),name=norm(p.name);
  if(name.includes('lookman'))return{kind:'protect',label:'PROTEGER',icon:'★',reason:'Estrella protegida por estrategia'};
  if(pos===1&&posCount<=1)return{kind:'protect',label:'PROTEGER',icon:'★',reason:'Único portero disponible: no dejar la posición vacía'};
  if(daily(p)<0&&weekly(p)<0&&points(p)<10)return{kind:'sell',label:'VENDER',icon:'↓',reason:'Caída de valor y poco respaldo deportivo'};
  if(value(p)>=4500000&&daily(p)<50000&&points(p)<8)return{kind:'liquid',label:'VENDER SI HACE FALTA',icon:'€',reason:'Mucho capital para una rentabilidad actual limitada'};
  if(idx>=n-bottom&&points(p)<10){
    if(daily(p)<=0||weekly(p)<=0)return{kind:'sell',label:'VENDER',icon:'↓',reason:'Entre los activos menos eficientes de la plantilla'};
    return{kind:'liquid',label:'VENDER SI HACE FALTA',icon:'€',reason:'Buen candidato para liberar liquidez sin tocar los mejores activos'};
  }
  if((idx<top&&points(p)>=9)||(starter&&idx<Math.ceil(n*.50)&&points(p)>=11))return{kind:'protect',label:'PROTEGER',icon:'★',reason:'Combina buen rendimiento deportivo y revalorización'};
  return{kind:'hold',label:'MANTENER',icon:'✓',reason:'Sigue aportando valor sin motivo claro de venta'};
}
function makeAdvice(advice){
  const chip=document.createElement('span');chip.className=`player-advice advice-${advice.kind}`;chip.dataset.kind=advice.kind;chip.dataset.label=advice.label;chip.title=advice.reason;chip.setAttribute('aria-label',`${advice.label}. ${advice.reason}`);chip.innerHTML=`<b>${esc(advice.icon)}</b>${esc(advice.label)}`;return chip;
}
function upgradePlayerPhoto(row){
  const id=row.dataset.playerId,photo=row.querySelector('.player-photo');if(!id||!photo||photo.querySelector('img'))return;
  const p=playerData(id),src=playerImage(id,p);if(!src)return;
  const img=new Image();img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onload=()=>{photo.querySelector('.player-initial')?.remove();if(!photo.querySelector('img'))photo.prepend(img)};img.onerror=()=>{};img.src=src;
}
function decorateLayout(row){
  const id=row.dataset.playerId;if(!id)return;const photo=row.querySelector('.player-photo');if(!photo)return;
  upgradePlayerPhoto(row);
  if(row.dataset.misterLayout==='1')return;
  const stack=document.createElement('div');stack.className='market-club-stack';const logo=logoFor(id),pos=positionFor(id,row);
  stack.innerHTML=`${logo?`<img class="club-badge" src="${esc(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="club-placeholder"></span>'}<span class="side-position pos-${pos||0}">${({1:'PT',2:'DF',3:'MC',4:'DL'})[pos]||'—'}</span><span class="side-points">${esc(pointsFor(row))}</span>`;
  row.insertBefore(stack,photo);row.dataset.misterLayout='1';
}
function decorateAdvice(row){
  if(!latest)return;const id=row.dataset.playerId,p=playerData(id);if(!id||!p)return;
  const isTeam=row.closest('.screen')?.dataset.screen==='team',advice=isTeam?teamAdvice(p):marketAdvice(p);
  const name=row.querySelector('.market-name');if(!name)return;
  let line=row.querySelector('.decision-line');if(!line){line=document.createElement('div');line.className='decision-line';line.style.cssText='margin:4px 0 1px;min-height:19px;display:flex;align-items:center';name.insertAdjacentElement('afterend',line)}
  let chip=line.querySelector('.player-advice');if(!chip){chip=makeAdvice(advice);line.appendChild(chip)}else if(chip.dataset.kind!==advice.kind||chip.dataset.label!==advice.label){chip.replaceWith(makeAdvice(advice))}
  row.dataset.advice=advice.kind;
  if(isTeam){
    const meta=row.querySelector('.market-meta-top span:first-child'),starter=startingIds().has(String(id));
    const listed=arr(latest.market_players).some(x=>String(x.player_id)===String(id)&&norm(x.owner_name)==='ale');
    const next=`Tu jugador · ${starter?'Titular':listed?'En venta':'Plantilla'}`;if(meta&&meta.textContent!==next)meta.textContent=next;
    const button=row.querySelector('.bid-button');if(button&&button.textContent!=='Ver')button.textContent='Ver';
  }
}
function decorateRows(){$$('.market-row').forEach(row=>{decorateLayout(row);decorateAdvice(row)})}
function transferRows(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created).replace(' ','T'))-new Date(String(a.created).replace(' ','T')))}
function transferId(t){return t?.player_id||t?.player_resolution?.player_id||null}
function decorateFeedList(selector,limit){
  if(!latest)return;const host=$(selector);if(!host)return;const rows=[...host.querySelectorAll('.feed-row')],data=transferRows().slice(0,limit);
  rows.forEach((row,i)=>{const t=data[i],id=transferId(t),icon=row.querySelector('.feed-icon');if(!t||!id||!icon||icon.dataset.playerId===String(id))return;
    const src=playerImage(id,playerData(id));if(!src)return;const marker=norm(t.from)==='mister'?'＋':norm(t.to)==='mister'?'−':'↔';
    const img=new Image();img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.style.cssText='width:100%;height:100%;object-fit:cover;object-position:center top;display:block';
    img.onload=()=>{icon.style.cssText='position:relative;width:42px;height:46px;padding:0;overflow:hidden;border-radius:10px;background:#191a23';icon.textContent='';icon.appendChild(img);const badge=document.createElement('span');badge.textContent=marker;badge.style.cssText='position:absolute;right:-1px;bottom:-1px;width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:#11131a;color:#35df82;border:1px solid #272a31;font-size:11px;font-weight:950';icon.appendChild(badge);icon.dataset.playerId=String(id)};img.onerror=()=>{};img.src=src;
  });
}
function decorateFeeds(){decorateFeedList('#homeFeed',6);decorateFeedList('#activityList',30)}
function decoratePitch(){
  if(!lineup)return;$$('.pitch-player').forEach(el=>{
    const name=clean(el.querySelector('.pitch-player__name')?.textContent),lp=arr(lineup.players).find(x=>clean(x.name)===name);if(!lp)return;
    const logo=logoFor(lp.player_id),portrait=el.querySelector('.pitch-player__portrait');if(logo&&portrait&&!el.querySelector('.pitch-club'))portrait.insertAdjacentHTML('beforeend',`<img class="pitch-club" src="${esc(logo)}" alt="">`);
    if(latest){const advice=teamAdvice(playerData(lp.player_id)),cls=`pitch-${advice.kind}`;['pitch-protect','pitch-hold','pitch-liquid','pitch-sell'].forEach(c=>{if(c!==cls)el.classList.remove(c)});el.classList.add(cls);let dot=el.querySelector('.pitch-advice-dot');if(!dot){dot=document.createElement('span');dot.className='pitch-advice-dot';el.appendChild(dot)}dot.title=advice.label}
  })
}
function header(){
  const ctx=lineup?.ui_context||{},strong=$('.brand-copy strong'),small=$('.brand-copy small'),mark=$('.brand-mark');if(strong&&ctx.community)strong.textContent=ctx.community;
  const sub=`${ctx.user_name||'Ale'} · Fantasy OS${ctx.credits!=null?` · ${ctx.credits} créditos`:''}`;if(small)small.textContent=sub;
  if(mark){const src=normalizeAsset(ctx.user_picture),fallback=(ctx.user_name||'Ale').trim().charAt(0).toUpperCase()||'A';if(src&&mark.dataset.avatarSrc!==src){const img=new Image();img.alt='';img.onload=()=>{mark.textContent='';mark.appendChild(img);mark.classList.add('has-avatar');mark.dataset.avatarSrc=src};img.onerror=()=>{mark.classList.remove('has-avatar');mark.textContent=fallback};img.src=src}else if(!src&&!mark.querySelector('img'))mark.textContent=fallback}
  const note=$('#lineupCaptureNote');if(note&&lineup?.status==='ok')note.classList.add('hidden');
}
function icons(){const svg={home:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/></svg>',market:'<svg viewBox="0 0 24 24"><path d="M5 5h14l-1 9H7z"/><path d="M8 5 9 2h6l1 3M8 19h.01M16 19h.01"/></svg>',team:'<svg viewBox="0 0 24 24"><path d="M7 4 4 7l2 4 2-1v10h8V10l2 1 2-4-3-3-3 2h-4z"/></svg>',table:'<svg viewBox="0 0 24 24"><path d="M8 3h8v3a4 4 0 0 1-8 0zM6 4H3v2a4 4 0 0 0 4 4M18 4h3v2a4 4 0 0 1-4 4M12 10v5M8 21h8M9 15h6v6H9z"/></svg>',more:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'};$$('.nav-tab').forEach(b=>{const icon=b.querySelector('.nav-icon'),key=b.dataset.screenTarget;if(icon&&svg[key])icon.innerHTML=svg[key]})}
function marketSummary(){
  if(!latest)return;const host=$('[data-screen="market"] .market-toolbar');if(!host)return;let box=$('#marketAdviceSummary');if(!box){box=document.createElement('div');box.id='marketAdviceSummary';box.className='advice-summary';host.insertAdjacentElement('afterend',box)}
  const free=arr(latest.market_players).filter(p=>String(p.owner_id)==='0'||norm(p.owner_name)==='libre'),counts={top:0,good:0,watch:0,bad:0,neutral:0};free.forEach(p=>counts[marketAdvice(p).kind]++);
  box.innerHTML=`<span class="summary-dot advice-top">🔥 ${counts.top} ir a por</span><span class="summary-dot advice-good">✓ ${counts.good} recomendados</span><span class="summary-dot advice-watch">👀 ${counts.watch} vigilar</span><span class="summary-dot advice-bad">× ${counts.bad} pasar</span>`;
}
function teamSummary(){
  if(!latest)return;const list=$('#teamList');if(!list)return;let box=$('#teamAdviceSummary');if(!box){box=document.createElement('div');box.id='teamAdviceSummary';box.className='advice-summary team-advice-summary';list.parentNode.insertBefore(box,list)}
  const counts={protect:0,hold:0,liquid:0,sell:0};arr(latest.my_team).forEach(p=>counts[teamAdvice(p).kind]++);
  box.innerHTML=`<span class="summary-dot advice-protect">★ ${counts.protect} proteger</span><span class="summary-dot advice-hold">✓ ${counts.hold} mantener</span><span class="summary-dot advice-liquid">€ ${counts.liquid} liquidez</span><span class="summary-dot advice-sell">↓ ${counts.sell} vender</span>`;
}
function homeDecision(){
  if(!latest)return;const free=arr(latest.market_players).filter(p=>String(p.owner_id)==='0'||norm(p.owner_name)==='libre').sort((a,b)=>investmentScore(b)-investmentScore(a)),best=free[0];if(!best)return;
  const a=marketAdvice(best),title=$('#decisionTitle'),copy=$('#decisionText'),kicker=$('.action-card .section-kicker');if(kicker)kicker.textContent=a.kind==='top'?'TOP DEL MERCADO':'RECOMENDACIÓN';if(title)title.textContent=a.kind==='top'?`Ve a por ${clean(best.name)}`:a.kind==='good'?`${clean(best.name)} merece puja`:`Vigila a ${clean(best.name)}`;if(copy)copy.textContent=`${a.label} · VM ${compact(best.market_value)} · ${points(best)} pts · ${daily(best)>=0?'+':''}${compact(daily(best))} hoy.`
}
function renderPolish(){header();decorateRows();decorateFeeds();decoratePitch();if(latest){marketSummary();teamSummary();homeDecision()}}
function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;renderPolish()})}
async function fetchJson(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return await r.json()}catch{return null}}
async function loadContext(){
  const [l,d]=await Promise.all([fetchJson('./data/current_lineup.json'),fetchJson('./data/latest.json')]);if(l)lineup=l;if(d)latest=d;renderPolish();
  if(!latest){clearTimeout(retryTimer);retryTimer=setTimeout(async()=>{const retry=await fetchJson('./data/latest.json');if(retry){latest=retry;renderPolish()}},700)}
}
window.addEventListener('DOMContentLoaded',()=>{icons();setTimeout(loadContext,60);setTimeout(queueRender,450);setTimeout(queueRender,1100);const obs=new MutationObserver(queueRender);obs.observe(document.body,{childList:true,subtree:true})});
})();
