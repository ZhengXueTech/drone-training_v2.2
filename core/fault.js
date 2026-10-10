/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   fault.js — 🎲 神秘故障（2026-10-08，設計稿見專案 claude/newdrone-故障卡設計.md）
   ------------------------------------------------------------
   老師定案：當挑戰條件、每關都能選；飛到一半偷偷出狀況、過程不說；
   硬開完、太慘才給提示；飛完先猜再揭曉（名稱＋真實狀況說明），猜對給徽章；
   分兩級：輕＝搖桿偏移／單邊無力，重＝五種都可能。

   做法：只要 import 這個檔就生效，關卡本身不用改（challenge.js 已 import，另外第 2～6 關各加一行 import）：
     · 開始畫面（有 b-go／b-start／難度鈕的對話框）自動多一顆「🎲 神秘故障：關／輕／重」
     · InputManager.player(0) 的輸出在故障發生後被改寫（不改物理、不改關卡）
     · HUD.setTelemetry 用來偵測撞擊；HUD.setProgress／setScore 用來判斷「有沒有進度」
     · progress.record 時在成績標示「神秘故障・輕／重」，接著把關卡的結算對話框先換成「猜猜看」
   預設「關」：完全不改變任何行為（只多一顆按鈕）。
   ============================================================ */
import { UI } from './ui.js';
import { HUD } from './hud.js';
import { InputManager } from './input.js';
import { progress } from '../data/progress.js';

const STORE='nd.settings.fault';
const LV_LABEL=['關','輕','重'];
export const FAULTS={
  drift:{name:'搖桿偏移',emoji:'🎚️',
    why:'遙控器的微調（Trim）沒有歸零，或飛控的陀螺儀校正不準：放開搖桿時，機體還是一直往某個方向慢慢飄。',
    fix:'起飛前在平地做水平校正、把微調歸零；飛行中用小幅度的反向修正撐住，盡快降落檢查。'},
  weak:{name:'單邊無力',emoji:'🪫',
    why:'某一顆馬達老化、或槳葉有裂痕：那一側的推力比較小，機體會一直往那邊偏、還會慢慢轉。',
    fix:'不要硬拉高度，平穩降落；檢查槳葉有沒有破損、馬達是不是特別燙，換掉再飛。'},
  headless:{name:'無頭錯亂',emoji:'🧭',
    why:'無頭模式是用「起飛時機頭的方向」當作前方。起飛前沒對準、或飛行中重新校正錯了，推「前」就會往斜的方向飛。',
    fix:'先停住，用小幅度輕推找出實際的方向；必要時關掉無頭模式，改成看機頭方向飛。'},
  delay:{name:'訊號延遲',emoji:'📶',
    why:'距離太遠、中間有遮蔽、或附近有干擾：遙控訊號變慢，操作要等一下才反應，很容易修正過頭。',
    fix:'動作放小、放慢，等機體反應了再修；把無人機飛回近處，遠離干擾源。'},
  reverse:{name:'通道反向',emoji:'🔄',
    why:'遙控器或接收器的通道設定錯（某一軸被設成反向）：推右卻往左、推前卻往後。',
    fix:'起飛前一定要做「打桿檢查」，低空確認每個方向；發現反向立刻降落，把設定改回來。'},
};
const POOL={1:['drift','weak'],2:['drift','weak','headless','delay','reverse']};
const AXIS_NAME={roll:'左右',pitch:'前後',yaw:'轉向'};

const ENABLED=/\/levels\/((t0[2-9]|t1[01]|x)-[a-z-]+|acro-freeflight)\.html/.test(location.pathname)&&!/-pk\.html/.test(location.pathname);
let level=0; try{ level=Math.max(0,Math.min(2,parseInt(localStorage.getItem(STORE),10)||0)); }catch{}
const S={armed:false,lvl:0,id:null,p:{},t:0,at:0,on:false,onT:0,hinted:false,hits:[],lastProg:0,progKey:'',
  prevSpd:null,lastHit:-9,hud:null,pendingReveal:false,guessing:false,deferFocus:null,buf:[]};
export const faultState=S;                              // 測試與診斷用
export function faultLevel(){ return level; }
export function setFaultLevel(v){ level=Math.max(0,Math.min(2,v|0)); try{ localStorage.setItem(STORE,String(level)); }catch{} }

/* ── 1. 選一種故障、決定發生時間 ── */
function arm(){
  S.armed=true; S.lvl=level; S.t=0; S.on=false; S.hinted=false; S.hits=[];
  S.at=15+Math.random()*25;
  const pool=POOL[level]; S.id=pool[Math.floor(Math.random()*pool.length)];
  const sg=Math.random()<0.5?-1:1, a=Math.random()*Math.PI*2;
  S.p={sg, ox:Math.cos(a)*0.22, oy:Math.sin(a)*0.22,
       ang:sg*(Math.PI/3+Math.random()*Math.PI/3),       // 無頭錯亂：60～120 度
       axis:['roll','pitch','yaw'][Math.floor(Math.random()*3)]};
  S.hud?.toast?.(`🎲 神秘故障・${LV_LABEL[level]}：飛到一半會偷偷出一種狀況，飛完才揭曉`,'warn');
}
function trigger(){ S.on=true; S.onT=S.t; S.lastProg=S.t; S.hits=[]; S.buf=[]; }
function hint(){
  S.hinted=true;
  S.hud?.toast?.('🤔 好像哪裡怪怪的……試著小幅度推推看，觀察機體怎麼反應','warn');
}

