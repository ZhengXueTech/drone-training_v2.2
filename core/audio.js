/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   audio.js — Web Audio 程序合成音效庫（ES Module）
   newdrone Phase 1｜規劃書 §4、修改前檢查清單 #8
   ------------------------------------------------------------
   守則：
   - 預設關（nd.settings.audio 記憶開關，關卡暫停選單可切換）
   - AudioContext 首次使用者互動才初始化（瀏覽器 autoplay 政策）
   - 全部程序合成，零外部音檔——教室斷網照常
   用法：
     import { sfx } from '../core/audio.js';
     sfx.play('ring');            // enabled=false 時靜默略過
     sfx.setEnabled(true);        // 寫入 nd.settings.audio
   ============================================================ */
'use strict';

export const AUDIO_VERSION='1.0';
const STORE='nd.settings.audio';

/* 音色表：每個音效 = 一組 [波形, 起頻, 終頻, 時長, 音量] 疊加 */
const PATCHES={
  ring:    [['sine',880,1320,0.18,0.25],['sine',1760,1760,0.10,0.10]],   // 穿環/檢查點
  ok:      [['sine',660,990,0.12,0.20]],                                  // 一般達成
  warn:    [['square',330,330,0.15,0.12]],                                // 警告
  fail:    [['sawtooth',220,110,0.35,0.22]],                              // 失敗/碰撞
  click:   [['square',990,990,0.04,0.10]],                                // UI 點擊
  lowbat:  [['square',440,330,0.22,0.15]],                                // 低電量（慢閃同步）
  charge:  [['sine',523,784,0.15,0.12]],                                  // 充電中提示
  finish:  [['sine',523,523,0.15,0.2],['sine',659,659,0.15,0.2],
            ['sine',784,784,0.3,0.2]],                                    // 完賽小和弦
};

class Sfx{
  constructor(){
    this.ctx=null;
    try{this.enabled=JSON.parse(localStorage.getItem(STORE)||'false');}
    catch{this.enabled=false;}
    this._lowbatT=0;
  }
  /* 首次互動才建 AudioContext（勿在載入時呼叫） */
  _ensure(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      this.ctx=new AC();
    }
    if(this.ctx.state==='suspended')this.ctx.resume();
    return true;
  }
  setEnabled(on){
    this.enabled=!!on;
    try{localStorage.setItem(STORE,JSON.stringify(this.enabled));}catch{}
    if(on)this._ensure();
    return this.enabled;
  }
  toggle(){ return this.setEnabled(!this.enabled); }
  play(name){
    if(!this.enabled)return;
    const patch=PATCHES[name];
    if(!patch||!this._ensure())return;
    const t0=this.ctx.currentTime;
    let delay=0;
    for(const [wave,f0,f1,dur,vol] of patch){
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=wave;
      o.frequency.setValueAtTime(f0,t0+delay);
      if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t0+delay+dur);
      g.gain.setValueAtTime(vol,t0+delay);
      g.gain.exponentialRampToValueAtTime(0.001,t0+delay+dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t0+delay); o.stop(t0+delay+dur+0.02);
      if(name==='finish')delay+=0.12;   // 完賽和弦琶音
    }
  }
  /* 低電量提醒節流（每 2.5 秒最多一次），關卡迴圈可每幀呼叫 */
  lowBatteryTick(dt,pct){
    if(pct>20){this._lowbatT=0;return;}
    this._lowbatT-=dt;
    if(this._lowbatT<=0){this._lowbatT=2.5;this.play('lowbat');}
  }
}

export const sfx=new Sfx();
