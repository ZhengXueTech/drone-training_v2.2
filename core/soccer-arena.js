/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   soccer-arena.js — 足球場「競技場」外觀（2026-10-11，設計稿＝專案 claude/newdrone-足球場畫面升級構想.md）
   ------------------------------------------------------------
   老師定案：場地本體、LED 計分板＋觀眾席、新 HUD、發光效果都要；場地印 NEWDRONE；
   新舊可切換、預設新版；三關（3v3、PVP、擬真賽規）一起；畫質像線上遊戲一樣可選，避免效能問題。
   · 畫質（nd.settings.soccerGfx）：auto／high／mid／low／classic
       低＝紅藍地板＋標線＋簡單鋼管＋LED 計分板（平板、VR、舊電腦）
       中＝再加三角桁架球籠、觀眾席（約 300 人）、霓虹燈條
       高＝再加發光光暈（additive，不用後製，分割畫面也能用）、觀眾 700 人、看台燈
       經典＝原本的場地（systems/soccer.js buildClassicDeco，一字未改）
       自動＝觸控／VR／小螢幕用「低」，其他用「中」
   · 只換外觀：球門環、籠網尺寸、物理、規則完全不動（球門環仍由 soccer.js 建）
   · 計分板分數：讀 HUD 的 setProgress（「藍 a:b 紅」／「A a:b B」）與 setTimer、setMission（第幾節）
   · 開始畫面、暫停選單都多一顆「🖥️ 畫質」鈕，按了當場重建場地（比賽不中斷）
   import 就生效（systems/soccer.js 透過 setArenaHook 呼叫）。
   ============================================================ */
import * as THREE from 'three';
import { FIELD, setArenaHook, buildClassicDeco, FIELD_PRESETS, FIELD_SETUP, saveFieldSetup } from './systems/soccer.js';
import { progress } from '../data/progress.js';
import { UI } from './ui.js';
import { HUD } from './hud.js';
import { InputManager } from './input.js';
import { getHand } from './hand.js';

const KEY='nd.settings.soccerGfx';
const mmss=t=>{ const n=Math.ceil(Math.max(0,t)); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; };
const LABEL={auto:'自動',high:'高',mid:'中',low:'低',classic:'經典'};
const ORDER=['auto','high','mid','low','classic'];
export function gfxSetting(){ try{ const v=localStorage.getItem(KEY); return ORDER.includes(v)?v:'auto'; }catch{ return 'auto'; } }
export function gfxLevel(s=gfxSetting()){
  if(s!=='auto')return s;
  const touch=(()=>{ try{ return matchMedia('(pointer:coarse)').matches; }catch{ return false; } })();
  const vr=/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent||'');
  return (touch||vr||innerWidth<900)?'low':'mid';
}
const gfxLabel=()=>{ const s=gfxSetting(); return '🖥️ 畫質：'+LABEL[s]+(s==='auto'?'（'+LABEL[gfxLevel(s)]+'）':''); };

const F=FIELD, HL=F.HL, HW=F.HW;
const hudInfo={extra:'',mission:'',flight:'',cam:'',inp:null};
let SCENE=null, DECO=null, GOALS=null, board=null, boardState={a:0,b:0,t:null,set:1}, lastDrawn='';

/* ── 地板貼圖：紅藍半場＋標線＋NEWDRONE ── */
function floorTexture(){
  const W=512, H=1024, c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  const grd=(y0,y1,a,b)=>{ const l=g.createLinearGradient(0,y0,0,y1); l.addColorStop(0,a); l.addColorStop(1,b); return l; };
  g.fillStyle=grd(0,H/2,'#0b2a6b','#123a8a'); g.fillRect(0,0,W,H/2);          // 上半＝-Z＝藍隊
  g.fillStyle=grd(H/2,H,'#8a1a22','#6b1018'); g.fillRect(0,H/2,W,H/2);        // 下半＝+Z＝紅隊
  // 細格紋
  g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1;
  for(let x=0;x<=W;x+=32){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); }
  for(let y=0;y<=H;y+=32){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
  // 標線
  g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=6; g.strokeRect(6,6,W-12,H-12);
  g.beginPath(); g.moveTo(0,H/2); g.lineTo(W,H/2); g.stroke();
  g.beginPath(); g.arc(W/2,H/2,86,0,Math.PI*2); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.arc(W/2,H/2,8,0,Math.PI*2); g.fill();
  // 球門區（球門環在 ±2 公尺＝離底線 1 公尺）
  const gz=((HL-F.GZ)/F.FL)*H; g.lineWidth=4; g.strokeStyle='rgba(255,255,255,.75)';
  g.strokeRect(W*0.25,6,W*0.5,gz*1.2); g.strokeRect(W*0.25,H-6-gz*1.2,W*0.5,gz*1.2);
  // NEWDRONE 字樣（中線兩側，各朝自己的半場）
  g.font='900 60px "Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='rgba(255,255,255,.16)';
  g.save(); g.translate(W/2,H*0.32); g.rotate(Math.PI); g.fillText('NEWDRONE',0,0); g.restore();
  g.fillText('NEWDRONE',W/2,H*0.68);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}

