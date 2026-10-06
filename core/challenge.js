/* ============================================================
   challenge.js — 挑戰條件系統（2026-10-01 新增，規劃書 v2.0 §3.9）
   ------------------------------------------------------------
   學生在每關開始畫面自己選「⚙ 挑戰條件」：
     定高輔助（開／關）、環境風（無／微風／強風）、檔位（一檔／二檔）
   預設＝標準（定高開、無風、一檔）＝改動前的手感，已驗收關卡零回歸。
   成績自動標示條件（progress.record 的 challenge / challengeCode 欄位），
   畫面提示寫進左上角既有模式框（hud.setConditionTag），不新增元件。

   關卡接法（Drone 家族，5 個掛點）：
     const ch=new Challenge({levelId,input,ui,hud});
     const hud=new HUD(ch.hudFeatures(LEVEL.hud));        // 先於 HUD 建立：需要風場面板
     buttons:[ ch.introButton(()=>showIntro(1)), ... ]      // 開始畫面按鈕
     ch.apply(drone)              // startGame() 內：設定飛行模式與檔位
     ch.update(dt,drone)          // 主迴圈：環境風＋G/手把檔位鍵（預設 RT）切檔
     progress.record(id,{...result,...ch.recordFields()})
   ============================================================ */
import { WindSystem } from './systems/wind.js';

const STORE='nd.settings.challenge';
import { challengeAllow, WIND_LEVELS, GEAR_LABEL, loadPkConditions, savePkConditions, conditionTag } from './challenge-rules.js';
export { challengeAllow, WIND_LEVELS, GEAR_LABEL, loadPkConditions, savePkConditions, conditionTag };

function _load(){
  try{ const v=JSON.parse(localStorage.getItem(STORE)); if(v&&typeof v==='object')return v; }catch{}
  return {};
}
function _save(c){ try{ localStorage.setItem(STORE,JSON.stringify(c)); }catch{} }

export class Challenge{
  constructor({levelId,input,ui,hud=null,allow=null}){
    this.levelId=levelId; this.input=input; this.ui=ui; this.hud=hud;
    this.allow=allow||challengeAllow(levelId);
    const s=_load();
    // 只保留本關開放的條件；其他一律標準
    this.hold = this.allow.hold ? (s.hold!==false) : true;
    this.wind = this.allow.wind ? Math.max(0,Math.min(2,s.wind|0)) : 0;
    this.gear = this.allow.gear ? (s.gear===2?2:1) : 1;
    this.windSys=new WindSystem({strength:0});
    this._prevY=false; this._applied=false;
    addEventListener('keydown',e=>{ if(e.code==='KeyG'&&!e.repeat&&this._applied&&!this.ui?.modalOpen)this.toggleGear(); });
  }
  get any(){ return this.allow.hold||this.allow.wind||this.allow.gear; }
  get isStandard(){ return this.hold&&this.wind===0&&this.gear===1; }
  setHud(hud){
    this.hud=hud; this._syncTag();
    if(this.allow.wind&&!this.wind)hud.setWind?.(null);     // 開始畫面就先藏起風場面板（沒選風時）
    // 底部按鍵列自動補上檔位提示（關卡原本的 extra 照留；已含「檔位」就不重複）
    if(this.allow.gear&&hud.setGpBar&&!hud._chGpWrapped){
      const orig=hud.setGpBar.bind(hud); hud._chGpWrapped=true;
      const GH={keyboard:'<kbd>G</kbd>檔位',gamepad:'<kbd>{gear}</kbd>檔位',touch:''};
      hud.setGpBar=(device,extra)=>{
        const ex=(extra&&typeof extra==='object')?(extra[device]||''):(extra||'');
        const add=GH[device]||'';
        orig(device, (add&&!ex.includes('檔位'))?(ex?ex+' '+add:add):ex);
      };
    }
  }
  /* 風場面板只在「可能有風」的關卡建立；沒選風時 setWind(null) 會把它藏起來 */
  hudFeatures(f){ return this.allow.wind?{...f,wind:true}:f; }

