// Mortalis: Realms playtest engine — data, effect compiler, rules, combat, AI.
// Everything here is plain JS on purpose so you can open it and change any rule.

"use strict";

/* ============================== DATA LAYER ============================== */

const LS_KEY = "mortalis_playtest_db_v1";
let DB = null;

// Published data (custom.js) beats built-in defaults; a visitor's own local
// edits (localStorage) beat both.
function baseData() {
  if (window.CUSTOM_DATA && window.CUSTOM_DATA.cards) {
    const d = JSON.parse(JSON.stringify(window.CUSTOM_DATA));
    if (!d.rulesText) d.rulesText = window.DEFAULT_RULES_TEXT;
    return d;
  }
  const d = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
  d.rulesText = window.DEFAULT_RULES_TEXT;
  return d;
}
function loadDB() {
  DB = null;
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    try { DB = JSON.parse(saved); } catch (e) { DB = null; }
  }
  if (!DB || !DB.cards) DB = baseData();
  else {
    // older saved data may predate newly added game constants — fill the gaps
    const base = baseData();
    for (const k of Object.keys(base.constants)) if (!(k in DB.constants)) DB.constants[k] = base.constants[k];
  }
  if (!DB.rulesText) DB.rulesText = window.DEFAULT_RULES_TEXT;
  recompileAll();
}
function saveDB() { localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
function resetDB() { localStorage.removeItem(LS_KEY); loadDB(); }
function exportDB() {
  const blob = new Blob([JSON.stringify(DB, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mortalis_playtest_data.json";
  a.click();
}
function importDB(json) {
  const d = JSON.parse(json);
  if (!d.cards || !d.constants) throw new Error("Not a Mortalis data file");
  DB = d; saveDB(); recompileAll();
}

function cardById(id) { return DB.cards.find(c => c.id === id); }
function realmNames() { return DB.realms.map(r => r.name); }
function C() { return DB.constants; }

/* ============================ EFFECT COMPILER ============================ */
// Best-effort: recognizes the common wording patterns from the rulebook and
// turns them into engine behavior. Anything it can't parse is flagged
// "manual" — the card still plays for its stats/cost and you adjudicate the
// text by hand with the sandbox tools.

const COMPILED = {};
function recompileAll() { DB.cards.forEach(c => { COMPILED[c.id] = compileCard(c); }); }
function fx(cardId) { return COMPILED[cardId] || compileCard(cardById(cardId)); }

const NUM = "(\\d+)";
function sentences(text) { return (text || "").split(/(?<=\.)\s+/).map(s => s.trim()).filter(Boolean); }
function norm(s) { return s.replace(/[−–]/g, "-"); }

function parseScope(s, sourceKind) {
  s = s.toLowerCase();
  if (/all other heroes you control/.test(s)) return { scope: "allFriendly", excludeSelf: true };
  const mRealm = s.match(/all (?:other )?([a-z]+) heroes you control|all your ([a-z]+) heroes/);
  if (mRealm) {
    const realm = (mRealm[1] || mRealm[2] || "");
    const rn = realmNames().find(r => r.toLowerCase() === realm);
    if (rn) return { scope: "allFriendly", realmFilter: rn, excludeSelf: /other/.test(s) };
  }
  if (/all heroes you control/.test(s)) return { scope: "allFriendly" };
  if (/heroes you control in neighboring lanes|neighboring heroes|heroes in neighboring lanes/.test(s)) return { scope: "neighbors" };
  if (/enemy hero in the (?:opposing lane|lane opposing this one)/.test(s)) return { scope: "opposingEnemy" };
  if (/all enemy heroes/.test(s)) return { scope: "allEnemy" };
  if (sourceKind === "relic" && /this hero/.test(s)) return { scope: "equipped" };
  if (sourceKind === "aux" && /the hero in this lane/.test(s)) return { scope: "laneHero" };
  return null;
}

function parseStatClause(s) {
  s = norm(s);
  let m = s.match(new RegExp(`([+-])${NUM} Attack and ([+-])${NUM} Health`));
  if (m) return { atk: (m[1] === "-" ? -1 : 1) * +m[2], hp: (m[3] === "-" ? -1 : 1) * +m[4] };
  m = s.match(new RegExp(`([+-])${NUM} Attack`));
  if (m) return { atk: (m[1] === "-" ? -1 : 1) * +m[2], hp: 0 };
  m = s.match(new RegExp(`([+-])${NUM} Health`));
  if (m) return { atk: 0, hp: (m[1] === "-" ? -1 : 1) * +m[2] };
  return null;
}

// Parse a simple imperative clause into ops. Returns null if unrecognized.
function parseOp(cl) {
  cl = norm(cl.trim().replace(/\.$/, "").replace(/\s*\((?:stat reduction[^)]*|wards?[^)]*|rounded[^)]*|minimum \d+|maximum \d+|no stat bonus)\)/gi, ""));
  let m;
  // ---- scoped buffs / heals / reductions (added for full coverage) ----
  if ((m = cl.match(new RegExp(`^(?:all|each|every) Hero(?:es)? you control (?:of any [Rr]ealm )?gains? \\+${NUM} Attack(?: and \\+${NUM} Health)?(?: until end of turn| permanently)?$`, "i")))) {
    const perm = /permanently/i.test(cl), tot = /until end of turn/i.test(cl);
    return { op: "buff", atk: +m[1], hp: +(m[2] || 0), target: "allOwn", perm, dur: tot ? 0 : 0 };
  }
  if ((m = cl.match(new RegExp(`^all other Heroes you control gain \\+${NUM} Attack and \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +m[2], target: "allOwnOther", perm: true };
  if ((m = cl.match(new RegExp(`^(?:all|each|every) Hero(?:es)? you control heals? ${NUM} Health(?: and gains? \\+${NUM} Health permanently)?$`, "i")))) return { op: "heal", n: +m[1], permHp: +(m[2] || 0), target: "allOwn" };
  if ((m = cl.match(new RegExp(`^a Hero you control heals ${NUM} Health(?: and gains? \\+${NUM} Health permanently)?$`, "i")))) return { op: "heal", n: +m[1], permHp: +(m[2] || 0), target: "ownChoice" };
  if ((m = cl.match(new RegExp(`^it heals ${NUM} Health$`, "i")))) return { op: "heal", n: +m[1], target: "self" };
  if ((m = cl.match(/^it heals to its maximum Health(?:, gains? \+(\d+) Health permanently)?$/i))) { const ops = [{ op: "healToMax", target: "self" }]; if (m[1]) ops.push({ op: "buff", atk: 0, hp: +m[1], target: "self", perm: true }); return ops; }
  if ((m = cl.match(/^(?:a Hero you control|it) heals to (?:its )?maximum Health$/i))) return { op: "healToMax", target: "ownChoice" };
  // wards
  if ((m = cl.match(new RegExp(`^(?:each|all) Hero(?:es)? you control gains? a ward that prevents the next ${NUM} damage(?: it would take)?(?:,? and you gain ${NUM} Pulse for each Hero warded[^,]*)?$`, "i")))) return { op: "ward", n: +m[1], target: "allOwn", pulsePerWard: m[2] ? 1 : 0, pulseMax: m[2] ? 3 : 0 };
  if ((m = cl.match(new RegExp(`^(?:a Hero you control|it) gains a ward that prevents the next ${NUM} damage(?: it would take)?$`, "i")))) return { op: "ward", n: +m[1], target: cl.startsWith("it ") ? "self" : "ownChoice" };
  // stat reductions to enemies
  if ((m = cl.match(new RegExp(`^(?:every|all) enemy Hero(?:es)? (?:permanently )?(?:gets?|lose[s]?) [-−–]?${NUM} (Attack|Health)(?: permanently)?$`, "i")))) return { op: "statReduce", atk: /Attack/i.test(m[2]) ? +m[1] : 0, hp: /Health/i.test(m[2]) ? +m[1] : 0, target: "allEnemy" };
  if ((m = cl.match(new RegExp(`^all enemy Hero(?:es)? permanently lose ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "allEnemy" };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice loses ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "enemyChoice" };
  // damage to multiple
  if ((m = cl.match(new RegExp(`^deal ${NUM} damage to each of up to ${NUM} (?:different )?enemy Heroes of your choice$`, "i")))) return { op: "damage", n: +m[1], target: "upToAny", count: +m[2], enemyOnly: true };
  // cleanse
  if ((m = cl.match(/^remove all enemy-imposed stat reductions and negative effects(?: \([^)]*\))? from (?:up to (\d+) Heroes you control|a Hero you control)[^]*$/i))) return { op: "removeReductions", target: m[1] ? "upToOwn" : "ownChoice", count: m[1] ? +m[1] : 1 };
  // search deck for a relic
  if ((m = cl.match(/^search your deck for(?: up to (\d+))?(?: any)? Relic cards?(?: costing (\d+) or less)?, reveal (?:it|them), and put (?:it|them) into your hand, then shuffle your deck$/i))) return { op: "searchRelic", count: m[1] ? +m[1] : 1, maxCost: m[2] ? +m[2] : 99 };
  // may attack twice / any lane (targeted at a chosen own hero)
  if ((m = cl.match(/^(?:choose a Hero you control: )?it may attack twice this turn$/i))) return { op: "attackTwice", target: "self" };
  // forge counters (N) on a chosen relic
  if ((m = cl.match(/^[Pp]lace (\d+) forge counters? on a Relic you control$/i))) { const ops = []; for (let i = 0; i < +m[1]; i++) ops.push({ op: "forgeCounterChoice" }); return ops; }
  if ((m = cl.match(/^destroy a Hero you control(?: in any lane)?$/i))) return { op: "sacrifice" };
  if ((m = cl.match(/^Gain Pulse equal to that Hero's cost(?:, immediately and only once)?$/i))) return { op: "pulseLastCost", mult: 1 };
  if ((m = cl.match(/^destroy a Relic you control$/i))) return { op: "sacrificeRelic" };
  if ((m = cl.match(/^Gain Pulse equal to double that Relic's printed cost$/i))) return { op: "pulseLastCost", mult: 2 };
  if ((m = cl.match(new RegExp(`^lose ${NUM} Mortality$`, "i")))) return { op: "mortality", n: -+m[1] };
  if ((m = cl.match(/^deal damage to an enemy Hero equal to the current Attack of your Hero in the same lane$/i))) return { op: "furyDamage" };
  if ((m = cl.match(new RegExp(`^destroy (?:up to )?(\\d+|one) enemy Relics? (?:and\\/or|or) (?:enemy )?Auxiliary cards?(?:, then gain ${NUM} Pulse for each card destroyed this way)?$`, "i")))) {
    const n = m[1] === "one" ? 1 : +m[1];
    const ops = [{ op: "destroySupport", n }];
    if (m[2]) ops.push({ op: "pulsePerDestroyed", n: +m[2] });
    return ops;
  }
  if ((m = cl.match(/^destroy one enemy Relic or enemy Auxiliary card of your choice$/i))) return { op: "destroySupport", n: 1 };
  if ((m = cl.match(/^Destroy up to (\d+|1) Hex(?:es)?, Rites?,? or Pacts? anywhere on the board$/i))) return { op: "destroySlotCard", n: 1 };
  if ((m = cl.match(/^destroy up to (\d+|1) Hex, Rite, or Pact anywhere on the board(?:, then draw a card)?$/i))) {
    const ops = [{ op: "destroySlotCard", n: 1 }];
    if (/draw a card/i.test(cl)) ops.push({ op: "draw", n: 1 });
    return ops;
  }
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice gets -${NUM} Attack permanently$`, "i")))) return { op: "statReduce", atk: +m[1], hp: 0, target: "enemyChoice" };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice permanently loses ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "enemyChoice" };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice gets -${NUM} Attack until the end of your next turn$`, "i")))) return { op: "buff", atk: -+m[1], hp: 0, target: "enemyChoice", dur: 2 };
  if ((m = cl.match(new RegExp(`^a Hero you control(?: of your choice)? gains \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +(m[2] || 0), target: "ownChoice", perm: true };
  if ((m = cl.match(new RegExp(`^(?:all|every) enemy Hero(?:es)? permanently loses? ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "allEnemy" };
  if ((m = cl.match(new RegExp(`^(?:all|every) enemy Hero(?:es)? gets? -${NUM} Attack permanently$`, "i")))) return { op: "statReduce", atk: +m[1], hp: 0, target: "allEnemy" };
  if ((m = cl.match(new RegExp(`^all enemy Heroes get -${NUM} Attack until the end of your next turn$`, "i")))) return { op: "buff", atk: -+m[1], hp: 0, target: "allEnemy", dur: 2 };
  if ((m = cl.match(new RegExp(`^choose (?:a|one) (?:(\\w+) )?Hero you control — it gains \\+${NUM} Attack(?: and \\+${NUM} Health)?(?: permanently| until (?:the )?end of (?:the current )?turn)?$`, "i")))) {
    const perm = /permanently/i.test(cl);
    return { op: "buff", atk: +m[2], hp: +(m[3] || 0), target: "ownChoice", perm, dur: perm ? 0 : 0 };
  }
  if ((m = cl.match(/^choose a Hero you control — it (?:can't|cannot) attack next turn$/i))) return { op: "cantAttack", target: "ownChoice", dur: 2 };
  if ((m = cl.match(/^(?:Then )?choose an enemy Hero — it cannot attack during your opponent's next turn$/i))) return { op: "cantAttack", target: "enemyChoice", dur: 2 };
  if ((m = cl.match(new RegExp(`^gain ${NUM} Pulse immediately$`, "i")))) return { op: "pulse", n: +m[1] };
  if ((m = cl.match(/^destroy an enemy Auxiliary card$/i))) return { op: "destroySupport", n: 1, only: "aux" };
  if ((m = cl.match(/^destroy a Relic attached to an enemy Hero(?: in this lane(?: or a neighboring lane)?)?$/i))) return { op: "destroySupport", n: 1, only: "relic" };
  if ((m = cl.match(/^destroy one Relic attached to that Hero$/i))) return { op: "destroySupport", n: 1, only: "relic" };
  if ((m = cl.match(/^destroy an enemy (?:Hex, Rite, or Pact|Rite or Pact|Hex)$/i))) return { op: "destroySlotCard", n: 1, enemyOnly: true };
  if ((m = cl.match(/^destroy a Hex or (?:Rite|Pact) targeting (?:one of your lanes|this lane)$/i))) return { op: "destroySlotCard", n: 1, enemyOnly: true };
  if ((m = cl.match(new RegExp(`^give the Hero in this lane \\+${NUM} Attack until the end of the current turn$`, "i")))) return { op: "buff", atk: +m[1], hp: 0, target: "laneHero", dur: 0 };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice gets -${NUM} Attack until end of turn$`, "i")))) return { op: "buff", atk: -+m[1], hp: 0, target: "enemyChoice", dur: 0 };
  if ((m = cl.match(new RegExp(`^\\w+ gains \\+${NUM} Attack until end of turn$`, "i")))) return { op: "buff", atk: +m[1], hp: 0, target: "laneHero", dur: 0 };
  if ((m = cl.match(/^place a forge counter on this Relic$/i))) return { op: "forgeCounter" };
  if ((m = cl.match(/^place a forge counter on a Relic you control$/i))) return { op: "forgeCounterChoice" };
  if ((m = cl.match(/^sacrifice another Hero you control(?::\s*(.*))?$/i))) {
    const ops = [{ op: "sacrifice", other: true }];
    if (m[1]) {
      for (const p of m[1].split(/ and (?=gain |draw |deal |a Hero )|, then /i)) {
        const o = parseOp(p);
        if (!o) return null;
        ops.push(...[].concat(o));
      }
    }
    return ops;
  }
  if ((m = cl.match(new RegExp(`^give an enemy Hero of your choice -${NUM} Attack until end of turn$`, "i")))) return { op: "buff", atk: -+m[1], hp: 0, target: "enemyChoice", dur: 0 };
  if ((m = cl.match(new RegExp(`^give a Hero you control \\+${NUM} (Attack|Health) permanently$`, "i")))) return { op: "buff", atk: m[2].toLowerCase() === "attack" ? +m[1] : 0, hp: m[2].toLowerCase() === "health" ? +m[1] : 0, target: "ownChoice", perm: true };
  if ((m = cl.match(new RegExp(`^a Hero you control heals ${NUM} Health$`, "i")))) return { op: "heal", n: +m[1], target: "ownChoice" };
  if ((m = cl.match(new RegExp(`^(?:\\w+|this Hero) gains \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +(m[2] || 0), target: "laneHero", perm: true };
  if ((m = cl.match(/^destroy an enemy Relic or enemy Auxiliary card$/i))) return { op: "destroySupport", n: 1 };
  if ((m = cl.match(/^destroy any one enemy Relic, Auxiliary card, Hex, Rite, or Pact$/i))) return { op: "destroyAnyEnemy" };
  if ((m = cl.match(new RegExp(`^destroy an enemy Hero(?: in [^ ]+ opposing lane)?(?: that has| with) ${NUM} or less Health remaining$`, "i")))) return { op: "executeHero", max: +m[1] };
  if ((m = cl.match(/^choose another Hero you control — it may attack twice this turn$/i))) return { op: "attackTwice", target: "ownChoice" };
  if ((m = cl.match(/^a Hero you control in a lane neighboring (?:this one|\w+) (?:gains \+(\d+) Attack until end of turn|may attack twice this turn)$/i)))
    return m[1] ? { op: "buff", atk: +m[1], hp: 0, target: "ownChoice", dur: 0 } : { op: "attackTwice", target: "ownChoice" };
  if ((m = cl.match(new RegExp(`^deal ${NUM} damage to (.+)$`, "i")))) {
    const t = m[2].toLowerCase();
    let target = null;
    if (/^an enemy hero of your choice|^an enemy hero$/.test(t)) target = "enemyChoice";
    else if (/^a hero of your choice/.test(t)) target = "anyChoice";
    else if (/^the attacking hero/.test(t)) target = "attacker";
    else if (/^whichever hero killed it/.test(t)) target = "killer";
    else if (/^the hero in this lane/.test(t)) target = "laneHero";
    else if (/^your own hero in this lane/.test(t)) target = "laneHero";
    else if (/^each chosen hero/.test(t)) target = "chosen";
    if (target) return { op: "damage", n: +m[1], target };
    return null;
  }
  if ((m = cl.match(new RegExp(`^choose up to ${NUM} heroes.*deal ${NUM} damage to each`, "i"))))
    return { op: "damage", n: +m[2], target: "upToAny", count: +m[1] };
  if ((m = cl.match(new RegExp(`^choose up to ${NUM} heroes you control — each permanently gains \\+${NUM} Attack`, "i"))))
    return { op: "buff", atk: +m[2], hp: 0, target: "upToOwn", count: +m[1], perm: true };
  if ((m = cl.match(/^draw (a|\d+) cards?(?:, then discard (\d+) cards?)?$/i))) {
    const ops = [{ op: "draw", n: m[1] === "a" ? 1 : +m[1] }];
    if (m[2]) ops.push({ op: "discard", n: +m[2] });
    return ops;
  }
  if ((m = cl.match(/^discard (a|\d+|1) cards?(?:, then draw (\d+) cards?)?$/i))) {
    const ops = [{ op: "discard", n: m[1] === "a" ? 1 : +m[1] }];
    if (m[2]) ops.push({ op: "draw", n: +m[2] });
    return ops;
  }
  if ((m = cl.match(new RegExp(`^gain ${NUM} Pulse(?:, immediately and only once)?$`, "i")))) return { op: "pulse", n: +m[1] };
  if ((m = cl.match(new RegExp(`^lose ${NUM} Mortality, then gain ${NUM} Pulse$`, "i"))))
    return [{ op: "mortality", n: -+m[1] }, { op: "pulse", n: +m[2] }];
  if ((m = cl.match(new RegExp(`^give the Hero in this lane \\+${NUM} Health$`, "i")))) return { op: "buff", atk: 0, hp: +m[1], target: "laneHero", perm: true };
  if ((m = norm(cl).match(new RegExp(`^your Hero in this lane permanently gains \\+${NUM} Attack and \\+${NUM} Health(?:, then destroy this Rite)?$`, "i"))))
    return { op: "buff", atk: +m[1], hp: +m[2], target: "laneHero", perm: true };
  if ((m = cl.match(new RegExp(`^heal the defending Hero .*for ${NUM} Health`, "i")))) return { op: "heal", n: +m[1], target: "defender" };
  return null;
}

// Parse a full effect text into an op list; null if any clause fails.
function parseOps(text) {
  text = (text || "").trim()
    .replace(/^When this (Incantation|Pact) resolves,\s*/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*Then destroy this card\.?$/i, "")
    .replace(/\s*then destroy this Rite\.?$/i, "")
    .replace(/ from your hand/gi, "")
    .trim();
  if (!text) return null;
  // multi-sentence "choose up to N ... deal N to each" pre-pass
  let m = norm(text).match(new RegExp(`^choose up to ${NUM} Heroes[^.]*\\.\\s*Deal ${NUM} damage to each chosen Hero\\.?$`, "i"));
  if (m) return [{ op: "damage", n: +m[2], target: "upToAny", count: +m[1] }];
  const ops = [];
  for (const s of sentences(text)) {
    // try the whole sentence first (some single ops contain commas)
    const whole = parseOp(s);
    if (whole) { ops.push(...[].concat(whole)); continue; }
    // otherwise split on connectors and greedily parse, rejoining segments
    // when an op legitimately spans a comma (longest-chunk-first)
    const segs = s.replace(/\.$/, "").split(/, then | and then |, and | and (?=[a-z])|, |; /i).map(x => x.trim()).filter(Boolean);
    let ok = true; const got = []; let i = 0;
    while (i < segs.length) {
      let matched = false;
      for (let j = Math.min(segs.length, i + 3); j > i; j--) {
        const o = parseOp(segs.slice(i, j).join(", "));
        if (o) { got.push(...[].concat(o)); i = j; matched = true; break; }
      }
      if (!matched) { ok = false; break; }
    }
    if (!ok) return null;
    ops.push(...got);
  }
  return ops.length ? ops : null;
}

function compileContinuous(text, sourceKind, out) {
  for (const s of sentences(text)) {
    if (!/continuously|while equipped|while in this slot|while .* is in play|while this card is in play/i.test(s)) continue;
    const stat = parseStatClause(s);
    if (!stat) continue;
    const sc = parseScope(s, sourceKind);
    if (sc) { out.cont.push(Object.assign({ atk: stat.atk, hp: stat.hp }, sc)); out.autoBits.push("aura"); }
  }
  if (/may attack a second time each turn/i.test(text)) {
    out.props.push({ scope: sourceKind === "aux" ? "laneHero" : "equipped", maxAttacks: 2 });
    out.autoBits.push("extra attack");
  }
}

function compileRecurring(text, out) {
  let m;
  for (const s of sentences(text)) {
    if ((m = s.match(new RegExp(`^At the start of each of your turns, gain ${NUM} Pulse`, "i")))) { out.sot.push({ op: "pulse", n: +m[1] }); out.autoBits.push("start-of-turn pulse"); }
    else if (/^At the start of each of your turns, draw a card/i.test(s)) { out.sot.push({ op: "draw", n: 1 }); out.autoBits.push("start-of-turn draw"); }
    else if ((m = norm(s).match(new RegExp(`^At the start of each of your turns, (?:that|the|this) Hero (?:in this lane )?takes ${NUM} damage`, "i")))) { out.sot.push({ op: "damage", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn self-damage"); }
    else if ((m = s.match(new RegExp(`the Hero in this lane heals ${NUM} Health at the start of each of your turns`, "i")))) { out.sot.push({ op: "heal", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn heal"); }
    else if ((m = norm(s).match(new RegExp(`^At the start of each of your turns, this Hero heals ${NUM} Health`, "i")))) { out.sot.push({ op: "heal", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn heal"); }
    else if ((m = norm(s).match(new RegExp(`^At the end of each of your turns, (?:the Hero in this lane|this Hero) takes ${NUM} damage`, "i")))) { out.eot.push({ op: "damage", n: +m[1], target: "laneHero" }); out.autoBits.push("end-of-turn damage"); }
    else if ((m = norm(s).match(new RegExp(`^At the end of each of your turns, gain ${NUM} Pulse`, "i")))) { out.eot.push({ op: "pulse", n: +m[1] }); out.autoBits.push("end-of-turn pulse"); }
  }
}

function compileTriggers(text, card, out) {
  let m;
  const t = norm(text);
  if ((m = t.match(/Whenever (?:\w+) takes damage, (?:he|she|it) permanently gains (?:(\d+) Attack|Attack equal to the damage taken|Attack equal to double the damage taken)/i))) {
    out.onDamaged = m[1] ? { mode: "flat", n: +m[1] } : (/double/i.test(m[0]) ? { mode: "double" } : { mode: "equal" });
    out.autoBits.push("grows when damaged");
  }
  if ((m = t.match(new RegExp(`whenever an enemy Hero dies, gain ${NUM} Pulse`, "i")))) { out.onEnemyDeath = { pulse: +m[1] }; out.autoBits.push("pulse on enemy death"); }
  if ((m = t.match(new RegExp(`whenever a Hero you control dies, gain ${NUM} Pulse`, "i")))) { out.onFriendlyDeath = { pulse: +m[1] }; out.autoBits.push("pulse on friendly death"); }
  if ((m = t.match(new RegExp(`Whenever you play a Hero from a Realm other than (\\w+), gain ${NUM} Pulse`, "i")))) { out.onPlayOtherRealm = { realm: m[1], pulse: +m[2] }; out.autoBits.push("pulse on other-realm hero"); }
}

// Passive "While X is in play, whenever <event>, <effect>" listeners.
// out.listen = [{event, do:{k,...}, maxPerTurn}]
function compileListen(text, out, bits) {
  let m; const t = norm(text || "");
  const push = (event, dd, label, maxPerTurn) => { out.push({ event, do: dd, maxPerTurn }); bits.push(label); };
  if ((m = t.match(new RegExp(`[Ww]henever you gain Pulse from a card effect, \\w+ gains \\+${NUM} Attack until the end of your next turn`, "i")))) push("gainPulse", { k: "buffSelf", atk: +m[1], dur: 2 }, "grows on Pulse gain");
  if ((m = t.match(new RegExp(`[Ww]henever you lose Mortality, gain ${NUM} Pulse(?: \\(maximum (\\d+) Pulse per turn[^)]*\\))?`, "i")))) push("loseMortality", { k: "pulse", n: +m[1] }, "Pulse on Mortality loss", m[2] ? +m[2] : 0);
  if ((m = t.match(new RegExp(`[Ww]henever you play a Relic, \\w+ gains \\+${NUM} Attack and \\+${NUM} Health permanently`, "i")))) push("playRelic", { k: "buffSelf", atk: +m[1], hp: +m[2], perm: true }, "grows on Relic play");
  if ((m = t.match(new RegExp(`whenever an enemy Hero dies from combat damage dealt by one of your Heroes, \\w+ permanently gains \\+${NUM} Attack`, "i")))) push("enemyKilledByYourHero", { k: "buffSelf", atk: +m[1], perm: true }, "grows when your Hero kills");
  if ((m = t.match(new RegExp(`whenever you heal a Hero with a card effect, gain ${NUM} Pulse(?: \\(maximum (\\d+) per turn\\))?`, "i")))) push("heal", { k: "pulse", n: +m[1] }, "Pulse on heal", m[2] ? +m[2] : 0);
  if ((m = t.match(new RegExp(`whenever a Hero you control's ward is fully consumed[^,]*, that Hero heals ${NUM} Health`, "i")))) push("wardConsumed", { k: "healEvent", n: +m[1] }, "heal on ward break");
  if ((m = t.match(new RegExp(`whenever a Hero you control dies, all remaining Heroes you control gain \\+${NUM} Attack and \\+${NUM} Health permanently`, "i")))) push("friendlyDied", { k: "buffAll", atk: +m[1], hp: +m[2], perm: true }, "team grows on death");
  if ((m = t.match(new RegExp(`whenever an enemy Hero dies, all remaining enemy Heroes get [-−–]${NUM} Attack permanently`, "i")))) push("enemyDied", { k: "reduceAll", atk: +m[1] }, "enemies wither on death");
}

// Static combat flags on a Hero. out.flags = {attackAnyLane, taunt, ignoreEnemyEquip, protect:{cond}}
function compileFlags(text, out, bits) {
  const t = norm(text || "");
  const f = {};
  if (/may attack any enemy lane/i.test(t)) { f.attackAnyLane = true; bits.push("attacks any lane"); }
  if (/(?:all enemy Hero attacks must target|enemy Heroes must attack) \w+(?:'s)? lane/i.test(t)) { f.taunt = true; bits.push("taunt"); }
  if (/When \w+ fights, the (?:opposing Hero's equipped Relics|enemy Hero's Relics)[^.]*grant it no Attack or Health for that combat/i.test(t)) { f.ignoreEnemyEquip = true; bits.push("ignores enemy equipment"); }
  if (/cannot be attacked and cannot be targeted by enemy card effects/i.test(t)) {
    if (/While another Hero you control occupies a neighboring lane/i.test(t)) f.protect = "neighbor";
    else if (/While any other Hero you control is in play/i.test(t)) f.protect = "otherHero";
    else if (/Until (?:the first time she attacks|the first time he attacks|it attacks)/i.test(t)) f.protect = "untilAttack";
    else if (/did not attack during your previous turn/i.test(t)) f.protect = "didntAttackLast";
    if (f.protect) bits.push("conditional protection");
  }
  if (Object.keys(f).length) out.flags = f;
}

// "When <Name> dies, <effect>." → out.onDeath (ops run from destroyHero)
function compileOnDeath(text, out, bits) {
  const t = norm(text || "");
  const m = t.match(/^When .+? (?:dies|is destroyed)(?: \([^)]*\))?, (.*)$/i);
  if (!m) return;
  let body = m[1].replace(/\s*and you draw (\d+) cards?/i, ". draw $1 cards");
  const ops = parseOps(body);
  if (ops) { out.onDeath = ops; bits.push("on-death effect"); }
}

// Combat-event triggers on Heroes/Relics. `self` fires for the carrying Hero's
// own combat; `friendly` is a board-wide listener for any Hero you control.
// out.combatTrig = [{event, scope, op:{kind, ...}}]
function compileCombatTriggers(text, out, bits) {
  let m; const t = norm(text || "");
  const push = (event, scope, op, label) => { out.push({ event, scope, op }); bits.push(label); };
  // deal combat damage to an enemy Hero → …
  if ((m = t.match(/whenever (?:this Hero|\w+) deals combat damage to an enemy Hero, draw (a|\d+) cards?/i))) push("dealDamage", "self", { kind: "draw", n: m[1] === "a" ? 1 : +m[1] }, "draw on combat damage");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) deals combat damage to an enemy Hero,(?: you)? gain ${NUM} Pulse`, "i")))) push("dealDamage", "self", { kind: "pulse", n: +m[1] }, "pulse on combat damage");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) deals combat damage to an enemy Hero, it heals ${NUM} Health`, "i")))) push("dealDamage", "self", { kind: "healSelf", n: +m[1] }, "self-heal on combat damage");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) deals combat damage to an enemy Hero, (?:that Hero|it) gets? [-−–]${NUM} Attack permanently`, "i")))) push("dealDamage", "self", { kind: "reduceTarget", atk: +m[1] }, "debuff on combat damage");
  // destroy an enemy Hero in combat → …
  if ((m = t.match(new RegExp(`whenever a Hero you control destroys an enemy Hero in combat, gain ${NUM} Pulse`, "i")))) push("kill", "friendly", { kind: "pulse", n: +m[1] }, "pulse when your Hero kills");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) destroys an enemy Hero in combat, gain ${NUM} Pulse`, "i")))) push("kill", "self", { kind: "pulse", n: +m[1] }, "pulse on kill");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) (?:destroys|defeats) an enemy Hero in combat, (?:heal it for|it heals) ${NUM}`, "i")))) push("kill", "self", { kind: "healSelf", n: +m[1] }, "self-heal on kill");
  if ((m = t.match(new RegExp(`whenever (?:this Hero|\\w+) destroys an enemy Hero in combat, it gains \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently`, "i")))) push("kill", "self", { kind: "buffSelf", atk: +m[1], hp: +(m[2] || 0) }, "grow on kill");
  // win a fight (deal damage while taking none)
  if ((m = t.match(new RegExp(`whenever this Hero wins a fight \\(deals damage while taking none\\), also deal ${NUM} damage to the Hero in the opposing lane`, "i")))) push("winFight", "self", { kind: "damageOpposing", n: +m[1] }, "hit opposing on win");
  // first attack each turn → pulse
  if ((m = t.match(new RegExp(`(?:The )?first time each turn (?:this Hero|\\w+) declares an attack, gain ${NUM} Pulse`, "i")))) push("declareAttack", "selfFirst", { kind: "pulse", n: +m[1] }, "pulse on first attack");
  // damage directly to Mortality → draw / pulse
  if ((m = t.match(/whenever (?:\w+|this Hero) deals damage directly to an opponent's Mortality, draw (a|\d+) cards?/i))) push("mortalityDamage", "self", { kind: "draw", n: m[1] === "a" ? 1 : +m[1] }, "draw on Mortality damage");
  if ((m = t.match(new RegExp(`whenever (?:\\w+|this Hero) deals damage directly to an opponent's Mortality,(?: you)? gain ${NUM} Pulse`, "i")))) push("mortalityDamage", "self", { kind: "pulse", n: +m[1] }, "pulse on Mortality damage");
  // safety: drop any accidental duplicate (same event+scope+op) so nothing fires twice
  const seen = new Set();
  for (let i = out.length - 1; i >= 0; i--) {
    const key = out[i].event + "|" + out[i].scope + "|" + JSON.stringify(out[i].op);
    if (seen.has(key)) out.splice(i, 1); else seen.add(key);
  }
}

function compileHex(card, out) {
  const t = norm(card.text);
  const persistent = /is not destroyed after triggering/i.test(t);
  let m, ev = null, ops = [];
  if (/^When an enemy Hero attacks a Hero in this lane/i.test(t) || /^The first time each turn an enemy Hero attacks this lane/i.test(t) ||
      /^The first time each turn a Hero in this lane would take combat damage/i.test(t) ||
      /^When an enemy Onslaught is declared against a Hero in this lane/i.test(t)) {
    ev = "attackLane";
    if ((m = t.match(new RegExp(`(?:that|the) attacker takes ${NUM} damage`, "i")))) ops.push({ op: "damage", n: +m[1], target: "attacker", pre: true });
    if ((m = t.match(new RegExp(`the defend(?:er|ing Hero)(?:'s)? gains \\+${NUM} Attack(?: and \\+${NUM} Health)?,? for that combat`, "i")))) {
      ops.push({ op: "combatDefAtk", n: +m[1] });
      if (m[2]) ops.push({ op: "combatPrevent", n: +m[2] });
    }
    if ((m = t.match(/draw (a|\d+) cards?/i))) ops.push({ op: "draw", n: m[1] === "a" ? 1 : +m[1] });
    if (/cancel that combat/i.test(t)) ops.push({ op: "block" });
    if ((m = t.match(new RegExp(`the attacker loses ${NUM} Health`, "i")))) ops.push({ op: "statReduce", atk: 0, hp: +m[1], target: "attacker" });
    if ((m = t.match(new RegExp(`the defender [^.]*?heals ${NUM} Health`, "i")))) ops.push({ op: "heal", n: +m[1], target: "defender" });
    if ((m = t.match(new RegExp(`the attacker gets -${NUM} Attack`, "i")))) ops.push({ op: "combatAtk", n: -+m[1] });
    if ((m = t.match(new RegExp(`each attacking Hero has -${NUM} Attack for that combat`, "i")))) ops.push({ op: "combatAtk", n: -+m[1] });
    if ((m = t.match(new RegExp(`prevent ${NUM} of (?:that|the combat) damage`, "i")))) ops.push({ op: "combatPrevent", n: +m[1] });
    if ((m = t.match(new RegExp(`deal ${NUM} damage to the attacking Hero`, "i")))) ops.push({ op: "damage", n: +m[1], target: "attacker", pre: true });
    if ((m = t.match(new RegExp(`reduce that enemy Hero's Attack by ${NUM} for that combat`, "i")))) ops.push({ op: "combatAtk", n: -+m[1] });
    if ((m = t.match(/treat that Hero's Attack as 0 for that combat/i))) ops.push({ op: "combatAtkSet", n: 0 });
    if ((m = t.match(/that attack is blocked/i))) ops.push({ op: "block", removeOne: /removes one attacking Hero/i.test(t) });
    if ((m = t.match(new RegExp(`gain ${NUM} Pulse`, "i")))) ops.push({ op: "pulse", n: +m[1] });
    if ((m = t.match(new RegExp(`heal the defending Hero \\(the Hero in this lane being attacked\\) for ${NUM} Health`, "i")))) ops.push({ op: "heal", n: +m[1], target: "defender" });
    if ((m = t.match(new RegExp(`deal ${NUM} damage to the Hero in this lane \\(yours\\)`, "i")))) ops.push({ op: "damage", n: +m[1], target: "defender", pre: true });
    if ((m = t.match(new RegExp(`that Hero takes ${NUM} damage and has -${NUM} Attack for that combat`, "i")))) { ops.push({ op: "damage", n: +m[1], target: "attacker", pre: true }); ops.push({ op: "combatAtk", n: -+m[2] }); }
    if ((m = t.match(new RegExp(`that Hero gets -${NUM} Attack permanently`, "i")))) ops.push({ op: "statReduce", atk: +m[1], hp: 0, target: "attacker" });
    if ((m = t.match(/swap the attacking Hero's Attack and Health values for that combat/i))) ops.push({ op: "combatSwap" });
  } else if ((m = t.match(new RegExp(`^When a Hero in this lane dies, deal ${NUM} damage to whichever Hero killed it(?:, then draw a card)?`, "i")))) {
    ev = "laneHeroDied";
    ops.push({ op: "damage", n: +m[1], target: "killer" });
    if (/draw a card/i.test(t)) ops.push({ op: "draw", n: 1 });
  } else if (/^When a Hero in this lane dies, gain Pulse equal to that Hero's printed cost/i.test(t)) {
    ev = "laneHeroDied";
    ops.push({ op: "pulseLastCost", mult: 1 });
    if (/draw 1 card/i.test(t)) ops.push({ op: "draw", n: 1 });
  } else if (/^When your opponent plays a Hero/i.test(t)) {
    ev = "oppHeroPlayed";
    if ((m = t.match(new RegExp(`enters play with -${NUM} Attack(?: and -${NUM} Health)? permanently`, "i")))) {
      ops.push({ op: "statReduce", atk: +m[1], hp: +(m[2] || 0), target: "played" });
      if ((m = t.match(new RegExp(`the Hero in this lane gains \\+${NUM} Attack permanently`, "i")))) ops.push({ op: "buff", atk: +m[1], hp: 0, target: "laneHero", perm: true });
    }
    else if (/that Hero cannot attack during your opponent's next turn/i.test(t)) ops.push({ op: "cantAttack", target: "played", dur: 2 });
    else {
      const rest = t.replace(/^When your opponent plays a Hero,\s*/i, "").replace(/\s*After this effect triggers once, destroy this card\.?$/i, "");
      const parsed = parseOps(rest);
      if (parsed) ops.push(...parsed);
    }
  } else if (/^When your opponent casts an Incantation, negate its effect and destroy it/i.test(t)) {
    ev = "oppIncant"; ops.push({ op: "negate" });
  } else if ((m = t.match(new RegExp(`^When an enemy Hero attacks a Hero in this lane, gain ${NUM} Pulse`, "i")))) {
    ev = "attackLane"; ops.push({ op: "pulse", n: +m[1] });
  }
  // "you may sacrifice a/another Hero you control:" — a real cost, paid first;
  // declining or having no Hero aborts the rest of the effect
  if (ev && ops.length && (m = t.match(/you may sacrifice (a|another) Hero you control:/i)))
    ops.unshift({ op: "sacrifice", other: m[1].toLowerCase() === "another" });
  if (ev && ops.length) { out.hexTrig = { event: ev, ops, persistent }; out.autoBits.push("auto-trigger hex"); }
  else out.hexTrig = "manual";
}

function compileRite(card, out) {
  const t = norm(card.text);
  let m;
  const rite = { timer: null, counterMax: null, payoff: null, early: null };
  if ((m = t.match(new RegExp(`count ${NUM} of your turns`, "i")))) rite.timer = +m[1];
  if ((m = t.match(new RegExp(`When it reaches ${NUM} counters`, "i")))) rite.counterMax = +m[1];
  let pm = t.match(/At the end of the \d+(?:st|nd|rd|th) counted turn, (.*?)(?:, then destroy this Rite)/i);
  if (!pm) pm = t.match(/destroy this Rite and (.*?)$/i);
  if (pm) {
    rite.payoff = parseOps(pm[1]) || parsePayoffBuff(pm[1]) || "manual";
  } else rite.payoff = "manual";
  const em = t.match(/end this Rite early(?:,)? (?:to |granting )?(.*?)(?: immediately| instead)/i);
  if (em) rite.early = parseOps(em[1]) || parsePayoffBuff(em[1]) || "manual";
  out.rite = rite;
  if (rite.payoff !== "manual") out.autoBits.push("rite payoff");
}

function parsePayoffBuff(s) {
  s = norm(s);
  let m = s.match(new RegExp(`give each (\\w+ )?Hero(?:es)? you control(?: from a Realm other than (\\w+))? \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently`, "i"));
  if (m) return [{ op: "buff", atk: +m[3], hp: +(m[4] || 0), target: "allOwn", realmFilter: m[1] ? m[1].trim() : null, otherThan: m[2] || null, perm: true }];
  m = s.match(new RegExp(`\\+${NUM} Attack and \\+${NUM} Health`));
  if (m && /this lane|your Hero/i.test(s)) return [{ op: "buff", atk: +m[1], hp: +m[2], target: "laneHero", perm: true }];
  m = s.match(new RegExp(`deal ${NUM} damage to a Hero of your choice`, "i"));
  if (m) return [{ op: "damage", n: +m[1], target: "anyChoice" }];
  m = s.match(new RegExp(`gain ${NUM} Pulse`, "i"));
  if (m) return [{ op: "pulse", n: +m[1] }];
  m = s.match(new RegExp(`draw ${NUM} cards?`, "i"));
  if (m) return [{ op: "draw", n: +m[1] }];
  return null;
}

// "Once per turn, you may (pay N Pulse to) <effect>." → clickable ability on the card
function compileActivated(text, list, bits) {
  const re = /Once per turn,? you may (?:pay (\d+) Pulse(?: to|:| and) )?([^.]+)\./gi;
  let m;
  while ((m = re.exec(norm(text || "")))) {
    const cost = m[1] ? +m[1] : 0;
    const clause = m[2].replace(/\s*\([^)]*\)/g, "").trim();
    let ops = null;
    const parts = clause.split(/, and |, then | and (?=[A-Z]\w+ gains |this Hero gains |gain |draw |deal |destroy )/);
    const got = [];
    let ok = true;
    for (const p of parts) {
      const o = parseOp(p);
      if (!o) { ok = false; break; }
      got.push(...[].concat(o));
    }
    if (ok && got.length) ops = got;
    list.push({ cost, ops, raw: (cost ? `pay ${cost} Pulse — ` : "") + m[2] });
    if (ops) bits.push("activated ability");
  }
}

function compileCard(card) {
  const out = { cont: [], props: [], sot: [], eot: [], onEnter: null, onDeath: null, listen: [], spellOps: null, rite: null, hexTrig: null, autoBits: [], auxCont: [], auxSot: [], auxEot: [], auxOnEnter: null, auxProps: [], auxAutoBits: [], activated: [], auxActivated: [], combatTrig: [] };
  try {
    if (card.type === "hero") {
      compileContinuous(card.text, "hero", out);
      compileRecurring(card.text, out);
      compileTriggers(card.text, card, out);
      compileCombatTriggers(card.text, out.combatTrig, out.autoBits);
      compileListen(card.text, out.listen, out.autoBits);
      compileOnDeath(card.text, out, out.autoBits);
      compileFlags(card.text, out, out.autoBits);
      compileActivated(card.text, out.activated, out.autoBits);
      compileActivated(card.auxText, out.auxActivated, out.auxAutoBits);
      const em = norm(card.text).match(/^When .+? enters play, (.*?)(?:\. While |\.$|$)/i);
      if (em) { out.onEnter = parseOps(em[1]); if (out.onEnter) out.autoBits.push("on-enter"); }
      // aux side
      const aout = { cont: out.auxCont, props: out.auxProps, sot: out.auxSot, eot: out.auxEot, autoBits: out.auxAutoBits };
      compileContinuous(card.auxText, "aux", aout);
      compileRecurring(card.auxText, aout);
      const am = norm(card.auxText).match(/^When this card enters play, (.*)$/i);
      if (am) { out.auxOnEnter = parseOps(am[1]); if (out.auxOnEnter) out.auxAutoBits.push("on-enter"); out.auxSelfDestruct = /then destroy this card/i.test(card.auxText); }
    } else if (card.type === "relic") {
      compileContinuous(card.text, "relic", out);
      compileRecurring(card.text, out);
      compileCombatTriggers(card.text, out.combatTrig, out.autoBits);
      compileActivated(card.text, out.activated, out.autoBits);
    } else if (card.type === "hex") {
      compileHex(card, out);
    } else if (card.type === "rite") {
      compileRite(card, out);
    } else {
      out.spellOps = parseOps(card.text) || "manual";
      if (out.spellOps !== "manual") out.autoBits.push("scripted spell");
    }
  } catch (e) { console.warn("compile failed", card.name, e); }
  return out;
}

function autoLevel(card) {
  const f = fx(card.id);
  const bits = f.autoBits.concat(f.auxAutoBits || []);
  if (card.type === "hex") return f.hexTrig && f.hexTrig !== "manual" ? "auto" : "manual";
  if (card.type === "rite") return f.rite && f.rite.payoff !== "manual" ? "auto" : "manual";
  if (card.type === "pact" || card.type === "incantation") return f.spellOps !== "manual" ? "auto" : "manual";
  return bits.length ? "partial" : "manual";
}

/* ============================== GAME STATE ============================== */

let G = null;
let UNDO = [];

let UID = 1;
function uid() { return UID++; }

function newGame(opts) {
  UNDO = [];
  const mkPlayer = (name, isAI, realms) => ({
    name, isAI, mortality: C().startingMortality, pulse: 0, fatigue: 0, turnCount: 0,
    realms: realms.slice(0, C().lanes),
    lanes: realms.slice(0, C().lanes).map(r => ({ realm: r, hero: null, aux: [null, null] })),
    slots: new Array(C().sharedSlots).fill(null),
    deck: buildDeck(realms), hand: [],
  });
  G = {
    players: [mkPlayer("You", false, opts.playerRealms), mkPlayer("AI (" + opts.difficulty + ")", true, opts.aiRealms)],
    difficulty: opts.difficulty,
    active: opts.first, firstPlayer: opts.first,
    turn: 0, gt: 0, over: false, winner: null, log: [],
  };
  for (const p of G.players) for (let i = 0; i < C().startingHand; i++) drawCard(G.players.indexOf(p), true);
  log(`New game — you: ${opts.playerRealms.join(", ")} vs AI: ${opts.aiRealms.join(", ")}. ${G.players[opts.first].name} goes first.`);
  startTurn();
}

function buildDeck(realms) {
  const uniq = [...new Set(realms)];
  const pool = DB.cards.filter(c => uniq.includes(c.realm));
  const targets = { hero: 26, relic: 8, hex: 6, rite: 4, pact: 3, incantation: 3 };
  const deck = [];
  const counts = {};
  const lim = C().copyLimit;
  for (const type of Object.keys(targets)) {
    const cands = shuffle(pool.filter(c => c.type === type));
    let need = Math.round(targets[type] / 50 * C().deckSize);
    let guard = 0;
    while (need > 0 && cands.length && guard++ < 1000) {
      for (const c of cands) {
        if (need <= 0) break;
        if ((counts[c.id] || 0) >= lim) continue;
        counts[c.id] = (counts[c.id] || 0) + 1;
        deck.push(c.id); need--;
      }
      if (cands.every(c => (counts[c.id] || 0) >= lim)) break;
    }
  }
  const fillers = shuffle(pool);
  let guard = 0;
  while (deck.length < C().deckSize && guard++ < 2000) {
    const c = fillers[Math.floor(Math.random() * fillers.length)];
    if ((counts[c.id] || 0) >= lim) { if (fillers.every(x => (counts[x.id] || 0) >= lim)) break; continue; }
    counts[c.id] = (counts[c.id] || 0) + 1;
    deck.push(c.id);
  }
  return shuffle(deck).slice(0, C().deckSize);
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

function log(msg, cls) { G.log.push({ msg, cls: cls || "", turn: G.turn }); if (window.UI) UI.onLog(); }

function pushUndo() { if (!G) return; UNDO.push(JSON.stringify(G)); if (UNDO.length > 50) UNDO.shift(); }
function undo() { if (!UNDO.length) return false; G = JSON.parse(UNDO.pop()); return true; }

/* ------------------------------ stats ------------------------------ */

function heroInst(cardId) {
  const c = cardById(cardId);
  return { uid: uid(), cardId, permAtk: 0, permHp: 0, redAtk: 0, redHp: 0, dmg: 0, ward: 0, temp: [], relics: [], attacksUsed: 0, playedTurn: G ? G.gt : 0, survivedOnce: false };
}

function collectAuras(tpi, tli, bare) {
  // sum continuous effects from everything in play that hits hero at (tpi, tli).
  // bare=true skips the target's OWN Relics and its lane's Aux (for "enemy's
  // Relics and Auxiliary cards grant it no Attack or Health" combat effects).
  let atk = 0, hp = 0, maxAttacks = 1;
  for (let pi = 0; pi < 2; pi++) {
    const P = G.players[pi];
    for (let li = 0; li < P.lanes.length; li++) {
      const L = P.lanes[li];
      const isTargetLane = pi === tpi && li === tli;
      const sources = [];
      if (L.hero) sources.push({ f: fx(L.hero.cardId), cont: "cont", props: "props", self: pi === tpi && li === tli });
      const seen = new Set();
      if (!(bare && isTargetLane)) for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); sources.push({ f: fx(a.cardId), cont: "auxCont", props: "auxProps" }); }
      if (L.hero && !(bare && isTargetLane)) for (const r of L.hero.relics) sources.push({ f: fx(r.cardId), cont: "cont", props: "props", equippedHere: true, forge: r.counters || 0 });
      for (const src of sources) {
        for (const e of (src.f[src.cont] || [])) {
          const hit = auraHits(e, pi, li, tpi, tli, src);
          if (hit) { atk += e.atk; hp += e.hp; }
        }
        for (const pr of (src.f[src.props] || [])) {
          if (auraHits(pr, pi, li, tpi, tli, src) && pr.maxAttacks) maxAttacks = Math.max(maxAttacks, pr.maxAttacks);
        }
        if (src.forge && pi === tpi && li === tli) { atk += 10 * src.forge; hp += 10 * src.forge; }
      }
    }
  }
  return { atk, hp, maxAttacks };
}

function auraHits(e, spi, sli, tpi, tli, src) {
  const tHero = G.players[tpi].lanes[tli].hero;
  const sHero = G.players[spi].lanes[sli].hero;
  switch (e.scope) {
    case "equipped": return src.equippedHere && spi === tpi && sli === tli;
    case "laneHero": return spi === tpi && sli === tli;
    case "allFriendly":
      if (spi !== tpi) return false;
      if (e.excludeSelf && sli === tli && sHero === tHero && src.cont === "cont") return false;
      if (e.realmFilter && cardById(tHero.cardId).realm !== e.realmFilter) return false;
      return true;
    case "neighbors": return spi === tpi && Math.abs(sli - tli) === 1;
    case "opposingEnemy": return spi !== tpi && sli === tli;
    case "allEnemy": return spi !== tpi;
    default: return false;
  }
}

function effAtk(pi, li, bare) {
  const h = G.players[pi].lanes[li].hero;
  if (!h) return 0;
  const c = cardById(h.cardId);
  const auras = collectAuras(pi, li, bare);
  let temp = h.temp.filter(t => t.until >= G.gt).reduce((s, t) => s + (t.atk || 0), 0);
  let v = c.atk + h.permAtk - h.redAtk + auras.atk + temp;
  // Vorka-style: +1 Attack per point of missing Health
  if (/Attack is continuously increased by 1 for each point of Health she is currently missing|for each point of Health .* missing/i.test(c.text)) v += h.dmg;
  return Math.max(0, v);
}
function effMaxHp(pi, li, bare) {
  const h = G.players[pi].lanes[li].hero;
  if (!h) return 0;
  const c = cardById(h.cardId);
  const auras = collectAuras(pi, li, bare);
  const temp = h.temp.filter(t => t.until >= G.gt).reduce((s, t) => s + (t.hp || 0), 0);
  return Math.max(0, c.hp + h.permHp - h.redHp + auras.hp + temp);
}
function curHp(pi, li) { return effMaxHp(pi, li) - G.players[pi].lanes[li].hero.dmg; }
function maxAttacksOf(pi, li) { return collectAuras(pi, li).maxAttacks; }

/* ------------------------------ turn flow ------------------------------ */

// Staggered lane unlocks: lane li is usable once its owner's own turn count
// reaches laneUnlockTurns[li] (e.g. [1,1,3,5] = lanes 1-2 open, 3 on turn 3, 4 on turn 5).
function laneUnlocked(pi, li) {
  const sched = C().laneUnlockTurns || [1, 1, 1, 1];
  return Math.max(1, G.players[pi].turnCount || 0) >= (sched[li] || 1);
}

function startTurn() {
  G.turn++; G.gt++;
  const pi = G.active, P = G.players[pi];
  P.turnCount = (P.turnCount || 0) + 1;
  const sched = C().laneUnlockTurns || [];
  sched.forEach((t, li) => { if (t === P.turnCount && t > 1 && li < P.lanes.length) log(`${P.name}'s Lane ${li + 1} (${P.lanes[li].realm}) unlocks!`, P.isAI ? "ai" : ""); });
  P.pulse += C().pulsePerTurn;
  const skipDraw = C().firstPlayerSkipsDraw && G.gt === 1 && pi === G.firstPlayer;
  log(`— ${P.name}'s turn (turn ${Math.ceil(G.gt / 2)}) —`, P.isAI ? "ai turnhdr" : "turnhdr");
  if (!skipDraw) for (let i = 0; i < C().drawPerTurn; i++) drawCard(pi);
  // reset attacks + once-per-turn abilities, expire temps
  for (let p = 0; p < 2; p++) for (const L of G.players[p].lanes) {
    if (L.hero) {
      if (p === pi) { L.hero.attacksUsed = 0; L.hero.extraAttacks = 0; L.hero.usedAb = {}; L.hero.atkTrig = {}; L.hero.relics.forEach(r => { r.usedAb = {}; }); }
      L.hero.listenCount = {};
      L.hero.temp = L.hero.temp.filter(t => t.until >= G.gt);
    }
    if (p === pi) L.aux.forEach(a => { if (a) a.usedAb = {}; });
  }
  // start-of-turn recurring effects (aux + heroes + rites)
  for (let li = 0; li < P.lanes.length; li++) {
    const L = P.lanes[li];
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      for (const op of fx(a.cardId).auxSot) runOp(op, pi, { laneIdx: li, sourceName: cardById(a.cardId).name });
    }
    if (L.hero) for (const op of fx(L.hero.cardId).sot) runOp(op, pi, { laneIdx: li, sourceName: cardById(L.hero.cardId).name });
    if (L.hero) for (const r of L.hero.relics.slice()) for (const op of fx(r.cardId).sot) runOp(op, pi, { laneIdx: li, sourceName: cardById(r.cardId).name });
  }
  for (let si = 0; si < P.slots.length; si++) {
    const s = P.slots[si];
    if (!s) continue;
    if (s.kind === "pact" && s.expireGt <= G.gt) { P.slots[si] = null; continue; }
    if (s.kind === "rite") {
      const r = fx(s.cardId).rite;
      if (r && (r.timer || r.counterMax)) {
        s.counters++;
        log(`${P.name}'s Rite "${cardById(s.cardId).name}" ticks (${s.counters}/${r.timer || r.counterMax}).`);
        const target = r.timer || r.counterMax;
        if (s.counters >= target) resolveRite(pi, si, "payoff");
      }
    }
  }
  checkWin();
}

function endTurn() {
  const pi = G.active, P = G.players[pi];
  for (let li = 0; li < P.lanes.length; li++) {
    const L = P.lanes[li];
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      for (const op of fx(a.cardId).auxEot) runOp(op, pi, { laneIdx: li, sourceName: cardById(a.cardId).name });
    }
    if (L.hero) for (const op of fx(L.hero.cardId).eot) runOp(op, pi, { laneIdx: li, sourceName: cardById(L.hero.cardId).name });
    if (L.hero) for (const r of L.hero.relics.slice()) for (const op of fx(r.cardId).eot) runOp(op, pi, { laneIdx: li, sourceName: cardById(r.cardId).name });
  }
  G.active = 1 - G.active;
  startTurn();
}

function drawCard(pi, silent) {
  const P = G.players[pi];
  if (P.deck.length === 0) {
    P.fatigue++;
    const dmg = C().fatigueBase + (P.fatigue - 1) * C().fatigueStep;
    P.mortality -= dmg;
    log(`${P.name} draws from an empty deck — fatigue ${dmg}!`, "ai");
    checkWin();
    return;
  }
  P.hand.push(P.deck.pop());
  if (!silent && !P.isAI) log(`You draw a card.`);
  if (!silent && P.isAI) log(`AI draws a card.`, "ai");
}

function checkWin() {
  for (let pi = 0; pi < 2; pi++) if (G.players[pi].mortality <= 0 && !G.over) {
    G.over = true; G.winner = 1 - pi;
    log(`*** ${G.players[1 - pi].name} WINS — ${G.players[pi].name}'s Mortality hit 0. ***`);
  }
}

/* ------------------------------ ops runtime ------------------------------ */
// ctx: {laneIdx, sourceName, attacker:{pi,li}, defender:{pi,li}, killer:{pi,li}, pickTarget(filter):Promise}

async function runOp(op, pi, ctx) {
  ctx = ctx || {};
  const P = G.players[pi], O = G.players[1 - pi];
  const nameOf = (t) => cardById(G.players[t.pi].lanes[t.li].hero.cardId).name;
  switch (op.op) {
    case "pulse": gainPulse(pi, op.n, ctx.sourceName || "effect"); break;
    case "mortality": if (op.n < 0) loseMortality(pi, -op.n, ctx.sourceName); else { P.mortality += op.n; log(`${P.name} gains ${op.n} Mortality.`); } break;
    case "draw": for (let i = 0; i < op.n; i++) drawCard(pi); break;
    case "discard":
      for (let i = 0; i < op.n && P.hand.length; i++) {
        if (P.isAI) { P.hand.splice(Math.floor(Math.random() * P.hand.length), 1); log(`AI discards a card.`, "ai"); }
        else {
          const idx = await UI.pickHandCard("Choose a card to discard");
          if (idx == null) return;
          log(`You discard ${cardById(P.hand[idx]).name}.`);
          P.hand.splice(idx, 1);
        }
      }
      break;
    case "damage": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) dealDamage(t, op.n, { combat: false, sourceName: ctx.sourceName });
      break;
    }
    case "heal": {
      let targets = await resolveTargets(op, pi, ctx);
      let any = false;
      for (const t of targets) if (heroAt(t)) {
        const h = heroAt(t);
        const healed = Math.min(h.dmg, op.n);
        h.dmg -= healed;
        if (op.permHp) h.permHp += op.permHp;
        log(`${nameOf(t)} heals ${healed}${op.permHp ? ` and gains +${op.permHp} Health` : ""}.`);
        any = true;
      }
      if (any) emit("heal", pi, {});
      break;
    }
    case "buff": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        const h = heroAt(t);
        if (op.perm) { h.permAtk += op.atk || 0; h.permHp += op.hp || 0; }
        else h.temp.push({ atk: op.atk || 0, hp: op.hp || 0, until: G.gt + (op.dur || 0) });
        log(`${nameOf(t)} gets +${op.atk || 0}/+${op.hp || 0}${op.perm ? " permanently" : ""}.`);
      }
      break;
    }
    case "statReduce": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        const h = heroAt(t);
        h.redAtk += op.atk || 0; h.redHp += op.hp || 0;
        log(`${nameOf(t)} loses ${op.atk || 0} Attack / ${op.hp || 0} Health (stat reduction).`);
        if (curHp(t.pi, t.li) <= 0 && effMaxHp(t.pi, t.li) <= h.dmg) destroyHero(t.pi, t.li, null, { noOverkill: true });
        else if (effMaxHp(t.pi, t.li) <= 0) destroyHero(t.pi, t.li, null, { noOverkill: true });
      }
      break;
    }
    case "cantAttack": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        // block exactly the target controller's NEXT turn, whoever is active now
        const blockTurn = G.active === t.pi ? G.gt + 2 : G.gt + 1;
        heroAt(t).noAttackOnTurn = blockTurn;
        log(`${nameOf(t)} cannot attack during its controller's next turn.`);
      }
      break;
    }
    case "sacrifice": {
      let own = heroesOf(pi);
      // "sacrifice ANOTHER Hero" — the source Hero can't pay with itself
      if (op.other && ctx.laneIdx != null) own = own.filter(t => t.li !== ctx.laneIdx);
      if (!own.length) { log(`No Hero to sacrifice — effect fizzles.`); ctx.abort = true; break; }
      let t;
      if (P.isAI) t = own.sort((a, b) => effAtk(a.pi, a.li) - effAtk(b.pi, b.li))[0];
      else t = await UI.pickHero("Choose a Hero you control to destroy" + (op.other ? " (not the source Hero)" : ""), own);
      if (!t) { ctx.abort = true; break; }
      ctx.lastCost = cardById(heroAt(t).cardId).cost;
      ctx.sacAtk = cardById(heroAt(t).cardId).atk;
      log(`${P.name} sacrifices ${nameOf(t)}.`);
      destroyHero(t.pi, t.li, null, { sacrifice: true });
      emit("sacrifice", pi, {});
      break;
    }
    case "sacrificeRelic": {
      const owned = [];
      G.players[pi].lanes.forEach((L, li) => { if (L.hero) L.hero.relics.forEach(r => owned.push({ li, r })); });
      if (!owned.length) { log(`No Relic to destroy — effect fizzles.`); ctx.abort = true; break; }
      let pick = owned[0];
      if (!P.isAI && owned.length > 1) {
        const idx = promptPick("Destroy which of your Relics?", owned.map(o => `${cardById(o.r.cardId).name} (lane ${o.li + 1})`));
        if (idx == null) { ctx.abort = true; break; }
        pick = owned[idx];
      }
      ctx.lastCost = cardById(pick.r.cardId).cost;
      const hero = G.players[pi].lanes[pick.li].hero;
      hero.relics = hero.relics.filter(r => r !== pick.r);
      log(`${P.name} destroys own Relic ${cardById(pick.r.cardId).name}.`);
      break;
    }
    case "pulseLastCost":
      if (ctx.abort) break;
      P.pulse += (ctx.lastCost || 0) * (op.mult || 1);
      log(`${P.name} gains ${(ctx.lastCost || 0) * (op.mult || 1)} Pulse.`);
      break;
    case "furyDamage": {
      const enemies = heroesOf(1 - pi).filter(t => heroAt({ pi, li: t.li }));
      if (!enemies.length) { log(`No valid target (needs your Hero in the same lane) — fizzles.`); break; }
      let t;
      if (P.isAI) t = enemies.sort((a, b) => effAtk(pi, b.li) - effAtk(pi, a.li))[0];
      else t = await UI.pickHero("Choose an enemy Hero (your Hero in that lane deals its Attack)", enemies);
      if (!t) break;
      dealDamage(t, effAtk(pi, t.li), { sourceName: ctx.sourceName });
      break;
    }
    case "destroySupport": {
      ctx.destroyed = 0;
      for (let i = 0; i < (op.n || 1); i++) {
        let supports = [];
        G.players[1 - pi].lanes.forEach((L, li) => {
          if (L.hero) L.hero.relics.forEach(r => supports.push({ li, kind: "relic", obj: r, label: `Relic ${cardById(r.cardId).name} (lane ${li + 1})` }));
          const seen = new Set();
          L.aux.forEach(a => { if (a && !seen.has(a.uid)) { seen.add(a.uid); supports.push({ li, kind: "aux", obj: a, label: `Aux ${cardById(a.cardId).name} (lane ${li + 1})` }); } });
        });
        if (op.only) supports = supports.filter(s => s.kind === op.only);
        if (!supports.length) { if (!i) log(`No valid enemy ${op.only || "Relic/Auxiliary"} to destroy.`); break; }
        let pick = supports.sort((a, b) => cardById(b.obj.cardId).cost - cardById(a.obj.cardId).cost)[0];
        if (!P.isAI) {
          const idx = promptPick(`Destroy which enemy Relic/Auxiliary? (${i + 1} of up to ${op.n})`, supports.map(s => s.label));
          if (idx == null) break;
          pick = supports[idx];
        }
        if (pick.kind === "relic") {
          const hero = G.players[1 - pi].lanes[pick.li].hero;
          hero.relics = hero.relics.filter(r => r !== pick.obj);
        } else removeAux(1 - pi, pick.li, pick.obj.uid);
        ctx.destroyed++;
        log(`${P.name} destroys ${pick.label}.`);
      }
      break;
    }
    case "pulsePerDestroyed":
      if (ctx.destroyed) { P.pulse += op.n * ctx.destroyed; log(`${P.name} gains ${op.n * ctx.destroyed} Pulse.`); }
      break;
    case "destroySlotCard": {
      const slots = [];
      for (let p = 0; p < 2; p++) G.players[p].slots.forEach((s, si) => {
        if (op.enemyOnly && p === pi) return;
        if (s && s.kind !== "pact") slots.push({ p, si, label: `${G.players[p].name}'s ${s.kind}${s.faceDown && p !== pi ? " (face-down)" : ": " + cardById(s.cardId).name}` });
      });
      if (!slots.length) { log(`No Hex/Rite/Pact to destroy — fizzles.`); break; }
      let pick = slots.find(s => s.p !== pi) || slots[0];
      if (!P.isAI) {
        const idx = promptPick("Destroy which Hex/Rite/Pact?", slots.map(s => s.label));
        if (idx == null) break;
        pick = slots[idx];
      }
      log(`${P.name} destroys ${cardById(G.players[pick.p].slots[pick.si].cardId).name} (${G.players[pick.p].slots[pick.si].kind}).`);
      G.players[pick.p].slots[pick.si] = null;
      break;
    }
    case "forgeCounter":
      if (ctx.relic) { ctx.relic.counters = (ctx.relic.counters || 0) + 1; log(`${ctx.sourceName} gains a forge counter (${ctx.relic.counters}).`); }
      break;
    case "forgeCounterChoice": {
      const owned = [];
      G.players[pi].lanes.forEach((L, li) => { if (L.hero) L.hero.relics.forEach(r => owned.push({ li, r })); });
      if (!owned.length) { log(`No Relic to place a forge counter on.`); break; }
      let pick = owned.sort((a, b) => (b.r.counters || 0) - (a.r.counters || 0))[0];
      if (!P.isAI && owned.length > 1) {
        const idx = promptPick("Place a forge counter on which Relic?", owned.map(o => `${cardById(o.r.cardId).name} (lane ${o.li + 1}, ${o.r.counters || 0} counters)`));
        if (idx == null) break;
        pick = owned[idx];
      }
      pick.r.counters = (pick.r.counters || 0) + 1;
      log(`${cardById(pick.r.cardId).name} gains a forge counter (${pick.r.counters}).`);
      break;
    }
    case "destroyAnyEnemy": {
      const opts2 = [];
      G.players[1 - pi].lanes.forEach((L, li) => {
        if (L.hero) L.hero.relics.forEach(r => opts2.push({ kind: "relic", li, obj: r, label: `Relic ${cardById(r.cardId).name} (lane ${li + 1})` }));
        const seen = new Set();
        L.aux.forEach(a => { if (a && !seen.has(a.uid)) { seen.add(a.uid); opts2.push({ kind: "aux", li, obj: a, label: `Aux ${cardById(a.cardId).name} (lane ${li + 1})` }); } });
      });
      G.players[1 - pi].slots.forEach((s, si) => { if (s) opts2.push({ kind: "slot", si, label: `${s.kind}${s.faceDown ? " (face-down)" : ": " + cardById(s.cardId).name}` }); });
      if (!opts2.length) { log(`Nothing to destroy — fizzles.`); break; }
      let pick = opts2[0];
      if (!P.isAI) {
        const idx = promptPick("Destroy which enemy card?", opts2.map(o => o.label));
        if (idx == null) break;
        pick = opts2[idx];
      }
      if (pick.kind === "relic") { const hero = G.players[1 - pi].lanes[pick.li].hero; hero.relics = hero.relics.filter(r => r !== pick.obj); }
      else if (pick.kind === "aux") removeAux(1 - pi, pick.li, pick.obj.uid);
      else G.players[1 - pi].slots[pick.si] = null;
      log(`${P.name} destroys enemy ${pick.label}.`);
      break;
    }
    case "executeHero": {
      const cands = heroesOf(1 - pi).filter(t => curHp(t.pi, t.li) <= op.max);
      if (!cands.length) { log(`No enemy Hero with ${op.max} or less Health — fizzles.`); break; }
      let t = cands.sort((a, b) => effAtk(b.pi, b.li) - effAtk(a.pi, a.li))[0];
      if (!P.isAI) t = await UI.pickHero(`Destroy an enemy Hero with ${op.max} or less Health`, cands);
      if (!t) break;
      log(`${nameOf(t)} is destroyed outright.`);
      destroyHero(t.pi, t.li, null, {});
      break;
    }
    case "attackTwice": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        heroAt(t).extraAttacks = (heroAt(t).extraAttacks || 0) + 1;
        log(`${nameOf(t)} may attack an additional time this turn.`);
      }
      break;
    }
    case "ward": {
      let targets = await resolveTargets(op, pi, ctx);
      let warded = 0;
      for (const t of targets) if (heroAt(t)) { heroAt(t).ward += op.n; warded++; log(`${nameOf(t)} gains a ${op.n}-damage ward.`); }
      if (op.pulsePerWard && warded) { const g = Math.min(warded * op.pulsePerWard, op.pulseMax || 99); P.pulse += g; log(`${P.name} gains ${g} Pulse.`); }
      break;
    }
    case "healToMax": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) { const h = heroAt(t); if (h.dmg) log(`${nameOf(t)} heals to full (${h.dmg}).`); h.dmg = 0; }
      break;
    }
    case "removeReductions": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        const h = heroAt(t);
        h.redAtk = 0; h.redHp = 0; h.temp = h.temp.filter(x => (x.atk || 0) >= 0 && (x.hp || 0) >= 0);
        h.noAttackOnTurn = 0; h.noAttackUntil = 0; h.silenced = 0;
        log(`${nameOf(t)} is cleansed of enemy stat reductions and negative effects.`);
      }
      break;
    }
    case "setFlag": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) { heroAt(t)[op.flag] = op.until ? G.gt + op.until : true; log(`${nameOf(t)}: ${op.label || op.flag}.`); }
      break;
    }
    case "searchRelic": {
      for (let k = 0; k < (op.count || 1); k++) {
        const idxs = P.deck.map((id, ix) => ({ id, ix })).filter(x => { const c = cardById(x.id); return c.type === "relic" && c.cost <= (op.maxCost || 99); });
        if (!idxs.length) { if (!k) log(`No matching Relic in deck.`); break; }
        let pick;
        if (P.isAI) pick = idxs.sort((a, b) => cardById(b.id).cost - cardById(a.id).cost)[0];
        else { const ci = promptPick("Search your deck — put which Relic into your hand?", idxs.map(x => `${cardById(x.id).name} (${cardById(x.id).realm}, ${cardById(x.id).cost})`)); if (ci == null) break; pick = idxs[ci]; }
        P.hand.push(pick.id); P.deck.splice(pick.ix, 1);
        log(`${P.name} searches up a Relic: ${cardById(pick.id).name}.`);
      }
      break;
    }
    case "healthTransfer": {
      // move up to N max+current Health from the source lane Hero to a chosen ally
      const src = ctx.laneIdx != null ? heroAt({ pi, li: ctx.laneIdx }) : null;
      if (!src) break;
      const others = heroesOf(pi).filter(t => t.li !== ctx.laneIdx);
      if (!others.length) { log(`No other Hero to receive Health.`); break; }
      let t = P.isAI ? others[0] : await UI.pickHero(`Move up to ${op.n} Health to which Hero?`, others);
      if (!t) break;
      src.permHp -= op.n; heroAt(t).permHp += op.n;
      log(`${op.n} Health moved to ${nameOf(t)}.`);
      if (effMaxHp(pi, ctx.laneIdx) <= src.dmg) destroyHero(pi, ctx.laneIdx, null, { noOverkill: true });
      break;
    }
  }
}

