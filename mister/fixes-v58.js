(()=>{
'use strict';
const $=s=>document.querySelector(s);
let queued=false,refreshTimer=0;
function loadV61(){if(document.querySelector('link[data-fantasy-v61]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./fixes-v61.css?v=61';l.dataset.fantasyV61='1';document.head.appendChild(l)}
function loadV63(){if(!document.querySelector('link[data-fantasy-v63]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fixes-v63.css?v=63';l.dataset.fantasyV63='1';document.head.appendChild(l)}if(!document.querySelector('script[data-fantasy-v63]')){const s=document.createElement('script');s.src='./fixes-v63.js?v=63';s.dataset.fantasyV63='1';document.body.appendChild(s)}}
function refreshSvg(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.4L20 9"/><path d="m4 15 2.6 2.4A7 7 0 0 0 17.9 15"/></svg>'}
function skeleton(){
  const home=$('.screen[data-screen="home"]');if(!home||$('#v58HomeSkeleton'))return;
  const host=document.createElement('section');host.id='v58HomeSkeleton';host.className='v58-home-skeleton';host.setAttribute('aria-hidden','true');
  const card=()=>`<div class="v58-sk-card"><span class="v58-sk-icon"></span><span class="v58-sk-photo"></span><span class="v58-sk-copy"><i class="v58-sh kicker"></i><i class="v58-sh title"></i><i class="v58-sh sub"></i><span class="v58-sk-reasons"><i class="v58-sh chip"></i><i class="v58-sh chip"></i></span></span><span class="v58-sk-value"><i class="v58-sh money"></i><i class="v58-sh badge"></i></span></div>`;
  host.innerHTML=`<div class="v58-sk-intro"><div><span class="v58-sk-kicker"><i></i>Preparando tu día</span><small>Mercado, plantilla y oportunidades</small></div><span class="v58-sk-progress"><i></i></span></div><div class="v58-sk-tabs">${Array.from({length:4},()=>'<span class="v58-sk-tab"><i class="v58-sh"></i></span>').join('')}</div><div class="v58-sk-list">${card()}${card()}${card()}</div>`;
  const status=home.querySelector('.home-status');if(status)status.insertAdjacentElement('afterend',host);else home.prepend(host);
}
function header(){
  const h=$('.app-header'),balance=$('.balance-chip'),refresh=$('#refreshButton');if(!h||!balance||!refresh)return;
  let actions=$('.v58-header-actions');if(!actions){actions=document.createElement('div');actions.className='v58-header-actions';h.appendChild(actions)}
  if(balance.parentElement!==actions)actions.appendChild(balance);
  const privacy=$('#privacyToggle');if(privacy&&privacy.parentElement!==actions)actions.appendChild(privacy);
  if(refresh.parentElement!==actions)actions.appendChild(refresh);
  if(refresh.dataset.v58!=='1'){refresh.dataset.v58='1';refresh.innerHTML=refreshSvg();refresh.setAttribute('aria-label','Actualizar datos');refresh.title='Actualizar datos';refresh.addEventListener('click',()=>{clearTimeout(refreshTimer);refresh.classList.add('v58-refreshing');refreshTimer=setTimeout(()=>refresh.classList.remove('v58-refreshing'),1100)},true)}
}
function patch(){queued=false;skeleton();header()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(patch)}
function init(){loadV61();loadV63();patch();const h=$('.app-header');if(h)new MutationObserver(queue).observe(h,{childList:true,subtree:true});window.addEventListener('fantasy:ready',()=>{patch();setTimeout(patch,180)});document.addEventListener('visibilitychange',()=>{if(!document.hidden)patch()});setTimeout(patch,500);setTimeout(patch,1300)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
