(()=>{
'use strict';

// V35 enriches player_details with the full-player Mister sweep.
const nativeFetch=window.fetch.bind(window);
const TTL=20000;
let liveCache={at:0,data:null};

function urlOf(input){
  try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}
}
function isPlayerDetails(input){
  const u=urlOf(input);return !!u&&/\/data\/player_details\.json$/i.test(u.pathname)
}
function n(v){return Number.isFinite(Number(v))?Number(v):null}
function gameweekNumber(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):9999}
function eventStats(tokens){
  const list=Array.isArray(tokens)?tokens:[];
  let goals=0,assists=0;
  for(const raw of list){
    const t=String(raw||'').toLowerCase();
    if(/goal(?!assist)|events-goal|#goal\b|\bgol\b/.test(t))goals++;
    if(/assist|asistencia/.test(t))assists++;
  }
  const stats={};if(goals)stats.goals=goals;if(assists)stats.goalAssist=assists;return stats
}
function normalizeRecent(row){
  const role=String(row?.role||'').toLowerCase();
  const starter=row?.starter===true||role==='starter'?true:row?.starter===false||role==='bench'?false:null;
  return {
    gameweek_id:String(row?.gameweek_id||''),
    gameweek:row?.gameweek||null,
    status:'played',
    points:n(row?.points),
    starter,
    minutes:n(row?.minutes),
    sofascore_rating:n(row?.sofascore_rating),
    stats:{...(row?.stats||{})}
  }
}
async function liveData(){
  if(liveCache.data&&Date.now()-liveCache.at<TTL)return liveCache.data;
  try{
    const r=await nativeFetch(`./data/gameweek_live.json?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)return null;
    const data=await r.json();liveCache={at:Date.now(),data};return data
  }catch{return null}
}
function upsertMatch(node,row){
  if(!row?.gameweek_id)return;
  const rows=Array.isArray(node.matches)?node.matches:(node.matches=[]);
  const idx=rows.findIndex(x=>String(x?.gameweek_id||'')===String(row.gameweek_id));
  if(idx<0)rows.push(row);
  else{
    const old=rows[idx]||{};
    rows[idx]={...row,...old,stats:{...(row.stats||{}),...(old.stats||{})}};
  }
}
function enrich(details,live){
  if(!details||typeof details!=='object'||!live||typeof live!=='object')return details;
  const players=details.players&&typeof details.players==='object'?details.players:(details.players={});
  const currentGid=String(live.gameweek_id||'');
  for(const match of (Array.isArray(live.matches)?live.matches:[])){
    for(const p of (Array.isArray(match?.all_players)?match.all_players:[])){
      const pid=String(p?.player_id||'');if(!pid)continue;
      const node=players[pid]&&typeof players[pid]==='object'?players[pid]:(players[pid]={matches:[]});
      if(!Array.isArray(node.matches))node.matches=[];
      for(const r of (Array.isArray(p?.recent)?p.recent:[]))upsertMatch(node,normalizeRecent(r));
      if(currentGid&&p?.points!==null&&p?.points!==undefined&&(match?.status==='played'||match?.status==='playing')){
        upsertMatch(node,{
          gameweek_id:currentGid,
          gameweek:live.name||`J${live.gameweek_number||''}`,
          status:match.status,
          points:n(p.points),
          starter:null,
          minutes:null,
          sofascore_rating:null,
          stats:eventStats(p.event_tokens)
        });
      }
      node._fantasy_v35={
        source:'Mister all-player sweep',
        owner_name:p.owner_name||null,
        lineup_status:match?.lineup_status||null,
        match_id:String(match?.match_id||''),
        recent_avg_points:n(p.recent_avg_points),
        recent_starts:n(p.recent_starts),
        recent_games:n(p.recent_games)
      };
      node.matches.sort((a,b)=>gameweekNumber(a?.gameweek||a?.gameweek_id)-gameweekNumber(b?.gameweek||b?.gameweek_id));
    }
  }
  details._fantasy_v35={
    source:'gameweek_live.all_players',
    gameweek_id:currentGid,
    captured_at:live?.all_player_intelligence?.captured_at||live?.captured_at||null
  };
  return details
}

window.fetch=async function(input,init){
  if(!isPlayerDetails(input))return nativeFetch(input,init);
  const response=await nativeFetch(input,init);
  if(!response.ok)return response;
  const fallback=response.clone();
  try{
    const [details,live]=await Promise.all([response.json(),liveData()]);
    if(!live)return fallback;
    const merged=enrich(details,live);
    const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('x-fantasy-intelligence','v35');
    return new Response(JSON.stringify(merged),{status:response.status,statusText:response.statusText,headers});
  }catch{return fallback}
};

function loadV37(){
  if(!document.querySelector('link[data-fantasy-v37]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fixes-v37.css?v=37';l.dataset.fantasyV37='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-fantasy-v37]')){const s=document.createElement('script');s.src='./fixes-v37.js?v=37';s.async=false;s.dataset.fantasyV37='1';document.head.appendChild(s)}
}
function loadV36(){
  if(!document.querySelector('link[data-fantasy-v36]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fixes-v36.css?v=36';l.dataset.fantasyV36='1';document.head.appendChild(l)}
  const existing=document.querySelector('script[data-fantasy-v36]');
  if(existing){loadV37();return}
  const s=document.createElement('script');s.src='./fixes-v36.js?v=36';s.async=false;s.dataset.fantasyV36='1';s.addEventListener('load',loadV37,{once:true});document.head.appendChild(s)
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadV36,{once:true});else setTimeout(loadV36,0);
})();