// Activate a "Once per turn" ability printed on a Hero, Relic, or Auxiliary card.
// holder = the in-play instance carrying the once-per-turn flag.
async function activateAbility(pi, li, holder, sourceName, ab, idx, relicInst) {
  const P = G.players[pi];
  if (G.over || G.active !== pi) return;
  holder.usedAb = holder.usedAb || {};
  if (holder.usedAb[idx]) { if (!P.isAI) UI.toast("Already used this turn."); return; }
  if (P.pulse < ab.cost) { if (!P.isAI) UI.toast("Not enough Pulse."); return; }
  P.pulse -= ab.cost;
  holder.usedAb[idx] = true;
  log(`${P.name} activates ${sourceName}: ${ab.raw}.`, P.isAI ? "ai" : "");
  if (ab.ops) {
    const ctx = { laneIdx: li, sourceName, relic: relicInst };
    for (const op of ab.ops) { if (ctx.abort) break; await runOp(op, pi, ctx); }
  } else if (!P.isAI) UI.toast("Effect not scripted — adjudicate it with the manual controls (cost already paid).");
}

function promptPick(title, options) {
  const msg = title + "\n" + options.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n\nEnter a number (or cancel):";
  const raw = prompt(msg);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return n >= 1 && n <= options.length ? n - 1 : null;
}

