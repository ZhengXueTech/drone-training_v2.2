/* ============================================================
   controller-profiles.js — 搖桿設定檔（Phase 7，2026-10-04；規劃書 v2.0 §3.1）
   ------------------------------------------------------------
   不依賴 three.js（精靈頁、席位大廳都能載入）。
   三層來源，前面的優先：
     1. 本機：localStorage nd.settings.gpProfiles（精靈做完立刻生效）
     2. 雲端：老師在 Google 試算表勾「通過」的（啟動時自動抓，見下方「雲端」）
     3. 檔案：data/controller-profiles.json（老師放進資料夾，跟著 zip／GitHub 走，不怕還原卡也不用網路）
   都沒有 → input.js 原本的四組內建設定與標準映射（行為與 Phase 7 之前完全相同）。

   設定檔格式（一支搖桿一份；同一支搖桿在不同瀏覽器回報的 id 不同，會是不同份）：
   { id:'<gamepad.id>', name:'顯示名稱',
     axes:{ throttle:{i,inv,rest,min,max}, yaw:{…}, pitch:{…}, roll:{…} },
     shape:'pad-asym'|'pad-sym'|'rc',     // 示意圖外型（core/controller-diagram.js）；沒寫＝自動猜
     throttleType:'center'|'bottom',      // 放手後油門回中／不回中（遙控器型）
     buttons:{ confirm, back, camCycle, pilotCycle, crouch, gear, mode, action, selfLevel },   // 按鈕編號；沒指派的不寫＝停用（改用鍵盤）
     axBtns:[{ax,fn,type:'toggle'}                  // 撥桿開關當「按一下」：撥任何一下算一次
            ,{ax,fn,type:'hold',on:±1,mid}],        // 撥桿開關當「按住／檔位」：停在 on 那一邊＝按住（檔位＝二檔）
     labels:{ b3:'C1 鍵', a5:'左肩開關' },  // 非標準搖桿：設定的人幫按鈕（b編號）／撥桿（a軸號）取的名字，畫面提示會用
     deadzone:0.08, expo:0,
     author:'', created:'YYYY-MM-DD', browser:'', os:'', status:'local|pending|approved' }
   ============================================================ */
const STORE='nd.settings.gpProfiles';
export const PROFILE_FILE_VERSION=1;
export const AXIS_NAMES=['throttle','yaw','pitch','roll'];
export const FN_NAMES=['confirm','back','camCycle','pilotCycle','crouch','gear','mode','action','selfLevel'];

let _local=null, _file={}, _cfgCache=new Map(), _draft=null;

/* ── 雲端（Phase 7b，2026-10-04）：老師的 Google 試算表（Apps Script 網頁應用程式，程式在 tools/gas/）──
   學生跑完精靈按「上傳」→ 試算表多一列「待審核」→ 老師改成「通過」→ 每台電腦開模擬器時自動抓通過的清單。
   有還原卡的電腦教室：本機設定重開機就沒了，雲端通過的每次開機會重新抓回來。
   網址來源：瀏覽器裡存的（精靈頁老師功能填的）＞ data/cloud-config.json（跟著資料夾／GitHub 走）。
   抓不到（沒網路、沒設定）就當沒有，不影響其他來源。 */
