/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   input.js — 三裝置統一輸入層（ES Module）
   newdrone Phase 1｜自基本版 exp/gamepad.js 升級
   ------------------------------------------------------------
   規劃書 5.2 輸入公平性管線：
   1. 動態全程校準：每軸自動追蹤 rest / min / max（不需事先手測極值）
   2. 曲線（deadzone/expo）在「正規化後」套用 → 任何搖桿同一條曲線
   3. 鍵盤類比化：按住 ramp 至滿舵（attack 0.15s / release 0.10s），Shift 半舵
   4. 輸入層只輸出 -1..+1，速度上限由 physics 層決定
   ------------------------------------------------------------
   用法：
     const input = new InputManager();
     // 每幀：input.update(dt);
     const p = input.player(0);  // {throttle,yaw,pitch,roll,device}
     const m = input.pollMenu(); // {nav:{x,y}, confirm, back} 邊緣觸發
   v2.4：新增 crouch（蹲姿）按鈕語意——LB/b4；STARTRC 無空撥段故不支援
   ============================================================ */
'use strict';
import { getHand } from './hand.js';   // 2026-10-10 美國手／日本手（跟著飛手記）
import { profileFor, profileToCfg, fetchFileProfiles, fetchCloudProfiles } from './controller-profiles.js';

/* Phase 7（2026-10-04）：啟動時讀老師放進資料夾的搖桿設定檔；讀不到就當沒有 */
try{ fetchFileProfiles(new URL('../data/controller-profiles.json',import.meta.url)); }catch{}
/* Phase 7b：有設定雲端網址的話，抓老師審核通過的搖桿設定（沒設定、沒網路都不影響） */
try{ fetchCloudProfiles(new URL('../data/cloud-config.json',import.meta.url)); }catch{}

export const INPUT_VERSION='2.8';
/* 用搖桿按確認而換頁／換選單時記一筆時間；下一頁在這段時間內第一次讀到「已經按著」的鍵就不當成新的一下 */
const CARRY_KEY='nd.gp.carry', CARRY_MS=2500;
export function gpCarryMark(){ try{ sessionStorage.setItem(CARRY_KEY,String(Date.now())); }catch{} }
export function gpCarried(){ try{ return Date.now()-Number(sessionStorage.getItem(CARRY_KEY)||0)<CARRY_MS; }catch{ return false; } }
/* 具名按鍵的預設按鈕編號（標準手把）。
   2026-10-07 老師實測後定案的統一配置（原則：飛行中拇指不離開搖桿，常用功能放食指按得到的肩鍵／扳機）：
     A 確認｜B 返回＋暫停（選單裡是返回、飛行中是暫停）｜RT 檔位｜LT 模式｜RB 自穩｜LB 動作｜十字↓ 蹲｜≡ 視角｜⧉ 站位
   舊配置（到 2026-10-06）：Y 檔位、X 模式、B 動作、LB 蹲——X／Y 現在空著。 */
export const DEF_BTN={confirm:0,back:1,camCycle:9,pilotCycle:8,crouch:13,gear:7,mode:6,action:4,selfLevel:5};
const _OLD_BTN={crouch:4,gear:3,mode:2,action:1,selfLevel:5};   // 非標準的內建搖桿（STARTRC／PS2 轉接）維持原本的編號，不套新配置
const STD_NAME=['A','B','X','Y','LB','RB','LT','RT','⧉','≡','壓左桿','壓右桿','十字↑','十字↓','十字←','十字→'];
const PS_NAME=['✕','○','□','△','L1','R1','L2','R2','Create','Options','L3','R3','十字↑','十字↓','十字←','十字→'];
const _isPS=id=>/dualsense|dualshock|wireless controller|054c|playstation/i.test(id);
const KB_LABEL={confirm:'Enter',back:'Esc',camCycle:'C',pilotCycle:'V',crouch:'Z',gear:'G',mode:'M',action:'B',selfLevel:'空白鍵'};            // 版本戳記（fairness 頁顯示，供確認檔案已更新）

