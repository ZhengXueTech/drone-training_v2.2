/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   tracks/race-forest.js — 改裝賽道「森林峽谷」的賽道資料（2026-10-11 從 levels/race-forest.html 原封搬出來，
   讓單人賽道與賽道對戰 levels/race-pk.html 共用同一份；內容一字未改）
   ============================================================ */
import * as THREE from 'three';
/* 固定亂數（每次樹的位置都一樣，成績才能比） */
let seed=20261009; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
/* 賽道中心線：封閉曲線，經過低空倒木（第 5 個控制點）與山脊（第 7 個控制點） */
const CP=[[0,2.6,20],[14,3.2,18],[24,5,8],[26,6,-6],[16,3.2,-16],[4,1.8,-20],[-10,4,-14],[-22,7,-6],[-24,3.5,8],[-12,2.4,16]]
  .map(a=>new THREE.Vector3(...a));
const curve=new THREE.CatmullRomCurve3(CP,true,'catmullrom',0.5);
const N=14, pts=curve.getSpacedPoints(N).slice(0,N);
const BOOST=[4,10], CHARGE=[7];
const rings=pts.map((p,i)=>({p,kind:BOOST.includes(i)?'boost':CHARGE.includes(i)?'charge':'ring',r:i===0?2.2:1.8}));
/* 樹：避開賽道走廊 4.5 公尺 */
const path=curve.getSpacedPoints(160), BX=34, BZ=26;
const trees=[], obstacles=[];
for(let n=0;n<600&&trees.length<85;n++){
  const x=(rnd()*2-1)*(BX-1.5), z=(rnd()*2-1)*(BZ-1.5);
  let near=1e9; for(const q of path){ const d=Math.hypot(q.x-x,q.z-z); if(d<near)near=d; }
  if(near<4.5)continue; if(Math.hypot(x+6,z-23)<4)continue;                 // 停機坪旁邊留空
  if(trees.some(t=>Math.hypot(t.x-x,t.z-z)<2.2))continue;
  const h=6+rnd()*5, r=0.3+rnd()*0.2; trees.push({x,z,h,r});
  obstacles.push({x,z,r,h:h*0.5},{x,z,r:1.25,y0:h*0.45,h:h*0.92});            // 樹幹＋樹冠
}
/* 峽谷兩側的岩石（第 2～3 個控制點之間的外側） */
const rocks=[];
for(let t=0.17;t<0.33;t+=0.022){ const p=curve.getPointAt(t), tg=curve.getTangentAt(t); const nx=tg.z, nz=-tg.x, L=Math.hypot(nx,nz);
  for(const s of [-1,1]){ const x=p.x+s*nx/L*4.6, z=p.z+s*nz/L*4.6, r=1.1+rnd()*0.7, h=3+rnd()*4; rocks.push({x,z,r,h}); obstacles.push({x,z,r,h}); } }
function decorate(scene){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(BX*2,BZ*2),new THREE.MeshStandardMaterial({color:0x1f3a22,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.position.y=0.01; ground.receiveShadow=true; scene.add(ground);
  const trunkG=new THREE.CylinderGeometry(1,1,1,7), leafG=new THREE.ConeGeometry(1,1,8);
  const trunks=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:0x5b3a21}),trees.length);
  const leaves=new THREE.InstancedMesh(leafG,new THREE.MeshStandardMaterial({color:0x2f7a3b,flatShading:true}),trees.length);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3();
  trees.forEach((t,i)=>{ trunks.setMatrixAt(i,m.compose(p.set(t.x,t.h*0.25,t.z),q,s.set(t.r,t.h*0.5,t.r)));
    leaves.setMatrixAt(i,m.compose(p.set(t.x,t.h*0.68,t.z),q,s.set(1.6,t.h*0.62,1.6))); });
  trunks.castShadow=leaves.castShadow=true; scene.add(trunks,leaves);
  const rockM=new THREE.MeshStandardMaterial({color:0x6b6f73,flatShading:true});
  rocks.forEach(r=>{ const g=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),rockM); g.position.set(r.x,r.h*0.45,r.z); g.scale.set(r.r,r.h*0.5,r.r); g.rotation.y=r.x; scene.add(g); });
  /* 倒木：架在第 5 個控制點上方（環在下面，要低飛穿過） */
  const lp=CP[5], tg=curve.getTangentAt(0.5);
  const log=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,9,10),new THREE.MeshStandardMaterial({color:0x6b4425}));
  log.position.set(lp.x,3.6,lp.z); log.rotation.z=Math.PI/2; log.rotation.y=Math.atan2(tg.x,tg.z); scene.add(log);
  for(const sgn of [-1,1]){ const st=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.35,3.6,7),new THREE.MeshStandardMaterial({color:0x5b3a21}));
    st.position.set(lp.x+Math.cos(log.rotation.y)*4.2*sgn,1.8,lp.z-Math.sin(log.rotation.y)*4.2*sgn); scene.add(st);
    obstacles.push({x:st.position.x,z:st.position.z,r:0.35,h:3.6}); }
}
const dir=pts[1].clone().sub(pts[N-1]).setY(0).normalize();
export const TRACK=({levelId:'race-forest',title:'森林峽谷',bounds:{x:BX,z:BZ,y:10},sky:0x0d1b17,fog:[22,62],rings,obstacles,decorate,
  pit:new THREE.Vector3(-6,0,23),pitHint:'起點左後方的空地',pitSignYaw:-Math.PI/2,
  spawn:pts[0].clone().addScaledVector(dir,-4.5).setY(1.2),spawnYaw:Math.atan2(-dir.x,-dir.z),laps:3,
  introHtml:'<p>🌲 樹林裡飛行：<b>樹幹、樹冠、岩石都會撞</b>（撞到會被彈開、掉電）。有一段要<b>低飛穿過倒木下方</b>，一段要<b>爬上山脊</b>；起霧了，遠處看不清楚，要記路線。</p>'});
