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
import { getHand, handName } from './hand.js';
import { vrTutSeen, showVrTutorial } from './tutorial.js';   // 2026-10-12 進 VR 前先播平面教學

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
  /* 10/12 修正（老師回報：賽道進 VR 全黑，按頭盔選單鍵跳出來反而看得到）：VR 進行中，畫面要畫在「頭盔的畫面緩衝區」，
     原本畫完機上鏡頭後用 setRenderTarget(null) 切回去，在 VR 裡等於切到「網頁的畫布」→ 頭盔裡什麼都沒有。
     改成記住原本的目標、畫完再切回同一個。 */
  function goggleRender(r,scene,cam0){
    const prev=r.getRenderTarget();
    goggle.visible=false; const was=r.xr.enabled; r.xr.enabled=false;
    r.setRenderTarget(rt); r.render(scene,fpvCam);
    r.xr.enabled=was; r.setRenderTarget(prev); goggle.visible=true; r.render(scene,cam0);
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
  /* 2026-10-12 VR 裡的 3D 教學看板（老師定案）：眼前一塊大看板，兩支搖桿的點會照「高度→轉向→前後→左右」輪流動給你看，
     右邊列出這關的按鍵（opt.guide.keys）。賽道：起點等待時顯示，倒數開始收起；自由飛行：進 VR 時顯示，
     開始推搖桿飛一陣子或 15 秒後自動收起，Y 可以再叫出來。 */
  const gcv=document.createElement('canvas'); gcv.width=1024; gcv.height=560;
  const gtex=new THREE.CanvasTexture(gcv); gtex.colorSpace=THREE.SRGBColorSpace;
  const guide=new THREE.Mesh(new THREE.PlaneGeometry(1.1,0.6),new THREE.MeshBasicMaterial({map:gtex,transparent:true,depthTest:false,fog:false}));
  guide.renderOrder=998; guide.position.set(0,opt.menu?0.5:0.16,opt.menu?-1.9:-1.6); guide.visible=false;   // 有 VR 選單時看板往上挪，不跟選單疊在一起
  let gT=0, gDraw=0, gMove=0;
  function drawGuide(t){
    const g=gcv.getContext('2d'), J=getHand()==='1';
    g.clearRect(0,0,1024,560);
    g.fillStyle='rgba(6,16,28,.9)'; g.strokeStyle='#00eeff'; g.lineWidth=5;
    g.beginPath(); g.roundRect?g.roundRect(6,6,1012,548,28):g.rect(6,6,1012,548); g.fill(); g.stroke();
    g.textBaseline='middle'; g.textAlign='left';
    g.fillStyle='#facc15'; g.font='bold 40px "Microsoft JhengHei",sans-serif'; g.fillText(`🥽 VR 手把怎麼飛（${handName()}）`,36,52);
    const M=[{k:'thr',st:J?'R':'L',ax:'y',t:`${J?'右':'左'}搖桿 上下＝升高／降低`},{k:'yaw',st:'L',ax:'x',t:'左搖桿 左右＝原地轉向'},
             {k:'pit',st:J?'L':'R',ax:'y',t:`${J?'左':'右'}搖桿 上下＝往前／往後`},{k:'rol',st:'R',ax:'x',t:'右搖桿 左右＝往左／往右飛'}];
    const i=Math.floor(t/2.6)%4, m=M[i], w=Math.sin((t%2.6)/2.6*Math.PI*2)*0.85;
    for(const [side,cx] of [['L',150],['R',390]]){
      const on=m.st===side, dx=on&&m.ax==='x'?w*48:0, dy=on&&m.ax==='y'?-w*48:0;
      g.strokeStyle=on?'#00eeff':'#2a4a63'; g.lineWidth=6; g.beginPath(); g.arc(cx,250,78,0,Math.PI*2); g.stroke();
      g.fillStyle=on?'#00eeff':'#2a3f55'; g.beginPath(); g.arc(cx+dx,250+dy,30,0,Math.PI*2); g.fill();
      g.fillStyle='#9fc3d8'; g.font='28px "Microsoft JhengHei",sans-serif'; g.textAlign='center'; g.fillText(side==='L'?'左手':'右手',cx,360);
    }
    g.textAlign='left'; g.fillStyle='#ffffff'; g.font='bold 34px "Microsoft JhengHei",sans-serif'; g.fillText(`${'①②③④'[i]} ${m.t}`,40,430);
    g.fillStyle='#7aa3b8'; g.font='26px "Microsoft JhengHei",sans-serif'; g.fillText('慢慢推、小小修正，比用力推更穩',40,478);
    const keys=(opt.guide&&opt.guide.keys)||[];
    g.fillStyle='#cfefff'; g.font='30px "Microsoft JhengHei",sans-serif';
    keys.slice(0,7).forEach((k,j)=>g.fillText(k,560,130+j*52,440));
    if(opt.guide&&opt.guide.foot){ g.fillStyle='#4ade80'; g.font='bold 32px "Microsoft JhengHei",sans-serif'; g.fillText(opt.guide.foot,560,505,440); }
    gtex.needsUpdate=true;
  }
  function showGuide(on){ guide.visible=!!on&&!!opt.guide; if(guide.visible){ gT=0; gMove=0; gDraw=0; drawGuide(0); } }

  /* 2026-10-12 VR 選單（老師：進 VR 會先黑一陣子，學生亂按遊戲就開始了 → 選單也要有 VR 版）
     opt.menu()＝回傳選項清單 [{label:()=>'文字', act:()=>{}, left:()=>{}, right:()=>{}}]（有 left/right 的是可切換的設定）。
     搖桿上下＝選、左右＝換設定、A／扳機＝確定。選單開著時飛機不會動、其他按鍵不作用。
     另外：畫面真的出來、而且手把按鍵都放開過、再等 1 秒，才開始接受按鍵（黑畫面期間亂按都不算）。 */
  const mcv=document.createElement('canvas'); mcv.width=768; mcv.height=560;
  const mtex=new THREE.CanvasTexture(mcv); mtex.colorSpace=THREE.SRGBColorSpace;
  const menuMesh=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.525),new THREE.MeshBasicMaterial({map:mtex,transparent:true,depthTest:false,fog:false}));
  menuMesh.renderOrder=1001; menuMesh.position.set(0,-0.16,-1.3); menuMesh.visible=false;
  const M={open:false,i:0,items:[],key:'',navT:0,armed:false,armT:0,seenRelease:false,title:''};
  function drawMenu(){
    const key=M.i+'|'+M.armed+'|'+M.title+'|'+M.items.map(x=>x.label()).join('|'); if(key===M.key)return; M.key=key;
    const g=mcv.getContext('2d'); g.clearRect(0,0,768,560);
    g.fillStyle='rgba(6,16,28,.94)'; g.strokeStyle='#00eeff'; g.lineWidth=5;
    g.beginPath(); g.roundRect?g.roundRect(6,6,756,548,26):g.rect(6,6,756,548); g.fill(); g.stroke();
    g.textBaseline='middle'; g.textAlign='center'; g.fillStyle='#facc15'; g.font='bold 40px "Microsoft JhengHei",sans-serif';
    g.fillText(M.title||'🥽 VR 選單',384,52);
    M.items.forEach((it,j)=>{ const y=118+j*72, on=j===M.i;
      g.fillStyle=on?'#00eeff':'rgba(14,34,56,.95)'; g.beginPath(); g.roundRect?g.roundRect(40,y-30,688,60,30):g.rect(40,y-30,688,60); g.fill();
      g.fillStyle=on?'#04202c':'#cfefff'; g.font=(on?'bold ':'')+'32px "Microsoft JhengHei",sans-serif';
      g.fillText((it.left?'◀  ':'')+it.label()+(it.left?'  ▶':''),384,y+2,660); });
    g.fillStyle=M.armed?'#7aa3b8':'#fbbf24'; g.font='26px "Microsoft JhengHei",sans-serif';
    g.fillText(M.armed?'搖桿上下＝選　左右＝換　A／扳機＝確定':'畫面準備中…請先放開所有按鍵',384,528);
    mtex.needsUpdate=true;
  }
  function openMenu(title){ if(!opt.menu)return; M.items=opt.menu(); M.title=title||''; M.i=0; M.open=true; M.key=''; menuMesh.visible=true; drawMenu(); }
  function closeMenu(){ M.open=false; menuMesh.visible=false; }
  function menuStep(S,dt,trigEdge,aEdge){
    if(!M.open)return;
    M.items=opt.menu(); if(M.i>=M.items.length)M.i=M.items.length-1;
    const y=Math.abs(S.ly)>Math.abs(S.ry)?S.ly:S.ry, x=Math.abs(S.lx)>Math.abs(S.rx)?S.lx:S.rx;
    M.navT=Math.max(0,M.navT-dt);
    if(M.armed&&M.navT===0){
      if(y>0.6){ M.i=(M.i+1)%M.items.length; M.navT=0.28; }
      else if(y<-0.6){ M.i=(M.i-1+M.items.length)%M.items.length; M.navT=0.28; }
      else if(x>0.6&&M.items[M.i].right){ M.items[M.i].right(); M.navT=0.3; }
      else if(x<-0.6&&M.items[M.i].left){ M.items[M.i].left(); M.navT=0.3; }
    }
    if(M.armed&&(trigEdge||aEdge)){ const it=M.items[M.i]; if(it.act)it.act(); else if(it.right)it.right(); }
    if(M.open)drawMenu();
  }

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
  btn.onclick=()=>tryEnter();
  /* 2026-10-12 縮短進 VR 後的黑畫面：頁面載入後先把材質編譯好、FPV 眼鏡的貼圖先畫一次（第一次進 VR 才不用現場編譯） */
  setTimeout(()=>{ try{ R.compile(scene,cam); if(VIEWS.includes('goggle')){ R.setRenderTarget(rt); R.render(scene,fpvCam); R.setRenderTarget(null); } }catch{} },1500);
  /* 2026-10-12：第一次進 VR 先播平面教學（這位飛手這次開瀏覽器播一次）；教學看完要再點一次才進得去時給提示 */
  function tryEnter(){
    if(st.active||entering)return;
    if(opt.tutorial!==false&&!vrTutSeen()){ showVrTutorial(g=>{ if(g)enter(); else warn('教學看完了！請再按一次「🥽 進入 VR」戴上頭盔。'); },{keys:opt.tutKeys}); return; }
    enter();
  }

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
    try{ R.xr.setFramebufferScaleFactor(opt.scale||0.9); }catch{}   // 解析度略降一點：第一幀快、也比較順
    try{ R.xr.setFoveation&&R.xr.setFoveation(1); }catch{}
    await R.xr.setSession(s);
    st.session=s; st.active=true; st.camParent=cam.parent;
    st.camPose={p:cam.position.clone(),q:cam.quaternion.clone()};
    scene.add(dolly); dolly.add(cam); cam.position.set(0,0,0); cam.quaternion.identity(); cam.add(board); cam.add(big); cam.add(guide); cam.add(menuMesh); board.visible=true; showGuide(!!opt.guide);
    M.armed=false; M.armT=0; M.seenRelease=false; st.btnPrev={}; st.trigPrev=false;
    dolly.position.copy(stand); dolly.rotation.set(0,0,0); st.view=opt.view||VIEWS[0]; boardKey='';
    if(!goggle.parent)dolly.add(goggle); applyView();
    s.addEventListener('end',onEnd);
    opt.onStart&&opt.onStart();
  }
  function onEnd(){
    st.active=false; st.session=null; engine.setRenderFn(null); goggle.visible=false; dolly.quaternion.identity();
    cam.remove(board); cam.remove(big); cam.remove(guide); cam.remove(menuMesh); guide.visible=false; closeMenu(); dolly.remove(cam); if(st.camParent)st.camParent.add(cam); scene.remove(dolly);
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
    const any=now.A||now.B||now.X||now.Y||st.trigger;
    if(!M.seenRelease&&!any)M.seenRelease=true;
    const edge={}; for(const k of ['A','B','X','Y']){ edge[k]=now[k]&&!st.btnPrev[k]; st.btnPrev[k]=!!now[k]; }
    const tEdge=st.trigger&&!st.trigPrev; st.trigPrev=st.trigger;
    st._edge={edge,tEdge};
    if(!M.armed){ if(edge.X)exit(); return; }          // 還沒準備好：只有 X（離開）有用
    if(M.open){ if(edge.X)exit(); return; }            // 選單開著：交給選單
    for(const k of ['A','B','X','Y'])if(edge[k])press(k);
  }
  function press(k){
    if(k==='B'){ st.view=VIEWS[(VIEWS.indexOf(st.view)+1)%VIEWS.length]; boardKey=''; dolly.quaternion.identity(); applyView(); }
    if(k==='X'){ exit(); return; }
    if(k==='Y'&&opt.boardToggle){ board.visible=!board.visible; return; }   // 賽道：Y＝收起／打開看板
    if(k==='Y'&&opt.guide&&!opt.boardToggle){ showGuide(!guide.visible); return; }   // 自由飛行：Y＝叫出／收起教學看板
    opt.onButton&&opt.onButton(k);
  }
  /* 換成 VR 手把的搖桿值，其他欄位（檔位、按鍵函式）沿用原本的 player 物件 */
  function player(base){
    const S=st.sticks;
    if(M.open||!M.armed)return {...base,device:'xr',throttle:0,yaw:0,pitch:0,roll:0};   // 選單開著／還沒準備好：飛機不動
    if(getHand()==='1')return {...base,device:'xr',throttle:-S.ry,yaw:S.lx,pitch:-S.ly,roll:S.rx};   // 2026-10-10 日本手：左桿上下＝前後、右桿上下＝油門
    return {...base,device:'xr',throttle:-S.ly,yaw:S.lx,pitch:-S.ry,roll:S.rx};
  }
  /* 每幀：讀手把、跟機視角時把站位移到無人機後方 */
  function update(dt,drone){
    if(!st.active)return; poll();
    if(!M.armed){ if(dt>0)M.armT+=dt; if(M.armT>1.0&&M.seenRelease){ M.armed=true; M.key=''; } }   // 有畫面（迴圈在跑）＋放開過按鍵＋1 秒
    if(M.open){ const e=st._edge||{edge:{}}; menuStep(st.sticks,dt,e.tEdge,e.edge&&e.edge.A); }
    if(guide.visible){ gT+=dt; gDraw+=dt; if(gDraw>1/15){ gDraw=0; drawGuide(gT); }
      if(opt.guide&&opt.guide.autoHide){ const S=st.sticks, mv=Math.max(Math.abs(S.lx),Math.abs(S.ly),Math.abs(S.rx),Math.abs(S.ry))>0.4;
        gMove=mv?gMove+dt:Math.max(0,gMove-dt*0.5);
        if(gT>opt.guide.autoHide||(gT>2&&gMove>2.5))guide.visible=false; } }
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
    get active(){ return st.active; }, get menuOpen(){ return M.open; }, get armed(){ return M.armed; }, openMenu, closeMenu, get view(){ return st.view; }, setView(v){ if(VIEWS.includes(v)){ st.view=v; boardKey=''; if(st.active){ dolly.quaternion.identity(); applyView(); } } }, get selfLevel(){ return st.active&&st.trigger&&M.armed&&!M.open; },
    _sim:{arm(){ M.armed=true; M.seenRelease=true; }, open:openMenu, step(S,trig,a){ menuStep({lx:0,ly:0,rx:0,ry:0,...S},0.5,trig,a); }, get M(){ return M; }},
    player,update,setBoard,setBig,showGuide,get guideOn(){ return guide.visible; },enter,tryEnter,exit,dolly,_goggleRender:goggleRender,_fpvCam:fpvCam,_rt:rt
  };
}
