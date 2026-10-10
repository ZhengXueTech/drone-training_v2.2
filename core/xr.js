/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   xr.js — VR 模式（Meta Quest 等頭盔，WebXR）（2026-10-08，第一版只接自由飛行）
   ------------------------------------------------------------
   · Quest 的手把在一般網頁裡不是「遊戲手把」，只有進入 VR 之後才讀得到 → 這裡自己讀，不經過 input.js。
   · 網頁 VR 只能在安全連線下啟動（https:// 或 localhost）。用筆電的 http://192.168.x.x 開不會出現按鈕，
     改用「啟動模擬器_VR.bat」（https）或 GitHub 線上版。
   · 手把（美國手）：左搖桿 上下＝油門、左右＝轉向；右搖桿 上下＝前後、左右＝左右。
     右扳機按住＝自穩；A＝切飛行模式；B＝切視角（場邊／跟機）；X＝離開 VR。
   · 視角：場邊＝站在場地邊上看無人機飛（比較不暈，預設）；跟機＝跟在無人機後面（刺激、容易暈）。
   · DOM 的 HUD 在 VR 裡看不到，所以另外做一塊浮在眼前下方的小看板（canvas 貼圖）。
   用法（關卡）：
     const xr=createXR(engine,{stand:new THREE.Vector3(0,0,12),onStart,onEnd,onButton});
     迴圈裡：const p=xr.active?xr.player(input.player(0)):input.player(0); …; xr.update(dt,drone); xr.setBoard([...]);
   ============================================================ */
import * as THREE from 'three';
import { getHand } from './hand.js';

const DZ=0.08;
const dz=v=>Math.abs(v)<DZ?0:(v-Math.sign(v)*DZ)/(1-DZ);

export function xrNeedsHttps(){ return !('xr' in navigator) && !isSecureContext; }
export function isHeadset(){ return /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent||''); }