/* ── LED 計分板 ── */
function makeBoard(){
  const c=document.createElement('canvas'); c.width=1024; c.height=384;
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});
  return {c,tex,mat};
}
function drawBoard(force){
  if(!board)return;
  const {a,b,t,set}=boardState, key=`${a}|${b}|${t==null?'':Math.ceil(t)}|${set}`;
  if(!force&&key===lastDrawn)return; lastDrawn=key;
  const g=board.c.getContext('2d'), W=1024, H=384;
  g.fillStyle='#03060c'; g.fillRect(0,0,W,H);
  g.strokeStyle='#22d3ee'; g.lineWidth=8; g.strokeRect(6,6,W-12,H-12);
  // LED 點陣感
  g.fillStyle='rgba(255,255,255,.03)'; for(let x=10;x<W;x+=8)for(let y=10;y<H;y+=8)g.fillRect(x,y,3,3);
  g.textAlign='center'; g.textBaseline='middle';
  g.font='900 46px "Arial Black",sans-serif'; g.fillStyle='#e6f7ff'; g.fillText('NEWDRONE  DRONE SOCCER',W/2,52);
  g.font='900 160px "Arial Black",sans-serif';
  g.fillStyle='#3b82f6'; g.shadowColor='#3b82f6'; g.shadowBlur=30; g.fillText(String(a),W*0.27,205);
  g.fillStyle='#ef4444'; g.shadowColor='#ef4444'; g.fillText(String(b),W*0.73,205);
  g.shadowBlur=0; g.fillStyle='#e6f7ff'; g.fillText(':',W/2,195);
  g.font='900 40px "Arial Black",sans-serif'; g.fillStyle='#93c5fd'; g.fillText('BLUE',W*0.27,320); g.fillStyle='#fca5a5'; g.fillText('RED',W*0.73,320);
  const tt=t==null?'--:--':mmss(t);
  g.font='900 44px "Arial Black",monospace'; g.fillStyle='#facc15'; g.fillText(`SET ${set}   ${tt}`,W/2,320);
  board.tex.needsUpdate=true;
}

/* ── 三角桁架：沿 a→b 的三根弦桿＋之字斜撐（中／高）── */
function truss(group,a,b,mat,w=0.14){
  const dir=new THREE.Vector3().subVectors(b,a), L=dir.length(); dir.normalize();
  const up=Math.abs(dir.y)>0.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
  const s1=new THREE.Vector3().crossVectors(dir,up).normalize(), s2=new THREE.Vector3().crossVectors(dir,s1).normalize();
  const off=[0,1,2].map(k=>{ const t=k/3*Math.PI*2; return s1.clone().multiplyScalar(Math.cos(t)*w).addScaledVector(s2,Math.sin(t)*w); });
  const rods=[];
  off.forEach(o=>rods.push([a.clone().add(o),b.clone().add(o),0.012]));
  const n=Math.max(2,Math.round(L/0.3));
  for(let i=0;i<n;i++){ const p0=a.clone().addScaledVector(dir,L*i/n), p1=a.clone().addScaledVector(dir,L*(i+1)/n);
    for(let k=0;k<3;k++)rods.push([p0.clone().add(off[k]),p1.clone().add(off[(k+1)%3]),0.006]); }
  const geo=new THREE.CylinderGeometry(1,1,1,5), im=new THREE.InstancedMesh(geo,mat,rods.length), m=new THREE.Matrix4(), q=new THREE.Quaternion(), Y=new THREE.Vector3(0,1,0);
  rods.forEach(([p,r,rad],i)=>{ const d=new THREE.Vector3().subVectors(r,p), len=d.length(); q.setFromUnitVectors(Y,d.normalize());
    m.compose(p.clone().lerp(r,0.5),q,new THREE.Vector3(rad,len,rad)); im.setMatrixAt(i,m); });
  group.add(im);
}

