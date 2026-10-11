/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   race-pk.js — 改裝賽道「同學對戰」（2026-10-11）
   ------------------------------------------------------------
   老師定案：同一台電腦分割畫面一起飛；每個人各自在機庫組自己的機體。
   · 席位大廳（pages/pairing.html?activity=race-pk）指派 4 席：手把／鍵盤／觸控／AI
   · 只有真人席有畫面（1 人＝全螢幕、2 人＝左右、3～4 人＝四格）；AI 席照樣在賽道上一起跑
   · 開始畫面：選賽道（5 條）、風、干擾區（大家相同）；每位真人按「🔧 P? 機體」組自己的零件
   · 規則跟單人賽道一樣（core/race.js）：依序穿環 3 圈、電量、PIT 換電池、加速／充電環、障礙會撞、亂流區
   · 機體之間會互相碰撞（彈開，不扣電）
   · 第一個人跑完後，其他人還有 30 秒；時間到還沒跑完的照進度排名
   成績記在 nd.progress['race-pk']（最快完賽秒數＝分數，越少越好）。
   ============================================================ */
import * as THREE from 'three';
import { Engine } from './engine.js';
import { InputManager } from './input.js';
import { Drone } from './physics.js';
import { UI } from './ui.js';
import { attachTouchSeat } from './hud.js';
import { buildBasicField, makeRing } from './world.js';
import { CameraRig, CAM_LABELS } from './camera.js';
import { buildDroneStyle, DRONE_STYLES } from './drone-styles.js';
import { checkRingPass } from './systems/scoring.js';
import { WindSystem } from './systems/wind.js';
import { WIND_LEVELS } from './challenge-rules.js';
import { sfx } from './audio.js';
import { progress } from '../data/progress.js';
import { seats as seatSvc } from '../data/seats.js';
import { PART_TYPES, loadBuild, partOf, specOf, buildLabel, BASE_DRAIN, enduranceSec, DEFAULT_BUILD } from '../data/parts.js';

export const TRACKS=[
  {id:'race-playground',name:'操場入門'},{id:'race-forest',name:'森林峽谷'},{id:'race-city',name:'城市高樓'},
  {id:'race-gym',name:'室內體育館'},{id:'race-neon',name:'夜間霓虹'}];
const ACT='race-pk', N_SEATS=4;
const COLORS=[0x38bdf8,0xff5533,0x22c55e,0xfacc15], CSS_COL=['#38bdf8','#ff5533','#22c55e','#facc15'];
const AI_AGGR={easy:0.45,med:0.6,hard:0.75};   // 全推（1）的 AI 操場只要 31 秒，太強；hard 約 40 秒，好手追得到

export function runRacePK(T){
const seatList=seatSvc.get(ACT);
if(!seatSvc.isValid(seatList,N_SEATS)){ location.href='../pages/pairing.html?activity='+ACT; return; }
const isAI=i=>seatList[i].controller?.type==='ai';
const humans=seatList.map((s,i)=>isAI(i)?null:i).filter(i=>i!==null);
const LAPS=T.laps||3;

/* ── 機體：真人各自組（存 nd.race.pkbuilds；P1 預設用機庫那一台），AI＝標準機 ── */
const BKEY='nd.race.pkbuilds';
let builds=[]; try{ builds=JSON.parse(localStorage.getItem(BKEY))||[]; }catch{}
for(let i=0;i<N_SEATS;i++){ if(!builds[i]||typeof builds[i]!=='object')builds[i]=i===0?loadBuild():{...DEFAULT_BUILD}; builds[i]={...DEFAULT_BUILD,...builds[i]}; }
const saveBuilds=()=>{ try{ localStorage.setItem(BKEY,JSON.stringify(builds)); }catch{} };
const buildOf=i=>isAI(i)?{...DEFAULT_BUILD}:builds[i];

/* ── 共同條件：風、干擾區（沿用單人賽道的設定值） ── */
const WKEY='nd.race.wind', JKEY='nd.race.jam';
let windLv=0, jamOn=false;
try{ windLv=Math.max(0,Math.min(2,+localStorage.getItem(WKEY)||0)); jamOn=localStorage.getItem(JKEY)==='1'; }catch{}
const condTag=()=>[windLv?WIND_LEVELS[windLv].label:'',jamOn?'干擾區':''].filter(Boolean).join('・');

/* ── 引擎與場景 ── */
const engine=new Engine(document.getElementById('c'),{lowQuality:true});
const input=new InputManager();
const ui=new UI(input);
const BX=T.bounds.x, BZ=T.bounds.z;
buildBasicField(engine.scene,{size:BX,sky:T.sky??0x0c1a2e});
if(T.fog)engine.scene.fog=new THREE.Fog(T.sky??0x0c1a2e,T.fog[0],T.fog[1]);
if(T.decorate)T.decorate(engine.scene,THREE);
const wind=new WindSystem();

/* 環（共用的實體；每格畫面渲染前換成「那位飛手的下一個環」亮起來） */
const NR=T.rings.length;
const KCOLOR={boost:0xff8800,charge:0x4ade80,start:0xffffff,ring:0x00ffcc};
const rings=T.rings.map((d,i)=>{
  const kind=i===0?'start':(d.kind||'ring');
  const r=makeRing(d.p,{radius:d.r||(i===0?2.2:1.9),color:KCOLOR[kind]});
  const a=T.rings[(i-1+NR)%NR].p, b=T.rings[(i+1)%NR].p;
  r.rotation.y=Math.atan2(b.x-a.x,b.z-a.z); r.userData.kind=kind; engine.scene.add(r); return r;
});
function paintRings(target){
  rings.forEach((r,i)=>{ const on=i===target; r.scale.setScalar(on?1.12:1);
    r.children.forEach((m,j)=>{ m.material.opacity=on?(j?0.35:1):(j?0.06:0.28); }); });
}
/* PIT 停機坪 */
const PIT=T.pit.clone();
{ const g=new THREE.Group();
  const pad=new THREE.Mesh(new THREE.CircleGeometry(2,32),new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:0.35})); pad.rotation.x=-Math.PI/2; pad.position.y=0.03; g.add(pad);
  const rim=new THREE.Mesh(new THREE.RingGeometry(1.9,2.05,40),new THREE.MeshBasicMaterial({color:0xfacc15})); rim.rotation.x=-Math.PI/2; rim.position.y=0.04; g.add(rim);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const c2=cv.getContext('2d');
  c2.fillStyle='#facc15'; c2.font='bold 80px sans-serif'; c2.textAlign='center'; c2.textBaseline='middle'; c2.fillText('PIT',128,64);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,side:THREE.DoubleSide}));
  sign.position.set(0,2.6,-2.2); sign.rotation.y=T.pitSignYaw??-Math.PI/2; g.add(sign);
  g.position.copy(PIT); engine.scene.add(g); }

