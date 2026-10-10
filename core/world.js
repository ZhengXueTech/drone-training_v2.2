/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   world.js — 場地建構器（ES Module）
   newdrone Phase 0：基礎訓練場（地面網格＋邊界＋光照＋穿環）
   dispose-safe：所有物件掛在單一 root Group，卸載由 engine.disposeScene 處理
   ============================================================ */
import * as THREE from 'three';

export function buildBasicField(scene,{size=15,sky=0x0c1a2e,skipCompassMark=false}={}){
  scene.background=new THREE.Color(sky);
  scene.fog=new THREE.Fog(sky,40,120);
  const root=new THREE.Group(); root.name='field';
  // 光照（r184 物理光照：強度重調過，勿沿用 r128 數值）
  root.add(new THREE.HemisphereLight(0x8fb4d8,0x1a2e1a,0.9));
  const sun=new THREE.DirectionalLight(0xfff2dd,2.2);
  sun.position.set(18,30,12);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-25; sun.shadow.camera.right=25;
  sun.shadow.camera.top=25; sun.shadow.camera.bottom=-25;
  root.add(sun);
  // 地面
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(size*2.4,size*2.4),
    new THREE.MeshStandardMaterial({color:0x1c3a24,roughness:0.95}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; root.add(ground);
  const grid=new THREE.GridHelper(size*2,size*2,0x2c6e49,0x1f4d33);
  grid.position.y=0.01; root.add(grid);
  // 邊界柱＋圍線（視覺提示物理邊界）
  const postG=new THREE.CylinderGeometry(0.05,0.05,3,6);
  const postM=new THREE.MeshStandardMaterial({color:0x00aacc,emissive:0x004455,emissiveIntensity:0.6});
  const fenceM=new THREE.LineBasicMaterial({color:0x00ccee,transparent:true,opacity:0.35});
  const pts=[];
  [[-size,-size],[size,-size],[size,size],[-size,size]].forEach(([x,z])=>{
    const p=new THREE.Mesh(postG,postM); p.position.set(x,1.5,z); root.add(p);
    pts.push(new THREE.Vector3(x,2.6,z));
  });
  pts.push(pts[0].clone());
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),fenceM));
  // 北方標記（2026-07-23 修正：原本放在 -Z 邊，跟 hud.js 小地圖 toMX/toMZ
  // 的座標轉換對不起來（+Z 才是小地圖畫布 y=0／"N" 那端，見 drawMinimap()
  // 的機頭指示線修正註解）——這顆錐體其實一直畫在南邊，不是北邊。
  // skipCompassMark：關卡想改用下面 makeCompassLandmarks() 畫完整四方位時，
  // 傳 true 跳過這顆單一北方錐體，避免跟新的北方地標重複。
  if(!skipCompassMark){
    const nMark=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.2,4),
      new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x664400,emissiveIntensity:0.5}));
    nMark.position.set(0,0.6,size+1.2); root.add(nMark);
  }
  scene.add(root);
  return root;
}

/* 四方位地標（Phase 5，2026-07-23 使用者回饋：學生分不清小地圖「北朝上」
   跟跟機鏡頭實際朝向南的關係，希望場地放實體地標＋小地圖同步顯示，
   不用先懂羅盤概念就能對照方向）。
   四個方向用不同顏色＋不同形狀（不只顏色，色弱學生也分得出來）：
     北＝金色圓錐、南＝紅色方塊、東＝藍色球體、西＝紫色菱形（八面體，
     刻意避開跟小地圖既有機頭指示線同色的綠色 #4ade80，避免混淆）。
   世界座標慣例（已在 hud.js/wind.js 反覆驗證過）：+Z=北、-Z=南、
   +X=西、-X=東。回傳的陣列可以直接餵給 hud.js drawMinimap() 新增的
   opts.landmarks，讓小地圖同步畫出對應顏色/形狀的小圖示。 */
export function makeCompassLandmarks(scene,{size=15,y=0.6}={}){
  const D=size+1.2;
  const defs=[
    {dir:'北',pos:new THREE.Vector3(0,0,D), color:0xffcc00, shape:'triangle',
      geo:()=>new THREE.ConeGeometry(0.5,1.2,4)},
    {dir:'南',pos:new THREE.Vector3(0,0,-D), color:0xff5566, shape:'square',
      geo:()=>new THREE.BoxGeometry(0.85,1.1,0.85)},
    {dir:'東',pos:new THREE.Vector3(-D,0,0), color:0x38bdf8, shape:'circle',
      geo:()=>new THREE.SphereGeometry(0.6,14,10)},
    {dir:'西',pos:new THREE.Vector3(D,0,0), color:0xc084fc, shape:'diamond',
      geo:()=>new THREE.OctahedronGeometry(0.65)},
  ];
  for(const d of defs){
    const mesh=new THREE.Mesh(d.geo(),
      new THREE.MeshStandardMaterial({color:d.color,emissive:d.color,emissiveIntensity:0.45}));
    mesh.position.copy(d.pos); mesh.position.y=y;
    scene.add(mesh);
  }
  return defs.map(d=>({dir:d.dir,pos:d.pos.clone(),color:d.color,shape:d.shape}));
}

/* 穿環（scoring.checkRingPass 配套；半透明加成色——3D 導航物件透明原則 v1.9） */
export function makeRing(pos,{radius=1.6,color=0x00ffcc}={}){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,0.08,8,32),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.75,blending:THREE.AdditiveBlending}));
  g.add(ring);
  const glow=new THREE.Mesh(new THREE.TorusGeometry(radius,0.2,8,32),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.15,blending:THREE.AdditiveBlending}));
  g.add(glow);
  g.position.copy(pos);
  g.userData.radius=radius; g.userData.passed=false;
  return g;
}

/* 信標光柱（半透明 additive，不擋視線） */
export function makeBeacon(pos,{color=0xff8800,height=10}={}){
  const g=new THREE.Group();
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.4,height,8,1,true),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  pillar.position.y=height/2; g.add(pillar);
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8),
    new THREE.MeshBasicMaterial({color}));
  core.position.y=0.4; g.add(core);
  g.position.copy(pos);
  return g;
}

/* ── 機頭方向指示（v1.1 新增——「機體遠看不清朝向」對策）──
   懸浮於機體上方的高對比發光箭頭，指向機頭 -Z；additive 不擋視線。
   關卡把它 add 為機體 mesh 的 child（y 上移），每幀依相機距離放大：
     beacon.scale.setScalar(THREE.MathUtils.clamp(dist/12,1,2.8))
   暫停選單可開關（nd.settings.headingBeacon）。 */
export function makeHeadingBeacon({color=0xfacc15,y=0.75}={}){
  const g=new THREE.Group();
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,
    blending:THREE.AdditiveBlending,depthTest:false});
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.45,4),mat);
  cone.rotation.x=-Math.PI/2;           // 尖端朝 -Z（機頭規範）
  cone.position.z=-0.28; g.add(cone);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.03,0.5),mat);
  tail.position.z=0.12; g.add(tail);
  // 白色描邊錐（稍大、低透明）——深色與亮色場地都看得見
  const outline=new THREE.Mesh(new THREE.ConeGeometry(0.21,0.55,4),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.35,
      blending:THREE.AdditiveBlending,depthTest:false}));
  outline.rotation.x=-Math.PI/2; outline.position.z=-0.28; g.add(outline);
  g.position.y=y;
  g.renderOrder=9;                       // depthTest:false＋高 renderOrder＝永不被場景遮住
  return g;
}