/* ── 觀眾席：兩側長邊階梯看台＋方塊人（隨機顏色、少數舉手） ── */
function stands(group,n,lvl){
  const stepM=new THREE.MeshStandardMaterial({color:0x1b2433,roughness:.9});
  const people=[];
  let seed=1011; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(const sx of [-1,1]){
    for(let r=0;r<5;r++){ const x=sx*(HW+1.6+r*0.55), h=0.25+r*0.32;
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.55,h,F.FL+3),stepM); st.position.set(x,h/2,0); group.add(st);
      for(let z=-(F.FL+2)/2;z<=(F.FL+2)/2;z+=0.32){ if(rnd()<0.25)continue; people.push([x+(rnd()-0.5)*0.12,h,z+(rnd()-0.5)*0.08,sx]); } }
  }
  // 兩端（球門後面）各一排低看台
  for(const sz of [-1,1]){ const z=sz*(HL+2.6), h=0.3;
    const st=new THREE.Mesh(new THREE.BoxGeometry(F.FW+4,h,0.6),stepM); st.position.set(0,h/2,z); group.add(st);
    for(let x=-(F.FW+3)/2;x<=(F.FW+3)/2;x+=0.32){ if(rnd()<0.35)continue; people.push([x,h,z,0,sz]); } }
  people.sort(()=>rnd()-0.5); people.length=Math.min(people.length,n);
  const COLS=[0x3b82f6,0xef4444,0xfacc15,0x22c55e,0xf97316,0xe5e7eb,0xa855f7,0x60a5fa,0xf87171];
  const body=new THREE.InstancedMesh(new THREE.BoxGeometry(0.16,0.24,0.12),new THREE.MeshStandardMaterial({roughness:.8}),people.length);
  const head=new THREE.InstancedMesh(new THREE.BoxGeometry(0.11,0.11,0.11),new THREE.MeshStandardMaterial({color:0xf1c27d,roughness:.8}),people.length);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(1,1,1), c=new THREE.Color();
  people.forEach(([x,y,z,sx,sz],i)=>{ q.setFromEuler(new THREE.Euler(0,sx?(sx>0?-Math.PI/2:Math.PI/2):(sz>0?Math.PI:0),0));
    m.compose(new THREE.Vector3(x,y+0.12,z),q,s); body.setMatrixAt(i,m); body.setColorAt(i,c.setHex(COLS[Math.floor(rnd()*COLS.length)]));
    m.compose(new THREE.Vector3(x,y+0.31,z),q,s); head.setMatrixAt(i,m); });
  group.add(body,head);
  return people.length;
}

