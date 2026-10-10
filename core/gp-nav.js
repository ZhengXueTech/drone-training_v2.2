/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   gp-nav.js — 選單頁的搖桿操作（2026-10-06，規劃書附錄 E.2／F.1）
   ------------------------------------------------------------
   老師回饋：網頁很多功能用滑鼠點沒問題，用手把就選不到；遙控器按鈕少，確認和取消很難按。
   · 右搖桿（或十字鍵）移動「選取框」：往哪邊推，就跳到那個方向最近的一個可以點的東西。
   · 確認＝A 鍵，或左搖桿往右推住半秒；返回＝B 鍵，或左搖桿往左推住半秒（core/gp-hold.js）。
   · 下拉選單：確認進入 → 右搖桿上下選 → 確認（或往右推住）套用、返回（或往左推住）取消。
   · 文字輸入框選得到，但打字還是要鍵盤或觸控（登入只在上課一開始做一次）。
   用法：頁面加一行  <script type="module" src="…/core/gp-nav-boot.js"></script>  ——有接搖桿才會載入這個檔。
   關卡裡的選單（開場、暫停、結算）是 core/ui.js 自己的焦點系統，不走這裡。
   ============================================================ */
import { InputManager, gpCfgRead, gpCarryMark } from './input.js';
import { YawHold } from './gp-hold.js';

const input=new InputManager({backPauses:false});
const hold=new YawHold();
const SEL='a[href],button,select,input:not([type=hidden]),textarea,[data-gpnav]';
const OVERLAYS='.nd-gpnav-pop,.id-gate-bg,.nd-modal-bg,[data-gpnav-modal]';
let cur=null, active=false, pop=null, last=performance.now();
const rep={x:{armed:false,t:0,r:0},y:{armed:false,t:0,r:0}};   // 一開始要先回中才算：換頁時還推著的搖桿不會在新頁面多跳一格

const css=document.createElement('style');
css.textContent=`.gpnav-focus{outline:4px solid #fff!important;outline-offset:3px!important;box-shadow:0 0 0 7px rgba(0,238,255,.35)!important;position:relative;z-index:2;}
a.card.gpnav-focus{transform:scale(1.03);}
.nd-gpnav-pop{position:fixed;inset:0;z-index:9400;background:rgba(2,6,12,.8);display:flex;align-items:center;justify-content:center;font-family:Consolas,'Microsoft JhengHei',monospace;}
.nd-gpnav-pop .box{background:#0b1626;border:2px solid #00eeff;border-radius:12px;padding:10px;max-height:80vh;overflow:auto;min-width:240px;max-width:90vw;}
.nd-gpnav-pop .opt{padding:10px 16px;border-radius:8px;color:#cfefff;font-size:16px;cursor:pointer;}
.nd-gpnav-pop .opt.on{background:#fff;color:#06121f;font-weight:bold;}
.nd-gpnav-pop .tip{font-size:12px;color:#7aa3b8;padding:8px 8px 2px;text-align:center;}`;
document.head.appendChild(css);

