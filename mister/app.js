(() => {
  'use strict';

  const state = { latest: null, series: null, marketSearch: '', marketSort: 'radar' };
  const $ = id => document.getElementById(id);
  const els = Object.fromEntries([
    'snapshotPill','refreshButton','heroTitle','heroSubtitle','decisionCard','kpiGrid','historyMeta','wealthNow','pointsNow','wealthChart','pointsChart','capacityList','qualityGrid','marketMeta','marketSearch','marketSort','marketHighlights','marketList','teamMeta','teamHighlights','teamList','offerList','listedPlayers','leagueTable','rivalList','activityList','bidList','clauseList','footerStatus'
  ].map(id => [id, $(id)]));

  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const numOrNull = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const arr = v => Array.isArray(v) ? v : [];
  const text = v => String(v ?? '').trim();
  const cleanName = v => text(v).replace(/\s*💥\s*/g, '').trim();
  const norm = v => cleanName(v).toLocaleLowerCase('es-ES');
  const esc = v => text(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const posLabel = p => ({1:'POR',2:'DEF',3:'MED',4:'DEL'}[Number(p)] || '—');
  const euro = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n(v));
  const compactEuro = v => {
    const value=n(v), sign=value<0?'−':'', abs=Math.abs(value);
    if(abs>=1_000_000) return `${sign}${(abs/1_000_000).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;
    if(abs>=1_000) return `${sign}${Math.round(abs/1_000).toLocaleString('es-ES')}k`;
    return `${sign}${Math.round(abs).toLocaleString('es-ES')} €`;
  };
  const signedEuro = v => `${n(v)>0?'+':n(v)<0?'−':''}${compactEuro(Math.abs(n(v)))}`;
  const tone = v => n(v)>0?'positive':n(v)<0?'negative':'neutral';
  const dateTime = v => { const d=new Date(v); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d); };

  function market(){ return arr(state.latest?.market_players); }
  function freeMarket(){ return market().filter(p => String(p.owner_id)==='0' || norm(p.owner_name)==='libre'); }
  function team(){ return arr(state.latest?.my_team); }
  function league(){ return arr(state.latest?.league_users); }
  function me(){ return league().find(u => norm(u.name)==='ale') || league()[0] || null; }
  function balance(){ return n(state.latest?.my_balance?.current_balance); }
  function futureBalance(){ return n(state.latest?.my_balance?.future_balance ?? state.latest?.my_balance?.current_balance); }
  function maxCapacity(){ return n(state.latest?.my_balance?.max_debt) || balance() + teamValue()*0.25; }
  function teamValue(){ const v=numOrNull(me()?.displayed_euro_value); return v ?? team().reduce((s,p)=>s+n(p.market_value),0); }
  function wealth(){ return balance()+teamValue(); }
  function positionOf(player){ const direct=numOrNull(player?.position); if(direct) return direct; const found=market().find(p=>String(p.player_id)===String(player?.player_id)); return numOrNull(found?.position); }
  function daily(p){ return n(p?.daily_market_change); }
  function weekly(p){ return n(p?.weekly_market_change); }
  function points(p){ return n(p?.displayed_points); }
  function playerValue(p){ return n(p?.market_value); }
  function rank(){ const rows=[...league()].sort((a,b)=>n(b.displayed_points)-n(a.displayed_points)||n(b.displayed_euro_value)-n(a.displayed_euro_value)); const i=rows.findIndex(u=>norm(u.name)==='ale'); return i<0?null:i+1; }
  function marketScore(p){ const value=Math.max(playerValue(p),1), dPct=daily(p)/value*100, wPct=weekly(p)/value*100; return Math.round(Math.max(0,Math.min(100,45+Math.max(-12,Math.min(12,dPct))*3+Math.max(-30,Math.min(60,wPct))*.55+Math.max(0,Math.min(20,points(p)))*1.2+(daily(p)>100000?7:0)))); }
  function teamScore(p){ return weekly(p)*.6+daily(p)*1.15+points(p)*50000; }
  function bidModel(p){ const value=playerValue(p), score=marketScore(p), premium=score>=80?.055:score>=65?.04:.025; return { value:Math.round(value*(1+premium*.35)), win:Math.round(value*(1+premium)), ceiling:Math.round(value*(1+premium*1.55)) }; }

  async function fetchJson(path){ const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }

  async function loadLatest(){
    setLoading(true);
    try{
      state.latest=await fetchJson('./data/latest.json');
      renderAll();
      loadSeriesLater();
    }catch(error){
      console.error(error);
      els.heroTitle.textContent='No se pudo cargar el snapshot';
      els.heroSubtitle.textContent=`Error: ${error.message}`;
      els.decisionCard.innerHTML='<div class="empty">La web está funcionando, pero latest.json no ha respondido.</div>';
      els.snapshotPill.textContent='Error de datos';
    }finally{ setLoading(false); }
  }

  async function loadSeriesLater(){
    try{ state.series=await fetchJson('./data/series.json'); renderCharts(); }
    catch(error){ console.warn('series.json',error); els.historyMeta.textContent='Histórico no disponible'; }
  }

  function setLoading(loading){ if(els.refreshButton){ els.refreshButton.disabled=loading; els.refreshButton.textContent=loading?'…':'↻'; } }

  function renderAll(){
    renderHeader(); renderDecision(); renderKpis(); renderCapacity(); renderQuality(); renderMarket(); renderTeam(); renderOffers(); renderLeague(); renderActivity(); renderBids(); renderClauses(); renderCharts();
  }

  function renderHeader(){
    const r=rank();
    els.heroTitle.textContent=r?`Ale va ${r}º en la liga`:'Fantasy OS';
    els.heroSubtitle.textContent=`${team().length} jugadores en plantilla · ${freeMarket().length} libres · ${league().length} managers capturados.`;
    els.snapshotPill.textContent=`${state.latest?.snapshot_finalized?'Finalizado':'Parcial'} · ${dateTime(state.latest?.captured_at)}`;
    els.footerStatus.textContent=`Snapshot ${dateTime(state.latest?.captured_at)} · ${state.latest?.source || 'Mister'}`;
  }

  function renderDecision(){
    const candidates=[...freeMarket()].sort((a,b)=>marketScore(b)-marketScore(a));
    const affordable=candidates.find(p=>bidModel(p).win<=Math.max(futureBalance(),0));
    const best=affordable || candidates[0];
    if(!best){ els.decisionCard.innerHTML='<div class="empty">No hay jugadores libres en este snapshot.</div>'; return; }
    const bid=bidModel(best), after=futureBalance()-bid.win;
    els.decisionCard.innerHTML=`<span class="eyebrow">Qué haría ahora</span><h3>${esc(cleanName(best.name))}</h3><p>Mejor oportunidad del radar local por momentum, puntos y precio. El informe de ChatGPT sigue siendo el criterio maestro.</p><div class="decision-stats"><div class="decision-stat"><span>VM</span><strong>${compactEuro(playerValue(best))}</strong></div><div class="decision-stat"><span>Puja ganar</span><strong>${compactEuro(bid.win)}</strong></div><div class="decision-stat"><span>Techo</span><strong>${compactEuro(bid.ceiling)}</strong></div><div class="decision-stat"><span>Saldo después</span><strong class="${tone(after)}">${compactEuro(after)}</strong></div></div>`;
  }

  function renderKpis(){
    const dailyTotal=team().reduce((s,p)=>s+daily(p),0), weeklyTotal=team().reduce((s,p)=>s+weekly(p),0);
    const cards=[['Saldo real',euro(balance()),`Futuro ${euro(futureBalance())}`],['Valor plantilla',compactEuro(teamValue()),`${signedEuro(dailyTotal)} hoy`],['Patrimonio',compactEuro(wealth()),`${signedEuro(weeklyTotal)} 7d`],['Puntos',`${n(me()?.displayed_points)} pts`,`${team().length} jugadores`]];
    els.kpiGrid.innerHTML=cards.map(([label,value,sub])=>`<article class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-sub">${sub}</span></article>`).join('');
  }

  function renderCapacity(){
    const bidCommitment=Math.max(0,balance()-futureBalance()), offers=realOffers(), release=offers.reduce((s,o)=>s+Math.max(0,o.amount-(o.market_value*.25)),0);
    const steps=[['Saldo futuro',futureBalance(),'Caja limpia'],['Cancelando pujas',futureBalance()+bidCommitment,'Recupera compromisos'],['Con ofertas reales',futureBalance()+release,'Solo ofertas capturadas'],['Máximo temporal',maxCapacity()+release,'Incluye margen de deuda']];
    const max=Math.max(...steps.map(s=>s[1]),1);
    els.capacityList.innerHTML=steps.map(([label,value,note])=>`<div class="stack-item"><div class="stack-top"><div><strong>${label}</strong><small>${note}</small></div><strong>${compactEuro(value)}</strong></div><div class="progress"><span style="width:${Math.max(5,Math.min(100,value/max*100))}%"></span></div></div>`).join('');
  }

  function renderQuality(){
    const clauseRows=arr(state.latest?.member_clause_snapshots), scoring=state.latest?.scoring_capture;
    const items=[['Snapshot',state.latest?.snapshot_finalized?'OK':'Parcial'],['Mercado',`${freeMarket().length} libres`],['Scoring',text(scoring?.status||'capturado')],['Rivales',`${league().length}/7`],['Cláusulas',`${clauseRows.length}/7`],['Fuente',text(state.latest?.source||'—')]];
    els.qualityGrid.innerHTML=items.map(([l,v])=>`<div class="quality"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join('');
  }

  function playerCard(p, marketMode=false){
    const bid=marketMode?bidModel(p):null;
    return `<article class="player-card"><div class="player-top"><div><span class="badge">${posLabel(positionOf(p))}</span><div class="player-name">${esc(cleanName(p.name))}</div></div><div class="player-value">${compactEuro(playerValue(p))}</div></div><div class="player-stats"><div class="player-stat"><span>Hoy</span><strong class="${tone(daily(p))}">${signedEuro(daily(p))}</strong></div><div class="player-stat"><span>Semana</span><strong class="${tone(weekly(p))}">${signedEuro(weekly(p))}</strong></div><div class="player-stat"><span>Puntos</span><strong>${points(p)}</strong></div><div class="player-stat"><span>${marketMode?'Puja':'Radar'}</span><strong>${marketMode?compactEuro(bid.win):marketScore(p)+'/100'}</strong></div></div></article>`;
  }

  function renderMarket(){
    const q=norm(els.marketSearch?.value||state.marketSearch), sort=els.marketSort?.value||state.marketSort;
    const sorters={radar:(a,b)=>marketScore(b)-marketScore(a),daily:(a,b)=>daily(b)-daily(a),weekly:(a,b)=>weekly(b)-weekly(a),points:(a,b)=>points(b)-points(a),value:(a,b)=>playerValue(b)-playerValue(a)};
    const rows=[...freeMarket()].filter(p=>norm(p.name).includes(q)).sort(sorters[sort]||sorters.radar);
    els.marketMeta.textContent=`${freeMarket().length} jugadores libres capturados`;
    els.marketHighlights.innerHTML=[...freeMarket()].sort(sorters.radar).slice(0,3).map(p=>playerCard(p,true)).join('')||'<div class="empty">Sin mercado libre.</div>';
    els.marketList.innerHTML=rows.map(p=>playerCard(p,true)).join('')||'<div class="empty">No hay resultados.</div>';
  }

  function renderTeam(){
    const rows=[...team()].sort((a,b)=>teamScore(b)-teamScore(a));
    els.teamMeta.textContent=`${rows.length} jugadores · ${compactEuro(teamValue())}`;
    els.teamHighlights.innerHTML=rows.slice(0,3).map(p=>playerCard(p,false)).join('')||'<div class="empty">Sin plantilla.</div>';
    els.teamList.innerHTML=rows.map(p=>playerCard(p,false)).join('')||'<div class="empty">Sin plantilla.</div>';
  }

  function flattenObjects(value,out=[],depth=0){ if(!value||depth>5)return out; if(Array.isArray(value)){value.forEach(v=>flattenObjects(v,out,depth+1));} else if(typeof value==='object'){out.push(value);Object.values(value).forEach(v=>flattenObjects(v,out,depth+1));} return out; }
  function realOffers(){
    const listed=market().filter(p=>norm(p.owner_name)==='ale');
    const results=[];
    for(const [key,value] of Object.entries(state.latest||{})){
      if(!/offer|oferta/i.test(key)||/history/i.test(key)) continue;
      for(const o of flattenObjects(value,[],0)){
        const amount=numOrNull(o.offer_amount??o.amount??o.price??o.value), pid=o.player_id??o.id_player??o.player?.id, pname=o.player_name??o.player?.name;
        if(amount==null||(!pid&&!pname))continue;
        const p=listed.find(x=>(pid&&String(x.player_id)===String(pid))||(pname&&norm(x.name)===norm(pname)));
        if(p) results.push({name:cleanName(p.name),player_id:p.player_id,amount,market_value:playerValue(p)});
      }
    }
    const unique=new Map(); results.forEach(o=>{const e=unique.get(String(o.player_id)); if(!e||o.amount>e.amount)unique.set(String(o.player_id),o);}); return [...unique.values()];
  }

  function renderOffers(){
    const offers=realOffers().sort((a,b)=>b.amount-a.amount);
    els.offerList.innerHTML=offers.length?offers.map(o=>`<div class="stack-item"><div class="stack-top"><div><strong>${esc(o.name)}</strong><small>VM ${compactEuro(o.market_value)}</small></div><strong>${compactEuro(o.amount)}</strong></div><div class="rows"><div class="row"><span>% VM</span><strong>${o.market_value?`${(o.amount/o.market_value*100).toFixed(1)}%`:'—'}</strong></div><div class="row"><span>Liberación neta</span><strong>${compactEuro(Math.max(0,o.amount-o.market_value*.25))}</strong></div></div></div>`).join(''):'<div class="empty">No se han localizado ofertas reales activas en el snapshot.</div>';
    const listed=market().filter(p=>norm(p.owner_name)==='ale');
    els.listedPlayers.innerHTML=listed.length?listed.map(p=>`<div class="stack-item"><div class="stack-top"><div><strong>${esc(cleanName(p.name))}</strong><small>VM ${compactEuro(playerValue(p))}</small></div><strong>${compactEuro(p.asking_price)}</strong></div></div>`).join(''):'<div class="empty">No hay jugadores tuyos listados ahora.</div>';
  }

  function balanceRow(name){ return arr(state.latest?.estimated_rival_balances).find(r=>norm(r.name)===norm(name))||null; }
  function rivalBalance(name){ const r=balanceRow(name); return numOrNull(r?.usable_estimated_balance??r?.estimated_balance??r?.reconstructed_balance); }
  function renderLeague(){
    const rows=[...league()].map(u=>{const name=cleanName(u.name),value=n(u.displayed_euro_value),bal=norm(name)==='ale'?balance():(rivalBalance(name)??0);return{name,value,bal,points:n(u.displayed_points),capacity:bal+value*.25};}).sort((a,b)=>b.points-a.points||b.value-a.value);
    els.leagueTable.innerHTML=rows.map((r,i)=>`<div class="league-row"><span class="league-pos">${i+1}</span><div class="league-copy"><strong>${esc(r.name)}</strong><small>${compactEuro(r.value)} plantilla · ${compactEuro(r.bal)} saldo est.</small></div><span class="league-points">${r.points}</span></div>`).join('');
    els.rivalList.innerHTML=rows.map(r=>`<div class="stack-item"><div class="stack-top"><div><strong>${esc(r.name)}</strong><small>${r.points} pts</small></div><strong>${compactEuro(r.capacity)}</strong></div><div class="rows"><div class="row"><span>Saldo estimado</span><strong>${compactEuro(r.bal)}</strong></div><div class="row"><span>Plantilla</span><strong>${compactEuro(r.value)}</strong></div></div></div>`).join('');
  }

  function transfers(){ return arr(state.latest?.transfers_detected).slice().sort((a,b)=>new Date(b.created)-new Date(a.created)); }
  function transferName(t){ if(t.player)return cleanName(t.player); const c=arr(t.player_resolution?.candidate_players); return c.length===1?cleanName(c[0]):c.length>1?`Jugador no resuelto (${c.length})`:'Jugador no resuelto'; }
  function renderActivity(){
    els.activityList.innerHTML=transfers().slice(0,20).map(t=>`<div class="timeline-item"><div class="timeline-main"><strong>${esc(transferName(t))}</strong><span>${compactEuro(t.price)}</span></div><small>${esc(t.from||'—')} → ${esc(t.to||'—')} · ${dateTime(String(t.created||'').replace(' ','T'))}</small></div>`).join('')||'<div class="empty">Sin movimientos capturados.</div>';
  }

  function renderBids(){
    const map=new Map();
    for(const t of transfers()) for(const b of arr(t.other_bids)){ const name=cleanName(b.name); if(!name)continue; const row=map.get(name)||{name,count:0,max:0,total:0}; row.count++; row.max=Math.max(row.max,n(b.bid)); row.total+=n(b.bid); map.set(name,row); }
    const rows=[...map.values()].sort((a,b)=>b.count-a.count||b.total-a.total).slice(0,8);
    els.bidList.innerHTML=rows.length?rows.map(r=>`<div class="stack-item"><div class="stack-top"><div><strong>${esc(r.name)}</strong><small>${r.count} pujas detectadas</small></div><strong>${compactEuro(r.max)}</strong></div><div class="rows"><div class="row"><span>Total rastreado</span><strong>${compactEuro(r.total)}</strong></div></div></div>`).join(''):'<div class="empty">No hay other_bids en el histórico capturado.</div>';
  }

  function renderClauses(){
    const rows=arr(state.latest?.member_clause_snapshots);
    els.clauseList.innerHTML=rows.length?rows.map(r=>`<div class="stack-item"><div class="stack-top"><div><strong>${esc(cleanName(r.name))}</strong><small>${n(r.raised_clause_players_detected)} elevados</small></div><strong>${compactEuro(r.active_clause_balance_investment)}</strong></div></div>`).join(''):'<div class="empty">Sin detalle de cláusulas.</div>';
  }

  function drawChart(svg,values,start,end){
    if(!svg)return; const data=values.filter(Number.isFinite); if(data.length<2){svg.innerHTML='<text x="12" y="28" fill="#9aabc0" font-size="12">Aún no hay histórico suficiente</text>';return;}
    const W=640,H=220,P=10,min=Math.min(...data),max=Math.max(...data),range=max-min||1; const pts=data.map((v,i)=>[P+i*(W-P*2)/Math.max(data.length-1,1),H-P-(v-min)/range*(H-P*2)]); const line=pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '); const area=`${line} L${pts.at(-1)[0]},${H-P} L${pts[0][0]},${H-P} Z`; const id=`g${svg.id}`; svg.innerHTML=`<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><path d="${area}" fill="url(#${id})" opacity=".15"/><path d="${line}" fill="none" stroke="url(#${id})" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="5" fill="${end}"/>`;
  }

  function renderCharts(){
    els.wealthNow.textContent=compactEuro(wealth()); els.pointsNow.textContent=`${n(me()?.displayed_points)} pts`;
    const series=arr(state.series?.points); if(!series.length){els.historyMeta.textContent=state.series?'Sin snapshots':'Cargando histórico…'; return;}
    els.historyMeta.textContent=`${series.length} snapshots`;
    drawChart(els.wealthChart,series.map(p=>numOrNull(p.wealth)).filter(v=>v!=null),'#43d7a0','#55c8ff');
    drawChart(els.pointsChart,series.map(p=>numOrNull(p.points)).filter(v=>v!=null),'#aa94ff','#55c8ff');
  }

  els.refreshButton.addEventListener('click',loadLatest);
  els.marketSearch.addEventListener('input',()=>renderMarket());
  els.marketSort.addEventListener('change',()=>renderMarket());
  loadLatest();

  if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