/* ── 建競技場 ── */
function buildArena(scene,deco,lvl){
  scene.background=new THREE.Color(0x02040a);
  scene.fog=new THREE.FogExp2(0x02040a,lvl==='low'?0.018:0.012);
  deco.add(new THREE.HemisphereLight(0x9fc3ff,0x101820,lvl==='low'?1.4:1.1));
  const key=new THREE.DirectionalLight(0xffffff,1.1); key.position.set(3,9,-4); deco.add(key);
  const fill=new THREE.DirectionalLight(0x88aaff,0.4); fill.position.set(-4,5,5); deco.add(fill);
  // 外圍地台
  const plat=new THREE.Mesh(new THREE.PlaneGeometry(26,30),new THREE.MeshStandardMaterial({color:0x0a0f18,roughness:.85,metalness:.2}));
  plat.rotation.x=-Math.PI/2; plat.position.y=-0.005; deco.add(plat);
  if(lvl!=='low'){ const grid=new THREE.GridHelper(26,26,0x123250,0x0c1a2c); grid.position.y=0.001; deco.add(grid); }
  // 場內地板
  const flr=new THREE.Mesh(new THREE.PlaneGeometry(F.FW,F.FL),new THREE.MeshStandardMaterial({map:floorTexture(),roughness:.7,metalness:.1}));
  flr.rotation.x=-Math.PI/2; flr.position.y=0.002; deco.add(flr);
  // 籠網：很淡的面板（比經典版更透，看得到外面的觀眾）
  const netM=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:lvl==='low'?0.05:0.035,side:THREE.DoubleSide,depthWrite:false});
  [[F.FW,F.FH,[0,F.FH/2,-HL],0,0],[F.FW,F.FH,[0,F.FH/2,HL],0,Math.PI],[F.FL,F.FH,[-HW,F.FH/2,0],0,Math.PI/2],[F.FL,F.FH,[HW,F.FH/2,0],0,-Math.PI/2],[F.FW,F.FL,[0,F.FH,0],-Math.PI/2,0]]
    .forEach(([w,h,p,rx,ry])=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),netM); m.position.set(...p); m.rotation.set(rx,ry,0); deco.add(m); });
  // 網格線（籠網的細格）
  if(lvl!=='low'){ const gl=new THREE.LineBasicMaterial({color:0x5fa8d8,transparent:true,opacity:0.14});
    const pts=[];
    for(let x=-HW;x<=HW+1e-6;x+=0.25)for(const z of [-HL,HL]){ pts.push(x,0,z,x,F.FH,z); }
    for(let z=-HL;z<=HL+1e-6;z+=0.25)for(const x of [-HW,HW]){ pts.push(x,0,z,x,F.FH,z); }
    for(let y=0.25;y<F.FH;y+=0.25){ for(const z of [-HL,HL])pts.push(-HW,y,z,HW,y,z); for(const x of [-HW,HW])pts.push(x,y,-HL,x,y,HL); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); deco.add(new THREE.LineSegments(g,gl)); }
  // 鋼架
  const steel=new THREE.MeshStandardMaterial({color:0xb8c4d0,metalness:.85,roughness:.3});
  const C=[[-HW,-HL],[HW,-HL],[HW,HL],[-HW,HL]], top=F.FH+0.15;
  const rod=(a,b,r)=>{ const d=new THREE.Vector3().subVectors(b,a), L=d.length(), m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,8),steel);
    m.position.copy(a).lerp(b,0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); deco.add(m); };
  if(lvl==='low'){ C.forEach(([x,z])=>rod(new THREE.Vector3(x,0,z),new THREE.Vector3(x,top,z),0.035));
    for(let i=0;i<4;i++){ const [x0,z0]=C[i],[x1,z1]=C[(i+1)%4]; rod(new THREE.Vector3(x0,top,z0),new THREE.Vector3(x1,top,z1),0.03); } }
  else { C.forEach(([x,z])=>truss(deco,new THREE.Vector3(x,0,z),new THREE.Vector3(x,top,z),steel));
    for(let i=0;i<4;i++){ const [x0,z0]=C[i],[x1,z1]=C[(i+1)%4]; truss(deco,new THREE.Vector3(x0,top,z0),new THREE.Vector3(x1,top,z1),steel); }
    truss(deco,new THREE.Vector3(-HW,top,0),new THREE.Vector3(HW,top,0),steel,0.1); }
  // 霓虹燈條：地板外框＋籠頂外框（藍半場藍、紅半場紅）
  const neon=[];
  const strip=(a,b,col)=>{ const d=new THREE.Vector3().subVectors(b,a), L=d.length();
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,L),new THREE.MeshBasicMaterial({color:col,toneMapped:false}));
    m.position.copy(a).lerp(b,0.5); m.lookAt(b); deco.add(m); neon.push([m,L,col]); };
  {
    for(const y of [0.02,top+0.18]){ strip(new THREE.Vector3(-HW-0.05,y,-HL-0.05),new THREE.Vector3(HW+0.05,y,-HL-0.05),0x3b82f6); strip(new THREE.Vector3(-HW-0.05,y,HL+0.05),new THREE.Vector3(HW+0.05,y,HL+0.05),0xef4444);
      for(const x of [-HW-0.05,HW+0.05]){ strip(new THREE.Vector3(x,y,-HL-0.05),new THREE.Vector3(x,y,0),0x3b82f6); strip(new THREE.Vector3(x,y,0),new THREE.Vector3(x,y,HL+0.05),0xef4444); } } }
  // 高：發光光暈（additive，比真正的後製便宜、分割畫面也能用）
  if(lvl==='high'){ neon.forEach(([m,L,col])=>{ const h=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,L),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false}));
      h.position.copy(m.position); h.quaternion.copy(m.quaternion); deco.add(h); });
    // 看台燈
    for(const sx of [-1,1])for(const sz of [-1,1]){ const l=new THREE.PointLight(0xbfdcff,6,14); l.position.set(sx*(HW+3),5,sz*(HL+1)); deco.add(l); } }
  // 觀眾席
  if(lvl!=='low')stands(deco,lvl==='high'?700:300,lvl);
  // LED 計分板：兩端球門後方上空（飛手位在藍隊底線後，看得到紅隊那面）
  board=makeBoard(); drawBoard(true);
  for(const sz of [-1,1]){ const frame=new THREE.Group();
    const scr=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.2),board.mat); frame.add(scr);
    const back=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.4,0.12),new THREE.MeshStandardMaterial({color:0x111827,metalness:.6,roughness:.4})); back.position.z=-0.07; frame.add(back);
    if(lvl==='high'){ const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,1.8),new THREE.MeshBasicMaterial({color:0x22d3ee,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false})); glow.position.z=-0.01; frame.add(glow); }
    frame.position.set(0,F.FH+1.3,sz*(HL+1.4)); frame.rotation.y=sz>0?Math.PI:0; deco.add(frame);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,F.FH+1.3),steel); pole.position.set(0,(F.FH+1.3)/2,sz*(HL+1.5)); deco.add(pole); }
}