  tag(){
    const t=[];
    if(!this.hold)t.push('無定高');
    if(this.wind)t.push(WIND_LEVELS[this.wind].label);
    if(this.gear===2)t.push('二檔');
    return t.join('・');
  }
  code(){ return `h${this.hold?1:0}w${this.wind}g${this.gear}`; }
  /* 成績標示：飛行中切過二檔（哪怕只用一下）也算「二檔」——2026-10-01，避免切回一檔後標成標準 */
  recordFields(){
    const g=this.gear, used=this._gear2Used||g===2;
    this.gear=used?2:g; const out={challenge:this.tag()||'標準',challengeCode:this.code()};
    this.gear=g; return out;
  }
  _syncTag(){ if(this.hud&&this.hud.setConditionTag)this.hud.setConditionTag(this.isStandard?'':'⚠ '+this.tag()); }

  /* 開始畫面按鈕；本關沒開放任何條件時回傳 null（呼叫端 filter 掉） */
  introButton(back){
    if(!this.any)return null;
    return {id:'b-challenge',label:'⚙ 挑戰條件：'+(this.isStandard?'標準':this.tag()),onClick:()=>this.openMenu(back)};
  }
  openMenu(back,focus=0){
    const dev=this.input?.player?.(0)?.device||'keyboard';
    const warn=(!this.hold&&(dev==='keyboard'||dev==='touch'))
      ?`<p style="color:#fbbf24">⚠ 你現在用的是${dev==='touch'?'手機觸控':'鍵盤'}：無定高時油門要一直抓住約四成，${dev==='touch'?'虛擬搖桿放手會彈回中間，很吃力':'鍵盤油門只有按住／放開，幾乎無法懸停'}。建議用手把或遙控器。</p>`:'';
    const btns=[];
    if(this.allow.hold)btns.push({id:'c-hold',label:'定高輔助：'+(this.hold?'開':'關（放開油門會往下掉）'),
      onClick:()=>{this.hold=!this.hold;this._persist();this.openMenu(back,btns.findIndex(b=>b.id==='c-hold'));}});
    if(this.allow.wind)btns.push({id:'c-wind',label:'環境風：'+WIND_LEVELS[this.wind].label,
      onClick:()=>{this.wind=(this.wind+1)%3;this._persist();this.openMenu(back,btns.findIndex(b=>b.id==='c-wind'));}});
    if(this.allow.gear)btns.push({id:'c-gear',label:'檔位：'+GEAR_LABEL[this.gear]+(this.gear===2?'（快）':'（穩）'),
      onClick:()=>{this.gear=this.gear===2?1:2;this._persist();this.openMenu(back,btns.findIndex(b=>b.id==='c-gear'));}});
    btns.push({id:'c-std',label:'恢復標準',onClick:()=>{this.hold=true;this.wind=0;this.gear=1;this._persist();this.openMenu(back,0);}});
    btns.push({id:'c-done',label:'完成',onClick:()=>back()});
    this.ui.showModal({title:'⚙ 挑戰條件',
      html:`<p>想挑戰更難嗎？自己選條件。<b>成績會標示你用的條件</b>，排行榜與報告看得到。</p>
        <p style="color:#9fc3d8">定高輔助關＝放開油門往下掉、高度自己抓｜環境風＝會被吹走，要自己修正｜二檔＝速度更快、更難收</p>
        ${warn}<p>目前：<b>${this.isStandard?'標準':this.tag()}</b></p>`,
      buttons:btns});
    this.ui.gpSetFocus(btns.map(b=>b.id),Math.max(0,focus));
  }
  _persist(){ _save({hold:this.hold,wind:this.wind,gear:this.gear}); this._syncTag(); }

