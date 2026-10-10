/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   stick-guide.js — 搖桿精靈的「示範＋範圍」面板（2026-10-07）
   ------------------------------------------------------------
   老師回饋：前面幾步只有文字，學生不知道要動哪一支、往哪推；也看不到搖桿推到哪、有沒有回中。
   這個面板畫兩個圓形搖桿區（左手／右手，以美國手顯示）：
     · 示範：半透明的「示範搖桿」重複做一次這一步要做的動作，要動的那一支會發亮、另一支變暗。
     · 即時：亮點跟著實體搖桿走（精靈已經認出來的軸才會動；正在認的那一軸照「要求的方向」顯示推了多少）。
     · 範圍：推過的最遠處會留下外框，四個方向各推到幾 % 寫在旁邊；放開後回到中心小圈＝「已歸位」。
     · 停住進度：外圈一圈進度條，轉滿＝抓到了。
   只畫圖，不讀搖桿、不碰設定檔；數值由精靈頁每幀餵進來。不依賴 three.js。
   ============================================================ */
const SEC=32, R=60;
const PADS={L:{cx:140,cy:112,hand:'左手'},R:{cx:380,cy:112,hand:'右手'}};
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));

export function createStickGuide(host,opt={}){
  const pad=(id)=>{ const p=PADS[id]; return `<g id="sg-pad${id}" data-pad="${id}">
      <circle cx="${p.cx}" cy="${p.cy}" r="${R+9}" fill="none" stroke="#1c3a52" stroke-width="5"/>
      <circle id="sg-hold${id}" cx="${p.cx}" cy="${p.cy}" r="${R+9}" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="0 999" transform="rotate(-90 ${p.cx} ${p.cy})"/>
      <circle id="sg-base${id}" cx="${p.cx}" cy="${p.cy}" r="${R}" fill="#06101c" stroke="#3b6a8a" stroke-width="2"/>
      <line x1="${p.cx-R}" y1="${p.cy}" x2="${p.cx+R}" y2="${p.cy}" stroke="#1c3a52"/><line x1="${p.cx}" y1="${p.cy-R}" x2="${p.cx}" y2="${p.cy+R}" stroke="#1c3a52"/>
      <path id="sg-trace${id}" d="" fill="rgba(0,238,255,.10)" stroke="#00eeff" stroke-width="1.5" stroke-linejoin="round"/>
      <circle id="sg-dead${id}" cx="${p.cx}" cy="${p.cy}" r="9" fill="none" stroke="#5b7f95" stroke-dasharray="3 3"/>
      <path id="sg-arrow${id}" d="" stroke="#facc15" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
      <circle id="sg-ghost${id}" cx="${p.cx}" cy="${p.cy}" r="15" fill="rgba(250,204,21,.28)" stroke="#facc15" stroke-width="2" stroke-dasharray="4 3" opacity="0"/>
      <circle id="sg-dot${id}" cx="${p.cx}" cy="${p.cy}" r="11" fill="#4ade80"/>
      <text x="${p.cx}" y="${p.cy+R+30}" text-anchor="middle" fill="#cfefff" font-size="14">✋ ${p.hand}</text>
      <text id="sg-cap${id}" x="${p.cx}" y="${p.cy+R+48}" text-anchor="middle" fill="#7aa3b8" font-size="11"></text>
      <text id="sg-pct${id}" x="${p.cx}" y="${p.cy-R-16}" text-anchor="middle" fill="#7aa3b8" font-size="11"></text>
    </g>`; };
  host.innerHTML=`<svg id="sg-svg" viewBox="0 0 520 240" style="width:100%;max-width:560px;display:block;margin:6px auto 0;font-family:inherit">
      <rect x="24" y="14" width="472" height="196" rx="60" fill="#0b1626" stroke="#2a5c7f" stroke-width="2"/>${pad('L')}${pad('R')}</svg>
    <p class="sub" id="sg-note" style="text-align:center;margin:2px 0 0"></p>`;
  const q=s=>host.querySelector(s);
  const ext={L:new Array(SEC).fill(0),R:new Array(SEC).fill(0)}, reach={L:{u:0,d:0,l:0,r:0},R:{u:0,d:0,l:0,r:0}};
  let demo=null, t0=performance.now(), showPct=!!opt.pct;
  const pos=(id,x,y)=>[PADS[id].cx+clamp(x)*(R-13), PADS[id].cy-clamp(y)*(R-13)];
  function trace(id){
    const e=ext[id]; if(!e.some(v=>v>0.12)){ q('#sg-trace'+id).setAttribute('d',''); return; }
    q('#sg-trace'+id).setAttribute('d',e.map((r,i)=>{ const a=i/SEC*Math.PI*2, [px,py]=pos(id,Math.cos(a)*r,Math.sin(a)*r); return (i?'L':'M')+px.toFixed(1)+','+py.toFixed(1); }).join('')+'Z');
  }
  return {
    /* 這一步的示範：pad＝要動哪一支（'L'／'R'／null＝兩支都放開），path＝示範搖桿依序走過的位置（-1～1），caps＝兩支桿下面的小字 */
    setDemo(d){ demo=d||null; t0=performance.now();
      for(const id of ['L','R']){ const act=!demo||!demo.pad||demo.pad===id;
        q('#sg-pad'+id).setAttribute('opacity',act?1:0.38);
        q('#sg-base'+id).setAttribute('stroke',demo&&demo.pad===id?'#facc15':'#3b6a8a');
        q('#sg-base'+id).setAttribute('stroke-width',demo&&demo.pad===id?3:2);
        q('#sg-cap'+id).textContent=(demo&&demo.caps&&demo.caps[id])||'';
        q('#sg-ghost'+id).setAttribute('opacity',0); q('#sg-arrow'+id).setAttribute('opacity',0); }
      q('#sg-note').textContent=(demo&&demo.note)||''; },
    clearTrace(){ for(const id of ['L','R']){ ext[id].fill(0); reach[id]={u:0,d:0,l:0,r:0}; trace(id); } },
    reach(){ return reach; },
    /* 每幀：v＝{L:{x,y},R:{x,y}}（-1～1，右、上為正）；hold＝0～1 停住進度；centerY＝{L:false} 表示那支桿的上下不檢查回中（油門不回中） */
    update(v,o={}){
      const now=performance.now();
      for(const id of ['L','R']){
        const p=v[id]||{x:0,y:0}, x=clamp(p.x||0), y=clamp(p.y||0), [px,py]=pos(id,x,y);
        const d=q('#sg-dot'+id); d.setAttribute('cx',px); d.setAttribute('cy',py);
        const noY=o.centerY&&o.centerY[id]===false, off=Math.hypot(x,noY?0:y), home=off<0.14;
        d.setAttribute('fill',home?'#4ade80':'#00eeff');
        q('#sg-dead'+id).setAttribute('stroke',home?'#4ade80':'#5b7f95');
        // 範圍外框與四向百分比
        const m=Math.hypot(x,y);
        if(m>0.12){ const a=(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2), i=Math.round(a/(Math.PI*2)*SEC)%SEC, r=Math.min(1,m);
          let ch=false; for(const k of [i-1,i,i+1]){ const j=(k+SEC)%SEC; if(r>ext[id][j]){ ext[id][j]=k===i?r:Math.max(ext[id][j],r*0.96); ch=true; } }
          if(ch&&showPct)trace(id); }      // 範圍外框只在「範圍檢查」畫；前面幾步只認一個方向，畫出來是一條怪線
        const rc=reach[id]; rc.u=Math.max(rc.u,y); rc.d=Math.max(rc.d,-y); rc.r=Math.max(rc.r,x); rc.l=Math.max(rc.l,-x);
        if(showPct){ const f=n=>Math.round(Math.min(1,n)*100), any=rc.u+rc.d+rc.l+rc.r>0.5;
          q('#sg-pct'+id).textContent=any?`↑${f(rc.u)}  ↓${f(rc.d)}  ←${f(rc.l)}  →${f(rc.r)} %`:'';
          q('#sg-cap'+id).textContent=home?(noY?'✓ 左右已歸位（油門不會回中）':'✓ 已歸位'):'放開看看有沒有回到中心';
          q('#sg-cap'+id).setAttribute('fill',home?'#4ade80':'#7aa3b8'); }
        // 停住進度
        const act=demo&&demo.pad===id, h=act?clamp(o.hold||0,0,1):0, C=2*Math.PI*(R+9);
        q('#sg-hold'+id).setAttribute('stroke-dasharray',h>0?`${(C*h).toFixed(1)} ${C.toFixed(1)}`:'0 999');
        // 示範搖桿：沿 path 走，每 2.2 秒一輪；學生已經在推（亮點離開中心）就淡掉，不擋視線
        const g=q('#sg-ghost'+id), ar=q('#sg-arrow'+id);
        if(act&&demo.path&&demo.path.length>1){
          const T=2200, u=((now-t0)%T)/T, n=demo.path.length-1, f=Math.min(u/0.78,1)*n, k=Math.min(n-1,Math.floor(f)), w=f-k;
          const A=demo.path[k], B=demo.path[k+1], gx=A[0]+(B[0]-A[0])*w, gy=A[1]+(B[1]-A[1])*w, [qx,qy]=pos(id,gx,gy);
          g.setAttribute('cx',qx); g.setAttribute('cy',qy); g.setAttribute('opacity',m>0.35?0.25:0.95);
          const E=demo.path[n], [ex,ey]=pos(id,E[0]*1.02,E[1]*1.02), [sx,sy]=pos(id,demo.path[n-1][0]*0.2,demo.path[n-1][1]*0.2), an=Math.atan2(ey-sy,ex-sx);
          ar.setAttribute('d',`M${sx},${sy} L${ex},${ey} M${ex},${ey} L${ex-11*Math.cos(an-0.5)},${ey-11*Math.sin(an-0.5)} M${ex},${ey} L${ex-11*Math.cos(an+0.5)},${ey-11*Math.sin(an+0.5)}`);
          ar.setAttribute('opacity',m>0.35?0.2:0.55);
        }else if(demo&&!demo.pad&&demo.pulse){       // 兩支都放開：示範圈在中心一呼一吸
          g.setAttribute('cx',PADS[id].cx); g.setAttribute('cy',PADS[id].cy); g.setAttribute('opacity',0.35+0.45*Math.abs(Math.sin(now/450))); ar.setAttribute('opacity',0);
        }
      }
    }
  };
}
