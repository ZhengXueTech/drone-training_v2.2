/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   owner.js — 這台裝置上的成績「是誰的」（2026-10-06）
   ------------------------------------------------------------
   問題：平板不像電腦教室有還原卡。甲同學飛完、乙同學在同一台登入，平板裡還留著甲的紀錄，
        乙之後飛同一關時，甲的最佳成績會被併進去、當成乙的傳上雲端。
   做法：本機的進度（nd.progress.*）和徽章（nd.badges）永遠只放「目前這個人」的；
        換人時把前一位的收進 nd.stash.<身分>，再把新的人以前留在這台的拿出來。誰的資料都不會不見。
   身分鍵：有班級＋座號 → 「學校|班級|座號」（座號去掉前面的 0）；只有姓名 → 「name:姓名」；都沒有 → anon。
   不算換人的情況：還沒有身分（anon）→ 填了身分；只有姓名的人改姓名（修正錯字）；
              訪客時填了班級座號但沒有學校（還沒選老師），之後用同班級座號登入；
              只填姓名（離線按「先不登入」）的人，之後用同一個姓名登入班級座號（認領自己離線時的成績）。
   不依賴其他檔案；progress.js 和 cloud-sync.js 都用這一份。
   ============================================================ */
const OWNER='nd.owner', STASH='nd.stash.', P='nd.progress.', B='nd.badges';
const rd=k=>{ try{ return localStorage.getItem(k); }catch{ return null; } };

let _strict=false;
/* 活動版（多人輪流用同一台、只填姓名）：姓名不一樣就當成換人，不當成改錯字 */
export function ownerStrict(on){ _strict=!!on; }
export function ownerKeyOf(s){
  if(!s)return 'anon';
  const cls=String(s.classId||'').trim(), seat=String(s.seat||'').trim(), name=String(s.name||'').trim();
  if(cls&&seat)return [String(s.school||'').trim(),cls,/^\d+$/.test(seat)?String(+seat):seat].join('|');
  return name?'name:'+name:'anon';
}
export function currentOwner(){
  let cur=rd(OWNER);
  if(cur===null){            // 舊版留下來的資料：算在目前登記的那個人頭上
    let s=null; try{ s=JSON.parse(rd('nd.student')||'null'); }catch{}
    cur=ownerKeyOf(s); try{ localStorage.setItem(OWNER,cur); }catch{}
  }
  return cur;
}
/* 換成 next 這個身分。真的換了人才回傳 true（此時本機進度已經換成 next 的）。 */
export function switchOwner(next,name){
  const cur=currentOwner();
  if(cur===next)return false;
  const rename=cur==='anon'||(cur.startsWith('name:')&&((next.startsWith('name:')&&!_strict)||cur==='name:'+String(name||'').trim()))
    ||(cur.startsWith('|')&&next.endsWith(cur));      // 訪客時沒有學校可填（還沒選老師），之後用同班級同座號登入＝同一個人
  try{
    if(!rename){
      const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&(k.startsWith(P)||k===B))keys.push(k); }
      const bag={}; keys.forEach(k=>{ bag[k]=localStorage.getItem(k); });
      if(keys.length)localStorage.setItem(STASH+cur,JSON.stringify(bag));
      keys.forEach(k=>localStorage.removeItem(k));
      const back=rd(STASH+next);
      if(back){ const o=JSON.parse(back); for(const k in o)if(k.startsWith(P)||k===B)localStorage.setItem(k,o[k]); localStorage.removeItem(STASH+next); }
      try{ sessionStorage.removeItem('nd.exam'); }catch{}      // 上一位的考核狀態不能帶給下一位
    }
    localStorage.setItem(OWNER,next);
  }catch{ return false; }
  return !rename;
}
