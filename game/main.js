"use strict";

/* ================= 纯合成 Web Audio 音效 & 治愈 BGM 引擎 ================= */
var audioCtx = null;
var isMusicMuted = false;
var bgmTimer = null;

function initAudio(){
  if(!audioCtx){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(AC){
      audioCtx = new AC();
      if(audioCtx.state === 'suspended'){
        audioCtx.resume();
      }
    }
  }
}

var sizzleNode = null;
function startSizzle(){
  initAudio(); if(!audioCtx || sizzleNode) return;
  var bufferSize = audioCtx.sampleRate * 2;
  var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  var output = noiseBuffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
  var whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer; whiteNoise.loop = true;
  
  // 核心调音：改为低通滤波 + 降频至 800Hz，彻底抹平尖锐毛刺
  var filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  
  // 音量大幅调低至 0.016，化作温柔的 ASMR 氛围垫底
  var gain = audioCtx.createGain();
  gain.gain.value = 0.016;
  
  whiteNoise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  whiteNoise.start();
  sizzleNode = { source: whiteNoise, gain: gain };
}
function stopSizzle(){
  if(sizzleNode){
    try{ sizzleNode.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      setTimeout(function(){ sizzleNode.source.stop(); sizzleNode=null; }, 200);
    }catch(e){ sizzleNode=null; }
  }
}

function playTone(freq, type, dur, vol){
  initAudio(); if(!audioCtx) return;
  var osc = audioCtx.createOscillator(); var g = audioCtx.createGain();
  osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  g.gain.setValueAtTime(vol||0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}
function playPop(){ playTone(420, 'triangle', 0.1, 0.2); }
function playFlipSound(){ playTone(180, 'sine', 0.25, 0.25); }
function playCoinSound(){
  initAudio(); if(!audioCtx) return;
  [880, 1320, 1760].forEach(function(f, i){
    setTimeout(function(){ playTone(f, 'sine', 0.25, 0.18); }, i * 70);
  });
}
function playAhaSound(){
  initAudio(); if(!audioCtx) return;
  [523, 659, 784, 1046].forEach(function(f, i){
    setTimeout(function(){ playTone(f, 'triangle', 0.35, 0.25); }, i * 90);
  });
}

// 纯代码合成温柔八音盒 BGM (空灵治愈循环)
var bgmNotes = [523.25, 659.25, 783.99, 1046.50, 440.00, 523.25, 659.25, 880.00, 349.23, 440.00, 523.25, 698.46, 392.00, 493.88, 587.33, 783.99];
var bgmStep = 0;
function startBGM(){
  initAudio();
  if(bgmTimer || isMusicMuted) return;
  bgmTimer = setInterval(function(){
    if(!audioCtx || isMusicMuted) return;
    var freq = bgmNotes[bgmStep % bgmNotes.length];
    if(Math.random() > 0.15){
      var osc = audioCtx.createOscillator(); var g = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(0.035, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 1.2);
    }
    bgmStep++;
  }, 480);
}
function toggleBGM(){
  isMusicMuted = !isMusicMuted;
  if(els.btnSound){
    els.btnSound.textContent = isMusicMuted ? "🔇" : "🎵";
  }
  if(!isMusicMuted) startBGM();
}

/* ================= 常量与画布 ================= */
var W = 360, H = 320;
var CX = W / 2, CY = H / 2;
var GRIDDLE_R = 126;
var PANCAKE_MAX_R = 115;

var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");
function $(id){ return document.getElementById(id); }

var els = {
  dayNum:$("dayNum"), coinsShow:$("coinsShow"), ordersShow:$("ordersShow"), maxOrdersShow:$("maxOrdersShow"),
  cAvatar:$("cAvatar"), cName:$("cName"), cSay:$("cSay"), cBonus:$("cBonus"),
  stallTitle:$("stallTitle"), hint:$("hint"), trayScroll:$("trayScroll"), trayTips:$("trayTips"),
  btnFlip:$("btnFlip"), btnServe:$("btnServe"), btnOpenBook:$("btnOpenBook"), btnOpenShop:$("btnOpenShop"),
  btnSound:$("btnSound"), bookCount:$("bookCount"), toast:$("toast"),
  splashScreen:$("splashScreen"), splashBar:$("splashBar"), splashStatus:$("splashStatus"), btnStartGame:$("btnStartGame")
};

var SAVE_KEY = "jianbing_master_v14";
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a+Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function hy(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }

/* ================= 16 大绝密食谱与勋章定义 ================= */
var SECRET_RECIPES = [
  { id: "r1", name: "绝地求生裸饼", icon: "🫓", bonus: 10, clue: "极简主义的终极体现，甚至舍不得一粒芝麻", desc: "连一粒葱花都不加的白水摊饼，主打一个返璞归真！", check: function(s){ return s.eggCount===0 && !s.hasScallion && !s.hasSesame && !s.hasSweetSauce && !s.hasChiliSauce && !s.hasCrisp && !s.hasSausage && !s.hasLettuce && !s.hasLatiao && !s.hasLiji && !s.hasBacon && !s.hasRousong && !s.hasLobster; } },
  { id: "r2", name: "绿化带本带", icon: "🥗", bonus: 15, clue: "放眼望去一片翠绿，仿佛在马路牙子刚薅的草皮", desc: "纯生菜配葱花，师傅您确定这是煎饼不是兔子饲料？", check: function(s){ return s.hasLettuce && s.hasScallion && s.eggCount===0 && !s.hasSausage && !s.hasBacon && !s.hasLiji && !s.hasLobster; } },
  { id: "r3", name: "开会静音套餐", icon: "🤫", bonus: 15, clue: "软糯无声，在工位偷吃绝不会发出咔嚓声", desc: "单蛋加甜面酱和生菜，杜绝一切酥脆响声，摸鱼必备！", check: function(s){ return s.eggCount===1 && s.hasSweetSauce && s.hasLettuce && !s.hasCrisp && !s.hasSausage; } },
  { id: "r4", name: "碳水轰炸机", icon: "💥", bonus: 20, clue: "纯碳水的酥脆狂欢，咔嚓一声治愈全世界", desc: "薄脆搭配香甜肉松与面酱，热量炸弹瞬间引爆！", check: function(s){ return s.hasCrisp && s.hasRousong && s.hasSweetSauce && !s.hasLettuce; } },
  { id: "r5", name: "早八蒜香重炮", icon: "🧄", bonus: 20, clue: "一口下去，早八老师提问都得离你三米远", desc: "浓郁葱花配香辣酱，提神醒脑，早八防困第一名！", check: function(s){ return s.hasScallion && s.hasChiliSauce && s.eggCount>=1; } },
  { id: "r6", name: "肉食狂暴者", icon: "🍖", bonus: 30, clue: "无肉不欢，拒绝任何绿色植物的纯粹肉宴", desc: "热狗加培根加大里脊，一片青菜都别想混进来！", check: function(s){ return s.hasSausage && s.hasBacon && s.hasLiji && !s.hasLettuce && !s.hasScallion; } },
  { id: "r7", name: "减脂心理安慰", icon: "🏃", bonus: 25, clue: "大片生菜包着培根，假装在吃凯撒沙拉", desc: "无蛋无饼酱，纯靠生菜裹培根欺骗自己的卡路里！", check: function(s){ return s.eggCount===0 && s.hasLettuce && s.hasBacon && !s.hasSweetSauce && !s.hasChiliSauce; } },
  { id: "r8", name: "校门口大霸王", icon: "🔥", bonus: 35, clue: "小时候兜里揣了五块巨款才能享受的高贵待遇", desc: "双蛋加卫龙辣条加热狗，梦回放学后的校门口小摊！", check: function(s){ return s.eggCount===2 && s.hasLatiao && s.hasSausage; } },
  { id: "r9", name: "冰火两重天", icon: "🌶️", bonus: 30, clue: "甜酱与辣酱在舌尖激烈搏杀，舌头直呼过瘾", desc: "甜面酱与香辣酱同时刷满，咸甜香辣一口焖！", check: function(s){ return s.hasSweetSauce && s.hasChiliSauce && s.hasCrisp; } },
  { id: "r10", name: "老北京四合院", icon: "🏮", bonus: 25, clue: "规规矩矩的传统风骨，多一丝肉都是异端", desc: "单蛋加葱花芝麻甜酱大薄脆，老胡同里的正统老味！", check: function(s){ return s.eggCount===1 && s.hasScallion && s.hasSesame && s.hasSweetSauce && s.hasCrisp && !s.hasSausage && !s.hasBacon && !s.hasLiji; } },
  { id: "r11", name: "寝室熄灯夜宵", icon: "🌙", bonus: 35, clue: "熄灯断网后，从窗户用绳子吊上来的那份深夜慰藉", desc: "双蛋加辣条加烤肠配香辣酱，年轻人的深夜快乐水！", check: function(s){ return s.eggCount===2 && s.hasLatiao && s.hasSausage && s.hasChiliSauce; } },
  { id: "r12", name: "痛风大爆炸", icon: "🌋", bonus: 80, clue: "嘌呤值干到八百的终极盛宴，香到灵魂出窍", desc: "热狗培根里脊大龙虾全聚齐，这一口下去爽上天！", check: function(s){ return s.hasSausage && s.hasBacon && s.hasLiji && s.hasLobster; } },
  { id: "r13", name: "赛博黄金甲", icon: "👑", bonus: 100, clue: "满屏尽带黄金甲，闪瞎夜市所有食客的眼睛", desc: "整整四个蛋搭配金箔大龙虾和大薄脆，壕无人性！", check: function(s){ return s.eggCount===4 && s.hasLobster && s.hasCrisp; } },
  { id: "r14", name: "四喜大蛋王", icon: "🥚", bonus: 50, clue: "整整四颗土鸡蛋在铁板上排排坐，母鸡看了直摇头", desc: "四颗鸡蛋占满整个饼，不加肉不加菜，纯蛋猛男！", check: function(s){ return s.eggCount===4 && !s.hasSausage && !s.hasBacon && !s.hasLiji && !s.hasLobster && !s.hasLatiao; } },
  { id: "r15", name: "海陆空大集结", icon: "🛸", bonus: 120, clue: "陆地跑的、水里游的全在这一张饼里胜利会师", desc: "里脊、培根、大龙虾加生菜与双蛋，夜市至尊排面！", check: function(s){ return s.eggCount>=2 && s.hasLiji && s.hasBacon && s.hasLobster && s.hasLettuce; } },
  { id: "r16", name: "乾坤大挪移", icon: "🌌", bonus: 150, clue: "把当前所有解锁的食材全部勾选拉满的终极神作", desc: "牛皮纸袋当场撑爆，这是一座移动的卡路里珠峰！", check: function(s){
      var count = (s.hasCrisp?1:0)+(s.hasSausage?1:0)+(s.hasLettuce?1:0)+(s.hasLatiao?1:0)+
                  (s.hasLiji?1:0)+(s.hasBacon?1:0)+(s.hasRousong?1:0)+(s.hasLobster?1:0);
      return s.eggCount>=2 && count>=6 && s.hasSweetSauce && s.hasChiliSauce;
    }
  }
];

/* ================= 存档系统 ================= */
var save = {
  day: 1, coinsTotal: 0, unlockedLatiao: false, unlockedLiji: false,
  unlockedBacon: false, unlockedRousong: false, unlockedLobster: false,
  hasGoldScraper: false, hasNeonSign: false, unlockedRecipes: {}
};
function loadSave(){
  try{ var r = localStorage.getItem(SAVE_KEY); if(r){ save = Object.assign(save, JSON.parse(r)); } }catch(e){} 
}
function writeSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }

