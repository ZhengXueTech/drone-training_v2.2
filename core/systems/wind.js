/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   systems/wind.js — 風場系統（ES Module）v1.1
   newdrone Phase 1：定向風＋陣風正弦擾動；HUD 箭頭公式沿用
   CLAUDE.md 已驗證規則（箭頭=被吹方向、文字=來源方位）。
   v1.1：新增 setScripted()——關卡逐幀指定風向量（t06 劇本化風場：
         風向緩慢擺動、風力隨時間漸強），HUD 公式不變。
   ============================================================ */
import * as THREE from 'three';

export const DIR_NAMES=['東','東南','南','西南','西','西北','北','東北'];

const _p0=new THREE.Vector3(), _p1=new THREE.Vector3(), _dir=new THREE.Vector3();
const _camQInv=new THREE.Quaternion();

export class WindSystem{
  constructor({strength=0,angleDeg=0}={}){
    this.base=strength;              // m/s²（作用於速度的加速度近似）
    this.angle=angleDeg*Math.PI/180; // 世界角度：0=+X（東風向西吹）
    this.t=0;
    this.vec=new THREE.Vector3();
    this.enabled=strength>0;
    this._scripted=false;            // true=關卡逐幀餵向量，update 不覆寫
  }
  randomize(strength){
    this.base=strength; this.enabled=strength>0;
    this._scripted=false;
    this.angle=Math.random()*Math.PI*2;
  }
  /* 劇本化風場：關卡每幀直接指定風向量（世界座標 x/z 與強度）。
     呼叫後 update() 不再自算 gust——擾動由關卡劇本自行決定。 */
  setScripted(dirX,dirZ,strength){
    this._scripted=true; this.enabled=strength>0.001;
    const len=Math.hypot(dirX,dirZ)||1;
    this.vec.set(dirX/len*strength,0,dirZ/len*strength);
  }
  update(dt){
    if(this._scripted)return;                    // 劇本模式：向量由 setScripted 決定
    if(!this.enabled){this.vec.set(0,0,0);return;}
    this.t+=dt;
    const gust=1+0.35*Math.sin(this.t*0.7)+0.15*Math.sin(this.t*2.3);
    this.vec.set(Math.cos(this.angle),0,Math.sin(this.angle)).multiplyScalar(this.base*gust);
  }
  /* HUD 資料（已驗證公式：兩軸取負；srcAngle 轉方位名——文字方位是絕對座標系，
     「東風／北風」本來就是地理名詞，這部分維持世界座標系不變）。
     ⚠️ arrowDeg 是「絕對世界座標角」，只適合畫在像小地圖那種固定 N 朝上、
     不隨鏡頭轉動的介面上——HUD 風向箭頭疊在跟機/FPV/飛手鏡頭畫面上時，
     請改用 screenArrowDeg()（見下）算出「這個鏡頭當下」的螢幕方向，
     否則鏡頭朝向跟世界座標不一致時，箭頭指的方向會跟玩家實際看到的
     飄移方向相反（2026-07-23 使用者實機回饋：標示東風，球卻往螢幕另一
     側飄——根因是跟機鏡頭預設朝南，螢幕左右跟絕對世界座標系是相反的）。 */
  hudInfo(){
    if(!this.enabled)return null;
    const ang=Math.atan2(-this.vec.z,-this.vec.x)*180/Math.PI;
    const srcAngle=((ang+180)%360+360)%360;
    return { arrowDeg:ang,
      label:DIR_NAMES[Math.round(srcAngle/45)%8]+'風',
      speed:this.vec.length() };
  }
  /* 螢幕相對風向箭頭角度（Phase 5 修正，2026-07-23 二次修正）：
     第一版曾經用「投影兩個世界座標點、取螢幕座標差」（project()+atan2）
     的做法，跟 hud.js `_updateOffTarget()` 同招——但使用者實機回饋抓到
     這招在「風向剛好跟鏡頭視線方向接近平行」時（例如跟機鏡頭預設朝南、
     風也剛好吹向南）會嚴重失準：兩個投影點幾乎重疊在畫面同一點，
     screen-space 的微小差值被透視除法放大成幾乎任意的雜訊角度，箭頭
     看起來會亂轉、跟實際飄移方向對不起來。
     二次修正改成不透過透視投影，直接把風向量轉到「鏡頭本地座標系」
     （camera.quaternion 的反向旋轉），本地座標系的 x=螢幕右、y=螢幕上、
     z=鏡頭前後（景深，跟左右/上下無關，直接忽略）——只取 x,y 這兩個
     跟畫面平面平行的分量算 atan2，數值穩定、不會有透視除以極小值的問題，
     風正好吹向/背向鏡頭時 x,y 分量本來就趨近 0，箭頭自然趨近某個穩定值
     （代表「這個方向在畫面上幾乎沒有明顯左右/上下分量，主要是往鏡頭
     前後推」），不會亂跳。
     不管鏡頭是跟機/FPV/飛手站位、不管機頭朝向為何都成立，因為直接用
     camera.quaternion 當下的實際朝向去轉換，不假設任何固定關係。
     camera 缺省或風力接近 0 時回傳 null（呼叫端應該退回 hudInfo().arrowDeg
     或直接隱藏箭頭）。dronePos 參數保留只是維持既有呼叫端簽名不必再改，
     這個算法本身只需要方向、不需要位置。 */
  screenArrowDeg(dronePos,camera){
    if(!this.enabled||!camera||this.vec.lengthSq()<1e-6)return null;
    _dir.copy(this.vec).normalize();
    _camQInv.copy(camera.quaternion).invert();
    _dir.applyQuaternion(_camQInv);
    return -Math.atan2(_dir.y,_dir.x)*180/Math.PI;
  }
}
