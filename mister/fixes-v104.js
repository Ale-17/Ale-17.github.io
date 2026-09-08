(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
let latestCache={at:0,data:null};
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isGuarded(input){const u=urlOf(input);return !!u&&/\/data\/(decision_center|smart_alerts)\.json$/i.test(u.pathname)}
async function latest(){if(latestCache.data&&Date.now()-latestCache.at<5000)return latestCache.data;const r=await nativeFetch(`./data/latest.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`latest ${r.status}`);const d=await r.json();latestCache={at:Date.now(),data:d};return d}
function emptyFor(path,snapshotAt,feedAt){if(/smart_alerts\.json$/i.test(path))return{status:'ok',schema_version:1,snapshot_at:snapshotAt,generated_at:new Date().toISOString(),alerts:[],summary:{total:0,important:0,critical:0,notifyable:0,categories:{}},stale_source_snapshot_at:feedAt||null,stale_suppressed:true};return{status:'ok',snapshot_at:snapshotAt,generated_at:new Date().toISOString(),decision_count:0,counts:{clause:0,buy:0,lineup:0},domain_counts:{},decisions:[],market_diagnostics:[],suppressed:[],stale_source_snapshot_at:feedAt||null,stale_suppressed:true}}
window.fetch=async function(input,init){if(!isGuarded(input))return nativeFetch(input,init);const response=await nativeFetch(input,{...(init||{}),cache:'no-store'});if(!response.ok)return response;const fallback=response.clone();try{const [feed,cur]=await Promise.all([response.json(),latest()]);const feedAt=String(feed?.snapshot_at||'');const latestAt=String(cur?.captured_at||'');if(!latestAt||feedAt===latestAt)return new Response(JSON.stringify(feed),{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)});const u=urlOf(input);const clean=emptyFor(u?.pathname||'',latestAt,feedAt);const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('x-fantasy-stale-suppressed','v104');return new Response(JSON.stringify(clean),{status:200,statusText:'OK',headers})}catch{return fallback}};
function refreshConsumers(){latestCache={at:0,data:null};try{window.dispatchEvent(new Event('focus'))}catch{}try{document.dispatchEvent(new Event('visibilitychange'))}catch{}try{window.dispatchEvent(new CustomEvent('fantasy:ready'))}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshConsumers,350),{once:true});else setTimeout(refreshConsumers,350);
window.addEventListener('pageshow',()=>setTimeout(refreshConsumers,100));
})();
