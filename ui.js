// Mortalis: Realms playtest UI — rendering + interaction. Engine logic lives in engine.js.
"use strict";

const $ = (id) => document.getElementById(id);

// Authoring tools are for maintaining the game, not for playing it. They stay
// hidden unless the page is opened with ?dev=1, which also survives a reload
// via localStorage so the flag only has to be typed once.
const DEV = (() => {
  try {
    const q = typeof location !== "undefined" && /[?&]dev=([01])/.exec(location.search || "");
    if (q) { localStorage.setItem("mr_dev", q[1]); return q[1] === "1"; }
    return localStorage.getItem("mr_dev") === "1";
  } catch (e) { return false; }
})();

const UI = {
  screen: "setup",
  sel: [],            // selected attacker lane indexes
  pending: null,      // {type:'hero'|'lane'|'hand', msg, cands, resolve, allowCancel}
  setup: { difficulty: "medium", aiMode: "random", first: "random", mine: [], ai: [] },
  sandboxOpen: false,
  busy: false,        // true during AI turn

  freeTargeting() { return $("free-target") && $("free-target").checked; },

  /* ---------------- screens & tabs ---------------- */
  show(screen) {
    UI.screen = screen;
    for (const s of ["setup", "game", "cards", "rules"]) $("screen-" + s).classList.toggle("visible", s === screen);
    const tab = (id, on) => { const b = $(id); if (b) b.classList.toggle("active-tab", on); };
    tab("tab-play", screen === "setup" || screen === "game");
    tab("tab-cards", screen === "cards");
    tab("tab-rules", screen === "rules");
    if (screen === "cards") Editor.render();
    if (screen === "rules") RulesTab.render();
  },

  toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(() => { t.style.display = "none"; }, 3500);
  },

  onLog() { UI.renderLog(); },

  /* ---------------- pickers (promise-based) ---------------- */
  pickHero(msg, cands, allowCancel) {
    return new Promise(res => {
      UI.pending = { type: "hero", msg, cands, resolve: res, allowCancel: allowCancel !== false };
      UI.render();
    });
  },
  pickLane(msg, side, lanes) {
    return new Promise(res => {
      UI.pending = { type: "lane", msg, side, lanes, resolve: res, allowCancel: true };
      UI.render();
    });
  },
  pickHandCard(msg) {
    return new Promise(res => {
      UI.pending = { type: "hand", msg, resolve: res, allowCancel: false };
      UI.render();
    });
  },
  settlePending(val) {
    if (!UI.pending) return;
    const r = UI.pending.resolve;
    UI.pending = null;
    r(val);
    UI.render();
  },

  /* ---------------- rendering ---------------- */
  render() {
    if (!G) return;
    $("turn-ind").textContent = G.over ? `GAME OVER — ${G.players[G.winner].name} wins` :
      `Turn ${Math.ceil(G.gt / 2)} — ${G.players[G.active].name}${G.active === 0 ? " (you)" : ""}`;
    let selMsg = "";
    if (UI.sel.length) {
      const lt = legalTargetsFor(0, UI.sel);
      selMsg = (lt.heroes.length || lt.face)
        ? `${UI.sel.length} attacker${UI.sel.length > 1 ? "s" : ""} selected — click a red target (or click Hero again to deselect)`
        : `No legal targets for this attack — a protection, redirect-block, or Onslaught lane rule is preventing it. Click the Hero${UI.sel.length > 1 ? "es" : ""} again to deselect.`;
    }
    $("prompt").textContent = UI.pending ? UI.pending.msg : selMsg;
    $("btn-cancel").style.display = UI.pending && UI.pending.allowCancel ? "" : "none";
    $("btn-endturn").disabled = UI.busy || G.over || G.active !== 0 || !!UI.pending;
    $("btn-undo").disabled = UI.busy;

    const you = G.players[0], ai = G.players[1];
    $("ai-name").textContent = ai.name;
    $("ai-mort").textContent = ai.mortality;
    $("ai-pulse").textContent = ai.pulse;
    $("ai-hand").textContent = ai.hand.length;
    $("ai-deck").textContent = ai.deck.length;
    $("my-mort").textContent = you.mortality;
    $("my-pulse").textContent = you.pulse;
    $("my-deck").textContent = you.deck.length;

    // face targeting highlight
    const faceTarget = UI.sel.length && legalTargetsFor(0, UI.sel).face;
    $("ai-face").classList.toggle("targetable", !!faceTarget);

    FX.capture();                 // measure the outgoing hand before we wipe it

    UI.renderSlots("ai-slots", 1);
    UI.renderSlots("my-slots", 0);
    UI.renderLanes("ai-lanes", 1);
    UI.renderLanes("my-lanes", 0);
    UI.renderDeck("ai-deckpile", 1);
    UI.renderDeck("my-deckpile", 0);
    UI.renderOppHand();
    UI.renderHand();
    UI.renderLog();

    FX.settle();                  // diff against the previous frame and fly cards
  },

  /* deck pile — the approved card back, with the count remaining */
  renderDeck(elId, pi) {
    const el = $(elId);
    if (!el) return;
    const n = G.players[pi].deck.length;
    el.className = "deckpile" + (n === 0 ? " empty" : "");
    el.title = `${G.players[pi].name}'s deck — ${n} card${n === 1 ? "" : "s"} remaining`;
    el.innerHTML =
      `<div class="pl p1"></div><div class="pl p2"></div>` +
      `<div class="pl top">${n ? cardBackSVG(true) : ""}</div>` +
      `<div class="dcount">${n}</div>`;
  },

  /* the opponent's hand, face down — you see how many cards they hold */
  renderOppHand() {
    const el = $("ai-hand-cards");
    if (!el) return;
    el.innerHTML = "";
    const n = G.players[1].hand.length;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "oppcard";
      d.innerHTML = cardBackSVG();
      el.appendChild(d);
    }
    if (!n) {
      const e = document.createElement("div");
      e.className = "handempty";
      e.textContent = "no cards in hand";
      el.appendChild(e);
    }
  },

  statSpan(base, eff) {
    const cls = eff > base ? "buffed" : eff < base ? "nerfed" : "";
    return `<span class="${cls}">${eff}</span>`;
  },

  renderLanes(elId, pi) {
    const el = $(elId);
    el.innerHTML = "";
    const P = G.players[pi];
    const sched = C().laneUnlockTurns || [];
    P.lanes.forEach((L, li) => {
      const col = realmColor(L.realm);
      const unlocked = laneUnlocked(pi, li);
      const lane = document.createElement("div");
      lane.className = "lane" + (unlocked ? "" : " locked");
      lane.style.setProperty("--lc", col);

      // ---- realm cap ----
      const cap = document.createElement("div");
      cap.className = "lane-cap";
      cap.innerHTML = `${realmCrest(L.realm, 15, "#12151c", "rgba(18,21,28,.55)")}<span>${L.realm}</span>`;
      lane.appendChild(cap);

      const body = document.createElement("div");
      body.className = "lane-body";

      if (!unlocked) {
        const s = document.createElement("div");
        s.className = "heroslot";
        s.textContent = `unlocks turn ${sched[li] || "?"}`;
        body.appendChild(s);
        lane.appendChild(body);
        el.appendChild(lane);
        return;
      }

      // ---- hero ----
      const heroBox = document.createElement("div");
      if (L.hero) {
        const c = cardById(L.hero.cardId);
        const div = document.createElement("div");
        div.className = "herocard";
        const atk = effAtk(pi, li), hp = curHp(pi, li), mhp = effMaxHp(pi, li);
        if (pi === G.active && L.hero.attacksUsed >= maxAttacksOf(pi, li)) div.classList.add("exhausted");
        if (pi === 0 && UI.sel.includes(li)) div.classList.add("selected");
        if (UI.targetableHeroes().some(t => t.pi === pi && t.li === li)) div.classList.add("targetable");
        // an armed "block the next attack" ward is invisible otherwise, which
        // makes cards like Benedar look as though they did nothing
        const wardPill = (P.blockAtkGt >= G.gt && !P.blockAtkUsed && P.blockAtkLane === li)
          ? `<span class="pill ward" title="The first attack declared against your Heroes on your opponent's next turn is blocked.">ward armed</span>` : "";
        const relicPills = wardPill + L.hero.relics.map(r => `<span class="pill relic" data-ruid="${r.uid}" title="${(cardById(r.cardId).text || "").replace(/"/g, "&quot;")}">${cardById(r.cardId).name}${r.counters ? " ⚒" + r.counters : ""}</span>`).join(" ");
        const freeRelic = C().relicSlotsPerHero - L.hero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0);
        div.innerHTML = `<div class="cost-orb">${c.cost}</div>
          <div class="nm">${c.name}</div>
          <div class="txt">${c.text}</div>
          <div class="statbar"><span class="atk">${UI.statSpan(c.atk, atk)}</span><span class="rar">${c.rarity || ""}</span><span class="hp">${UI.statSpan(c.hp, hp)}${hp !== mhp ? `<span class="mx">/${mhp}</span>` : ""}</span></div>
          ${relicPills || freeRelic > 0 ? `<div class="relicrow">${relicPills}${freeRelic > 0 ? `<span class="pill dim">${freeRelic} relic slot${freeRelic > 1 ? "s" : ""}</span>` : ""}</div>` : ""}
          ${autoLevel(c) === "manual" ? '<span class="badge-manual" title="Ability not scripted — adjudicate manually"></span>' : ""}`;
        div.onmouseenter = () => INS.hero(pi, li);
        div.onmouseleave = () => INS.clear();
        div.onclick = (e) => { e.stopPropagation(); UI.clickBoardHero(pi, li); };
        div.ondblclick = (e) => { e.stopPropagation(); UI.sel = UI.sel.filter(x => x !== li || pi !== 0); UI.zoomCard(c, { kind: "boardHero", pi, li }); };
        heroBox.appendChild(div);
        // Relic pills open the Relic itself — its text, and its activated abilities
        div.querySelectorAll(".pill.relic").forEach(p => {
          p.onclick = (e) => {
            e.stopPropagation();
            const r = L.hero.relics.find(x => String(x.uid) === p.dataset.ruid);
            if (r) UI.zoomCard(cardById(r.cardId), { kind: "relic", pi, li, relicUid: r.uid });
          };
          p.onmouseenter = (e) => {
            e.stopPropagation();
            const r = L.hero.relics.find(x => String(x.uid) === p.dataset.ruid);
            if (r) INS.card(cardById(r.cardId), INS.row("attached to", cardById(L.hero.cardId).name) + (r.counters ? INS.row("forge counters", "+" + (10 * r.counters) + "/+" + (10 * r.counters), "#a8e08a") : ""));
          };
        });
      } else {
        const slot = document.createElement("div");
        slot.className = "heroslot";
        slot.textContent = "empty lane";
        if (UI.pending && UI.pending.type === "lane" && UI.pending.side === pi && UI.pending.lanes.includes(li)) {
          slot.classList.add("eligible");
          slot.textContent = "play here";
          slot.onclick = (e) => { e.stopPropagation(); UI.settlePending(li); };
        }
        heroBox.appendChild(slot);
      }
      if (L.hero && UI.pending && UI.pending.type === "lane" && UI.pending.side === pi && UI.pending.lanes.includes(li)) {
        heroBox.firstChild.classList.add("targetable");
        heroBox.firstChild.onclick = (e) => { e.stopPropagation(); UI.settlePending(li); };
      }

      // ---- aux slots (show what's in them) ----
      const auxWrap = document.createElement("div");
      auxWrap.className = "auxwrap";
      const seen = new Set();
      L.aux.forEach((a) => {
        if (a && seen.has(a.uid)) return;          // 2-slot aux renders once, spanning
        const s = document.createElement("div");
        if (a) {
          seen.add(a.uid);
          const c = cardById(a.cardId);
          const span = (c.auxSlots || 1) > 1;
          s.className = "auxslot filled" + (span ? " span2" : "");
          s.innerHTML = `<span class="auxtag">AUX${span ? " ×2" : ""}</span><span class="auxnm">${c.name}</span><span class="auxfx">${UI.auxSummary(c)}</span>`;
          s.title = c.auxText || "";
          s.onmouseenter = () => INS.card(c, INS.row("mode", "Auxiliary in lane " + (li + 1)) + `<div style="color:#9aa4b6;margin-top:4px">${c.auxText || ""}</div><div style="color:#6f7b8c;font-size:11px;margin-top:4px">Hero-mode text:</div>`);
          s.onmouseleave = () => INS.clear();
          s.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "aux", pi, li, auxUid: a.uid }); };
        } else {
          s.className = "auxslot";
          s.textContent = "open aux";
        }
        auxWrap.appendChild(s);
      });

      // ---- support cards belonging to THIS lane ----
      const supWrap = document.createElement("div");
      supWrap.className = "supwrap";
      const mine = P.slots.map((s, si) => ({ s, si })).filter(x => x.s && x.s.laneIdx === li);
      if (!mine.length) {
        const empty = document.createElement("div");
        empty.className = "supslot";
        empty.textContent = "support slot";
        supWrap.appendChild(empty);
      } else mine.forEach(({ s, si }) => {
        const c = cardById(s.cardId);
        const st = SUPPORT_STYLE[s.kind] || SUPPORT_STYLE.hex;
        const d = document.createElement("div");
        d.className = "supslot filled";
        d.style.setProperty("--sc", st.col);
        d.style.setProperty("--sbg", st.bg);
        const hidden = s.kind === "hex" && s.faceDown && pi === 1;
        let label;
        if (hidden) label = "face-down Hex";
        else if (s.kind === "rite") {
          const r = fx(s.cardId).rite;
          label = `${c.name} · ${s.counters}/${(r && (r.timer || r.counterMax)) || "?"}`;
        } else label = c.name;
        d.innerHTML = `<svg viewBox="0 0 12 12" width="11" height="11" style="color:${st.col}">${st.glyph}</svg><span>${label}</span>${s.kind === "hex" && s.faceDown && pi === 0 ? '<span class="fd">set</span>' : ""}`;
        if (!hidden) {
          d.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "slot", pi, si }); };
          d.onmouseenter = () => INS.card(c, INS.row("lane", String(li + 1)) + (s.kind === "rite" ? INS.row("progress", s.counters + " counters") : ""));
          d.onmouseleave = () => INS.clear();
        } else {
          d.onmouseenter = () => INS.show(`<div style="color:#c7aee8">A face-down Hex is set in this lane.</div><div style="color:#8a93a4;margin-top:4px">You won't see what it is until it triggers — attacking into this lane is a risk.</div>`);
          d.onmouseleave = () => INS.clear();
        }
        supWrap.appendChild(d);
      });

      // opponent half mirrors: support outermost, hero nearest the midline
      if (pi === 1) { body.appendChild(supWrap); body.appendChild(auxWrap); body.appendChild(heroBox); }
      else { body.appendChild(heroBox); body.appendChild(auxWrap); body.appendChild(supWrap); }
      lane.appendChild(body);
      el.appendChild(lane);
    });
  },

  // one-line gist of an Auxiliary card's effect for the slot label
  auxSummary(c) {
    const t = (c.auxText || "").replace(/^While in this slot,?\s*/i, "").replace(/^When this card enters play,?\s*/i, "");
    return t.length > 46 ? t.slice(0, 44).trim() + "…" : t;
  },

  renderSlots(elId, pi) {
    // Lane-bound support cards render inside their lane; this strip shows
    // lane-less cards (Pacts) plus how many shared slots remain.
    const el = $(elId);
    el.innerHTML = "";
    const P = G.players[pi];
    let shown = 0;
    P.slots.forEach((s, si) => {
      if (!s || s.laneIdx != null) return;
      shown++;
      const c = cardById(s.cardId);
      const st = SUPPORT_STYLE[s.kind] || SUPPORT_STYLE.pact;
      const d = document.createElement("div");
      d.className = "sharedslot filled";
      d.style.setProperty("--sc", st.col);
      d.style.setProperty("--sbg", st.bg);
      d.innerHTML = `<svg viewBox="0 0 12 12" width="10" height="10" style="color:${st.col}">${st.glyph}</svg><span>${c.name}</span>`;
      d.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "slot", pi, si }); };
      el.appendChild(d);
    });
    const free = P.slots.filter(s => !s).length;
    const info = document.createElement("div");
    info.className = "slotfree";
    info.textContent = shown ? `${free} of ${P.slots.length} slots open` : `${free} of ${P.slots.length} shared slots open`;
    el.appendChild(info);
  },

  renderHand() {
    const el = $("hand");
    el.innerHTML = "";
    const P = G.players[0];
    P.hand.forEach((cid, hi) => {
      const c = cardById(cid);
      const d = document.createElement("div");
      d.className = "handcard";
      const o = playOptions(0, hi);
      const playable = o.heroLanes.length || o.auxLanes.length || o.relicLanes.length || o.hexLanes.length || o.riteLanes.length || o.spell;
      if (!playable) d.classList.add("unaffordable");
      const typeLabel = c.type === "hero" ? `Hero ${c.cost} · Aux ${Math.max(1, c.auxCost != null ? c.auxCost : c.cost - C().auxDiscount)}` :
        c.type[0].toUpperCase() + c.type.slice(1) + " · " + c.cost + (c.type === "relic" ? ` · ${c.slots} slot${c.slots > 1 ? "s" : ""}` : "");
      d.innerHTML = `<div class="nm">${c.name}</div>
        <div class="meta">${c.realm}</div>
        <div class="meta">${typeLabel}${c.type === "hero" ? ` · ${c.atk}/${c.hp}` : ""}</div>
        ${autoLevel(c) === "manual" ? '<span class="badge-manual" title="Not scripted — adjudicate manually"></span>' : ""}`;
      if (UI.pending && UI.pending.type === "hand") {
        d.style.outline = "3px solid var(--accent)";
        d.onclick = (e) => { e.stopPropagation(); UI.settlePending(hi); };
      } else {
        d.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "hand", hi }); };
      }
      el.appendChild(d);
    });
  },

  renderLog() {
    if (!G) return;
    const el = $("log");
    el.innerHTML = G.log.map(l => `<div class="${l.cls}">${l.msg}</div>`).join("");
    el.scrollTop = el.scrollHeight;
  },

  /* ---------------- board interaction ---------------- */
  targetableHeroes() {
    if (UI.pending && UI.pending.type === "hero") return UI.pending.cands;
    if (UI.sel.length) return legalTargetsFor(0, UI.sel).heroes;
    return [];
  },

  async clickBoardHero(pi, li) {
    // pending hero pick? (must come before the busy gate — mid-combat prompts
    // like Marquessa's kill reward appear while an attack is still resolving)
    if (UI.pending && UI.pending.type === "hero") {
      if (UI.pending.cands.some(t => t.pi === pi && t.li === li)) UI.settlePending({ pi, li });
      return;
    }
    if (UI.busy) return;
    if (UI.pending) return;
    if (pi === 0) {
      // toggle attacker selection, or zoom if it can't attack
      if (G.active === 0 && canAttack(0, li)) {
        const i = UI.sel.indexOf(li);
        if (i >= 0) UI.sel.splice(i, 1); else UI.sel.push(li);
        UI.render();
      } else UI.zoomCard(cardById(G.players[0].lanes[li].hero.cardId), { kind: "boardHero", pi, li });
    } else {
      // attack target?
      if (UI.sel.length && legalTargetsFor(0, UI.sel).heroes.some(t => t.pi === pi && t.li === li)) {
        const attackers = UI.sel.slice();
        UI.sel = [];
        UI.busy = true;
        pushUndo();
        await resolveAttack(0, attackers, { pi, li });
        UI.busy = false;
        UI.render();
      } else UI.zoomCard(cardById(G.players[1].lanes[li].hero.cardId), { kind: "boardHero", pi, li });
    }
  },

  async clickFace(pi) {
    if (UI.busy || pi !== 1) return;
    if (UI.sel.length && legalTargetsFor(0, UI.sel).face) {
      const attackers = UI.sel.slice();
      UI.sel = [];
      UI.busy = true;
      pushUndo();
      await resolveAttack(0, attackers, { face: true });
      UI.busy = false;
      UI.render();
    }
  },

  /* ---------------- zoom overlay ---------------- */
  zoomCard(c, ctx) {
    ctx = ctx || {};
    const big = $("bigcard");
    let modes = "";
    if (c.type === "hero") {
      modes = `<div class="mode">Hero Mode — Cost: ${c.cost} Pulse | ${c.atk}/${c.hp} | ${c.rarity || ""}</div>
        <p class="body">${c.text}</p>
        <div class="mode">Auxiliary Mode — Cost: ${c.auxCost} Pulse | ${c.auxSlots} slot${c.auxSlots > 1 ? "s" : ""}</div>
        <p class="body">${c.auxText}</p>`;
    } else if (c.type === "relic") {
      modes = `<div class="mode">${c.slots} slot${c.slots > 1 ? "s" : ""} | Cost: ${c.cost} Pulse</div><p class="body">${c.text}</p>`;
    } else {
      modes = `<div class="mode">Cost: ${c.cost} Pulse</div><p class="body">${c.text}</p>`;
    }
    let live = "";
    if (ctx.kind === "relic") {
      const h2 = heroAt({ pi: ctx.pi, li: ctx.li });
      const r2 = h2 && h2.relics.find(x => x.uid === ctx.relicUid);
      if (r2 && ctx.pi === 0 && G.active === 0 && !G.over) {
        fx(r2.cardId).activated.forEach((ab, i) => {
          const used = r2.usedAb && r2.usedAb[i];
          UI.addAction((used ? "Used this turn — " : "Activate: ") + ab.raw.slice(0, 60) + (ab.ops ? "" : " (manual)"),
            async () => { pushUndo(); await activateAbility(0, ctx.li, r2, cardById(r2.cardId).name, ab, i, r2); }, !used && !!ab.ops);
        });
      }
    }
    if (ctx.kind === "boardHero" && heroAt({ pi: ctx.pi, li: ctx.li })) {
      const h = heroAt({ pi: ctx.pi, li: ctx.li });
      live = `<div class="live">In play: <b>${effAtk(ctx.pi, ctx.li)} ATK · ${curHp(ctx.pi, ctx.li)}/${effMaxHp(ctx.pi, ctx.li)} HP</b>
        ${h.relics.length ? "<br>Relics: " + h.relics.map(r => cardById(r.cardId).name).join(", ") : ""}</div>`;
    }
    const lvl = autoLevel(c);
    const manualNote = lvl !== "auto" ? `<div class="manual-note">${lvl === "manual" ? "This card's effect is not scripted — the engine plays it for stats/cost and you adjudicate the text with sandbox tools." : "Partially scripted: " + fx(c.id).autoBits.concat(fx(c.id).auxAutoBits || []).join(", ") + "."}</div>` : "";
    big.innerHTML = `<div class="hdr"><span class="nm">${c.name}</span><span class="realm">${c.realm}</span></div>
      <div class="sub">${c.type[0].toUpperCase() + c.type.slice(1)}${c.rarity ? " · " + c.rarity : ""}</div>
      ${modes}${live}${manualNote}<div class="actions" id="zoom-actions"></div>`;
    $("overlay").classList.add("visible");
    UI.buildZoomActions(c, ctx);
  },

  closeZoom() { $("overlay").classList.remove("visible"); },

  addAction(label, fn, primary) {
    const b = document.createElement("button");
    b.textContent = label;
    if (primary) b.className = "primary";
    b.onclick = async (e) => { e.stopPropagation(); UI.closeZoom(); await fn(); UI.render(); };
    $("zoom-actions").appendChild(b);
  },

  buildZoomActions(c, ctx) {
    const A = $("zoom-actions");
    A.innerHTML = "";
    if (ctx.kind === "hand" && G.active === 0 && !G.over && !UI.busy) {
      const o = playOptions(0, ctx.hi);
      if (c.type === "hero") {
        if (o.heroLanes.length) UI.addAction(`Play as Hero (${c.cost})`, async () => {
          const li = await UI.pickLane("Choose a lane for " + c.name, 0, o.heroLanes);
          if (li != null) { pushUndo(); await playHero(0, ctx.hi, li); }
        }, true);
        if (o.auxLanes.length) UI.addAction(`Play as Aux (${o.auxCost})`, async () => {
          const li = await UI.pickLane("Choose a lane for the Auxiliary", 0, o.auxLanes);
          if (li != null) { pushUndo(); await playAux(0, ctx.hi, li); }
        });
      }
      if (c.type === "relic" && o.relicLanes.length) UI.addAction(`Equip (${c.cost})`, async () => {
        const li = await UI.pickLane("Choose a Hero to equip", 0, o.relicLanes);
        if (li != null) { pushUndo(); playRelic(0, ctx.hi, li); }
      }, true);
      if (c.type === "hex" && o.hexLanes.length) UI.addAction("Set face-down (free)", async () => {
        const li = await UI.pickLane("Choose the lane this Hex watches", 0, o.hexLanes);
        if (li != null) { pushUndo(); setHex(0, ctx.hi, li); }
      }, true);
      if (c.type === "rite" && o.riteLanes.length) UI.addAction(`Begin Rite (${c.cost})`, async () => {
        const li = await UI.pickLane("Choose the lane for this Rite", 0, o.riteLanes);
        if (li != null) { pushUndo(); playRite(0, ctx.hi, li); }
      }, true);
      if ((c.type === "pact" || c.type === "incantation") && o.spell) UI.addAction(`Cast (${c.cost})`, async () => {
        pushUndo();
        UI.busy = false;
        await playSpell(0, ctx.hi);
      }, true);
    }
    if (ctx.kind === "boardHero" && heroAt({ pi: ctx.pi, li: ctx.li })) {
      const t = { pi: ctx.pi, li: ctx.li };
      const h = heroAt(t);
      // activated abilities ("Once per turn, you may…") — yours, on your turn
      if (ctx.pi === 0 && G.active === 0 && !G.over && !UI.busy) {
        fx(c.id).activated.forEach((ab, i) => {
          const used = h.usedAb && h.usedAb[i];
          UI.addAction((used ? "Used this turn — " : "Activate: ") + ab.raw.slice(0, 70) + (ab.ops ? "" : " (manual)"),
            async () => { pushUndo(); await activateAbility(0, ctx.li, h, c.name, ab, i); }, !used && !!ab.ops);
        });
        h.relics.forEach(r => {
          const rc = cardById(r.cardId);
          fx(r.cardId).activated.forEach((ab, i) => {
            const used = r.usedAb && r.usedAb[i];
            UI.addAction((used ? "Used this turn — " : "Activate ") + rc.name + ": " + ab.raw.slice(0, 50) + (ab.ops ? "" : " (manual)"),
              async () => { pushUndo(); await activateAbility(0, ctx.li, r, rc.name, ab, i, r); });
          });
        });
      }
      // manual adjudication controls — always available, both sides
      UI.addAction("−10 HP", () => { pushUndo(); dealDamage(t, 10, { sourceName: "manual" }); });
      UI.addAction("+10 heal", () => { pushUndo(); h.dmg = Math.max(0, h.dmg - 10); });
      UI.addAction("+10 ATK", () => { pushUndo(); h.permAtk += 10; });
      UI.addAction("−10 ATK", () => { pushUndo(); h.permAtk -= 10; });
      UI.addAction("+10 max HP", () => { pushUndo(); h.permHp += 10; });
      UI.addAction("Destroy", () => { pushUndo(); destroyHero(t.pi, t.li, null, {}); });
    }
    if (ctx.kind === "aux" && ctx.pi === 0) {
      const inst = G.players[0].lanes[ctx.li].aux.find(a => a && a.uid === ctx.auxUid);
      if (inst && G.active === 0 && !G.over && !UI.busy) {
        fx(c.id).auxActivated.forEach((ab, i) => {
          const used = inst.usedAb && inst.usedAb[i];
          UI.addAction((used ? "Used this turn — " : "Activate: ") + ab.raw.slice(0, 70) + (ab.ops ? "" : " (manual)"),
            async () => { pushUndo(); await activateAbility(0, ctx.li, inst, c.name, ab, i); }, !used && !!ab.ops);
        });
      }
      UI.addAction("Destroy Aux", () => { pushUndo(); removeAux(ctx.pi, ctx.li, ctx.auxUid); log(`${c.name} (Aux) destroyed.`); });
    }
    if (ctx.kind === "slot") {
      const s = G.players[ctx.pi].slots[ctx.si];
      if (s && ctx.pi === 0) {
        if (s.kind === "rite") {
          const r = fx(s.cardId).rite;
          if (r && r.early) UI.addAction("Resolve early (smaller effect)", async () => { pushUndo(); await resolveRite(0, ctx.si, "early"); }, true);
          UI.addAction("Resolve payoff now", async () => { pushUndo(); await resolveRite(0, ctx.si, "payoff"); });
          UI.addAction("+1 counter", () => { pushUndo(); s.counters++; });
        }
        if (s.kind === "hex") {
          UI.addAction(`Trigger manually (pay ${c.cost})`, async () => {
            pushUndo();
            const P = G.players[0];
            if (P.pulse < c.cost) { UI.toast("Not enough Pulse."); return; }
            P.pulse -= c.cost;
            P.slots[ctx.si] = null;
            log(`You manually trigger Hex: ${c.name} — "${c.text}" (adjudicate with sandbox tools if not scripted).`);
            const f = fx(c.id);
            if (f.hexTrig && f.hexTrig !== "manual") for (const op of f.hexTrig.ops) if (!["combatAtk", "combatAtkSet", "combatSwap", "block", "negate"].includes(op.op)) await runOp(op, 0, { laneIdx: s.laneIdx, sourceName: c.name });
          }, true);
        }
        UI.addAction("Discard from slot", () => { pushUndo(); G.players[0].slots[ctx.si] = null; log(`${c.name} discarded from slot.`); });
      }
    }
    if (DEV) UI.addAction("Edit this card", () => { Editor.selectId = c.id; UI.show("cards"); });
    UI.addAction("Close", () => {});
  },

  /* ---------------- setup screen ---------------- */
  renderSetup() {
    const names = realmNames();
    const mk = (elId, arr) => {
      const el = $(elId);
      el.innerHTML = "";
      for (let i = 0; i < C().lanes; i++) {
        const wrap = document.createElement("div");
        wrap.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:3px">Lane ${i + 1}</div>`;
        const sel = document.createElement("select");
        names.forEach(n => {
          const o = document.createElement("option");
          o.value = n; o.textContent = n;
          sel.appendChild(o);
        });
        sel.value = arr[i] || names[i % names.length];
        arr[i] = sel.value;
        sel.onchange = () => { arr[i] = sel.value; };
        wrap.appendChild(sel);
        el.appendChild(wrap);
      }
    };
    if (!UI.setup.mine.length) UI.setup.mine = shuffle(names).slice(0, C().lanes);
    if (!UI.setup.ai.length) UI.setup.ai = shuffle(names).slice(0, C().lanes);
    mk("player-realms", UI.setup.mine);
    mk("ai-realms", UI.setup.ai);
  },

  startGame() {
    const s = UI.setup;
    const aiRealms = s.aiMode === "pick" ? s.ai.slice() : shuffle(realmNames()).slice(0, C().lanes);
    const first = s.first === "you" ? 0 : s.first === "ai" ? 1 : (Math.random() < 0.5 ? 0 : 1);
    UI.sel = [];
    UI.pending = null;
    newGame({ playerRealms: s.mine.slice(), aiRealms, difficulty: s.difficulty, first });
    UI.show("game");
    UI.render();
    FX.intro();
    if (G.active === 1) setTimeout(() => UI.runAI(), FX.busy ? FX.ms(3600) : 0);
  },

  async runAI() {
    if (window.PVP_MODE) return;   // PvP: the other side is a human, never the AI
    UI.busy = true;
    UI.render();
    try { await aiTakeTurn(); } catch (e) { console.error(e); log("AI error: " + e.message); }
    UI.busy = false;
    UI.render();
  },

  async endTurnClicked() {
    if (UI.busy || G.over || G.active !== 0) return;
    UI.sel = [];
    pushUndo();
    endTurn();
    UI.render();
    if (!G.over && G.active === 1) await UI.runAI();
  },
};