const STORE_GPMAP  = 'droneSimGpMap';        // 沿用基本版 wizard 儲存（相容）
const STORE_MODE   = 'droneSimFlightMode';   // '1' | '2'（日本手/美國手），相容舊 key
// [FIX 2] 校準儲存 key 升版：v1 曾在「第一次讀值」自動抓靜止位，若載入瞬間手碰著桿子
// 會把偏移永久存起來（症狀：搖桿沒碰卻持續自轉）。v2 改為靜止位預設 0／設定值，
// 只能由「歸零校準」按鈕明確寫入；換 key 讓舊的髒資料自然失效。
const STORE_CAL    = 'nd.settings.gpCal2';   // {gpId:{axisIdx:{rest,min,max}}}

/* ── 內建控制器 config（移植自 gamepad.js）──
   [FIX 4] 反相旗標依「統一輸出語意」重定（與鍵盤一致，鍵盤已由使用者驗證正確）：
     throttle +1=上升、yaw +1=右轉、pitch +1=前進(機頭下壓)、roll +1=右移
   標準映射搖桿：X 軸右=+1（yaw/roll 不反相）、Y 軸上=-1（throttle/pitch 反相）。
   基本版舊 inv 值是配家族 C 物理的方向，直接沿用會「左右相反」——已全數重校。
   crouch（v2.4）：蹲姿按住鍵，標準映射 LB=b4（承基本版 L1 蹲）。 */
const _XBOX_360_CFG = {
  axes:{yaw:{i:0,inv:false},throttle:{i:1,inv:true},roll:{i:2,inv:false},pitch:{i:3,inv:true}},
  buttons:{confirm:0,back:1,camCycle:9,pilotCycle:8},deadzone:0.12,expo:0
};
const _XBOX_ONE_HID_CFG = {
  axes:{yaw:{i:0,inv:false},throttle:{i:1,inv:true},roll:{i:2,inv:false},pitch:{i:3,inv:true}},
  buttons:{confirm:0,back:1,camCycle:9,pilotCycle:8},deadzone:0.12,expo:0
};
const _STARTRC_CFG = {  // 依 Xbox 同樣的相對翻轉（yaw/roll 反相取消）；實機驗證後如仍反向，改這裡即可
  axes:{yaw:{i:3,inv:false},throttle:{i:2,inv:false},roll:{i:0,inv:false},pitch:{i:1,inv:false}},
  buttons:{confirm:1,back:1,camCycle:0,pilotCycle:0,..._OLD_BTN},
  axBtns:[{ax:4,type:'3pos',fn:'camCycle'},{ax:5,type:'2pos',fn:'back'},
          {ax:6,type:'3pos',fn:'pilotCycle'},{ax:7,type:'2pos',fn:'confirm'}],
  deadzone:0.12,expo:0
};
const _PS2_USB_CFG = {
  axes:{yaw:{i:0,inv:false},throttle:{i:1,inv:true},roll:{i:5,inv:false},pitch:{i:2,inv:true}},
  buttons:{confirm:2,back:1,camCycle:9,pilotCycle:8,..._OLD_BTN,crouch:6},
  ignoreAxes:[9],deadzone:0.12,expo:0
};

export function gpCfgRead(gp){
  if(!gp) return null;
  // Phase 7：搖桿設定檔（精靈做的／老師放進資料夾的）優先；沒有才走下面原本的判斷
  const prof=profileFor(gp);
  if(prof) return profileToCfg(prof);
  const id = gp.id.toLowerCase();
  if(id.includes('startrc'))                                        return _STARTRC_CFG;
  if(id.includes('xinput'))                                         return _XBOX_360_CFG;
  if(id.includes('hid-compliant')||id.includes('standard gamepad')) return _XBOX_ONE_HID_CFG;
  if(id.includes('0810'))                                           return _PS2_USB_CFG;
  try{return JSON.parse(localStorage.getItem(STORE_GPMAP)||'{}')[gp.id]||null;}catch{return null;}
}

/* 2026-10-10 日本手：只對「手把外型」的內建設定（Xbox／PS／PS2 轉接）把油門和前後對調；
   搖桿精靈或設定檔（遙控器）是照功能指派的，照實體走、不對調；沒有設定（cfg=null）的手把在 gpAxis 已依 flightMode 選軸。 */