function heroAt(t) { return t && G.players[t.pi] && G.players[t.pi].lanes[t.li] ? G.players[t.pi].lanes[t.li].hero : null; }

function heroesOf(pi) {
  const out = [];
  G.players[pi].lanes.forEach((L, li) => { if (L.hero) out.push({ pi, li }); });
  return out;
}

async function resolveTargets(op, pi, ctx) {
  // enemy Heroes protected by "cannot be targeted by enemy card effects" are skipped
  const enemies = heroesOf(1 - pi).filter(t => !isProtected(t)), own = heroesOf(pi);
  const P = G.players[pi];
  const strongest = (list) => list.sort((a, b) => effAtk(b.pi, b.li) - effAtk(a.pi, a.li))[0];
  switch (op.target) {
    case "laneHero": return ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx }) ? [{ pi, li: ctx.laneIdx }] : [];
    case "attacker": return ctx.attacker ? [ctx.attacker] : [];
    case "defender": return ctx.defender ? [ctx.defender] : [];
    case "killer": return ctx.killer && heroAt(ctx.killer) ? [ctx.killer] : [];
    case "played": return ctx.played ? [ctx.played] : [];
    case "allEnemy": return enemies;
    case "self": return ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx }) ? [{ pi, li: ctx.laneIdx }] : [];
    case "allOwn": return own.filter(t => {
      const r = cardById(heroAt(t).cardId).realm;
      if (op.neighborCond && !own.some(o => Math.abs(o.li - t.li) === 1)) return false;
      if (op.realmFilter) return r.toLowerCase() === op.realmFilter.toLowerCase();
      if (op.otherThan) return r.toLowerCase() !== op.otherThan.toLowerCase();
      return true;
    });
    case "allOwnOther": return own.filter(t => t.li !== ctx.laneIdx);
    case "opposingEnemy": {
      const o = { pi: 1 - pi, li: ctx.laneIdx };
      return ctx.laneIdx != null && heroAt(o) ? [o] : [];
    }
    case "enemyChoice":
      if (!enemies.length) return [];
      if (P.isAI) return [strongest(enemies)];
      return [await UI.pickHero("Choose an enemy Hero", enemies)].filter(Boolean);
    case "ownChoice":
      if (!own.length) return [];
      if (P.isAI) return [strongest(own)];
      return [await UI.pickHero("Choose one of your Heroes", own)].filter(Boolean);
    case "anyChoice": {
      const all = enemies.concat(own);
      if (!all.length) return [];
      if (P.isAI) return [strongest(enemies.length ? enemies : own)];
      return [await UI.pickHero("Choose any Hero", all)].filter(Boolean);
    }
    case "upToAny": case "upToOwn": {
      const cands = op.target === "upToOwn" ? own : (op.enemyOnly ? enemies : enemies.concat(own));
      const picked = [];
      for (let i = 0; i < (op.count || 1); i++) {
        const rem = cands.filter(c => !picked.some(p => p.pi === c.pi && p.li === c.li));
        if (!rem.length) break;
        if (P.isAI) picked.push(strongest(op.target === "upToOwn" ? rem : rem.filter(r => r.pi !== pi)) || rem[0]);
        else {
          const t = await UI.pickHero(`Choose a Hero (${i + 1} of up to ${op.count}) — or cancel to stop`, rem, true);
          if (!t) break;
          picked.push(t);
        }
      }
      return picked;
    }
    default: return [];
  }
}