/* ================= 12 种配料库 ================= */
var INGREDIENTS_DEF = [
  { id:"egg", name:"鲜鸡蛋", icon:"🥚", price:2, stageType:'front', isSpecial:false },
  { id:"scallion", name:"翠绿葱花", icon:"🌱", price:1, stageType:'front', isSpecial:false },
  { id:"sesame", name:"黑芝麻", icon:"✨", price:1, stageType:'front', isSpecial:false },
  { id:"sweetSauce", name:"甜面酱", icon:"🥣", price:1, stageType:'back', isSpecial:false },
  { id:"chiliSauce", name:"香辣酱", icon:"🌶️", price:1, stageType:'back', isSpecial:false },
  { id:"crisp", name:"香脆薄脆", icon:"🧇", price:2, stageType:'back', isSpecial:false },
  { id:"sausage", name:"烤热狗", icon:"🌭", price:3, stageType:'back', isSpecial:false },
  { id:"lettuce", name:"新鲜生菜", icon:"🥬", price:1, stageType:'back', isSpecial:false },
  { id:"latiao", name:"卫龙辣条", icon:"🔥", price:5, stageType:'back', isSpecial:true, needKey:"unlockedLatiao" },
  { id:"liji", name:"嫩里脊肉", icon:"🥩", price:5, stageType:'back', isSpecial:true, needKey:"unlockedLiji" },
  { id:"bacon", name:"烟熏培根", icon:"🥓", price:6, stageType:'back', isSpecial:true, needKey:"unlockedBacon" },
  { id:"rousong", name:"海苔肉松", icon:"🍙", price:4, stageType:'back', isSpecial:true, needKey:"unlockedRousong" },
  { id:"lobster", name:"金箔龙虾", icon:"🦞", price:38, stageType:'back', isSpecial:true, needKey:"unlockedLobster" }
];

/* ================= 游戏运行状态 ================= */
var isBatterDone = false;
var batterProgress = 0;
var batterRadius = 32;
var dragPointer = null;

var isFlipped = false;
var flipAnim = null;
var foldAnim = null;
var floatAmt = 0;
var isServedWaiting = false;

