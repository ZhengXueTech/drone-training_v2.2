/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   race.js — 改裝賽道共用引擎（2026-10-09，第二階段由 race-playground.html 抽出）
   ------------------------------------------------------------
   每條賽道只要給「賽道資料」就好：
     runRace({levelId,title,bounds:{x,z,y},sky,fog:[近,遠],rings:[{p:Vector3,kind:'ring'|'boost'|'charge',r}],
              pit:Vector3,pitHint,pitSignYaw,spawn:Vector3,spawnYaw,laps,introHtml,obstacles:[{x,z,r,h}],decorate(scene,THREE)})
     10/10 新增（選填）：boxes:[{x,z,w,d,h,y0}] 方塊障礙（大樓／牆／橫梁）、zones:[{x,z,r,y0,h,k}] 亂流區。
   rings[0]＝起點（白環）；環的方向自動朝向前後兩環連線。其餘規則（機庫零件倍率、電量、進站、加速／充電環、
   幽靈機、成績）跟操場入門第一階段一樣（老師 10/09 試玩確認可以）。
   頁面需要：<canvas id="c">、<div id="count">、<div id="lap">。
   ============================================================ */
import * as THREE from 'three';
import { Engine } from './engine.js';
import { InputManager } from './input.js';
import { Drone } from './physics.js';
import { CameraRig, CAM_LABELS } from './camera.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { buildBasicField, makeRing } from './world.js';
import { buildDroneStyle, droneStyleGet, DRONE_STYLES } from './drone-styles.js';
import { checkRingPass } from './systems/scoring.js';
import { sfx } from './audio.js';
import { progress } from '../data/progress.js';
import { getLevel } from '../data/levels-manifest.js';
import './tutorial.js';   // 2026-10-10 📖 飛之前的操作教學
import { loadBuild, specOf, buildLabel, BASE_DRAIN, enduranceSec, markMissions } from '../data/parts.js';

export function runRace(T){
const LEVEL=getLevel(T.levelId);
const TRACK=T.levelId, LAPS=T.laps||3;
progress.migrateLegacy();
const build=loadBuild(), spec=specOf(build);

/* ── 引擎 ── */
const engine=new Engine(document.getElementById('c'),{lowQuality:innerWidth<600});
const input=new InputManager();
const hud=new HUD(LEVEL.hud);
const ui=new UI(input);
const BX=T.bounds.x, BZ=T.bounds.z;
buildBasicField(engine.scene,{size:BX,sky:T.sky??0x0c1a2e});
if(T.fog)engine.scene.fog=new THREE.Fog(T.sky??0x0c1a2e,T.fog[0],T.fog[1]);
if(T.decorate)T.decorate(engine.scene,THREE);

/* ── 改裝機：零件倍率套在街機模式常數上（physics.js 不動） ── */
class RaceDrone extends Drone{
  constructor(o){ super(o); this.boostK=1; this.battK=1; }
  _arcade(dt,inp,C){
    const s=spec, k=this.boostK*this.battK;
    const e=s.twitch>=1?1:1+(1-s.twitch)*2;          // 靈敏度低＝搖桿曲線比較緩（小推更細）
    const sh=v=>Math.sign(v)*Math.pow(Math.abs(v),e);
    const C2={...C,A_MAX_HSPEED:C.A_MAX_HSPEED*1.25*s.speed*k,A_H_ACCEL:C.A_H_ACCEL*s.accel*k,
      A_YAW_RATE:C.A_YAW_RATE*s.yaw,A_MAX_VSPEED:C.A_MAX_VSPEED*s.climb*this.battK,A_TILT_LERP:C.A_TILT_LERP*s.twitch};
    super._arcade(dt,{...inp,pitch:sh(inp.pitch),roll:sh(inp.roll),yaw:sh(inp.yaw)},C2);
  }
}

/* ── 賽道：關卡給環的位置與種類，方向自動朝向前後兩環的連線 ── */
const N=T.rings.length;
const KCOLOR={boost:0xff8800,charge:0x4ade80,start:0xffffff,ring:0x00ffcc};
const rings=T.rings.map((d,i)=>{
  const kind=i===0?'start':(d.kind||'ring');
  const r=makeRing(d.p,{radius:d.r||(i===0?2.2:1.9),color:KCOLOR[kind]});
  const a=T.rings[(i-1+N)%N].p, b=T.rings[(i+1)%N].p;
  r.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
  r.userData.kind=kind; engine.scene.add(r); return r;
});
/* 起點拱門的兩根柱子 */
{ const m=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x334455}), r0=rings[0], R=(T.rings[0].r||2.2)+0.4;
  const side={x:Math.cos(r0.rotation.y),z:-Math.sin(r0.rotation.y)};
  for(const s of [-1,1]){ const h=r0.position.y+R; const c=new THREE.Mesh(new THREE.BoxGeometry(0.25,h,0.25),m);
    c.position.set(r0.position.x+side.x*s*R,h/2,r0.position.z+side.z*s*R); engine.scene.add(c); } }