/* ------------------------- passive event listeners ------------------------- */
// Heroes/Auxes with "While X is in play, whenever <event>, <effect>" register a
// listen entry; emit() fires all matching ones for the observing player.

function emit(event, pi, data) {
  if (!G) return;
  data = data || {};
  for (const pos of heroesOf(pi)) {
    const h = heroAt(pos);
    const lis = fx(h.cardId).listen || [];
    for (let i = 0; i < lis.length; i++) {
      const L = lis[i];
      if (L.event !== event) continue;
      if (L.maxPerTurn) {
        h.listenCount = h.listenCount || {};
        const key = event + i;
        if ((h.listenCount[key] || 0) >= L.maxPerTurn) continue;
        h.listenCount[key] = (h.listenCount[key] || 0) + 1;
      }
      applyListen(L.do, pi, pos, h, data);
    }
  }
}

function applyListen(dd, pi, pos, h, data) {
  const nm = cardById(h.cardId).name;
  if (dd.k === "pulse") { G.players[pi].pulse += dd.n; log(`${G.players[pi].name} gains ${dd.n} Pulse (${nm}).`, G.players[pi].isAI ? "ai" : ""); }
  else if (dd.k === "buffSelf") {
    if (dd.perm) { h.permAtk += dd.atk || 0; h.permHp += dd.hp || 0; }
    else h.temp.push({ atk: dd.atk || 0, hp: dd.hp || 0, until: G.gt + (dd.dur || 0) });
    log(`${nm} gains +${dd.atk || 0}/+${dd.hp || 0}${dd.perm ? " permanently" : ""}.`);
  } else if (dd.k === "healEvent") { const tg = heroAt(data.at); if (tg) { const hd = Math.min(tg.dmg, dd.n); tg.dmg -= hd; if (hd) log(`${cardById(tg.cardId).name} heals ${hd} (${nm}).`); } }
  else if (dd.k === "buffAll") {
    for (const t of heroesOf(pi)) {
      if (dd.other && t.li === pos.li) continue;
      const hh = heroAt(t);
      if (dd.realmFilter && cardById(hh.cardId).realm.toLowerCase() !== dd.realmFilter.toLowerCase()) continue;
      hh.permAtk += dd.atk || 0; hh.permHp += dd.hp || 0;
    }
    log(`${nm}: your${dd.realmFilter ? " " + dd.realmFilter : ""} Heroes gain +${dd.atk || 0}/+${dd.hp || 0}.`);
  } else if (dd.k === "healAll") { for (const t of heroesOf(pi)) { if (dd.other && t.li === pos.li) continue; const hh = heroAt(t); const hd = Math.min(hh.dmg, dd.n); hh.dmg -= hd; } log(`${nm}: your Heroes heal ${dd.n}.`); }
  else if (dd.k === "reduceAll") { for (const t of heroesOf(1 - pi)) { const hh = heroAt(t); hh.redAtk += dd.atk || 0; hh.redHp += dd.hp || 0; if (effMaxHp(t.pi, t.li) <= 0) destroyHero(t.pi, t.li, null, { noOverkill: true }); } log(`${nm}: enemy Heroes lose ${dd.atk || 0} Attack / ${dd.hp || 0} Health.`); }
}

