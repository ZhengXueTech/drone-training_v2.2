/* ============================================================
   systems/scoring.js — 判定與計分（ES Module）
   newdrone Phase 0：穿環判定（寬鬆優先——skill 守則 5）＋計分器
   競賽模式建議值以註解標明。
   ============================================================ */
import * as THREE from 'three';

const _rel=new THREE.Vector3(), _prev=new THREE.Vector3();

/* 穿環：跨越環平面且距環心 < radius（練習：不扣機身半徑；
   競賽模式建議值：radius - 0.15）。ring 為 world.makeRing 的 Group。 */
export function checkRingPass(ring,dronePos,prevPos){
  if(ring.userData.passed)return false;
  const r=ring.userData.radius??1.6;
  // 環面法線取環自身 -Z（未旋轉時環孔朝 Z）
  _rel.copy(dronePos).sub(ring.position);
  _prev.copy(prevPos).sub(ring.position);
  const n=new THREE.Vector3(0,0,1).applyQuaternion(ring.quaternion);
  const d1=_prev.dot(n), d2=_rel.dot(n);
  if(d1*d2<0){ // 跨面
    const dist=Math.sqrt(_rel.lengthSq()-d2*d2);
    if(dist<r){ ring.userData.passed=true; return true; }
  }
  return false;
}

export class ScoreKeeper{
  constructor(){ this.score=0; this.events=[]; }
  add(points,tag){ this.score+=points; this.events.push({points,tag,t:performance.now()}); }
}
