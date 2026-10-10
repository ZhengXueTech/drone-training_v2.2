/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   drone-styles.js v2 — 機體樣式／實機數位分身註冊表（ES Module）
   newdrone Phase 0｜移植自基本版 v1.2（14 樣式全數保留）
   ------------------------------------------------------------
   ■ 機體座標規範（全系統凍結，見規劃書 5.5）：
       機頭 = -Z、機頂 = +Y、右舷 = +X
     基本版部分樣式機鼻朝 +Z（歷史因素）——本模組以 noseAxis
     欄位標記，於 buildDroneStyle() 內用外層 Group 統一轉正，
     保證任何樣式回傳時機頭都指向 -Z。
   ■ userData 約定：
       .noseDir  = Vector3(0,0,-1)（驗收站畫箭頭用）
       .spin     = 需要每幀旋轉的子物件（保護籠/光環）
       .cargo    = 貨運機吊掛物（cargo-lift 專用）
       .styleCode
   ■ 用法：
       import { DRONE_STYLES, buildDroneStyle, droneStyleGet, droneStyleSet } from './drone-styles.js';
       const mesh = buildDroneStyle('pvp-cage', { tint: 0xff3344 }); // tint = 席位隊色
   ■ 實機對應：機隊共 18 台（紅、藍各半）、遙控器 15 支。
       詳細型號盤點完成後，於 REAL_FLEET 補上實機建檔並精修對應樣式。
   ============================================================ */
import * as THREE from 'three';

const BR = 0.11; // 足球系機體半徑（公尺）

/* ── 足球系 ─────────────────────────────────────────────── */
function m_soccer(o){
  const tc=o.tc??0x00eeff, sc=o.sc??0x22d3ee, isPlayer=o.isPlayer??true;
  const g=new THREE.Group(); const S=0.22;
  const spin=new THREE.Group();
  const glowMat=new THREE.MeshStandardMaterial({color:tc,emissive:tc,emissiveIntensity:isPlayer?.85:.55,wireframe:true,transparent:true,opacity:isPlayer?.72:.55});
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(BR,14,10),glowMat));
  g.add(spin); g.userData.spin=spin;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14*S,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.9})));
  const armMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:.8});
  const armGeo=new THREE.CylinderGeometry(0.02*S,0.02*S,0.72*S,6);
  const a1=new THREE.Mesh(armGeo,armMat); a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(armGeo,armMat.clone()); a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.07*S,0.165*S,4),new THREE.MeshBasicMaterial({color:0xfacc15}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.32*S); g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(0.09*S,6,6),new THREE.MeshBasicMaterial({color:0xef4444}));
  tail.position.set(0,0,-0.32*S); g.add(tail);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:sc,emissive:sc,emissiveIntensity:isPlayer?1.2:.7,transparent:true,opacity:.42})));
  const led=new THREE.Mesh(new THREE.TorusGeometry(BR*.88,BR*.05,6,24),new THREE.MeshBasicMaterial({color:sc}));
  led.rotation.x=Math.PI/2; g.add(led);
  g.add(new THREE.PointLight(sc,isPlayer?.9:.45,1.8));
  return g;
}

function m_pvp(o){
  const tc=o.tc??0x00eeff;
  const g=new THREE.Group(),S=0.22;
  const glowM=new THREE.MeshBasicMaterial({color:tc,wireframe:true,transparent:true,opacity:.55});
  const glowMesh=new THREE.Mesh(new THREE.SphereGeometry(BR*.97,10,7),glowM);
  g.add(glowMesh); g.userData.spin=glowMesh;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.88,8,6),new THREE.MeshBasicMaterial({color:tc,transparent:true,opacity:.12})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:0x0a1428,metalness:.7,roughness:.35})));
  const armG=new THREE.BoxGeometry(BR*1.7*S,BR*.18*S,BR*.18*S);
  const armM=new THREE.MeshStandardMaterial({color:0x112244,metalness:.6,roughness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(armG,armM);a.rotation.y=ry;a.scale.setScalar(1/S);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,6),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x114422,emissiveIntensity:.8,metalness:.3}));
  nose.rotation.x=Math.PI/2; nose.position.z=BR*.62; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.15,6,4),new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff1100,emissiveIntensity:1.5}));
  tail.position.z=-BR*.62; g.add(tail);
  g.add(new THREE.PointLight(tc,.8,1.0));
  return g;
}