/* ── 註冊給 systems/soccer.js ── */
setArenaHook({
  build(scene,deco){
    SCENE=scene; DECO=deco; const lvl=gfxLevel();
    if(lvl==='classic'){ board=null; buildClassicDeco(deco,scene); return; }
    buildArena(scene,deco,lvl);
  },
  goals(goals,scene,deco){ GOALS=goals; addGoalGlow(); }
});
function addGoalGlow(){
  if(!GOALS)return;
  for(const g of GOALS){ if(g._glow){ g.mesh.remove(g._glow); g._glow=null; }
    if(gfxLevel()==='high'){ const col=g.mesh.material.color.getHex();
      const halo=new THREE.Mesh(new THREE.TorusGeometry(F.GR,F.GT*2.6,12,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.25,blending:THREE.AdditiveBlending,depthWrite:false}));
      g.mesh.add(halo); g._glow=halo; } }
}
/* 當場重建（畫質切換）：清空 deco 群組再建一次；球門環不動 */
export function rebuildArena(){
  if(!SCENE||!DECO)return;
  for(const o of [...DECO.children]){ DECO.remove(o); o.traverse?.(x=>{ x.geometry?.dispose?.(); if(x.material){ (Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{ m.map?.dispose?.(); m.dispose?.(); }); } }); }
  const lvl=gfxLevel(); lastDrawn='';
  if(lvl==='classic'){ board=null; buildClassicDeco(DECO,SCENE); } else buildArena(SCENE,DECO,lvl);
  addGoalGlow();
}
function cycleGfx(){ const s=gfxSetting(); const n=ORDER[(ORDER.indexOf(s)+1)%ORDER.length]; try{ localStorage.setItem(KEY,n); }catch{} rebuildArena(); }

/* ── 計分板讀分數：HUD 的 setProgress／setTimer／setMission ── */
const _sp=HUD.prototype.setProgress, _st=HUD.prototype.setTimer, _sm=HUD.prototype.setMission;
HUD.prototype.setProgress=function(t){ const m=/(?:藍|A)\s*(\d+)\s*:\s*(\d+)\s*(?:紅|B)/.exec(t||''); if(m){ boardState.a=+m[1]; boardState.b=+m[2]; drawBoard(); }
  hudInfo.extra=String(t||'').replace(/(?:藍|A)\s*\d+\s*:\s*\d+\s*(?:紅|B)/,'').trim(); return _sp.apply(this,arguments); };
HUD.prototype.setTimer=function(t){ boardState.t=(t==null?null:t); drawBoard(); return _st.apply(this,arguments); };
HUD.prototype.setMission=function(t){ const m=/第\s*(\d+)\s*[節局]/.exec(t||''); if(m){ boardState.set=+m[1]; drawBoard(); } hudInfo.mission=String(t||''); return _sm.apply(this,arguments); };
const _smo=HUD.prototype.setModes;
HUD.prototype.setModes=function(f,c){ hudInfo.flight=f; hudInfo.cam=c; return _smo.apply(this,arguments); };
const _pl=InputManager.prototype.player;
InputManager.prototype.player=function(n=0){ const r=_pl.apply(this,arguments); if(n===0&&r)hudInfo.inp=r; return r; };

