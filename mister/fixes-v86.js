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
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function patch(){
  const sheet=document.querySelector('#v79SimulatorSheet');
  if(!sheet)return;
  sheet.querySelectorAll('.v79-quick button').forEach(button=>{
    const text=(button.textContent||'').trim();
    if(text==='Asegurar'||text==='Cobertura')setText(button,'Agresiva');
  });
  sheet.querySelectorAll('.v79-strategy').forEach(card=>{
    const label=card.querySelector('span');
    const text=(label?.textContent||'').trim();
    if(text==='Asegurar'||text==='Alta cobertura')setText(label,'Agresiva');
    const sub=card.querySelector('small');
    if(sub){
      const next=(sub.textContent||'').replace(/máxima cobertura|objetivo alto/gi,'máximo estimado');
      setText(sub,next);
    }
  });
  const prob=Number((sheet.querySelector('#v79Prob')?.textContent||'').replace('%','').trim());
  const risk=(sheet.querySelector('#v79Risk')?.textContent||'').trim();
  const tacticalNode=sheet.querySelector('#v79Tactical');
  if(tacticalNode&&Number.isFinite(prob))setText(tacticalNode,tactical(prob,risk));
  sheet.dataset.v86='1';
}
let queued=false;
function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patch()});
}
window.addEventListener('input',event=>{if(event.target?.id==='v79BidSlider')setTimeout(queue,0)},true);
window.addEventListener('click',event=>{if(event.target?.closest?.('[data-v79-bid],[data-v79-preset],.v79-launch'))setTimeout(queue,20)},true);
const observer=new MutationObserver(queue);
function init(){observer.observe(document.body,{childList:true,subtree:true,characterData:true});queue()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.FantasyOSAuctionUiV86={patch};
})();