/* ============================================================
   seats.js — 席位（seat）服務（ES Module）
   newdrone Phase 4｜規劃書 5.2.2「pairing 升級為全系統基礎設施」
   ------------------------------------------------------------
   「席位」是引擎的一級概念：任何多人/PVP 關卡宣告需要幾席
   （manifest 的 maxSeats），pairing.html 負責逐席指派控制器
   （gamepad／keyboard／ai），寫入 nd.settings.seats.<activity>，
   關卡開場直接讀回、呼叫 input.playerFor(seat.controller) 取得
   正規化輸入。單人關卡不經過這裡（maxSeats:1 用預設值即可玩）。

   資料結構（每個 activity 一份，互不干擾）：
     nd.settings.seats.<activity> = [
       { seat:'P1', controller:{type:'gamepad',gpIndex:0}
                             | {type:'keyboard',layout:'KB1'}
                             | {type:'ai',diff:'med'},
         flightMode:'2', name:'' },
       ...
     ]
   ============================================================ */
'use strict';
import { progress } from './progress.js';

export const CTL_AI='ai', CTL_GAMEPAD='gamepad', CTL_KEYBOARD='keyboard', CTL_TOUCH='touch';
export const KB_LAYOUTS=['KB1','KB2'];

function key(activity){ return 'seats.'+activity; }

export const seats={
  /* 讀回某活動目前的席位表；沒有指派過回傳 null（呼叫端應導去 pairing.html） */
  get(activity){ return progress.setting(key(activity),null); },
  set(activity,list){ progress.setSetting(key(activity),list); },
  clear(activity){ progress.setSetting(key(activity),null); },

  /* 建立某活動的預設席位表（全部先給 AI，等大廳逐席指派）
     seatDefs：manifest 可選提供的席位描述陣列（如足球 SOCCER_SEATS），
     沒有提供就用 P1..Pn 純數字命名。 */
  makeDefault(n,seatDefs=null){
    return Array.from({length:n},(_,i)=>({
      seat:'P'+(i+1),
      label: seatDefs?.[i]?.label || ('P'+(i+1)),
      controller:{type:CTL_AI,diff:'med'},
      flightMode:'2',
      name:'',
    }));
  },

  /* 目前已被指派的 gamepad index 集合（大廳判斷「這支手把還沒被認領」用） */
  claimedGpIndexes(list){
    return new Set((list||[]).filter(s=>s.controller?.type===CTL_GAMEPAD)
      .map(s=>s.controller.gpIndex));
  },
  claimedKbLayouts(list){
    return new Set((list||[]).filter(s=>s.controller?.type===CTL_KEYBOARD)
      .map(s=>s.controller.layout));
  },
  humanSeats(list){ return (list||[]).filter(s=>s.controller?.type!==CTL_AI); },
  isValid(list,n){ return Array.isArray(list)&&list.length===n; },
};
