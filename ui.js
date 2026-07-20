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
        const relicPills = L.hero.relics.map(r => `<span class="pill relic" data-ruid="${r.uid}" title="${(cardById(r.cardId).text || "").replace(/"/g, "&quot;")}">${cardById(r.cardId).name}${r.counters ? " ⚒" + r.counters : ""}</span>`).join(" ");
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
const SUPPORT_STYLE = {
  hex:  { col:"#c7aee8", bg:"#2a2140", glyph:'<path d="M6 1 L11 6 L6 11 L1 6 Z" fill="currentColor"/>' },
  rite: { col:"#9ed6c6", bg:"#17302a", glyph:'<circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="6" r="1.4" fill="currentColor"/>' },
  pact: { col:"#e39a86", bg:"#3a221c", glyph:'<path d="M6 11 C2 8 1 5 2.6 3 C4 1.4 6 2.6 6 4.2 C6 2.6 8 1.4 9.4 3 C11 5 10 8 6 11 Z" fill="currentColor"/>' },
  incantation: { col:"#a2dcf2", bg:"#162836", glyph:'<path d="M6 1 L7.4 4.6 L11 6 L7.4 7.4 L6 11 L4.6 7.4 L1 6 L4.6 4.6 Z" fill="currentColor"/>' },
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
