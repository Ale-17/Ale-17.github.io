(()=>{
'use strict';
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
let screenObserver=null;
function moveInstalledCardToBottom(){
  const screen=document.querySelector('.screen[data-screen="more"]');
  const card=document.querySelector('#v70InstallCard');
  if(!screen||!card)return false;
  if(!card.classList.contains('is-installed')&&!isStandalone())return false;
  if(card.parentElement!==screen||screen.lastElementChild!==card)screen.appendChild(card);
  card.dataset.v72Position='bottom';
  return true;
}
function scheduleMove(){
  requestAnimationFrame(moveInstalledCardToBottom);
  setTimeout(moveInstalledCardToBottom,120);
  setTimeout(moveInstalledCardToBottom,600);
}
function boot(){
  const screen=document.querySelector('.screen[data-screen="more"]');
  if(!screen){setTimeout(boot,100);return}
  if(!screenObserver){
    screenObserver=new MutationObserver(()=>{
      const card=document.querySelector('#v70InstallCard');
      if(card?.classList.contains('is-installed')||isStandalone())requestAnimationFrame(moveInstalledCardToBottom);
    });
    screenObserver.observe(screen,{childList:true});
  }
  scheduleMove();
}
window.addEventListener('appinstalled',scheduleMove);
window.addEventListener('DOMContentLoaded',boot,{once:true});
if(document.readyState!=='loading')boot();
})();
