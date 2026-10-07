/* ============================================================
   cloud-sync.js — 成績上雲（Phase 9 第一輪，2026-10-05）
   ------------------------------------------------------------
   · 登入：學校＋班級＋座號＋姓名（密碼預設＝班級＋座號，老師可在試算表改）。
          登入成功會把雲端上的進度、徽章拉回這台電腦（換電腦、還原卡清空後用）。
   · 上傳：progress.record() 每次結算後自動排進佇列（nd.cloud.queue），一筆一筆送；
          斷網就留在佇列，恢復連線或下次開頁面自動補送。沒登入雲端＝不上傳，跟以前一樣只存本機。
   · 關卡不用改：progress.js 會自己載入這個檔並掛上 hook。
   ============================================================ */
import { cloudInit, cloudUrl, cloudPost, cloudGet, localMode } from '../core/cloud-api.js';
import { localEnqueue, localFlush } from './local-sync.js';
import { ownerKeyOf, switchOwner } from './owner.js';

const Q_KEY='nd.cloud.queue', AUTH_KEY='nd.cloud.auth', MAX_Q=200;
const get=(k,f)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch{ return f; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };
let _flushing=false, _lastError='';
const listeners=new Set();
const emit=()=>listeners.forEach(f=>{ try{f(status());}catch{} });

export function onCloudStatus(f){ listeners.add(f); return ()=>listeners.delete(f); }
/* 給首頁顯示：{enabled, loggedIn, pending, error} */
export function status(){ return {enabled:!!cloudUrl(), loggedIn:!!get(AUTH_KEY,null), pending:get(Q_KEY,[]).length, error:_lastError}; }
export function auth(){ return get(AUTH_KEY,null); }
export function logout(){ try{ localStorage.removeItem(AUTH_KEY); }catch{} emit(); }
export const defaultPw=(classId,seat)=>String(classId)+(/^\d$/.test(String(seat))?'0'+seat:String(seat));

