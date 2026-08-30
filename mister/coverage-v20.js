(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let data=null,queued=false;
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').trim();
async function load(){try{const r=await fetch(`./data/transfer_insights.json?v=${Date.now()}`,{cache:'no-store'});if(r.ok)data=await r.json()}catch{}render()}
function stat(name){return data?.manager_bid_analytics?.[clean(name)]||null}
function qualityText(s){return `${s.vm_quality_high||0} alta · ${s.vm_quality_estimated||0} estim.`}
function patchGrid(grid,s){if(!grid||!s)return;[...grid.querySelectorAll('div')].forEach(cell=>{const label=cell.querySelector('span'),strong=cell.querySelector('strong');if(!label)return;if(label.textContent.trim()==='VM históricos usados'||label.textContent.trim()==='VM reconstruidos'){label.textContent='VM reconstruidos';if(strong)strong.textContent=`${s.vm_reference_wins}/${s.wins}`;cell.title='Incluye referencias históricas directas y reconstrucciones estimadas.'}});let q=grid.querySelector('.v20-vm-quality');if(!q){q=document.createElement('div');q.className='v19-extra-metric v20-vm-quality';q.innerHTML='<span>Calidad VM</span><strong></strong>';grid.appendChild(q)}q.querySelector('strong').textContent=qualityText(s);q.title=`Alta confianza: ${s.vm_quality_high||0}. Estimadas: ${s.vm_quality_estimated||0}.`}
function patchRival(){const sheet=$('.v18-rival-sheet');if(!sheet)return;const s=stat(sheet.querySelector('h2')?.textContent);if(!s)return;const behavior=[...sheet.querySelectorAll('.v18-rival-section')].find(x=>x.querySelector('h3')?.textContent.includes('Comportamiento'));patchGrid(behavior?.querySelector('.v18-rival-grid'),s)}
function patchRadar(){$$('.v18-bid-manager').forEach(card=>{const s=stat(card.querySelector('summary strong')?.textContent);if(s)patchGrid(card.querySelector('.v18-bid-metrics'),s)})}
function render(){if(!data)return;patchRival();patchRadar()}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
window.addEventListener('DOMContentLoaded',()=>{setTimeout(load,220);setTimeout(queue,1000);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true})});
})();
