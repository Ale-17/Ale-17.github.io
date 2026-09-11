(()=>{
'use strict';
const BAD=/\bvar\s+_FG_cfg\b|PLAYER_[A-Z_]{3,}|<\/?(?:em|strong|script)\b|\{"pag"\s*:|\bselect\\n|\bplural\\n/i;
function broken(value){const s=String(value||'').trim();return !s||s.length>140||BAD.test(s)}
function clean(){const root=document.getElementById('activityList');if(!root)return;for(const item of root.querySelectorAll('.timeline-item')){const title=item.querySelector('.timeline-main strong')?.textContent||'';const detail=item.querySelector('small')?.textContent||'';if(broken(title)||BAD.test(detail)||detail.length>320)item.remove()}if(!root.querySelector('.timeline-item')&&!root.querySelector('.empty'))root.innerHTML='<div class="empty">Sin movimientos válidos capturados.</div>'}
function boot(){clean();const root=document.getElementById('activityList');if(root)new MutationObserver(clean).observe(root,{childList:true,subtree:true,characterData:true});window.addEventListener('focus',clean);window.addEventListener('pageshow',clean)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
