(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES');
let tableObserver=null;
function scopeLeaguePrivacy(){
  const table=$('#leagueTable');if(!table)return;
  for(const row of $$('#leagueTable .table-row')){
    const name=clean(row.querySelector('.table-manager strong')?.textContent);
    const own=row.classList.contains('me')||norm(name)==='ale';
    row.classList.toggle('v73-own-manager',own);
    if(!own)row.querySelectorAll('.privacy-value').forEach(el=>el.classList.remove('privacy-value'));
  }
}
function watchLeague(){
  const table=$('#leagueTable');if(!table){setTimeout(watchLeague,120);return}
  scopeLeaguePrivacy();
  if(tableObserver)return;
  let queued=false;
  tableObserver=new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;scopeLeaguePrivacy()});
  });
  tableObserver.observe(table,{childList:true,subtree:true});
}
function closeManagerSheet(sheet){
  const back=$('#sheetBackdrop');
  sheet.style.transition='transform .18s cubic-bezier(.2,.8,.2,1)';
  sheet.style.transform='translate(-50%,105%)';
  if(back){back.style.transition='opacity .18s ease';back.style.opacity='0'}
  setTimeout(()=>{
    const close=$('#sheetClose');
    close?.click();
    setTimeout(()=>{
      if(sheet.classList.contains('open')){
        sheet.classList.remove('open','v36-manager-sheet','v36-sheet');
        sheet.setAttribute('aria-hidden','true');
        back?.classList.add('hidden');
        document.body.classList.remove('v28-sheet-open','sheet-open');
      }
      sheet.style.removeProperty('transform');
      sheet.style.removeProperty('transition');
      sheet.style.removeProperty('will-change');
      if(back){back.style.removeProperty('opacity');back.style.removeProperty('transition')}
    },0);
  },175);
}
function installManagerSwipe(){
  const sheet=$('#playerSheet');if(!sheet||sheet.dataset.v73ManagerSwipe)return;
  sheet.dataset.v73ManagerSwipe='1';
  let active=false,dragging=false,startY=0,startX=0,lastY=0,startAt=0;
  const reset=()=>{
    active=false;dragging=false;
    sheet.style.transition='transform .2s cubic-bezier(.2,.8,.2,1)';
    sheet.style.transform='translate(-50%,0)';
    const back=$('#sheetBackdrop');if(back)back.style.opacity='';
    setTimeout(()=>{sheet.style.removeProperty('transition');sheet.style.removeProperty('transform');sheet.style.removeProperty('will-change')},220);
  };
  sheet.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||!sheet.classList.contains('open')||!sheet.classList.contains('v36-manager-sheet')||sheet.scrollTop>1)return;
    if(e.target.closest?.('button,a,input,textarea,select'))return;
    const t=e.touches[0];active=true;dragging=false;startY=lastY=t.clientY;startX=t.clientX;startAt=performance.now();
    sheet.style.transition='none';sheet.style.willChange='transform';
    e.stopImmediatePropagation();
  },{capture:true,passive:true});
  sheet.addEventListener('touchmove',e=>{
    if(!active||e.touches.length!==1)return;
    const t=e.touches[0],dy=t.clientY-startY,dx=t.clientX-startX;lastY=t.clientY;
    if(!dragging&&Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8){reset();return}
    if(dy<=0){if(dy<-10)reset();return}
    if(dy<6)return;
    dragging=true;e.preventDefault();e.stopImmediatePropagation();
    sheet.style.transform=`translate(-50%,${dy}px)`;
    const back=$('#sheetBackdrop');if(back)back.style.opacity=String(Math.max(.18,1-dy/520));
  },{capture:true,passive:false});
  sheet.addEventListener('touchend',e=>{
    if(!active)return;
    const dy=Math.max(0,lastY-startY),dt=Math.max(1,performance.now()-startAt),velocity=dy/dt,wasDragging=dragging;
    active=false;dragging=false;
    if(wasDragging)e.stopImmediatePropagation();
    if(wasDragging&&(dy>90||velocity>.55))closeManagerSheet(sheet);else reset();
  },{capture:true,passive:true});
  sheet.addEventListener('touchcancel',()=>{if(active)reset()},{capture:true,passive:true});
}
function init(){watchLeague();installManagerSwipe();window.addEventListener('fantasy:ready',()=>setTimeout(scopeLeaguePrivacy,0));setTimeout(scopeLeaguePrivacy,500);setTimeout(scopeLeaguePrivacy,1400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