/* ── 開始畫面、暫停選單多一顆「🖥️ 畫質」 ── */
const _show=UI.prototype.showModal;
UI.prototype.showModal=function(args){
  const btns=args.buttons||[];
  const isPause=/暫停/.test(args.title||''), isStart=btns.some(b=>b.id==='b-go');   // 足球三關的開始畫面都有 b-go
  // 統一開始畫面（有 settings）：畫質、場地、球門高做成設定列，不再是按鈕
  if(isStart&&Array.isArray(args.settings)&&!args.settings.some(r=>r.id==='gfx')){
    const P=FIELD_PRESETS[FIELD_SETUP.preset];
    const rows=[...args.settings,
      {id:'field',label:'📐 場地',value:FIELD_SETUP.preset,options:[{v:'fai',label:'FAI 6×3×3（台灣比賽）'},{v:'fida',label:'FIDA 8×4×3'}],
        hint:v=>v==='fida'?'球門離底線 1.5 m、內徑 30 cm（改了會重新載入）':'球門離底線 1 m、內徑 40 cm（改了會重新載入）',
        onChange:v=>{ if(v===FIELD_SETUP.preset)return; saveFieldSetup({preset:v,gy:FIELD_PRESETS[v].gy}); location.reload(); }},
      {id:'gh',label:'🥅 球門高',value:String(FIELD.GY),options:P.gys.map(g=>({v:String(g),label:g.toFixed(1)+' m'})),
        hint:()=>FIELD_SETUP.preset==='fida'?'FIDA 規定 1.8～2.2 m（改了會重新載入）':'FAI 沒規定高度，預設 2.5 m（改了會重新載入）',
        onChange:v=>{ if(+v===FIELD.GY)return; saveFieldSetup({preset:FIELD_SETUP.preset,gy:+v}); location.reload(); }},
      {id:'gfx',label:'🖥️ 畫質',value:gfxSetting(),options:ORDER.map(k=>({v:k,label:k==='auto'?'自動（'+LABEL[gfxLevel('auto')]+'）':LABEL[k]})),
        hint:v=>({auto:'依裝置自動選',high:'發光、觀眾最多，電腦要夠力',mid:'一般電腦',low:'平板、舊電腦、VR',classic:'原本的場地'})[v],
        onChange:v=>{ try{ localStorage.setItem(KEY,v); }catch{} rebuildArena(); }}];
    let html=args.html||'';
    if(FIELD_SETUP.preset==='fida')html=`<div style="border:2px solid #f97316;background:rgba(249,115,22,.15);border-radius:10px;padding:8px 12px;margin-bottom:8px;color:#fed7aa;line-height:1.6;font-size:13px">
        ⚠ <b>目前是 FIDA Class 20 場地</b>（FIDA 國際無人機足球協會聯合會 2023 規則）：<b>8×4×3 公尺</b>、球門<b>離底線 1.5 公尺</b>、球門內徑 <b>30 cm</b>／外徑 50 cm、中心高 1.8～2.2 公尺。<br>
        台灣教育部、教育科技盃採用的是 <b>FAI F9A-B（6×3×3、球門離底線 1 公尺、內徑 40 cm）</b>——要練正式比賽請切回 FAI。成績會標示「FIDA 場地」另外記。</div>`+html;
    return _show.call(this,{...args,html,settings:rows});
  }
  if((isPause||isStart)&&!btns.some(b=>b.id==='b-gfx')){
    let nb=[...btns,{id:'b-gfx',label:gfxLabel(),onClick:()=>{ cycleGfx(); const el=document.getElementById('b-gfx'); if(el)el.textContent=gfxLabel(); }}];
    let html=args.html||'';
    if(isStart){
      // 2026-10-11 開賽前場地設定：場地規格、球門高度（改了重新載入頁面，因為場地大小在載入時就決定）
      const P=FIELD_PRESETS[FIELD_SETUP.preset];
      nb=[...nb,
        {id:'b-field',label:'📐 場地：'+P.label,onClick:()=>{ const np=FIELD_SETUP.preset==='fai'?'fida':'fai'; saveFieldSetup({preset:np,gy:FIELD_PRESETS[np].gy}); location.reload(); }},
        {id:'b-gh',label:'🥅 球門高：'+FIELD.GY.toFixed(1)+' m',onClick:()=>{ const L=P.gys, i=(L.indexOf(FIELD.GY)+1)%L.length; saveFieldSetup({preset:FIELD_SETUP.preset,gy:L[i]}); location.reload(); }}];
      if(FIELD_SETUP.preset==='fida')html=`<div style="border:2px solid #f97316;background:rgba(249,115,22,.15);border-radius:10px;padding:8px 12px;margin-bottom:8px;color:#fed7aa;line-height:1.6">
        ⚠ <b>目前是 FIDA Class 20 場地</b>（FIDA 國際無人機足球協會聯合會 2023 規則）：<b>8×4×3 公尺</b>、球門<b>離底線 1.5 公尺</b>、球門內徑 <b>30 cm</b>／外徑 50 cm、中心高 1.8～2.2 公尺。<br>
        台灣教育部、教育科技盃採用的是 <b>FAI F9A-B（6×3×3、球門離底線 1 公尺、內徑 40 cm）</b>——要練正式比賽請切回 FAI。成績會標示「FIDA 場地」另外記。</div>`+html;
      else if(FIELD.GY!==FIELD_PRESETS.fai.gy)html=`<p style="color:#fde68a">🥅 球門中心高 ${FIELD.GY.toFixed(1)} 公尺（預設 2.5）——成績會另外標示。</p>`+html;
    }
    const r=_show.call(this,{...args,html,buttons:nb});
    if(!this._navAdded)this._navAdded=[]; for(const id of ['b-gfx','b-field','b-gh'])if(nb.some(b=>b.id===id)&&!this._navAdded.includes(id))this._navAdded=[...this._navAdded,id];
    return r;
  }
  return _show.call(this,args);
};
/* 成績標示：FIDA 場地、非預設球門高度另外記（progress.record 的 challenge 後面加上） */
const fieldTag=()=>[FIELD_SETUP.preset==='fida'?'FIDA 場地':'',FIELD.GY!==FIELD_PRESETS[FIELD_SETUP.preset].gy?'球門 '+FIELD.GY.toFixed(1)+'m':''].filter(Boolean).join('・');
{ const _rec=progress.record.bind(progress);
  progress.record=(id,r)=>{ const t=fieldTag(); if(t&&/^soccer/.test(id)&&r){ const base=r.challenge&&r.challenge!=='標準'?r.challenge+'・':''; r={...r,challenge:base+t,challengeCode:(r.challengeCode||'')+(FIELD_SETUP.preset==='fida'?'-fida':'')+'-gy'+FIELD.GY}; } return _rec(id,r); }; }

