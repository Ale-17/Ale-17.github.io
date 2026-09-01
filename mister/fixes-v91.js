(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isDecisionReview(input){const u=urlOf(input);return !!u&&/\/data\/decision_review\.json$/i.test(u.pathname)}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function kind(row){return row?.decision_kind||row?.type}
function veryClearHold(row){
  if(kind(row)!=='hold'||row?.resolved===true)return true;
  const m=row?.metrics||{},weekly=n(m.weekly_pct),daily=n(m.daily_pct),offer=n(m.offer_vs_vm_pct);
  if(weekly===null||offer===null)return false;
  return (weekly>=35&&offer<=1)||(weekly>=25&&offer<=-3)||(offer<=-7&&weekly>=0)||(weekly>=20&&daily!==null&&daily>=4&&offer<=-4);
}
function rebuildSummary(data,rows){
  const kinds=rows.map(kind),resolved=rows.filter(x=>x?.resolved===true),open=rows.filter(x=>x?.resolved!==true);
  return {...(data.summary||{}),decisions:rows.length,resolved_decisions:resolved.length,open_decisions:open.length,scored_decisions:resolved.filter(x=>x?.score!==null&&x?.score!==undefined).length,bids:kinds.filter(x=>x==='buy'||x==='lost_bid').length,missed_opportunities:kinds.filter(x=>x==='skip_buy').length,purchases:kinds.filter(x=>x==='buy').length,sales:kinds.filter(x=>x==='sale').length,holds:kinds.filter(x=>x==='hold').length,lineups:kinds.filter(x=>x==='lineup').length};
}
function filterReview(data){
  if(!data||data.mode!=='today'||!Array.isArray(data.decisions))return data;
  const before=data.decisions,rows=before.filter(veryClearHold),removed=before.filter(x=>kind(x)==='hold'&&x?.resolved!==true&&!veryClearHold(x));
  return {...data,decisions:rows,summary:rebuildSummary(data,rows),v91_hold_filter:{mode:'very_clear_only',candidate_holds:before.filter(x=>kind(x)==='hold'&&x?.resolved!==true).length,kept_holds:rows.filter(x=>kind(x)==='hold'&&x?.resolved!==true).length,removed_holds:removed.length,criteria:{strong_momentum:'7d >= 35% and offer <= +1% vs VM',undervalued_offer:'7d >= 25% and offer <= -3% vs VM',deep_discount:'offer <= -7% vs VM while not falling',accelerating_discount:'7d >= 20%, 24h >= 4%, offer <= -4% vs VM'}}};
}
window.fetch=async function(input,init){
  const response=await nativeFetch(input,init);
  if(!isDecisionReview(input)||!response.ok)return response;
  const fallback=response.clone();
  try{
    const data=filterReview(await response.json()),headers=new Headers(response.headers);
    headers.set('content-type','application/json; charset=utf-8');
    headers.set('x-fantasy-decision-filter','v91');
    return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
  }catch{return fallback}
};
window.FantasyOSV91={filterReview,veryClearHold};
})();