/* ===================== HOVER CHEAT SHEET (inspector) ===================== */
// Explains, in plain English, every effect currently touching whatever you hover.
const INS = {
  el: null,
  ensure() {
    if (INS.el && document.getElementById("inspector")) return INS.el;
    const log = document.getElementById("log");
    if (!log) return null;
    const panel = log.closest ? log.closest(".logpanel") : log.parentElement;
    if (!panel || !panel.parentElement) return null;
    const d = document.createElement("div");
    d.id = "inspector";
    d.style.cssText = "background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px;font-size:12px;margin-bottom:12px;min-height:96px";
    d.innerHTML = `<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Cheat sheet</div>
      <div id="ins-body" style="color:#9aa4b6;line-height:1.5">Hover anything on the board to see exactly what's affecting it.</div>`;
    panel.parentElement.insertBefore(d, panel);
    INS.el = d;
    return d;
  },
  show(html) {
    const d = INS.ensure();
    if (d) document.getElementById("ins-body").innerHTML = html;
  },
  clear() { INS.show(`<span style="color:#6f7b8c">Hover anything on the board to see exactly what's affecting it.</span>`); },

  row(label, val, col) {
    return `<div style="display:flex;justify-content:space-between;gap:8px"><span>${label}</span><span style="color:${col || "#cfd6e2"};white-space:nowrap">${val}</span></div>`;
  },
  head(t) { return `<div style="color:#e9eef6;font-weight:600;margin:2px 0 5px">${t}</div>`; },
  sub(t) { return `<div style="color:#6f7b8c;font-size:11px;letter-spacing:.6px;text-transform:uppercase;margin:8px 0 3px">${t}</div>`; },

  // walk exactly the sources collectAuras walks, naming each contribution
  auraLines(tpi, tli) {
    const out = [];
    for (let pi = 0; pi < 2; pi++) {
      const P = G.players[pi];
      for (let li = 0; li < P.lanes.length; li++) {
        const L = P.lanes[li];
        const srcs = [];
        if (L.hero && !isSilenced(L.hero)) srcs.push({ f: fx(L.hero.cardId), cont: "cont", props: "props", nm: cardById(L.hero.cardId).name, self: pi === tpi && li === tli });
        const seen = new Set();
        for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); srcs.push({ f: fx(a.cardId), cont: "auxCont", props: "auxProps", nm: cardById(a.cardId).name + " (aux)" }); }
        if (L.hero) for (const r of L.hero.relics) srcs.push({ f: fx(r.cardId), cont: "cont", props: "props", nm: cardById(r.cardId).name, equippedHere: true, forge: r.counters || 0, ref: r });
        for (const s of srcs) {
          for (const e of (s.f[s.cont] || [])) {
            let hit = false;
            try { hit = auraHits(e, pi, li, tpi, tli, s); } catch (err) {}
            if (!hit || (!e.atk && !e.hp)) continue;
            const who = pi === tpi ? "" : " (enemy)";
            const sign = (n) => (n >= 0 ? "+" : "") + n;
            out.push(INS.row(s.nm + who, `${sign(e.atk || 0)}/${sign(e.hp || 0)}`, (e.atk || 0) + (e.hp || 0) >= 0 ? "#a8e08a" : "#e0736b"));
          }
          if (s.forge && pi === tpi && li === tli) out.push(INS.row(s.nm + " forge counters", `+${10 * s.forge}/+${10 * s.forge}`, "#a8e08a"));
        }
      }
    }
    return out;
  },

  hero(pi, li) {
    const h = heroAt({ pi, li });
    if (!h) return INS.clear();
    const c = cardById(h.cardId);
    const atk = effAtk(pi, li), hp = curHp(pi, li), mhp = effMaxHp(pi, li);
    let s = INS.head(`${c.name} — ${c.realm} ${c.type}`);
    s += INS.row("Printed", `${c.atk} ATK / ${c.hp} HP`, "#9aa4b6");
    s += INS.row("<b>Right now</b>", `<b>${atk} ATK / ${hp}${hp !== mhp ? " of " + mhp : ""} HP</b>`, "#f0ece2");

    const lines = INS.auraLines(pi, li);
    if (h.permAtk || h.permHp) lines.push(INS.row("permanent gains", `+${h.permAtk}/+${h.permHp}`, "#a8e08a"));
    if (h.redAtk || h.redHp) lines.push(INS.row("enemy reductions", `−${h.redAtk}/−${h.redHp}`, "#e0736b"));
    const temps = (h.temp || []).filter(t => t.until >= G.gt);
    for (const t of temps) lines.push(INS.row("temporary", `${t.atk >= 0 ? "+" : ""}${t.atk || 0}/${t.hp >= 0 ? "+" : ""}${t.hp || 0}`, t.atk < 0 || t.hp < 0 ? "#e0736b" : "#a8e08a"));
    if (h.dmg) lines.push(INS.row("damage taken", `−${h.dmg} HP`, "#e0736b"));
    if (lines.length) s += INS.sub("what's changing it") + lines.join("");

    const notes = [];
    if (h.ward > 0) notes.push(`ward absorbs the next <b>${h.ward}</b> damage`);
    if (h.blood) notes.push(`${h.blood} blood counter${h.blood > 1 ? "s" : ""}`);
    if (heroFlag({ pi, li }, "taunt")) notes.push("enemy attacks are forced onto this Hero");
    if (heroFlag({ pi, li }, "attackAnyLane")) notes.push("may attack any lane");
    if (heroFlag({ pi, li }, "anyLaneNotOpp")) notes.push("may attack any lane except the opposing one");
    if (isProtected({ pi, li })) notes.push("cannot be attacked or targeted right now");
    const ff = isSilenced(h) ? null : fx(h.cardId).flags;
    if (ff && ff.thorns) notes.push(`attackers take ${ff.thorns} damage back`);
    if (ff && ff.combatShield) notes.push(`takes ${ff.combatShield} less combat damage`);
    if (isSilenced(h)) notes.push("SILENCED — its text does nothing");
    for (const r of h.relics) notes.push(`Relic: <b>${cardById(r.cardId).name}</b> — ${cardById(r.cardId).text}`);
    const laneAux = [];
    const seenA = new Set();
    for (const a of G.players[pi].lanes[li].aux) if (a && !seenA.has(a.uid)) { seenA.add(a.uid); laneAux.push(`Aux: <b>${cardById(a.cardId).name}</b> — ${cardById(a.cardId).auxText}`); }
    const maxA = maxAttacksOf(pi, li);
    notes.push(`attacks used this turn: ${h.attacksUsed} of ${maxA + (h.extraAttacks || 0)}`);
    s += INS.sub("in play") + [...notes, ...laneAux].map(n => `<div style="margin-bottom:3px">• ${n}</div>`).join("");
    s += INS.sub("card text") + `<div style="color:#8a93a4">${c.text}</div>`;
    INS.show(s);
  },

  card(c, extra) {
    let s = INS.head(`${c.name} — ${c.realm} ${c.type}`);
    if (extra) s += extra;
    s += `<div style="color:#9aa4b6;margin-top:4px">${c.text || ""}</div>`;
    INS.show(s);
  },
};

