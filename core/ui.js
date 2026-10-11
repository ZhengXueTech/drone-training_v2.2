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
/* ── 2026-10-11 統一開始畫面格式（老師定調：設定用「分段選擇」、說明＝一句重點＋可展開規則）──
   showModal 傳了 summary／settings 就用這個版面；沒傳＝舊版面完全不變。規範見 CLAUDE.md「UI 規範」。 */
.nd-modal.nd-panel{max-width:min(640px,94vw);text-align:left;padding:20px 24px;}
.nd-panel h1{text-align:center;margin-bottom:6px;}
.nd-panel .np-sum{font-size:15px;color:#e6f7ff;text-align:center;line-height:1.6;margin:2px 0 8px;}
.nd-panel .np-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 10px;}
.nd-panel .np-tags span{font-size:12px;background:#0e2238;border:1px solid rgba(0,238,255,.35);border-radius:999px;padding:2px 10px;color:#cfefff;}
.nd-panel .np-rules{margin:6px 0 10px;border:1px solid rgba(0,238,255,.25);border-radius:10px;padding:2px 12px;background:rgba(6,16,28,.6);}
.nd-panel .np-rules summary{cursor:pointer;color:#7dd3fc;font-size:13px;padding:6px 0;list-style:none;}
.nd-panel .np-rules summary::before{content:'▸ ';} .nd-panel .np-rules[open] summary::before{content:'▾ ';}
.nd-panel .np-rules p{font-size:12.5px;}
.nd-panel .np-set{margin:8px 0 4px;}
.nd-panel .np-h{font-size:12px;color:#7aa3b8;letter-spacing:2px;margin:4px 0 6px;}
.nd-panel .np-row{display:grid;grid-template-columns:92px 1fr;gap:4px 10px;align-items:center;padding:5px 6px;border-radius:8px;}
.nd-panel .np-row.gp-focus{background:rgba(0,238,255,.08);}
.nd-panel .np-l{font-size:13px;color:#cfefff;}
.nd-panel .np-opts{display:flex;flex-wrap:wrap;gap:6px;}
.nd-panel .np-opts button{font-size:13px;padding:5px 12px;min-height:34px;border-radius:999px;color:#9fc3d8;background:#0a1828;border-color:rgba(0,238,255,.25);}
.nd-panel .np-opts button.on{background:#00eeff;color:#04202c;border-color:#00eeff;font-weight:bold;}
.nd-panel .np-hint{grid-column:2;font-size:12.5px;color:#7aa3b8;line-height:1.5;}
.nd-panel .np-hint:empty{display:none;}
.nd-panel .np-go{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:12px;position:sticky;bottom:-20px;padding:10px 0 12px;background:linear-gradient(transparent,#0b1626 30%);}   /* 設定很多時，開始鈕＋次要鈕黏在下面，不用捲才看得到 */
.nd-panel .np-go > button{font-size:18px;padding:12px 46px;min-height:52px;background:#00eeff;color:#04202c;font-weight:bold;border-color:#00eeff;}
.nd-panel .btns{margin-top:10px;}
.nd-panel .btns button{font-size:13px;padding:7px 16px;min-height:38px;}
@media (max-width:520px){ .nd-panel .np-row{grid-template-columns:1fr;} .nd-panel .np-hint{grid-column:1;} }
/* 手機橫拿（高度矮）：精簡模式——標題縮小、設定兩欄、按鈕列一排 */
@media (max-height:520px){ .nd-modal-bg--top:has(.nd-panel){padding-top:4px;} .nd-modal.nd-panel{max-width:96vw;width:96vw;padding:10px 16px;max-height:calc(100vh - 8px);box-sizing:border-box;}
 .nd-panel h1{font-size:20px;margin:0 0 2px;} .nd-panel .np-sum{font-size:13.5px;margin:0 0 4px;line-height:1.4;}
 .nd-panel .np-tags{margin:0 0 4px;} .nd-panel .np-tags span{font-size:12px;padding:1px 8px;}
 .nd-panel .np-rules{margin:2px 0 4px;} .nd-panel .np-rules summary{padding:3px 0;}
 .nd-panel .np-h{display:none;} .nd-panel .np-set{display:grid;grid-template-columns:1fr 1fr;align-items:start;gap:2px 12px;margin:4px 0 0;}
 .nd-panel .np-row{grid-template-columns:1fr;padding:3px 4px;gap:2px;} .nd-panel .np-hint{grid-column:1;}
 .nd-panel .np-opts button{min-height:32px;padding:4px 10px;}
 .nd-panel .np-go{flex-wrap:nowrap;align-items:center;margin-top:4px;padding:6px 0 4px;bottom:-10px;margin-bottom:-10px;padding-bottom:10px;}
 .nd-panel .np-go > button{font-size:16px;padding:8px 30px;min-height:44px;} .nd-panel .np-go .btns{margin:0!important;width:auto!important;display:flex;gap:8px;} }
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
  showModal({title,html='',buttons=[],align,summary,tags,rules,settings}){
    const keepFocus=this._keepFocus; this._keepFocus=null;
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
    if(summary!=null||settings)return this._showPanel({title,html,buttons,align,summary,tags,rules,settings:settings||[],navAdded,keepFocus});
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
  closeModal(){ this._modal?.remove(); this._modal=null; this._panel=null; this._navAdded=[]; this._hold?.reset(); this.gpSetFocus([],0); }
  /* ── 統一開始畫面（2026-10-11）：標題／一句重點／小標籤／（橫幅 html）／📖 規則說明（收合）／⚙ 設定（分段選擇）／▶ 主按鈕／次要按鈕
     settings：[{id,label,options:[{v,label}],value,onChange(v),hint:(v)=>字串}]；主按鈕＝buttons 裡 primary:true 或 id 為 b-go／b-start 的第一顆。
     手把：上下＝換列、左右＝在設定列裡換選項；A＝按下（在設定列上＝換下一個）。 */
  _showPanel({title,html,buttons,align,summary,tags,rules,settings,navAdded,keepFocus}){
    const esc=t=>String(t??'');
    const pi=buttons.findIndex(b=>b.primary)>=0?buttons.findIndex(b=>b.primary):buttons.findIndex(b=>b.id==='b-go'||b.id==='b-start');
    const prim=pi>=0?buttons[pi]:null, rest=buttons.filter((b,i)=>i!==pi);
    const hintOf=r=>{ try{ return typeof r.hint==='function'?(r.hint(r.value)||''):(r.hint||''); }catch{ return ''; } };
    const rowHtml=r=>`<div class="np-row" id="row-${r.id}" data-nf="1"><span class="np-l">${esc(r.label)}</span><div class="np-opts">${r.options.map((o,i)=>
      `<button id="opt-${r.id}-${i}" class="${String(o.v)===String(r.value)?'on':''}"${o.disabled?' disabled':''}>${esc(o.label)}</button>`).join('')}</div><div class="np-hint">${hintOf(r)}</div></div>`;
    const bg=document.createElement('div');
    bg.className='nd-modal-bg'+(align==='top'?' nd-modal-bg--top':'');
    bg.innerHTML=`<div class="nd-modal nd-panel"><h1>${title}</h1>
      ${summary!=null?`<div class="np-sum">${summary}</div>`:''}
      ${tags&&tags.length?`<div class="np-tags">${tags.map(t=>`<span>${t}</span>`).join('')}</div>`:''}
      ${html||''}
      ${rules?`<details class="np-rules" id="np-rules" data-nf="1"><summary>📖 規則說明（點開看完整規則）</summary>${rules}</details>`:''}
      ${settings.length?`<div class="np-set"><div class="np-h">⚙ 設定</div>${settings.map(rowHtml).join('')}</div>`:''}
      <div class="np-go">${prim?`<button id="${prim.id}" data-nf="1">${prim.label}</button>`:''}
        ${rest.length?`<div class="btns" style="width:100%;margin-top:4px">${rest.map(b=>`<button id="${b.id}" data-nf="1">${b.label}</button>`).join('')}</div>`:''}</div></div>`;
    document.body.appendChild(bg);
    buttons.forEach(b=>{ const el=document.getElementById(b.id); el&&el.addEventListener('click',()=>b.onClick&&b.onClick()); });
    const ui=this;
    settings.forEach(r=>r.options.forEach((o,i)=>{ const el=document.getElementById(`opt-${r.id}-${i}`);
      el&&el.addEventListener('click',()=>ui._pickOpt(r,i)); }));
    this._modal=bg; this._navAdded=navAdded; this._hold.reset();
    this._panel={settings};
    const order=[...bg.querySelectorAll('[data-nf]')].map(e=>e.id);
    const start=keepFocus&&order.includes(keepFocus)?keepFocus:(prim?prim.id:order[0]);
    this._focusBtns=[]; this.gpSetFocus(order,Math.max(0,order.indexOf(start)));
    this._keepPanelFocus=keepFocus&&order.includes(keepFocus)?keepFocus:null;
    return bg;
  }
  _pickOpt(r,i){
    const o=r.options[i]; if(!o||o.disabled)return;
    r.value=o.v;
    r.options.forEach((_,j)=>document.getElementById(`opt-${r.id}-${j}`)?.classList.toggle('on',j===i));
    this._keepFocus='row-'+r.id;              // onChange 若重畫整個畫面，焦點留在這一列
    try{ r.onChange&&r.onChange(o.v); }catch(e){ console.error(e); }
    this._keepFocus=null;
    const h=document.querySelector(`#row-${r.id} .np-hint`); if(h){ try{ h.innerHTML=typeof r.hint==='function'?(r.hint(r.value)||''):(r.hint||''); }catch{} }
  }
  _rowStep(id,d){
    const r=this._panel&&this._panel.settings.find(x=>'row-'+x.id===id); if(!r)return false;
    const n=r.options.length; let i=r.options.findIndex(o=>String(o.v)===String(r.value));
    for(let k=0;k<n;k++){ i=(i+d+n)%n; if(!r.options[i].disabled)break; }
    this._pickOpt(r,i); return true;
  }
  get modalOpen(){ return !!this._modal; }

  gpSetFocus(ids,idx=0){
    this._focusBtns.forEach(id=>document.getElementById(id)?.classList.remove('gp-focus'));
    // 統一開始畫面：焦點清單永遠是畫面上全部可選的項目（設定列＋按鈕）；關卡指定的那顆當起點
    if(this._panel&&this._modal&&ids.length){
      const order=[...this._modal.querySelectorAll('[data-nf]')].map(e=>e.id);
      let cur=this._keepPanelFocus||ids[idx]; this._keepPanelFocus=null;
      ids=order; idx=Math.max(0,order.indexOf(cur));
    }
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
    { const fid=this._focusBtns[this._focusIdx]; if(this._panel&&fid&&fid.startsWith('row-')){ this._rowStep(fid,1); return; }
      if(this._panel&&fid==='np-rules'){ const d=document.getElementById('np-rules'); if(d)d.open=!d.open; return; } }
    document.getElementById(this._focusBtns[this._focusIdx])?.click();
  }
  /* 每幀（modal 開啟時）：把 pollMenu 事件轉為焦點移動 */
  update(dt){
    if(!this._modal)return;
    const m=this.input.pollMenu(dt);
    if(keysVisible())return;      // 按鍵圖開著時選單不動（還是要輪詢，按鍵的前一幀狀態才不會過期）
    const fid=this._focusBtns[this._focusIdx];
    if(this._panel&&fid&&fid.startsWith('row-')){   // 統一開始畫面：設定列上左右＝換選項、上下＝換列、A＝下一個選項
      if(m.x)this._rowStep(fid,m.x>0?1:-1);
      if(m.y>0)this.gpNav(1); if(m.y<0)this.gpNav(-1);
      if(m.confirm)this._rowStep(fid,1);
    }else{
    if(m.y>0||m.x>0)this.gpNav(1);
    if(m.y<0||m.x<0)this.gpNav(-1);
    if(m.confirm){ if(this._panel&&fid==='np-rules'){ const d=document.getElementById('np-rules'); if(d)d.open=!d.open; } else this.gpConfirm(); }
    }
    // 左搖桿（偏航）往右推住＝確認、往左推住＝返回（跟按 B 一樣送出 Esc）。要先回中才計時，暫停當下手還推著不會誤觸
    try{ const gp=this.input.gamepads&&this.input.gamepads()[0];
      if(gp&&this.input.gpAxis){ const r=this._hold.step(this.input.gpAxis(gp,'yaw'),dt||0.016);
        if(r==='confirm')this.gpConfirm();
        else if(r==='back')dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'})); }
    }catch{}
  }
}
