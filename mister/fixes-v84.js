(()=>{
'use strict';
const VERSION='84',FEED='./data/smart_alerts.json',CACHE_KEY='fantasy-v83-alert-feed-cache';
function valid(d){return !!d&&d.status==='ok'&&Array.isArray(d.alerts)}
function save(d){if(!valid(d))return false;try{localStorage.setItem(CACHE_KEY,JSON.stringify(d))}catch{}window.FantasyOSAlertFeedV84=d;return true}
async function warm(){try{const r=await fetch(`${FEED}?v=${VERSION}-${Date.now()}`,{cache:'no-store'});if(!r.ok)return false;return save(await r.json())}catch{return false}}
window.FantasyOSGetAlertFeedV84=()=>window.FantasyOSAlertFeedV84||(()=>{try{const d=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return valid(d)?d:null}catch{return null}})();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warm,{once:true});else warm();
window.addEventListener('focus',warm);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')warm()});
})();