/* ===================== REALM IDENTITY (Arcane Table board) ===================== */
const REALM_COLORS = {
  Fangrend:"#8fa0c0", Luminar:"#e0c478", Runespire:"#a98cd8", Balemaw:"#c07a5a",
  Gildharbor:"#6fb3c4", Ankhara:"#d9a441", Karakhorde:"#b5915e", Deepforge:"#9aa6b5",
  Aurelium:"#c05a4a", Oathenhall:"#6f8fd0", Zolthec:"#4fae86", Almsgard:"#cfc6b0",
  Thornveil:"#7ba396", Noctavein:"#a3556b", Brightmantle:"#f0e2a8",
};
const REALM_LOGOS = {
  Fangrend:(L,D)=>`<polygon points="6,6 18,6 12,36" fill="${L}"/><polygon points="20,6 32,6 26,28" fill="${D}"/>`,
  Luminar:(L,D)=>`<circle cx="17" cy="21" r="7" fill="${L}"/><g fill="${D}"><polygon points="17,2 19.5,12 14.5,12"/><polygon points="17,40 19.5,30 14.5,30"/><polygon points="0,21 10,18.5 10,23.5"/><polygon points="34,21 24,18.5 24,23.5"/><polygon points="5,7 13,13 9.5,16.5"/><polygon points="29,7 21,13 24.5,16.5"/><polygon points="5,35 13,29 9.5,25.5"/><polygon points="29,35 21,29 24.5,25.5"/></g>`,
  Runespire:(L,D)=>`<rect x="15.3" y="14" width="3.4" height="30" rx="1.5" fill="${D}"/><path d="M17 14 q-7 -2 -6 -8 l4 2 q-1 -4 2 -6 q3 2 2 6 l4 -2 q1 6 -6 8 z" fill="${D}"/><circle cx="17" cy="8" r="3.6" fill="${L}"/><polygon points="27,4 28.2,7 31,8 28.2,9 27,12 25.8,9 23,8 25.8,7" fill="${L}"/><rect x="14.6" y="18" width="4.8" height="2.4" fill="${L}"/>`,
  Balemaw:(L,D)=>`<path d="M9 33 q-4 -6 -3.5 -13 q0.5 -6 4.5 -9 q-1.5 5 -0.5 9.5 q1 5.5 3 9 q-1 2.5 -3.5 3.5 z" fill="${L}"/><path d="M25 33 q4 -6 3.5 -13 q-0.5 -6 -4.5 -9 q1.5 5 0.5 9.5 q-1 5.5 -3 9 q1 2.5 3.5 3.5 z" fill="${D}"/>`,
  Gildharbor:(L,D)=>`<circle cx="17" cy="23" r="14" fill="${L}"/><circle cx="17" cy="23" r="10.5" fill="none" stroke="${D}" stroke-width="2"/><path d="M17 15 q6 8 0 16 q-6 -8 0 -16 z" fill="${D}"/><rect x="3" y="21.5" width="4" height="3" fill="${D}"/><rect x="27" y="21.5" width="4" height="3" fill="${D}"/><rect x="15.5" y="7" width="3" height="4" fill="${D}"/><rect x="15.5" y="35" width="3" height="4" fill="${D}"/>`,
  Ankhara:(L,D,BG)=>`<circle cx="17" cy="10" r="6" fill="${L}"/><polygon points="17,20 30,42 4,42" fill="${D}"/><polygon points="17,28 24,40 10,40" fill="${BG}"/>`,
  Karakhorde:(L,D)=>`<path d="M6.2 19 Q8 17.4 11 17.8 Q14.5 18.4 17 17.6 C19 16 20.5 13.5 22.6 11.8 L23 10.4 L23.9 11.6 L24.8 10.2 L25.6 11.9 C27.5 13 29.5 14.8 31.3 16.6 L31.8 17.8 Q31.4 18.6 30.4 18.4 Q28.8 18.2 28.2 17.6 C27.2 18.4 26.6 19.4 26.4 20.6 C25.8 22.5 25.2 24 24.8 25.2 L24.6 26 L25.1 32 L24.9 36 L25.3 39.3 L23.7 39.3 L23.5 33 L23 28.2 L22.2 27.6 L21.6 28.4 L21.9 39.3 L20.3 39.3 L20 31.5 L19.4 27.6 Q16 28.4 13 27.8 L12.2 28.6 L12.6 39.3 L11 39.3 L10.8 33 Q10.2 30 9.8 28 L9.2 29 L9.6 34 L9.3 39.3 L7.7 39.3 L7.9 32 Q7 28 6.8 25.5 Q6.3 22.5 6.2 20.5 C4.2 21.5 3.2 25 3 29 C2.8 33 3 36 3.6 38.3 L4.8 38 C4.6 34 4.8 30 5.4 26.5 C5.7 24 5.9 21.5 6.2 19 Z" fill="${D}"/><path d="M17.2 17.4 C19.2 15.7 20.6 13.4 22.4 11.7 L23.2 12.6 C21.4 14.4 20 16.5 18.4 18.2 Q17.6 17.9 17.2 17.4 Z" fill="${L}"/><circle cx="28.2" cy="15.6" r="0.9" fill="${L}"/>`,
  Deepforge:(L,D)=>`<path d="M4 16 h26 v5 q-8 1 -8 7 h5 v6 h-20 v-6 h5 q0-6 -8-7 z" fill="${L}"/><rect x="8" y="38" width="18" height="4" fill="${D}"/><rect x="24" y="2" width="6" height="10" fill="${D}"/>`,
  Aurelium:(L,D)=>`<rect x="15" y="4" width="4" height="38" fill="${D}"/><rect x="6" y="8" width="22" height="4" fill="${L}"/><circle cx="17" cy="22" r="7" fill="none" stroke="${L}" stroke-width="2.5"/><rect x="6" y="4" width="4" height="6" fill="${L}"/><rect x="24" y="4" width="4" height="6" fill="${L}"/>`,
  Oathenhall:(L,D)=>`<path d="M5 34 v-18 l7 7 5-12 5 12 7-7 v18 z" fill="${L}"/><rect x="5" y="36" width="24" height="5" fill="${D}"/>`,
  Zolthec:(L,D,BG)=>`<rect x="13" y="6" width="8" height="6" fill="${L}"/><rect x="9" y="14" width="16" height="7" fill="${D}"/><rect x="5" y="23" width="24" height="8" fill="${L}"/><rect x="2" y="33" width="30" height="9" fill="${D}"/><rect x="15" y="14" width="4" height="28" fill="${BG}"/>`,
  Almsgard:(L,D)=>`<circle cx="17" cy="12" r="4.5" fill="${L}"/><path d="M17 18 l1.2 3 -1.2 3 -1.2 -3 z" fill="${L}"/><path d="M4 27 h26 q0 9 -8 12 h-10 q-8 -3 -8 -12 z" fill="${D}"/><rect x="12" y="41" width="10" height="2.5" fill="${D}"/>`,
  Thornveil:(L,D)=>`<circle cx="17" cy="23" r="12" fill="none" stroke="${D}" stroke-width="3.5"/><g fill="${L}"><polygon points="17,7 21,2 19,9"/><polygon points="29,17 34,15 30,21"/><polygon points="27,33 32,37 25,36"/><polygon points="7,33 2,37 9,36"/><polygon points="5,17 0,15 4,21"/></g><polygon points="17,17 20,23 17,29 14,23" fill="${L}"/>`,
  Noctavein:(L,D)=>`<path d="M26 6 a15 15 0 1 0 6 22 a12 12 0 1 1 -6 -22 z" fill="${D}"/><path d="M20 16 q6 8 0 14 q-6 -6 0 -14 z" fill="${L}"/>`,
  Brightmantle:(L,D,BG)=>`<path d="M17 8 q-13 4 -13 22 l6 -3 q-1 -12 7 -15 q8 3 7 15 l6 3 q0 -18 -13 -22 z" fill="${D}"/><circle cx="17" cy="10" r="5" fill="${L}"/><circle cx="17" cy="10" r="2" fill="${BG}"/><rect x="15.5" y="26" width="3" height="14" fill="${L}"/><rect x="11" y="30" width="12" height="3" fill="${L}"/>`,
};
function realmColor(r) { return REALM_COLORS[r] || "#8fa0c0"; }
function realmCrest(realm, w, main, dark, bg) {
  const fn = REALM_LOGOS[realm];
  if (!fn) return "";
  return `<svg viewBox="0 0 34 46" width="${w}" height="${Math.round(w * 46 / 34)}" style="flex-shrink:0;display:block">${fn(main, dark, bg || "#12151c")}</svg>`;
}
/* ---------------------------- card back art ----------------------------
   The Mortalis mark is drawn on a 40x44 grid, but its *ink* does not fill that
   grid: the diamond spans x 9..31 / y 3..25 and the four lane bars span
   x 6..34.4 / y 28..42. So the ink bounding box is x 6..34.4, y 3..42 and its
   true centre is (20.2, 22.5) — NOT the (20, 22) grid centre. Centring by the
   grid leaves the mark visibly low and left. Every card back positions the mark
   with `translate(cx,cy) scale(s) translate(-20.2,-22.5)` so the ink is dead
   centre in the medallion and on the card.                                   */
