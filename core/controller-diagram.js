/* ============================================================
   controller-diagram.js — 搖桿示意圖（Phase 7，2026-10-05）
   ------------------------------------------------------------
   不認外型，用「位置」標準化：瀏覽器只給搖桿名字和按鈕編號，不知道它長怎樣；
   同樣叫 Xbox 的手把外型就有好幾種。所以畫的是通用示意圖，不是實物圖：
     pad-asym：標準手把，左桿在上、十字鍵在下（Xbox 系排列）
     pad-sym ：標準手把，十字鍵在上、兩支桿並排在下（PS 系排列）
     rc      ：遙控器型，兩支桿＋上方一排撥桿開關＋下方一排按鈕（位置對不到實體，靠即時亮燈辨認）
   標準手把的按鈕編號是照位置排的（右手菱形最下面永遠是 0 號），所以圖上位置是準的。
   功能標籤照設定檔；按鈕按下、撥桿撥動、桿子推動都會即時顯示。
   不依賴 three.js。
   ============================================================ */
import { DEF_BTN } from './input.js';

export const SHAPES=[['pad-asym','手把（左桿在上）'],['pad-sym','手把（雙桿在下）'],['rc','遙控器']];
export const FN_LABEL={confirm:'確認',back:'返回／暫停',gear:'檔位',mode:'模式',camCycle:'視角',pilotCycle:'站位',
  action:'動作',selfLevel:'自穩',crouch:'蹲下'};
const AX_LABEL={throttle:'油門',yaw:'轉向',pitch:'前後',roll:'左右'};

/* 自動猜外型：設定檔有寫就用設定檔；不回中或非標準映射＝遙控器；名字像 PS 系＝雙桿在下 */
export function shapeFor(gp,cfg){
  if(cfg&&cfg.shape)return cfg.shape;
  if(!gp)return 'pad-asym';
  if((cfg&&cfg.throttleType==='bottom')||gp.mapping!=='standard'&&!/xinput|xbox|standard gamepad/i.test(gp.id))return 'rc';
  if(/dualsense|dualshock|wireless controller|054c|playstation/i.test(gp.id))return 'pad-sym';
  return 'pad-asym';
}
/* 各功能在這支搖桿上是哪顆鈕／哪個撥桿 → {btn:{編號:[功能…]}, ax:{軸:[功能…]}} */
export function fnMap(cfg){
  const btn={}, ax={};
  for(const fn in DEF_BTN){
    const ab=cfg?.axBtns?.find(b=>b.fn===fn);
    if(ab){ (ax[ab.ax]=ax[ab.ax]||[]).push(fn); continue; }
    const bi=cfg?.profileName?cfg.buttons?.[fn]:(cfg?.buttons?.[fn]??DEF_BTN[fn]);
    if(bi>=0)(btn[bi]=btn[bi]||[]).push(fn);
  }
  return {btn,ax};
}
const lab=fns=>fns.map(f=>FN_LABEL[f]).join('／');

const BODY='M92,62 Q260,34 428,62 Q478,72 490,200 Q496,272 452,276 Q420,276 382,218 L138,218 Q100,276 68,276 Q24,272 30,200 Q42,72 92,62 Z';
/* 標準手把各按鈕編號的位置（[x,y]）；兩種排列只差左桿和十字鍵互換 */
function padPos(shape){
  const sym=shape==='pad-sym';
  return { stickL:sym?[200,188]:[150,112], dpad:sym?[142,112]:[200,188], stickR:[320,188], face:[384,112],
    b8:[234,104], b9:[286,104] };
}

