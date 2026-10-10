/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   levels-page-common.js — 分類子頁面共用渲染工具（ES Module）
   newdrone Phase 5.5｜index 選單分頁化
   ------------------------------------------------------------
   五個 pages/levels-*.html（basic/advanced/soccer/scenario/pk）
   都是同一種版型：一份分類說明 + 一個關卡卡片格線，只有篩選出的
   關卡清單不同。共用邏輯抽在這裡，避免五份檔案各自維護一份
   esc()／isLocked()／卡片 HTML，改一次全部同步。

   注意：lv.file 是相對於專案根目錄的路徑（如 'levels/t01-...html'），
   這裡的頁面放在 pages/ 底下，所以連結要補 '../' 前綴——
   跟 pages/pairing.html 的 location.href='../'+LEVEL.file 是同一慣例。
   ============================================================ */
import { GATED, gateState, gateReady } from '../data/gate.js';   // 2026-10-06 基礎＋進階全過才開放其他分類
export function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* 前置關卡不存在於 LEVELS（尚未上線）一律視為不鎖——見 manifest t06 註解。
   解鎖鏈是跨分類的（t06 屬於「進階訓練」但依賴屬於「基礎訓練」的 t05），
   所以這裡永遠用完整的 LEVELS 陣列去找前置關卡，不是只找同分類內的關卡。 */
export function isLocked(lv, LEVELS, progress){
  if(!lv.unlockAfter)return false;
  const pre=LEVELS.find(l=>l.id===lv.unlockAfter);
  if(!pre)return false;
  const rec=progress.get(pre.id);
  return !(rec && rec[pre.doneField||'completed']);
}

export function renderLevelGrid(gridEl, levels, LEVELS, progress){
  // 這一頁全是「要先通過基礎＋進階」的關，而且還沒開放 → 不列關卡，只說明條件
  const g=gateState(LEVELS, progress);
  if(levels.length&&levels.every(GATED)&&!g.open){
    gridEl.innerHTML=`<div id="gate-msg" style="grid-column:1/-1;padding:28px 18px;text-align:center;border:1px dashed rgba(148,163,184,.5);border-radius:12px;color:#cbd5e1;line-height:1.9;font-size:14px;">
      🔒 這一區還沒開放<br>先通過「基礎訓練」和「進階訓練」的全部關卡（目前 ${g.done} / ${g.total}）<br>
      <a href="levels-basic.html" style="color:#00eeff">去基礎訓練</a>　<a href="levels-advanced.html" style="color:#00eeff">去進階訓練</a></div>`;
    gateReady().then(all=>{ if(all)renderLevelGrid(gridEl, levels, LEVELS, progress); });      // 活動版全部開放：設定檔讀到後重畫
    return;
  }
  gridEl.innerHTML=levels.map(lv=>{
    const rec=progress.get(lv.id);
    const done=!!(rec && rec[lv.doneField||'completed']);
    const locked=isLocked(lv, LEVELS, progress);
    return `<a id="lv-${esc(lv.id)}" class="card${locked?' locked':''}" href="${locked?'#':'../'+lv.file}">
      ${done?'<span class="badge done">✔ 已完成</span>':locked?'<span class="badge locked">🔒 未解鎖</span>':''}
      <h2>${lv.emoji||''} ${esc(lv.title)}</h2>
      <p>${esc(lv.desc||'')}${lv.hint?`<span class="tag"><br>${esc(lv.hint)}</span>`:''}</p>
    </a>`;
  }).join('');
  // 從關卡回來（網址帶 #lv-關卡代號）：捲到那一關的卡片並標出來（2026-10-05 關卡動線）
  const here=location.hash&&document.getElementById(location.hash.slice(1));
  if(here&&gridEl.contains(here)){
    here.style.outline='3px solid rgba(255,255,255,.85)'; here.style.outlineOffset='2px';
    try{ here.scrollIntoView({block:'center'}); here.focus({preventScroll:true}); }catch{}
  }
}