var plateState = {
  eggCount: 0, hasScallion: false, hasSesame: false,
  hasSweetSauce: false, hasChiliSauce: false, hasCrisp: false,
  hasSausage: false, hasLettuce: false, hasLatiao: false,
  hasLiji: false, hasBacon: false, hasRousong: false, hasLobster: false
};

var dayRevenue = 0, orderCount = 0, currentOrder = 1;
var baseOrders = 5;
var maxOrders = 5;
var currentOrderReq = null;

/* ================= 动态随机订单 ================= */
var AVATARS = [
  { a:"🧑‍🎓", n:"赶早八大学生" }, { a:"👩‍💼", n:"加班白领" }, { a:"🏋️", n:"健身教练" },
  { a:"🤑", n:"土豪大哥" }, { a:"👴", n:"老街坊食客" }, { a:"👧", n:"挑食小可爱" }, { a:"👨‍🍳", n:"隔壁偷师厨子" }
];

function generateRandomOrder(){
  var who = pick(AVATARS);
  var req = {
    avatar: who.a, name: who.n, eggs: pick([0, 1, 2, 3]),
    noScallion: Math.random() < 0.35, wantSauce: pick(["sweet", "chili", "both", "none"]),
    wantSausage: Math.random() < 0.5, wantCrisp: Math.random() < 0.65, wantLettuce: Math.random() < 0.45,
    wantSpecial: null, bonus: 8
  };
  var specials = ["latiao", "liji", "bacon", "rousong", "lobster"];
  if(Math.random() < 0.55){ req.wantSpecial = pick(specials); }

  var parts = [];
  if(req.eggs === 0) parts.push("不要蛋！");
  else if(req.eggs === 1) parts.push("一个蛋！");
  else if(req.eggs === 2) parts.push("来<b>双蛋</b>！");
  else parts.push("来<b>三个蛋！要豪横</b>！");

  if(req.noScallion) parts.push("<b>千万别放葱</b>！");
  if(req.wantSauce === "chili") parts.push("只要<b>辣酱</b>！");
  else if(req.wantSauce === "sweet") parts.push("刷<b>甜面酱</b>！");
  else if(req.wantSauce === "none") parts.push("不要酱！");
  
  if(req.wantSausage) parts.push("加根热狗！");
  if(!req.wantCrisp) parts.push("不要薄脆！");
  if(req.wantLettuce) parts.push("多来点生菜！");

  if(req.wantSpecial === "latiao"){ parts.push("有<b>卫龙辣条</b>必须加！"); req.bonus += 10; }
  else if(req.wantSpecial === "liji"){ parts.push("想吃<b>香嫩里脊肉</b>！"); req.bonus += 12; }
  else if(req.wantSpecial === "bacon"){ parts.push("加份<b>烟熏培根</b>！"); req.bonus += 14; }
  else if(req.wantSpecial === "rousong"){ parts.push("多抓两把<b>海苔肉松</b>！"); req.bonus += 10; }
  else if(req.wantSpecial === "lobster"){ parts.push("有传说中的<b>金箔龙虾</b>吗？不差钱！"); req.bonus += 50; }

  req.say = "老板，" + parts.join(" ");
  return req;
}

/* ================= 界面刷新与托盘 ================= */
function showToast(msg){
  if(!els.toast) return;
  els.toast.textContent = msg; els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function(){ els.toast.classList.remove("show"); }, 1500);
}
function setHint(t){ if(els.hint) els.hint.innerHTML = t; }

function updateHeader(){
  if(!els.dayNum) return;
  els.dayNum.textContent = save.day;
  els.coinsShow.textContent = save.coinsTotal;
  maxOrders = save.hasNeonSign ? 8 : baseOrders;
  els.ordersShow.textContent = Math.min(currentOrder, maxOrders);
  els.maxOrdersShow.textContent = maxOrders;
  
  var unlockedCount = Object.keys(save.unlockedRecipes || {}).length;
  if(els.bookCount) els.bookCount.textContent = unlockedCount;

  if(save.hasNeonSign && els.stallTitle){
    els.stallTitle.innerHTML = "✨ 赛博煎饼总店 ✨";
    els.stallTitle.style.color = "#FF9E5E";
  }
}

