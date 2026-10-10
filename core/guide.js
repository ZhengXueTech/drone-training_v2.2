/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   guide.js — 資料驅動引導系統（ES Module）
   newdrone Phase 0｜規劃書 5.6
   ------------------------------------------------------------
   步驟宣告式：
     [{ text:'起飛到 3 公尺', done:s=>s.drone.pos.y>3, arrow:Vector3? }]
   通用機制：提示顯示（hud.setGuide）、3D 指示箭頭、done 自動下一步。
   文字守則（5.7.3）：text ≤ 20 字——超過請拆步驟。
   完成狀態由關卡自行寫入 nd.progress（progress.record 的 metrics）。
   ============================================================ */
import * as THREE from 'three';

export class Guide{
  constructor(steps,hud,scene){
    this.steps=steps||[]; this.hud=hud; this.scene=scene;
    this.idx=-1; this.activeStep=null; this.finished=this.steps.length===0;
    this._arrow=null;
    if(this.steps.some(s=>(s.text||'').length>20))
      console.warn('[guide] 有步驟文字超過 20 字——防遮擋守則建議拆步驟');
  }
  start(){ if(this.steps.length){this.idx=0;this._enter();} }
  skipAll(){ this._clearArrow(); this.hud.setGuide(null); this.finished=true; }
  _enter(){
    this.activeStep=this.steps[this.idx];
    this.hud.setGuide(`${this.activeStep.text}（${this.idx+1}/${this.steps.length}）`);
    this._clearArrow();
    if(this.activeStep.arrow&&this.scene){
      const dir=new THREE.Vector3(0,-1,0);
      this._arrow=new THREE.ArrowHelper(dir,
        this.activeStep.arrow.clone().add(new THREE.Vector3(0,2.2,0)),1.6,0x4ade80,0.5,0.3);
      this.scene.add(this._arrow);
    }
  }
  _clearArrow(){
    if(this._arrow){this.scene.remove(this._arrow);this._arrow.dispose();this._arrow=null;}
  }
  /* simState 由關卡組裝，done(s) 依此判定 */
  update(dt,simState){
    if(this.finished||this.idx<0)return;
    if(this._arrow){ this._arrow.rotation.y+=dt*1.5; } // 輕微動態提示
    if(this.activeStep.done&&this.activeStep.done(simState)){
      this.idx++;
      if(this.idx>=this.steps.length){
        this.finished=true; this._clearArrow();
        this.hud.setGuide(null); this.hud.toast('引導完成！','ok');
      } else this._enter();
    }
  }
  dispose(){ this._clearArrow(); }
}
