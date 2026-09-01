(()=>{
'use strict';
function addCss(){if(document.querySelector('link[data-fantasy-v90]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./fixes-v90.css?v=90';l.dataset.fantasyV90='1';document.head.appendChild(l)}
function boot(){addCss();let s=document.querySelector('script[data-fantasy-v90]');if(s)return;if(window.FantasyOSV90){window.FantasyOSV90.refresh?.(true);return}s=document.createElement('script');s.src='./fixes-v90.js?v=90';s.async=false;s.dataset.fantasyV90='1';document.head.appendChild(s)}
function refresh(){if(window.FantasyOSV90?.refresh)return window.FantasyOSV90.refresh(true);boot()}
boot();
window.FantasyOSV89={refresh};
})();