/* 障礙與亂流區（規則同 race.js） */
const OBS=T.obstacles||[], BOXES=T.boxes||[], ZONES=T.zones||[];
function collide(d){
  let hit=false;
  for(const o of OBS){
    if(d.pos.y>o.h||d.pos.y<(o.y0||0))continue;
    const dx=d.pos.x-o.x, dz=d.pos.z-o.z, dd=Math.hypot(dx,dz), R=o.r+0.3;
    if(dd<R&&dd>1e-4){ const k=(R-dd)/dd; d.pos.x+=dx*k; d.pos.z+=dz*k;
      const nx=dx/dd, nz=dz/dd, vn=d.vel.x*nx+d.vel.z*nz;
      if(vn<0){ d.vel.x-=1.35*vn*nx; d.vel.z-=1.35*vn*nz; }
      d.vel.x*=0.6; d.vel.z*=0.6; hit=true; }
  }
  for(const b of BOXES){
    const y0=b.y0||0, hw=b.w/2+0.3, hd=b.d/2+0.3, dx=d.pos.x-b.x, dz=d.pos.z-b.z, y=d.pos.y;
    if(Math.abs(dx)>=hw||Math.abs(dz)>=hd||y>=b.h+0.15||y<=y0-0.15)continue;
    const pen=[hw-Math.abs(dx),hd-Math.abs(dz),b.h+0.15-y,y0>0?y-(y0-0.15):1e9], m=Math.min(...pen), k=pen.indexOf(m);
    if(k===0){ d.pos.x=b.x+Math.sign(dx||1)*hw; d.vel.x=-d.vel.x*0.35; d.vel.z*=0.6; }
    else if(k===1){ d.pos.z=b.z+Math.sign(dz||1)*hd; d.vel.z=-d.vel.z*0.35; d.vel.x*=0.6; }
    else if(k===2){ d.pos.y=b.h+0.15; if(d.vel.y<0)d.vel.y=0; continue; }
    else { d.pos.y=y0-0.15; if(d.vel.y>0)d.vel.y=-0.5; d.vel.x*=0.7; d.vel.z*=0.7; }
    hit=true;
  }
  return hit;
}
let gustT=0;
function turbulence(d,spec,dt){
  const o=ZONES.find(o=>Math.hypot(d.pos.x-o.x,d.pos.z-o.z)<o.r&&d.pos.y>=(o.y0||0)&&d.pos.y<=(o.h||99)); if(!o)return false;
  const k=(o.k||6)/Math.pow(spec.mass,1.5), t=gustT;
  d.vel.x+=k*dt*(Math.sin(t*1.7+o.x)*0.8+Math.sin(t*4.3)*0.5);
  d.vel.z+=k*dt*(Math.cos(t*1.3+o.z)*0.8+Math.sin(t*3.7+1)*0.5);
  d.vel.y+=k*0.35*dt*Math.sin(t*2.9); return true;
}
/* 干擾區：位置算法同 race.js（T.jams 或自動放兩個） */
const JAMS=T.jams||(()=>{ const P=T.rings.map(r=>r.p), n=P.length, out=[];
  for(const f of [0.35,0.75]){ for(let k=0;k<n;k++){ const i=(Math.floor(n*f)+k)%n, a=P[i], b=P[(i+1)%n];
      const x=(a.x+b.x)/2, z=(a.z+b.z)/2;
      if(ZONES.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+3.5)||out.some(o=>Math.hypot(o.x-x,o.z-z)<8))continue;
      out.push({x,z,r:3.2}); break; } }
  return out; })();
