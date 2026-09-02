(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const money=v=>{if(!finite(v)||Number(v)<=0)return'—';const x=Number(v),a=Math.abs(x);if(a>=1e6)return`${(x/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})} M€`;if(a>=1e3)return`${Math.round(x/1e3).toLocaleString('es-ES')}k`;return`${Math.round(x).toLocaleString('es-ES')} €`};
const stamp=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)};
let cache=null,loading=null,queued=false,observer=null;
async function get(path){try{const r=await fetch(`${path}?v=102-${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});return r.ok?await r.json():null}catch{return null}}
async function ensure(){if(cache)return cache;if(loading)return loading;loading=Promise.all([get('./data/player_universe.json'),get('./data/series.json')]).then(([u,s])=>cache={u:u||{players:{}},s:s||{players:{}}}).finally(()=>loading=null);return loading}
function history(data,id){return arr(data.s?.players?.[String(id)]?.points).filter(r=>finite(r?.market_value)&&Number(r.market_value)>0).slice().sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at))}
function marketCard(article,label){return $$('.v38-form-card',article).find(card=>clean($('span',card)?.textContent).toLocaleLowerCase('es-ES')===label.toLocaleLowerCase('es-ES'))||null}
function neutral(card){if(!card)return;const strong=$('strong',card);if(!strong)return;strong.textContent='—';strong.classList.remove('v38-positive','v38-negative');strong.classList.add('v102-neutral')}
function spark(rows){const vals=rows.slice(-24).map(r=>Number(r.market_value));if(vals.length<2)return'';const w=520,h=100,p=5,min=Math.min(...vals),max=Math.max(...vals),rg=max-min||Math.max(max*.02,1),pts=vals.map((v,i)=>[p+i*(w-p*2)/Math.max(1,vals.length-1),h-p-(v-min)/rg*(h-p*2)]),line=pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '),area=`${line} L${pts.at(-1)[0]},${h-p} L${pts[0][0]},${h-p} Z`;return`<svg class="v38-spark v102-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Evolución del valor de mercado capturado"><line class="v38-spark-grid" x1="0" y1="50" x2="${w}" y2="50"/><path class="v38-spark-area" d="${area}"/><path class="v38-spark-line" d="${line}"/></svg>`}
async function patch(article){const id=article?.getAttribute('data-v38-profile');if(!id)return;const data=await ensure();if(!article.isConnected)return;const p=data.u?.players?.[String(id)]||{},rows=history(data,id),last=rows.at(-1)||null,signature=`${id}|${p.last_seen_at||''}|${last?.captured_at||''}`;if(article.dataset.v102Patched===signature)return;article.dataset.v102Patched=signature;
  const today=marketCard(article,'Hoy'),week=marketCard(article,'Semana'),value=marketCard(article,'Valor')||marketCard(article,'Último valor');
  if(!finite(p.daily_market_change))neutral(today);
  if(!finite(p.weekly_market_change))neutral(week);
  if(!finite(p.market_value)||Number(p.market_value)<=0){
    if(value&&last){const label=$('span',value),strong=$('strong',value);if(label)label.textContent='Último valor';if(strong){strong.textContent=money(last.market_value);strong.classList.remove('v38-positive','v38-negative','v102-neutral')}let small=$('small',value);if(!small){small=document.createElement('small');value.appendChild(small)}small.className='v102-last-known';small.textContent=`Último dato capturado · ${stamp(last.captured_at)}`}
    else neutral(value);
  }
  const oldSpark=$('.v38-spark',article);if(oldSpark){const html=spark(rows);if(html){const wrap=document.createElement('div');wrap.innerHTML=html;oldSpark.replaceWith(wrap.firstElementChild)}else oldSpark.remove()}
  const empty=$('.v38-empty',article);if(empty&&/partidos recientes|hist[oó]rico/i.test(clean(empty.textContent))){empty.textContent='Histórico deportivo no capturado para este jugador. No hay datos fiables de minutos, titularidades o Sofascore en la captura actual.';empty.classList.add('v102-data-note')}
  for(const small of $$('.v38-summary small',article))if(/sin hist[oó]rico/i.test(clean(small.textContent)))small.textContent='Sin datos capturados';
}
function scan(){queued=false;const article=$('#sheetContent .v38-player-shell[data-v38-profile]');if(article)patch(article)}
function queue(){if(queued)return;queued=true;requestAnimationFrame(scan)}
function init(){const host=$('#sheetContent');if(!host)return;observer=new MutationObserver(queue);observer.observe(host,{childList:true,subtree:true,characterData:true});queue();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){cache=null;queue()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