function m_realistic(o){
  const teamColor=o.tc??0x00eeff, armColor=o.armColor??0x112244;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR,16,12),new THREE.MeshPhongMaterial({color:teamColor,transparent:true,opacity:.28,shininess:90})));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(BR*.82,.011,4,20),new THREE.MeshBasicMaterial({color:teamColor,transparent:true,opacity:.55}));
  g.add(ring); g.userData.ring=ring; g.userData.spin=ring;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.40,8,8),new THREE.MeshStandardMaterial({color:0x0a1428,metalness:.7,roughness:.35})));
  const armGeo=new THREE.BoxGeometry(BR*1.65,BR*.15,BR*.15);
  const armMat=new THREE.MeshStandardMaterial({color:armColor,metalness:.6,roughness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(armGeo,armMat);arm.rotation.y=ry;g.add(arm);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,5),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x116622,emissiveIntensity:.9}));
  nose.rotation.x=Math.PI/2; nose.position.z=BR*.53; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.13,5,4),new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff1100,emissiveIntensity:1.8}));
  tail.position.z=-BR*.55; g.add(tail);
  g.add(new THREE.PointLight(teamColor,.75,.95));
  return g;
}

function m_gkpractice(o){
  const tc=o.tc??0x00eeff, isPlayer=o.isPlayer??true;
  const g=new THREE.Group(); const S=0.22;
  const spin=new THREE.Group();
  const gm=new THREE.MeshStandardMaterial({color:tc,emissive:tc,emissiveIntensity:isPlayer?.85:.55,wireframe:true,transparent:true,opacity:isPlayer?.72:.52});
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(BR,14,10),gm));
  g.add(spin); g.userData.spin=spin;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14*S,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.9})));
  const am=new THREE.MeshStandardMaterial({color:isPlayer?0x64748b:0x8b2222,metalness:.8});
  const ag=new THREE.CylinderGeometry(0.02*S,0.02*S,0.72*S,6);
  const a1=new THREE.Mesh(ag,am); a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(ag,am.clone()); a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08*S,0.2*S,4),new THREE.MeshBasicMaterial({color:isPlayer?0xfacc15:0xff6633}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.3*S); g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(0.09*S,6,6),new THREE.MeshBasicMaterial({color:isPlayer?0xef4444:0xff9900}));
  tail.position.set(0,0,-0.35*S); g.add(tail);
  g.add(new THREE.PointLight(tc,isPlayer?.6:.4,.65));
  return g;
}

function m_expgk(o){
  const color=o.color??0xcc0033;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(BR*.97,10,7),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.7}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.88,8,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.25})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:0x0a0018,metalness:.7,roughness:.35})));
  const armM=new THREE.MeshStandardMaterial({color:0x110022,metalness:.6,roughness:.4});
  const armG=new THREE.CylinderGeometry(0.015,0.015,BR*1.6,4);
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(armG,armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,6),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x22cc44,emissiveIntensity:1.2}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-BR*.62; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.15,6,4),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.5}));
  tail.position.z=BR*.62; g.add(tail);
  g.add(new THREE.PointLight(color,1.2,1.5));
  return g;
}