/* 進站停機坪 */
const PIT=T.pit.clone();
const pit=new THREE.Group();
{ const pad=new THREE.Mesh(new THREE.CircleGeometry(2,32),new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:0.35}));
  pad.rotation.x=-Math.PI/2; pad.position.y=0.03; pit.add(pad);
  const rim=new THREE.Mesh(new THREE.RingGeometry(1.9,2.05,40),new THREE.MeshBasicMaterial({color:0xfacc15}));
  rim.rotation.x=-Math.PI/2; rim.position.y=0.04; pit.add(rim);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const g=cv.getContext('2d');
  g.fillStyle='#facc15'; g.font='bold 80px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('PIT',128,64);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,side:THREE.DoubleSide}));
  sign.position.set(0,2.6,-2.2); sign.rotation.y=T.pitSignYaw??-Math.PI/2; pit.add(sign);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6),new THREE.MeshBasicMaterial({color:0xfacc15})); pole.position.set(0,1.3,-2.2); pit.add(pole);
  pit.position.copy(PIT); engine.scene.add(pit); }

/* ── 機體與幽靈機 ── */
const SPAWN=T.spawn.clone();
const drone=new RaceDrone({mode:'arcade',bounds:{x:BX,z:BZ,y:T.bounds.y||10},spawn:SPAWN});
drone.yaw=T.spawnYaw;
const prevPos=drone.pos.clone();
const styleCode=droneStyleGet()||DRONE_STYLES[0].code;
const mesh=buildDroneStyle(styleCode,{tint:progress.setting('teamTint',0x3399ff)}); mesh.castShadow=true; engine.scene.add(mesh);
const ghost=buildDroneStyle(styleCode,{tint:0xffffff});
ghost.traverse(o=>{ if(o.material){ o.material=o.material.clone(); o.material.transparent=true; o.material.opacity=0.32; o.material.depthWrite=false; } });
ghost.visible=false; engine.scene.add(ghost);
const GKEY='nd.race.ghost.'+TRACK;
let ghostData=null; try{ ghostData=JSON.parse(localStorage.getItem(GKEY)); }catch{}
const rec=[];        // 本次軌跡：[t,x,y,z,yaw] 每 0.1 秒
const rig=new CameraRig(engine.camera);

