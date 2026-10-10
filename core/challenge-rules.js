/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   challenge-rules.js — 挑戰條件的「規則與存取」（不依賴 three.js）
   2026-10-02 從 challenge.js 拆出：席位大廳 pairing.html 沒有 importmap，
   不能載入 three，只需要「哪關開放哪些條件」與 PK 條件存取。
   challenge.js 會原樣 re-export，關卡端 import 不用改。
   ============================================================ */
export const WIND_LEVELS=[{v:0,label:'無'},{v:1.2,label:'微風'},{v:2.5,label:'強風'}];
export const GEAR_LABEL={1:'一檔',2:'二檔'};

/* 哪些關卡開放哪些條件（老師定案：t01～t05 固定標準；t06 風是主題；
   t07 以後＋情境＋PK 開放；足球只開放無定高與檔位）。沒列出＝不開放。 */
const T_LATE=['t07','t08','t09','t10','t11'];
const DRONE_SCN=['x-cargo','x-chase','x-infinite'];
export function challengeAllow(levelId){
  if(T_LATE.includes(levelId)||DRONE_SCN.includes(levelId)) return {hold:true,wind:true,gear:true};
  if(levelId==='x-hover') return {hold:true,wind:false,gear:true};           // 本關難度本身就是風，不再疊加
  // 情境 5 關（YawDrone）：各關中/高級難度本來就有風、守門是封閉網籠 → 只開放定高＋檔位
  if(['x-agri','x-bridge','x-rescue','x-inspection','x-goalkeeper'].includes(levelId)) return {hold:true,wind:false,gear:true};
  // 第三批 PK 對戰（2026-10-02）：條件在席位大廳統一選、雙方相同；AI 席不套用定高／檔位
  if(['cargo-pk','chase-pk','infinite-pk'].includes(levelId)) return {hold:true,wind:true,gear:true};
  if(['x-hover-pk','agri-pk','bridge-pk','rescue-pk','inspection-pk','goalkeeper-pk'].includes(levelId)) return {hold:true,wind:false,gear:true};
  if(levelId==='acro-freeflight') return {hold:false,wind:true,gear:true};    // 自己有模式切換（角度／Acro／街機），定高選項不適用；風改由挑戰條件提供（原 R 鍵移除）
  return {hold:false,wind:false,gear:false};
}

const STORE_PK='nd.settings.challengePk';
export function loadPkConditions(levelId){
  const allow=challengeAllow(levelId);
  let s={}; try{ const v=JSON.parse(localStorage.getItem(STORE_PK)); if(v&&typeof v==='object')s=v; }catch{}
  return {allow,
    hold: allow.hold ? (s.hold!==false) : true,
    wind: allow.wind ? Math.max(0,Math.min(2,s.wind|0)) : 0,
    gear: allow.gear ? (s.gear===2?2:1) : 1};
}
export function savePkConditions(c){
  try{ localStorage.setItem(STORE_PK,JSON.stringify({hold:c.hold!==false,wind:c.wind|0,gear:c.gear===2?2:1})); }catch{}
}
export function conditionTag(c){
  const t=[];
  if(!c.hold)t.push('無定高');
  if(c.wind)t.push(WIND_LEVELS[c.wind].label);
  if(c.gear===2)t.push('二檔');
  return t.join('・');
}
