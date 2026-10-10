/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   hud.js — 統一 HUD（ES Module）v1.1
   newdrone Phase 1｜規劃書 5.7 HUD_LAYOUT（位置凍結）
   ------------------------------------------------------------
   分區：左上狀態／頂部中央任務／右上環境（風向）／左下遙測＋姿態儀／
         右下小地圖／底部 gp-bar／中央 toast／中央下引導槽
   響應式（5.7.1）：≥1024 完整、600–1023 精簡、<600 橫拿極簡、
                    <600 直拿遙控器佈局（畫面 60%＋控制區 40%）
   防遮擋（5.7.3）：中央 40%×40% 禁區；機體投影撞提示框→幽靈化
   常駐儀表（5.7.4）：風向/小地圖/電量/遙測永不幽靈化
   Phase 1 新增：姿態儀（pro 模式）、螢幕外目標貼邊箭頭（5.7.4-3）、
                 HUD 密度手動切換（nd.settings.hudDensity）、
                 小地圖點擊放大（手遊慣例：2 秒無操作自動收回）、
                 小地圖路線層（下一檢查點高亮＋已完成打勾＋路徑虛線）
   ============================================================ */
import * as THREE from 'three';
import { glyph } from './controller-diagram.js';
import { showKeys } from './keys-overlay.js';
import { getHand } from './hand.js';   // 2026-10-10 美國手／日本手

export const HUD_VERSION='1.2';
const STORE_DENSITY='nd.settings.hudDensity';   // 'auto'|'full'|'lite'|'min'