function scope(){ const o=[...document.querySelectorAll(OVERLAYS)].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed'); return o.length?o[o.length-1]:document; }
function visible(el){
  if(el.disabled||el.getAttribute('aria-hidden')==='true')return false;
  const r=el.getBoundingClientRect(); if(r.width<4||r.height<4)return false;
  const s=getComputedStyle(el); if(s.visibility==='hidden'||s.display==='none'||s.pointerEvents==='none')return false;
  if(el.matches('a.card.locked'))return false;
  return true;
}
const items=()=>[...scope().querySelectorAll(SEL)].filter(visible);
function setFocus(el){
  if(cur&&cur!==el)cur.classList.remove('gpnav-focus');
  cur=el||null;
  if(cur){ cur.classList.add('gpnav-focus'); try{ cur.scrollIntoView({block:'nearest',inline:'nearest'}); }catch{} }
}
function ensureFocus(){
  const list=items();
  if(cur&&list.includes(cur)){ if(!cur.classList.contains('gpnav-focus'))cur.classList.add('gpnav-focus'); return; }
  const h=location.hash&&document.getElementById(location.hash.slice(1));
  setFocus((h&&list.includes(h))?h:(list.find(e=>e.matches('a.card'))||list[0]||null));
}
/* 往 (dx,dy) 方向找最近的一個：主方向的距離＋3 倍的側向偏移，偏太多的不算 */
function move(dx,dy){
  const list=items(); if(!list.length)return;
  if(!cur||!list.includes(cur)){ ensureFocus(); return; }
  const a=cur.getBoundingClientRect(), ax=a.left+a.width/2, ay=a.top+a.height/2;
  let best=null, bs=1e12;
  for(const el of list){ if(el===cur)continue;
    const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    // 用邊到邊的距離當主方向距離：大卡片旁邊的小按鈕才不會被跳過
    const main=dx?(dx>0?r.left-a.right:a.left-r.right):(dy>0?r.top-a.bottom:a.top-r.bottom);
    const cen=dx?(x-ax)*dx:(y-ay)*dy; if(cen<=1)continue;
    const side=dx?Math.max(0,Math.max(r.top-a.bottom,a.top-r.bottom)):Math.max(0,Math.max(r.left-a.right,a.left-r.right));
    const off=dx?Math.abs(y-ay):Math.abs(x-ax);
    const s=Math.max(0,main)+side*4+off*0.6;
    if(s<bs){ bs=s; best=el; }
  }
  if(best)setFocus(best);
}
function openSelect(sel){
  const opts=[...sel.options].filter(o=>!o.disabled); if(!opts.length)return;
  let i=Math.max(0,opts.findIndex(o=>o.value===sel.value&&o.index===sel.selectedIndex));
  const bg=document.createElement('div'); bg.className='nd-gpnav-pop';
  bg.innerHTML=`<div class="box">${opts.map((o,k)=>`<div class="opt" data-k="${k}"></div>`).join('')}<div class="tip">右搖桿上下選　A 或左搖桿→推住＝確認　B 或←推住＝取消</div></div>`;
  opts.forEach((o,k)=>{ bg.querySelector(`[data-k="${k}"]`).textContent=o.textContent; });
  document.body.appendChild(bg);
  const paint=()=>bg.querySelectorAll('.opt').forEach((e,k)=>{ e.classList.toggle('on',k===i); if(k===i)try{ e.scrollIntoView({block:'nearest'}); }catch{} });
  paint();
  const close=()=>{ bg.remove(); pop=null; hold.reset(); };
  pop={ nav(d){ i=(i+d+opts.length)%opts.length; paint(); },
        ok(){ const o=opts[i]; close(); if(sel.selectedIndex!==o.index){ sel.selectedIndex=o.index; sel.dispatchEvent(new Event('input',{bubbles:true})); sel.dispatchEvent(new Event('change',{bubbles:true})); } },
        cancel:close };
  bg.addEventListener('click',e=>{ const k=e.target.closest('.opt')?.dataset.k; if(k!=null){ i=+k; pop.ok(); } else if(e.target===bg)close(); });
}
function confirm(){
  if(pop)return pop.ok();
  ensureFocus(); if(!cur)return;
  if(cur.tagName==='SELECT')return openSelect(cur);
  if(cur.tagName==='TEXTAREA'||(cur.tagName==='INPUT'&&!/^(button|submit|checkbox|radio|range|color|file)$/i.test(cur.type))){ try{ cur.focus(); }catch{} return; }
  cur.click();
}
function back(){
  if(pop)return pop.cancel();
  const sc=scope();
  const b=(sc!==document&&sc.querySelector('[data-gpnav-back],[id$="cancel"],#ig-skip'))
    ||document.querySelector('[data-gpnav-back]')
    ||[...document.querySelectorAll('a[href]')].find(a=>/index\.html(#.*)?$/.test(a.getAttribute('href'))&&/回首頁|返回入口|返回/.test(a.textContent)&&visible(a));
  if(b)b.click();
}
function fire(v,k,dt){
  const m=rep[k];
  if(Math.abs(v)>0.55){
    if(m.armed){ m.armed=false; m.t=0; m.r=0; return Math.sign(v); }
    m.t+=dt; if(m.t>0.4){ m.r+=dt; if(m.r>0.16){ m.r=0; return Math.sign(v); } }
  }else if(Math.abs(v)<0.3)m.armed=true;
  return 0;
}
function tick(){
  requestAnimationFrame(tick);
  const now=performance.now(), dt=Math.min(0.1,(now-last)/1000); last=now;
  const gp=input.gamepads()[0];
  if(!gp){ hold.reset(); return; }
  const cfg=gpCfgRead(gp);
  let x=input.gpAxis(gp,'roll',cfg), y=-input.gpAxis(gp,'pitch',cfg);          // 畫面座標：往下為正
  if(gp.buttons[12]?.pressed)y=-1; if(gp.buttons[13]?.pressed)y=1;
  if(gp.buttons[14]?.pressed)x=-1; if(gp.buttons[15]?.pressed)x=1;
  const yaw=input.gpAxis(gp,'yaw',cfg);
  let ok=false, bk=false;
  if(cfg&&cfg.profileName){ ok=input.gpFnEdge(gp,'confirm',cfg); bk=input.gpFnEdge(gp,'back',cfg); }
  else{ ok=input.gpBtnEdge(gp,0); bk=input.gpBtnEdge(gp,1); }
  const fx=fire(x,'x',dt), fy=fire(y,'y',dt);
  if(!active&&(fx||fy||ok||bk||Math.abs(yaw)>0.6)){ active=true; ensureFocus(); if(fx||fy)return; }   // 第一下只叫出選取框
  if(!active)return;
  if(pop){ if(fy)pop.nav(fy); }
  else{ if(fx)move(fx,0); if(fy)move(0,fy); if(!cur||!cur.isConnected||!visible(cur))ensureFocus(); }
  const h=hold.step(yaw,dt);
  if(ok||h==='confirm'){ gpCarryMark(); confirm(); } else if(bk||h==='back'){ gpCarryMark(); back(); }
}
// 改用滑鼠時先把選取框收起來，搖桿一動再出現
addEventListener('mousemove',()=>{ if(active&&!pop){ active=false; if(cur)cur.classList.remove('gpnav-focus'); } },{passive:true});
requestAnimationFrame(tick);
export const _debug={items,move,confirm,back,focus:setFocus,get cur(){ return cur; }};