const GAS_KEY='nd.settings.gasUrl', CLOUD_CACHE='nd.cache.cloudProfiles';
let _cloud={}, _gasUrl='', _cloudErr='', _cloudState='off';     // off｜loading｜ok｜error
try{ const c=JSON.parse(localStorage.getItem(CLOUD_CACHE)); if(c&&typeof c==='object')_cloud=c; }catch{}
const _okUrl=u=>typeof u==='string'&&/^https:\/\/script\.google(usercontent)?\.com\//.test(u)||/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u||'');
async function _fetchJson(url,opt={}){
  // Apps Script 冷啟動常要 5～10 秒，等 25 秒；回來的不是 JSON（例如 Google 的登入頁或錯誤頁）要講清楚
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),25000);
  try{
    const r=await fetch(url,{...opt,signal:ac.signal}), txt=await r.text();
    try{ return JSON.parse(txt); }
    catch{ throw new Error(/accounts\.google|ServiceLogin|登入|Sign in/i.test(txt)?'試算表要求登入——部署時「誰可以存取」要選「所有人」'
      :'回來的不是預期的資料（HTTP '+r.status+'）——部署可能不是最新版，或網址不是結尾 /exec 的那個'); }
  }catch(e){ if(e.name==='AbortError')throw new Error('等了 25 秒沒有回應'); throw e; }
  finally{ clearTimeout(t); }
}
export function gasUrl(){ return _gasUrl; }
export function cloudState(){ return _cloudState; }
export function cloudError(){ return _cloudErr; }   // 連得上但試算表那邊回報的問題（例如還沒執行 setup）
export function setGasUrl(u){
  u=(u||'').trim();
  try{ if(u)localStorage.setItem(GAS_KEY,JSON.stringify(u)); else localStorage.removeItem(GAS_KEY); }catch{}
  _gasUrl=_okUrl(u)?u:'';
}
/* 啟動時呼叫：決定網址 → 抓「通過」清單 → 存一份快取（下次沒網路時先用） */
export async function fetchCloudProfiles(configUrl){
  let u=''; try{ u=JSON.parse(localStorage.getItem(GAS_KEY))||''; }catch{}
  if(!u&&configUrl){ try{ const r=await fetch(configUrl,{cache:'no-store'}); if(r.ok)u=(await r.json()).gasUrl||''; }catch{} }
  _gasUrl=_okUrl(u)?u:'';
  if(!_gasUrl){ _cloudState='off'; return 0; }
  _cloudState='loading'; _cloudErr='';
  try{
    const j=await _fetchJson(_gasUrl+(_gasUrl.includes('?')?'&':'?')+'action=profiles');
    if(!j||!j.ok){ _cloudErr=String((j&&j.error)||'回應格式不對'); throw new Error(_cloudErr); }
    _cloud={}; for(const p of (j.profiles||[])) if(!validateProfile(p)) _cloud[p.id]={...p,status:'approved'};
    try{ localStorage.setItem(CLOUD_CACHE,JSON.stringify(_cloud)); }catch{}
    _cfgCache.clear(); _cloudState='ok';
    return Object.keys(_cloud).length;
  }catch(e){ _cloudState='error'; if(!_cloudErr)_cloudErr=String(e&&e.message||e); return 0; }
}
export function listCloudProfiles(){ return Object.values(_cloud); }
/* 上傳一份設定給老師審核。回傳 {ok,error?} */
export async function uploadProfile(p){
  if(!_gasUrl)return {ok:false,error:'還沒設定雲端網址'};
  const err=validateProfile(p); if(err)return {ok:false,error:err};
  try{
    // 用 text/plain 送：瀏覽器不會先發預檢請求，Apps Script 才收得到
    const j=await _fetchJson(_gasUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'upload',profile:p})});
    return j&&j.ok?{ok:true}:{ok:false,error:(j&&j.error)||'伺服器沒有接受'};
  }catch(e){ return {ok:false,error:'連不上雲端：'+String(e&&e.message||e)}; }
}
export async function pingCloud(){
  if(!_gasUrl)return {ok:false,error:'網址格式不對（要是 https://script.google.com/… 開頭）'};
  try{ const j=await _fetchJson(_gasUrl+(_gasUrl.includes('?')?'&':'?')+'action=ping'); return j&&j.ok?{ok:true,sheet:j.sheet||''}:{ok:false,error:'回應不對'}; }
  catch(e){ return {ok:false,error:'連不上：'+String(e&&e.message||e)}; }
}

function _readLocal(){
  if(_local)return _local;
  try{ const v=JSON.parse(localStorage.getItem(STORE)); _local=(v&&typeof v==='object')?v:{}; }catch{ _local={}; }
  return _local;
}
function _writeLocal(){ try{ localStorage.setItem(STORE,JSON.stringify(_local)); }catch{} _cfgCache.clear(); }

/* 基本檢查：四軸都要有、軸編號不可重複 */
export function validateProfile(p){
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id)return '缺少搖桿識別（id）';
  if(!p.axes)return '缺少軸設定';
  const seen=new Set();
  for(const n of AXIS_NAMES){
    const a=p.axes[n];
    if(!a||!Number.isInteger(a.i)||a.i<0)return `缺少「${n}」的軸編號`;
    if(seen.has(a.i))return `軸編號 ${a.i} 被重複使用`;
    seen.add(a.i);
  }
  if(p.throttleType&&!['center','bottom'].includes(p.throttleType))return '油門類型不正確';
  return null;
}

