/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   level-categories.js — 關卡分類「單一真相來源」（ES Module）
   newdrone Phase 5.5｜index 選單分頁化
   ------------------------------------------------------------
   2026-07-26：使用者回饋「30 關全塞在同一個訓練關卡區塊裡，
   跟以前版本一樣通通聚集一起，看起來很亂」，改用「首頁分類卡片
   ＋各分類各自一個子頁面」的結構。分類依據直接沿用
   levels-manifest.js 既有的 part 欄位（DEV/A/B/C/D），
   唯獨 D（情境體驗）本身混了「單人」與「PK對戰」兩種性質，
   額外用 modes 是否含 'pk-live' 拆成兩個分類。

   index.html／各 pages/levels-*.html 都 import 這份設定，
   新增關卡分類時只改這裡一處，不必同時改五個頁面。
   ============================================================ */
export const CATEGORIES=[
  { key:'basic', file:'levels-basic.html', emoji:'🎯', title:'基礎訓練',
    desc:'地面安全、搖桿對應、緊急處置、飛行風險、單飛考核（含自由練習沙盒）',
    match: lv => lv.part==='DEV' || lv.part==='A' },
  { key:'advanced', file:'levels-advanced.html', emoji:'🌪️', title:'進階訓練',
    desc:'逆風飛行、精準降落、限電規劃、動態障礙、城市峽谷、搜救任務',
    match: lv => lv.part==='B' },
  { key:'soccer', file:'levels-soccer.html', emoji:'⚽', title:'足球對戰',
    desc:'無人機足球 3v3 單機版與 PVP 多人版（1v1～3v3）',
    match: lv => lv.part==='C' },
  { key:'scenario', file:'levels-scenario.html', emoji:'🚁', title:'情境體驗（單人）',
    desc:'投遞、農噴、巡檢、搜救等真實情境化單人訓練',
    match: lv => lv.part==='D' && !(lv.modes||[]).includes('pk-live') },
  { key:'pk', file:'levels-pk.html', emoji:'🆚', title:'情境體驗對戰（PK）',
    desc:'同場對戰版情境關卡，兩人分割畫面即時互相比拚',
    match: lv => lv.part==='D' && (lv.modes||[]).includes('pk-live') },
  { key:'race', file:'levels-race.html', emoji:'🏁', title:'改裝賽道',
    desc:'到機庫換馬達、槳葉、電池、機架，組一台自己的無人機跑穿圈賽道（2026-10-09 新增）',
    match: lv => lv.part==='R' },
];
