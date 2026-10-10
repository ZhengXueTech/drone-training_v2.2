/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   tutorial.js — 📖 飛之前的操作教學動畫（2026-10-10，親子體驗用）
   ------------------------------------------------------------
   老師定案：飛之前先看一遍；四個基本動作、穿環示範、各種裝置的按鍵（含 VR 手把）都要教。
   做法：import 就生效（challenge.js、race.js、第 2～6 關已 import）。
     · 每一位飛手（依目前的姓名）這次開瀏覽器第一次按「開始」時，先播教學，看完（或按跳過）才真的開始
     · 開始畫面多一顆「📖 操作教學」可以隨時重看
     · 動畫是 SVG：左邊兩支搖桿自己動，右邊無人機跟著做出對應動作，下面一行大字說明
   手把：A＝下一步、B＝跳過；鍵盤：Enter／→＝下一步、Esc＝跳過；也可以直接點按鈕。
   ============================================================ */
import { UI } from './ui.js';
import { getHand, toggleHand, handName, handLabel, handDesc } from './hand.js';   // 2026-10-10 美國手／日本手

const ENABLED=/\/levels\/((t0[2-9]|t1[01]|x|race)-[a-z-]+|acro-freeflight)\.html/.test(location.pathname)&&!/-pk\.html/.test(location.pathname);
function who(){ try{ const s=JSON.parse(localStorage.getItem('nd.student')||'{}'); return (s.classId||'')+'|'+(s.seat||'')+'|'+(s.name||''); }catch{ return ''; } }
const KEY=()=>'nd.tut.seen.'+who();
export function tutSeen(){
  try{ if(navigator.webdriver&&sessionStorage.getItem('nd.tut.test')!=='1')return true;   // 自動測試（Playwright）預設不播，測教學本身時才開
    return sessionStorage.getItem(KEY())==='1'; }catch{ return true; } }
function markSeen(){ try{ sessionStorage.setItem(KEY(),'1'); }catch{} }
function device(){
  if(/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent||''))return 'vr';
  try{ if([...(navigator.getGamepads?.()||[])].some(Boolean))return 'gamepad'; }catch{}
  try{ if(matchMedia('(pointer:coarse)').matches)return 'touch'; }catch{}
  return 'keyboard';
}

/* ── 教學步驟 ── */
/* 2026-10-10：依美國手／日本手換說明和動畫（油門、前後在哪一支桿）。st＝動的那支桿 L／R */
function stepsFor(h){
  const T=h==='1'?'右':'左', P=h==='1'?'左':'右';
  return [
  {k:'thr',st:T==='左'?'L':'R',title:`① ${T}手：往上推＝升高，往下拉＝降低`,sub:`${T}邊搖桿上下＝高度（油門）`},
  {k:'yaw',st:'L',title:'② 左手：往左右推＝原地轉向',sub:'左邊搖桿左右＝機頭轉過去'},
  {k:'pit',st:P==='左'?'L':'R',title:`③ ${P}手：往上推＝往前飛，往下拉＝往後退`,sub:`${P}邊搖桿上下＝前進後退`},
  {k:'rol',st:'R',title:'④ 右手：往左右推＝往左邊、右邊飛',sub:'右邊搖桿左右＝橫著移動'},
  {k:'ring',title:'⑤ 目標：穿過亮起來的環！',sub:'慢慢推、小小修正，比用力推更穩'},
  {k:'keys',title:'⑥ 你的操作方式',sub:''},
  ];
}
const VR_STEP=()=>({k:'vr',title:'⑦ VR 頭盔的手把',sub:'兩支手把的搖桿跟上面一樣：'+handDesc()});