const jamG=new THREE.Group(); engine.scene.add(jamG);
for(const j of JAMS){ const col=new THREE.Mesh(new THREE.CylinderGeometry(j.r,j.r,(T.bounds.y||10)+2,28,1,true),new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0.1,side:THREE.DoubleSide,depthWrite:false}));
  col.position.set(j.x,((T.bounds.y||10)+2)/2,j.z); jamG.add(col);
  const rim=new THREE.Mesh(new THREE.RingGeometry(j.r-0.12,j.r,40),new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
  rim.rotation.x=-Math.PI/2; rim.position.set(j.x,0.05,j.z); jamG.add(rim); }
jamG.visible=jamOn;

/* ── 機體（每席一台；零件倍率套在街機常數上，同 race.js） ── */
class PkDrone extends Drone{
  constructor(o,spec){ super(o); this.spec=spec; this.boostK=1; this.battK=1; }
  _arcade(dt,inp,C){
    const s=this.spec, k=this.boostK*this.battK;
    const e=s.twitch>=1?1:1+(1-s.twitch)*2, sh=v=>Math.sign(v)*Math.pow(Math.abs(v),e);
    const C2={...C,A_MAX_HSPEED:C.A_MAX_HSPEED*1.25*s.speed*k,A_H_ACCEL:C.A_H_ACCEL*s.accel*k,
      A_YAW_RATE:C.A_YAW_RATE*s.yaw,A_MAX_VSPEED:C.A_MAX_VSPEED*s.climb*this.battK,A_TILT_LERP:C.A_TILT_LERP*s.twitch};
    super._arcade(dt,{...inp,pitch:sh(inp.pitch),roll:sh(inp.roll),yaw:sh(inp.yaw)},C2);
  }
}
/* 起跑位置：起點後方排成一排（左右錯開 1.6 公尺） */
const SPAWN=T.spawn.clone(), side=new THREE.Vector3(Math.cos(T.spawnYaw),0,-Math.sin(T.spawnYaw));
const P=[], drones=[], meshes=[];
for(let i=0;i<N_SEATS;i++){
  const sp=SPAWN.clone().addScaledVector(side,(i-1.5)*1.6);
  const d=new PkDrone({mode:'arcade',bounds:{x:BX,z:BZ,y:T.bounds.y||10},spawn:sp},specOf(buildOf(i)));
  d.yaw=T.spawnYaw; drones.push(d);
  const m=buildDroneStyle(DRONE_STYLES[0].code,{tint:COLORS[i]}); engine.scene.add(m); meshes.push(m);
  P.push({sp,target:0,lap:0,laps:[],lapStart:0,battery:100,pits:0,pitT:0,boostT:0,hits:0,hitCD:0,finished:false,time:null,prev:d.pos.clone(),
    delay:[],inJam:false,aiPit:false,progress:0});
}

/* ── 分割畫面 ── */
const cams=humans.map(()=>new THREE.PerspectiveCamera(66,1,0.05,220));
function layout(){
  const n=humans.length;
  if(n<=1)return [{x:0,y:0,w:1,h:1}];
  if(n===2)return [{x:0,y:0,w:0.5,h:1},{x:0.5,y:0,w:0.5,h:1}];
  return [{x:0,y:0.5,w:0.5,h:0.5},{x:0.5,y:0.5,w:0.5,h:0.5},{x:0,y:0,w:0.5,h:0.5},{x:0.5,y:0,w:0.5,h:0.5}].slice(0,n);
}
const RECTS=layout();
const overCam=new THREE.PerspectiveCamera(55,1,0.1,400); overCam.position.set(0,Math.max(BX,BZ)*1.9,BZ*0.9); overCam.lookAt(0,0,0);   // 3 人時第 4 格＝全場俯瞰
engine.setRenderFn((renderer,scene)=>{
  const w=renderer.domElement.clientWidth, h=renderer.domElement.clientHeight;
  renderer.setScissorTest(true);
  const panes=humans.map((si,k)=>({cam:cams[k],rect:RECTS[k],si}));
  if(humans.length===3)panes.push({cam:overCam,rect:{x:0.5,y:0,w:0.5,h:0.5},si:-1});
  for(const p of panes){
    const x=Math.round(p.rect.x*w), y=Math.round(p.rect.y*h), pw=Math.max(1,Math.round(p.rect.w*w)), ph=Math.max(1,Math.round(p.rect.h*h));
    renderer.setViewport(x,y,pw,ph); renderer.setScissor(x,y,pw,ph);
    if(p.cam.aspect!==pw/ph){ p.cam.aspect=pw/ph; p.cam.updateProjectionMatrix(); }
    paintRings(p.si>=0?P[p.si].target:-1);
    const k=humans.indexOf(p.si), hide=k>=0&&camMode[k]==='fpv';   // FPV：自己那格看不到自己的機體
    if(hide)meshes[p.si].visible=false;
    renderer.render(scene,p.cam);
    if(hide)meshes[p.si].visible=true;
  }
  renderer.setScissorTest(false); renderer.setViewport(0,0,w,h);
});
const _v=new THREE.Vector3();
/* 每位真人各自切視角（2026-10-11）：跟機（分割畫面專用近距離）／FPV／飛手；預設值在開始畫面選 */
const CKEY='nd.racepk.cam', PK_CAMS=['follow','fpv','ground'];
let camDefault='follow'; try{ const v=localStorage.getItem(CKEY); if(PK_CAMS.includes(v))camDefault=v; }catch{}
const rigs=cams.map(c=>new CameraRig(c));
const camMode=humans.map(()=>camDefault);
function setPaneCam(k,m){ camMode[k]=m; const c=cams[k]; c.fov=m==='fpv'?95:m==='ground'?55:66; c.updateProjectionMatrix();
  if(m!=='follow')rigs[k].setMode(m); rigs[k]._init=false; }
