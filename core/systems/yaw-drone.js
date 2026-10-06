/* ============================================================
   systems/yaw-drone.js — C1 家族共用物理（ES Module）v1.0
   newdrone Phase 5｜抽出自 systems/soccer.js 的 SoccerDrone（不動 soccer.js 本體）
   ------------------------------------------------------------
   適用關卡（家族 C1：yaw-only＋重力/懸浮推力，無四元數視覺傾斜）：
     農噴 / 巡檢 / 搜救 / 橋檢 / 守門（exp-agri/inspection/rescue/bridge/goalkeeper）
   這五關的基本版物理函式（agriPhysics/physicsDrone 等）結構跟
   soccer.js 的 SoccerDrone.integrate() 幾乎一致，差別只在各關卡自訂的
   THRMAX/PITCHMAX/YAWMAX/DRAG/彈性係數與場地邊界，因此抽成本模組，
   讓每一關只需傳自己的物理參數表＋邊界即可共用同一套積分/邊界反彈邏輯。
   [FIX] 阻尼 dt 化：基本版各關卡的 DRAG（如 exp-goalkeeper 的 0.92）
   都是「每幀」假設（綁定 60fps），沿用 soccer.js 已驗證的做法，
   換算為每秒存速比 DRAG^60，以 Math.pow(K,dt) 施加。
   座標慣例（沿 soccer.js／exp-goalkeeper）：yaw=0 時機頭朝 +Z
   （與 drone-styles 機頭 -Z 規範相反，關卡同步 mesh 時
   須 mesh.rotation.y = yaw + Math.PI；相機 CameraRig 也需餵入
   yaw+Math.PI 才能跟 mesh 的視覺朝向一致，見各關卡 camProxy 用法）。
   ============================================================ */
import * as THREE from 'three';
import { rollGroundEffect, dampInput, triggerAnomaly as _triggerAnomaly } from './anomaly.js';

/* 預設物理參數（沿 soccer.js SOCCER_PHYS 原值）；關卡可整包覆寫某幾項，
   例如 exp-goalkeeper 用 PITCHMAX:18、DRAG_PER_SEC:Math.pow(0.92,60)、
   WBOUNCE:0.45、FBOUNCE:0.3（守門手感更靈活、撞擊彈得更明顯）。 */
export const YAW_PHYS_DEFAULT={
  GRAVITY:-9.81, HOVER:9.81,
  THRMAX:14, PITCHMAX:8, YAWMAX:2.8,
  DRAG_PER_SEC:Math.pow(0.87,60),
  WBOUNCE:0.35, FBOUNCE:0.18,
};

/* bounds：{minX,maxX,minY,maxY,minZ,maxZ,BR}——BR 是機體半徑，反彈時
   會讓機身邊緣（而非中心點）貼齊邊界，沿 soccer.js/exp-goalkeeper 慣例。 */
export const DEFAULT_BOUNDS={minX:-1.5,maxX:1.5,minY:0,maxY:3,minZ:-3,maxZ:3,BR:0.11};

