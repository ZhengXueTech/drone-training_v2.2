/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   parts.js — 改裝零件與機體數值（2026-10-09，改裝賽道第一階段；設計稿＝專案 claude/newdrone-改機設計.md）
   ------------------------------------------------------------
   四類零件各三選一，全部開放（老師定案）。每個零件只是一組「倍率」，
   賽道關卡用 specOf(build) 算出整台機體的倍率，套在街機模式的物理常數上（physics.js 不動）。
   取捨是教學重點：沒有最強的組合。
   ============================================================ */
const STORE='nd.garage.build';
export const PART_TYPES=[
  {key:'motor',name:'馬達',emoji:'⚙️',opts:[
    {id:'torque',name:'低速大扭力',m:{accel:1.25,climb:1.15,speed:0.88,drain:0.9},
     why:'轉速比較低、但力氣大：起步和爬升很有力，極速比較慢，也比較省電。'},
    {id:'std',name:'標準',m:{},why:'各方面平均，適合先熟悉賽道。'},
    {id:'speed',name:'高速',m:{speed:1.3,accel:0.92,drain:1.5},
     why:'轉速高、極速快，但起步沒那麼猛，而且很耗電——可能要多進站一次。'}]},
  {key:'prop',name:'槳葉',emoji:'🌀',opts:[
    {id:'small',name:'小槳',m:{speed:1.08,accel:0.9,yaw:1.15,twitch:1.25,drain:0.85},
     why:'槳小、推開的空氣少：反應靈敏、轉向快，但推力小一點；手抖也比較容易晃。'},
    {id:'std',name:'標準',m:{},why:'推力和靈敏度平均。'},
    {id:'big',name:'大槳',m:{accel:1.25,climb:1.2,speed:0.95,yaw:0.9,twitch:0.85,drain:1.25},
     why:'槳越大、推開的空氣越多，推力變大；但馬達負擔變重、比較耗電，轉向也比較鈍。'}]},
  {key:'battery',name:'電池',emoji:'🔋',opts:[
    {id:'light',name:'輕巧',m:{cap:0.65,mass:0.88},
     why:'容量小、重量輕：機體比較靈活，但很快就要進站換電池。'},
    {id:'std',name:'標準',m:{},why:'容量和重量平均，3 圈大多要進站 1 次。'},
    {id:'large',name:'大容量',m:{cap:1.5,mass:1.3,speed:0.95},
     why:'容量大、可以少進站甚至不進站，但機體變重：加速、爬升、轉向都變慢。'}]},
  {key:'frame',name:'機架',emoji:'🛸',opts:[
    {id:'light',name:'輕量',m:{mass:0.88,dur:0.6},
     why:'機架輕：整台更靈活，但撞到牆損失比較大。'},
    {id:'std',name:'標準',m:{},why:'重量和耐撞平均。'},
    {id:'guard',name:'護框',m:{mass:1.18,dur:2,speed:0.96},
     why:'加了保護框：撞到牆幾乎不掉電，但比較重、風阻也大一點。'}]},
];
export const DEFAULT_BUILD={motor:'std',prop:'std',battery:'std',frame:'std'};

export function loadBuild(){
  try{ const v=JSON.parse(localStorage.getItem(STORE)); if(v&&typeof v==='object')return {...DEFAULT_BUILD,...v}; }catch{}
  return {...DEFAULT_BUILD};
}
export function saveBuild(b){ try{ localStorage.setItem(STORE,JSON.stringify(b)); }catch{} }
export function partOf(type,id){ const t=PART_TYPES.find(x=>x.key===type); return t&&(t.opts.find(o=>o.id===id)||t.opts[1]); }