export function handSwapFor(cfg){ return getHand()==='1'&&(cfg===_XBOX_360_CFG||cfg===_XBOX_ONE_HID_CFG||cfg===_PS2_USB_CFG); }
function _swapTP(o){ const t=o.throttle; o.throttle=o.pitch; o.pitch=t; return o; }
function _expo(v,e){return e>0?v*(1-e)+v*v*v*e:v;}
const _clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ── 動態校準表 ──
   靜止位（rest）規則 [FIX 2]：預設取 config 設定值（內建控制器＝0），
   絕不從當下讀值自動猜測——只有 captureRest()（歸零校準鈕）能改寫。
   極值（min/max）：初始 ±0.85（打不滿的桿先給 1.18 倍增益），
   之後只往外擴——「打滿一圈」即完成全程校準並永久記住。 */
class Calibration{
  constructor(){
    try{this.data=JSON.parse(localStorage.getItem(STORE_CAL)||'{}');}catch{this.data={};}
    this._dirty=false; this._saveT=0;
  }
  ensure(gpId,idx,cfgRest=0,seed=null){
    const g=this.data[gpId]??(this.data[gpId]={});
    // seed：設定檔帶的極值（Phase 7）；沒帶＝原本的 ±0.85
    if(!g[idx]){ g[idx]={rest:cfgRest,min:seed?.min??-0.85,max:seed?.max??0.85}; this._dirty=true; }
    return g[idx];
  }
  track(gpId,idx,raw,cfgRest=0,seed=null){
    const c=this.ensure(gpId,idx,cfgRest,seed);
    if(raw<c.min-0.02){c.min=Math.max(-1.25,raw);this._dirty=true;}
    if(raw>c.max+0.02){c.max=Math.min(1.25,raw);this._dirty=true;}
    return c;
  }
  setRest(gpId,idx,raw){
    const c=this.ensure(gpId,idx,0);
    c.rest=raw; this._dirty=true;
  }
  clear(){
    this.data={}; this._dirty=false;
    try{localStorage.removeItem(STORE_CAL);}catch{}
  }
  save(){ this._dirty=false;
    try{localStorage.setItem(STORE_CAL,JSON.stringify(this.data));}catch{} }
  maybeSave(dt){
    this._saveT+=dt;
    if(this._dirty&&this._saveT>2){this._saveT=0;this.save();}
  }
}

/* ── 鍵盤 ramp 類比化 ── */
const KB_LAYOUTS={
  KB1:{ throttle:{pos:'KeyW',neg:'KeyS'}, yaw:{pos:'KeyD',neg:'KeyA'},
        pitch:{pos:'ArrowUp',neg:'ArrowDown'}, roll:{pos:'ArrowRight',neg:'ArrowLeft'} },
  KB2:{ throttle:{pos:'KeyI',neg:'KeyK'}, yaw:{pos:'KeyL',neg:'KeyJ'},
        pitch:{pos:'Numpad8',neg:'Numpad5'}, roll:{pos:'Numpad6',neg:'Numpad4'} },
};
const KB_ATTACK=1/0.15, KB_RELEASE=1/0.10; // 0.15s 到滿舵、0.10s 歸零

class KeyboardSource{
  constructor(layout='KB1'){
    this.map=KB_LAYOUTS[layout];
    this.keys=new Set(); this.half=false;
    this.axes={throttle:0,yaw:0,pitch:0,roll:0};
    addEventListener('keydown',e=>{ this.keys.add(e.code);
      if(e.key==='Shift')this.half=true;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault(); });
    addEventListener('keyup',e=>{ this.keys.delete(e.code); if(e.key==='Shift')this.half=false; });
    addEventListener('blur',()=>{this.keys.clear();
      for(const k in this.axes)this.axes[k]=0;});
  }
  active(){ for(const a in this.map){const m=this.map[a];
    if(this.keys.has(m.pos)||this.keys.has(m.neg))return true;} return false; }
  update(dt){
    const lim=this.half?0.5:1.0;
    for(const a in this.map){
      const m=this.map[a];
      const target=(this.keys.has(m.pos)?lim:0)+(this.keys.has(m.neg)?-lim:0);
      const cur=this.axes[a];
      const rate=(target===0)?KB_RELEASE:KB_ATTACK;
      const d=target-cur;
      const step=rate*dt*lim;
      this.axes[a]=Math.abs(d)<=step?target:cur+Math.sign(d)*step;
    }
  }
}