// Route Pulse gains through here so onGainPulse listeners fire.
function gainPulse(pi, n, src) {
  if (n <= 0) { G.players[pi].pulse += n; return; }
  G.players[pi].pulse += n;
  log(`${G.players[pi].name} gains ${n} Pulse${src ? " (" + src + ")" : ""}.`, G.players[pi].isAI ? "ai" : "");
  emit("gainPulse", pi, {});
}
function loseMortality(pi, n, src) {
  G.players[pi].mortality -= n;
  if (n > 0) { log(`${G.players[pi].name} loses ${n} Mortality${src ? " (" + src + ")" : ""}.`); emit("loseMortality", pi, {}); }
  checkWin();
}

/* ------------------------------ damage/death ------------------------------ */

function dealDamage(t, amount, opts) {
  opts = opts || {};
  const h = heroAt(t);
  if (!h || amount <= 0) return 0;
  const c = cardById(h.cardId);
  // wards absorb damage before it reaches Health
  if (h.ward > 0) {
    const absorbed = Math.min(h.ward, amount);
    h.ward -= absorbed;
    amount -= absorbed;
    log(`${c.name}'s ward absorbs ${absorbed}.`);
    if (h.ward === 0) emit("wardConsumed", t.pi, { at: t });
    if (amount <= 0) return 0;
  }
  const before = curHp(t.pi, t.li);
  h.dmg += amount;
  log(`${c.name} takes ${amount} damage${opts.sourceName ? " (" + opts.sourceName + ")" : ""}.`);
  // "whenever this hero takes damage" growth triggers
  const od = fx(h.cardId).onDamaged;
  if (od && before > 0) {
    const counted = Math.min(amount, before);
    const gain = od.mode === "flat" ? od.n : od.mode === "double" ? 2 * Math.min(amount, od.capToLethal ? counted : amount) : amount;
    // Ragna-style survival clause is handled below; standard gain uses full damage dealt
    h.pendingAtkGain = (h.pendingAtkGain || 0) + (od.mode === "flat" ? od.n : od.mode === "double" ? amount * 2 : amount);
  }
  if (curHp(t.pi, t.li) <= 0) {
    // survival clause: "The first time X would die from damage each game, instead reduce her Health to 10"
    if (/first time \w+ would die from damage each game, instead reduce (?:her|his|its) Health to 10/i.test(c.text) && !h.survivedOnce) {
      h.survivedOnce = true;
      const needed = before; // damage needed to reach 0
      h.dmg = effMaxHp(t.pi, t.li) - 10;
      if (od) h.pendingAtkGain = needed; // only the amount needed, per card text
      applyPendingGain(h, c);
      log(`${c.name} refuses to die — survives at 10 Health!`);
      return amount;
    }
    const excess = h.dmg - effMaxHp(t.pi, t.li);
    destroyHero(t.pi, t.li, opts.killer || null, { overkill: opts.combat ? excess : 0 });
  } else {
    applyPendingGain(h, c);
  }
  return amount;
}

