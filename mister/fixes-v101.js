(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const clean=v=>String(v??'').replace(/\s*💥\s*/g,'').replace(/\s+/g,' ').trim();
let intent={until:0,id:'',name:''},preserved=null,observer=null;
function feedRow(target){return target?.closest?.('#homeFeed .feed-row,#activityList .feed-row')||null}
function rememberIntent(e){const row=feedRow(e.target);if(!row)return;intent={until:Date.now()+3000,id:String(row.dataset.v38PlayerId||row.dataset.playerId||''),name:clean(row.querySelector('.feed-copy strong')?.textContent)};preserved=null}
function activeFor(id){if(Date.now()>intent.until)return false;const wanted=String(intent.id||''),actual=String(id||'');return !wanted||!actual||wanted===actual}
function informationScore(root){if(!root)return 0;let score=0;for(const el of root.querySelectorAll('strong')){const t=clean(el.textContent);if(t&&t!=='—')score+=1}score+=root.querySelectorAll('.v38-summary>div,.v38-form-card').length*2;score+=root.querySelectorAll('.v38-match').length*4;if(root.querySelector('.v38-spark'))score+=4;if(/sin hist[oó]rico disponible todav[ií]a/i.test(root.textContent||''))score-=8;return score}
function cloneProtected(article){const clone=article.cloneNode(true);clone.dataset.v39Upgrading='v101-preserve';clone.dataset.v101FeedPreserved='1';return clone}
function protectV38(article){if(!article||article.dataset.v101FeedPreserved==='1')return false;const id=article.getAttribute('data-v38-profile')||'';if(!activeFor(id))return false;const clone=cloneProtected(article),score=informationScore(article);preserved={id:String(id),html:clone.outerHTML,score,until:Date.now()+3500};article.replaceWith(clone);return true}
function restoreIfDowngraded(article){if(!article||!preserved||Date.now()>preserved.until)return false;const id=String(article.getAttribute('data-v39-profile')||'');if(preserved.id&&id&&preserved.id!==id)return false;const nextScore=informationScore(article);if(nextScore>=preserved.score)return false;const wrap=document.createElement('div');wrap.innerHTML=preserved.html;const clone=wrap.firstElementChild;if(!clone)return false;article.replaceWith(clone);return true}
function scan(){const host=$('#sheetContent');if(!host)return;const v38=$('.v38-player-shell:not([data-v101-feed-preserved])',host);if(v38&&protectV38(v38))return;const v39=$('.v39-player-shell',host);if(v39)restoreIfDowngraded(v39)}
function init(){window.addEventListener('pointerdown',rememberIntent,true);window.addEventListener('touchstart',rememberIntent,{capture:true,passive:true});const host=$('#sheetContent');if(!host)return;observer=new MutationObserver(scan);observer.observe(host,{childList:true,subtree:true});scan()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