function cyclePaneCam(k){ setPaneCam(k,PK_CAMS[(PK_CAMS.indexOf(camMode[k])+1)%PK_CAMS.length]); paneMsg(humans[k],'📷 視角：'+CAM_LABELS[camMode[k]]); }
function updateCam(cam,d){
  const sy=Math.sin(d.yaw), cy=Math.cos(d.yaw);
  cam.position.lerp(_v.set(d.pos.x+sy*5,d.pos.y+2.4,d.pos.z+cy*5),0.12);
  cam.lookAt(d.pos.x,d.pos.y+0.3,d.pos.z);
}
humans.forEach((si,k)=>{ const d=drones[si]; cams[k].position.set(d.pos.x+Math.sin(d.yaw)*5,d.pos.y+2.4,d.pos.z+Math.cos(d.yaw)*5); cams[k].lookAt(d.pos); });

/* ── 每格畫面的資訊框＋觸控搖桿＋干擾雜訊 ── */
{ const st=document.createElement('style'); st.textContent=`
.rp-pane{position:fixed;pointer-events:none;z-index:21;overflow:hidden;}
.rp-pane .info{position:absolute;left:8px;top:8px;background:rgba(6,16,28,.85);border:2px solid;border-radius:10px;padding:5px 10px;color:#e6f7ff;font-size:13px;line-height:1.5;font-family:'Microsoft JhengHei',sans-serif;}
.rp-pane .info b{font-size:16px;}
.rp-pane button.cam{position:absolute;right:10px;top:48px;pointer-events:auto;font-size:13px;padding:4px 10px;min-height:32px;border-radius:999px;background:rgba(6,16,28,.8);color:#cfefff;border:1px solid rgba(0,238,255,.4);}
.rp-pane .msg{position:absolute;left:50%;top:22%;transform:translateX(-50%);background:rgba(6,16,28,.88);border-radius:10px;padding:6px 14px;color:#fde68a;font-size:15px;white-space:nowrap;opacity:0;transition:opacity .25s;font-family:'Microsoft JhengHei',sans-serif;}
.rp-pane .rank{position:absolute;right:10px;top:6px;font:900 34px 'Arial Black',sans-serif;color:#fff;-webkit-text-stroke:2px rgba(0,0,0,.6);}
.rp-pane canvas.jam{position:absolute;inset:0;width:100%;height:100%;display:none;image-rendering:pixelated;mix-blend-mode:screen;}
.rp-pane .black{position:absolute;inset:0;background:#000;opacity:0;}
#rp-split{position:fixed;inset:0;pointer-events:none;z-index:22;}
#rp-board{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:23;background:rgba(6,16,28,.85);border:1px solid rgba(0,238,255,.4);border-radius:10px;padding:4px 12px;color:#e6f7ff;font-size:13px;pointer-events:none;font-family:'Microsoft JhengHei',sans-serif;white-space:nowrap;}
#rp-cd{position:fixed;inset:0;z-index:40;pointer-events:none;display:none;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(0,0,0,.05),rgba(0,0,0,.5) 75%);}
#rp-cd .num{font:900 clamp(140px,30vmin,320px) 'Arial Black',sans-serif;-webkit-text-stroke:6px rgba(0,0,0,.55);paint-order:stroke fill;animation:rpPop .9s cubic-bezier(.2,1.6,.4,1) both;}
@keyframes rpPop{0%{transform:scale(2.6);opacity:0}35%{transform:scale(.9);opacity:1}100%{transform:scale(1);opacity:1}}`;
  document.head.appendChild(st); }
const panesDom=humans.map((si,k)=>{ const r=RECTS[k], el=document.createElement('div'); el.className='rp-pane';
  el.style.cssText+=`left:${r.x*100}%;width:${r.w*100}%;top:${(1-r.y-r.h)*100}%;height:${r.h*100}%;`;
  el.innerHTML=`<canvas class="jam" width="120" height="68"></canvas><div class="black"></div><div class="info" style="border-color:${CSS_COL[si]}"></div><button class="cam" data-k="${k}">📷 視角</button><div class="rank"></div><div class="msg"></div>`;
  document.body.appendChild(el); return el; });
{ const sp=document.createElement('div'); sp.id='rp-split';
  sp.innerHTML=RECTS.length>1?`<div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(150,210,255,.5)"></div>`+(RECTS.length>2?`<div style="position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(150,210,255,.5)"></div>`:''):'';
  document.body.appendChild(sp); }