/* ── 新 HUD 版面（2026-10-11，老師：可以）：轉播式比分列＋左側資訊面板＋搖桿通道回饋。
   畫質不是「經典」才顯示；原本 HUD 的比分那一列（#nd-mission）收起來，裡面其他文字（回防、停飛、電量、延長賽）搬到比分列下面，資訊不少。 */
{ const st=document.createElement('style'); st.textContent=`
body.nd-arena-hud #nd-mission{display:none!important;}
#ar-hud{position:fixed;inset:0;pointer-events:none;z-index:19;font-family:'Microsoft JhengHei','Share Tech Mono',sans-serif;display:none;}
body.nd-arena-hud #ar-hud{display:block;}
#ar-score{position:absolute;left:50%;top:8px;transform:translateX(-50%);display:flex;align-items:stretch;border-radius:10px;overflow:hidden;box-shadow:0 0 18px rgba(34,211,238,.35);border:1px solid rgba(34,211,238,.6);}
#ar-score .tm{padding:4px 14px;font:900 15px 'Arial Black',sans-serif;color:#fff;display:flex;align-items:center;gap:10px;}
#ar-score .b{background:linear-gradient(90deg,#1d4ed8,#2563eb);} #ar-score .r{background:linear-gradient(90deg,#dc2626,#b91c1c);}
#ar-score .n{font-size:24px;min-width:22px;text-align:center;}
#ar-score .mid{background:#05080f;color:#facc15;padding:2px 14px;text-align:center;font:900 13px 'Arial Black',monospace;line-height:1.25;}
#ar-score .mid b{display:block;font-size:20px;color:#fff;}
#ar-sub{position:absolute;left:50%;top:66px;transform:translateX(-50%);color:#e6f7ff;font-size:12px;background:rgba(5,8,15,.7);border-radius:8px;padding:2px 10px;white-space:nowrap;}
#ar-sub:empty{display:none;}
#ar-panel{position:absolute;left:8px;top:96px;width:178px;background:rgba(5,8,15,.78);border:1px solid rgba(34,211,238,.45);border-left:4px solid #22d3ee;border-radius:8px;padding:6px 9px;color:#cfefff;font-size:11.5px;line-height:1.75;}
#ar-panel h4{margin:0 0 2px;font:900 11px 'Arial Black',sans-serif;color:#22d3ee;letter-spacing:1px;}
#ar-panel b{color:#fff;}
#ar-sticks{position:absolute;left:8px;bottom:88px;display:flex;gap:8px;align-items:flex-end;background:rgba(5,8,15,.78);border:1px solid rgba(34,211,238,.45);border-radius:8px;padding:6px 8px;}
#ar-sticks .pad{width:56px;height:56px;border:1px solid #2f5d7a;border-radius:8px;position:relative;background:radial-gradient(circle,#0e2238,#05080f);}
#ar-sticks .pad i{position:absolute;width:10px;height:10px;margin:-5px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee;left:50%;top:50%;}
#ar-sticks .ch{font:11px 'Share Tech Mono',monospace;color:#9fc3d8;line-height:1.5;min-width:64px;}
#ar-sticks .ch b{color:#fff;display:inline-block;width:38px;text-align:right;}
@media (max-width:760px){ #ar-panel{display:none;} #ar-sticks{display:none;} #ar-score .n{font-size:18px;} }
body.nd-touch #ar-sticks, body.nd-portrait #ar-sticks, body.nd-portrait #ar-panel{display:none;}`;
  document.head.appendChild(st); }