/* ── 狀態 ── */
let phase='intro', countT=0, raceT=0, target=0, lap=0, lapStart=0, laps=[], battery=100, pits=0, pitT=0, boostT=0, hits=0, hitCD=0, recT=0, lowWarn=false;
const $count=document.getElementById('count'), $lap=document.getElementById('lap');
function paintRings(){
  rings.forEach((r,i)=>{ const on=i===target; r.scale.setScalar(on?1.12:1);
    r.children.forEach((m,j)=>{ m.material.opacity=on?(j?0.35:1):(j?0.06:0.28); }); });
}
function syncModes(){ hud.setModes('街機',CAM_LABELS[rig.mode]); }
function cycleCam(){ hud.toast('視角：'+CAM_LABELS[rig.cycleMode()],'ok'); syncModes(); }
function cyclePilot(){ rig.cyclePilot(); if(rig.mode==='ground')hud.toast(`飛手站位 ${rig.pilotIdx+1}/${rig.pilotPositions.length}`,'ok'); }
/* 2026-10-10 老師回饋「視野模式沒了」：原本只有鍵盤 C 和畫面上的鈕，補上手把（換視角／換站位／蹲）與鍵盤 V、Z，跟其他關卡一樣 */
addEventListener('keydown',e=>{ if(e.code==='KeyC')cycleCam(); if(e.code==='Escape')togglePause();
  if(e.code==='KeyV'&&engine.simStarted&&!ui.modalOpen)cyclePilot(); if(e.code==='KeyZ')rig.crouch=true; });
addEventListener('keyup',e=>{ if(e.code==='KeyZ')rig.crouch=false; });
hud.onCamButton(cycleCam); hud.onPauseButton(togglePause); hud.attachTouch(input);

function showIntro(){
  engine.simStarted=false;
  const s=enduranceSec(spec);
  ui.showModal({title:'🏁 改裝賽道：'+T.title,
    html:`${T.introHtml||''}<p>依序穿過 <b>${N} 個環</b>（下一個環會亮起來），跑 <b>${LAPS} 圈</b>，時間越短越好。</p>
      <p>🟠 <b>橘環</b>＝加速 2 秒　🟢 <b>綠環</b>＝充電 10%　🟡 <b>PIT 停機坪</b>（${T.pitHint||'起點旁邊'}）＝降落停 3 秒換滿電池</p>
      <p>電量低於 20% 會越來越沒力；撞牆${T.obstacles&&T.obstacles.length?'、撞樹':''}會掉電。半透明的機體＝你這條賽道最快的紀錄（幽靈機）。</p>
      <p style="color:#facc15">你的機體：<b>${buildLabel(build)}</b>（滿電約可飛 ${s} 秒）　要換零件請到「🔧 機庫」。</p>`,
    buttons:[{id:'b-garage',label:'🔧 去機庫換零件',onClick:()=>{location.href='../pages/garage.html';}},
             {id:'b-start',label:'開始（倒數 3 秒）',onClick:startRace}],align:'top'});
  ui.gpSetFocus(['b-garage','b-start'],1);
}
function startRace(){
  ui.closeModal(); sfx.play('click');
  engine.simStarted=true; phase='count'; countT=3;
  drone.reset(SPAWN); drone.yaw=T.spawnYaw; drone.vel.set(0,0,0);
  target=0; lap=0; laps=[]; battery=100; pits=0; pitT=0; boostT=0; hits=0; raceT=0; rec.length=0; recT=0; lowWarn=false;
  rings.forEach(r=>r.userData.passed=false); paintRings();
  ghost.visible=!!(ghostData&&ghostData.p&&ghostData.p.length);
  hud.setGuide('倒數結束才能起飛｜穿過白色起點環開始第 1 圈');
}
function togglePause(){
  if(!engine.simStarted||phase==='done')return;
  engine.paused=!engine.paused;
  if(engine.paused) ui.showModal({title:'暫停',html:`<p>第 ${Math.max(1,lap)} / ${LAPS} 圈・${raceT.toFixed(1)} 秒・進站 ${pits} 次</p>`,
    buttons:[{id:'b-resume',label:'繼續',onClick:togglePause},{id:'b-restart',label:'重新開始',onClick:()=>location.reload()},
             {id:'b-garage2',label:'🔧 回機庫',onClick:()=>{location.href='../pages/garage.html';}}]});
  else ui.closeModal();
}
function finish(){
  phase='done'; sfx.play('finish');
  const time=Math.round(raceT*10)/10, best=Math.min(...laps);
  const isBest=!(ghostData&&ghostData.time<=time);
  if(isBest){ try{ localStorage.setItem(GKEY,JSON.stringify({time,build:buildLabel(build),p:rec})); }catch{} }
  const r=progress.record(TRACK,{completed:true,score:time,
    metrics:{time,bestLap:Math.round(best*10)/10,pits,hits,build:buildLabel(build)}});   // 老師定案：改裝機成績一起比，不分機型（機體只記在 metrics）
  const got=markMissions({finished:true,time,pits,hits,build,track:TRACK});
  ui.showModal({title:'🏁 完賽！',
    html:`<p>⏱ 總時間 <b style="font-size:20px">${time.toFixed(1)}</b> 秒${isBest?'　🎉 <b style="color:#4ade80">新紀錄！</b>（幽靈機已更新）':`　（最佳 ${ghostData.time.toFixed(1)} 秒）`}</p>
      <p>每圈：${laps.map((t,i)=>`第${i+1}圈 ${t.toFixed(1)}`).join('｜')}　🔋 進站 ${pits} 次　💥 撞擊 ${hits} 次</p>
      <p>機體：${buildLabel(build)}</p>
      ${got.length?`<p style="color:#facc15">🎯 完成小任務：${got.map(m=>m.name).join('、')}</p>`:''}
      <p style="color:#9fc3d8">想更快？回機庫換零件再跑一次：極速、續航、進站次數，哪個最划算？（第 ${r.attempts} 次）</p>`,
    buttons:[{id:'b-again',label:'再跑一次',onClick:()=>location.reload()},
             {id:'b-garage3',label:'🔧 回機庫',onClick:()=>{location.href='../pages/garage.html';}}]});
  ui.gpSetFocus(['b-again','b-garage3'],0);
}

