/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   ui.js — Modal 與搖桿選單焦點系統（ES Module）
   newdrone Phase 0｜gpSetFocus/gpNav/gpConfirm 全系統唯一實作
   選單導航支援 D-pad＋右蘑菇頭（input.pollMenu 已含邊緣觸發/連發）
   ============================================================ */
import { showKeys, keysVisible } from './keys-overlay.js';
import { rewriteButtons, patchBackLinks } from './nav-flow.js';
import { getHand, toggleHand, handLabel } from './hand.js';   // 2026-10-10 暫停選單切換美國手／日本手
import { YawHold } from './gp-hold.js';                          // 2026-10-06 左搖桿左右推住＝確認／返回（沒有 A、B 鍵的遙控器用）   // 2026-10-05 關卡動線（離開回原分頁、下一關）

'use strict';

const CSS=`
.nd-modal-bg{position:fixed;inset:0;background:rgba(2,6,12,.78);z-index:50;
 display:flex;align-items:center;justify-content:center;
 font-family:'Share Tech Mono','Consolas',monospace;}
/* align:'top' 變體（showModal 的可選參數）——只給「開場可即時預覽機體」的畫面用，
   把對話框推到畫面上方、背景稍微變淡，讓下方跟隨鏡頭實際看得到機體本人，
   不是新增另一套 modal 系統，只是同一個 .nd-modal-bg 疊加修飾 class，
   沒傳這個參數的既有呼叫（暫停/結算等）行為完全不變。 */
.nd-modal-bg.nd-modal-bg--top{align-items:flex-start;padding-top:18px;background:rgba(2,6,12,.6);}
.nd-modal{background:#0b1626;border:1px solid rgba(0,238,255,.5);border-radius:14px;
 padding:26px 34px;max-width:min(560px,92vw);color:#cfefff;text-align:center;
 box-shadow:0 0 40px rgba(0,238,255,.15);max-height:88vh;overflow:auto;}
.nd-modal h1{font-size:22px;color:#00eeff;letter-spacing:2px;margin:0 0 12px;}
.nd-modal p{font-size:13px;line-height:1.8;margin:8px 0;text-align:left;}
.nd-modal .btns{display:flex;gap:12px;justify-content:center;margin-top:18px;flex-wrap:wrap;}
.nd-modal button{background:#0e2238;color:#00eeff;border:1px solid rgba(0,238,255,.5);
 border-radius:8px;font-size:15px;padding:10px 22px;font-family:inherit;cursor:pointer;min-height:44px;}
.nd-modal button:hover{background:#153a5e;}
.gp-focus{outline:3px solid rgba(255,255,255,.85)!important;outline-offset:2px;}
`;

/* 診斷小視窗：首頁網址加 ?debug=1 開、?debug=0 關（記在這台裝置）。沒開就不載入。 */
try{ if(localStorage.getItem('nd.debug')==='1'){ globalThis.__ndDebugOn=true; import('./debug-overlay.js').catch(()=>{}); } }catch{}

function ensureCSS(){
  if(!document.getElementById('nd-ui-css')){
    const st=document.createElement('style');st.id='nd-ui-css';st.textContent=CSS;
    document.head.appendChild(st);
  }
}

