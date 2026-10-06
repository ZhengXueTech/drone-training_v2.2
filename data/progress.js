/* ============================================================
   progress.js — 學習歷程資料層（ES Module）
   newdrone Phase 0｜nd.* 命名空間（規劃書 6.1）＋舊資料一次性匯入
   ============================================================ */
'use strict';
import { ownerKeyOf, switchOwner } from './owner.js';   // 2026-10-06：共用的平板換人時，成績不混在一起

const K={ student:'nd.student',
          progress:id=>`nd.progress.${id}`,
          settings:k=>`nd.settings.${k}`,
          leaderboard:id=>`nd.leaderboard.${id}`,
          migrated:'nd.migrated',
          badges:'nd.badges' };

function _get(key,fallback=null){
  try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{return fallback;}
}
function _set(key,val){ try{localStorage.setItem(key,JSON.stringify(val));}catch{} }

/* ============================================================
   成就／勳章系統（2026-08-02 新增，規劃書「成就系統：中量」）
   ------------------------------------------------------------
   里程碑類：純粹由現有完成度資料算出，不需要額外欄位——每次 record()
   結束、或任何頁面呼叫 progress.badges() 時都會重新檢查一次，沒拿到
   的話補頒，已經拿到的不會被拿掉（earnedAt 只在第一次頒發時蓋章）。
   表現類：precision／energy-saver 只能在 record() 當下、對照這次剛
   送進來的 result.metrics 判斷（不是看累積最佳值），因為「這次跑出來
   有沒有零碰撞／電量夠不夠」是單次成績的性質，不是像 bestScore 那種
   累積最大值可以代表的東西。第一次達成後就頒發，之後某次沒達成也
   不會收回。
   ============================================================ */
const MILESTONE_GROUPS={
  basic:['t01','t02','t03','t04','t05'],
  advanced:['t06','t07','t08','t09','t10','t11'],
  soccer:['soccer','soccer-pvp','soccer-real'],
  scenario:['x-hover','x-cargo','x-chase','x-infinite','x-goalkeeper','x-bridge','x-rescue','x-inspection','x-agri'],
};
const MILESTONE_BADGES=[
  {id:'rookie-pilot',emoji:'🥉',name:'新手飛官',group:'basic'},
  {id:'advanced-pilot',emoji:'🥈',name:'進階飛官',group:'advanced'},
  {id:'soccer-ace',emoji:'⚽',name:'足球好手',group:'soccer'},
  {id:'scenario-master',emoji:'🚁',name:'情境達人',group:'scenario'},
];
const TOP_BADGE={id:'drone-instructor',emoji:'🏆',name:'無人機教官'};
/* 碰撞類指標依關卡而異的欄位名稱（見各關卡 progress.record 呼叫）——
   t04/t05/t09＝obstacleHits、t07＝crashCount（降落過快次數）、
   t10＝buildingHits，全部都是「越低越好、0＝完美」同一種語意。 */
const PRECISION_HIT_FIELD={t04:'obstacleHits',t05:'obstacleHits',t07:'crashCount',
                            t09:'obstacleHits',t10:'buildingHits'};
const ENERGY_SAVER_LEVELS=['t04','t05','t09'];

function _levelDone(id){ const r=_get(K.progress(id)); return !!(r&&r.completed); }
function _awardBadge(list,id,emoji,name){
  if(list.some(b=>b.id===id))return false;
  list.push({id,emoji,name,earnedAt:new Date().toISOString()});
  return true;
}
function _recheckMilestones(){
  const list=_get(K.badges,[]);
  let changed=false;
  for(const b of MILESTONE_BADGES){
    if(MILESTONE_GROUPS[b.group].every(_levelDone))
      changed=_awardBadge(list,b.id,b.emoji,b.name)||changed;
  }
  const gotAll=MILESTONE_BADGES.every(b=>list.some(x=>x.id===b.id));
  if(gotAll)changed=_awardBadge(list,TOP_BADGE.id,TOP_BADGE.emoji,TOP_BADGE.name)||changed;
  if(changed)_set(K.badges,list);
  return list;
}
function _checkPerformanceBadges(levelId,merged){
  const m=merged.metrics||{};
  const list=_get(K.badges,[]);
  let changed=false;
  const hitField=PRECISION_HIT_FIELD[levelId];
  if(hitField&&m[hitField]===0)
    changed=_awardBadge(list,'precision','🎯','精準飛行')||changed;
  if(ENERGY_SAVER_LEVELS.includes(levelId)&&typeof m.finalBattery==='number'&&m.finalBattery>50)
    changed=_awardBadge(list,'energy-saver','🔋','節能高手')||changed;
  if(changed)_set(K.badges,list);
}

/* 成績上雲（Phase 9，2026-10-05）：這裡自己載入 cloud-sync.js，所有關卡不用改。
   載入失敗（舊資料夾沒有這個檔、離線）就當沒有。 */