const CSS=`
:root{--nd-cyan:#00eeff;--nd-green:#4ade80;--nd-yellow:#facc15;--nd-red:#f87171;
--nd-orange:#fb923c;--nd-panel:rgba(10,20,35,.72);--nd-edge:rgba(0,238,255,.45);}
#nd-hud{position:fixed;inset:0;pointer-events:none;z-index:20;
 font-family:'Share Tech Mono','Consolas',monospace;color:#cfefff;
 padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}
.nd-z{position:absolute;background:var(--nd-panel);border:1px solid var(--nd-edge);
 border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.5;transition:opacity .25s;}
.nd-ghost{opacity:.2 !important;transform:scale(.92);}
#nd-status{left:12px;top:12px;min-width:150px;}
#nd-mission{left:50%;top:12px;transform:translateX(-50%);text-align:center;white-space:nowrap;}
#nd-env{right:12px;top:12px;text-align:center;min-width:96px;}
#nd-env .arrow{display:inline-block;font-size:24px;color:var(--nd-cyan);}
#nd-tele{left:12px;bottom:52px;}
#nd-att{left:12px;bottom:96px;padding:5px;display:none;}
#nd-att canvas{display:block;border-radius:50%;}
#nd-map{right:12px;bottom:52px;text-align:center;padding:6px;pointer-events:auto;cursor:pointer;}
#nd-map canvas{display:block;border-radius:6px;}
#nd-map.nd-map-big{right:auto;bottom:auto;left:50%;top:50%;transform:translate(-50%,-50%);
 opacity:.92;z-index:30;}
#nd-map.nd-map-big canvas{width:min(60vmin,420px)!important;height:min(60vmin,420px)!important;}
#nd-toast{left:50%;top:22%;transform:translateX(-50%);color:var(--nd-orange);
 border-color:var(--nd-orange);opacity:0;font-size:14px;padding:5px 16px;}
#nd-guide{left:50%;bottom:58px;transform:translateX(-50%);max-width:70vw;text-align:center;
 border-color:rgba(74,222,128,.5);font-size:13px;}
#nd-gpbar{left:50%;bottom:8px;transform:translateX(-50%);white-space:nowrap;font-size:11px;padding:4px 12px;}
#nd-gpbar kbd svg{display:inline-block;}
#nd-gpbar kbd{background:#123;border:1px solid #2a5c7f;border-radius:3px;padding:0 4px;margin:0 2px;}
/* 螢幕外目標貼邊箭頭（5.7.4-3：只沿邊框滑動、永不進中央區） */
#nd-offtgt{position:absolute;width:0;height:0;display:none;
 border-left:11px solid transparent;border-right:11px solid transparent;
 border-bottom:20px solid var(--nd-yellow);
 filter:drop-shadow(0 0 6px rgba(250,204,21,.8));transform-origin:50% 65%;}
.nd-bar{height:8px;border-radius:4px;background:#123;overflow:hidden;margin:3px 0;min-width:110px;}
.nd-bar i{display:block;height:100%;transition:width .2s;}
.nd-blink{animation:ndblink 1s infinite;}
@keyframes ndblink{50%{opacity:.35}}
/* 觸控虛擬搖桿（覆蓋式） */
.nd-vj{position:absolute;bottom:46px;width:96px;height:96px;border-radius:50%;
 border:2px dashed rgba(255,255,255,.28);opacity:.35;pointer-events:auto;touch-action:none;}
.nd-vj.active{opacity:.7;}
.nd-vj .vj-knob{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;
 border-radius:50%;background:rgba(255,255,255,.25);}
#nd-vj-l{left:24px}#nd-vj-r{right:24px}
/* 直拿遙控器佈局 */
#nd-deck{display:none;position:absolute;left:0;right:0;bottom:0;height:40%;
 background:rgba(4,8,14,.92);border-top:1px solid var(--nd-edge);pointer-events:auto;}
#nd-deck .deck-in{display:flex;height:100%;align-items:center;justify-content:space-between;padding:0 20px;}
#nd-deck .nd-vj{position:relative;bottom:auto;left:auto;right:auto;opacity:.6;}
#nd-deck .mid{display:flex;flex-direction:column;gap:10px;}
#nd-deck button{background:#0e2238;color:var(--nd-cyan);border:1px solid var(--nd-edge);
 border-radius:8px;font-size:13px;padding:8px 12px;font-family:inherit;min-width:56px;min-height:44px;}
#nd-guide-deck{display:none;position:absolute;left:50%;bottom:calc(40% + 6px);transform:translateX(-50%);
 font-size:12px;color:#a7f3d0;background:var(--nd-panel);border:1px solid rgba(74,222,128,.5);
 border-radius:6px;padding:3px 10px;white-space:nowrap;}
/* ── 平板精簡（600–1023） ── */
@media (max-width:1023px){
  #nd-tele{display:none;}
  #nd-gpbar{display:none;}
  #nd-status{font-size:11px;min-width:0;}
  #nd-map canvas{width:84px!important;height:84px!important;}
  #nd-att{display:none!important;}
}
/* ── 手機（<600） ── */
@media (max-width:599px){
  #nd-status,#nd-env{display:none;}
  #nd-mission{font-size:11px;top:6px;max-width:92vw;overflow:hidden;text-overflow:ellipsis;}
  #nd-map{top:34px;bottom:auto;right:8px;padding:3px;}
  #nd-map canvas{width:60px!important;height:60px!important;border-radius:50%;}
  #nd-map .cap{display:none;}
  #nd-guide{bottom:8px;font-size:11px;max-width:94vw;}
}
/* 直拿：遙控器佈局 */
body.nd-portrait #nd-deck{display:block;}
body.nd-portrait #nd-guide{display:none;}
body.nd-portrait #nd-guide-deck{display:block;}
body.nd-portrait .nd-vj.overlay{display:none;}
body.nd-portrait #nd-map{top:30px;}
/* ── 直拿版面補強（2026-10-08）：關卡自己的動作鈕（模式、自穩、噴藥…）原本用 position:fixed 疊在遙控器區中間，和「視角／暫停」蓋在一起。
   直拿時把它們搬進遙控器區中間那一欄（#nd-deck-acts）：上面一排「視角｜⏸」，下面依序排關卡的動作鈕；轉回橫拿就放回原處。
   進度條（#hold-wrap／#prog-wrap）不是按鈕，改放到畫面區的下緣。橫拿、電腦完全不受影響。 */
#nd-deck .mid .sys{display:flex;gap:6px;justify-content:center;}
#nd-deck-acts{display:flex;flex-direction:column;align-items:center;gap:8px;}
#nd-deck-acts:empty{display:none;}
.nd-docked{position:static!important;margin:0!important;flex:0 0 auto;}
body.nd-portrait #nd-deck .mid{align-items:center;gap:8px;}
body.nd-portrait #nd-map{top:46px;}
body.nd-portrait #nd-guide-deck{left:3vw;right:3vw;transform:none;width:fit-content;max-width:94vw;margin:0 auto;white-space:normal;text-align:center;box-sizing:border-box;}
body.nd-portrait #hold-wrap,body.nd-portrait #prog-wrap{bottom:calc(40% + 40px);}
/* ── 觸控橫拿版面（2026-10-06，規劃書附錄 D.4／F.1；摸底結果見 tests/layout_audit.md）──
   原本小地圖、飛行數據、情境關的專用按鈕都擠在兩支虛擬搖桿的位置上，而且橫拿時沒有暫停鈕。
   只在「觸控裝置＋橫拿」（body.nd-touch）生效，滑鼠鍵盤與手把的畫面完全不變：
   · 左下、右下留給搖桿，其他東西一律不進來
   · 最上面一排：⏸ 暫停｜狀態｜任務｜風向｜視角；小地圖在右上角下面、姿態儀在左上角下面
   · 最下面中間：引導文字、飛行數據（夾在兩支搖桿中間）；按鍵提示列拿掉（觸控按鈕本身就標了功能）
   · 關卡自己的動作按鈕：放在右搖桿左邊 */
.nd-tbtn{display:none;position:absolute;top:10px;width:48px;height:48px;border-radius:10px;pointer-events:auto;touch-action:manipulation;
 background:rgba(8,20,34,.88);color:var(--nd-cyan);border:1px solid var(--nd-edge);font-family:inherit;font-size:12px;padding:0;z-index:3;}
#nd-tbtn-pause{left:10px;font-size:20px;}
#nd-tbtn-cam{right:10px;}
body.nd-touch .nd-tbtn{display:block;width:max(44px,calc(48px*var(--nd-ts,1)));height:max(44px,calc(48px*var(--nd-ts,1)));font-size:calc(12px*var(--nd-ts,1));}
body.nd-touch #nd-tbtn-pause{font-size:calc(20px*var(--nd-ts,1));}
/* 觸控按鍵大小（首頁「顯示設定」，--nd-ts＝0.85／1／1.3／1.6；見 HUD 建構子）：搖桿、暫停與視角鈕、關卡動作鈕一起縮放，旁邊的東西跟著讓位 */
body.nd-touch .nd-vj.overlay{width:calc(96px*var(--nd-ts,1));height:calc(96px*var(--nd-ts,1));}
body.nd-touch .nd-vj.overlay .vj-knob{width:calc(40px*var(--nd-ts,1));height:calc(40px*var(--nd-ts,1));margin:calc(-20px*var(--nd-ts,1));}
body.nd-touch #nd-status{left:calc(18px + 48px*var(--nd-ts,1));top:10px;width:150px;min-width:0;box-sizing:border-box;font-size:11px;}
body.nd-touch #nd-mission{left:calc(176px + 48px*var(--nd-ts,1));right:224px;top:10px;transform:none;white-space:normal;font-size:12px;line-height:1.35;max-height:48px;overflow:hidden;box-sizing:border-box;}
body.nd-touch #nd-env{right:116px;top:10px;min-width:0;width:96px;box-sizing:border-box;}   /* 在小地圖那一欄的左邊：風向框比較高時才不會壓到小地圖 */
body.nd-touch #ver{display:none;}
body.nd-touch #nd-map{right:10px;top:calc(18px + 48px*var(--nd-ts,1));bottom:auto;padding:4px;}
body.nd-touch #nd-map canvas{width:84px!important;height:84px!important;}
body.nd-touch #nd-att{left:10px;top:140px;bottom:auto;}
body.nd-touch #nd-guide{left:calc(54px + 96px*var(--nd-ts,1));right:calc(90px + 160px*var(--nd-ts,1));bottom:48px;transform:none;max-width:none;width:fit-content;margin:0 auto;font-size:12px;box-sizing:border-box;}
body.nd-touch #nd-tele{display:block;left:50%;bottom:8px;transform:translateX(-50%);font-size:11px;padding:3px 8px;white-space:nowrap;}
body.nd-touch #nd-gpbar{display:none!important;}
@media (max-height:440px){
  body.nd-touch #nd-map canvas{width:64px!important;height:64px!important;}
  body.nd-touch #nd-map .cap{display:none;}
  body.nd-touch #nd-att{display:none!important;}
}
@media (max-width:760px){
  body.nd-touch #nd-status{width:124px;font-size:10px;}
  body.nd-touch #nd-mission{left:calc(150px + 48px*var(--nd-ts,1));right:204px;font-size:11px;}
  body.nd-touch #nd-env{width:80px;font-size:11px;}
  body.nd-touch #nd-tele{display:none;}
  body.nd-touch #nd-guide{bottom:8px;font-size:11px;}
}
/* 關卡自己的動作按鈕（噴藥、熱成像、確認異常、加速掃描）：右搖桿的左邊，拇指一伸就到，不壓搖桿也不壓小地圖 */
body.nd-touch #agri-spray-btn,body.nd-touch #rs-thermal-btn,body.nd-touch #insp-confirm-btn,body.nd-touch #bg-boost-btn{right:calc(40px + 96px*var(--nd-ts,1))!important;bottom:52px!important;
 transform:scale(var(--nd-ts,1));transform-origin:bottom right;}
/* 自由飛行練習場的自穩鈕、模式鈕：跟著搖桿大小往左、往上讓 */
body.nd-touch #self-level-btn{right:calc(54px + 96px*var(--nd-ts,1))!important;transform:scale(var(--nd-ts,1));transform-origin:bottom right;}
body.nd-touch #mode-btn{right:calc(54px + 96px*var(--nd-ts,1))!important;bottom:calc(60px + 96px*var(--nd-ts,1))!important;transform:scale(var(--nd-ts,1));transform-origin:bottom right;}
/* ── 密度手動覆蓋（5.7.1-1：學生可蓋過自動偵測） ── */
body.nd-density-full #nd-status,body.nd-density-full #nd-env,
body.nd-density-full #nd-tele,body.nd-density-full #nd-gpbar{display:block!important;}
body.nd-density-lite #nd-tele,body.nd-density-lite #nd-gpbar,
body.nd-density-lite #nd-att{display:none!important;}
body.nd-density-min #nd-status,body.nd-density-min #nd-env,body.nd-density-min #nd-att,
body.nd-density-min #nd-tele,body.nd-density-min #nd-gpbar{display:none!important;}
`;