/* ── 障礙物（樹幹等直立圓柱：{x,z,r,h}）碰撞：推出去、減速，算一次撞擊 ── */
const OBS=T.obstacles||[];
function collide(){
  let hit=false;
  for(const o of OBS){
    if(drone.pos.y>o.h||drone.pos.y<(o.y0||0))continue;      // y0～h 之間才算（樹冠用 y0）
    const dx=drone.pos.x-o.x, dz=drone.pos.z-o.z, d=Math.hypot(dx,dz), R=o.r+0.3;
    if(d<R&&d>1e-4){ const k=(R-d)/d; drone.pos.x+=dx*k; drone.pos.z+=dz*k;
      const nx=dx/d, nz=dz/d, vn=drone.vel.x*nx+drone.vel.z*nz;
      if(vn<0){ drone.vel.x-=1.35*vn*nx; drone.vel.z-=1.35*vn*nz; }
      drone.vel.x*=0.6; drone.vel.z*=0.6; hit=true; }
  }
  /* 2026-10-10 第二階段：方塊障礙（大樓、牆、橫梁、看台：{x,z,w,d,h,y0}，w/d＝寬深全長）。從最淺的那一面推出去 */
  for(const b of BOXES){
    const y0=b.y0||0, hw=b.w/2+0.3, hd=b.d/2+0.3, dx=drone.pos.x-b.x, dz=drone.pos.z-b.z, y=drone.pos.y;
    if(Math.abs(dx)>=hw||Math.abs(dz)>=hd||y>=b.h+0.15||y<=y0-0.15)continue;
    const pen=[hw-Math.abs(dx),hd-Math.abs(dz),b.h+0.15-y,y0>0?y-(y0-0.15):1e9], m=Math.min(...pen), i=pen.indexOf(m);
    if(i===0){ drone.pos.x=b.x+Math.sign(dx||1)*hw; drone.vel.x=-drone.vel.x*0.35; drone.vel.z*=0.6; }
    else if(i===1){ drone.pos.z=b.z+Math.sign(dz||1)*hd; drone.vel.z=-drone.vel.z*0.35; drone.vel.x*=0.6; }
    else if(i===2){ drone.pos.y=b.h+0.15; if(drone.vel.y<0)drone.vel.y=0; continue; }       // 停在屋頂上不算撞
    else { drone.pos.y=y0-0.15; if(drone.vel.y>0)drone.vel.y=-0.5; drone.vel.x*=0.7; drone.vel.z*=0.7; }
    hit=true;
  }
  return hit;
}
const BOXES=T.boxes||[];
/* 2026-10-10 亂流區（{x,z,r,y0,h,k}）：在裡面會被一陣一陣的風推來推去；機體越重越不怕（spec.mass） */
const ZONES=T.zones||[]; let inZone=-1, gustT=0;
function turbulence(dt){
  gustT+=dt; let z=-1;
  ZONES.forEach((o,i)=>{ if(Math.hypot(drone.pos.x-o.x,drone.pos.z-o.z)<o.r&&drone.pos.y>=(o.y0||0)&&drone.pos.y<=(o.h||99))z=i; });
  if(z!==inZone){ if(z>=0)hud.toast('🌀 亂流區！會被風吹晃——抓穩、修正（機體重一點比較穩）','warn'); inZone=z; }
  if(z<0)return;
  const o=ZONES[z], k=(o.k||6)/Math.pow(spec.mass,1.5), t=gustT;
  drone.vel.x+=k*dt*(Math.sin(t*1.7+o.x)*0.8+Math.sin(t*4.3)*0.5);
  drone.vel.z+=k*dt*(Math.cos(t*1.3+o.z)*0.8+Math.sin(t*3.7+1)*0.5);
  drone.vel.y+=k*0.35*dt*Math.sin(t*2.9);
}

