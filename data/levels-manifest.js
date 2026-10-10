/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市中正國中科技中心）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   levels-manifest.js — 關卡清單「單一真相來源」（ES Module）
   newdrone Phase 1｜規劃書 6.4
   ------------------------------------------------------------
   index / report / teacher / DPT / 成就 / pairing 全部由本表產生。
   新增關卡 = 這裡加一筆 + 薄 HTML 一份；勿在其他檔案另建對照表。
   欄位：id, title, part, file, modes, maxSeats, hud, metrics,
         doneField, unlockAfter, emoji, desc, hint
   （emoji/desc/hint＝index 選關卡片顯示用，取代 index.html 自己內嵌一份文字
     ——單一真相來源原則延伸到卡片文案，不再有第二份可以脫節）
   ⚠️ 2026-07-22 修復紀錄：Phase 3 開發 t03 時發現 t01/t02 雖然檔案已交付，
   但從未真的寫進這份 manifest——導致 t02-stickmapping.html 一開就因
   getLevel('t02')===null、new HUD(LEVEL.hud) 直接炸掉，且 index.html
   當時仍是 Phase 1 的純靜態頁面（不是從這份 manifest 動態產生卡片），
   t01/t02 完全連不到、report/teacher 也看不到這兩關的紀錄。已一併補上
   t01/t02，並把 index.html 改成動態由本表產生卡片（見下方修復說明）。
   ============================================================ */