/* ── 觸控雙虛擬搖桿 ── */
class TouchSource{
  constructor(){
    this.axes={throttle:0,yaw:0,pitch:0,roll:0};
    this.activeTouches=0; this.sticks=[];
  }
  /* container：DOM 節點；mode 'overlay'（橫拿/桌機）或 'deck'（直拿控制區） */
  attach(leftEl,rightEl){
    this.sticks.forEach(s=>s.dispose&&s.dispose());
    this.sticks=[
      this._makeStick(leftEl ,(x,y)=>{this.axes.yaw=x; this.axes.throttle=-y;}),
      this._makeStick(rightEl,(x,y)=>{this.axes.roll=x; this.axes.pitch=-y;}),
    ];
  }
  _makeStick(el,cb){
    if(!el)return{dispose(){}};
    let pid=null;
    const knob=el.querySelector('.vj-knob');
    const R=()=>el.clientWidth/2;
    const set=(x,y)=>{cb(x,y);
      if(knob)knob.style.transform=`translate(${x*R()*0.5}px,${y*R()*0.5}px)`;};
    const onMove=e=>{ if(e.pointerId!==pid)return;
      const r=el.getBoundingClientRect();
      let x=((e.clientX-r.left)/r.width )*2-1;
      let y=((e.clientY-r.top )/r.height)*2-1;
      const len=Math.hypot(x,y); if(len>1){x/=len;y/=len;}
      set(x,y); };
    const down=e=>{ pid=e.pointerId; el.setPointerCapture(pid);
      el.classList.add('active'); this.activeTouches++; onMove(e); };
    const up=e=>{ if(e.pointerId!==pid)return; pid=null;
      el.classList.remove('active'); this.activeTouches=Math.max(0,this.activeTouches-1);
      set(0,0); };
    el.addEventListener('pointerdown',down);
    el.addEventListener('pointermove',onMove);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
    return {dispose(){el.removeEventListener('pointerdown',down);
      el.removeEventListener('pointermove',onMove);
      el.removeEventListener('pointerup',up);
      el.removeEventListener('pointercancel',up);}};
  }
  active(){return this.activeTouches>0 ||
    Math.abs(this.axes.throttle)+Math.abs(this.axes.yaw)+Math.abs(this.axes.pitch)+Math.abs(this.axes.roll)>0.01;}
}

/* ── InputManager ── */
export class InputManager{
  constructor(opts={}){
    this.cal=new Calibration();
    this.keyboard=new KeyboardSource(opts.kbLayout||'KB1');
    this.touch=new TouchSource();
    this._touchSeats={};       // Phase 4b：多席位觸控（split-screen 多人各自一組虛擬搖桿）
    this._kbExtra={};          // Phase 4：席位式輸入用到的額外鍵盤佈局（KB2…）
    this._axPrev={};           // 撥段開關前值
    this._axCache={}; this._frame=0;   // 撥桿邊緣事件的同幀快取
    this.backPauses=opts.backPauses!==false; this._backPrev=false;
    this._btnPrev={};          // 按鈕邊緣偵測
    this._menu={x:0,y:0,heldT:0,repT:0,armedX:true,armedY:true};
    this.flightMode=()=>getHand();   // 2026-10-10：改成跟著飛手記（core/hand.js）；沒選過＝沿用舊的整台設定 droneSimFlightMode，再沒有＝美國手
  }
  /* 取得（必要時建立）某個鍵盤佈局的來源；同一佈局重用同一個 KeyboardSource，
     避免重複掛 window 監聽。this.keyboard 預設就是 opts.kbLayout（多半是 KB1）。 */
  _getKb(layout){
    layout=layout||'KB1';
    if(this.keyboard.map===KB_LAYOUTS[layout])return this.keyboard;
    if(!this._kbExtra[layout])this._kbExtra[layout]=new KeyboardSource(layout);
    return this._kbExtra[layout];
  }
  gamepads(){ try{return [...(navigator.getGamepads?.()||[])].filter(Boolean);}catch{return [];} }

  /* 取得（必要時建立）某席位的觸控來源；n=0/null/undefined 沿用既有的 this.touch
     （單人模式 hud.attachTouch(input) 掛的就是這個實例，行為完全不變）；
     n≥1 則各自懶建立獨立的 TouchSource，供多人分割畫面各自一組虛擬搖桿用
     （見 hud.js 的 attachTouchSeat()）。 */
  touchSeat(n){
    n=n||0;
    if(n===0)return this.touch;
    if(!this._touchSeats[n])this._touchSeats[n]=new TouchSource();
    return this._touchSeats[n];
  }

