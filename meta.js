/* ============================================================================
   meta.js — Accounts, economy, collection, campaign, and store.
   Loaded AFTER engine.js (needs DB, cardById, C, buildDeck, shuffle at runtime).
   Pure logic + localStorage only; all DOM lives in meta_ui.js.
   ========================================================================== */
(function () {
  "use strict";

  var PKEY = "mortalis_profiles_v1";

  /* ------------------------------- helpers ------------------------------- */
  function allCards() { return (window.DB && DB.cards) || (window.DEFAULT_DATA && DEFAULT_DATA.cards) || []; }
  function isHero(id) { var c = cardById(id); return !!(c && c.type === "hero"); }
  function heroesByRealmRarity(realm, rarity) {
    return allCards().filter(function (c) { return c.type === "hero" && c.realm === realm && c.rarity === rarity; });
  }
  function eternalOf(realm) { return heroesByRealmRarity(realm, "Eternal")[0] || null; }
  function realmList() {
    return ((window.DB && DB.realms) || (window.DEFAULT_DATA && DEFAULT_DATA.realms) || []).map(function (r) { return r.name; });
  }

  /* =============================== Meta / accounts ====================== */
  var Meta = window.Meta = {
    db: null,

    load: function () {
      if (this.db) return this.db;   // keep a single in-memory copy; save() persists it
      try { var r = localStorage.getItem(PKEY); this.db = r ? JSON.parse(r) : null; } catch (e) { this.db = null; }
      if (!this.db || typeof this.db !== "object") this.db = { profiles: {}, current: null };
      if (!this.db.profiles) this.db.profiles = {};
      return this.db;
    },
    reload: function () { this.db = null; return this.load(); },
    save: function () { try { localStorage.setItem(PKEY, JSON.stringify(this.db)); } catch (e) {} },

    names: function () { this.load(); return Object.keys(this.db.profiles); },
    exists: function (name) { this.load(); return !!this.db.profiles[normName(name)]; },
    current: function () { this.load(); return this.db.current ? this.db.profiles[this.db.current] : null; },

    /* new profile: username + 4-digit PIN (stored plainly — light device gate, not security) */
    create: function (name, pin) {
      this.load();
      name = (name || "").trim();
      var key = normName(name);
      if (!key) return { err: "Enter a username." };
      if (key.length > 20) return { err: "Username too long (20 max)." };
      if (this.db.profiles[key]) return { err: "That username is taken on this device." };
      if (!/^\d{4}$/.test(pin || "")) return { err: "PIN must be exactly 4 digits." };
      this.db.profiles[key] = {
        name: name, pin: pin, createdAt: Date.now(),
        coins: 0, seals: 0,
        collection: {},          // heroId -> count owned
        campaign: { chapter: 1, stages: {}, bosses: {} }, // progress
        decks: [],               // per-profile saved decks
      };
      this.db.current = key;
      grantStarter(this.db.profiles[key]);
      this.save();
      syncDecksFromProfile();
      return { ok: true, profile: this.db.profiles[key] };
    },

    login: function (name, pin) {
      this.load();
      var p = this.db.profiles[normName(name)];
      if (!p) return { err: "No profile with that username." };
      if (p.pin !== pin) return { err: "Wrong PIN." };
      this.db.current = normName(name);
      migrate(p);
      this.save();
      syncDecksFromProfile();
      return { ok: true, profile: p };
    },

    logout: function () { this.load(); this.db.current = null; this.save(); },

    /* ------- economy (operate on the current profile) ------- */
    coins: function () { var p = this.current(); return p ? (p.coins | 0) : 0; },
    seals: function () { var p = this.current(); return p ? (p.seals | 0) : 0; },
    addCoins: function (n) { var p = this.current(); if (!p) return; p.coins = Math.max(0, (p.coins | 0) + n); this.save(); },
    addSeals: function (n) { var p = this.current(); if (!p) return; p.seals = Math.max(0, (p.seals | 0) + n); this.save(); },
    spendCoins: function (n) { var p = this.current(); if (!p || (p.coins | 0) < n) return false; p.coins -= n; this.save(); return true; },
    spendSeals: function (n) { var p = this.current(); if (!p || (p.seals | 0) < n) return false; p.seals -= n; this.save(); return true; },

    /* ------- collection ------- */
    owned: function (id) { var p = this.current(); if (!p) return 0; return (p.collection[id] | 0); },
    grant: function (id, n) {
      var p = this.current(); if (!p) return { newCard: false };
      var before = p.collection[id] | 0;
      var lim = (C().copyLimit || 3);
      var after = Math.min(lim, before + (n || 1));
      p.collection[id] = after;
      this.save();
      return { newCard: before === 0, added: after - before };
    },
    collectionStats: function () {
      var p = this.current(); if (!p) return { owned: 0, total: 0 };
      var heroes = allCards().filter(function (c) { return c.type === "hero" && c.rarity; });
      var owned = heroes.filter(function (c) { return (p.collection[c.id] | 0) > 0; }).length;
      return { owned: owned, total: heroes.length };
    },
  };

  function normName(n) { return (n || "").trim().toLowerCase(); }

  /* starter collection: the three basic realms, Commons + Uncommons only,
     full playset of each so a 40-card deck is buildable from day one. */
  function grantStarter(p) {
    var lim = (C().copyLimit || 3);
    ["Luminar", "Fangrend", "Brightmantle"].forEach(function (realm) {
      ["Common", "Uncommon"].forEach(function (rar) {
        heroesByRealmRarity(realm, rar).forEach(function (c) { p.collection[c.id] = lim; });
      });
    });
  }

  function migrate(p) {
    if (!p.campaign) p.campaign = { chapter: 1, stages: {}, bosses: {} };
    if (!p.collection) p.collection = {};
    if (!p.decks) p.decks = [];
    if (p.coins == null) p.coins = 0;
    if (p.seals == null) p.seals = 0;
  }

  /* --- per-profile decks: bridge the engine's global deck store to the profile.
     The engine keeps decks in localStorage "mortalis_decks_v1"; we snapshot that
     into the active profile so each account has its own decks. --- */
  function syncDecksFromProfile() {
    var p = Meta.current();
    try { localStorage.setItem("mortalis_decks_v1", JSON.stringify((p && p.decks) || [])); } catch (e) {}
  }
  window.__metaSyncDecksToProfile = function (list) {
    var p = Meta.current(); if (!p) return;
    p.decks = Array.isArray(list) ? list : [];
    Meta.save();
  };

  /* =============================== Campaign ============================= */
  // 9 chapters. First three are the starter realms. Ultra-rare reward on every
  // third chapter (3, 6, 9); the rest give a Rare. 3 opponents then a boss.
  var CHAPTER_REALMS = ["Luminar", "Fangrend", "Brightmantle", "Thornveil",
    "Gildharbor", "Karakhorde", "Ankhara", "Noctavein", "Balemaw"];
  var CHAPTER_MOOD = {
    Luminar: { color: "#e9c766", sky: "#2a2f52", tag: "Dawnspire Reaches", blurb: "Radiant training grounds where your order first musters." },
    Fangrend: { color: "#7fb0d6", sky: "#26313d", tag: "The Howling Steppe", blurb: "Storm-wolf packs test your resolve on the open tundra." },
    Brightmantle: { color: "#f0e2b8", sky: "#3a3350", tag: "Cathedral of First Light", blurb: "Zealous clerics bar the road with holy fire." },
    Thornveil: { color: "#8fc45a", sky: "#1f3325", tag: "The Overgrown Ruin", blurb: "Vines and thorn-wardens swallow the old empire's bones." },
    Gildharbor: { color: "#e6a83a", sky: "#2c2413", tag: "The Gilded Docks", blurb: "Coin buys armies here — outlast the merchant tide." },
    Karakhorde: { color: "#d85a30", sky: "#2a1610", tag: "The Thunder Plains", blurb: "Riders and storm strike as one across the horizon." },
    Ankhara: { color: "#e0c060", sky: "#241d0c", tag: "The Silent Necropolis", blurb: "The god-kings do not stay dead. Close fast." },
    Noctavein: { color: "#b47adf", sky: "#1c1226", tag: "Spires Under a Red Moon", blurb: "The crimson court drains all who linger." },
    Balemaw: { color: "#e24b4a", sky: "#2a0d0d", tag: "The Red Gate", blurb: "The Final Bargain waits on a throne of ash." },
  };
  var FOE_NAMES = {
    Luminar: ["Squire of the Watch", "Dawnward Sentinel", "Radiant Champion"],
    Fangrend: ["Pack Outrunner", "Stormfang Reaver", "Alpha of the Howl"],
    Brightmantle: ["Acolyte of Ash", "White-Flame Zealot", "High Inquisitor"],
    Thornveil: ["Bramble Warden", "Vinespeaker Nyx", "Thornguard Captain"],
    Gildharbor: ["Ledger Enforcer", "Harbor Broker", "Vaultkeeper Sol"],
    Karakhorde: ["Horse-lord Outrider", "Bow-rank Sergeant", "Blood Standard Bearer"],
    Ankhara: ["Tomb Vizier", "River Embalmer", "Sunspear Guard"],
    Noctavein: ["Nightblade Consort", "Blood Chancellor", "Moonveil Reaper"],
    Balemaw: ["Debt Collector", "Pact Warden", "The Broker of Souls"],
  };

  function chapterData(i) { // i is 1-based
    var realm = CHAPTER_REALMS[i - 1];
    var ultra = (i % 3 === 0);
    var mood = CHAPTER_MOOD[realm] || { color: "#c9a24a", sky: "#26262e", tag: realm, blurb: "" };
    var boss = eternalOf(realm);
    // difficulty ramps: 1-2 easy, 3-5 medium, 6-9 hard
    var diff = i <= 2 ? "easy" : i <= 5 ? "medium" : "hard";
    return {
      idx: i, realm: realm, ultra: ultra, mood: mood,
      title: mood.tag, blurb: mood.blurb,
      diff: diff,
      boss: boss ? { id: boss.id, name: boss.name, atk: boss.atk, hp: boss.hp } : null,
      foes: FOE_NAMES[realm] || ["Vanguard", "Champion", "Warlord"],
      rewardRarity: ultra ? "Ultra-Rare" : "Rare",
      coinsRegular: 20 + i * 10,
      coinsBoss: 60 + i * 20,
      sealsBoss: ultra ? 2 : 1,
      stages: 4,  // 3 opponents + boss
    };
  }

  var Campaign = window.Campaign = {
    active: null,   // set while a campaign battle is in progress: {chapter, stage}
    CHAPTER_REALMS: CHAPTER_REALMS,
    chapters: function () { var a = []; for (var i = 1; i <= 9; i++) a.push(chapterData(i)); return a; },
    chapter: function (i) { return chapterData(i); },

    /* progress reads */
    unlockedChapter: function () { var p = Meta.current(); return p ? (p.campaign.chapter | 0) || 1 : 1; },
    isChapterUnlocked: function (i) { return i <= this.unlockedChapter(); },
    stageDone: function (i, s) { var p = Meta.current(); return !!(p && p.campaign.stages[i] && p.campaign.stages[i][s]); },
    stagesCleared: function (i) { var p = Meta.current(); var o = p && p.campaign.stages[i]; if (!o) return 0; var n = 0; for (var k in o) if (o[k]) n++; return n; },
    bossBeaten: function (i) { var p = Meta.current(); return !!(p && p.campaign.bosses[i]); },
    nextStage: function (i) { // first unfinished stage index (0..3), or -1 if chapter complete
      for (var s = 0; s < 4; s++) if (!this.stageDone(i, s)) return s;
      return -1;
    },

    /* build a battle config for newGame(); stage 0-2 = opponents, 3 = boss */
    battleConfig: function (i, stage) {
      var ch = chapterData(i);
      var isBoss = stage === 3;
      var playerRealms = playerCampaignRealms();
      var playerDeck = buildCampaignPlayerDeck(playerRealms);
      var enemyDeck = buildEnemyDeck(ch.realm, stage, isBoss);
      var name = isBoss ? ch.boss.name : (ch.foes[stage] || "Champion");
      // boss battles bump difficulty one notch
      var diff = ch.diff;
      if (isBoss) diff = diff === "easy" ? "medium" : "hard";
      return {
        playerRealms: playerRealms,
        aiRealms: [ch.realm, ch.realm, ch.realm, ch.realm].slice(0, C().lanes),
        aiDeck: enemyDeck,
        playerDeck: playerDeck,
        difficulty: diff,
        first: 0,
        names: ["You", name],
        humanOpponent: false,
      };
    },

    /* record a win and hand out rewards. Returns a summary for the UI. */
    resolveWin: function (i, stage) {
      var p = Meta.current(); if (!p) return null;
      var ch = chapterData(i);
      if (!p.campaign.stages[i]) p.campaign.stages[i] = {};
      var firstTime = !p.campaign.stages[i][stage];
      p.campaign.stages[i][stage] = true;
      var out = { chapter: i, stage: stage, firstTime: firstTime, coins: 0, seals: 0, unlocked: [], boss: stage === 3 };

      if (stage === 3) { // boss
        if (firstTime) {
          p.campaign.bosses[i] = true;
          Meta.addCoins(ch.coinsBoss); out.coins = ch.coinsBoss;
          Meta.addSeals(ch.sealsBoss); out.seals = ch.sealsBoss;
          // unlock a reward card of this realm (rare, or ultra every 3rd chapter)
          var pool = heroesByRealmRarity(ch.realm, ch.rewardRarity);
          var pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) { Meta.grant(pick.id, 1); out.unlocked.push({ id: pick.id, name: pick.name, rarity: pick.rarity }); }
          // advance to the next chapter
          if (p.campaign.chapter <= i) p.campaign.chapter = Math.min(9, i + 1);
        } else { Meta.addCoins(Math.round(ch.coinsBoss / 4)); out.coins = Math.round(ch.coinsBoss / 4); }
      } else { // regular opponent
        Meta.addCoins(firstTime ? ch.coinsRegular : Math.round(ch.coinsRegular / 3));
        out.coins = firstTime ? ch.coinsRegular : Math.round(ch.coinsRegular / 3);
        if (firstTime) out.unlocked = grantStageCards(ch.realm, stage);
      }
      Meta.save();
      return out;
    },
  };

  /* the player's campaign realms: up to C().lanes realms in which they own the
     most heroes (the three starters are always eligible). */
  function playerCampaignRealms() {
    var p = Meta.current();
    var counts = {};
    realmList().forEach(function (r) { counts[r] = 0; });
    if (p) for (var id in p.collection) { var c = cardById(id); if (c && (p.collection[id] | 0) > 0) counts[c.realm] = (counts[c.realm] || 0) + 1; }
    var ranked = realmList().slice().sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0); });
    // guarantee the starters are present if owned
    return ranked.slice(0, C().lanes);
  }

  /* build the player's campaign deck from OWNED heroes + freely-available
     support cards (relics/hex/rite/pact/incantation carry no rarity and are
     always usable). Falls back to the auto-builder if the pool is too thin. */
  function buildCampaignPlayerDeck(realms) {
    var p = Meta.current(); if (!p) return null;
    var uniq = realms.filter(function (v, k) { return realms.indexOf(v) === k; });
    var size = C().deckSize, lim = C().copyLimit;
    var deck = [], counts = {};
    var ownedHeroes = [];
    uniq.forEach(function (r) {
      allCards().forEach(function (c) {
        if (c.type === "hero" && c.realm === r) {
          var have = p.collection[c.id] | 0;
          for (var k = 0; k < have; k++) ownedHeroes.push(c.id);
        }
      });
    });
    var support = allCards().filter(function (c) { return c.type !== "hero" && uniq.indexOf(c.realm) >= 0; }).map(function (c) { return c.id; });
    // ~26 heroes, remainder support (mirrors buildDeck ratios)
    var heroTarget = Math.min(ownedHeroes.length, Math.round(26 / 50 * size));
    ownedHeroes = shuffle(ownedHeroes);
    for (var a = 0; a < ownedHeroes.length && countLen(deck) < heroTarget; a++) {
      var id = ownedHeroes[a];
      if ((counts[id] || 0) >= lim) continue;
      counts[id] = (counts[id] || 0) + 1; deck.push(id);
    }
    // fill the rest with support, then any owned hero, respecting copy limit
    var pool = shuffle(support.concat(ownedHeroes));
    var guard = 0;
    while (deck.length < size && guard++ < 4000 && pool.length) {
      var pid = pool[Math.floor(Math.random() * pool.length)];
      if ((counts[pid] || 0) >= lim) continue;
      counts[pid] = (counts[pid] || 0) + 1; deck.push(pid);
    }
    if (deck.length < size) return null; // let engine auto-build if we couldn't fill
    return shuffle(deck).slice(0, size);
  }
  function countLen(a) { return a.length; }

  /* enemy deck: themed to the chapter realm. Regular opponents pull commons +
     uncommons (+ a rare at stage 3-ish); the boss fields rares, an ultra, and
     the realm's Eternal, for a genuine spike. */
  function buildEnemyDeck(realm, stage, isBoss) {
    var size = C().deckSize, lim = C().copyLimit;
    var heroRarities;
    if (isBoss) heroRarities = ["Common", "Uncommon", "Rare", "Ultra-Rare"];
    else if (stage <= 0) heroRarities = ["Common"];
    else if (stage === 1) heroRarities = ["Common", "Uncommon"];
    else heroRarities = ["Common", "Uncommon", "Rare"];
    var heroes = allCards().filter(function (c) { return c.type === "hero" && c.realm === realm && heroRarities.indexOf(c.rarity) >= 0; }).map(function (c) { return c.id; });
    var support = allCards().filter(function (c) { return c.type !== "hero" && c.realm === realm; }).map(function (c) { return c.id; });
    var deck = [], counts = {};
    if (isBoss) { var e = eternalOf(realm); if (e) { deck.push(e.id); deck.push(e.id); counts[e.id] = 2; } } // field the Eternal
    var heroTarget = Math.round(26 / 50 * size);
    var hpool = shuffle(heroes);
    var g = 0;
    while (countLen(deck) < heroTarget && g++ < 3000 && hpool.length) {
      var id = hpool[Math.floor(Math.random() * hpool.length)];
      if ((counts[id] || 0) >= lim) continue;
      counts[id] = (counts[id] || 0) + 1; deck.push(id);
    }
    var pool = shuffle(support.concat(heroes));
    g = 0;
    while (deck.length < size && g++ < 4000 && pool.length) {
      var pid = pool[Math.floor(Math.random() * pool.length)];
      if ((counts[pid] || 0) >= lim) continue;
      counts[pid] = (counts[pid] || 0) + 1; deck.push(pid);
    }
    if (deck.length < size) return null;
    return shuffle(deck).slice(0, size);
  }

  /* progressive per-stage collection unlocks within a chapter */
  function grantStageCards(realm, stage) {
    var out = [];
    var give = function (cards) {
      cards.forEach(function (c) { Meta.grant(c.id, C().copyLimit); out.push({ id: c.id, name: c.name, rarity: c.rarity }); });
    };
    var commons = heroesByRealmRarity(realm, "Common");
    var uncommons = heroesByRealmRarity(realm, "Uncommon");
    if (stage === 0) give(commons.slice(0, 2));
    else if (stage === 1) give(commons.slice(2));
    else if (stage === 2) give(uncommons);
    return out;
  }

  /* ================================ Store ============================== */
  var PACKS = [
    {
      id: "wayfarer", name: "Wayfarer Pouch", cur: "coin", price: 150, cards: 3,
      blurb: "Everyday pack. Reliable commons, the odd uncommon.",
      odds: [["Common", 70], ["Uncommon", 27], ["Rare", 3]],
    },
    {
      id: "reliquary", name: "Sealed Reliquary", cur: "coin", price: 600, cards: 3,
      blurb: "Guaranteed uncommon or better, a real shot at a rare.",
      odds: [["Uncommon", 55], ["Rare", 40], ["Ultra-Rare", 5]],
    },
    {
      id: "vault", name: "Eternal Vault", cur: "seal", price: 8, cards: 3,
      blurb: "Premium. Every card rare or better — and a shot at an Eternal.",
      odds: [["Rare", 55], ["Ultra-Rare", 40], ["Eternal", 5]],
    },
  ];
  var DUP_REFUND = { Common: 10, Uncommon: 25, Rare: 60, "Ultra-Rare": 120, Eternal: 300 };

  var Store = window.Store = {
    packs: PACKS,
    pack: function (id) { return PACKS.filter(function (p) { return p.id === id; })[0]; },
    canAfford: function (id) { var p = this.pack(id); if (!p) return false; return p.cur === "seal" ? Meta.seals() >= p.price : Meta.coins() >= p.price; },

    open: function (id) {
      var pack = this.pack(id); if (!pack) return { err: "Unknown pack." };
      if (!this.canAfford(id)) return { err: "Not enough " + (pack.cur === "seal" ? "Seals" : "coins") + "." };
      if (pack.cur === "seal") Meta.spendSeals(pack.price); else Meta.spendCoins(pack.price);
      var results = [];
      var totalRefund = 0;
      for (var n = 0; n < pack.cards; n++) {
        var rarity = rollRarity(pack.odds);
        var pool = allCards().filter(function (c) { return c.type === "hero" && c.rarity === rarity; });
        var card = pool[Math.floor(Math.random() * pool.length)];
        if (!card) continue;
        var g = Meta.grant(card.id, 1);
        var dup = !g.newCard && g.added === 0;
        var refund = dup ? (DUP_REFUND[rarity] || 10) : 0;
        if (dup) { Meta.addCoins(refund); totalRefund += refund; }
        results.push({ id: card.id, name: card.name, realm: card.realm, rarity: rarity, dup: dup, refund: refund });
      }
      Meta.save();
      return { ok: true, cards: results, refund: totalRefund };
    },
  };

  function rollRarity(odds) {
    var total = odds.reduce(function (s, o) { return s + o[1]; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < odds.length; i++) { r -= odds[i][1]; if (r <= 0) return odds[i][0]; }
    return odds[odds.length - 1][0];
  }

  window.MetaData = { DUP_REFUND: DUP_REFUND, CHAPTER_MOOD: CHAPTER_MOOD };
})();