panesDom.forEach((el,k)=>el.querySelector('button.cam').addEventListener('click',e=>{ e.stopPropagation(); cyclePaneCam(k); }));
addEventListener('keydown',e=>{ const n=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code); if(n<0||ui.modalOpen)return; const k=humans.indexOf(n); if(k>=0)cyclePaneCam(k); });   // 鍵盤：1～4 切 P1～P4 的視角
const $board=document.createElement('div'); $board.id='rp-board'; document.body.appendChild($board);
const $cd=document.createElement('div'); $cd.id='rp-cd'; document.body.appendChild($cd);
humans.forEach((si,k)=>{ if(seatList[si].controller?.type==='touch')attachTouchSeat(input,si,RECTS[k],`P${si+1} 📱`); });
const msgT=[];
function paneMsg(si,txt){ const k=humans.indexOf(si); if(k<0)return; const el=panesDom[k].querySelector('.msg'); el.textContent=txt; el.style.opacity=1; clearTimeout(msgT[k]); msgT[k]=setTimeout(()=>{ el.style.opacity=0; },1800); }
const devIcon=c=>c?.type==='gamepad'?'🎮':c?.type==='keyboard'?'⌨':c?.type==='touch'?'📱':'🤖';

/* ── 名次：跑完的照時間；沒跑完的照進度（圈數＋環數＋離下一環多近） ── */
function progressOf(i){ const p=P[i], d=drones[i]; if(p.finished)return 1e6-p.time;
  const r=rings[p.target].position; return p.lap*1000+((p.target-1+NR)%NR)*10+(10-Math.min(10,d.pos.distanceTo(r)/4)); }
function ranking(){ return [...Array(N_SEATS).keys()].sort((a,b)=>progressOf(b)-progressOf(a)); }

/* ── AI：照環的順序飛（環與環之間的直線航線都驗證過不會撞），電量低就去 PIT ── */
function aiInput(i){
  const p=P[i], d=drones[i], aggr=AI_AGGR[seatList[i].controller.diff||'med'];
  if(p.battery<22&&!p.aiPit)p.aiPit=true;
  let tgt=rings[p.target].position;
  if(p.aiPit){ const h=Math.hypot(d.pos.x-PIT.x,d.pos.z-PIT.z); tgt=_v.set(PIT.x,h<1.2?0:Math.max(1.5,Math.min(4,h*0.4)),PIT.z); if(p.battery>=99)p.aiPit=false; }
  const dx=tgt.x-d.pos.x, dy=tgt.y-d.pos.y, dz=tgt.z-d.pos.z, dist=Math.hypot(dx,dz);
  const ndx=dist>0.05?dx/dist:0, ndz=dist>0.05?dz/dist:0, desYaw=dist>0.05?Math.atan2(-ndx,-ndz):d.yaw;
  let ye=desYaw-d.yaw; ye=Math.atan2(Math.sin(ye),Math.cos(ye));
  const sy=Math.sin(d.yaw), cy=Math.cos(d.yaw), slow=p.aiPit?Math.min(1,dist/4):1;
  return {throttle:THREE.MathUtils.clamp(dy*0.9,-1,1),yaw:THREE.MathUtils.clamp(ye*2.2,-1,1),
    pitch:THREE.MathUtils.clamp((-sy*ndx-cy*ndz)*aggr*slow,-1,1),roll:THREE.MathUtils.clamp((cy*ndx-sy*ndz)*aggr*slow,-1,1)};
}