function applyPendingGain(h, c) {
  if (h.pendingAtkGain) {
    h.permAtk += h.pendingAtkGain;
    log(`${c.name} permanently gains ${h.pendingAtkGain} Attack.`);
    h.pendingAtkGain = 0;
  }
}

function destroyHero(pi, li, killer, opts) {
  opts = opts || {};
  const P = G.players[pi];
  const h = P.lanes[li].hero;
  if (!h) return;
  const c = cardById(h.cardId);
  P.lanes[li].hero = null;
  log(`${c.name} dies.${h.relics.length ? " Its Relics are destroyed." : ""}`);
  if (opts.overkill > 0) {
    const cap = C().overkillCap;
    const ov = (cap != null && cap >= 0) ? Math.min(opts.overkill, cap) : opts.overkill;
    P.mortality -= ov;
    log(`Overkill: ${P.name} loses ${ov} Mortality${ov < opts.overkill ? ` (capped at ${cap})` : ""}.`);
    emit("loseMortality", pi, {});
  }
  // the dying Hero's own "when this Hero dies" effect
  const selfDeath = fx(c.id).onDeath;
  if (selfDeath) for (const op of selfDeath) runOp(op, pi, { laneIdx: li, sourceName: c.name });
  // death triggers: lane hexes + global "on death" listeners
  fireHexes(pi, "laneHeroDied", { laneIdx: li, killer, deadOwner: pi, lastCost: c.cost });
  for (let p = 0; p < 2; p++) {
    for (const t of heroesOf(p)) {
      const f = fx(heroAt(t).cardId);
      if (p !== pi && f.onEnemyDeath) runOp({ op: "pulse", n: f.onEnemyDeath.pulse }, p, { sourceName: cardById(heroAt(t).cardId).name });
      if (p === pi && f.onFriendlyDeath) runOp({ op: "pulse", n: f.onFriendlyDeath.pulse }, p, { sourceName: cardById(heroAt(t).cardId).name });
    }
  }
  emit("friendlyDied", pi, {});
  emit("enemyDied", 1 - pi, {});
  checkWin();
}

/* ------------------------------ hexes ------------------------------ */

