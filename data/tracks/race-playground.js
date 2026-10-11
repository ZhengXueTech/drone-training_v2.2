/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   tracks/race-playground.js — 改裝賽道「操場入門」的賽道資料（2026-10-11 從 levels/race-playground.html 原封搬出來，
   讓單人賽道與賽道對戰 levels/race-pk.html 共用同一份；內容一字未改）
   ============================================================ */
import * as THREE from 'three';
/* 賽道：橢圓上 10 個環，高度起伏；橘環＝加速（第 3、7 環）、綠環＝充電（第 5 環） */
const A=19, B=12, N=10, BOOST=[3,7], CHARGE=[5];
const rings=[];
for(let i=0;i<N;i++){
  const th=i/N*Math.PI*2;
  rings.push({p:new THREE.Vector3(A*Math.sin(th),2.2+1.6*Math.sin(th*2+0.8)+(i===0?0:0.4),B*Math.cos(th)),
    kind:BOOST.includes(i)?'boost':CHARGE.includes(i)?'charge':'ring'});
}
export const TRACK=({levelId:'race-playground',title:'操場入門',bounds:{x:26,z:18,y:10},rings,
  pit:new THREE.Vector3(-7,0,16),pitHint:'起點左後方',pitSignYaw:-Math.PI/2,
  spawn:new THREE.Vector3(-4.5,1.2,B),spawnYaw:-Math.PI/2,laps:3});