/* 把雲端的一關進度併進本機：取分數高的、次數多的，完成過就算完成 */
function mergeLevel(local,remote){
  if(!local)return remote;
  const out={...remote,...local};
  out.completed=!!(local.completed||remote.completed);
  const bs=[local.bestScore,remote.bestScore].filter(x=>typeof x==='number');
  if(bs.length)out.bestScore=Math.max(...bs);
  out.attempts=Math.max(local.attempts||0,remote.attempts||0);
  const m={...(remote.bestByChallenge||{})};
  for(const k in (local.bestByChallenge||{}))m[k]=Math.max(m[k]??-Infinity,local.bestByChallenge[k]);
  if(Object.keys(m).length)out.bestByChallenge=m;
  return out;
}
/* 登入（或第一次註冊）。回傳 {ok, created, restored（拉回幾關）, name} 或 {ok:false, code, error} */
const nap=ms=>new Promise(r=>setTimeout(r,ms));
/* 雲端忙線（很多人同時在寫）時自己隔幾秒再試，每台隨機錯開；onWait(第幾次) 讓畫面顯示「排隊中」 */
async function postBusy(body,onWait,tries=8){
  let r;
  for(let i=1;i<=tries;i++){
    r=await cloudPost(body);
    const slow=body.action==='login'&&r.code==='net'&&/沒有回應/.test(r.error||'')&&i<3;      // 等到逾時（雲端塞車）：最多再試兩次；真的沒網路則馬上回報
    if(r.ok||(r.code!=='busy'&&!slow)||i===tries)break;
    try{ onWait&&onWait(i); }catch{}
    await nap(1000+Math.random()*3000);
  }
  return r;
}
export async function login({school,classId,seat,name,pw},opt={}){
  await cloudInit();
  if(!cloudUrl())return {ok:false,code:'off',error:'沒有設定雲端'};
  const num=v=>{ try{ v=v.normalize('NFKC'); }catch{} return /^\d+$/.test(v)?String(+v):v; };      // 純數字去掉前面的 0（試算表會把「01」存成 1）
  const who={school:String(school||'').trim(),classId:num(String(classId||'').trim()),seat:num(String(seat||'').trim()),name:String(name||'').trim()};
  who.pw=String(pw||'').trim()||defaultPw(who.classId,who.seat);
  const r=await postBusy({action:'login',...who},opt.onWait);
  if(!r.ok)return r.code==='busy'?{...r,error:'現在太多人同時登入，請過幾秒再按一次登入。'}:r;
  // 先換人：這台裝置上如果留著別人的成績，收起來，不要併給現在登入的這個人（data/owner.js）
  const switched=switchOwner(ownerKeyOf(who),r.name||who.name);
  set(AUTH_KEY,{...who,name:r.name||who.name});
  let restored=0, pushed=0;
  const mine={...who,name:r.name||who.name}, remote=r.progress||{};
  for(const id in (r.progress||{})){
    if(!/^[a-z0-9-]+$/i.test(id))continue;
    const key='nd.progress.'+id, local=get(key,null), merged=mergeLevel(local,r.progress[id]);
    if(JSON.stringify(merged)!==JSON.stringify(local)){ set(key,merged); restored++; }
  }
  // 補傳：這個人在這台裝置上有、雲端沒有（或雲端比較舊）的成績——離線時按「先不登入」飛的就是這種
  try{
    const better=(l,c)=>!c||(l.completed&&!c.completed)||((l.bestScore??-Infinity)>(c.bestScore??-Infinity))||((l.attempts||0)>(c.attempts||0));
    const q=get(Q_KEY,[]), queued=new Set(q.filter(x=>x._who&&ownerKeyOf(x._who)===ownerKeyOf(mine)).map(x=>x.levelId));
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k||!k.startsWith('nd.progress.'))continue;
      const id=k.slice(12), l=get(k,null); if(!l||!/^[a-z0-9-]+$/i.test(id)||queued.has(id)||!better(l,remote[id]))continue;
      q.push({levelId:id,score:typeof l.bestScore==='number'?l.bestScore:null,completed:!!l.completed,challenge:'標準',mode:'practice',examCode:'',
        metrics:{note:'補傳本機紀錄'},progress:l,badges:get('nd.badges',[]).map(b=>({id:b.id,emoji:b.emoji,name:b.name,earnedAt:b.earnedAt})),device:'',at:l.lastAttempt||new Date().toISOString(),_who:mine,_url:cloudUrl()});
      pushed++;
    }
    if(pushed){ while(q.length>MAX_Q)q.shift(); set(Q_KEY,q); }
  }catch{}
  if(Array.isArray(r.badges)&&r.badges.length){
    const mine=get('nd.badges',[]), ids=new Set(mine.map(b=>b.id));
    for(const b of r.badges) if(b&&b.id&&!ids.has(b.id)){ mine.push(b); ids.add(b.id); }
    set('nd.badges',mine);
  }
  try{ const q=get(Q_KEY,[]); if(q.some(x=>x._retried)){ q.forEach(x=>{ delete x._retried; }); set(Q_KEY,q); } }catch{}   // 重新登入後，卡住的那一筆可以再試一次
  _lastError=''; emit(); flush();
  return {ok:true,created:!!r.created,restored,pushed,switched,name:r.name||who.name};
}