/* ── 狀態 ── */
let phase='intro', countT=0, raceT=0, firstFinishT=null, cdShown='';
function showCount(lab){
  if(lab===cdShown)return; cdShown=lab;
  if(!lab){ $cd.style.display='none'; return; }
  const n=lab==='GO!'?0:+lab;
  $cd.style.display='flex'; $cd.innerHTML=`<div class="num" style="color:${['#22c55e','#facc15','#facc15','#ef4444'][n]}">${lab}</div>`;
  sfx.play(n===0?'go':'beep');
}
function trackName(){ return (TRACKS.find(t=>t.id===T.levelId)||{name:T.title}).name; }
function seatHtml(){
  return `<div style="font-size:13.5px;line-height:1.8;background:rgba(6,16,28,.6);border-radius:10px;padding:4px 12px;margin:0 0 8px">${seatList.map((s,i)=>`<span style="color:${CSS_COL[i]}">●</span> P${i+1} ${devIcon(s.controller)} ${isAI(i)?`AI（${({easy:'簡單',med:'中等',hard:'困難'})[s.controller.diff||'med']}）・標準機`:`<b>${buildLabel(builds[i])}</b>（滿電約 ${enduranceSec(specOf(builds[i]))} 秒）`}`).join('<br>')}</div>`;
}
function showIntro(){   // 2026-10-11 統一開始畫面格式
  engine.simStarted=false; phase='intro';
  const bb=humans.map(i=>({id:'b-build-'+i,label:`🔧 P${i+1} 機體`,onClick:()=>showBuilder(i)}));
  ui.showModal({title:'🏁 改裝賽道對戰',
    summary:`同一台電腦分割畫面比賽：<b>${trackName()}</b> 跑 <b>${LAPS} 圈</b>，先跑完的贏。每人可以自己改機體。`,
    tags:[`👥 ${humans.length} 人＋${N_SEATS-humans.length} AI`,'🟠 加速環','🟢 充電環','🟡 PIT 換電池'],
    html:seatHtml(),
    rules:`<p>規則跟單人賽道一樣：依序穿環、電量不夠去 PIT 換電池、橘環加速、綠環充電。</p>
      <p>機體之間會互相彈開。第一個人跑完後，其他人還有 30 秒。</p>
      <p>📷 <b>切視角</b>：手把按「視角鍵」、鍵盤按 <b>1～4</b>（切 P1～P4），或點自己畫面右上的「📷 視角」。</p>`,
    settings:[
      {id:'track',label:'🗺️ 賽道',value:T.levelId,options:TRACKS.map(t=>({v:t.id,label:t.name})),
        hint:()=>'換賽道會重新載入',onChange:v=>{ if(v!==T.levelId)location.href='race-pk.html?track='+v; }},
      {id:'wind',label:'🌬️ 風',value:String(windLv),options:[{v:'0',label:'無風'},{v:'1',label:'微風'},{v:'2',label:'強風'}],
        hint:v=>v==='0'?'':'風向每次出發隨機；有風的成績另外記',
        onChange:v=>{ windLv=+v; try{ localStorage.setItem(WKEY,v); }catch{} }},
      {id:'jam',label:'📡 干擾區',value:jamOn?'1':'0',options:[{v:'0',label:'關'},{v:'1',label:'開'}],
        hint:v=>v==='1'?'紅色區域：自己那格畫面會閃、操控慢半拍':'',
        onChange:v=>{ jamOn=v==='1'; jamG.visible=jamOn; try{ localStorage.setItem(JKEY,jamOn?'1':'0'); }catch{} }},
      {id:'cam',label:'📷 視角',value:camDefault,options:PK_CAMS.map(m=>({v:m,label:CAM_LABELS[m]})),
        hint:v=>v==='fpv'?'第一人稱，最刺激也最難':v==='ground'?'站在場邊看飛機，像真實飛手':'在機體後方跟著飛，最好上手',
        onChange:v=>{ camDefault=v; try{ localStorage.setItem(CKEY,v); }catch{} humans.forEach((si,k)=>setPaneCam(k,v)); }},
    ],
    buttons:[{id:'b-start',label:'🏁 開始（倒數 3 秒）',onClick:startRace,primary:true},...bb,
      {id:'b-seats',label:'🪑 重新指派席位',onClick:()=>{ location.href='../pages/pairing.html?activity='+ACT; }}],align:'top'});
}
/* 每位真人的小機庫：四類零件各三選一 */
function showBuilder(i){   // 2026-10-11 統一格式：四類零件＝四列分段選擇
  const head=()=>`🔧 P${i+1} 的機體`, sum=()=>`<b style="color:${CSS_COL[i]}">${buildLabel(builds[i])}</b>（滿電約 ${enduranceSec(specOf(builds[i]))} 秒）・沒有最強的組合！`;
  const refresh=()=>{ const m=document.querySelector('.nd-panel .np-sum'); if(m)m.innerHTML=sum(); };
  ui.showModal({title:head(),summary:sum(),
    settings:PART_TYPES.map(t=>({id:'p-'+t.key,label:`${t.emoji} ${t.name}`,value:builds[i][t.key],
      options:t.opts.map(o=>({v:o.id,label:o.name})),hint:v=>partOf(t.key,v).why,
      onChange:v=>{ builds[i]={...builds[i],[t.key]:v}; saveBuilds(); refresh(); }})),
    buttons:[{id:'b-done',label:'✔ 完成',primary:true,onClick:()=>{ drones[i].spec=specOf(builds[i]); showIntro(); }},
             {id:'b-load',label:'📥 載入機庫那一台',onClick:()=>{ builds[i]=loadBuild(); saveBuilds(); showBuilder(i); }}]});
}
function startRace(){
  ui.closeModal(); sfx.play('click');
  drones.forEach((d,i)=>{ d.spec=specOf(buildOf(i)); d.reset(P[i].sp); d.yaw=T.spawnYaw; d.vel.set(0,0,0);
    Object.assign(P[i],{target:0,lap:0,laps:[],lapStart:0,battery:100,pits:0,pitT:0,boostT:0,hits:0,hitCD:0,finished:false,time:null,delay:[],inJam:false,aiPit:false}); P[i].prev.copy(d.pos); });
  wind.randomize(windLv?WIND_LEVELS[windLv].v:0);
  raceT=0; firstFinishT=null; countT=3; phase='count'; engine.simStarted=true; cdShown='';
}
function togglePause(){
  if(phase!=='race'&&phase!=='count')return;
  engine.paused=!engine.paused;
  if(engine.paused) ui.showModal({title:'暫停',html:`<p>${raceT.toFixed(1)} 秒</p>`,
    buttons:[{id:'b-resume',label:'繼續',onClick:togglePause},{id:'b-restart',label:'重新開始',onClick:()=>location.reload()}]});
  else ui.closeModal();
}
addEventListener('keydown',e=>{ if(e.code==='Escape')togglePause(); });
function finishAll(){
  phase='done'; sfx.play('finish'); showCount('');
  const order=ranking();
  const rows=order.map((i,r)=>{ const p=P[i];
    return `<tr><td>${['🥇','🥈','🥉','4'][r]}</td><td style="color:${CSS_COL[i]}">P${i+1} ${devIcon(seatList[i].controller)}</td>
      <td>${p.finished?`<b>${p.time.toFixed(1)}</b> 秒`:`沒跑完（第 ${Math.max(1,p.lap)} 圈）`}</td><td>進站 ${p.pits}</td><td>撞 ${p.hits}</td><td>${isAI(i)?'標準機':buildLabel(builds[i])}</td></tr>`; }).join('');
  const best=order.map(i=>P[i]).find(p=>p.finished);
  progress.record(ACT,{completed:true,...(best?{score:Math.round(best.time*10)/10}:{}),
    ...(condTag()?{challenge:condTag(),challengeCode:(windLv?'w'+windLv:'')+(jamOn?'j1':'')}:{}),
    metrics:{track:T.levelId,winner:'P'+(order[0]+1),humans:humans.length,
      results:order.map(i=>({seat:'P'+(i+1),ai:isAI(i),time:P[i].time,pits:P[i].pits,hits:P[i].hits,build:isAI(i)?'標準機':buildLabel(builds[i])}))}});
  ui.showModal({title:`🏁 ${trackName()} 對戰結果　🏆 P${order[0]+1} 獲勝！`,
    html:`<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.9">${rows}</table>
      <p style="color:#9fc3d8;font-size:12px">${condTag()?'條件：'+condTag()+'　':''}想贏？回「🔧 機體」換零件再比一次：極速、續航、轉向，哪個最划算？</p>`,
    buttons:[{id:'b-again',label:'再比一次',onClick:()=>location.reload()},
             {id:'b-seats2',label:'🪑 重新指派席位',onClick:()=>{ location.href='../pages/pairing.html?activity='+ACT; }}]});
  ui.gpSetFocus(['b-again','b-seats2'],0);
}

