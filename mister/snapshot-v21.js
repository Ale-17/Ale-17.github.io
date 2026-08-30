(()=>{
'use strict';
// Compatibility loader: V22 moves manual snapshots out of the header and into
// Centro de control, while preserving the one-time token already stored on device.
function loadCss(){if(document.querySelector('link[data-fantasy-v22]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./ux-v22.css?v=22';l.dataset.fantasyV22='1';document.head.appendChild(l)}
function loadJs(){if(document.querySelector('script[data-fantasy-v22]'))return;const s=document.createElement('script');s.src='./ux-v22.js?v=22';s.defer=true;s.dataset.fantasyV22='1';document.head.appendChild(s)}
loadCss();loadJs();
})();