export const LEVELS=[
  { id:'sandbox', title:'Phase 0 訓練場（沙盒）', part:'DEV',
    file:'levels/template.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:true},
    metrics:[{key:'rings',label:'穿環數'},{key:'flightTime',label:'飛行秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🚁', desc:'三裝置輸入、四視角、街機／專業雙模式、風場、穿環引導。',
    hint:'鍵盤 C 視角・M 模式・R 風場・Z 蹲' },
  { id:'acro-freeflight', title:'自由飛行練習場（角度／Acro 模式）', part:'DEV',
    file:'levels/acro-freeflight.html',
    // 2026-08-02 新增：acro／速率模式的物理（core/physics.js 的 _pro()）
    // 早就寫好，只是沒有任何關卡真的用它——這關就是專門開放它的獨立
    // 練習場，預設 mode:'pro'，不像其他關卡預設 arcade。刻意不做成
    // 教師端全域開關（跟班級難度預設不同層次），因為這是學生自己
    // 選擇要不要挑戰的加碼練習，不影響任何課程進度判定。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:true},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'selfLevelUses',label:'自穩使用次數'}],
    doneField:'completed', unlockAfter:null,
    // 2026-09-30：預設改為「角度模式」（使用者回報 Acro 推住會整台翻過去），Acro 改為按 M 進階切換
    emoji:'🌀', desc:'預設角度模式（放開自動回平、不會翻），按 M 可挑戰會翻滾的 Acro 模式；按住空白鍵／手把R1／畫面按鈕隨時可暫時自穩，沒有任務門檻。',
    hint:'M／手把 X 切換角度→Acro→街機・空白鍵/R1/畫面按鈕＝自穩・⚙ 挑戰條件可加環境風與檔位' },
  { id:'t01', title:'第一關 地面安全教育', part:'A', file:'levels/t01-checklist.html',
    modes:['solo'], maxSeats:1,
    hud:{},
    metrics:[{key:'correctCount',label:'答對題數'},{key:'totalQuestions',label:'測驗題數'},
             {key:'checklistDone',label:'檢查清單完成'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🦺', desc:'起飛前 6 項安全檢查清單，再從 12 題安全知識隨機抽 5 題作答，答對 4 題以上過關。',
    hint:'滑鼠點選・無需搖桿・純 2D 頁面' },
  { id:'t02', title:'第二關 搖桿位置對應教學', part:'A', file:'levels/t02-stickmapping.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🕹️', desc:'逐軸練習油門／偏航／俯仰／翻滾，練熟一個才解鎖下一個，最後綜合路線四軸全開穿環。',
    hint:'W/S 油門・A/D 偏航・↑↓ 俯仰・←→ 翻滾' },
  { id:'t03', title:'第三關 緊急處置教學', part:'A', file:'levels/t03-emergency.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:true},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'killAttempts',label:'緊急停止重試次數'},
             {key:'calmPresses',label:'緊急狀況按鍵次數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🛡️', desc:'三種真實飛行危急狀況：緊急停止（Kill Switch）、訊號突然失靈、被擦撞後姿態失控重新穩定。',
    hint:'SPACE 緊急停止・W/S/A/D/↑↓←→ 飛行' },
  { id:'t04', title:'第四關 飛行風險與環境應對', part:'A', file:'levels/t04-hazards.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,liquid:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'obstacleHits',label:'障礙碰撞'},
             {key:'finalBattery',label:'充電段完成電量'}],
    doneField:'completed', unlockAfter:null,
    emoji:'⚠️', desc:'墜機後果與換電池（閃避障礙柱、充電站補電，兩者歸零會迫降）＋陣風環境即時修正。',
    hint:'W/S/A/D/↑↓←→ 飛行・注意風向箭頭反向修正' },
  { id:'t05', title:'第五關 綜合障礙賽（單飛考核）', part:'A', file:'levels/t05-standalone.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'stabilityScore',label:'高度穩定度'},
             {key:'obstacleHits',label:'障礙碰撞'},{key:'aiHits',label:'無人機擦身'},
             {key:'finalBattery',label:'完賽電量'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏁', desc:'A 部分最終驗收：依序穿過 6 個檢查點，同時閃避障礙柱與巡邏無人機，記得去充電站補電。',
    hint:'W/S/A/D/↑↓←→ 飛行・C 切視角・依序穿環不能跳過' },
  { id:'t06', title:'第六關 逆風飛行', part:'B', file:'levels/t06-wind.html',
    modes:['solo','pk-turn'], maxSeats:1,
    hud:{battery:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:true},
    metrics:[{key:'windScore',label:'抗風分數'},{key:'stabilityScore',label:'穩定分數'},
             {key:'obstacleHits',label:'障礙碰撞'},{key:'flightTime',label:'飛行秒數'}],
    doneField:'completed', unlockAfter:'t05',   // 2026-07-22：t05 已上線，這個解鎖依賴
    // 從這次交付起真正生效（先前 t05 不存在時，index.html 的 isLocked() 對「前置關卡
    // 不存在於 LEVELS」一律視為不鎖，讓 t06 不會被還沒鋪好的關卡永久鎖死；現在 t05
    // 進來了，沒完成 t05 的學生會在 index 卡片上看到 t06 顯示為鎖定）
    emoji:'🌬️', desc:'劇本化側風＋zigzag 檢查點＋障礙柱＋充電站，結算抗風／穩定分數。',
    hint:'M 專業模式顯示姿態儀・Z/LB 蹲姿' },
  { id:'t07', title:'第七關 精準降落', part:'B', file:'levels/t07-landing.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'totalScore',label:'降落總分(300)'},{key:'crashCount',label:'降落過快次數'},
             {key:'flightTime',label:'飛行秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🎯', desc:'3 回合精準降落：降落墊依序縮小（3m→2m→1.2m），緩速下降並在墊上維持 1.5 秒，太快會判定墜機不計分。',
    hint:'W/S/A/D/↑↓←→ 飛行・緩速下降到墊子中心並保持' },
  { id:'t08', title:'第八關 限電規劃', part:'B', file:'levels/t08-battery.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'checkpointsCleared',label:'完成檢查點'},{key:'chargersUsed',label:'使用充電站數'},
             {key:'finalBattery',label:'完賽電量'},{key:'failCount',label:'電量耗盡次數'},
             {key:'flightTime',label:'飛行秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🔋', desc:'電量只有 35% 起飛，7 個檢查點可任意順序通過，3 座充電站每座限用一次且只能充到 85%，考驗路線與資源規劃。',
    hint:'W/S/A/D/↑↓←→ 飛行・善用小地圖規劃路線與充電站順序' },
  { id:'t09', title:'第九關 動態障礙', part:'B', file:'levels/t09-dynamic.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'obstacleHits',label:'動態碰撞次數'},
             {key:'stabilityScore',label:'高度穩定度'},{key:'finalBattery',label:'完賽電量'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🔶', desc:'6 個持續移動的障礙物（左右擺動／上下振動／圓形軌道），依序穿過 6 個檢查點，考驗觀察節奏、抓準時機。',
    hint:'W/S/A/D/↑↓←→ 飛行・觀察障礙節奏，安全空隙出現時快速通過' },
  { id:'t10', title:'第十關 城市峽谷', part:'B', file:'levels/t10-city.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'buildingHits',label:'建築物碰撞'},
             {key:'precisionScore',label:'飛行精準度'},{key:'finalBattery',label:'完賽電量'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏙️', desc:'密集建築群的狹窄廊道，依序飛到 6 個航點，最考驗操控精準度，擦到建築物會被彈開並計入碰撞。',
    hint:'W/S/A/D/↑↓←→ 飛行・建議切換 FPV 視角判斷廊道寬度' },
  { id:'t11', title:'第十一關 搜救任務', part:'B', file:'levels/t11-rescue.html',
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'flightTime',label:'飛行秒數'},{key:'foundCount',label:'尋獲倖存者'},
             {key:'totalDist',label:'飛行總距離(m)'},{key:'finalBattery',label:'完賽電量'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🆘', desc:'訓練課程最終關卡：6 名倖存者散落大地圖，沒有地圖也沒有方向指引，靠近 16m 內才會偵測到信標，找齊後返回出發點。',
    hint:'W/S/A/D/↑↓←→ 飛行・把地圖分區有系統地搜索' },
  { id:'soccer', title:'無人機足球 3v3', part:'C', file:'levels/soccer-match.html',
    modes:['solo','pk-turn'], maxSeats:1,           // 多席位 pvp 於 Phase 4 參數化
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true},
    metrics:[{key:'goalsA',label:'我方進球'},{key:'goalsB',label:'對方進球'},
             {key:'setsA',label:'我方節勝'},{key:'setsB',label:'對方節勝'},
             {key:'result',label:'勝負'}],
    doneField:'completed', unlockAfter:null,
    emoji:'⚽', desc:'FAI 規則（striker 得分・進球退回半場）、AI 隊友對手、3 節賽制。',
    hint:'C 視角・F 保護籠旋轉・可調機速與 AI 難度' },
  { id:'soccer-pvp', title:'無人機足球 PVP（1v1～3v3）', part:'C',
    file:'pages/pairing.html?activity=soccer-pvp', playFile:'levels/pvp.html',
    // Phase 4：pairing 升級為通用席位大廳，取代基本版 soccer-match-2p/4p/6p
    // 三份分歧檔案；file 是入口（先進大廳指派席位），playFile 是大廳按「開始」
    // 後真正跳轉的關卡——任何一席（不限 2/4/6 對稱）都能自由指派人類／AI。
    modes:['pvp'], maxSeats:6,
    seatLabels:['A隊 前鋒','A隊 中場','A隊 後衛','B隊 前鋒','B隊 中場','B隊 後衛'],
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true},
    metrics:[{key:'goalsA',label:'A隊進球'},{key:'goalsB',label:'B隊進球'},
             {key:'setsA',label:'A隊節勝'},{key:'setsB',label:'B隊節勝'},
             {key:'result',label:'勝負'},{key:'humanCount',label:'人類席位數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🤼', desc:'同螢幕真人對戰：6 席（雙隊前鋒／中場／後衛）自由指派搖桿／鍵盤／AI，2 人以上分割畫面且同隊固定同一邊。',
    hint:'先進大廳指派席位再開賽・搖桿搖一下可自動認領' },
  { id:'x-hover', title:'情境體驗：懸停挑戰', part:'D', file:'levels/x-hover.html',
    // Phase 5「exp 系列移植」第一關（移植自基本版 exp/exp-hover.html）——
    // 物理直接共用 core/physics.js 既有 Drone(arcade) 模式，見關卡內註解。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'score',label:'總得分'},{key:'stabilityScore',label:'穩定度(%)'},
             {key:'timeIn',label:'在圈秒數'},{key:'timeOut',label:'出圈秒數'},
             {key:'finalRadius',label:'最終圓圈半徑(m)'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌀', desc:'風力會不斷把無人機推離地面圓圈，圓圈還會隨時間縮小；在圈內加分、出圈扣分，60 秒後結算穩定度等級。',
    hint:'留意風向箭頭反向修正・圓圈越晚越小，務必集中精神' },
  { id:'x-cargo', title:'情境體驗：投遞任務', part:'D', file:'levels/x-cargo.html',
    // Phase 5「exp 系列移植」第二關（移植自基本版 exp/exp-cargo.html）——
    // 物理同樣共用 core/physics.js 的 Drone(arcade) 模式；地圖邊界改用對稱 BOUND=11
    // （原版為不對稱矩形場地，核心 Drone 類別僅支援對稱邊界）。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'score',label:'總得分'},{key:'runsCompleted',label:'完成趟數'},
             {key:'cargoDrops',label:'貨物掉落次數'},{key:'perfectRuns',label:'完美趟數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'📦', desc:'到取貨點拾取貨物，依序送到三個顏色投遞區；載貨時速度不可過快，碰到邊界或超速都會掉貨，90 秒內盡量完成多趟。',
    hint:'載貨時放慢速度靠近投遞區・注意畫面邊緣箭頭指引下一個目標' },
  { id:'x-chase', title:'情境體驗：追蹤訓練', part:'D', file:'levels/x-chase.html',
    // Phase 5「exp 系列移植」第三關（移植自基本版 exp/exp-chase.html）——
    // 玩家物理同樣共用 core/physics.js 的 Drone(arcade)；AI 對手是獨立於
    // core Drone 之外的自訂蛇形巡遊/逃跑邏輯；地圖邊界比照 x-cargo 改用
    // 對稱 BOUND=12（原版為不對稱矩形場地）。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'score',label:'總得分'},{key:'tagCount',label:'標記次數'},
             {key:'bestCombo',label:'最高Combo'},{key:'efficiencyPerMin',label:'效率(次/分)'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏷️', desc:'場上有一台粉紅 AI 無人機會蛇形閃避，追上並觸碰它可標記得分，連續標記能疊加 Combo，60 秒內盡量多標記。',
    hint:'越靠近 AI 閃得越快，練習預判逃跑路徑・畫面邊緣箭頭指引 AI 方向' },
  { id:'x-infinite', title:'情境體驗：動態變形挑戰', part:'D', file:'levels/x-infinite.html',
    // Phase 5「exp 系列移植」第四關／C2 家族最後一關（移植自基本版
    // exp/exp-infinite.html）——玩家物理同樣共用 core/physics.js 的
    // Drone(arcade)；穿環判定改用既有 makeRing()+checkRingPass()；
    // 場地邊界比照 t09 取遠大於實際航道的對稱 BOUND=48 當安全網
    // （原版無邊界限制）。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'score',label:'總得分'},{key:'currentLoop',label:'闖過圈數'},
             {key:'totalCheckpointsPassed',label:'通過光環數'},{key:'obstacleHits',label:'撞障礙次數'},
             {key:'aiHits',label:'擦身AI次數'},{key:'stabilityScore',label:'高度穩定度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🧬', desc:'每過 6 個檢查點地圖就全面亂數重組，圈數越高障礙柱與巡邏機越多越快；穿環加秒加分、連續穿越疊加 Combo，撞障礙或擦身 AI 會扣秒，倒數歸零結束。',
    hint:'觀察障礙/巡邏機節奏抓空隙穿環・連續穿越別中斷才能疊高 Combo 倍率' },
  { id:'x-goalkeeper', title:'情境體驗：守門挑戰', part:'D', file:'levels/x-goalkeeper.html',
    // Phase 5「exp 系列移植」C1 家族第一關（移植自基本版
    // exp/exp-goalkeeper.html）——玩家與 AI 前鋒物理改用新抽出的共用
    // 模組 core/systems/yaw-drone.js（YawDrone/aiMoveWorld，抽自
    // soccer.js 的 SoccerDrone，阻尼 dt 化）；球門判定沿用基本版
    // prevZ 跨越＋半徑自算法（場上同一顆球門會被多台前鋒重複穿越，
    // 不適合 scoring.checkRingPass 的一次性 passed 語意）；前鋒機體
    // 重用 exp-gk-red 樣式＋黃/橘 tint，不另刻 mesh。無數字排名，
    // 依擋下率算 1-3 星（沿基本版 rate=blocked/(blocked+conceded)）。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'blockedCount',label:'擋下次數'},{key:'goalsConceded',label:'失守次數'},
             {key:'stars',label:'星等'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🥅', desc:'操控守門機防守球門，阻擋 AI 前鋒衝鋒穿越。限時 60 秒，靠近攔截或撞偏前鋒即可擋下，前鋒穿過球門中心圈則算失守，依擋下率結算星等。',
    hint:'貼近球門正前方待命反應最快・注意前鋒從不同角度衝來' },
  { id:'x-bridge', title:'情境體驗：橋梁/電塔巡檢', part:'D', file:'levels/x-bridge.html',
    // Phase 5「exp 系列移植」C1 家族第二關（移植自基本版
    // exp/exp-bridge.html）——玩家物理沿用 core/systems/yaw-drone.js
    // 的 YawDrone（THRMAX16/PITCHMAX20/YAWMAX2.6/DRAG0.88，邊界不反彈
    // WBOUNCE=FBOUNCE=0）。這關場地是開放大場景（橋梁/電塔/高壓線，
    // 100 公尺級），跟守門籠小場地相反，改用 core/camera.js 的
    // CameraRig（透過 camProxy 轉接 yaw+PI 補償）。巡檢判定是「懸停
    // 節點附近累積進度」，維持基本版距離累加自算法，不用
    // scoring.checkRingPass（語意是穿越判定，不適合懸停累積）。
    // v1.1：使用者實測回饋後改為「情境（橋梁/電塔/高壓線）→ 難度
    // （簡單/中等/困難）」兩層選單，每種情境各自可調整難度（原
    // v1.0 誤把兩者綁死成同一組三選一）；機體樣式固定顯示本關主題
    // 「橋檢機」，不再吃全域裝備設定（跟其他情境體驗關卡一致）。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'scannedCount',label:'完成區段'},{key:'totalSections',label:'總區段'},
             {key:'collisionCount',label:'碰撞次數'},{key:'grade',label:'評級'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏗️', desc:'選擇橋梁/電塔/高壓線情境與簡單/中等/困難難度，飛到各巡檢節點附近懸停，進度條累滿即完成區段；按 B 鈕可啟動 3 倍速精密掃描加速，注意避開結構物碰撞與電量/時間耗盡。',
    hint:'懸停在節點掃描範圍內別亂飄・精密掃描加速用在關鍵時刻搶時間' },
  { id:'x-rescue', title:'情境體驗：山區搜救', part:'D', file:'levels/x-rescue.html',
    // Phase 5「exp 系列移植」C1 家族第三關（移植自基本版
    // exp/exp-rescue.html）——玩家物理沿用 core/systems/yaw-drone.js
    // 的 YawDrone（THRMAX16/PITCHMAX20/YAWMAX2.6/DRAG0.88，X/Z 邊界
    // 不反彈 WBOUNCE=0）。這關場地是起伏山地地形（50 公尺級開放場景），
    // 跟 bridge 一樣改用 CameraRig（camProxy 補償）。地形高度用程序化
    // 函式即時計算，YawDrone 內建的平面 minY 邊界關掉（設極低值不觸發），
    // 改在關卡自己的主迴圈用地形高度函式即時判斷碰撞（跟 bridge 的
    // checkStructureCollision 同一類設計，只是障礙物換成連續地形）。
    // 搜救偵測是「距離內一次性尋獲」（非懸停累積、非穿越判定），比
    // bridge 的懸停累積/goalkeeper 的重複判定都單純，屬於第三種獨立
    // 判定模式。難度（初級/中級/高級）純粹是數值難度（人數/偵測距離/
    // 風力/耗電/時間），跟 bridge v1.0 不同，這關沒有「情境跟難度綁死」
    // 的問題，維持單軸三選一即可，不需要拆兩層選單。機體樣式固定用
    // 本關主題「救援機」（rescue-search），不吃全域裝備設定（比照
    // x-bridge 使用者回饋修正後的全系列情境體驗關卡慣例）。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'foundCount',label:'尋獲人數'},{key:'totalTargets',label:'總人數'},
             {key:'collisionCount',label:'地形碰撞'},{key:'grade',label:'評級'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏔️', desc:'山難搜救：在起伏山區地形中搜尋倖存者，飛到 1.5m 內即可尋獲；按 B 鈕開啟熱成像大幅提升偵測距離（限時 15 秒，冷卻 20 秒），注意避開地形碰撞與電量/時間耗盡。',
    hint:'訊號條越滿代表越接近・熱成像留到訊號微弱時開啟效益最大' },
  { id:'x-inspection', title:'情境體驗：建築外牆巡檢', part:'D', file:'levels/x-inspection.html',
    // Phase 5「exp 系列移植」C1 家族第四關（移植自基本版
    // exp/exp-inspection.html）——玩家物理沿用 core/systems/yaw-drone.js
    // 的 YawDrone（THRMAX16/PITCHMAX20/YAWMAX2.6/DRAG0.88，邊界不反彈
    // WBOUNCE=FBOUNCE=0，跟 bridge 同一組數值）。難度（初級/中級/高級）
    // 純粹是數值難度（列數/欄數/時間/風力/掃描速度/耗電/異常面板數），
    // 場地（同一棟建築＋城市背景）不變，維持單軸三選一，不拆兩層選單
    // （跟 rescue 同一種情況）。建築本體是離散固定方塊，沿用 bridge
    // checkStructureCollision 的 box 障礙物設計。相機場地開放（±55
    // 公尺，飛手站位在建築外圍約 12 公尺），改用 CameraRig（camProxy
    // 補償）。巡檢判定分兩種：一般面板是懸停累積進度條（同 bridge），
    // 異常面板是「距離門檻 + 玩家主動按 B 鍵確認」（比 rescue 的距離
    // 自動觸發多一道確認手續，訓練學生主動回報異常）。機體樣式固定用
    // 本關主題「巡檢機」（inspect-cam）。B 鍵常駐提示從第一版就做對
    // （吸收 x-bridge/x-rescue 使用者實機回饋才補提示的教訓），gamepad
    // 提示統一用字母「B」，不用圈圈數字。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'scannedCount',label:'巡檢格數'},{key:'totalPanels',label:'總格數'},
             {key:'anomalyConfirmed',label:'異常確認'},{key:'collisionCount',label:'碰撞次數'},{key:'grade',label:'評級'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏢', desc:'建築外牆巡檢：圍繞建築飛行，懸停在牆面巡檢區累積掃描進度；發現橘色異常面板需飛近後按 B 鈕確認記錄，注意避開建築碰撞與電量/時間耗盡。',
    hint:'掃描距離太近或太遠都不會累積進度・異常面板要主動按 B 確認才算數' },
  { id:'x-agri', title:'情境體驗：農業精準噴藥', part:'D', file:'levels/x-agri.html',
    // Phase 5「exp 系列移植」C1 家族第五關／最後一關（移植自基本版
    // exp/exp-agri.html）——玩家物理沿用 core/systems/yaw-drone.js 的
    // YawDrone（THRMAX16/PITCHMAX20/YAWMAX2.6/DRAG0.88，但邊界反彈係數
    // 這關是 WBOUNCE:0.4／FBOUNCE:0.15，跟 bridge/inspection 的「撞停
    // 不彈」不同——每一關都重新讀基本版原始碼取值，不沿用前一關參數）。
    // 難度（初級/中級/高級）是數值難度疊加漸增障礙物（無→4樹→4樹+2電線
    // 桿），農田場地本身不變，維持單軸三選一（跟 rescue/inspection 同
    // 情況）。障礙物是離散圓柱體，碰撞用農田專屬「推開＋垂直彈升」演算
    // 法（不是 bridge/inspection 的反向速度簡化版，如實移植基本版手感）。
    // 場地雖小（8×5 公尺農田）但屬開放戶外場景（非封閉小房間），改用
    // CameraRig（camProxy 補償），跟 goalkeeper 的封閉守門籠決策不同。
    // 噴藥判定是本關特有的第六種獨立判定模式：距離內即時觸發（同
    // rescue）疊加高度/藥水/開關三重閘門。新增「藥水」資源（跟電量並
    // 存，只在噴藥時消耗，回補給站可回充兩者），沿用 core/hud.js 既有
    // 的 setLiquid()（hud 設定需加 liquid:true 才會渲染 DOM）。開關
    // 噴藥（B 鍵/鈕）是持續開關，沒有計時/冷卻，跟前四關的限時加速/
    // 一次性確認都不同型態，但 B 鍵常駐提示仍從第一版就做對（gamepad
    // 統一用字母「B」）。機體樣式固定用本關主題「農噴機」（agri-
    // sprayer）。做完這關，exp 系列 9 關全數移植完成。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,liquid:true,wind:true,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'sprayedCount',label:'噴藥格數'},{key:'totalCells',label:'總格數'},
             {key:'collisionCount',label:'碰撞次數'},{key:'grade',label:'評級'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌾', desc:'農業精準噴藥：低空飛越 8×5 農田，高度低於 3m 才能噴藥，覆蓋所有格子；按 B 鈕開關噴藥可節省藥水，注意避開樹木/電線桿，藥水或電量不足時飛回西南角補給站回充。',
    hint:'噴藥半徑越大越省時間・飛過已噴完的格子時可以關噴藥省藥水' },
  { id:'x-hover-pk', title:'情境體驗：懸停對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=x-hover-pk', playFile:'levels/x-hover-pk.html',
    // Phase 5「單人關卡 PK 化框架」低成本首例（規劃書 §9 成本表：
    // hover｜低成本｜場景不用改，加一席即可）。比照 soccer-match.html／
    // levels/pvp.html 的既有慣例：不修改單人版 x-hover.html，另開一份
    // 專屬 pk-live 檔案；file 指到 pairing 大廳（先指派 2 席），
    // playFile 是大廳按「開始」後真正跳轉的關卡。
    // 兩個懸停圈並排（圈心 X=-6/+6，最大半徑 5m，邊緣最近距離仍有 2m
    // 不重疊），共用同一組風場（同一陣風同時考驗兩人，比較才公平），
    // 縮圈時間表跟單人版完全同公式。沒有套用 core/hud.js（該元件是
    // 單人視角設計，分割畫面比照 pvp.html 用輕量頂部列＋自訂分割線／
    // 格標籤，固定左右各一格，不需要足球那種 quad/hex 動態配置）。
    // AI 席位用全零輸入（arcade 模式零輸入＝定高但不主動修正水平風），
    // 剛好符合懸停挑戰「風會不會把你吹走」的核心測驗精神，不需要另外
    // 刻一套 AI 控制器。機體固定沿用單人版主題「trainer-orb」，P1/P2
    // 改用藍/橘紅 tint 區分。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Score',label:'P1得分'},{key:'p2Score',label:'P2得分'},
             {key:'p1Stability',label:'P1穩定度(%)'},{key:'p2Stability',label:'P2穩定度(%)'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌀', desc:'懸停對戰版：P1／P2 並排各自懸停在自己的地面圓圈上方，共用同一陣風、圈同步縮小，60 秒後比穩定分高下。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'跟單人懸停挑戰同一套操作手感・兩人共用風場，比的是誰修正得快' },
  { id:'goalkeeper-pk', title:'情境體驗：守門對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=goalkeeper-pk', playFile:'levels/goalkeeper-pk.html',
    // Phase 5「單人關卡 PK 化框架」低成本第二例（規劃書 §9 成本表：
    // goalkeeper／multidef｜低成本｜一攻一守，本來就是攻防結構，AI
    // 換成真人｜天生 PvP）。不修改單人版 x-goalkeeper.html，另開專屬
    // 檔案（比照 x-hover-pk 對 x-hover.html 的作法）。
    // 跟 x-hover-pk「兩人各自獨立、並排場地」不同，這關天生不對稱：
    // 席 0＝守門（防守方，沿用單人版 gkDrone 角色），席 1＝前鋒
    // （進攻方，取代單人版原本的 AI 攻擊機）。兩人共用同一個場地／
    // 同一顆球門（比照 pvp.html／soccer-match.html 的同場分割畫面），
    // 不是各自一半場地。
    // AI 席位處理：前鋒席若為 AI，直接沿用單人版 updateAttacker() 的
    // 瞄準/抖動/aiMoveWorld 邏輯（單人版本來就有、已驗證的真前鋒
    // 行為）；守門席若為 AI，單人版沒有這個角色，新寫一個最小可行的
    // 區域防守 AI（貼球門線、左右上下追蹤前鋒投影位置）——兩者都是
    // 有意義的主動行為，刻意不沿用 x-hover-pk「零輸入基準線」的技巧
    // （那個技巧只對「懸停不動」的任務語意成立，這關若守門或前鋒
    // 零輸入，對戰就失去意義，見專案記憶教訓）。兩個 AI 的速度／
    // 敏捷度都吃各自席位在 pairing 大廳選的 controller.diff（seats.js
    // 既有的逐席 AI 難度欄位），不疊加一個全場共用難度選單。
    // 沒有套用 core/hud.js（分割畫面，比照 pvp.html／x-hover-pk 用
    // 輕量頂部列＋自訂分割線／格標籤）。物理家族與單人版相同
    // （core/systems/yaw-drone.js 的 YawDrone，yaw=0 機頭朝 +Z），
    // 分割相機沿用 pvp.html 的正負號慣例，已用 __ndDebug 世界座標
    // 數學驗證過方向正確（不是只憑「同一物理家族」就假設沒事）。
    // 只提供「賽局時間」三選項（30/60/90 秒）取代單人版的難度選單——
    // 前鋒若是真人就無所謂 AI 難度，若前鋒是 AI 則難度已由 pairing
    // 逐席設定決定，這裡改給老師「調整比賽長度」這個更實用的選項。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['守門','前鋒'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'blockedCount',label:'守門擋下次數'},{key:'goalsScored',label:'前鋒得分次數'},
             {key:'saveRate',label:'守門擋下率(%)'},{key:'winner',label:'勝方'},
             {key:'humanCount',label:'人類席位數'},{key:'matchTime',label:'賽制秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🥅', desc:'守門對戰版：席 0 守門防守球門，席 1 前鋒衝鋒進攻，天生一攻一守的真人對戰。前鋒穿過球門中心圈得分，撞偏／擦身算擋下，比賽結束比守門擋下率高低。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'守門貼近球門正前方待命反應最快・前鋒多變換角度衝刺較難防守' },
  { id:'chase-pk', title:'情境體驗：追逐對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=chase-pk', playFile:'levels/chase-pk.html',
    // Phase 5「單人關卡 PK 化框架」低成本第三例（規劃書 §9 成本表：
    // chase｜低成本｜你追我逃，AI 目標機換成玩家機｜天生 PvP）。不修改
    // 單人版 x-chase.html，另開專屬檔案。
    // 跟 goalkeeper-pk 一樣天生不對稱：席 0＝追蹤者（沿用單人版玩家
    // 角色，全姿態搖桿操控），席 1＝逃跑者（取代單人版原本蛇形閃避的
    // 粉紅 AI，改由真人操控）。兩人共用同一個開放場地（單人版
    // BOUND=12 對稱場地＋四方位地標），不是各自一半場地。
    // 這關是 C2 家族（core/physics.js 的 Drone，yaw=0 機頭朝 -Z）——
    // 分割相機沿用 x-hover-pk 已驗證過的 +sinθ,+cosθ 公式，不是
    // goalkeeper-pk／pvp.html 的 C1 公式；即便同慣例仍用 __ndDebug
    // 獨立驗算過一次才交付。
    // 逃跑者現在是一台真正可操控的 core/physics.js Drone（不是單人版
    // 那個 plain pos/vel/yaw 物件），這樣真人才有完整搖桿飛行手感。
    // AI 席位處理：逃跑者 AI 沿用單人版 updateAI() 的巡遊/閃避決策
    // 邏輯，但執行方式改走新寫的 droneSteerToward()（把目標點轉成
    // 搖桿指令餵給 Drone.update()，不直接竄改 pos/vel/yaw，避免跨
    // 物理家族的機頭慣例混用風險）；追蹤者 AI 是單人版沒有的新角色，
    // 純追擊＋簡單預判攔截，一樣走 droneSteerToward()。兩者的積極度
    // 都吃各自席位在 pairing 大廳選的 diff。標記接觸半徑固定（不吃
    // diff，攔截寬容度是追蹤者的抓取判定，跟對手是 AI/真人無關）。
    // 用「賽局時間」三選項（30/60/90 秒）取代單人版難度選單，比賽
    // 結束依「標記次數是否達標」判定勝負。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['追蹤者','逃跑者'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'tagCount',label:'標記次數'},{key:'bestCombo',label:'最高連擊'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'},
             {key:'matchTime',label:'賽制秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏷️', desc:'追逐對戰版：席 0 追蹤者、席 1 逃跑者，你追我逃的真人對戰。追蹤者碰到逃跑者算標記，5 秒內連續標記可疊加 Combo，標記次數達標即獲勝，時間到沒達標則逃跑者判定成功逃脫。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'追蹤者善用預判攔截路線・逃跑者靠急轉甩開追蹤者最有效' },
  { id:'cargo-pk', title:'情境體驗：投遞對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=cargo-pk', playFile:'levels/cargo-pk.html',
    // Phase 5「單人關卡 PK 化框架」中成本第一例（規劃書 §9 成本表：
    // cargo｜中｜配送競速：同場搶單或各送各的比總量｜落點判定改
    // per-seat）。不修改單人版 x-cargo.html，另開專屬檔案。
    // 跟 goalkeeper-pk／chase-pk 的「天生不對稱、AI 換真人」結構不同，
    // 這關是對稱同任務（兩人做同一件事，比誰送得多），架構上比較接近
    // x-hover-pk。採用「各送各的比總量」：兩人共用同一個取貨點／同一組
    // 3 個落點，各自的取貨/投遞進度完全獨立（P[0]/P[1] 各自一份
    // cargoHeld/deliveryStep/score），沒有「搶單」意義下的資源爭奪——
    // 這正是成本註記「落點判定改 per-seat」的實際做法，也是維持中成本
    // （而非高成本）的關鍵簡化。
    // 沿用單人版整場難度選單（easy/med/hard 對應限速/落點大小）讓雙方
    // 共用同一套規則才公平，不像 goalkeeper-pk／chase-pk 那樣改用
    // 「賽局時間」選項——因為這兩關兩人角色不同（天生不對稱），這關
    // 兩人做同一件事，需要跟 x-hover-pk 一樣共用難度曲線才公平。
    // AI 席位：單人版沒有這個角色（純玩家操控，零輸入在這關不是合理
    // 基準線——貨物永遠送不出去），新寫自動送貨 AI，沿用 chase-pk 那個
    // 從 core/physics.js 的 _arcade() 公式反推的安全轉向函式
    // droneSteerToward()（本檔獨立複製一份，維持每個 pk-live 檔案
    // 自包含），依序導航取貨點→①→②→③→回取貨點，並在載貨時收斂轉向
    // 強度＋每幀安全夾速，避免 AI 因轉向策略不夠精準而誤觸超速掉貨。
    // 相機：C2 家族，沿用 x-hover-pk／chase-pk 已驗證過的 +sinθ,+cosθ
    // 公式，已用 __ndDebug 獨立驗算過方向正確。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Score',label:'P1得分'},{key:'p2Score',label:'P2得分'},
             {key:'p1Runs',label:'P1完整投遞輪數'},{key:'p2Runs',label:'P2完整投遞輪數'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'},
             {key:'diff',label:'難度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'📦', desc:'投遞對戰版：P1／P2 共用同一個取貨點與 3 個落點，各自獨立取貨→依序送達，各送各的比總得分，90 秒後比高下。速度超限或碰邊界會掉貨。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'兩人共用同一套限速規則，控制水平速度是關鍵・善用落點順序規劃路線' },
  { id:'agri-pk', title:'情境體驗：農噴對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=agri-pk', playFile:'levels/agri-pk.html',
    // Phase 5「單人關卡 PK 化框架」中成本第二例（規劃書 §9 成本表：
    // agri｜中｜同田搶噴／各噴各的比覆蓋率｜覆蓋格加 owner 欄位）。
    // 不修改單人版 x-agri.html，另開專屬檔案。
    // 跟 cargo-pk（各送各的，互不干涉）不同，這關採用「同田搶噴」：
    // 8×5=40 格農田只有一份，兩人共用，每格新增 owner 欄位
    // （null|0|1），先噴到的格子永久算誰的（不會被對方蓋掉）——這正是
    // 成本註記「覆蓋格加 owner 欄位」的實作。跟 cargo-pk 同屬對稱同
    // 任務型，沿用單人版整場難度選單（easy/med/hard 對應障礙物疊加）
    // 讓雙方共用同一套規則才公平。
    // 關鍵設計決策：core/input.js 的 playerFor() 對 keyboard/touch
    // 席位完全沒有按鍵偵測（btn/btnEdge/fnEdge 恆為 false，只有
    // gamepad 有），單人版「按 B 鍵開關噴藥」這個手動開關在 PK 版
    // 沒辦法逐席偵測——解法是拿掉這顆開關，改成條件滿足就自動噴
    // （高度<3m 且藥水>0 且不在補給站），不擴充共用輸入層。
    // 補給站改成兩座（NW／SE 對角），跟兩位玩家的對角出生點成 180°
    // 點對稱，確保雙方到補給站的距離公平（單人版只有一位玩家、一座
    // 西南角補給站，PK 版兩人必須重新設計這點）。電量歸零只讓該玩家
    // 停飛，不結束整場比賽（不像單人版電量=0 直接結束任務）。
    // AI 席位：單人版沒有這個角色，新寫「找最近未認領格子」的搶地盤
    // AI，走 goalkeeper-pk 已驗證的 aiMoveWorld()（C1 家族），並帶
    // 資源管理狀態機（電量/藥水低於門檻自動返航，含遲滯）。
    // 相機：C1 家族，沿用 goalkeeper-pk 驗證過的原始 yaw、-sinθ,-cosθ
    // 公式，偏移距離放大適合開放農田，已用 __ndDebug 獨立驗算方向。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Cells',label:'P1佔格數'},{key:'p2Cells',label:'P2佔格數'},
             {key:'totalCells',label:'農田總格數'},{key:'winner',label:'勝方'},
             {key:'humanCount',label:'人類席位數'},{key:'diff',label:'難度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌾', desc:'農噴對戰版：P1／P2 共用同一片 8×5 農田搶地盤，飛低於 3m 且藥水充足自動噴藥，先噴到的格子算誰的，時間到或全部有主，比誰佔格多。兩座補給站可回充電量/藥水。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'善用兩座補給站輪流回充・鎖定對手還沒佔的角落搶快' },
  { id:'rescue-pk', title:'情境體驗：搜救對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=rescue-pk', playFile:'levels/rescue-pk.html',
    // Phase 5「單人關卡 PK 化框架」中成本第三例（規劃書 §9 成本表：
    // rescue｜中｜同場搶找信標，誰找到算誰的｜信標加 claimed-by）。
    // 不修改單人版 x-rescue.html，另開專屬檔案。
    // 跟 agri-pk（同田搶噴）同一種玩法家族：山區地形只有一份，兩人
    // 共用同一組信標，每個信標新增 foundBy 欄位（null|0|1），先找到
    // 的永久算誰的（不會被對方搶走）——直接沿用 agri-pk 已驗證過的
    // 「一次性認領、永久鎖定」模式。屬於對稱同任務型，沿用單人版
    // 整場難度選單（easy/med/hard 對應信標數/耗電/風力/時間）。
    // 關鍵設計決策：跟 agri-pk 拿掉「開關噴藥」同一思路，這裡拿掉
    // 單人版「按 B 鍵啟動熱成像、限時 15 秒、冷卻 20 秒」的兩段式
    // 狀態機（core/input.js 對鍵盤/觸控席位沒有按鍵偵測）——但熱成像
    // 不是非核心技巧（沒有它偵測距離只有 1.5m，50×50 山地幾乎找不到
    // 信標），所以不是單純拿掉，而是直接把 curCfg.detectR（原熱成像
    // 模式的偵測距離）當成本關唯一、恆定的偵測半徑，同時解決「不需要
    // 按鍵偵測」跟「保留可尋獲性」兩個問題，對雙方公平。
    // 出生點：南／北兩端分列（跟 goalkeeper/agri 對角出生同精神），
    // 信標池本來就散佈地圖中央，不需要像 agri-pk 那樣重新設計資源點
    // 座標公平性（這關沒有補給站）。
    // AI 席位：單人版沒有這個角色，新寫「找最近未認領信標」導航，
    // 沿用 goalkeeper-pk／agri-pk 已驗證的 aiMoveWorld()（C1 家族）。
    // 電量：沿單人版連續耗電（無補給站），歸零比照 agri-pk 的「停飛
    // 不停賽」原則，不結束整場比賽。
    // 相機：C1 家族，沿用 -sinθ,-cosθ 公式，偏移距離放大到適合
    // 50×50 開放山地的量級，已用 __ndDebug 獨立驗算方向。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Found',label:'P1尋獲人數'},{key:'p2Found',label:'P2尋獲人數'},
             {key:'totalTargets',label:'倖存者總人數'},{key:'winner',label:'勝方'},
             {key:'humanCount',label:'人類席位數'},{key:'diff',label:'難度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏔️', desc:'搜救對戰版：P1／P2 在同一片山區搶搜同一組倖存者信標，飛到偵測範圍內即可尋獲，先找到的算誰的，時間到或全部尋獲，比誰找得多。注意避開地形碰撞與電量消耗。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'恆定偵測半徑取代熱成像開關・優先鎖定離自己最近的信標搶快' },
  { id:'infinite-pk', title:'情境體驗：無限穿環對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=infinite-pk', playFile:'levels/infinite-pk.html',
    // Phase 5「單人關卡 PK 化框架」中成本第四例／最後一例（規劃書 §9
    // 成本表：infinite｜中｜同場同環序競速）。不修改單人版
    // x-infinite.html，另開專屬檔案。
    // 跟 cargo-pk／agri-pk／rescue-pk（共用同一份場地/物件搶）都不同，
    // 這關沿用 x-hover-pk 的「並排各自一份」模式：兩人在同一場景各自
    // 擁有一份完全獨立、各自程序化生成的 6 環賽道（P1 賽道中心
    // x=-16、P2 賽道中心 x=+16），維持中成本，不需要處理「同一顆環
    // 該算誰的」爭奪邏輯。
    // 跟另外三關不同：單人版沒有整場難度選單可以沿用（只有一顆「挑戰
    // 未知賽道」按鈕，難度靠圈數自然遞增），退而借用 goalkeeper-pk／
    // chase-pk 的「賽局時間」選項（60/90/120 秒）——這不代表重新分類
    // 成天生不對稱型，只是難度選單機制沒有更好選項時的務實借用。
    // 計分機制也做了對應調整：單人版「穿環加秒/撞到扣秒」的存活制，
    // 改成「全場固定倒數時間，穿環加分、撞障礙/擦身AI扣分」，因為賽局
    // 時鐘現在是雙方共用的固定值，個人化的時間增減沒有意義。
    // AI 席位：單人版沒有「玩家 AI 對手」（只有環境巡邏機當障礙），
    // 新寫自動穿環 AI，沿用 cargo-pk/chase-pk 的 droneSteerToward()
    // （C2 家族安全轉向函式）。機體樣式改用可染色的 trainer-orb（沿用
    // cargo-pk/agri-pk/rescue-pk 的做法，因為單人版固定造型 infinite-neon
    // 不吃 tint 參數）。這關沒有資源系統，不需要處理停飛/補給站公平性。
    // 相機：C2 家族，沿用 +sinθ,+cosθ 公式，已用 __ndDebug 獨立驗算。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Score',label:'P1得分'},{key:'p2Score',label:'P2得分'},
             {key:'p1Loop',label:'P1闖過圈數'},{key:'p2Loop',label:'P2闖過圈數'},
             {key:'p1Passed',label:'P1穿環數'},{key:'p2Passed',label:'P2穿環數'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'},
             {key:'matchTime',label:'賽制秒數'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🧬', desc:'無限穿環對戰版：P1／P2 各自擁有一條獨立無限賽道（並排放置），依序穿環得分，每過 6 環地圖全面重組，圈數越高障礙/AI越多越快。撞障礙/擦身AI扣分，時間到比總分。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'善用 Combo 連續穿環拉高倍率・撞到障礙立刻有 1 秒無敵時間可以喘息' },
  { id:'bridge-pk', title:'情境體驗：橋梁/電塔巡檢對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=bridge-pk', playFile:'levels/bridge-pk.html',
    // Phase 5「單人關卡 PK 化框架」高成本第一例（規劃書 §9 成本表：
    // bridge｜高｜同結構搶巡檢段，先完成算誰的｜段落加owner＋沿用
    // 情境×難度雙層選單）。不修改單人版 x-bridge.html，另開專屬檔案。
    // 跟 agri-pk／rescue-pk 同一種「同場搶X」玩法家族，但成本更高：
    // ①單人版本身就有「情境（橋梁/電塔/高壓線）×難度（簡單/中等/
    // 困難）」兩層選單與三套完全不同的結構幾何，PK 版原封不動保留；
    // ②單人版判定是「懸停累積進度條」（dwell 累加），不是一次性觸發，
    // 兩人共用同一份節點時採「任一方在範圍內都讓共用進度前進，衝過
    // 100%那一刻正在貢獻進度的玩家鎖定」，同幀平手 P1 優先（跟 agri/
    // rescue 的一次性認領同一套簡化原則，只是換成累加版）。
    // 關鍵決策：整個拿掉「精密掃描加速」（B鍵技能，非核心/便利性技巧，
    // 跟 agri-pk 拿掉噴藥開關同思路——雙方分頭巡檢天生比單人快，部分
    // 彌補拿掉加速的損失）。
    // AI／物理：C1 家族 YawDrone＋aiMoveWorld（因節點含高塔頂端最高
    // 21m，AI 目標搜尋改用真 3D 距離）。出生點南／北兩端分列（三種
    // 情境節點配置都對稱，不需額外處理公平性）。電量：連續耗電、無
    // 補給站，歸零比照「停飛不停賽」。相機：C1 家族 -sinθ,-cosθ，
    // 偏移 8.0/3.6（場地±50公尺級，比 agri/rescue 都大），已用
    // __ndDebug 獨立驗算。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Scanned',label:'P1完成段數'},{key:'p2Scanned',label:'P2完成段數'},
             {key:'totalSections',label:'總段數'},{key:'scenario',label:'情境'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'},
             {key:'diff',label:'難度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏗️', desc:'橋梁/電塔巡檢對戰版：P1／P2 在同一座結構（橋梁/電塔/高壓線任選）共同巡檢，飛到節點附近懸停累積掃描進度，先完成的節點永久算誰的，時間到或全部完成，比誰完成得多。注意避開結構碰撞與電量消耗。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'拿掉單人版的掃描加速技巧・兩人分頭巡檢不同節點效率更高' },
  { id:'inspection-pk', title:'情境體驗：建築外牆巡檢對戰（PK）', part:'D',
    file:'pages/pairing.html?activity=inspection-pk', playFile:'levels/inspection-pk.html',
    // Phase 5「單人關卡 PK 化框架」高成本第二例／最後一例（規劃書 §9
    // 成本表：inspection｜高｜同建築搶面板，先掃完算誰的｜面板加
    // owner＋合併兩種判定模式為一種）。不修改單人版 x-inspection.html，
    // 另開專屬檔案。
    // 跟 bridge-pk 同一種「同場搶X＋dwell累加」玩法，共用同一份牆面/
    // 面板清單，panel.owner 決定歸屬。
    // 關鍵決策：單人版有兩種判定模式——(a)一般面板懸停累積 (b)異常
    // 面板距離門檻+按B鍵顯式確認。core/input.js 對鍵盤/觸控席位沒有
    // 按鍵偵測，但異常巡查的教學核心是「巡檢到異常要能被記錄」，不是
    // 「按鍵確認」動作本身，所以不是整個拿掉異常機制，而是把兩種判定
    // 模式合併成一種：異常面板改用跟一般面板相同的懸停掃描自動判定，
    // 只是分數權重更高、未完成前持續橘色警示閃爍（一般面板只在實際
    // 被掃描時才有進度回饋），維持異常的醒目辨識度。這是繼 agri-pk
    // （整個拿掉開關）、rescue-pk（保留數值拿掉限時/冷卻）、bridge-pk
    // （整個拿掉加速）之後第四種「移除鍵盤無法偵測手動機制」的具體
    // 解法：這次是「合併判定模式」。
    // AI／物理：C1 家族 YawDrone＋aiMoveWorld（目標依面板所在牆面
    // 法向外推到掃描距離帶中點，不會直接撞牆）。出生點南／北兩端
    // 分列（四面牆配置本身對稱）。電量：連續耗電、無補給站，歸零
    // 比照「停飛不停賽」。相機：C1 家族 -sinθ,-cosθ，偏移 6.5/3.0
    // （介於 agri-pk 與 rescue-pk/bridge-pk 之間），已用 __ndDebug
    // 獨立驗算。
    modes:['pk-live'], maxSeats:2,
    seatLabels:['P1','P2'],
    hud:{battery:false,wind:false,minimap:false,telemetry:false,gpbar:false,attitude:false},
    metrics:[{key:'p1Scanned',label:'P1完成面板數'},{key:'p2Scanned',label:'P2完成面板數'},
             {key:'totalPanels',label:'總面板數'},{key:'p1Anomaly',label:'P1異常面板數'},
             {key:'p2Anomaly',label:'P2異常面板數'},{key:'anomalyTotal',label:'總異常面板數'},
             {key:'winner',label:'勝方'},{key:'humanCount',label:'人類席位數'},
             {key:'diff',label:'難度'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏢', desc:'建築外牆巡檢對戰版：P1／P2 圍繞同一棟建築巡檢，飛到面板前懸停累積掃描進度，先完成的面板永久算誰的。橘色異常面板判定方式相同，只是分數權重更高、持續閃爍警示。時間到或全部完成，比誰完成得多。需先到席位大廳指派搖桿/鍵盤/AI。',
    hint:'異常面板持續閃爍・優先搶分數權重較高的異常面板' },
  { id:'soccer-real', title:'無人機足球 擬真賽規版', part:'C', file:'levels/soccer-real.html',
    // 2026-07-26：規則教育版——依 FAI F9A-B／教育部115年賽規（3局3分鐘、
    // 3戰2勝、平手黃金進球、判定固定正式FAI整球穿過）。裁判系統只盯玩家
    // （AI 是守規矩示範機）：搶飛（起飛信號倒數中離地，B.8.2）／守門員
    // 進環防守（B.8.4，玩家選守門後衛角色時生效）／得分後未退回半場即
    // 進攻（教育部）——皆判對方點球（簡化＝對方直接+1，intro 有註明與
    // 正式點球的差異）；同局3次違規＝黃牌本局停飛（黃紅牌制簡化版）。
    // 玩家可選角色：前鋒（可得分）或守門後衛（得分交給 A 隊 AI striker，
    // applyRole() 對調 seat0/seat2 的 role，updateSoccerAI 對 striker 的
    // 處理本來就按 team 泛化，A 隊 AI 前鋒可正常進攻得分）。每局獨立電池
    // ＋局間換電池量電壓（B.1.2），低電量推力衰減、不墜機。
    modes:['solo'], maxSeats:1,
    hud:{battery:false,wind:false,minimap:true,telemetry:true,gpbar:true},
    metrics:[{key:'goalsA',label:'我方進球'},{key:'goalsB',label:'對方進球'},
             {key:'setsA',label:'我方局勝'},{key:'setsB',label:'對方局勝'},
             {key:'fouls',label:'判罰次數'},{key:'result',label:'勝負'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏆', desc:'正式賽規教育版：起飛信號（搶飛判點球）、守門員不可進環、得分後退回半場、局間換電池量電壓、3戰2勝平手黃金進球；判定固定 FAI 正式標準。可選前鋒或守門後衛角色。',
    hint:'裁判只盯你——AI 全程守規矩・零犯規完賽有隱藏彩蛋字樣' },
  { id:'race-playground', title:'改裝賽道 操場入門', part:'R', file:'levels/race-playground.html',
    // 2026-10-09 改裝賽道第一階段（設計稿＝專案 claude/newdrone-改機設計.md）：用機庫（pages/garage.html）組的機體跑穿圈賽道，
    // 3 圈計時賽＋幽靈機＋進站換電池＋加速／充電環。成績＝總秒數（越少越好），改裝機成績一起比。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'time',label:'總秒數'},{key:'bestLap',label:'最快一圈'},{key:'pits',label:'進站次數'},{key:'hits',label:'撞牆次數'},{key:'build',label:'機體'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏁', desc:'用機庫組好的無人機跑 3 圈穿圈賽道：橘環加速、綠環充電、電量不夠就降落 PIT 停機坪換電池，還有自己的幽靈機陪跑。',
    hint:'先到「🔧 機庫」換零件・沒有最強的組合，想想這條賽道需要什麼' },
  { id:'race-forest', title:'改裝賽道 森林峽谷', part:'R', file:'levels/race-forest.html',
    // 2026-10-09 改裝賽道第二條（老師選的主題）：樹林穿梭、低飛過倒木、爬山脊、峽谷岩石、起霧。規則同操場入門（core/race.js）。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'time',label:'總秒數'},{key:'bestLap',label:'最快一圈'},{key:'pits',label:'進站次數'},{key:'hits',label:'撞擊次數'},{key:'build',label:'機體'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌲', desc:'在樹林間穿梭 14 個環：低飛穿過倒木、爬上山脊、閃過峽谷岩石，樹會撞、還起霧——大槳、小槳、護框各有用處。',
    hint:'撞樹會掉電・護框機架比較耐撞・小槳轉彎比較靈活' },
  { id:'race-city', title:'改裝賽道 城市高樓', part:'R', file:'levels/race-city.html',
    // 2026-10-10 改裝賽道第三條：大樓街道穿梭、飛越屋頂、空橋下方、🌀 亂流區（機體越重越穩）。規則同操場入門（core/race.js）。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'time',label:'總秒數'},{key:'bestLap',label:'最快一圈'},{key:'pits',label:'進站次數'},{key:'hits',label:'撞擊次數'},{key:'build',label:'機體'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏙️', desc:'在大樓之間穿梭 14 個環：飛越屋頂、穿過空橋下方，還有會把你吹晃的亂流區——重一點的機體比較穩，但也比較慢。',
    hint:'藍色風圈＝亂流區・大容量電池、護框比較不怕風' },
  { id:'race-gym', title:'改裝賽道 室內體育館', part:'R', file:'levels/race-gym.html',
    // 2026-10-10 改裝賽道第四條：室內小場地、天花板 7 公尺、小環、籃球架／排球網／看台／橫幅／標竿。比精準不比極速。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'time',label:'總秒數'},{key:'bestLap',label:'最快一圈'},{key:'pits',label:'進站次數'},{key:'hits',label:'撞擊次數'},{key:'build',label:'機體'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🏀', desc:'室內小場地 12 個小環：有天花板、要從橫幅下面壓低穿過、繞過標竿和排球網。一圈很短，比的是精準和轉彎。',
    hint:'高速馬達不一定划算・小槳轉向靈活' },
  { id:'race-neon', title:'改裝賽道 夜間霓虹', part:'R', file:'levels/race-neon.html',
    // 2026-10-10 改裝賽道第五條：夜晚、只有發光的環和霓虹柱；8 字形中間交叉一高一低。
    modes:['solo'], maxSeats:1,
    hud:{battery:true,wind:false,minimap:true,telemetry:true,gpbar:true,attitude:false},
    metrics:[{key:'time',label:'總秒數'},{key:'bestLap',label:'最快一圈'},{key:'pits',label:'進站次數'},{key:'hits',label:'撞擊次數'},{key:'build',label:'機體'}],
    doneField:'completed', unlockAfter:null,
    emoji:'🌃', desc:'夜晚的 8 字形賽道 16 個環：四周很暗、只看得到發光的環和霓虹柱，中間交叉的地方一高一低，別穿錯層。',
    hint:'看亮起來的那個環・爬升力強的機體比較輕鬆' },
];
export function getLevel(id){ return LEVELS.find(l=>l.id===id)||null; }
