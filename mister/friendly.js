(()=>{
  'use strict';
  const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
  const norm=v=>clean(v).toLocaleLowerCase('es-ES');
  const arr=v=>Array.isArray(v)?v:[];
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const money=v=>{const n=Number(v)||0,a=Math.abs(n),s=n<0?'−':'';if(a>=1e6)return `${s}${(a/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;if(a>=1e3)return `${s}${Math.round(a/1e3).toLocaleString('es-ES')}k`;return `${s}${Math.round(a).toLocaleString('es-ES')} €`;};
  const dt=v=>{const d=new Date(String(v||'').replace(' ','T'));return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);};
  const posLabel=p=>({1:'POR',2:'DEF',3:'MED',4:'DEL'}[Number(p)]||'JUG');

  let latest=null, series=null, loading=false;

  function byId(id){
    if(id==null)return null;
    const now=[...arr(latest?.market_players),...arr(latest?.my_team)].find(p=>String(p.player_id)===String(id));
    if(now?.name)return clean(now.name);
    const historical=series?.players?.[String(id)];
    return historical?.name?clean(historical.name):null;
  }

  function ownerMatches(actual,expected){
    const a=norm(actual),e=norm(expected);
    return e==='mister'?(!a||a==='libre'||a==='mister'):a===e;
  }

  function inferFromHistory(t,candidates){
    if(!series?.players||!candidates.length)return null;
    const eventTs=new Date(String(t.created||'').replace(' ','T')).getTime();
    if(!Number.isFinite(eventTs))return null;
    const all=Object.values(series.players);
    const scores=[];
    for(const candidate of candidates){
      const entry=all.find(s=>norm(s?.name)===norm(candidate));
      if(!entry)continue;
      const pts=arr(entry.points).map(p=>({...p,ts:new Date(p.captured_at).getTime()})).filter(p=>Number.isFinite(p.ts)).sort((a,b)=>a.ts-b.ts);
      let before=null,after=null;
      for(const p of pts){if(p.ts<=eventTs)before=p;if(p.ts>=eventTs){after=p;break;}}
      if(!before)before=pts[0];
      if(!after)after=pts.at(-1);
      let score=0;
      if(before&&ownerMatches(before.owner_name,t.from))score+=4;
      if(after&&ownerMatches(after.owner_name,t.to))score+=4;
      if(before&&after&&norm(before.owner_name)!==norm(after.owner_name))score+=2;
      if(before&&Math.abs(eventTs-before.ts)<=172800000)score++;
      if(after&&Math.abs(after.ts-eventTs)<=172800000)score++;
      scores.push({name:clean(candidate),score});
    }
    scores.sort((a,b)=>b.score-a.score);
    return scores[0]?.score>=7&&(!scores[1]||scores[0].score-scores[1].score>=2)?scores[0]:null;
  }

  function trackerLabel(r){
    const method=String(r?.method||'').replaceAll('_',' ');
    const confidence=String(r?.confidence||'').toLowerCase();
    if(confidence==='exact')return {label:method?`Exacto · ${method}`:'Identificación exacta',kind:'exact'};
    if(confidence==='high')return {label:method?`Alta confianza · ${method}`:'Alta confianza',kind:'history'};
    if(confidence==='medium')return {label:method?`Probable · ${method}`:'Probable',kind:'probable'};
    return null;
  }

  function resolveTransfer(t){
    const r=t.player_resolution||{};
    const direct=clean(t.player||t.player_name||r.player_name||r.resolved_player_name||r.name||'');
    if(direct){const tracker=trackerLabel(r);return{name:direct,label:tracker?.label||'Identificado por tracker',kind:tracker?.kind||'exact'};}
    const id=t.player_id??r.player_id??r.resolved_player_id;
    const idName=byId(id);
    if(idName)return{name:idName,label:'Identificado por ID',kind:'exact'};
    const candidates=arr(r.candidate_players).map(clean).filter(Boolean);
    if(candidates.length===1)return{name:candidates[0],label:'Candidato único',kind:'probable'};
    const inferred=inferFromHistory(t,candidates);
    if(inferred)return{name:inferred.name,label:'Identificado por histórico web',kind:'history'};
    const action=norm(t.from)==='mister'?`Compra de ${clean(t.to||'manager')}`:norm(t.to)==='mister'?`Venta de ${clean(t.from||'manager')}`:`${clean(t.from||'Manager')} → ${clean(t.to||'Manager')}`;
    return{name:action,label:candidates.length?`${candidates.length} candidatos por confirmar`:'Jugador por confirmar',kind:'pending'};
  }

  function activityIcon(t){if(norm(t.from)==='mister')return '＋';if(norm(t.to)==='mister')return '−';return '↔';}

  function resolutionSummary(){
    const s=latest?.transfer_identity_resolution||{};const version=Number(s.version)||0;if(version<2)return '';
    const total=Number(s.total_transfers)||0,resolved=Number(s.resolved_total)||0,coverage=Number(s.coverage_pct)||0,aleCoverage=Number(s.ale_coverage_pct)||0,ledger=Number(s.event_ledger_entries)||0,conflicts=Number(s.event_ledger_conflicts)||0;
    const extra=version>=3?` · ledger ${ledger}${conflicts?` · ${conflicts} conflictos protegidos`:''}`:'';
    return `<div class="resolution-summary"><div><span class="eyebrow">Resolución de datos</span><strong>${resolved}/${total} movimientos identificados</strong><small>Tracker V${version} · cobertura ${coverage.toLocaleString('es-ES')}% · Ale ${aleCoverage.toLocaleString('es-ES')}%${extra}</small></div><span class="resolution-score ${coverage>=90?'great':coverage>=70?'good':'warn'}">${coverage.toLocaleString('es-ES')}%</span></div>`;
  }

  function renderActivity(){
    const host=document.getElementById('activityList');if(!host||!latest)return;
    const rows=arr(latest.transfers_detected).slice().sort((a,b)=>new Date(String(b.created||'').replace(' ','T'))-new Date(String(a.created||'').replace(' ','T'))).slice(0,24);
    host.innerHTML=resolutionSummary()+rows.map(t=>{const r=resolveTransfer(t);const candidates=arr(t?.player_resolution?.candidate_players).map(clean).filter(Boolean);const candidateText=r.kind==='pending'&&candidates.length?`<span class="activity-candidates">${esc(candidates.slice(0,3).join(' · '))}${candidates.length>3?'…':''}</span>`:'';return `<div class="timeline-item friendly-activity ${r.kind}"><div class="activity-icon">${activityIcon(t)}</div><div class="activity-body"><div class="activity-title"><strong>${esc(r.name)}</strong><b>${money(t.price)}</b></div><div class="activity-meta"><span>${esc(t.from||'—')} → ${esc(t.to||'—')}</span><span>${dt(t.created)}</span></div>${candidateText}<span class="resolution-pill ${r.kind}">${esc(r.label)}</span></div></div>`;}).join('');
  }

  function decorateExistingCards(){
    document.querySelectorAll('.player-card').forEach(card=>{
      const name=card.querySelector('.player-name')?.textContent?.trim()||'';
      if(name&&!card.dataset.avatar)card.dataset.avatar=name.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'').slice(0,1).toUpperCase()||'⚽';
      card.querySelectorAll('.badge').forEach(badge=>{const label=badge.textContent.trim();badge.classList.toggle('p1',label==='POR');badge.classList.toggle('p2',label==='DEF');badge.classList.toggle('p3',label==='MED');badge.classList.toggle('p4',label==='DEL');});
    });
    document.querySelectorAll('.league-row').forEach(row=>{if(row.textContent.includes('Ale'))row.classList.add('me');});
  }

  function renderHeader(){
    if(!latest)return;
    const balance=Number(latest?.my_balance?.current_balance)||0;
    const users=arr(latest?.league_users).slice().sort((a,b)=>(Number(b.displayed_points)||0)-(Number(a.displayed_points)||0));
    const rankIndex=users.findIndex(u=>norm(u.name)==='ale');
    const balanceHost=document.getElementById('headerBalance');if(balanceHost)balanceHost.textContent=money(balance);
    const rankHost=document.getElementById('headerRank');if(rankHost)rankHost.textContent=rankIndex>=0?`#${rankIndex+1}`:'—';
  }

  function renderPitch(){
    const host=document.getElementById('pitchBoard');if(!host||!latest)return;
    const players=arr(latest.my_team).slice();
    const posOf=p=>Number(p.position)||Number(arr(latest.market_players).find(m=>String(m.player_id)===String(p.player_id))?.position)||3;
    const byPos={1:[],2:[],3:[],4:[]};players.forEach(p=>byPos[posOf(p)].push(p));
    Object.values(byPos).forEach(list=>list.sort((a,b)=>(Number(b.displayed_points)||0)-(Number(a.displayed_points)||0)||(Number(b.market_value)||0)-(Number(a.market_value)||0)));
    const choose=(list,n)=>list.slice(0,n);
    const eleven=[...choose(byPos[1],1),...choose(byPos[2],4),...choose(byPos[3],3),...choose(byPos[4],3)];
    const selected=new Set(eleven.map(p=>String(p.player_id)));
    if(eleven.length<11){players.filter(p=>!selected.has(String(p.player_id))).sort((a,b)=>(Number(b.displayed_points)||0)-(Number(a.displayed_points)||0)).slice(0,11-eleven.length).forEach(p=>eleven.push(p));}
    const grouped={1:[],2:[],3:[],4:[]};eleven.forEach(p=>grouped[posOf(p)].push(p));
    const playerHtml=p=>{const name=clean(p.name);const initial=name.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'').slice(0,1).toUpperCase()||'⚽';return `<div class="pitch-player"><div class="pitch-avatar">${esc(initial)}</div><strong>${esc(name)}</strong><small>${esc(posLabel(posOf(p)))} · ${Number(p.displayed_points)||0} pts</small></div>`;};
    host.innerHTML=`<div class="pitch-center"></div><div class="pitch-grid"><div class="pitch-row">${grouped[4].map(playerHtml).join('')}</div><div class="pitch-row">${grouped[3].map(playerHtml).join('')}</div><div class="pitch-row">${grouped[2].map(playerHtml).join('')}</div><div class="pitch-row">${grouped[1].map(playerHtml).join('')}</div></div>`;
  }

  function bindBottomNav(){
    const links=[...document.querySelectorAll('.bottom-nav a')];
    links.forEach(a=>a.addEventListener('click',()=>{links.forEach(x=>x.classList.remove('active'));a.classList.add('active');}));
  }

  async function enhance(){
    if(loading)return;loading=true;
    try{
      latest=await fetch(`./data/latest.json?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
      renderHeader();renderPitch();renderActivity();decorateExistingCards();
      const hasAmbiguous=arr(latest?.transfers_detected).some(t=>!t?.player&&arr(t?.player_resolution?.candidate_players).length>0);
      if(hasAmbiguous){series=await fetch(`./data/series.json?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);renderActivity();}
    }catch(error){console.warn('friendly enhancement',error);}finally{loading=false;}
  }

  window.addEventListener('DOMContentLoaded',()=>{bindBottomNav();setTimeout(enhance,220);});
  document.getElementById('refreshButton')?.addEventListener('click',()=>setTimeout(enhance,1000));
  const observer=new MutationObserver(()=>decorateExistingCards());
  window.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{subtree:true,childList:true}));
})();