export function buildDiagram(host,{shape,gp,cfg}){
  const map=fnMap(cfg), std=gp&&gp.mapping==='standard';
  const S=[]; const T=(x,y,t,a='middle',c='#facc15',s=11)=>`<text x="${x}" y="${y}" text-anchor="${a}" fill="${c}" font-size="${s}">${t}</text>`;
  const BTN=(i,x,y,r=13)=>`<circle data-b="${i}" cx="${x}" cy="${y}" r="${r}" fill="#0e2238" stroke="#3b6a8a" stroke-width="1.5"/>`;
  const STICK=(id,x,y,R)=>`<circle cx="${x}" cy="${y}" r="${R}" fill="#06101c" stroke="#3b6a8a" stroke-width="2" data-stick="${id}"/>
    <circle id="dot${id}" data-cx="${x}" data-cy="${y}" data-r="${R-12}" cx="${x}" cy="${y}" r="11" fill="#4ade80"/>`;
  let capL='上下＝油門　左右＝轉向', capR='上下＝前後　左右＝左右', fnBased=true;
  if(shape==='rc'){
    S.push(`<rect x="40" y="70" width="440" height="170" rx="46" fill="#0b1626" stroke="#2a5c7f" stroke-width="2"/>`);
    S.push(STICK('L',150,150,44),STICK('R',370,150,44));
    // 撥桿開關：四支主軸以外的軸，一軸一格
    const used=new Set(cfg?.axes?Object.values(cfg.axes).map(a=>a.i):[0,1,2,3]);
    const extra=(gp?[...gp.axes.keys()]:[]).filter(i=>!used.has(i)).slice(0,8);
    extra.forEach((ai,k)=>{ const x=260+(k-(extra.length-1)/2)*52;
      S.push(`<rect x="${x-9}" y="20" width="18" height="40" rx="9" fill="#06101c" stroke="#3b6a8a" stroke-width="1.5" data-sw="${ai}"/>
        <circle id="sw${ai}" data-y="40" cx="${x}" cy="40" r="7" fill="#7aa3b8"/>`,
        T(x,13,(cfg?.labels?.['a'+ai]?cfg.labels['a'+ai]+'：':'')+(map.ax[ai]?lab(map.ax[ai]):(cfg?.labels?.['a'+ai]?'':'撥桿'+ai)),'middle',map.ax[ai]?'#facc15':'#5b7f95',10)); });
    // 按鈕：一顆一個圓，照編號排
    const nb=Math.min(gp?gp.buttons.length:0,16);
    for(let i=0;i<nb;i++){ const x=260+(i-(nb-1)/2)*27;
      S.push(BTN(i,x,262,9),T(x,266,i,'middle','#7aa3b8',9));
      if(map.btn[i])S.push(T(x,288+(i%2)*11,(cfg?.labels?.['b'+i]?cfg.labels['b'+i]+'：':'')+lab(map.btn[i]),'middle','#facc15',10)); }
    S.push(T(150,222,'油門／轉向','middle','#7aa3b8',10),T(370,222,'前後／左右','middle','#7aa3b8',10));
  }else{
    const P=padPos(shape);
    S.push(`<path d="${BODY}" fill="#0b1626" stroke="#2a5c7f" stroke-width="2"/>`);
    // 肩鍵（上緣）：4/5＝上排，6/7＝下排扳機
    [[6,120,6],[4,112,30],[7,322,6],[5,330,30]].forEach(([i,x,y])=>S.push(
      `<rect data-b="${i}" x="${x}" y="${y}" width="78" height="18" rx="8" fill="#0e2238" stroke="#3b6a8a" stroke-width="1.5"/>`,
      T(x+39,y+13,map.btn[i]?lab(map.btn[i]):'','middle','#facc15',10)));
    S.push(STICK('L',P.stickL[0],P.stickL[1],30),STICK('R',P.stickR[0],P.stickR[1],30));
    // 十字鍵 12 上 13 下 14 左 15 右
    const [dx,dy]=P.dpad;
    [[12,0,-17],[13,0,17],[14,-17,0],[15,17,0]].forEach(([i,ox,oy])=>S.push(
      `<rect data-b="${i}" x="${dx+ox-8}" y="${dy+oy-8}" width="16" height="16" rx="3" fill="#0e2238" stroke="#3b6a8a" stroke-width="1.5"/>`));
    const dl=[12,13,14,15].filter(i=>map.btn[i]).map(i=>'↑↓←→'[i-12]+lab(map.btn[i])).join('　');
    if(dl)S.push(T(dx,dy+40,dl,'middle','#facc15',10));
    // 右手菱形：0 下、1 右、2 左、3 上
    const [fx,fy]=P.face;
    S.push(BTN(0,fx,fy+28),BTN(1,fx+28,fy),BTN(2,fx-28,fy),BTN(3,fx,fy-28));
    if(map.btn[3])S.push(T(fx,fy-46,lab(map.btn[3])));
    if(map.btn[0])S.push(T(fx,fy+56,lab(map.btn[0])));
    if(map.btn[1])S.push(T(fx+46,fy+4,lab(map.btn[1]),'start'));
    if(map.btn[2])S.push(T(fx-46,fy+22,lab(map.btn[2]),'end'));
    // 中間兩顆 8／9
    S.push(BTN(8,P.b8[0],P.b8[1],8),BTN(9,P.b9[0],P.b9[1],8));
    if(map.btn[8])S.push(T(P.b8[0],P.b8[1]-14,lab(map.btn[8]),'middle','#facc15',10));
    if(map.btn[9])S.push(T(P.b9[0],P.b9[1]-14,lab(map.btn[9]),'middle','#facc15',10));
    // 壓桿 10／11：標在桿子旁
    if(map.btn[10])S.push(T(P.stickL[0],P.stickL[1]+46,'壓下＝'+lab(map.btn[10]),'middle','#facc15',10));
    if(map.btn[11])S.push(T(P.stickR[0],P.stickR[1]+46,'壓下＝'+lab(map.btn[11]),'middle','#facc15',10));
    // 標準映射：桿子照實體位置畫（軸 0/1＝左桿、2/3＝右桿），說明照設定寫
    if(std&&cfg?.axes){ fnBased=false;
      const cap=(ix,iy)=>{ const f=i=>{ const n=Object.keys(cfg.axes).find(k=>cfg.axes[k].i===i); return n?AX_LABEL[n]:'—'; };
        return `上下＝${f(iy)}　左右＝${f(ix)}`; };
      capL=cap(0,1); capR=cap(2,3); }
  }
  // 沒指派到搖桿上的功能 → 提醒用鍵盤
  const have=new Set([...Object.values(map.btn),...Object.values(map.ax)].flat());
  const miss=Object.keys(DEF_BTN).filter(f=>!have.has(f));
  host.innerHTML=`<svg viewBox="0 0 520 300" style="width:100%;max-width:560px;display:block;margin:0 auto;font-family:inherit">${S.join('')}</svg>
    <p class="sub" style="text-align:center;margin:4px 0 0">左桿：${capL}　｜　右桿：${capR}${fnBased&&shape!=='rc'?'':''}${shape==='rc'?'（以美國手顯示）':''}</p>
    ${miss.length?`<p class="sub" style="text-align:center;margin:2px 0 0">這支搖桿沒有指派：${miss.map(f=>FN_LABEL[f]).join('、')} → 用鍵盤按</p>`:''}`;
  const q=s=>host.querySelector(s);
  const dot=(id,x,y)=>{ const d=q('#dot'+id); if(!d)return; const r=+d.dataset.r;
    d.setAttribute('cx',+d.dataset.cx+Math.max(-1,Math.min(1,x))*r); d.setAttribute('cy',+d.dataset.cy-Math.max(-1,Math.min(1,y))*r); };
  return {
    /* 每幀呼叫：input＝InputManager（取正規化後的四軸）、gp＝目前的搖桿 */
    update(gp,input,cfg){
      if(!gp)return;
      host.querySelectorAll('[data-b]').forEach(el=>{ const on=!!gp.buttons[+el.dataset.b]?.pressed;
        el.setAttribute('fill',on?'#4ade80':'#0e2238'); });
      host.querySelectorAll('[data-sw]').forEach(el=>{ const i=+el.dataset.sw, k=q('#sw'+i), v=gp.axes[i]??0;
        if(k){ k.setAttribute('cy',40-Math.max(-1,Math.min(1,v))*11); k.setAttribute('fill',Math.abs(v)>0.3?'#4ade80':'#7aa3b8'); } });
      const ax=n=>input.gpAxis(gp,n,cfg);
      if(fnBased){ dot('L',ax('yaw'),ax('throttle')); dot('R',ax('roll'),ax('pitch')); }
      else{ // 實體位置：找出軸 0～3 各是哪個功能，用正規化後的值（方向已校正：上／右為正）
        const by=i=>{ const n=Object.keys(cfg.axes).find(k=>cfg.axes[k].i===i); return n?ax(n):0; };
        dot('L',by(0),by(1)); dot('R',by(2),by(3)); }
    }
  };
}