  /* 正規化讀軸：動態校準 →(-1..1)→ deadzone → invert → expo */
  gpAxis(gp,name,cfg){
    cfg=cfg||gpCfgRead(gp);
    const mode=this.flightMode();
    const def = mode==='1' ? {yaw:0,throttle:3,roll:2,pitch:1}
                           : {yaw:0,throttle:1,roll:2,pitch:3};
    const defInv={throttle:true,pitch:true};  // [FIX 4] 標準映射：Y 軸反相、X 軸不反相
    let idx,invert,dz,expo,cfgRest,seed=null;
    if(cfg&&cfg.axes&&cfg.axes[name]!=null){
      const ax=cfg.axes[name];
      if(ax.min!=null&&ax.max!=null)seed=ax;
      idx=ax.i??ax.index??def[name]??0;
      invert=ax.inv??ax.invert??defInv[name]??false;
      cfgRest=ax.rest??0;
      dz=cfg.deadzone??0.12; expo=cfg.expo??0;
    } else { idx=def[name]??0; invert=defInv[name]??false; cfgRest=0; dz=0.12; expo=0; }
    if(cfg?.ignoreAxes?.includes(idx)) return 0;
    const raw=gp.axes[idx]??0;
    const c=this.cal.track(gp.id,idx,raw,cfgRest,seed);
    // 依 rest 分側正規化（解決「事先手測 ±1、比例不準」問題）
    let v;
    if(raw>=c.rest){ const span=c.max-c.rest; v=span>0.05?(raw-c.rest)/span:0; }
    else           { const span=c.rest-c.min; v=span>0.05?(raw-c.rest)/span:0; }
    v=_clamp(v,-1,1);
    if(Math.abs(v)<dz)v=0; else v=(v-Math.sign(v)*dz)/(1-dz);
    if(invert)v=-v;
    return _expo(v,expo);
  }
  gpBtn(gp,name,cfg){
    cfg=cfg||gpCfgRead(gp);
    const def=DEF_BTN;
    if(cfg&&cfg.axBtns){
      const ab=cfg.axBtns.find(b=>b.fn===name);
      if(ab!=null){
        const key=gp.id+'_'+ab.ax;
        const cur=gp.axes[ab.ax]??0;
        // 位置型（按住類功能、檔位）：撥桿停在「開」的那一邊＝按住
        if(ab.type==='hold') return (cur-(ab.mid??0))*(ab.on||1)>0.3;
        // 同一幀被問第二次（例如選單和關卡都問「確認」）回同一個答案，不然第二個人永遠拿到 false
        const ck=this._axCache[key]; if(this._frame>0&&ck&&ck.f===this._frame) return ck.v;
        const prev=this._axPrev[key]??cur;
        this._axPrev[key]=cur;
        let v=false;
        if(ab.type==='2pos') v=prev>0.5&&cur<-0.5;
        else if(ab.type==='3pos'){const pz=Math.abs(prev)<0.3; v=Math.abs(cur)>=0.3&&pz;}
        else if(ab.type==='toggle') v=Math.abs(cur-prev)>0.5;   // Phase 7：精靈指派的撥桿開關，撥任何一下都算
        this._axCache[key]={f:this._frame,v};
        return v;
      }
    }
    const bi=cfg?.buttons?.[name]??def[name]??0;
    return !!gp.buttons[bi]?.pressed;
  }
  /* 按鈕「剛按下」邊緣偵測（idx 為原始按鈕編號）
     ⚠ 必須每幀無條件呼叫——放在 && 右側被短路會讓 prev 狀態過期，
       症狀＝「只有第一下有效」。請改用 gpFnEdge()/player().fnEdge()。 */
  gpBtnEdge(gp,idx){
    const key=gp.id+'_b'+idx;
    // 2026-10-06 老師回饋：在選單按 A 進下一頁，A 還沒放開，新頁面一載入就把它當成「又按了一次」，畫面還沒出現就選下去了。
    // 剛用搖桿換頁（gpCarryMark）之後，第一次看到就已經按著的鍵不算「剛按下」，要放開再按才算。
    const cur=!!gp.buttons[idx]?.pressed, prev=this._btnPrev[key]??(cur&&gpCarried());
    this._btnPrev[key]=cur;
    return cur&&!prev;
  }