const _v=new THREE.Vector3();
/* Canvas 的 fillStyle/strokeStyle 只吃字串（'#rrggbb' 或 CSS 色名），直接塞
   THREE.js 慣用的數字色碼（例如 0x22c55e）會被靜默忽略、維持前一次設定的
   顏色——2026-07-23 加小地圖方位地標時發現既有的 targets[].color 也中這個
   坑（一直沒人發現是因為圖示仍然會用「前一個顏色」畫出來、看起來像有畫，
   只是顏色不對）。這裡統一轉換，數字轉成 '#rrggbb'，字串原樣放行。 */
function _cssColor(c){
  if(typeof c==='number') return '#'+c.toString(16).padStart(6,'0');
  return c;
}
export const DENSITY_LABELS={auto:'自動',full:'完整',lite:'精簡',min:'極簡'};
export const DENSITY_ORDER=['auto','full','lite','min'];

export class HUD{
  /* flags：manifest 的 hud:{} — 關卡沒有的系統整區不建（v1.6「整區消失」原則） */
  constructor(flags={}){
    this.flags={battery:true,liquid:false,wind:true,minimap:true,telemetry:true,gpbar:true,
                attitude:false,...flags};
    this._toastT=0;
    this._mapBigT=0;
    this._offTarget=null;          // Vector3 | null（螢幕外指示器目標）
    this._buildDOM();
    this._updatePortrait=()=>{
      const portrait=innerWidth<600&&innerHeight>innerWidth;
      document.body.classList.toggle('nd-portrait',portrait);
      this.portrait=portrait;
      this._dockActs(portrait);
      // 觸控裝置橫拿：套用分區版面（上面的 body.nd-touch 規則）。直拿走原本的遙控器版面。
      let coarse=false; try{ coarse=matchMedia('(pointer:coarse)').matches; }catch{}
      document.body.classList.toggle('nd-touch',coarse&&!portrait);
      // 觸控按鍵大小（首頁設定 nd.settings.touchScale）；螢幕很矮時自動壓小，免得兩支搖桿把畫面佔滿
      let ts=1; try{ const v=parseFloat(localStorage.getItem('nd.settings.touchScale')); if(v>=0.5&&v<=2)ts=v; }catch{}
      document.body.style.setProperty('--nd-ts',String(Math.min(ts,Math.max(0.8,innerHeight/300))));
    };
    addEventListener('resize',this._updatePortrait);
    this._updatePortrait();
    // 密度記憶（各裝置各自記憶——localStorage 天然 per-device）
    let d='auto';
    try{d=JSON.parse(localStorage.getItem(STORE_DENSITY)||'"auto"');}catch{}
    this.setDensity(d,false);
  }
  _buildDOM(){
    if(!document.getElementById('nd-hud-css')){
      const st=document.createElement('style');st.id='nd-hud-css';st.textContent=CSS;
      document.head.appendChild(st);
    }
    const root=document.createElement('div');root.id='nd-hud';
    const F=this.flags;
    root.innerHTML=`
      <div class="nd-z" id="nd-status">
        <div id="nd-modes">街機｜跟機</div>
        ${F.battery?`<div>🔋<div class="nd-bar"><i id="nd-bat" style="width:100%;background:var(--nd-green)"></i></div></div>`:''}
        ${F.liquid?`<div>🛠️<div class="nd-bar"><i id="nd-liq" style="width:100%;background:#22d3ee"></i></div></div>`:''}
        <div id="nd-anomaly" style="display:none;color:var(--nd-red)">⚠ 訊號異常</div>
      </div>
      <div class="nd-z" id="nd-mission"><b id="nd-mtext">—</b>　<span id="nd-mprog"></span>　<span id="nd-mtimer"></span>　<span id="nd-mscore"></span></div>
      ${F.wind?`<div class="nd-z" id="nd-env"><span class="arrow" id="nd-warrow">➤</span><div id="nd-wlabel">無風</div><div class="cap" style="font-size:9px;color:#7aa3b8">依畫面方向</div></div>`:''}
      ${F.telemetry?`<div class="nd-z" id="nd-tele">ALT <span id="nd-alt">0.0</span> m　SPD <span id="nd-spd">0.0</span> m/s</div>`:''}
      ${F.attitude?`<div class="nd-z" id="nd-att"><canvas id="nd-attc" width="120" height="120" style="width:60px;height:60px"></canvas></div>`:''}
      ${F.minimap?`<div class="nd-z" id="nd-map"><canvas id="nd-mapc" width="220" height="220" style="width:110px;height:110px"></canvas><div class="cap" style="font-size:9px;color:#7aa3b8">N 朝上</div></div>`:''}
      <div class="nd-z" id="nd-toast"></div>
      <div class="nd-z" id="nd-guide" style="display:none"></div>
      <div id="nd-guide-deck"></div>
      <div id="nd-offtgt"></div>
      ${F.gpbar?`<div class="nd-z" id="nd-gpbar"></div>`:''}
      <button class="nd-tbtn" id="nd-tbtn-pause" aria-label="暫停">⏸</button>
      <button class="nd-tbtn" id="nd-tbtn-cam" aria-label="切換視角">視角</button>
      <div class="nd-vj overlay" id="nd-vj-l"><div class="vj-knob"></div></div>
      <div class="nd-vj overlay" id="nd-vj-r"><div class="vj-knob"></div></div>
      <div id="nd-deck"><div class="deck-in">
        <div class="nd-vj" id="nd-vj-dl"><div class="vj-knob"></div></div>
        <div class="mid">
          <div class="sys"><button id="nd-btn-cam">視角</button><button id="nd-btn-pause">⏸</button></div>
          <div id="nd-deck-acts"></div>
        </div>
        <div class="nd-vj" id="nd-vj-dr"><div class="vj-knob"></div></div>
      </div></div>`;
    document.body.appendChild(root);
    this.el=(id)=>document.getElementById(id);
    this.root=root;
    // 小地圖點擊放大（5.7.1-2：全屏 60% 半透明、2 秒無操作自動收回；遊戲不暫停）
    const map=this.el('nd-map');
    if(map)map.addEventListener('click',()=>{
      const big=map.classList.toggle('nd-map-big');
      this._mapBigT=big?2.0:0;
    });
  }
  /* 直拿：把關卡自己的動作鈕搬進遙控器區中間；離開直拿就放回原來的位置（2026-10-08）。
     新關卡的按鈕加 data-deck-act 屬性就會自動被搬；下面這串是既有關卡的按鈕。 */
  _dockActs(on){
    const slot=document.getElementById('nd-deck-acts'); if(!slot)return;
    if(on){
      document.querySelectorAll('[data-deck-act],#mode-btn,#self-level-btn,#kill-btn,#bg-boost-btn,#rs-thermal-btn,#insp-confirm-btn,#agri-spray-btn').forEach(e=>{
        if(e.classList.contains('nd-docked'))return;
        e._ndHome={p:e.parentNode,n:e.nextSibling}; e.classList.add('nd-docked'); slot.appendChild(e); });
    }else{
      [...slot.children].forEach(e=>{ e.classList.remove('nd-docked'); const h=e._ndHome;
        if(h&&h.p){ if(h.n&&h.n.parentNode===h.p)h.p.insertBefore(e,h.n); else h.p.appendChild(e); } });
    }
  }
  /* 觸控搖桿元素（依直/橫拿把正確的一組交給 input.touch.attach） */
  attachTouch(input){
    const bind=()=>{
      if(this.portrait) input.touch.attach(this.el('nd-vj-dl'),this.el('nd-vj-dr'));
      else              input.touch.attach(this.el('nd-vj-l'), this.el('nd-vj-r'));
    };
    addEventListener('resize',bind); bind();
    // 非觸控裝置隱藏覆蓋搖桿
    if(!matchMedia('(pointer:coarse)').matches){
      this.el('nd-vj-l').style.display='none';
      this.el('nd-vj-r').style.display='none';
    }
  }
  /* 直拿版面的按鈕（nd-btn-*）和橫拿觸控版面的按鈕（nd-tbtn-*）都接同一個動作 */
  onCamButton(fn){ this.el('nd-btn-cam')?.addEventListener('click',fn); this.el('nd-tbtn-cam')?.addEventListener('click',fn); }
  onPauseButton(fn){ this.el('nd-btn-pause')?.addEventListener('click',fn); this.el('nd-tbtn-pause')?.addEventListener('click',fn); }