export class UI{
  constructor(input){
    ensureCSS();
    this.input=input;          // InputManager（pollMenu）
    this._focusBtns=[]; this._focusIdx=0;
    this._modal=null; this._navAdded=[]; this._hold=new YawHold();
    try{ patchBackLinks(); }catch{}
  }
  /* 顯示 modal：{title, html, buttons:[{id,label,onClick}], align}，回傳背景元素。
     align:'top'（可選）＝疊加 .nd-modal-bg--top，讓對話框靠上、背景變淡，
     用在「開場可即時切換機體樣式」的畫面，讓下方跟機視角看得到機體本人
     （2026-07-23 使用者實機回饋：機體被對話框整個擋住，看不到即時預覽）。
     不傳這個參數＝跟改動前完全一樣（既有暫停/結算等呼叫端零影響）。 */
  showModal({title,html='',buttons=[],align}){
    this.closeModal();
    // 關卡動線：「返回入口」改成回原本的關卡分頁，結算多「下一關」，暫停多「回關卡列表／回首頁」（core/nav-flow.js）
    let navAdded=[]; try{ const r=rewriteButtons(title,buttons); buttons=r.buttons; navAdded=r.added; }catch{}
    // 暫停選單自動多一顆「🎮 按鍵圖」（有接手把才加）：全站共用，關卡不用各自寫
    if(/暫停/.test(title)&&!buttons.some(b=>b.id==='b-keys')){
      let hasGp=false; try{ hasGp=[...(navigator.getGamepads?.()||[])].some(Boolean); }catch{}
      if(hasGp)buttons=[...buttons,{id:'b-keys',label:'🎮 按鍵圖',onClick:()=>showKeys({mode:'overlay'})}];
    }
    // 暫停選單多一顆「✋ 美國手／日本手」：按一下切換，不關選單（2026-10-10）
    if(/暫停/.test(title)&&!buttons.some(b=>b.id==='b-hand')){
      const hb={id:'b-hand',label:'✋ '+handLabel()+'｜按一下切換',onClick:()=>{ toggleHand(); const b=document.getElementById('b-hand'); if(b)b.textContent='✋ '+handLabel()+'｜按一下切換'; }};
      const at=buttons.findIndex(b=>navAdded.includes(b.id)||b.id==='b-keys');   // 放在「回關卡列表／回首頁」前面
      buttons=at<0?[...buttons,hb]:[...buttons.slice(0,at),hb,...buttons.slice(at)];
    }
    const bg=document.createElement('div');
    bg.className='nd-modal-bg'+(align==='top'?' nd-modal-bg--top':'');
    bg.innerHTML=`<div class="nd-modal"><h1>${title}</h1>${html}
      <div class="btns">${buttons.map(b=>`<button id="${b.id}">${b.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(bg);
    buttons.forEach(b=>{
      const el=document.getElementById(b.id);
      el&&el.addEventListener('click',()=>b.onClick&&b.onClick());
    });
    this._modal=bg; this._navAdded=navAdded; this._hold.reset();
    this.gpSetFocus(buttons.map(b=>b.id),0);
    return bg;
  }
  closeModal(){ this._modal?.remove(); this._modal=null; this._navAdded=[]; this._hold?.reset(); this.gpSetFocus([],0); }
  get modalOpen(){ return !!this._modal; }

  gpSetFocus(ids,idx=0){
    this._focusBtns.forEach(id=>document.getElementById(id)?.classList.remove('gp-focus'));
    // 關卡自己指定焦點清單時，把動線新增的按鈕也排進去（照畫面上的順序），手把才選得到
    if(ids.length&&this._navAdded&&this._navAdded.some(id=>!ids.includes(id))&&this._modal){
      const order=[...this._modal.querySelectorAll('.btns button')].map(b=>b.id), cur=ids[idx];
      ids=order.filter(id=>ids.includes(id)||this._navAdded.includes(id)); idx=Math.max(0,ids.indexOf(cur));
    }
    this._focusBtns=ids; this._focusIdx=idx;
    const el=document.getElementById(ids[idx]);
    el&&el.classList.add('gp-focus');
  }
  gpNav(d){
    if(!this._focusBtns.length)return;
    document.getElementById(this._focusBtns[this._focusIdx])?.classList.remove('gp-focus');
    this._focusIdx=(this._focusIdx+d+this._focusBtns.length)%this._focusBtns.length;
    document.getElementById(this._focusBtns[this._focusIdx])?.classList.add('gp-focus');
  }
  gpConfirm(){
    if(!this._focusBtns.length)return;
    try{ sessionStorage.setItem('nd.gp.carry',String(Date.now())); }catch{}   // 見 input.js gpCarryMark：換頁後還按著的確認鍵不算新的一下
    document.getElementById(this._focusBtns[this._focusIdx])?.click();
  }
  /* 每幀（modal 開啟時）：把 pollMenu 事件轉為焦點移動 */
  update(dt){
    if(!this._modal)return;
    const m=this.input.pollMenu(dt);
    if(keysVisible())return;      // 按鍵圖開著時選單不動（還是要輪詢，按鍵的前一幀狀態才不會過期）
    if(m.y>0||m.x>0)this.gpNav(1);
    if(m.y<0||m.x<0)this.gpNav(-1);
    if(m.confirm)this.gpConfirm();
    // 左搖桿（偏航）往右推住＝確認、往左推住＝返回（跟按 B 一樣送出 Esc）。要先回中才計時，暫停當下手還推著不會誤觸
    try{ const gp=this.input.gamepads&&this.input.gamepads()[0];
      if(gp&&this.input.gpAxis){ const r=this._hold.step(this.input.gpAxis(gp,'yaw'),dt||0.016);
        if(r==='confirm')this.gpConfirm();
        else if(r==='back')dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'})); }
    }catch{}
  }
}
