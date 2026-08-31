(()=>{
'use strict';
let observer=null;
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
function compactState(state){
  const s=clean(state);
  if(/^\d+\s+alertas?\s+nuevas?$/i.test(s))return s.replace(/\s+alertas?/i,'');
  return s;
}
function compactCard(){
  const card=document.querySelector('#v77AlertsCard');
  if(!card)return;
  card.classList.add('v81-alert-card');
  const copy=card.querySelector('.v80-alert-copy');
  if(!copy)return;
  const strong=copy.querySelector('strong'),em=copy.querySelector('em'),small=copy.querySelector('small');
  if(!strong||!em)return;
  if(strong.dataset.v81Title==='1')return;
  strong.dataset.v81Title='1';
  const state=compactState(strong.textContent),sub=clean(em.textContent);
  if(small)small.textContent='';
  strong.textContent='Alertas inteligentes';
  const parts=[];
  if(state)parts.push(state);
  if(sub&&!parts.some(x=>x.toLocaleLowerCase('es-ES')===sub.toLocaleLowerCase('es-ES')))parts.push(sub);
  em.textContent=parts.join(' · ');
}
function watch(){
  const more=document.querySelector('.screen[data-screen="more"]');
  if(!more)return;
  observer?.disconnect();
  observer=new MutationObserver(()=>requestAnimationFrame(compactCard));
  observer.observe(more,{childList:true,subtree:true,characterData:true});
  compactCard();
}
function init(){
  watch();
  setTimeout(compactCard,250);
  setTimeout(compactCard,900);
  setTimeout(compactCard,1800);
  window.addEventListener('focus',compactCard);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')compactCard()});
  window.addEventListener('fantasy:ready',compactCard);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