  setMission(text){ this.el('nd-mtext').textContent=text; }
  setProgress(t){ this.el('nd-mprog').textContent=t||''; }
  setScore(t){ this.el('nd-mscore').textContent=t!=null?('🏆 '+t):''; }
  setTimer(sec){
    const el=this.el('nd-mtimer');
    if(sec==null){el.textContent='';return;}
    const m=Math.floor(sec/60),s=Math.floor(sec%60);
    el.textContent=`⏱ ${m}:${String(s).padStart(2,'0')}`;
    el.classList.toggle('nd-blink',sec<=10);
    el.style.color=sec<=10?'var(--nd-red)':'';
  }
  setModes(flight,cam){ this._lastModes=[flight,cam];
    this.el('nd-modes').textContent=`${flight}｜${cam}`+(this._condTag?`｜${this._condTag}`:''); }
  /* 2026-10-01 挑戰條件標籤（core/challenge.js 呼叫）：接在既有模式框後面，不新增元件 */
  setConditionTag(t){ this._condTag=t||''; if(this._lastModes)this.setModes(...this._lastModes); }
  /* 2026-08-03 新增（碰撞真實感 D 項）：關卡每幀傳入 drone.anomalyT>0 即可，
     不傳這個參數（既有呼叫端）完全不受影響——元素預設 display:none。 */
  setAnomaly(active){
    const el=this.el('nd-anomaly'); if(!el)return;
    el.style.display=active?'block':'none';
    el.classList.toggle('nd-blink',!!active);
  }
  setBattery(pct){
    const b=this.el('nd-bat'); if(!b)return;
    b.style.width=pct+'%';
    b.style.background=pct>50?'var(--nd-green)':pct>20?'var(--nd-yellow)':'var(--nd-red)';
    b.parentElement.parentElement.classList.toggle('nd-blink',pct<=20);
  }
  setLiquid(pct){
    const b=this.el('nd-liq'); if(!b)return;
    b.style.width=pct+'%';
  }
  /* screenDeg（可選，Phase 5 新增）：wind.screenArrowDeg(dronePos,camera) 算出的
     「目前這顆鏡頭畫面上」的箭頭角度——不傳時退回 info.arrowDeg（絕對世界座標角，
     舊行為，只有還沒更新呼叫端的關卡會用到，新關卡請一律傳 screenDeg）。
     絕對座標角在跟機/FPV/飛手鏡頭疊圖時會跟玩家實際看到的飄移方向相反
     （鏡頭朝向跟世界座標系不一致時），只適合畫在固定 N 朝上的小地圖上。 */
  setWind(info,screenDeg){
    const a=this.el('nd-warrow'); if(!a)return;
    if(!info){a.parentElement.style.display='none';return;}
    a.parentElement.style.display='';
    const deg=(screenDeg!=null)?screenDeg:info.arrowDeg;
    a.style.transform=`rotate(${deg}deg)`;
    this.el('nd-wlabel').textContent=`${info.label} ${info.speed.toFixed(1)} m/s`;
  }
  setTelemetry(alt,spd){
    const a=this.el('nd-alt'); if(!a)return;
    a.textContent=alt.toFixed(1);
    this.el('nd-spd').textContent=spd.toFixed(1);
  }
  /* extra：關卡專屬按鍵提示（例如 x-bridge 的「B 加速掃描」、x-rescue 的
     「B 熱成像」），依裝置類型帶入對應提示文字（可以是 { keyboard, gamepad, touch }
     物件依裝置分別顯示，或單一字串三種裝置都顯示同一段文字）。可省略——
     不傳就完全維持原本三種裝置的固定文字，向下相容所有既有呼叫端。 */
  setGpBar(device,extra){
    const el=this.el('nd-gpbar'); if(!el)return;
    const exText=(extra&&typeof extra==='object')?(extra[device]||''):(extra||'');
    const exHtml=exText?('・'+exText):'';
    if(device==='gamepad'){
      let h=(globalThis.__ndHandSwap?'🎮 左桿 俯仰/偏航・右桿 油門/翻滾・':'🎮 左桿 油門/偏航・右桿 俯仰/翻滾・')+'<kbd>{camCycle}</kbd>視角・<kbd>{crouch}</kbd>蹲・<kbd>{confirm}</kbd>確認・<kbd>{back}</kbd>暫停'+exHtml;
      // 提示字串裡寫功能代號 {gear}、{action}…，這裡換成這支手把上實際的鍵名（input.player() 每幀提供；
      // 標準手把＝RT／LB…，PS＝R2／L1…，有設定檔的搖桿＝設定的鈕或撥桿，沒指派＝鍵盤按法）
      const L=globalThis.__ndBtnLabels||{confirm:'A',back:'B',camCycle:'≡',pilotCycle:'⧉',crouch:'十字↓',gear:'RT',mode:'LT',action:'LB',selfLevel:'RB'};
      // 標準手把在鍵名前面加一個小圖示，標出是哪個位置的鍵（遙控器沒有固定位置，只寫名字）
      h=h.replace(/\{(\w+)\}/g,(m,k)=>L[k]?((L._idx&&L._idx[k]!=null?glyph(L._idx[k]):'')+L[k]):m);
      if(h!==this._gpHtml){ this._gpHtml=h; el.innerHTML=h; }
      // 每關第一次真的開始飛（沒有對話框擋著）時，秀幾秒這支搖桿的按鍵圖
      if(!this._keysShown&&!document.querySelector('.nd-modal-bg')){ this._keysShown=true; try{ showKeys({mode:'card',seconds:6}); }catch{} }
      return;
    }
    this._gpHtml=null;
    if(device==='touch') el.innerHTML=(getHand()==='1'?'👆 左搖桿 俯仰/偏航・右搖桿 油門/翻滾':'👆 左搖桿 油門/偏航・右搖桿 俯仰/翻滾')+exHtml;
    else el.innerHTML='<kbd>W/S</kbd>油門 <kbd>A/D</kbd>偏航 <kbd>↑↓←→</kbd>俯仰/翻滾 <kbd>Shift</kbd>半舵 <kbd>C</kbd>視角 <kbd>V</kbd>站位 <kbd>Z</kbd>蹲 <kbd>M</kbd>模式 <kbd>Esc</kbd>暫停'+exHtml;
  }
  toast(msg,type='warn'){
    const el=this.el('nd-toast');
    el.textContent=msg;
    const c=type==='ok'?'var(--nd-green)':type==='fail'?'var(--nd-red)':'var(--nd-orange)';
    el.style.color=c; el.style.borderColor=c; el.style.opacity=1;
    this._toastT=2.5;
  }
  setGuide(text){
    const g=this.el('nd-guide'), d=this.el('nd-guide-deck');
    if(!text){g.style.display='none';d.style.display='none';d.textContent='';g.textContent='';return;}
    g.style.display=''; g.textContent=text; d.textContent=text;
    if(this.portrait)d.style.display='block';
  }
  /* ── 姿態儀（5.7：左下遙測上方，pro 模式才顯示；arcade 隱藏） ── */
  showAttitude(on){ const el=this.el('nd-att'); if(el)el.style.display=on?'block':'none'; }
  /* pitchRad：正=機頭抬起；rollRad：正=右壓 */
  setAttitude(pitchRad,rollRad){
    const c=this.el('nd-attc'); if(!c)return;
    if(this.el('nd-att').style.display==='none')return;
    const ctx=c.getContext('2d'), W=c.width, R=W/2;
    ctx.save();
    ctx.clearRect(0,0,W,W);
    ctx.beginPath(); ctx.arc(R,R,R-2,0,Math.PI*2); ctx.clip();
    ctx.translate(R,R);
    ctx.rotate(-rollRad);
    const pitchPx=(pitchRad/(Math.PI/2))*R*1.6;     // 90° 俯仰 ≈ 滿刻度
    // 天空／地面
    ctx.fillStyle='#1c4a6e'; ctx.fillRect(-R*1.6,-R*3.2+pitchPx,R*3.2,R*3.2);
    ctx.fillStyle='#4a2f14'; ctx.fillRect(-R*1.6,pitchPx,R*3.2,R*3.2);
    ctx.strokeStyle='#e8f4ff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-R,pitchPx); ctx.lineTo(R,pitchPx); ctx.stroke();
    // 俯仰刻度（±15°、±30°）
    ctx.strokeStyle='rgba(232,244,255,.55)'; ctx.lineWidth=1;
    for(const deg of [-30,-15,15,30]){
      const y=pitchPx+(deg*Math.PI/180/(Math.PI/2))*R*1.6;
      ctx.beginPath(); ctx.moveTo(-R*0.3,y); ctx.lineTo(R*0.3,y); ctx.stroke();
    }
    ctx.restore();
    // 固定機徽（中央小翼）
    ctx.strokeStyle='#facc15'; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(R-22,R); ctx.lineTo(R-7,R); ctx.moveTo(R+7,R); ctx.lineTo(R+22,R);
    ctx.moveTo(R,R-3); ctx.lineTo(R,R+3); ctx.stroke();
    ctx.strokeStyle='rgba(0,238,255,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(R,R,R-2,0,Math.PI*2); ctx.stroke();
  }
  /* ── 螢幕外目標指示器（5.7.4-3）：目標不在視野→邊緣貼邊箭頭 ── */
  setOffscreenTarget(pos){ this._offTarget=pos||null; }
  _updateOffTarget(camera){
    const el=this.el('nd-offtgt'); if(!el)return;
    if(!this._offTarget||!camera){el.style.display='none';return;}
    _v.copy(this._offTarget).project(camera);
    const behind=_v.z>1;
    let nx=_v.x, ny=_v.y;                 // NDC -1..1
    if(behind){nx=-nx;ny=-ny;}
    const onScreen=!behind&&Math.abs(nx)<0.92&&Math.abs(ny)<0.88;
    if(onScreen){el.style.display='none';return;}   // 目標進視野即淡出
    // 夾到螢幕邊框（保留邊距；只沿邊框滑動、不進中央）
    const k=1/Math.max(Math.abs(nx),Math.abs(ny),1e-6);
    nx=Math.max(-1,Math.min(1,nx*k)); ny=Math.max(-1,Math.min(1,ny*k));
    const M=26;
    const x=(nx*0.5+0.5)*(innerWidth -M*2)+M;
    const y=(-ny*0.5+0.5)*(innerHeight-M*2)+M;
    const ang=Math.atan2(nx,ny)*180/Math.PI;        // 箭頭指向目標方向
    el.style.display='block';
    el.style.left=(x-11)+'px'; el.style.top=(y-13)+'px';
    el.style.transform=`rotate(${ang}deg)`;
  }
  /* ── HUD 密度手動切換（5.7.1-1）── */
  setDensity(mode,save=true){
    if(!DENSITY_ORDER.includes(mode))mode='auto';
    this.density=mode;
    for(const m of ['full','lite','min'])
      document.body.classList.toggle('nd-density-'+m,mode===m);
    if(save)try{localStorage.setItem(STORE_DENSITY,JSON.stringify(mode));}catch{}
    return mode;
  }
  cycleDensity(){
    const i=DENSITY_ORDER.indexOf(this.density);
    return this.setDensity(DENSITY_ORDER[(i+1)%DENSITY_ORDER.length]);
  }
  /* 小地圖：N 朝上（CLAUDE.md 已驗證翻轉規則）；targets:[{pos,color,done}]
     opts.route=true 時畫路線層：路徑虛線＋下一檢查點高亮＋已完成打勾（5.7.4-2） */
  /* 2026-09-30 新增（使用者回報：t06「我往前飛，小地圖卻往下跑，可以理解但閱讀很奇怪」）：
     小地圖方向改成可選——'view'＝隨畫面轉（預設，畫面前方＝小地圖上方，跟風向箭頭
     「依畫面方向」同一套參考系，不再兩套並存）；'north'＝原本的北方朝上。
     設定存 nd.settings.mapOrient，由 index「顯示設定」切換，所有關卡共用。
     旋轉角依相機朝向（hud.update() 每幀傳入的 camera）；沒有相機時退回機頭朝向。 */
  _mapRotation(yaw){
    let mode='view';
    try{ const v=JSON.parse(localStorage.getItem('nd.settings.mapOrient')); if(v==='north')mode='north'; }catch{}
    this._mapMode=mode;
    if(mode==='north')return 0;
    // 世界向量 (vx,vz) 在畫布上的方向＝(-vx,-vz)（toMX/toMZ 兩軸皆翻轉）
    let cx,cz;
    if(this._cam&&this._cam.getWorldDirection){
      const f=this._cam.getWorldDirection(this._camDir||(this._camDir=new this._cam.position.constructor()));
      if(Math.hypot(f.x,f.z)>1e-3){ cx=-f.x; cz=-f.z; }
    }
    if(cx===undefined){ cx=Math.sin(yaw); cz=Math.cos(yaw); }   // 機頭（同下方機頭線的畫布方向）
    return -Math.PI/2-Math.atan2(cz,cx);
  }
  drawMinimap(dronePos,yaw,bound,targets=[],opts={}){
    const c=this.el('nd-mapc'); if(!c)return;
    const ctx=c.getContext('2d'), W=c.width, H=c.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(4,12,22,.9)'; ctx.fillRect(0,0,W,H);
    const scX=W/(bound*2), scZ=H/(bound*2);
    const toMX=x=>W-(x+bound)*scX, toMZ=z=>H-(z+bound)*scZ;
    ctx.strokeStyle='rgba(0,238,255,.4)'; ctx.strokeRect(1,1,W-2,H-2);
    const rot=this._mapRotation(yaw);
    const cap=this.el('nd-map')?.querySelector('.cap');
    const capTxt=this._mapMode==='north'?'N 朝上':'隨畫面轉';   // 依設定，不依角度（鏡頭剛好朝北時角度也是 0）
    if(cap&&cap.textContent!==capTxt)cap.textContent=capTxt;
    ctx.save();
    if(this._mapMode!=='north'){
      // 旋轉後整個方形場地要塞得進畫布 → 縮 0.7（≈1/√2）
      ctx.translate(W/2,H/2); ctx.rotate(rot); ctx.scale(0.7,0.7); ctx.translate(-W/2,-H/2);
      ctx.strokeStyle='rgba(0,238,255,.25)'; ctx.strokeRect(1,1,W-2,H-2);   // 場地邊界
    }
    // N 標示：永遠正立，放在「北方」那一側的邊緣
    { const r=W/2-14, nx=W/2+Math.sin(rot)*r, ny=H/2-Math.cos(rot)*r;
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#00eeff'; ctx.font='bold 16px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('N',nx,ny); ctx.restore(); }
    // 四方位地標（Phase 5，2026-07-23：跟 core/world.js makeCompassLandmarks()
    // 配套——場地放實體地標＋小地圖同步畫同顏色/形狀，不用先懂羅盤方位名
    // 就能對照方向。純視覺定向輔助，不參與 route/done 判定，故獨立於
    // targets 陣列之外，用新的 opts.landmarks（可省略，不影響既有呼叫端）。）
    if(opts.landmarks){
      // 地標故意放在場地圍籬外（3D 場景裡不跟邊界柱重疊），世界座標會超出
      // ±bound、換算後落在畫布外——夾在畫布邊緣內側 6px，永遠看得到。
      for(const m of opts.landmarks){
        const mx=Math.max(6,Math.min(W-6,toMX(m.pos.x)));
        const mz=Math.max(6,Math.min(H-6,toMZ(m.pos.z)));
        this._drawMapMarker(ctx,mx,mz,m.shape,m.color,6);
      }
    }
    if(opts.route&&targets.length>1){          // 建議路徑虛線
      ctx.strokeStyle='rgba(250,204,21,.4)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
      ctx.beginPath();
      targets.forEach((t,i)=>{const x=toMX(t.pos.x),z=toMZ(t.pos.z);
        i?ctx.lineTo(x,z):ctx.moveTo(x,z);});
      ctx.stroke(); ctx.setLineDash([]);
    }
    let nextDrawn=false;
    for(const t of targets){
      const isNext=opts.route&&!t.done&&!nextDrawn;
      if(isNext)nextDrawn=true;
      ctx.fillStyle=t.done?'rgba(120,220,120,.5)':_cssColor(t.color||'#facc15');
      ctx.beginPath(); ctx.arc(toMX(t.pos.x),toMZ(t.pos.z),isNext?7:5,0,Math.PI*2); ctx.fill();
      if(isNext){ ctx.strokeStyle='#facc15'; ctx.lineWidth=2;   // 下一個檢查點高亮圈
        ctx.beginPath(); ctx.arc(toMX(t.pos.x),toMZ(t.pos.z),10,0,Math.PI*2); ctx.stroke(); }
      if(t.done){ ctx.strokeStyle='#4ade80'; ctx.lineWidth=2;   // 已完成打勾
        const x=toMX(t.pos.x),z=toMZ(t.pos.z);
        ctx.beginPath(); ctx.moveTo(x-4,z); ctx.lineTo(x-1,z+3); ctx.lineTo(x+4,z-3); ctx.stroke(); }
    }
    // 機頭箭頭：v1.3 修正方向反了的 bug（2026-07-23 使用者實機回饋抓到）——
    // toMX/toMZ 把世界座標「+往螢幕負方向」轉換（north=+Z 對應畫布 y 變小、
    // west=+X 對應畫布 x 變小），機頭向量（跟 physics.js `_arcade()` 的
    // fx=-sin(yaw),fz=-cos(yaw) 同一套）要套進畫布座標時，方向也要跟著
    // 「正負反轉」一次，否則畫出來的線段會指向機尾、不是機頭（180° 反了）。
    // 舊式（v1.2，已證實錯誤）：hx=dx-sin(yaw)*14, hz=dz-cos(yaw)*14。
    const dx=toMX(dronePos.x), dz=toMZ(dronePos.z);
    const hx=dx + Math.sin(yaw)*14, hz=dz + Math.cos(yaw)*14;
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(dx,dz); ctx.lineTo(hx,hz); ctx.stroke();
    ctx.strokeStyle='#4ade80'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(dx,dz); ctx.lineTo(hx,hz); ctx.stroke();
    ctx.fillStyle='#4ade80'; ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(dx,dz,5,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  /* 小地圖方位地標圖示：形狀跟 core/world.js makeCompassLandmarks() 的
     3D 物件一一對應（圓錐≈三角形、方塊≈正方形、球體≈圓形、八面體≈菱形），
     不寫 shape 或不認得的 shape 一律退回圓形（沿用原本 targets 的畫法，
     不影響既有呼叫端）。 */
  _drawMapMarker(ctx,x,y,shape,color,r){
    ctx.fillStyle=_cssColor(color||'#facc15'); ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.5;
    ctx.beginPath();
    if(shape==='square'){ ctx.rect(x-r,y-r,r*2,r*2); }
    else if(shape==='triangle'){ ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.87,y+r*0.6); ctx.lineTo(x-r*0.87,y+r*0.6); ctx.closePath(); }
    else if(shape==='diamond'){ ctx.moveTo(x,y-r); ctx.lineTo(x+r,y); ctx.lineTo(x,y+r); ctx.lineTo(x-r,y); ctx.closePath(); }
    else { ctx.arc(x,y,r,0,Math.PI*2); }
    ctx.fill(); ctx.stroke();
  }
  /* 每幀：toast 倒數＋小地圖放大倒數＋螢幕外指示器＋防遮擋幽靈化
     （5.7.3-3：幽靈化只對文字浮層，儀表永不套用） */
  update(dt,camera,dronePos){
    if(camera)this._cam=camera;   // 小地圖「隨畫面轉」用
    if(this._toastT>0){ this._toastT-=dt;
      if(this._toastT<=0)this.el('nd-toast').style.opacity=0; }
    const map=this.el('nd-map');
    if(map&&map.classList.contains('nd-map-big')){
      this._mapBigT-=dt;
      if(this._mapBigT<=0)map.classList.remove('nd-map-big');
    }
    this._updateOffTarget(camera);
    if(camera&&dronePos){
      _v.copy(dronePos).project(camera);
      const sx=(_v.x*0.5+0.5)*innerWidth, sy=(-_v.y*0.5+0.5)*innerHeight;
      for(const id of ['nd-toast','nd-guide']){
        const el=this.el(id);
        if(!el||el.style.opacity==='0'||el.style.display==='none')continue;
        const r=el.getBoundingClientRect();
        const hit=sx>r.left-20&&sx<r.right+20&&sy>r.top-20&&sy<r.bottom+20;
        if(hit){el.classList.add('nd-ghost');el._ghostT=0.5;}
        else if(el._ghostT!=null){el._ghostT-=dt;
          if(el._ghostT<=0){el.classList.remove('nd-ghost');el._ghostT=null;}}
      }
    }
  }
  dispose(){ this.root.remove(); removeEventListener('resize',this._updatePortrait); }
}

/* ── 多人分割畫面觸控搖桿（Phase 4b）──────────────────────────────
   pvp.html 等多人關卡 humanCount>=2 時 hud=null（沒有單人 HUD 實例可用，
   單人版的 attachTouch() 也只認 input.touch 這一份），因此獨立成一個
   「非 class 方法」的匯出函式：依 buildGroupPanes() 算出的分割畫面矩形
   （WebGL 左下為原點的正規化座標，與 pvp.html renderPaneLabels() 用的
   同一份 rect）直接在該席位的畫面範圍內疊一組虛擬搖桿，綁定到
   input.touchSeat(seatIndex)（互不干擾的獨立 TouchSource）。
   只對 controller.type==='touch' 的席位呼叫；其餘席位（鍵盤/手把/AI）
   不受影響、也不需要改動 HUD class 或 attachTouch() 既有行為。 */
const _SEAT_CSS_ID='nd-hud-touchseat-css';
function _ensureTouchSeatCSS(){
  if(document.getElementById(_SEAT_CSS_ID))return;
  const style=document.createElement('style');
  style.id=_SEAT_CSS_ID;
  style.textContent=`
.nd-vjseat{position:fixed;pointer-events:none;z-index:25;}
.nd-vjseat .nd-vj{position:absolute;bottom:10px;width:72px;height:72px;border-radius:50%;
 border:2px dashed rgba(255,255,255,.32);opacity:.4;pointer-events:auto;touch-action:none;}
.nd-vjseat .nd-vj.active{opacity:.75;}
.nd-vjseat .nd-vj .vj-knob{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px;
 border-radius:50%;background:rgba(255,255,255,.28);}
.nd-vjseat .vjs-l{left:6px;}
.nd-vjseat .vjs-r{right:6px;}
.nd-vjseat .vjs-tag{position:absolute;top:4px;left:50%;transform:translateX(-50%);
 font:11px 'Share Tech Mono','Consolas',monospace;color:#cfefff;background:rgba(10,20,35,.6);
 border-radius:4px;padding:1px 6px;white-space:nowrap;pointer-events:none;}
`;
  document.head.appendChild(style);
}
/* input：InputManager 實例／seatIndex：該席位在 seatList 的索引（touchSeat 的 key）
   rectNorm：{x,y,w,h}，WebGL 左下為原點的正規化視口座標（buildGroupPanes() 的 pane.rect）
   label：選填，顯示在搖桿上方的小標籤（例如席位名稱）
   回傳 {dispose()}：分割畫面重算佈局時可先 dispose() 再重呼叫。 */
export function attachTouchSeat(input,seatIndex,rectNorm,label){
  _ensureTouchSeatCSS();
  const id='nd-vjseat-'+seatIndex;
  document.getElementById(id)?.remove();
  const box=document.createElement('div');
  box.className='nd-vjseat'; box.id=id;
  box.style.left=(rectNorm.x*100)+'%';
  box.style.width=(rectNorm.w*100)+'%';
  box.style.top=((1-rectNorm.y-rectNorm.h)*100)+'%';
  box.style.height=(rectNorm.h*100)+'%';
  if(label){ const tag=document.createElement('div'); tag.className='vjs-tag'; tag.textContent=label; box.appendChild(tag); }
  const l=document.createElement('div'); l.className='nd-vj vjs-l'; l.innerHTML='<div class="vj-knob"></div>';
  const r=document.createElement('div'); r.className='nd-vj vjs-r'; r.innerHTML='<div class="vj-knob"></div>';
  box.appendChild(l); box.appendChild(r);
  document.body.appendChild(box);
  input.touchSeat(seatIndex).attach(l,r);
  return { dispose(){ box.remove(); } };
}
