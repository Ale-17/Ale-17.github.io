(()=>{
'use strict';
const KEY='fantasy-os-incognito';
const root=document.documentElement;
let enabled=false;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function ensureCss(){
  if(document.querySelector('link[data-fantasy-privacy]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='./privacy.css?v=16';link.dataset.fantasyPrivacy='1';document.head.appendChild(link);
}
function ensureButton(){
  const chip=document.querySelector('.balance-chip');if(!chip||$('#privacyToggle'))return;
  const btn=document.createElement('button');btn.id='privacyToggle';btn.className='privacy-toggle';btn.type='button';btn.innerHTML=`${incognitoSvg()}<span class="privacy-tooltip">Modo incógnito</span>`;chip.appendChild(btn);
}
function read(){try{return localStorage.getItem(KEY)==='1'}catch{return false}}
function store(value){try{localStorage.setItem(KEY,value?'1':'0')}catch{}}
function ensureWealthPlaceholder(){
  const chart=$('#wealthChart'),block=chart?.closest('.chart-block');if(!block)return;
  block.classList.add('privacy-wealth-chart');
  if(block.querySelector('.privacy-wealth-placeholder'))return;
  const placeholder=document.createElement('div');placeholder.className='privacy-wealth-placeholder';
  placeholder.innerHTML=`<span class="privacy-lock-icon">${incognitoSvg()}</span><div><strong>Patrimonio oculto</strong><small>Modo incógnito activo</small></div>`;
  chart.insertAdjacentElement('afterend',placeholder);
}
function markDynamicFinancialValues(){
  const header=$('#headerBalance');if(header)header.classList.add('privacy-value');
  const wealth=$('#wealthNow');if(wealth)wealth.classList.add('privacy-value');
  $$('#capacityList .capacity-top span').forEach(el=>el.classList.add('privacy-value'));
  $$('#homeStats .summary-stat').forEach(card=>{const label=card.querySelector('span')?.textContent?.trim().toLocaleLowerCase('es-ES')||'';if(label.includes('saldo')||label.includes('patrimonio'))card.querySelector('strong')?.classList.add('privacy-value')});
  $$('#marketFooterStats .footer-stat').forEach(card=>{const label=card.querySelector('span')?.textContent?.trim().toLocaleLowerCase('es-ES')||'';if(label.includes('saldo')||label.includes('patrimonio'))card.querySelector('strong')?.classList.add('privacy-value')});
  $$('#moreSummary .more-card').forEach(card=>{const label=card.querySelector('span')?.textContent?.trim().toLocaleLowerCase('es-ES')||'';if(label.includes('saldo')||label.includes('patrimonio'))card.querySelector('strong')?.classList.add('privacy-value')});
  ensureWealthPlaceholder();
}
function incognitoSvg(){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 9.2 9 4.8h6l1.8 4.4"/><path d="M5.2 10.2h13.6"/><circle cx="8" cy="14.8" r="2.8"/><circle cx="16" cy="14.8" r="2.8"/><path d="M10.8 14.8h2.4"/></svg>`}
function updateButton(){
  const btn=$('#privacyToggle');if(!btn)return;
  btn.setAttribute('aria-pressed',enabled?'true':'false');btn.setAttribute('aria-label',enabled?'Desactivar modo incógnito':'Activar modo incógnito');btn.title=enabled?'Mostrar datos financieros':'Ocultar saldo y patrimonio';btn.classList.toggle('active',enabled);
  const label=btn.querySelector('.privacy-tooltip');if(label)label.textContent=enabled?'Incógnito activo':'Modo incógnito';
}
function toast(message){
  let el=$('#privacyToast');if(!el){el=document.createElement('div');el.id='privacyToast';el.className='privacy-toast';document.body.appendChild(el)}
  el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800);
}
function apply(value,{notify=false}={}){
  enabled=!!value;root.classList.toggle('privacy-mode',enabled);document.body?.classList.toggle('privacy-mode',enabled);store(enabled);markDynamicFinancialValues();updateButton();
  if(notify)toast(enabled?'Modo incógnito activo · datos financieros ocultos':'Modo incógnito desactivado · datos visibles');
}
function bind(){ensureButton();const btn=$('#privacyToggle');if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',e=>{e.stopPropagation();apply(!enabled,{notify:true})})}}
function refresh(){markDynamicFinancialValues();updateButton()}
ensureCss();enabled=read();root.classList.toggle('privacy-mode',enabled);
window.addEventListener('DOMContentLoaded',()=>{bind();apply(enabled);const observer=new MutationObserver(()=>requestAnimationFrame(refresh));observer.observe(document.body,{childList:true,subtree:true});setTimeout(refresh,400);setTimeout(refresh,1100)});
})();