export class YawDrone{
  /* opts:{spawn:Vector3, yaw:number, bounds:{}, phys:{}} */
  constructor(opts={}){
    this.pos=(opts.spawn?opts.spawn.clone():new THREE.Vector3(0,1.5,0));
    this.vel=new THREE.Vector3();
    this.yaw=opts.yaw??0;
    this.prevZ=this.pos.z;
    this.bounds=opts.bounds||DEFAULT_BOUNDS;
    this.phys=opts.phys||YAW_PHYS_DEFAULT;
    // 2026-08-03 新增（使用者回饋「碰撞真實感」D 項：起降地面效應搖桿異常）：
    // anomalyT／_geArmed／_frozenInput 見 systems/anomaly.js，跟 physics.js 的 Drone 共用同一套引擎。
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;
  }
  reset(spawn,yaw=0){
    if(spawn)this.pos.copy(spawn);
    this.vel.set(0,0,0); this.yaw=yaw; this.prevZ=this.pos.z;
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;
  }
  triggerAnomaly(dur){ _triggerAnomaly(this,dur); }
  /* 玩家輸入（統一語意合約：throttle+=升、yaw+=右轉、pitch+=前進、roll+=右移）
     沿 soccer.js SoccerDrone.step：螢幕右=-X → roll 取負；yaw+=右轉=yaw 減小 → 取負
     D 項：只套用在玩家操控的 step()（AI 走 aiMoveWorld 直接控速度，不經過搖桿
     輸入，沒有「訊號異常」這個概念可套用，維持原樣）。 */
  /* 2026-10-01 挑戰條件（core/challenge.js 設定實例屬性，未設定＝原手感）：
     this.noHold＝true：拿掉定高，油門 ≤0＝無推力往下掉（同角度模式／足球專家）
     this.gearMul ：二檔水平推力倍率（1.5） */
  step(dt,ctl,SF=1){
    const P=this.phys;
    rollGroundEffect(this,this.pos.y-this.bounds.minY,this.vel.y);
    const inp=dampInput(this,ctl,dt);
    const GM=this.gearMul||1;
    const ay=this.noHold?Math.max(0,inp.throttle)*(P.HOVER+P.THRMAX):P.HOVER+inp.throttle*P.THRMAX*SF;
    this.integrate(dt, -inp.roll*P.PITCHMAX*SF*GM, ay,
                       inp.pitch*P.PITCHMAX*SF*GM, -inp.yaw*P.YAWMAX);
  }
  /* 原始積分（AI moveTo 也可直接呼叫；ax/az 依 yaw 轉世界系——沿 soccer.js 行為） */
  integrate(dt,ax,ay,az,yr){
    const P=this.phys, B=this.bounds;
    this.prevZ=this.pos.z;
    this.yaw+=yr*dt;
    const sy=Math.sin(this.yaw), cy=Math.cos(this.yaw);
    this.vel.x+=(ax*cy+az*sy)*dt;
    this.vel.y+=(ay+P.GRAVITY)*dt;
    this.vel.z+=(ax*-sy+az*cy)*dt;
    this.vel.multiplyScalar(Math.pow(P.DRAG_PER_SEC,dt));
    this.pos.addScaledVector(this.vel,dt);
    if(this.pos.y<B.minY+B.BR){this.pos.y=B.minY+B.BR;this.vel.y=Math.abs(this.vel.y)*P.FBOUNCE;}
    if(this.pos.y>B.maxY-B.BR){this.pos.y=B.maxY-B.BR;this.vel.y=-Math.abs(this.vel.y)*P.WBOUNCE;}
    if(this.pos.x<B.minX+B.BR){this.pos.x=B.minX+B.BR;this.vel.x=Math.abs(this.vel.x)*P.WBOUNCE;}
    if(this.pos.x>B.maxX-B.BR){this.pos.x=B.maxX-B.BR;this.vel.x=-Math.abs(this.vel.x)*P.WBOUNCE;}
    if(this.pos.z<B.minZ+B.BR){this.pos.z=B.minZ+B.BR;this.vel.z=Math.abs(this.vel.z)*P.WBOUNCE;}
    if(this.pos.z>B.maxZ-B.BR){this.pos.z=B.maxZ-B.BR;this.vel.z=-Math.abs(this.vel.z)*P.WBOUNCE;}
  }
  speed(){return this.vel.length();}
}

/* AI 世界系移動（沿基本版 aiMoveWorld：lerp 朝目標速度、只夾 X/Y 邊界，
   Z 方向刻意不夾——攻擊方/巡邏機需要飛越場地縱深，沒有 Z 牆）。
   d：{pos,vel,yaw,prevZ}（YawDrone 實例或同形狀的 plain object 皆可）。 */
export function aiMoveWorld(d,tgt,dt,maxSpd,bounds,phys=YAW_PHYS_DEFAULT){
  const toT=tgt.clone().sub(d.pos);
  const dist=toT.length();
  if(dist<0.005)return;
  const dir=toT.divideScalar(dist);
  const desired=dir.multiplyScalar(Math.min(maxSpd,dist/dt*0.8));
  d.vel.lerp(desired,Math.min(dt*8,1.0));
  d.vel.clampLength(0,maxSpd*1.15);
  d.prevZ=d.pos.z;
  d.pos.addScaledVector(d.vel,dt);
  const B=bounds;
  if(d.pos.y<B.minY+B.BR){d.pos.y=B.minY+B.BR;d.vel.y=Math.abs(d.vel.y)*phys.FBOUNCE;}
  if(d.pos.y>B.maxY-B.BR){d.pos.y=B.maxY-B.BR;d.vel.y=-Math.abs(d.vel.y)*phys.WBOUNCE;}
  if(d.pos.x<B.minX+B.BR){d.pos.x=B.minX+B.BR;d.vel.x=Math.abs(d.vel.x)*phys.WBOUNCE;}
  if(d.pos.x>B.maxX-B.BR){d.pos.x=B.maxX-B.BR;d.vel.x=-Math.abs(d.vel.x)*phys.WBOUNCE;}
  if(d.vel.length()>0.1) d.yaw=Math.atan2(d.vel.x,d.vel.z);
}