/* ── 主迴圈 ── */
const _f=new THREE.Vector3();
engine.start((dt,simStarted)=>{
  input.update(dt); ui.update(dt);
  if(engine.paused)return;
  let p=input.player(0);
  hud.setGpBar(p.device);
  if(p.device==='gamepad'){
    const camE=p.fnEdge?p.fnEdge('camCycle'):false, pilotE=p.fnEdge?p.fnEdge('pilotCycle'):false;
    rig.crouch=p.btn('crouch');
    if(engine.simStarted&&!ui.modalOpen){ if(camE)cycleCam(); if(pilotE)cyclePilot(); }
  }
  if(phase==='count'){
    countT-=dt; $count.style.display=''; $count.textContent=countT>0?String(Math.ceil(countT)):'GO!';
    if(countT<=0&&phase==='count'){ phase='race'; lapStart=0; sfx.play('ring'); setTimeout(()=>{$count.style.display='none';},600); hud.setGuide(null); }
    p={...p,throttle:0,yaw:0,pitch:0,roll:0};
  }
  if(phase==='race'){
    raceT+=dt;
    // 電量
    const work=Math.min(1,Math.abs(p.throttle)+Math.hypot(p.pitch,p.roll));
    if(pitT<=0)battery-=BASE_DRAIN*spec.drain*(0.6+0.4*work)/spec.cap*dt;   // 停在停機坪換電池時不耗電
    battery=Math.max(0,battery);
    drone.battK=battery<20?0.55+0.45*battery/20:1;
    if(battery<20&&!lowWarn){ lowWarn=true; sfx.play('lowbat'); hud.toast('🔋 電量低！越來越沒力——去 PIT 停機坪換電池','warn'); }
    boostT=Math.max(0,boostT-dt); drone.boostK=boostT>0?1.4:1;
    // 進站：停在停機坪上（夠低、夠慢）3 秒
    const onPad=Math.hypot(drone.pos.x-PIT.x,drone.pos.z-PIT.z)<2&&drone.pos.y<0.8&&drone.hSpeed()<1.5;
    if(onPad&&battery<99){ pitT+=dt; hud.setGuide(`🔋 換電池中… ${Math.max(0,3-pitT).toFixed(1)} 秒`);
      if(pitT>=3){ battery=100; pits++; pitT=0; lowWarn=false; sfx.play('charge'); hud.toast('🔋 換好電池，滿電出發！','ok'); hud.setGuide(null); } }
    else if(pitT>0){ pitT=0; hud.setGuide(null); }
    // 軌跡（幽靈機用）
    recT+=dt; if(recT>=0.1){ recT=0; rec.push([+raceT.toFixed(2),+drone.pos.x.toFixed(2),+drone.pos.y.toFixed(2),+drone.pos.z.toFixed(2),+drone.yaw.toFixed(2)]); }
  }
  prevPos.copy(drone.pos);
  drone.update(dt,p);
  if(phase==='race'&&ZONES.length)turbulence(dt);
  if(phase==='race'){
    // 撞牆
    hitCD=Math.max(0,hitCD-dt);
    const hitObs=collide();
    if((drone.collided||hitObs)&&hitCD===0){ hits++; hitCD=0.6; battery=Math.max(0,battery-4/spec.dur); sfx.play('warn'); }
    // 環
    const r=rings[target]; r.userData.passed=false;
    if(checkRingPass(r,drone.pos,prevPos)){
      r.userData.passed=false;
      if(r.userData.kind==='boost'){ boostT=2; hud.toast('🟠 加速！','ok'); }
      else if(r.userData.kind==='charge'){ battery=Math.min(100,battery+10); sfx.play('charge'); hud.toast('🟢 充電 +10%','ok'); }
      sfx.play('ring');
      if(target===0){
        if(lap>0){ laps.push(raceT-lapStart); }
        lapStart=raceT; lap++;
        if(lap>LAPS){ lap=LAPS; finish(); }
        else if(lap>1) hud.toast(`第 ${lap} 圈！`,'ok');
      }
      target=(target+1)%N; paintRings();
    }
  }
  // 幽靈機（依時間內插）
  if(ghost.visible&&phase==='race'){
    const P=ghostData.p; let i=Math.min(P.length-1,Math.floor(raceT/0.1));
    while(i>0&&P[i][0]>raceT)i--; const a=P[i], b=P[Math.min(P.length-1,i+1)];
    const k=b[0]>a[0]?Math.min(1,(raceT-a[0])/(b[0]-a[0])):0;
    ghost.position.set(a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k,a[3]+(b[3]-a[3])*k); ghost.rotation.set(0,a[4],0);
    if(raceT>P[P.length-1][0]+1)ghost.visible=false;
  }
  mesh.position.copy(drone.pos); mesh.quaternion.copy(drone.q);
  mesh.visible=rig.mode!=='fpv';
  if(mesh.userData.spin)mesh.userData.spin.rotation.y+=dt*(3.2*(drone.boostK||1));
  rig.portrait=hud.portrait; rig.update(dt,drone,mesh);
  hud.setBattery(Math.round(battery));
  hud.setTelemetry(drone.pos.y,drone.speed());
  hud.setProgress(phase==='race'||phase==='done'?`第 ${Math.max(1,lap)}/${LAPS} 圈・下一環 ${target===0?'起點':target}`:'');
  hud.setTimer(null);
  $lap.innerHTML=`<b>${raceT.toFixed(1)}</b> 秒<br>第 ${Math.max(1,Math.min(lap,LAPS))} / ${LAPS} 圈<br>🔋 ${Math.round(battery)}%　進站 ${pits}${boostT>0?'<br><span style="color:#ff8800">🟠 加速中</span>':''}${ghostData?`<br><span style="color:#9fc3d8">幽靈 ${ghostData.time.toFixed(1)} 秒</span>`:''}`;
  hud.setOffscreenTarget(phase==='race'?rings[target].position:null);
  hud.drawMinimap(drone.pos,drone.yaw,BX,rings.map((r,i)=>({pos:r.position,done:i!==target})));
  hud.update(dt,engine.camera,drone.pos);
});

hud.setMission(`改裝賽道：${T.title}（${LAPS} 圈）`);
syncModes(); paintRings();
showIntro();
window.__race={get state(){ return {phase,lap,target,battery,pits,raceT,hits,boostT,inZone}; },drone,rings,spec,prevPos,track:T,
  setBattery:v=>{battery=v;}, finishNow:()=>{ laps=[20,21,22]; raceT=63; finish(); }};
addEventListener('beforeunload',()=>engine.dispose());
}