const MARK_INK_CX = 20.2, MARK_INK_CY = 22.5;
const MARK_PATHS =
  '<path d="M20 3 L31 14 L20 14 Z" fill="#3a5c9e"/>' +
  '<path d="M9 14 L20 3 L20 14 Z" fill="#4d76c4"/>' +
  '<path d="M31 14 L20 25 L20 14 Z" fill="#1c2f5c"/>' +
  '<path d="M20 25 L9 14 L20 14 Z" fill="#26417a"/>' +
  '<path d="M20 3 L31 14 L20 25 L9 14 Z" fill="none" stroke="#dfe6ef" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<path d="M20 9.5 L24.5 14 L20 18.5 L15.5 14 Z" fill="#0e1116" stroke="#aab6c6" stroke-width="1" stroke-linejoin="round"/>' +
  '<rect x="6" y="28" width="4.4" height="9" rx="1.2" fill="#6d7b8f"/>' +
  '<rect x="14" y="28" width="4.4" height="14" rx="1.2" fill="#dfe6ef"/>' +
  '<rect x="22" y="28" width="4.4" height="14" rx="1.2" fill="#b8c3d1"/>' +
  '<rect x="30" y="28" width="4.4" height="9" rx="1.2" fill="#55627a"/>';

// The same mark in the defeat palette, so the losing end screen reads red all
// the way through rather than a blue crest inside a red seal.
const MARK_RED = {
  "#3a5c9e": "#7a4a46", "#4d76c4": "#a8635c", "#1c2f5c": "#4a2523", "#26417a": "#63332f",
  "#dfe6ef": "#f0d3d0", "#0e1116": "#160b0a", "#aab6c6": "#d9a49f",
  "#6d7b8f": "#8f6360", "#b8c3d1": "#d1b0ad", "#55627a": "#7a504d",
};
function markPaths(red) {
  if (!red) return MARK_PATHS;
  return MARK_PATHS.replace(/#[0-9a-f]{6}/gi, (h) => MARK_RED[h.toLowerCase()] || h);
}

// Miniature of the approved "Sovereign Seal" card back, for deck piles, the
// opponent's hand and cards in flight. `wordmark` adds MORTALIS under the seal
// (only legible at pile size).
function cardBackSVG(wordmark) {
  const mk = `<g transform="translate(30,${wordmark ? 38 : 42}) scale(0.92) translate(-${MARK_INK_CX},-${MARK_INK_CY})">${MARK_PATHS}</g>`;
  return `<svg class="cardback" viewBox="0 0 60 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="0" y="0" width="60" height="84" rx="6" fill="#111926"/>
    <rect x="3" y="3" width="54" height="78" rx="4" fill="none" stroke="#3a4a68" stroke-width="1"/>
    <circle cx="30" cy="${wordmark ? 38 : 42}" r="23" fill="#162031"/>
    <circle cx="30" cy="${wordmark ? 38 : 42}" r="23" fill="none" stroke="#8f9db4" stroke-width="1.1"/>
    <circle cx="30" cy="${wordmark ? 38 : 42}" r="19.6" fill="none" stroke="#41506d" stroke-width=".7"/>
    ${mk}
    ${wordmark ? `<text x="30" y="70" text-anchor="middle" fill="#c3ccdb" font-family="Cinzel,Georgia,serif" font-weight="800" font-size="8.4" letter-spacing="1.1">MORTALIS</text>
    <line x1="12" y1="74.5" x2="48" y2="74.5" stroke="#3a4a68" stroke-width=".7"/>` : ""}
  </svg>`;
}

const SUPPORT_STYLE = {
  hex:  { col:"#c7aee8", bg:"#2a2140", glyph:'<path d="M6 1 L11 6 L6 11 L1 6 Z" fill="currentColor"/>' },
  rite: { col:"#9ed6c6", bg:"#17302a", glyph:'<circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="6" r="1.4" fill="currentColor"/>' },
  pact: { col:"#e39a86", bg:"#3a221c", glyph:'<path d="M6 11 C2 8 1 5 2.6 3 C4 1.4 6 2.6 6 4.2 C6 2.6 8 1.4 9.4 3 C11 5 10 8 6 11 Z" fill="currentColor"/>' },
  incantation: { col:"#a2dcf2", bg:"#162836", glyph:'<path d="M6 1 L7.4 4.6 L11 6 L7.4 7.4 L6 11 L4.6 7.4 L1 6 L4.6 4.6 Z" fill="currentColor"/>' },
};

/* =========================== CARD MOTION (FX) ===========================
   "Rail Deal" style. Nothing here touches game state — FX watches each render,
   diffs the hands/decks against the previous frame and flies a ghost card along
   the difference. That means draws, plays, burns, AI turns, PvP syncs and
   tutorial scripts all animate for free, with no hooks in the rules code.     */
const FX = {
  // Design timings below are written at "1x". Everything that schedules or
  // animates routes through FX.ms(), so this one number sets the pace of the
  // whole game. The stylesheet reads the same figure from --fx-mult.
  speed: 1.4,
  ms(n) { return Math.round(n * FX.speed); },
  after(fn, n) { return setTimeout(fn, FX.ms(n)); },
  DUR: 340,
  on: true,
  gref: null,
  snap: null,
  pre: [[], []],

  live() {
    return typeof requestAnimationFrame === "function" &&
           typeof document !== "undefined" && !!document.body &&
           UI.screen === "game" && !!G;
  },
  rect(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect();
    return (r && r.width) ? r : null;
  },
  handEl(pi) { return pi === 0 ? $("hand") : $("ai-hand-cards"); },
  pileEl(pi) { return pi === 0 ? $("my-deckpile") : $("ai-deckpile"); },
  laneEl(pi, li) {
    const wrap = $(pi === 0 ? "my-lanes" : "ai-lanes");
    if (!wrap || !wrap.children) return null;
    return (li >= 0 && wrap.children[li]) ? wrap.children[li] : wrap;
  },
  layer() {
    let l = $("fxlayer");
    if (!l) { l = document.createElement("div"); l.id = "fxlayer"; l.className = "fxlayer"; document.body.appendChild(l); }
    return l;
  },

  // where each card id currently sits on a player's board (for play targets)
  boardMap(pi) {
    const P = G.players[pi], m = {};
    P.lanes.forEach((L, li) => {
      if (L.hero) { m[L.hero.cardId] = li; (L.hero.relics || []).forEach(r => { m[r.cardId] = li; }); }
      L.aux.forEach(a => { if (a) m[a.cardId] = li; });
    });
    (P.slots || []).forEach(s => { if (s) m[s.cardId] = (s.laneIdx != null ? s.laneIdx : -1); });
    return m;
  },
  take() {
    return {
      gt: G.gt,
      over: !!G.over, winner: G.winner,
      hand: [G.players[0].hand.slice(), G.players[1].hand.slice()],
      deck: [G.players[0].deck.length, G.players[1].deck.length],
      disc: [(G.players[0].discard || []).length, (G.players[1].discard || []).length],
      board: [FX.boardMap(0), FX.boardMap(1)],
    };
  },

  /* called just before the DOM is rebuilt — the old hand nodes still exist */
  capture() {
    FX.pre = [[], []];
    if (!FX.live() || FX.busy) return;
    for (const pi of [0, 1]) {
      const el = FX.handEl(pi);
      if (el && el.children) FX.pre[pi] = [...el.children].map(n => FX.rect(n));
    }
  },

  /* called after the DOM is rebuilt — diff and animate */
  settle() {
    let now;
    try { now = FX.take(); } catch (e) { return; }
    const prev = FX.snap, sameGame = FX.gref === G;
    FX.snap = now; FX.gref = G;
    if (FX.busy) { FX.q.length = 0; return; }
    // the game just ended: collapse the loser's board, then crown the winner
    if (prev && sameGame && !prev.over && now.over && now.winner != null) {
      FX.q.length = 0;
      FX.after(() => FX.finale(now.winner), 260);
      return;
    }
    if (!prev || !sameGame || !FX.live()) { FX.q.length = 0; return; }
    if (now.gt < prev.gt) { FX.q.length = 0; return; }   // undo / rewind: don't animate
    for (const pi of [0, 1]) {
      try { FX.animateSide(pi, prev, now); } catch (e) { /* motion must never break the board */ }
    }
    FX.drain();                                          // attacks, effects, deaths
  },

  diffHand(prev, now) {
    const used = new Array(prev.length).fill(false), addedIdx = [];
    for (let i = 0; i < now.length; i++) {
      let k = -1;
      for (let j = 0; j < prev.length; j++) if (!used[j] && prev[j] === now[i]) { k = j; break; }
      if (k >= 0) used[k] = true; else addedIdx.push(i);
    }
    const removedIdx = [];
    for (let j = 0; j < prev.length; j++) if (!used[j]) removedIdx.push(j);
    return { addedIdx, removedIdx };
  },

  animateSide(pi, prev, now) {
    const d = FX.diffHand(prev.hand[pi], now.hand[pi]);
    const drewCount = prev.deck[pi] - now.deck[pi];
    const burned = drewCount > 0 && !d.addedIdx.length && (now.disc[pi] > prev.disc[pi]);
    // a wholesale change (new game, import, mulligan) is a redraw, not a move
    if (d.addedIdx.length > 5 || d.removedIdx.length > 3) return;

    const pile = FX.rect(FX.pileEl(pi));
    const nodes = FX.handEl(pi) && FX.handEl(pi).children ? [...FX.handEl(pi).children] : [];

    // ---- draws: deck -> hand ----
    if (pile) d.addedIdx.forEach((hi, k) => {
      const node = nodes[hi], to = FX.rect(node);
      if (!to) return;
      if (node.style) node.style.visibility = "hidden";
      FX.fly(pile, to, {
        mode: pi === 0 ? "flip" : "back",
        card: pi === 0 ? cardById(now.hand[pi][hi]) : null,
        delay: k * 80,
        done: () => { if (node.style) node.style.visibility = ""; },
      });
    });

    // ---- plays: hand -> the lane the card landed in ----
    d.removedIdx.forEach((hi, k) => {
      const from = FX.pre[pi][hi];
      if (!from) return;
      const cid = prev.hand[pi][hi];
      const card = cardById(cid);
      const li = (now.board[pi][cid] != null && prev.board[pi][cid] == null) ? now.board[pi][cid] : -1;
      const laneEl = FX.laneEl(pi, li);
      const to = FX.rect(laneEl);
      if (!to) return;
      FX.fly(from, to, { mode: pi === 0 ? "face" : "flip", card, delay: k * 70, fade: true });
      // a realm-coloured sigil blooms where the card lands
      FX.after(() => {
        FX.ring(laneEl, li >= 0 ? FX.laneColor(pi, li) : realmColor(card.realm), 1.7);
        if (card.type !== "hero") FX.chip(laneEl, card.type[0].toUpperCase() + card.type.slice(1) + " — " + card.name, "#dfe5ef", "rgba(32,40,56,.92)");
      }, FX.DUR + k * 70 - 60);
    });

    // ---- overdraw burn: deck -> away ----
    if (burned && pile) FX.fly(pile, { left: pile.left, top: pile.top + (pi === 0 ? 40 : -40), width: pile.width, height: pile.height }, { mode: "back", fade: true, shrink: .7 });
  },

  /* --------------------- opening & victory sequences ---------------------
     Both take the board over for a few seconds, so they suspend the normal
     diff-and-fly machinery (FX.busy) and hand back a clean re-render at the
     end. Neither touches game state.                                        */
  busy: false,

  boardCentre() {
    const a = FX.rect($("ai-lanes")), b = FX.rect($("my-lanes"));
    if (!a || !b) return null;
    return { x: a.left + a.width / 2, y: (a.top + b.top + b.height) / 2 };
  },
  title(main, sub, delay, hold) {
    const d = FX.spawn("left:0;right:0;top:40%;opacity:0;transform:scale(.86)", delay + hold + 700, "fxtitle");
    if (!d) return;
    d.innerHTML = `<div class="fxwm">${main}</div>${sub ? `<div class="fxsub">${sub}</div>` : ""}`;
    FX.after(() => { d.style.cssText += ";opacity:1;transform:scale(1)"; }, delay);
    FX.after(() => { d.style.opacity = "0"; }, delay + hold);
  },
  /* The opening wordmark: the mark stamps down, shocks a ring outward, then
     rises above MORTALIS as the letters unfurl from behind it. */
  stamp(delay, hold) {
    const d = FX.spawn("left:0;right:0;top:36%", delay + hold + 900, "fxtitle fxstamp");
    if (!d) return;
    d.innerHTML =
      `<div class="fxmark"><svg viewBox="0 0 40 44" width="58" height="64" aria-hidden="true">${MARK_PATHS}</svg></div>` +
      `<div class="fxwm">${"MORTALIS".split("").map(ch => `<span>${ch}</span>`).join("")}</div>` +
      `<div class="fxsub"><i></i><b>REALMS</b><i></i></div>`;
    const kids = d.children || [];
    const mark = kids[0], wm = kids[1], sub = kids[2];
    const sp = wm && wm.children ? [...wm.children] : [];
    sp.forEach((s, i) => { if (s.style) s.style.transform = `translateX(${Math.round((i - 3.5) * -26)}px)`; });

    FX.after(() => { if (mark && mark.style) { mark.style.transform = "scale(1)"; mark.style.opacity = "1"; } }, delay);
    FX.after(() => {
      const r = FX.rect(mark);
      if (r) {
        const size = 74;
        const sh = FX.spawn(`left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px;opacity:.9`, 700, "fxshock");
        FX.go(sh, ";transform:scale(4.6);opacity:0");
      }
      if (mark && mark.style) {
        mark.style.transition = `transform ${FX.ms(500)}ms cubic-bezier(.2,.9,.3,1), opacity ${FX.ms(500)}ms`;
        mark.style.transform = "translateY(-56px) scale(.6)";
      }
      sp.forEach(s => { if (s.style) { s.style.opacity = "1"; s.style.transform = "none"; } });
    }, delay + 280);
    FX.after(() => {
      if (!sub || !sub.querySelectorAll) return;
      [...sub.querySelectorAll("i")].forEach(i => { if (i.style) i.style.width = "28px"; });
      const b = sub.querySelector("b");
      if (b && b.style) b.style.opacity = "1";
    }, delay + 880);
    FX.after(() => { d.style.opacity = "0"; }, delay + hold);
  },

  suspend(ms) {
    FX.busy = true;
    const wasBusy = UI.busy;
    UI.busy = true;
    FX.after(() => {
      FX.busy = false; UI.busy = wasBusy;
      FX.snap = null; FX.gref = null;      // resync silently; the deal already played
      try { UI.render(); } catch (e) {}
    }, ms);
  },

  /* Sigils converge onto the lanes, then the opening hands are dealt. */
  intro() {
    if (!FX.live() || FX.busy) return;
    const c = FX.boardCentre();
    if (!c) return;
    const cells = [];
    for (const pi of [1, 0]) for (let li = 0; li < 4; li++) {
      const el = FX.laneEl(pi, li), r = FX.rect(el);
      if (el && r) cells.push({ el, r, col: FX.laneColor(pi, li), realm: G.players[pi].lanes[li].realm });
    }
    if (!cells.length) return;

    const CREST = 55, DEAL_AT = 420 + cells.length * CREST, DEAL = 80;
    const STAMP_AT = DEAL_AT + 620, STAMP_HOLD = 1800, TOTAL = STAMP_AT + STAMP_HOLD + 800;
    FX.suspend(TOTAL);

    cells.forEach((o, i) => {
      if (o.el.style) { o.el.style.transition = "opacity .45s, transform .45s"; o.el.style.opacity = "0"; o.el.style.transform = "scale(.93)"; }
      const s = FX.spawn(`left:${c.x - 11}px;top:${c.y - 12}px;width:22px;height:24px;opacity:0`, 420 + i * CREST + 700, "fxcrest");
      if (s) {
        s.innerHTML = realmCrest(o.realm, 22, o.col, "rgba(18,21,28,.6)") || "";
        FX.go(s, ";opacity:1");
        FX.after(() => { s.style.cssText += `;transform:translate(${o.r.left + o.r.width / 2 - c.x}px, ${o.r.top + 10 - c.y}px) scale(.85);opacity:0`; }, 60 + i * CREST);
      }
      FX.after(() => {
        if (!o.el.style) return;
        o.el.style.opacity = "1"; o.el.style.transform = "none";
        o.el.style.boxShadow = `0 0 0 1px ${o.col}, 0 0 22px -6px ${o.col}`;
        FX.ring(o.el, o.col, 2.1);
        FX.after(() => { if (o.el.style) o.el.style.boxShadow = ""; }, 800);
      }, 420 + i * CREST);
    });

    // ...then the opening hands are dealt off the decks, card by card
    FX.after(() => {
      for (const pi of [0, 1]) {
        const pile = FX.rect(FX.pileEl(pi));
        const hand = FX.handEl(pi);
        if (!pile || !hand || !hand.children) continue;
        [...hand.children].forEach((node, k) => {
          const to = FX.rect(node);
          if (!to) return;
          if (node.style) node.style.visibility = "hidden";
          FX.fly(pile, to, {
            mode: pi === 0 ? "flip" : "back",
            card: pi === 0 ? cardById(G.players[0].hand[k]) : null,
            delay: k * DEAL,
            done: () => { if (node.style) node.style.visibility = ""; },
          });
        });
      }
    }, DEAL_AT);

    FX.stamp(STAMP_AT, STAMP_HOLD);
  },

  /* The loser's board collapses, then the Sovereign Seal names the winner. */
  finale(w) {
    if (!FX.live() || FX.busy) return;
    const loser = 1 - w;
    const c = FX.boardCentre();
    const cells = [];
    for (let li = 0; li < 4; li++) {
      const el = FX.laneEl(loser, li), r = FX.rect(el);
      if (el && r) cells.push({ el, col: FX.laneColor(loser, li) });
    }
    const COLLAPSE = 170, SEAL_AT = 400 + cells.length * COLLAPSE, TOTAL = SEAL_AT + 3400;
    FX.suspend(TOTAL);

    cells.forEach((o, i) => FX.after(() => {
      FX.shatter(o.el, o.col);
      if (o.el.style) { o.el.style.transition = "opacity .5s, transform .5s"; o.el.style.opacity = "0"; o.el.style.transform = "translateY(16px) scale(.9)"; }
    }, 200 + i * COLLAPSE));

    FX.after(() => {
      const wash = FX.spawn("left:0;right:0;top:0;bottom:0;background:#e0736b;opacity:.24", 900, "fxwash");
      FX.go(wash, ";opacity:0");
    }, 200 + cells.length * COLLAPSE);

    FX.after(() => FX.crown(w), SEAL_AT);
  },

  /* One composed lockup: seal, then VICTORY, then who won. Previously the
     medallion and the banner were positioned independently and overlapped. */
  crown(w) {
    for (let li = 0; li < 4; li++) { const e2 = FX.laneEl(w, li); if (e2 && e2.style) { e2.style.transition = `opacity ${FX.ms(500)}ms`; e2.style.opacity = ".28"; } }
    // The AI's board name carries its difficulty ("AI (medium)"), which reads
    // badly in a banner; a PvP opponent's typed name is used as-is.
    const who = (((G.players[w] && G.players[w].name) || "You").replace(/\s*\([^)]*\)\s*$/, "") || "Your opponent");
    // "You" is a pronoun, not a name — "YOU PREVAILS" reads as broken English
    const line = /^you$/i.test(who) ? "YOU PREVAIL" : who.toUpperCase() + " PREVAILS";
    const lost = w !== 0;                    // player 0 is always the local player
    const d = FX.spawn("left:0;right:0;top:30%", 4200, "fxtitle fxcrown" + (lost ? " lost" : ""));
    if (!d) return;
    // viewBox is the mark's ink box (centre 20.2, 22.5) with room for the
    // stroke, so the browser centres the mark itself rather than its grid
    d.innerHTML =
      `<div class="fxseal"><svg viewBox="5 2 30.4 41" width="64" height="70" aria-hidden="true">${markPaths(lost)}</svg></div>` +
      `<div class="fxwm">${lost ? "DEFEAT" : "VICTORY"}</div>` +
      `<div class="fxsub">${line}</div>`;
    const kids = d.children || [];
    const seal = kids[0], wm = kids[1], sub = kids[2];

    FX.after(() => { if (seal && seal.style) seal.style.transform = "scale(1)"; }, 40);
    [0, 160, 320].forEach((t, i) => FX.after(() => {
      const r = FX.rect(seal) || FX.rect(d);   // fall back to the lockup if the seal is not measurable
      if (!r) return;
      const size = 92;
      const col = lost ? (i % 2 ? "#e0736b" : "#a33b33") : (i % 2 ? "#8f9db4" : "#4d76c4");
      const ring = FX.spawn(`left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px;border:2px solid ${col};border-radius:50%;opacity:.8`, 1100, "fxring");
      FX.go(ring, ";transform:scale(4.4);opacity:0");
    }, 120 + t));
    FX.after(() => { if (wm && wm.style) { wm.style.opacity = "1"; wm.style.transform = "none"; } }, 380);
    FX.after(() => { if (sub && sub.style) sub.style.opacity = "1"; }, 780);
  },

  /* ------------------------- arcane event motion -------------------------
     The engine calls FX.signal() at attack / damage / destroy / effect / hex
     points. Those are queued rather than played immediately, because the engine
     is mid-flight and about to re-render the board — playing them from settle()
     guarantees the lanes we measure are the ones on screen.                  */
  q: [],
  lastFx: {},
  signal(kind, data) {
    if (!FX.on || !FX.live()) return;
    if (kind === "effect") {                       // one flourish per effect, not per op
      if (!data.name) return;
      const key = data.name + "@" + data.pi + ":" + data.li;
      const t = Date.now();
      if (FX.lastFx[key] && t - FX.lastFx[key] < 900) return;
      FX.lastFx[key] = t;
    }
    if (FX.q.length < 24) FX.q.push({ kind, data });
  },
  drain() {
    if (!FX.q.length) return;
    const q = FX.q.splice(0, FX.q.length);
    q.forEach((e, i) => FX.after(() => { try { FX.play(e.kind, e.data); } catch (err) { /* motion is never fatal */ } }, i * 90));
  },
  play(kind, d) {
    if (!FX.live()) return;
    const lane = FX.laneEl(d.pi === 0 ? 0 : 1, d.li);
    const col = (kind === "attack") ? null : FX.laneColor(d.pi, d.li);
    if (kind === "attack") {
      const to = FX.laneEl(d.dpi === 0 ? 0 : 1, d.dli);
      d.lanes.forEach((li, k) => {
        const from = FX.laneEl(d.pi === 0 ? 0 : 1, li);
        FX.after(() => FX.streak(from, to, FX.laneColor(d.pi, li)), k * 110);
      });
      if (d.onslaught) FX.after(() => FX.ring(to, "#e0a45c", 1.9), d.lanes.length * 110);
    } else if (kind === "damage") {
      FX.float(lane, "-" + d.n, "#e0736b");
    } else if (kind === "destroy") {
      FX.shatter(lane, FX.laneColor(d.pi, d.li));
      FX.chip(lane, d.name + " destroyed", "#f0c4c0", "rgba(74,26,24,.92)");
    } else if (kind === "effect") {
      FX.ring(lane, col, 1.5);
      FX.chip(lane, d.name, "#dfe5ef", "rgba(32,40,56,.92)");
    } else if (kind === "reveal") {
      FX.ring(lane, "#c7aee8", 1.7);
      FX.chip(lane, "Hex — " + d.name, "#e6d8fb", "rgba(42,33,64,.94)");
    } else if (kind === "block") {
      FX.ring(lane, "#9dc0f0", 2.1);
      FX.chip(lane, d.name + " — attack blocked", "#cfe0ff", "rgba(26,39,64,.94)");
    } else if (kind === "faceAttack") {
      const to = FX.faceEl(d.dpi);
      if (!to) return;
      d.lanes.forEach((li, k) => {
        const from = FX.laneEl(d.pi === 0 ? 0 : 1, li);
        FX.after(() => FX.streak(from, to, FX.laneColor(d.pi, li)), k * 110);
      });
      FX.after(() => {
        FX.ring(to, "#e0736b", 2.4);
        FX.float(to, "-" + d.n, "#f0d9a0");
        FX.chip(to, d.onslaught ? "Direct hit — Onslaught" : "Direct hit", "#f6e6c0", "rgba(74,52,16,.94)");
      }, d.lanes.length * 110);
    }
  },
  faceEl(pi) { return $(pi === 0 ? "my-face" : "ai-face"); },
  laneColor(pi, li) {
    try { const L = G.players[pi].lanes[li]; return realmColor(L && L.realm); } catch (e) { return "#8fa0c0"; }
  },
  spawn(css, ms, cls) {
    const L = FX.layer();
    if (!L || typeof L.appendChild !== "function") return null;
    const d = document.createElement("div");
    d.className = "fxbit " + (cls || "");
    d.style.cssText += css;
    L.appendChild(d);
    FX.after(() => { if (d.parentNode) d.parentNode.removeChild(d); }, ms);
    return d;
  },
  go(el, css) { if (el) requestAnimationFrame(() => { el.style.cssText += css; }); },

  streak(fromEl, toEl, col) {
    const a = FX.rect(fromEl), b = FX.rect(toEl);
    if (!a || !b) return;
    const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
    const x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const s = FX.spawn(`left:${x1}px;top:${y1 - 2}px;width:${len}px;height:4px;background:${col};box-shadow:0 0 12px ${col};transform:rotate(${ang}deg) scaleX(0);opacity:.95`, 620, "fxstreak");
    FX.go(s, `;transform:rotate(${ang}deg) scaleX(1);opacity:0`);
    FX.ring(toEl, col, 1.4);
  },
  ring(el, col, scale) {
    const r = FX.rect(el);
    if (!r) return;
    const size = Math.min(r.width, r.height) * .7;
    const c = FX.spawn(`left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px;border:2px solid ${col};border-radius:50%;opacity:.9`, 700, "fxring");
    FX.go(c, `;transform:scale(${scale || 1.6});opacity:0`);
  },
  float(el, txt, col) {
    const r = FX.rect(el);
    if (!r) return;
    const d = FX.spawn(`left:${r.left + r.width / 2 - 26}px;top:${r.top + r.height / 2 - 10}px;width:52px;text-align:center;color:${col};font-size:16px;font-weight:700;text-shadow:0 1px 4px #000`, 950, "fxnum");
    if (d) d.textContent = txt;
    FX.go(d, ";transform:translateY(-34px);opacity:0");
  },
  chip(el, txt, col, bg) {
    const r = FX.rect(el);
    if (!r) return;
    const d = FX.spawn(`left:${r.left + 4}px;top:${r.top - 6}px;max-width:${Math.max(90, r.width - 8)}px;background:${bg};color:${col};opacity:0`, 1500, "fxchip");
    if (d) d.textContent = txt;
    FX.go(d, ";opacity:1;transform:translateY(-16px)");
    FX.after(() => { if (d) d.style.opacity = "0"; }, 1000);
  },
  shatter(el, col) {
    const r = FX.rect(el);
    if (!r) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = FX.spawn(`left:${cx}px;top:${cy}px;width:8px;height:11px;background:${col};opacity:.95`, 720, "fxshard");
      FX.go(p, `;transform:translate(${Math.cos(a) * 58}px, ${Math.sin(a) * 50}px) rotate(${Math.round(a * 70)}deg);opacity:0`);
    }
  },

  fly(a, b, o) {
    o = o || {};
    const L = FX.layer();
    if (!L || typeof L.appendChild !== "function") return;
    const g = document.createElement("div");
    g.className = "fxghost";
    g.style.left = a.left + "px"; g.style.top = a.top + "px";
    g.style.width = a.width + "px"; g.style.height = a.height + "px";
    const dur = FX.ms(FX.DUR), delay = FX.ms(o.delay || 0);
    g.style.transitionDuration = dur + "ms";
    if (delay) g.style.transitionDelay = delay + "ms";
    const c = o.card;
    const face = c ? `<div class="ff ft"><div class="gnm">${c.name}</div><div class="gmeta">${c.realm}</div>
        <div class="gmeta">${c.type === "hero" ? c.atk + "/" + c.hp : c.type}</div></div>` : `<div class="ff ft"></div>`;
    g.innerHTML = `<div class="fin">${face}<div class="ff bk">${cardBackSVG()}</div></div>`;
    L.appendChild(g);
    const fin = g.firstChild;
    if (fin && fin.style) {
      fin.style.transitionDuration = dur + "ms";
      if (delay) fin.style.transitionDelay = delay + "ms";
      if (o.mode === "face") { fin.style.transition = "none"; fin.style.transform = "rotateY(180deg)"; }
    }
    const s = (o.shrink != null) ? o.shrink : Math.min(b.width / a.width, b.height / a.height);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    requestAnimationFrame(() => {
      g.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      if (o.fade) g.style.opacity = "0";
      if (o.mode === "flip" && fin && fin.style) { void g.offsetWidth; fin.style.transform = "rotateY(180deg)"; }
    });
    setTimeout(() => {          // dur and delay are already real milliseconds
      if (g.parentNode) g.parentNode.removeChild(g);
      if (o.done) o.done();
    }, dur + delay + 60);
  },
};

