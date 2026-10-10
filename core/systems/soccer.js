/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   systems/soccer.js — FAI 無人機足球核心（ES Module）v1.0
   newdrone Phase 1｜移植自基本版 soccer-match.html（手感優先）
   ------------------------------------------------------------
   內容：FAI F9A-B 場地常數、場地/籠網/球門環建構、
         SoccerDrone（家族 C 物理：yaw-only＋重力/懸浮推力）、
         球體彈性碰撞、球門環碰撞、進球判定（僅 striker 得分）。
   [FIX bug#6] 阻尼 dt 化：基本版 vel*=0.87 是「每幀」（綁定 60fps，
   高刷新率手感不同）。此處換算為每秒存速比 0.87^60，
   以 Math.pow(K,dt) 施加——60Hz 下手感與基本版完全一致。
   座標慣例（沿基本版）：Team A 出發於 -Z、攻 +Z 球門；
   yaw=0 時機頭朝 +Z（注意與 drone-styles 機頭 -Z 規範相反，
   關卡同步 mesh 時須 rotation.y = yaw + PI）。
   ============================================================ */
import * as THREE from 'three';
import { rollGroundEffect, dampInput, triggerAnomaly as _triggerAnomaly } from './anomaly.js';

/* ── FAI F9A-B 場地常數（公尺）── */
export const FIELD={
  FL:6, FW:3, FH:3,            // 場長/寬/高
  HL:3, HW:1.5,                // 半場
  GZ:2.0,                      // 球門環 Z（HL-1.0）
  GY:2.5,                      // 球門環中心高
  GI:0.20, GO:0.35,            // 內/外半徑
  GT:0.075, GR:0.275,          // 環管半徑/環主半徑
  BR:0.11,                     // 機體（bumper 球）半徑
  SET_DUR:180, N_SETS:3,       // 每節 180 秒、3 節制
};

/* ── 物理常數（基本版原值；速度倍率 SF 由關卡傳入）── */
export const SOCCER_PHYS={
  GRAVITY:-9.81, HOVER:9.81,
  THRMAX:14, PITCHMAX:8, YAWMAX:2.8,
  DRAG_PER_SEC:Math.pow(0.87,60),   // [FIX bug#6] 0.87/幀@60fps → dt 化
  WBOUNCE:0.35, FBOUNCE:0.18,
};

export const TA=0, TB=1;

/* 速度檔位（2026-08-03 新增，使用者回饋「碰撞真實感」C 項）：真實足球
   無人機比賽選手會切一檔（穩）／二檔（衝）——這裡只調水平推進力道
   （PITCHMAX 方向的 ax/az），不動垂直油門，貼近「檔位是前後左右衝刺力道」
   的真實印象。二檔能不能撞贏、撞了會不會失控，完全是「二檔本來速度就
   比較快」這件事在 resolveCollisions() 依 closingSpeed 分級判定時自然帶出來
   的結果，不需要在碰撞公式裡另外疊加檔位係數，兩處只要各自對，效果就對。 */
export const GEAR_MULT={1:0.55,2:1.0};   // 2026-09-30：一檔 0.7→0.55，兩檔差距拉大（使用者回報「G 檔感覺不出來」）

/* 機速手感（2026-09-30 新增，使用者回報：「競速無刷／專家只是變快，並沒有很難控制」）：
   原本四檔只把推力乘上 SF，足球物理阻力極大（每幀存速 0.87）→ 幾乎沒有慣性，
   推就走、放就停，速度再快也不難。真實無刷機難在「慣性（放桿還會滑）＋轉向靈敏＋
   （專家）沒有定高」。這裡每檔補上：
     drag  ＝每幀存速（越接近 1 慣性越大、放桿滑越遠）
     accel ＝水平推力再乘的係數（阻力變小後終端速度會暴增，用它壓回合理範圍）
     yaw   ＝轉向速率倍率
   由關卡把 SOCCER_FEEL[機速代碼] 傳給 step() 的第 5 個參數；不傳＝原本手感（AI 與 pvp 不受影響）。 */
export const SOCCER_FEEL={
  slow:  {drag:0.87, accel:1.0, yaw:0.85},
  std:   {drag:0.87, accel:1.0, yaw:1.0},
  race:  {drag:0.935,accel:0.6, yaw:1.3},   // 放桿滑行約為標準的 4～5 倍，終端速度比原本競速略快
  expert:{drag:0.935,accel:0.6, yaw:1.3},   // 同 race，另由 noHold 拿掉定高
};

/* 六席編制（基本版 DCFG）：[0]=玩家 A-striker */
export const SOCCER_SEATS=[
  {team:TA,role:'striker', tc:0x00eeff,sc:0xff44cc},
  {team:TA,role:'support', tc:0x2266ff,sc:0x2266ff},
  {team:TA,role:'defender',tc:0x2266ff,sc:0x2266ff},
  {team:TB,role:'striker', tc:0xff3322,sc:0x66aaff},
  {team:TB,role:'support', tc:0xff6633,sc:0xff6633},
  {team:TB,role:'defender',tc:0xff6633,sc:0xff6633},
];
const {HL,HW,BR}=FIELD;
/* 2026-07-23：出發位置改比照基本版 PVP/soccer-match-2p/4p/6p.html 的
   STARTS_2P/STARTS_6P 慣例（同隊三人在中場附近排開，X 間距 ±0.60，
   Z 只離中線 ~1.1~1.18），取代舊值（X 間距只有 ±0.264、Z 深入己方
   底線 ~2.78）。舊值只影響「單人版 AI 隊友/對手的視覺站位」時不明顯
   （單人版全程只會渲染玩家自己一顆鏡頭），但在 Phase 4 pvp.html 多人
   分割畫面情境下，三名隊友幾乎疊在一起、又緊貼自家底牆，會讓三格個人
   視角在開賽瞬間長得幾乎一樣——這正是使用者實機回饋「多視角看起來像
   同一個」的根本原因，經比對基本版三份 PVP 檔案的實際出發座標後修正。 */
export const SOCCER_STARTS=[
  new THREE.Vector3(0,BR+.02,-HL+1.82), new THREE.Vector3(-0.60,BR+.02,-HL+1.90),
  new THREE.Vector3(0.60,BR+.02,-HL+1.90), new THREE.Vector3(0,BR+.02,HL-1.82),
  new THREE.Vector3(-0.60,BR+.02,HL-1.90), new THREE.Vector3(0.60,BR+.02,HL-1.90),
];

/* ── 場地建構（地板/標線/籠網/球門環）── */
export function buildSoccerField(scene){
  const F=FIELD;
  scene.background=new THREE.Color(0x040810);
  scene.fog=new THREE.FogExp2(0x04080e,0.032);
  scene.add(new THREE.AmbientLight(0x0a1830,3.5));
  const dl=new THREE.DirectionalLight(0x4488aa,.8); dl.position.set(2,8,-2); scene.add(dl);
  const dl2=new THREE.DirectionalLight(0x223355,.35); dl2.position.set(-3,4,4); scene.add(dl2);
  const tl=new THREE.PointLight(0x0e2244,1.2,10); tl.position.set(0,F.FH+.5,0); scene.add(tl);
  const flr=new THREE.Mesh(new THREE.PlaneGeometry(F.FW,F.FL),
    new THREE.MeshStandardMaterial({color:0x08122a,roughness:.95,metalness:.05}));
  flr.rotation.x=-Math.PI/2; scene.add(flr);
  scene.add(new THREE.GridHelper(Math.max(F.FW,F.FL),12,0x0c1e3c,0x0c1e3c));
  const lm=(c,o=.65)=>new THREE.LineBasicMaterial({color:c,transparent:true,opacity:o});
  const line=(mat,p1,p2)=>scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1),new THREE.Vector3(...p2)]),mat));
  line(lm(0x22d3ee,.7),[-HW,.005,0],[HW,.005,0]);
  line(lm(0x3b82f6,.55),[-HW,.005,-HL],[HW,.005,-HL]);
  line(lm(0xef4444,.55),[-HW,.005,HL],[HW,.005,HL]);
  // 籠網（半透明面板＋邊框＋立柱）
  const netM=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:THREE.DoubleSide});
  const wM=new THREE.LineBasicMaterial({color:0x1a4060,transparent:true,opacity:.5});
  [{w:F.FW,h:F.FH,p:[0,F.FH/2,-HL],ry:0,col:0x001040,op:.18},
   {w:F.FW,h:F.FH,p:[0,F.FH/2, HL],ry:Math.PI,col:0x400010,op:.18},
   {w:F.FL,h:F.FH,p:[-HW,F.FH/2,0],ry:Math.PI/2,col:0x0a1e36,op:.12},
   {w:F.FL,h:F.FH,p:[ HW,F.FH/2,0],ry:-Math.PI/2,col:0x0a1e36,op:.12},
   {w:F.FW,h:F.FL,p:[0,F.FH,0],rx:-Math.PI/2,col:0x060f1e,op:.09},
  ].forEach(p=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.h,Math.ceil(p.w/.25),Math.ceil(p.h/.25)),netM(p.col,p.op));
    m.position.set(...p.p); if(p.rx)m.rotation.x=p.rx; if(p.ry)m.rotation.y=p.ry; scene.add(m);
    const el=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.w,p.h)),wM.clone());
    el.position.set(...p.p); if(p.rx)el.rotation.x=p.rx; if(p.ry)el.rotation.y=p.ry; scene.add(el);
  });
  const pilM=new THREE.MeshStandardMaterial({color:0x1a3050,metalness:.85,roughness:.2});
  const pilG=new THREE.CylinderGeometry(.022,.022,F.FH,6);
  [[-HW,-HL],[HW,-HL],[-HW,HL],[HW,HL]].forEach(([x,z])=>{
    const p=new THREE.Mesh(pilG,pilM); p.position.set(x,F.FH/2,z); scene.add(p);});
  // 球門環（直立於 XY 平面、開口朝 Z——基本版已驗證勿加 rotation.x）
  const goals=[];
  [{z:-F.GZ,col:0x2266ff,em:0x001155},{z:F.GZ,col:0xff2233,em:0x550011}].forEach(d=>{
    const torus=new THREE.Mesh(new THREE.TorusGeometry(F.GR,F.GT,20,64),
      new THREE.MeshStandardMaterial({color:d.col,emissive:d.em,emissiveIntensity:1.1,metalness:.4,roughness:.3}));
    // FAI F9A-B：環軸向厚度上限 10cm（徑向 15cm 由 D1/D2 幾何決定）
    // → 圓管 torus 沿 Z 壓扁 10/15（SC4 Vol F9 2026 對照，2026-07-20 查證）
    torus.scale.z=10/15;
    torus.position.set(0,F.GY,d.z); scene.add(torus);
    const gl=new THREE.PointLight(d.col,1.5,2.5); gl.position.set(0,F.GY,d.z); scene.add(gl);
    const wl=F.FH-F.GY;
    const wire=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,wl,4),
      new THREE.MeshBasicMaterial({color:0x334455}));
    wire.position.set(0,F.GY+wl/2,d.z); scene.add(wire);
    goals.push({mesh:torus,light:gl,z:d.z});
  });
  return goals;
}