/* ── 任務系 ─────────────────────────────────────────────── */
function m_hover(o){
  const C=o.color??0x00ccaa;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,10),new THREE.MeshBasicMaterial({color:C,wireframe:true,transparent:true,opacity:.65}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.38,10,8),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.22})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8),new THREE.MeshStandardMaterial({color:0x0a1828,metalness:.8,roughness:.3})));
  const armM=new THREE.MeshStandardMaterial({color:0x1a3040,metalness:.7});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.8,4),armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.05,.10,4),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-.44; g.add(nose);
  g.add(new THREE.PointLight(C,1.5,2.0));
  return g;
}

function m_chaseai(o){
  const C=o.color??0xec4899;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.48,14,10),new THREE.MeshBasicMaterial({color:C,wireframe:true,transparent:true,opacity:.75}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.28})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13,8,8),new THREE.MeshStandardMaterial({color:0x200020,metalness:.8})));
  const armM=new THREE.MeshStandardMaterial({color:0x3d0030,metalness:.7});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.75,4),armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  g.add(new THREE.PointLight(C,1.5,2.5));
  return g;
}

function m_infinite(){
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16),new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8,wireframe:true,transparent:true,opacity:0.7}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:0.9})));
  const armMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:0.8});
  const a1=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.75,8),armMat);
  a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.75,8),armMat);
  a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.2,4),new THREE.MeshBasicMaterial({color:0xfacc15}));
  nose.rotation.x=-Math.PI/2; nose.position.set(0,0,-0.3); g.add(nose);
  return g;
}

function m_agri(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:0x3d6518,metalness:.5,roughness:.4})));
  const armM=new THREE.MeshStandardMaterial({color:0x4a7a20,metalness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(.52,.03,.05),armM);arm.rotation.y=ry;g.add(arm);});
  const propM=new THREE.MeshBasicMaterial({color:0x99dd44,transparent:true,opacity:.40});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(.09,16),propM);pd.rotation.x=-Math.PI/2;pd.position.set(mx*.184,.06,mz*.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.06,.12,6),new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x886600,emissiveIntensity:.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=.22; g.add(nose);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,.08,6),new THREE.MeshStandardMaterial({color:0x00ccff,emissive:0x006688,emissiveIntensity:.5}));
  nozzle.position.y=-.16; g.add(nozzle);
  g.add(new THREE.PointLight(0xaaff44,.6,.8));
  return g;
}

