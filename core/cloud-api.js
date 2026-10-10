/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   cloud-api.js — 跟老師的 Google 試算表（Apps Script）講話的最底層（2026-10-05）
   ------------------------------------------------------------
   不依賴 three.js。成績上雲（data/cloud-sync.js）用這個；搖桿設定檔（controller-profiles.js）有自己一份較早的實作。
   網址來源：瀏覽器裡存的 nd.settings.gasUrl（精靈頁老師功能）＞ data/cloud-config.json 的 gasUrl。
   cloud-config.json 也放學校清單 schools（首頁登入用的下拉選單）。
   2026-10-06 一位老師一份試算表：
   · 中心（centerUrl()）＝上面那個網址：遙控器設定、查「老師代碼連到哪」。
   · 班級（cloudUrl()）＝學生登入、成績、排行榜、考核、證書連的那一份。來源依序：
       cloud-config.json 的 classUrl（老師自己的資料夾直接指定，學生不用輸入代碼）
       ＞ 這台裝置記住的老師代碼（nd.class，學生在首頁輸入或網址帶 ?c=代碼）
       ＞ cloud-config.json 的 classCode（向中心查一次後記住）。
     都沒有＝沒有班級，只能用訪客（先不登入）。
   ============================================================ */
const GAS_KEY='nd.settings.gasUrl';
const okUrl=u=>typeof u==='string'&&(/^https:\/\/script\.google(usercontent)?\.com\//.test(u)||/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u));
let _init=null, _url='', _center='', _cfg={}, _schools=null, _class=null, _local=false;
const CLASS_KEY='nd.class';
const SCH_KEY='nd.cache.schools';

export function cloudInit(){
  if(_init)return _init;
  return _init=(async()=>{
    try{ const r=await fetch(new URL('../data/cloud-config.json',import.meta.url),{cache:'no-store'}); if(r.ok)_cfg=await r.json(); }catch{}
    let u=''; try{ u=JSON.parse(localStorage.getItem(GAS_KEY))||''; }catch{}
    if(!u)u=_cfg.gasUrl||'';
    _center=okUrl(u)?u:'';
    _url=''; _class=null;
    // 交給老師的電腦（2026-10-07）：這一頁不是在本機開的（平板連到筆電），而且那台筆電有成績收件匣
    // → 成績一律交給筆電，不直接找雲端（不用網路、不用排隊、不用密碼）。筆電自己開的（localhost）不走這條。
    _local=false;
    try{ const h=location.hostname;
      if(location.protocol==='http:'&&h&&h!=='localhost'&&h!=='127.0.0.1'&&h!=='[::1]'){
        const ac=new AbortController(), t=setTimeout(()=>ac.abort(),1500);
        try{ const r=await fetch(new URL('../local/ping',import.meta.url),{cache:'no-store',signal:ac.signal}); if(r.ok){ const j=await r.json(); _local=!!(j&&j.ok&&j.local); } }catch{} finally{ clearTimeout(t); }
      } }catch{}
    if(_local)return _url;
    if(okUrl(_cfg.classUrl)){ _url=_cfg.classUrl; _class={url:_url,pinned:true}; }
    else{
      let c=null; try{ c=JSON.parse(localStorage.getItem(CLASS_KEY)||'null'); }catch{}
      if(c&&okUrl(c.url)){ _class=c; _url=c.url;
        // 老師重新部署後網址可能換了：這台記的是舊網址就會整個連不上。每小時最多一次，背景向中心重查這個代碼，網址不同就換成新的。
        if(c.code&&_center&&!(Date.now()-(+c.checkedAt||0)<3600000)){
          classLookup(c.code).then(r=>{ if(!r||!r.ok||!r.found)return;
            const fresh={code:String(r.code||c.code),school:String(r.school||''),teacher:String(r.teacher||''),url:r.url,checkedAt:Date.now()};
            if(_class&&_class.code===c.code){ _class=fresh; _url=r.url; try{ localStorage.setItem(CLASS_KEY,JSON.stringify(fresh)); }catch{} } }).catch(()=>{});
        } }
      else if(_cfg.classCode&&_center){ const r=await classLookup(_cfg.classCode); if(r.ok&&r.found)classSet(r); }
    }
    return _url;
  })();
}
export function centerUrl(){ return _center; }
/* true＝成績交給老師的電腦（平板連筆電上課） */
export function localMode(){ return _local; }
export const localUrl=p=>new URL('../local/'+p,import.meta.url).href;
/* 目前連到哪位老師的班級：{code, school, teacher, url} 或 null；pinned＝資料夾設定直接指定的（不能在畫面上換） */
export function classInfo(){ return _class; }
/* 問中心：這個代碼連到哪位老師？回傳 {ok, found, code, school, teacher, url} */
export async function classLookup(code){
  code=String(code||'').trim().toUpperCase();
  if(!_center)return {ok:false,code:'off',error:'沒有設定雲端'};
  if(!/^[A-Z0-9]{3,8}$/.test(code))return {ok:true,found:false};
  const r=await call(_center+(_center.includes('?')?'&':'?')+'action=teacher&code='+encodeURIComponent(code));
  if(r&&r.ok&&r.found===undefined)return {ok:false,code:'old',error:'中心的雲端程式還沒更新到有老師代碼的版本'};
  if(r&&r.ok&&r.found&&!okUrl(r.url))return {ok:true,found:false};     // 只連 Google 試算表程式的網址
  if(r&&!r.ok&&!r.code&&/不認得|setup/.test(r.error||''))return {ok:false,code:'old',error:'中心的雲端程式還沒更新到有老師代碼的版本'};
  return r;
}
export function classSet(info){
  if(!info||!okUrl(info.url))return false;
  _class={code:String(info.code||''),school:String(info.school||''),teacher:String(info.teacher||''),url:info.url,checkedAt:Date.now()}; _url=info.url;
  try{ localStorage.setItem(CLASS_KEY,JSON.stringify(_class)); localStorage.removeItem(SCH_KEY); }catch{}
  _schools=null; _schP=null; return true;
}
export function classClear(){ if(_class&&_class.pinned)return; _class=null; _url=''; try{ localStorage.removeItem(CLASS_KEY); localStorage.removeItem(SCH_KEY); }catch{} _schools=null; _schP=null; }
export function cloudUrl(){ return _url; }
export function cloudConfig(){ return _cfg; }
/* 活動版設定（cloud-config.json 的 edition，沒有就是 null）——離線體驗營版用：
   {issuer:'發證單位', event:'活動名稱', unlockAll:true, strictNames:true, trial:{name,count,desc}, seal:'data/圖檔'} */
export function edition(){ return (_cfg&&_cfg.edition&&typeof _cfg.edition==='object')?_cfg.edition:null; }
/* 學校清單：老師試算表的 schools 工作表為主（在那裡加一列全班都看得到）；
   還沒抓到時先用上次的快取，再沒有就用 cloud-config.json 裡的 schools。 */
export function schoolList(){
  if(_schools&&_schools.length)return _schools;
  try{ const c=JSON.parse(localStorage.getItem(SCH_KEY)); if(Array.isArray(c)&&c.length)return c; }catch{}
  return (_cfg.schools||[]).filter(Boolean);
}
let _schP=null;
/* 向雲端要最新的學校清單（只問一次）；回傳清單。首頁登入畫面拿到後會更新下拉選單。 */
export function refreshSchools(){
  if(_schP)return _schP;
  return _schP=(async()=>{
    await cloudInit(); if(!_url)return schoolList();
    const r=await call(_url+(_url.includes('?')?'&':'?')+'action=schools');
    if(r&&r.ok&&Array.isArray(r.schools)&&r.schools.length){ _schools=r.schools.map(String); try{ localStorage.setItem(SCH_KEY,JSON.stringify(_schools)); }catch{} }
    return schoolList();
  })();
}

async function call(url,opt){
  // Apps Script 冷啟動常要 5～10 秒
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),25000);
  try{
    const r=await fetch(url,{...opt,signal:ac.signal}), txt=await r.text();
    try{ return JSON.parse(txt); }catch{ return {ok:false,code:'server',error:'雲端回應不對（老師的部署可能不是最新版）'}; }
  }catch(e){ return {ok:false,code:'net',error:e.name==='AbortError'?'等了 25 秒沒有回應':'連不上雲端'}; }
  finally{ clearTimeout(t); }
}
/* 回傳一律是 {ok:true,…} 或 {ok:false,code,error}；code:'net'＝網路問題（可以晚點再試），其他＝伺服器拒絕 */
export async function cloudPost(obj){
  await cloudInit(); if(!_url)return {ok:false,code:'off',error:'沒有設定雲端'};
  // text/plain：瀏覽器不會先發預檢請求，Apps Script 才收得到
  return call(_url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(obj)});
}
export async function cloudGet(action,params){
  await cloudInit(); if(!_url)return {ok:false,code:'off',error:'沒有設定雲端'};
  let extra=''; for(const k in (params||{}))extra+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);
  return call(_url+(_url.includes('?')?'&':'?')+'action='+encodeURIComponent(action)+extra);
}
