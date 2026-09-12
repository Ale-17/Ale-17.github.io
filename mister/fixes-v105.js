(()=>{
'use strict';
const BAD=/\bvar\s+_FG_cfg\b|PLAYER_[A-Z_]{3,}|<\/?(?:em|strong|script)\b|\{"pag"\s*:|\bselect\\n|\bplural\\n/i;
function broken(value,max=140){const s=String(value||'').trim();return !s||s.length>max||BAD.test(s)}
function cleanRoot(root){if(!root)return;for(const row of root.querySelectorAll('.feed-row,.timeline-item')){const title=row.querySelector('.feed-copy strong,.timeline-main strong')?.textContent||'';const detail=row.querySelector('.feed-copy small,small')?.textContent||'';if(broken(title,140)||broken(detail,320))row.remove()}if(!root.querySelector('.feed-row,.timeline-item')&&!root.querySelector('.empty'))root.innerHTML='<div class="empty">Sin movimientos válidos capturados.</div>'}
function clean(){cleanRoot(document.getElementById('homeFeed'));cleanRoot(document.getElementById('activityList'))}
function boot(){clean();for(const id of ['homeFeed','activityList']){const root=document.getElementById(id);if(root)new MutationObserver(()=>cleanRoot(root)).observe(root,{childList:true,subtree:true,characterData:true})}window.addEventListener('focus',clean);window.addEventListener('pageshow',clean)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
