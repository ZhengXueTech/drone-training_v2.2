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
   2026-10-11 新增（改裝賽道用，自由飛行不受影響）：opt.views＝B 鍵輪流的視角清單，可用
     'goggle'（FPV 眼鏡：眼前一塊大螢幕播機上鏡頭，轉頭畫面不跟著轉，最像真實 FPV、比較不暈）、
     'cockpit'（沉浸駕駛艙：人坐在機上，跟著機身轉，轉頭看四周，最刺激也最容易暈）、'side'、'follow'。
     opt.view＝進 VR 時的視角；opt.fpvTilt＝機上鏡頭上仰角（rad）。沒給 views＝原本的 場邊／跟機。
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
  const VIEWS=opt.views||['side','follow'];
  const st={active:false,view:VIEWS[0],session:null,btnPrev:{},sticks:{lx:0,ly:0,rx:0,ry:0},trigger:false,camParent:null};
  /* FPV 眼鏡：機上鏡頭畫到一張貼圖，貼在眼前的大螢幕；人站在遠處一個暗房間裡（看不到賽道本體） */
  const GOG=new THREE.Vector3(0,-300,0);
  const fpvCam=new THREE.PerspectiveCamera(100,16/9,0.05,400);
  const rt=new THREE.WebGLRenderTarget(1280,720,{samples:2}); rt.texture.colorSpace=THREE.SRGBColorSpace;
  const goggle=new THREE.Group(); goggle.visible=false;
  { const room=new THREE.Mesh(new THREE.SphereGeometry(9,24,16),new THREE.MeshBasicMaterial({color:0x05080e,side:THREE.BackSide,fog:false}));
    const scr=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.025),new THREE.MeshBasicMaterial({map:rt.texture,fog:false,toneMapped:false}));
    scr.position.set(0,1.45,-2.6);
    const rim=new THREE.Mesh(new THREE.PlaneGeometry(3.75,2.17),new THREE.MeshBasicMaterial({color:0x0b2a3a,fog:false})); rim.position.set(0,1.45,-2.62);
    goggle.add(room,rim,scr); }
  const _qT=new THREE.Quaternion(), _hv=new THREE.Vector3();
  function goggleRender(r,scene,cam0){
    goggle.visible=false; const was=r.xr.enabled; r.xr.enabled=false;
    r.setRenderTarget(rt); r.render(scene,fpvCam); r.setRenderTarget(null);
    r.xr.enabled=was; goggle.visible=true; r.render(scene,cam0);
  }
  function applyView(){
    const g=st.view==='goggle';
    engine.setRenderFn(g&&st.active?goggleRender:null); goggle.visible=g&&st.active;
    if(st.view==='side'){ dolly.position.copy(stand); dolly.rotation.set(0,0,0); }
    if(g){ dolly.position.copy(GOG); dolly.quaternion.identity(); }
  }
  const _f=new THREE.Vector3(), _tgt=new THREE.Vector3();

  /* ── 眼前的小看板 ── */
  const cv=document.createElement('canvas'); cv.width=512; cv.height=192;
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(0.64,0.24),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false}));
  board.renderOrder=999; board.position.set(0,-0.38,-1.0); board.rotation.x=-0.35;
  if(opt.boardPos){ const b=opt.boardPos; board.position.set(b.x||0,b.y,b.z); board.rotation.x=b.tilt||0; board.scale.setScalar(b.scale||1); }   // 2026-10-11 賽道：看板放低、縮小，不擋中央
  /* 大字倒數（賽道用）：眼前正中央，倒數完就收起來 */
  const bcv=document.createElement('canvas'); bcv.width=256; bcv.height=256;
  const btex=new THREE.CanvasTexture(bcv); btex.colorSpace=THREE.SRGBColorSpace;
  const big=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.42),new THREE.MeshBasicMaterial({map:btex,transparent:true,depthTest:false,fog:false}));
  big.renderOrder=1000; big.position.set(0,0.02,-1.4); big.visible=false; let bigKey='';
  function setBig(txt,col='#fff'){
    if(!txt){ big.visible=false; bigKey=''; return; } big.visible=true;
    if(txt+col===bigKey)return; bigKey=txt+col;
    const g=bcv.getContext('2d'); g.clearRect(0,0,256,256); g.textAlign='center'; g.textBaseline='middle';
    g.font=(txt.length>2?'bold 92px':'bold 190px')+' "Arial Black","Microsoft JhengHei",sans-serif';
    g.lineWidth=12; g.strokeStyle='rgba(0,0,0,.7)'; g.strokeText(txt,128,134); g.fillStyle=col; g.fillText(txt,128,134); btex.needsUpdate=true;
  }
  let boardKey='';
  function setBoard(lines){
    const key=lines.join('|'); if(key===boardKey)return; boardKey=key;
    const g=cv.getContext('2d'); g.clearRect(0,0,512,192);
    g.fillStyle='rgba(6,16,28,.82)'; g.strokeStyle='rgba(0,238,255,.7)'; g.lineWidth=4;
    const bh=opt.boardPos?Math.min(184,12+Math.min(4,lines.length)*42):184;   // 賽道：只有一行時看板變矮
    g.beginPath(); g.roundRect?g.roundRect(4,4,504,bh,18):g.rect(4,4,504,bh); g.fill(); g.stroke();
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
    navigator.xr.isSessionSupported('immersive-vr').then(ok=>{ if(ok&&!opt.hideButton)btn.style.display=''; }).catch(()=>{});
  }else if(xrNeedsHttps()&&isHeadset()) tip.style.display='';
  btn.onclick=()=>enter();

  /* 10/12 老師回報偶爾跳「There is already an active immersive XRSession」：按鈕被連按（或兩顆進入鈕都按到），
     第二次 requestSession 撞到第一次還沒開好的。→ 進入中先鎖住、不再跳 alert（會卡住頭盔畫面），改成畫面上的提示；
     離開頁面時一定把 VR 關掉，避免殘留到下一頁 */
  let entering=false;
  function warn(msg){ tip.textContent=msg; tip.style.display=''; clearTimeout(warn._t); warn._t=setTimeout(()=>{ tip.style.display='none'; },6000); }
  addEventListener('pagehide',()=>{ try{ st.session&&st.session.end(); }catch{} });
  async function enter(){
    if(st.active||entering||!navigator.xr)return;
    entering=true;
    let s; try{ s=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']}); }
    catch(e){ entering=false; const m=String(e&&e.message||e);
      warn(/already/i.test(m)?'VR 已經在開啟中，請稍等一下；如果頭盔一直沒畫面，按手把 Meta 鍵回瀏覽器，重新整理頁面再按一次「進入 VR」。':'無法進入 VR：'+m); return; }
    entering=false;
    R.xr.enabled=true; R.xr.setReferenceSpaceType('local-floor');
    try{ R.xr.setFoveation&&R.xr.setFoveation(1); }catch{}
    await R.xr.setSession(s);
    st.session=s; st.active=true; st.camParent=cam.parent;
    st.camPose={p:cam.position.clone(),q:cam.quaternion.clone()};
    scene.add(dolly); dolly.add(cam); cam.position.set(0,0,0); cam.quaternion.identity(); cam.add(board); cam.add(big); board.visible=true;
    dolly.position.copy(stand); dolly.rotation.set(0,0,0); st.view=opt.view||VIEWS[0]; boardKey='';
    if(!goggle.parent)dolly.add(goggle); applyView();
    s.addEventListener('end',onEnd);
    opt.onStart&&opt.onStart();
  }
  function onEnd(){
    st.active=false; st.session=null; engine.setRenderFn(null); goggle.visible=false; dolly.quaternion.identity();
    cam.remove(board); cam.remove(big); dolly.remove(cam); if(st.camParent)st.camParent.add(cam); scene.remove(dolly);
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
    if(k==='B'){ st.view=VIEWS[(VIEWS.indexOf(st.view)+1)%VIEWS.length]; boardKey=''; dolly.quaternion.identity(); applyView(); }
    if(k==='X'){ exit(); return; }
    if(k==='Y'&&opt.boardToggle){ board.visible=!board.visible; return; }   // 賽道：Y＝收起／打開看板
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
    if(drone&&(st.view==='cockpit'||st.view==='goggle')){
      _qT.setFromAxisAngle(_hv.set(1,0,0),opt.fpvTilt||0);
      if(st.view==='cockpit'){   // 人坐在機上：頭的位置對準機身（扣掉頭盔自己的高度）
        dolly.quaternion.copy(drone.q);
        _hv.copy(cam.position).applyQuaternion(dolly.quaternion);
        dolly.position.copy(drone.pos).sub(_hv);
      }else{
        fpvCam.position.copy(drone.pos); fpvCam.quaternion.copy(drone.q).multiply(_qT); fpvCam.updateMatrixWorld();
      }
    }
  }
  return {
    get active(){ return st.active; }, get view(){ return st.view; }, setView(v){ if(VIEWS.includes(v)){ st.view=v; boardKey=''; if(st.active){ dolly.quaternion.identity(); applyView(); } } }, get selfLevel(){ return st.active&&st.trigger; },
    player,update,setBoard,setBig,enter,exit,dolly,_goggleRender:goggleRender,_fpvCam:fpvCam,_rt:rt
  };
}