/* ── 2. 計時（只算真的在飛的時間：開始後、沒暫停、沒開對話框） ── */
let _last=performance.now();
function tick(now){
  const dt=Math.min(0.1,(now-_last)/1000); _last=now;
  const e=globalThis.__ndEngine;
  if(ENABLED&&e){
    if(!S.armed&&e.simStarted&&level>0)arm();
    if(S.armed&&e.simStarted&&!e.paused&&!document.querySelector('.nd-modal-bg')){
      S.t+=dt;
      if(!S.on&&S.t>=S.at)trigger();
      if(S.on&&!S.hinted){
        const recent=S.hits.filter(h=>h>=S.onT&&h-S.onT<=20).length;
        if(recent>=3||S.t-Math.max(S.onT,S.lastProg)>=30)hint();
      }
    }
  }
  requestAnimationFrame(tick);
}
if(ENABLED)requestAnimationFrame(tick);

/* ── 3. 改寫搖桿輸出 ── */
const clamp=v=>Math.max(-1,Math.min(1,v));
export function applyFault(id,p,inp,t){
  const o={...inp};
  if(id==='drift'){ o.roll=clamp(o.roll+p.ox); o.pitch=clamp(o.pitch+p.oy); }
  else if(id==='weak'){ o.roll=clamp(o.roll+p.sg*0.2); o.yaw=clamp(o.yaw+p.sg*0.1); }
  else if(id==='headless'){ const c=Math.cos(p.ang), s=Math.sin(p.ang), r=o.roll, q=o.pitch; o.roll=clamp(r*c-q*s); o.pitch=clamp(r*s+q*c); }
  else if(id==='reverse'){ o[p.axis]=-o[p.axis]; }
  return o;
}
const _player=InputManager.prototype.player;
InputManager.prototype.player=function(n=0){
  const r=_player.call(this,n);
  if(!(ENABLED&&S.on&&n===0&&r&&r.device!=='none'))return r;
  if(S.id==='delay'){                                   // 0.4 秒前的輸入
    const now=performance.now(), cur={throttle:r.throttle,yaw:r.yaw,pitch:r.pitch,roll:r.roll};
    const last=S.buf[S.buf.length-1];
    if(!last||now-last.t>8)S.buf.push({t:now,v:cur});
    while(S.buf.length>1&&now-S.buf[1].t>=400)S.buf.shift();
    const old=(S.buf.length&&now-S.buf[0].t>=400)?S.buf[0].v:{throttle:0,yaw:0,pitch:0,roll:0};
    return {...r,...old};
  }
  return applyFault(S.id,S.p,r,S.t);
};

/* ── 4. 撞擊與進度偵測（借用 HUD 每幀都會呼叫的函式） ── */
const _tel=HUD.prototype.setTelemetry;
HUD.prototype.setTelemetry=function(alt,spd){
  S.hud=this;
  if(ENABLED&&S.on&&typeof spd==='number'){
    if(S.prevSpd!=null&&S.prevSpd-spd>3&&S.t-S.lastHit>1){ S.hits.push(S.t); S.lastHit=S.t; }
    S.prevSpd=spd;
  }
  return _tel.call(this,alt,spd);
};
const progMark=t=>{ const k=String(t??'').replace(/\d+(\.\d+)?\s*(秒|s\b|%|m\b|m\/s)/g,''); if(k!==S.progKey){ S.progKey=k; S.lastProg=S.t; } };
const _prog=HUD.prototype.setProgress;
HUD.prototype.setProgress=function(t){ S.hud=this; if(S.on)progMark(t); return _prog.call(this,t); };
const _score=HUD.prototype.setScore;
HUD.prototype.setScore=function(t){ S.hud=this; if(S.on&&t!==S._lastScore){ S._lastScore=t; S.lastProg=S.t; } return _score.call(this,t); };
const _toast=HUD.prototype.toast;
if(_toast)HUD.prototype.toast=function(...a){ S.hud=this; return _toast.apply(this,a); };

/* ── 5. 成績標示 ── */
const _record=progress.record.bind(progress);
progress.record=function(levelId,result={}){
  if(ENABLED&&S.armed&&S.on){
    const base=result.challenge&&result.challenge!=='標準'?result.challenge:'';
    result={...result,challenge:(base?base+'・':'')+'神秘故障・'+LV_LABEL[S.lvl],
      challengeCode:(result.challengeCode||'')+'f'+S.lvl,
      metrics:{...(result.metrics||{}),fault:S.id,faultHint:S.hinted}};
    S.pendingReveal=true;
  }else if(ENABLED&&S.armed&&!S.on){
    S.hud?.toast?.('🎲 這次飛得太快，神秘故障還沒來得及發生（成績照標準記）','ok');
  }
  return _record(levelId,result);
};

