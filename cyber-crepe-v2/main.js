/* =============================================================================
 *  Cyber Crepe Master: Street Food Sim  ·  V2.0
 *  Panoramic 16:9 street-food cooking simulation.
 *  Pure Canvas 2D + Web Audio synthesis + CrazyGames SDK v3.
 * ========================================================================== */
(function () {
  'use strict';

  /* ===========================================================================
   * 0. UTILITIES
   * ======================================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var fmt = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var sorted = function (a) { return a.slice().sort(); };
  var sameSet = function (a, b) {
    if (a.length !== b.length) return false;
    var x = sorted(a), y = sorted(b);
    for (var i = 0; i < x.length; i++) { if (x[i] !== y[i]) return false; }
    return true;
  };

  /* Central tuning table — every previously-scattered magic number lives here
     so gameplay timing and rewards can be adjusted from one place. */
  var TUNE = {
    AD_CASH: 60,              /* rewarded-ad cash grant (synced into DOM text) */
    FOLD_MS: 1150,            /* fold animation duration (ms of foldT progress) */
    FLIP_MS: 780,
    NEXT_CUST_MS: 780,
    GAVEUP_MS: 620,
    RECIPE_TOAST_MS: 620,
    PATIENCE_MIN: 46,
    PATIENCE_MAX: 92,
    SEAR_INTERVAL: 0.22,
    SEAR_MAX: 90,
    HINT_TICK: 0.12,
    MAX_PARTICLES: 120,
    MIDGAME_COOLDOWN_MS: 90000,
    AD_GUARD_MS: 180000,
    MIDGAME_TIMEOUT_MS: 180000,
    SERVE_TIP_FREE: 0.18,
    SERVE_TIP_PERFECT: 0.22,
    SERVE_WRONG: 0.45,
    SAVE_DEBOUNCE_MS: 300
  };

  /* ===========================================================================
   * 1. GAME DATA
   * ======================================================================== */
  var BASE_PRICE = 8;
  var MAX_EGGS = 4;

  /* `price` is the profit a single portion adds to an order. The base larder is
     bottomless; the seven isSpecial items are consumables that have to be
     restocked in the shop, and each restock is bought in a fixed batch
     (`batch`) at `shopPrice` per batch.
     `stageType` is the cooking stage the tile lights up in: 'front' before the
     flip, 'back' after it. STAGE_SHELF is derived from this field, so the tray
     cannot drift out of sync with the table below.
     Names stay under a dozen characters on purpose — the tiles ellipsise, and
     anything longer reads as "Seaweed Flo…" on a narrow screen. */
  var INGREDIENTS = {
    /* --- Left shelf : raw side --- */
    egg:        { name: 'Fresh Egg',    icon: '🥚', price: 2,  shelf: 'left',  stageType: 'front', unlocked: true },
    scallion:   { name: 'Scallion',     icon: '🌿', price: 1,  shelf: 'left',  stageType: 'front', unlocked: true },
    sesame:     { name: 'Sesame',       icon: '⚫', price: 1,  shelf: 'left',  stageType: 'front', unlocked: true },
    /* --- Left shelf : cooked side --- */
    lettuce:    { name: 'Lettuce',      icon: '🥬', price: 1,  shelf: 'left',  stageType: 'back',  unlocked: true },
    sausage:    { name: 'Hot Dog',      icon: '🌭', price: 3,  shelf: 'left',  stageType: 'back',  unlocked: true },
    liji:       { name: 'BBQ Pork',     icon: '🥩', price: 10, shelf: 'left',  stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 55,  shopDesc: 'Char-grilled marinated pork loin strips.' },
    bacon:      { name: 'Bacon',        icon: '🥓', price: 15, shelf: 'left',  stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 65,  shopDesc: 'Applewood smoked, crisps on the griddle.' },
    cheese:     { name: 'Lava Cheese',  icon: '🧀', price: 7,  shelf: 'left',  stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 45,  shopDesc: 'Molten cheddar that stretches on the fold.' },
    /* --- Right shelf : sauces --- */
    sweetSauce: { name: 'Sweet Paste',  icon: '🥣', price: 1,  shelf: 'right', stageType: 'back',  unlocked: true },
    chiliSauce: { name: 'Chili Sauce',  icon: '🌶️', price: 1,  shelf: 'right', stageType: 'back',  unlocked: true },
    /* --- Right shelf : cooked toppings & the luxury tier --- */
    crisp:      { name: 'Cracker',      icon: '🧇', price: 2,  shelf: 'right', stageType: 'back',  unlocked: true },
    latiao:     { name: 'Spicy Jerky',  icon: '🍢', price: 5,  shelf: 'right', stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 35,  shopDesc: 'Street-school latiao strips, addictive heat.' },
    rousong:    { name: 'Pork Floss',   icon: '🍙', price: 8,  shelf: 'right', stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 50,  shopDesc: 'Fluffy pork floss, a spoonful per crepe.' },
    intestine:  { name: 'Intestines',   icon: '🍲', price: 25, shelf: 'right', stageType: 'back',  isSpecial: true, batch: 5, shopPrice: 75,  shopDesc: 'Slow-braised in 18 spices. For connoisseurs.' },
    lobster:    { name: 'Lobster',      icon: '🦞', price: 88, shelf: 'right', stageType: 'back',  isSpecial: true, batch: 3, shopPrice: 160, shopDesc: 'Gold-leaf lobster tail. Pure luxury.' }
  };
  var ING_KEYS = Object.keys(INGREDIENTS);

  /* Ids that were renamed after the pantry system shipped. Saves written before
     the rename still spell them the old way, so they are translated on load
     rather than silently dropped. */
  var LEGACY_KEYS = {
    hotdog: 'sausage', sweetbean: 'sweetSauce', chili: 'chiliSauce', cracker: 'crisp',
    jerky: 'latiao', tenderloin: 'liji', floss: 'rousong'
  };
  function migrateKey(k) { return LEGACY_KEYS[k] || k; }

  /* Consumable ids, and the pantry a brand-new stall opens with: three portions
     of latiao and three of bacon, so the advanced shelf is usable on day one. */
  var SPECIAL_KEYS = ING_KEYS.filter(function (k) { return !!INGREDIENTS[k].isSpecial; });

  function defaultStock() {
    var s = {};
    SPECIAL_KEYS.forEach(function (k) { s[k] = 0; });
    s.latiao = 3;
    s.bacon = 3;
    return s;
  }

  var UPGRADES = {
    scraper: { name: 'Golden Flow Scraper', icon: '🥄', price: 60,  desc: 'A weighted brass scraper: batter spreads 80% faster.' },
    stall:   { name: 'Cyber Grand Stall',   icon: '🏪', price: 120, desc: 'Expand the neon booth: daily customer flow 5 -> 8 orders.' }
  };
  var UPGRADE_KEYS = Object.keys(UPGRADES);

  /* --- 16 secret recipes ------------------------------------------------- */
  var RECIPES = [
    { id: 'naked',      name: 'The Naked Crepe',       icon: '⚫', bonus: 10,  eggs: 0, set: [],
      clue: 'The boldest order on the street: batter, and nothing else. No egg, no topping, no mercy.',
      line: 'Just the base, chef. I want to taste the batter itself.' },

    { id: 'veggie',     name: 'Veggie Overload',       icon: '🥬', bonus: 15,  eggs: 0, set: ['lettuce', 'scallion'],
      clue: 'A green garden folded in paper: lettuce and scallion only, and absolutely no egg.',
      line: 'Make it green! Lettuce and scallion, and hold the egg.' },

    { id: 'silent',     name: 'Silent Meeting Meal',   icon: '🤫', bonus: 15,  eggs: 1, set: ['sweetSauce', 'lettuce'],
      clue: 'One egg, sweet paste and lettuce. Quiet, polite, eaten during a boring meeting.',
      line: 'One egg, sweet paste, lettuce. Something quiet, I am on a call.' },

    { id: 'carb',       name: 'Carb Explosion',        icon: '💥', bonus: 20,  eggs: 0, set: ['crisp', 'rousong', 'sweetSauce'],
      clue: 'Cracker, pork floss and sweet paste. No egg, the crunch does all the work.',
      line: 'I want crunch. Cracker, pork floss, sweet paste. No egg today.' },

    { id: 'garlic',     name: 'Morning Garlic Cannon', icon: '🧄', bonus: 20,  eggs: 2, set: ['scallion', 'chiliSauce'],
      clue: 'Double egg, scallion and chili sauce. The breakfast that clears a whole subway car.',
      line: 'Two eggs, scallion, chili. Wake me up properly!' },

    { id: 'carnivore',  name: 'Carnivore Rampage',     icon: '🍖', bonus: 30,  eggs: 0, set: ['sausage', 'bacon', 'liji'],
      clue: 'Hot dog, bacon and BBQ pork. Three meats, no egg, no vegetables.',
      line: 'Meat. Hot dog, bacon, BBQ pork. Skip the egg.' },

    { id: 'diet',       name: 'Diet Illusion',         icon: '🥗', bonus: 25,  eggs: 0, set: ['lettuce', 'bacon'],
      clue: 'Lettuce wrapped around bacon. No egg and no sauce, the salad that fools nobody.',
      line: 'I am on a diet. Lettuce and bacon. No egg, no sauce.' },

    { id: 'school',     name: 'School Gate King',      icon: '🎒', bonus: 35,  eggs: 2, set: ['latiao', 'sausage'],
      clue: 'Double egg with spicy jerky strips and a hot dog. Sold out every day at 4 PM.',
      line: 'Double egg, latiao strips and a hot dog, the after-school classic!' },

    { id: 'fireice',    name: 'Fire & Ice Blend',      icon: '🌡️', bonus: 30,  eggs: 0, set: ['sweetSauce', 'chiliSauce', 'crisp'],
      clue: 'Sweet paste and chili sauce together with a cracker. No egg at all.',
      line: 'Sweet AND spicy, plus cracker. No egg. Trust me on this.' },

    { id: 'alley',      name: 'Alley Heritage',        icon: '🏮', bonus: 25,  eggs: 1, set: ['scallion', 'sesame', 'sweetSauce', 'crisp'],
      clue: 'One egg, scallion, sesame, sweet paste and a big cracker. Grandma alley recipe.',
      line: 'One egg, scallion, sesame, sweet paste and cracker. Like my grandma made.' },

    { id: 'midnight',   name: 'Midnight Dorm Snack',   icon: '🌙', bonus: 35,  eggs: 2, set: ['latiao', 'sausage', 'chiliSauce'],
      clue: 'Double egg, spicy jerky, hot dog and chili sauce. Eaten at 2 AM under a desk lamp.',
      line: 'Two eggs, latiao, hot dog and chili. It is 2 AM, I need this.' },

    { id: 'purine',     name: 'Purine Bomb',           icon: '☢️', bonus: 80,  eggs: 0, set: ['sausage', 'bacon', 'liji', 'lobster'],
      clue: 'Hot dog, bacon, BBQ pork AND lobster. No egg, the meat does the talking.',
      line: 'Everything meat, and the lobster too. No egg. I accept the consequences.' },

    { id: 'goldarmor',  name: 'Cyber Golden Armor',    icon: '🛡️', bonus: 100, eggs: 4, set: ['lobster', 'crisp'],
      clue: 'Four eggs, lobster and a cracker. The most expensive armour in the alley.',
      line: 'Four eggs, lobster, cracker. Full armour, chef.' },

    { id: 'quad',       name: 'Quad-Egg Supreme',      icon: '🥚', bonus: 50,  eggs: 4, set: [],
      clue: 'Four eggs and nothing else. Pure protein, pure confidence.',
      line: 'Four eggs. Nothing else. I am bulking.' },

    { id: 'sealandair', name: 'Sea-Land-Air Rally',    icon: '🚀', bonus: 120, eggs: 2, set: ['liji', 'bacon', 'lobster', 'lettuce'],
      clue: 'BBQ pork, bacon, lobster and lettuce with double egg. Land, sea and garden in one fold.',
      line: 'Land, sea and garden: BBQ pork, bacon, lobster, lettuce, two eggs.' },

    { id: 'universal',  name: 'Universal Masterpiece', icon: '👑', bonus: 150, eggs: 2, set: [], special: 'universal',
      clue: 'Six or more toppings, exactly two eggs, and BOTH the sweet paste and the chili sauce. Free-styled only.',
      line: 'Surprise me. Make it legendary.' }
  ];
  var RECIPE_MAP = {};
  RECIPES.forEach(function (r) { RECIPE_MAP[r.id] = r; });

  var CUSTOMERS = [
    { n: 'Neon Noodle Kid', a: '🧑' }, { n: 'Cyber Auntie',   a: '👩‍🦰' },
    { n: 'Delivery Bot 7',  a: '🤖' },   { n: 'Midnight Coder', a: '🧑' },
    { n: 'Skater Lin',      a: '🛹' },   { n: 'Boba Grandma',   a: '👵' },
    { n: 'Street Rapper K', a: '🧢' },   { n: 'Netrunner Mei',  a: '👩‍🚀' },
    { n: 'Hungry Patrol',   a: '👮' },   { n: 'Gamer Bro',      a: '🎮' },
    { n: 'Chef Rival Wu',   a: '👨‍🍳' }, { n: 'Vlogger Tofu',   a: '📸' },
    { n: 'Night Nurse Q',   a: '👩‍⚕️' }, { n: 'Rickshaw Uncle', a: '🛺' }
  ];

  var QUOTES_5 = [
    'Perfect fold, perfect crunch. I am telling everyone about this stall.',
    'That is the best crepe in the neon district. Five stars, no notes.',
    'Crispy, saucy, warm. My whole night just got better.'
  ];
  var QUOTES_4 = [
    'Really good! A tiny bit slow, but worth the wait.',
    'Solid work, chef. I will be back tomorrow.'
  ];
  var QUOTES_3 = [
    'Hmm, close, but something was missing.',
    'Not quite what I ordered, but edible.'
  ];
  var QUOTES_1 = [
    'That was not my order at all.',
    'I waited all that time for this?'
  ];

  /* ===========================================================================
   * 2. PERSISTENCE
   * ======================================================================== */
  var SAVE_KEY = 'cyber_crepe_master_v2_save';

  var state = {
    day: 1,
    /* The day's running tally is persisted so a refresh cannot reset the
       order count and hand the player another full day of orders. */
    dayOrders: 0,
    dayRevenue: 0,
    /* The receipt's own stats are persisted too: without them a refresh on a
       finished day re-opened a receipt that claimed 0 orders and a 0.00 rating. */
    dayServed: 0,
    dayLost: 0,
    dayStars: 0,
    dayRecipesFound: 0,
    /* Latched once the revenue-doubling ad has paid out, so refreshing cannot
       farm the same day's takings twice. */
    dayDoubled: false,
    cash: 0,
    unlocked: [],
    stock: defaultStock(),
    recipes: [],
    upgrades: { scraper: false, stall: false },
    bestRevenue: 0,
    totalServed: 0,
    muted: false
  };

  /* Debounced persistence: rapid stock clicks no longer sync-write storage
     on every tap. Settlement points still call saveNow() for an immediate flush. */
  var saveTimer = null;
  function saveNow() {
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
    save();
  }
  function saveDebounced() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () { saveTimer = null; save(); }, TUNE.SAVE_DEBOUNCE_MS);
  }

  /* ===========================================================================
   * 2b. PROGRESS STORAGE (CrazyGames Data module + local fallback)
   * ======================================================================== */
  /* Full Launch requires progress on the CG account via SDK.data. Off-platform
     (file:// / self-host) and before init() resolves, keep localStorage so the
     game still boots. After cgDataReady, reads/writes go through SDK.data.
     CG_ON_PLATFORM is defined in section 3; function bodies run only later. */
  var cgDataReady = false;

  function cgData() {
    if (!window.__CG_ON_PLATFORM__ || !cgDataReady) return null;
    try {
      var sdk = window.CrazyGames && window.CrazyGames.SDK;
      return sdk && sdk.data ? sdk.data : null;
    } catch (e) { return null; }
  }

  function storageGet(key) {
    var data = cgData();
    if (data) {
      try {
        var v = data.getItem(key);
        return (v === undefined) ? null : v;
      } catch (e) { /* fall through */ }
    }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    var data = cgData();
    if (data) {
      try { data.setItem(key, value); return; } catch (e) { /* fall through */ }
    }
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  /* Copy any pre-Data-module localStorage save into SDK.data.
     Cloud progress wins: only fill an empty data-module slot. */
  function migrateLocalToCgData(keys) {
    var data = cgData();
    if (!data) return;
    keys.forEach(function (key) {
      try {
        var cloud = data.getItem(key);
        if (cloud !== null && cloud !== undefined && cloud !== '') return;
        var local = window.localStorage.getItem(key);
        if (local) data.setItem(key, local);
      } catch (e) { /* migration is best-effort */ }
    });
  }

  function defaultUnlocked() {
    return ING_KEYS.filter(function (k) { return INGREDIENTS[k].unlocked; });
  }

  function loadSave() {
    /* Base ingredients are always available, even on a brand-new save. */
    state.unlocked = defaultUnlocked();
    state.stock = defaultStock();
    try {
      var raw = storageGet(SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      state.day = Math.max(1, parseInt(d.day, 10) || 1);
      state.dayOrders = Math.max(0, parseInt(d.dayOrders, 10) || 0);
      state.dayRevenue = Math.max(0, Number(d.dayRevenue) || 0);
      state.dayServed = Math.max(0, parseInt(d.dayServed, 10) || 0);
      state.dayLost = Math.max(0, parseInt(d.dayLost, 10) || 0);
      state.dayStars = Math.max(0, Number(d.dayStars) || 0);
      state.dayRecipesFound = Math.max(0, parseInt(d.dayRecipesFound, 10) || 0);
      state.dayDoubled = !!d.dayDoubled;
      state.cash = Math.max(0, Number(d.cash) || 0);
      state.bestRevenue = Math.max(0, Number(d.bestRevenue) || 0);
      state.totalServed = Math.max(0, parseInt(d.totalServed, 10) || 0);
      state.muted = !!d.muted;
      /* Restore the pantry, clamped so a tampered or corrupted save cannot
         inject negative or fractional portions. */
      if (d.stock && typeof d.stock === 'object') {
        Object.keys(d.stock).forEach(function (raw) {
          /* Read through migrateKey so a pantry stocked before the rename is
             carried over instead of being written off as unknown. */
          var k = migrateKey(raw);
          if (SPECIAL_KEYS.indexOf(k) < 0) return;
          var v = Number(d.stock[raw]);
          if (isFinite(v)) state.stock[k] = Math.max(0, Math.floor(v));
        });
      }
      /* Older saves sold advanced ingredients as one-time unlocks. They are
         consumables now, so anyone who bought one gets a complimentary batch
         instead of having the purchase silently confiscated. */
      if (Array.isArray(d.unlocked)) {
        d.unlocked.forEach(function (raw) {
          var k = migrateKey(raw);
          if (SPECIAL_KEYS.indexOf(k) < 0) return;
          state.stock[k] = Math.max(state.stock[k], INGREDIENTS[k].batch);
        });
      }
      state.recipes = [];
      if (Array.isArray(d.recipes)) {
        d.recipes.forEach(function (id) { if (RECIPE_MAP[id] && state.recipes.indexOf(id) < 0) state.recipes.push(id); });
      }
      UPGRADE_KEYS.forEach(function (k) { state.upgrades[k] = !!(d.upgrades && d.upgrades[k]); });
      /* Clamped after the upgrades are in, because the day's cap depends on the
         stall upgrade and a tampered save must not read "Orders 99/5". */
      state.dayOrders = Math.min(state.dayOrders, maxOrdersPerDay());
    } catch (e) { /* corrupted save - start fresh */ }
  }

  function save() {
    try {
      storageSet(SAVE_KEY, JSON.stringify({
        day: state.day, dayOrders: state.dayOrders, dayRevenue: state.dayRevenue,
        dayServed: state.dayServed, dayLost: state.dayLost, dayStars: state.dayStars,
        dayRecipesFound: state.dayRecipesFound, dayDoubled: state.dayDoubled,
        cash: state.cash, unlocked: state.unlocked, stock: state.stock, recipes: state.recipes,
        upgrades: state.upgrades, bestRevenue: state.bestRevenue, totalServed: state.totalServed, muted: state.muted
      }));
    } catch (e) { /* storage unavailable */ }
  }

  /* Re-apply a (re)loaded save to surfaces that already booted from the
     pre-SDK localStorage snapshot. */
  function applySaveToUi() {
    refreshHud();
    renderRecipes();
    markShopDirty();
    buildShop();
    renderOrderCard();
    updateButtons();
    $('btn-bgm').textContent = state.muted ? '🔇 Muted' : '🎵 BGM';
    Audio.setMuted(state.muted);
    $('start-stats').textContent =
      'Day ' + state.day + '  ·  Cash ' + fmt(state.cash) + '  ·  Recipes ' +
      state.recipes.length + '/' + RECIPES.length + '  ·  Orders served ' + state.totalServed;
  }

  function maxOrdersPerDay() { return state.upgrades.stall ? 8 : 5; }

  /* ===========================================================================
   * 3. CRAZYGAMES SDK v3
   * ======================================================================== */
  /* Single source of truth: index.html computes __CG_ON_PLATFORM__ once when
     injecting the SDK, and main.js only reads that flag — never re-derives it. */
  var CG_ON_PLATFORM = !!window.__CG_ON_PLATFORM__;
  function sdkReady() { return CG_ON_PLATFORM && !!(window.CrazyGames && window.CrazyGames.SDK); }

  var rewardedAdPending = false;
  var midgameAdPending = false;
  var lastMidgameAt = -Infinity;
  var sdkInitStarted = false;
  /* Pessimistic default: ad CTAs start hidden and only appear after
     checkAdsAvailability() confirms the ad system is live. CrazyGames QA
     rejects "rewarded ad buttons without effect" during Basic Launch. */
  var adsUnavailable = true;

  /* 只有这两种错误码代表"平台永远不给投广告"；其余（adCooldown / unfilled /
     other）都是瞬时错误，不得永久隐藏激励 CTA。 */
  function isAdsOffError(err) {
    var code = err && err.code;
    return code === 'adsDisabledBasicLaunch' || code === 'adblock';
  }

  function markAdsUnavailable() {
    if (adsUnavailable) return;
    adsUnavailable = true;
    markShopDirty();
    if (document.getElementById('modal-shop') &&
        document.getElementById('modal-shop').classList.contains('show')) {
      buildShop(true);
    }
    refreshAdCtas();
  }

  function adsUsable() {
    if (!CG_ON_PLATFORM) return true; /* local/dev simulates ads */
    /* Optimistic until the platform proves ads are off (Basic Launch /
       adblock). Never gate on sdkReady here — CTAs would flash-hide during
       boot and reappear after init. */
    return !adsUnavailable;
  }

  function refreshAdCtas() {
    var hide = CG_ON_PLATFORM && adsUnavailable;
    var banners = document.querySelectorAll('.ad-banner');
    for (var i = 0; i < banners.length; i++) {
      banners[i].style.display = hide ? 'none' : '';
    }
    var restock = document.querySelectorAll('[data-adstock]');
    for (var j = 0; j < restock.length; j++) {
      restock[j].style.display = hide ? 'none' : '';
    }
    var doubleBtn = $('btn-ad-double');
    if (doubleBtn && hide) doubleBtn.disabled = true;
  }

  /* Probe the ad system at boot so Basic Launch (ads disabled) and adblock
     sessions never show rewarded CTAs. A midgame request at game start is
     suppressed by the SDK (adCooldown) — we only read the error code. */
  function checkAdsAvailability() {
    if (!CG_ON_PLATFORM || !sdkReady()) return;

    var settled = false;
    function setAdsAvailable() {
      if (!adsUnavailable) return;
      adsUnavailable = false;
      refreshAdCtas();
      markShopDirty();
      if (document.getElementById('modal-shop') &&
          document.getElementById('modal-shop').classList.contains('show')) {
        buildShop(true);
      }
    }

    try {
      window.CrazyGames.SDK.ad.requestAd('midgame', {
        adStarted: function () { settled = true; setAdsAvailable(); },
        adFinished: function () { settled = true; setAdsAvailable(); },
        adError: function (err) {
          settled = true;
          var code = err && err.code;
          if (code !== 'adsDisabledBasicLaunch' && code !== 'adblock') setAdsAvailable();
        }
      });
    } catch (e) { settled = true; /* stay hidden */ }

    /* The SDK may drop a "too early" midgame probe without any callback.
       Silence is not proof the ads are off — Basic Launch and adblock say so
       explicitly via the error codes above. Consult hasAdblock before
       revealing; if that is silent too, keep the CTAs hidden (never ship a
       rewarded button without effect). */
    window.setTimeout(function () {
      if (settled) return;
      try {
        var p = window.CrazyGames.SDK.ad.hasAdblock && window.CrazyGames.SDK.ad.hasAdblock();
        if (p && typeof p.then === 'function') {
          p.then(function (has) {
            if (settled) return;
            settled = true;
            if (!has) setAdsAvailable();
          }).catch(function () { settled = true; });
          return;
        }
        if (typeof p === 'boolean') {
          settled = true;
          if (!p) setAdsAvailable();
          return;
        }
      } catch (e) {}
      settled = true;
    }, 3000);
  }

  /* Ensure SDK.init() runs exactly once as soon as the async script finishes
     loading — previously a race left init permanently skipped on the platform. */
  function sdkInit() {
    if (sdkInitStarted || !CG_ON_PLATFORM) return;
    if (!window.__cgSdkLoaded__) {
      window.__cgSdkOnLoaded = function () {
        window.__cgSdkOnLoaded = null;
        sdkInit();
      };
      return;
    }
    /* Script finished (or onerror ran) but CrazyGames is still missing —
       adblock / failed load. Hide every rewarded CTA immediately. */
    if (!sdkReady()) {
      markAdsUnavailable();
      return;
    }
    sdkInitStarted = true;
    try {
      var p = window.CrazyGames.SDK.init();
      if (p && typeof p.then === 'function') {
        p.then(function () { onSdkReady(); })
          .catch(function () { /* init failure is non-fatal; ads simply no-op */ });
      } else {
        onSdkReady();
      }
    } catch (e) { /* init failure is non-fatal; ads simply no-op */ }
  }

  /* After SDK.init(): enable Data module storage, migrate any legacy local
     save, reload progress, then surface the CrazyGames profile (Full Launch). */
  function onSdkReady() {
    cgDataReady = true;
    try { migrateLocalToCgData([SAVE_KEY]); } catch (e) {}
    loadSave();
    try { applySaveToUi(); } catch (e) {}
    loadCgUserProfile();
    checkAdsAvailability();
  }

  /* ===========================================================================
   * 3b. CRAZYGAMES USER (username + avatar for Full Launch)
   * ======================================================================== */
  var cgUser = null;

  function loadCgUserProfile() {
    if (!CG_ON_PLATFORM || !sdkReady() || !window.CrazyGames.SDK.user) {
      renderCgUserChip(null);
      return;
    }
    var userMod = window.CrazyGames.SDK.user;
    try {
      if (userMod.isUserAccountAvailable === false) {
        renderCgUserChip(null);
        return;
      }
      var p = userMod.getUser();
      if (p && typeof p.then === 'function') {
        p.then(function (user) {
          cgUser = user || null;
          renderCgUserChip(cgUser);
        }).catch(function () { renderCgUserChip(null); });
      }
      if (typeof userMod.addAuthListener === 'function') {
        userMod.addAuthListener(function (user) {
          cgUser = user || null;
          renderCgUserChip(cgUser);
        });
      }
    } catch (e) { renderCgUserChip(null); }
  }

  function renderCgUserChip(user) {
    var chip = $('hud-user');
    if (!chip) return;
    if (!user || !user.username) {
      chip.style.display = 'none';
      return;
    }
    chip.style.display = '';
    var nameEl = $('hud-user-name');
    if (nameEl) nameEl.textContent = user.username;
    var img = $('hud-user-avatar');
    var ph = $('hud-user-ph');
    if (img && user.profilePictureUrl) {
      img.onload = function () {
        img.style.display = '';
        if (ph) ph.style.display = 'none';
      };
      img.onerror = function () {
        img.style.display = 'none';
        if (ph) ph.style.display = '';
      };
      img.referrerPolicy = 'no-referrer';
      img.src = user.profilePictureUrl;
    } else if (ph) {
      ph.style.display = '';
      if (img) img.style.display = 'none';
    }
  }

  function showRewardedAd(onSuccess, onFailure) {
    if (rewardedAdPending || midgameAdPending) {
      if (onFailure) onFailure('Another ad is already running.');
      return false;
    }
    /* Platform already told us ads are off — never leave a dead CTA path. */
    if (CG_ON_PLATFORM && adsUnavailable) {
      if (onFailure) onFailure('Ads are unavailable right now. No reward was granted.');
      return false;
    }

    /* Only a non-platform host (file:// / Vercel self-host) may simulate an ad.
       On CrazyGames, if the SDK is not ready yet we must NEVER pay out —
       otherwise rewards are granted without a real ad (policy violation). */
    if (!CG_ON_PLATFORM) {
      rewardedAdPending = true;
      Audio.setMuted(true);
      pauseGameplay('ad');
      window.setTimeout(function () {
        rewardedAdPending = false;
        Audio.setMuted(state.muted);
        resumeGameplayAfterAd();
        if (onSuccess) onSuccess();
      }, 1000);
      return true;
    }
    if (!sdkReady() || !window.CrazyGames.SDK.ad) {
      if (onFailure) onFailure('The ad system is still loading. Please try again in a moment.');
      return false;
    }

    rewardedAdPending = true;
    var settled = false;
    var adGuard = null;
    function settle(success, message) {
      if (settled) return;
      settled = true;
      window.clearTimeout(adGuard);
      rewardedAdPending = false;
      Audio.setMuted(state.muted);
      resumeGameplayAfterAd();
      if (success) {
        if (onSuccess) onSuccess();
      } else if (onFailure) {
        onFailure(message);
      }
    }

    /* If adStarted already fired, the ad owns mute/pause until adFinished —
       a guard timeout must not resume underneath it. */
    var adStartedFired = false;
    try {
      window.CrazyGames.SDK.ad.requestAd("rewarded", {
        /* CrazyGames' terms require the game to be silent for the whole ad
           break, so the master gain is forced to 0 here and put back to the
           player's own preference on every exit path. */
        adStarted: function () {
          adStartedFired = true;
          Audio.setMuted(true);
          pauseGameplay('ad');
          sdkGameplayStop();
        },
        adFinished: function () { settle(true); },
        adError: function (err) {
          /* 仅 Basic Launch / adblock 永久隐藏；瞬时错误保留 CTA 供重试。 */
          if (isAdsOffError(err)) markAdsUnavailable();
          settle(false, isAdsOffError(err)
            ? 'Ads are unavailable right now. No reward was granted.'
            : 'No ad available right now. No reward was granted.');
        }
      });
      adGuard = window.setTimeout(function () {
        if (adStartedFired) {
          /* Ad is still running from the SDK's point of view — only clear the
             pending flag so the game can continue accepting input; leave mute
             alone (adFinished will restore it). */
          settled = true;
          rewardedAdPending = false;
          if (onFailure) onFailure('The ad is taking too long. No reward was granted.');
          return;
        }
        settle(false, 'The ad is taking too long. No reward was granted.');
      }, TUNE.AD_GUARD_MS);
    } catch (err) {
      settle(false, 'The ad could not be started. No reward was granted.');
    }
    return true;
  }

  function showMidgameAd() {
    if (!CG_ON_PLATFORM) return;
    if (midgameAdPending || rewardedAdPending || adsUnavailable) return;
    var now = Date.now();
    if (now - lastMidgameAt < TUNE.MIDGAME_COOLDOWN_MS) return;
    if (!sdkReady() || !window.CrazyGames.SDK.ad) return;

    midgameAdPending = true;
    lastMidgameAt = now;
    var settled = false;
    var guard = null;
    function done(success, err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      midgameAdPending = false;
      if (success === false && isAdsOffError(err)) markAdsUnavailable();
      Audio.setMuted(state.muted);
      resumeGameplayAfterAd();
    }
    try {
      window.CrazyGames.SDK.ad.requestAd("midgame", {
        adStarted: function () {
          Audio.setMuted(true);
          pauseGameplay('ad');
          sdkGameplayStop();
        },
        adFinished: function () { done(true); },
        adError: function (err) { done(false, err); }
      });
      /* SDK that never calls back would otherwise mute the game forever. */
      guard = window.setTimeout(done, TUNE.MIDGAME_TIMEOUT_MS);
    } catch (e) { done(); }
  }

  function sdkGameplayStart() {
    try { if (sdkReady() && window.CrazyGames.SDK.game) window.CrazyGames.SDK.game.gameplayStart(); } catch (e) {}
  }
  function sdkGameplayStop() {
    try { if (sdkReady() && window.CrazyGames.SDK.game) window.CrazyGames.SDK.game.gameplayStop(); } catch (e) {}
  }
  function sdkHappytime() {
    try { if (sdkReady() && window.CrazyGames.SDK.game) window.CrazyGames.SDK.game.happytime(); } catch (e) {}
  }

  /* ===========================================================================
   * 4. WEB AUDIO ASMR ENGINE (zero external assets)
   * ======================================================================== */
  var Audio = (function () {
    var ctx = null, master = null, noiseBuf = null;
    var sizzleSrc = null, sizzleGain = null, sizzleFilter = null, sizzleLfo = null, sizzleLfoGain = null;
    var bgmTimer = null, bgmStep = 0, bgmNextT = 0, muted = false;

    var STEP = 0.29;
    var MEL = [
      659.25, 0, 783.99, 0, 880.00, 0, 783.99, 0,
      698.46, 0, 587.33, 0, 659.25, 0, 0, 0,
      523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0,
      587.33, 0, 523.25, 0, 440.00, 0, 0, 0
    ];
    var BASS = [
      130.81, 0, 0, 0, 164.81, 0, 0, 0, 146.83, 0, 0, 0, 110.00, 0, 0, 0,
      130.81, 0, 0, 0, 196.00, 0, 0, 0, 174.61, 0, 0, 0, 130.81, 0, 0, 0
    ];

    function ensure() {
      if (ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { ctx = null; return false; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);
      return true;
    }
    function resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    }
    function unlock() { if (ensure()) resume(); }

    function voice(opt) {
      if (!ensure()) return;
      var t0 = (opt.at || ctx.currentTime);
      var o = ctx.createOscillator();
      o.type = opt.type || 'sine';
      o.frequency.setValueAtTime(opt.freq, t0);
      if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + (opt.bend || opt.dur));
      var g = ctx.createGain();
      var vol = (opt.vol == null ? 0.18 : opt.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.attack || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
      var node = g;
      if (opt.lp) {
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = opt.lp;
        g.connect(f); node = f;
      }
      if (opt.hp) {
        var h = ctx.createBiquadFilter();
        h.type = 'highpass'; h.frequency.value = opt.hp;
        node.connect(h); node = h;
      }
      o.connect(g);
      node.connect(master);
      o.start(t0);
      o.stop(t0 + opt.dur + 0.08);
    }

    function ensureNoise() {
      if (!noiseBuf) {
        var len = Math.floor(ctx.sampleRate * 2);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
    }

    function noiseBurst(dur, vol, lp, hp) {
      if (!ensure()) return;
      var t0 = ctx.currentTime;
      ensureNoise();
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 3000;
      var h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp || 200;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(h); h.connect(g); g.connect(master);
      s.start(t0); s.stop(t0 + dur + 0.05);
    }

    function startSizzle() {
      if (!ensure() || sizzleSrc) return;
      resume();
      ensureNoise();
      sizzleSrc = ctx.createBufferSource();
      sizzleSrc.buffer = noiseBuf;
      sizzleSrc.loop = true;
      sizzleFilter = ctx.createBiquadFilter();
      sizzleFilter.type = 'lowpass';
      sizzleFilter.frequency.value = 800;
      sizzleFilter.Q.value = 0.9;
      sizzleGain = ctx.createGain();
      sizzleGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      sizzleGain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.7);
      sizzleLfo = ctx.createOscillator();
      sizzleLfo.type = 'sine';
      sizzleLfo.frequency.value = 0.27;
      sizzleLfoGain = ctx.createGain();
      sizzleLfoGain.gain.value = 0.018;
      sizzleLfo.connect(sizzleLfoGain);
      sizzleLfoGain.connect(sizzleGain.gain);
      sizzleSrc.connect(sizzleFilter);
      sizzleFilter.connect(sizzleGain);
      sizzleGain.connect(master);
      sizzleSrc.start();
      sizzleLfo.start();
    }

    function stopSizzle() {
      if (!ctx || !sizzleSrc) return;
      var t = ctx.currentTime;
      try {
        sizzleGain.gain.cancelScheduledValues(t);
        sizzleGain.gain.setValueAtTime(Math.max(0.0001, sizzleGain.gain.value), t);
        sizzleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        sizzleSrc.stop(t + 0.6);
        sizzleLfo.stop(t + 0.6);
      } catch (e) {}
      sizzleSrc = null; sizzleGain = null; sizzleFilter = null; sizzleLfo = null; sizzleLfoGain = null;
    }

    function crackEgg() {
      if (!ensure()) return;
      noiseBurst(0.07, 0.14, 5200, 1200);
      voice({ freq: 420, to: 190, dur: 0.17, vol: 0.22, type: 'triangle', bend: 0.15, lp: 2600 });
      voice({ freq: 640, to: 300, dur: 0.11, vol: 0.10, type: 'sine', bend: 0.09, at: ctx.currentTime + 0.03 });
    }
    function flipThud() {
      voice({ freq: 180, to: 84, dur: 0.36, vol: 0.30, type: 'sine', bend: 0.34, lp: 600 });
      noiseBurst(0.16, 0.07, 900, 120);
    }
    function spreadScrape() { noiseBurst(0.10, 0.045, 2600, 500); }
    function coin() {
      if (!ensure()) return;
      var t = ctx.currentTime;
      [880, 1320, 1760].forEach(function (f, i) {
        voice({ freq: f, dur: 0.30, vol: 0.16, type: 'triangle', at: t + i * 0.075, lp: 6000 });
        voice({ freq: f * 2, dur: 0.16, vol: 0.05, type: 'sine', at: t + i * 0.075 });
      });
    }
    function victory() {
      if (!ensure()) return;
      var t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach(function (f, i) {
        voice({ freq: f, dur: 0.62, vol: 0.19, type: 'triangle', at: t + i * 0.135, lp: 5200 });
        voice({ freq: f / 2, dur: 0.62, vol: 0.07, type: 'sine', at: t + i * 0.135 });
      });
    }
    function deny() {
      if (!ensure()) return;
      var t = ctx.currentTime;
      voice({ freq: 200, to: 140, dur: 0.18, vol: 0.16, type: 'square', at: t, bend: 0.16, lp: 900 });
      voice({ freq: 150, to: 100, dur: 0.22, vol: 0.14, type: 'square', at: t + 0.14, bend: 0.2, lp: 900 });
    }
    function swoosh() {
      noiseBurst(0.34, 0.10, 2400, 380);
      voice({ freq: 520, to: 180, dur: 0.30, vol: 0.08, type: 'sine', bend: 0.28, lp: 1800 });
    }
    function chime() {
      if (!ensure()) return;
      var t = ctx.currentTime;
      voice({ freq: 1174.66, dur: 0.5, vol: 0.10, type: 'sine', at: t, lp: 7000 });
      voice({ freq: 1567.98, dur: 0.6, vol: 0.08, type: 'sine', at: t + 0.10, lp: 7000 });
    }

    function playBgmStep(atTime) {
      if (!ctx || muted) return;
      var t = atTime != null ? atTime : ctx.currentTime + 0.06;
      var m = MEL[bgmStep % MEL.length];
      var b = BASS[bgmStep % BASS.length];
      if (m) {
        voice({ freq: m, dur: 0.95, vol: 0.055, type: 'triangle', at: t, attack: 0.02, lp: 3800 });
        voice({ freq: m * 2.005, dur: 0.42, vol: 0.018, type: 'sine', at: t, attack: 0.015 });
      }
      if (b) voice({ freq: b, dur: 1.5, vol: 0.045, type: 'sine', at: t, attack: 0.06, lp: 900 });
      if (bgmStep % 8 === 0) noiseBurst(0.05, 0.010, 5000, 2000);
      bgmStep++;
    }

    /* Look-ahead scheduler: a 100ms interval queues every step that falls
       inside the next 300ms of audio-clock time, so background-tab throttling
       cannot chop the melody into glitchy stutters (plain setInterval could). */
    function bgmTick() {
      if (!ctx || muted) return;
      while (bgmNextT < ctx.currentTime + 0.3) {
        if (bgmNextT < ctx.currentTime) bgmNextT = ctx.currentTime + 0.02;
        playBgmStep(bgmNextT);
        bgmNextT += STEP;
      }
    }

    function startBgm() {
      if (!ensure()) return;
      resume();
      if (bgmTimer) return;
      bgmStep = 0;
      bgmNextT = ctx.currentTime + 0.08;
      bgmTimer = window.setInterval(bgmTick, 100);
    }
    function stopBgm() { if (bgmTimer) { window.clearInterval(bgmTimer); bgmTimer = null; } }
    function setMuted(m) {
      muted = !!m;
      if (master) {
        /* Ramp instead of a raw assignment: a 0 → 0.85 step clicks audibly,
           which was most noticeable when restoring volume after an ad. */
        try {
          var t = ctx.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(master.gain.value, t);
          master.gain.setTargetAtTime(muted ? 0 : 0.85, t, muted ? 0.012 : 0.03);
        } catch (e) {
          master.gain.value = muted ? 0 : 0.85;
        }
      }
      if (!muted) resume();
    }
    function suspend() {
      if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
    }
    function resumeCtx() { resume(); }

    return {
      unlock: unlock, startSizzle: startSizzle, stopSizzle: stopSizzle,
      crackEgg: crackEgg, flipThud: flipThud, spreadScrape: spreadScrape,
      coin: coin, victory: victory, deny: deny, swoosh: swoosh, chime: chime,
      startBgm: startBgm, stopBgm: stopBgm, setMuted: setMuted,
      suspend: suspend, resumeCtx: resumeCtx
    };
  })();

  /* ===========================================================================
   * 5. CANVAS ENGINE
   * ======================================================================== */
  var cv = $('pan');
  var ctx = cv.getContext('2d');
  var W = 640, H = 360, CX = 320, CY = 180;
  var PAN_R = 158, MAX_R = 136, ANGLES = 64;
  var TAU = Math.PI * 2;

  /* The base is only finished once the player has physically swept the scraper
     two full laps around the griddle. Growth is driven by the swirled angle,
     never by elapsed time, so resting on the pan does nothing at all. Either
     rotation direction counts and the sweep is accumulated as an absolute
     value, so the crepe can only ever grow — see trackSwirl(). */
  var SWIRL_LAPS = 2;
  var SWIRL_FULL = TAU * SWIRL_LAPS;  /* total swept angle required: 720° */
  /* A single frame sweeping more than this cannot be a hand movement — it is
     the pointer jumping (or re-entering the pan from the far side), and letting
     it through would hand the player a free half-lap. */
  var SWIRL_MAX_STEP = 0.6;
  /* The crepe widens as the batter is worked outwards, but it must be at full
     width by the time the two laps are up — otherwise the crepe would still be
     visibly too small at the very moment the player is told the base is ready. */
  var SWIRL_WIDTH_LAPS = 1.0;
  /* How much radius one radian of swirling deposits into the band of angles
     under the scraper. Chosen so a single full pass saturates the band all the
     way to its limit, whatever the frame rate or the player's hand speed. */
  var SWIRL_DEPOSIT = 3.0;

  var blob = new Float32Array(ANGLES);
  var maxR = 0;
  var panRot = 0;
  var particles = [];
  var MAX_PARTICLES = TUNE.MAX_PARTICLES;

  /* Pre-rendered steam puff — one radial-gradient sprite built once, then
     blitted with globalAlpha. Replacing per-particle createRadialGradient
     removes the main per-frame allocation in the particle pass. */
  var steamSprite = null;
  function getSteamSprite() {
    if (steamSprite) return steamSprite;
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var sc = s.getContext('2d');
    var g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,246,232,1)');
    g.addColorStop(0.45, 'rgba(255,244,224,0.55)');
    g.addColorStop(1, 'rgba(255,240,220,0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, 64, 64);
    steamSprite = s;
    return s;
  }

  /* Deterministic blister / mottle unit positions for the crepe surface.
     Precomputed once (they never change) instead of ~330 trig calls per frame. */
  var BLISTERS = (function () {
    var out = [];
    for (var b = 0; b < 54; b++) {
      out.push({ a: (b * 2.399) % TAU, d: ((b * 0.618) % 1) * 0.9 + 0.05, r1: 2.4 + (b % 4), r2: 1.4 + (b % 3) });
    }
    return out;
  })();
  var MOTTLES = (function () {
    var out = [];
    for (var m = 0; m < 30; m++) {
      out.push({ a: (m * 2.399) % TAU, d: ((m * 0.613) % 1) * 0.86 + 0.06, rx: 5 + (m % 4) * 2, ry: 3.4 + (m % 3) * 1.6 });
    }
    return out;
  })();

  var game = {
    phase: 'idle',      /* idle | cooking | flipping | folding | locked */
    paused: false,      /* modal / ad / tab-hidden — freezes logic, still renders */
    started: false,     /* false until "Open the Stall" — no rAF work before that */
    coverage: 0,
    eggs: [],
    toppings: {},
    art: {},
    sauces: {},
    flipped: false,
    flipT: 0,
    foldT: 0,
    sear: [],
    searTimer: 0,
    order: null,
    dragging: false,
    inPan: false,
    px: CX, py: CY,
    lastX: CX, lastY: CY,
    time: 0,
    glow: 0,
    swirl: 0,           /* accumulated scraper rotation (either way), in radians */
    lastSwirlAng: -1,   /* pointer angle on the previous frame, -1 = no previous */
    batterProgress: 0,  /* 0..1 swirl progress; 1.0 means two full laps */
    batterDone: false,  /* set by finishBatter() once the base is truly finished */
    shelfStage: '',     /* which stage the side shelves are currently showing */
    hintTick: 0,
    serveResult: null,  /* settlement computed at serve time, drives the payout FX */
    coinPaid: false
  };

  /* Fold-animation offscreen cache: the crepe body is drawn once when folding
     starts, then blitted 3× per frame (centre / left wing / right wing) instead
     of re-running the full topping pipeline every pass. */
  var foldCache = null;
  function buildFoldCache() {
    var side = Math.ceil(MAX_R * 2 + 48);
    var c = document.createElement('canvas');
    c.width = side; c.height = side;
    var cc = c.getContext('2d');
    /* Swap the module-level ctx the draw helpers close over, render the crepe
       once into the offscreen buffer, then restore. */
    var prev = ctx;
    ctx = cc;
    try {
      drawCrepeBody(side / 2, side / 2);
    } finally {
      ctx = prev;
    }
    foldCache = c;
    return c;
  }
  function clearFoldCache() { foldCache = null; }
  function drawFoldCached(cx, cy) {
    if (!foldCache) { drawCrepeBody(cx, cy); return; }
    var half = foldCache.width / 2;
    ctx.drawImage(foldCache, cx - half, cy - half);
  }

  /* Pause / resume used by modals, ads and tab visibility. Keeps SDK
     gameplayStart/Stop paired with the real "player is playing" windows. */
  var gameplayRunning = false;
  function pauseGameplay(reason) {
    if (game.paused) return;
    game.paused = true;
    Audio.stopSizzle();
    sdkGameplayStop();
    gameplayRunning = false;
  }
  function resumeGameplay(reason) {
    if (!game.paused) return;
    /* Never resume while a modal is still open. */
    if (document.querySelector('.modal.show')) return;
    if (rewardedAdPending || midgameAdPending) return;
    /* Stay paused while the first-time onboarding overlay is up — a tab
       focus event must not unpause the run under the tutorial. */
    if ($('overlay-tutorial') && !$('overlay-tutorial').classList.contains('hide')) return;
    game.paused = false;
    if (game.started && game.phase !== 'locked') {
      sdkGameplayStart();
      gameplayRunning = true;
    }
  }
  function resumeGameplayAfterAd() {
    if (rewardedAdPending || midgameAdPending) return;
    resumeGameplay('ad');
  }

  function resetPan() {
    blob.fill(0);
    maxR = 0;
    game.coverage = 0;
    game.eggs = [];
    game.toppings = {};
    game.art = {};
    game.sauces = {};
    game.flipped = false;
    game.flipT = 0;
    game.foldT = 0;
    game.sear = [];
    game.searTimer = 0;
    game.phase = 'cooking';
    game.dragging = false;
    game.inPan = false;
    game.swirl = 0;
    game.lastSwirlAng = -1;
    game.batterProgress = 0;
    game.batterDone = false;
    game.hintTick = 0;
    game.serveResult = null;
    game.coinPaid = false;
    particles.length = 0;
    clearFoldCache();
    Audio.stopSizzle();
    refreshShelfMarks();
    applyShelfStage(true);
    updateButtons();
  }

  /* --- particle helpers -------------------------------------------------- */
  function pushParticle(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }
  function spawnSteam(x, y, strength) {
    pushParticle({
      t: 'steam', x: x, y: y, vx: rand(-12, 12), vy: rand(-42, -20) * strength,
      r: rand(6, 16), life: 0, max: rand(1.1, 2.2), seed: rand(0, 6.28)
    });
  }
  function spawnSpark(x, y) {
    pushParticle({
      t: 'spark', x: x, y: y, vx: rand(-26, 26), vy: rand(-46, -14),
      r: rand(0.8, 2.1), life: 0, max: rand(0.3, 0.7)
    });
  }
  function spawnCoin(x, y, text) {
    pushParticle({ t: 'coin', x: x, y: y, vx: rand(-18, 18), vy: rand(-76, -46), life: 0, max: rand(1.3, 1.9), text: text, r: rand(8, 12) });
  }
  function spawnCrumb(x, y, color) {
    pushParticle({ t: 'crumb', x: x, y: y, vx: rand(-50, 50), vy: rand(-70, -20), r: rand(1.2, 2.8), life: 0, max: rand(0.5, 1.0), color: color });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t === 'steam') {
        p.vy -= 6 * dt;
        p.vx += Math.sin((p.life + p.seed) * 2.1) * 14 * dt;
        p.r += 15 * dt;
      } else {
        p.vy += 120 * dt;
      }
    }
  }

  function drawParticles() {
    var sprite = getSteamSprite();
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], k = p.life / p.max;
      if (p.t === 'steam') {
        var a = (1 - k) * 0.26 * Math.min(1, k * 6);
        var d = p.r * 2;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, d, d);
        ctx.globalAlpha = 1;
      } else if (p.t === 'spark') {
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.fillStyle = k < 0.4 ? '#fff0b8' : '#ff9a3c';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.t === 'crumb') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.t === 'coin') {
        ctx.globalAlpha = 1 - Math.pow(k, 3);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU);
        var cg = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
        cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.5, '#ffcc4d'); cg.addColorStop(1, '#d68e12');
        ctx.fillStyle = cg; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
        ctx.fillStyle = '#5b3d00';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.text, 0, 0.5);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* --- griddle ----------------------------------------------------------- */
  /* Cached background gradient — colours never change, so build once. */
  var bgGrad = null;
  function getBgGrad() {
    if (!bgGrad) {
      bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0b0b14');
      bgGrad.addColorStop(1, '#151019');
    }
    return bgGrad;
  }

  /* Offscreen griddle plate: rim + plate fill + 16 rings + 28 spokes baked
     once (44 stroke calls → one blit per frame). Halo/neon stroke stay dynamic
     because they pulse with game.glow. */
  var griddleCache = null;
  function getGriddleCache() {
    if (griddleCache) return griddleCache;
    var pad = 40;
    var size = (PAN_R + pad) * 2;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    var ox = PAN_R + pad, oy = PAN_R + pad;
    g.translate(ox, oy);

    g.beginPath(); g.arc(0, 0, PAN_R, 0, TAU);
    var rim = g.createLinearGradient(-PAN_R, -PAN_R, PAN_R, PAN_R);
    rim.addColorStop(0, '#4d4d5c'); rim.addColorStop(0.33, '#20202a');
    rim.addColorStop(0.6, '#3b3b48'); rim.addColorStop(1, '#13131b');
    g.fillStyle = rim; g.fill();

    g.beginPath(); g.arc(0, 0, PAN_R - 13, 0, TAU);
    var plate = g.createRadialGradient(-34, -44, 8, 0, 0, PAN_R - 13);
    plate.addColorStop(0, '#2e2e38'); plate.addColorStop(0.62, '#1b1b23'); plate.addColorStop(1, '#0e0e15');
    g.fillStyle = plate; g.fill();

    g.save();
    g.beginPath(); g.arc(0, 0, PAN_R - 14, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.032)'; g.lineWidth = 1.6;
    g.beginPath();
    var i;
    for (i = 1; i <= 16; i++) g.arc(0, 0, (PAN_R - 16) * i / 16, 0, TAU);
    for (i = 0; i < 28; i++) {
      var a = i / 28 * TAU;
      g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      g.lineTo(Math.cos(a) * (PAN_R - 16), Math.sin(a) * (PAN_R - 16));
    }
    g.stroke();
    g.restore();

    griddleCache = { canvas: c, pad: pad, size: size };
    return griddleCache;
  }

  function drawGriddle() {
    var halo = ctx.createRadialGradient(CX, CY, PAN_R * 0.7, CX, CY, PAN_R + 34);
    halo.addColorStop(0, 'rgba(255,140,40,' + (0.12 + game.glow * 0.14) + ')');
    halo.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.beginPath(); ctx.arc(CX, CY, PAN_R + 34, 0, TAU);
    ctx.fillStyle = halo; ctx.fill();

    var cache = getGriddleCache();
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(panRot);
    ctx.drawImage(cache.canvas, -cache.size / 2, -cache.size / 2);
    ctx.restore();

    ctx.beginPath(); ctx.arc(CX, CY, PAN_R, 0, TAU);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(34,230,255,' + (0.30 + game.glow * 0.35) + ')';
    ctx.stroke();
  }

  /* --- batter ------------------------------------------------------------ */
  /* The spread model keeps a per-angle radius (blob[]) purely for gameplay, but
     the crepe itself is drawn as a true circle: the radius grows smoothly with
     coverage, so the silhouette never shows polygon facets or serrated edges. */
  function batterRadius(scale) {
    var sc = scale == null ? 1 : scale;
    /* Two independent things decide how big the crepe looks. coverage is how
       much of the rim the scraper has actually reached — swirl in the middle of
       the pan and it stays low. maxR is how far the swirl has carried the batter
       outwards. The circle is the product of the two. */
    return MAX_R * clamp(game.coverage, 0, 1) * clamp(maxR, 0, 1) * sc;
  }

  function circlePath(r, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.01, r), 0, TAU);
    ctx.closePath();
  }

  function drawBatter(scale, ox, oy) {
    if (game.coverage < 0.012) return;
    var px = (ox == null ? CX : ox), py = (oy == null ? CY : oy);
    var sc = scale == null ? 1 : scale;
    var r = batterRadius(sc);
    var flipped = game.flipped;
    var i;

    ctx.save();

    /* soft drop shadow so the crepe sits on the griddle */
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(px + 3, py + 5, r, r * 0.97, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.fill();
    ctx.restore();

    circlePath(r, px, py);

    if (flipped) {
      /* seared underside: caramel gold -> crisp deep brown rim */
      var gb = ctx.createRadialGradient(px - r * 0.16, py - r * 0.20, r * 0.06, px, py, r);
      gb.addColorStop(0, '#E5A955');
      gb.addColorStop(0.62, '#C97F2A');
      gb.addColorStop(1, '#A1651B');
      ctx.fillStyle = gb;
    } else {
      /* raw top side: creamy ivory -> toasted wheat rim */
      var gf = ctx.createRadialGradient(px - r * 0.16, py - r * 0.20, r * 0.06, px, py, r);
      gf.addColorStop(0, '#F8EAC5');
      gf.addColorStop(0.58, '#EFD79C');
      gf.addColorStop(1, '#D2AD65');
      ctx.fillStyle = gf;
    }
    ctx.fill();

    /* --- detail pass, clipped to the crepe surface --- */
    ctx.save();
    ctx.clip();

    /* Maillard bloom: a warm toasted sheen around the rim */
    var rimGlow = ctx.createRadialGradient(px, py, r * 0.55, px, py, r);
    rimGlow.addColorStop(0, 'rgba(180,110,30,0)');
    rimGlow.addColorStop(0.72, flipped ? 'rgba(150,80,16,.20)' : 'rgba(196,140,54,.16)');
    rimGlow.addColorStop(1, flipped ? 'rgba(120,58,8,.46)' : 'rgba(168,112,32,.34)');
    ctx.fillStyle = rimGlow;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);

    /* scattered sear spots build up while the base cooks */
    for (i = 0; i < game.sear.length; i++) {
      var s = game.sear[i];
      var sx = px + Math.cos(s.a) * s.d * r;
      var sy = py + Math.sin(s.a) * s.d * r;
      ctx.beginPath();
      ctx.ellipse(sx, sy, s.r * sc, s.r * 0.72 * sc, s.rot, 0, TAU);
      ctx.fillStyle = 'rgba(126,70,16,' + (s.alpha * (flipped ? 0.85 : 0.6)) + ')';
      ctx.fill();
    }

    if (flipped) {
      /* crisp blistered texture on the cooked face (precomputed unit coords) */
      for (var b = 0; b < BLISTERS.length; b++) {
        var bl = BLISTERS[b];
        var bx = px + Math.cos(bl.a) * bl.d * r;
        var by = py + Math.sin(bl.a) * bl.d * r;
        ctx.beginPath(); ctx.arc(bx, by, bl.r1 * sc, 0, TAU);
        ctx.fillStyle = 'rgba(255,226,150,.30)'; ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 1, by + 1, bl.r2 * sc, 0, TAU);
        ctx.fillStyle = 'rgba(126,66,10,.24)'; ctx.fill();
      }
    } else {
      /* light browning mottle on the raw side (precomputed unit coords) */
      for (var m = 0; m < MOTTLES.length; m++) {
        var mo = MOTTLES[m];
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(mo.a) * mo.d * r, py + Math.sin(mo.a) * mo.d * r,
          mo.rx * sc, mo.ry * sc, mo.a, 0, TAU);
        ctx.fillStyle = 'rgba(206,158,74,.13)';
        ctx.fill();
      }
    }

    /* glossy highlight sweep */
    var sweep = ctx.createLinearGradient(px - r, py - r, px + r * 0.4, py + r * 0.6);
    sweep.addColorStop(0, 'rgba(255,255,235,.16)');
    sweep.addColorStop(0.45, 'rgba(255,255,235,.04)');
    sweep.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
    ctx.restore();

    /* crisp toasted edge */
    circlePath(r, px, py);
    ctx.lineWidth = 3;
    ctx.strokeStyle = flipped
      ? 'rgba(110,54,6,.55)'
      : 'rgba(168,112,32,.42)';
    ctx.stroke();

    /* inner ring just inside the rim, sells the "baked edge" */
    circlePath(r * 0.9, px, py);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = flipped
      ? 'rgba(255,206,120,.20)'
      : 'rgba(255,244,206,.26)';
    ctx.stroke();

    ctx.restore();
  }

  /* --- egg --------------------------------------------------------------- */
  function drawEgg(e, scale, ox, oy) {
    var px = (ox == null ? CX : ox), py = (oy == null ? CY : oy);
    var sc = scale == null ? 1 : scale;
    ctx.save();

    /* never let an egg bleed past the crepe edge */
    circlePath(batterRadius(sc), px, py);
    ctx.clip();

    ctx.translate(px + e.x * sc, py + e.y * sc);
    ctx.scale(sc, sc);
    var r = e.r * (1 + e.spread * 1.05);

    /* egg white: soft irregular oval, low harmonic amplitude so it reads as a
       smooth translucent pool rather than a faceted polygon */
    ctx.beginPath();
    for (var i = 0; i <= 44; i++) {
      var a = i / 44 * TAU;
      var rr = r * (1 + 0.10 * Math.sin(a * 3 + e.seed) + 0.05 * Math.sin(a * 5 + e.seed * 2.3));
      var x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.86;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    var gw = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r * 1.25);
    gw.addColorStop(0, 'rgba(255,253,244,' + (0.94 - e.spread * 0.42) + ')');
    gw.addColorStop(0.68, 'rgba(255,247,225,' + (0.72 - e.spread * 0.4) + ')');
    gw.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = gw;
    ctx.fill();

    /* glossy rim on the white */
    ctx.strokeStyle = 'rgba(255,255,250,' + (0.30 - e.spread * 0.2) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    /* yolk: plump and dimensional, with a specular hotspot */
    var ya = 1 - e.spread * 0.9;
    if (ya > 0.03) {
      var yr = r * 0.40 * (1 - e.spread * 0.15);
      ctx.beginPath(); ctx.arc(r * 0.07, -r * 0.05, yr, 0, TAU);
      var gy = ctx.createRadialGradient(-yr * 0.3, -yr * 0.35, yr * 0.08, 0, 0, yr);
      gy.addColorStop(0, 'rgba(255,236,150,' + ya + ')');
      gy.addColorStop(0.55, 'rgba(255,178,22,' + ya + ')');
      gy.addColorStop(1, 'rgba(206,116,0,' + (ya * 0.92) + ')');
      ctx.fillStyle = gy; ctx.fill();

      /* yolk shadow so it sits proud of the white */
      ctx.beginPath();
      ctx.arc(r * 0.07, -r * 0.05 + yr * 0.22, yr * 0.98, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = 'rgba(150,80,0,' + (ya * 0.22) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-yr * 0.33, -yr * 0.38, yr * 0.26, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,240,' + (ya * 0.82) + ')';
      ctx.fill();
    }
    ctx.restore();
  }

