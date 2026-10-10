/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   local-sync.js — 把成績交給老師的電腦（2026-10-07）
   ------------------------------------------------------------
   平板連到老師筆電上課時（core/cloud-api.js 的 localMode()），成績不直接找雲端，
   而是 POST 給筆電的 /local/record（tools/serve.py 的成績收件匣）。同一個熱點裡，不用網路。
   送不出去（筆電暫時沒回應）就留在這台的佇列，下次再送。之後老師在筆電的「成績收件匣」頁一鍵上傳雲端。
   ============================================================ */
import { localUrl } from '../core/cloud-api.js';
const Q='nd.local.queue', MAX=300;
const get=()=>{ try{ return JSON.parse(localStorage.getItem(Q)||'[]'); }catch{ return []; } };
const set=v=>{ try{ localStorage.setItem(Q,JSON.stringify(v)); }catch{} };
let _busy=false, _err='', _subs=[];
const emit=()=>_subs.forEach(f=>{ try{ f(); }catch{} });
export function onLocalStatus(f){ _subs.push(f); }
export function localStatus(){ return {pending:get().length,error:_err}; }
export function localEnqueue(who,levelId,result,merged,badges){
  if(!who||!who.name)return;
  const q=get();
  q.push({who:{school:who.school||'',classId:who.classId||'',seat:who.seat||'',name:who.name},levelId,
    score:typeof result.score==='number'?result.score:null,completed:!!result.completed,challenge:result.challenge||'標準',
    progress:merged,badges:(badges||[]).map(b=>({id:b.id,emoji:b.emoji,name:b.name,earnedAt:b.earnedAt})),at:new Date().toISOString()});
  while(q.length>MAX)q.shift();
  set(q); emit(); localFlush();
}
export async function localFlush(){
  if(_busy)return; _busy=true;
  try{
    for(;;){
      const q=get(); if(!q.length)break;
      let r=null;
      try{ const ac=new AbortController(), t=setTimeout(()=>ac.abort(),6000);
        const res=await fetch(localUrl('record'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(q[0]),signal:ac.signal});
        clearTimeout(t); r=await res.json(); }catch{ r=null; }
      if(!r){ _err='老師的電腦沒有回應，成績先留在這台，等一下會再送'; break; }
      _err=r.ok?'':(r.error||'');                      // 被拒絕的（格式不對）就丟掉，不然會卡住後面的
      const q2=get(); q2.shift(); set(q2); emit();
    }
  }finally{ _busy=false; emit(); }
}