export function listLocalProfiles(){ return Object.values(_readLocal()); }
export function listFileProfiles(){ return Object.values(_file); }
export function saveProfile(p){
  const err=validateProfile(p); if(err)throw new Error(err);
  _readLocal()[p.id]={status:'local',...p}; _writeLocal();
}
export function deleteProfile(id){ delete _readLocal()[id]; _writeLocal(); }
export function setFileProfiles(list){
  _file={};
  for(const p of (list||[])) if(!validateProfile(p)) _file[p.id]=p;
  _cfgCache.clear();
}
/* 啟動時讀 data/controller-profiles.json；讀不到就當沒有（離線、舊版資料夾都不會壞） */
export async function fetchFileProfiles(url){
  try{
    const r=await fetch(url,{cache:'no-store'}); if(!r.ok)return 0;
    const j=await r.json(); setFileProfiles(j.profiles||[]);
    return Object.keys(_file).length;
  }catch{ return 0; }
}
/* 草稿：精靈「確認方向」那一步試用的設定，只存在記憶體、不寫入；按下儲存才真的存。
   這樣重跑精靈做到一半放棄，原本的設定不會被蓋掉。 */
export function setDraftProfile(p){ _draft=p||null; _cfgCache.clear(); }
export function profileFor(gp){
  if(!gp)return null;
  if(_draft&&_draft.id===gp.id)return _draft;
  return _readLocal()[gp.id]||_cloud[gp.id]||_file[gp.id]||null;
}
export function profileSource(gp){
  if(!gp)return null;
  return _readLocal()[gp.id]?'local':_cloud[gp.id]?'cloud':_file[gp.id]?'file':null;
}

/* 轉成 input.js 既有的 cfg 形狀（gpAxis／gpBtn 直接吃） */
export function profileToCfg(p){
  if(_cfgCache.has(p))return _cfgCache.get(p);
  const axes={};
  for(const n of AXIS_NAMES){
    const a=p.axes[n];
    axes[n]={i:a.i,inv:!!a.inv,rest:a.rest??0,min:a.min,max:a.max};
  }
  // 有設定檔的搖桿：沒指派的功能＝停用（-1），不能去讀標準手把的預設位置（在這支搖桿上可能是別的鈕）
  const buttons={};
  for(const fn of FN_NAMES){ const b=p.buttons?.[fn]; buttons[fn]=Number.isInteger(b)?b:-1; }
  const cfg={axes,buttons,deadzone:p.deadzone??0.08,expo:p.expo??0,
    throttleType:p.throttleType||'center',profileName:p.name||p.id,shape:p.shape||null,labels:p.labels||null,layout:p.layout||null,hide:p.hide||null};
  if(p.axBtns&&p.axBtns.length)cfg.axBtns=p.axBtns.map(b=>({...b}));
  _cfgCache.set(p,cfg);
  return cfg;
}

/* 匯出／匯入：檔案格式＝data/controller-profiles.json 的格式，匯出的檔案可以直接放進資料夾 */
export function exportProfiles(list=listLocalProfiles()){
  return JSON.stringify({version:PROFILE_FILE_VERSION,exported:new Date().toISOString().slice(0,10),
    profiles:list},null,2);
}
export function importProfiles(text){
  let j; try{ j=JSON.parse(text); }catch{ throw new Error('不是有效的設定檔（JSON 格式錯誤）'); }
  const list=Array.isArray(j)?j:(j.profiles||[]);
  let ok=0; const bad=[];
  for(const p of list){
    const err=validateProfile(p);
    if(err){ bad.push((p&&p.name)||'（未命名）'+'：'+err); continue; }
    _readLocal()[p.id]={...p,status:p.status||'local'}; ok++;
  }
  _writeLocal();
  return {ok,bad};
}

export function envInfo(){
  const ua=navigator.userAgent;
  const browser=/Edg\//.test(ua)?'edge':/Firefox\//.test(ua)?'firefox':/Chrome\//.test(ua)?'chrome':/Safari\//.test(ua)?'safari':'other';
  const os=/Windows/.test(ua)?'windows':/Android/.test(ua)?'android':/CrOS/.test(ua)?'chromeos':/Mac OS X|iPhone|iPad/.test(ua)?'apple':/Linux/.test(ua)?'linux':'other';
  return {browser,os};
}
