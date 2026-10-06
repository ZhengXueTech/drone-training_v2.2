/* ============================================================
   systems/battery.js — 電池系統（ES Module）
   newdrone Phase 0：可設起始%、耗率、充電站（含單次限制）
   simStarted=false 時不耗電（skill 守則 4）
   2026-07-22（t08）：新增 chargers[].maxPct——部分關卡的充電站只充到
   85% 就斷電（限電規劃教學：資源有上限，不是取之不盡），預設 100 不填
   即維持原本行為，t04/t05/t06 既有呼叫方式完全不受影響。
   ============================================================ */
export class BatterySystem{
  /* chargers: [{pos:Vector3, radius, rate, onceOnly, maxPct, used:false}] */
  constructor({start=100,drainPerSec=1.0,chargers=[]}={}){
    this.pct=start; this.drain=drainPerSec; this.chargers=chargers;
    this.charging=false; this.empty=false;
  }
  update(dt,dronePos,simStarted){
    if(!simStarted||this.empty)return;
    this.charging=false;
    for(const c of this.chargers){
      if(c.onceOnly&&c.used)continue;
      if(dronePos.distanceTo(c.pos)<(c.radius??2.5)){
        const cap=c.maxPct??100;
        this.pct=Math.min(cap,this.pct+(c.rate??30)*dt);
        this.charging=true;
        if(c.onceOnly&&this.pct>=cap)c.used=true;
        break;
      }
    }
    if(!this.charging){
      this.pct=Math.max(0,this.pct-this.drain*dt);
      if(this.pct<=0)this.empty=true;
    }
  }
}