export function createXR(engine,opt={}){
  const R=engine.renderer, cam=engine.camera, scene=engine.scene;
  const stand=(opt.stand||new THREE.Vector3(0,0,12)).clone();
  const dolly=new THREE.Group(); dolly.name='xr-dolly';
  const st={active:false,view:'side',session:null,btnPrev:{},sticks:{lx:0,ly:0,rx:0,ry:0},trigger:false,camParent:null};
  const _f=new THREE.Vector3(), _tgt=new THREE.Vector3();

  /* ── 眼前的小看板 ── */
  const cv=document.createElement('canvas'); cv.width=512; cv.height=192;
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(0.64,0.24),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false}));
  board.renderOrder=999; board.position.set(0,-0.38,-1.0); board.rotation.x=-0.35;
  let boardKey='';
  function setBoard(lines){
    const key=lines.join('|'); if(key===boardKey)return; boardKey=key;
    const g=cv.getContext('2d'); g.clearRect(0,0,512,192);
    g.fillStyle='rgba(6,16,28,.82)'; g.strokeStyle='rgba(0,238,255,.7)'; g.lineWidth=4;
    g.beginPath(); g.roundRect?g.roundRect(4,4,504,184,18):g.rect(4,4,504,184); g.fill(); g.stroke();
    g.textBaseline='middle';
    lines.slice(0,4).forEach((t,i)=>{ g.fillStyle=i===0?'#00eeff':'#e6f7ff'; g.font=(i===0?'bold 34px':'28px')+' "Microsoft JhengHei",sans-serif'; g.fillText(t,22,34+i*42,470); });
    tex.needsUpdate=true;
  }

  /* ── 「進入 VR」按鈕 ── */
  const btn=document.createElement('button'); btn.id='nd-xr-btn'; btn.textContent='🥽 進入 VR';
  btn.style.cssText='display:none;position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:60;font:bold 18px "Microsoft JhengHei",sans-serif;'+
    'padding:12px 22px;border-radius:12px;border:2px solid #00eeff;background:#06243a;color:#cfefff;cursor:pointer;';
  const tip=document.createElement('div'); tip.id='nd-xr-tip';
  tip.style.cssText='display:none;position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:60;max-width:90vw;font:14px "Microsoft JhengHei",sans-serif;'+
    'padding:8px 14px;border-radius:10px;border:1px solid #facc15;background:rgba(40,30,4,.9);color:#fde68a;text-align:center;';
  tip.textContent='這台頭盔可以玩 VR，但要用 https 網址開：請改用「啟動模擬器_VR.bat」給的網址，或 GitHub 線上版。';
  document.body.append(btn,tip);
  if(navigator.xr&&navigator.xr.isSessionSupported){
    navigator.xr.isSessionSupported('immersive-vr').then(ok=>{ if(ok)btn.style.display=''; }).catch(()=>{});
  }else if(xrNeedsHttps()&&isHeadset()) tip.style.display='';
  btn.onclick=()=>enter();

  async function enter(){
    if(st.active||!navigator.xr)return;
    let s; try{ s=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']}); }
    catch(e){ alert('無法進入 VR：'+(e&&e.message||e)); return; }
    R.xr.enabled=true; R.xr.setReferenceSpaceType('local-floor');
    try{ R.xr.setFoveation&&R.xr.setFoveation(1); }catch{}
    await R.xr.setSession(s);
    st.session=s; st.active=true; st.camParent=cam.parent;
    st.camPose={p:cam.position.clone(),q:cam.quaternion.clone()};
    scene.add(dolly); dolly.add(cam); cam.position.set(0,0,0); cam.quaternion.identity(); cam.add(board);
    dolly.position.copy(stand); dolly.rotation.set(0,0,0); st.view='side'; boardKey='';
    s.addEventListener('end',onEnd);
    opt.onStart&&opt.onStart();
  }
  function onEnd(){
    st.active=false; st.session=null;
    cam.remove(board); dolly.remove(cam); if(st.camParent)st.camParent.add(cam); scene.remove(dolly);
    if(st.camPose){ cam.position.copy(st.camPose.p); cam.quaternion.copy(st.camPose.q); }
    R.xr.enabled=false; engine.resize();
    opt.onEnd&&opt.onEnd();
  }
  function exit(){ if(st.session)st.session.end().catch(()=>{}); }

  /* ── 讀手把（xr-standard：axes[2,3]＝搖桿、buttons 0＝扳機、1＝握把、4＝A/X、5＝B/Y） ── */
  function poll(){
    const S=st.sticks; S.lx=S.ly=S.rx=S.ry=0; st.trigger=false; const now={};
    const srcs=st.session?st.session.inputSources:[];
    for(const src of srcs){ const g=src.gamepad; if(!g)continue; const h=src.handedness, ax=g.axes||[], b=g.buttons||[];
      const x=dz(ax.length>=4?ax[2]:ax[0]||0), y=dz(ax.length>=4?ax[3]:ax[1]||0);
      if(h==='left'){ S.lx=x; S.ly=y; now.X=!!(b[4]&&b[4].pressed); now.Y=!!(b[5]&&b[5].pressed); }
      if(h==='right'){ S.rx=x; S.ry=y; st.trigger=!!(b[0]&&b[0].pressed); now.A=!!(b[4]&&b[4].pressed); now.B=!!(b[5]&&b[5].pressed); } }
    for(const k of ['A','B','X','Y']){ if(now[k]&&!st.btnPrev[k])press(k); st.btnPrev[k]=!!now[k]; }
  }
  function press(k){
    if(k==='B'){ st.view=st.view==='side'?'follow':'side'; boardKey=''; if(st.view==='side'){ dolly.position.copy(stand); dolly.rotation.set(0,0,0); } }
    if(k==='X'){ exit(); return; }
    opt.onButton&&opt.onButton(k);
  }
  /* 換成 VR 手把的搖桿值，其他欄位（檔位、按鍵函式）沿用原本的 player 物件 */
  function player(base){
    const S=st.sticks;
    if(getHand()==='1')return {...base,device:'xr',throttle:-S.ry,yaw:S.lx,pitch:-S.ly,roll:S.rx};   // 2026-10-10 日本手：左桿上下＝前後、右桿上下＝油門
    return {...base,device:'xr',throttle:-S.ly,yaw:S.lx,pitch:-S.ry,roll:S.rx};
  }
  /* 每幀：讀手把、跟機視角時把站位移到無人機後方 */
  function update(dt,drone){
    if(!st.active)return; poll();
    if(st.view==='follow'&&drone){
      const yaw=drone.yaw||0; _f.set(-Math.sin(yaw),0,-Math.cos(yaw));
      _tgt.copy(drone.pos).addScaledVector(_f,-3.2); _tgt.y=Math.max(0,drone.pos.y-1.35);
      const k=1-Math.exp(-dt*3);
      dolly.position.lerp(_tgt,k);
      let d=yaw-dolly.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); dolly.rotation.y+=d*k;
    }
  }
  return {
    get active(){ return st.active; }, get view(){ return st.view; }, get selfLevel(){ return st.active&&st.trigger; },
    player,update,setBoard,enter,exit,dolly
  };
}
