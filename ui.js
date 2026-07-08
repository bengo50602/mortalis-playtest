// Mortalis: Realms playtest UI — rendering + interaction. Engine logic lives in engine.js.
"use strict";

const $ = (id) => document.getElementById(id);

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
    $("tab-play").classList.toggle("active-tab", screen === "setup" || screen === "game");
    $("tab-cards").classList.toggle("active-tab", screen === "cards");
    $("tab-rules").classList.toggle("active-tab", screen === "rules");
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
    $("prompt").textContent = UI.pending ? UI.pending.msg :
      (UI.sel.length ? `${UI.sel.length} attacker${UI.sel.length > 1 ? "s" : ""} selected — click a red target (or click Hero again to deselect)` : "");
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

    UI.renderSlots("ai-slots", 1);
    UI.renderSlots("my-slots", 0);
    UI.renderLanes("ai-lanes", 1);
    UI.renderLanes("my-lanes", 0);
    UI.renderHand();
    UI.renderLog();
  },

  statSpan(base, eff) {
    const cls = eff > base ? "buffed" : eff < base ? "nerfed" : "";
    return `<span class="${cls}">${eff}</span>`;
  },

  renderLanes(elId, pi) {
    const el = $(elId);
    el.innerHTML = "";
    const P = G.players[pi];
    P.lanes.forEach((L, li) => {
      const lane = document.createElement("div");
      lane.className = "lane";
      const unlocked = laneUnlocked(pi, li);
      if (!unlocked) lane.style.opacity = "0.45";
      const tag = document.createElement("div");
      tag.className = "realm-tag";
      const sched = C().laneUnlockTurns || [];
      tag.textContent = unlocked ? `Lane ${li + 1} · ${L.realm}` : `Lane ${li + 1} · ${L.realm} 🔒`;
      lane.appendChild(tag);
      if (!unlocked) {
        const slot = document.createElement("div");
        slot.className = "heroslot";
        slot.textContent = `Locked — unlocks on turn ${sched[li] || "?"}`;
        lane.appendChild(slot);
        el.appendChild(lane);
        return;
      }

      const auxRow = document.createElement("div");
      auxRow.className = "slotrow";
      const heroBox = document.createElement("div");

      // hero slot / card
      if (L.hero) {
        const c = cardById(L.hero.cardId);
        const div = document.createElement("div");
        div.className = "herocard";
        const atk = effAtk(pi, li), hp = curHp(pi, li), mhp = effMaxHp(pi, li);
        const exhausted = pi === G.active && L.hero.attacksUsed >= maxAttacksOf(pi, li);
        if (exhausted) div.classList.add("exhausted");
        if (pi === 0 && UI.sel.includes(li)) div.classList.add("selected");
        const isTarget = UI.targetableHeroes().some(t => t.pi === pi && t.li === li);
        if (isTarget) div.classList.add("targetable");
        const relicPills = L.hero.relics.map(r => `<span class="pill">${cardById(r.cardId).name}${r.counters ? " ⚒" + r.counters : ""}</span>`).join(" ");
        const freeRelic = C().relicSlotsPerHero - L.hero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0);
        div.innerHTML = `<div class="nm">${c.name} <span style="color:var(--muted)">(${c.cost})</span></div>
          <div class="stats">${UI.statSpan(c.atk, atk)} ATK · ${UI.statSpan(c.hp, hp)}/${mhp} HP</div>
          <div class="txt">${c.text}</div>
          <div style="margin-top:3px">${relicPills}${freeRelic > 0 ? ` <span class="pill" style="opacity:.6">${freeRelic} relic slot${freeRelic > 1 ? "s" : ""}</span>` : ""}</div>
          ${autoLevel(c) === "manual" ? '<span class="badge-manual" title="Ability not scripted — adjudicate manually"></span>' : ""}`;
        div.onclick = (e) => { e.stopPropagation(); UI.clickBoardHero(pi, li); };
        div.ondblclick = (e) => { e.stopPropagation(); UI.sel = UI.sel.filter(x => x !== li || pi !== 0); UI.zoomCard(c, { kind: "boardHero", pi, li }); };
        heroBox.appendChild(div);
      } else {
        const slot = document.createElement("div");
        slot.className = "heroslot";
        slot.textContent = "Empty lane";
        if (UI.pending && UI.pending.type === "lane" && UI.pending.side === pi && UI.pending.lanes.includes(li)) {
          slot.classList.add("eligible");
          slot.textContent = "Play here";
          slot.onclick = (e) => { e.stopPropagation(); UI.settlePending(li); };
        }
        heroBox.appendChild(slot);
      }
      // lane-pick highlight when hero present (relic/aux/hex/rite targets)
      if (L.hero && UI.pending && UI.pending.type === "lane" && UI.pending.side === pi && UI.pending.lanes.includes(li)) {
        heroBox.firstChild.classList.add("targetable");
        heroBox.firstChild.onclick = (e) => { e.stopPropagation(); UI.settlePending(li); };
      }

      // aux slots
      const seen = new Set();
      L.aux.forEach((a, ai2) => {
        const s = document.createElement("div");
        s.className = "minislot";
        if (a) {
          const c = cardById(a.cardId);
          if (seen.has(a.uid)) { s.classList.add("filled"); s.textContent = "(2-slot)"; s.style.opacity = ".55"; }
          else { s.classList.add("filled"); s.textContent = c.name; }
          seen.add(a.uid);
          s.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "aux", pi, li, auxUid: a.uid }); };
        } else s.textContent = "Aux";
        auxRow.appendChild(s);
      });

      if (pi === 1) { lane.appendChild(heroBox); lane.appendChild(auxRow); }
      else { lane.appendChild(auxRow); lane.appendChild(heroBox); }
      el.appendChild(lane);
    });
  },

  renderSlots(elId, pi) {
    const el = $(elId);
    el.innerHTML = "";
    const P = G.players[pi];
    P.slots.forEach((s, si) => {
      const d = document.createElement("div");
      d.className = "sharedslot";
      if (!s) { d.textContent = "open"; }
      else {
        d.classList.add("filled");
        const c = cardById(s.cardId);
        if (s.kind === "hex" && s.faceDown && pi === 1) d.textContent = "face-down Hex";
        else if (s.kind === "hex") d.textContent = `Hex: ${c.name} (L${s.laneIdx + 1})`;
        else if (s.kind === "rite") {
          const r = fx(s.cardId).rite;
          d.textContent = `Rite: ${c.name} ${s.counters}/${(r && (r.timer || r.counterMax)) || "?"}`;
        } else d.textContent = `Pact: ${c.name}`;
        if (!(s.kind === "hex" && s.faceDown && pi === 1))
          d.onclick = (e) => { e.stopPropagation(); UI.zoomCard(c, { kind: "slot", pi, si }); };
      }
      el.appendChild(d);
    });
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
    if (UI.busy) return;
    // pending hero pick?
    if (UI.pending && UI.pending.type === "hero") {
      if (UI.pending.cands.some(t => t.pi === pi && t.li === li)) UI.settlePending({ pi, li });
      return;
    }
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
    UI.addAction("Edit this card", () => { Editor.selectId = c.id; UI.show("cards"); });
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
    if (G.active === 1) UI.runAI();
  },

  async runAI() {
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
  if (window.CUSTOM_DATA && window.CUSTOM_DATA.cards) $("btn-reset").textContent = "Reset to published data";
  UI.renderSetup();

  $("tab-play").onclick = () => UI.show(G ? "game" : "setup");
  $("tab-cards").onclick = () => UI.show("cards");
  $("tab-rules").onclick = () => UI.show("rules");
  $("btn-newgame").onclick = () => { UI.renderSetup(); UI.show("setup"); };

  $("btn-export").onclick = exportDB;
  $("btn-import").onclick = () => $("import-file").click();
  $("import-file").onchange = (e) => {
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
  $("btn-reset").onclick = () => {
    if (confirm("Discard ALL your edits (cards, constants, rule text) and restore the published rulebook data?")) {
      resetDB();
      UI.toast("Reset to rulebook defaults.");
      UI.renderSetup();
      if (UI.screen === "cards") Editor.render();
      if (UI.screen === "rules") RulesTab.render();
    }
  };

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