/* ── 主迴圈 ── */
engine.start(dt=>{
  input.update(dt); ui.update(dt);
  if(engine.paused)return;
  gustT+=dt; wind.update(dt);
  if(phase==='count'){ countT-=dt; showCount(countT>0?String(Math.ceil(countT)):'GO!');
    if(countT<=0){ phase='race'; setTimeout(()=>showCount(''),700); } }
  const racing=phase==='race';
  if(racing)raceT+=dt;
  for(let i=0;i<N_SEATS;i++){
    const d=drones[i], p=P[i];
    let inp={throttle:0,yaw:0,pitch:0,roll:0};
    if(racing&&!p.finished){
      if(isAI(i))inp=aiInput(i);
      else{ const c=seatList[i].controller; const ip=input.playerFor(c?.type==='touch'?{...c,seat:i}:c); inp={throttle:ip.throttle,yaw:ip.yaw,pitch:ip.pitch,roll:ip.roll};
        const k=humans.indexOf(i); if(k>=0&&!ui.modalOpen){ if(ip.fnEdge('camCycle'))cyclePaneCam(k); if(ip.fnEdge('pilotCycle'))rigs[k].cyclePilot(); rigs[k].crouch=ip.btn('crouch'); } }
      // 干擾區：延遲 0.35 秒＋（真人）畫面雜訊
      p.delay.push({t:raceT,...inp}); while(p.delay.length>2&&p.delay[1].t<=raceT-0.35)p.delay.shift();
      const nowJam=jamOn&&JAMS.some(j=>Math.hypot(d.pos.x-j.x,d.pos.z-j.z)<j.r);
      if(nowJam!==p.inJam){ p.inJam=nowJam; if(nowJam)paneMsg(i,'📡 干擾區！操控慢半拍'); }
      if(nowJam){ const o=p.delay[0]; inp={throttle:o.throttle,yaw:o.yaw,pitch:o.pitch,roll:o.roll}; }
      // 電量
      const work=Math.min(1,Math.abs(inp.throttle)+Math.hypot(inp.pitch,inp.roll));
      if(p.pitT<=0)p.battery-=BASE_DRAIN*d.spec.drain*(0.6+0.4*work)/d.spec.cap*dt;
      p.battery=Math.max(0,p.battery); d.battK=p.battery<20?0.55+0.45*p.battery/20:1;
      p.boostT=Math.max(0,p.boostT-dt); d.boostK=p.boostT>0?1.4:1;
      const onPad=Math.hypot(d.pos.x-PIT.x,d.pos.z-PIT.z)<2&&d.pos.y<0.8&&d.hSpeed()<1.5;
      if(onPad&&p.battery<99){ p.pitT+=dt; if(p.pitT>=3){ p.battery=100; p.pits++; p.pitT=0; paneMsg(i,'🔋 換好電池！'); sfx.play('charge'); } }
      else p.pitT=0;
    }
    d.wind=(racing&&windLv)?wind.vec:null;
    p.prev.copy(d.pos);
    d.update(dt,inp);
    if(racing&&!p.finished){
      turbulence(d,d.spec,dt);
      p.hitCD=Math.max(0,p.hitCD-dt);
      if((d.collided||collide(d))&&p.hitCD===0){ p.hits++; p.hitCD=0.6; p.battery=Math.max(0,p.battery-4/d.spec.dur); }
      const r=rings[p.target]; r.userData.passed=false;
      if(checkRingPass(r,d.pos,p.prev)){
        r.userData.passed=false;
        if(r.userData.kind==='boost'){ p.boostT=2; paneMsg(i,'🟠 加速！'); }
        else if(r.userData.kind==='charge'){ p.battery=Math.min(100,p.battery+10); paneMsg(i,'🟢 充電 +10%'); }
        if(!isAI(i))sfx.play('ring');
        if(p.target===0){
          if(p.lap>0)p.laps.push(raceT-p.lapStart);
          p.lapStart=raceT; p.lap++;
          if(p.lap>LAPS){ p.lap=LAPS; p.finished=true; p.time=raceT; paneMsg(i,`🏁 完賽！${raceT.toFixed(1)} 秒`);
            if(firstFinishT===null)firstFinishT=raceT; }
          else if(p.lap>1)paneMsg(i,`第 ${p.lap} 圈！`);
        }
        p.target=(p.target+1)%NR;
      }
    }
  }
  // 機體互撞：彈開
  for(let a=0;a<N_SEATS;a++)for(let b=a+1;b<N_SEATS;b++){
    const A=drones[a], B=drones[b], dx=B.pos.x-A.pos.x, dy=B.pos.y-A.pos.y, dz=B.pos.z-A.pos.z, dd=Math.hypot(dx,dy,dz);
    if(dd<0.7&&dd>1e-4){ const nx=dx/dd, ny=dy/dd, nz=dz/dd, push=(0.7-dd)/2;
      A.pos.x-=nx*push; A.pos.y-=ny*push; A.pos.z-=nz*push; B.pos.x+=nx*push; B.pos.y+=ny*push; B.pos.z+=nz*push;
      const rv=(B.vel.x-A.vel.x)*nx+(B.vel.y-A.vel.y)*ny+(B.vel.z-A.vel.z)*nz;
      if(rv<0){ const j=-rv*0.9; A.vel.x-=nx*j; A.vel.y-=ny*j; A.vel.z-=nz*j; B.vel.x+=nx*j; B.vel.y+=ny*j; B.vel.z+=nz*j; } }
  }
  if(racing){ const humansDone=humans.every(i=>P[i].finished), allDone=P.every(p=>p.finished);
    if(allDone||(humans.length&&humansDone)||(firstFinishT!==null&&raceT-firstFinishT>=30))finishAll(); }
  // 畫面
  drones.forEach((d,i)=>{ meshes[i].position.copy(d.pos); meshes[i].quaternion.copy(d.q); if(meshes[i].userData.spin)meshes[i].userData.spin.rotation.y+=dt*3.2*(d.boostK||1); });
  humans.forEach((si,k)=>{ if(camMode[k]==='follow')updateCam(cams[k],drones[si]); else rigs[k].update(dt,drones[si],meshes[si]); });
  const order=ranking();
  humans.forEach((si,k)=>{ const p=P[si], el=panesDom[k];
    el.querySelector('.info').innerHTML=`<b style="color:${CSS_COL[si]}">P${si+1}</b> ${devIcon(seatList[si].controller)}　第 <b>${Math.max(1,Math.min(p.lap,LAPS))}</b>/${LAPS} 圈<br>🔋 ${Math.round(p.battery)}%　進站 ${p.pits}${p.pitT>0?`<br>換電池中 ${Math.max(0,3-p.pitT).toFixed(1)}`:''}${p.boostT>0?'<br><span style="color:#ff8800">🟠 加速中</span>':''}${p.finished?`<br>🏁 ${p.time.toFixed(1)} 秒`:''}`;
    el.querySelector('.rank').textContent=phase==='race'||phase==='done'?['1st','2nd','3rd','4th'][order.indexOf(si)]:'';
    // 干擾雜訊（只畫在自己那格）
    const cv=el.querySelector('canvas.jam'), bl=el.querySelector('.black');
    if(p.inJam&&racing){ cv.style.display='block'; const g=cv.getContext('2d'), img=g.createImageData(120,68), dd=img.data;
      for(let q=0;q<dd.length;q+=4){ const v=Math.random()*255|0; dd[q]=dd[q+1]=dd[q+2]=v; dd[q+3]=Math.random()<0.6?90:0; }
      g.putImageData(img,0,0); cv.style.opacity=(0.35+Math.random()*0.4).toFixed(2); bl.style.opacity=(Math.random()<0.03)?0.85:0; }
    else { cv.style.display='none'; bl.style.opacity=0; }
  });
  $board.innerHTML=(phase==='race'||phase==='done')?`⏱ ${raceT.toFixed(1)} 秒　`+order.map((i,r)=>`<span style="color:${CSS_COL[i]}">${r+1}. P${i+1}${isAI(i)?'🤖':''}</span>`).join('　')
    +(firstFinishT!==null&&phase==='race'?`　⌛ 剩 ${Math.max(0,30-(raceT-firstFinishT)).toFixed(0)} 秒`:''):`🏁 ${trackName()}　${condTag()||'標準'}`;
});
showIntro();
window.__racePK={P,drones,rings,seatList,humans,camMode,get phase(){ return phase; },get raceT(){ return raceT; },jams:JAMS,
  finishNow:()=>{ P.forEach((p,i)=>{ p.finished=true; p.time=60+i*3; }); finishAll(); }};
addEventListener('beforeunload',()=>engine.dispose());
}