/* progress.record() 之後呼叫：排進佇列並試著送出 */
export function enqueue(levelId,result,merged,badges){
  if(localMode()){      // 平板連老師的筆電上課：交給筆電的成績收件匣（data/local-sync.js），不找雲端
    let s=null; try{ s=JSON.parse(localStorage.getItem('nd.student')||'null'); }catch{}
    return localEnqueue(s,levelId,result,merged,badges);
  }
  const a=auth(); if(!a)return;                       // 沒登入雲端＝只存本機
  const q=get(Q_KEY,[]);
  let metrics=result&&result.metrics||{}; try{ if(JSON.stringify(metrics).length>1400)metrics={note:'略'}; }catch{ metrics={}; }
  // 考核中（首頁輸入過考場代碼）而且飛的是那一關：這一次算考核
  let examCode=result.examCode||''; const ex=examState();
  if(!examCode&&ex&&ex.levelId===levelId&&ex.used<ex.limit){ examCode=ex.code; ex.used++; ex.sent=ex.used; ex.lastScore=typeof result.score==='number'?result.score:null; ex.note=''; saveExam(ex); }
  q.push({levelId,score:typeof result.score==='number'?result.score:null,completed:!!result.completed,
    challenge:result.challenge||'標準',mode:examCode?'exam':'practice',examCode,
    metrics,progress:merged,badges:(badges||[]).map(b=>({id:b.id,emoji:b.emoji,name:b.name,earnedAt:b.earnedAt})),
    device:result.device||'',at:new Date().toISOString(),_who:a,_url:cloudUrl()});   // _who：這一筆是誰的。換人登入後，還沒傳完的仍用原本那個人的身分送
  while(q.length>MAX_Q)q.shift();
  set(Q_KEY,q); emit(); flush();
}
/* 一筆一筆送；網路問題就停下來等下次，伺服器明確拒絕的那一筆丟掉（不然會卡住後面的） */
export async function flush(){
  if(_flushing)return; _flushing=true;
  try{
    await cloudInit(); if(localMode()){ localFlush(); return; } const a=auth();
    if(!cloudUrl()||!a)return;
    for(;;){
      const q=get(Q_KEY,[]); if(!q.length)break;
      if(q[0]._url&&q[0]._url!==cloudUrl()){ _lastError='有成績是別位老師班級的，換回那位老師後才會上傳'; break; }     // 換了老師：不把成績送錯地方
      const w=q[0]._who||a, body={...q[0]}; delete body._who; delete body._retried; delete body._url;
      const r=await postBusy({action:'record',school:w.school,classId:w.classId,seat:w.seat,name:w.name,pw:w.pw,...body},null,6);
      if(r.ok){ _lastError='';
        if(r.exam===false){ const ex=examState(); if(ex&&ex.code===q[0].examCode){ ex.note='這一次沒有算進考核：'+(r.examError||''); if(/用完|關閉/.test(r.examError||''))ex.used=ex.limit; saveExam(ex); } }
        else if(r.exam&&r.exam.used){ const ex=examState(); if(ex&&ex.code===r.exam.code){ ex.used=Math.max(ex.used,r.exam.used); saveExam(ex); } } }
      else if(r.code==='net'||r.code==='server'||r.code==='busy'){ _lastError=r.error; break; }   // 留在佇列，下次再傳
      else if(r.code==='nouser'){            // 雲端還沒有這個人（例如之前離線時先存的）：先幫他登入建檔，再重送這一筆
        if(q[0]._retried){ _lastError='雲端找不到這位學員（請回首頁重新登入）'; break; }   // 只補登一次，不行就停，絕不重複建檔（2026-10-06）
        const l=await cloudPost({action:'login',...w});
        if(l.ok){ const q3=get(Q_KEY,[]); if(q3[0]){ q3[0]._retried=1; set(Q_KEY,q3); } continue; } _lastError=(l.error||'')+'（請回首頁重新登入）'; break; }
      else if(r.code==='pw'||r.code==='name'||r.code==='dup'){ _lastError=r.error+'（請回首頁重新登入）'; break; }
      else _lastError=r.error||'';
      const q2=get(Q_KEY,[]); q2.shift(); set(Q_KEY,q2); emit();
    }
  }finally{ _flushing=false; emit(); }
}
/* 排行榜（Phase 9 第二輪）：要登入才看得到。回傳雲端的 {ok,scope,nameMode,where,rows:[{rank,label,score,me}],total,me} */
export async function board(levelId){
  await cloudInit(); const a=auth();
  if(!cloudUrl())return {ok:false,code:'off',error:'沒有設定雲端'};
  if(!a)return {ok:false,code:'nologin',error:'要先登入雲端才看得到排行榜'};
  const r=await cloudPost({action:'board',school:a.school,classId:a.classId,seat:a.seat,pw:a.pw,levelId});
  if(!r.ok&&/不認得的動作/.test(r.error||''))return {ok:false,code:'old',error:'老師的雲端程式還沒更新到有排行榜的版本'};
  return r;
}
/* 雲端證書（Phase 9 第二輪）：先把還沒上傳的成績送完，再問雲端達成了哪些階段。
   回傳 {ok,name,school,classId,stages:[{name,desc,levels:[{id,score}]}],todo,code,approved,approvedAt,teacher,issuedAt} */
export async function cert(){
  await cloudInit(); const a=auth();
  if(!cloudUrl())return {ok:false,code:'off',error:'沒有設定雲端'};
  if(!a)return {ok:false,code:'nologin',error:'要先登入雲端才有雲端證書'};
  await flush();
  const r=await cloudPost({action:'cert',school:a.school,classId:a.classId,seat:a.seat,pw:a.pw});
  if(!r.ok&&/不認得的動作/.test(r.error||''))return {ok:false,code:'old',error:'老師的雲端程式還沒更新到有證書的版本'};
  return r;
}
/* 查驗碼：不用登入。回傳 {ok,found,school,classId,name（遮名）,stages,approved,approvedAt,teacher} */
export async function verifyCert(code){ return cloudGet('verify',{code:String(code||'').trim()}); }

/* ── 考場代碼（Phase 9 第二輪）────────────────────────────
   首頁輸入代碼 → examStart() 問雲端 → 記在這個分頁（sessionStorage 的 nd.exam）→ 進那一關。
   之後 enqueue() 看到是那一關就自動帶上代碼；關卡不用改。關卡畫面上方會出現「考核中」小牌子。 */
