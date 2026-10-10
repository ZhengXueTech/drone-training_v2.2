/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   dpt.js — DPT（Drone Progress Token）短碼編解碼器（ES Module）
   newdrone Phase 2｜規劃書 6.2「report.html＋DPT v2」
   ------------------------------------------------------------
   v1（基本版 progress-report.html／decode.html 原始格式，原封不動保留於
   本檔 decodeV1，供老師解析舊生舊代碼用；**不再產生新的 v1 代碼**）：
     8 碼 base36：完成度固定編 12 個 bit（t01-t11 + soccer 寫死順序），
     用「日期×31 XOR 日期>>>7」12-bit 混淆＋權重加總 checksum。

   v2（newdrone 新格式，本檔 encodeV2/decodeV2）：
     newdrone 關卡數是動態的（目前只有 3 關，未來會逐步移植到 12+ 關，
     順序也可能調整），v1 那種「寫死 12 個 bit 對應哪一關」的做法無法
     沿用，所以 v2 改成**自描述格式**：代碼裡先存「這份代碼記錄了幾關
     （N）」，再存 N 關、每關 2-bit「狀態級別」，解碼時不需要事先知道
     N，也不會因為之後 manifest 關卡數增加而讓舊代碼解壞掉。

     每關 2-bit 狀態級別（tierFor()）：
       0＝未開始　1＝有紀錄但未完成　2＝已完成　3＝已完成且 attempts≥3
       （3 是拿來替代 v1 沒有的「嘗試次數」需求——多次挑戰的簡化訊號；
       完整、精確的分數與嘗試次數不塞進這個「短碼」，短碼的定位一直
       是給 Google 表單那種文字欄位貼的不透明代碼，精確數字走旁邊的
       JSON／CSV 匯出，兩者分工，短碼不需要為了塞更多資料而變得又臭又長）

     格式：字面版本標記 "N2" + 4 碼日期(base36) + 變動長度資料(base36)
           + 2 碼 checksum(base36)。version 標記＋非固定總長度，跟 v1
           固定 8 碼格式在解碼端可以無歧義地分辨（v1 dptDecodeAny 一律
           先看是不是 N2 開頭，不是的話才嘗試當 v1 8 碼解）。

     混淆用的 keystream 固定 48-bit（用 dateKey 產生），無論 N 多大都用
     同一個函式：BigInt XOR 兩次自然互相抵銷，正確性不受 N 大小影響；
     只有在關卡數大到 N>21（超出目前規劃的完整 13 關課程甚多）時，混淆
     的「遮蔽完整度」會隨 N 增加而遞減（不影響正確解碼，只是代碼比較
     容易被有心人士猜出规律）——這不是安全機制，跟 v1 的定位一致（見
     legacy progress-report.html 的原始說明：「代碼已混淆，學生無法直接
     判讀內容」，從來就不是防破解等級的加密）。
   ============================================================ */

const B36='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function toBase36(n,minLen=0){ // n: BigInt
  let s=n.toString(36).toUpperCase();
  while(s.length<minLen)s='0'+s;
  return s;
}
function bigFromBase36(str){
  let v=0n;
  for(const ch of str.toUpperCase()){
    const d=B36.indexOf(ch);
    if(d<0)throw new Error('非法字元: '+ch);
    v=v*36n+BigInt(d);
  }
  return v;
}

