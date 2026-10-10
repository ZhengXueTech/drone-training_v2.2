/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   systems/ai.js — AI 行為（ES Module）v1.0
   newdrone Phase 1｜泛化自基本版 soccer-match.html 狀態機
   ------------------------------------------------------------
   - moveTo：P 控制趨近目標點（所有 AI 共用的基礎行為）
   - updateSoccerAI：足球 3v3 狀態機
       striker：stage（中場對準球門）→ charge（直線衝刺）→ stage
       support：TB 壓迫/攔截玩家、TA 側翼跟隨
       defender：TB 主動阻擋守門（追蹤玩家 X/Y）、TA 攔截敵方 striker
   - 難度參數表 AI_DIFF：速度倍率＋節奏／果斷度（規劃書 §7-1「難度參數表化」；
     2026-07-21 第二輪回饋加大三檔差距＋加入 react/align 節奏參數，
     真正的假動作/人味失誤等行為分級——留待 Phase 4 AI 專題）
   ============================================================ */
import * as THREE from 'three';
import { FIELD, SOCCER_PHYS, TA, TB } from './soccer.js';

// spd/gk/block：移動與撲防速度倍率（med＝原始基準值，不變＝三檔中原本手感不動）
// react：striker 進球/退回後要等多久才能再次衝刺的冷卻時間倍率（越小＝越快再衝）
// align：striker 判斷「是否對準可以衝刺」的容許誤差倍率（越大＝越隨便就衝、越果斷）
export const AI_DIFF={
  easy:{spd:0.6,  gk:2.6, block:6.0,  react:1.6, align:0.75},
  med: {spd:1.0,  gk:6.0, block:9.0,  react:1.0, align:1.0},
  hard:{spd:1.5,  gk:12.0,block:13.5, react:0.5, align:1.4},
};

const _tgt=new THREE.Vector3();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* P 控制趨近：距離×4.5 決定期望速度（上限 maxSpd），機頭轉向目標
   [FIX] 基本版把「世界座標」速度誤差直接塞進 integrate 的「機體座標」參數：
   yaw=0 的藍隊沒事，yaw=π 的紅隊指令整組反轉——紅隊 striker 永遠卡在
   自家底線牆上、從未成功進攻（基本版潛在 bug，headless 實測證實）。
   修正：先把世界系指令旋回機體系（ax=wx·cy−wz·sy, az=wx·sy+wz·cy），
   yaw=0 時與基本版完全相同（藍隊手感不變），yaw=π 時方向正確。 */
export function moveTo(d,tgt,dt,maxSpd){
  const P=SOCCER_PHYS;
  // 2026-08-03 新增（使用者回饋：AI 被撞後應該跟玩家一樣會「訊號異常」，
  // 不能撞完下一幀就秒修正回來，否則人機不公平）：AI 沒有搖桿輸入可以
  // 打折，但 moveTo() 就是 AI 版的「下指令給機身」——跟玩家的 dampInput()
  // 同一個概念，改成凍結異常觸發當下算出來的那組 (ax,ay,az,yr) 指令，
  // 之後每幀原樣重播，不再依 tgt 重新算，直到異常結束；updateSoccerAI()
  // 的狀態機（aiState/aiT）繼續照常演進——這代表「AI 的大腦還在想」，
  // 只是「訊號送不到機身」，跟玩家「手還在動搖桿、機身收不到」是同一回事。
  if(d.anomalyT>0){
    d.anomalyT=Math.max(0,d.anomalyT-dt);
    if(d._frozenCmd){
      d.integrate(dt,d._frozenCmd[0],d._frozenCmd[1],d._frozenCmd[2],d._frozenCmd[3]);
      if(d.anomalyT<=0)d._frozenCmd=null;
      return;
    }
  }else{
    d._frozenCmd=null;
  }
  const toT=tgt.clone().sub(d.pos);
  const dist=toT.length();
  if(dist<.05){d.integrate(dt,0,P.HOVER,0,0);return;}
  const spd=clamp(dist*4.5,0,maxSpd);
  const ve=toT.clone().normalize().multiplyScalar(spd).sub(d.vel);
  const ty=Math.atan2(toT.x,toT.z);                       // 機頭轉向目標
  const yd=Math.atan2(Math.sin(ty-d.yaw),Math.cos(ty-d.yaw));
  const wx=ve.x*.5, wz=ve.z*.5;                           // 期望世界系加速度
  const sy=Math.sin(d.yaw), cy=Math.cos(d.yaw);
  const ax=wx*cy-wz*sy, ay=P.HOVER+ve.y*.9, az=wx*sy+wz*cy, yr=yd*3.5;
  if(d.anomalyT>0)d._frozenCmd=[ax,ay,az,yr];
  d.integrate(dt, ax,ay,az,yr);
}