  /* [FIX 5] 功能鍵邊緣事件（camCycle/pilotCycle/confirm/back）：
     一般搖桿＝映射按鈕的邊緣偵測；STARTRC＝撥段開關（gpBtn 對 axBtns 本身即邊緣事件）。
     每幀呼叫一次即可，回傳「這一幀剛觸發」。 */
  gpFnEdge(gp,name,cfg){
    cfg=cfg||gpCfgRead(gp);
    if(cfg&&cfg.axBtns&&cfg.axBtns.find(b=>b.fn===name))
      return this.gpBtn(gp,name,cfg);
    const def=DEF_BTN;
    const bi=cfg?.buttons?.[name]??def[name]??0;
    return this.gpBtnEdge(gp,bi);
  }

  /* 任一支手把的具名按鍵是否按著（關卡自己做邊緣偵測）。沒有設定檔＝讀 DEF_BTN 的標準位置。 */
  anyBtn(name){ return this.gamepads().some(gp=>this.gpBtn(gp,name)); }
  /* 檔位撥桿：有手把把「檔位」指派給撥桿時回傳 true（二檔）／false（一檔）；沒有回傳 null（用按一下切換）。 */
  gearPos(){
    for(const gp of this.gamepads()){
      const cfg=gpCfgRead(gp), ab=cfg?.axBtns?.find(b=>b.fn==='gear'&&b.type==='hold');
      if(ab)return this.gpBtn(gp,'gear',cfg);
    }
    return null;
  }
  /* 畫面按鍵提示用：有設定檔的手把，回傳各功能在這支手把上叫什麼（沒指派＝鍵盤按法）。 */
  btnLabels(gp){
    const cfg=gpCfgRead(gp), prof=!!(cfg&&cfg.profileName), out={};
    // 標準手把用大家認得的鍵名（Xbox：RT、LB…；PS：R2、L1、✕○□△）；其他搖桿用設定時取的名字，沒取就寫編號
    const std=gp.mapping==='standard'||/xinput|xbox|standard gamepad/i.test(gp.id);
    const NM=std?(_isPS(gp.id)?PS_NAME:STD_NAME):null, custom=cfg?.labels||{};
    for(const fn in DEF_BTN){
      const ab=cfg?.axBtns?.find(b=>b.fn===fn), bi=prof?cfg.buttons?.[fn]:(cfg?.buttons?.[fn]??DEF_BTN[fn]);
      out[fn]=ab?(custom['a'+ab.ax]||'撥桿'+ab.ax):(bi>=0?(custom['b'+bi]||NM?.[bi]||'鈕'+bi):('鍵盤 '+KB_LABEL[fn]));
      if(NM&&!ab&&bi>=0)(out._idx=out._idx||{})[fn]=bi;     // 標準手把：附上按鈕編號（＝位置），hud 用來畫小圖示
    }
    return out;
  }

