/* ============================================================
   keys-overlay.js — 關卡裡的「按鍵圖」（2026-10-04）
   ------------------------------------------------------------
   用精靈頁同一張示意圖（controller-diagram.js），所以精靈怎麼設、這裡就怎麼顯示。
     showKeys({mode:'overlay'})：蓋在畫面中央，按哪顆圖上那顆就亮；點一下、按 Esc／返回鍵、或手把確認鍵關閉。
                                暫停選單的「🎮 按鍵圖」按鈕用這個（ui.js 自動加）。
     showKeys({mode:'card',seconds:6})：每關開始飛的時候在上方顯示幾秒，不擋操作（hud.js 觸發，只對手把）。
   沒接手把就什麼都不做。
   ============================================================ */
import { buildDiagram, shapeFor } from './controller-diagram.js';
import { gpCfgRead } from './input.js';

let _el=null, _raf=0, _card=false;
export function hideKeys(){ if(_el){ _el.remove(); _el=null; } cancelAnimationFrame(_raf); document.removeEventListener('keydown',_onKey,true); globalThis.__ndKeysHide=null; }
/* Esc（＝手把返回鍵）只關掉按鍵圖，不要同時把遊戲也取消暫停 */
function _onKey(e){ if(e.code==='Escape'||e.code==='Enter'||e.code==='Space'){ e.stopImmediatePropagation(); hideKeys(); } }
/* 只有蓋住畫面的大圖才算「開著」。每關開頭右上角那張小卡不擋操作，不能讓選單因此不理搖桿
   （2026-10-06 修正：原本小卡顯示的 6 秒內按暫停，暫停選單用搖桿選不動）。 */
export function keysVisible(){ return !!_el&&!_card; }

export function showKeys({mode='overlay',seconds=0}={}){
  let gp=null; try{ gp=[...(navigator.getGamepads?.()||[])].find(Boolean)||null; }catch{}
  if(!gp)return false;
  hideKeys();
  const cfg=gpCfgRead(gp), shape=shapeFor(gp,cfg), card=mode==='card'; _card=card;
  const el=_el=document.createElement('div'); el.id='nd-keys';
  el.style.cssText=card
    ?'position:fixed;right:12px;top:60px;z-index:45;width:min(300px,60vw);pointer-events:none;opacity:.9;transition:opacity .6s;'   // 右上角：不擋畫面中間的機體
    :'position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(2,6,12,.82);cursor:pointer;';
  el.innerHTML=`<div style="background:#0b1626;border:1px solid rgba(0,238,255,.5);border-radius:14px;padding:${card?'8px 10px':'16px 20px'};width:${card?'100%':'min(640px,92vw)'};color:#9fc3d8;font-size:12px;font-family:inherit;box-sizing:border-box">
    <div style="color:#facc15;font-size:${card?12:16}px;margin-bottom:4px;text-align:center">🎮 ${card?'你的搖桿按鍵（暫停選單可以再看）':'按鍵圖：'+String(cfg?.profileName||gp.id.replace(/\s*\(.*$/,'')).replace(/[<>&]/g,'')}</div>
    <div id="nd-keys-diag"></div>
    ${card?'':'<div style="text-align:center;margin-top:8px;color:#7aa3b8">按按看，圖上那顆會亮　｜　點一下畫面、或按返回鍵關閉</div>'}</div>`;
  document.body.appendChild(el);
  const diag=buildDiagram(el.querySelector('#nd-keys-diag'),{shape,gp,cfg});
  const stub={gpAxis:()=>0};                 // 這裡只顯示按鈕亮燈，桿子不動（暫停中也沒有輸入層在跑）
  let prevA=true, t0=performance.now();
  const loop=()=>{ if(_el!==el)return; _raf=requestAnimationFrame(loop);
    let g=null; try{ g=[...(navigator.getGamepads?.()||[])].find(x=>x&&x.index===gp.index); }catch{}
    if(g){ diag.update(g,stub,cfg);
      if(!card){ const bi=cfg?.profileName?cfg.buttons?.confirm:0, a=bi>=0&&!!g.buttons[bi]?.pressed;   // 手把確認鍵也能關
        if(a&&!prevA){ hideKeys(); return; } prevA=a; } }
    if(seconds&&performance.now()-t0>seconds*1000){ el.style.opacity=0; setTimeout(()=>{ if(_el===el)hideKeys(); },650); seconds=0; }
  };
  loop();
  // 鍵盤 Esc：掛在 document 的捕獲階段，搶在關卡（掛在 window）之前攔下來。
  // 手把返回鍵：input.js 看到 __ndKeysHide 就呼叫它、不送 Esc（不能直接 import，會循環引用）。
  if(!card){ el.addEventListener('click',hideKeys); document.addEventListener('keydown',_onKey,true); globalThis.__ndKeysHide=hideKeys; }
  return true;
}