function m_rescue(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshStandardMaterial({color:0xff5500,metalness:0.4,roughness:0.4})));
  const armM=new THREE.MeshStandardMaterial({color:0xcc4400,metalness:0.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.03,0.05),armM);a.rotation.y=ry;g.add(a);});
  const propM=new THREE.MeshBasicMaterial({color:0xff8833,transparent:true,opacity:0.45});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(0.09,16),propM.clone());pd.rotation.x=-Math.PI/2;pd.position.set(mx*0.184,0.06,mz*0.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,6),new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x886600,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=0.22; g.add(nose);
  const lh=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.08,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.2,metalness:0.8}));
  lh.position.set(0,-0.13,0.04); g.add(lh);
  const sl=new THREE.PointLight(0xffffff,1.5,12); sl.position.set(0,-0.15,0.04); g.add(sl);
  const sLed=new THREE.SphereGeometry(0.02,6,6);
  const fL=new THREE.Mesh(sLed,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fL.position.set(0,0.05,0.13); g.add(fL);
  const rL=new THREE.Mesh(sLed.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rL.position.set(0,0.05,-0.13); g.add(rL);
  return g;
}

function m_bridge(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshStandardMaterial({color:0xffcc00,metalness:0.5,roughness:0.3})));
  const aM=new THREE.MeshStandardMaterial({color:0xddaa00,metalness:0.5});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.03,0.05),aM);arm.rotation.y=ry;g.add(arm);});
  const pM=new THREE.MeshBasicMaterial({color:0xffee88,transparent:true,opacity:0.40});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(0.09,16),pM.clone());pd.rotation.x=-Math.PI/2;pd.position.set(mx*0.184,0.06,mz*0.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,6),new THREE.MeshStandardMaterial({color:0xff4400,emissive:0x882200,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=0.22; g.add(nose);
  const sM=new THREE.MeshStandardMaterial({color:0x222222,roughness:0.3,metalness:0.8});
  const pod=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.10,8),sM);
  pod.rotation.x=Math.PI/2; pod.position.set(0,-0.08,0.06); g.add(pod);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6),new THREE.MeshStandardMaterial({color:0x880000,roughness:0.1,metalness:0.9}));
  tip.position.set(0,-0.08,0.12); g.add(tip);
  const sL=new THREE.SphereGeometry(0.02,6,6);
  const fL=new THREE.Mesh(sL,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fL.position.set(0,0.05,0.13); g.add(fL);
  const rL=new THREE.Mesh(sL.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rL.position.set(0,0.05,-0.13); g.add(rL);
  return g;
}

function m_inspection(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.20,0.06,0.20),new THREE.MeshStandardMaterial({color:0xe8e8e8,roughness:0.3,metalness:0.5})));
  const armMat=new THREE.MeshStandardMaterial({color:0xcccccc,roughness:0.4,metalness:0.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(0.40,0.025,0.04),armMat);arm.rotation.y=ry;g.add(arm);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.04,0.10,6),new THREE.MeshStandardMaterial({color:0x4488ff,emissive:0x224499,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.21); g.add(nose);
  const propGeo=new THREE.CylinderGeometry(0.09,0.09,0.015,12);
  [[0.13,0.13,0x4488ff],[-0.13,0.13,0x4488ff],[0.13,-0.13,0xaaaaaa],[-0.13,-0.13,0xaaaaaa]].forEach(([px,pz,col])=>{
    const pr=new THREE.Mesh(propGeo,new THREE.MeshStandardMaterial({color:col,transparent:true,opacity:0.75,metalness:0.3}));
    pr.position.set(px,0.04,pz); g.add(pr);
  });
  const gimbal=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.05,0.05),new THREE.MeshStandardMaterial({color:0x444444,roughness:0.3,metalness:0.7}));
  gimbal.position.set(0,-0.08,0.03); g.add(gimbal);
  const lens=new THREE.Mesh(new THREE.SphereGeometry(0.025,8,8),new THREE.MeshStandardMaterial({color:0x112244,roughness:0.05,metalness:0.95}));
  lens.position.set(0,-0.08,0.07); g.add(lens);
  const ledGeo=new THREE.SphereGeometry(0.022,6,6);
  const fLed=new THREE.Mesh(ledGeo,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fLed.position.set(0,0.05,0.13); g.add(fLed);
  const rLed=new THREE.Mesh(ledGeo.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rLed.position.set(0,0.05,-0.13); g.add(rLed);
  return g;
}

function m_cargo(o){
  const DRONE_COLOR=0xf59e0b, CARGO_COLOR=0xfbbf24;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.12,0.34),new THREE.MeshStandardMaterial({color:DRONE_COLOR,metalness:.7,roughness:.3})));
  [[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1]].forEach(([sx,,sz])=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.04,0.04),new THREE.MeshStandardMaterial({color:0x78350f}));
    arm.position.set(sx*.32,0,sz*.32); arm.rotation.y=Math.atan2(sz,sx); g.add(arm);
    const rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.025,10),new THREE.MeshStandardMaterial({color:DRONE_COLOR,transparent:true,opacity:.5}));
    rotor.position.set(sx*.42,0.06,sz*.42); g.add(rotor);
  });
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-0.30; g.add(nose);
  g.add(new THREE.PointLight(DRONE_COLOR,1.2,3));
  const cargo=new THREE.Group();
  const cbx=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.38,0.38),new THREE.MeshStandardMaterial({color:CARGO_COLOR,emissive:CARGO_COLOR,emissiveIntensity:.9,metalness:.3}));
  cbx.position.y=-0.75; cargo.add(cbx);
  cargo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,-0.75,0)]),new THREE.LineBasicMaterial({color:0x888888})));
  cargo.add(new THREE.PointLight(CARGO_COLOR,0.8,2));
  cargo.visible=(o&&o.showCargo===false)?false:true;
  g.add(cargo); g.userData.cargo=cargo;
  return g;
}