const EXAM_KEY='nd.exam';
export function examState(){ try{ const v=sessionStorage.getItem(EXAM_KEY); return v?JSON.parse(v):null; }catch{ return null; } }
function saveExam(ex){ try{ sessionStorage.setItem(EXAM_KEY,JSON.stringify(ex)); }catch{} paintExam(); emit(); }
export function examEnd(){ try{ sessionStorage.removeItem(EXAM_KEY); }catch{} paintExam(); emit(); }
/* levels＝關卡清單（用來查那一關的檔案與名稱）。回傳 {ok, exam} 或 {ok:false, error} */
export async function examStart(code,levels){
  await cloudInit(); const a=auth();
  if(!cloudUrl())return {ok:false,code:'off',error:'沒有設定雲端'};
  if(!a)return {ok:false,code:'nologin',error:'要先登入雲端才能考核'};
  const r=await cloudPost({action:'exam',school:a.school,classId:a.classId,seat:a.seat,pw:a.pw,examCode:String(code||'').trim()});
  if(!r.ok)return /不認得的動作/.test(r.error||'')?{ok:false,code:'old',error:'老師的雲端程式還沒更新到有考場代碼的版本'}:r;
  const lv=(levels||[]).find(l=>l.id===r.levelId);
  if(!lv||!lv.file)return {ok:false,code:'exam',error:'這場考核指定的關卡（'+r.levelId+'）這台電腦沒有，請找老師'};
  const ex={code:r.examCode,levelId:r.levelId,limit:r.limit,used:r.used,rule:r.rule,file:lv.file,title:lv.title,sent:0,note:''};
  saveExam(ex); return {ok:true,exam:ex};
}
/* 關卡畫面左上角的小牌子（只在考核那一關顯示；不擋操作）。2026-10-05 老師要求從正上方挪到左上角並縮短：
   排在 HUD 左上狀態框（#nd-status）的右邊；沒有那個框就貼左上角。 */
function placeExam(el){
  const st=document.getElementById('nd-status'), r=st&&st.getBoundingClientRect();
  if(r&&r.width>0&&document.body.classList.contains('nd-touch')){ el.style.left=Math.round(r.left)+'px'; el.style.top=Math.round(r.bottom+4)+'px'; }   // 觸控橫拿：狀態框右邊是任務列，改排在狀態框下面
  else if(r&&r.width>0){ el.style.left=Math.round(r.right+8)+'px'; el.style.top=Math.round(r.top)+'px'; }
  else{ el.style.left='12px'; el.style.top='12px'; }
}
function paintExam(){
  if(typeof document==='undefined'||!document.body)return;
  const ex=examState(); let el=document.getElementById('nd-exam-tag');
  const here=ex&&ex.file&&decodeURIComponent(location.pathname).endsWith('/'+ex.file);
  if(!here){ if(el)el.remove(); return; }
  if(!el){ el=document.createElement('div'); el.id='nd-exam-tag';
    el.style.cssText='position:fixed;top:12px;left:12px;z-index:9000;pointer-events:none;font:12px/1.5 Consolas,"Microsoft JhengHei",monospace;padding:3px 10px;border-radius:8px;background:rgba(40,28,2,.88);border:1px solid #facc15;color:#fde68a;max-width:46vw;';
    document.body.appendChild(el);
    [300,1200,3000].forEach(t=>setTimeout(()=>{ const e=document.getElementById('nd-exam-tag'); if(e)placeExam(e); },t));   // HUD 比較晚才建好
    addEventListener('resize',()=>{ const e=document.getElementById('nd-exam-tag'); if(e)placeExam(e); }); }
  const left=ex.limit-ex.used;
  el.title='考核 '+ex.code+'：第幾次／總次數';
  el.textContent=ex.note?'📝 '+ex.note
    :'📝 '+ex.code+' '+(ex.sent?ex.used+'/'+ex.limit+' 已送出'+(ex.lastScore!=null?'（'+ex.lastScore+'分）':'')+(left>0?'':'・次數用完')
      :(ex.used+1)+'/'+ex.limit);
  el.style.whiteSpace=ex.note?'normal':'nowrap';
  el.style.borderColor=ex.note?'#f87171':'#facc15'; el.style.color=ex.note?'#fecaca':'#fde68a';
  placeExam(el);
}
if(typeof document!=='undefined'){ if(document.body)paintExam(); else addEventListener('DOMContentLoaded',paintExam); }
if(typeof addEventListener==='function'){ addEventListener('online',()=>flush()); }
cloudInit().then(()=>{ emit(); flush(); });