function dateKeyOf(d){ return (d.getFullYear()%100)*10000+(d.getMonth()+1)*100+d.getDate(); }
function dateFromKey(dateKey){
  const yy=Math.floor(dateKey/10000), mm=Math.floor((dateKey%10000)/100), dd=dateKey%100;
  return `20${String(yy).padStart(2,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}

const MASK48=(1n<<48n)-1n;
function keystream48(dateKey){
  let x=BigInt(dateKey)*2654435761n;
  x^=x>>15n;
  x=(x*0x2545F4914F6CDD1Dn)&MASK48;
  x^=x>>17n;
  return x&MASK48;
}

/* 32-bit 安全 checksum：對「實際傳輸的字元」（dateStr+dataStr）逐字算
   rolling hash，不是只對解碼後語意上的 N/tiers 算——payload 只佔
   enc 的低 5+2N 個 bit，enc 本身固定編碼成 48-bit（見 keystream48 註解），
   高位那些「用不到」的 bit 純粹是 keystream 雜訊，如果 checksum 只跟
   解出來的 N/tiers 掛勾，竄改 dataStr 高位字元會完全不影響解碼結果、
   也就不會被 checksum 抓到（測試時真的抓到這個洞——高位字元純雜訊，
   改了 N/tiers 語意不變，checksum 當然對得上）。改成對「整串傳輸字元」
   算 hash 之後，任何一個字元被改都會讓 checksum 對不上，不會有漏洞。 */
function checksumV2(dateStr,dataStr){
  let v=0;
  for(const ch of dateStr+dataStr)v=((v*131)+ch.charCodeAt(0))>>>0;
  return v%1296;
}

export const TIER_LABELS=['── 未開始','⏳ 進行中','✅ 已完成','🏆 已完成（多次挑戰）'];

/* result: {completed, attempts} 依 progress.get(levelId) 算出 2-bit 狀態級別 */
export function tierFor(rec){
  if(!rec)return 0;
  if(!rec.completed)return 1;
  return (rec.attempts||0)>=3?3:2;
}

/* levels: [{id,title}, ...]（呼叫端傳 LEVELS，順序＝這份代碼的關卡順序）
   tiers: 對應每個 level 的 0-3 狀態級別（呼叫端算好傳進來，本模組不碰
   localStorage，保持純函式方便測試） */
export function encodeV2(levels,tiers,dateObj=new Date()){
  const N=levels.length;
  if(tiers.length!==N)throw new Error('tiers 長度需與 levels 一致');
  const dateKey=dateKeyOf(dateObj);
  let payload=BigInt(N);                              // bits [0..4]
  tiers.forEach((t,i)=>{ payload|=BigInt(t&3)<<BigInt(5+2*i); });
  const enc=payload^keystream48(dateKey);
  const dateStr=toBase36(BigInt(dateKey),4);
  const dataStr=toBase36(enc,8);
  const chk=checksumV2(dateStr,dataStr);
  const chkStr=toBase36(BigInt(chk),2);
  return 'N2'+dateStr+dataStr+chkStr;
}

export function decodeV2(rawCode){
  const code=(rawCode||'').trim().toUpperCase();
  if(!code.startsWith('N2'))return{valid:false,error:'不是 v2 格式（缺 N2 標記）'};
  const body=code.slice(2);
  if(body.length<4+1+2)return{valid:false,error:'長度太短，代碼不完整'};
  const dateStr=body.slice(0,4), chkStr=body.slice(-2), dataStr=body.slice(4,-2);
  let dateKey,enc;
  try{ dateKey=Number(bigFromBase36(dateStr)); enc=bigFromBase36(dataStr); }
  catch(e){ return{valid:false,error:'非法字元，代碼可能貼錯或漏字'}; }
  if(dateKey<10101||dateKey>991231)return{valid:false,error:'日期範圍異常'};
  const payload=enc^keystream48(dateKey);
  const N=Number(payload&0b11111n);
  if(N<0||N>200)return{valid:false,error:'關卡數量異常，代碼可能已損毀'};
  const tiers=[];
  for(let i=0;i<N;i++)tiers.push(Number((payload>>BigInt(5+2*i))&0b11n));
  const expectChk=checksumV2(dateStr,dataStr);
  const gotChk=Number(bigFromBase36(chkStr));
  if(expectChk!==gotChk)return{valid:false,error:'⚠️ Checksum 不符，代碼可能已竄改或打錯字'};
  return{valid:true,version:2,date:dateFromKey(dateKey),N,tiers,
    completed:tiers.filter(t=>t>=2).length};
}

/* v1（基本版原始格式）解碼器——逐字對照 無人機飛行器_基本版/decode.html
   的 dptDecode()，只用來讀舊代碼，不再產生新代碼 */
const V1_WEIGHTS=[3,7,11,13,17,19,23,29,31,37,41,43];
export function decodeV1(rawCode){
  const code=(rawCode||'').trim().toUpperCase();
  if(!/^[0-9A-Z]{8}$/.test(code))return{valid:false,error:'格式錯誤（需 8 碼英數字）'};
  const packed=parseInt(code.slice(0,6),36);
  if(isNaN(packed)||packed<0)return{valid:false,error:'解析失敗'};
  const encoded=packed%4096, dateKey=Math.floor(packed/4096);
  if(dateKey<10101||dateKey>991231)return{valid:false,error:'日期範圍異常'};
  const xorKey=((dateKey*31)^(dateKey>>>7))&0xFFF;
  const completion=encoded^xorKey;
  const bits=Array.from({length:12},(_,i)=>(completion>>>i)&1);
  let chkVal=V1_WEIGHTS.reduce((s,w,i)=>s+bits[i]*w,0);
  chkVal=(chkVal+dateKey)%1296;
  const expectedChk=chkVal.toString(36).toUpperCase().padStart(2,'0');
  if(expectedChk!==code.slice(6,8))return{valid:false,error:'⚠️ Checksum 不符，代碼可能已竄改'};
  return{valid:true,version:1,date:dateFromKey(dateKey),bits,
    completed:bits.reduce((a,b)=>a+b,0)};
}

/* 統一入口：老師端解碼器用這個就好，不用自己判斷 v1/v2 */
export function decodeAny(rawCode){
  const code=(rawCode||'').trim().toUpperCase();
  if(code.startsWith('N2'))return decodeV2(code);
  return decodeV1(code);
}