/* ── SoccerDrone：家族 C 物理（沿基本版 physicsDrone，阻尼 dt 化）── */
export class SoccerDrone{
  constructor(i){
    const cfg=SOCCER_SEATS[i];
    this.i=i; this.team=cfg.team; this.role=cfg.role; this.isPlayer=i===0;
    this.cfg=cfg;
    this.pos=SOCCER_STARTS[i].clone();
    this.vel=new THREE.Vector3();
    this.yaw=cfg.team===TA?0:Math.PI;
    this.prevZ=this.pos.z;
    this.mustReturn=false;
    this.aiState='stage'; this.aiT=Math.random()*1.5;
    // 2026-08-03 新增：anomalyT／_geArmed／_frozenInput 見 systems/anomaly.js；
    // gear 是玩家自己切換的裝備設定，預設一檔（穩），reset() 不會把它重置掉（見下方）。
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null; this.gear=1;
  }
  reset(){
    this.pos.copy(SOCCER_STARTS[this.i]); this.vel.set(0,0,0);
    this.yaw=this.team===TA?0:Math.PI; this.prevZ=this.pos.z;
    this.mustReturn=false; this.aiState='stage'; this.aiT=Math.random()*1.5;
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;   // gear 是裝備設定，不隨每球重置
  }
  triggerAnomaly(dur){ _triggerAnomaly(this,dur); }
  /* 玩家輸入（統一語意合約：throttle+=升、yaw+=右轉、pitch+=前進、roll+=右移）
     基本版符號對照：螢幕(相機朝+Z)右=-X → roll 取負；yaw+=右轉=yaw 減小 → 取負
     D 項只套用在玩家 step()（AI 走 moveTo()→integrate() 直接控速度、沒有
     搖桿輸入可以打折，維持原樣）。 */
  /* noHold（2026-09-30 補上：關卡的「專家無定高」選項從移植以來一直有傳進來，
     但這裡從沒接收，所以專家＝競速無刷，完全沒差）：true 時拿掉定高輔助，
     油門 ≤0＝無推力往下掉，0..1 對應 0..(HOVER+THRMAX)——跟角度/Acro 模式同一套邏輯
     （老師 2026-09-30 決定維持「放開油門＝往下掉」）。懸停約需推住 41%。
     feel：見 SOCCER_FEEL；不傳＝原本手感。 */
  step(dt,ctl,SF=1,noHold=false,feel=null){
    const P=SOCCER_PHYS;
    rollGroundEffect(this,this.pos.y-FIELD.BR,this.vel.y);
    const inp=dampInput(this,ctl,dt);
    const GM=GEAR_MULT[this.gear]??1.0;
    const AM=feel?feel.accel:1, YM=feel?feel.yaw:1;
    this._dragPerSec=feel?Math.pow(feel.drag,60):null;
    const ay=noHold?Math.max(0,inp.throttle)*(P.HOVER+P.THRMAX):P.HOVER+inp.throttle*P.THRMAX*SF;
    this.integrate(dt, -inp.roll*P.PITCHMAX*SF*GM*AM, ay,
                       inp.pitch*P.PITCHMAX*SF*GM*AM, -inp.yaw*P.YAWMAX*YM);
  }
  /* 原始積分（AI moveTo 直接用；ax/az 依 yaw 轉世界系——沿基本版行為） */
  integrate(dt,ax,ay,az,yr){
    const P=SOCCER_PHYS, F=FIELD;
    this.prevZ=this.pos.z;
    this.yaw+=yr*dt;
    const sy=Math.sin(this.yaw), cy=Math.cos(this.yaw);
    this.vel.x+=(ax*cy+az*sy)*dt;
    this.vel.y+=(ay+P.GRAVITY)*dt;
    this.vel.z+=(ax*-sy+az*cy)*dt;
    this.vel.multiplyScalar(Math.pow(this._dragPerSec??P.DRAG_PER_SEC,dt));   // [FIX bug#6]；_dragPerSec＝玩家機速手感（AI 不設）
    this.pos.addScaledVector(this.vel,dt);
    // 地板/天花板/牆
    if(this.pos.y<F.BR){this.pos.y=F.BR;this.vel.y=Math.abs(this.vel.y)*P.FBOUNCE;}
    if(this.pos.y>F.FH-F.BR){this.pos.y=F.FH-F.BR;this.vel.y=-Math.abs(this.vel.y)*P.WBOUNCE;}
    if(this.pos.x<-HW+F.BR){this.pos.x=-HW+F.BR;this.vel.x= Math.abs(this.vel.x)*P.WBOUNCE;}
    if(this.pos.x> HW-F.BR){this.pos.x= HW-F.BR;this.vel.x=-Math.abs(this.vel.x)*P.WBOUNCE;}
    if(this.pos.z<-HL+F.BR){this.pos.z=-HL+F.BR;this.vel.z= Math.abs(this.vel.z)*P.WBOUNCE;}
    if(this.pos.z> HL-F.BR){this.pos.z= HL-F.BR;this.vel.z=-Math.abs(this.vel.z)*P.WBOUNCE;}
    this._ringBounce();
  }
  /* 球門環碰撞（沿基本版 goalRingBounce） */
  _ringBounce(){
    const F=FIELD;
    for(const gz of [-F.GZ,F.GZ]){
      const dx=this.pos.x, dy=this.pos.y-F.GY, dz=this.pos.z-gz;
      const r=Math.sqrt(dx*dx+dy*dy);
      const distTube=Math.sqrt((r-F.GR)*(r-F.GR)+dz*dz);
      if(distTube<F.GT+F.BR){
        const tx=r>0.001?dx/r*F.GR:F.GR, ty=r>0.001?dy/r*F.GR:0;
        const nx=dx-tx, ny=dy-ty, nz=dz;
        const nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
        if(nl>0.001){const f=4/nl;
          this.vel.x+=nx*f; this.vel.y+=ny*f; this.vel.z+=nz*f;}
      }
    }
  }
}