const CSS=`#nd-tut{position:fixed;inset:0;z-index:200;background:rgba(3,8,16,.92);display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei','Share Tech Mono',sans-serif;}
#nd-tut .box{width:min(860px,94vw);background:#0b1626;border:2px solid #00eeff;border-radius:18px;padding:18px 20px;box-shadow:0 0 40px rgba(0,238,255,.25);color:#e6f7ff;}
#nd-tut h2{margin:0 0 4px;font-size:clamp(20px,3.4vw,30px);color:#facc15;text-align:center;}
#nd-tut .sub{text-align:center;color:#9fc3d8;font-size:clamp(13px,2vw,17px);min-height:22px;}
#nd-tut svg{width:100%;height:auto;display:block;margin:6px 0;}
#nd-tut .keys{font-size:clamp(14px,2.2vw,18px);line-height:1.9;padding:6px 10px;}
#nd-tut .keys b{color:#00eeff;}
#nd-tut .dots{text-align:center;margin:4px 0 10px;}
#nd-tut .dots i{display:inline-block;width:10px;height:10px;border-radius:50%;background:#1f3a55;margin:0 4px;}
#nd-tut .dots i.on{background:#00eeff;}
#nd-tut .btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
#nd-tut button{font-family:inherit;font-size:clamp(15px,2.2vw,19px);min-height:50px;min-width:120px;border-radius:12px;border:2px solid #00eeff;background:#06243a;color:#cfefff;cursor:pointer;padding:0 16px;}
#nd-tut button.main{background:#00eeff;color:#04202c;font-weight:bold;}
#nd-tut .hand{text-align:center;font-size:clamp(13px,1.9vw,16px);color:#cfefff;margin-top:4px;}
#nd-tut .hand b{color:#4ade80;}
#nd-tut .hand button{min-height:34px;min-width:0;font-size:clamp(13px,1.8vw,15px);padding:0 12px;margin-left:8px;border-width:1px;}
#nd-tut .hint{text-align:center;font-size:12px;color:#5f86a0;margin-top:8px;}`;