/* 足球 AI（沿基本版 updateAI；ctx={drones,player,SF,diff}） */
export function updateSoccerAI(d,dt,ctx){
  if(d.isPlayer)return;
  const F=FIELD, {drones,player}=ctx;
  const SF=ctx.SF??1, D=AI_DIFF[ctx.diff??'med'];
  const isA=d.team===TA;
  const attkGZ=isA?F.GZ:-F.GZ;
  const ds=isA?1:-1;
  d.aiT-=dt;

  // FAI：進球後退回己方半場
  if(d.mustReturn){
    _tgt.set((d.i%2-.5)*.3,1.2,isA?-.6:.6);
    moveTo(d,_tgt,dt,6*SF*D.spd);
    return;
  }

  switch(d.role){
    case 'striker':{   // stage → charge → stage
      if(d.aiState==='charge'){
        _tgt.set(0,F.GY,attkGZ+ds*.05);
        moveTo(d,_tgt,dt,11*SF*D.spd);
        // [難度] 衝刺後回到 stage 的冷卻時間 × D.react：hard 更快再度出擊，
        // easy 讓玩家有更多喘息空間
        if((d.pos.z-attkGZ)*ds>=-.05){d.aiState='stage';d.aiT=(.8+Math.random())*D.react;}
      }else{
        const stgZ=isA?.8:-.8;
        _tgt.set(0,F.GY,stgZ);
        moveTo(d,_tgt,dt,6*SF*D.spd);
        // 對準窗口比基本版放寬（.13/.25→.2/.35）：基本版此路徑因 moveTo bug
        // 從未實際執行；實測太嚴時 striker 被防守碰撞後很難再進入攻擊循環
        // [難度] × D.align：hard 較隨便就判定「對準」了、更果斷衝刺；
        // easy 要站得更準才會出手，給玩家防守反應時間（med＝原始基準不變）
        const aligned=Math.abs(d.pos.x)<.2*D.align&&Math.abs(d.pos.y-F.GY)<.2
                    &&Math.abs(d.pos.z-stgZ)<.35*D.align;
        if(aligned&&d.aiT<0){d.aiState='charge';d.aiT=3;}
      }
      break;
    }
    case 'support':{
      if(d.team===TB){
        if(player.pos.z>0)
          _tgt.set(player.pos.x*.65,clamp(player.pos.y,F.BR+.1,F.FH-F.BR-.1),player.pos.z-.4);
        else _tgt.set(d.i%2===0?-.4:.4,1.3,.5);
      }else{
        _tgt.copy(player.pos);
        _tgt.z-=.5; _tgt.x+=(d.i%2===0?-.35:.35);
        _tgt.y=clamp(_tgt.y,F.BR+.1,F.FH-F.BR-.2);
      }
      moveTo(d,_tgt,dt,5.5*SF*D.spd);
      break;
    }
    case 'defender':{
      if(d.team===TB){   // TB 守門員：主動阻擋
        const distP=d.pos.distanceTo(player.pos);
        const approaching=player.pos.z>F.GZ*.3;
        if(distP<0.55&&approaching){
          _tgt.set(clamp(player.pos.x,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(player.pos.y,F.BR+.1,F.FH-F.BR-.1),
                   clamp(player.pos.z,F.GZ-.9,F.GZ-.1));
          moveTo(d,_tgt,dt,D.block*SF);
        }else if(approaching){
          _tgt.set(clamp(player.pos.x*.85,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(player.pos.y,F.BR+.1,F.FH-F.BR-.1),F.GZ-.5);
          moveTo(d,_tgt,dt,D.gk*SF);
        }else{
          _tgt.set(0,F.GY,F.GZ-.5);
          moveTo(d,_tgt,dt,4*SF);
        }
      }else{             // TA 後衛：攔截敵方 striker（drones[3]）
        const bStr=drones[3];
        if(bStr&&bStr.pos.z<-F.GZ*.35)
          _tgt.set(clamp(bStr.pos.x*.85,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(bStr.pos.y,F.BR+.1,F.FH-F.BR-.1),-F.GZ+.55);
        else _tgt.set(0,F.GY,-F.GZ+.55);
        moveTo(d,_tgt,dt,6*SF*D.spd);
      }
      break;
    }
  }
}
