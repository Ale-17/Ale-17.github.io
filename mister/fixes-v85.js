(()=>{
'use strict';
function tactical(p,risk){
  if(risk==='Muy alto')return'Sobrepago fuerte';
  if(p<42)return'Desfavorable';
  if(p<56)return'Muy abierta';
  if(p<70)return'Ventaja leve';
  if(p<82)return'Favorita';
  if(p<92)return'Muy favorita';
  return'Cobertura máxima';
}
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function patch(){
  const sheet=document.querySelector('#v79SimulatorSheet');
  if(!sheet)return;
  sheet.querySelectorAll('.v79-quick button').forEach(b=>{if((b.textContent||'').trim()==='Asegurar')setText(b,'Cobertura')});
  sheet.querySelectorAll('.v79-strategy').forEach(b=>{
    const label=b.querySelector('span'),sub=b.querySelector('small');
    if(label&&(label.textContent||'').trim()==='Asegurar')setText(label,'Alta cobertura');
    if(sub&&/máxima cobertura/i.test(sub.textContent||'')){const next=(sub.textContent||'').replace(/máxima cobertura/i,'objetivo alto');setText(sub,next)}
  });
  sheet.querySelectorAll('.v79-rival-list>div>strong').forEach(el=>{const next=(el.textContent||'').replace(/^\s*≤\s*/,'≈ ');setText(el,next)});
  const prob=Number((sheet.querySelector('#v79Prob')?.textContent||'').replace('%','').trim());
  const risk=(sheet.querySelector('#v79Risk')?.textContent||'').trim();
  const out=sheet.querySelector('#v79Tactical');
  if(out&&Number.isFinite(prob))setText(out,tactical(prob,risk));
  sheet.dataset.v85='1';
}
let queued=false;
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}
window.addEventListener('input',e=>{if(e.target?.id==='v79BidSlider')setTimeout(queue,0)},true);
window.addEventListener('click',e=>{if(e.target?.closest?.('[data-v79-bid],[data-v79-preset],.v79-launch'))setTimeout(queue,20)},true);
const obs=new MutationObserver(queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{obs.observe(document.body,{childList:true,subtree:true,characterData:true});queue()},{once:true});else{obs.observe(document.body,{childList:true,subtree:true,characterData:true});queue()}
window.FantasyOSAuctionUiV85={patch};
})();