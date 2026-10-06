/* ============================================================
   physics.js — 統一飛行物理（ES Module）
   newdrone Phase 0
   ------------------------------------------------------------
   統一 DroneState（終結基本版家族 B/C 分裂）：
     { pos, vel, q, yaw, tilt:{pitch,roll}, battery, flags }
   雙飛行模式（skill 規範）：
     arcade：定高輔助（目標垂直速度＋PD 補償重力）、放桿自動煞停、
             視覺傾斜 lerp——初學者預設
     pro   ：全姿態四元數、推力沿機體 local up、無自動回正——準實機
   守則：重力 9.81、公尺制；阻尼一律 dt 化（Math.pow），
         迴圈內不 new 物件（scratch vectors）；輸入一律 -1..+1，
         速度上限由本檔常數決定（輸入公平性守則 4）。
   ============================================================ */
import * as THREE from 'three';
import { triggerAnomaly as _triggerAnomaly, rollGroundEffect, dampInput } from './systems/anomaly.js';

/* 物理常數表——全系統唯一來源。修改請附註原因（規劃書 5.1）。 */
export const PHYS_CONST = {
  GRAVITY: 9.81,          // m/s²（理化課對應）
  // arcade
  A_MAX_HSPEED: 8.0,      // 滿舵水平極速 m/s
  A_H_ACCEL: 14.0,        // 水平加速度 m/s²
  A_MAX_VSPEED: 4.0,      // 滿油門垂直速度 m/s
  A_VS_GAIN: 6.0,         // 垂直速度 PD 增益
  A_BRAKE_PER_SEC: 0.015, // 放桿水平存速比（dt 化：v*=pow(這值,dt)≈急煞）
  A_DRIFT_PER_SEC: 0.35,  // 推桿時水平存速比（保留動感）
  A_YAW_RATE: 2.6,        // rad/s
  A_TILT_MAX: 0.40,       // 視覺傾斜幅度 rad
  A_TILT_LERP: 8.0,       // 傾斜趨近速率
  // pro
  P_THRUST_MAX: 22.0,     // 最大推力加速度 m/s²（>g 才能爬升）
  P_RATE_PITCH: 3.2,      // rad/s 滿舵角速度
  P_RATE_ROLL: 3.6,
  P_RATE_YAW: 2.8,
  P_DRAG_PER_SEC: 0.55,   // 空氣阻尼存速比
  // 共通
  BOUNCE: 0.35,           // 邊界反彈恢復係數
  GROUND_Y: 0.15,         // 機體離地最低高度（半徑近似）
  GROUND_LEVEL_RATE: 6.0, // 貼地時機身擺平的速率（見下方 update() 說明）
  // angle（角度／自穩模式，2026-09-30 新增）：搖桿＝目標傾角，放開自動回平、不會翻
  G_ANGLE_MAX: 0.61,      // 最大傾角 rad（≈35°，常見新手／比賽機角度模式上限）
  G_ANGLE_GAIN: 7.0,      // 傾角趨近速率（一階，無超調；§3.2 擬真模式再做二階）
  G_ANGLE_RATE_MAX: 4.0,  // 傾角變化上限 rad/s（避免瞬間甩到位）
};

const _v1=new THREE.Vector3(), _v2=new THREE.Vector3();
const _q1=new THREE.Quaternion(), _e1=new THREE.Euler();
const _qLevel=new THREE.Quaternion(), _eLevel=new THREE.Euler();
const UP=new THREE.Vector3(0,1,0);
/* angle 模式：傾角一階趨近＋每秒變化上限（純函式，迴圈內不配置物件） */
function _angleStep(cur,tgt,dt,C){
  const mx=C.G_ANGLE_RATE_MAX*dt;
  return cur+THREE.MathUtils.clamp((tgt-cur)*Math.min(1,C.G_ANGLE_GAIN*dt),-mx,mx);
}

