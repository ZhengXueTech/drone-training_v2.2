/* ============================================================
   systems/anomaly.js — 訊號異常／地面效應共用引擎（ES Module）
   newdrone 2026-08-03 新增（2026-08-03 second pass 依使用者回饋修正行為模型）
   ------------------------------------------------------------
   使用者回饋來源：「碰撞真實感」規劃的 D 項（起飛／降落地面效應搖桿異常）
   ＋足球對戰的 A-2 項（碰撞附帶失控）——兩者本質是同一件事：某個事件
   （貼地／撞擊）觸發後，玩家操控輸入送不到機身一段時間，期間 HUD 顯示
   「⚠ 訊號異常」，時間到自動收斂回正常操控。

   [FIX] 2026-08-03 使用者修正：第一版把異常做成「輸入打折 40%＋（pro 模式）
   姿態自動拉平」，這其實是「飛控溫和接管、幫你穩住」的模型——使用者澄清
   真實訊號異常是「維持剛剛控制的方向」：新指令送不到，機身只能沿用異常
   發生那一刻收到的最後一組指令繼續飛，不會有人幫你拉平，正因為玩家在這
   段時間怎麼動搖桿都不會被聽到、也沒有自動修正，才會飄到意料之外的
   位置——不是隨機亂轉亂噴力道，是「凍結指令＋沒人即時修正」自然造成的
   飄移。這裡改成：異常觸發當下把輸入「凍結」起來，之後每幀原樣重播這組
   凍結指令，直到異常結束為止；不再額外做姿態拉平（那件事交給 pro 模式
   本來就有的、貼地那一刻才生效的擺平邏輯，跟「飛行中訊號異常」是兩回事）。

   physics.js 的 Drone（全姿態四元數）、yaw-drone.js 的 YawDrone、
   soccer.js 的 SoccerDrone 是三個互不繼承的獨立 class（家族 B vs 家族 C），
   沒有共同基底可以掛方法，因此拆成這裡的純函式——任何物件只要有
   {anomalyT, _geArmed, _frozenInput} 三個欄位（呼叫端自己在建構子／reset()
   初始化為 0/false/null）就能直接共用，不需改變各自的 class 階層。

   數值來源：2026-08-03 使用者確認的方案（起降異常基礎機率 15%、持續
   0.4~0.8 秒）；輸入「凍結重播」的行為模型是同一天使用者澄清後修正的。
   ============================================================ */
export const ANOMALY_CONST={
  GE_HEIGHT: 0.4,   // 離地高度低於此值才算「貼地」
  GE_VSPEED: 1.0,   // 垂直速度絕對值需超過此值，代表正在起飛爬升／降落下降（非靜止懸停）
  GE_PROB: 0.15,    // 每次「進入」貼地狀態時的觸發機率
  GE_DUR_MIN: 0.4,
  GE_DUR_MAX: 0.8,
};

/** 疊加一段異常時間（取現有剩餘與新值的較大者，不會互相打斷縮短）。 */
export function triggerAnomaly(state,dur){
  state.anomalyT=Math.max(state.anomalyT||0,dur);
}

/** 每幀呼叫：貼地時「進入」該狀態的那一瞬間才擲一次骰，避免同一次貼地
    因為每幀都在門檻內而被拆成好幾次判定、機率被高刷新率放大。 */
/* 2026-09-30 新增（使用者：「可以從難度去關掉」）：起降異常機率跟著首頁「班級難度預設」走。
   初級＝關閉（0）、無設定／中級＝原本的 15%、高級＝25%。只影響起降地面效應；
   足球碰撞造成的訊號異常（triggerAnomaly）不受影響。頁面載入時讀一次即可
   （難度只在首頁設定，進關卡時已確定）。 */
export const GE_DIFF_MUL={easy:0,med:1,hard:25/15};
let _geDiffMul=1;
try{
  const v=JSON.parse(localStorage.getItem('nd.settings.classDifficulty'));
  if(v in GE_DIFF_MUL)_geDiffMul=GE_DIFF_MUL[v];
}catch{}
export function geDiffMul(){ return _geDiffMul; }
export function rollGroundEffect(state,posY,velY,C=ANOMALY_CONST){
  const nearGround=posY<C.GE_HEIGHT&&Math.abs(velY)>C.GE_VSPEED;
  if(nearGround&&!state._geArmed&&Math.random()<C.GE_PROB*_geDiffMul){
    triggerAnomaly(state,C.GE_DUR_MIN+Math.random()*(C.GE_DUR_MAX-C.GE_DUR_MIN));
  }
  state._geArmed=nearGround;
}

/** 異常期間把「異常觸發當下」的指令凍結起來，之後每幀原樣重播這組凍結
    指令（不理會玩家這段時間實際在動的搖桿），直到異常結束才解凍、恢復
    讀取即時輸入——回傳新物件，不動原本傳進來的 input；同時把 dt 從倒數
    計時扣掉，呼叫端每幀只需呼叫這一個函式即可，沒有異常時原樣傳回，
    完全不影響既有手感。 */
export function dampInput(state,input,dt,C=ANOMALY_CONST){
  if(!(state.anomalyT>0)){ state._frozenInput=null; return input; }
  if(!state._frozenInput){
    state._frozenInput={throttle:input.throttle,yaw:input.yaw,pitch:input.pitch,roll:input.roll};
  }
  state.anomalyT=Math.max(0,state.anomalyT-dt);
  const frozen=state._frozenInput;
  if(state.anomalyT<=0)state._frozenInput=null;
  return frozen;
}