/* 整台機體的倍率：零件倍率相乘，再依總重量修正加速／爬升／轉向 */
export function specOf(build){
  const s={speed:1,accel:1,climb:1,yaw:1,twitch:1,drain:1,cap:1,mass:1,dur:1};
  for(const t of PART_TYPES){ const p=partOf(t.key,build[t.key]); for(const k in p.m)s[k]*=p.m[k]; }
  s.accel/=s.mass; s.climb/=s.mass; s.yaw/=Math.sqrt(s.mass);
  return s;
}
export const BASE_DRAIN=2.2;          // 標準機每秒耗電 %（標準電池約 45 秒；3 圈 50～90 秒＝大多要進站 1 次）
export function enduranceSec(spec){ return Math.round(100*spec.cap/(BASE_DRAIN*spec.drain)); }
/* 數值條（0～100，標準機＝50） */
export function bars(spec){
  const c=v=>Math.max(5,Math.min(100,Math.round(50*v)));
  return [
    {key:'thrust',name:'推力',v:c(Math.sqrt(spec.accel*spec.climb))},
    {key:'speed',name:'極速',v:c(spec.speed)},
    {key:'agile',name:'靈敏',v:c(Math.sqrt(spec.yaw*spec.twitch))},
    {key:'endure',name:'續航',v:c(spec.cap/spec.drain)},
    {key:'tough',name:'耐撞',v:c(Math.sqrt(spec.dur))},
  ];
}
export function buildLabel(build){
  return PART_TYPES.map(t=>{ const p=partOf(t.key,build[t.key]); return p.id==='std'?null:p.name; }).filter(Boolean).join('＋')||'標準機';
}

/* 小任務（老師定案：每個零件一句原理＋小任務）。check(r)：r＝賽道結算資料 */
const MSTORE='nd.race.missions';
export const MISSIONS=[
  {id:'nopit',name:'不進站跑完 3 圈',hint:'提示：續航夠不夠？電池和馬達怎麼搭最省電？',check:r=>r.finished&&r.pits===0},
  {id:'fast',name:'操場入門 3 圈 60 秒內',hint:'提示：極速和進站次數要取捨。',check:r=>r.finished&&(r.track||'race-playground')==='race-playground'&&r.time<=60},
  {id:'forest',name:'森林峽谷 3 圈 90 秒內',hint:'提示：太快會撞樹，轉向靈不靈活很重要。',check:r=>r.finished&&r.track==='race-forest'&&r.time<=90},
  {id:'light',name:'用「輕巧電池」跑完 3 圈',hint:'提示：電量很快就沒，要算好什麼時候進站。',check:r=>r.finished&&r.build.battery==='light'},
  {id:'clean',name:'一次都沒撞到（牆、樹、岩石）跑完',hint:'提示：靈敏度太高的機比較難穩。',check:r=>r.finished&&r.hits===0},
  /* 2026-10-10 第二階段新賽道的小任務（老師：新增小任務） */
  {id:'city',name:'城市高樓 3 圈 100 秒內',hint:'提示：亂流區要一直小修正，被吹走就浪費時間。',check:r=>r.finished&&r.track==='race-city'&&r.time<=100},
  {id:'citylight',name:'用「輕巧電池＋輕量機架」跑完城市高樓',hint:'提示：最輕的機最怕風——亂流區要怎麼過？',check:r=>r.finished&&r.track==='race-city'&&r.build.battery==='light'&&r.build.frame==='light'},
  {id:'gym',name:'室內體育館 3 圈 70 秒內',hint:'提示：一圈很短、轉彎很多，轉向靈活比極速重要。',check:r=>r.finished&&r.track==='race-gym'&&r.time<=70},
  {id:'neon',name:'夜間霓虹 不進站跑完 3 圈',hint:'提示：這條最長，標準機的電一定不夠——續航要怎麼湊？綠環也算。',check:r=>r.finished&&r.track==='race-neon'&&r.pits===0},
];
export function missionsDone(){ try{ return JSON.parse(localStorage.getItem(MSTORE))||{}; }catch{ return {}; } }
export function markMissions(r){
  const d=missionsDone(), got=[];
  for(const m of MISSIONS){ if(!d[m.id]&&m.check(r)){ d[m.id]={at:new Date().toISOString(),build:buildLabel(r.build)}; got.push(m); } }
  try{ localStorage.setItem(MSTORE,JSON.stringify(d)); }catch{}
  return got;
}
