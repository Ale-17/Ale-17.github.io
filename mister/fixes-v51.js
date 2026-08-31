(()=>{
'use strict';
const $=s=>document.querySelector(s),arr=v=>Array.isArray(v)?v:[];
let decisionData=null,loading=null,patchQueued=false;

async function loadData(){
  if(decisionData)return decisionData;
  if(loading)return loading;
  loading=fetch(`./data/decision_center.json?v=${Date.now()}`,{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(d=>decisionData=d||{decisions:[]})
    .catch(()=>decisionData={decisions:[]})
    .finally(()=>loading=null);
  return loading;
}
function confidenceLabel(v){
  const s=String(v||'').toLocaleLowerCase('es-ES');
  if(s.includes('alta'))return'Alta conf.';
  if(s.includes('baja'))return'Baja conf.';
  return'Conf. media';
}
function patchRank(){
  const badge=$('#rankBadge');if(!badge)return;
  const raw=badge.querySelector('.v51-rank-number')?`${badge.dataset.v51RankPos||''} de ${badge.dataset.v51RankTotal||''}`:badge.textContent||'';
  const m=String(raw).match(/#?\s*(\d+)\s*(?:\.º|º|°)?\s*de\s*(\d+)/i);
  if(!m)return;
  const pos=Number(m[1]),total=Number(m[2]);
  if(!pos||!total)return;
  if(!badge.querySelector('.v51-rank-number')||badge.dataset.v51RankPos!==String(pos)||badge.dataset.v51RankTotal!==String(total)){
    badge.dataset.v51RankPos=String(pos);badge.dataset.v51RankTotal=String(total);
    badge.innerHTML=`<strong class="v51-rank-number">${pos}.º</strong><span class="v51-rank-rest">de ${total}</span><i class="v51-rank-arrow">›</i>`;
  }
  badge.classList.add('v51-rank-link');badge.setAttribute('role','button');badge.setAttribute('tabindex','0');badge.setAttribute('aria-label',`${pos}.º de ${total}. Abrir clasificación`);
}
function scoreClass(score){return score>=85?'v51-score-high':score>=72?'v51-score-good':'v51-score-watch'}
function decorateCards(){
  const rows=arr(decisionData?.decisions).slice(0,7);
  document.querySelectorAll('.v50-card[data-v50-index]').forEach(card=>{
    const d=rows[Number(card.dataset.v50Index)];if(!d)return;
    const score=Math.round(Number(d.score)||0);
    card.classList.remove('v51-high','v51-good','v51-watch');
    card.classList.add(score>=85?'v51-high':score>=72?'v51-good':'v51-watch');
    const copy=card.querySelector('.v50-copy'),kicker=copy?.querySelector(':scope > .v50-kicker');
    if(copy&&kicker&&!copy.querySelector(':scope > .v51-topline')){
      const top=document.createElement('span');top.className='v51-topline';
      copy.insertBefore(top,kicker);top.appendChild(kicker);
      const chip=document.createElement('span');chip.className=`v51-score ${scoreClass(score)}`;chip.textContent=`${score}/100`;top.appendChild(chip);
    }else{
      const chip=copy?.querySelector('.v51-score');
      if(chip){chip.className=`v51-score ${scoreClass(score)}`;chip.textContent=`${score}/100`}
    }
    const conf=card.querySelector('.v50-value>em');if(conf)conf.textContent=confidenceLabel(d.confidence);
    const reasons=card.querySelector('.v50-reasons');if(reasons)reasons.setAttribute('aria-label','Motivos principales');
  });
}
function patchFilters(){
  document.querySelectorAll('.v50-filters [data-v50-filter]').forEach(btn=>{
    const key=btn.dataset.v50Filter||'';btn.classList.add(`v51-filter-${key}`);
    if(!btn.querySelector('.v51-filter-dot')){const dot=document.createElement('i');dot.className='v51-filter-dot';btn.prepend(dot)}
  });
}
function patch(){patchQueued=false;patchRank();patchFilters();decorateCards()}
function schedulePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(patch)}
function goTable(){
  const tab=document.querySelector('.nav-tab[data-screen-target="table"]');
  if(tab){tab.click();setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),40)}
}
function bind(){
  document.addEventListener('click',e=>{const badge=e.target.closest?.('#rankBadge.v51-rank-link');if(!badge)return;e.preventDefault();e.stopImmediatePropagation();goTable()},true);
  document.addEventListener('keydown',e=>{const badge=e.target.closest?.('#rankBadge.v51-rank-link');if(!badge||!['Enter',' '].includes(e.key))return;e.preventDefault();goTable()},true);
  const app=document.querySelector('.app-shell')||document.body;
  new MutationObserver(schedulePatch).observe(app,{childList:true,subtree:true,characterData:true});
  window.addEventListener('fantasy:ready',schedulePatch);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){decisionData=null;loadData().then(schedulePatch)}});
}
async function init(){bind();await loadData();patch();setTimeout(patch,700);setTimeout(patch,1600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
