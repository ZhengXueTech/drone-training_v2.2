/* ============================================================
   camera.js — 視角系統（ES Module）
   newdrone Phase 0｜規劃書 5.3 CAMERA_SPEC（凍結表）
   ------------------------------------------------------------
   模式：follow（遊戲視角）/ fpv（無人機視角）/ ground（飛手視角）/ overhead
   規格凍結：關卡只能改「站位座標」，不得改 FOV/offset/lerp。
   直拿手機：follow 距離 ×1.1（規劃書 5.7.2 唯一允許的方向修正）。
   ============================================================ */
import * as THREE from 'three';

export const CAMERA_SPEC={
  follow:  { fov:60, offset:new THREE.Vector3(0,2.4,7.0), posLerp:0.08, lookLerp:0.12 },
  fpv:     { fov:95 },
  ground:  { fov:55, lookLerp:0.1 },
  overhead:{ fov:50 },
};
export const CAM_MODES=['follow','fpv','ground'];
export const CAM_LABELS={follow:'跟機',fpv:'FPV',ground:'飛手',overhead:'俯視'};

const _v1=new THREE.Vector3(), _v2=new THREE.Vector3(), _q1=new THREE.Quaternion();

/* ── 分割畫面（Phase 4，規劃書 5.3「自 soccer-match-2p 收斂」）──
   panes: [{camera, rect:{x,y,w,h}}]（rect 為 0..1 比例，不是像素——
   自動換算目前 renderer 實際解析度，換裝置/轉橫直都不用改呼叫端）。
   同一顆 scene 用不同相機、不同 viewport/scissor 各畫一次。
   關卡若要單一共用相機（3+ 人類席位不分割），直接呼叫
   renderer.render(scene,camera) 就好，不需要這個函式。 */
export function renderSplit(renderer,scene,panes){
  /* 注意：renderer.setViewport()/setScissor() 內部會「自己再乘一次
     devicePixelRatio」（Three.js WebGLRenderer 原始碼：setViewport 收到的座標
     視為 CSS（未縮放）像素，內部才換算成實際 framebuffer 像素）。
     這裡務必用 domElement.clientWidth/clientHeight（CSS 像素），
     不能用 domElement.width/height（framebuffer 像素，已經乘過一次
     pixelRatio）——否則在 devicePixelRatio>=2 的機器上，viewport/scissor
     會被「乘兩次」導致座標跑出畫布範圍，看起來像「第二格畫面被擠成一小角」。
     （2026-07-23 實機回饋根因排查：https://github.com/mrdoob/three.js
     WebGLRenderer.setViewport 原始碼 `q.copy(re).multiplyScalar(te)`） */
  const w=renderer.domElement.clientWidth, h=renderer.domElement.clientHeight;
  renderer.setScissorTest(true);
  for(const p of panes){
    const x=Math.round(p.rect.x*w), y=Math.round(p.rect.y*h);
    const pw=Math.max(1,Math.round(p.rect.w*w)), ph=Math.max(1,Math.round(p.rect.h*h));
    renderer.setViewport(x,y,pw,ph);
    renderer.setScissor(x,y,pw,ph);
    if(p.camera.aspect!==pw/ph){ p.camera.aspect=pw/ph; p.camera.updateProjectionMatrix(); }
    renderer.render(scene,p.camera);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0,0,w,h);
}

export class CameraRig{
  /* pilotPositions：關卡可自訂的站位座標陣列（唯一可改項） */
  constructor(camera,opts={}){
    this.camera=camera;
    this.mode='follow';
    this.pilotPositions=opts.pilotPositions||[
      new THREE.Vector3(0,1.7,14), new THREE.Vector3(-10,1.7,12), new THREE.Vector3(10,1.7,12)];
    this.pilotIdx=0;
    this.crouch=false;
    this.portrait=false;         // 直拿手機由 hud 設定
    this._look=new THREE.Vector3();
    this._init=false;
  }
  cycleMode(){ this.mode=CAM_MODES[(CAM_MODES.indexOf(this.mode)+1)%CAM_MODES.length];
    this.camera.fov=CAMERA_SPEC[this.mode].fov??60; this.camera.updateProjectionMatrix();
    this._init=false; return this.mode; }
  setMode(m){ if(CAM_MODES.includes(m)||m==='overhead'){this.mode=m;
    this.camera.fov=CAMERA_SPEC[m].fov??60; this.camera.updateProjectionMatrix(); this._init=false;} }
  cyclePilot(){ this.pilotIdx=(this.pilotIdx+1)%this.pilotPositions.length; }
  /* drone：core/physics 的 Drone；mesh：機體 Group（fpv 取姿態） */
  update(dt,drone,mesh){
    const S=CAMERA_SPEC, cam=this.camera;
    if(globalThis.__ndDebugOn)globalThis.__ndCamDbg={mode:this.mode,dist:cam.position.distanceTo(drone.pos)};   // 診斷用：上一格鏡頭離機體多遠
    if(this.mode==='follow'){
      const k=this.portrait?1.1:1.0;
      // offset 在機體 yaw 座標系後上方（機頭=-Z → 相機在 +Z 後方）
      _v1.copy(S.follow.offset).multiplyScalar(k);
      _v1.applyAxisAngle(new THREE.Vector3(0,1,0),drone.yaw);
      _v1.add(drone.pos);
      if(!this._init){cam.position.copy(_v1);this._look.copy(drone.pos);this._init=true;}
      cam.position.lerp(_v1,Math.min(1,S.follow.posLerp*60*dt));
      this._look.lerp(drone.pos,Math.min(1,S.follow.lookLerp*60*dt));
      cam.lookAt(this._look);
    }else if(this.mode==='fpv'){
      cam.position.copy(drone.pos);
      // 鏡頭掛機鼻：three 相機 forward=-Z、機頭規範亦=-Z → 直接複製四元數即對齊
      cam.quaternion.copy(mesh?mesh.quaternion:drone.q);
    }else if(this.mode==='ground'){
      _v1.copy(this.pilotPositions[this.pilotIdx]);
      if(this.crouch)_v1.y*=0.55;
      cam.position.copy(_v1);
      this._look.lerp(drone.pos,Math.min(1,S.ground.lookLerp*60*dt));
      if(!this._init){this._look.copy(drone.pos);this._init=true;}
      cam.lookAt(this._look);
    }else if(this.mode==='overhead'){
      cam.position.set(0,Math.max(this.pilotPositions[0].z*1.6,18),0.01);
      cam.lookAt(0,0,0);
    }
  }
}