function renderTray(){
  if(!els.trayScroll) return;
  els.trayScroll.innerHTML = "";
  if(isServedWaiting){
    els.trayTips.innerHTML = "🥩 出餐完成！下一位食客准备中…";
    return;
  }
  if(!isBatterDone){
    els.trayTips.innerHTML = "🥩 请先在铁板上摊开面糊！";
  } else if(!isFlipped){
    els.trayTips.innerHTML = "🥩 正面生料：加好生料后点击【翻面】";
  } else {
    els.trayTips.innerHTML = "🥩 翻面熟料：生料已封底，快涂酱加肉！";
  }

  var currentStageType = !isFlipped ? 'front' : 'back';

  INGREDIENTS_DEF.forEach(function(item){
    if(item.stageType !== currentStageType) return;

    var isLocked = item.isSpecial && !save[item.needKey];
    var div = document.createElement("div");
    div.className = "ing-card" + (isLocked ? " locked" : "");
    div.id = "card_" + item.id;
    
    var badge = "";
    if(item.id === "egg" && plateState.eggCount > 0) badge = "x" + plateState.eggCount;
    else if(plateState["has" + capitalize(item.id)]) badge = "✓";

    div.innerHTML = 
      (badge ? '<span class="ing-badge">' + badge + '</span>' : '') +
      '<span class="ing-icon">' + item.icon + '</span>' +
      '<span class="ing-name">' + item.name + '</span>' +
      '<span class="ing-price">' + (isLocked ? "未进货" : "+￥" + item.price) + '</span>';

    div.addEventListener("click", function(){ handleIngredientClick(item, isLocked); });
    els.trayScroll.appendChild(div);
  });
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

(function setupTrayScroll(){
  var el = els.trayScroll;
  if(!el) return;
  el.addEventListener("wheel", function(e){ e.preventDefault(); el.scrollLeft += e.deltaY; });
  var isDown = false, startX, scrollLeft;
  el.addEventListener('mousedown', function(e){
    isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', function(){ isDown = false; });
  el.addEventListener('mouseup', function(){ isDown = false; });
  el.addEventListener('mousemove', function(e){
    if(!isDown) return; e.preventDefault();
    var x = e.pageX - el.offsetLeft;
    var walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  });
})();

function handleIngredientClick(item, isLocked){
  if(!isBatterDone || isServedWaiting){
    showToast("先把面糊摊圆才能加料哦！"); return;
  }
  if(isLocked){
    showToast("尚未进货！点击右上角【🛒 进货】购买！"); return;
  }

  if(item.id === "egg"){
    if(plateState.eggCount >= 4){ showToast("饼上已经放了4个蛋，真装不下啦！"); return; }
    plateState.eggCount += 1;
    playPop();
    showToast("打入新鲜土鸡蛋 x" + plateState.eggCount);
  }
  else if(item.id === "scallion"){
    plateState.hasScallion = !plateState.hasScallion;
    playTone(700, 'sine', 0.1, 0.15);
  }
  else if(item.id === "sesame"){
    plateState.hasSesame = !plateState.hasSesame;
    playTone(850, 'sine', 0.1, 0.15);
  }
  else if(item.id === "sweetSauce"){
    plateState.hasSweetSauce = !plateState.hasSweetSauce;
    playTone(300, 'triangle', 0.15, 0.2);
  }
  else if(item.id === "chiliSauce"){
    plateState.hasChiliSauce = !plateState.hasChiliSauce;
    playTone(360, 'triangle', 0.15, 0.2);
  }
  else {
    var key = "has" + capitalize(item.id);
    plateState[key] = !plateState[key];
    playTone(550, 'sine', 0.1, 0.15);
  }
  renderTray();
}

function startNewOrder(){
  isServedWaiting = false;
  isBatterDone = false;
  batterProgress = 0;
  batterRadius = 32;
  isFlipped = false;
  flipAnim = null; foldAnim = null;
  plateState = {
    eggCount:0, hasScallion:false, hasSesame:false,
    hasSweetSauce:false, hasChiliSauce:false, hasCrisp:false,
    hasSausage:false, hasLettuce:false, hasLatiao:false,
    hasLiji:false, hasBacon:false, hasRousong:false, hasLobster:false
  };

  currentOrderReq = generateRandomOrder();
  if(els.cAvatar) els.cAvatar.textContent = currentOrderReq.avatar;
  if(els.cName) els.cName.textContent = currentOrderReq.name;
  if(els.cSay) els.cSay.innerHTML = currentOrderReq.say;
  if(els.cBonus) els.cBonus.textContent = "+￥" + currentOrderReq.bonus + " 小费";

  setHint("按住木刮板<b>顺时针画圈旋转</b>，摊开面糊！");
  if(els.btnFlip) els.btnFlip.disabled = true;
  if(els.btnServe) els.btnServe.disabled = true;

  updateHeader();
  if(els.trayScroll) els.trayScroll.scrollLeft = 0;
  renderTray();
  startSizzle();
}

function finishBatter(){
  isBatterDone = true;
  batterRadius = PANCAKE_MAX_R;
  showToast("面糊摊圆了！先在正面加鸡蛋、葱花芝麻！");
  setHint("正面加好生料后，点击【翻转脆底】");
  if(els.btnFlip) els.btnFlip.disabled = false;
  renderTray();
}

if(els.btnFlip){
  els.btnFlip.addEventListener("click", function(){
    if(!isBatterDone || isFlipped || isServedWaiting) return;
    playFlipSound();
    isFlipped = true;
    flipAnim = { t0: performance.now(), dur: 500 };
    els.btnFlip.disabled = true;
    if(els.btnServe) els.btnServe.disabled = false;
    setHint("熟脆翻面！货架已换新，快涂酱加肉！");
    if(els.trayScroll) els.trayScroll.scrollLeft = 0;
    renderTray();
  });
}

if(els.btnServe){
  els.btnServe.addEventListener("click", function(){
    if(!isBatterDone || !isFlipped || isServedWaiting) return;
    stopSizzle();

    var pass = true; var missMsg = "";
    if(plateState.eggCount !== currentOrderReq.eggs){
      pass = false; missMsg = currentOrderReq.eggs === 0 ? "说了不要蛋还放蛋" : "蛋的数量不对！";
    }
    else if(currentOrderReq.noScallion && plateState.hasScallion){
      pass = false; missMsg = "特意交代了不要放葱！";
    }
    else if(currentOrderReq.wantSauce === "chili" && (!plateState.hasChiliSauce || plateState.hasSweetSauce)){
      pass = false; missMsg = "只要辣酱，酱料刷错了！";
    }
    else if(currentOrderReq.wantSauce === "sweet" && (!plateState.hasSweetSauce || plateState.hasChiliSauce)){
      pass = false; missMsg = "只要甜面酱，别乱加辣酱！";
    }
    else if(currentOrderReq.wantSauce === "none" && (plateState.hasSweetSauce || plateState.hasChiliSauce)){
      pass = false; missMsg = "明明说了不要刷任何酱！";
    }
    else if(currentOrderReq.wantSausage && !plateState.hasSausage){
      pass = false; missMsg = "热狗怎么没给我加！";
    }
    else if(!currentOrderReq.wantCrisp && plateState.hasCrisp){
      pass = false; missMsg = "减肥呢，交代了不要薄脆呀！";
    }
    else if(currentOrderReq.wantLettuce && !plateState.hasLettuce){
      pass = false; missMsg = "没放生菜差评！";
    }
    else if(currentOrderReq.wantSpecial && !plateState["has" + capitalize(currentOrderReq.wantSpecial)]){
      pass = false; missMsg = "我想吃的特色食材没放上！";
    }

    var basePrice = 8 + (plateState.eggCount*2) + (plateState.hasScallion?1:0) + (plateState.hasSesame?1:0) +
                    (plateState.hasSweetSauce?1:0) + (plateState.hasChiliSauce?1:0) + (plateState.hasCrisp?2:0) + 
                    (plateState.hasSausage?3:0) + (plateState.hasLettuce?1:0) + (plateState.hasLatiao?5:0) + 
                    (plateState.hasLiji?5:0) + (plateState.hasBacon?6:0) + (plateState.hasRousong?4:0) + (plateState.hasLobster?38:0);

    if(pass){
      basePrice += currentOrderReq.bonus;
      showToast("完全符合口味！获得小费 +￥" + currentOrderReq.bonus);
    } else {
      basePrice = Math.max(4, basePrice - 6);
      showToast("顾客吐槽扣款：" + missMsg);
    }

    floatAmt = basePrice;
    foldAnim = { t0: performance.now(), dur: 1800 };
    setHint("折叠装袋，大功告成！");
    checkSecretRecipes();
  });
}

var newlyDiscoveredRecipe = null;
function checkSecretRecipes(){
  if(!save.unlockedRecipes) save.unlockedRecipes = {};
  for(var i=0; i<SECRET_RECIPES.length; i++){
    var r = SECRET_RECIPES[i];
    if(!save.unlockedRecipes[r.id]){
      if(r.check(plateState)){
        save.unlockedRecipes[r.id] = true;
        save.coinsTotal += r.bonus;
        writeSave(); updateHeader();
        newlyDiscoveredRecipe = r;
        break;
      }
    }
  }
}

function settleOrder(){
  playCoinSound();
  dayRevenue += floatAmt;
  save.coinsTotal += floatAmt;
  orderCount += 1;
  updateHeader(); writeSave();
  currentOrder = orderCount + 1;
  
  isServedWaiting = true;
  if(els.btnServe) els.btnServe.disabled = true;
  renderTray();

  if(newlyDiscoveredRecipe){
    playAhaSound();
    showAhaModal(newlyDiscoveredRecipe, function(){
      newlyDiscoveredRecipe = null;
      continueAfterSettle();
    });
  } else {
    continueAfterSettle();
  }
}

function continueAfterSettle(){
  if(orderCount >= maxOrders){
    setTimeout(showReceipt, 500);
  } else {
    setTimeout(startNewOrder, 750);
  }
}

function showAhaModal(recipe, onClose){
  var mask = document.createElement("div"); mask.className = "modal-mask"; mask.style.zIndex = "80";
  mask.innerHTML =
    '<div class="aha-card">'+
      '<div class="aha-badge">' + recipe.icon + '</div>'+
      '<div class="aha-title">🎉 解锁全新勋章！</div>'+
      '<div style="font-weight:700; font-size:15px; color:#3A2710; margin-top:4px;">【' + recipe.name + '】</div>'+
      '<div class="aha-desc">' + recipe.desc + '</div>'+
      '<div class="aha-bonus">成就达成奖金：+￥' + recipe.bonus + '</div>'+
      '<button class="action-btn btn-serve" id="btnAhaClose" style="width:100%; padding:10px;">收下奖金，载入勋章墙！</button>'+
    '</div>';
  document.body.appendChild(mask);
  $("btnAhaClose").addEventListener("click", function(){
    mask.remove();
    if(onClose) onClose();
  });
}

/* ================= 画面绘制系统 ================= */
function drawGriddle(){
  ctx.save();
  ctx.beginPath(); ctx.arc(CX,CY,GRIDDLE_R,0,Math.PI*2); ctx.fillStyle="#2B2825"; ctx.fill();
  var g=ctx.createRadialGradient(CX-25,CY-25,10,CX,CY,GRIDDLE_R);
  g.addColorStop(0,"#44403B"); g.addColorStop(0.7,"#2F2C29"); g.addColorStop(1,"#181615");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(CX,CY,GRIDDLE_R,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(255,200,140,.2)"; ctx.lineWidth=3; ctx.stroke();
  ctx.restore();
}

function drawPancake(scaleX, isGoldenBack){
  var sx = (scaleX===undefined)?1:scaleX;
  ctx.save();
  ctx.translate(CX,CY); ctx.scale(sx,1); ctx.translate(-CX,-CY);
  var g=ctx.createRadialGradient(CX-20,CY-20,10,CX,CY,batterRadius);
  if(!isGoldenBack){
    g.addColorStop(0,"#F8EAC5"); g.addColorStop(0.7,"#E8C988"); g.addColorStop(1,"#D2AD65");
  } else {
    g.addColorStop(0,"#E5A955"); g.addColorStop(0.5,"#C88732"); g.addColorStop(1,"#A1651B");
  }
  ctx.beginPath(); ctx.arc(CX,CY,batterRadius,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle = isGoldenBack ? "rgba(120,60,10,0.4)" : "rgba(180,130,60,0.3)";
  ctx.lineWidth = 3.5; ctx.stroke();
  ctx.restore();
}

function drawEgg(){
  if(plateState.eggCount <= 0) return;
  ctx.save();
  var offsets = [];
  if(plateState.eggCount === 1) offsets = [{x:0, y:0}];
  else if(plateState.eggCount === 2) offsets = [{x:-26, y:-8}, {x:26, y:8}];
  else if(plateState.eggCount === 3) offsets = [{x:0, y:-24}, {x:-26, y:16}, {x:26, y:16}];
  else offsets = [{x:-24, y:-24}, {x:24, y:-24}, {x:-24, y:24}, {x:24, y:24}];

  offsets.forEach(function(pos){
    var ox = pos.x, oy = pos.y;
    var wg = ctx.createRadialGradient(CX+ox, CY+oy, 8, CX+ox, CY+oy, 42);
    wg.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    wg.addColorStop(0.65, "rgba(250, 250, 245, 0.75)");
    wg.addColorStop(0.9, "rgba(240, 235, 220, 0.35)");
    wg.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(CX+ox, CY+oy, 42, 0, Math.PI*2); ctx.fill();

    var yg = ctx.createRadialGradient(CX+ox-3, CY+oy-3, 2, CX+ox, CY+oy, 15);
    yg.addColorStop(0, "#FFE066"); yg.addColorStop(0.5, "#FFA000");
    yg.addColorStop(0.85, "#FF6F00"); yg.addColorStop(1, "#E65100");
    ctx.fillStyle = yg;
    ctx.beginPath(); ctx.arc(CX+ox, CY+oy, 15, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath(); ctx.ellipse(CX+ox-5, CY+oy-5, 3.5, 2, -0.4, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function drawScallionsAndSesame(){
  ctx.save();
  if(plateState.hasScallion){
    for(var i=0; i<16; i++){
      var a = (i/16)*Math.PI*2 + 0.3, r = 24 + (i%3)*20;
      var x = CX + Math.cos(a)*r, y = CY + Math.sin(a)*r*0.9;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI*2); ctx.fillStyle = "#2ECC71"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fillStyle = "#27AE60"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI*2); ctx.fillStyle = "#FFF"; ctx.fill();
    }
  }
  if(plateState.hasSesame){
    for(var j=0; j<20; j++){
      var a2 = (j/20)*Math.PI*2 + 0.5, r2 = 18 + (j%4)*18;
      var x2 = CX + Math.cos(a2)*r2, y2 = CY + Math.sin(a2)*r2*0.9;
      ctx.beginPath(); ctx.arc(x2, y2, 1.8, 0, Math.PI*2); ctx.fillStyle = "#1B1917"; ctx.fill();
    }
  }
  ctx.restore();
}

function drawSauceLayer(){
  ctx.save();
  if(plateState.hasSweetSauce){
    var sg = ctx.createRadialGradient(CX-15, CY, 10, CX, CY, 80);
    sg.addColorStop(0, "rgba(90, 42, 18, 0.85)"); sg.addColorStop(1, "rgba(90, 42, 18, 0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(CX, CY, 80, 0, Math.PI*2); ctx.fill();
  }
  if(plateState.hasChiliSauce){
    var cg = ctx.createRadialGradient(CX+15, CY, 10, CX, CY, 80);
    cg.addColorStop(0, "rgba(214, 40, 40, 0.8)"); cg.addColorStop(1, "rgba(214, 40, 40, 0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(CX, CY, 80, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawToppings(){
  ctx.save();
  if(plateState.hasLettuce){
    for(var side = -1; side <= 1; side += 2){
      ctx.save(); ctx.translate(CX + side * 16, CY - 6); ctx.rotate(side * 0.16);
      var lg = ctx.createLinearGradient(-50, -30, 50, 30);
      lg.addColorStop(0, "#48C774"); lg.addColorStop(0.7, "#2EB85C"); lg.addColorStop(1, "#1E824C");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(-52, -18); ctx.bezierCurveTo(-60, -38, -20, -42, 0, -32);
      ctx.bezierCurveTo(28, -42, 64, -32, 58, -12); ctx.bezierCurveTo(66, 6, 48, 34, 20, 28);
      ctx.bezierCurveTo(-10, 38, -48, 34, -52, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if(plateState.hasCrisp){
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(-0.04);
    var cg = ctx.createLinearGradient(-50, -25, 50, 25);
    cg.addColorStop(0, "#E5B362"); cg.addColorStop(0.4, "#FAD586"); cg.addColorStop(1, "#B87A28");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.roundRect(-55, -24, 110, 48, 5); ctx.fill();
    ctx.strokeStyle = "rgba(120,60,10,0.5)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "rgba(140, 70, 10, 0.4)";
    for(var r=-1; r<=1; r++){
      for(var c=-3; c<=3; c++){
        ctx.beginPath(); ctx.ellipse(c*14, r*11, 3.5, 2, 0.2, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }
  if(plateState.hasLiji){
    ctx.save(); ctx.translate(CX, CY - 6); ctx.rotate(0.04);
    var mg = ctx.createLinearGradient(-45, 0, 45, 0);
    mg.addColorStop(0, "#BA4A00"); mg.addColorStop(0.5, "#D35400"); mg.addColorStop(1, "#A04000");
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.roundRect(-46, -14, 92, 28, 8); ctx.fill();
    ctx.strokeStyle = "rgba(100,30,0,0.5)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  if(plateState.hasSausage){
    ctx.save(); ctx.translate(CX, CY + 4); ctx.rotate(0.08);
    var hg = ctx.createLinearGradient(0, -12, 0, 12);
    hg.addColorStop(0, "#E74C3C"); hg.addColorStop(0.5, "#C0392B"); hg.addColorStop(1, "#8B1E13");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.roundRect(-55, -12, 110, 24, 12); ctx.fill();
    ctx.strokeStyle = "rgba(90, 20, 10, 0.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#561008"; ctx.lineWidth = 2.5;
    for(var k = -3; k <= 3; k++){
      ctx.beginPath(); ctx.moveTo(k*13 - 4, -9); ctx.lineTo(k*13 + 4, 9); ctx.stroke();
    }
    ctx.restore();
  }
  if(plateState.hasBacon){
    ctx.save(); ctx.translate(CX, CY + 12); ctx.rotate(-0.05);
    var bg = ctx.createLinearGradient(-45, 0, 45, 0);
    bg.addColorStop(0, "#9E2A2B"); bg.addColorStop(0.3, "#D65A31"); bg.addColorStop(0.6, "#E89F71"); bg.addColorStop(1, "#9E2A2B");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(-46, -6, 92, 12, 4); ctx.fill();
    ctx.restore();
  }
  if(plateState.hasLatiao){
    ctx.save(); ctx.translate(CX, CY - 14); ctx.rotate(-0.06);
    ctx.fillStyle = "#C0392B";
    for(var lt = -2; lt <= 2; lt++){
      ctx.beginPath(); ctx.roundRect(-44, lt * 6.5, 88, 4, 2); ctx.fill();
      ctx.fillStyle = "#E74C3C"; ctx.fillRect(-40, lt*6.5 + 1, 80, 1); ctx.fillStyle = "#C0392B";
    }
    ctx.restore();
  }
  if(plateState.hasRousong){
    ctx.save(); ctx.fillStyle = "#E59866";
    for(var rs=0; rs<25; rs++){
      var rx = CX + (rs%5)*16 - 32 + rand(-3,3), ry = CY + Math.floor(rs/5)*8 - 14 + rand(-2,2);
      ctx.fillRect(rx, ry, 6, 2);
    }
    ctx.restore();
  }
  if(plateState.hasLobster){
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(-0.02);
    ctx.fillStyle = "#C0392B";
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 16, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-45, -20, 20, 10, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(25, -20, 20, 10, 4); ctx.fill();
    ctx.fillStyle = "#FFD700";
    for(var gl=0; gl<8; gl++){ ctx.fillRect(rand(-30,30), rand(-8,8), 4, 3); }
    ctx.restore();
  }
  ctx.restore();
}

function drawFoldAnimation(p){
  var foldW = 140, foldH = 50;
  var pLeft = clamp(p / 0.3, 0, 1);
  var pRight = clamp((p - 0.3) / 0.3, 0, 1);
  var pBag = clamp((p - 0.6) / 0.25, 0, 1);
  var pFloat = clamp((p - 0.85) / 0.15, 0, 1);

  ctx.save();
  var mg = ctx.createLinearGradient(CX-30, 0, CX+30, 0);
  mg.addColorStop(0,"#C88732"); mg.addColorStop(0.5,"#E0A34D"); mg.addColorStop(1,"#C88732");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.roundRect(CX-30, CY-foldH/2, 60, foldH, 7); ctx.fill();

  if(pLeft > 0){
    ctx.save(); ctx.translate(CX-30, CY); ctx.scale(Math.cos(pLeft * Math.PI), 1);
    ctx.fillStyle = "#B37424"; ctx.beginPath(); ctx.roundRect(-40, -foldH/2, 40, foldH, 5); ctx.fill();
    ctx.restore();
  }
  if(pRight > 0){
    ctx.save(); ctx.translate(CX+30, CY); ctx.scale(Math.cos(pRight * Math.PI), 1);
    ctx.fillStyle = "#A8691A"; ctx.beginPath(); ctx.roundRect(0, -foldH/2, 40, foldH, 5); ctx.fill();
    ctx.restore();
  }
  if(pBag > 0){
    var bagY = CY - 20 - pBag*38;
    ctx.fillStyle = "#C8A265";
    ctx.beginPath(); ctx.roundRect(CX-40, bagY, 80, 84, 7); ctx.fill();
    ctx.strokeStyle = "#8C6A36"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle = "#C0392B"; ctx.beginPath(); ctx.arc(CX, bagY+42, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#FFF"; ctx.font="bold 12px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("煎", CX, bagY+42);
  }
  if(pFloat > 0){
    var oy = CY - 60 - pFloat * 32;
    ctx.font = "bold 26px serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#FFD24D"; ctx.strokeStyle = "#8A5200"; ctx.lineWidth = 3;
    ctx.strokeText("＋￥" + floatAmt, CX, oy);
    ctx.fillText("＋￥" + floatAmt, CX, oy);
  }
  ctx.restore();
}

function render(now){
  ctx.fillStyle = "#12100E"; ctx.fillRect(0,0,W,H);
  drawGriddle();

  if(isServedWaiting){
    return;
  }

  if(!foldAnim){
    if(flipAnim){
      var f = clamp((now - flipAnim.t0) / flipAnim.dur, 0, 1);
      var sx = Math.cos(f * Math.PI);
      if(sx >= 0){
        drawPancake(sx, false); drawEgg(); drawScallionsAndSesame();
      } else {
        drawPancake(Math.abs(sx), true);
      }
      if(f >= 1) flipAnim = null;
    } else {
      drawPancake(1, isFlipped);
      if(!isFlipped){
        drawEgg();
        drawScallionsAndSesame();
      } else {
        drawSauceLayer();
        drawToppings();
      }
    }

    if(!isBatterDone){
      if(batterProgress < 0.95){
        var mg = ctx.createRadialGradient(CX-3,CY-3,2,CX,CY,30*(1-batterProgress*0.6));
        mg.addColorStop(0,"#FFF8E7"); mg.addColorStop(1,"#E5CE9F");
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(CX,CY,30*(1-batterProgress*0.6),0,Math.PI*2); ctx.fill();
      }
      if(dragPointer && dragPointer.lastAngle !== undefined){
        ctx.save(); ctx.translate(CX, CY); ctx.rotate(dragPointer.lastAngle);
        ctx.fillStyle = save.hasGoldScraper ? "#FFD700" : "#8C6239";
        ctx.fillRect(0, -4, batterRadius + 10, 8);
        ctx.fillStyle = save.hasGoldScraper ? "#FFA500" : "#A07248";
        ctx.beginPath(); ctx.roundRect(batterRadius - 2, -30, 8, 60, 3); ctx.fill();
        ctx.restore();
      }
    }
  } else {
    var fp = clamp((now - foldAnim.t0) / foldAnim.dur, 0, 1);
    drawFoldAnimation(fp);
    if(fp >= 1){ foldAnim = null; settleOrder(); }
  }
}

function loop(now){
  try { render(now); } catch(e) { console.error(e); }
  requestAnimationFrame(loop);
}

function getPos(e){
  var r = canvas.getBoundingClientRect();
  var src = (e.touches && e.touches.length) ? e.touches[0] : e;
  return { x: (src.clientX - r.left)*(W/r.width), y: (src.clientY - r.top)*(H/r.height) };
}

canvas.addEventListener("pointerdown", function(e){
  var p = getPos(e); var dist = hy(p.x, p.y, CX, CY);
  if(!isBatterDone && !isServedWaiting && dist < GRIDDLE_R){
    dragPointer = { lastAngle: Math.atan2(p.y-CY, p.x-CX) };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove", function(e){
  var p = getPos(e);
  if(!isBatterDone && !isServedWaiting && dragPointer){
    var a = Math.atan2(p.y-CY, p.x-CX);
    var d = a - dragPointer.lastAngle;
    if(d > Math.PI) d -= Math.PI*2; else if(d < -Math.PI) d += Math.PI*2;
    dragPointer.lastAngle = a;
    if(Math.abs(d) < 0.5){
      var speedRate = save.hasGoldScraper ? 1.8 : 1.0;
      batterProgress = clamp(batterProgress + (Math.abs(d)/(Math.PI*2))*speedRate, 0, 1);
      batterRadius = 32 + (PANCAKE_MAX_R - 32) * batterProgress;
      if(batterProgress >= 1){ dragPointer = null; finishBatter(); }
    }
  }
});
canvas.addEventListener("pointerup", function(){ dragPointer = null; });
canvas.addEventListener("pointercancel", function(){ dragPointer = null; });

/* ================= 随时进货商城弹窗（听劝核心功能） ================= */
function openShopModal(){
  var mask = document.createElement("div"); mask.className = "modal-mask"; mask.style.zIndex = "85";
  
  mask.innerHTML =
    '<div class="shop-panel">'+
      '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #443A2E; padding-bottom:8px; margin-bottom:10px;">'+
        '<div style="font-weight:700; color:var(--gold); font-size:14px;">🛒 随时进货与摊位升级</div>'+
        '<button id="btnCloseShop" style="background:none; border:none; color:var(--textDim); font-size:18px; cursor:pointer;">✕</button>'+
      '</div>'+
      '<div style="font-size:11px; color:var(--textDim); margin-bottom:12px;">我的总金币：<b style="color:var(--gold)">￥' + save.coinsTotal + '</b> (买完托盘立即进货)</div>'+

      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🌶️ 卫龙大辣条 (单份+￥5)</div><div class="sd">售价: ￥30</div></div>'+
        '<button class="shop-buy" id="buyLatiao"' + (save.unlockedLatiao ? " disabled>已进货" : (save.coinsTotal>=30 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+

      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🥩 香嫩大里脊 (单份+￥5)</div><div class="sd">售价: ￥40</div></div>'+
        '<button class="shop-buy" id="buyLiji"' + (save.unlockedLiji ? " disabled>已进货" : (save.coinsTotal>=40 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+

      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🍙 海苔肉松 (单份+￥4)</div><div class="sd">售价: ￥45</div></div>'+
        '<button class="shop-buy" id="buyRousong"' + (save.unlockedRousong ? " disabled>已进货" : (save.coinsTotal>=45 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+

      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🥓 烟熏大培根 (单份+￥6)</div><div class="sd">售价: ￥55</div></div>'+
        '<button class="shop-buy" id="buyBacon"' + (save.unlockedBacon ? " disabled>已进货" : (save.coinsTotal>=55 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+

      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🦞 金箔大龙虾 (一份+￥38)</div><div class="sd">售价: ￥150</div></div>'+
        '<button class="shop-buy" id="buyLobster"' + (save.unlockedLobster ? " disabled>已进货" : (save.coinsTotal>=150 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+
      
      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">✨ 黄金流光刮板 (加速80%)</div><div class="sd">售价: ￥60</div></div>'+
        '<button class="shop-buy" id="buyScraper"' + (save.hasGoldScraper ? " disabled>已拥有" : (save.coinsTotal>=60 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+
      
      '<div class="shop-item">'+
        '<div class="shop-info"><div class="sn">🏮 赛博总店 (客流扩至8单)</div><div class="sd">售价: ￥120</div></div>'+
        '<button class="shop-buy" id="buyNeon"' + (save.hasNeonSign ? " disabled>已拥有" : (save.coinsTotal>=120 ? ">购买" : " disabled>金币不足")) + '</button>'+
      '</div>'+
    '</div>';
    
  document.body.appendChild(mask);
  $("btnCloseShop").addEventListener("click", function(){ mask.remove(); });

  function bindBuy(id, cost, key, succMsg){
    var b = $(id);
    if(b) b.addEventListener("click", function(){
      if(save.coinsTotal >= cost && !save[key]){
        save.coinsTotal -= cost; save[key] = true;
        writeSave(); updateHeader(); renderTray(); playCoinSound(); showToast(succMsg);
        mask.remove();
      }
    });
  }
  bindBuy("buyLatiao", 30, "unlockedLatiao", "成功进货卫龙辣条！");
  bindBuy("buyLiji", 40, "unlockedLiji", "成功进货嫩里脊肉！");
  bindBuy("buyRousong", 45, "unlockedRousong", "成功进货海苔肉松！");
  bindBuy("buyBacon", 55, "unlockedBacon", "成功进货烟熏大培根！");
  bindBuy("buyLobster", 150, "unlockedLobster", "进货豪横金箔大龙虾！");
  bindBuy("buyScraper", 60, "hasGoldScraper", "换上黄金流光刮板！");
  bindBuy("buyNeon", 120, "hasNeonSign", "升级为赛博豪华总店！");
}

if(els.btnOpenShop){
  els.btnOpenShop.addEventListener("click", openShopModal);
}
if(els.btnSound){
  els.btnSound.addEventListener("click", toggleBGM);
}

/* ================= 16 大勋章展示柜 ================= */
if(els.btnOpenBook){
  els.btnOpenBook.addEventListener("click", function(){
    var mask = document.createElement("div"); mask.className = "modal-mask";
    var unlockedMap = save.unlockedRecipes || {};
    var unlockedCount = Object.keys(unlockedMap).length;
    var pct = Math.round((unlockedCount / SECRET_RECIPES.length) * 100);

    var gridHtml = "";
    SECRET_RECIPES.forEach(function(r, index){
      var isU = !!unlockedMap[r.id];
      gridHtml += 
        '<div class="medal-slot ' + (isU ? 'unlocked' : 'locked') + '" data-idx="' + index + '">' +
          '<div class="medal-circle">' + (isU ? r.icon : '🔒') + '</div>' +
          '<div class="medal-name">' + (isU ? r.name : ('勋章 #' + (index+1))) + '</div>' +
        '</div>';
    });

    mask.innerHTML =
      '<div class="book-panel">'+
        '<div class="book-header">'+
          '<div>'+
            '<div style="font-weight:700; color:var(--gold); font-size:14px;">🎖️ 绝密食谱勋章墙</div>'+
            '<div style="font-size:10px; color:var(--textDim); margin-top:2px;">收集进度：' + unlockedCount + '/16 (' + pct + '%)</div>'+
          '</div>'+
          '<button id="btnCloseBook" style="background:none; border:none; color:var(--textDim); font-size:18px; cursor:pointer; padding:4px;">✕</button>'+
        '</div>'+
        '<div class="book-progress-bar"><div class="book-progress-fill" style="width:' + pct + '%;"></div></div>'+
        '<div class="book-grid">' + gridHtml + '</div>'+
      '</div>';
      
    document.body.appendChild(mask);
    $("btnCloseBook").addEventListener("click", function(){ mask.remove(); });

    mask.querySelectorAll(".medal-slot").forEach(function(slot){
      slot.addEventListener("click", function(){
        var idx = parseInt(slot.getAttribute("data-idx"));
        var r = SECRET_RECIPES[idx];
        var isU = !!unlockedMap[r.id];
        showMedalDetail(r, isU);
      });
    });
  });
}

function showMedalDetail(recipe, isUnlocked){
  var dMask = document.createElement("div"); dMask.className = "modal-mask"; dMask.style.zIndex = "70";
  dMask.innerHTML = 
    '<div class="detail-card">'+
      '<div class="detail-icon" style="background:' + (isUnlocked ? 'radial-gradient(circle, #FFE082, #B38628)' : '#332C24') + '; border:2px solid ' + (isUnlocked ? '#FFE082' : '#55483A') + ';">' + 
        (isUnlocked ? recipe.icon : '🔒') + 
      '</div>'+
      '<div class="detail-title">' + (isUnlocked ? ('【' + recipe.name + '】') : '【未解锁绝密勋章】') + '</div>'+
      '<div class="detail-desc">' + (isUnlocked ? recipe.desc : ('💡 探索线索：' + recipe.clue)) + '</div>'+
      '<div class="detail-reward">' + (isUnlocked ? '🎖️ 成就已达成' : ('达成奖金：+￥' + recipe.bonus)) + '</div>'+
      '<button class="action-btn btn-serve" id="btnCloseDetail" style="width:100%; padding:8px; font-size:12px;">知道了</button>'+
    '</div>';
  document.body.appendChild(dMask);
  $("btnCloseDetail").addEventListener("click", function(){ dMask.remove(); });
}

/* ================= 收摊小票 ================= */
var COMMENTS = ["面糊摊得比我的人生规划还圆，神仙美味！", "完全按我的忌口做的，必须给老板五星好评！", "这大肠切得太诱人了，深夜打工人直接满血复活！", "料给得是真足，明天早八还来你家蹲点！", "老字号味道，酱汁香得我连袋子都想舔干净！"];

function showReceipt(){
  var old = document.querySelector(".modal-mask"); if(old) old.remove();
  var q = pick(COMMENTS);
  var mask = document.createElement("div"); mask.className = "modal-mask";
  
  mask.innerHTML =
    '<div class="ticket">'+
      '<h3>赛博煎饼小摊 · 营业小票</h3>'+
      '<div class="subline">— 今日收摊已打烊 —</div>'+
      '<div class="row"><span class="k">摊位招牌</span><span class="v">' + (save.hasNeonSign ? "✨赛博煎饼总店" : "赛博煎饼小摊") + '</span></div>'+
      '<div class="row"><span class="k">今日单数</span><span class="v">' + maxOrders + ' 单</span></div>'+
      '<div class="row"><span class="k">今日总营收</span><span class="v big">￥' + dayRevenue + '</span></div>'+
      '<div class="row"><span class="k">摊位总资产</span><span class="v">￥' + save.coinsTotal + '</span></div>'+
      '<div class="quote-box">顾客好评：' + q + '</div>'+
      '<button class="action-btn btn-flip" id="btnShopFromReceipt" style="width:100%; margin:4px 0 8px;">🛒 前往进货升级市场</button>'+
      '<button class="action-btn btn-serve" id="nextDay" style="width:100%; padding:10px;">开始第二天营业</button>'+
    '</div>';
    
  document.body.appendChild(mask);

  $("btnShopFromReceipt").addEventListener("click", openShopModal);
  $("nextDay").addEventListener("click", function(){
    mask.remove();
    save.day += 1; dayRevenue = 0; orderCount = 0; currentOrder = 1;
    writeSave(); startNewOrder();
  });
}

/* ================= 开屏仪式与启动 ================= */
function runSplashScreen(){
  var bar = els.splashBar; var status = els.splashStatus; var btn = els.btnStartGame;
  var progress = 0;
  
  var timer = setInterval(function(){
    progress += 20;
    if(bar) bar.style.width = progress + "%";
    if(progress === 40 && status) status.textContent = "打理酱料与酥脆薄脆…";
    if(progress === 70 && status) status.textContent = "夜色正好，食客已在街角等候…";
    if(progress >= 100){
      clearInterval(timer);
      if(status) status.textContent = "小摊已准备就绪！";
      if(btn) btn.style.display = "inline-block";
    }
  }, 160);

  if(btn){
    btn.addEventListener("click", function(){
      initAudio();
      playCoinSound();
      startBGM(); // 出摊瞬间启动温柔八音盒背景音乐！

      if(els.splashScreen) els.splashScreen.classList.add("fade-out");
      setTimeout(function(){
        if(els.splashScreen) els.splashScreen.remove();
      }, 550);

      startNewOrder();
      requestAnimationFrame(loop);
    });
  }
}

loadSave();
updateHeader();
runSplashScreen();