  /* startGame() 呼叫：無定高＝角度模式（Drone 家族）；檔位寫進 drone.gearMul */
  apply(drone){
    this._applied=true; this._gear2Used=(this.gear===2);
    if(drone){
      if(this.allow.hold&&!this.hold){
        if('mode' in drone)drone.mode='angle';     // Drone 家族：角度模式
        else drone.noHold=true;                    // YawDrone：拿掉定高
      }else if(!('mode' in drone))drone.noHold=false;
      drone.gearMul=this.gear===2?1.5:1;
    }
    if(this.wind){ this.windSys.randomize(WIND_LEVELS[this.wind].v); }
    this._syncTag();
    if(this.hud&&!this.isStandard)this.hud.toast('挑戰條件：'+this.tag(),'warn');
  }
  toggleGear(drone){
    if(!this.allow.gear)return;
    this.gear=this.gear===2?1:2; this._persist();
    if(this.gear===2&&this._applied)this._gear2Used=true;
    if(this._drone)this._drone.gearMul=this.gear===2?1.5:1;
    if(this.hud)this.hud.toast('檔位：'+GEAR_LABEL[this.gear]+(this.gear===2?'（快，更難收）':'（穩）'),'ok');
  }
  /* 主迴圈每幀：環境風（風向緩慢旋轉）＋手把檔位鍵切檔 */
  update(dt,drone,camera=null){
    this._drone=drone;
    if(this.allow.gear&&this._applied&&this.input){
      // 具名按鍵「檔位」（預設＝Y）。指派給撥桿時是位置型：撥到哪邊就是哪一檔
      const pos=this.input.gearPos?.();
      if(pos!=null){ if((pos?2:1)!==this.gear&&!this.ui?.modalOpen)this.toggleGear(); }
      else{
        const y=this.input.anyBtn?this.input.anyBtn('gear'):this.input.gamepads().some(gp=>!!gp.buttons[3]?.pressed);
        if(y&&!this._prevY&&!this.ui?.modalOpen)this.toggleGear();
        this._prevY=y;
      }
    }
    if(this.wind){
      this.windSys.angle+=dt*0.06;          // 風向約每 100 秒轉一圈：要持續修正
      this.windSys.update(dt);
      if(drone)drone.wind=this.windSys.vec;
      if(this.hud&&camera)this.hud.setWind(this.windSys.hudInfo(),this.windSys.screenArrowDeg(drone.pos,camera));
    }else if(this.allow.wind&&this.hud){
      this.hud.setWind(null);
    }
  }
}

/* ============================================================
   PK 對戰版（第三批，2026-10-02）
   ------------------------------------------------------------
   - 條件在 pages/pairing.html 席位大廳選，存 nd.settings.challengePk，雙方相同
   - 比賽中不能切檔（公平：開賽就定好）
   - 只套用在真人席；AI 席維持標準（AI 的導航是照有定高的物理寫的）
   - 環境風（只有 cargo/chase/infinite）吹所有機體，包含 AI
   - pk 關卡沒有 HUD 類別，提示寫進 topbar 中間＋開始畫面一行字
   關卡接法：const pkc=new PkChallenge(ACT);
     intro html 加 ${pkc.introHtml()}；startGame 內 pkc.apply(dronesBySeat,seatList)；
     主迴圈 pkc.update(dt)；record 加 ...pkc.recordFields()；topbar 加 ${pkc.topTag()}
   ============================================================ */
export class PkChallenge{
  constructor(levelId){
    this.levelId=levelId;
    Object.assign(this,loadPkConditions(levelId));
    this.windSys=new WindSystem({strength:0});
    this._drones=[];
  }
  get any(){ return this.allow.hold||this.allow.wind||this.allow.gear; }
  get isStandard(){ return this.hold&&this.wind===0&&this.gear===1; }
  tag(){ return conditionTag(this); }
  code(){ return `h${this.hold?1:0}w${this.wind}g${this.gear}`; }
  recordFields(){ return {challenge:this.tag()||'標準',challengeCode:this.code()}; }
  topTag(){ return this.isStandard?'':`<b style="color:#fbbf24">⚠ ${this.tag()}</b>　`; }
  introHtml(){
    if(!this.any)return '';
    return `<p style="font-size:12px;color:${this.isStandard?'#9fc3d8':'#fbbf24'}">⚙ 挑戰條件（雙方相同）：<b>${this.isStandard?'標準':this.tag()}</b>`+
      `${!this.isStandard&&!this.hold?'（只套用真人席，AI 維持標準）':''}　要更改請按「重新指派席位」，在席位大廳設定。</p>`;
  }
  /* dronesBySeat[i] 對應 seatList[i] */
  apply(dronesBySeat,seatList){
    this._drones=dronesBySeat.filter(Boolean);
    dronesBySeat.forEach((d,i)=>{
      if(!d)return;
      const human=seatList?.[i]?.controller?.type!=='ai';
      if('mode' in d){ if(human&&!this.hold)d.mode='angle'; }
      else d.noHold=human&&!this.hold;
      d.gearMul=(human&&this.gear===2)?1.5:1;
    });
    if(this.wind)this.windSys.randomize(WIND_LEVELS[this.wind].v);
  }
  update(dt){
    if(!this.wind)return;
    this.windSys.angle+=dt*0.06;
    this.windSys.update(dt);
    this._drones.forEach(d=>{ d.wind=this.windSys.vec; });
  }
}