/* ── 小圖示（2026-10-04）：按鍵提示列用。只有標準手把有——編號就是位置，所以畫得出「哪一顆」。
   回傳一小段 SVG（行內、跟文字同高）；不是標準手把的編號回傳空字串，提示就只寫名字。 */
export function glyph(idx){
  const on='#4ade80', off='#3b6a8a', W=(c,w=18)=>`<svg viewBox="0 0 ${w} 14" width="${w}" height="14" style="vertical-align:-2px;margin-right:2px">${c}</svg>`;
  const dot=(x,y,f)=>`<circle cx="${x}" cy="${y}" r="2.6" fill="${f?on:'none'}" stroke="${f?on:off}" stroke-width="1"/>`;
  if(idx>=0&&idx<=3){ const p=[[9,11],[13.5,7],[4.5,7],[9,3]];            // 菱形四顆：0 下、1 右、2 左、3 上
    return W(p.map((q,i)=>dot(q[0],q[1],i===idx)).join('')); }
  if(idx>=4&&idx<=7){ const left=idx===4||idx===6, trig=idx>=6, x=left?1:9;     // 肩鍵：上排＝扳機、下排＝肩鍵；左或右
    const bar=(y,f,xx)=>`<rect x="${xx}" y="${y}" width="8" height="4.5" rx="2" fill="${f?on:'none'}" stroke="${f?on:off}" stroke-width="1"/>`;
    return W(bar(1.5,trig&&left,1)+bar(1.5,trig&&!left,9)+bar(8,!trig&&left,1)+bar(8,!trig&&!left,9)); }
  if(idx===8||idx===9) return W(dot(5,7,idx===8)+dot(13,7,idx===9));                 // 中間兩顆：⧉ 左、≡ 右
  if(idx===10||idx===11) return W(`<circle cx="9" cy="7" r="5.5" fill="none" stroke="${off}"/><circle cx="9" cy="7" r="2.6" fill="${on}"/>`);
  if(idx>=12&&idx<=15){ const a=(x,y,f)=>`<rect x="${x}" y="${y}" width="4" height="4" fill="${f?on:'none'}" stroke="${f?on:off}" stroke-width="1"/>`;
    return W(a(7,1,idx===12)+a(7,9,idx===13)+a(3,5,idx===14)+a(11,5,idx===15)); }  // 十字：上下左右
  return '';
}
