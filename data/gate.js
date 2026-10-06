/* ============================================================
   gate.js — 關卡開放條件（2026-10-06）
   ------------------------------------------------------------
   規則：基礎訓練（第 1～5 關）和進階訓練（第 6～11 關）全部通過之後，
        足球對戰、情境體驗（單人）、情境體驗對戰（PK）才開放。自由練習沙盒不算在條件裡。
   彩蛋：在首頁連點標題「NEWDRONE」七下 → 這次開瀏覽器期間全部開放（存 sessionStorage，關掉就失效）。
        老師沒有開關可以關掉彩蛋（老師 2026-10-06 決定）。
   只擋「選單進得去進不去」：老師發的考場代碼、直接開關卡網址都不擋。
   ============================================================ */
const EGG='nd.egg';
let _all=false, _ready=null;
/* 活動版（data/cloud-config.json 的 edition.unlockAll）：全部開放。設定檔要用抓的，所以先照一般規則畫，抓到後再重畫一次。
   回傳 Promise<是否全部開放> */
export function gateReady(){
  return _ready||(_ready=fetch(new URL('./cloud-config.json',import.meta.url),{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>(_all=!!(c&&c.edition&&c.edition.unlockAll))).catch(()=>false));
}
const NEED=lv=>lv.part==='A'||lv.part==='B';          // 要先通過的關
export const GATED=lv=>lv.part==='C'||lv.part==='D';  // 被擋的關
export function eggOn(){ try{ return sessionStorage.getItem(EGG)==='1'; }catch{ return false; } }
export function eggSet(){ try{ sessionStorage.setItem(EGG,'1'); }catch{} }
/* 回傳 {open, done, total, egg}：open＝可以進被擋的分類 */
export function gateState(LEVELS,progress){
  const need=LEVELS.filter(NEED), done=need.filter(lv=>{ const r=progress.get(lv.id); return !!(r&&r[lv.doneField||'completed']); }).length;
  const egg=eggOn();
  return {open:_all||egg||done>=need.length,done,total:need.length,egg,all:_all};
}
/* 首頁標題連點 n 下（每下間隔不超過 1.2 秒）就呼叫 onUnlock */
export function bindEgg(el,onUnlock,n=7){
  if(!el)return;
  let c=0,last=0;
  el.style.touchAction='manipulation'; el.style.userSelect='none'; el.style.webkitUserSelect='none';
  el.addEventListener('click',()=>{
    const t=Date.now(); c=(t-last<=1200)?c+1:1; last=t;
    if(c>=n){ c=0; if(!eggOn()){ eggSet(); onUnlock(); } }
  });
}