function m_multidef(){
  const DRONE_COLOR=0x7c3aed;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.35,0.12,0.35),new THREE.MeshStandardMaterial({color:DRONE_COLOR,metalness:.7,roughness:.3})));
  [[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1]].forEach(([sx,,sz])=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.05,0.05),new THREE.MeshStandardMaterial({color:0x3b0d8a}));
    arm.position.set(sx*.32,0,sz*.32); arm.rotation.y=Math.atan2(sz,sx); g.add(arm);
    const rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.025,10),new THREE.MeshStandardMaterial({color:0x6d28d9,transparent:true,opacity:.55}));
    rotor.position.set(sx*.42,0.06,sz*.42); g.add(rotor);
  });
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-0.31; g.add(nose);
  g.add(new THREE.PointLight(DRONE_COLOR,1.5,3));
  return g;
}

/* ── 樣式註冊表 ──────────────────────────────────────────────
   noseAxis：'−z' 已符合規範；'+z' 建構時機鼻朝 +Z（基本版歷史），
   buildDroneStyle() 會自動用外層 Group 轉正 180°。 */
export const DRONE_STYLES=[
 {code:'soccer-cage',   name:'足球競賽版',   badge:'足球系', noseAxis:'+z', sim:'足球競賽 3v3（單人＋AI）', feat:'隊色線框保護籠＋內部 LED 發光球＋水平 LED 環', src:'soccer-match.html → makeDroneMesh', build:m_soccer},
 {code:'pvp-cage',      name:'PVP 對戰版',   badge:'足球系', noseAxis:'+z', sim:'PVP 對戰 2/4/6 人', feat:'線框籠＋淡光暈＋X 方臂，綠鼻錐', src:'PVP/soccer-match-2p/4p/6p.html', build:m_pvp},
 {code:'realistic-shell',name:'真實防撞殼版', badge:'足球系', noseAxis:'+z', sim:'真實版足球對戰 FAI F9A-B', feat:'FAI 半透明 bumper 球殼＋旋轉光環', src:'PVP/soccer-realistic.html', build:m_realistic},
 {code:'gk-practice',   name:'守門練習版',   badge:'足球系', noseAxis:'+z', sim:'守門員練習模式', feat:'發光線框籠＋斜十字臂，雙配色', src:'practice-goalkeeper.html', build:m_gkpractice},
 {code:'exp-gk-red',    name:'守門挑戰版',   badge:'足球系', noseAxis:'-z', sim:'守門挑戰任務', feat:'紅色高亮線框籠＋高強度尾燈', src:'exp/exp-goalkeeper.html', build:m_expgk},
 {code:'trainer-orb',   name:'訓練型光球',   badge:'任務系', noseAxis:'-z', sim:'定點懸停訓練', feat:'大線框光球，訓練關卡標準機', src:'exp/exp-hover.html', build:m_hover},
 {code:'chase-ai',      name:'追逐 AI 機',   badge:'任務系', noseAxis:'-z', sim:'追逐任務（AI 目標機）', feat:'桃紅高亮光球、無鼻錐', src:'exp/exp-chase.html', build:m_chaseai},
 {code:'infinite-neon', name:'穿環霓虹版',   badge:'任務系', noseAxis:'-z', sim:'無限穿環挑戰', feat:'青色 emissive 線框球＋黃鼻錐', src:'exp/exp-infinite.html', build:m_infinite},
 {code:'agri-sprayer',  name:'農噴機',       badge:'任務系', noseAxis:'+z', sim:'農田噴灑任務', feat:'草綠機身＋四槳盤＋朝下噴頭', src:'exp/exp-agri.html', build:m_agri},
 {code:'rescue-search', name:'救援機',       badge:'任務系', noseAxis:'+z', sim:'夜間搜救任務', feat:'橘機身＋探照燈＋紅綠航行燈', src:'exp/exp-rescue.html', build:m_rescue},
 {code:'bridge-probe',  name:'橋檢機',       badge:'任務系', noseAxis:'+z', sim:'橋梁檢測任務', feat:'工程黃機身＋腹部感測莢艙', src:'exp/exp-bridge.html', build:m_bridge},
 {code:'inspect-cam',   name:'巡檢機',       badge:'任務系', noseAxis:'+z', sim:'設施巡檢任務', feat:'白方機身＋雲台相機，最像市售空拍機', src:'exp/exp-inspection.html', build:m_inspection},
 {code:'cargo-lift',    name:'貨運機',       badge:'任務系', noseAxis:'-z', sim:'貨物吊運任務', feat:'琥珀方機身＋鋼索吊掛發光貨箱', src:'exp/exp-cargo.html', build:m_cargo},
 {code:'multidef-guard',name:'防守機',       badge:'任務系', noseAxis:'-z', sim:'多機防守任務', feat:'紫色方形機身＋紫旋翼', src:'exp/exp-multidef.html', build:m_multidef},
];