// the engine reaches the motion layer through window.FX (see fxSignal in engine.js)
window.FX = FX;

/* ================================ EDITOR ================================ */

const Editor = {
  selectId: null,
  render() {
    const rSel = $("ed-realm");
    if (!rSel.options.length) {
      realmNames().forEach(n => { const o = document.createElement("option"); o.value = n; o.textContent = n; rSel.appendChild(o); });
      rSel.onchange = () => Editor.renderList();
      $("ed-type").onchange = () => Editor.renderList();
      $("ed-search").oninput = () => Editor.renderList();
      $("ed-new").onclick = () => Editor.newCard();
    }
    if (Editor.selectId) {
      const c = cardById(Editor.selectId);
      if (c) rSel.value = c.realm;
    }
    Editor.renderList();
    Editor.renderForm();
  },
  filtered() {
    const realm = $("ed-realm").value, type = $("ed-type").value, q = $("ed-search").value.toLowerCase();
    return DB.cards.filter(c =>
      (q ? c.name.toLowerCase().includes(q) : c.realm === realm) &&
      (!type || c.type === type));
  },
  renderList() {
    const el = $("ed-list");
    el.innerHTML = "";
    for (const c of Editor.filtered()) {
      const d = document.createElement("div");
      d.className = "item" + (c.id === Editor.selectId ? " sel" : "");
      d.innerHTML = `<span>${c.name}</span><span class="ct">${c.type}</span>`;
      d.onclick = () => { Editor.selectId = c.id; Editor.renderList(); Editor.renderForm(); };
      el.appendChild(d);
    }
  },
  renderForm() {
    const el = $("ed-form");
    const c = Editor.selectId ? cardById(Editor.selectId) : null;
    if (!c) { el.innerHTML = '<p style="color:var(--muted)">Select a card to edit, or create a new one.</p>'; return; }
    const lvl = autoLevel(c);
    const bits = fx(c.id).autoBits.concat(fx(c.id).auxAutoBits || []);
    const realmOpts = realmNames().map(n => `<option ${n === c.realm ? "selected" : ""}>${n}</option>`).join("");
    const typeOpts = ["hero", "relic", "hex", "rite", "pact", "incantation"].map(t => `<option ${t === c.type ? "selected" : ""}>${t}</option>`).join("");
    let extra = "";
    if (c.type === "hero") {
      extra = `<div class="frow">
        <div><label>Attack</label><input id="f-atk" type="number" step="10" value="${c.atk}"></div>
        <div><label>Health</label><input id="f-hp" type="number" step="10" value="${c.hp}"></div>
        <div><label>Rarity</label><input id="f-rarity" value="${c.rarity || ""}"></div>
        <div><label>Aux cost</label><input id="f-auxcost" type="number" value="${c.auxCost}"></div>
        <div><label>Aux slots</label><input id="f-auxslots" type="number" min="1" max="2" value="${c.auxSlots}"></div>
      </div>
      <label style="font-size:11px;color:var(--muted)">Hero Mode ability text</label>
      <textarea id="f-text" style="height:64px">${c.text}</textarea>
      <label style="font-size:11px;color:var(--muted);display:block;margin-top:8px">Auxiliary Mode text</label>
      <textarea id="f-auxtext" style="height:64px">${c.auxText}</textarea>`;
    } else if (c.type === "relic") {
      extra = `<div class="frow"><div><label>Slots (1-2)</label><input id="f-slots" type="number" min="1" max="2" value="${c.slots}"></div></div>
      <label style="font-size:11px;color:var(--muted)">Effect text</label>
      <textarea id="f-text" style="height:80px">${c.text}</textarea>`;
    } else {
      extra = `<label style="font-size:11px;color:var(--muted)">Effect text</label>
      <textarea id="f-text" style="height:96px">${c.text}</textarea>`;
    }
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="pill ${lvl === "auto" ? "auto" : lvl === "manual" ? "manual" : ""}" title="${bits.join(", ") || "no scripted behavior"}">
          engine: ${lvl}${bits.length ? " — " + bits.join(", ") : ""}</span>
        <span style="font-size:11px;color:var(--muted)">${c.id}</span>
      </div>
      <div class="frow">
        <div style="grid-column:span 2"><label>Name</label><input id="f-name" value="${c.name.replace(/"/g, "&quot;")}"></div>
        <div><label>Realm</label><select id="f-realm">${realmOpts}</select></div>
        <div><label>Type</label><select id="f-type">${typeOpts}</select></div>
        <div><label>Cost (Pulse)</label><input id="f-cost" type="number" value="${c.cost}"></div>
      </div>
      ${extra}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="primary" id="f-save">Save card</button>
        <button id="f-dup">Duplicate</button>
        <button id="f-del" style="color:var(--bad)">Delete card</button>
      </div>
      <p style="font-size:11px;color:var(--muted);margin-top:10px">The engine re-reads ability text on save — wording that matches rulebook patterns (auras, "deal N damage…", "draw N", "gain N Pulse", hex triggers, rite timers…) becomes scripted automatically. Anything else plays as stats + manual adjudication. Stat/cost changes always apply. In-play copies use new stats immediately; text changes apply to the next play.</p>`;
    $("f-save").onclick = () => Editor.save(c);
    $("f-dup").onclick = () => Editor.duplicate(c);
    $("f-del").onclick = () => Editor.remove(c);
  },
  save(c) {
    c.name = $("f-name").value.trim() || c.name;
    c.realm = $("f-realm").value;
    c.type = $("f-type").value;
    c.cost = +$("f-cost").value || 0;
    c.text = $("f-text") ? $("f-text").value.trim() : c.text;
    if (c.type === "hero") {
      c.atk = +$("f-atk").value || 0;
      c.hp = +$("f-hp").value || 0;
      c.rarity = $("f-rarity").value.trim();
      c.auxCost = +$("f-auxcost").value || 1;
      c.auxSlots = +$("f-auxslots").value || 1;
      c.auxText = $("f-auxtext").value.trim();
    }
    if (c.type === "relic") c.slots = $("f-slots") ? (+$("f-slots").value || 1) : (c.slots || 1);
    saveDB();
    COMPILED[c.id] = compileCard(c);
    Editor.render();
    UI.toast(`Saved ${c.name} — engine: ${autoLevel(c)}`);
    if (G) UI.render();
  },
  newCard() {
    const realm = $("ed-realm").value || realmNames()[0];
    const id = "custom--" + Date.now();
    const c = { id, realm, name: "New card", type: "hero", cost: 3, atk: 40, hp: 50, rarity: "Common", text: "", auxCost: 1, auxSlots: 1, auxText: "" };
    DB.cards.push(c);
    saveDB();
    COMPILED[id] = compileCard(c);
    Editor.selectId = id;
    Editor.render();
  },
  duplicate(c) {
    const copy = JSON.parse(JSON.stringify(c));
    copy.id = "custom--" + Date.now();
    copy.name = c.name + " (copy)";
    DB.cards.push(copy);
    saveDB();
    COMPILED[copy.id] = compileCard(copy);
    Editor.selectId = copy.id;
    Editor.render();
  },
  remove(c) {
    if (!confirm(`Delete "${c.name}" from the card database?`)) return;
    DB.cards = DB.cards.filter(x => x.id !== c.id);
    saveDB();
    Editor.selectId = null;
    Editor.render();
  },
};

/* ============================== RULES TAB ============================== */

const RulesTab = {
  render() {
    const grid = $("const-grid");
    grid.innerHTML = "";
    for (const [k, v] of Object.entries(C())) {
      const d = document.createElement("div");
      const label = k.replace(/([A-Z])/g, " $1").toLowerCase();
      if (typeof v === "boolean") {
        d.innerHTML = `<label>${label}</label><input type="checkbox" id="const-${k}" ${v ? "checked" : ""} style="width:auto">`;
      } else if (Array.isArray(v)) {
        d.innerHTML = `<label>${label} (comma-separated)</label><input id="const-${k}" value="${v.join(", ")}">`;
      } else if (v == null) {
        d.innerHTML = `<label>${label} (blank = none)</label><input id="const-${k}" value="">`;
      } else {
        d.innerHTML = `<label>${label}</label><input type="number" id="const-${k}" value="${v}">`;
      }
      grid.appendChild(d);
    }
    $("rules-text").value = DB.rulesText || "";
  },
  saveConsts() {
    for (const k of Object.keys(C())) {
      const el = $("const-" + k);
      if (!el) continue;
      if (el.type === "checkbox") C()[k] = el.checked;
      else if (Array.isArray(C()[k])) C()[k] = el.value.split(",").map(s => +s.trim()).filter(n => !isNaN(n));
      else if (el.value.trim() === "") C()[k] = null;
      else C()[k] = +el.value;
    }
    saveDB();
    UI.toast("Constants saved — they apply from the next game.");
  },
  saveText() {
    DB.rulesText = $("rules-text").value;
    saveDB();
    UI.toast("Rule text saved.");
  },
};

/* ================================ WIRING ================================ */

window.addEventListener("DOMContentLoaded", () => {
  loadDB();
  $("verinfo").textContent = `${DB.cards.length} cards · ${DB.realms.length} realms`;
  const devbar = $("devtools");
  if (devbar) devbar.style.display = DEV ? "inline-flex" : "none";
  if (DEV && window.CUSTOM_DATA && window.CUSTOM_DATA.cards && $("btn-reset")) $("btn-reset").textContent = "Reset to published data";
  UI.renderSetup();

  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on("tab-play", () => UI.show(G ? "game" : "setup"));
  on("btn-newgame", () => { UI.renderSetup(); UI.show("setup"); });
  if (DEV) {
    on("tab-cards", () => UI.show("cards"));
    on("tab-rules", () => UI.show("rules"));
  }

  if (DEV) {
    on("btn-export", exportDB);
    on("btn-import", () => $("import-file").click());
    const imp = $("import-file");
    if (imp) imp.onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { importDB(r.result); UI.toast("Imported."); UI.renderSetup(); if (UI.screen === "cards") Editor.render(); }
        catch (err) { UI.toast("Import failed: " + err.message); }
      };
      r.readAsText(f);
      e.target.value = "";
    };
  }
  on("btn-reset", () => {
    if (confirm("Discard ALL your edits (cards, constants, rule text) and restore the published rulebook data?")) {
      resetDB();
      UI.toast("Reset to rulebook defaults.");
      UI.renderSetup();
      if (UI.screen === "cards") Editor.render();
      if (UI.screen === "rules") RulesTab.render();
    }
  });

  // setup controls
  document.querySelectorAll("#diff-btns button").forEach(b => b.onclick = () => {
    UI.setup.difficulty = b.dataset.d;
    document.querySelectorAll("#diff-btns button").forEach(x => x.classList.toggle("active-tab", x === b));
  });
  document.querySelectorAll("#ai-mode-btns button").forEach(b => b.onclick = () => {
    UI.setup.aiMode = b.dataset.m;
    document.querySelectorAll("#ai-mode-btns button").forEach(x => x.classList.toggle("active-tab", x === b));
    $("ai-realms").style.display = b.dataset.m === "pick" ? "grid" : "none";
  });
  document.querySelectorAll("#first-btns button").forEach(b => b.onclick = () => {
    UI.setup.first = b.dataset.f;
    document.querySelectorAll("#first-btns button").forEach(x => x.classList.toggle("active-tab", x === b));
  });
  $("btn-rand-mine").onclick = () => { UI.setup.mine = shuffle(realmNames()).slice(0, C().lanes); UI.renderSetup(); };
  $("btn-start").onclick = () => UI.startGame();

  // game controls
  $("btn-endturn").onclick = () => UI.endTurnClicked();
  $("btn-undo").onclick = () => { if (undo()) { UI.sel = []; UI.pending = null; UI.render(); UI.toast("Undone."); } else UI.toast("Nothing to undo."); };
  $("btn-cancel").onclick = () => UI.settlePending(null);
  $("btn-sandbox-toggle").onclick = () => { UI.sandboxOpen = !UI.sandboxOpen; $("sandbox").style.display = UI.sandboxOpen ? "" : "none"; };
  $("ai-face").onclick = () => UI.clickFace(1);
  $("overlay").onclick = (e) => { if (e.target === $("overlay")) UI.closeZoom(); };

  document.querySelectorAll("[data-sb]").forEach(b => b.onclick = () => {
    if (!G) return;
    const [what, arg] = b.dataset.sb.split(":");
    pushUndo();
    const P = { "my": G.players[0], "ai": G.players[1] }[what.split("-")[0]];
    const act = what.split("-")[1];
    if (act === "mort") { P.mortality += +arg; log(`Sandbox: ${P.name} Mortality ${+arg > 0 ? "+" : ""}${arg}.`); checkWin(); }
    if (act === "pulse") { P.pulse = Math.max(0, P.pulse + +arg); log(`Sandbox: ${P.name} Pulse ${+arg > 0 ? "+" : ""}${arg}.`); }
    if (act === "draw") drawCard(G.players.indexOf(P));
    if (what === "add-card") {
      const q = prompt("Type part of a card name to add to your hand:");
      if (q) {
        const matches = DB.cards.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
        if (!matches.length) UI.toast("No match.");
        else if (matches.length > 6) UI.toast(`${matches.length} matches — be more specific.`);
        else if (matches.length > 1) UI.toast("Matches: " + matches.map(m => m.name).join(" · ") + " — be more specific.");
        else { G.players[0].hand.push(matches[0].id); log(`Sandbox: ${matches[0].name} added to your hand.`); }
      }
    }
    UI.render();
  });

  // rules tab buttons
  $("btn-save-consts").onclick = () => RulesTab.saveConsts();
  $("btn-save-rules").onclick = () => RulesTab.saveText();

  UI.show("setup");
});
