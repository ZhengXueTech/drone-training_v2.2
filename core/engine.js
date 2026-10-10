/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   engine.js — 引擎核心（ES Module）
   newdrone Phase 0
   ------------------------------------------------------------
   守則（skill 五大工程守則）：
   - clock.getDelta() 全系統只在本檔呼叫一次，clamp 0.1
   - simStarted 旗標由引擎管理（intro 期間不耗資源機制）
   - 卸載統一 dispose geometry/material（根治基本版記憶體洩漏）
   - r184：sRGB 輸出＋ACESFilmicToneMapping＋PCFSoftShadowMap
   ============================================================ */
import * as THREE from 'three';

export class Engine{
  constructor(canvas,opts={}){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,opts.lowQuality?1.5:2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=!opts.lowQuality;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(60,1,0.05,500);
    this.clock=new THREE.Clock();
    this.simStarted=false;         // intro 顯示期間 update 收到 simStarted=false
    this.paused=false;
    this._tick=null;
    globalThis.__ndEngine=this;    // 給診斷小視窗（core/debug-overlay.js）讀，平常沒有人用
    this._renderFn=null;           // Phase 4：分割畫面等多相機關卡可覆寫預設單相機渲染
    this._resize=()=>{
      const w=canvas.clientWidth||innerWidth, h=canvas.clientHeight||innerHeight;
      this.renderer.setSize(w,h,false);
      this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    };
    addEventListener('resize',this._resize);
    addEventListener('orientationchange',this._resize);
    this._resize();
  }
  /* fn(dt, simStarted) — dt 已 clamp；paused 時 dt=0 但仍渲染 */
  start(fn){
    this._tick=fn;
    this.renderer.setAnimationLoop(()=>{
      let dt=this.clock.getDelta();          // ← 全系統唯一一次呼叫
      if(dt>0.1)dt=0.1;                      // 分頁切回防暴衝
      if(this.paused)dt=0;
      this._tick&&this._tick(dt,this.simStarted);
      if(this._renderFn)this._renderFn(this.renderer,this.scene,this.camera);
      else this.renderer.render(this.scene,this.camera);
    });
  }
  /* Phase 4：多相機／分割畫面關卡（pvp.html）覆寫渲染步驟；
     不設定時行為完全不變（單相機 render，既有 13 關不受影響）。
     fn(renderer, scene, mainCamera) */
  setRenderFn(fn){ this._renderFn=fn; }
  stop(){ this.renderer.setAnimationLoop(null); }
  resize(){ this._resize(); }
  /* 深度釋放：卸載場景所有 geometry/material/texture */
  disposeScene(){
    this.scene.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      if(o.material){
        (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
          for(const k in m)if(m[k]&&m[k].isTexture)m[k].dispose();
          m.dispose();
        });
      }
    });
    this.scene.clear();
  }
  dispose(){
    this.stop(); this.disposeScene();
    removeEventListener('resize',this._resize);
    removeEventListener('orientationchange',this._resize);
    this.renderer.dispose();
  }
}
