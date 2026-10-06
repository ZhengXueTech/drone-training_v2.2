/* ============================================================
   debug-overlay.js — 診斷小視窗（2026-10-06）
   ------------------------------------------------------------
   老師回報：平板上機體看起來比電腦小很多，3 倍也沒有預期的大；模擬環境重現不出來，需要實機的數字。
   開啟：首頁網址後面加 ?debug=1（會記在這台裝置，之後每一關都顯示）；關閉：?debug=0。
   顯示：每秒格數、螢幕與畫布尺寸、像素比、鏡頭視角與長寬比、鏡頭離機體幾公尺、機體大小設定。
   只讀不改，沒開的時候這個檔完全不會載入。
   ============================================================ */
const el=document.createElement('div');
el.id='nd-debug';
el.style.cssText='position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:9600;pointer-events:none;background:rgba(0,0,0,.82);color:#7CFC00;border:1px solid #7CFC00;border-radius:6px;padding:6px 10px;font:12px/1.5 Consolas,monospace;white-space:pre;text-align:left;';
document.body.appendChild(el);
let n=0, t0=performance.now(), fps=0, worst=0, last=performance.now();
function tick(){
  requestAnimationFrame(tick);
  const now=performance.now(); n++; worst=Math.max(worst,now-last); last=now;
  if(now-t0<500)return;
  fps=n*1000/(now-t0); n=0; t0=now;
  const e=globalThis.__ndEngine, c=globalThis.__ndCamDbg||{}, cv=document.querySelector('canvas');
  let scale='?', style='?'; try{ scale=localStorage.getItem('nd.settings.droneVisualScale')||'1（預設）'; style=localStorage.getItem('nd.settings.droneStyle')||'（預設）'; }catch{}
  const cam=e&&e.camera;
  el.textContent=
    `格數 ${fps.toFixed(0)} fps（最慢一格 ${worst.toFixed(0)} ms）\n`+
    `螢幕 ${innerWidth}×${innerHeight}　像素比 ${devicePixelRatio}　${matchMedia('(pointer:coarse)').matches?'觸控':'滑鼠'}\n`+
    `畫布 顯示 ${cv?cv.clientWidth+'×'+cv.clientHeight:'?'}　實際 ${cv?cv.width+'×'+cv.height:'?'}\n`+
    `鏡頭 視角 ${cam?cam.fov:'?'}°　長寬比 ${cam?cam.aspect.toFixed(3):'?'}　模式 ${c.mode||'?'}\n`+
    `鏡頭離機體 ${c.dist!=null?c.dist.toFixed(2)+' m':'?'}　機體佔畫面高 ${c.dist&&cam?(100*(1.0*(parseFloat(scale)||1))/(2*c.dist*Math.tan(cam.fov*Math.PI/360))).toFixed(1)+'%（估）':'?'}\n`+
    `機體大小設定 ${scale}　樣式 ${style}`;
  worst=0;
}
requestAnimationFrame(tick);