/* ── 機體互撞（2026-08-03 重寫，使用者回饋「碰撞真實感」B/A-2 項）──────
   原本永遠是對稱彈性碰撞（像撞球一樣，兩邊各分一半動量），使用者實測回饋
   「阻擋沒啥用」——真實無人機互撞高機率是雙方都受衝擊、低機率是被借力
   頂飛、更低機率是兩台一起意外送進球門。這裡依「相對衝擊速度」
   （closingSpeed＝兩機相對速度沿碰撞法線方向的分量）分三段機率決定結果：
     simple（簡單碰撞）：原本的對稱彈開，維持原手感，多數情況會是這個。
     stun（撞球定桿換位）：沿法線方向衝得較猛的一方幾乎停下，另一方帶著
       大半動量、往一個隨機偏轉角度飛出（模擬「借力」但方向不受控）。
     blowup（雙機捲入進網）：只有碰撞點靠近球門（|z|超過門前 70% 位置）
       才可能發生，兩機動量一起被甩向該側球門——防守方弄巧成拙送分。
   速度檔位（C 項）不在這裡另外加係數：二檔本來速度上限就比較高，
   會自然撞出更高的 closingSpeed、落在中/高速機率區間，兩邊各自對即可。
   ============================================================ */
const _diff=new THREE.Vector3(), _relVel=new THREE.Vector3(), _deflect=new THREE.Vector3();
const GOAL_MOUTH_FRAC=0.7;   // |pos.z| 超過 FIELD.GZ 的這個比例才算「靠近球門」

