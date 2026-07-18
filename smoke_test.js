// Effect smoke test — audits every card's compiled behavior in a staged game.
// Not loaded by index.html. Run from the browser console on the app page:
//   fetch('smoke_test.js').then(r=>r.text()).then(eval).then(()=>runSmokeTest())
// Both players are flagged as AI so choice-effects auto-resolve without UI.

async function runSmokeTest() {
  const issues = [];
  const saveG = typeof G !== "undefined" ? G : null;

  // synthetic vanilla hero per realm = clean ground truth for aura math
  const dummies = {};
  for (const r of realmNames()) {
    const d = { id: "smoke-dummy--" + r.toLowerCase().replace(/[^a-z0-9]+/g, "-"), realm: r, name: "Smoke Dummy " + r, type: "hero", cost: 3, atk: 50, hp: 90, rarity: "Common", text: "", auxCost: 1, auxSlots: 1, auxText: "" };
    DB.cards.push(d);
    COMPILED[d.id] = compileCard(d);
    dummies[r] = d.id;
  }
  const dummyId = dummies[realmNames()[0]];

  function mkG(realm) {
    const mk = (n) => ({
      name: n, isAI: true, mortality: 250, pulse: 99, fatigue: 0, turnCount: 9,
      realms: [realm, realm, realm, realm],
      lanes: [0, 1, 2, 3].map(() => ({ realm, hero: null, aux: [null, null] })),
      slots: [null, null, null, null],
      deck: new Array(30).fill(dummies[realm]), hand: [dummies[realm], dummies[realm], dummies[realm]],
    });
    G = { players: [mk("T1"), mk("T2")], difficulty: "medium", active: 0, firstPlayer: 0, turn: 20, gt: 20, over: false, winner: null, log: [] };
  }
  // richer stage: enemy + own presence so targeted ops have things to hit; some
  // damage on boards so heals are visible
  function stageBoards(realm) {
    G.players[1].lanes[0].hero = heroInst(dummies[realm]); G.players[1].lanes[0].hero.dmg = 30;
    G.players[1].lanes[1].hero = heroInst(dummies[realm]); G.players[1].lanes[1].hero.dmg = 30;
    G.players[1].lanes[1].hero.relics.push({ uid: uid(), cardId: DB.cards.find(c => c.type === "relic" && c.realm === realm).id, counters: 0 });
    G.players[1].lanes[2].aux[0] = { uid: uid(), cardId: dummies[realm] };
    G.players[1].slots[0] = { uid: uid(), cardId: DB.cards.find(c => c.type === "rite" && c.realm === realm).id, kind: "rite", laneIdx: 0, counters: 0 };
    G.players[0].lanes[2].hero = heroInst(dummies[realm]); G.players[0].lanes[2].hero.dmg = 30;
    G.players[0].lanes[3].hero = heroInst(dummies[realm]); G.players[0].lanes[3].hero.dmg = 30;
  }

  // Whole-state fingerprint — any pulse/mortality/hand/deck/board/slot change shows up.
  function fullSnap() {
    return JSON.stringify(G.players.map(p => ({
      pulse: p.pulse, mort: p.mortality, hand: p.hand.length, deck: p.deck.length,
      lanes: p.lanes.map(L => ({
        h: L.hero ? { id: L.hero.cardId, pa: L.hero.permAtk, ph: L.hero.permHp, ra: L.hero.redAtk, rh: L.hero.redHp, dmg: L.hero.dmg, rel: L.hero.relics.length, temp: L.hero.temp.length } : null,
        aux: L.aux.map(a => a && a.cardId),
      })),
      slots: p.slots.map(s => s && s.kind),
    })));
  }

  // expected same-lane self-aura (hero/relic/aux hitting the hero it sits with)
  function expectedSelfAura(contList, cardRealm) {
    let atk = 0, hp = 0;
    for (const e of contList) {
      if (e.scope === "equipped" || e.scope === "laneHero") { atk += e.atk; hp += e.hp; }
      else if (e.scope === "allFriendly" && !e.excludeSelf && (!e.realmFilter || e.realmFilter === cardRealm)
               && !(e.otherRealmFilter && e.otherRealmFilter === cardRealm)) { atk += e.atk; hp += e.hp; }
    }
    return { atk, hp };
  }
  // does this card carry any aura that reaches beyond its own lane?
  function hasRemoteAura(f) {
    return [].concat(f.cont || [], f.auxCont || []).some(e => ["neighbors", "opposingEnemy", "allEnemy", "allFriendly"].includes(e.scope));
  }

  for (const c of DB.cards) {
    if (c.id.startsWith("smoke-dummy--")) continue;
    const f = fx(c.id);

    try {
      if (c.type === "hero") {
        // --- hero mode + on-enter ---
        mkG(c.realm); stageBoards(c.realm);
        G.players[0].lanes[0].hero = null;
        G.players[0].hand.push(c.id);
        const pre = fullSnap();
        await playHero(0, G.players[0].hand.length - 1, 0);
        if (!G.players[0].lanes[0].hero) issues.push([c.name, "hero", "hero not on board after play"]);
        if (f.onEnter) {
          const fizz = G.log.some(l => /fizzle|No valid|no enemy|No Hero|No Relic|Nothing to/i.test(l.msg));
          if (fullSnap() === pre && !fizz) issues.push([c.name, "hero-onEnter", "compiled on-enter produced no state change"]);
        }
        // hero self-aura ground truth (skip dynamic "missing health" text)
        if (G.players[0].lanes[0].hero && !/missing/i.test(c.text)) {
          const exp = expectedSelfAura(f.cont, c.realm);
          if (exp.atk !== 0 || exp.hp !== 0) {
            const gotAtk = effAtk(0, 0) - c.atk, gotHp = effMaxHp(0, 0) - c.hp;
            if (gotAtk !== exp.atk || gotHp !== exp.hp) issues.push([c.name, "hero-aura", `self aura expected +${exp.atk}/+${exp.hp}, got +${gotAtk}/+${gotHp}`]);
          }
        }
        // remote aura sanity: hero in lane 1, dummies in lane 2 (neighbor) & opposing lane 1
        if (hasRemoteAura(f)) {
          mkG(c.realm);
          G.players[0].lanes[1].hero = heroInst(c.id);
          G.players[0].lanes[2].hero = heroInst(dummies[c.realm]);
          G.players[1].lanes[1].hero = heroInst(dummies[c.realm]);
          const nb0 = effAtk(0, 2) + effMaxHp(0, 2), en0 = effAtk(1, 1) + effMaxHp(1, 1);
          // recompute after (auras are computed live, so just read again with hero present vs absent)
          G.players[0].lanes[1].hero = null;
          const nb1 = effAtk(0, 2) + effMaxHp(0, 2), en1 = effAtk(1, 1) + effMaxHp(1, 1);
          // otherRealmFilter auras hit nothing in the staged same-realm board — skip them
          const reaches = [].concat(f.cont).some(e => ["neighbors", "opposingEnemy", "allEnemy", "allFriendly"].includes(e.scope) && !(e.otherRealmFilter && e.otherRealmFilter === c.realm));
          if (reaches && nb0 === nb1 && en0 === en1) issues.push([c.name, "hero-remote-aura", "aura scope declared but no neighbor/opposing/board effect measured"]);
        }
        // passive "whenever takes damage" growth (permanent or temporary)
        if (f.onDamaged) {
          mkG(c.realm);
          G.players[0].lanes[0].hero = heroInst(c.id);
          const h0 = G.players[0].lanes[0].hero;
          const pa = h0.permAtk, tn = h0.temp.length;
          dealDamage({ pi: 0, li: 0 }, 20, { sourceName: "test" });
          if (G.players[0].lanes[0].hero && h0.permAtk === pa && h0.temp.length === tn) issues.push([c.name, "hero-onDamaged", "damage-growth trigger did not raise Attack"]);
        }
        // start-of-turn ops shouldn't crash
        mkG(c.realm); stageBoards(c.realm);
        G.players[0].lanes[0].hero = heroInst(c.id);
        G.active = 0; endTurn(); endTurn();
        // --- aux mode ---
        mkG(c.realm); stageBoards(c.realm);
        G.players[0].lanes[2].hero = heroInst(dummies[c.realm]);
        const baseAtk = effAtk(0, 2), baseHp = effMaxHp(0, 2);
        G.players[0].hand.push(c.id);
        await playAux(0, G.players[0].hand.length - 1, 2);
        const placed = G.players[0].lanes[2].aux.some(a => a && a.cardId === c.id);
        if (!placed && !f.auxSelfDestruct) issues.push([c.name, "aux", "aux not placed (and not self-destructing)"]);
        if (placed) {
          const exp = expectedSelfAura(f.auxCont, c.realm);
          if (exp.atk !== 0 || exp.hp !== 0) {
            const gotAtk = effAtk(0, 2) - baseAtk, gotHp = effMaxHp(0, 2) - baseHp;
            if (gotAtk !== exp.atk || gotHp !== exp.hp) issues.push([c.name, "aux-aura", `lane aura expected +${exp.atk}/+${exp.hp}, got +${gotAtk}/+${gotHp}`]);
          }
          endTurn(); endTurn();
        }
        // --- activated abilities (hero) ---
        mkG(c.realm); stageBoards(c.realm);
        G.players[0].lanes[0].hero = heroInst(c.id);
        G.players[0].lanes[1].hero = heroInst(dummies[c.realm]); // fuel for sacrifice
        for (let i = 0; i < f.activated.length; i++) {
          const ab = f.activated[i];
          if (!ab.ops) continue;
          G.players[0].lanes[0].hero.usedAb = {};
          const pre2 = fullSnap();
          await activateAbility(0, 0, G.players[0].lanes[0].hero, c.name, ab, i);
          const fizz = G.log.some(l => /fizzle|No valid|no enemy|No Hero|No Relic|Nothing to/i.test(l.msg));
          if (fullSnap() === pre2 && !fizz) issues.push([c.name, "activated#" + i, "activated ability produced no state change"]);
        }
      } else if (c.type === "relic") {
        mkG(c.realm); stageBoards(c.realm);
        const li = 2;
        const baseAtk = effAtk(0, li), baseHp = effMaxHp(0, li);
        G.players[0].hand.push(c.id);
        playRelic(0, G.players[0].hand.length - 1, li);
        const exp = expectedSelfAura(f.cont, c.realm);
        if (exp.atk !== 0 || exp.hp !== 0) {
          const gotAtk = effAtk(0, li) - baseAtk, gotHp = effMaxHp(0, li) - baseHp;
          if (gotAtk !== exp.atk || gotHp !== exp.hp) issues.push([c.name, "relic-aura", `expected +${exp.atk}/+${exp.hp}, got +${gotAtk}/+${gotHp}`]);
        }
        const r = G.players[0].lanes[li].hero.relics.find(x => x.cardId === c.id);
        for (let i = 0; i < f.activated.length; i++) {
          const ab = f.activated[i];
          if (!ab.ops) continue;
          r.usedAb = {};
          const pre2 = fullSnap();
          await activateAbility(0, li, r, c.name, ab, i, r);
          const fizz = G.log.some(l => /fizzle|No valid|no enemy|No Hero|No Relic|Nothing to/i.test(l.msg));
          if (fullSnap() === pre2 && !fizz) issues.push([c.name, "relic-activated#" + i, "activated ability produced no state change"]);
        }
        endTurn(); endTurn();
      } else if (c.type === "pact" || c.type === "incantation") {
        mkG(c.realm); stageBoards(c.realm);
        G.players[0].hand.push(c.id);
        const pre = fullSnap();
        await playSpell(0, G.players[0].hand.length - 1);
        if (f.spellOps && f.spellOps !== "manual") {
          const fizz = G.log.some(l => /fizzle|No valid|Nothing to destroy|No Hero to sacrifice|No Relic|no enemy/i.test(l.msg));
          if (fullSnap() === pre && !fizz) issues.push([c.name, "spell", "scripted spell resolved with no state change"]);
        }
      } else if (c.type === "hex") {
        mkG(c.realm); stageBoards(c.realm);
        if (f.hexTrig && f.hexTrig !== "manual") {
          const ev = f.hexTrig.event;
          G.players[0].slots[1] = { uid: uid(), cardId: c.id, kind: "hex", faceDown: true, laneIdx: f.hexNeighborLane ? 1 : 2 };
          const pre = fullSnap();
          if (ev === "attackLane") {
            const combat = { atkMod: 0, atkSet: null, swap: false, blocked: false };
            await fireHexes(0, "attackLane", { laneIdx: 2, combat, attacker: { pi: 1, li: 1 }, defender: { pi: 0, li: 2 } });
            const modApplied = combat.atkMod !== 0 || combat.atkSet != null || combat.swap || combat.blocked || (combat.defAtkMod || 0) !== 0 || (combat.prevent || 0) !== 0;
            if (!modApplied && fullSnap() === pre) issues.push([c.name, "hex", "attackLane hex triggered but nothing happened"]);
          } else if (ev === "laneHeroDied") {
            await fireHexes(0, "laneHeroDied", { laneIdx: 2, killer: { pi: 1, li: 1 }, deadOwner: 0, lastCost: 4 });
            if (fullSnap() === pre) issues.push([c.name, "hex", "laneHeroDied hex triggered but nothing happened"]);
          } else if (ev === "oppHeroPlayed") {
            await fireHexes(0, "oppHeroPlayed", { played: { pi: 1, li: 0 } });
            if (fullSnap() === pre) issues.push([c.name, "hex", "oppHeroPlayed hex triggered but nothing happened"]);
          } else if (ev === "oppIncant") {
            const negate = { negated: false };
            await fireHexes(0, "oppIncant", { negate });
            if (!negate.negated) issues.push([c.name, "hex", "counterspell hex did not negate"]);
          } else if (ev === "onslaughtFailed") {
            await fireHexes(0, "onslaughtFailed", { laneIdx: 2, onslaughtAttackers: [{ pi: 1, li: 0 }, { pi: 1, li: 1 }] });
          } else if (ev === "friendlySacrificed" || ev === "friendlyDiedAny" || ev === "friendlyKill") {
            await fireHexes(0, ev, {});
          } else if (ev === "oppSupportPlayed") {
            await fireHexes(0, "oppSupportPlayed", { playedSupport: { kind: "aux", tpi: 1, li: 2, uid: G.players[1].lanes[2].aux[0].uid } });
          } else if (ev === "postCombat") {
            await fireHexes(0, "postCombat", { laneIdx: 2, attacker: { pi: 1, li: 1 }, defender: { pi: 0, li: 2 }, defenderTookDamage: true });
          } else if (ev === "ownAttack") {
            const combat = { atkMod: 0 };
            await fireHexes(0, "ownAttack", { laneIdx: 2, combat });
          } else if (ev === "oppEndTurn") {
            G.players[0].slots[1].laneIdx = 2;
            await fireHexes(0, "oppEndTurn", {});
          } else if (ev === "tookDamage") {
            await fireHexes(0, "tookDamage", { laneIdx: 2, defender: { pi: 0, li: 2 } });
          } else if (ev === "statReduced") {
            await fireHexes(0, "statReduced", { reducedAt: { pi: 0, li: 2 } });
          } else if (ev === "friendlyKill") {
            await fireHexes(0, "friendlyKill", { laneIdx: 2, victor: { pi: 0, li: 2 } });
          }
          if (!f.hexTrig.persistent && G.players[0].slots[1]) issues.push([c.name, "hex", "one-shot hex not consumed after trigger"]);
        }
      } else if (c.type === "rite") {
        mkG(c.realm); stageBoards(c.realm);
        for (const which of ["payoff", "early"]) {
          const ops = f.rite && (which === "payoff" ? f.rite.payoff : f.rite.early);
          if (!ops || ops === "manual") continue;
          G.players[0].slots[0] = { uid: uid(), cardId: c.id, kind: "rite", laneIdx: 2, counters: 3 };
          const pre = fullSnap();
          await resolveRite(0, 0, which);
          const fizz = G.log.some(l => /fizzle|No valid|no enemy|Nothing to/i.test(l.msg));
          if (fullSnap() === pre && !fizz) issues.push([c.name, "rite-" + which, "scripted rite resolved with no state change"]);
        }
      }
    } catch (e) {
      issues.push([c.name, c.type, "EXCEPTION: " + e.message]);
    }
  }

  DB.cards = DB.cards.filter(x => !x.id.startsWith("smoke-dummy--"));
  for (const r of Object.values(dummies)) delete COMPILED[r];
  G = saveG;
  return issues;
}