let _cloud=null;
import('./cloud-sync.js').then(m=>{ _cloud=m; }).catch(()=>{});

export const progress={
  student(){ return _get(K.student); },
  setStudent(s){ switchOwner(ownerKeyOf(s),s&&s.name);      // 先換人（把前一位的本機成績收起來），再寫入新的身分
    _set(K.student,{...s,createdAt:s.createdAt||new Date().toISOString()}); },

  get(levelId){ return _get(K.progress(levelId),null); },
  /* 增量合併寫入（承基本版 saveProgress 模式）；每次呼叫 attempts+1 */
  record(levelId,result){
    const old=_get(K.progress(levelId),{attempts:0});
    const merged={...old,...result,
      attempts:(old.attempts||0)+1,
      bestScore:Math.max(old.bestScore??-Infinity,result.score??-Infinity),
      lastAttempt:new Date().toISOString()};
    if(merged.bestScore===-Infinity)delete merged.bestScore;
    // 2026-10-01 挑戰條件：每種條件各自記最佳分數（例 bestByChallenge['無定高・強風']=85）
    if(result.challenge&&result.score!=null){
      const m={...(old.bestByChallenge||{})};
      m[result.challenge]=Math.max(m[result.challenge]??-Infinity,result.score);
      merged.bestByChallenge=m;
    }
    _set(K.progress(levelId),merged);
    _checkPerformanceBadges(levelId,merged);
    const _badges=_recheckMilestones();
    // Phase 9：有登入雲端就排進上傳佇列（沒登入、沒設定雲端＝什麼都不做，行為跟以前一樣）
    if(_cloud){ try{ _cloud.enqueue(levelId,result,merged,_badges); }catch{} }
    return merged;
  },

  /* 已獲得的徽章清單（emoji/name/earnedAt）。每次呼叫都會重新檢查一次
     里程碑類（純看目前完成度，永遠可重算，不怕漏頒），表現類則只在
     record() 當下判斷過、已經持久化，這裡不會重新評估表現類。 */
  badges(){ return _recheckMilestones(); },
  /* 證書版面用：只回傳「最高榮譽」徽章（拿到就回傳，證書上只顯示這一個，
     其餘完整清單留給進度報告頁），沒拿到最高榮譽則回傳 null——
     報告頁那邊自己決定要不要改顯示「已獲得 N 項成就」。 */
  topBadge(){ const list=_recheckMilestones(); return list.find(b=>b.id===TOP_BADGE.id)||null; },

  setting(key,fallback=null){ return _get(K.settings(key),fallback); },
  setSetting(key,val){ _set(K.settings(key),val); },

  /* 班級難度預設（2026-08-02 新增，規劃書「輕量參數編輯器」第一批）：
     index.html 頂部一個全域旋鈕，null＝不干預（所有關卡維持原本寫死的
     預設值，向下相容）；設定後套用到目前支援的兩類數值——t06 風力強度
     倍率、t04/t05/t09 電量消耗速率——係數集中在這裡，以後要調鬆緊只改
     一個地方，不必到處找數字。之後如果要延伸到更多關卡，直接在對應
     關卡讀 classDiffCoef() 相乘即可，不需要改這裡。 */
  CLASS_DIFF_COEF:{easy:0.7,med:1.0,hard:1.3},
  classDifficulty(){ return _get(K.settings('classDifficulty'),null); },
  setClassDifficulty(v){ _set(K.settings('classDifficulty'),v); },
  classDiffCoef(){ return this.CLASS_DIFF_COEF[this.classDifficulty()]??1.0; },

  /* 單機排行榜（pk-turn.html 專用）：entry={name,score,metrics}，at 由本函式蓋章。
     每台電腦／每個瀏覽器各自本機保存，開新的一節課用 leaderboardClear 清空。 */
  leaderboardGet(levelId){ return _get(K.leaderboard(levelId),[]); },
  leaderboardAdd(levelId,entry){
    const list=_get(K.leaderboard(levelId),[]);
    list.push({...entry,at:new Date().toISOString()});
    _set(K.leaderboard(levelId),list);
    return list;
  },
  leaderboardClear(levelId){ try{localStorage.removeItem(K.leaderboard(levelId));}catch{} },

  /* 基本版舊資料一次性匯入（不刪舊 key——基本版繼續可用） */
  migrateLegacy(){
    if(_get(K.migrated))return false;
    let n=0;
    for(let i=1;i<=11;i++){
      const old=_get(`training-stage${i}-progress`);
      if(old){ _set(K.progress(`t${String(i).padStart(2,'0')}`),
        {...old,completed:old.completed||old.quizDone||false,migratedFrom:'basic'}); n++; }
    }
    const fm=localStorage.getItem('droneSimFlightMode');
    if(fm)_set(K.settings('flightMode'),fm);
    _set(K.migrated,{at:new Date().toISOString(),count:n});
    return n;
  },
};
