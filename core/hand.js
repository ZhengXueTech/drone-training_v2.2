/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   hand.js — 美國手／日本手（2026-10-10，老師定案：學生兩種都有人用）
   ------------------------------------------------------------
   · 美國手（Mode 2）：左手＝油門＋轉向，右手＝前後＋左右（預設）
   · 日本手（Mode 1）：左手＝前後＋轉向，右手＝油門＋左右
   跟著「這位飛手」記（nd.hand.<班級|座號|姓名>），共用平板換人登入就自動換；
   首頁身分列、每關暫停選單都能切。套用範圍：Xbox／PS 手把、觸控雙搖桿、VR 手把。
   真的遙控器（搖桿精靈或設定檔）照實體設定，不受影響——精靈是「照功能推」，日本手的遙控器設定完本來就是日本手。
   沒有任何 import（input.js、ui.js 都會用到這裡，避免循環）。
   ============================================================ */
const LEGACY='droneSimFlightMode';      // 基本版留下的整台機器設定，只當「這位飛手還沒選過」時的預設
function who(){ try{ const s=JSON.parse(localStorage.getItem('nd.student')||'{}'); return (s.classId||'')+'|'+(s.seat||'')+'|'+(s.name||''); }catch{ return ''; } }
export function getHand(){
  try{ return localStorage.getItem('nd.hand.'+who())||localStorage.getItem(LEGACY)||'2'; }catch{ return '2'; }
}
export function setHand(m){
  m=m==='1'?'1':'2';
  try{ localStorage.setItem('nd.hand.'+who(),m); }catch{}
  try{ dispatchEvent(new CustomEvent('nd-hand',{detail:m})); }catch{}
  return m;
}
export function toggleHand(){ return setHand(getHand()==='1'?'2':'1'); }
export function handName(m=getHand()){ return m==='1'?'日本手':'美國手'; }
export function handLabel(m=getHand()){ return m==='1'?'日本手（Mode 1）':'美國手（Mode 2）'; }
/* 一句話說明（教學、按鍵說明用） */
export function handDesc(m=getHand()){
  return m==='1'?'左手＝前後＋轉向，右手＝高度（油門）＋左右':'左手＝高度（油門）＋轉向，右手＝前後＋左右';
}