/* --- sauce -------------------------------------------------------------- */
  function drawSauce(key, layer, scale, ox, oy) {
    var px = (ox == null ? CX : ox), py = (oy == null ? CY : oy);
    var sc = scale == null ? 1 : scale;
    if (layer <= 0) return;
    var r = batterRadius(sc) * 0.94;
    ctx.save();

    /* clip the sauce inside the crepe and follow its round silhouette */
    circlePath(batterRadius(sc), px, py);
    ctx.clip();

    ctx.translate(px, py);

    /* The layer is brushed on by hand: it stays rich through the middle and
       thins out toward the rim, so the golden crisp base keeps showing through
       instead of being flat-painted over. */
    var g = ctx.createRadialGradient(-r * 0.22, -r * 0.26, r * 0.06, 0, 0, r);
    if (key === 'sweetSauce') {
      g.addColorStop(0, 'rgba(160,94,46,' + (0.50 * layer) + ')');
      g.addColorStop(0.60, 'rgba(122,58,21,' + (0.62 * layer) + ')');
      g.addColorStop(0.88, 'rgba(90,40,12,' + (0.42 * layer) + ')');
      g.addColorStop(1, 'rgba(67,28,7,0)');
    } else {
      g.addColorStop(0, 'rgba(255,138,86,' + (0.50 * layer) + ')');
      g.addColorStop(0.58, 'rgba(232,35,28,' + (0.66 * layer) + ')');
      g.addColorStop(0.88, 'rgba(180,18,16,' + (0.46 * layer) + ')');
      g.addColorStop(1, 'rgba(120,8,8,0)');
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    circlePath(r, 0, 0);
    ctx.fill();

    /* brushed-on streaks read as a glossy layer rather than flat paint */
    ctx.globalAlpha = 0.26 * layer;
    ctx.strokeStyle = key === 'sweetSauce' ? 'rgba(255,222,176,.75)' : 'rgba(255,206,150,.65)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    var seed = key === 'chiliSauce' ? 1.7 : 4.2;
    for (var k = 0; k < 4; k++) {
      ctx.beginPath();
      for (var t = 0; t <= 30; t++) {
        var aa = t / 30 * TAU * 0.9 + k * 1.6 + seed;
        var rr = (0.15 + 0.7 * (t / 30)) * r;
        var xx = Math.cos(aa) * rr, yy = Math.sin(aa) * rr;
        if (t === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    /* wet specular highlight */
    ctx.globalAlpha = 0.30 * layer;
    var spec = ctx.createRadialGradient(-r * 0.30, -r * 0.34, r * 0.04, -r * 0.30, -r * 0.34, r * 0.72);
    spec.addColorStop(0, 'rgba(255,255,255,.85)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    circlePath(r, 0, 0);
    ctx.fill();

    ctx.restore();
  }

  /* --- topping art -------------------------------------------------------- */
  function makeArt(key) {
    var out = [];
    var n = 1, i;
    switch (key) {
      case 'scallion': n = 20; break;
      case 'sesame':   n = 46; break;
      case 'lettuce':  n = 9;  break;
      case 'sausage':   n = 5;  break;
      case 'bacon':    n = 4;  break;
      case 'liji': n = 5; break;
      case 'crisp':  n = 4;  break;
      case 'latiao':    n = 7;  break;
      case 'rousong':    n = 14; break;
      case 'lobster':  n = 4;  break;
      case 'cheese':   n = 5;  break;
      case 'intestine': n = 6; break;
      default: n = 6;
    }
    var rr = batterRadius(1) * 0.78;
    if (key === 'crisp') {
      /* one big golden waffle crisp laid dead centre on the crepe */
      out.push({ x: 0, y: 0, rot: 0, s: 1.9, v: 0.5, a: 0.4 });
      return out;
    }
    for (i = 0; i < n; i++) {
      var a = rand(0, TAU), d = Math.sqrt(Math.random()) * 0.82;
      out.push({
        x: Math.cos(a) * d * rr,
        y: Math.sin(a) * d * rr,
        rot: rand(0, TAU), s: rand(0.8, 1.25), v: Math.random(), a: rand(0, TAU)
      });
    }
    return out;
  }

  function drawArt(key, pieces, scale, ox, oy) {
    var px = (ox == null ? CX : ox), py = (oy == null ? CY : oy);
    var sc = scale == null ? 1 : scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(sc, sc);

    /* toppings are confined to the crepe surface */
    circlePath(batterRadius(1), 0, 0);
    ctx.clip();

    var i, p;
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      switch (key) {
        case 'scallion':
          ctx.strokeStyle = 'rgba(58,150,52,.95)';
          ctx.lineWidth = 2.2 * p.s;
          ctx.beginPath(); ctx.arc(0, 0, 4.2 * p.s, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(180,240,150,.85)';
          ctx.lineWidth = 1.1 * p.s;
          ctx.beginPath(); ctx.arc(0, 0, 4.2 * p.s, 0, TAU); ctx.stroke();
          break;
        case 'sesame':
          ctx.fillStyle = 'rgba(28,22,16,.92)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 1.7 * p.s, 1.1 * p.s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,240,200,.35)';
          ctx.beginPath(); ctx.ellipse(-0.4, -0.4, 0.7 * p.s, 0.45 * p.s, 0, 0, TAU); ctx.fill();
          break;
        case 'lettuce':
          ctx.beginPath();
          for (var q = 0; q <= 12; q++) {
            var qa = q / 12 * TAU;
            var qr = (11 + 4 * Math.sin(qa * 3 + p.v * 6)) * p.s;
            var qx = Math.cos(qa) * qr, qy = Math.sin(qa) * qr * 0.66;
            if (q === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(86,186,70,.92)'; ctx.fill();
          ctx.strokeStyle = 'rgba(210,255,190,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-8 * p.s, 0); ctx.lineTo(8 * p.s, 0);
          ctx.strokeStyle = 'rgba(230,255,210,.55)'; ctx.stroke();
          break;
        case 'sausage':
          ctx.fillStyle = '#c0453a';
          roundRect(-16 * p.s, -4.5 * p.s, 32 * p.s, 9 * p.s, 4.5 * p.s);
          ctx.fill();
          /* grilled slits scored across the skin */
          ctx.strokeStyle = 'rgba(96,26,20,.85)';
          ctx.lineWidth = 1.5 * p.s;
          ctx.beginPath();
          for (var hk = -9; hk <= 9; hk += 6) {
            ctx.moveTo(hk * p.s, -4 * p.s);
            ctx.lineTo((hk + 3.4) * p.s, 4 * p.s);
          }
          ctx.stroke();
          /* seared char blotches */
          ctx.fillStyle = 'rgba(70,18,10,.5)';
          ctx.beginPath(); ctx.ellipse(-6 * p.s, 1.6 * p.s, 2.6 * p.s, 1.4 * p.s, 0.5, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(7 * p.s, -1.4 * p.s, 2.2 * p.s, 1.2 * p.s, 0.5, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,178,146,.5)';
          roundRect(-13 * p.s, -2.8 * p.s, 26 * p.s, 2.4 * p.s, 1.2 * p.s);
          ctx.fill();
          break;
        case 'bacon':
          ctx.fillStyle = '#a83a2c';
          roundRect(-18 * p.s, -6 * p.s, 36 * p.s, 12 * p.s, 3 * p.s);
          ctx.fill();
          ctx.fillStyle = '#f0d3b0';
          for (var bk = -12; bk <= 12; bk += 8) {
            ctx.fillRect(bk * p.s, -5 * p.s, 3.2 * p.s, 10 * p.s);
          }
          ctx.strokeStyle = 'rgba(90,20,10,.6)'; ctx.lineWidth = 1;
          roundRect(-18 * p.s, -6 * p.s, 36 * p.s, 12 * p.s, 3 * p.s);
          ctx.stroke();
          break;
        case 'liji':
          ctx.fillStyle = '#7a4321';
          roundRect(-14 * p.s, -6.5 * p.s, 28 * p.s, 13 * p.s, 4 * p.s);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,190,120,.45)';
          ctx.fillRect(-11 * p.s, -3.5 * p.s, 22 * p.s, 2 * p.s);
          ctx.fillStyle = 'rgba(60,26,8,.55)';
          ctx.fillRect(-9 * p.s, 2 * p.s, 6 * p.s, 2 * p.s);
          ctx.fillRect(3 * p.s, 2 * p.s, 5 * p.s, 2 * p.s);
          break;
        case 'crisp':
          ctx.fillStyle = '#e0a83f';
          roundRect(-15 * p.s, -15 * p.s, 30 * p.s, 30 * p.s, 4 * p.s);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,70,10,.55)'; ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (var ck = -10; ck <= 10; ck += 5) {
            ctx.moveTo(ck * p.s, -15 * p.s); ctx.lineTo(ck * p.s, 15 * p.s);
            ctx.moveTo(-15 * p.s, ck * p.s); ctx.lineTo(15 * p.s, ck * p.s);
          }
          ctx.stroke();
          break;
        case 'latiao':
          ctx.fillStyle = '#b4231c';
          roundRect(-17 * p.s, -3.6 * p.s, 34 * p.s, 7.2 * p.s, 3.4 * p.s);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,110,60,.55)';
          roundRect(-14 * p.s, -2 * p.s, 28 * p.s, 2.4 * p.s, 1.2 * p.s);
          ctx.fill();
          break;
        case 'rousong':
          ctx.fillStyle = 'rgba(206,152,84,.9)';
          for (var fk = 0; fk < 7; fk++) {
            var fa = fk / 7 * TAU;
            ctx.beginPath();
            ctx.ellipse(Math.cos(fa) * 5 * p.s, Math.sin(fa) * 5 * p.s, 5.5 * p.s, 3.4 * p.s, fa, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(60,110,60,.5)';
          ctx.fillRect(-6 * p.s, -1 * p.s, 12 * p.s, 1.6 * p.s);
          break;
        case 'lobster':
          ctx.fillStyle = '#e2603a';
          ctx.beginPath(); ctx.ellipse(0, 0, 13 * p.s, 8 * p.s, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff8a55';
          ctx.beginPath(); ctx.ellipse(-3 * p.s, -2 * p.s, 7 * p.s, 4 * p.s, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#c2461f'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-11 * p.s, -5 * p.s); ctx.lineTo(-17 * p.s, -10 * p.s);
          ctx.moveTo(-11 * p.s, 5 * p.s); ctx.lineTo(-17 * p.s, 10 * p.s);
          ctx.moveTo(11 * p.s, -5 * p.s); ctx.lineTo(17 * p.s, -10 * p.s);
          ctx.moveTo(11 * p.s, 5 * p.s); ctx.lineTo(17 * p.s, 10 * p.s);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,236,160,.85)';
          ctx.beginPath(); ctx.ellipse(2 * p.s, 0, 3.4 * p.s, 2 * p.s, 0, 0, TAU); ctx.fill();
          break;
        case 'cheese':
          ctx.beginPath();
          ctx.moveTo(-14 * p.s, 8 * p.s); ctx.lineTo(14 * p.s, 8 * p.s); ctx.lineTo(2 * p.s, -11 * p.s);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,201,60,.94)'; ctx.fill();
          ctx.strokeStyle = 'rgba(210,140,10,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.fillStyle = 'rgba(255,240,170,.8)';
          ctx.beginPath(); ctx.arc(-3 * p.s, 3 * p.s, 1.8 * p.s, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(4 * p.s, 5 * p.s, 1.4 * p.s, 0, TAU); ctx.fill();
          break;
        case 'intestine':
          ctx.strokeStyle = '#8a5220';
          ctx.lineWidth = 4.6 * p.s;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, 6 * p.s, p.a, p.a + 4.2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,190,120,.5)';
          ctx.lineWidth = 1.6 * p.s;
          ctx.beginPath();
          ctx.arc(0, 0, 6 * p.s, p.a, p.a + 4.2);
          ctx.stroke();
          ctx.lineCap = 'butt';
          break;
        default:
          ctx.fillStyle = '#cc8844';
          ctx.beginPath(); ctx.arc(0, 0, 5 * p.s, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* --- scraper: classic T-shaped wooden crepe spreader (bamboo dragonfly) -- */
  function drawScraper() {
    if (game.phase === 'folding') return;
    /* Stay visible for the whole active stroke, even if the pointer briefly
       rides past the pan rim while closing the outer circle. */
    if (!game.inPan && !game.dragging) return;

    /* The tool pivots on the griddle centre: the handle runs outward from the
       centre and the crossbar blade rides at the outer end, right under the
       pointer, so it sweeps tangentially as you circle the pan. */
    var dx = game.px - CX, dy = game.py - CY;
    var dist = Math.hypot(dx, dy);
    var ang = dist > 3 ? Math.atan2(dy, dx) : -0.5;
    var len = clamp(dist, 46, MAX_R + 26);

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(ang);

    /* contact shadow cast by the tool */
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.translate(3, 6);
    ctx.fillStyle = '#000';
    roundRect(4, -5, len - 4, 11, 5); ctx.fill();
    roundRect(len - 8, -28, 17, 56, 7); ctx.fill();
    ctx.restore();

    /* --- handle: tapered dark walnut shaft --- */
    var hg = ctx.createLinearGradient(0, -6, 0, 6);
    hg.addColorStop(0, '#A8794A');
    hg.addColorStop(0.42, '#8C6239');
    hg.addColorStop(1, '#5E3E20');
    ctx.fillStyle = hg;
    roundRect(6, -5, len - 12, 10, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(52,32,12,.75)';
    ctx.lineWidth = 1.3;
    roundRect(6, -5, len - 12, 10, 5); ctx.stroke();

    /* lengthwise sheen on the handle */
    ctx.fillStyle = 'rgba(255,228,186,.30)';
    roundRect(10, -2.8, len - 22, 2.2, 1.1); ctx.fill();

    /* collar where the shaft meets the blade */
    ctx.fillStyle = '#6B4622';
    roundRect(len - 16, -7, 9, 14, 3); ctx.fill();

    /* --- crossbar blade: pale birch paddle, perpendicular to the shaft --- */
    var bx = len - 4, bh = 58, bw = 15;
    var bg = ctx.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
    bg.addColorStop(0, '#C49A6C');
    bg.addColorStop(0.45, '#D8B084');
    bg.addColorStop(1, '#A67E52');
    ctx.fillStyle = bg;
    roundRect(bx - bw / 2, -bh / 2, bw, bh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(96,64,30,.72)';
    ctx.lineWidth = 1.4;
    roundRect(bx - bw / 2, -bh / 2, bw, bh, 6); ctx.stroke();

    /* wood grain running the length of the blade */
    ctx.strokeStyle = 'rgba(140,100,58,.42)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var gy = -bh / 2 + 8 + i * (bh - 16) / 3;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2 + 3.5, gy);
      ctx.quadraticCurveTo(bx, gy + 1.8, bx + bw / 2 - 3.5, gy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,240,215,.34)';
    roundRect(bx - bw / 2 + 2.5, -bh / 2 + 2.5, 2, bh - 5, 1); ctx.fill();

    ctx.restore();

    /* heat shimmer / working glow under the blade while spreading */
    if (game.dragging) {
      var gx = CX + Math.cos(ang) * len;
      var gy2 = CY + Math.sin(ang) * len;
      var hg2 = ctx.createRadialGradient(gx, gy2, 3, gx, gy2, 30);
      hg2.addColorStop(0, 'rgba(34,230,255,.55)');
      hg2.addColorStop(1, 'rgba(34,230,255,0)');
      ctx.beginPath(); ctx.arc(gx, gy2, 30, 0, TAU);
      ctx.fillStyle = hg2; ctx.fill();
    }
  }

  /* --- folding / bag ------------------------------------------------------ */
  /* Ingredients that live on the RAW top face. They are drawn only while the
     crepe is face-up and are completely hidden once it is flipped over. */
  var RAW_FACE = { scallion: true, sesame: true };

  /* Strict face separation: the two sides never bleed into each other.
       face-up  -> raw batter + eggs + scallion + sesame
       face-down-> seared batter + sauces + all cooked fillings            */
  function drawCrepeBody(ox, oy) {
    var i, key;
    drawBatter(1, ox, oy);

    if (game.flipped) {
      if (game.sauces.sweetSauce) drawSauce('sweetSauce', game.sauces.sweetSauce, 1, ox, oy);
      if (game.sauces.chiliSauce) drawSauce('chiliSauce', game.sauces.chiliSauce, 1, ox, oy);
      for (i = 0; i < ING_KEYS.length; i++) {
        key = ING_KEYS[i];
        if (RAW_FACE[key]) continue;
        if (game.toppings[key] && game.art[key]) drawArt(key, game.art[key], 1, ox, oy);
      }
    } else {
      for (i = 0; i < game.eggs.length; i++) drawEgg(game.eggs[i], 1, ox, oy);
      for (i = 0; i < ING_KEYS.length; i++) {
        key = ING_KEYS[i];
        if (!RAW_FACE[key]) continue;
        if (game.toppings[key] && game.art[key]) drawArt(key, game.art[key], 1, ox, oy);
      }
    }
  }

  /* kraft paper takeaway bag with a red stamp logo.
     Drawn in two passes so the folded crepe can slide in between them:
     pass 1 = the open bag, pass 2 = the front panel that closes over it. */
  function drawBag(x, y, s, alpha, front) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(s, s);

    var W2 = 40, TOP = -38, H2 = 84;

    if (!front) {
      /* ground shadow */
      ctx.save();
      ctx.globalAlpha = alpha * 0.4;
      ctx.beginPath(); ctx.ellipse(0, 48, 46, 10, 0, 0, TAU);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.restore();

      /* dark interior seen through the open mouth */
      ctx.fillStyle = '#6B4A22';
      roundRect(-W2 + 3, TOP + 4, W2 * 2 - 6, 40, 3); ctx.fill();

      /* bag body */
      var g = ctx.createLinearGradient(-W2, TOP, W2, TOP + H2);
      g.addColorStop(0, '#DAB77C');
      g.addColorStop(0.45, '#C8A265');
      g.addColorStop(1, '#A07C42');
      ctx.fillStyle = g;
      roundRect(-W2, TOP, W2 * 2, H2, 4); ctx.fill();

      /* side creases give it volume */
      ctx.strokeStyle = 'rgba(126,92,44,.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-W2 + 9, TOP + 6); ctx.lineTo(-W2 + 9, TOP + H2 - 6);
      ctx.moveTo(W2 - 9, TOP + 6); ctx.lineTo(W2 - 9, TOP + H2 - 6);
      ctx.stroke();
    } else {
      /* front panel closes over the opening so the crepe reads as tucked in */
      var gf = ctx.createLinearGradient(-W2, TOP + 30, W2, TOP + H2);
      gf.addColorStop(0, '#D5B075');
      gf.addColorStop(0.5, '#C29B5C');
      gf.addColorStop(1, '#9C783E');
      ctx.fillStyle = gf;
      roundRect(-W2, TOP + 30, W2 * 2, H2 - 30, 4); ctx.fill();

      /* serrated top lip */
      ctx.beginPath();
      ctx.moveTo(-W2, TOP + 30);
      for (var i = 0; i <= 9; i++) {
        ctx.lineTo(-W2 + i * (W2 * 2 / 9), TOP + 30 + (i % 2 === 0 ? 0 : -6));
      }
      ctx.lineTo(W2, TOP + 30);
      ctx.strokeStyle = 'rgba(126,92,44,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(104,74,32,.7)';
      ctx.lineWidth = 1.8;
      roundRect(-W2, TOP, W2 * 2, H2, 4); ctx.stroke();

      /* red stamp logo */
      ctx.save();
      ctx.translate(0, TOP + 58);
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU);
      ctx.fillStyle = 'rgba(196,42,42,.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,224,224,.75)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 13.6, 0, TAU);
      ctx.strokeStyle = 'rgba(255,224,224,.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#FFF0EC';
      ctx.font = 'bold 19px Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();

      /* brand line */
      ctx.fillStyle = 'rgba(88,60,24,.8)';
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('CYBER CREPE', 0, TOP + 34);
    }

    ctx.restore();
  }

  /* One continuous fold -> bag -> payout sequence driven by game.foldT. */
  function drawFoldAnimation(p) {
    var bagX = 500, bagY = 268;

    /* ---- stage 3 (60-85%): the kraft bag rises from below ---- */
    var bagUp = clamp((p - 0.60) / 0.25, 0, 1);
    var be = 1 - Math.pow(1 - bagUp, 3);
    /* once the parcel is packed, the bag lifts off the griddle and floats up */
    var liftE = 1 - Math.pow(1 - clamp((p - 0.85) / 0.15, 0, 1), 3);
    var bagY2 = bagY + (1 - be) * 150 - liftE * 30;
    /* back pass: the open bag sits behind the parcel */
    if (bagUp > 0.001) drawBag(bagX, bagY2, 0.94, be, false);

    /* ---- stages 1 & 2 (0-60%): the two wings fold in ---- */
    var foldP = clamp(p / 0.60, 0, 1);
    var leftP = clamp(foldP / 0.5, 0, 1);            /* 0-30% of total */
    var rightP = clamp((foldP - 0.5) / 0.5, 0, 1);   /* 30-60% of total */

    /* ---- stage 4 (85-100%): bundle swings over the bag and drops in ---- */
    var moveE = 1 - Math.pow(1 - clamp((p - 0.78) / 0.12, 0, 1), 2);
    var dropE = 1 - Math.pow(1 - clamp((p - 0.88) / 0.12, 0, 1), 3);
    var hoistY = bagY2 - 62;   /* hovering right over the open mouth */
    var homeY = bagY2 - 8;     /* settled down inside the bag */

    ctx.save();
    var crepeX = CX + (bagX - CX) * moveE;
    var crepeY = CY + (hoistY - CY) * moveE + (homeY - hoistY) * dropE;
    var crepeS = 1 - moveE * 0.55 - dropE * 0.19;
    /* the parcel fades out as the front panel closes over it, so it reads as
       genuinely tucked into the bag instead of pasted on top of it */
    var crepeA = 1 - dropE * 0.92;
    /* once both wings are in, the parcel is pressed flat so it reads as a
       compact wrap instead of a tall sliver */
    var squash = 1 - 0.52 * foldP;

    ctx.globalAlpha = crepeA;
    ctx.translate(crepeX, crepeY);
    ctx.scale(crepeS, crepeS * squash);
    ctx.translate(-crepeX, -crepeY);

    var R = batterRadius(1);
    var halfFold = R * 0.56;      /* where each wing creases */
    var wingW = R - halfFold;     /* width of one wing */

    /* centre band: stays flat and becomes the wrapped middle */
    ctx.save();
    ctx.beginPath();
    ctx.rect(crepeX - halfFold, crepeY - R - 20, halfFold * 2, (R + 20) * 2);
    ctx.clip();
    drawFoldCached(crepeX, crepeY);
    ctx.restore();

    /* A wing tips over its crease with a cosine 3D perspective fold: the scale
       runs +1 -> 0 (edge-on) -> -1, so the flap first foreshortens and then
       lands mirrored on top of the centre band instead of simply vanishing.
       The clip window tracks the flap edge, which keeps every other part of the
       crepe out of the shot. */
    var lw = Math.cos(leftP * Math.PI);
    if (Math.abs(lw) > 0.012) {
      ctx.save();
      ctx.beginPath();
      var lx0 = crepeX - halfFold - wingW * Math.max(0, lw);
      var lx1 = crepeX - halfFold - wingW * Math.min(0, lw);
      ctx.rect(lx0, crepeY - R - 20, lx1 - lx0, (R + 20) * 2);
      ctx.clip();
      ctx.translate(crepeX - halfFold, crepeY);
      ctx.scale(lw, 1);
      ctx.translate(-(crepeX - halfFold), -crepeY);
      drawFoldCached(crepeX, crepeY);
      ctx.restore();
    }

    /* the right wing folds over last, so it ends up on top */
    var rw = Math.cos(rightP * Math.PI);
    if (Math.abs(rw) > 0.012) {
      ctx.save();
      ctx.beginPath();
      var rx0 = crepeX + halfFold + wingW * Math.min(0, rw);
      var rx1 = crepeX + halfFold + wingW * Math.max(0, rw);
      ctx.rect(rx0, crepeY - R - 20, rx1 - rx0, (R + 20) * 2);
      ctx.clip();
      ctx.translate(crepeX + halfFold, crepeY);
      ctx.scale(rw, 1);
      ctx.translate(-(crepeX + halfFold), -crepeY);
      drawFoldCached(crepeX, crepeY);
      ctx.restore();
    }

    /* crease seams along the two wing folds, confined to the parcel */
    if (leftP > 0.02 || rightP > 0.02) {
      ctx.save();
      /* keep the seams on the crepe silhouette, never floating off the parcel */
      circlePath(R, crepeX, crepeY);
      ctx.clip();
      ctx.strokeStyle = 'rgba(88,48,10,.62)';
      ctx.lineWidth = 2.2;
      /* the fold hinges sit on the silhouette, so the seam runs to the chord
         where that x meets the circle */
      var chord = Math.sqrt(Math.max(0, R * R - halfFold * halfFold));
      var seamTop = crepeY - chord;
      var seamBot = crepeY + chord;
      if (leftP > 0.02) {
        ctx.globalAlpha = leftP * 0.8;
        ctx.beginPath();
        ctx.moveTo(crepeX - halfFold, seamTop);
        ctx.lineTo(crepeX - halfFold, seamBot);
        ctx.stroke();
      }
      if (rightP > 0.02) {
        ctx.globalAlpha = rightP * 0.8;
        ctx.beginPath();
        ctx.moveTo(crepeX + halfFold, seamTop);
        ctx.lineTo(crepeX + halfFold, seamBot);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    /* front pass: the panel closes over the parcel's lower half */
    if (bagUp > 0.001) drawBag(bagX, bagY2, 0.94, be, true);

    /* ---- stage 4 payout: golden +$XX rising above the bag ---- */
    if (p >= 0.84 && game.serveResult) {
      var t = clamp((p - 0.84) / 0.16, 0, 1);
      if (!game.coinPaid) {
        game.coinPaid = true;
        Audio.coin();
        var n = clamp(Math.round(game.serveResult.money / 14), 3, 12);
        for (var c = 0; c < n; c++) {
          spawnCoin(rand(300, 560), rand(190, 280), '$' + Math.max(1, Math.round(game.serveResult.money / n)));
        }
        spawnSteam(bagX, bagY2 - 24, 1.2);
        spawnSteam(bagX - 24, bagY2 - 12, 1.0);
        spawnSteam(bagX + 24, bagY2 - 12, 1.0);
      }
      var ay = bagY2 - 74 - t * 46;
      var aAlpha = t < 0.75 ? 1 : (1 - (t - 0.75) / 0.25);
      ctx.save();
      ctx.globalAlpha = clamp(aAlpha, 0, 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 27px Consolas, monospace';
      ctx.shadowColor = 'rgba(255,196,60,.95)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#2A1A00';
      ctx.fillText('+' + fmt(game.serveResult.money), bagX + 2, ay + 2);
      ctx.fillStyle = '#FFD863';
      ctx.fillText('+' + fmt(game.serveResult.money), bagX, ay);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.fillStyle = 'rgba(255,240,190,.92)';
      ctx.fillText(starRow(game.serveResult.stars), bagX, ay + 20);
      ctx.restore();
    }
  }

  function drawCrepe() {
    if (game.phase === 'folding' || game.phase === 'finishing') {
      drawFoldAnimation(game.foldT);
      return;
    }

    if (game.flipT > 0 && game.flipT < 1) {
      var sy = Math.cos(game.flipT * TAU);
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(1, Math.abs(sy) < 0.02 ? 0.02 : sy);
      ctx.translate(-CX, -CY);
      var wasFlipped = game.flipped;
      game.flipped = sy < 0 ? true : wasFlipped;
      drawCrepeBody(CX, CY);
      game.flipped = wasFlipped;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.sin(game.flipT * Math.PI) * 0.5;
      ctx.strokeStyle = 'rgba(34,230,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CX, CY, MAX_R + 8 + Math.sin(game.flipT * Math.PI) * 16, -1.2, 1.2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    drawCrepeBody(CX, CY);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getBgGrad();
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#22e6ff';
    ctx.fillRect(0, 8, W, 1.5);
    ctx.fillStyle = '#ff3d9a';
    ctx.fillRect(0, H - 10, W, 1.5);
    ctx.restore();

    game.glow = clamp(game.coverage * 1.2, 0, 1) * (0.55 + 0.45 * Math.sin(game.time * 2.4));
    drawGriddle();
    drawCrepe();
    drawScraper();
    drawParticles();
  }

/* ===========================================================================
   * 6. CANVAS INPUT
   * ======================================================================== */
  function toCanvas(ev) {
    var r = cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (W / r.width),
      y: (ev.clientY - r.top) * (H / r.height)
    };
  }

  function pointerUpdate(ev) {
    var p = toCanvas(ev);
    game.lastX = p.x; game.lastY = p.y;
    game.px = p.x; game.py = p.y;
    var d = Math.hypot(p.x - CX, p.y - CY);
    /* Generous margin past the pan rim: the crossbar rides out at
       MAX_R+26 and the last outer arc needs the pointer at the edge.
       A tight PAN_R+12 cutoff made the scraper vanish mid-circle and
       reset swirl, so the final sector could never be banked. */
    game.inPan = d < PAN_R + 56;
  }

  function endDrag() {
    if (!game.dragging) return;
    game.dragging = false;
    game.lastSwirlAng = -1;
    Audio.stopSizzle();
    updateButtons();
  }

  function bindCanvas() {
    cv.addEventListener('pointerdown', function (ev) {
      /* Only the primary pointer drives the scraper — a second finger must not
         steal / release the drag mid-stroke. */
      if (ev.isPrimary === false) return;
      Audio.unlock();
      if (game.paused || !game.started) return;
      if (game.phase !== 'cooking') return;
      cv.setPointerCapture(ev.pointerId);
      game.dragging = true;
      /* a fresh stroke re-seeds the reference angle so lifting and re-pressing
         elsewhere never counts as one enormous sweep */
      game.lastSwirlAng = -1;
      var p = toCanvas(ev);
      game.lastX = p.x; game.lastY = p.y;
      pointerUpdate(ev);
      Audio.startSizzle();
      Audio.spreadScrape();
    });
    cv.addEventListener('pointermove', function (ev) {
      if (ev.isPrimary === false) return;
      pointerUpdate(ev);
    });
    window.addEventListener('pointerup', function (ev) {
      if (ev && ev.isPrimary === false) return;
      endDrag();
    });
    cv.addEventListener('pointerleave', function (ev) {
      /* With pointer capture the stroke continues outside the canvas — only
         stop when the button is actually up (window pointerup handles that).
         Ending here made the scraper vanish and killed the final outer arc. */
      if (!ev || ev.buttons === 0) {
        game.inPan = false;
        endDrag();
      }
    });
  }

  /* Accrue the angle the scraper has swept around the griddle. Unwrapping into
     (-PI, PI] keeps crossing the ±PI seam from registering as a gigantic jump.

     The step is taken as an absolute value: swirling anticlockwise, or dragging
     the scraper back the way it came, must never subtract from the work already
     done — progress is monotonically non-decreasing. Oversized steps are
     pointer jumps rather than hand movement, so they are dropped instead of
     being banked as a free half-lap. */
  function trackSwirl() {
    var ang = Math.atan2(game.py - CY, game.px - CX);
    if (ang < 0) ang += TAU;
    var gain = 0;
    if (game.lastSwirlAng >= 0) {
      var d = ang - game.lastSwirlAng;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      var step = Math.abs(d);
      if (step <= SWIRL_MAX_STEP) gain = step;
    }
    game.lastSwirlAng = ang;
    var boost = state.upgrades.scraper ? 1.8 : 1;
    game.swirl += gain * boost;
    game.batterProgress = clamp(game.swirl / SWIRL_FULL, 0, 1);
    return gain;
  }

  /* The base is finished only when BOTH hold: two full laps have been swept AND
     the batter has genuinely reached the rim of the griddle. The second check
     is what stops a player from finishing with a tiny circle scribbled in the
     middle of the pan.

     Finishing pins the model at full width, and updateSpread() stops writing to
     it entirely, so from here on batterRadius() is locked to exactly MAX_R and
     no further pointer motion can pull the crepe back in. */
  function finishBatter() {
    if (game.batterDone) return;
    game.batterDone = true;
    game.batterProgress = 1;
    for (var f = 0; f < ANGLES; f++) blob[f] = 1;
    maxR = 1;
    game.coverage = 1;
    Audio.chime();
    for (var i = 0; i < 20; i++) spawnSteam(CX + rand(-MAX_R, MAX_R) * 0.8, CY + rand(-MAX_R, MAX_R) * 0.8, 1.0);
    applyShelfStage(true);
    updateButtons();
    flashHint('🫓 Base is spread — add egg, scallion & sesame, then hit [Flip the Base]', 'good');
  }

  function updateSpread(dt) {
    if (!game.dragging || game.phase !== 'cooking') return;

    if (!game.batterDone) {
      var dAng = trackSwirl();
      if (dAng > 0) {
        var boost = state.upgrades.scraper ? 1.8 : 1.0;
        /* width grows with the swept angle, so only real swirling widens the crepe */
        maxR = Math.min(1, maxR + dAng / (TAU * SWIRL_WIDTH_LAPS) * boost);

        var ang = Math.atan2(game.py - CY, game.px - CX);
        if (ang < 0) ang += TAU;
        var idx = ang / TAU * ANGLES;
        /* How far out the scraper is right now. The band of angles under it can
           never grow past this, so a player who only ever scribbles in the
           middle of the pan cannot spread the batter to the rim. */
        var reach = Math.min(1, Math.hypot(game.px - CX, game.py - CY) / MAX_R + 0.18);
        for (var k = -9; k <= 9; k++) {
          var i = (Math.round(idx) + k + ANGLES * 2) % ANGLES;
          var w = 1 - Math.abs(k) / 10;
          var next = Math.min(reach, blob[i] + dAng * SWIRL_DEPOSIT * boost * w);
          /* Monotonic write. Once the scraper swings back towards the middle,
             `reach` drops below radius that has already been laid down; taking
             the plain min() there would overwrite it with the smaller value and
             shrink the crepe on screen. Only ever grow. */
          if (next > blob[i]) blob[i] = next;
        }
        var sum = 0;
        for (var s = 0; s < ANGLES; s++) sum += blob[s];
        game.coverage = sum / ANGLES;

        /* Once two laps are banked, active swirling near the rim also lifts
           every angular bin toward `reach`. Without this, a few under-filled
           sectors can pin coverage just under the finish bar no matter how
           much the player keeps circling — the crepe already looks done. */
        if (game.batterProgress >= 1 && reach >= 0.97) {
          for (var t = 0; t < ANGLES; t++) {
            var lift = dAng * SWIRL_DEPOSIT * boost * 0.45;
            var cap = Math.min(1, reach);
            if (blob[t] < cap) blob[t] = Math.min(cap, blob[t] + lift);
          }
          sum = 0;
          for (var u = 0; u < ANGLES; u++) sum += blob[u];
          game.coverage = sum / ANGLES;
        }

        /* Both gates: 720° of swirl and a crepe that is visually at the rim.
           (Previously required coverage*maxR >= (MAX_R-0.5)/MAX_R ≈ 0.9963,
           which is invisible on screen but easy to miss with uneven bins.) */
        if (game.batterProgress >= 1 && maxR >= 0.98 && game.coverage >= 0.97) {
          finishBatter();
        }
      }
      game.hintTick += dt;
      if (game.hintTick >= 0.12) { game.hintTick = 0; updateHint(); }
    } else {
      /* base already finished — no further swirl bookkeeping */
      game.lastSwirlAng = -1;
    }

    for (var e = 0; e < game.eggs.length; e++) {
      var eg = game.eggs[e];
      var ex = CX + eg.x, ey = CY + eg.y;
      if (Math.hypot(game.px - ex, game.py - ey) < eg.r + 22) {
        eg.spread = Math.min(1, eg.spread + dt * 1.6);
      }
    }
    /* Rate must scale with dt — a raw per-frame probability made 120Hz
       displays generate steam twice as fast as 60Hz ones. */
    if (Math.random() < 0.35 * dt * 60) {
      spawnSteam(game.px + rand(-8, 8), game.py + rand(-8, 8), 0.6);
    }
  }

  /* ===========================================================================
   * 7. GAMEPLAY
   * ======================================================================== */
  /* Every day counter that appears on the receipt lives on `state`, so a refresh
     cannot change the finished day's summary. */

  /* Only recipes the stall can actually cook right now. As well as the base
     larder this has to check the pantry, or the game would happily take an order
     for a lobster crepe with an empty lobster tray and hand the player an
     impossible ticket. */
  function feasibleRecipes() {
    return RECIPES.filter(function (r) {
      if (r.special) return false;
      for (var i = 0; i < r.set.length; i++) {
        var k = r.set[i];
        var ing = INGREDIENTS[k];
        if (!ing) return false;
        /* Two different gates. Base larder items are always unlocked; the seven
           consumables never enter `unlocked` at all, so checking it for them
           would rule out every recipe that uses one and quietly retire a third
           of the menu. Their gate is the pantry. */
        if (ing.isSpecial) { if ((state.stock[k] || 0) <= 0) return false; }
        else if (state.unlocked.indexOf(k) < 0) return false;
      }
      return true;
    });
  }

  function findRecipe(eggs, keys) {
    var i, r;
    for (i = 0; i < RECIPES.length; i++) {
      r = RECIPES[i];
      if (r.special) continue;
      if (r.eggs !== eggs) continue;
      if (r.set.length !== keys.length) continue;
      if (sameSet(r.set, keys)) return r;
    }
    if (eggs === 2 && keys.length >= 6 &&
        keys.indexOf('sweetSauce') >= 0 && keys.indexOf('chiliSauce') >= 0) {
      return RECIPE_MAP.universal;
    }
    return null;
  }

  function nextCustomer() {
    if (state.dayOrders >= maxOrdersPerDay()) { closeDay(); return; }
    resetPan();
    var cust = pick(CUSTOMERS);
    var free = Math.random() < 0.2;
    var pool = feasibleRecipes();
    /* An empty pool (tampered stock, future data edits) must never reach
       pick([]) — that returned undefined and crashed renderOrderCard. */
    var recipe = (free || !pool.length) ? null : pick(pool);
    if (!recipe) free = true;
    var set = recipe ? recipe.set.slice() : [];
    var eggs = recipe ? recipe.eggs : 2;

    var complexity = set.length + eggs;
    var patience = clamp(complexity * 5 + TUNE.PATIENCE_MIN, TUNE.PATIENCE_MIN, TUNE.PATIENCE_MAX);

    game.order = {
      cust: cust,
      recipe: recipe,
      free: free,
      eggs: eggs,
      set: set,
      patience: patience,
      patienceMax: patience,
      value: orderValue(recipe, set, eggs)
    };
    renderOrderCard();
    updateButtons();
    Audio.chime();
  }

  function orderValue(recipe, set, eggs) {
    var v = BASE_PRICE + eggs * INGREDIENTS.egg.price;
    for (var i = 0; i < set.length; i++) v += INGREDIENTS[set[i]].price;
    if (recipe) v += recipe.bonus;
    return v;
  }

  /* [Flip the Base] stays dark until finishBatter() has actually run, i.e. until
     the player has swirled two full laps around the griddle. */
  function canFlip() {
    return game.phase === 'cooking' && !game.flipped && game.batterDone;
  }
  /* Serving is only reachable through the flip, so the base is always spread by
     the time this can light up. */
  function canServe() {
    return game.phase === 'cooking' && game.flipped;
  }

  function doFlip() {
    if (!canFlip()) {
      Audio.deny();
      flashHint(game.flipped
        ? '⚠️ The base is already flipped'
        : '⚠️ Keep swirling — the base is not spread yet', 'warn');
      return;
    }
    game.phase = 'flipping';
    game.flipT = 0;
    Audio.flipThud();
    Audio.stopSizzle();
    for (var i = 0; i < 26; i++) spawnSteam(CX + rand(-90, 90), CY + rand(-60, 60), 1.1);
    updateButtons();
  }

  /* Settle the order up-front so the folding animation can show the real payout. */
  function computeServe() {
    var order = game.order;
    var keys = Object.keys(game.toppings);
    var eggs = game.eggs.length;
    var perfect = !!order && !order.free && order.eggs === eggs && sameSet(order.set, keys);
    var recipe = findRecipe(eggs, keys);

    var base = BASE_PRICE + eggs * INGREDIENTS.egg.price;
    for (var i = 0; i < keys.length; i++) base += INGREDIENTS[keys[i]].price;

    var bonus = 0;
    var money = 0;
    var stars;
    var ratio = order ? clamp(order.patience / order.patienceMax, 0, 1) : 0;

    if (order && order.free) {
      bonus = recipe ? recipe.bonus : 0;
      money = base + bonus + Math.round((base + bonus) * TUNE.SERVE_TIP_FREE * ratio);
      stars = recipe ? 5 : (keys.length >= 2 ? 4 : 3);
    } else if (perfect) {
      bonus = order.recipe ? order.recipe.bonus : 0;
      money = base + bonus + Math.round((base + bonus) * TUNE.SERVE_TIP_PERFECT * ratio);
      stars = ratio > 0.55 ? 5 : (ratio > 0.28 ? 4 : 3);
    } else {
      money = Math.round(base * TUNE.SERVE_WRONG);
      stars = keys.length > 0 || eggs > 0 ? 2 : 1;
    }

    return {
      order: order, perfect: perfect, recipe: recipe, money: money, stars: stars
    };
  }

  function doServe() {
    if (!canServe()) {
      Audio.deny();
      flashHint('⚠️ Flip the base first — the underside needs the Maillard crust', 'warn');
      return;
    }
    game.serveResult = computeServe();
    game.phase = 'folding';
    game.foldT = 0;
    game.coinPaid = false;
    /* Bake the crepe once — drawFoldAnimation blits this instead of re-running
       the full topping pipeline three times per frame. */
    buildFoldCache();
    Audio.swoosh();
    Audio.stopSizzle();
    updateButtons();
    /* Completion is driven solely by foldT in loop() (no setTimeout race that
       could cut the animation short on a laggy frame). */
  }

  function finishServe() {
    if (game.phase !== 'finishing' && game.phase !== 'folding') return;
    var res = game.serveResult || computeServe();
    var order = res.order;
    var perfect = res.perfect;
    var recipe = res.recipe;
    var money = res.money;
    var stars = res.stars;
    clearFoldCache();

    state.cash += money;
    state.dayRevenue += money;
    state.dayStars += stars;
    state.dayServed++;
    state.dayOrders++;
    state.totalServed++;

    /* the coin burst + jingle are driven by the folding animation's final stage */
    for (var sp = 0; sp < 18; sp++) spawnCrumb(rand(220, 420), rand(150, 250), 'rgba(255,214,140,.9)');

    if (perfect) {
      toast('✅ ' + (order.recipe ? order.recipe.name : 'Order') + ' · ' + fmt(money) + ' (' + starRow(stars) + ')', 'gold');
      if (stars === 5) sdkHappytime();
    } else if (order && order.free) {
      toast('🎲 Chef\'s Special served · ' + fmt(money) + ' (' + starRow(stars) + ')', 'gold');
    } else {
      toast('😕 Wrong order — paid ' + fmt(money) + ' only', 'bad');
    }

    if (recipe && state.recipes.indexOf(recipe.id) < 0) {
      state.recipes.push(recipe.id);
      state.dayRecipesFound++;
      Audio.victory();
      sdkHappytime();
      window.setTimeout(function () {
        toast('🎖️ New secret recipe: ' + recipe.name + '  (+' + fmt(recipe.bonus) + ' bonus)', 'pink');
        renderRecipes();
      }, TUNE.RECIPE_TOAST_MS);
    }

    saveNow();
    refreshHud();
    renderRecipes();

    game.order = null;
    renderOrderCard();

    if (state.dayOrders > 0 && state.dayOrders % 3 === 0) showMidgameAd();

    /* Hand off to the next customer after a short beat — tracked with a real
       timer handle so pause / day-end can cancel a pending swap. */
    scheduleNext(TUNE.NEXT_CUST_MS);
  }

  var nextTimer = null;
  function scheduleNext(ms) {
    if (nextTimer) window.clearTimeout(nextTimer);
    nextTimer = window.setTimeout(function () {
      nextTimer = null;
      /* Defer while a modal/ad pause is active so customers never appear
         underneath a video ad or shop sheet. */
      if (game.paused || rewardedAdPending || midgameAdPending) {
        scheduleNext(200);
        return;
      }
      if (game.phase === 'folding' || game.phase === 'finishing') game.phase = 'cooking';
      nextCustomer();
    }, ms);
  }

  function starRow(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  function customerGaveUp() {
    if (!game.order) return;
    var order = game.order;
    state.dayLost++;
    state.dayOrders++;
    toast('💨 ' + order.cust.n + ' walked away…', 'bad');
    Audio.deny();
    saveNow();
    refreshHud();
    game.order = null;
    renderOrderCard();
    resetPan();
    scheduleNext(TUNE.GAVEUP_MS);
  }

  function closeDay() {
    game.phase = 'locked';
    game.order = null;
    applyShelfStage(true);
    renderOrderCard();
    Audio.stopSizzle();
    sdkGameplayStop();
    gameplayRunning = false;
    /* Midgame is offered before the receipt modal opens so the ad can start
       while the day summary is being read; cooldown + pending flags still
       prevent stacking with a rewarded ad. */
    showMidgameAd();

    var avg = state.dayServed > 0 ? state.dayStars / state.dayServed : 0;
    if (avg >= 4.6) sdkHappytime();
    state.bestRevenue = Math.max(state.bestRevenue, state.dayRevenue);
    saveNow();
    renderReceipt(avg);
    openModal('modal-receipt');
  }

  function renderReceipt(avg) {
    var stars = clamp(Math.round(avg), 0, 5);
    var quote;
    if (avg >= 4.6) quote = pick(QUOTES_5);
    else if (avg >= 3.6) quote = pick(QUOTES_4);
    else if (avg >= 2.4) quote = pick(QUOTES_3);
    else quote = pick(QUOTES_1);
    var starStr = starRow(stars);

    $('receipt-body').innerHTML =
      '<h3>CYBER CREPE MASTER</h3>' +
      '<div class="r-sub">NEON ALLEY STALL · DAY ' + state.day + '</div>' +
      '<div class="r-line"><span>Orders completed</span><b>' + state.dayServed + ' / ' + maxOrdersPerDay() + '</b></div>' +
      '<div class="r-line"><span>Customers lost</span><b>' + state.dayLost + '</b></div>' +
      '<div class="r-line"><span>New recipes found</span><b>' + state.dayRecipesFound + '</b></div>' +
      '<div class="r-line"><span>Avg. rating</span><b>' + avg.toFixed(2) + ' / 5.00</b></div>' +
      '<div class="r-dash"></div>' +
      '<div class="r-line"><span>Day revenue</span><b>' + fmt(state.dayRevenue) + '</b></div>' +
      '<div class="r-line"><span>All-time best day</span><b>' + fmt(state.bestRevenue) + '</b></div>' +
      '<div class="r-total"><span>TOTAL CASH</span><span>' + fmt(state.cash) + '</span></div>' +
      '<div class="r-stars">' + starStr + '</div>' +
      '<div class="r-quote">"' + quote + '"</div>';

    $('receipt-double-amt').textContent = Math.round(state.dayRevenue).toLocaleString('en-US');
    /* Never leave a payable ad CTA enabled when ads are proven off. */
    $('btn-ad-double').disabled =
      (state.dayRevenue <= 0 || state.dayDoubled || (CG_ON_PLATFORM && adsUnavailable));
  }

  function startDay() {
    /* A session restart on the same day keeps the day's tally: resetting it here
       would resurrect the refresh-scumming bug the save fields exist to fix. */
    saveNow();
    refreshHud();
    game.started = true;
    if (!game.paused) {
      sdkGameplayStart();
      gameplayRunning = true;
    }
    Audio.startBgm();
    nextCustomer();
  }

  /* ===========================================================================
   * 8b. FIRST-TIME ONBOARDING
   * ======================================================================== */
  var TUT_KEY = 'cyber_crepe_tutorial_v1';
  var TUT_STEPS = [
    { icon: '🫓', title: 'Spread the Batter', text: 'Press &amp; circle the scraper on the griddle to spread the batter evenly.' },
    { icon: '🥚', title: 'Add Toppings', text: 'Tap ingredients on the shelf to add <b>egg, scallion &amp; sesame</b> — follow the order card.' },
    { icon: '🍳', title: 'Flip &amp; Serve', text: 'Hit <b>[Flip the Base]</b>, add sauce, fold, then serve to the customer!' }
  ];
  var tutStep = 0;

  function maybeShowTutorial() {
    try { if (window.localStorage.getItem(TUT_KEY)) return; } catch (e) { return; }
    tutStep = 0;
    renderTut();
    $('overlay-tutorial').classList.remove('hide');
    pauseGameplay('tutorial');
  }

  function renderTut() {
    var s = TUT_STEPS[tutStep];
    $('tut-icon').textContent = s.icon;
    $('tut-title').textContent = s.title;
    $('tut-text').innerHTML = s.text;
    var dots = document.querySelectorAll('.tut-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === tutStep);
    $('tut-next').textContent = tutStep >= TUT_STEPS.length - 1 ? 'Got it!' : 'Next';
  }

  function closeTut() {
    $('overlay-tutorial').classList.add('hide');
    try { window.localStorage.setItem(TUT_KEY, '1'); } catch (e) {}
    resumeGameplay('tutorial');
  }

  /* ===========================================================================
   * 8. UI
   * ======================================================================== */
  var hintTimer = null;
  var patienceTone = '';
  var lastHintText = null, lastHintCls = null;
  function flashHint(text, cls) {
    var el = $('hint-bar');
    lastHintText = text; lastHintCls = cls || '';
    el.textContent = text;
    el.className = cls || '';
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(updateHint, 2200);
  }

  function updateHint() {
    var el = $('hint-bar');
    var text, cls = '';
    if (game.phase === 'folding' || game.phase === 'finishing') { text = '📦 Folding into the kraft bag…'; }
    else if (game.phase === 'flipping') { text = '↺ Flipping — Maillard crust forming…'; }
    else if (!game.order) { text = '🕐 Waiting for the next customer…'; }
    else if (!game.batterDone) {
      if (game.batterProgress >= 1) {
        text = 'Keep swirling right out to the rim — the crepe is still too small';
        cls = 'warn';
      } else {
        var laps = (game.batterProgress * SWIRL_LAPS);
        text = 'Hold & swirl the scraper to spread the crepe first!  ·  ' +
          laps.toFixed(1) + ' / ' + SWIRL_LAPS + ' laps';
      }
    } else if (!game.flipped) {
      text = 'Add egg, scallion & sesame, then hit [Flip the Base]';
      cls = 'good';
    } else {
      var missing = neededKeys().filter(function (k) { return !game.toppings[k]; });
      var actualKeys = Object.keys(game.toppings);
      var eggOk = game.order.free || game.eggs.length === game.order.eggs;
      var toppingOk = game.order.free || sameSet(game.order.set, actualKeys);
      if (missing.length || !eggOk || !toppingOk) {
        text = 'Brush sauce & load toppings, then hit [Fold & Serve]!';
        cls = 'warn';
      } else {
        text = 'Brush sauce & load toppings, then hit [Fold & Serve]!  ·  ✅ Order looks right';
        cls = 'good';
      }
    }
    /* Dirty check — textContent assignment forces layout, so skip no-ops. */
    if (text === lastHintText && cls === lastHintCls) return;
    lastHintText = text; lastHintCls = cls;
    el.textContent = text;
    el.className = cls;
  }

  function neededKeys() {
    if (!game.order || game.order.free) return [];
    return game.order.set;
  }

  function refreshHud() {
    $('hud-day').textContent = 'Day ' + state.day;
    $('hud-cash').textContent = fmt(state.cash);
    $('hud-orders').textContent = 'Orders ' + Math.min(state.dayOrders, maxOrdersPerDay()) + '/' + maxOrdersPerDay();
    $('btn-recipes').textContent = '🎖️ Recipes (' + state.recipes.length + '/' + RECIPES.length + ')';
  }

  function updateButtons() {
    $('btn-flip').disabled = !canFlip();
    $('btn-serve').disabled = !canServe();
    updateHint();
  }

  /* Cached ing-card lookup — the DOM never changes after boot, so five separate
     querySelectorAll walks collapse into one boot-time Map read. */
  var ingCardMap = null;
  function getIngCard(key) {
    if (!ingCardMap) {
      ingCardMap = new Map();
      var nodes = document.querySelectorAll('.ing-card');
      for (var i = 0; i < nodes.length; i++) {
        var k = nodes[i].getAttribute('data-ing');
        if (k) ingCardMap.set(k, nodes[i]);
      }
    }
    return ingCardMap.get(key) || null;
  }
  function eachIngCard(fn) {
    if (!ingCardMap) getIngCard(''); /* force build */
    ingCardMap.forEach(function (node, key) { fn(node, key); });
  }

  function refreshShelfMarks() {
    eachIngCard(function (node, k) {
      var on = (k === 'egg') ? game.eggs.length > 0 : !!game.toppings[k];
      node.classList.toggle('added', on);
    });
    updateReqMarks();
  }

  function buildShelves() {
    eachIngCard(function (node, k) {
      var ing = INGREDIENTS[k];
      if (!ing) return;
      node.querySelector('.ing-price').textContent = '+$' + ing.price;
      refreshStockBadge(node, k);
    });
  }

  /* Only the consumables carry a badge. Base larder items are bottomless, so
     their badge element does not exist at all. */
  function refreshStockBadge(node, key) {
    if (!node || !INGREDIENTS[key] || !INGREDIENTS[key].isSpecial) return;
    var n = state.stock[key] || 0;
    var badge = node.querySelector('.stock-badge');
    if (badge) {
      badge.textContent = n > 0 ? ('x' + n) : 'OUT';
      badge.classList.toggle('out', n <= 0);
    }
    node.classList.toggle('out-of-stock', n <= 0);
  }

  function refreshAllShelves() {
    eachIngCard(function (node, k) {
      if (k) refreshStockBadge(node, k);
    });
  }

  /* Which ingredients each side shelf offers in each cooking stage. A card that
     is not listed stays in its slot as a dark standby tile — the tray always
     reads as a full condiment box instead of collapsing into empty holes.
     spread : nothing is usable yet, the whole box sits dimmed
     front  : raw toppings only — the sauce counter sits dimmed
     back   : cooked fillings on the left, sauces & extras all live on the right  */
  /* Built from INGREDIENTS rather than hand-listed: every tile is active in
     exactly the stage its `stageType` names, so the tray and the ingredient
     table can never disagree. `spread` stays empty — nothing goes on the crepe
     until the batter is done. */
  var STAGE_SHELF = (function () {
    var cfg = { spread: { left: [], right: [] }, front: { left: [], right: [] }, back: { left: [], right: [] } };
    ING_KEYS.forEach(function (k) {
      var ing = INGREDIENTS[k];
      cfg[ing.stageType][ing.shelf].push(k);
    });
    return cfg;
  })();

  var SHELF_TITLE = {
    left: { spread: '🧺 Fresh Shelf', front: '🥚 Egg & Greens', back: '🥩 Meat & Veggies' },
    right: '🥫 Sauces'
  };

  /* The current cooking stage, derived purely from the pan state so the UI can
     never drift out of sync with what is actually on the griddle. */
  function shelfStage() {
    if (!game.order || !game.batterDone) return 'spread';
    return game.flipped ? 'back' : 'front';
  }

  function applyShelfStage(force) {
    var st = shelfStage();
    if (!force && st === game.shelfStage) return;
    game.shelfStage = st;

    var cfg = STAGE_SHELF[st];
    eachIngCard(function (node, k) {
      var ing = INGREDIENTS[k];
      if (!ing) return;
      /* off-stage cards keep their slot, just dimmed and inert */
      node.classList.toggle('stage-disabled', cfg[ing.shelf].indexOf(k) < 0);
    });

    var lt = $('shelf-title-left');
    if (lt) lt.textContent = SHELF_TITLE.left[st];
    var rt = $('shelf-title-right');
    if (rt) rt.textContent = SHELF_TITLE.right;
  }

  function addIngredient(key) {
    var ing = INGREDIENTS[key];
    if (!ing) return;
    /* Taking an ingredient back off the griddle is always allowed — even at zero
       stock — otherwise a player could strand a topping on the crepe. The pantry
       is only consulted when actually laying something down, below. */
    if (game.toppings[key]) { removeIngredient(key); return; }
    if (ing.isSpecial && (state.stock[key] || 0) <= 0) {
      Audio.deny();
      toast(adsUsable() ? '⚠️ Out of stock! Restock in Shop or watch Ad!' : '⚠️ Out of stock! Restock in Shop.', 'bad');
      return;
    }
    if (game.phase !== 'cooking') {
      Audio.deny();
      flashHint('⚠️ Finish the current action first', 'warn');
      return;
    }
    if (!game.batterDone) {
      Audio.deny();
      flashHint('⚠️ Swirl the scraper two full laps to spread the base first', 'warn');
      return;
    }
    /* Stage guard: a tile can only be laid down in the half of the cook its
       `stageType` names. The tray dims the wrong tiles, but this stops a stray
       call — or a granted request on a stale tile — from punching through. */
    if (ing.stageType !== (game.flipped ? 'back' : 'front')) {
      Audio.deny();
      return;
    }

    if (key === 'egg') {
      if (game.eggs.length >= MAX_EGGS) {
        Audio.deny();
        flashHint('⚠️ The griddle fits a maximum of 4 eggs', 'warn');
        return;
      }
      var a = rand(0, TAU), d = Math.sqrt(Math.random()) * 0.5;
      game.eggs.push({
        x: Math.cos(a) * d * MAX_R, y: Math.sin(a) * d * MAX_R,
        r: rand(24, 31), spread: 0, seed: rand(0, 6.28)
      });
      Audio.crackEgg();
      var last = game.eggs[game.eggs.length - 1];
      for (var s = 0; s < 10; s++) spawnSteam(CX + last.x, CY + last.y, 0.7);
      pulseIng('egg');
      refreshShelfMarks();
      updateButtons();
      return;
    }

    game.toppings[key] = true;
    game.art[key] = makeArt(key);
    if (ing.isSpecial) {
      state.stock[key] = (state.stock[key] || 0) - 1;
      saveDebounced();
      refreshStockBadge(getIngCard(key), key);
    }
    if (key === 'sweetSauce' || key === 'chiliSauce') {
      game.sauces[key] = 1;
      Audio.spreadScrape();
    } else {
      Audio.crackEgg();
      for (var c = 0; c < 6; c++) spawnCrumb(CX + rand(-60, 60), CY + rand(-50, 50), 'rgba(255,220,160,.8)');
    }
    pulseIng(key);
    refreshShelfMarks();
    updateButtons();
  }

  /* Peeling a topping back off the crepe returns the portion to the pantry, so
     a mis-tap costs nothing. There is no exploit in the symmetry: add and
     remove are a matched pair. */
  function removeIngredient(key) {
    delete game.toppings[key];
    delete game.art[key];
    delete game.sauces[key];
    var ing = INGREDIENTS[key];
    if (ing && ing.isSpecial) {
      state.stock[key] = (state.stock[key] || 0) + 1;
      saveDebounced();
      refreshStockBadge(getIngCard(key), key);
    }
    Audio.spreadScrape();
    refreshShelfMarks();
    updateButtons();
  }

  function pulseIng(key) {
    var node = getIngCard(key);
    if (!node) return;
    node.classList.remove('pulse');
    void node.offsetWidth;
    node.classList.add('pulse');
  }

  function renderOrderCard() {
    var card = $('order-card');
    var order = game.order;
    if (!order) {
      card.classList.add('empty');
      $('cust-avatar').textContent = '🕐';
      $('cust-name').textContent = 'Street is quiet…';
      $('cust-line').textContent = 'Waiting for the next customer.';
      $('cust-pay').textContent = '$0';
      $('req-row').innerHTML = '';
      $('patience-fill').style.width = '100%';
      return;
    }
    card.classList.remove('empty');
    $('cust-avatar').textContent = order.cust.a;
    if (order.free) {
      $('cust-name').innerHTML = order.cust.n + ' <span class="mystery">🎲 CHEF\'S SPECIAL</span>';
      $('cust-line').textContent = '"Surprise me, chef — anything fresh off the griddle!"';
      $('cust-pay').textContent = '???';
    } else {
      $('cust-name').innerHTML = order.cust.n + ' <span class="mystery">🎲 MYSTERY ORDER</span>';
      /* Defensive: even if a future recipe-table edit empties the pool, a
         missing recipe must not throw inside the order card renderer. */
      $('cust-line').textContent = order.recipe ? '"' + order.recipe.line + '"' : '"Surprise me, chef."';
      $('cust-pay').textContent = fmt(order.value);
    }
    var html = '';
    if (order.free) {
      html += '<span class="req"><span class="rq-ico">🎲</span>Free style · 6+ toppings + double sauce = 👑</span>';
    } else {
      html += '<span class="req" data-req="__egg"><span class="rq-ico">🥚</span>' +
              (order.eggs === 0 ? 'No egg' : '×' + order.eggs) + '</span>';
      for (var i = 0; i < order.set.length; i++) {
        var k = order.set[i];
        html += '<span class="req" data-req="' + k + '"><span class="rq-ico">' + INGREDIENTS[k].icon + '</span>' +
                INGREDIENTS[k].name + '</span>';
      }
    }
    $('req-row').innerHTML = html;
    updateReqMarks();
    updatePatienceBar();
  }

  function updateReqMarks() {
    var order = game.order;
    if (!order || order.free) return;
    var chips = document.querySelectorAll('#req-row .req');
    for (var i = 0; i < chips.length; i++) {
      var k = chips[i].getAttribute('data-req');
      var ok = (k === '__egg') ? (game.eggs.length === order.eggs) : !!game.toppings[k];
      chips[i].classList.toggle('done', ok);
    }
  }

  function updatePatienceBar() {
    var order = game.order;
    var fill = $('patience-fill');
    if (!order) {
      if (fill.style.width !== '100%') fill.style.width = '100%';
      if (patienceTone !== 'full') {
        fill.style.background = 'linear-gradient(90deg,#3ddc84,#8ef5b0)';
        patienceTone = 'full';
      }
      return;
    }
    var r = clamp(order.patience / order.patienceMax, 0, 1);
    var width = (Math.round(r * 1000) / 10) + '%';
    if (fill.style.width !== width) fill.style.width = width;
    var tone = r > 0.55 ? 'high' : (r > 0.28 ? 'mid' : 'low');
    if (tone === patienceTone) return;
    patienceTone = tone;
    if (tone === 'high') fill.style.background = 'linear-gradient(90deg,#3ddc84,#8ef5b0)';
    else if (tone === 'mid') fill.style.background = 'linear-gradient(90deg,#ffb020,#ffd97a)';
    else fill.style.background = 'linear-gradient(90deg,#ff3b3b,#ff8080)';
  }

  /* Shop body is only rebuilt when something relevant actually changed —
     opening the modal reuses the previous HTML otherwise. */
  var shopDirty = true;
  function markShopDirty() { shopDirty = true; }
  function buildShop(force) {
    if (!force && !shopDirty) {
      var cashEl = $('shop-cash');
      if (cashEl) cashEl.textContent = fmt(state.cash);
      return;
    }
    shopDirty = false;
    var cashEl = $('shop-cash');
    if (cashEl) cashEl.textContent = fmt(state.cash);

    var html = '<div class="shop-sec">📦 Wholesale Restock</div>';
    SPECIAL_KEYS.forEach(function (k) {
      var ing = INGREDIENTS[k];
      var n = state.stock[k] || 0;
      var canPay = state.cash >= ing.shopPrice;
      html += '<div class="shop-item">' +
        '<div class="si-ico">' + ing.icon + '</div>' +
        '<div class="si-info"><div class="si-name">' + ing.name + '</div>' +
        '<div class="si-desc">' + (ing.shopDesc || '') + ' · <b>+$' + ing.price + ' profit</b></div>' +
        '<div class="si-stock' + (n > 0 ? '' : ' none') + '">In Stock: ' + n + '</div></div>' +
        '<div class="si-btns">' +
          '<button class="btn tiny gold" data-restock="' + k + '"' + (canPay ? '' : ' disabled') + '>Restock +' +
            ing.batch + ' ($' + ing.shopPrice + ')</button>' +
          (adsUsable()
            ? '<button class="btn tiny pink" data-adstock="' + k + '">📺 Free Stock +' + ing.batch + '</button>'
            : '') +
        '</div>' +
        '</div>';
    });
    html += '<div class="shop-sec">⚙️ Stall Upgrades</div>';
    UPGRADE_KEYS.forEach(function (k) {
      var u = UPGRADES[k];
      html += '<div class="shop-item">' +
        '<div class="si-ico">' + u.icon + '</div>' +
        '<div class="si-info"><div class="si-name">' + u.name + '</div>' +
        '<div class="si-desc">' + u.desc + '</div></div>' +
        (state.upgrades[k]
          ? '<div class="si-owned">✔ INSTALLED</div>'
          : '<div class="si-btns"><button class="btn tiny gold" data-buyup="' + k + '">Buy $' + u.price + '</button></div>') +
        '</div>';
    });
    $('shop-list').innerHTML = html;
  }

  /* Buy one wholesale batch. The batch size lives on the ingredient, so a
     luxury item can restock 3 at a time while everything else gets 5. */
  function restockIngredient(key) {
    var ing = INGREDIENTS[key];
    if (!ing || !ing.isSpecial) return;
    if (state.cash < ing.shopPrice) { Audio.deny(); toast('💸 Not enough cash for ' + ing.name, 'bad'); return; }
    state.cash -= ing.shopPrice;
    state.stock[key] = (state.stock[key] || 0) + ing.batch;
    Audio.coin();
    toast('📦 Restocked ' + ing.batch + '× ' + ing.name + '  (In stock: ' + state.stock[key] + ')', 'gold');
    saveDebounced(); refreshHud(); markShopDirty(); buildShop(); refreshAllShelves();
  }

  function buyUpgrade(key) {
    var u = UPGRADES[key];
    if (!u || state.upgrades[key]) return;
    if (state.cash < u.price) { Audio.deny(); toast('💸 Not enough cash for ' + u.name, 'bad'); return; }
    state.cash -= u.price;
    state.upgrades[key] = true;
    Audio.victory();
    toast('🛠️ Installed ' + u.name + '!', 'gold');
    saveDebounced(); refreshHud(); markShopDirty(); buildShop();
  }

  function adRestockIngredient(key) {
    var ing = INGREDIENTS[key];
    if (!ing || !ing.isSpecial) return;
    if (CG_ON_PLATFORM && adsUnavailable) {
      toast('⚠️ Ads are unavailable — restock with cash instead.', 'bad');
      return;
    }
    showRewardedAd(function () {
      state.stock[key] = (state.stock[key] || 0) + ing.batch;
      Audio.victory();
      toast('📺 Free delivery: ' + ing.batch + '× ' + ing.name + '  (In stock: ' + state.stock[key] + ')', 'gold');
      saveDebounced(); refreshHud(); markShopDirty(); buildShop(); refreshAllShelves();
    }, function (message) {
      toast('⚠️ ' + message, 'bad');
    });
  }

  function renderRecipes() {
    var html = '';
    for (var i = 0; i < RECIPES.length; i++) {
      var r = RECIPES[i];
      var found = state.recipes.indexOf(r.id) >= 0;
      html += '<button class="rec-cell ' + (found ? 'found' : 'locked') + '" data-rec="' + r.id + '">' +
        '<span class="rc-ico">' + (found ? r.icon : '❔') + '</span>' +
        '<span class="rc-name">' + (found ? r.name : '???') + '</span>' +
        '<span class="rc-bonus">+' + fmt(r.bonus) + '</span>' +
        '</button>';
    }
    $('rec-grid').innerHTML = html;
    $('rec-fill').style.width = (state.recipes.length / RECIPES.length * 100) + '%';
    $('rec-count').textContent = state.recipes.length + ' / ' + RECIPES.length;
    $('btn-recipes').textContent = '🎖️ Recipes (' + state.recipes.length + '/' + RECIPES.length + ')';
  }

  function showClue(id) {
    var r = RECIPE_MAP[id];
    if (!r) return;
    var found = state.recipes.indexOf(id) >= 0;
    var html = '<div class="cl-title">' + (found ? r.icon + ' ' + r.name : '❔ Undiscovered Recipe') + '</div>' +
      '<div>' + r.clue + '</div>' +
      '<div class="cl-row">' +
        '<span class="cl-tag g">Recipe bonus +' + fmt(r.bonus) + '</span>' +
        '<span class="cl-tag">Eggs: ' + (r.special ? 'exactly 2' : (r.eggs === 0 ? 'none' : r.eggs)) + '</span>' +
        '<span class="cl-tag">' + (found ? '★ COLLECTED' : '🔍 NOT COLLECTED') + '</span>' +
      '</div>';
    if (r.set.length) {
      html += '<div class="cl-row">';
      r.set.forEach(function (k) {
        html += '<span class="cl-tag">' + INGREDIENTS[k].icon + ' ' + INGREDIENTS[k].name + '</span>';
      });
      html += '</div>';
    }
    $('clue-body').innerHTML = html;
    openModal('modal-clue');
  }

  function openModal(id) {
    var m = $(id);
    if (!m) return;
    if (id === 'modal-shop') buildShop();
    if (id === 'modal-recipes') renderRecipes();
    m.classList.add('show');
    /* Freeze the sim while the player is in a menu — patience used to keep
       draining, so customers walked away while you were shopping. */
    pauseGameplay('modal');
    Audio.stopSizzle();
    var sheet = m.querySelector('.sheet');
    if (sheet && sheet.focus) { try { sheet.focus(); } catch (e) {} }
  }
  function closeModal(id) {
    var m = $(id);
    if (m) m.classList.remove('show');
    if (!document.querySelector('.modal.show')) resumeGameplay('modal');
  }
  function toast(text, cls) {
    var layer = $('toast-layer');
    var el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = text;
    layer.appendChild(el);
    window.setTimeout(function () {
      el.classList.add('out');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
    while (layer.children.length > 5) layer.removeChild(layer.firstChild);
  }

/* ===========================================================================
   * 9. MAIN LOOP
   * ======================================================================== */
  var lastT = 0;

  function loop(ts) {
    window.requestAnimationFrame(loop);
    if (!lastT) lastT = ts;
    /* Clamp both ends: a stale or backwards timestamp must never rewind physics
       (a negative dt would shrink particle radii below zero and break rendering). */
    var dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000));
    lastT = ts;
    game.time += dt;

    /* Before "Open the Stall" the loop only re-requests the next frame — no
       wasted GPU/CPU behind the start overlay's backdrop blur. */
    if (!game.started) return;

    /* Paused (modal / ad / hidden tab): still paint the last state so closing
       a modal doesn't flash, but freeze every gameplay system. */
    if (game.paused) {
      render();
      return;
    }

    panRot += dt * (game.coverage > 0.05 ? 0.28 : 0.10);
    updateSpread(dt);

    if (game.phase === 'flipping') {
      game.flipT += dt / (TUNE.FLIP_MS / 1000);
      if (game.flipT >= 1) {
        game.flipT = 0;
        game.flipped = true;
        game.phase = 'cooking';
        applyShelfStage(true);
        updateButtons();
      }
    }

    if (game.phase === 'folding') {
      game.foldT = Math.min(1, game.foldT + dt / (TUNE.FOLD_MS / 1000));
      /* Sole clock for serve completion — a setTimeout could fire while frames
         were still catching up and cut the payout animation short. Flip to
         'finishing' first so settle logic runs exactly once, not every frame. */
      if (game.foldT >= 1) {
        game.phase = 'finishing';
        finishServe();
      }
    }

    if (game.coverage > 0.2 && game.phase === 'cooking') {
      game.searTimer += dt;
      if (game.searTimer > TUNE.SEAR_INTERVAL && game.sear.length < TUNE.SEAR_MAX) {
        game.searTimer = 0;
        game.sear.push({
          a: rand(0, TAU),
          d: Math.sqrt(Math.random()) * 0.85,
          r: rand(4, 13),
          rot: rand(0, TAU),
          alpha: rand(0.06, 0.22)
        });
      }
    }

    if (game.coverage > 0.1 && (game.phase === 'cooking' || game.phase === 'flipping')) {
      var rate = game.coverage * (game.flipped ? 22 : 14);
      if (Math.random() < rate * dt) {
        var sa = rand(0, TAU), sd = Math.sqrt(Math.random()) * game.coverage * MAX_R * 0.95;
        spawnSteam(CX + Math.cos(sa) * sd, CY + Math.sin(sa) * sd, rand(0.5, 1.2));
      }
      if (Math.random() < 6 * dt) {
        var pa = rand(0, TAU), pd = Math.sqrt(Math.random()) * game.coverage * MAX_R * 0.9;
        spawnSpark(CX + Math.cos(pa) * pd, CY + Math.sin(pa) * pd);
      }
    }

    updateParticles(dt);

    if (game.order && game.phase === 'cooking') {
      game.order.patience -= dt;
      updatePatienceBar();
      if (game.order.patience <= 0) customerGaveUp();
    }

    render();
  }

/* ===========================================================================
   * 10. EVENT BINDING + BOOT
   * ======================================================================== */
  function fitViewport() {
    var vp = $('viewport');
    var s = Math.min(window.innerWidth / 1200, window.innerHeight / 675);
    vp.style.transform = 'scale(' + s + ')';
  }

  function fitCanvas() {
    var wrap = $('canvas-wrap');
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    var s = Math.min(w / W, h / H);
    var cssW = Math.floor(W * s);
    var cssH = Math.floor(H * s);
    cv.style.width = cssW + 'px';
    cv.style.height = cssH + 'px';
    /* Back the CSS size with real device pixels (capped at 2× so fill-rate
       stays sane) — the old fixed 640×360 bitmap looked soft on every
       high-DPI / large display. */
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.max(1, Math.floor(cssW * dpr));
    var bh = Math.max(1, Math.floor(cssH * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
      /* Keep the 640×360 logical coordinate system; map it onto the bitmap. */
      ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
      /* Gradient / offscreen caches are resolution-independent draws — only
         the griddle blit size depends on transform, so no rebuild needed. */
      bgGrad = null;
    }
  }

  /* --- UI binding, split by concern so each handler block stays short ----- */
  function bindShelf() {
    eachIngCard(function (node) {
      node.addEventListener('click', function () { addIngredient(node.getAttribute('data-ing')); });
    });
  }

  function bindGameActions() {
    $('btn-flip').addEventListener('click', doFlip);
    $('btn-serve').addEventListener('click', doServe);
  }

  function bindModals() {
    $('btn-shop').addEventListener('click', function () { Audio.unlock(); openModal('modal-shop'); });
    $('btn-recipes').addEventListener('click', function () { Audio.unlock(); openModal('modal-recipes'); });

    var closers = document.querySelectorAll('[data-close]');
    for (var c = 0; c < closers.length; c++) {
      (function (btn) {
        btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
      })(closers[c]);
    }

    $('rec-grid').addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== $('rec-grid') && !t.getAttribute('data-rec')) t = t.parentNode;
      if (t && t.getAttribute && t.getAttribute('data-rec')) showClue(t.getAttribute('data-rec'));
    });

    $('shop-list').addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var buy = t.getAttribute('data-restock');
      var ad = t.getAttribute('data-adstock');
      var up = t.getAttribute('data-buyup');
      if (buy) restockIngredient(buy);
      else if (ad) adRestockIngredient(ad);
      else if (up) buyUpgrade(up);
    });
  }

  function bindAudioToggle() {
    $('btn-bgm').addEventListener('click', function () {
      Audio.unlock();
      state.muted = !state.muted;
      Audio.setMuted(state.muted);
      if (state.muted) Audio.stopBgm(); else Audio.startBgm();
      $('btn-bgm').textContent = state.muted ? '🔇 Muted' : '🎵 BGM';
      saveDebounced();
    });
  }

  function bindAds() {
    $('btn-ad-cash').addEventListener('click', function () {
      Audio.unlock();
      if (CG_ON_PLATFORM && adsUnavailable) {
        toast('⚠️ Ads are unavailable right now.', 'bad');
        return;
      }
      showRewardedAd(function () {
        state.cash += TUNE.AD_CASH;
        Audio.coin();
        toast('📺 Thanks! +' + fmt(TUNE.AD_CASH) + ' added to your cash box', 'gold');
        saveDebounced(); refreshHud(); markShopDirty(); buildShop();
      }, function (message) {
        toast('⚠️ ' + message, 'bad');
      });
    });

    $('btn-ad-double').addEventListener('click', function () {
      Audio.unlock();
      var amt = Math.round(state.dayRevenue);
      /* The latch is the authority, not the disabled attribute: a sandboxed or
         script-driven click must not pay the same day's revenue out twice. */
      if (amt <= 0 || state.dayDoubled || rewardedAdPending || midgameAdPending) return;
      if (CG_ON_PLATFORM && adsUnavailable) {
        toast('⚠️ Ads are unavailable right now.', 'bad');
        return;
      }
      showRewardedAd(function () {
        if (state.dayDoubled) return;
        state.cash += amt;
        /* Latched so a refresh cannot replay the same day's doubling. */
        state.dayDoubled = true;
        Audio.coin();
        toast('📺 Revenue doubled! +' + fmt(amt), 'gold');
        saveNow(); refreshHud();
        renderReceipt(state.dayServed > 0 ? state.dayStars / state.dayServed : 0);
        $('btn-ad-double').disabled = true;
      }, function (message) {
        toast('⚠️ ' + message, 'bad');
      });
    });
  }

  function bindLifecycle() {
    $('btn-next-day').addEventListener('click', function () {
      Audio.unlock();
      closeModal('modal-receipt');
      state.day += 1;
      state.dayOrders = 0;
      state.dayRevenue = 0;
      state.dayServed = 0;
      state.dayLost = 0;
      state.dayStars = 0;
      state.dayRecipesFound = 0;
      state.dayDoubled = false;
      saveNow();
      startDay();
      refreshHud();
    });

    /* Auto-open the stall on a cold start so new players land in gameplay
       after at most the single Start click (audio unlock + Full Launch rule).
       The overlay is reduced to that one action; returning players with a
       finished day still get their receipt via the same path. */
    $('btn-start').addEventListener('click', function () {
      Audio.unlock();
      $('overlay-start').classList.add('hide');
      game.started = true;
      lastT = 0;
      Audio.setMuted(state.muted);
      /* Refreshed on an already-finished day: re-open that day's receipt rather
         than handing the player a brand-new batch of customers. The day tally
         is never cleared here — only the next-day button does that. */
      if (state.dayOrders >= maxOrdersPerDay()) { closeDay(); return; }
      if (!state.muted) Audio.startBgm();
      startDay();
      maybeShowTutorial();
    });

    function onViewportChange() { fitViewport(); fitCanvas(); }
    window.addEventListener('resize', onViewportChange);
    /* Mobile URL-bar show/hide fires visualViewport, not window.resize. */
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
    }

    window.addEventListener('keydown', function (ev) {
      /* Escape is intentionally NOT bound: on the web it exits fullscreen and
         CrazyGames quality guidelines list it as a restricted key. Close
         sheets with their ✕ buttons instead. */
      var target = ev.target;
      var interactive = target && target.closest && target.closest('button, input, select, textarea, [contenteditable="true"]');
      if (interactive || !$('overlay-start').classList.contains('hide') || document.querySelector('.modal.show') || !$('overlay-tutorial').classList.contains('hide')) return;
      if (ev.code === 'Space') { ev.preventDefault(); doFlip(); }
      else if (ev.code === 'Enter') { ev.preventDefault(); doServe(); }
    });

    /* Tab hidden / shown: stop gameplay reporting, halt audio, flush save. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        endDrag();
        pauseGameplay('hidden');
        Audio.stopSizzle();
        Audio.suspend();
        saveNow();
      } else {
        Audio.resumeCtx();
        lastT = 0;
        resumeGameplay('visible');
      }
    });
    window.addEventListener('pagehide', function () { saveNow(); });
    window.addEventListener('blur', function () {
      endDrag();
      pauseGameplay('blur');
      sdkGameplayStop();
      gameplayRunning = false;
    });
    window.addEventListener('focus', function () {
      resumeGameplay('focus');
    });
  }

  function bindUi() {
    bindShelf();
    bindGameActions();
    bindModals();
    bindAudioToggle();
    bindAds();
    bindLifecycle();
    $('tut-skip').addEventListener('click', closeTut);
    $('tut-next').addEventListener('click', function () {
      if (tutStep >= TUT_STEPS.length - 1) { closeTut(); return; }
      tutStep++;
      renderTut();
    });
    /* Keep the ad-reward labels as a single source of truth (TUNE.AD_CASH). */
    var adLabel = $('ad-cash-label');
    if (adLabel) adLabel.textContent = 'Watch a short ad, get +' + fmt(TUNE.AD_CASH);
    var adBtn = $('btn-ad-cash');
    if (adBtn) adBtn.textContent = '📺 Watch Ad (+' + fmt(TUNE.AD_CASH) + ')';
  }

  function boot() {
    loadSave();
    Audio.setMuted(state.muted);
    $('btn-bgm').textContent = state.muted ? '🔇 Muted' : '🎵 BGM';
    buildShelves();
    applyShelfStage(true);
    renderRecipes();
    markShopDirty();
    buildShop();
    renderOrderCard();
    refreshHud();
    updateButtons();
    bindCanvas();
    bindUi();
    fitViewport();
    fitCanvas();

    $('recipe-total').textContent = RECIPES.length;
    $('start-stats').textContent =
      'Day ' + state.day + '  ·  Cash ' + fmt(state.cash) + '  ·  Recipes ' +
      state.recipes.length + '/' + RECIPES.length + '  ·  Orders served ' + state.totalServed;

    sdkInit();
    refreshAdCtas();
    window.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