/* ── 公開 API ───────────────────────────────────────────── */
const KEY='nd.settings.droneStyle';      // 新命名空間
const LEGACY_KEY='droneSimDroneStyle';   // 基本版舊 key（fallback 讀取）
const SCALE_KEY='nd.settings.droneVisualScale'; // 機體視覺大小（純視覺，不影響物理/碰撞尺寸）

export function buildDroneStyle(code,opts={}){
  const def=DRONE_STYLES.find(s=>s.code===code);
  if(!def){console.warn('[drone-styles] 未知樣式代號：'+code);return null;}
  // tint（席位隊色）：同時映射到各建構函式慣用的 tc / color 參數
  const o={...opts};
  if(opts.tint!=null){ o.tc=o.tc??opts.tint; o.color=o.color??opts.tint; }
  const inner=def.build(o);
  // 機頭規範化：+z 樣式外包一層並旋轉 180°，統一輸出機頭 = -Z
  let g;
  if(def.noseAxis==='+z'){
    g=new THREE.Group();
    inner.rotation.y=Math.PI;
    g.add(inner);
    Object.assign(g.userData, inner.userData); // spin / cargo / ring 上提
  } else {
    g=inner;
  }
  g.userData.styleCode=code;
  g.userData.noseDir=new THREE.Vector3(0,0,-1); // 規範：機頭 = -Z（驗收站據此畫箭頭）
  // 機體視覺大小：呼叫端可用 opts.scale 明確指定（例如 pvp.html 固定傳 1，
  // 避免多人分割畫面裡大小不一致）；沒指定時 fallback 讀取使用者全域偏好
  // （index.html「顯示設定」）。純粹縮放渲染用的 Group，物理/碰撞半徑
  // （core/physics.js、core/systems/soccer.js 的 BR 等）完全不受影響。
  const scale=(opts.scale!=null)?opts.scale:droneVisualScaleGet();
  if(scale && scale!==1) g.scale.setScalar(scale);
  return g;
}

export function droneStyleGet(slot){
  try{
    if(slot){const v=localStorage.getItem(KEY+'.'+slot); if(v)return v;}
    return localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
  }catch(e){return null;}
}
export function droneStyleSet(code,slot){
  try{localStorage.setItem(KEY+(slot?'.'+slot:''),code);}catch(e){}
}

export function droneVisualScaleGet(){
  try{
    const v=parseFloat(localStorage.getItem(SCALE_KEY));
    return (v>0 && isFinite(v)) ? v : 1;
  }catch(e){return 1;}
}
export function droneVisualScaleSet(scale){
  try{localStorage.setItem(SCALE_KEY,String(scale));}catch(e){}
}
