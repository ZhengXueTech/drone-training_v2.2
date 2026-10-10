/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   score-rule.js — 哪一種成績算「比較好」（2026-10-08）
   ------------------------------------------------------------
   大多數關卡的成績是分數，越高越好。第 2、3、4 關的成績是「完成秒數」，越少越好——
   原本一律取大的，結果這三關的「最佳成績」留下的是最慢的一次。
   所有「兩筆成績取好的那一筆」的地方（本機紀錄、登入時與雲端合併、補傳、收件匣）都改用這裡的函式。
   雲端程式 tools/gas/Code.gs 的 LOWER_BETTER 要和這裡一致。
   這個檔案不 import 任何東西，避免模組互相引用。
   ============================================================ */
export const LOWER_BETTER=new Set(['t02','t03','t04','race-playground','race-forest','race-city','race-gym','race-neon']);   // 2026-10-09 改裝賽道：總秒數
export const lowerBetter=id=>LOWER_BETTER.has(String(id));
/* 兩個成績取比較好的；其中一個不是數字就回另一個；都不是回 undefined */
export function pickBest(id,a,b){
  const na=typeof a==='number'&&isFinite(a), nb=typeof b==='number'&&isFinite(b);
  if(!na&&!nb)return undefined; if(!na)return b; if(!nb)return a;
  return lowerBetter(id)?Math.min(a,b):Math.max(a,b);
}
/* a 是不是比 b 好（b 不是數字＝a 比較好；a 不是數字＝不是） */
export function isBetter(id,a,b){
  if(typeof a!=='number')return false; if(typeof b!=='number')return true;
  return lowerBetter(id)?a<b:a>b;
}