/* 球體/機體彈性碰撞＋分離（沿 soccer.js resolveCollisions，BR 由呼叫端傳入） */
export function resolveSphereCollisions(list,BR){
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i], b=list[j];
    const diff=a.pos.clone().sub(b.pos);
    const d2=diff.lengthSq(), md=BR*2;
    if(d2<md*md&&d2>1e-4){
      const dist=Math.sqrt(d2), n=diff.divideScalar(dist);
      const imp=a.vel.clone().sub(b.vel).dot(n)*.65;
      if(imp<0){a.vel.addScaledVector(n,-imp*.5); b.vel.addScaledVector(n,imp*.5);}
      const ov=(md-dist)*.52;
      a.pos.addScaledVector(n,ov); b.pos.addScaledVector(n,-ov);
    }
  }
}

/* ============================================================
   守門攔截的撞擊結果（2026-10-03 新增；使用者回饋「守球門的碰撞很奇怪，
   怎麼都跟撞球定桿一樣」）
   ------------------------------------------------------------
   原本：一碰到，前鋒當場凍結在原地、守門員固定被推 1.5 m/s——每次都一樣。
   現在比照足球 resolveCollisions 的機率分段，依「相對衝擊速度」擲骰：
     bounce（多數）：前鋒往回彈開、帶隨機偏轉；守門員依衝擊力道後座。
     stun  （少數）：定桿——前鋒幾乎停下（＝原本的行為，保留當其中一種結果）。
     knock （偶爾，衝擊越快機率越高 5%／25%／40%）：守門員被撞飛、
            方向隨機偏轉，並有六成機率短暫訊號異常——門會空出來。
   gk／other：有 pos、vel 的物件（YawDrone 或 plain object）。
   n：從 other 指向 gk 的單位向量。回傳 'bounce'|'stun'|'knock'。
   ============================================================ */
const _bi=new THREE.Vector3(), _bd=new THREE.Vector3();
function _deflected(n,sign,maxAng){
  const ang=(Math.random()*2-1)*maxAng, cs=Math.cos(ang), sn=Math.sin(ang);
  return _bd.set((n.x*cs-n.z*sn)*sign,n.y*sign+(Math.random()*2-1)*0.25,(n.x*sn+n.z*cs)*sign).normalize();
}
export function blockImpact(gk,other,n,rng=Math.random){
  const closing=Math.abs(_bi.copy(gk.vel).sub(other.vel).dot(n));
  const pKnock=closing<1.5?0.05:closing<3.5?0.25:0.40, pStun=0.15;
  const r=rng();
  if(r<pKnock){
    gk.vel.copy(_deflected(n,1,0.6)).multiplyScalar(Math.max(2.2,closing*0.85));
    other.vel.multiplyScalar(0.15);
    if(Math.random()<0.6&&gk.triggerAnomaly)gk.triggerAnomaly(0.4+Math.random()*0.4);
    return 'knock';
  }
  if(r<pKnock+pStun){
    other.vel.multiplyScalar(0.1);
    gk.vel.addScaledVector(n,1.5);
    return 'stun';
  }
  other.vel.copy(_deflected(n,-1,0.7)).multiplyScalar(Math.max(1.4,closing*0.6));
  gk.vel.addScaledVector(n,Math.max(0.8,closing*0.35));
  return 'bounce';
}
/* 被擋下後的翻滾（前鋒鎖定期間不再凍結在原地）：帶著撞擊後的速度飄開、
   慢慢下墜、碰牆反彈。d：{pos,vel}；bounds 含 BR。 */
export function tumbleStep(d,dt,bounds,phys=YAW_PHYS_DEFAULT){
  const B=bounds;
  d.vel.y-=3.5*dt;
  d.vel.multiplyScalar(Math.pow(0.25,dt));
  d.pos.addScaledVector(d.vel,dt);
  if(d.pos.y<B.minY+B.BR){d.pos.y=B.minY+B.BR;d.vel.y=Math.abs(d.vel.y)*phys.FBOUNCE;}
  if(d.pos.y>B.maxY-B.BR){d.pos.y=B.maxY-B.BR;d.vel.y=-Math.abs(d.vel.y)*phys.WBOUNCE;}
  if(d.pos.x<B.minX+B.BR){d.pos.x=B.minX+B.BR;d.vel.x=Math.abs(d.vel.x)*phys.WBOUNCE;}
  if(d.pos.x>B.maxX-B.BR){d.pos.x=B.maxX-B.BR;d.vel.x=-Math.abs(d.vel.x)*phys.WBOUNCE;}
  if(d.pos.z<B.minZ+B.BR){d.pos.z=B.minZ+B.BR;d.vel.z=Math.abs(d.vel.z)*phys.WBOUNCE;}
  if(d.pos.z>B.maxZ-B.BR){d.pos.z=B.maxZ-B.BR;d.vel.z=-Math.abs(d.vel.z)*phys.WBOUNCE;}
}
