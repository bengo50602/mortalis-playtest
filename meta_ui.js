/* ============================================================================
   meta_ui.js — screens + wiring for accounts, campaign, and store.
   Loaded AFTER ui.js and meta.js. Injects its own DOM + styles so index.html
   stays lean, and wraps UI.show() to route the three new screens.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var RC = { Common: "#9aa4b2", Uncommon: "#7fb069", Rare: "#5b8fd6", "Ultra-Rare": "#c78bd6", Eternal: "#e0a45c", Support: "#6fae8f" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }

  var MetaUI = window.MetaUI = {};
  var EXTRA = ["login", "campaign", "store"];

  /* ------------------------------- styles ------------------------------- */
  function injectStyle() {
    if ($("meta-style")) return;
    var css = ""
      + "#meta-chip{display:inline-flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)}"
      + "#meta-chip b{color:var(--ink);font-weight:600}"
      + "#meta-chip .cur{color:var(--warn)}"
      + ".splash-menu{margin-top:30px;display:flex;flex-direction:column;align-items:center;gap:12px;width:min(340px,80vw)}"
      + ".splash-menu button{width:100%;font-family:'Cinzel',Georgia,serif;letter-spacing:3px;font-size:15px;padding:12px 18px;border-radius:10px;cursor:pointer;border:1px solid rgba(200,215,240,.35);background:rgba(16,22,34,.55);color:#e9eff7;backdrop-filter:blur(3px);transition:transform .12s,filter .2s,background .2s}"
      + ".splash-menu button:hover{transform:translateY(-2px);background:rgba(30,42,64,.7)}"
      + ".splash-menu button.primary{background:linear-gradient(180deg,#e9eff7,#b9c8de);color:#0d1420;border-color:#f2f6fc;font-weight:700}"
      + ".splash-menu .prof{color:#cdd9ec;font-size:12px;letter-spacing:1px;text-shadow:0 1px 4px rgba(0,0,0,.7);margin-top:4px}"
      + ".splash-menu .prof .cur{color:#f0d69a}"
      + ".splash-menu .prof a{color:#9db8e6;cursor:pointer;text-decoration:underline;margin-left:8px}"
      + ".mpanel{max-width:1120px;margin:0 auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px}"
      + ".mhead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px}"
      + ".mhead h2{font-family:'Cinzel',Georgia,serif;letter-spacing:2px;margin:0;font-size:24px;color:var(--ink)}"
      + ".mhead .sub{color:var(--muted);font-size:13px}"
      + ".ch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}"
      + "@media(max-width:820px){.ch-grid{grid-template-columns:1fr}}"
      + ".ch-card{position:relative;border-radius:12px;padding:14px;border:1px solid var(--line2);overflow:hidden;color:#eef3fb;min-height:150px;display:flex;flex-direction:column;justify-content:space-between}"
      + ".ch-card .num{font-family:'Cinzel',serif;font-size:12px;letter-spacing:3px;opacity:.85}"
      + ".ch-card .rtag{font-family:'Cinzel',serif;font-size:19px;letter-spacing:1px;margin:2px 0 4px}"
      + ".ch-card .blurb{font-size:12px;line-height:1.5;color:#dfe7f2;opacity:.92;min-height:34px}"
      + ".ch-card .boss{font-size:12px;margin-top:8px;color:#fff}"
      + ".ch-card .foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px}"
      + ".ch-card .pips{display:flex;gap:4px}"
      + ".ch-card .pip{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.28)}"
      + ".ch-card .pip.on{background:#ffe9a8}"
      + ".ch-card button{font-family:'Cinzel',serif;letter-spacing:2px;font-size:12px;padding:7px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.14);color:#fff;cursor:pointer}"
      + ".ch-card button:hover{background:rgba(255,255,255,.26)}"
      + ".ch-card.locked{filter:grayscale(.85) brightness(.6)}"
      + ".ch-card.locked button{opacity:.5;cursor:not-allowed}"
      + ".ch-card .rw{display:inline-block;font-size:11px;letter-spacing:1px;padding:2px 8px;border-radius:6px;font-weight:600}"
      + ".mcard{width:118px;border-radius:10px;border:1px solid var(--line2);background:var(--card);padding:9px;text-align:center;color:var(--ink)}"
      + ".mcard .nm{font-size:12px;font-weight:600;min-height:30px;display:flex;align-items:center;justify-content:center;line-height:1.2}"
      + ".mcard .rl{font-size:10px;color:var(--muted);letter-spacing:1px}"
      + ".mcard .st{font-size:12px;margin-top:5px;color:var(--ink)}"
      + ".mcard .rr{font-size:10px;letter-spacing:1px;margin-top:4px;font-weight:700}"
      + ".pack-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}"
      + "@media(max-width:820px){.pack-grid{grid-template-columns:1fr}}"
      + ".pack{border-radius:14px;padding:18px;border:1px solid var(--line2);text-align:center;color:#eef3fb;display:flex;flex-direction:column;gap:8px;min-height:250px}"
      + ".pack .pn{font-family:'Cinzel',serif;font-size:18px;letter-spacing:1px}"
      + ".pack .pi{font-size:40px;line-height:1}"
      + ".pack .pb{font-size:12px;color:#dfe7f2;min-height:34px}"
      + ".pack .odds{font-size:11px;color:#e7edf6;text-align:left;margin:0 auto}"
      + ".pack button{margin-top:auto;font-family:'Cinzel',serif;letter-spacing:2px;font-size:13px;padding:9px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.16);color:#fff;cursor:pointer}"
      + ".pack button:hover{background:rgba(255,255,255,.3)}"
      + ".pack button:disabled{opacity:.45;cursor:not-allowed}"
      + ".mover{min-height:80vh;background:rgba(6,10,18,.86);display:flex;align-items:center;justify-content:center;padding:24px}"
      + ".mmodal{max-width:640px;width:100%;background:var(--panel);border:1px solid var(--line2);border-radius:16px;padding:26px;text-align:center}"
      + ".mmodal h2{font-family:'Cinzel',serif;letter-spacing:2px;margin:0 0 8px;color:var(--ink)}"
      + ".mmodal .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}"
      + ".mmodal .reveal{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:16px 0}"
      + ".mbtn{font-family:'Cinzel',serif;letter-spacing:2px;font-size:14px;padding:10px 22px;border-radius:10px;cursor:pointer;border:1px solid var(--line2);background:var(--card);color:var(--ink)}"
      + ".mbtn.primary{background:linear-gradient(180deg,#e9eff7,#b9c8de);color:#0d1420;border-color:#f2f6fc;font-weight:700}"
      + ".mbtn:hover{filter:brightness(1.08)}"
      + ".ci{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;color:#f2f6fc;position:relative;overflow:hidden}"
      + ".ci .chn{font-family:'Cinzel',serif;letter-spacing:8px;font-size:14px;opacity:.85;animation:ciUp 1s ease both}"
      + ".ci .ctt{font-family:'Cinzel',serif;letter-spacing:5px;font-size:clamp(30px,7vw,72px);margin:10px 0;text-shadow:0 3px 18px rgba(0,0,0,.6);animation:ciUp 1.1s ease .1s both}"
      + ".ci .cbl{max-width:560px;font-size:15px;line-height:1.7;color:#e2ebf6;animation:ciUp 1.1s ease .25s both}"
      + ".ci .cbs{margin-top:18px;font-family:'Cinzel',serif;letter-spacing:2px;font-size:15px;animation:ciUp 1.1s ease .4s both}"
      + ".ci .cbs .skull{font-size:26px;display:block;margin-bottom:4px}"
      + ".ci .cgo{margin-top:26px;font-family:'Cinzel',serif;letter-spacing:4px;font-size:18px;padding:13px 46px;border-radius:11px;cursor:pointer;border:1px solid #f2f6fc;background:linear-gradient(180deg,#e9eff7,#b9c8de);color:#101826;font-weight:700;animation:ciUp 1.1s ease .55s both}"
      + ".ci .cgo:hover{transform:translateY(-2px)}"
      + ".ci .cx{margin-top:14px;color:#cdd9ec;cursor:pointer;font-size:12px;letter-spacing:1px;text-decoration:underline;animation:ciUp 1.1s ease .7s both}"
      + "@keyframes ciUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}"
      + "@keyframes cardIn{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:none}}"
      + ".login-wrap{max-width:420px;margin:6vh auto;background:var(--panel);border:1px solid var(--line2);border-radius:16px;padding:28px}"
      + ".login-wrap h2{font-family:'Cinzel',serif;letter-spacing:2px;text-align:center;margin:0 0 4px;color:var(--ink)}"
      + ".login-wrap .sub{text-align:center;color:var(--muted);font-size:13px;margin-bottom:18px}"
      + ".login-wrap label{display:block;font-size:12px;color:var(--muted);margin:12px 0 5px}"
      + ".login-wrap input{width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--line2);border-radius:9px;color:var(--ink);font-size:16px;padding:10px 12px}"
      + ".login-wrap .err{color:var(--bad);font-size:13px;min-height:18px;margin-top:10px;text-align:center}"
      + ".login-wrap .tabs{display:flex;gap:8px;margin-bottom:16px}"
      + ".login-wrap .tabs button{flex:1;padding:9px;border-radius:9px;border:1px solid var(--line2);background:var(--card);color:var(--muted);cursor:pointer}"
      + ".login-wrap .tabs button.on{background:var(--accent-bg);color:var(--ink);border-color:var(--accent)}"
      + ".login-wrap .who{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}"
      + ".login-wrap .who button{background:var(--card);border:1px solid var(--line2);color:var(--ink);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}"
      + ".mnote{color:var(--muted);font-size:12px;text-align:center;margin-top:14px;line-height:1.6}"
      + ".cmap{position:relative;max-width:560px;margin:14px auto 4px;padding:6px 0}"
      + ".cmap:before{content:'';position:absolute;left:50%;top:6px;bottom:6px;width:3px;background:repeating-linear-gradient(var(--line2) 0 8px,transparent 8px 16px);transform:translateX(-50%)}"
      + ".cnode{position:relative;width:46%;padding:11px 13px;border-radius:12px;border:1px solid var(--line2);margin:9px 0;background:var(--card);cursor:pointer;transition:transform .12s,box-shadow .2s}"
      + ".cnode:hover{transform:translateY(-1px)}"
      + ".cnode.right{margin-left:54%}.cnode.left{margin-right:54%}"
      + ".cnode .cn{font-size:10px;letter-spacing:2px;color:var(--muted)}"
      + ".cnode .cr{font-family:'Cinzel',serif;font-size:16px;margin-top:1px}"
      + ".cnode .cpips{margin-top:7px;display:flex;gap:3px;flex-wrap:wrap}"
      + ".cnode .cpip{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.16)}"
      + ".cnode .cpip.on{background:#ffe4a0}"
      + ".cnode.cur{box-shadow:0 0 0 2px var(--accent),0 6px 20px -8px var(--accent)}"
      + ".cnode.done{opacity:.9}"
      + ".cnode.myst{cursor:default;text-align:center;font-family:'Cinzel',serif;letter-spacing:5px;color:var(--muted);opacity:.6;background:repeating-linear-gradient(45deg,#12161d 0 8px,#151a22 8px 16px)}"
      + ".cnode .chero{position:absolute;top:-12px;left:12px;font-size:22px;color:#ffe4a0;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}"
      + ".cut{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}"
      + ".cut-inner{max-width:740px;width:100%;display:flex;gap:24px;align-items:flex-end}"
      + "@media(max-width:640px){.cut-inner{flex-direction:column;align-items:center}.cut-portrait{width:160px !important}}"
      + ".cut-portrait{flex:0 0 auto;width:210px;text-align:center}"
      + ".cut-name{font-family:'Cinzel',serif;font-size:19px;color:#eef3fb;margin-top:8px;line-height:1.2}"
      + ".cut-title{font-size:12px;color:#cbd6e6;margin-top:2px}"
      + ".cut-side{flex:1;display:flex;flex-direction:column;gap:12px;min-width:0}"
      + ".bubble{background:var(--panel);border:1px solid var(--line2);border-radius:14px;padding:11px 15px;font-size:15px;line-height:1.6;color:var(--ink);max-width:100%;animation:ciUp .5s ease both}"
      + ".bubble .who{font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:3px;text-transform:uppercase}"
      + ".cut-continue{align-self:flex-start;margin-top:4px}";
    var s = document.createElement("style"); s.id = "meta-style"; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ------------------------------ screen DOM ---------------------------- */
  function injectScreens() {
    EXTRA.forEach(function (id) {
      if ($("screen-" + id)) return;
      var d = document.createElement("div");
      d.id = "screen-" + id; d.className = "screen";
      document.body.appendChild(d);
    });
  }

  /* ------------------------- splash menu + topbar ----------------------- */
  function renderSplashMenu() {
    var splash = $("title-splash"); if (!splash) return;
    var start = $("btn-splash-start"); if (start) start.style.display = "none";
    var links = splash.querySelector(".splash-links"); if (links) links.style.display = "none";
    var menu = $("splash-menu");
    if (!menu) { menu = document.createElement("div"); menu.id = "splash-menu"; menu.className = "splash-menu"; splash.appendChild(menu); }
    var p = Meta.current();
    var html = "";
    if (!p) {
      html += "<button class='primary' data-a='login'>SIGN IN</button>";
      html += "<div class='prof'>Create a free account to save decks, campaign progress, and your collection.</div>";
    } else {
      html += "<button class='primary' data-a='campaign'>CAMPAIGN</button>";
      html += "<button data-a='store'>STORE</button>";
      html += "<button data-a='quick'>QUICK PLAY (vs AI)</button>";
      html += "<button data-a='decks'>DECKS</button>";
      html += "<div class='prof'>Signed in as <b>" + esc(p.name) + "</b> &nbsp;·&nbsp; <span class='cur'>&#9679; " + (p.coins | 0) + "</span> coins &nbsp; <span class='cur'>&#9670; " + (p.seals | 0) + "</span> Seals <a data-a='logout'>Sign out</a></div>";
    }
    html += "<div class='prof'><a href='tutorial.html' style='margin:0'>How to play</a> &nbsp;·&nbsp; <a href='pvp.html' style='margin:0'>Play a friend (PvP)</a></div>";
    menu.innerHTML = html;
    menu.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { menuAction(b.getAttribute("data-a")); }; });
  }

  function menuAction(a) {
    if (a === "login") return MetaUI.showLogin();
    if (a === "logout") { Meta.logout(); renderSplashMenu(); renderChip(); return; }
    if (a === "campaign") { if (!requireLogin()) return; UI.show("campaign"); return; }
    if (a === "store") { if (!requireLogin()) return; UI.show("store"); return; }
    if (a === "decks") { if (!requireLogin()) return; UI.exitTitle(); UI.show("decks"); return; }
    if (a === "quick") { if (!requireLogin()) return; UI.exitTitle(); UI.show("setup"); return; }
  }
  function requireLogin() { if (Meta.current()) return true; MetaUI.showLogin(); return false; }

  function renderChip() {
    var bar = document.querySelector(".topbar"); if (!bar) return;
    var chip = $("meta-chip");
    if (!chip) {
      chip = document.createElement("span"); chip.id = "meta-chip";
      var anchor = $("btn-mainmenu");
      bar.insertBefore(chip, anchor || null);
      // topbar campaign/store buttons (visible during play, hidden on splash)
      var cbtn = document.createElement("button"); cbtn.id = "btn-tb-campaign"; cbtn.textContent = "Campaign";
      cbtn.onclick = function () { if (requireLogin()) UI.show("campaign"); };
      var sbtn = document.createElement("button"); sbtn.id = "btn-tb-store"; sbtn.textContent = "Store";
      sbtn.onclick = function () { if (requireLogin()) UI.show("store"); };
      bar.insertBefore(cbtn, anchor || null); bar.insertBefore(sbtn, anchor || null);
    }
    var p = Meta.current();
    chip.innerHTML = p
      ? "<b>" + esc(p.name) + "</b> <span class='cur'>&#9679; " + (p.coins | 0) + "</span> <span class='cur'>&#9670; " + (p.seals | 0) + "</span>"
      : "";
  }

  /* -------------------------------- login ------------------------------- */
  MetaUI.showLogin = function () { UI.show("login"); };
  var loginMode = "signin";
  function renderLogin() {
    var el = $("screen-login"); if (!el) return;
    var names = Meta.names();
    if (!names.length) loginMode = "create";
    var html = "<div class='login-wrap'>"
      + "<h2>Mortalis: Realms</h2><div class='sub'>Sign in to save your decks, progress, and collection.</div>"
      + "<div class='tabs'><button data-m='signin' class='" + (loginMode === "signin" ? "on" : "") + "'>Sign in</button>"
      + "<button data-m='create' class='" + (loginMode === "create" ? "on" : "") + "'>Create account</button></div>";
    if (loginMode === "signin") {
      html += "<label>Username</label><input id='li-name' autocomplete='off' placeholder='your username'>";
      if (names.length) html += "<div class='who'>" + names.map(function (n) { var pr = Meta.db.profiles[n]; return "<button data-n='" + esc(pr.name) + "'>" + esc(pr.name) + "</button>"; }).join("") + "</div>";
      html += "<label>4-digit PIN</label><input id='li-pin' inputmode='numeric' maxlength='4' placeholder='••••'>";
      html += "<div class='err' id='li-err'></div><button class='mbtn primary' id='li-go' style='width:100%'>Sign in</button>";
    } else {
      html += "<label>Choose a username</label><input id='li-name' autocomplete='off' maxlength='20' placeholder='e.g. Ben'>";
      html += "<label>Choose a 4-digit PIN</label><input id='li-pin' inputmode='numeric' maxlength='4' placeholder='••••'>";
      html += "<div class='err' id='li-err'></div><button class='mbtn primary' id='li-go' style='width:100%'>Create account</button>";
    }
    html += "<div class='mnote'>Profiles are stored on this device only — they don't sync between devices, and a 4-digit PIN is a light lock, not real security.</div>";
    html += "<div style='text-align:center;margin-top:14px'><a class='prof' style='color:var(--muted);cursor:pointer;text-decoration:underline' id='li-back'>Back to menu</a></div></div>";
    el.innerHTML = html;
    el.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { loginMode = b.getAttribute("data-m"); renderLogin(); }; });
    el.querySelectorAll(".who button").forEach(function (b) { b.onclick = function () { var i = $("li-name"); if (i) i.value = b.getAttribute("data-n"); var pin = $("li-pin"); if (pin) pin.focus(); }; });
    var back = $("li-back"); if (back) back.onclick = function () { backToSplash(); };
    var go = $("li-go"); if (go) go.onclick = submitLogin;
    var pin = $("li-pin"); if (pin) pin.onkeydown = function (e) { if (e.key === "Enter") submitLogin(); };
  }
  function submitLogin() {
    var name = ($("li-name") || {}).value || "", pin = ($("li-pin") || {}).value || "";
    var err = $("li-err");
    var r = loginMode === "create" ? Meta.create(name, pin) : Meta.login(name, pin);
    if (r.err) { if (err) err.textContent = r.err; return; }
    renderChip(); renderSplashMenu();
    backToSplash();
    if (loginMode === "create") UI.toast && UI.toast("Welcome, " + r.profile.name + "! Your starter cards are ready.");
    else UI.toast && UI.toast("Welcome back, " + r.profile.name + ".");
  }
  function backToSplash() {
    var s = $("screen-setup"); if (s) s.classList.add("title-mode");
    UI.show("setup");
  }

  /* reveal the campaign screen WITHOUT re-rendering its content (our overlays
     set their own innerHTML; UI.show('campaign') would otherwise redraw the map) */
  function revealCampaign() {
    EXTRA.forEach(function (id) { var e = $("screen-" + id); if (e) e.classList.remove("visible"); });
    ["setup", "game", "decks", "cards", "rules"].forEach(function (c) { var e = $("screen-" + c); if (e) e.classList.remove("visible"); });
    var e = $("screen-campaign"); if (e) e.classList.add("visible");
    if (document.body) document.body.classList.remove("on-splash");
    UI.screen = "campaign"; window.scrollTo(0, 0);
  }

  /* --------------------------- fog-of-war map --------------------------- */
  // The hero follows a winding path. Only cleared chapters, the current one, and
  // a single shrouded "next" node are shown — everything beyond stays a mystery.
  // the call-to-adventure premise, shown once on first entry (replayable via "Story")
  MetaUI.showPrologue = function (onDone) {
    var el = $("screen-campaign"); if (!el) return;
    el.innerHTML = "<div class='ci' style='background:radial-gradient(130% 95% at 50% 12%,#2a0d0dEE 0%,#05070c 82%)'>"
      + "<div class='chn' style='color:#e0a45c'>THE CALL TO ADVENTURE</div>"
      + "<div class='ctt' style='color:#e24b4a;font-size:clamp(26px,6vw,52px)'>A Village of Ash</div>"
      + "<div class='cbl' style='max-width:640px'>" + esc(Campaign.prologue) + "</div>"
      + "<button class='cgo'>Begin your quest</button>"
      + "<div class='cx'>Skip</div></div>";
    revealCampaign();
    var done = function () { Campaign.markPrologueSeen(); if (onDone) onDone(); };
    el.querySelector(".cgo").onclick = done;
    el.querySelector(".cx").onclick = done;
  };

  function renderCampaign() {
    var el = $("screen-campaign"); if (!el) return;
    // first-time players get the story premise before the map
    if (!Campaign.seenPrologue()) { MetaUI.showPrologue(function () { renderCampaign(); }); return; }
    var cur = Campaign.unlockedChapter();
    var reveal = Math.min(Campaign.TOTAL, cur + 1);   // show one shrouded node ahead
    var cs = Meta.collectionStats();
    var html = "<div class='mpanel'><div class='mhead'><h2>Campaign</h2>"
      + "<span class='sub'>Collection " + cs.owned + " / " + cs.total + " heroes &nbsp;·&nbsp; <span style='color:var(--warn)'>&#9679; " + Meta.coins() + "</span> &nbsp; <span style='color:var(--warn)'>&#9670; " + Meta.seals() + "</span></span></div>"
      + "<div class='sub'>Follow the road. Win six duels, then the chapter's champion. Bosses drop coins, Seals, and a card — an ultra-rare every third chapter. The road ahead is unknown.</div>"
      + "<div class='cmap'>";
    for (var i = 1; i <= reveal; i++) {
      var side = (i % 2) ? "left" : "right";
      if (i > cur) { // the shrouded next chapter
        html += "<div class='cnode myst " + side + "'><span class='chero' style='display:none'></span>? ? ?<div style='font-size:11px;letter-spacing:1px;margin-top:4px'>The road continues…</div></div>";
        continue;
      }
      var ch = Campaign.chapter(i);
      var m = ch.mood;
      var boss = Campaign.bossBeaten(i);
      var duels = Campaign.duelsCleared(i);
      var isCur = (i === cur);
      var pips = "";
      for (var s = 0; s < Campaign.DUELS; s++) pips += "<span class='cpip " + (duels > s ? "on" : "") + "'></span>";
      pips += "<span class='cpip " + (boss ? "on" : "") + "' style='margin-left:5px;border-radius:2px'></span>";
      var rwColor = ch.ultra ? RC["Ultra-Rare"] : RC.Rare;
      var label = boss ? "Revisit" : (duels >= Campaign.DUELS ? "Face the champion" : "Continue");
      html += "<div class='cnode " + side + (isCur ? " cur" : "") + (boss ? " done" : "") + "' data-ch='" + i + "' style='border-color:" + m.color + "66'>"
        + (isCur ? "<span class='chero' title='You are here'>&#9873;</span>" : "")
        + "<div class='cn'>CHAPTER " + i + (boss ? " &#10003;" : "") + "</div>"
        + "<div class='cr' style='color:" + m.color + "'>" + esc(ch.realm) + (ch.ascendant ? " &#9733;" : "") + "</div>"
        + "<div style='font-size:11px;color:var(--muted);margin-top:2px'>" + esc(ch.title) + "</div>"
        + "<div class='cpips'>" + pips + "</div>"
        + "<div style='margin-top:8px;display:flex;justify-content:space-between;align-items:center'>"
        + "<span class='rw' style='background:" + rwColor + "22;color:" + rwColor + ";border:1px solid " + rwColor + "55;font-size:10px;padding:2px 7px;border-radius:6px'>" + (ch.ultra ? "ULTRA" : "RARE") + "</span>"
        + "<span style='font-size:11px;color:" + m.color + "'>" + label + " &#8250;</span></div>"
        + "</div>";
    }
    html += "</div><div style='margin-top:6px;text-align:center'><button class='mbtn' id='cmp-story'>Story</button> <button class='mbtn' id='cmp-back'>Back to menu</button> <button class='mbtn' id='cmp-store'>Store</button></div></div>";
    el.innerHTML = html;
    el.querySelectorAll("[data-ch]").forEach(function (b) { b.onclick = function () { openChapter(+b.getAttribute("data-ch")); }; });
    var back = $("cmp-back"); if (back) back.onclick = function () { backToSplash(); };
    var st = $("cmp-store"); if (st) st.onclick = function () { UI.show("store"); };
    var story = $("cmp-story"); if (story) story.onclick = function () { MetaUI.showPrologue(function () { renderCampaign(); }); };
  }

  /* ---------------------------- chapter intro --------------------------- */
  function openChapter(i) {
    var ch = Campaign.chapter(i);
    var stage = Campaign.nextStage(i);
    if (stage < 0) stage = Campaign.BOSS_STAGE; // fully cleared -> revisit boss
    var isBoss = stage === Campaign.BOSS_STAGE;
    var m = ch.mood;
    var el = $("screen-campaign");
    var duelsLeft = Campaign.DUELS - Campaign.duelsCleared(i);
    var sub = isBoss ? "The champion awaits." : (Campaign.duelsCleared(i) + " of " + Campaign.DUELS + " duels won — " + duelsLeft + " to go.");
    var actLine = ch.act ? "<div class='chn' style='color:" + m.color + ";letter-spacing:6px'>" + esc(ch.act.act) + " &mdash; " + esc(ch.act.title) + "</div>" : "";
    el.innerHTML = "<div class='ci' style='background:radial-gradient(120% 90% at 50% 20%," + m.sky + "cc 0%,#05070c 80%)'>"
      + actLine
      + "<div class='chn'>CHAPTER " + i + " &nbsp;&#183;&nbsp; " + esc(ch.realm).toUpperCase() + "</div>"
      + "<div class='ctt' style='color:" + m.color + "'>" + esc(ch.title) + "</div>"
      + "<div class='cbl'>" + esc(ch.story) + "</div>"
      + "<div class='cbs' style='color:#cbd6e6'>" + esc(sub) + "</div>"
      + "<button class='cgo'>" + (isBoss ? "FACE THE CHAMPION" : "NEXT DUEL") + "</button>"
      + "<div class='cx'>Back to the map</div></div>";
    revealCampaign();
    el.querySelector(".cgo").onclick = function () { prepBattle(i, stage); };
    el.querySelector(".cx").onclick = function () { renderCampaign(); revealCampaign(); };
  }

  /* -------- pre-battle loadout: pick a deck; realms suggested from it -------- */
  var prep = { chapter: 0, stage: 0, deckId: "auto", realms: [] };
  function playableDecks() {
    var list = (typeof loadDecks === "function") ? loadDecks() : [];
    return list.filter(function (d) { try { return validateDeck(d).playable; } catch (e) { return false; } });
  }
  function suggestRealms(deckId, decks) {
    var lanes = C().lanes, out = [];
    if (deckId === "auto") return Campaign.autoRealms().slice(0, lanes);
    var d = decks.filter(function (x) { return x.id === deckId; })[0];
    var rs = d ? deckRealms(d) : [];
    if (!rs.length) rs = Campaign.autoRealms();
    for (var k = 0; k < lanes; k++) out.push(rs[k % rs.length]);
    return out;
  }
  function prepBattle(i, stage) {
    prep.chapter = i; prep.stage = stage;
    var decks = playableDecks();
    prep.deckId = decks.length ? decks[0].id : "auto";
    prep.realms = suggestRealms(prep.deckId, decks);
    renderPrep(decks);
  }
  function renderPrep(decks) {
    var i = prep.chapter, stage = prep.stage;
    var ch = Campaign.chapter(i), opp = Campaign.opponent(i, stage), m = ch.mood;
    var unlocked = (window.Meta && Meta.unlockedRealms) ? Meta.unlockedRealms() : realmNames();
    if (!unlocked.length) unlocked = realmNames();
    // Keep the stored realms in lockstep with what the dropdowns can show: a
    // suggested realm you haven't unlocked isn't a valid <option>, so the select
    // would silently display a different realm than prep.realms holds — and the
    // battle would then use the hidden one. Clamp every lane to an unlocked realm.
    prep.realms = prep.realms.map(function (r) { return unlocked.indexOf(r) >= 0 ? r : unlocked[0]; });
    var el = $("screen-campaign");
    var deckOpts = "<div class='deck-opt " + (prep.deckId === "auto" ? "sel" : "") + "' data-d='auto'><span class='tick'>" + (prep.deckId === "auto" ? "&#9679;" : "&#9675;") + "</span>Auto-build from your collection<span class='sub'>a fresh legal deck for the realms below</span></div>";
    decks.forEach(function (d) {
      deckOpts += "<div class='deck-opt " + (prep.deckId === d.id ? "sel" : "") + "' data-d='" + d.id + "'><span class='tick'>" + (prep.deckId === d.id ? "&#9679;" : "&#9675;") + "</span>" + esc(d.name || "Untitled") + "<span class='sub'>" + esc(deckRealms(d).join(" &#183; ") || "ready") + "</span></div>";
    });
    var laneSel = "";
    for (var k = 0; k < C().lanes; k++) {
      laneSel += "<div><div style='font-size:11px;color:var(--muted);margin-bottom:3px'>Lane " + (k + 1) + "</div><select data-lane='" + k + "'>"
        + unlocked.map(function (r) { return "<option value='" + esc(r) + "'" + (prep.realms[k] === r ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("") + "</select></div>";
    }
    el.innerHTML = "<div class='mpanel' style='max-width:720px'>"
      + "<div class='mhead'><h2>Prepare for battle</h2><span class='sub'>Chapter " + i + " &#183; <span style='color:" + m.color + "'>" + esc(ch.realm) + "</span> &mdash; vs " + esc(opp.name) + "</span></div>"
      + "<div class='sub'>Choose your deck. Your realms are suggested from that deck &mdash; adjust any lane if you like.</div>"
      + "<div class='deck-pick' style='margin:12px 0'>" + deckOpts + "</div>"
      + "<p class='setup-label' style='margin-top:4px'>Your realms (one per lane)</p>"
      + "<div class='lane-picks'>" + laneSel + "</div>"
      + "<div style='display:flex;gap:8px;margin-top:4px'><button class='mbtn' id='pp-rand' style='font-size:12px;padding:6px 12px'>Randomize realms</button></div>"
      + "<div class='row' style='justify-content:flex-start;margin-top:16px'><button class='mbtn primary' id='pp-go'>Begin</button> <button class='mbtn' id='pp-back'>Back</button></div>"
      + "</div>";
    revealCampaign();
    el.querySelectorAll(".deck-opt").forEach(function (it) { it.onclick = function () { prep.deckId = it.getAttribute("data-d"); prep.realms = suggestRealms(prep.deckId, decks); renderPrep(decks); }; });
    el.querySelectorAll("select[data-lane]").forEach(function (s) { s.onchange = function () { prep.realms[+s.getAttribute("data-lane")] = s.value; }; });
    var rnd = $("pp-rand"); if (rnd) rnd.onclick = function () { var u = unlocked.slice(); prep.realms = []; for (var k = 0; k < C().lanes; k++) prep.realms.push(u[Math.floor(Math.random() * u.length)]); renderPrep(decks); };
    var back = $("pp-back"); if (back) back.onclick = function () { renderCampaign(); revealCampaign(); };
    var go = $("pp-go"); if (go) go.onclick = function () {
      var opts = { playerRealms: prep.realms.slice(0, C().lanes) };
      if (prep.deckId !== "auto") { var d = decks.filter(function (x) { return x.id === prep.deckId; })[0]; if (d) opts.playerDeck = expandDeck(d); }
      cutscene(opp, "pre", { onDone: function () { MetaUI.startBattle(i, stage, opts); } });
    };
  }

  MetaUI.startBattle = function (chapter, stage, opts) {
    var cfg = Campaign.battleConfig(chapter, stage, opts);
    if (UI.resetLocks) UI.resetLocks();
    Campaign.active = { chapter: chapter, stage: stage };
    newGame(cfg);
    var s = $("screen-setup"); if (s) s.classList.remove("title-mode");
    UI.show("game");
    UI.render();
    try { FX.intro(); } catch (e) {}
    if (G.active === 1) setTimeout(function () { UI.runAI(); }, FX.busy ? FX.ms(3600) : 0);
  };

  /* --------------------------- portraits + dialogue -------------------- */
  function hashName(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  var SKINS = ["#e8c9a8", "#d8a878", "#b07a4e", "#8a5a3a", "#c9a98a", "#a9b0bc"];
  function portraitSVG(opp, size) {
    size = size || 210;
    var name = opp.name || "", col = opp.color || "#c9a24a", boss = !!opp.isBoss;
    var h = hashName(name);
    var skin = SKINS[(h >> 3) % SKINS.length];
    var eye = boss ? col : "#20242c";
    var dark = "#0c0f16";
    var gear = boss ? (/Balemaw|Noctavein|Zolthec/.test(opp.realm) ? "horns" : "crown") : (h % 5);
    var parts = "";
    parts += "<rect x='2' y='2' width='96' height='116' rx='11' fill='" + dark + "' stroke='" + col + "' stroke-width='2.5'/>";
    if (boss) parts += "<rect x='6' y='6' width='88' height='108' rx='8' fill='none' stroke='" + col + "' stroke-width='1' opacity='.55'/>";
    parts += "<path d='M14 118 Q50 88 86 118 Z' fill='" + col + "' opacity='.9'/>";
    parts += "<path d='M22 118 Q50 96 78 118 Z' fill='" + dark + "' opacity='.5'/>";
    parts += "<rect x='43' y='76' width='14' height='16' fill='" + skin + "'/>";
    parts += "<ellipse cx='50' cy='60' rx='18' ry='21' fill='" + skin + "'/>";
    parts += "<ellipse cx='42' cy='62' rx='2.4' ry='2.8' fill='" + eye + "'/><ellipse cx='58' cy='62' rx='2.4' ry='2.8' fill='" + eye + "'/>";
    if (boss) { parts += "<ellipse cx='42' cy='62' rx='3.6' ry='3.9' fill='none' stroke='" + col + "' opacity='.5'/><ellipse cx='58' cy='62' rx='3.6' ry='3.9' fill='none' stroke='" + col + "' opacity='.5'/>"; }
    parts += "<path d='M45 71 Q50 74 55 71' stroke='#3a2a22' stroke-width='1.4' fill='none' stroke-linecap='round'/>";
    if (gear === "hood" || gear === 0) parts += "<path d='M27 66 Q26 34 50 33 Q74 34 73 66 Q73 52 50 48 Q27 52 27 66 Z' fill='" + shadeHex(col, -.45) + "'/>";
    else if (gear === "helm" || gear === 1) { parts += "<path d='M30 60 Q30 34 50 33 Q70 34 70 60 L70 54 Q50 41 30 54 Z' fill='#8a94a4'/><rect x='48' y='44' width='4' height='24' fill='#6d7686'/>"; }
    else if (gear === "mitre" || gear === 3) parts += "<path d='M38 44 Q50 16 62 44 Q56 40 50 40 Q44 40 38 44 Z' fill='" + shadeHex(col, .1) + "' stroke='" + col + "' stroke-width='1'/>";
    else if (gear === "crown") parts += "<path d='M33 42 L37 30 L43 40 L50 26 L57 40 L63 30 L67 42 Q50 36 33 42 Z' fill='#e8c766' stroke='#a9822a' stroke-width='.8'/>";
    else if (gear === "horns") parts += "<path d='M33 46 Q20 40 22 26 Q30 34 36 42 Z' fill='" + shadeHex(col, -.3) + "'/><path d='M67 46 Q80 40 78 26 Q70 34 64 42 Z' fill='" + shadeHex(col, -.3) + "'/>";
    else parts += "<path d='M31 52 Q34 36 50 35 Q66 36 69 52 Q60 44 50 44 Q40 44 31 52 Z' fill='#3a2f2a'/>";
    return "<svg viewBox='0 0 100 120' width='" + size + "' height='" + Math.round(size * 1.2) + "' xmlns='http://www.w3.org/2000/svg' style='display:block;border-radius:12px'>" + parts + "</svg>";
  }
  function shadeHex(hex, amt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = amt < 0 ? 1 + amt : 1; var add = amt > 0 ? amt * 255 : 0;
    r = Math.max(0, Math.min(255, Math.round(r * f + add))); g = Math.max(0, Math.min(255, Math.round(g * f + add))); b = Math.max(0, Math.min(255, Math.round(b * f + add)));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Clear, story-driven lines. You are a survivor whose village was burned by
  // Azhûl the Ash-Crowned; his servants across the realms stand between you and him.
  var TONE = {
    Luminar: { taunt: ["Even the Dawn knights kneel to Azhûl now. You can't win this.", "Go home, wanderer. Oh — you don't have one anymore, do you?"], win: ["You're not ready. Turn back while you still breathe."], lose: ["Then the road is yours. He waits at the end of it."] },
    Fangrend: { taunt: ["My pack follows the strongest, and that's Azhûl. Not you.", "You fight for the dead. We fight to keep living."], win: ["Grief isn't strength. You just proved it."], lose: ["You fight like someone with nothing left to lose. Go on."] },
    Brightmantle: { taunt: ["Your village burned and no god lifted a hand. Kneel to the one who did.", "I'll send you to the family you lost."], win: ["Anger made you careless — and dead."], lose: ["Maybe the gods sent you after all. Pass."] },
    Thornveil: { taunt: ["These woods eat trespassers, even grieving ones.", "Azhûl pays in gold. Your revenge pays nothing."], win: ["The forest keeps one more lost soul."], lose: ["Go. The way to his gate is clear."] },
    Gildharbor: { taunt: ["I sold your village's location to Azhûl. Just business.", "Everything's for sale here — including how badly you lose."], win: ["You should've spent more on your deck."], lose: ["All right, all right — you've bought your passage."] },
    Runespire: { taunt: ["I've read how this ends. You don't reach him.", "Azhûl rewrote fate itself. You can't out-fight destiny."], win: ["Exactly as the runes said."], lose: ["The future… changed. You changed it. How?"] },
    Karakhorde: { taunt: ["We ride under Azhûl's banner now. Join the horde or the dead.", "You're one rider. We are the whole storm."], win: ["Too slow to matter."], lose: ["Ride on, then. Take your storm to him."] },
    Ankhara: { taunt: ["Death doesn't frighten me. Should it frighten you?", "Your home is ash. Soon you will be too."], win: ["One more name for the tombs."], lose: ["Even the god-kings step aside. Go end him."] },
    Deepforge: { taunt: ["Azhûl paid me to build your ending. Here it is.", "Steel doesn't grieve. Steel just wins."], win: ["Back to the forge with you."], lose: ["Well struck. Maybe you can break him too."] },
    Almsgard: { taunt: ["I've lost more than you can imagine, and still I serve him.", "Set down your grudge. It only gets you killed."], win: ["Rest now. Your war ends here."], lose: ["Carry your grief to his gate, then. Go gently."] },
    Oathenhall: { taunt: ["I swore an oath to Azhûl, and I keep my oaths.", "Turn around now and I'll let you live."], win: ["An oath kept. You're turned away."], lose: ["My vow is spent. The road is yours."] },
    Aurelium: { taunt: ["The Legion has never lost — not to him, not to you.", "One grieving wanderer against an empire? Really?"], win: ["Undefeated, as always."], lose: ["Impossible… take that fire to the Ash-Crowned."] },
    Zolthec: { taunt: ["Azhûl promised us an endless sun. Your blood buys it.", "The eclipse is coming. You won't see past it."], win: ["The sun sets on you."], lose: ["The eclipse breaks. Go — end his reign."] },
    Noctavein: { taunt: ["Azhûl feeds us the fallen. You'll do nicely.", "Stay a while. Let me drink that grief of yours."], win: ["Drained, like all the rest."], lose: ["Such spite in you… his gate is that way."] },
    Balemaw: { taunt: ["I burned your village to draw you here. And here you stand.", "You crossed fifteen realms for revenge. Was it worth it?"], win: ["You were always going to lose. I made certain of it."], lose: ["Impossible… undone by a nobody from a village of ash…"] },
  };
  var PLAYER_LINES = ["Then get out of my way.", "I'm not turning back.", "Your master burned my home. You're just in the way.", "I've heard worse. Let's go.", "Step aside. My fight is with Azhûl."];
  // The six duels of a chapter tell one small, escalating story: from the first
  // wary guard to the lieutenant's right hand. Plain language, clear stakes.
  var DUEL_ARC = [
    { taunt: "So you're the one who walked out of that burning village. Word travels fast. You won't get past me, though.",
      win: "Go home, survivor. There's nothing down this road but more people like me.",
      lose: "All right… you're better than the stories said. But you'll never reach him." },
    { taunt: "I don't want to fight you, honestly. But Azhûl's people are watching, and I'd rather it be you than me.",
      win: "I warned you — this isn't a fight you can win.",
      lose: "Then go. I never saw you, and you never saw me." },
    { taunt: "You think losing everything makes you strong? I've watched a hundred angry people die on this road.",
      win: "Just another angry ghost for the pile.",
      lose: "…Maybe you really are different. Maybe." },
    { taunt: "The lieutenant pays me well to keep wanderers out. It's nothing personal — you're simply in the way.",
      win: "Should've taken the long way around, friend.",
      lose: "Keep walking, then. And don't tell anyone I lost." },
    { taunt: "You've come a long way. The lieutenant knows your name now — and trust me, that is not a good thing.",
      win: "So close. That's the sad part, really.",
      lose: "Then go and meet them. I won't stand in your way again." },
    { taunt: "I'm the last one between you and my master. Turn back now, or you will never see the throne of ash.",
      win: "The road ends here, survivor. It always did.",
      lose: "Impossible… go on, then. You've earned the right to face them." },
  ];
  function dialogueFor(opp, phase, won) {
    var seed = hashName(opp.name);
    var youLine = PLAYER_LINES[seed % PLAYER_LINES.length];
    if (!opp.isBoss) {
      var arc = DUEL_ARC[Math.min(opp.stage || 0, DUEL_ARC.length - 1)];
      if (phase === "pre") return [{ who: "them", text: arc.taunt }, { who: "you", text: youLine }];
      return [{ who: "them", text: won ? arc.lose : arc.win }];
    }
    var t = TONE[opp.realm] || { taunt: ["Face me."], win: ["You lose."], lose: ["Well fought."] };
    if (phase === "pre") return [{ who: "them", text: t.taunt[0] }, { who: "you", text: youLine }];
    var arr = won ? t.lose : t.win;
    return [{ who: "them", text: arr[seed % arr.length] }];
  }

  // full-screen cutscene: opponent portrait + text bubbles + Continue
  function cutscene(opp, phase, opts) {
    opts = opts || {};
    var lines = dialogueFor(opp, phase, opts.won);
    var el = $("screen-campaign");
    var m = Campaign.chapter(opp.chapter).mood;
    var bubbles = lines.map(function (l, i) {
      var mine = l.who === "you";
      return "<div class='bubble " + (mine ? "you" : "them") + "' style='animation-delay:" + (i * 0.45) + "s;" + (mine ? "align-self:flex-end;border-color:var(--accent)" : "") + "'>"
        + "<div class='who'>" + (mine ? "You" : esc(opp.name)) + "</div>" + esc(l.text) + "</div>";
    }).join("");
    var cont = phase === "pre" ? (opp.isBoss ? "To battle &#9876;" : "Begin the duel &#9876;") : "Continue &#8250;";
    el.innerHTML = "<div class='cut' style='background:radial-gradient(120% 90% at 28% 25%," + m.sky + "e6 0%,#05070c 82%)'>"
      + "<div class='cut-inner'>"
      + "<div class='cut-portrait'>" + portraitSVG(opp, 210)
      + "<div class='cut-name'>" + esc(opp.name) + "</div><div class='cut-title'>" + esc(opp.title || "") + (opp.title ? " &#183; " : "") + esc(opp.realm) + "</div></div>"
      + "<div class='cut-side'>" + bubbles + "<button class='mbtn primary cut-continue'>" + cont + "</button></div>"
      + "</div></div>";
    revealCampaign();
    var b = el.querySelector(".cut-continue"); if (b) b.onclick = function () { if (opts.onDone) opts.onDone(); };
  }

  /* ------------------------ battle result (campaign) -------------------- */
  MetaUI.onBattleEnd = function (winner) {
    if (!Campaign.active) return;
    var info = Campaign.active; Campaign.active = null;
    var won = winner === 0;
    var opp = Campaign.opponent(info.chapter, info.stage);
    var delay = (window.FX && FX.busy) ? 3400 : 300;
    setTimeout(function () {
      cutscene(opp, "post", { won: won, onDone: function () { showBattleResult(info.chapter, info.stage, won); } });
    }, delay);
  };
  function playResultBanner(won) {
    if (!document.getElementById("br-anim-style")) {
      var st = document.createElement("style"); st.id = "br-anim-style";
      st.textContent = "@keyframes brFade{from{opacity:0}to{opacity:1}}@keyframes brFadeOut{from{opacity:1}to{opacity:0}}"
        + "@keyframes brPop{0%{opacity:0;transform:scale(.5) rotate(-4deg)}60%{opacity:1;transform:scale(1.08) rotate(1deg)}100%{opacity:1;transform:scale(1) rotate(0)}}"
        + "@keyframes brRay{from{transform:rotate(0)}to{transform:rotate(360deg)}}";
      document.head.appendChild(st);
    }
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;animation:brFade .35s ease forwards;"
      + "background:radial-gradient(circle at 50% 45%," + (won ? "rgba(34,74,46,.6)" : "rgba(78,28,28,.6)") + " 0%,rgba(6,8,12,.86) 68%)";
    var col = won ? "#8fe0a0" : "#e79089";
    var glow = won ? "rgba(120,220,150,.55)" : "rgba(220,110,110,.5)";
    ov.innerHTML = "<div style='position:relative;text-align:center'>"
      + (won ? "<div style='position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px;background:repeating-conic-gradient(from 0deg," + glow + " 0deg 6deg,transparent 6deg 18deg);border-radius:50%;opacity:.18;animation:brRay 14s linear infinite'></div>" : "")
      + "<div style='position:relative;font-family:Cinzel,serif;font-size:62px;font-weight:800;letter-spacing:7px;color:" + col + ";text-shadow:0 0 34px " + glow + ";opacity:0;animation:brPop .6s cubic-bezier(.2,1.3,.4,1) .1s forwards'>"
      + (won ? "VICTORY" : "DEFEAT") + "</div></div>";
    document.body.appendChild(ov);
    setTimeout(function () { ov.style.animation = "brFadeOut .45s ease forwards"; setTimeout(function () { try { document.body.removeChild(ov); } catch (e) {} }, 440); }, 1450);
  }
  function showBattleResult(chapter, stage, won) {
    playResultBanner(won);
    var ch = Campaign.chapter(chapter);
    var el = $("screen-campaign");
    var body;
    if (won) {
      var res = Campaign.resolveWin(chapter, stage);
      var lines = "";
      if (res.coins) lines += "<div style='margin:6px 0;color:var(--warn)'>&#9679; +" + res.coins + " coins</div>";
      if (res.seals) lines += "<div style='margin:6px 0;color:var(--warn)'>&#9670; +" + res.seals + " Seals</div>";
      var cards = "";
      (res.unlocked || []).forEach(function (u) { cards += cardTile(u.id, u.rarity, true); });
      var newCards = res.unlocked && res.unlocked.length
        ? "<div style='color:var(--muted);font-size:13px;margin-top:10px'>New card" + (res.unlocked.length > 1 ? "s" : "") + " unlocked</div><div class='reveal'>" + cards + "</div>"
        : "";
      var moreStages = Campaign.nextStage(chapter) >= 0;
      var title = res.boss ? "Champion defeated!" : "Victory";
      var subtext = res.boss ? "The champion falls. " + (chapter < 15 ? "Chapter " + (chapter + 1) + " lies ahead." : "The campaign is won — every realm has fallen to you.") : "";
      body = "<h2 style='color:var(--good)'>" + title + "</h2>"
        + (subtext ? "<div style='color:var(--muted)'>" + subtext + "</div>" : "")
        + lines + newCards
        + "<div class='row'>"
        + (moreStages ? "<button class='mbtn primary' id='br-next'>Continue</button>" : (chapter < 15 ? "<button class='mbtn primary' id='br-nextch'>Next chapter</button>" : ""))
        + "<button class='mbtn' id='br-map'>Campaign map</button>"
        + "<button class='mbtn' id='br-store'>Store</button></div>";
    } else {
      var loss = Campaign.resolveLoss(chapter, stage);
      var lossLine = (loss && loss.coins)
        ? "<div style='margin:6px 0;color:var(--warn)'>&#9679; +" + loss.coins + " coins for the effort</div>"
        : "";
      body = "<h2 style='color:var(--bad)'>Defeat</h2>"
        + lossLine
        + "<div class='row'><button class='mbtn primary' id='br-retry'>Retry duel</button>"
        + "<button class='mbtn' id='br-map'>Campaign map</button></div>";
    }
    el.innerHTML = "<div class='mover'><div class='mmodal'>" + body + "</div></div>";
    revealCampaign();
    var hook = function (id, fn) { var b = $(id); if (b) b.onclick = fn; };
    hook("br-next", function () { openChapter(chapter); });
    hook("br-nextch", function () { openChapter(Math.min(15, chapter + 1)); });
    hook("br-retry", function () { prepBattle(chapter, stage); });
    hook("br-map", function () { renderCampaign(); revealCampaign(); });
    hook("br-store", function () { UI.show("store"); });
    renderChip();
  }

  /* -------------------------------- store ------------------------------- */
  var PACK_ICON = { wayfarer: "&#127890;", reliquary: "&#128142;", vault: "&#128081;" };
  var PACK_TINT = { wayfarer: "#3a4256", reliquary: "#243a5a", vault: "#4a3a12" };
  function renderStore() {
    var el = $("screen-store"); if (!el) return;
    var html = "<div class='mpanel'><div class='mhead'><h2>Store</h2>"
      + "<span class='sub'><span style='color:var(--warn)'>&#9679; " + Meta.coins() + "</span> coins &nbsp; <span style='color:var(--warn)'>&#9670; " + Meta.seals() + "</span> Seals</span></div>"
      + "<div class='sub'>Every pack gives 3 cards — heroes plus a chance at realm support cards. Duplicates convert back to coins. Earn Seals by beating campaign bosses.</div>"
      + "<div class='pack-grid'>";
    Store.packs.forEach(function (p) {
      var afford = Store.canAfford(p.id);
      var odds = p.odds.map(function (o) { return "<div>" + o[0] + " &#183; " + o[1] + "%</div>"; }).join("");
      var cur = p.cur === "seal" ? "&#9670;" : "&#9679;";
      html += "<div class='pack' style='background:linear-gradient(160deg," + PACK_TINT[p.id] + " 0%,#0b0e14 100%)'>"
        + "<div class='pi'>" + (PACK_ICON[p.id] || "&#127183;") + "</div>"
        + "<div class='pn'>" + esc(p.name) + "</div>"
        + "<div class='pb'>" + esc(p.blurb) + "</div>"
        + "<div class='odds'>" + odds + "</div>"
        + "<button data-p='" + p.id + "' " + (afford ? "" : "disabled") + ">" + cur + " " + p.price + " &#183; Open</button>"
        + "</div>";
    });
    html += "</div><div style='margin-top:18px;text-align:center'><button class='mbtn' id='st-back'>Back to menu</button> <button class='mbtn' id='st-cmp'>Campaign</button></div></div>";
    el.innerHTML = html;
    el.querySelectorAll("[data-p]").forEach(function (b) { if (!b.disabled) b.onclick = function () { openPack(b.getAttribute("data-p")); }; });
    var back = $("st-back"); if (back) back.onclick = function () { backToSplash(); };
    var cmp = $("st-cmp"); if (cmp) cmp.onclick = function () { UI.show("campaign"); };
  }
  function openPack(id) {
    var r = Store.open(id);
    if (r.err) { UI.toast && UI.toast(r.err); return; }
    var el = $("screen-store");
    var reveal = r.cards.map(function (c, i) {
      return "<div style='animation:cardIn .5s ease " + (0.15 + i * 0.5) + "s both'>" + cardTile(c.id, c.rarity, !c.dup, c.dup ? ("+" + c.refund + " coins") : "") + "</div>";
    }).join("");
    var refundLine = r.refund ? "<div style='color:var(--muted);font-size:13px;margin-top:6px'>Duplicates refunded " + r.refund + " coins.</div>" : "";
    el.innerHTML = "<div class='mover'><div class='mmodal'><h2>" + esc(Store.pack(id).name) + "</h2>"
      + "<div class='reveal'>" + reveal + "</div>" + refundLine
      + "<div class='row'><button class='mbtn primary' id='pk-again' " + (Store.canAfford(id) ? "" : "disabled") + ">Open another</button>"
      + "<button class='mbtn' id='pk-store'>Back to store</button></div></div></div>";
    var again = $("pk-again"); if (again && !again.disabled) again.onclick = function () { openPack(id); };
    var st = $("pk-store"); if (st) st.onclick = function () { renderStore(); };
    renderChip();
  }

  /* ------------------------------ card tile ----------------------------- */
  function cardTile(id, rarity, isNew, badge) {
    var c = cardById(id) || {}; var col = RC[rarity] || "#9aa4b2";
    return "<div class='mcard' style='border-color:" + col + "88'>"
      + (isNew ? "<div style='font-size:9px;letter-spacing:1px;color:" + col + ";font-weight:700'>NEW</div>" : "<div style='height:12px'></div>")
      + "<div class='nm'>" + esc(c.name || id) + "</div>"
      + "<div class='rl'>" + esc(c.realm || "") + "</div>"
      + "<div class='st'>" + (c.atk != null ? c.atk + " / " + c.hp : "") + "</div>"
      + "<div class='rr' style='color:" + col + "'>" + esc(rarity || "") + "</div>"
      + (badge ? "<div style='font-size:11px;color:var(--warn);margin-top:3px'>" + esc(badge) + "</div>" : "")
      + "</div>";
  }

  /* ----------------------- wrap UI.show for new screens ----------------- */
  function wrapShow() {
    if (UI.__metaWrapped) return; UI.__metaWrapped = true;
    var _show = UI.show.bind(UI);
    UI.show = function (screen) {
      // leaving the board on a non-game screen ends any campaign battle context
      if (screen !== "game" && Campaign.active) Campaign.active = null;
      EXTRA.forEach(function (id) { var e = $("screen-" + id); if (e) e.classList.remove("visible"); });
      if (EXTRA.indexOf(screen) >= 0) {
        UI.screen = screen;
        ["setup", "game", "decks", "cards", "rules"].forEach(function (c) { var e = $("screen-" + c); if (e) e.classList.remove("visible"); });
        var e = $("screen-" + screen); if (e) e.classList.add("visible");
        if (document.body) document.body.classList.remove("on-splash");
        if (screen === "login") renderLogin();
        else if (screen === "campaign") renderCampaign();
        else if (screen === "store") renderStore();
        window.scrollTo(0, 0);
        return;
      }
      _show(screen);
    };
  }

  /* -------------------- per-profile deck persistence -------------------- */
  function wrapDecks() {
    if (typeof saveDecks === "function" && !saveDecks.__metaWrapped) {
      var _sd = saveDecks;
      window.saveDecks = function (list) { var r = _sd(list); try { window.__metaSyncDecksToProfile(list); } catch (e) {} return r; };
      window.saveDecks.__metaWrapped = true;
    }
  }

  /* -------------------------------- init -------------------------------- */
  function init() {
    if (!window.Meta) return;
    Meta.load();
    injectStyle();
    injectScreens();
    wrapShow();
    wrapDecks();
    renderChip();
    renderSplashMenu();
    MetaUI.refresh = function () { renderChip(); renderSplashMenu(); };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 0); });
  else setTimeout(init, 0);

  /* TESTING CHEAT — Ctrl+Shift+U unlocks every card for the signed-in profile. */
  document.addEventListener("keydown", function (e) {
    if (!(e.shiftKey && (e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u"))) return;
    e.preventDefault();
    if (!(window.Meta && Meta.current && Meta.current())) { alert("Sign in to a profile first, then press Ctrl+Shift+U."); return; }
    var r = Meta.grantAllCards();
    if (r && r.ok) {
      try { if (window.MetaUI && MetaUI.refresh) MetaUI.refresh(); } catch (x) {}
      try { if (typeof Decks !== "undefined" && Decks.renderCollection) { Decks.renderRealms && Decks.renderRealms(); Decks.renderCollection(); } } catch (x) {}
      try { if (typeof renderCampaign === "function") renderCampaign(); } catch (x) {}
      if (r.reverted) alert("Cheat OFF — restored your earned collection (" + r.count + " cards).");
      else alert("Cheat ON — unlocked all " + r.count + " cards (and stocked coins/seals). Press Ctrl+Shift+U again to revert.");
    } else { alert((r && r.err) || "Could not unlock cards."); }
  });
})();
