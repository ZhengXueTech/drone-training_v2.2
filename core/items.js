/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   items.js — 改裝賽道「🎁 道具站」（2026-10-12，老師定案）
   ------------------------------------------------------------
   · 只放在一般（自穩）模式；單人賽道與同學對戰都有。
   · 賽道上幾個道具站，每站橫排 3 個發光「？」神秘箱；飛過去碰到＝立刻生效（不用按鍵，小朋友也會玩）。
     箱子被拿走後 6 秒再長出來。
   · 神秘箱隨機給：⚡ 加速、🔋 補電、🛡️ 護盾；對戰多一種 🌪️ 風暴彈（打前一名：被吹偏＋減速 2 秒）。
     落後的人比較容易拿到加速和風暴彈（像賽車遊戲的追趕機制），第一名拿不到風暴彈。
   · 位置：賽道資料可給 T.items:[{x,y,z,yaw}]；沒給就自動放在環與環之間（約 20%、50%、80% 處），避開亂流區、干擾區。
   ============================================================ */
import * as THREE from 'three';

export const ITEM_INFO={
  boost:{emoji:'⚡',name:'加速',msg:'⚡ 加速 3 秒！'},
  charge:{emoji:'🔋',name:'補電',msg:'🔋 補電 +25%！'},
  shield:{emoji:'🛡️',name:'護盾',msg:'🛡️ 護盾！下一次撞到不掉電'},
  storm:{emoji:'🌪️',name:'風暴彈',msg:'🌪️ 風暴彈發射！'},
};

export function itemStations(T,avoid=[]){
  if(T.items)return T.items;
  const P=T.rings.map(r=>r.p), n=P.length, out=[];
  for(const f of [0.2,0.5,0.8]){
    for(let k=0;k<n;k++){ const i=(Math.floor(n*f)+k)%n, a=P[i], b=P[(i+1)%n];
      const x=(a.x+b.x)/2, z=(a.z+b.z)/2, y=Math.max(1.4,(a.y+b.y)/2);
      if(avoid.some(o=>Math.hypot(o.x-x,o.z-z)<(o.r||3)+2.5)||out.some(o=>Math.hypot(o.x-x,o.z-z)<9))continue;
      out.push({x,y,z,yaw:Math.atan2(b.x-a.x,b.z-a.z)}); break; }
  }
  return out;
}

function boxTexture(){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=128; const g=cv.getContext('2d');
  const gr=g.createLinearGradient(0,0,128,128); gr.addColorStop(0,'#a855f7'); gr.addColorStop(1,'#ec4899');
  g.fillStyle=gr; g.fillRect(0,0,128,128); g.strokeStyle='#fff'; g.lineWidth=8; g.strokeRect(6,6,116,116);
  g.fillStyle='#fff'; g.font='bold 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('?',64,70);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}

export function createItemBoxes(scene,stations){
  const group=new THREE.Group(); scene.add(group);
  const geo=new THREE.BoxGeometry(0.75,0.75,0.75), mat=new THREE.MeshBasicMaterial({map:boxTexture(),transparent:true,opacity:0.92});
  const boxes=[];
  for(const s of stations){ const sx=Math.cos(s.yaw||0), sz=-Math.sin(s.yaw||0);
    for(const o of [-2.2,0,2.2]){ const m=new THREE.Mesh(geo,mat); m.position.set(s.x+sx*o,s.y,s.z+sz*o); group.add(m);
      boxes.push({mesh:m,base:m.position.clone(),cd:0}); } }
  let t=0;
  return {
    group,boxes,
    update(dt){ t+=dt; boxes.forEach((b,i)=>{ if(b.cd>0){ b.cd-=dt; if(b.cd<=0)b.mesh.visible=true; }
      b.mesh.rotation.set(0.4,t*1.6+i,0.2); b.mesh.position.y=b.base.y+Math.sin(t*2+i)*0.15;
      const s=b.cd>0?0:1+Math.sin(t*5+i)*0.06; b.mesh.scale.setScalar(s); }); },
    /* 碰到哪一箱（半徑 1.0 m）；拿走後 6 秒長回來。回傳 true＝拿到 */
    take(pos){ for(const b of boxes){ if(b.cd>0)continue; if(b.mesh.position.distanceTo(pos)<1.0){ b.cd=6; b.mesh.visible=false; return true; } } return false; },
    reset(){ boxes.forEach(b=>{ b.cd=0; b.mesh.visible=true; }); },
    set visible(v){ group.visible=v; }, get visible(){ return group.visible; },
  };
}

/* 神秘箱抽獎：rank＝0 第一名…；n＝參賽人數（單人＝1，沒有風暴彈） */
export function rollItem(rank=0,n=1,rnd=Math.random){
  const behind=n>1?rank/(n-1):0;                     // 0＝領先、1＝最後
  const w={boost:1+behind*1.2,charge:1,shield:1};
  if(n>1&&rank>0)w.storm=0.6+behind*1.4;
  const tot=Object.values(w).reduce((a,b)=>a+b,0); let r=rnd()*tot;
  for(const k in w){ r-=w[k]; if(r<=0)return k; } return 'boost';
}