async function fireHexes(ownerPi, event, ctx) {
  const P = G.players[ownerPi];
  for (let si = 0; si < P.slots.length; si++) {
    const s = P.slots[si];
    if (!s || s.kind !== "hex" || !s.faceDown) continue;
    const f = fx(s.cardId);
    if (!f.hexTrig || f.hexTrig === "manual") continue;
    if (f.hexTrig.event !== event) continue;
    if ((event === "attackLane" || event === "laneHeroDied") && s.laneIdx !== ctx.laneIdx) continue;
    const card = cardById(s.cardId);
    if (P.pulse < card.cost) { log(`${P.name}'s Hex "${card.name}" cannot be paid for — it fizzles.`); P.slots[si] = null; continue; }
    let pay = true;
    if (!P.isAI) pay = confirm(`Your Hex "${card.name}" triggered!\n\n${card.text}\n\nPay ${card.cost} Pulse to resolve it? (Cancel = fizzle)`);
    if (!pay) { log(`Your Hex "${card.name}" fizzles (declined).`); P.slots[si] = null; continue; }
    P.pulse -= card.cost;
    log(`${P.name}'s Hex triggers: ${card.name}!`, P.isAI ? "ai" : "");
    const opCtx = Object.assign({ sourceName: card.name, laneIdx: s.laneIdx }, ctx);
    for (const op of f.hexTrig.ops) {
      if (opCtx.abort) break;
      if (op.op === "combatAtk" && ctx.combat) ctx.combat.atkMod += op.n;
      else if (op.op === "combatDefAtk" && ctx.combat) ctx.combat.defAtkMod = (ctx.combat.defAtkMod || 0) + op.n;
      else if (op.op === "combatPrevent" && ctx.combat) ctx.combat.prevent = (ctx.combat.prevent || 0) + op.n;
      else if (op.op === "combatAtkSet" && ctx.combat) ctx.combat.atkSet = op.n;
      else if (op.op === "combatSwap" && ctx.combat) ctx.combat.swap = true;
      else if (op.op === "block" && ctx.combat) { ctx.combat.blocked = true; if (op.removeOne) ctx.combat.blockRemoveOne = true; }
      else if (op.op === "negate" && ctx.negate) ctx.negate.negated = true;
      else await runOp(op, ownerPi, opCtx);
    }
    if (!f.hexTrig.persistent) P.slots[si] = null;
  }
}

/* ------------------------------ playing cards ------------------------------ */

function canPlayNameCheck(pi, card) {
  const P = G.players[pi];
  for (const L of P.lanes) {
    if (L.hero && cardById(L.hero.cardId).name === card.name) return false;
    for (const a of L.aux) if (a && cardById(a.cardId).name === card.name) return false;
  }
  return true;
}
function hasRealmAccess(pi, card) { return G.players[pi].lanes.some(L => L.realm === card.realm); }
function openSlotIdx(pi) { return G.players[pi].slots.findIndex(s => !s); }

async function playHero(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  P.pulse -= card.cost;
  P.hand.splice(handIdx, 1);
  P.lanes[laneIdx].hero = heroInst(card.id);
  log(`${P.name} plays ${card.name} (${card.atk}/${card.hp}) in lane ${laneIdx + 1} (${card.realm}).`, P.isAI ? "ai" : "");
  // opponent "when your opponent plays a Hero" hexes
  await fireHexes(1 - pi, "oppHeroPlayed", { played: { pi, li: laneIdx } });
  // own "whenever you play a Hero from Realm other than X" listeners
  for (const t of heroesOf(pi)) {
    const f = fx(heroAt(t).cardId);
    if (f.onPlayOtherRealm && heroAt(t).uid !== P.lanes[laneIdx].hero.uid && card.realm.toLowerCase() !== f.onPlayOtherRealm.realm.toLowerCase())
      await runOp({ op: "pulse", n: f.onPlayOtherRealm.pulse }, pi, { sourceName: cardById(heroAt(t).cardId).name });
  }
  const f = fx(card.id);
  if (f.onEnter) {
    const ctx = { laneIdx, sourceName: card.name };
    for (const op of f.onEnter) { if (ctx.abort) break; await runOp(op, pi, ctx); }
  } else if (/^When \S+ enters play/i.test(card.text) && !P.isAI) UI.toast("On-enter effect needs manual resolution — see card text / sandbox.");
}

async function playAux(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const cost = Math.max(1, card.auxCost != null ? card.auxCost : card.cost - C().auxDiscount);
  P.pulse -= cost;
  P.hand.splice(handIdx, 1);
  const inst = { uid: uid(), cardId: card.id };
  const L = P.lanes[laneIdx];
  if (card.auxSlots === 2) { L.aux[0] = inst; L.aux[1] = inst; }
  else { const free = L.aux[0] ? 1 : 0; L.aux[free] = inst; }
  log(`${P.name} plays ${card.name} as an Auxiliary in lane ${laneIdx + 1}.`, P.isAI ? "ai" : "");
  const f = fx(card.id);
  if (f.auxOnEnter) {
    const ctx = { laneIdx, sourceName: card.name };
    for (const op of f.auxOnEnter) { if (ctx.abort) break; await runOp(op, pi, ctx); }
    if (f.auxSelfDestruct) { removeAux(pi, laneIdx, inst.uid); log(`${card.name} is destroyed.`); }
  } else if (/^When this card enters play/i.test(card.auxText) && !P.isAI) UI.toast("On-enter effect needs manual resolution — see card text / sandbox.");
}
function removeAux(pi, laneIdx, auxUid) {
  const L = G.players[pi].lanes[laneIdx];
  for (let i = 0; i < L.aux.length; i++) if (L.aux[i] && L.aux[i].uid === auxUid) L.aux[i] = null;
}

function playRelic(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  P.pulse -= card.cost;
  P.hand.splice(handIdx, 1);
  P.lanes[laneIdx].hero.relics.push({ uid: uid(), cardId: card.id, counters: 0 });
  log(`${P.name} equips ${card.name} to ${cardById(P.lanes[laneIdx].hero.cardId).name}.`, P.isAI ? "ai" : "");
  emit("playRelic", pi, {});
}

function setHex(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const si = openSlotIdx(pi);
  P.hand.splice(handIdx, 1);
  P.slots[si] = { uid: uid(), cardId: card.id, kind: "hex", faceDown: true, laneIdx };
  log(`${P.name} sets a face-down Hex${P.isAI ? "" : ` on lane ${laneIdx + 1}`}.`, P.isAI ? "ai" : "");
}

function playRite(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const si = openSlotIdx(pi);
  P.pulse -= card.cost;
  P.hand.splice(handIdx, 1);
  P.slots[si] = { uid: uid(), cardId: card.id, kind: "rite", laneIdx, counters: 0 };
  log(`${P.name} begins a Rite: ${card.name} (lane ${laneIdx + 1}).`, P.isAI ? "ai" : "");
}

async function resolveRite(pi, si, which) {
  const P = G.players[pi];
  const s = P.slots[si];
  if (!s) return;
  const card = cardById(s.cardId);
  const r = fx(s.cardId).rite;
  const ops = which === "payoff" ? (r && r.payoff) : (r && r.early);
  P.slots[si] = null;
  log(`${P.name}'s Rite resolves${which === "early" ? " early" : ""}: ${card.name}.`, P.isAI ? "ai" : "");
  if (ops && ops !== "manual") {
    const ctx = { laneIdx: s.laneIdx, sourceName: card.name };
    for (const op of ops) { if (ctx.abort) break; await runOp(op, pi, ctx); }
  } else if (!P.isAI) UI.toast("This Rite's effect needs manual resolution — card text is in the log; use sandbox tools.");
}

async function playSpell(pi, handIdx) { // pact or incantation
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const si = openSlotIdx(pi);
  P.pulse -= card.cost;
  P.hand.splice(handIdx, 1);
  log(`${P.name} plays ${card.type === "pact" ? "Pact" : "Incantation"}: ${card.name} — "${card.text}"`, P.isAI ? "ai" : "");
  if (card.type === "incantation") {
    const negate = { negated: false };
    await fireHexes(1 - pi, "oppIncant", { negate });
    if (negate.negated) { log(`${card.name} is negated!`); return; }
  } else {
    P.slots[si] = { uid: uid(), cardId: card.id, kind: "pact", expireGt: G.gt + 1 };
  }
  const ops = fx(card.id).spellOps;
  if (ops && ops !== "manual") {
    // one shared ctx for the whole resolution: ops can pass state to later
    // ops (sacrificed Hero's cost, number of cards destroyed, ...)
    const ctx = { sourceName: card.name };
    for (const op of ops) { if (ctx.abort) break; await runOp(op, pi, ctx); }
  } else if (!P.isAI) UI.toast("This card's effect isn't scripted — resolve it by hand (sandbox tools).");
  if (card.type === "incantation") emit("castIncantation", pi, {});
}

/* ------------------------------ legality ------------------------------ */

function playOptions(pi, handIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const opts = { heroLanes: [], auxLanes: [], relicLanes: [], hexLanes: [], riteLanes: [], spell: false, auxCost: null };
  if (G.over || G.active !== pi) return opts;
  if (!hasRealmAccess(pi, card)) return opts;
  if (card.type === "hero") {
    opts.auxCost = Math.max(1, card.auxCost != null ? card.auxCost : card.cost - C().auxDiscount);
    if (canPlayNameCheck(pi, card)) {
      P.lanes.forEach((L, li) => {
        if (!laneUnlocked(pi, li)) return;
        if (L.realm === card.realm && !L.hero && P.pulse >= card.cost) opts.heroLanes.push(li);
        const freeAux = L.aux.filter(a => !a).length;
        if (L.realm === card.realm && freeAux >= (card.auxSlots || 1) && P.pulse >= opts.auxCost) opts.auxLanes.push(li);
      });
    }
  } else if (card.type === "relic") {
    P.lanes.forEach((L, li) => {
      if (!L.hero || !laneUnlocked(pi, li)) return;
      if (C().relicRealmLocked && cardById(L.hero.cardId).realm !== card.realm) return;
      const used = L.hero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0);
      if (C().relicSlotsPerHero - used >= (card.slots || 1) && P.pulse >= card.cost) opts.relicLanes.push(li);
    });
  } else if (card.type === "hex") {
    if (openSlotIdx(pi) >= 0) P.lanes.forEach((L, li) => { if (laneUnlocked(pi, li)) opts.hexLanes.push(li); });
  } else if (card.type === "rite") {
    if (openSlotIdx(pi) >= 0 && P.pulse >= card.cost) P.lanes.forEach((L, li) => { if (laneUnlocked(pi, li)) opts.riteLanes.push(li); });
  } else {
    opts.spell = openSlotIdx(pi) >= 0 && P.pulse >= card.cost;
  }
  return opts;
}

/* ------------------------------ combat ------------------------------ */

function heroFlag(pos, flag) {
  const h = heroAt(pos);
  if (!h) return false;
  const f = fx(h.cardId).flags;
  return !!(f && f[flag]);
}
// Is this Hero currently protected (cannot be attacked / targeted by enemy effects)?
function isProtected(pos) {
  const h = heroAt(pos);
  if (!h) return false;
  const f = fx(h.cardId).flags;
  if (!f || !f.protect) return false;
  const others = heroesOf(pos.pi).filter(t => t.li !== pos.li);
  switch (f.protect) {
    case "neighbor": return others.some(t => Math.abs(t.li - pos.li) === 1);
    case "otherHero": return others.length > 0;
    case "untilAttack": return !h.hasAttacked;
    case "didntAttackLast": return G.active !== pos.pi && h.attackedTurn !== G.gt - 1;
    default: return false;
  }
}
// Which enemy lane(s) is this attacker allowed to hit, honoring taunt + protection + attackAnyLane?
function attackableEnemyLanes(pi) {
  const O = 1 - pi;
  let enemies = heroesOf(O).filter(t => !isProtected(t));
  const taunts = enemies.filter(t => heroFlag(t, "taunt"));
  if (taunts.length) enemies = taunts;
  return enemies;
}

function legalTargetsFor(pi, attackerLis) {
  // returns {heroes:[{pi,li}], face:bool}
  const O = 1 - pi;
  const free = window.UI && UI.freeTargeting();
  const targetable = attackableEnemyLanes(pi);
  if (free) return { heroes: heroesOf(O), face: true };
  const anyBoard = heroesOf(O).length > 0;
  // face damage only when the opponent has no Heroes on the board at all
  if (!anyBoard) return { heroes: [], face: true };
  if (!targetable.length) return { heroes: [], face: false };
  if (attackerLis.length === 1) {
    const li = attackerLis[0];
    if (heroFlag({ pi, li }, "attackAnyLane")) return { heroes: targetable, face: false };
    const opp = { pi: O, li };
    if (heroAt(opp) && !isProtected(opp) && (!targetable.some(t => heroFlag(t, "taunt")) || heroFlag(opp, "taunt"))) return { heroes: [opp], face: false };
    return { heroes: targetable, face: false };
  }
  // onslaught: each attacker must have empty opposing lane OR target its own opposing hero (unless it can attack any lane)
  const shared = targetable.filter(t => attackerLis.every(li => heroFlag({ pi, li }, "attackAnyLane") || !heroAt({ pi: O, li }) || li === t.li));
  return { heroes: shared, face: false };
}

function canAttack(pi, li) {
  if (G.over || G.active !== pi) return false;
  const h = heroAt({ pi, li });
  if (!h) return false;
  if (C().firstPlayerNoAttackTurn1 && G.gt === 1 && pi === G.firstPlayer) return false;
  if (h.noAttackUntil && h.noAttackUntil > G.gt) return false;
  if (h.noAttackOnTurn && h.noAttackOnTurn === G.gt) return false;
  return h.attacksUsed < maxAttacksOf(pi, li) + (h.extraAttacks || 0);
}

// Fire combat-event triggers carried by a Hero (and its Relics) that just acted.
// event: "declareAttack" | "dealDamage" | "kill" | "winFight"
async function fireCombat(event, actorPi, actorLi, targetPi, targetLi) {
  const actor = heroAt({ pi: actorPi, li: actorLi });
  const list = [];
  if (actor) {
    for (const tr of (fx(actor.cardId).combatTrig || [])) if (tr.scope === "self" || tr.scope === "selfFirst") list.push({ tr, src: cardById(actor.cardId).name });
    for (const r of actor.relics) for (const tr of (fx(r.cardId).combatTrig || [])) if (tr.scope === "self" || tr.scope === "selfFirst") list.push({ tr, src: cardById(r.cardId).name });
  }
  if (event === "kill") for (const t of heroesOf(actorPi))
    for (const tr of (fx(heroAt(t).cardId).combatTrig || [])) if (tr.event === "kill" && tr.scope === "friendly") list.push({ tr, src: cardById(heroAt(t).cardId).name });

  for (const { tr, src } of list) {
    if (tr.event !== event) continue;
    if (tr.scope === "selfFirst") { if (!actor) continue; actor.atkTrig = actor.atkTrig || {}; if (actor.atkTrig[src]) continue; actor.atkTrig[src] = true; }
    const op = tr.op, PA = G.players[actorPi];
    if (op.kind === "pulse") { gainPulse(actorPi, op.n, src); }
    else if (op.kind === "draw") { for (let i = 0; i < op.n; i++) drawCard(actorPi); }
    else if (op.kind === "healSelf" && actor) { const healed = Math.min(actor.dmg, op.n); actor.dmg -= healed; if (healed) { log(`${src} heals ${healed}.`); emit("heal", actorPi, {}); } }
    else if (op.kind === "buffSelf" && actor) { actor.permAtk += op.atk || 0; actor.permHp += op.hp || 0; log(`${src} permanently gains +${op.atk || 0}/+${op.hp || 0}.`); }
    else if (op.kind === "reduceTarget") { const tg = heroAt({ pi: targetPi, li: targetLi }); if (tg) { tg.redAtk += op.atk || 0; log(`${cardById(tg.cardId).name} gets -${op.atk} Attack permanently (${src}).`); } }
    else if (op.kind === "damageOpposing") { if (heroAt({ pi: 1 - actorPi, li: actorLi })) dealDamage({ pi: 1 - actorPi, li: actorLi }, op.n, { sourceName: src }); }
  }
  if (event === "kill") emit("enemyKilledByYourHero", actorPi, {});
}