function svgFrame(){
  return `<svg viewBox="0 0 760 300" id="tut-svg">
  <defs><radialGradient id="tg" cx="50%" cy="40%"><stop offset="0" stop-color="#1a3550"/><stop offset="1" stop-color="#0b1626"/></radialGradient></defs>
  <rect x="10" y="20" width="330" height="250" rx="40" fill="#0e2238" stroke="#2a5a80" stroke-width="2"/>
  <g id="tL"><circle cx="95" cy="140" r="62" fill="url(#tg)" stroke="#2f6f9a" stroke-width="3"/><line x1="95" y1="84" x2="95" y2="196" stroke="#1f4766"/><line x1="39" y1="140" x2="151" y2="140" stroke="#1f4766"/>
    <circle id="kL" cx="95" cy="140" r="22" fill="#2a3f55" stroke="#9fc3d8" stroke-width="2"/><text x="95" y="236" text-anchor="middle" fill="#9fc3d8" font-size="18">左手</text></g>
  <g id="tR"><circle cx="255" cy="140" r="62" fill="url(#tg)" stroke="#2f6f9a" stroke-width="3"/><line x1="255" y1="84" x2="255" y2="196" stroke="#1f4766"/><line x1="199" y1="140" x2="311" y2="140" stroke="#1f4766"/>
    <circle id="kR" cx="255" cy="140" r="22" fill="#2a3f55" stroke="#9fc3d8" stroke-width="2"/><text x="255" y="236" text-anchor="middle" fill="#9fc3d8" font-size="18">右手</text></g>
  <path id="tArrow" d="" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round" marker-end=""/>
  <rect x="360" y="20" width="390" height="250" rx="16" fill="#08131f" stroke="#1f4766"/>
  <g id="scene"></g>
</svg>`;
}
const DRONE_SIDE=`<g><rect x="-34" y="-6" width="68" height="12" rx="6" fill="#3b82f6"/><rect x="-44" y="-12" width="22" height="4" rx="2" fill="#cfefff"/><rect x="22" y="-12" width="22" height="4" rx="2" fill="#cfefff"/><circle cx="0" cy="0" r="8" fill="#93c5fd"/></g>`;
const DRONE_TOP=`<g><line x1="-28" y1="-28" x2="28" y2="28" stroke="#3b82f6" stroke-width="7"/><line x1="-28" y1="28" x2="28" y2="-28" stroke="#3b82f6" stroke-width="7"/>
  ${[[-28,-28],[28,-28],[-28,28],[28,28]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#cfefff" stroke-width="3"/>`).join('')}
  <circle r="11" fill="#93c5fd"/><path d="M0,-44 L9,-30 L-9,-30 Z" fill="#facc15"/></g>`;

function keysHtml(dev){
  if(dev==='keyboard')return `<div class="keys">⌨ 鍵盤：<b>W／S</b>＝升高／降低　<b>A／D</b>＝轉向<br><b>↑／↓</b>＝前進／後退　<b>←／→</b>＝左右移動<br><b>Esc</b>＝暫停　<b>C</b>＝換視角</div>`;
  if(dev==='touch')return `<div class="keys">👆 觸控：畫面上有<b>兩個圓形搖桿</b>，用拇指推（${handName()}：${handDesc()}）。<br><b>⏸</b>＝暫停　<b>視角</b>＝換視角</div>`;
  if(dev==='vr')return `<div class="keys">🎮 手把：左右兩支搖桿跟上面一樣（${handName()}）。<br><b>B</b>（Xbox）／<b>○</b>（PS）＝暫停　其他按鍵在暫停選單的「🎮 按鍵圖」</div>`;
  return `<div class="keys">🎮 手把（${handName()}）：${getHand()==='1'?'<b>左搖桿</b>＝前後＋轉向　<b>右搖桿</b>＝高度＋左右':'<b>左搖桿</b>＝高度＋轉向　<b>右搖桿</b>＝前後＋左右'}<br><b>B</b>（Xbox）／<b>○</b>（PS）＝暫停　其他按鍵在暫停選單的「🎮 按鍵圖」</div>`;
}
const VR_HTML=()=>`<div class="keys">🥽 VR（${handName()}）：${getHand()==='1'?'<b>左搖桿</b>＝前後＋轉向　<b>右搖桿</b>＝高度＋左右':'<b>左搖桿</b>＝高度＋轉向　<b>右搖桿</b>＝前後＋左右'}<br><b>右扳機按住</b>＝自穩救援　<b>A</b>＝切飛行模式　<b>B</b>＝切視角（場邊／跟機）　<b>X</b>＝離開 VR<br>跟機視角比較容易暈，小朋友建議用<b>場邊視角</b>。</div>`;

/* 搖桿節奏（一輪 6 秒）：停 0.6 → 推住 1.8 → 放開停 0.6 → 反方向推住 1.8 → 放開停 1.2；推和放都用 0.3 秒滑順過去 */
function stickVal(ph){
  const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x), R=0.3;
  const seg=(a,b)=>ease((ph-a)/R)*(1-ease((ph-b)/R));
  return seg(0.6,2.4)-seg(3.0,4.8);
}
let open=false;
export function showTutorial(onDone){
  if(open)return; open=true;
  if(!document.getElementById('nd-tut-css')){ const st=document.createElement('style'); st.id='nd-tut-css'; st.textContent=CSS; document.head.appendChild(st); }
  const dev=device(); let steps;
  const mkSteps=()=>{ steps=[...stepsFor(getHand()),...(dev==='vr'?[VR_STEP()]:[])]; }; mkSteps();
  const el=document.createElement('div'); el.id='nd-tut'; document.body.appendChild(el);
  let i=0, t0=performance.now(), raf=0, gpPrev={}, st={pos:0,ph:0,last:0};
  const draw=()=>{
    const s=steps[i];
    el.innerHTML=`<div class="box"><h2>${s.title}</h2><div class="sub">${s.sub}</div>
      <div class="hand">✋ 現在是 <b>${handLabel()}</b>：${handDesc()}<button id="tut-hand">換成${getHand()==='1'?'美國手':'日本手'}</button></div>
      ${s.k==='keys'?keysHtml(dev):s.k==='vr'?VR_HTML():svgFrame()}
      <div class="dots">${steps.map((_,j)=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>
      <div class="btns">${i>0?'<button id="tut-prev">← 上一步</button>':''}
        <button id="tut-skip">跳過，開始飛</button>
        <button class="main" id="tut-next">${i<steps.length-1?'下一步 →':'🚀 開始飛！'}</button></div>
      <div class="hint">手把：A＝下一步、B＝跳過　鍵盤：Enter＝下一步、Esc＝跳過</div></div>`;
    el.querySelector('#tut-next').onclick=next; el.querySelector('#tut-skip').onclick=done;
    el.querySelector('#tut-hand').onclick=()=>{ toggleHand(); mkSteps(); draw(); };   // 遙控器是日本手的同學，在教學裡就能切
    const pv=el.querySelector('#tut-prev'); if(pv)pv.onclick=()=>{ i=Math.max(0,i-1); t0=performance.now(); draw(); };
    t0=performance.now(); st={pos:0,ph:0,last:0};
  };
  function next(){ if(i<steps.length-1){ i++; draw(); } else done(); }
  function done(){ cancelAnimationFrame(raf); removeEventListener('keydown',onKey,true); el.remove(); open=false; markSeen(); onDone&&onDone(); }
  function onKey(e){ if(e.code==='Enter'||e.code==='ArrowRight'||e.code==='Space'){ e.preventDefault(); e.stopPropagation(); next(); }
    else if(e.code==='Escape'){ e.preventDefault(); e.stopPropagation(); done(); } }
  addEventListener('keydown',onKey,true);
  /* 動畫：左右搖桿自己動，右邊場景跟著動 */
  const loop=now=>{
    raf=requestAnimationFrame(loop);
    // 手把 A／B
    try{ const gp=[...(navigator.getGamepads?.()||[])].find(Boolean); if(gp){ const a=!!gp.buttons[0]?.pressed, b=!!gp.buttons[1]?.pressed;
      if(a&&!gpPrev.a)next(); else if(b&&!gpPrev.b)done(); gpPrev={a,b}; } }catch{}
    const s=steps[i]; if(s.k==='keys'||s.k==='vr')return;
    /* 10/10 第二版（老師回饋）：搖桿改成「推住 → 放開 → 反方向推住 → 放開」的節奏，
       無人機用「推多少就一直動、放開就停住」來表現（跟真的飛一樣），兩邊時間完全同步；前後、左右改成從上面看。 */
    const t=(now-t0)/1000, dt=Math.min(0.05,Math.max(0,(now-(st.last||now))/1000)); st.last=now;
    const P=6, ph=t%P; if(ph<st.ph){ st.pos=0; } st.ph=ph;            // 每一輪從原點重來，不會越飄越遠
    const w=stickVal(ph);
    const kL=el.querySelector('#kL'), kR=el.querySelector('#kR'), sc=el.querySelector('#scene');
    if(!kL||!sc)return;
    let lx=0,ly=0,rx=0,ry=0;
    if(s.k==='thr'||s.k==='pit'){ if(s.st==='L')ly=w; else ry=w; } else if(s.k==='yaw')lx=w; else if(s.k==='rol')rx=w;
    else if(s.k==='ring'){ if(getHand()==='1')ly=0.6; else ry=0.6; lx=0.35*Math.sin(t*0.9); }
    const act=Math.abs(w)>0.08, onL=s.st==='L', onR=s.st==='R';
    kL.setAttribute('cx',95+lx*40); kL.setAttribute('cy',140-ly*40); kR.setAttribute('cx',255+rx*40); kR.setAttribute('cy',140-ry*40);
    kL.setAttribute('fill',(s.k==='ring'||(onL&&act))?'#00eeff':'#2a3f55'); kR.setAttribute('fill',(s.k==='ring'||(onR&&act))?'#00eeff':'#2a3f55');
    el.querySelector('#tL').setAttribute('opacity',(onL||s.k==='ring')?1:0.35); el.querySelector('#tR').setAttribute('opacity',(onR||s.k==='ring')?1:0.35);
    const SPD={thr:42,yaw:55,pit:46,rol:70}[s.k]||0; st.pos+=w*SPD*dt;
    const cx=555, cy=145, stopTxt=`<tspan fill="#7aa3b8">放開＝停在那裡</tspan>`; let g='';
    const lab=(a,b)=>w>0.08?a:w<-0.08?b:(ph>1&&ph<P-0.3?stopTxt:'');
    const TOPBG=`<text x="372" y="40" fill="#5f86a0" font-size="15">從上面看（機頭朝上）</text><circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="#1f4766" stroke-dasharray="4 6"/>`;
    if(s.k==='thr'){ const y=cy+20-st.pos; g=`<line x1="380" y1="250" x2="730" y2="250" stroke="#2f5d3a" stroke-width="3"/><text x="372" y="40" fill="#5f86a0" font-size="15">側面看</text>
        <line x1="${cx}" y1="250" x2="${cx}" y2="${y+10}" stroke="#1f4766" stroke-dasharray="4 6"/><g transform="translate(${cx},${y})">${DRONE_SIDE}</g>
        <text x="${cx+70}" y="${y+6}" fill="#facc15" font-size="22">${lab('⬆ 升高','⬇ 降低')}</text>`; }
    else if(s.k==='yaw'){ g=`<text x="372" y="40" fill="#5f86a0" font-size="15">從上面看</text><circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#1f4766" stroke-dasharray="5 7"/>
        <g transform="translate(${cx},${cy}) rotate(${st.pos})">${DRONE_TOP}</g><text x="${cx}" y="262" text-anchor="middle" fill="#facc15" font-size="20">${lab('↻ 機頭往右轉','↺ 機頭往左轉')}</text>`; }
    else if(s.k==='pit'){ const y=cy-st.pos; g=`${TOPBG}<g transform="translate(${cx},${y}) scale(0.8)">${DRONE_TOP}</g>
        <text x="${cx+70}" y="${y+7}" fill="#facc15" font-size="22">${lab('⬆ 往前飛','⬇ 往後退')}</text>`; }
    else if(s.k==='rol'){ const x=cx+st.pos; g=`${TOPBG}<g transform="translate(${x},${cy}) scale(0.8)">${DRONE_TOP}</g>
        <text x="${cx}" y="252" text-anchor="middle" fill="#facc15" font-size="22">${lab('往右飛 ➡','⬅ 往左飛')}</text>`; }
    else if(s.k==='ring'){ const T=t*0.35%1, ang=T*Math.PI*2, R=88, px=cx+Math.sin(ang)*R*1.5, py=cy-Math.cos(ang)*R*0.95;
        const rs=[0,0.25,0.5,0.75].map((u,j)=>{ const a=u*Math.PI*2, x=cx+Math.sin(a)*R*1.5, y=cy-Math.cos(a)*R*0.95, nxt=Math.floor(T*4+1)%4===j;
          return `<ellipse cx="${x}" cy="${y}" rx="${nxt?16:12}" ry="${nxt?26:20}" fill="none" stroke="${nxt?'#00ffcc':'#1f6f66'}" stroke-width="${nxt?5:3}" transform="rotate(${a*57.3+90} ${x} ${y})"/>`; }).join('');
        g=`<text x="372" y="40" fill="#5f86a0" font-size="15">從上面看</text><ellipse cx="${cx}" cy="${cy}" rx="${R*1.5}" ry="${R*0.95}" fill="none" stroke="#1f4766" stroke-dasharray="5 8"/>${rs}
        <g transform="translate(${px},${py}) rotate(${ang*57.3+90}) scale(0.6)">${DRONE_TOP}</g>`; }
    sc.innerHTML=g;
  };
  draw(); raf=requestAnimationFrame(loop);
}

/* ── 掛到開始畫面：多一顆「📖 操作教學」；這位飛手這次第一次按開始時先播 ── */
if(ENABLED){
  const _show=UI.prototype.showModal;
  const START=/^(b-go|b-start|b-easy|b-med|b-hard|b-diff-.+)$/;
  UI.prototype.showModal=function(args){
    const btns=args.buttons||[], e=globalThis.__ndEngine;
    if(!(e&&e.simStarted)&&btns.some(b=>START.test(b.id))&&!btns.some(b=>b.id==='b-tut')){
      const nb=btns.map(b=>START.test(b.id)&&b.onClick?{...b,onClick:()=>{ if(open)return; if(tutSeen())return b.onClick(); showTutorial(()=>b.onClick()); }}:b);
      nb.push({id:'b-tut',label:'📖 操作教學',onClick:()=>showTutorial(null)});
      const r=_show.call(this,{...args,buttons:nb});
      if(!this._navAdded)this._navAdded=[];
      if(!this._navAdded.includes('b-tut'))this._navAdded=[...this._navAdded,'b-tut'];
      return r;
    }
    return _show.call(this,args);
  };
  // 教學播放時，手把的確認／移動不要點到後面的開始畫面
  for(const m of ['gpConfirm','gpNav']){ const f=UI.prototype[m]; if(f)UI.prototype[m]=function(...a){ if(open)return; return f.apply(this,a); }; }
}