/* 依 closingSpeed（m/s）＋是否靠近球門，回傳 'simple'|'stun'|'blowup'。
   數值來自 2026-08-03 使用者確認的三段機率表。 */
function _rollCollisionTier(closing,nearGoal){
  let pStun,pBlow;
  if(closing<1.5){pStun=0.05;pBlow=0;}
  else if(closing<3.5){pStun=0.25;pBlow=nearGoal?0.05:0;}
  else {pStun=0.40;pBlow=nearGoal?0.15:0;}
  if(!nearGoal){                 // 不靠近球門時，雙機捲入的機率併回定桿換位
    pStun += closing<1.5?0:closing<3.5?0.05:0.15;
  }
  const r=Math.random();
  if(pBlow>0&&r<pBlow)return 'blowup';
  if(r<pBlow+pStun)return 'stun';
  return 'simple';
}
function _maybeAnomaly(d,tMin,tMax,prob){
  if(Math.random()<prob) _triggerAnomaly(d,tMin+Math.random()*(tMax-tMin));
}
export function resolveCollisions(drones){
  for(let i=0;i<drones.length;i++)for(let j=i+1;j<drones.length;j++){
    const a=drones[i], b=drones[j];
    _diff.copy(a.pos).sub(b.pos);
    const d2=_diff.lengthSq(), md=BR*2;
    if(d2<md*md&&d2>1e-4){
      const dist=Math.sqrt(d2), n=_diff.divideScalar(dist);
      _relVel.copy(a.vel).sub(b.vel);
      const closing=Math.abs(_relVel.dot(n));
      const nearGoal=Math.abs(a.pos.z)>FIELD.GZ*GOAL_MOUTH_FRAC||Math.abs(b.pos.z)>FIELD.GZ*GOAL_MOUTH_FRAC;
      const tier=_rollCollisionTier(closing,nearGoal);
      if(tier==='stun'){
        // 沿法線方向速度分量較大者＝主動撞上去的一方，幾乎停下；
        // 另一方帶大半動量、疊加隨機 ±0.6rad（≈±34°）水平偏轉飛出。
        const mover=_relVel.dot(n)>0?a:b, other=mover===a?b:a;
        // n＝從 b 指向 a；other 要往「mover→other」方向飛出——mover=a 時方向是
        // a→b＝-n，mover=b 時方向是 b→a＝+n（Y 軸旋轉是線性變換，先轉 n 再乘
        // sign，跟先乘 sign 再轉，結果相同，這裡選前者純粹省一行）。
        const sign=mover===a?-1:1;
        const ang=(Math.random()*2-1)*0.6;
        const cs=Math.cos(ang), sn=Math.sin(ang);
        _deflect.set(n.x*cs-n.z*sn,0,n.x*sn+n.z*cs).multiplyScalar(sign);
        const launchSpeed=closing*0.85;
        mover.vel.multiplyScalar(0.15);
        other.vel.copy(_deflect).multiplyScalar(launchSpeed);
        _maybeAnomaly(mover,0.3,0.6,0.30);
        _maybeAnomaly(other,0.5,1.0,0.60);
      }else if(tier==='blowup'){
        // 兩機一起被甩向較靠近的那側球門（哪個球門近就往哪個門送）。
        const targZ=(Math.abs(a.pos.z-FIELD.GZ)<Math.abs(a.pos.z+FIELD.GZ))?FIELD.GZ:-FIELD.GZ;
        const dz=targZ>0?1:-1, launchSpeed=closing*0.9;
        a.vel.set(0,a.vel.y*0.4,dz*launchSpeed);
        b.vel.set(0,b.vel.y*0.4,dz*launchSpeed);
        _maybeAnomaly(a,0.8,1.2,1.0);
        _maybeAnomaly(b,0.8,1.2,1.0);
      }else{
        // simple：原本的對稱彈性碰撞，完全維持原手感。
        const imp=_relVel.dot(n)*.65;
        if(imp<0){a.vel.addScaledVector(n,-imp*.5); b.vel.addScaledVector(n,imp*.5);}
      }
      const ov=(md-dist)*.52;
      a.pos.addScaledVector(n,ov); b.pos.addScaledVector(n,-ov);
    }
  }
}

/* ── 進球判定（FAI：僅 striker、mustReturn 中不得分）→ 'A'|'B'|null ──
   判定半徑兩檔（skill「判定寬鬆優先」＋FAI 正式規則對照）：
   - 練習（寬鬆，預設）：球心進內徑 GI=0.20 即得分——降低學生挫折感
   - 正式（strict）：FAI 規定「整顆球完全穿過」＝球心距環軸 < GI−BR=0.09
     （SC4 Vol F9 2026：goal when "entire drone ball has passed through"）
   辦正式比賽請開 strict（關卡 intro 可切換）。 */
export function checkGoal(d,{strict=false}={}){
  const F=FIELD;
  if(d.role!=='striker'||d.mustReturn)return null;
  const targZ=d.team===TA?F.GZ:-F.GZ;
  const dir=d.team===TA?1:-1;
  if(!((d.prevZ-targZ)*dir<0&&(d.pos.z-targZ)*dir>=0))return null;
  const dx=d.pos.x, dy=d.pos.y-F.GY;
  const r=strict?F.GI-F.BR:F.GI;
  return Math.sqrt(dx*dx+dy*dy)<=r ? (d.team===TA?'A':'B') : null;
}