export class Drone{
  /* opts: {mode:'arcade'|'pro', bounds:{x,z,y}, spawn:Vector3} */
  constructor(opts={}){
    this.mode=opts.mode||'arcade';
    this.bounds=opts.bounds||{x:15,z:15,y:12};
    this.pos=(opts.spawn?opts.spawn.clone():new THREE.Vector3(0,1.5,0));
    this.vel=new THREE.Vector3();
    this.q=new THREE.Quaternion();
    this.yaw=0;
    this.tilt={pitch:0,roll:0};
    this.battery=100;
    this.flags={crashed:false,mustReturn:false};
    this.wind=null;                 // 由 WindSystem 注入 Vector3 或 null
    this.collided=false;            // 本幀是否撞邊界（供音效/HUD）
    // 2026-08-03 新增（使用者回饋「碰撞真實感」D 項：起降地面效應搖桿異常）：
    // anomalyT＝剩餘異常秒數，_geArmed＝貼地邊緣偵測旗標，_frozenInput＝
    // 異常期間凍結重播的指令快照，見 systems/anomaly.js。
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;
  }
  reset(spawn){
    if(spawn)this.pos.copy(spawn); else this.pos.set(0,1.5,0);
    this.vel.set(0,0,0); this.q.identity(); this.yaw=0;
    this.tilt.pitch=0; this.tilt.roll=0; this.flags.crashed=false;
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;
  }
  /* 供碰撞等外部事件呼叫（本檔目前沒有機體互撞場景，先留給未來擴充／
     其他系統直接 import 用；不影響現有任何呼叫端）。 */
  triggerAnomaly(dur){ _triggerAnomaly(this,dur); }
  /* input: {throttle,yaw,pitch,roll} ∈ [-1,1]；Model 2 慣例：pitch 推前=+1=機頭下壓前飛 */
  update(dt,input){
    const C=PHYS_CONST;
    // D 項：貼地（起飛爬升／降落下降中）才擲一次骰觸發。
    // [FIX] 2026-08-03 使用者修正：異常期間不是「輸入打折＋自動拉平」（那是
    // 飛控溫和接管的模型）——真實訊號異常是新指令送不到，機身維持異常
    // 發生那一刻的最後一組指令繼續飛，沒有人幫忙修正，才會飄到意料之外
    // 的位置。dampInput() 內部會凍結觸發當下的指令、之後每幀原樣重播，
    // 不再額外做姿態拉平；跟下面「貼地那一刻才擺平」的既有修正是兩回事，
    // 不受影響（那個只在真的碰到地板時才生效，這裡是「飛在空中訊號異常」）。
    rollGroundEffect(this,this.pos.y,this.vel.y);
    const inp=dampInput(this,input,dt);
    // 切換進 angle 模式的那一幀：從目前姿態接手傾角，避免機身瞬間跳動
    if(this.mode==='angle'&&this._prevMode!=='angle'){
      _e1.setFromQuaternion(this.q,'YXZ');
      this.tilt.pitch=THREE.MathUtils.clamp(_e1.x,-C.G_ANGLE_MAX,C.G_ANGLE_MAX);
      this.tilt.roll =THREE.MathUtils.clamp(_e1.z,-C.G_ANGLE_MAX,C.G_ANGLE_MAX);
    }
    this._prevMode=this.mode;
    if(this.mode==='arcade') this._arcade(dt,inp,C);
    else if(this.mode==='angle') this._angle(dt,inp,C);
    else this._pro(dt,inp,C);
    // 風
    if(this.wind){ this.vel.addScaledVector(this.wind,dt); }
    // 邊界
    this.collided=false;
    const b=this.bounds;
    if(this.pos.y<C.GROUND_Y){this.pos.y=C.GROUND_Y;
      if(this.vel.y<0){this.vel.y=-this.vel.y*C.BOUNCE*0.4;}
      // 2026-08-02 修正（使用者回報：acro／pro 模式落地後方向亂掉、不會擺回正面）：
      // pro 模式的姿態只由角速度積分而來，完全沒有跟地面互動的機制——邊界反彈
      // 只處理了位置/垂直速度，姿態不管墜地當下是什麼角度都會維持原樣，等於
      // 「掉到地上還維持墜機瞬間的傾斜角」，不符合真實無人機落地後機架/起落架
      // 貼地會自然擺平的樣子。這裡讓機身「貼地時」慢慢 slerp 擺平成水平、
      // 但保留目前朝向（yaw 不變，落地後鏡頭朝向不會被拗過去）——只在貼地那
      // 一刻才生效，飛在空中完全不受影響，acro／pro 模式空中一樣沒有自動回正。
      // 街機模式本來就每幀從 tilt 重新算出姿態、不受影響，這裡加給兩種模式共用
      // 也無害（街機的傾斜本來就會自然趨近 0，這裡只是讓貼地時收得更乾脆）。
      _eLevel.set(0,this.yaw,0,'YXZ');
      _qLevel.setFromEuler(_eLevel);
      this.q.slerp(_qLevel,Math.min(1,C.GROUND_LEVEL_RATE*dt));
    }
    if(this.pos.y>b.y){this.pos.y=b.y; if(this.vel.y>0)this.vel.y=0;}
    if(Math.abs(this.pos.x)>b.x){this.pos.x=Math.sign(this.pos.x)*b.x;
      this.vel.x=-this.vel.x*C.BOUNCE; this.collided=true;}
    if(Math.abs(this.pos.z)>b.z){this.pos.z=Math.sign(this.pos.z)*b.z;
      this.vel.z=-this.vel.z*C.BOUNCE; this.collided=true;}
  }
  _arcade(dt,inp,C){
    // 偏航
    this.yaw-=inp.yaw*C.A_YAW_RATE*dt;
    const cy=Math.cos(this.yaw), sy=Math.sin(this.yaw);
    // 機頭方向（機頭=-Z 規範；yaw=0 時朝 -Z）
    // 世界加速度：pitch 推前 → 沿機頭；roll 推右 → 沿右舷
    const fx=-sy, fz=-cy;          // forward（機頭）水平投影
    const rx=cy,  rz=-sy;          // right（右舷）
    _v1.set(fx*inp.pitch + rx*inp.roll, 0, fz*inp.pitch + rz*inp.roll);
    const stick=Math.hypot(inp.pitch,inp.roll);
    const gm=this.gearMul||1;   // 2026-10-01 檔位（挑戰條件）：二檔＝1.5，未設定＝1（原手感）
    if(stick>0.01){
      this.vel.addScaledVector(_v1,C.A_H_ACCEL*gm*dt);
      const keep=Math.pow(C.A_DRIFT_PER_SEC,dt);
      this.vel.x*=keep; this.vel.z*=keep;
      // 極速夾制（速度上限收歸物理層）
      const hs=Math.hypot(this.vel.x,this.vel.z);
      if(hs>C.A_MAX_HSPEED*gm){const k=C.A_MAX_HSPEED*gm/hs;this.vel.x*=k;this.vel.z*=k;}
    }else{
      const keep=Math.pow(C.A_BRAKE_PER_SEC,dt); // 放桿自動煞停
      this.vel.x*=keep; this.vel.z*=keep;
    }
    // 定高輔助：油門＝目標垂直速度，PD 趨近（重力已被補償概念化）
    const targetVy=inp.throttle*C.A_MAX_VSPEED;
    this.vel.y+= (targetVy-this.vel.y)*Math.min(1,C.A_VS_GAIN*dt);
    this.pos.addScaledVector(this.vel,dt);
    // 視覺傾斜（僅外觀，不參與力學）＋合成四元數
    // [FIX 3] 符號修正：機頭=-Z 時，rot.x 為正=機頭抬起；推前(pitch+)須「下壓」→ 取負
    const tp=-inp.pitch*C.A_TILT_MAX, tr=-inp.roll*C.A_TILT_MAX;
    const L=Math.min(1,C.A_TILT_LERP*dt);
    this.tilt.pitch+=(tp-this.tilt.pitch)*L;
    this.tilt.roll +=(tr-this.tilt.roll )*L;
    _e1.set(this.tilt.pitch,this.yaw,this.tilt.roll,'YXZ');
    this.q.setFromEuler(_e1);
  }
  /* angle：角度（自穩）模式——2026-09-30 新增（使用者回報：Acro 練習場「整台翻過去」）。
     介於 arcade 與 pro 之間的真實飛控模式：
       - 搖桿＝目標傾角（最多 G_ANGLE_MAX≈35°），放開自動回平 → 永遠不會翻
       - 推力沿機體 local up：傾斜才會產生水平加速度（真實原理，不是直接給速度）
       - 油門跟 pro 同一套（≤0 無推力），高度要自己抓——這是 angle 跟 arcade 最大差別
       - 沒有放桿急煞：回平後靠空氣阻力自然減速
     符號沿用 arcade（[FIX 3]：推前 pitch+ → 機頭下壓 → tilt.pitch 為負）。
     arcade／pro 兩個分支完全沒動（新增不修改守則）。 */
  _angle(dt,inp,C){
    this.yaw-=inp.yaw*C.P_RATE_YAW*dt;
    // 斜推（前＋右同時推到底）時，合成傾角也不超過上限：搖桿向量長度夾到 1
    const sm=Math.max(1,Math.hypot(inp.pitch,inp.roll));
    const amax=C.G_ANGLE_MAX*((this.gearMul||1)>1?1.3:1);   // 二檔：最大傾角 35°→約 45°
    const tp=-inp.pitch/sm*amax, tr=-inp.roll/sm*amax;
    this.tilt.pitch=_angleStep(this.tilt.pitch,tp,dt,C);
    this.tilt.roll =_angleStep(this.tilt.roll ,tr,dt,C);
    _e1.set(this.tilt.pitch,this.yaw,this.tilt.roll,'YXZ');
    this.q.setFromEuler(_e1);
    const thr=Math.max(0,inp.throttle)*C.P_THRUST_MAX;
    _v2.copy(UP).applyQuaternion(this.q);
    this.vel.addScaledVector(_v2,thr*dt);
    this.vel.y-=C.GRAVITY*dt;
    const keep=Math.pow(C.P_DRAG_PER_SEC,dt);
    this.vel.multiplyScalar(keep);
    this.pos.addScaledVector(this.vel,dt);
  }
  _pro(dt,inp,C){
    // 全姿態：機體角速度旋轉四元數
    // [FIX 3] 機頭=-Z 時繞 +X 正轉=機頭「抬起」；推前(pitch+)須下壓 → 取負
    const rm=this.gearMul||1;   // 二檔：旋轉更快
    _e1.set(-inp.pitch*C.P_RATE_PITCH*rm*dt,
            -inp.yaw*C.P_RATE_YAW*dt,
            -inp.roll*C.P_RATE_ROLL*rm*dt,'YXZ');
    _q1.setFromEuler(_e1);
    this.q.multiply(_q1);
    // 推力沿機體 local up。2026-08-02 修正：原本寫「油門 -1..1 → 0..max（中位≈懸停）」，
    // 但鍵盤/觸控/搖桿放開時輸入一律回到 0（軟體是彈簧回中），跟真實油門桿完全不同——
    // 真實油門是「桿推多高、動力就多高」，桿在下＝0（自由落體）、往上推才有推力，
    // 沒有「置中＝懸停」這回事（那是彈簧回中桿特有的假象，油門桿本來就不會彈簧回中）。
    // 改成：油門 ≤0（含放開）＝無推力＝自由落體，只有 0..+1 這段對應 0..max，
    // 才是真正的「放手就往下掉、要自己抓油門量」acro 手感。
    const thr=Math.max(0,inp.throttle)*C.P_THRUST_MAX;
    _v2.copy(UP).applyQuaternion(this.q);
    this.vel.addScaledVector(_v2,thr*dt);
    this.vel.y-=C.GRAVITY*dt;
    const keep=Math.pow(C.P_DRAG_PER_SEC,dt);
    this.vel.multiplyScalar(keep);
    this.pos.addScaledVector(this.vel,dt);
    // yaw 快取（HUD/小地圖用）
    _v1.set(0,0,-1).applyQuaternion(this.q);
    this.yaw=Math.atan2(-_v1.x,-_v1.z);
  }
  speed(){return this.vel.length();}
  hSpeed(){return Math.hypot(this.vel.x,this.vel.z);}
}