async function resolveAttack(pi, attackerLis, target) {
  // target: {face:true} or {pi,li}
  const P = G.players[pi], O = G.players[1 - pi];
  attackerLis = attackerLis.filter(li => canAttack(pi, li));
  if (!attackerLis.length) return;
  for (const li of attackerLis) { const h = heroAt({ pi, li }); h.attacksUsed++; h.hasAttacked = true; h.attackedTurn = G.gt; }
  const names = attackerLis.map(li => cardById(heroAt({ pi, li }).cardId).name).join(" + ");
  for (const li of attackerLis) await fireCombat("declareAttack", pi, li, target.face ? -1 : 1 - pi, target.li);

  if (target.face) {
    const total = attackerLis.reduce((s, li) => s + effAtk(pi, li), 0);
    O.mortality -= total;
    log(`${names} attack${attackerLis.length > 1 ? "" : "s"} directly: ${O.name} loses ${total} Mortality!`, P.isAI ? "ai" : "");
    if (total > 0) emit("loseMortality", 1 - pi, {});
    // Skarn-style: "whenever he deals damage directly to Mortality, draw"
    for (const li of attackerLis) await fireCombat("mortalityDamage", pi, li, -1, -1);
    checkWin();
    return;
  }

  const dLi = target.li;
  const combat = { atkMod: 0, atkSet: null, swap: false, blocked: false };
  const ctx = { laneIdx: dLi, combat, attacker: { pi, li: attackerLis[0] }, defender: { pi: 1 - pi, li: dLi } };
  log(`${names} attack${attackerLis.length > 1 ? " (Onslaught)" : "s"} ${cardById(heroAt(ctx.defender).cardId).name}.`, P.isAI ? "ai" : "");
  await fireHexes(1 - pi, "attackLane", ctx);
  if (combat.blocked) { log(`The attack is blocked!`); return; }
  if (!heroAt(ctx.defender)) { log(`The defender is already gone — attack ends.`); return; }
  // pre-damage may have killed attackers
  const alive = attackerLis.filter(li => heroAt({ pi, li }));
  if (!alive.length) { log(`All attackers died before combat!`); return; }

  // "when X fights, the opposing Hero's Relics/Aux grant it no stats" — strip
  // the defender's equipment if any attacker has it; strip attackers' if the defender has it
  const defBare = alive.some(li => heroFlag({ pi, li }, "ignoreEnemyEquip"));
  const atkBare = heroFlag(ctx.defender, "ignoreEnemyEquip");
  const atkOf = (li) => {
    let a = effAtk(pi, li, atkBare);
    if (combat.atkSet != null) a = combat.atkSet;
    if (combat.swap) a = curHp(pi, li);
    return Math.max(0, a + combat.atkMod);
  };
  const defHero = heroAt(ctx.defender);
  const defAtk = Math.max(0, effAtk(1 - pi, dLi, defBare) + (combat.defAtkMod || 0));
  const defName = cardById(defHero.cardId).name;

  if (alive.length === 1) {
    const aAtk = atkOf(alive[0]);
    if (aAtk > defAtk) {
      const dmg = Math.max(0, aAtk - defAtk - (combat.prevent || 0));
      if (dmg > 0) {
        const defThere = heroAt(ctx.defender);
        dealDamage(ctx.defender, dmg, { combat: true, killer: { pi, li: alive[0] }, sourceName: "combat" });
        await fireCombat("dealDamage", pi, alive[0], 1 - pi, dLi);
        await fireCombat("winFight", pi, alive[0], 1 - pi, dLi);
        if (defThere && !heroAt(ctx.defender)) await fireCombat("kill", pi, alive[0], 1 - pi, dLi);
      } else log(`All combat damage prevented.`);
    } else if (defAtk > aAtk) {
      const atkThere = heroAt({ pi, li: alive[0] });
      dealDamage({ pi, li: alive[0] }, defAtk - aAtk, { combat: true, killer: ctx.defender, sourceName: "combat" });
      // the defender dealt combat damage back to the attacker
      await fireCombat("dealDamage", 1 - pi, dLi, pi, alive[0]);
      if (atkThere && !heroAt({ pi, li: alive[0] })) await fireCombat("kill", 1 - pi, dLi, pi, alive[0]);
    } else log(`Evenly matched (${aAtk} vs ${defAtk}) — no damage.`);
  } else {
    // Onslaught: attackers' Attack is summed and treated as one collective value,
    // then compared to the defender's Attack — lower side loses Health equal to the difference.
    const total = alive.reduce((s, li) => s + atkOf(li), 0);
    if (total > defAtk) {
      const dmg = Math.max(0, total - defAtk - (combat.prevent || 0));
      log(`Onslaught: combined ${total} Attack vs ${defAtk} — ${defName} takes ${dmg}.`);
      if (dmg > 0) {
        const defThere = heroAt(ctx.defender);
        dealDamage(ctx.defender, dmg, { combat: true, killer: { pi, li: alive[0] }, sourceName: "Onslaught" });
        for (const li of alive) if (heroAt({ pi, li })) await fireCombat("dealDamage", pi, li, 1 - pi, dLi);
        if (defThere && !heroAt(ctx.defender)) await fireCombat("kill", pi, alive[0], 1 - pi, dLi);
      }
    } else if (defAtk > total) {
      const dmg = defAtk - total;
      log(`Onslaught FAILS (combined ${total} vs ${defAtk}) — every attacker takes ${dmg}!`);
      for (const li of alive) if (heroAt({ pi, li })) dealDamage({ pi, li }, dmg, { combat: true, killer: ctx.defender, sourceName: "failed Onslaught" });
    } else log(`Evenly matched (${total} vs ${defAtk}) — no damage.`);
  }
  checkWin();
}

/* ================================== AI ================================== */

function aiLegalHandPlays(pi) {
  const P = G.players[pi];
  const plays = [];
  P.hand.forEach((cid, hi) => {
    const o = playOptions(pi, hi);
    const card = cardById(cid);
    o.heroLanes.forEach(li => plays.push({ kind: "hero", hi, li, cost: card.cost, card }));
    o.auxLanes.forEach(li => plays.push({ kind: "aux", hi, li, cost: o.auxCost, card }));
    o.relicLanes.forEach(li => plays.push({ kind: "relic", hi, li, cost: card.cost, card }));
    o.hexLanes.forEach(li => plays.push({ kind: "hex", hi, li, cost: 0, card }));
    o.riteLanes.forEach(li => plays.push({ kind: "rite", hi, li, cost: card.cost, card }));
    if (o.spell) plays.push({ kind: "spell", hi, cost: card.cost, card });
  });
  return plays;
}

async function aiDoPlay(pi, p) {
  if (p.kind === "hero") await playHero(pi, p.hi, p.li);
  else if (p.kind === "aux") await playAux(pi, p.hi, p.li);
  else if (p.kind === "relic") playRelic(pi, p.hi, p.li);
  else if (p.kind === "hex") setHex(pi, p.hi, p.li);
  else if (p.kind === "rite") playRite(pi, p.hi, p.li);
  else if (p.kind === "spell") await playSpell(pi, p.hi);
}

async function aiTakeTurn() {
  const pi = 1, P = G.players[pi], O = G.players[0];
  const d = G.difficulty;
  const step = () => new Promise(r => setTimeout(r, 300));

  // ---- play phase ----
  let guard = 0;
  while (guard++ < 30 && !G.over) {
    const plays = aiLegalHandPlays(pi);
    if (!plays.length) break;
    let pick = null;
    if (d === "easy") {
      if (Math.random() < 0.15) break;
      pick = plays[Math.floor(Math.random() * plays.length)];
    } else {
      const reserve = d === "hard" && P.slots.some(s => s && s.kind === "hex") ? 2 : 0;
      const afford = plays.filter(p => p.cost <= P.pulse - (p.kind === "hex" ? 0 : reserve) || p.kind === "hex");
      if (!afford.length) break;
      // develop the board first: if no hero is affordable but we hold hero cards
      // and our board is thin, bank Pulse (free hexes are still fine)
      if (!afford.some(p => p.kind === "hero") && heroesOf(pi).length < 2 &&
          P.hand.some(cid => cardById(cid).type === "hero" && canPlayNameCheck(pi, cardById(cid)))) {
        const hexPlay = afford.find(p => p.kind === "hex");
        if (hexPlay) { await aiDoPlay(pi, hexPlay); UI.render(); await step(); continue; }
        break;
      }
      const rank = (p) => {
        let v = 0;
        if (p.kind === "hero") v = 100 + p.cost * 10;
        else if (p.kind === "relic") v = 60 + p.cost * 8;
        else if (p.kind === "aux") v = heroAt({ pi, li: p.li }) ? 40 + p.cost * 6 : 4;
        else if (p.kind === "hex") v = 55;
        else if (p.kind === "rite") v = 35;
        else if (p.kind === "spell") v = fx(p.card.id).spellOps !== "manual" ? 45 : 5;
        if (d === "hard") {
          if (p.kind === "hero" && !heroAt({ pi: 0, li: p.li })) v += 5;
          if (p.kind === "spell" && fx(p.card.id).spellOps !== "manual") {
            const dmgOp = [].concat(fx(p.card.id).spellOps).find(o => o.op === "damage" && (o.target === "enemyChoice" || o.target === "anyChoice"));
            if (dmgOp && heroesOf(0).some(t => curHp(0, t.li) <= dmgOp.n)) v = 130;
          }
        }
        return v + Math.random() * 8;
      };
      afford.sort((a, b) => rank(b) - rank(a));
      pick = afford[0];
      if (rank(pick) < 20) break;
    }
    await aiDoPlay(pi, pick);
    UI.render(); await step();
  }

  // ---- attack phase ----
  if (!(C().firstPlayerNoAttackTurn1 && G.gt === 1 && pi === G.firstPlayer) && !G.over) {
    // hard: lethal check on empty board
    const ready = () => G.players[pi].lanes.map((L, li) => li).filter(li => canAttack(pi, li));
    if (d === "hard" && heroesOf(0).length === 0) {
      const total = ready().reduce((s, li) => s + effAtk(pi, li), 0);
      if (total > 0) { await resolveAttack(pi, ready(), { face: true }); UI.render(); }
    }
    // onslaught planning (medium/hard): kill best target if guaranteed
    if (d !== "easy" && !G.over) {
      let guard2 = 0;
      while (guard2++ < 6 && !G.over) {
        const targets = heroesOf(0).sort((a, b) => effAtk(0, b.li) - effAtk(0, a.li));
        let done = false;
        for (const t of targets) {
          const legalAtt = ready().filter(li => {
            const lt = legalTargetsFor(pi, [li]);
            return lt.heroes.some(h => h.li === t.li);
          });
          if (legalAtt.length < 2) continue;
          const hp = curHp(0, t.li);
          const dAtk = effAtk(0, t.li);
          const sorted = legalAtt.sort((a, b) => effAtk(pi, b) - effAtk(pi, a));
          const group = [];
          let sum = 0;
          for (const li of sorted) { group.push(li); sum += effAtk(pi, li); if (sum - dAtk >= hp) break; }
          const solo1v1 = group.length && effAtk(pi, group[0]) - dAtk >= hp;
          if (sum - dAtk >= hp && group.length >= 2 && !solo1v1) {
            const lt = legalTargetsFor(pi, group);
            if (lt.heroes.some(h => h.li === t.li)) {
              await resolveAttack(pi, group, { pi: 0, li: t.li });
              UI.render(); await step();
              done = true; break;
            }
          }
        }
        if (!done) break;
      }
    }
    // singles
    for (const li of G.players[pi].lanes.map((L, i) => i)) {
      if (G.over || !canAttack(pi, li)) continue;
      const lt = legalTargetsFor(pi, [li]);
      const myAtk = effAtk(pi, li);
      if (d === "easy") {
        if (Math.random() < 0.3) continue;
        const all = lt.heroes.slice();
        if (lt.face) all.push({ face: true });
        if (!all.length) continue;
        const t = all[Math.floor(Math.random() * all.length)];
        await resolveAttack(pi, [li], t.face ? { face: true } : t);
      } else {
        if (lt.face && !lt.heroes.length) { await resolveAttack(pi, [li], { face: true }); }
        else {
          // pick a target we beat; hard also accepts even trades that kill something bigger
          let best = null, bestV = -1;
          for (const t of lt.heroes) {
            const dAtk = effAtk(0, t.li), dHp = curHp(0, t.li);
            let v = -1;
            if (myAtk > dAtk) v = (myAtk - dAtk >= dHp ? 100 + dAtk : 40 + Math.min(myAtk - dAtk, dHp) / 10);
            else if (myAtk === dAtk) v = 0;
            else if (d === "hard") v = -1;
            if (v > bestV) { bestV = v; best = t; }
          }
          const threshold = d === "hard" ? 30 : 1;
          if (best && bestV >= threshold) await resolveAttack(pi, [li], best);
        }
      }
      UI.render(); await step();
    }
    // hard: after clearing, face if now empty
    if (d === "hard" && !G.over && heroesOf(0).length === 0) {
      const rem = G.players[pi].lanes.map((L, i) => i).filter(li => canAttack(pi, li));
      if (rem.length) { await resolveAttack(pi, rem, { face: true }); UI.render(); }
    }
  }

  // resolve early rites sometimes (hard keeps them)
  await step();
  if (!G.over) endTurn();
}