  update(dt){
    this._frame++;
    this.keyboard.update(dt);
    // 2026-10-07「返回＝暫停」：手把的返回鍵在飛行中當暫停用。每一關本來就聽鍵盤 Esc 來暫停／繼續，
    // 所以這裡在「剛按下返回鍵」時送出一個 Esc，全站關卡不用逐關改。開始畫面／結算畫面各關自己會忽略。
    if(this.backPauses){
      let now=false;
      for(const gp of this.gamepads()) if(this.gpBtn(gp,'back')) now=true;
      if(now&&!this._backPrev){
        if(globalThis.__ndKeysHide) globalThis.__ndKeysHide();        // 按鍵圖開著：返回鍵只關掉它，不動暫停狀態
        else try{ dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'})); }catch{}
      }
      this._backPrev=now;
    }
    for(const k in this._kbExtra)this._kbExtra[k].update(dt);
    this.cal.maybeSave(dt);
  }

  /* 歸零校準（[FIX 2]）：把「當下」讀值設為靜止位。
     使用前提：所有搖桿都已放開——由 UI 按鈕明確觸發，絕不自動。 */
  captureRest(){
    let n=0;
    for(const gp of this.gamepads()){
      const cfg=gpCfgRead(gp);
      const idxs=new Set();
      if(cfg&&cfg.axes)for(const k in cfg.axes)idxs.add(cfg.axes[k].i??cfg.axes[k].index??0);
      else [0,1,2,3].forEach(i=>idxs.add(i));
      // Phase 7：油門不回中的搖桿（設定檔 throttleType:'bottom'）油門靜止位＝行程中點，
      // 不能拿「放手時停在最下面」的讀值當靜止位（會變成放到底＝懸停）。
      const skip=(cfg&&cfg.throttleType==='bottom')?cfg.axes.throttle.i:-1;
      idxs.forEach(i=>{ if(i===skip)return; this.cal.setRest(gp.id,i,gp.axes[i]??0);n++;});
    }
    this.cal.save();
    return n;
  }
  /* 清除全部校準資料（極值＋靜止位歸出廠） */
  clearCalibration(){ this.cal.clear(); }

  /* 診斷：回傳某軸的完整讀值鏈（原始值/校準/輸出），供公平性頁顯示 */
  axisDebug(gp,name){
    const cfg=gpCfgRead(gp);
    const mode=this.flightMode();
    const def=mode==='1'?{yaw:0,throttle:3,roll:2,pitch:1}:{yaw:0,throttle:1,roll:2,pitch:3};
    let idx;
    if(cfg&&cfg.axes&&cfg.axes[name]!=null)idx=cfg.axes[name].i??cfg.axes[name].index??def[name]??0;
    else idx=def[name]??0;
    const raw=gp.axes[idx]??0;
    const c=(this.cal.data[gp.id]||{})[idx]||{rest:0,min:-0.85,max:0.85};
    return {idx,raw,rest:c.rest,min:c.min,max:c.max,out:this.gpAxis(gp,name,cfg)};
  }

  /* 席位輸入：Phase 0 單人 → gamepad[n] 優先，否則鍵盤，再否則觸控。
     輸出永遠是 -1..+1；速度上限由 physics 決定（公平性守則 4）。 */
  player(n=0){
    const gps=this.gamepads();
    const gp=gps[n];
    if(gp){
      const cfg=gpCfgRead(gp);
      globalThis.__ndBtnLabels=this.btnLabels(gp);   // hud.setGpBar 依此把 {gear} 這類代號換成這支手把上的鍵名
      const o={ device:'gamepad', id:gp.id,
        throttle:this.gpAxis(gp,'throttle',cfg), yaw:this.gpAxis(gp,'yaw',cfg),
        pitch:this.gpAxis(gp,'pitch',cfg), roll:this.gpAxis(gp,'roll',cfg),
        btn:(name)=>this.gpBtn(gp,name,cfg),
        btnEdge:(idx)=>this.gpBtnEdge(gp,idx),
        fnEdge:(name)=>this.gpFnEdge(gp,name,cfg) };
      const sw=handSwapFor(cfg)||(!cfg&&getHand()==='1'); globalThis.__ndHandSwap=sw;   // hud 提示列依此改字
      return handSwapFor(cfg)?_swapTP(o):o;
    }
    if(n===0){
      const src=this.touch.active()&&!this.keyboard.active()?this.touch:this.keyboard;
      const a=src.axes;
      const o={ device:src===this.touch?'touch':'keyboard',
        throttle:a.throttle, yaw:a.yaw, pitch:a.pitch, roll:a.roll,
        btn:()=>false, btnEdge:()=>false };
      return (src===this.touch&&getHand()==='1')?_swapTP(o):o;   // 日本手：觸控左桿上下＝前後、右桿上下＝油門
    }
    return { device:'none', throttle:0,yaw:0,pitch:0,roll:0, btn:()=>false, btnEdge:()=>false };
  }

  /* 席位式輸入（Phase 4，規劃書 5.2.2）：依 nd.settings.seats 存的 controller
     描述直接取正規化輸入，不像 player(n) 依賴「第 n 支已連接手把」的順序——
     多人關卡（pvp.html）每一席固定對應某支手把／某組鍵盤佈局／AI，
     手把插拔或順序改變都不會讓「這席是誰在玩」跑掉。
     ctl：{type:'gamepad',gpIndex} | {type:'keyboard',layout} | {type:'ai',...} | null
     AI 席位回傳的軸值全 0——AI 邏輯不讀這裡，由關卡另外呼叫 updateXxxAI()。 */
  playerFor(ctl){
    const none={ device:'none', throttle:0,yaw:0,pitch:0,roll:0, btn:()=>false, btnEdge:()=>false, fnEdge:()=>false };
    if(!ctl||ctl.type==='ai') return { ...none, device:ctl?.type==='ai'?'ai':'none' };
    if(ctl.type==='gamepad'){
      const gps=this.gamepads();
      const gp=gps.find(g=>g.index===ctl.gpIndex);
      if(!gp) return none;
      const cfg=gpCfgRead(gp);
      return { device:'gamepad', id:gp.id,
        throttle:this.gpAxis(gp,'throttle',cfg), yaw:this.gpAxis(gp,'yaw',cfg),
        pitch:this.gpAxis(gp,'pitch',cfg), roll:this.gpAxis(gp,'roll',cfg),
        btn:(name)=>this.gpBtn(gp,name,cfg),
        btnEdge:(idx)=>this.gpBtnEdge(gp,idx),
        fnEdge:(name)=>this.gpFnEdge(gp,name,cfg) };
    }
    if(ctl.type==='keyboard'){
      const src=this._getKb(ctl.layout);
      const a=src.axes;
      return { device:'keyboard', throttle:a.throttle, yaw:a.yaw, pitch:a.pitch, roll:a.roll,
        btn:()=>false, btnEdge:()=>false, fnEdge:()=>false };
    }
    if(ctl.type==='touch'){
      // ctl.seat 未指定時＝0，沿用 hud.attachTouch(input) 掛上去的同一份雙虛擬搖桿
      // （單人模式行為完全不變）；多人分割畫面由 hud.attachTouchSeat() 依 ctl.seat 各自掛獨立來源。
      const a=this.touchSeat(ctl.seat||0).axes;
      return { device:'touch', throttle:a.throttle, yaw:a.yaw, pitch:a.pitch, roll:a.roll,
        btn:()=>false, btnEdge:()=>false, fnEdge:()=>false };
    }
    return none;
  }

  /* 選單導航（規劃書 v1.2）：D-pad ＋ 右蘑菇頭撥動，邊緣觸發＋連發。
     回傳 {x:-1|0|1, y:-1|0|1, confirm, back}（confirm=A 或 R3） */
  pollMenu(dt){
    const out={x:0,y:0,confirm:false,back:false};
    const gp=this.gamepads()[0];
    const m=this._menu;
    let ax=0, ay=0;
    if(gp){
      const cfg=gpCfgRead(gp);
      // 右手桿（Mode2 的 roll/pitch 桿）— 必經正規化層，杜絕 RC 搖桿 rest≠0 狂捲
      ax=this.gpAxis(gp,'roll',cfg); ay=this.gpAxis(gp,'pitch',cfg);
      // D-pad（standard mapping b12-15）
      if(gp.buttons[12]?.pressed)ay=-1; if(gp.buttons[13]?.pressed)ay=1;
      if(gp.buttons[14]?.pressed)ax=-1; if(gp.buttons[15]?.pressed)ax=1;
      if(cfg&&cfg.profileName){     // 有設定檔：確認／返回照設定檔（遙控器的按鈕編號跟標準手把不同）
        if(this.gpFnEdge(gp,'confirm',cfg)) out.confirm=true;
        if(this.gpFnEdge(gp,'back',cfg)) out.back=true;
      }else{
      if(this.gpBtnEdge(gp,0)||this.gpBtnEdge(gp,11)) out.confirm=true; // A 或 R3
      if(this.gpBtnEdge(gp,1)) out.back=true;
      }
    }
    const TH=0.5, RESET=0.3;
    const fire=(v,armedKey)=>{
      if(Math.abs(v)>TH){
        if(m[armedKey]){ m[armedKey]=false; m.heldT=0; m.repT=0; return Math.sign(v); }
        m.heldT+=dt;
        if(m.heldT>0.4){ m.repT+=dt;
          if(m.repT>0.15){ m.repT=0; return Math.sign(v); } }
      } else if(Math.abs(v)<RESET){ m[armedKey]=true; }
      return 0;
    };
    out.x=fire(ax,'armedX'); out.y=fire(ay,'armedY');
    return out;
  }
}
