/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   tracks/race-neon.js — 改裝賽道「夜間霓虹」的賽道資料（2026-10-11 從 levels/race-neon.html 原封搬出來，
   讓單人賽道與賽道對戰 levels/race-pk.html 共用同一份；內容一字未改）
   ============================================================ */
import * as THREE from 'three';
const A=23, B=40, M=16;
const pt=t=>new THREE.Vector3(A*Math.sin(t),6+3.5*Math.cos(t),B*Math.sin(t)*Math.cos(t));
const N=16, rings=[];
for(let i=0;i<N;i++){ const t=Math.PI/2+i/N*Math.PI*2; rings.push({p:pt(t),kind:[4,12].includes(i)?'boost':[8].includes(i)?'charge':'ring',r:i===0?2.2:1.8}); }
const path=[]; for(let i=0;i<240;i++)path.push(pt(i/240*Math.PI*2));
const BX=30, BZ=24;
let seed=20261011; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const COLORS=[0xff2bd6,0x00e5ff,0xa855f7,0x22ff88,0xffd000];
const pillars=[], obstacles=[];
for(let n=0;n<500&&pillars.length<38;n++){
  const x=(rnd()*2-1)*(BX-2), z=(rnd()*2-1)*(BZ-2);
  let near=1e9; for(const q of path){ const d=Math.hypot(q.x-x,q.z-z); if(d<near)near=d; }
  if(near<3.8||near>9)continue; if(Math.hypot(x-19,z-9)<4||Math.hypot(x-23,z-5)<4)continue;
  if([[0,14],[-10,12],[10,12]].some(([a,c])=>Math.hypot(x-a,z-c)<3))continue;   // 飛手站位（場邊視角）前面不要擋
  if(pillars.some(p=>Math.hypot(p.x-x,p.z-z)<4))continue;
  const h=4+rnd()*9; pillars.push({x,z,h,c:COLORS[pillars.length%COLORS.length]}); obstacles.push({x,z,r:0.35,h});
}
function decorate(scene){
  scene.traverse(o=>{ if(o.isLight)o.intensity*=0.18; });
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(BX*2,BZ*2),new THREE.MeshStandardMaterial({color:0x07060f,roughness:0.5,metalness:0.4}));
  ground.rotation.x=-Math.PI/2; ground.position.y=0.012; scene.add(ground);
  const grid=new THREE.GridHelper(BX*2,30,0xff2bd6,0x3b0d5c); grid.position.y=0.03; scene.add(grid);
  for(const p of pillars){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,p.h,10),new THREE.MeshBasicMaterial({color:p.c}));
    m.position.set(p.x,p.h/2,p.z); scene.add(m);
    const halo=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,p.h,10,1,true),new THREE.MeshBasicMaterial({color:p.c,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false}));
    halo.position.copy(m.position); scene.add(halo); }
  /* 路線的地面光帶（看得出 8 字形，交叉點標出上下層） */
  const g=new THREE.BufferGeometry().setFromPoints(path.map(p=>new THREE.Vector3(p.x,0.05,p.z)).concat([new THREE.Vector3(path[0].x,0.05,path[0].z)]));
  scene.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x00e5ff,transparent:true,opacity:0.35})));
  const sign=(txt,x,y,z,c)=>{ const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const x2=cv.getContext('2d'); x2.fillStyle=c; x2.font='bold 40px sans-serif'; x2.textAlign='center'; x2.textBaseline='middle'; x2.fillText(txt,128,32);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true})); s.scale.set(4,1,1); s.position.set(x,y,z); scene.add(s); };
  sign('上層',0,11.6,0,'#22ff88'); sign('下層',0,0.9,0,'#ffd000');
  for(const [x,z,c] of [[0,0,0xff2bd6],[A,0,0x00e5ff],[-A,0,0xa855f7]]){ const l=new THREE.PointLight(c,30,26); l.position.set(x,6,z); scene.add(l); }
}
const p0=pt(Math.PI/2), p1=pt(Math.PI/2+0.05), dir=p1.clone().sub(p0).setY(0).normalize();
export const TRACK=({levelId:'race-neon',title:'夜間霓虹',bounds:{x:BX,z:BZ,y:M},sky:0x05040c,fog:[16,52],rings,obstacles,decorate,
  pit:new THREE.Vector3(19,0,9),pitHint:'起點後方右邊',pitSignYaw:Math.PI,
  spawn:p0.clone().addScaledVector(dir,-4.5).setY(1.2),spawnYaw:Math.atan2(-dir.x,-dir.z),laps:3,
  introHtml:'<p>🌃 夜晚的霓虹賽道：四周很暗，<b>只看得到發光的環和霓虹柱</b>，要靠光記路線。</p><p>8 字形：<b>中間交叉的地方一高一低</b>（綠字上層、黃字下層），照亮起來的那個環走，別穿錯層。霓虹柱會撞。</p>'});
