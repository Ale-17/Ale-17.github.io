(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const arr=v=>Array.isArray(v)?v:[];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
const norm=v=>clean(v).toLocaleLowerCase('es-ES');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=v=>{const x=num(v),a=Math.abs(x),sign=x<0?'−':'';if(a>=1e6)return`${sign}${(a/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;if(a>=1e3)return`${sign}${Math.round(a/1e3).toLocaleString('es-ES')}k`;return`${sign}${Math.round(a).toLocaleString('es-ES')} €`};
const pct=v=>`${(num(v)*100).toLocaleString('es-ES',{maximumFractionDigits:0})}%`;
let latest=null,lineup=null,catalog={players:{}},insights={by_key:{}},queued=false;

async function get(path){try{const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
function transfers(){return arr(latest?.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T')))}
function transferKey(t){return [String(t?.created||''),clean(t?.from),clean(t?.to),String(Math.round(num(t?.price)))].join('|')}
function clauseManagers(){return arr(latest?.member_clause_snapshots)}
function clauseManager(name){return clauseManagers().find(x=>norm(x.name)===norm(name))||null}
function leagueUsers(){return arr(latest?.league_users)}
function leagueUser(name){return leagueUsers().find(x=>norm(x.name)===norm(name))||null}
function rivalBalance(name){return arr(latest?.estimated_rival_balances).find(x=>norm(x.name)===norm(name))||null}
function playerCatalog(id){return catalog?.players?.[String(id)]||null}
function imageFor(id){return playerCatalog(id)?.image_url||lineup?.player_media?.[String(id)]||`https://cdn-mister.mundodeportivo.com/file/cdn-common/players/${encodeURIComponent(String(id))}.png`}
function playerById(id){return [...arr(latest?.my_team),...arr(latest?.market_players)].find(p=>String(p.player_id)===String(id))||null}
function playerNameById(id){return clean(playerById(id)?.name||playerCatalog(id)?.name||'')}
function acquisitionResolution(t){
  if(norm(t?.from)!=='mister'||norm(t?.to)==='mister')return null;
  const manager=clauseManager(t.to);if(!manager)return null;
  const exact=arr(manager.clauses).filter(p=>Math.round(num(p.acquisition_cost))===Math.round(num(t.price))&&String(p.investment_ledger_episode||'').includes(String(t.created||'')));
  if(exact.length===1)return{player_id:String(exact[0].player_id),name:clean(exact[0].name),method:'exact_acquisition_ledger_episode',confidence:'exact'};
  return null;
}
function resolvedTransfer(t){
  const r=t?.player_resolution||{},direct=clean(t?.player||t?.player_name||r?.player_name||r?.resolved_player_name||r?.name);
  const fromFile=insights?.by_key?.[transferKey(t)];
  if(fromFile?.name)return{player_id:fromFile.player_id?String(fromFile.player_id):null,name:clean(fromFile.name),method:fromFile.method,confidence:fromFile.confidence};
  if(direct)return{player_id:t?.player_id?String(t.player_id):r?.player_id?String(r.player_id):null,name:direct,method:r?.method||'feed',confidence:r?.confidence||'exact'};
  const acq=acquisitionResolution(t);if(acq)return acq;
  if(t?.player_id){const name=playerNameById(t.player_id);if(name)return{player_id:String(t.player_id),name,method:'player_id_catalog',confidence:'high'}}
  const candidates=arr(r?.candidate_players).map(clean).filter(Boolean);if(candidates.length===1)return{player_id:null,name:candidates[0],method:'single_candidate',confidence:'high'};
  return null;
}
function managerNames(){return leagueUsers().map(x=>clean(x.name)).filter(Boolean)}
function isManager(name){return managerNames().some(x=>norm(x)===norm(name))}

function decorateFeed(selector,limit){
  if(!latest)return;const host=$(selector);if(!host)return;const data=transfers().slice(0,limit),rows=[...host.querySelectorAll('.feed-row')];
  rows.forEach((row,i)=>{
    const t=data[i];if(!t)return;const key=transferKey(t);if(row.dataset.v18Key===key)return;
    const res=resolvedTransfer(t),copy=row.querySelector('.feed-copy'),title=copy?.querySelector('strong'),icon=row.querySelector('.feed-icon');
    if(title){
      if(res?.name)title.textContent=res.name;
      else title.textContent=norm(t.from)==='mister'?`Fichaje de ${clean(t.to)||'manager'}`:norm(t.to)==='mister'?`Venta de ${clean(t.from)||'manager'}`:'Traspaso';
    }
    const id=res?.player_id;if(id&&icon){
      const img=new Image();img.alt=res?.name||'';img.loading='lazy';img.referrerPolicy='no-referrer';img.onload=()=>{icon.className='feed-icon feed-player-photo';icon.textContent='';icon.appendChild(img);const badge=document.createElement('span');badge.className='feed-transfer-badge';badge.textContent=norm(t.from)==='mister'?'+':norm(t.to)==='mister'?'−':'↔';icon.appendChild(badge)};img.onerror=()=>{};img.src=imageFor(id);
    }
    if(copy){
      copy.querySelectorAll('.v18-feed-bids').forEach(x=>x.remove());
      const bids=arr(t.other_bids).map(b=>({name:clean(b.name||b.manager_name||b.manager),bid:num(b.bid??b.amount??b.bid_amount??b.price)})).filter(b=>b.name&&b.bid>0).sort((a,b)=>b.bid-a.bid);
      if(bids.length){
        const wrap=document.createElement('div');wrap.className='v18-feed-bids';
        const button=document.createElement('button');button.type='button';button.className='v18-feed-bids__toggle';button.textContent=`${bids.length} ${bids.length===1?'puja rival':'pujas rivales'} ▾`;
        const panel=document.createElement('div');panel.className='v18-feed-bids__panel hidden';
        const winner=clean(t.to),entries=[{name:winner,bid:num(t.price),winner:true},...bids.map(b=>({...b,winner:false}))].sort((a,b)=>b.bid-a.bid);
        panel.innerHTML=entries.map(b=>`<div class="v18-feed-bid ${b.winner?'winner':''}"><span>${b.winner?'✓ ':''}${esc(b.name)}</span><strong>${compact(b.bid)}</strong></div>`).join('');
        button.addEventListener('click',e=>{e.stopPropagation();panel.classList.toggle('hidden');button.textContent=`${bids.length} ${bids.length===1?'puja rival':'pujas rivales'} ${panel.classList.contains('hidden')?'▾':'▴'}`});
        wrap.append(button,panel);copy.appendChild(wrap);
      }
    }
    row.dataset.v18Key=key;
  });
}

function bidAnalytics(){
  const stats={};
  const ensure=name=>{const key=clean(name);return stats[key]||(stats[key]={name:key,attempts:0,wins:0,losses:0,competitiveWins:0,soloWins:0,overbidTotal:0,overbidMax:0,lostGapTotal:0,lostGapCount:0,maxBid:0,totalWonSpend:0,recent:[]})};
  const seen=new Set();
  transfers().forEach(t=>{
    if(norm(t.from)!=='mister'||!isManager(t.to))return;const key=transferKey(t);if(seen.has(key))return;seen.add(key);
    const winner=clean(t.to),price=num(t.price),res=resolvedTransfer(t),losers=arr(t.other_bids).map(b=>({name:clean(b.name||b.manager_name||b.manager),bid:num(b.bid??b.amount??b.bid_amount??b.price)})).filter(b=>isManager(b.name)&&b.bid>0);
    const ws=ensure(winner);ws.attempts++;ws.wins++;ws.totalWonSpend+=price;ws.maxBid=Math.max(ws.maxBid,price);ws.recent.push({won:true,price,player:res?.name||'Jugador',created:t.created,against:losers.length});
    if(losers.length){const second=Math.max(...losers.map(x=>x.bid));const margin=Math.max(0,price-second);ws.competitiveWins++;ws.overbidTotal+=margin;ws.overbidMax=Math.max(ws.overbidMax,margin)}else ws.soloWins++;
    losers.forEach(b=>{const s=ensure(b.name);s.attempts++;s.losses++;s.maxBid=Math.max(s.maxBid,b.bid);s.lostGapTotal+=Math.max(0,price-b.bid);s.lostGapCount++;s.recent.push({won:false,price:b.bid,winnerPrice:price,player:res?.name||'Jugador',created:t.created,against:losers.length})});
  });
  Object.values(stats).forEach(s=>s.recent.sort((a,b)=>new Date(String(b.created).replace(' ','T'))-new Date(String(a.created).replace(' ','T'))));
  return stats;
}
function managerMoves(name){
  const rows=transfers().filter(t=>norm(t.from)===norm(name)||norm(t.to)===norm(name));
  const purchases=rows.filter(t=>norm(t.from)==='mister'&&norm(t.to)===norm(name));
  const sales=rows.filter(t=>norm(t.to)==='mister'&&norm(t.from)===norm(name));
  return{rows,purchases,sales,buySpend:purchases.reduce((s,t)=>s+num(t.price),0),saleIncome:sales.reduce((s,t)=>s+num(t.price),0)};
}
function renderBidRadar(){
  const host=$('#bidList');if(!host||!latest)return;const stamp=String(latest.captured_at||'');if(host.dataset.v18===stamp)return;
  const details=host.closest('details');const heading=details?.querySelector('summary span:first-child');if(heading)heading.textContent='Radar de pujas';
  const stats=bidAnalytics(),rows=Object.values(stats).sort((a,b)=>b.attempts-a.attempts||b.wins-a.wins),competitive=rows.reduce((s,x)=>s+x.competitiveWins,0),overbid=rows.reduce((s,x)=>s+x.overbidTotal,0),ale=rows.find(x=>norm(x.name)==='ale');
  host.className='v18-bid-radar';
  host.innerHTML=`<div class="v18-bid-note">La “sobrepuja detectada” es la diferencia entre la puja ganadora y la mejor puja rival conocida. Es una medida de margen pagado, no una garantía de que todo ese importe fuera evitable.</div><div class="v18-bid-summary"><div><span>Subastas competitivas</span><strong>${competitive}</strong></div><div><span>Margen sobre 2ª puja</span><strong>${compact(overbid)}</strong></div><div><span>Tu ratio de victorias</span><strong>${ale?.attempts?pct(ale.wins/ale.attempts):'—'}</strong></div></div>${rows.map(s=>{
    const wr=s.attempts?s.wins/s.attempts:0,avg=s.competitiveWins?s.overbidTotal/s.competitiveWins:0,lost=s.lostGapCount?s.lostGapTotal/s.lostGapCount:0;
    return `<details class="v18-bid-manager"><summary><div><strong>${esc(s.name)}</strong><small>${s.attempts} participaciones · ${s.wins} ganadas · ${s.losses} perdidas</small></div><span>${pct(wr)}</span></summary><div class="v18-bid-metrics"><div><span>Win rate</span><strong>${pct(wr)}</strong></div><div><span>Sobrepuja detectada</span><strong>${compact(s.overbidTotal)}</strong></div><div><span>Media sobre 2ª</span><strong>${s.competitiveWins?compact(avg):'—'}</strong></div><div><span>Déficit medio al perder</span><strong>${s.lostGapCount?compact(lost):'—'}</strong></div><div><span>Puja máxima</span><strong>${compact(s.maxBid)}</strong></div><div><span>Victorias sin rival</span><strong>${s.soloWins}</strong></div></div><div class="v18-bid-recent">${s.recent.slice(0,5).map(r=>`<div><span>${r.won?'✓':'×'} ${esc(r.player)}</span><strong>${compact(r.price)}</strong></div>`).join('')}</div></details>`
  }).join('')}`;
  host.dataset.v18=stamp;
}

function capacityFor(name){const b=rivalBalance(name),u=leagueUser(name),cash=num(b?.usable_estimated_balance??b?.estimated_balance??b?.balance),team=num(u?.displayed_euro_value),capacity=num(b?.remaining_debt_capacity_if_estimate_were_true)||cash+team*.25;return{row:b,user:u,cash,team,capacity}}
function threatFor(name){const c=capacityFor(name),s=bidAnalytics()[clean(name)]||{},wr=s.attempts?s.wins/s.attempts:0;if(c.capacity>=20000000||(c.capacity>=16000000&&wr>=.5))return{label:'Amenaza alta',kind:'high'};if(c.capacity>=12000000||s.attempts>=12)return{label:'Amenaza media',kind:'mid'};return{label:'Amenaza baja',kind:'low'}}
function profileFor(name){
  const s=bidAnalytics()[clean(name)]||{attempts:0,wins:0,competitiveWins:0,overbidTotal:0,totalWonSpend:0},m=managerMoves(name),cm=clauseManager(name),c=capacityFor(name),players=num(cm?.roster_cards_detected),avgBuy=s.wins?s.totalWonSpend/s.wins:0,wr=s.attempts?s.wins/s.attempts:0;
  let label='Gestor equilibrado',text='Mezcla compras y conservación sin una señal extrema dominante.';
  if(m.purchases.length>=12&&m.sales.length>=7){label='Trader de rotación';text='Mueve mucho la plantilla, compra volumen y recicla capital con ventas frecuentes.'}
  else if(avgBuy>=6000000&&m.purchases.length>=5){label='Cazador de estrellas';text='Concentra bastante capital en fichajes caros y acepta inmovilizar dinero por calidad.'}
  else if(wr>=.55&&s.competitiveWins>=3&&(s.overbidTotal/Math.max(1,s.competitiveWins))>=200000){label='Pujador agresivo';text='Gana muchas subastas y suele dejar margen apreciable sobre la segunda puja conocida.'}
  else if(s.attempts>=12&&wr<.35){label='Pujador persistente';text='Participa mucho, pero convierte pocas pujas en fichajes; suele quedarse cerca sin rematar.'}
  else if(players>=17&&c.team>=60000000){label='Acumulador de patrimonio';text='Prioriza una plantilla grande y valiosa; su fuerza está más en activos que en caja.'}
  else if(num(cm?.active_clause_balance_investment)>=1000000){label='Constructor defensivo';text='Dedica una parte relevante del saldo a blindar cláusulas y reducir riesgo de robo.'}
  return{label,text,avgBuy,wr};
}
function rivalSheet(name){
  const u=leagueUser(name),cm=clauseManager(name),c=capacityFor(name),s=bidAnalytics()[clean(name)]||{attempts:0,wins:0,losses:0,competitiveWins:0,overbidTotal:0,totalWonSpend:0},moves=managerMoves(name),profile=profileFor(name),threat=threatFor(name),rank=[...leagueUsers()].sort((a,b)=>num(b.displayed_points)-num(a.displayed_points)).findIndex(x=>norm(x.name)===norm(name))+1,pts=num(u?.displayed_points),players=num(cm?.roster_cards_detected),eff=c.team?pts/(c.team/10000000):0;
  const recent=moves.rows.slice(0,6).map(t=>{const r=resolvedTransfer(t),buy=norm(t.from)==='mister'&&norm(t.to)===norm(name),sale=norm(t.to)==='mister'&&norm(t.from)===norm(name);return `<div class="v18-rival-move"><span>${buy?'+':sale?'−':'↔'} ${esc(r?.name||'Movimiento')}</span><strong>${compact(t.price)}</strong></div>`}).join('');
  return `<div class="v18-rival-sheet"><span class="section-kicker">PERFIL RIVAL</span><h2>${esc(name)}</h2><div class="v18-rival-tags"><span>${esc(profile.label)}</span><span class="threat-${threat.kind}">${esc(threat.label)}</span></div><p>${esc(profile.text)}</p><div class="v18-rival-grid"><div><span>Puesto</span><strong>#${rank||'—'}</strong></div><div><span>Puntos</span><strong>${pts}</strong></div><div><span>Jugadores</span><strong>${players||'—'}</strong></div><div><span>Valor equipo</span><strong>${compact(c.team)}</strong></div><div><span>Saldo estimado</span><strong>${compact(c.cash)}</strong></div><div><span>Capacidad máx.</span><strong>${compact(c.capacity)}</strong></div></div><div class="v18-rival-section"><h3>Comportamiento de puja</h3><div class="v18-rival-grid compact"><div><span>Participaciones</span><strong>${s.attempts}</strong></div><div><span>Ganadas</span><strong>${s.wins}</strong></div><div><span>Win rate</span><strong>${s.attempts?pct(s.wins/s.attempts):'—'}</strong></div><div><span>Sobrepuja</span><strong>${compact(s.overbidTotal)}</strong></div></div></div><div class="v18-rival-section"><h3>Gestión</h3><div class="v18-rival-grid compact"><div><span>Compras Mister</span><strong>${moves.purchases.length}</strong></div><div><span>Ventas Mister</span><strong>${moves.sales.length}</strong></div><div><span>Pts / 10 M€</span><strong>${eff.toLocaleString('es-ES',{maximumFractionDigits:1})}</strong></div><div><span>Cláusulas subidas</span><strong>${num(cm?.raised_clause_players_detected)}</strong></div></div></div><div class="v18-rival-section"><h3>Últimos movimientos</h3><div class="v18-rival-moves">${recent||'<span class="muted-line">Sin movimientos recientes</span>'}</div></div></div>`
}
function openRival(name){const sheet=$('#playerSheet'),backdrop=$('#sheetBackdrop'),content=$('#sheetContent');if(!sheet||!backdrop||!content)return;content.innerHTML=rivalSheet(name);backdrop.classList.remove('hidden');sheet.classList.add('open');sheet.setAttribute('aria-hidden','false')}
function renderRivals(){
  const host=$('#rivalCapacity');if(!host||!latest)return;const stamp=String(latest.captured_at||'');if(host.dataset.v18!==stamp){
    const names=managerNames().filter(n=>norm(n)!=='ale').sort((a,b)=>capacityFor(b).capacity-capacityFor(a).capacity);
    host.className='v18-rival-capacity';host.innerHTML=names.map(name=>{const c=capacityFor(name),t=threatFor(name),p=profileFor(name),players=num(clauseManager(name)?.roster_cards_detected);return `<button type="button" class="v18-rival-row" data-rival="${esc(name)}"><div><strong>${esc(name)}</strong><small>${esc(p.label)} · ${players} jugadores · ${compact(c.cash)} saldo</small></div><div><strong>${compact(c.capacity)}</strong><small class="threat-${t.kind}">${esc(t.label)}</small></div></button>`}).join('');host.dataset.v18=stamp;
  }
  host.querySelectorAll('[data-rival]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>openRival(b.dataset.rival))});
  $$('#leagueTable .table-row').forEach(row=>{const name=clean(row.querySelector('.table-manager strong')?.textContent);if(!name||norm(name)==='ale'||row.dataset.v18Bound)return;row.dataset.v18Bound='1';row.classList.add('v18-rival-clickable');row.addEventListener('click',()=>openRival(name))});
}

function myClause(id){const me=clauseManager('Ale');return arr(me?.clauses).find(x=>String(x.player_id)===String(id))||null}
function daily(p){return num(p?.daily_market_change)}function weekly(p){return num(p?.weekly_market_change)}function points(p){return num(p?.displayed_points)}function value(p){return Math.max(1,num(p?.market_value))}
function dailyPct(p){return Number.isFinite(Number(p?.daily_market_change_pct))?Number(p.daily_market_change_pct):daily(p)/value(p)*100}
function weeklyPct(p){return Number.isFinite(Number(p?.weekly_market_change_pct))?Number(p.weekly_market_change_pct):weekly(p)/value(p)*100}
function starterIds(){return new Set(arr(lineup?.players).map(x=>String(x.player_id)))}
function protectionScore(p){return points(p)*4+Math.min(20,Math.max(-10,dailyPct(p)))*3+Math.min(50,Math.max(-30,weeklyPct(p)))*.5+Math.min(15,value(p)/1000000)*2+(starterIds().has(String(p.player_id))?8:0)+(norm(p.name).includes('lookman')?60:0)}
function protectionSet(){
  const rows=arr(latest?.my_team).map(p=>{const c=myClause(p.player_id),ratio=c&&value(p)?num(c.clause_value)/value(p):0,percent=num(c?.clause_percent);return{p,c,ratio,percent,score:protectionScore(p)}}).filter(x=>x.c&&x.percent<=50&&x.ratio<1.9&&((norm(x.p.name).includes('lookman'))||(value(x.p)>=7000000&&points(x.p)>=12&&daily(x.p)>0&&weekly(x.p)>=0)||(value(x.p)>=4000000&&points(x.p)>=15&&daily(x.p)>=80000&&weekly(x.p)>0))).sort((a,b)=>b.score-a.score);
  return new Set(rows.slice(0,3).map(x=>String(x.p.player_id)));
}
function teamDecision(p){
  const c=myClause(p.player_id),ratio=c&&value(p)?num(c.clause_value)/value(p):0,percent=num(c?.clause_percent),pos=Number(p.position||lineup?.roster_positions?.[String(p.player_id)]||0),posCount=arr(latest?.my_team).filter(x=>Number(x.position||lineup?.roster_positions?.[String(x.player_id)]||0)===pos).length,protect=protectionSet().has(String(p.player_id)),important=protectionScore(p)>=85||norm(p.name).includes('lookman');
  if(protect)return{kind:'protect',label:'PROTEGER',icon:'★',reason:`Sí gastaría en subir su cláusula ahora. Cláusula actual ${compact(c?.clause_value)} (${ratio?Math.round(ratio*100):'—'}% del VM).`};
  if(c&&important&&(percent>=100||ratio>=1.9))return{kind:'safe',label:'PROTEGIDO',icon:'🔒',reason:`Activo importante, pero su cláusula ya está suficientemente alta (${compact(c.clause_value)}). No gastaría más ahora.`};
  if(pos===1&&posCount<=1)return{kind:'hold',label:'MANTENER',icon:'✓',reason:'Es tu único portero: hay que conservarlo, pero eso no implica subir su cláusula.'};
  if(daily(p)<0&&weekly(p)<0&&points(p)<10)return{kind:'sell',label:'VENDER',icon:'↓',reason:'Caída diaria y semanal con poco respaldo de puntos.'};
  if(value(p)>=4500000&&daily(p)<50000&&points(p)<8)return{kind:'liquid',label:'LIQUIDEZ',icon:'€',reason:'Mucho capital inmovilizado para la rentabilidad y puntos actuales.'};
  const own=[...arr(latest?.my_team)].sort((a,b)=>protectionScore(b)-protectionScore(a)),idx=own.findIndex(x=>String(x.player_id)===String(p.player_id));if(idx>=Math.max(0,own.length-4)&&points(p)<10)return{kind:'liquid',label:'LIQUIDEZ',icon:'€',reason:'Está entre los activos de menor prioridad si necesitamos liberar caja.'};
  return{kind:'hold',label:'MANTENER',icon:'✓',reason:'No veo motivo suficiente para vender ni para gastar ahora en subir cláusula.'};
}
function renderTeamAdvice(){
  if(!latest)return;const host=$('#teamList');if(!host)return;host.querySelectorAll('.market-row').forEach(row=>{const id=row.dataset.playerId,p=playerById(id),line=row.querySelector('.decision-line');if(!id||!p||!line)return;let chip=line.querySelector('.v18-team-advice'),d=teamDecision(p);if(!chip){chip=document.createElement('span');chip.className='v18-team-advice';line.appendChild(chip)}chip.className=`v18-team-advice v18-advice-${d.kind}`;chip.innerHTML=`<b>${esc(d.icon)}</b>${esc(d.label)}`;chip.title=d.reason;row.dataset.v18Decision=d.kind;if(!row.dataset.v18Sheet){row.dataset.v18Sheet='1';row.addEventListener('click',()=>setTimeout(()=>enhanceOwnPlayerSheet(id),40))}});
  const old=$('.screen[data-screen="team"] .advice-summary');if(old)old.classList.add('v18-hide-old-summary');
  const section=$('.roster-section'),list=$('#teamList');if(section&&list){let summary=section.querySelector('.v18-team-summary');if(!summary){summary=document.createElement('div');summary.className='v18-team-summary';list.before(summary)}const counts={protect:0,safe:0,hold:0,liquid:0,sell:0};arr(latest.my_team).forEach(p=>{const k=teamDecision(p).kind;counts[k]=(counts[k]||0)+1});summary.innerHTML=`<div class="v18-team-summary__chips"><span class="v18-advice-protect">★ ${counts.protect} PROTEGER</span><span class="v18-advice-safe">🔒 ${counts.safe} PROTEGIDOS</span><span class="v18-advice-hold">✓ ${counts.hold} MANTENER</span><span class="v18-advice-liquid">€ ${counts.liquid} LIQUIDEZ</span><span class="v18-advice-sell">↓ ${counts.sell} VENDER</span></div><small>PROTEGER = sí recomiendo gastar ahora en subir esa cláusula.</small>`}
  const acct=latest.account_state;if(acct&&$('#teamCount'))$('#teamCount').textContent=`${num(acct.squad_count)}/${num(acct.squad_limit)} jugadores`;
  $$('.pitch-player').forEach(el=>{const name=clean(el.querySelector('.pitch-player__name')?.textContent),p=arr(latest.my_team).find(x=>norm(x.name)===norm(name));if(!p)return;let dot=el.querySelector('.v18-pitch-dot');if(!dot){dot=document.createElement('span');dot.className='v18-pitch-dot';el.appendChild(dot)}const d=teamDecision(p);dot.className=`v18-pitch-dot dot-${d.kind}`;dot.title=`${d.label}: ${d.reason}`});
}
function enhanceOwnPlayerSheet(id){const p=playerById(id),content=$('#sheetContent');if(!p||!content)return;const c=myClause(id),d=teamDecision(p),old=content.querySelector('.v18-own-strategy');if(old)old.remove();const bids=content.querySelector('.sheet-bids');if(bids)bids.style.display='none';const block=document.createElement('div');block.className='v18-own-strategy';const ratio=c&&value(p)?num(c.clause_value)/value(p):0;block.innerHTML=`<div class="v18-own-strategy__head"><span class="v18-team-advice v18-advice-${d.kind}"><b>${esc(d.icon)}</b>${esc(d.label)}</span></div><p>${esc(d.reason)}</p><div class="v18-rival-grid compact"><div><span>Cláusula</span><strong>${c?compact(c.clause_value):'—'}</strong></div><div><span>Cláusula / VM</span><strong>${ratio?`${Math.round(ratio*100)}%`:'—'}</strong></div><div><span>Nivel subido</span><strong>${c?num(c.clause_level):'—'}</strong></div><div><span>Invertido en cláusula</span><strong>${c?compact(c.active_balance_investment):'—'}</strong></div></div>`;content.appendChild(block)}

function render(){decorateFeed('#homeFeed',6);decorateFeed('#activityList',30);renderBidRadar();renderRivals();renderTeamAdvice()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
async function load(){const [l,c,i,d]=await Promise.all([get('./data/current_lineup.json'),get('./data/player_catalog.json'),get('./data/transfer_insights.json'),get('./data/latest.json')]);if(l)lineup=l;if(c)catalog=c;if(i)insights=i;if(d)latest=d;render()}
window.addEventListener('DOMContentLoaded',()=>{setTimeout(load,120);setTimeout(queue,700);setTimeout(queue,1500);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true})});
})();
