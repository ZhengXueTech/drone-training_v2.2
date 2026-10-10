/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   nav-flow.js — 關卡動線（2026-10-05，規劃書附錄 E.5）
   ------------------------------------------------------------
   老師回饋：從關卡分頁進某一關，離開時卻回到最外層首頁，要再點一次才能選下一關。
   · 離開關卡 → 回到「進來的那一頁」（關卡分頁／配對大廳／首頁），並停在剛剛那一關的卡片。
   · 直接用網址開關卡（沒有來源）→ 回它所屬類別的分頁。
   · 結算畫面多一顆「下一關」：只在同一個類別內接續（不跨區）、下一關已解鎖、是單人關才出現。
   · 暫停選單多「回關卡列表」「回首頁」。
   關卡檔不用改：core/ui.js 的 showModal 看到「返回入口」按鈕就自動換成這裡的行為。
   不依賴 three.js。
   ============================================================ */
import { LEVELS } from '../data/levels-manifest.js';
import { CATEGORIES } from '../data/level-categories.js';
import { progress } from '../data/progress.js';

const KEY='nd.nav.from';
const ROOT=new URL('../',import.meta.url);                       // 專案根目錄
const rel=u=>{ try{ const x=new URL(u,location.href); return x.href.startsWith(ROOT.href)?x.href.slice(ROOT.href.length):null; }catch{ return null; } };
const bare=f=>String(f||'').split(/[?#]/)[0];

/* 目前這一頁是哪一關（不是關卡頁回傳 null） */
export function currentLevel(){
  const here=bare(rel(location.href));
  if(!here||!here.startsWith('levels/'))return null;
  return LEVELS.find(l=>bare(l.playFile||l.file)===here)||null;
}
const catOf=lv=>CATEGORIES.find(c=>c.match(lv))||null;

/* 進關卡時記下「從哪一頁來的」。重新整理、從上一關按「下一關」過來＝沿用原本記的。 */
export function rememberOrigin(){
  if(!currentLevel())return;
  try{
    if(!document.referrer){ sessionStorage.removeItem(KEY); return; }        // 直接開網址：清掉舊紀錄，改用類別分頁
    const r=rel(document.referrer);
    if(r===null)return;                                                      // 從別的網站來：不動
    const p=bare(r);
    if(p.startsWith('levels/'))return;                                       // 從別的關卡來（下一關、重新整理）：不動
    if(p===''||p==='index.html'||p.startsWith('pages/'))sessionStorage.setItem(KEY,JSON.stringify({href:r.split('#')[0]}));
  }catch{}
}
/* 離開關卡要去哪：{href（絕對網址）, label, isHome} */
export function listTarget(){
  const lv=currentLevel();
  let from=null; try{ from=JSON.parse(sessionStorage.getItem(KEY)||'null'); }catch{}
  let href=from&&from.href, p=bare(href||'');
  if(!href&&href!==''){ const c=lv&&catOf(lv); href=c?'pages/'+c.file:'index.html'; p=bare(href); }
  const isHome=(p===''||p==='index.html');
  const label=isHome?'回首頁':p==='pages/pairing.html'?'回配對大廳':'回關卡列表';
  const hash=(!isHome&&lv&&p.startsWith('pages/levels-'))?'#lv-'+lv.id:'';
  return {href:new URL((href||'index.html')+hash,ROOT).href,label,isHome};
}
export const homeHref=()=>new URL('index.html',ROOT).href;

function locked(lv){
  if(!lv.unlockAfter)return false;
  const pre=LEVELS.find(l=>l.id===lv.unlockAfter); if(!pre)return false;
  const rec=progress.get(pre.id); return !(rec&&rec[pre.doneField||'completed']);
}
/* 同類別的下一關（沒有就回傳 null）。只在「剛剛才完成這一關」時給，避免開場畫面也冒出來。 */
export function nextLevel(){
  const lv=currentLevel(); if(!lv)return null;
  try{ const ex=JSON.parse(sessionStorage.getItem('nd.exam')||'null'); if(ex&&ex.levelId===lv.id)return null; }catch{}   // 考核中不帶去別關
  const rec=progress.get(lv.id);
  if(!rec||!rec[lv.doneField||'completed'])return null;
  if(!rec.lastAttempt||Date.now()-new Date(rec.lastAttempt).getTime()>15000)return null;
  const c=catOf(lv); if(!c)return null;
  const list=LEVELS.filter(c.match), nx=list[list.indexOf(lv)+1];
  if(!nx||!nx.file||locked(nx))return null;
  if(nx.modes&&!nx.modes.includes('solo'))return null;                        // 要先進大廳配對的關不直接跳
  return {id:nx.id,title:nx.title,href:new URL(nx.file,ROOT).href};
}
/* 給 ui.showModal 用：把按鈕清單換成新的動線。回傳 {buttons, added（新增的按鈕 id）} */
export function rewriteButtons(title,buttons){
  if(!currentLevel())return {buttons,added:[]};
  const t=listTarget(), added=[], out=[];
  const isPause=/暫停/.test(title||'');
  const go=h=>()=>{ location.href=h; };
  for(const b of buttons){
    if(b&&b.id==='b-back'&&/入口/.test(b.label||'')){
      const nx=isPause?null:nextLevel();
      if(nx){ out.push({id:'b-nextlv',label:'下一關 ▶',onClick:go(nx.href)}); added.push('b-nextlv'); }
      out.push({...b,label:t.label,onClick:go(t.href)});
      if(!t.isHome){ out.push({id:'b-home',label:'回首頁',onClick:go(homeHref())}); added.push('b-home'); }
    }else out.push(b);
  }
  if(isPause&&!out.some(b=>b.id==='b-back'||b.id==='b-list')){
    out.push({id:'b-list',label:t.label,onClick:go(t.href)}); added.push('b-list');
    if(!t.isHome){ out.push({id:'b-home',label:'回首頁',onClick:go(homeHref())}); added.push('b-home'); }
  }
  return {buttons:out,added};
}
/* 關卡頁裡寫死連到首頁的 <a>（例：第一關的「返回入口」）也換掉 */
export function patchBackLinks(){
  if(!currentLevel())return;
  const t=listTarget();
  document.querySelectorAll('a[href="../index.html"]').forEach(a=>{
    a.href=t.href; if(/入口/.test(a.textContent))a.textContent=a.textContent.replace('返回入口',t.label);
  });
}
rememberOrigin();