/* ── 6. 開始畫面的按鈕；結算前先「猜猜看」 ── */
const _show=UI.prototype.showModal, _focus=UI.prototype.gpSetFocus;
UI.prototype.gpSetFocus=function(ids,idx){
  if(S.guessing&&!this._faultOwn){ S.deferFocus=[ids,idx]; return; }
  return _focus.call(this,ids,idx);
};
UI.prototype.showModal=function(args){
  if(!ENABLED)return _show.call(this,args);
  const btns=args.buttons||[], e=globalThis.__ndEngine;
  // 結算對話框：先換成猜猜看
  if(S.pendingReveal&&!S.guessing&&!/暫停/.test(args.title||'')){
    S.pendingReveal=false; S.guessing=true; S.saved=args; S.deferFocus=null;
    return guessModal(this);
  }
  // 開始畫面：多一顆神秘故障（放在開始鈕或第一個難度鈕前面）
  const iStart=btns.findIndex(b=>/^(b-go|b-start|b-easy|b-diff-.+)$/.test(b.id));   // 開始鈕；情境關是難度鈕（簡單／中等／困難）
  if(iStart>=0&&!(e&&e.simStarted)&&!btns.some(b=>b.id==='b-fault')){
    const ui=this, me={id:'b-fault',label:'🎲 神秘故障：'+LV_LABEL[level],onClick:()=>{
      setFaultLevel((level+1)%3); ui.showModal(args);
      const ids=[...document.querySelectorAll('.nd-modal .btns button')].map(b=>b.id); _focus.call(ui,ids,Math.max(0,ids.indexOf('b-fault')));
    }};
    const nb=[...btns]; nb.splice(iStart,0,me);
    const note=level?`<p style="font-size:12px;color:#fbbf24">🎲 神秘故障・${LV_LABEL[level]}：飛到一半會偷偷出一種狀況（${level===1?'輕：搖桿偏移或單邊無力':'重：五種都有可能'}），過程中不提示，飛完先猜再揭曉，猜對有徽章。</p>`:'';
    const r=_show.call(this,{...args,buttons:nb,html:(args.html||'')+note});
    // 關卡會再呼叫 gpSetFocus（不含 b-fault）→ 把 b-fault 排進去，手把才選得到
    if(!this._navAdded)this._navAdded=[];
    if(!this._navAdded.includes('b-fault'))this._navAdded=[...this._navAdded,'b-fault'];
    return r;
  }
  return _show.call(this,args);
};
function guessModal(ui){
  const opts=[...POOL[S.lvl],'none'];
  const buttons=opts.map(k=>({id:'g-'+k,label:k==='none'?'😶 沒感覺到異常':FAULTS[k].emoji+' '+FAULTS[k].name,onClick:()=>reveal(ui,k)}));
  ui._faultOwn=true;
  const r=_show.call(ui,{title:'🎲 神秘故障：你覺得剛剛發生了什麼？',
    html:`<p>飛行途中，這台無人機偷偷出了一種狀況。回想一下手感，選一個你覺得最像的。</p>${S.hinted?'<p style="color:#9fc3d8">（中途有給過一次提示）</p>':''}`,buttons});
  ui._faultOwn=false; return r;
}
function reveal(ui,pick){
  const f=FAULTS[S.id], ok=pick===S.id;
  let badge='';
  if(ok){
    const id='fault-detective-'+S.lvl, name=S.lvl===2?'故障偵探（重）':'故障偵探（輕）', emoji=S.lvl===2?'🕵️':'🔍';
    try{ const list=JSON.parse(localStorage.getItem('nd.badges')||'[]');
      if(!list.some(b=>b.id===id)){ list.push({id,emoji,name,earnedAt:new Date().toISOString()}); localStorage.setItem('nd.badges',JSON.stringify(list)); badge=`<p>🏅 獲得徽章：<b>${emoji} ${name}</b></p>`; } }catch{}
  }
  const extra=S.id==='reverse'?`（這次反過來的是「${AXIS_NAME[S.p.axis]}」）`:S.id==='headless'?`（方向偏了約 ${Math.round(Math.abs(S.p.ang)*180/Math.PI)} 度）`:'';
  ui._faultOwn=true;
  _show.call(ui,{title:ok?'✅ 猜對了！':'答案揭曉',
    html:`<p>這次的故障是：<b style="font-size:18px">${f.emoji} ${f.name}</b>${extra}</p>
      <p>${ok?'你從手感就判斷出來了，很厲害！':'你選的是「'+(pick==='none'?'沒感覺到異常':FAULTS[pick].name)+'」。'}</p>
      <p style="color:#cfefff">📖 真實狀況：${f.why}</p><p style="color:#a7f3d0">🛠 遇到時怎麼辦：${f.fix}</p>${badge}`,
    buttons:[{id:'g-next',label:'看本次成績',onClick:()=>{
      S.guessing=false; const a=S.saved; S.saved=null; ui.showModal(a);
      if(S.deferFocus){ const [ids,idx]=S.deferFocus; S.deferFocus=null; ui.gpSetFocus(ids,idx); }
    }}]});
  ui._faultOwn=false;
}
