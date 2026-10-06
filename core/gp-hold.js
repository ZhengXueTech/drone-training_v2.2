/* ============================================================
   gp-hold.js — 「左搖桿左右推住」＝確認／返回（2026-10-06，規劃書附錄 E.2）
   ------------------------------------------------------------
   給沒有 A、B 鍵的遙控器（例：BETAFPV LiteRadio 只有兩支搖桿和撥桿開關）也能操作選單：
   偏航（左搖桿左右）往右推住半秒＝確認，往左推住半秒＝返回；畫面下方有進度條，放開就取消。
   防誤觸：要先回到中間才會開始計時（暫停當下手還推著不會誤觸發），觸發後也要回中才能再觸發。
   不依賴 three.js、不依賴 input.js（呼叫端把偏航值傳進來）。
   ============================================================ */
let _el=null;
function ring(){
  if(_el&&_el.isConnected)return _el;
  _el=document.createElement('div'); _el.id='nd-gp-hold';
  _el.style.cssText='position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:9500;pointer-events:none;display:none;'
    +'min-width:170px;padding:7px 14px 9px;border-radius:10px;background:rgba(6,14,24,.94);border:2px solid #fff;color:#fff;'
    +'font:14px/1.4 Consolas,"Microsoft JhengHei",monospace;text-align:center;box-shadow:0 0 18px rgba(0,0,0,.6);';
  _el.innerHTML='<div class="t"></div><div style="height:6px;margin-top:5px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;"><div class="b" style="height:100%;width:0;background:#fff;"></div></div>';
  document.body.appendChild(_el); return _el;
}
function show(dir,p){
  if(typeof document==='undefined'||!document.body)return;
  const el=ring(); el.style.display='block';
  el.querySelector('.t').textContent=dir>0?'確認 ▶ 推住':'推住 ◀ 返回';
  const c=dir>0?'#4ade80':'#fbbf24'; el.style.borderColor=c; el.style.color=c;
  const b=el.querySelector('.b'); b.style.background=c; b.style.width=Math.round(Math.min(1,p)*100)+'%';
}
function hide(){ if(_el)_el.style.display='none'; }

export class YawHold{
  constructor({time=0.5,on=0.6,off=0.3}={}){ this.time=time; this.on=on; this.off=off; this.reset(); }
  reset(){ this.armed=false; this.t=0; this.dir=0; this._last=0; hide(); }
  /* 每幀呼叫：yaw＝偏航 -1..1（右為正）。回傳 'confirm'｜'back'｜null。
     用真實時間計時，不用呼叫端的 dt：暫停時關卡給的 dt 是 0，畫面慢的電腦 dt 又會被截短，半秒會變成好幾秒。 */
  step(yaw){
    const now=performance.now(), dt=this._last?Math.min(0.25,(now-this._last)/1000):0; this._last=now;
    const a=Math.abs(yaw||0);
    if(a<this.off){ this.armed=true; this.t=0; this.dir=0; hide(); return null; }
    if(!this.armed)return null;
    if(a<this.on){ this.t=0; hide(); return null; }
    const d=yaw>0?1:-1;
    if(d!==this.dir){ this.dir=d; this.t=0; }
    this.t+=dt; show(d,this.t/this.time);
    if(this.t>=this.time){ this.armed=false; this.t=0; hide(); return d>0?'confirm':'back'; }
    return null;
  }
}
