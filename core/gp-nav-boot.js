/* gp-nav-boot.js — 有接搖桿才載入選單的搖桿操作（core/gp-nav.js），沒接的電腦不多花任何資源。2026-10-06 */
let loaded=false;
const load=()=>{ if(loaded)return; loaded=true; import('./gp-nav.js').catch(()=>{ loaded=false; }); };
const has=()=>{ try{ return [...(navigator.getGamepads?.()||[])].some(Boolean); }catch{ return false; } };
if(has())load();
addEventListener('gamepadconnected',load);
// 有些瀏覽器要按過搖桿才回報：每秒看一次，載入後就停
const t=setInterval(()=>{ if(loaded)clearInterval(t); else if(has())load(); },1000);