const $ah=document.createElement('div'); $ah.id='ar-hud';
$ah.innerHTML=`<div id="ar-score"><div class="tm b">BLUE <span class="n" id="ar-a">0</span></div><div class="mid">SET <span id="ar-set">1</span><b id="ar-t">--:--</b></div><div class="tm r"><span class="n" id="ar-b">0</span> RED</div></div>
<div id="ar-sub"></div>
<div id="ar-panel"><h4>NEWDRONE · DRONE INFO</h4><div id="ar-pinfo"></div></div>
<div id="ar-sticks"><div class="pad"><i id="ar-l"></i></div><div class="pad"><i id="ar-r"></i></div><div class="ch" id="ar-ch"></div></div>`;
(document.body?Promise.resolve():new Promise(r=>addEventListener('DOMContentLoaded',r))).then(()=>document.body.appendChild($ah));
const $=id=>document.getElementById(id), pct=v=>`${v>=0?'+':''}${Math.round((v||0)*100)}%`;
function hudTick(){
  requestAnimationFrame(hudTick);
  const on=gfxLevel()!=='classic'&&!!SCENE; document.body&&document.body.classList.toggle('nd-arena-hud',on);
  if(!on||!$('ar-a'))return;
  const {a,b,t,set}=boardState;
  $('ar-a').textContent=a; $('ar-b').textContent=b; $('ar-set').textContent=set;
  $('ar-t').textContent=t==null?'--:--':mmss(t);
  const sub=[/延長|黃金|局間|維修/.test(hudInfo.mission)?hudInfo.mission:'',hudInfo.extra].filter(Boolean).join('　'); if($('ar-sub').textContent!==sub)$('ar-sub').textContent=sub;
  let hold='開'; try{ if(localStorage.getItem('nd.settings.soccerHoldOff')==='true'||/專家/.test(hudInfo.flight))hold='關'; }catch{}
  const P=FIELD_PRESETS[FIELD_SETUP.preset];
  const html=`🎮 <b>${hudInfo.flight||'—'}</b><br>📷 視角 <b>${hudInfo.cam||'—'}</b><br>🧭 定高 <b>${hold}</b><br>📐 <b>${FIELD_SETUP.preset==='fida'?'FIDA 8×4×3':'FAI 6×3×3'}</b>　🥅 <b>${FIELD.GY.toFixed(1)} m</b>`;
  if($('ar-pinfo').innerHTML!==html)$('ar-pinfo').innerHTML=html;
  const p=hudInfo.inp;
  if(p&&(p.device==='gamepad'||p.device==='keyboard')){ $('ar-sticks').style.display='';
    const jp=getHand()==='1', lv=jp?p.pitch:p.throttle, rv=jp?p.throttle:p.pitch;   // 日本手：左桿上下＝前後
    $('ar-l').style.left=(50+(p.yaw||0)*40)+'%'; $('ar-l').style.top=(50-(lv||0)*40)+'%';
    $('ar-r').style.left=(50+(p.roll||0)*40)+'%'; $('ar-r').style.top=(50-(rv||0)*40)+'%';
    $('ar-ch').innerHTML=`T <b>${pct(p.throttle)}</b><br>Y <b>${pct(p.yaw)}</b><br>P <b>${pct(p.pitch)}</b><br>R <b>${pct(p.roll)}</b>`; }
  else $('ar-sticks').style.display='none';
}
requestAnimationFrame(hudTick);
window.__arena={get level(){ return gfxLevel(); },rebuild:rebuildArena,get board(){ return {...boardState}; }};
