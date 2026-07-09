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
  if (/your champion/.test(s)) return { scope: "champion" };
  if (/all other heroes you control/.test(s)) return { scope: "allFriendly", excludeSelf: true };
  const mRealm = s.match(/all (?:other )?([a-z]+) heroes you control|all your ([a-z]+) heroes/);
  if (mRealm) {
    const realm = (mRealm[1] || mRealm[2] || "");
    const rn = realmNames().find(r => r.toLowerCase() === realm);
    if (rn) return { scope: "allFriendly", realmFilter: rn, excludeSelf: /other/.test(s) };
  }
  if (/all heroes you control/.test(s)) return { scope: "allFriendly" };
  if (/every hero you control that has an allied hero in a neighboring lane/.test(s)) return { scope: "allFriendlyNeighborCond" };
  if (/if heroes you control occupy both lanes neighboring this one, those two heroes/.test(s)) return { scope: "bothNeighbors" };
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
  if ((m = cl.match(new RegExp(`^(?:all|each) other Hero(?:es)? you control gains? \\+${NUM} Attack(?: and \\+${NUM} Health)?(?: permanently)?$`, "i")))) return { op: "buff", atk: +m[1], hp: +(m[2] || 0), target: "allOwnOther", perm: /permanently/i.test(cl) };
  if ((m = cl.match(new RegExp(`^all other Heroes you control have \\+${NUM} Attack$`, "i")))) return { op: "buff", atk: +m[1], hp: 0, target: "allOwnOther", dur: 0 };
  if ((m = cl.match(new RegExp(`^each other Hero you control heals ${NUM} Health$`, "i")))) return { op: "heal", n: +m[1], target: "allOwnOther" };
  if ((m = cl.match(new RegExp(`^(?:all|every) (\\w+) Heroes you control gain \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently$`, "i")))) {
    if (!/^other$/i.test(m[1])) return { op: "buff", atk: +m[2], hp: +(m[3] || 0), target: "allOwn", realmFilter: m[1], perm: true };
  }
  if ((m = cl.match(new RegExp(`^(?:each|all) Hero(?:es)? you control (?:gains?|heals?) ${NUM} Health and gains? \\+${NUM} Attack until the end of your next turn$`, "i")))) return [{ op: "heal", n: +m[1], target: "allOwn" }, { op: "buff", atk: +m[2], hp: 0, target: "allOwn", dur: 2 }];
  if ((m = cl.match(new RegExp(`^each Hero you control heals ${NUM} Health and gains \\+${NUM} Attack until the end of your next turn$`, "i")))) return [{ op: "heal", n: +m[1], target: "allOwn" }, { op: "buff", atk: +m[2], hp: 0, target: "allOwn", dur: 2 }];
  if ((m = cl.match(new RegExp(`^(?:all|each|every) (?:remaining )?Hero(?:es)? you control heals? ${NUM} Health(?: and gains? \\+${NUM} Health permanently)?$`, "i")))) return { op: "heal", n: +m[1], permHp: +(m[2] || 0), target: "allOwn" };
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
  if ((m = cl.match(new RegExp(`^give an enemy Hero of your choice [-−–]${NUM} Attack permanently$`, "i")))) return { op: "statReduce", atk: +m[1], hp: 0, target: "enemyChoice" };
  if ((m = cl.match(new RegExp(`^one enemy Hero of your choice loses ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "enemyChoice" };
  if ((m = cl.match(/^(?:a Hero you control (?:permanently )?gains the ability to attack any enemy lane|it gains the ability to attack any enemy lane)$/i))) return { op: "setFlag", flag: "grantAnyLane", target: "ownChoice", label: "may attack any enemy lane" };
  if ((m = cl.match(new RegExp(`^(?:a|one) Hero you control gains \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: 0, hp: +m[1], target: "ownChoice", perm: true };
  if ((m = cl.match(new RegExp(`^a Noctavein Hero you control gains \\+${NUM} Attack permanently and heals ${NUM} Health$`, "i")))) return [{ op: "buff", atk: +m[1], hp: 0, target: "ownChoice", perm: true, realmFilter: "Noctavein" }, { op: "heal", n: +m[2], target: "ownChoice", realmFilter: "Noctavein" }];
  // damage to multiple
  if ((m = cl.match(new RegExp(`^deal ${NUM} damage to each of up to ${NUM} (?:different )?enemy Heroes of your choice$`, "i")))) return { op: "damage", n: +m[1], target: "upToAny", count: +m[2], enemyOnly: true };
  // cleanse
  if ((m = cl.match(/^remove all enemy-imposed stat reductions and negative effects(?: \([^)]*\))? from (?:up to (\d+) Heroes you control|a Hero you control)[^]*$/i))) return { op: "removeReductions", target: m[1] ? "upToOwn" : "ownChoice", count: m[1] ? +m[1] : 1 };
  // search deck for a relic
  if ((m = cl.match(/^(?:you may )?search your deck for(?: up to (\d+))?(?: a| any)? Relic cards?(?: costing (\d+) or less)?, reveal (?:it|them), and put (?:it|them) into your hand, then shuffle your deck$/i))) return { op: "searchRelic", count: m[1] ? +m[1] : 1, maxCost: m[2] ? +m[2] : 99 };
  if ((m = cl.match(/^(?:you may )?move a Relic from one Hero you control to another Hero you control$/i))) return { op: "moveRelic" };
  if ((m = cl.match(/^(?:you may )?attach a Relic card (?:from your hand )?to a Hero you control without paying its cost$/i))) return { op: "attachRelic", discount: 99 };
  if ((m = cl.match(/^(?:you may )?attach a Relic card (?:from your hand )?to it, paying (\d+) less Pulse$/i))) return { op: "attachRelic", discount: +m[1], target: "lastChosen" };
  if ((m = cl.match(/^place (\d+) forge counters? on it$/i))) { const ops = []; for (let i = 0; i < +m[1]; i++) ops.push({ op: "forgeCounter" }); return ops; }
  if ((m = cl.match(/^return a Relic card from your discard pile to your hand$/i))) return { op: "returnRelicDiscard" };
  if ((m = cl.match(new RegExp(`^destroy up to (\\d+) Relics attached to enemy Heroes$`, "i")))) return { op: "shatterRelics", n: +m[1], dmg: 0 };
  // may attack twice / any lane (targeted at a chosen own hero)
  if ((m = cl.match(/^(?:choose a Hero you control: )?it may attack twice this turn$/i))) return { op: "attackTwice", target: "self" };
  // forge counters (N) on a chosen relic
  if ((m = cl.match(/^[Pp]lace (\d+) forge counters? on a Relic you control$/i))) { const ops = []; for (let i = 0; i < +m[1]; i++) ops.push({ op: "forgeCounterChoice" }); return ops; }
  // ---- final sweep clauses ----
  if ((m = cl.match(/^each Hero you control with an allied Hero in a neighboring lane gains \+(\d+) Attack and \+(\d+) Health permanently$/i))) return { op: "buff", atk: +m[1], hp: +m[2], target: "allOwn", neighborCond: true, perm: true };
  if ((m = cl.match(/^the victorious Hero gains \+(\d+) Health permanently$/i))) return { op: "buff", atk: 0, hp: +m[1], target: "victor", perm: true };
  if ((m = cl.match(/^(?:you may )?play a Hero card of cost (\d+) or less from your discard pile into an empty lane without paying its cost$/i))) return { op: "playFromDiscard", maxCost: +m[1] };
  if ((m = cl.match(/^(?:you may )?return a Hero card(?: of cost (\d+) or less)? from your discard pile to your hand$/i))) return { op: "returnHeroDiscard", maxCost: m[1] ? +m[1] : 99 };
  if ((m = cl.match(/^until the end of your following turn, all Heroes you control may attack any enemy lane and gain \+(\d+) Attack during combats they initiate$/i))) return { op: "armyRide", atk: +m[1] };
  if ((m = cl.match(/^one Hero you control may attack any enemy lane until the end of your next turn$/i))) return { op: "setFlag", flag: "grantAnyLane", target: "ownChoice", until: 2, label: "may attack any lane" };
  if ((m = cl.match(/^until the end of your following turn, all Heroes you control have \+(\d+) Attack and, when they fight, the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health for that combat$/i))) return { op: "armyHunt", atk: +m[1] };
  if ((m = cl.match(/^one Hero you control has \+(\d+) Attack until the end of your next turn and, when it fights during that time, the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health for that combat$/i))) return { op: "huntOne", atk: +m[1] };
  if ((m = cl.match(/^(?:you may )?sacrifice up to (\d+) (?:other )?Heroes you control: for each Hero sacrificed, (\w+) gains \+(\d+) Attack and \+(\d+) Health permanently$/i))) return { op: "sacUpTo", n: +m[1], perAtk: +m[3], perHp: +m[4], to: "self", other: /other/i.test(cl) };
  if ((m = cl.match(/^(?:you may )?sacrifice up to (\d+) Heroes you control: for each Hero sacrificed, all remaining Heroes you control gain \+(\d+) Attack and \+(\d+) Health permanently$/i))) return { op: "sacUpTo", n: +m[1], perAtk: +m[2], perHp: +m[3], to: "team" };
  if ((m = cl.match(/^sacrifice (?:1|one) Hero you control: all remaining Heroes gain \+(\d+) Attack and \+(\d+) Health permanently$/i))) return { op: "sacUpTo", n: 1, mandatory: true, perAtk: +m[1], perHp: +m[2], to: "team" };
  if ((m = cl.match(/^deal damage equal to half that Hero's printed Attack(?: \(rounded[^)]*\))? to an enemy Hero of your choice$/i))) return { op: "damageSacAtk", half: true, max: 999 };
  if ((m = cl.match(/^all remaining Heroes you control gain \+(\d+) Attack and \+(\d+) Health permanently$/i))) return { op: "buff", atk: +m[1], hp: +m[2], target: "allOwn", perm: true };
  if ((m = cl.match(/^a Hero you control gains \+(\d+) Attack permanently and heals to its maximum Health$/i))) return [{ op: "buff", atk: +m[1], hp: 0, target: "ownChoice", perm: true, storeChosen: true }, { op: "healToMax", target: "lastChosen" }];
  if ((m = cl.match(/^heals to (?:its )?maximum Health$/i))) return { op: "healToMax", target: "lastChosen" };
  if ((m = cl.match(/^draw a card if you control a Hero from a Realm other than (\w+)$/i))) return { op: "condRealmBonus", kind: "draw", n: 1, otherThan: m[1] };
  if ((m = cl.match(/^an enemy Hero in [\w'’]+s? lane or a neighboring lane loses (\d+) Health$/i))) return { op: "statReduce", atk: 0, hp: +m[1], target: "enemyChoice" };
  if ((m = cl.match(/^(\w+) gains \+(\d+) Attack permanently and heals (\d+) Health$/i))) return [{ op: "buff", atk: +m[2], hp: 0, target: "laneHero", perm: true }, { op: "heal", n: +m[3], target: "laneHero" }];
  if ((m = cl.match(/^every enemy Hero gets [-−–](\d+) Attack permanently, and (\w+) gains \+(\d+) Attack permanently for each Hero affected this way$/i))) return { op: "neferkha", red: +m[1], per: +m[3] };
  if ((m = cl.match(/^(?:you may )?sacrifice another Hero you control(?::\s*(.*))?$/i))) {
    const ops = [{ op: "sacrifice", other: true }];
    if (m[1]) { for (const pp of m[1].split(/ and (?=gain |draw |deal |a Hero |all Hero)|, then /i)) { const o = parseOp(pp); if (!o) return null; ops.push(...[].concat(o)); } }
    return ops;
  }
  // ---- misc single-card clauses (pacts/incantations sweep) ----
  if ((m = cl.match(new RegExp(`^deal ${NUM} damage to (?:your own Hero in this lane|a Hero you control)\\.? ?(?:If that Hero survives, it permanently gains \\+${NUM} Attack)?$`, "i")))) {
    const ops = [{ op: "damage", n: +m[1], target: "ownChoice", storeChosen: true }];
    if (m[2]) ops.push({ op: "buffIfAlive", atk: +m[2], target: "lastChosen" });
    return ops;
  }
  if ((m = cl.match(/^destroy one Relic or Auxiliary card you control$/i))) return { op: "sacrificeSupport" };
  if ((m = cl.match(new RegExp(`^choose a Hero you control — it gains \\+${NUM} Attack until end of turn, then takes ${NUM} damage at the end of the turn$`, "i")))) return [{ op: "buff", atk: +m[1], hp: 0, target: "ownChoice", dur: 0, storeChosen: true }, { op: "eotDamage", n: +m[2], target: "lastChosen" }];
  if ((m = cl.match(/^Enemy Heroes cannot redirect their attacks during your opponent's next turn$/i))) return { op: "noRedirectNextTurn" };
  if ((m = cl.match(new RegExp(`^(?:That Hero|It|it) gains \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: 0, hp: +m[1], target: "lastChosen", perm: true };
  if ((m = cl.match(new RegExp(`^(?:That Hero|the chosen Hero|It|it) (?:also )?gains \\+${NUM} Attack(?: and \\+${NUM} Health)? permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +(m[2] || 0), target: "lastChosen", perm: true };
  if ((m = cl.match(new RegExp(`^(?:it|It) also heals ${NUM} Health$`, "i")))) return { op: "heal", n: +m[1], target: "lastChosen" };
  if ((m = cl.match(new RegExp(`^Another Hero you control permanently gains Attack equal to half the destroyed Hero's printed Attack$`, "i")))) return { op: "buffHalfSacAtk" };
  if ((m = cl.match(new RegExp(`^Two Heroes you control each gain \\+${NUM} Attack until the end of your next turn$`, "i")))) return { op: "buff", atk: +m[1], hp: 0, target: "upToOwn", count: 2, dur: 2 };
  if ((m = cl.match(new RegExp(`^a Hero you control gains \\+${NUM} Attack permanently and loses ${NUM} Health permanently$`, "i")))) return [{ op: "buff", atk: +m[1], hp: 0, target: "ownChoice", perm: true, storeChosen: true }, { op: "statReduce", atk: 0, hp: +m[2], target: "lastChosen" }];
  if ((m = cl.match(/^Gain Pulse equal to its printed cost$/i))) return { op: "pulseLastCost", mult: 1 };
  if ((m = cl.match(new RegExp(`^all Heroes you control gain \\+${NUM} Attack until end of turn\\.? ?Each Hero you control that does not attack this turn takes ${NUM} damage at end of turn$`, "i")))) return [{ op: "buff", atk: +m[1], hp: 0, target: "allOwn", dur: 0 }, { op: "marchOrDie", n: +m[2] }];
  if ((m = cl.match(/^Return a Hero card from your discard pile to your hand$/i))) return { op: "returnHeroDiscard" };
  if ((m = cl.match(/^sacrifice (?:two|2) Heroes you control$/i))) return [{ op: "sacrifice" }, { op: "sacrifice" }];
  if ((m = cl.match(/^(?:you may )?sacrifice (?:a|one) Hero you control(?::\s*(.*))?$/i))) {
    const ops = [{ op: "sacrifice" }];
    if (m[1]) { for (const p of m[1].split(/ and (?=gain |draw |deal |a Hero )|, then /i)) { const o = parseOp(p); if (!o) return null; ops.push(...[].concat(o)); } }
    return ops;
  }
  if ((m = cl.match(new RegExp(`^deal damage equal to that Hero's printed Attack \\(?(?:maximum ${NUM})?\\)? ?to an enemy Hero of your choice$`, "i")))) return { op: "damageSacAtk", max: m[1] ? +m[1] : 999 };
  if ((m = cl.match(new RegExp(`^another Hero you control gains \\+${NUM} Attack and \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +m[2], target: "ownChoice", perm: true };
  if ((m = cl.match(new RegExp(`^(?:Until the (?:start|end) of your next turn, )?(?:a Hero you control|it|up to (\\d+) Heroes you control) cannot be attacked and cannot be targeted by enemy card effects(?:; it also gains \\+${NUM} Attack permanently)?(?:; it also heals ${NUM} Health)?$`, "i")))) {
    const ops = [{ op: "protectTemp", target: m[1] ? "upToOwn" : (/^(?:Until the (?:start|end) of your next turn, )?it /i.test(cl) ? "lastChosen" : "ownChoice"), count: m[1] ? +m[1] : 1, storeChosen: true }];
    if (m[2]) ops.push({ op: "buff", atk: +m[2], hp: 0, target: "lastChosen", perm: true });
    if (m[3]) ops.push({ op: "heal", n: +m[3], target: "lastChosen" });
    return ops;
  }
  if ((m = cl.match(new RegExp(`^An enemy Hero of your choice gets [-−–]${NUM} Attack until the end of your next turn and takes ${NUM} damage$`, "i")))) return [{ op: "buff", atk: -+m[1], hp: 0, target: "enemyChoice", dur: 2, storeChosen: true }, { op: "damage", n: +m[2], target: "lastChosen" }];
  if ((m = cl.match(new RegExp(`^an enemy Hero in its opposing lane or a neighboring lane loses ${NUM} Health$`, "i")))) return { op: "statReduce", atk: 0, hp: +m[1], target: "enemyChoice" };
  if ((m = cl.match(new RegExp(`^A Hero you control heals ${NUM} Health, and all enemy-imposed stat reductions and negative effects are removed from it$`, "i")))) return [{ op: "heal", n: +m[1], target: "ownChoice", storeChosen: true }, { op: "removeReductions", target: "lastChosen" }];
  if ((m = cl.match(/^you gain (\d+) Pulse$/i))) return { op: "pulse", n: +m[1] };
  if ((m = cl.match(/^you draw (\d+) cards?$/i))) return { op: "draw", n: +m[1] };
  if ((m = cl.match(new RegExp(`^It gains a ward that prevents the next ${NUM} damage it would take and \\+${NUM} Health permanently$`, "i")))) return [{ op: "ward", n: +m[1], target: "lastChosen" }, { op: "buff", atk: 0, hp: +m[2], target: "lastChosen", perm: true }];
  if ((m = cl.match(new RegExp(`^a Hero you control heals ${NUM} Health and gains a ward that prevents the next ${NUM} damage it would take$`, "i")))) return [{ op: "heal", n: +m[1], target: "ownChoice", storeChosen: true }, { op: "ward", n: +m[2], target: "lastChosen" }];
  if ((m = cl.match(new RegExp(`^discard any number of cards\\.?\\s*Choose one (\\w+) Hero you control — it gains \\+${NUM} Attack until the end of the current turn for each card discarded this way$`, "i")))) return { op: "discardForAtk", per: +m[2], realm: m[1] };
  if ((m = cl.match(new RegExp(`^deal damage to an enemy Hero of your choice equal to ${NUM} for every full ${NUM} Pulse you have banked after paying this card's cost(?: \\(?maximum ${NUM} damage\\)?)?$`, "i")))) return { op: "pulseDamage", per: +m[1], per2: +m[2], max: m[3] ? +m[3] : 60 };
  if ((m = cl.match(new RegExp(`^choose an enemy Hero: its ability text is blank(?: \\(has no effect\\))?(?: and it has [-−–]${NUM} Attack)? until the start of your next turn$`, "i")))) {
    const ops = [{ op: "silence", target: "enemyChoice", storeChosen: true }];
    if (m[1]) ops.push({ op: "buff", atk: -+m[1], hp: 0, target: "lastChosen", dur: 2 });
    return ops;
  }
  if ((m = cl.match(/^choose one of your opponent's lanes\.? ?Your opponent cannot play any cards into that lane(?: \(Heroes, Relics, or Auxiliary cards\))? until the start of your next turn$/i))) return { op: "sealLane" };
  if ((m = cl.match(new RegExp(`^choose up to ${NUM} Heroes you control — each heals ${NUM} Health, then each gains \\+${NUM} Health permanently$`, "i")))) return { op: "heal", n: +m[2], permHp: +m[3], target: "upToOwn", count: +m[1] };
  if ((m = cl.match(new RegExp(`^gain ${NUM} Pulse for each (\\w+) Hero you control$`, "i")))) return { op: "pulsePerRealmHero", n: +m[1], realm: m[2] };
  if ((m = cl.match(new RegExp(`^all Heroes you control continuously have \\+${NUM} Health until the start of your next turn$`, "i")))) return { op: "buff", atk: 0, hp: +m[1], target: "allOwn", dur: 2 };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice gets [-−–]${NUM} Attack and a Hero you control of your choice gains \\+${NUM} Attack, until the start of your next turn$`, "i")))) return [{ op: "buff", atk: -+m[1], hp: 0, target: "enemyChoice", dur: 2 }, { op: "buff", atk: +m[2], hp: 0, target: "ownChoice", dur: 2 }];
  if ((m = cl.match(new RegExp(`^every enemy Hero (?:gets [-−–]${NUM} Attack|loses ${NUM} Health)(?: permanently)?[;,]? ?(?:and )?a Hero you control(?: of your choice)? gains \\+${NUM} Attack permanently(?: and heals ${NUM} Health)? for each (?:enemy )?Hero affected(?: this way)?$`, "i")))) {
    return { op: "massReduceBuffPer", redAtk: +(m[1] || 0), redHp: +(m[2] || 0), buffAtk: +m[3], healPer: +(m[4] || 0) };
  }
  if ((m = cl.match(new RegExp(`^choose a Hero you control: it heals to its maximum Health(?:, gains \\+${NUM} Health permanently)?(?:, and you draw ${NUM} cards?)?$`, "i")))) {
    const ops = [{ op: "healToMax", target: "ownChoice", storeChosen: true }];
    if (m[1]) ops.push({ op: "buff", atk: 0, hp: +m[1], target: "lastChosen", perm: true });
    if (m[2]) ops.push({ op: "draw", n: +m[2] });
    return ops;
  }
  if ((m = cl.match(new RegExp(`^choose a Hero you control: until end of turn, it may attack any enemy lane and has \\+${NUM} Attack$`, "i")))) return { op: "rideThemDown", atk: +m[1] };
  if ((m = cl.match(new RegExp(`^each Hero you control with at least one Relic equipped gains \\+${NUM} Attack and \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +m[2], target: "allOwn", relicOnly: true, perm: true };
  if ((m = cl.match(new RegExp(`^every Hero you control with an allied Hero in a neighboring lane has \\+${NUM} Attack and \\+${NUM} Health$`, "i")))) return { op: "buff", atk: +m[1], hp: +m[2], target: "allOwn", neighborCond: true, dur: 2 };
  if ((m = cl.match(new RegExp(`^choose a Hero you control: it gains \\+${NUM} Attack until end of turn\\.? ?If it destroys an enemy Hero in combat this turn, it gains \\+${NUM} Attack and \\+${NUM} Health permanently and you gain ${NUM} Pulse$`, "i")))) return { op: "veniVidi", atk: +m[1], bAtk: +m[2], bHp: +m[3], pulse: +m[4] };
  if ((m = cl.match(new RegExp(`^all Heroes you control gain \\+${NUM} Attack until end of turn — or \\+${NUM} Attack if you control Heroes from ${NUM} or more different Realms$`, "i")))) return { op: "rally", base: +m[1], bonus: +m[2], need: +m[3] };
  if ((m = cl.match(new RegExp(`^choose a Hero you control and an enemy Hero in its opposing lane or a neighboring lane: they immediately fight a full combat, and your Hero has \\+${NUM} Attack for that combat, and the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health for that combat$`, "i")))) return { op: "forcedDuel", atk: +m[1] };
  if ((m = cl.match(new RegExp(`^an enemy Hero of your choice loses ${NUM} Health and a Hero you control gains \\+${NUM} Attack permanently; then that enemy Hero takes ${NUM} damage$`, "i")))) return { op: "exsanguinate", red: +m[1], buff: +m[2], dmg: +m[3] };
  // ---- cost reduction / next-card modifiers ----
  if ((m = cl.match(/^the next (\w+ )?Hero you play(?: this game| this turn)? costs (\d+) less Pulse(?: and enters play with \+(\d+) Attack and \+(\d+) Health permanently)?$/i)))
    return { op: "grantNextHero", discount: +m[2], buffAtk: +(m[3] || 0), buffHp: +(m[4] || 0), realm: m[1] ? m[1].trim() : null, life: /this turn/i.test(cl) ? "turn" : "game" };
  if ((m = cl.match(/^the next (\w+ )?Hero you play(?: this game| this turn)? enters play with \+(\d+) Attack(?: and \+(\d+) Health)? permanently$/i)))
    return { op: "grantNextHero", discount: 0, buffAtk: +m[2], buffHp: +(m[3] || 0), realm: m[1] ? m[1].trim() : null, life: /this turn/i.test(cl) ? "turn" : "game" };
  if ((m = cl.match(/^make your next (\w+ )?Hero cost (\d+) less Pulse$/i)))
    return { op: "grantNextHero", discount: +m[2], buffAtk: 0, buffHp: 0, realm: m[1] ? m[1].trim() : null, life: "game" };
  if ((m = cl.match(/^Relics you play this turn cost (\d+) less Pulse$/i))) return { op: "grantRelicDiscountTurn", discount: +m[1] };
  if ((m = cl.match(/^(?:At the start of your next turn, )?your flat base Pulse gain is (\d+) instead of 5$/i))) return { op: "pulseNextTurn", amount: +m[1] };
  // ---- Break the Line (Karakhorde): grant attack-any-lane + disable enemy prevent/block/redirect ----
  if (/all Heroes you control may attack any enemy lane/i.test(cl) && /cannot trigger/i.test(cl)) return { op: "breakLine" };
  // ---- Joint Strike (Oathenhall) ----
  if (/attack one enemy lane together as a single combat/i.test(cl)) {
    const self = /and a Hero you control in a lane neighboring/i.test(cl);
    return { op: "jointStrike", initiator: self ? "self" : "any" };
  }
  // ---- Champion (Oathenhall) ----
  if ((m = cl.match(/^(?:you may )?Knight (?:a|another|this) Hero you control(?:\s*[—–-]\s*it becomes your Champion)?(?:\s*[—–-]\s*and it gains \+(\d+) Attack(?: and \+(\d+) Health)? permanently)?$/i)))
    return { op: "knight", target: /Knight this Hero/i.test(cl) ? "self" : "ownChoice", buff: (m[1] ? { atk: +m[1], hp: +(m[2] || 0) } : null) };
  if ((m = cl.match(/^you may Knight this Hero(?:\s*[—–-]\s*it becomes your Champion)?$/i))) return { op: "knight", target: "self" };
  if ((m = cl.match(new RegExp(`^your Champion gains \\+${NUM} Attack and \\+${NUM} Health permanently$`, "i")))) return { op: "buff", atk: +m[1], hp: +m[2], target: "champion", perm: true };
  if ((m = cl.match(new RegExp(`^your Champion has \\+${NUM} Attack,? ?(?:and )?may attack twice$`, "i")))) return [{ op: "buff", atk: +m[1], hp: 0, target: "champion", dur: 0 }, { op: "attackTwice", target: "champion" }];
  if ((m = cl.match(/^destroy a Hero you control(?: in any lane)?$/i))) return { op: "sacrifice" };
  if ((m = cl.match(/^Gain Pulse equal to that Hero's cost(?:, immediately and only once)?$/i))) return { op: "pulseLastCost", mult: 1 };
  if ((m = cl.match(/^destroy a Relic you control$/i))) return { op: "sacrificeRelic" };
  if ((m = cl.match(/^(?:destroy|sacrifice) an Auxiliary card you control$/i))) return { op: "sacrificeAux" };
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
  if ((m = cl.match(/^choose a Hero you control — it (?:can't|cannot) attack next turn$/i))) return { op: "cantAttack", target: "ownChoice", dur: 2, storeChosen: true };
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
  if ((m = cl.match(/^move (?:up to )?(\d+) Health from \w+ to another Hero you control$/i))) return { op: "healthTransfer", n: +m[1] };
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
    .replace(/^until end of turn:\s*/i, "")
    .replace(/^until the (?:end|start) of your next turn,?\s*/i, "")
    .replace(/\s*Then destroy this card\.?$/i, "")
    .replace(/\s*then destroy this Rite\.?$/i, "")
    .replace(/ from your hand/gi, "")
    .trim();
  if (!text) return null;
  // whole-text try first (parens intact) — catches multi-sentence single ops
  const wholeAll = parseOp(text.replace(/\.$/, ""));
  if (wholeAll) return [].concat(wholeAll);
  text = text.replace(/\s*\([^)]*\)/g, "").trim();
  const wholeStripped = parseOp(text.replace(/\.$/, ""));
  if (wholeStripped) return [].concat(wholeStripped);
  // multi-sentence "choose up to N ... deal N to each" pre-pass
  let m = norm(text).match(new RegExp(`^choose up to ${NUM} Heroes[^.]*\\.\\s*Deal ${NUM} damage to each chosen Hero\\.?$`, "i"));
  if (m) return [{ op: "damage", n: +m[2], target: "upToAny", count: +m[1] }];
  // Shatterquake: destroy relics + damage per relic destroyed
  m = norm(text).match(/^destroy up to (\d+) Relics attached to enemy Heroes\.\s*For each Relic destroyed this way, deal (\d+) damage to the Hero that held it\.?$/i);
  if (m) return [{ op: "shatterRelics", n: +m[1], dmg: +m[2] }];
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
    // Squire's Oathband: "+10/+10 — or +20/+20 if this Hero is your Champion"
    const cond = norm(s).match(/\+(\d+) Attack and \+(\d+) Health — or \+(\d+) Attack and \+(\d+) Health if this Hero is your Champion/i);
    if (cond) {
      out.cont.push({ atk: +cond[1], hp: +cond[2], scope: sourceKind === "relic" ? "equipped" : "laneHero" });
      out.cont.push({ atk: +cond[3] - +cond[1], hp: +cond[4] - +cond[2], scope: "equippedIfChampion" });
      out.autoBits.push("champion aura");
      continue;
    }
    const stat = parseStatClause(s);
    if (!stat) continue;
    // conditional self auras (Deepforge)
    if (sourceKind === "hero" && /has a Relic equipped/i.test(s)) { out.cont.push({ atk: stat.atk, hp: stat.hp, scope: "selfIfHasRelic" }); out.autoBits.push("conditional aura"); continue; }
    if (sourceKind === "hero" && /both of \w+'s Relic slots are filled/i.test(s)) { out.cont.push({ atk: stat.atk, hp: stat.hp, scope: "selfIfTwoRelics" }); out.autoBits.push("conditional aura"); continue; }
    const sc = parseScope(s, sourceKind);
    if (sc) { out.cont.push(Object.assign({ atk: stat.atk, hp: stat.hp }, sc)); out.autoBits.push("aura"); }
  }
  if (/may attack (?:a second time|twice|an additional time) each turn/i.test(text)) {
    const scope = /your champion/i.test(text) ? "champion" : (sourceKind === "aux" ? "laneHero" : "equipped");
    out.props.push({ scope, maxAttacks: 2 });
    out.autoBits.push("extra attack");
  }
}

function compileRecurring(text, out) {
  let m;
  for (let s of sentences(text)) {
    s = s.replace(/^While (?:equipped|in this slot), /i, "");
    if ((m = s.match(new RegExp(`^At the start of each of your turns, gain ${NUM} Pulse`, "i")))) { out.sot.push({ op: "pulse", n: +m[1] }); out.autoBits.push("start-of-turn pulse"); }
    else if (/^At the start of each of your turns, draw a card/i.test(s)) { out.sot.push({ op: "draw", n: 1 }); out.autoBits.push("start-of-turn draw"); }
    else if ((m = norm(s).match(new RegExp(`^At the start of each of your turns, (?:that|the|this) Hero (?:in this lane )?takes ${NUM} damage`, "i")))) { out.sot.push({ op: "damage", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn self-damage"); }
    else if ((m = s.match(new RegExp(`the Hero in this lane heals ${NUM} Health at the start of each of your turns`, "i")))) { out.sot.push({ op: "heal", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn heal"); }
    else if ((m = norm(s).match(new RegExp(`^At the start of each of your turns, this Hero heals ${NUM} Health`, "i")))) { out.sot.push({ op: "heal", n: +m[1], target: "laneHero" }); out.autoBits.push("start-of-turn heal"); }
    else if ((m = norm(s).match(new RegExp(`^At the end of each of your turns, (?:the Hero in this lane|this Hero) takes ${NUM} damage`, "i")))) { out.eot.push({ op: "damage", n: +m[1], target: "laneHero" }); out.autoBits.push("end-of-turn damage"); }
    else if ((m = norm(s).match(new RegExp(`^At the end of each of your turns, gain ${NUM} Pulse`, "i")))) { out.eot.push({ op: "pulse", n: +m[1] }); out.autoBits.push("end-of-turn pulse"); }
    else if (/^At the start of each of your turns, place a forge counter on a Relic equipped to the Hero in this lane/i.test(norm(s))) { out.sot.push({ op: "forgeCounterLane" }); out.autoBits.push("start-of-turn forge counter"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, place a forge counter on each of up to (\d+) different Relics you control/i))) { for (let i = 0; i < +m[1]; i++) out.sot.push({ op: "forgeCounterChoice" }); out.autoBits.push("start-of-turn forge counters"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, if you control (?:a Hero from another Realm|Heroes from (\d+) or more different Realms), (?:gain (\d+) Pulse|draw (\d+) cards?)/i))) { out.sot.push({ op: "condRealmBonus", kind: m[3] ? "draw" : "pulse", n: +(m[2] || m[3] || 1), need: m[1] ? +m[1] : 0, otherRealm: !m[1] }); out.autoBits.push("realm-diversity bonus"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, if an enemy Hero died since the start of your previous turn, gain (\d+) Pulse/i))) { out.sot.push({ op: "mirielAux", n: +m[1] }); out.autoBits.push("death dividend"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, every enemy Hero gets [-−–](\d+) Attack and (\w+) gains \+(\d+) Attack for each enemy Hero affected, all until the start of your next turn/i))) { out.sot.push({ op: "osiraket", red: +m[1], per: +m[3] }); out.autoBits.push("draining presence"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, the enemy Hero in [\w'’]+s? opposing lane (?:\(if any\) )?loses (\d+) Health(?: \(stat reduction\))?, and (\w+) gains \+(\d+) Attack permanently and heals (\d+) Health/i))) { out.sot.push({ op: "ellisette", red: +m[1], atk: +m[3], heal: +m[4] }); out.autoBits.push("drains opposing lane"); }
    else if ((m = norm(s).match(/^At the start of each of your turns, if the enemy Hero in the opposing lane is below its maximum Health, it loses (\d+) Health/i))) { out.sot.push({ op: "ellisette", red: +m[1], atk: 0, heal: 0, needWounded: true }); out.autoBits.push("drains the wounded"); }
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
  if ((m = t.match(/[Ww]henever an enemy Relic or enemy Auxiliary card is destroyed, \w+ gains \+(\d+) Attack until the end of your next turn/i))) push("enemySupportDestroyed", { k: "buffSelf", atk: +m[1], dur: 2 }, "grows on support destruction");
  if ((m = t.match(/the first time each turn you play a Relic, draw (\d+) cards?/i))) push("playRelic", { k: "draw", n: +m[1] }, "draw on first Relic", 1);
}

// Static combat flags on a Hero. out.flags = {attackAnyLane, taunt, ignoreEnemyEquip, protect:{cond}}
function compileFlags(text, bits) {
  const t = norm(text || "");
  const f = {};
  if (/may attack any enemy lane/i.test(t)) { f.attackAnyLane = true; bits.push("attacks any lane"); }
  if (/(?:all enemy Hero attacks must target|enemy Heroes must attack) \w+(?:'s)? lane/i.test(t)) { f.taunt = true; bits.push("taunt"); }
  if (/When \w+ fights, the (?:opposing Hero's equipped Relics|enemy Hero's Relics)[^.]*grant it no Attack or Health for that combat/i.test(t)) { f.ignoreEnemyEquip = true; bits.push("ignores enemy equipment"); }
  if (/^While equipped, this Hero cannot be targeted by enemy card effects\.?$/i.test(t) || (/cannot be targeted by enemy card effects/i.test(t) && !/cannot be attacked/i.test(t))) { f.untargetable = true; bits.push("untargetable"); }
  if (/cannot be attacked and cannot be targeted by enemy card effects/i.test(t)) {
    if (/While another Hero you control occupies a neighboring lane/i.test(t)) f.protect = "neighbor";
    else if (/While any other Hero you control is in play/i.test(t)) f.protect = "otherHero";
    else if (/Until (?:the first time she attacks|the first time he attacks|it attacks)/i.test(t)) f.protect = "untilAttack";
    else if (/did not attack during your previous turn/i.test(t)) f.protect = "didntAttackLast";
    if (f.protect) bits.push("conditional protection");
  }
  let am;
  if ((am = t.match(/While \w+ has a Relic equipped, enemy Heroes attacking (?:her|him|it) have [-−–](\d+) Attack for that combat/i))) { f.attackerPenaltyIfRelic = +am[1]; bits.push("attacker penalty"); }
  else if ((am = t.match(/Enemy Heroes attacking \w+ have [-−–](\d+) Attack for that combat/i))) { f.attackerPenalty = +am[1]; bits.push("attacker penalty"); }
  if (/Relics equipped to Heroes you control in neighboring lanes cannot be destroyed by enemy card effects/i.test(t)) { f.relicProtect = "neighbor"; bits.push("relic protection"); }
  else if (/Relics equipped to (?:this Hero|\w+) cannot be destroyed by enemy card effects/i.test(t) || /his Relics cannot be destroyed by enemy card effects/i.test(t)) { f.relicProtect = /both of \w+'s Relic slots are filled/i.test(t) ? "selfIfTwoRelics" : "self"; bits.push("relic protection"); }
  if (Object.keys(f).length) return f;
  return null;
}

// Defender-side redirect: "when an enemy attacks a Hero you control [in a
// neighboring lane], you may [pay N] redirect that attack to <protector>."
function parseRedirect(text) {
  const t = norm(text || "");
  if (!/redirect that attack|pull that attack to this Hero/i.test(t)) return null;
  if (/another enemy Hero/i.test(t)) return null;           // that's an offensive redirect (Whispered Treason)
  const costM = t.match(/pay (\d+) Pulse/i);
  return {
    applies: /neighboring lane|another of your lanes/i.test(t) ? "neighbor" : "any",
    cost: costM ? +costM[1] : 0,
    optional: /you may/i.test(t),
    oncePerTurn: /once per turn/i.test(t),
  };
}

// Bodyguard: "when a Hero you control [in a neighboring lane] would take combat
// damage, you may have <protector> take half of that damage instead."
function parseBodyguard(text) {
  const t = norm(text || "");
  if (!/take half of that damage instead/i.test(t)) return null;
  return {
    applies: /regardless of lane/i.test(t) ? "any" : "neighbor",
    optional: /you may/i.test(t),
    oncePerTurn: /once per turn/i.test(t),
  };
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
  if ((m = t.match(/whenever this Hero deals combat damage to an enemy Hero, you may destroy one Relic attached to that Hero/i))) push("dealDamage", "self", { kind: "destroyTargetRelic" }, "strips relic on hit");
  if ((m = t.match(new RegExp(`The first time each turn \\w+ destroys an enemy Hero in combat, gain ${NUM} Pulse and draw ${NUM} cards?`, "i")))) push("kill", "selfFirst", { kind: "pulseDraw", p: +m[1], d: +m[2] }, "first-kill reward");
  if ((m = t.match(new RegExp(`Once per turn, when \\w+ deals combat damage to an enemy Hero, (?:he|she|it) heals ${NUM} Health`, "i")))) push("dealDamage", "selfFirst", { kind: "healSelf", n: +m[1] }, "self-heal on hit");
  if ((m = t.match(new RegExp(`Whenever \\w+ destroys an enemy Hero in combat, an enemy Hero of your choice loses ${NUM} Health \\(stat reduction\\) and \\w+ gains \\+${NUM} Attack permanently`, "i")))) push("kill", "self", { kind: "ilvane", red: +m[1], atk: +m[2] }, "feeds on kills");
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
  if (/^When an enemy Hero(?: below its maximum Health)? attacks a Hero in this lane(?! and the defender survives| and fails to destroy)/i.test(t) || /^The first time each turn an enemy Hero attacks this lane/i.test(t) ||
      /^The first time each turn a Hero in this lane would take combat damage/i.test(t) ||
      /^The first time each turn a Hero in a neighboring lane would take combat damage/i.test(t) ||
      /^When an enemy Onslaught is declared against a Hero in this lane/i.test(t)) {
    ev = "attackLane";
    if (/a Hero in a neighboring lane would take combat damage/i.test(t)) out.hexNeighborLane = true;
    if ((m = t.match(new RegExp(`the defending Hero heals ${NUM} Health before combat`, "i")))) ops.push({ op: "heal", n: +m[1], target: "defender" });
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
    if ((m = t.match(/destroy all Relics attached to the attacking Hero/i))) ops.push({ op: "stripAttackerRelics", all: true });
    if ((m = t.match(new RegExp(`destroy one Relic attached to the attacker(?: and deal ${NUM} damage to it)?`, "i")))) { ops.push({ op: "stripAttackerRelics", n: 1 }); if (m[1]) ops.push({ op: "damage", n: +m[1], target: "attacker", pre: true }); }
    if (/the defending Hero's Attack becomes equal to the attacker's Attack for that combat/i.test(t)) ops.push({ op: "combatDefMatch" });
    if (/another Hero you control of your choice joins the defense, adding half its Attack/i.test(t)) ops.push({ op: "joinDefense" });
    if (/that attacker cannot attack during your opponent's next turn/i.test(t)) ops.push({ op: "cantAttack", target: "attacker" });
    if (/the attacker's Relics and Auxiliary cards grant it no Attack or Health for that combat/i.test(t)) ops.push({ op: "combatAtkBare" });
    if ((m = t.match(new RegExp(`the defender has \\+${NUM} Attack for that combat`, "i")))) ops.push({ op: "combatDefAtk", n: +m[1], ifAttackerWounded: /below its maximum Health/i.test(t) });
    if ((m = t.match(new RegExp(`(?:that|the) attacker loses ${NUM} Health`, "i")))) { if (!ops.some(o => o.op === "statReduce")) ops.push({ op: "statReduce", atk: 0, hp: +m[1], target: "attacker" }); }
    if ((m = t.match(new RegExp(`the defender gains a ward that prevents the next ${NUM} damage`, "i")))) ops.push({ op: "ward", n: +m[1], target: "defender" });
    if (!ops.length) {
      // generic fallback: parse the effect clause after the condition
      const rest = t.replace(/^(?:When an enemy Hero(?: below its maximum Health)? attacks a Hero in this lane|The first time each turn an enemy Hero attacks this lane|The first time each turn a Hero in this lane would take combat damage|When an enemy Onslaught is declared against a Hero in this lane),?\s*/i, "")
        .replace(/\s*After this effect triggers once, destroy this card\.?$/i, "").replace(/\s*This card is not destroyed after triggering.*$/i, "");
      const parsed = parseOps(rest);
      if (parsed) ops.push(...parsed);
    }
  } else if (/^When an enemy Hero attacks a Hero in this lane and (?:the defender survives|fails to destroy it)/i.test(t) || /^The first time each turn the Hero in this lane is attacked and survives/i.test(t) || /^When the Hero in this lane takes combat damage and survives/i.test(t)) {
    ev = "postCombat";
    if (/the defender and one Hero you control in a neighboring lane may immediately attack the attacking Hero together/i.test(t)) ops.push({ op: "counterJoint" });
    if (/it may immediately attack the Hero that attacked it/i.test(t)) ops.push({ op: "counterAttack" });
    if ((m = t.match(new RegExp(`that enemy Hero gets [-−–]${NUM} Attack permanently`, "i")))) ops.push({ op: "statReduce", atk: +m[1], hp: 0, target: "attacker" });
    if ((m = t.match(new RegExp(`it heals ${NUM} Health and you gain ${NUM} Pulse`, "i")))) { ops.push({ op: "heal", n: +m[1], target: "defender" }); ops.push({ op: "pulse", n: +m[2] }); }
    if (/takes combat damage and survives/i.test(t)) out.hexNeedsDamage = true;
  } else if (/^The first time each turn the Hero in this lane (?:declares an attack|fights)/i.test(t)) {
    ev = "ownAttack";
    if ((m = t.match(new RegExp(`it (?:gains|has) \\+${NUM} Attack for that combat`, "i")))) ops.push({ op: "combatAtk", n: +m[1] });
    if (/the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health for that combat/i.test(t)) ops.push({ op: "combatDefBare" });
  } else if (/^At the end of your opponent's turn, if the enemy Hero in the opposing lane is below its maximum Health/i.test(t)) {
    ev = "oppEndTurn";
    const hm = t.match(new RegExp(`it loses ${NUM} Health(?: \\(stat reduction\\))? and the Hero in this lane gains \\+${NUM} Attack permanently`, "i"));
    if (hm) ops.push({ op: "hungeringDark", red: +hm[1], buff: +hm[2] });
  } else if (/^The first time each turn the Hero in this lane takes damage/i.test(t)) {
    ev = "tookDamage";
    const wm = t.match(new RegExp(`it gains a ward that prevents the next ${NUM} damage`, "i"));
    if (wm) ops.push({ op: "ward", n: +wm[1], target: "defender" });
  } else if (/^When an enemy card effect reduces the stats of a Hero you control/i.test(t)) {
    ev = "statReduced";
    ops.push({ op: "removeReductions", target: "reducedHero" });
  } else if (/^When a Hero in this lane would die, instead return it to your hand/i.test(t)) {
    out.deathReplace = true; out.autoBits.push("death replacement");
  } else if (/^When an enemy Onslaught fails against a Hero in this lane/i.test(t) && (m = t.match(new RegExp(`all Heroes that participated in that Onslaught get [-−–]${NUM} Attack permanently`, "i")))) {
    ev = "onslaughtFailed";
    ops.push({ op: "statReduce", atk: +m[1], hp: 0, target: "onslaughtAttackers" });
  } else if (/^(?:When|The first time each turn) a Hero you control is sacrificed/i.test(t)) {
    ev = "friendlySacrificed";
    const parsed = parseOps(t.replace(/^(?:When|The first time each turn) a Hero you control is sacrificed,?\s*/i, "").replace(/\s*After this effect triggers once.*$/i, "").replace(/\s*This card is not destroyed.*$/i, ""));
    if (parsed) ops.push(...parsed);
  } else if (/^(?:When|The first time each turn) a Hero you control dies/i.test(t)) {
    ev = "friendlyDiedAny";
    const parsed = parseOps(t.replace(/^(?:When|The first time each turn) a Hero you control dies,?\s*/i, "").replace(/\s*After this effect triggers once.*$/i, "").replace(/\s*This card is not destroyed.*$/i, ""));
    if (parsed) ops.push(...parsed);
  } else if (/^(?:When|The first time each turn) (?:a Hero you control|the Hero in this lane) destroys an enemy Hero in combat/i.test(t)) {
    ev = "friendlyKill";
    if (/the Hero in this lane destroys/i.test(t)) out.hexLaneScoped = true;
    let parsed = parseOps(t.replace(/^(?:When|The first time each turn) (?:a Hero you control|the Hero in this lane) destroys an enemy Hero in combat,?\s*/i, "").replace(/\s*After this effect triggers once.*$/i, "").replace(/\s*This card is not destroyed.*$/i, ""));
    if (parsed) { if (out.hexLaneScoped) parsed = parsed.map(o => o.target === "lastChosen" ? Object.assign({}, o, { target: "victor" }) : o); ops.push(...parsed); }
  } else if (/^When an enemy (?:Auxiliary or Relic|Relic or Auxiliary) card is played in an enemy lane, destroy it/i.test(t)) {
    ev = "oppSupportPlayed";
    ops.push({ op: "destroyPlayedSupport" });
  } else if (/^When an enemy Hero declares an attack against this lane, redirect that attack to another enemy Hero/i.test(t)) {
    ev = "attackLane";
    ops.push({ op: "redirectToAlly" });
  } else if ((m = t.match(new RegExp(`^When a Hero in this lane dies, deal ${NUM} damage to whichever Hero killed it(?:, then draw a card)?`, "i")))) {
    ev = "laneHeroDied";
    ops.push({ op: "damage", n: +m[1], target: "killer" });
    if (/draw a card/i.test(t)) ops.push({ op: "draw", n: 1 });
  } else if (/^When a Hero in this lane dies, gain Pulse equal to that Hero's printed cost/i.test(t)) {
    ev = "laneHeroDied";
    ops.push({ op: "pulseLastCost", mult: 1 });
    if (/draw 1 card/i.test(t)) ops.push({ op: "draw", n: 1 });
  } else if (/^When the Hero in this lane (?:dies|is destroyed)/i.test(t)) {
    ev = "laneHeroDied";
    const rest = t.replace(/^When the Hero in this lane (?:dies|is destroyed)(?: in combat)?(?: \([^)]*\))?,\s*/i, "")
      .replace(/\s*After this effect triggers once, destroy this card\.?$/i, "");
    const parsed = parseOps(rest);
    if (parsed) ops.push(...parsed);
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
  const rite = { timer: null, counterMax: null, event: null, condHeroes: 0, payoff: null, early: null };
  if ((m = t.match(new RegExp(`count ${NUM} of your turns`, "i")))) rite.timer = +m[1];
  if ((m = t.match(new RegExp(`When it reaches ${NUM} counters`, "i")))) rite.counterMax = +m[1];
  if (rite.counterMax) {
    if (/gains 1 counter at the start of each of your turns/i.test(t)) rite.event = "startTurn";
    else if (/reduces an enemy Hero's Attack or Health|enemy Hero's Attack or Health is reduced|reduces an enemy Hero's Attack/i.test(t)) rite.event = "statReduce";
    else if (/a Hero you control is healed by one of your card effects|you heal a Hero with a card effect/i.test(t)) rite.event = "heal";
    else if (/a Hero you control destroys an enemy Hero(?:, enemy Relic, or enemy Auxiliary card)? in combat/i.test(t)) rite.event = "kill";
    else if (/whenever you sacrifice a Hero/i.test(t)) rite.event = "sacrifice";
    else if (/whenever an enemy Hero is destroyed/i.test(t)) rite.event = "enemyDestroyed";
    else rite.event = "startTurn";
    const cond = t.match(/at the start of each of your turns during which you control ${?(\d+)}? or more Heroes/i) || t.match(/during which you control (\d+) or more Heroes/i);
    if (cond) rite.condHeroes = +cond[1];
  }
  let pm = t.match(/At the end of the \d+(?:st|nd|rd|th) counted turn, (.*?)(?:, then destroy this Rite|; then destroy this Rite|\.? ?Then destroy this Rite)/i);
  if (!pm) pm = t.match(/destroy this Rite[;,]? (?:and )?(.*?)$/i);
  if (pm) rite.payoff = parseOps(pm[1]) || parsePayoffBuff(pm[1]) || "manual"; else rite.payoff = "manual";
  const em = t.match(/end this Rite early(?:,)?(?: —| to| granting)? (.*?)(?: immediately| instead|\.$|$)/i);
  if (em) rite.early = parseOps(em[1]) || parsePayoffBuff(em[1]) || "manual";
  out.rite = rite;
  if (rite.payoff !== "manual") out.autoBits.push("rite payoff");
}

function parsePayoffBuff(s) {
  s = norm(s);
  let m = s.match(new RegExp(`give (?:all|each) (\\w+ )?Hero(?:es)? you control(?: \\(of any realm\\))?(?: from a Realm other than (\\w+))? \\+${NUM} (Attack|Health)(?: and \\+${NUM} (?:Attack|Health))? permanently`, "i"));
  if (m) {
    let atk = 0, hp = 0;
    if (/Attack/i.test(m[4])) atk = +m[3]; else hp = +m[3];
    if (m[5] != null) { if (hp === 0) hp = +m[5]; else atk = +m[5]; }
    const realm = m[1] && !/^your$/i.test(m[1].trim()) ? m[1].trim() : null;
    return [{ op: "buff", atk, hp, target: "allOwn", realmFilter: realm, otherThan: m[2] || null, perm: true }];
  }
  m = s.match(new RegExp(`\\+${NUM} Attack and \\+${NUM} Health`));
  if (m && /this lane|your Hero/i.test(s)) return [{ op: "buff", atk: +m[1], hp: +m[2], target: "laneHero", perm: true }];
  m = s.match(new RegExp(`deal ${NUM} damage to a Hero of your choice`, "i"));
  if (m) return [{ op: "damage", n: +m[1], target: "anyChoice" }];
  m = s.match(new RegExp(`^gain ${NUM} Pulse`, "i"));
  if (m) return [{ op: "pulse", n: +m[1] }];
  m = s.match(new RegExp(`^draw ${NUM} cards?`, "i"));
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
    const parts = clause.split(/, and |, then |; | and (?=[A-Z]\w+ gains |this Hero gains |gain |draw |deal |destroy )/);
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
  // Miriel: pay any amount of Pulse (max N): 10 damage per Pulse to a nearby enemy
  {
    const mm = norm(text || "").match(/Once per turn, you may pay any amount of Pulse \(maximum (\d+)\): deal (\d+) damage to an enemy Hero in this lane or a neighboring lane for each 1 Pulse paid/i);
    if (mm) { list.push({ cost: 0, ops: [{ op: "payXDamage", max: +mm[1], per: +mm[2] }], raw: `pay up to ${mm[1]} Pulse — ${mm[2]} damage per Pulse to a nearby enemy` }); bits.push("activated ability"); }
  }
  // Thalorin/Corvyn: attack an enemy Relic/Aux in the opposing lane instead of the Hero
  {
    const sm = norm(text || "").match(/(?:Instead of attacking the enemy Hero, \w+ may declare (?:his|her|its) attack against an enemy Relic or enemy Auxiliary card in (?:his|her|its) opposing lane|the Hero in this lane may attack an enemy Relic or enemy Auxiliary card in its opposing lane)/i);
    if (sm) { list.push({ cost: 0, ops: [{ op: "snipeSupport", chain: /may then immediately attack the enemy Hero in that lane/i.test(norm(text)) }], raw: "attack an enemy Relic/Auxiliary in the opposing lane instead (uses this Hero's attack)" }); bits.push("activated ability"); }
  }
  // Joint Strike abilities whose wording lacks "you may" (e.g. "Once per turn,
  // Elsbeth and a Hero you control ... may attack one enemy lane together ...")
  if (!list.some(a => a.ops && a.ops.some(o => o.op === "jointStrike"))) {
    const jm = norm(text || "").match(/Once per turn,?[^.]*?may attack one enemy lane together as a single combat[^.]*\./i);
    if (jm) {
      const self = /and a Hero you control in a lane neighboring/i.test(jm[0]);
      const costM = jm[0].match(/pay (\d+) Pulse/i);
      list.push({ cost: costM ? +costM[1] : 0, ops: [{ op: "jointStrike", initiator: self ? "self" : "any" }], raw: (costM ? `pay ${costM[1]} Pulse — ` : "") + "Joint Strike" });
      bits.push("activated ability");
    }
  }
}

// Passives implemented by direct engine scans (not compiled ops) — tag them
const SCANNED_HERO = [
  [/whenever you cast an Incantation, you may pay \d+ Pulse to resolve/i, "spell echo"],
  [/whenever your opponent plays a Hero, that Hero enters play with [-−–]\d+ Attack/i, "weakens enemy plays"],
  [/your opponent cannot attach Relics to the Hero in the opposing lane/i, "blocks enemy relics"],
  [/participates in an Onslaught, all participating Heroes gain \+\d+ Attack/i, "onslaught leader"],
  [/the first Hero you play each turn costs \d+ less Pulse/i, "first-hero discount"],
];
const SCANNED_AUX = [
  [/enemy Heroes attacking this lane have [-−–]\d+ Attack during that combat/i, "lane intimidation"],
  [/whenever any enemy Hero declares an attack, it gets [-−–]\d+ Attack/i, "battlefield curse"],
  [/the enemy Hero in the lane opposing this one cannot be healed/i, "blocks healing"],
  [/whenever your opponent plays a Hero, that Hero enters play with [-−–]\d+ Attack/i, "weakens enemy plays"],
  [/whenever two or more Heroes you control attack on the same turn, gain \d+ Pulse/i, "pack tactics"],
  [/when any Hero you control would take combat damage, if a Hero you control occupies a lane neighboring it, prevent \d+/i, "formation guard"],
  [/the Hero in this lane takes \d+ less combat damage while a Hero you control occupies a neighboring lane/i, "formation guard"],
  [/the Hero in this lane and Heroes you control in neighboring lanes take \d+ less combat damage/i, "formation guard"],
  [/Heroes you control have \+\d+ Attack while fighting enemy Heroes below their maximum Health/i, "blood scent"],
  [/when Heroes you control in neighboring lanes fight, the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health/i, "equipment denial"],
  [/whenever an enemy Hero's Health is reduced by one of your card effects, the Hero in this lane heals \d+ Health/i, "feeds on suffering"],
  [/the first time each turn an enemy Hero takes damage, the Hero in this lane heals \d+ Health/i, "feeds on pain"],
  [/the first time each turn a Hero you control is sacrificed, return a Hero card of cost \d+ or less from your discard pile/i, "recycles the fallen"],
  [/whenever any Hero you control destroys an enemy Hero in combat, gain \d+ Pulse/i, "victory dividend"],
];

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
      out.flags = compileFlags(card.text, out.autoBits);
      out.auxFlags = compileFlags(card.auxText, out.auxAutoBits);
      const hRed = parseRedirect(card.text); if (hRed) { out.redirect = Object.assign({ protector: "self" }, hRed); out.autoBits.push("attack redirect"); }
      const hBg = parseBodyguard(card.text); if (hBg) { out.bodyguard = Object.assign({ protector: "self" }, hBg); out.autoBits.push("bodyguard"); }
      const aRed = parseRedirect(card.auxText); if (aRed) { out.auxRedirect = Object.assign({ protector: "laneHero" }, aRed); out.auxAutoBits.push("attack redirect"); }
      const aBg = parseBodyguard(card.auxText); if (aBg) { out.auxBodyguard = Object.assign({ protector: "laneHero" }, aBg); out.auxAutoBits.push("bodyguard"); }
      compileActivated(card.text, out.activated, out.autoBits);
      compileActivated(card.auxText, out.auxActivated, out.auxAutoBits);
      for (const [re, label] of SCANNED_HERO) if (re.test(norm(card.text))) out.autoBits.push(label);
      for (const [re, label] of SCANNED_AUX) if (re.test(norm(card.auxText))) out.auxAutoBits.push(label);
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
      const rm = norm(card.text).match(/When this Relic is equipped, (.*?)\.?$/i);
      if (rm) { out.onEquip = parseOps(rm[1]); if (out.onEquip) out.autoBits.push("on-equip"); }
      const rRed = parseRedirect(card.text); if (rRed) { out.redirect = Object.assign({ protector: "equipped" }, rRed); out.autoBits.push("attack redirect"); }
      out.flags = compileFlags(card.text, out.autoBits) || out.flags;
      const pv = norm(card.text).match(/the first time each turn this Hero (?:would take|takes) combat damage, prevent (\d+) of that damage/i);
      if (pv) { out.preventFirst = +pv[1]; out.autoBits.push("combat prevention"); }
      const rBg = parseBodyguard(card.text); if (rBg) { out.bodyguard = Object.assign({ protector: "equipped" }, rBg); out.autoBits.push("bodyguard"); }
    } else if (card.type === "hex") {
      compileHex(card, out);
      const xRed = parseRedirect(card.text); if (xRed && (!out.hexTrig || out.hexTrig === "manual")) { out.hexRedirect = Object.assign({ protector: "laneHero" }, xRed); out.autoBits.push("attack redirect"); }
      if (/When an enemy card effect would destroy a Relic you control, prevent that destruction/i.test(norm(card.text))) { out.relicWard = true; out.autoBits.push("relic ward"); }
      if (/would silence a Hero you control or blank its ability text, prevent that effect/i.test(norm(card.text))) { out.silenceWard = true; out.autoBits.push("silence ward"); }
      if (/When an enemy Hero destroys a Hero you control in this lane in combat, that enemy Hero takes (\d+) damage/i.test(norm(card.text))) { const dm = norm(card.text).match(/takes (\d+) damage/); out.hexTrig = { event: "laneHeroDied", ops: [{ op: "damage", n: +dm[1], target: "killer" }], persistent: false }; }
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
  if (card.type === "hex") return (f.hexTrig && f.hexTrig !== "manual") || f.hexRedirect || f.relicWard || f.silenceWard || f.deathReplace ? "auto" : "manual";
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
    name, isAI, mortality: C().startingMortality, pulse: 0, fatigue: 0, turnCount: 0, championUid: null, discard: [], mods: [], heroesPlayedTurn: 0, relicDiscountTurn: 0, relicDiscountExpire: -1, pulseOverrideGt: -1, pulseOverrideAmt: 5,
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
      if (L.hero && !isSilenced(L.hero)) sources.push({ f: fx(L.hero.cardId), cont: "cont", props: "props", self: pi === tpi && li === tli });
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
  // Deepforge relic-boost effects modify the target Hero's Relic bonuses
  const tH = G.players[tpi].lanes[tli].hero;
  if (tH && tH.relics.length && !(bare)) {
    const boost = relicBoost(tpi, tli, tH);
    atk += boost.atk; hp += boost.hp;
  }
  return { atk, hp, maxAttacks };
}

// Extra Attack/Health granted to a Hero's Relics by Deepforge boosters:
// Durgan (double printed stats), Mardis-aux (+10/+10 per Relic, board-wide),
// Hegga-aux (+N Health per Relic on that lane's Hero).
function relicBoost(tpi, tli, tHero) {
  const relicCount = tHero.relics.length;
  let printedAtk = 0, printedHp = 0;
  for (const r of tHero.relics) for (const e of (fx(r.cardId).cont || [])) if (e.scope === "equipped") { printedAtk += e.atk; printedHp += e.hp; }
  let atk = 0, hp = 0;
  for (const pos of heroesOf(tpi)) if (/all Relics equipped to Heroes you control grant double their printed Attack and Health/i.test(cardById(heroAt(pos).cardId).text || "")) { atk += printedAtk; hp += printedHp; }
  G.players[tpi].lanes.forEach((L, li) => {
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const at = cardById(a.cardId).auxText || "";
      if (/all Relics equipped to Heroes you control grant an additional \+(\d+) Attack and \+(\d+) Health/i.test(at)) { const mm = at.match(/\+(\d+) Attack and \+(\d+) Health/); atk += relicCount * +mm[1]; hp += relicCount * +mm[2]; }
      if (li === tli) { const hm = at.match(/each Relic equipped to the Hero in this lane grants an additional \+(\d+) Health/i); if (hm) hp += relicCount * +hm[1]; }
    }
  });
  return { atk, hp };
}

function auraHits(e, spi, sli, tpi, tli, src) {
  const tHero = G.players[tpi].lanes[tli].hero;
  const sHero = G.players[spi].lanes[sli].hero;
  switch (e.scope) {
    case "equipped": return src.equippedHere && spi === tpi && sli === tli;
    case "equippedIfChampion": return src.equippedHere && spi === tpi && sli === tli && isChampion({ pi: tpi, li: tli });
    case "champion": return spi === tpi && isChampion({ pi: tpi, li: tli });
    case "selfIfHasRelic": return spi === tpi && sli === tli && tHero.relics.length > 0;
    case "selfIfTwoRelics": return spi === tpi && sli === tli && tHero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0) >= 2;
    case "laneHero": return spi === tpi && sli === tli;
    case "allFriendly":
      if (spi !== tpi) return false;
      if (e.excludeSelf && sli === tli && sHero === tHero && src.cont === "cont") return false;
      if (e.realmFilter && cardById(tHero.cardId).realm !== e.realmFilter) return false;
      return true;
    case "neighbors": return spi === tpi && Math.abs(sli - tli) === 1;
    case "allFriendlyNeighborCond": return spi === tpi && heroesOf(tpi).some(o => o.li !== tli && Math.abs(o.li - tli) === 1);
    case "bothNeighbors": {
      if (spi !== tpi || Math.abs(sli - tli) !== 1) return false;
      const lanes = G.players[spi].lanes;
      return !!(lanes[sli - 1] && lanes[sli - 1].hero) && !!(lanes[sli + 1] && lanes[sli + 1].hero);
    }
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
  // per-turn resets + this-turn cost modifiers
  P.heroesPlayedTurn = 0;
  if (P.mods) P.mods = P.mods.filter(m => m.life !== "turn");   // "this turn" next-Hero mods expire
  const basePulse = (P.pulseOverrideGt === G.gt) ? P.pulseOverrideAmt : C().pulsePerTurn;
  if (P.pulseOverrideGt === G.gt) log(`${P.name}'s base Pulse gain is ${basePulse} this turn.`);
  P.pulse += basePulse;
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
      // timer rites and "counter each turn" rites tick here; event-counter rites tick via tickRites()
      const ticksNow = r && (r.timer || (r.counterMax && r.event === "startTurn"));
      if (ticksNow && (!r.condHeroes || heroesOf(pi).length >= r.condHeroes)) {
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
    if (L.hero && !isSilenced(L.hero)) for (const op of fx(L.hero.cardId).eot) runOp(op, pi, { laneIdx: li, sourceName: cardById(L.hero.cardId).name });
    if (L.hero) for (const r of L.hero.relics.slice()) for (const op of fx(r.cardId).eot) runOp(op, pi, { laneIdx: li, sourceName: cardById(r.cardId).name });
  }
  // queued end-of-turn damage (Overchannel-style)
  if (P.eotQueue && P.eotQueue.length) {
    for (const q of P.eotQueue) {
      const pos = heroesOf(pi).find(t => heroAt(t).uid === q.uid);
      if (pos) dealDamage(pos, q.dmg, { sourceName: "end of turn" });
    }
    P.eotQueue = [];
  }
  // March or Die: your Heroes that didn't attack take damage
  if (P.marchGt === G.gt && P.marchDmg) {
    for (const t of heroesOf(pi).slice()) if (heroAt(t) && heroAt(t).attacksUsed === 0) dealDamage(t, P.marchDmg, { sourceName: "March or Die" });
    P.marchGt = -1;
  }
  fireHexes(1 - pi, "oppEndTurn", {});
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
      if (!P.discard) P.discard = [];
      for (let i = 0; i < op.n && P.hand.length; i++) {
        if (P.isAI) { P.discard.push(P.hand.splice(Math.floor(Math.random() * P.hand.length), 1)[0]); log(`AI discards a card.`, "ai"); }
        else {
          const idx = await UI.pickHandCard("Choose a card to discard");
          if (idx == null) return;
          log(`You discard ${cardById(P.hand[idx]).name}.`);
          P.discard.push(P.hand.splice(idx, 1)[0]);
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
        if (cannotBeHealed(t)) { log(`${nameOf(t)} cannot be healed!`); continue; }
        const h = heroAt(t);
        const healed = Math.min(h.dmg, op.n);
        h.dmg -= healed;
        if (op.permHp) h.permHp += op.permHp;
        log(`${nameOf(t)} heals ${healed}${op.permHp ? ` and gains +${op.permHp} Health` : ""}.`);
        any = true;
      }
      if (any) { emit("heal", pi, {}); tickRites(pi, "heal"); }
      break;
    }
    case "buffIfAlive":
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
      let any = false;
      for (const t of targets) if (heroAt(t)) {
        const h = heroAt(t);
        h.redAtk += op.atk || 0; h.redHp += op.hp || 0;
        log(`${nameOf(t)} loses ${op.atk || 0} Attack / ${op.hp || 0} Health (stat reduction).`);
        any = true;
        if (t.pi !== pi) postStatReduce(pi, t);
        if (curHp(t.pi, t.li) <= 0 && effMaxHp(t.pi, t.li) <= h.dmg) destroyHero(t.pi, t.li, null, { noOverkill: true });
        else if (effMaxHp(t.pi, t.li) <= 0) destroyHero(t.pi, t.li, null, { noOverkill: true });
      }
      if (any) tickRites(pi, "statReduce");
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
      tickRites(pi, "sacrifice");
      await fireHexes(pi, "friendlySacrificed", {});
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
    case "sacrificeAux": {
      const auxes = [];
      G.players[pi].lanes.forEach((L, li) => { const seen = new Set(); for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); auxes.push({ li, a }); } });
      if (!auxes.length) { log(`No Auxiliary card to destroy — effect fizzles.`); ctx.abort = true; break; }
      let pick = auxes[0];
      if (!P.isAI && auxes.length > 1) { const idx = promptPick("Destroy which Auxiliary card?", auxes.map(o => `${cardById(o.a.cardId).name} (lane ${o.li + 1})`)); if (idx == null) { ctx.abort = true; break; } pick = auxes[idx]; }
      removeAux(pi, pick.li, pick.a.uid);
      log(`${P.name} destroys own Auxiliary ${cardById(pick.a.cardId).name}.`);
      break;
    }
    case "sacrificeSupport": {
      // destroy one of your own Relics OR Auxiliary cards (cost payment)
      const opts3 = [];
      G.players[pi].lanes.forEach((L, li) => {
        if (L.hero) L.hero.relics.forEach(r => opts3.push({ kind: "relic", li, obj: r, label: `Relic ${cardById(r.cardId).name}` }));
        const seen = new Set();
        for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); opts3.push({ kind: "aux", li, obj: a, label: `Aux ${cardById(a.cardId).name}` }); }
      });
      if (!opts3.length) { log(`Nothing to destroy — effect fizzles.`); ctx.abort = true; break; }
      let pick = opts3[0];
      if (!P.isAI && opts3.length > 1) { const idx = promptPick("Destroy which of your Relics/Auxiliaries?", opts3.map(o => o.label)); if (idx == null) { ctx.abort = true; break; } pick = opts3[idx]; }
      ctx.lastCost = cardById(pick.obj.cardId).cost;
      if (pick.kind === "relic") { const h2 = G.players[pi].lanes[pick.li].hero; h2.relics = h2.relics.filter(r => r !== pick.obj); }
      else removeAux(pi, pick.li, pick.obj.uid);
      log(`${P.name} destroys own ${pick.label}.`);
      break;
    }
    case "eotDamage":
      if (ctx.lastChosen && heroAt(ctx.lastChosen)) { P.eotQueue = P.eotQueue || []; P.eotQueue.push({ uid: heroAt(ctx.lastChosen).uid, dmg: op.n }); log(`${nameOf(ctx.lastChosen)} will take ${op.n} damage at end of turn.`); }
      break;
    case "noRedirectNextTurn":
      O.noRedirectTurn = G.gt + 1;
      log(`${O.name}'s Heroes cannot redirect their attacks next turn.`);
      break;
    case "buffHalfSacAtk": {
      if (!ctx.sacAtk) break;
      const gain = Math.round(ctx.sacAtk / 2 / 10) * 10;
      await runOp({ op: "buff", atk: gain, hp: 0, target: "ownChoice", perm: true }, pi, ctx);
      break;
    }
    case "damageSacAtk": {
      if (!ctx.sacAtk) break;
      await runOp({ op: "damage", n: Math.min(ctx.sacAtk, op.max || 999), target: "enemyChoice" }, pi, ctx);
      break;
    }
    case "marchOrDie":
      P.marchGt = G.gt; P.marchDmg = op.n;
      break;
    case "returnHeroDiscard": {
      if (!P.discard) P.discard = [];
      const hIdxs = P.discard.map((id, ix) => ({ id, ix })).filter(x => cardById(x.id).type === "hero");
      if (!hIdxs.length) { log(`No Hero in your discard pile.`); break; }
      let pickH = P.isAI ? hIdxs.sort((a, b) => cardById(b.id).cost - cardById(a.id).cost)[0] : hIdxs[(() => { const i = promptPick("Return which Hero from your discard pile?", hIdxs.map(x => cardById(x.id).name)); return i == null ? -1 : i; })()];
      if (!pickH) break;
      P.hand.push(pickH.id); P.discard.splice(pickH.ix, 1);
      log(`${P.name} returns ${cardById(pickH.id).name} from the discard pile to hand.`, P.isAI ? "ai" : "");
      break;
    }
    case "protectTemp": {
      let targets = await resolveTargets(Object.assign({}, op, { target: op.target, count: op.count }), pi, ctx);
      for (const t of targets) if (heroAt(t)) { heroAt(t).protectedUntil = G.gt + 2; log(`${nameOf(t)} cannot be attacked or targeted until your next turn.`); }
      if (op.storeChosen && targets.length) ctx.lastChosen = targets[0];
      break;
    }
    case "silence": {
      let targets = await resolveTargets(op, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        const immune = heroesOf(t.pi).some(x => /Heroes you control cannot be silenced/i.test(cardById(heroAt(x).cardId).text || ""));
        if (immune) { log(`${nameOf(t)} cannot be silenced!`); continue; }
        const DP = G.players[t.pi];
        const wardIdx = DP.slots.findIndex(s2 => s2 && s2.kind === "hex" && fx(s2.cardId).silenceWard);
        if (wardIdx >= 0) { log(`${DP.name}'s ${cardById(DP.slots[wardIdx].cardId).name} prevents the silence!`, DP.isAI ? "ai" : ""); DP.slots[wardIdx] = null; continue; }
        heroAt(t).silencedUntil = G.gt + 2;
        log(`${nameOf(t)} is silenced — its ability text is blank until your next turn.`);
      }
      break;
    }
    case "sealLane": {
      const lanes = G.players[1 - pi].lanes.map((L, li) => li).filter(li => laneUnlocked(1 - pi, li));
      if (!lanes.length) break;
      let li = lanes[0];
      if (!P.isAI) { const idx = promptPick("Seal which enemy lane?", lanes.map(l => `Lane ${l + 1} (${G.players[1 - pi].lanes[l].realm})`)); if (idx == null) break; li = lanes[idx]; }
      else li = lanes.sort((a, b) => (heroAt({ pi: 1 - pi, li: b }) ? 0 : 1) - (heroAt({ pi: 1 - pi, li: a }) ? 0 : 1))[0];
      G.players[1 - pi].lanes[li].sealedUntil = G.gt + 2;
      log(`${P.name} seals ${O.name}'s Lane ${li + 1} until next turn.`);
      break;
    }
    case "pulsePerRealmHero": {
      const count = heroesOf(pi).filter(t => cardById(heroAt(t).cardId).realm.toLowerCase() === op.realm.toLowerCase()).length;
      if (count) gainPulse(pi, op.n * count, ctx.sourceName);
      break;
    }
    case "massReduceBuffPer": {
      const targets = heroesOf(1 - pi).filter(t => !isProtected(t));
      let affected = 0;
      for (const t of targets) { const h2 = heroAt(t); h2.redAtk += op.redAtk || 0; h2.redHp += op.redHp || 0; affected++; if (effMaxHp(t.pi, t.li) <= h2.dmg || effMaxHp(t.pi, t.li) <= 0) destroyHero(t.pi, t.li, null, { noOverkill: true }); }
      log(`All enemy Heroes lose ${op.redAtk || 0} Attack / ${op.redHp || 0} Health (${affected} affected).`);
      if (affected) await runOp({ op: "buff", atk: (op.buffAtk || 0) * affected, hp: 0, target: "ownChoice", perm: true, storeChosen: true }, pi, ctx);
      if (affected && op.healPer) await runOp({ op: "heal", n: op.healPer * affected, target: "lastChosen" }, pi, ctx);
      break;
    }
    case "rideThemDown": {
      let targets = await resolveTargets({ target: "ownChoice", storeChosen: true }, pi, ctx);
      for (const t of targets) if (heroAt(t)) { heroAt(t).grantAnyLane = G.gt; heroAt(t).temp.push({ atk: op.atk, hp: 0, until: G.gt }); log(`${nameOf(t)} may attack any lane and has +${op.atk} Attack this turn.`); }
      break;
    }
    case "rally": {
      const realms = new Set(heroesOf(pi).map(t => cardById(heroAt(t).cardId).realm));
      const amt = realms.size >= op.need ? op.bonus : op.base;
      await runOp({ op: "buff", atk: amt, hp: 0, target: "allOwn", dur: 0 }, pi, ctx);
      break;
    }
    case "veniVidi": {
      let targets = await resolveTargets({ target: "ownChoice", storeChosen: true }, pi, ctx);
      for (const t of targets) if (heroAt(t)) {
        const h2 = heroAt(t);
        h2.temp.push({ atk: op.atk, hp: 0, until: G.gt });
        h2.vvvGt = G.gt; h2.vvvReward = { atk: op.bAtk, hp: op.bHp, pulse: op.pulse };
        log(`${nameOf(t)} gains +${op.atk} Attack this turn — glory awaits a kill.`);
      }
      break;
    }
    case "forcedDuel": {
      const own2 = heroesOf(pi);
      if (!own2.length) break;
      let mine = P.isAI ? own2.sort((a, b) => effAtk(pi, b.li) - effAtk(pi, a.li))[0] : await UI.pickHero("Choose your duelist", own2);
      if (!mine) break;
      const foes = heroesOf(1 - pi).filter(t => Math.abs(t.li - mine.li) <= 1 && !isProtected(t));
      if (!foes.length) { log(`No enemy Hero in range for the duel.`); break; }
      let foe = P.isAI ? foes.sort((a, b) => effAtk(1 - pi, a.li) - effAtk(1 - pi, b.li))[0] : await UI.pickHero("Choose the enemy duelist (opposing or neighboring lane)", foes);
      if (!foe) break;
      const myAtk = effAtk(pi, mine.li) + op.atk;
      const foeAtk = effAtk(1 - pi, foe.li, true);   // bare: no relic/aux stats
      log(`Duel! ${nameOf(mine)} (${myAtk}) vs ${nameOf(foe)} (${foeAtk}).`);
      if (myAtk > foeAtk) { const defThere = heroAt(foe); dealDamage(foe, myAtk - foeAtk, { combat: true, killer: mine, sourceName: "duel" }); if (defThere && !heroAt(foe)) await fireCombat("kill", pi, mine.li, 1 - pi, foe.li); }
      else if (foeAtk > myAtk) dealDamage(mine, foeAtk - myAtk, { combat: true, killer: foe, sourceName: "duel" });
      else log(`The duel is a draw.`);
      break;
    }
    case "exsanguinate": {
      let targets = await resolveTargets({ target: "enemyChoice", storeChosen: true }, pi, ctx);
      if (!targets.length) break;
      const t = targets[0], h2 = heroAt(t);
      h2.redHp += op.red;
      log(`${nameOf(t)} loses ${op.red} Health (stat reduction).`);
      if (effMaxHp(t.pi, t.li) <= h2.dmg || effMaxHp(t.pi, t.li) <= 0) destroyHero(t.pi, t.li, null, { noOverkill: true });
      await runOp({ op: "buff", atk: op.buff, hp: 0, target: "ownChoice", perm: true }, pi, ctx);
      if (heroAt(t)) dealDamage(t, op.dmg, { sourceName: ctx.sourceName });
      break;
    }
    case "discardForAtk": {
      if (!P.discard) P.discard = [];
      let n = 0;
      if (P.isAI) { const max = Math.min(2, P.hand.length); for (let i = 0; i < max; i++) { P.discard.push(P.hand.splice(Math.floor(Math.random() * P.hand.length), 1)[0]); n++; } }
      else {
        while (P.hand.length) {
          const idx = promptPick(`Discard a card for +${op.per} Attack each (${n} so far) — cancel to stop`, P.hand.map(id => cardById(id).name));
          if (idx == null) break;
          P.discard.push(P.hand.splice(idx, 1)[0]); n++;
        }
      }
      if (!n) break;
      const cands = heroesOf(pi).filter(t => !op.realm || cardById(heroAt(t).cardId).realm.toLowerCase() === op.realm.toLowerCase());
      if (!cands.length) { log(`No ${op.realm || ""} Hero to empower.`); break; }
      let t = P.isAI ? cands.sort((a, b) => effAtk(pi, b.li) - effAtk(pi, a.li))[0] : await UI.pickHero(`Give +${op.per * n} Attack to which ${op.realm || ""} Hero?`, cands);
      if (!t) break;
      heroAt(t).temp.push({ atk: op.per * n, hp: 0, until: G.gt });
      log(`${nameOf(t)} gains +${op.per * n} Attack until end of turn (${n} discarded).`);
      break;
    }
    case "pulseDamage": {
      const dmg = Math.min(Math.floor(P.pulse / op.per2) * op.per, op.max);
      if (dmg <= 0) { log(`No banked Pulse — no damage.`); break; }
      await runOp({ op: "damage", n: dmg, target: "enemyChoice" }, pi, ctx);
      break;
    }
    case "playFromDiscard": {
      if (!P.discard) P.discard = [];
      const cands = P.discard.map((id, ix) => ({ id, ix })).filter(x => cardById(x.id).type === "hero" && cardById(x.id).cost <= (op.maxCost || 99) && canPlayNameCheck(pi, cardById(x.id)));
      const lanes = G.players[pi].lanes.map((L, li) => ({ L, li })).filter(x => !x.L.hero && laneUnlocked(pi, x.li) && !(x.L.sealedUntil > G.gt));
      if (!cands.length || !lanes.length) { log(`No Hero/lane available to raise from the discard pile.`); break; }
      let pickC = cands.filter(x => lanes.some(l => l.L.realm === cardById(x.id).realm));
      if (!pickC.length) { log(`No matching Realm lane for the discarded Heroes.`); break; }
      let chosen = P.isAI ? pickC.sort((a, b) => cardById(b.id).cost - cardById(a.id).cost)[0] : pickC[(() => { const i = promptPick("Play which Hero from your discard pile (free)?", pickC.map(x => cardById(x.id).name)); return i == null ? -1 : i; })()];
      if (!chosen) break;
      const lane = lanes.find(l => l.L.realm === cardById(chosen.id).realm);
      P.discard.splice(chosen.ix, 1);
      G.players[pi].lanes[lane.li].hero = heroInst(chosen.id);
      log(`${P.name} raises ${cardById(chosen.id).name} from the discard pile into lane ${lane.li + 1}!`, P.isAI ? "ai" : "");
      break;
    }
    case "armyRide": P.armyAnyLaneUntil = G.gt + 2; P.armyInitBonus = op.atk; P.armyInitUntil = G.gt + 2; log(`${P.name}'s Heroes may attack any lane (+${op.atk} when attacking) until the end of next turn!`); break;
    case "armyHunt":
      P.armyBareUntil = G.gt + 2;
      await runOp({ op: "buff", atk: op.atk, hp: 0, target: "allOwn", dur: 2 }, pi, ctx);
      log(`${P.name}'s Heroes ignore enemy equipment in combat until the end of next turn!`);
      break;
    case "huntOne": {
      let targets = await resolveTargets({ target: "ownChoice", storeChosen: true }, pi, ctx);
      for (const t of targets) if (heroAt(t)) { const h2 = heroAt(t); h2.temp.push({ atk: op.atk, hp: 0, until: G.gt + 2 }); h2.huntUntil = G.gt + 2; log(`${nameOf(t)} gains +${op.atk} Attack and ignores enemy equipment until your next turn.`); }
      break;
    }
    case "sacUpTo": {
      let count = 0;
      for (let i = 0; i < op.n; i++) {
        let own2 = heroesOf(pi);
        if (op.other && ctx.laneIdx != null) own2 = own2.filter(t => t.li !== ctx.laneIdx);
        if (op.to === "team") own2 = own2.filter(t => heroesOf(pi).length > 1);
        if (!own2.length) break;
        let t;
        if (P.isAI) { if (!op.mandatory && i >= 1) break; t = own2.sort((a, b) => effAtk(a.pi, a.li) - effAtk(b.pi, b.li))[0]; }
        else { t = await UI.pickHero(`Sacrifice a Hero (${i + 1} of up to ${op.n}) — or cancel to stop`, own2, true); if (!t) break; }
        log(`${P.name} sacrifices ${nameOf(t)}.`);
        destroyHero(t.pi, t.li, null, { sacrifice: true });
        emit("sacrifice", pi, {}); tickRites(pi, "sacrifice"); await fireHexes(pi, "friendlySacrificed", {});
        count++;
      }
      if (!count) break;
      if (op.to === "self" && ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx })) {
        const h2 = heroAt({ pi, li: ctx.laneIdx });
        h2.permAtk += op.perAtk * count; h2.permHp += op.perHp * count;
        log(`${cardById(h2.cardId).name} gains +${op.perAtk * count}/+${op.perHp * count} permanently.`);
      } else if (op.to === "team") {
        await runOp({ op: "buff", atk: op.perAtk * count, hp: op.perHp * count, target: "allOwn", perm: true }, pi, ctx);
      }
      break;
    }
    case "neferkha": {
      const targets = heroesOf(1 - pi).filter(t => !isProtected(t));
      let affected = 0;
      for (const t of targets) { const h2 = heroAt(t); h2.redAtk += op.red; affected++; postStatReduce(pi, t); }
      log(`Every enemy Hero loses ${op.red} Attack (${affected} affected).`);
      if (affected && ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx })) { heroAt({ pi, li: ctx.laneIdx }).permAtk += op.per * affected; log(`+${op.per * affected} Attack gained.`); }
      break;
    }
    case "osiraket": {
      const targets = heroesOf(1 - pi).filter(t => !isProtected(t));
      let affected = 0;
      for (const t of targets) { heroAt(t).temp.push({ atk: -op.red, hp: 0, until: G.gt + 1 }); affected++; }
      if (affected && ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx })) heroAt({ pi, li: ctx.laneIdx }).temp.push({ atk: op.per * affected, hp: 0, until: G.gt + 1 });
      if (affected) log(`${ctx.sourceName} drains ${op.red} Attack from ${affected} enemy Hero(es) until your next turn.`);
      break;
    }
    case "ellisette": {
      const foe = ctx.laneIdx != null ? { pi: 1 - pi, li: ctx.laneIdx } : null;
      const fh = foe && heroAt(foe);
      if (!fh) break;
      if (op.needWounded && fh.dmg <= 0) break;
      fh.redHp += op.red;
      log(`${cardById(fh.cardId).name} loses ${op.red} Health (stat reduction).`);
      postStatReduce(pi, foe);
      if (effMaxHp(foe.pi, foe.li) <= fh.dmg || effMaxHp(foe.pi, foe.li) <= 0) destroyHero(foe.pi, foe.li, null, { noOverkill: true });
      const mine = heroAt({ pi, li: ctx.laneIdx });
      if (mine && (op.atk || op.heal)) { mine.permAtk += op.atk; const hd = Math.min(mine.dmg, op.heal); mine.dmg -= hd; log(`${cardById(mine.cardId).name} gains +${op.atk} Attack and heals ${hd}.`); }
      break;
    }
    case "condRealmBonus": {
      const realms = new Set(heroesOf(pi).map(t => cardById(heroAt(t).cardId).realm));
      let ok2 = false;
      if (op.need) ok2 = realms.size >= op.need;
      else if (op.otherThan) ok2 = [...realms].some(r => r.toLowerCase() !== op.otherThan.toLowerCase());
      else if (op.otherRealm) ok2 = realms.size >= 2 || (realms.size === 1 && ctx.laneIdx != null && ![...realms][0]);
      if (op.otherRealm && ctx.laneIdx != null) { const laneRealm = G.players[pi].lanes[ctx.laneIdx].realm; ok2 = [...realms].some(r => r !== laneRealm); }
      if (!ok2) break;
      if (op.kind === "draw") { for (let i = 0; i < op.n; i++) drawCard(pi); }
      else gainPulse(pi, op.n, ctx.sourceName);
      break;
    }
    case "mirielAux":
      if ((G.deathGt && G.deathGt[1 - pi] || -99) >= G.gt - 2) gainPulse(pi, op.n, ctx.sourceName);
      break;
    case "payXDamage": {
      const maxPay = Math.min(op.max, P.pulse);
      if (maxPay <= 0) { if (!P.isAI) UI.toast("No Pulse to spend."); break; }
      const near = heroesOf(1 - pi).filter(t => !isUntargetable(t) && ctx.laneIdx != null && Math.abs(t.li - ctx.laneIdx) <= 1);
      if (!near.length) { log(`No enemy Hero in range.`); break; }
      let pay = maxPay;
      if (!P.isAI) { const idx = promptPick(`Pay how much Pulse? (${op.per} damage each)`, Array.from({ length: maxPay }, (_, i) => `${i + 1} Pulse — ${(i + 1) * op.per} damage`)); if (idx == null) break; pay = idx + 1; }
      P.pulse -= pay;
      let t = P.isAI ? near.sort((a, b) => curHp(a.pi, a.li) - curHp(b.pi, b.li))[0] : await UI.pickHero(`Deal ${pay * op.per} damage to which nearby enemy?`, near);
      if (!t) break;
      dealDamage(t, pay * op.per, { sourceName: ctx.sourceName });
      break;
    }
    case "snipeSupport": {
      const li2 = ctx.laneIdx;
      const h2 = heroAt({ pi, li: li2 });
      if (!h2 || !canAttack(pi, li2)) { if (!P.isAI) UI.toast("This Hero has no attack available."); break; }
      const foe = { pi: 1 - pi, li: li2 };
      const fh = heroAt(foe);
      const supports = [];
      if (fh) fh.relics.forEach(r => supports.push({ kind: "relic", obj: r, label: `Relic ${cardById(r.cardId).name}` }));
      const seen2 = new Set();
      for (const a of G.players[1 - pi].lanes[li2].aux) if (a && !seen2.has(a.uid)) { seen2.add(a.uid); supports.push({ kind: "aux", obj: a, label: `Aux ${cardById(a.cardId).name}` }); }
      if (!supports.length) { log(`No valid enemy Relic or Auxiliary in the opposing lane.`); break; }
      let pick = supports[0];
      if (!P.isAI && supports.length > 1) { const idx = promptPick("Destroy which enemy card in the opposing lane?", supports.map(x => x.label)); if (idx == null) break; pick = supports[idx]; }
      if (pick.kind === "relic" && !canDestroyRelic(1 - pi, li2)) break;
      h2.attacksUsed++; h2.hasAttacked = true; h2.attackedTurn = G.gt;
      if (pick.kind === "relic" && fh) fh.relics = fh.relics.filter(r => r !== pick.obj);
      else removeAux(1 - pi, li2, pick.obj.uid);
      log(`${cardById(h2.cardId).name} destroys ${pick.label} instead of attacking!`, P.isAI ? "ai" : "");
      emit("enemySupportDestroyed", pi, {});
      if (op.chain && heroAt(foe)) { log(`...and follows through against the Hero!`); await miniCombat({ pi, li: li2 }, foe, 0); }
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
        supports = supports.filter(s => s.kind !== "relic" || canDestroyRelic(1 - pi, s.li));   // honor relic protection
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
        emit("enemySupportDestroyed", pi, {});
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
      if (ctx.relic) { ctx.relic.counters = (ctx.relic.counters || 0) + 1; log(`${cardById(ctx.relic.cardId).name} gains a forge counter (${ctx.relic.counters}).`); }
      break;
    case "forgeCounterLane": {
      const lh = ctx.laneIdx != null ? heroAt({ pi, li: ctx.laneIdx }) : null;
      if (lh && lh.relics.length) { const r = lh.relics.sort((a, b) => (b.counters || 0) - (a.counters || 0))[0]; r.counters = (r.counters || 0) + 1; log(`${cardById(r.cardId).name} gains a forge counter (${r.counters}).`); }
      break;
    }
    case "grantNextHero":
      P.mods = P.mods || [];
      P.mods.push({ type: "nextHero", discount: op.discount || 0, buffAtk: op.buffAtk || 0, buffHp: op.buffHp || 0, realm: op.realm || null, life: op.life || "game", bornGt: G.gt });
      log(`${P.name}: your next ${op.realm ? op.realm + " " : ""}Hero${op.discount ? ` costs ${op.discount} less` : ""}${op.buffAtk || op.buffHp ? ` enters with +${op.buffAtk || 0}/+${op.buffHp || 0}` : ""}.`);
      break;
    case "grantRelicDiscountTurn":
      P.relicDiscountTurn = (P.relicDiscountTurn || 0) + op.discount;
      P.relicDiscountExpire = G.gt;
      log(`${P.name}: Relics you play this turn cost ${op.discount} less.`);
      break;
    case "pulseNextTurn":
      P.pulseOverrideGt = G.gt + 2;   // your next turn
      P.pulseOverrideAmt = op.amount;
      log(`${P.name}: next turn's base Pulse gain will be ${op.amount}.`);
      break;
    case "moveRelic": {
      const owned = [];
      G.players[pi].lanes.forEach((L, li) => { if (L.hero) L.hero.relics.forEach(r => owned.push({ li, r })); });
      const heroes = heroesOf(pi);
      if (!owned.length || heroes.length < 2) { log(`No Relic to move.`); break; }
      let pick = owned[0];
      if (!P.isAI) { const idx = promptPick("Move which Relic?", owned.map(o => `${cardById(o.r.cardId).name} (lane ${o.li + 1})`)); if (idx == null) break; pick = owned[idx]; }
      const relCard = cardById(pick.r.cardId);
      const dests = heroes.filter(t => t.li !== pick.li && (!C().relicRealmLocked || cardById(heroAt(t).cardId).realm === relCard.realm) && (C().relicSlotsPerHero - heroAt(t).relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0)) >= (relCard.slots || 1));
      if (!dests.length) { log(`No legal Hero to move ${relCard.name} to.`); break; }
      let dest = P.isAI ? dests.sort((a, b) => effAtk(pi, b.li) - effAtk(pi, a.li))[0] : (await UI.pickHero(`Move ${relCard.name} to which Hero?`, dests)) || dests[0];
      const from = G.players[pi].lanes[pick.li].hero;
      from.relics = from.relics.filter(r => r !== pick.r);
      heroAt(dest).relics.push(pick.r);
      log(`${P.name} re-forges ${relCard.name} onto ${cardById(heroAt(dest).cardId).name}.`, P.isAI ? "ai" : "");
      break;
    }
    case "attachRelic": {
      const relIdxs = P.hand.map((id, ix) => ({ id, ix })).filter(x => cardById(x.id).type === "relic");
      if (!relIdxs.length) { log(`No Relic in hand to attach.`); break; }
      let pickR = P.isAI ? relIdxs.sort((a, b) => cardById(b.id).cost - cardById(a.id).cost)[0] : relIdxs[(() => { const i = promptPick("Attach which Relic from your hand?", relIdxs.map(x => cardById(x.id).name)); return i == null ? -1 : i; })()];
      if (!pickR) break;
      const relCard = cardById(pickR.id);
      let heroesE = op.target === "laneHero" && ctx.laneIdx != null ? (heroAt({ pi, li: ctx.laneIdx }) ? [{ pi, li: ctx.laneIdx }] : [])
        : op.target === "lastChosen" ? (ctx.lastChosen && heroAt(ctx.lastChosen) ? [ctx.lastChosen] : [])
        : heroesOf(pi);
      heroesE = heroesE.filter(t => (!C().relicRealmLocked || cardById(heroAt(t).cardId).realm === relCard.realm) && (C().relicSlotsPerHero - heroAt(t).relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0)) >= (relCard.slots || 1));
      if (!heroesE.length) { log(`No legal Hero to attach ${relCard.name} to.`); break; }
      const cost = op.discount >= 99 ? 0 : Math.max(1, relCard.cost - op.discount);
      if (P.pulse < cost) { log(`Can't afford ${relCard.name}.`); break; }
      let dest = P.isAI ? heroesE.sort((a, b) => effAtk(pi, b.li) - effAtk(pi, a.li))[0] : (await UI.pickHero(`Attach ${relCard.name} to which Hero?`, heroesE)) || heroesE[0];
      P.pulse -= cost; P.hand.splice(pickR.ix, 1);
      const inst = { uid: uid(), cardId: relCard.id, counters: 0 };
      heroAt(dest).relics.push(inst);
      ctx.relic = inst;   // so a following "place N forge counters on it" targets this Relic
      log(`${P.name} attaches ${relCard.name} to ${cardById(heroAt(dest).cardId).name}${cost ? ` (${cost} Pulse)` : " for free"}.`, P.isAI ? "ai" : "");
      emit("playRelic", pi, {});
      break;
    }
    case "returnRelicDiscard": {
      if (!P.discard) P.discard = [];
      const relIdxs = P.discard.map((id, ix) => ({ id, ix })).filter(x => cardById(x.id).type === "relic");
      if (!relIdxs.length) { log(`No Relic in your discard pile.`); break; }
      let pickR = P.isAI ? relIdxs.sort((a, b) => cardById(b.id).cost - cardById(a.id).cost)[0] : relIdxs[(() => { const i = promptPick("Return which Relic from your discard pile?", relIdxs.map(x => cardById(x.id).name)); return i == null ? -1 : i; })()];
      if (!pickR) break;
      P.hand.push(pickR.id); P.discard.splice(pickR.ix, 1);
      log(`${P.name} returns ${cardById(pickR.id).name} from the discard pile to hand.`, P.isAI ? "ai" : "");
      break;
    }
    case "shatterRelics": {
      let destroyed = 0;
      for (let k = 0; k < op.n; k++) {
        const rels = [];
        heroesOf(1 - pi).forEach(t => heroAt(t).relics.forEach(r => rels.push({ t, r })));
        const avail = rels.filter(x => canDestroyRelic(1 - pi, x.t.li));
        if (!avail.length) break;
        let pick = avail.sort((a, b) => cardById(b.r.cardId).cost - cardById(a.r.cardId).cost)[0];
        if (!P.isAI) { const idx = promptPick(`Destroy which enemy Relic? (${k + 1} of ${op.n})`, avail.map(x => `${cardById(x.r.cardId).name} on ${cardById(heroAt(x.t).cardId).name}`)); if (idx == null) break; pick = avail[idx]; }
        const hero = heroAt(pick.t);
        hero.relics = hero.relics.filter(r => r !== pick.r);
        destroyed++;
        log(`${P.name} destroys ${cardById(pick.r.cardId).name}.`);
        emit("enemySupportDestroyed", pi, {});
        if (op.dmg) dealDamage(pick.t, op.dmg, { sourceName: ctx.sourceName });
      }
      if (!destroyed) log(`No enemy Relic could be destroyed.`);
      break;
    }
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
      let opts2 = [];
      G.players[1 - pi].lanes.forEach((L, li) => {
        if (L.hero) L.hero.relics.forEach(r => opts2.push({ kind: "relic", li, obj: r, label: `Relic ${cardById(r.cardId).name} (lane ${li + 1})` }));
        const seen = new Set();
        L.aux.forEach(a => { if (a && !seen.has(a.uid)) { seen.add(a.uid); opts2.push({ kind: "aux", li, obj: a, label: `Aux ${cardById(a.cardId).name} (lane ${li + 1})` }); } });
      });
      G.players[1 - pi].slots.forEach((s, si) => { if (s) opts2.push({ kind: "slot", si, label: `${s.kind}${s.faceDown ? " (face-down)" : ": " + cardById(s.cardId).name}` }); });
      opts2 = opts2.filter(o => o.kind !== "relic" || canDestroyRelic(1 - pi, o.li));   // honor relic protection
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
      if (pick.kind !== "slot") emit("enemySupportDestroyed", pi, {});
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
    case "jointStrike": {
      await initiateJointStrike(pi, { initiator: op.initiator, laneIdx: ctx.laneIdx });
      break;
    }
    case "breakLine": {
      P.breakLineTurn = G.gt;
      log(`${P.name}: this turn, your Heroes may attack any lane and the enemy can't prevent, block, or redirect.`);
      break;
    }
    case "knight": {
      let targets = await resolveTargets(op, pi, ctx);
      const t = targets[0];
      if (!t) { log(`No Hero to Knight.`); break; }
      knight(pi, t);
      if (op.buff) { heroAt(t).permAtk += op.buff.atk || 0; heroAt(t).permHp += op.buff.hp || 0; if (op.buff.atk || op.buff.hp) log(`${nameOf(t)} gains +${op.buff.atk || 0}/+${op.buff.hp || 0} permanently.`); }
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
  if (isSilenced(holder)) { if (!P.isAI) UI.toast("This Hero is silenced — its ability text is blank."); return; }
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

/* --------------------------- Relic protection --------------------------- */
function relicStaticProtected(ownerPi, li) {
  const hero = G.players[ownerPi].lanes[li].hero;
  if (!hero) return false;
  const f = fx(hero.cardId).flags || {};
  if (f.relicProtect === "self") return true;
  if (f.relicProtect === "selfIfTwoRelics" && hero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0) >= 2) return true;
  const lanes = G.players[ownerPi].lanes;
  for (let l2 = 0; l2 < lanes.length; l2++) {
    if (!lanes[l2].hero) continue;
    const seen = new Set();
    for (const a of lanes[l2].aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const af = fx(a.cardId).auxFlags || {};
      if (af.relicProtect === "neighbor" && Math.abs(l2 - li) === 1) return true;
      if (af.relicProtect === "self" && l2 === li) return true;
    }
  }
  return false;
}
// May an enemy effect destroy the Relic on ownerPi's Hero at li? Consumes an Anvil Ward hex if present.
function canDestroyRelic(ownerPi, li) {
  if (relicStaticProtected(ownerPi, li)) { log(`That Relic can't be destroyed (protected).`); return false; }
  const P = G.players[ownerPi];
  for (let si = 0; si < P.slots.length; si++) {
    const s = P.slots[si];
    if (s && s.kind === "hex" && fx(s.cardId).relicWard) { P.slots[si] = null; log(`${P.name}'s ${cardById(s.cardId).name} prevents the Relic's destruction!`, P.isAI ? "ai" : ""); return false; }
  }
  return true;
}

/* ------------------------------ Champion ------------------------------ */
function isChampion(pos) {
  const h = heroAt(pos);
  return !!(h && G.players[pos.pi].championUid === h.uid);
}
function championPos(pi) {
  const u = G.players[pi].championUid;
  if (!u) return null;
  for (let li = 0; li < G.players[pi].lanes.length; li++) {
    const h = G.players[pi].lanes[li].hero;
    if (h && h.uid === u) return { pi, li };
  }
  return null;
}
function knight(pi, pos) {
  if (!heroAt(pos)) return;
  G.players[pi].championUid = heroAt(pos).uid;
  log(`${G.players[pi].name} Knights ${cardById(heroAt(pos).cardId).name} as their Champion.`, G.players[pi].isAI ? "ai" : "");
}

async function resolveTargets(op, pi, ctx) {
  // enemy Heroes protected by "cannot be targeted by enemy card effects" are skipped
  const enemies = heroesOf(1 - pi).filter(t => !isUntargetable(t)), own = heroesOf(pi);
  const P = G.players[pi];
  const strongest = (list) => list.sort((a, b) => effAtk(b.pi, b.li) - effAtk(a.pi, a.li))[0];
  switch (op.target) {
    case "laneHero": return ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx }) ? [{ pi, li: ctx.laneIdx }] : [];
    case "attacker": return ctx.attacker ? [ctx.attacker] : [];
    case "defender": return ctx.defender ? [ctx.defender] : [];
    case "killer": return ctx.killer && heroAt(ctx.killer) ? [ctx.killer] : [];
    case "played": return ctx.played ? [ctx.played] : [];
    case "allEnemy": return enemies;
    case "champion": { const cp = championPos(pi); return cp ? [cp] : []; }
    case "self": return ctx.laneIdx != null && heroAt({ pi, li: ctx.laneIdx }) ? [{ pi, li: ctx.laneIdx }] : [];
    case "lastChosen": return ctx.lastChosen && heroAt(ctx.lastChosen) ? [ctx.lastChosen] : [];
    case "onslaughtAttackers": return (ctx.onslaughtAttackers || []).filter(t => heroAt(t));
    case "victor": return ctx.victor && heroAt(ctx.victor) ? [ctx.victor] : [];
    case "allOwn": return own.filter(t => {
      const r = cardById(heroAt(t).cardId).realm;
      if (op.neighborCond && !own.some(o => o.li !== t.li && Math.abs(o.li - t.li) === 1)) return false;
      if (op.relicOnly && heroAt(t).relics.length === 0) return false;
      if (op.realmFilter) return r.toLowerCase() === op.realmFilter.toLowerCase();
      if (op.otherThan) return r.toLowerCase() !== op.otherThan.toLowerCase();
      return true;
    });
    case "allOwnOther": return own.filter(t => t.li !== ctx.laneIdx);
    case "opposingEnemy": {
      const o = { pi: 1 - pi, li: ctx.laneIdx };
      return ctx.laneIdx != null && heroAt(o) ? [o] : [];
    }
    case "enemyChoice": {
      if (!enemies.length) return [];
      const r = P.isAI ? [strongest(enemies)] : [await UI.pickHero("Choose an enemy Hero", enemies)].filter(Boolean);
      if (op.storeChosen && r.length) ctx.lastChosen = r[0];
      return r;
    }
    case "ownChoice": {
      if (!own.length) return [];
      let r;
      if (P.isAI) r = [op.op === "heal" ? own.sort((a, b) => heroAt(b).dmg - heroAt(a).dmg)[0] : strongest(own)];
      else r = [await UI.pickHero("Choose one of your Heroes", own)].filter(Boolean);
      if (op.storeChosen && r.length) ctx.lastChosen = r[0];
      return r;
    }
    case "anyChoice": {
      const all = enemies.concat(own);
      if (!all.length) return [];
      const r = P.isAI ? [strongest(enemies.length ? enemies : own)] : [await UI.pickHero("Choose any Hero", all)].filter(Boolean);
      if (op.storeChosen && r.length) ctx.lastChosen = r[0];
      return r;
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
    const lis = isSilenced(h) ? [] : (fx(h.cardId).listen || []);
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

// Event-counter Rites gain a counter (max 1 per turn) when their event fires.
function tickRites(pi, event) {
  const P = G.players[pi];
  for (let si = 0; si < P.slots.length; si++) {
    const s = P.slots[si];
    if (!s || s.kind !== "rite") continue;
    const r = fx(s.cardId).rite;
    if (!r || !r.counterMax || r.event !== event) continue;
    s.tickedTurn = s.tickedTurn || {};
    if (s.tickedTurn[G.gt]) continue;       // maximum 1 counter per turn
    s.tickedTurn[G.gt] = true;
    s.counters++;
    log(`${P.name}'s Rite "${cardById(s.cardId).name}" gains a counter (${s.counters}/${r.counterMax}).`, P.isAI ? "ai" : "");
    if (s.counters >= r.counterMax) resolveRite(pi, si, "payoff");
  }
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
  // a bodyguard may soak half of incoming combat damage (rounded to nearest 10)
  if (opts.combat && !opts.noBodyguard) {
    const bg = findBodyguard(t.pi, t);
    if (bg) {
      const half = Math.round(amount / 2 / 10) * 10;
      const P = G.players[t.pi];
      let doIt = half > 0 && (!bg.src.optional || (P.isAI ? curHp(bg.pos.pi, bg.pos.li) > half : confirm(`Have ${cardById(heroAt(bg.pos).cardId).name} take ${half} of the ${amount} combat damage? (${bg.name})`)));
      if (doIt) {
        if (bg.src.oncePerTurn) bg.holder.bgTurn = G.gt;
        log(`${bg.name}: ${cardById(heroAt(bg.pos).cardId).name} soaks ${half} of the damage.`);
        dealDamage(bg.pos, half, { combat: true, noBodyguard: true, sourceName: "bodyguard" });
        amount -= half;
        if (amount <= 0) return 0;
      }
    }
  }
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
  const od = isSilenced(h) ? null : fx(h.cardId).onDamaged;
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
    fireHexes(t.pi, "tookDamage", { laneIdx: t.li, defender: t });
    // Vesk aux: first enemy damage each turn heals the lane Hero
    G.players[1 - t.pi].lanes.forEach((L, li) => { const seen4 = new Set(); for (const a of L.aux) if (a && !seen4.has(a.uid)) { seen4.add(a.uid); const mm = (cardById(a.cardId).auxText || "").match(/the first time each turn an enemy Hero takes damage, the Hero in this lane heals (\d+) Health/i); if (mm && L.hero && a.vGt !== G.gt) { a.vGt = G.gt; const hd = Math.min(L.hero.dmg, +mm[1]); L.hero.dmg -= hd; if (hd) log(`${cardById(L.hero.cardId).name} heals ${hd} (${cardById(a.cardId).name}).`); } } });
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
  // death replacement (Rune of Recall): return to hand instead of dying
  for (let si = 0; si < P.slots.length; si++) {
    const sl = P.slots[si];
    if (sl && sl.kind === "hex" && sl.faceDown && sl.laneIdx === li && fx(sl.cardId).deathReplace) {
      const hexCard = cardById(sl.cardId);
      if (P.pulse >= hexCard.cost && (P.isAI || confirm(`${hexCard.name}: pay ${hexCard.cost} Pulse to return ${c.name} to your hand instead of it dying?`))) {
        P.pulse -= hexCard.cost;
        P.slots[si] = null;
        P.lanes[li].hero = null;
        if (P.championUid === h.uid) P.championUid = null;
        P.hand.push(c.id);
        log(`${hexCard.name}: ${c.name} returns to ${P.name}'s hand${h.relics.length ? " (its Relics are destroyed)" : ""}.`, P.isAI ? "ai" : "");
        return;
      }
    }
  }
  G.deathGt = G.deathGt || {}; G.deathGt[pi] = G.gt;
  P.lanes[li].hero = null;
  if (P.championUid === h.uid) P.championUid = null;   // Champion status ends with the Hero
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
  fireHexes(pi, "friendlyDiedAny", {});
  for (let p = 0; p < 2; p++) {
    for (const t of heroesOf(p)) {
      const f = fx(heroAt(t).cardId);
      if (p !== pi && f.onEnemyDeath) runOp({ op: "pulse", n: f.onEnemyDeath.pulse }, p, { sourceName: cardById(heroAt(t).cardId).name });
      if (p === pi && f.onFriendlyDeath) runOp({ op: "pulse", n: f.onFriendlyDeath.pulse }, p, { sourceName: cardById(heroAt(t).cardId).name });
    }
  }
  emit("friendlyDied", pi, {});
  emit("enemyDied", 1 - pi, {});
  tickRites(1 - pi, "enemyDestroyed");
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
    if (event === "attackLane" && f.hexNeighborLane) { if (Math.abs(s.laneIdx - ctx.laneIdx) !== 1) continue; }
    else if ((event === "attackLane" || event === "laneHeroDied" || event === "postCombat" || event === "ownAttack" || event === "oppEndTurn" || event === "tookDamage") && ctx.laneIdx != null && s.laneIdx !== ctx.laneIdx) continue;
    if (event === "postCombat" && f.hexNeedsDamage && !ctx.defenderTookDamage) continue;
    if (f.hexLaneScoped && ctx.laneIdx != null && s.laneIdx !== ctx.laneIdx) continue;
    if (f.hexTrig.persistent && /first time each turn/i.test(cardById(s.cardId).text)) { s.fireGt = s.fireGt || {}; if (s.fireGt[G.gt]) continue; s.fireGt[G.gt] = true; }
    const card = cardById(s.cardId);
    let hexCost = card.cost;   // opponent's Mother Vhûl aux taxes your Hexes
    G.players[1 - ownerPi].lanes.forEach(L => { const seen = new Set(); for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); const m = (cardById(a.cardId).auxText || "").match(/your opponent's Hexes cost (\d+) additional Pulse/i); if (m) hexCost += +m[1]; } });
    if (P.pulse < hexCost) { log(`${P.name}'s Hex "${card.name}" cannot be paid for — it fizzles.`); P.slots[si] = null; continue; }
    let pay = true;
    if (!P.isAI) pay = confirm(`Your Hex "${card.name}" triggered!\n\n${card.text}\n\nPay ${hexCost} Pulse to resolve it? (Cancel = fizzle)`);
    if (!pay) { log(`Your Hex "${card.name}" fizzles (declined).`); P.slots[si] = null; continue; }
    P.pulse -= hexCost;
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
      else if (op.op === "combatDefMatch" && ctx.combat) ctx.combat.defMatch = true;
      else if (op.op === "combatAtkBare" && ctx.combat) ctx.combat.atkBare = true;
      else if (op.op === "combatDefAtk" && op.ifAttackerWounded && ctx.combat) { const ah = heroAt(ctx.attacker); if (ah && ah.dmg > 0) ctx.combat.defAtkMod = (ctx.combat.defAtkMod || 0) + op.n; }
      else if (op.op === "joinDefense" && ctx.combat && ctx.defender) {
        const others = heroesOf(ownerPi).filter(t => t.li !== ctx.defender.li);
        if (others.length) {
          let helper = P.isAI ? others.sort((a, b) => effAtk(ownerPi, b.li) - effAtk(ownerPi, a.li))[0] : (await UI.pickHero("Which Hero joins the defense (adds half its Attack)?", others)) || others[0];
          const add = Math.round(effAtk(ownerPi, helper.li) / 2 / 10) * 10;
          ctx.combat.defAtkMod = (ctx.combat.defAtkMod || 0) + add;
          log(`${cardById(heroAt(helper).cardId).name} joins the defense (+${add} Attack).`);
        }
      }
      else if (op.op === "stripAttackerRelics" && ctx.attacker) {
        const ah = heroAt(ctx.attacker);
        if (ah && ah.relics.length && canDestroyRelic(ctx.attacker.pi, ctx.attacker.li)) {
          if (op.all) { log(`All of ${cardById(ah.cardId).name}'s Relics are destroyed!`); ah.relics = []; }
          else { const r = ah.relics.sort((a, b) => cardById(b.cardId).cost - cardById(a.cardId).cost)[0]; ah.relics = ah.relics.filter(x => x !== r); log(`${cardById(r.cardId).name} is destroyed.`); }
        }
      }
      else if (op.op === "destroyPlayedSupport" && ctx.playedSupport) {
        const ps = ctx.playedSupport;
        if (ps.kind === "relic") { const h2 = heroAt({ pi: ps.tpi, li: ps.li }); if (h2 && canDestroyRelic(ps.tpi, ps.li)) { h2.relics = h2.relics.filter(r => r.uid !== ps.uid); log(`The freshly played Relic is destroyed!`); } }
        else { removeAux(ps.tpi, ps.li, ps.uid); log(`The freshly played Auxiliary is destroyed!`); }
      }
      else if (op.op === "negate" && ctx.negate) ctx.negate.negated = true;
      else if (op.op === "combatDefBare" && ctx.combat) ctx.combat.defBare = true;
      else if (op.op === "counterAttack" && ctx.defender && ctx.attacker) { if (heroAt(ctx.defender) && heroAt(ctx.attacker)) await miniCombat(ctx.defender, ctx.attacker, 0); }
      else if (op.op === "counterJoint" && ctx.defender && ctx.attacker) {
        const dpi2 = ctx.defender.pi;
        const nb = heroesOf(dpi2).find(x => Math.abs(x.li - ctx.defender.li) === 1);
        if (heroAt(ctx.attacker)) { if (nb) await jointStrike(dpi2, [ctx.defender.li, nb.li].sort((a, b) => a - b), { pi: ctx.attacker.pi, li: ctx.attacker.li }); else await miniCombat(ctx.defender, ctx.attacker, 0); }
      }
      else if (op.op === "hungeringDark") {
        const foe = { pi: 1 - ownerPi, li: s.laneIdx };
        const mine = { pi: ownerPi, li: s.laneIdx };
        const fh = heroAt(foe);
        if (fh && fh.dmg > 0) {
          fh.redHp += op.red;
          log(`${cardById(fh.cardId).name} loses ${op.red} Health (The Hungering Dark).`);
          if (effMaxHp(foe.pi, foe.li) <= fh.dmg || effMaxHp(foe.pi, foe.li) <= 0) destroyHero(foe.pi, foe.li, null, { noOverkill: true });
          if (heroAt(mine)) { heroAt(mine).permAtk += op.buff; log(`${cardById(heroAt(mine).cardId).name} gains +${op.buff} Attack.`); }
        }
      }
      else if (op.op === "removeReductions" && op.target === "reducedHero" && ctx.reducedAt) { await runOp({ op: "removeReductions", target: "lastChosen" }, ownerPi, { lastChosen: ctx.reducedAt, sourceName: card.name }); }
      else if (op.op === "redirectToAlly" && ctx.combat && ctx.attacker) {
        // send the attacker at its own ally (another Hero the attacker controls)
        const api = ctx.attacker.pi;
        const allies = heroesOf(api).filter(a => a.li !== ctx.attacker.li);
        if (allies.length) {
          const pick = G.players[ownerPi].isAI ? allies.sort((a, b) => effAtk(api, b.li) - effAtk(api, a.li))[0] : (await UI.pickHero("Redirect the attacker at which of its allies?", allies)) || allies[0];
          ctx.combat.redirectDefender = pick;
          log(`${G.players[ownerPi].name}'s Whispered Treason turns the attacker against ${cardById(heroAt(pick).cardId).name}!`, G.players[ownerPi].isAI ? "ai" : "");
        }
      }
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

// Net Hero cost: static reductions (Josselin), opponent increases (Nharessa),
// and a matching pending "next Hero" discount. Does not consume the pending mod.
function heroCostOf(pi, card) {
  let cost = card.cost;
  const first = (G.players[pi].heroesPlayedTurn || 0) === 0;
  if (first) for (const pos of heroesOf(pi)) if (/the first Hero you play each turn costs 1 less Pulse/i.test(cardById(heroAt(pos).cardId).text || "")) { cost -= 1; break; }
  if (first) { // opponent's Nharessa-aux taxes your first Hero
    let tax = 0;
    G.players[1 - pi].lanes.forEach(L => { const seen = new Set(); for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); if (/the first Hero your opponent plays each turn costs them 1 additional Pulse/i.test(cardById(a.cardId).auxText || "")) tax += 1; } });
    cost += tax;
  }
  const mod = pendingHeroMod(pi, card);
  if (mod) cost -= mod.discount;
  return Math.max(1, cost);
}
function pendingHeroMod(pi, card) {
  return (G.players[pi].mods || []).find(m => m.type === "nextHero" && (!m.realm || m.realm.toLowerCase() === card.realm.toLowerCase()));
}

async function playHero(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  const mod = pendingHeroMod(pi, card);
  P.pulse -= heroCostOf(pi, card);
  P.hand.splice(handIdx, 1);
  P.lanes[laneIdx].hero = heroInst(card.id);
  if (mod) { const h = P.lanes[laneIdx].hero; h.permAtk += mod.buffAtk || 0; h.permHp += mod.buffHp || 0; P.mods = P.mods.filter(x => x !== mod); if (mod.buffAtk || mod.buffHp) log(`${card.name} enters with +${mod.buffAtk || 0}/+${mod.buffHp || 0}.`); }
  P.heroesPlayedTurn = (P.heroesPlayedTurn || 0) + 1;
  log(`${P.name} plays ${card.name} (${card.atk}/${card.hp}) in lane ${laneIdx + 1} (${card.realm}).`, P.isAI ? "ai" : "");
  // opponent "when your opponent plays a Hero" hexes
  await fireHexes(1 - pi, "oppHeroPlayed", { played: { pi, li: laneIdx } });
  // opponent Heroes/Auxes: "whenever your opponent plays a Hero, it enters with -X/-Y"
  {
    const played = P.lanes[laneIdx].hero;
    if (played) {
      const applyRed = (txt) => {
        const tt = norm(txt || "");
        if (!/whenever your opponent plays a Hero/i.test(tt)) return;
        const mm = tt.match(/enters play with -(\d+) Attack(?: and -(\d+) Health)? permanently/i);
        if (mm) { played.redAtk += +mm[1]; played.redHp += +(mm[2] || 0); log(`${card.name} enters play weakened (-${mm[1]} Attack${mm[2] ? ", -" + mm[2] + " Health" : ""}).`); }
      };
      for (const t of heroesOf(1 - pi)) { const eh = heroAt(t); if (!isSilenced(eh)) applyRed(cardById(eh.cardId).text); }
      G.players[1 - pi].lanes.forEach(L => { const seen5 = new Set(); for (const a of L.aux) if (a && !seen5.has(a.uid)) { seen5.add(a.uid); applyRed(cardById(a.cardId).auxText); } });
    }
  }
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
  await fireHexes(1 - pi, "oppSupportPlayed", { playedSupport: { kind: "aux", tpi: pi, li: laneIdx, uid: inst.uid } });
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

// Total Relic-cost reduction the player currently has in play (Boldur aux, Mardis).
function relicCostReduction(pi) {
  let r = 0;
  for (const pos of heroesOf(pi)) { const m = (cardById(heroAt(pos).cardId).text || "").match(/your Relics cost (\d+) less Pulse/i); if (m) r += +m[1]; }
  G.players[pi].lanes.forEach(L => { const seen = new Set(); for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); const m = (cardById(a.cardId).auxText || "").match(/Relics you play cost (\d+) less Pulse/i); if (m) r += +m[1]; } });
  const P = G.players[pi];
  if (P.relicDiscountExpire === G.gt) r += P.relicDiscountTurn || 0;   // Masterwork "this turn"
  return r;
}
function relicCostOf(pi, card) { return Math.max(1, card.cost - relicCostReduction(pi)); }
// Incantation cost: Ostrellan aux ("your Incantations cost 1 less Pulse").
function spellCostOf(pi, card) {
  let cost = card.cost;
  if (card.type === "incantation") G.players[pi].lanes.forEach(L => { const seen = new Set(); for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); const m = (cardById(a.cardId).auxText || "").match(/your Incantations cost (\d+) less Pulse/i); if (m) cost -= +m[1]; } });
  return Math.max(1, cost);
}

function playRelic(pi, handIdx, laneIdx) {
  const P = G.players[pi];
  const card = cardById(P.hand[handIdx]);
  P.pulse -= relicCostOf(pi, card);
  P.hand.splice(handIdx, 1);
  const rinst = { uid: uid(), cardId: card.id, counters: 0 };
  P.lanes[laneIdx].hero.relics.push(rinst);
  log(`${P.name} equips ${card.name} to ${cardById(P.lanes[laneIdx].hero.cardId).name}.`, P.isAI ? "ai" : "");
  emit("playRelic", pi, {});
  fireHexes(1 - pi, "oppSupportPlayed", { playedSupport: { kind: "relic", tpi: pi, li: laneIdx, uid: rinst.uid } });
  const oe = fx(card.id).onEquip;
  if (oe) { const ctx = { laneIdx, sourceName: card.name }; for (const op of oe) runOp(op, pi, ctx); }
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
  P.pulse -= spellCostOf(pi, card);
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
  if (card.type === "incantation") {
    emit("castIncantation", pi, {});
    // Ostrellan: pay 2 Pulse to resolve the Incantation a second time (once per turn)
    if (ops && ops !== "manual" && P.recastGt !== G.gt) {
      const ost = heroesOf(pi).find(t => !isSilenced(heroAt(t)) && /whenever you cast an Incantation, you may pay (\d+) Pulse to resolve that Incantation's effect a second time/i.test(cardById(heroAt(t).cardId).text || ""));
      if (ost) {
        const rc = +(cardById(heroAt(ost).cardId).text.match(/pay (\d+) Pulse/i)[1]);
        if (P.pulse >= rc && (P.isAI ? P.pulse >= rc + 2 : confirm(`${cardById(heroAt(ost).cardId).name}: pay ${rc} Pulse to resolve ${card.name} a second time?`))) {
          P.pulse -= rc; P.recastGt = G.gt;
          log(`${cardById(heroAt(ost).cardId).name} echoes ${card.name}!`, P.isAI ? "ai" : "");
          const ctx2 = { sourceName: card.name + " (echo)" };
          for (const op of ops) { if (ctx2.abort) break; await runOp(op, pi, ctx2); }
        }
      }
    }
  }
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
        if (!laneUnlocked(pi, li) || L.sealedUntil > G.gt) return;
        if (L.realm === card.realm && !L.hero && P.pulse >= heroCostOf(pi, card)) opts.heroLanes.push(li);
        const freeAux = L.aux.filter(a => !a).length;
        if (L.realm === card.realm && freeAux >= (card.auxSlots || 1) && P.pulse >= opts.auxCost) opts.auxLanes.push(li);
      });
    }
  } else if (card.type === "relic") {
    P.lanes.forEach((L, li) => {
      if (!L.hero || !laneUnlocked(pi, li) || L.sealedUntil > G.gt) return;
      { const foe = G.players[1 - pi].lanes[li].hero; if (foe && !isSilenced(foe) && /your opponent cannot attach Relics to the Hero in the opposing lane/i.test(cardById(foe.cardId).text || "")) return; }
      if (C().relicRealmLocked && cardById(L.hero.cardId).realm !== card.realm) return;
      const used = L.hero.relics.reduce((s, r) => s + (cardById(r.cardId).slots || 1), 0);
      if (C().relicSlotsPerHero - used >= (card.slots || 1) && P.pulse >= relicCostOf(pi, card)) opts.relicLanes.push(li);
    });
  } else if (card.type === "hex") {
    if (openSlotIdx(pi) >= 0) P.lanes.forEach((L, li) => { if (laneUnlocked(pi, li)) opts.hexLanes.push(li); });
  } else if (card.type === "rite") {
    if (openSlotIdx(pi) >= 0 && P.pulse >= card.cost) P.lanes.forEach((L, li) => { if (laneUnlocked(pi, li)) opts.riteLanes.push(li); });
  } else {
    opts.spell = openSlotIdx(pi) >= 0 && P.pulse >= spellCostOf(pi, card);
  }
  return opts;
}

/* ------------------------------ combat ------------------------------ */

// Silenced Heroes have blank ability text: their card's compiled effects are off.
function isSilenced(h) { return !!(h && h.silencedUntil && h.silencedUntil > G.gt); }

function heroFlag(pos, flag) {
  const h = heroAt(pos);
  if (!h) return false;
  const f = isSilenced(h) ? null : fx(h.cardId).flags;
  if (f && f[flag]) return true;
  for (const r of h.relics) { const rf = fx(r.cardId).flags; if (rf && rf[flag]) return true; }
  if (flag === "attackAnyLane" && (h.grantAnyLane === true || h.grantAnyLane >= G.gt || G.players[pos.pi].breakLineTurn === G.gt)) return true;
  return false;
}
// Is this Hero currently protected (cannot be attacked / targeted by enemy effects)?
function isProtected(pos) {
  const h = heroAt(pos);
  if (!h) return false;
  if (h.protectedUntil && h.protectedUntil > G.gt) return true;   // temp protection (pacts/incantations)
  const f = isSilenced(h) ? null : fx(h.cardId).flags;
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
// Morgruth aux: "the enemy Hero in the lane opposing this one cannot be healed"
function cannotBeHealed(t) {
  let blocked = false;
  const L2 = G.players[1 - t.pi].lanes[t.li];
  if (L2) { const seen = new Set(); for (const a of L2.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); if (/the enemy Hero in the lane opposing this one cannot be healed/i.test(cardById(a.cardId).auxText || "")) blocked = true; } }
  return blocked;
}
// Untargetable by enemy card effects (protection, or an untargetable flag from card/Relic)
function isUntargetable(pos) { return isProtected(pos) || heroFlag(pos, "untargetable"); }
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
  // Bargain of Broken Wills: no redirecting this turn — opposing lane only
  if (G.players[pi].noRedirectTurn === G.gt) {
    const opp = attackerLis.length === 1 ? { pi: O, li: attackerLis[0] } : null;
    return { heroes: opp && heroAt(opp) && targetable.some(t => t.li === opp.li) ? [opp] : [], face: false };
  }
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
    if (!isSilenced(actor)) for (const tr of (fx(actor.cardId).combatTrig || [])) if (tr.scope === "self" || tr.scope === "selfFirst") list.push({ tr, src: cardById(actor.cardId).name });
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
    else if (op.kind === "destroyTargetRelic") { const tg = heroAt({ pi: targetPi, li: targetLi }); if (tg && tg.relics.length && canDestroyRelic(targetPi, targetLi)) { const r = tg.relics.sort((a, b) => cardById(b.cardId).cost - cardById(a.cardId).cost)[0]; tg.relics = tg.relics.filter(x => x !== r); log(`${src} destroys ${cardById(r.cardId).name}!`); } }
  }
  // Veni Vidi Vici: reward if the blessed Hero got a kill this turn
  if (event === "kill" && actor && actor.vvvGt === G.gt && actor.vvvReward) {
    const r = actor.vvvReward; actor.vvvReward = null;
    actor.permAtk += r.atk; actor.permHp += r.hp;
    gainPulse(actorPi, r.pulse, "Veni Vidi Vici");
    log(`${cardById(actor.cardId).name} is victorious — +${r.atk}/+${r.hp} permanently!`);
  }
  if (event === "kill") { emit("enemyKilledByYourHero", actorPi, {}); tickRites(actorPi, "kill"); await fireHexes(actorPi, "friendlyKill", { laneIdx: actorLi, victor: { pi: actorPi, li: actorLi } }); }
}

// Aux- and state-based combat modifiers applied after Hexes, before stats.
function applyCombatAuxMods(pi, attackerLis, dLi, combat, defenderPos) {
  const dpi = 1 - pi;
  const defHero2 = heroAt(defenderPos);
  // defender-side auxes
  G.players[dpi].lanes.forEach((L, li) => {
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const at = cardById(a.cardId).auxText || "";
      let mm;
      if (li === dLi && (mm = at.match(/enemy Heroes attacking this lane have [-−–](\d+) Attack during that combat/i))) combat.atkMod -= +mm[1];
      if ((mm = at.match(/whenever any enemy Hero declares an attack, it gets [-−–](\d+) Attack and the defending Hero you control gains \+(\d+) Attack, for that combat only/i))) { combat.atkMod -= +mm[1]; combat.defAtkMod = (combat.defAtkMod || 0) + +mm[2]; }
      if ((mm = at.match(/when any Hero you control would take combat damage, if a Hero you control occupies a lane neighboring it, prevent (\d+)/i))) { if (heroesOf(dpi).some(o => o.li !== dLi && Math.abs(o.li - dLi) === 1)) combat.prevent = (combat.prevent || 0) + +mm[1]; }
      if (li === dLi && (mm = at.match(/the Hero in this lane takes (\d+) less combat damage while a Hero you control occupies a neighboring lane/i))) { if (heroesOf(dpi).some(o => o.li !== dLi && Math.abs(o.li - dLi) === 1)) combat.prevent = (combat.prevent || 0) + +mm[1]; }
      if ((mm = at.match(/the Hero in this lane and Heroes you control in neighboring lanes take (\d+) less combat damage/i))) { if (Math.abs(li - dLi) <= 1) combat.prevent = (combat.prevent || 0) + +mm[1]; }
    }
  });
  // attacker-side auxes + army states + hero temp-hunt flags
  const A = G.players[pi];
  if (A.armyInitUntil >= G.gt && A.armyInitBonus) combat.atkMod += A.armyInitBonus;
  if (A.armyBareUntil >= G.gt) combat.defBare = true;
  for (const ali of attackerLis) { const ah = heroAt({ pi, li: ali }); if (ah && ah.huntUntil >= G.gt) combat.defBare = true; }
  G.players[pi].lanes.forEach((L, li) => {
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const at = cardById(a.cardId).auxText || "";
      let mm;
      if ((mm = at.match(/Heroes you control have \+(\d+) Attack while fighting enemy Heroes below their maximum Health/i))) { if (defHero2 && defHero2.dmg > 0) combat.atkMod += +mm[1]; }
      if ((mm = at.match(/when Heroes you control in neighboring lanes fight, the enemy Hero's Relics and Auxiliary cards grant it no Attack or Health/i))) { if (attackerLis.some(ali => Math.abs(ali - li) === 1)) combat.defBare = true; }
    }
  });
}

// A one-off 1v1 exchange outside the normal attack flow (counterattacks, duels,
// Corvyn follow-through). Standard rules: lower Attack takes the difference.
async function miniCombat(aPos, dPos, atkBonus) {
  const a = heroAt(aPos), d = heroAt(dPos);
  if (!a || !d) return;
  const aAtk = effAtk(aPos.pi, aPos.li) + (atkBonus || 0);
  const dAtk = effAtk(dPos.pi, dPos.li);
  log(`${cardById(a.cardId).name} (${aAtk}) strikes ${cardById(d.cardId).name} (${dAtk})!`);
  if (aAtk > dAtk) {
    const there = heroAt(dPos);
    dealDamage(dPos, aAtk - dAtk, { combat: true, killer: aPos, sourceName: "counterattack" });
    await fireCombat("dealDamage", aPos.pi, aPos.li, dPos.pi, dPos.li);
    if (there && !heroAt(dPos)) await fireCombat("kill", aPos.pi, aPos.li, dPos.pi, dPos.li);
  } else if (dAtk > aAtk) {
    dealDamage(aPos, dAtk - aAtk, { combat: true, killer: dPos, sourceName: "counterattack" });
  } else log(`Evenly matched — no damage.`);
  checkWin();
}

// After one of sourcePi's card effects reduces an enemy Hero's stats:
// target side may cleanse (Rite of Undoing), source side may heal (Lasziel aux).
function postStatReduce(sourcePi, targetPos) {
  fireHexes(targetPos.pi, "statReduced", { reducedAt: targetPos });
  G.players[sourcePi].lanes.forEach((L, li) => {
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const at = cardById(a.cardId).auxText || "";
      const mm = at.match(/whenever an enemy Hero's Health is reduced by one of your card effects, the Hero in this lane heals (\d+) Health/i);
      if (mm && L.hero && a.lasGt !== G.gt) { a.lasGt = G.gt; const hd = Math.min(L.hero.dmg, +mm[1]); L.hero.dmg -= hd; if (hd) log(`${cardById(L.hero.cardId).name} heals ${hd} (${cardById(a.cardId).name}).`); }
    }
  });
}

// Gather defender-side redirect sources for player dpi (Heroes, their Relics,
// Auxes [protector = lane Hero], and face-down Hexes [protector = lane Hero]).
function redirectSourcesFor(dpi) {
  const out = [];
  for (const pos of heroesOf(dpi)) {
    const h = heroAt(pos), f = fx(h.cardId);
    if (f.redirect) out.push({ src: f.redirect, pos, holder: h, name: cardById(h.cardId).name });
    for (const r of h.relics) { const rf = fx(r.cardId); if (rf.redirect) out.push({ src: rf.redirect, pos, holder: r, name: cardById(r.cardId).name }); }
  }
  G.players[dpi].lanes.forEach((L, li) => {
    if (!L.hero) return;
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) { seen.add(a.uid); const af = fx(a.cardId); if (af.auxRedirect) out.push({ src: af.auxRedirect, pos: { pi: dpi, li }, holder: a, name: cardById(a.cardId).name }); }
  });
  G.players[dpi].slots.forEach((s, si) => {
    if (s && s.kind === "hex") { const hf = fx(s.cardId); const lh = G.players[dpi].lanes[s.laneIdx] && G.players[dpi].lanes[s.laneIdx].hero; if (hf.hexRedirect && lh) out.push({ src: hf.hexRedirect, pos: { pi: dpi, li: s.laneIdx }, holder: s, name: cardById(s.cardId).name, hexSlot: si, hexCard: cardById(s.cardId) }); }
  });
  return out;
}
function redirectDisabled(attackerPi) { return G.players[attackerPi].breakLineTurn === G.gt; }

// Before a single-attacker combat resolves, the defending player may pull the
// attack onto a protector Hero (Tessio, Corvazzo, Escort Detail, Colossus, ...).
async function defensiveRedirect(attackerPi, ctx) {
  if (redirectDisabled(attackerPi)) return;
  const dpi = 1 - attackerPi, dLi = ctx.defender.li, P = G.players[dpi];
  const cands = redirectSourcesFor(dpi).filter(s =>
    s.pos.li !== dLi && !isProtected(s.pos) &&
    (s.src.applies !== "neighbor" || Math.abs(s.pos.li - dLi) === 1) &&
    P.pulse >= (s.src.cost || 0) &&
    !(s.src.oncePerTurn && s.holder.redirTurn === G.gt));
  for (const s of cands) {
    let doIt;
    if (!s.src.optional) doIt = true;
    else if (P.isAI) doIt = curHp(s.pos.pi, s.pos.li) > curHp(dpi, dLi) && (s.src.cost <= 2 || P.pulse >= s.src.cost + 2);
    else doIt = confirm(`Redirect the attack onto ${cardById(heroAt(s.pos).cardId).name}? (${s.name}${s.src.cost ? `, pay ${s.src.cost} Pulse` : ""})`);
    if (!doIt) continue;
    if (s.src.cost) P.pulse -= s.src.cost;
    if (s.src.oncePerTurn) s.holder.redirTurn = G.gt;
    if (s.hexSlot != null) P.slots[s.hexSlot] = null;   // one-shot Hex consumed
    log(`${P.name} redirects the attack onto ${cardById(heroAt(s.pos).cardId).name} (${s.name}).`, P.isAI ? "ai" : "");
    emit("attackDeflected", dpi, {});
    ctx.defender = { pi: dpi, li: s.pos.li };
    return;
  }
}

// Find a bodyguard willing to soak half the combat damage aimed at targetPos.
function findBodyguard(dpi, targetPos) {
  const list = [];
  for (const pos of heroesOf(dpi)) {
    const h = heroAt(pos), f = fx(h.cardId);
    if (f.bodyguard) list.push({ src: f.bodyguard, pos, holder: h, name: cardById(h.cardId).name });
    for (const r of h.relics) { const rf = fx(r.cardId); if (rf.bodyguard) list.push({ src: rf.bodyguard, pos, holder: r, name: cardById(r.cardId).name }); }
  }
  return list.find(b => b.pos.li !== targetPos.li &&
    (b.src.applies !== "neighbor" || Math.abs(b.pos.li - targetPos.li) === 1) &&
    !(b.src.oncePerTurn && b.holder.bgTurn === G.gt) && curHp(b.pos.pi, b.pos.li) > 0);
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

  let dLi = target.li;
  const combat = { atkMod: 0, atkSet: null, swap: false, blocked: false };
  const ctx = { laneIdx: dLi, combat, attacker: { pi, li: attackerLis[0] }, defender: { pi: 1 - pi, li: dLi } };
  if (!heroAt(ctx.defender)) { log(`No Hero in the targeted lane — attack fizzles.`); return; }
  log(`${names} attack${attackerLis.length > 1 ? " (Onslaught)" : "s"} ${cardById(heroAt(ctx.defender).cardId).name}.`, P.isAI ? "ai" : "");
  // defender may pull a single attacker onto a protector Hero
  if (attackerLis.length === 1) { await defensiveRedirect(pi, ctx); dLi = ctx.defender.li; ctx.laneIdx = dLi; }
  await fireHexes(1 - pi, "attackLane", ctx);
  for (const ali of attackerLis) await fireHexes(pi, "ownAttack", { laneIdx: ali, combat });
  applyCombatAuxMods(pi, attackerLis, ctx.defender.li, combat, ctx.defender);
  // Tolui: onslaught mates gain Attack; defender can't prevent/block/redirect
  if (attackerLis.length > 1) {
    for (const ali of attackerLis) { const ah = heroAt({ pi, li: ali }); if (ah && !isSilenced(ah) && /participates in an Onslaught, all participating Heroes gain \+(\d+) Attack/i.test(cardById(ah.cardId).text || "")) { const tm = cardById(ah.cardId).text.match(/gain \+(\d+) Attack/i); combat.atkMod += +tm[1]; combat.toluiLock = true; log(`${cardById(ah.cardId).name} leads the charge (+${tm[1]} Attack each)!`, P.isAI ? "ai" : ""); break; } }
  }
  if (combat.toluiLock) { combat.blocked = false; combat.prevent = 0; combat.redirectDefender = null; }
  // Tolui aux: two or more attacks declared this turn -> Pulse (once per turn)
  P.attacksDeclared = (P.attacksGt === G.gt ? (P.attacksDeclared || 0) : 0) + attackerLis.length; P.attacksGt = G.gt;
  if (P.attacksDeclared >= 2) G.players[pi].lanes.forEach(L => { const seen3 = new Set(); for (const a of L.aux) if (a && !seen3.has(a.uid)) { seen3.add(a.uid); const mm = (cardById(a.cardId).auxText || "").match(/whenever two or more Heroes you control attack on the same turn, gain (\d+) Pulse/i); if (mm && a.tGt !== G.gt) { a.tGt = G.gt; gainPulse(pi, +mm[1], cardById(a.cardId).name); } } });
  if (P.breakLineTurn === G.gt) { combat.blocked = false; combat.prevent = 0; combat.redirectDefender = null; }   // Break the Line ignores prevention/redirect
  if (combat.redirectDefender && heroAt(combat.redirectDefender)) { ctx.defender = combat.redirectDefender; dLi = ctx.defender.li; ctx.laneIdx = dLi; }
  if (combat.blocked) { log(`The attack is blocked!`); return; }
  if (!heroAt(ctx.defender)) { log(`The defender is already gone — attack ends.`); return; }
  // pre-damage may have killed attackers
  const alive = attackerLis.filter(li => heroAt({ pi, li }));
  if (!alive.length) { log(`All attackers died before combat!`); return; }

  // "when X fights, the opposing Hero's Relics/Aux grant it no stats" — strip
  // the defender's equipment if any attacker has it; strip attackers' if the defender has it
  const defBare = alive.some(li => heroFlag({ pi, li }, "ignoreEnemyEquip")) || !!combat.defBare;
  const atkBare = heroFlag(ctx.defender, "ignoreEnemyEquip") || !!combat.atkBare;
  const defHero = heroAt(ctx.defender);
  const defFlags = (isSilenced(defHero) ? null : fx(defHero.cardId).flags) || {};
  const atkPenalty = (defFlags.attackerPenalty || 0) + (defHero.relics.length ? (defFlags.attackerPenaltyIfRelic || 0) : 0);   // Kaeso, Hegga
  // relic-based first-time-each-turn combat prevention (Stonewall Pavise)
  for (const r of defHero.relics) { const pf = fx(r.cardId).preventFirst; if (pf && r.prevGt !== G.gt) { r.prevGt = G.gt; combat.prevent = (combat.prevent || 0) + pf; } }
  const atkOf = (li) => {
    let a = effAtk(pi, li, atkBare);
    if (combat.atkSet != null) a = combat.atkSet;
    if (combat.swap) a = curHp(pi, li);
    return Math.max(0, a + combat.atkMod - atkPenalty);
  };
  const defAtk = combat.defMatch && alive.length === 1 ? atkOf(alive[0]) : Math.max(0, effAtk(1 - pi, dLi, defBare) + (combat.defAtkMod || 0));
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
    // post-combat: defender survived (counterattacks, Weighing of Hearts, Benediction)
    if (heroAt(ctx.defender) && heroAt({ pi, li: alive[0] })) {
      const tookDmg = aAtk > defAtk;
      await fireHexes(1 - pi, "postCombat", { laneIdx: dLi, attacker: { pi, li: alive[0] }, defender: ctx.defender, defenderTookDamage: tookDmg });
    }
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
      await fireHexes(1 - pi, "onslaughtFailed", { laneIdx: dLi, onslaughtAttackers: alive.map(li => ({ pi, li })) });
    } else log(`Evenly matched (${total} vs ${defAtk}) — no damage.`);
  }
  checkWin();
}

/* ---------------------------- Joint Strike ---------------------------- */
// Total the +N Attack "during Joint Strikes" bonuses from anything you control.
function jointStrikeBonus(pi) {
  let b = 0;
  for (const pos of heroesOf(pi)) {
    const c = cardById(heroAt(pos).cardId);
    let m = (c.text || "").match(/Heroes you control gain \+(\d+) Attack during Joint Strikes/i);
    if (m) b += +m[1];
  }
  for (const L of G.players[pi].lanes) {
    const seen = new Set();
    for (const a of L.aux) if (a && !seen.has(a.uid)) {
      seen.add(a.uid);
      const at = cardById(a.cardId).auxText || "";
      let m = at.match(/(?:gain|gains) \+(\d+) Attack (?:during Joint Strikes|for that combat)/i);
      if (m && /Joint Strike/i.test(at)) b += +m[1];
    }
  }
  return b;
}

// Two neighboring Heroes attack one enemy lane as a single combat: Attacks are
// summed (+bonuses); if they win, defender takes the difference; if they lose,
// the return damage is split as evenly as possible (in 10s) between the two.
async function jointStrike(pi, lanes, target) {
  const O = 1 - pi;
  lanes = lanes.filter(li => heroAt({ pi, li }));
  if (lanes.length < 2 || Math.abs(lanes[0] - lanes[1]) !== 1) { log(`Joint Strike needs two Heroes in neighboring lanes.`); return; }
  for (const li of lanes) { const h = heroAt({ pi, li }); h.attacksUsed++; h.hasAttacked = true; h.attackedTurn = G.gt; }
  const bonus = jointStrikeBonus(pi);
  const names = lanes.map(li => cardById(heroAt({ pi, li }).cardId).name).join(" & ");
  for (const li of lanes) await fireCombat("declareAttack", pi, li, target && target.face ? -1 : O, target ? target.li : -1);

  if (target && target.face) {
    const total = lanes.reduce((s, li) => s + effAtk(pi, li) + bonus, 0);
    G.players[O].mortality -= total;
    log(`Joint Strike — ${names} hit directly for ${total}!`, G.players[pi].isAI ? "ai" : "");
    if (total > 0) emit("loseMortality", O, {});
    checkWin(); return;
  }
  const dLi = target.li;
  const def = { pi: O, li: dLi };
  if (!heroAt(def)) { log(`Joint Strike target is gone.`); return; }
  const defBare = lanes.some(li => heroFlag({ pi, li }, "ignoreEnemyEquip"));
  const total = lanes.reduce((s, li) => s + effAtk(pi, li) + bonus, 0);
  const defAtk = effAtk(O, dLi, defBare);
  const defName = cardById(heroAt(def).cardId).name;
  log(`Joint Strike — ${names} (combined ${total}${bonus ? `, +${bonus} bonus` : ""}) vs ${defName} (${defAtk}).`, G.players[pi].isAI ? "ai" : "");
  if (total > defAtk) {
    const dmg = total - defAtk;
    const defThere = heroAt(def);
    dealDamage(def, dmg, { combat: true, killer: { pi, li: lanes[0] }, sourceName: "Joint Strike" });
    for (const li of lanes) if (heroAt({ pi, li })) await fireCombat("dealDamage", pi, li, O, dLi);
    if (defThere && !heroAt(def)) await fireCombat("kill", pi, lanes[0], O, dLi);
  } else if (defAtk > total) {
    const D = defAtk - total;
    const h1 = Math.ceil(D / 20) * 10, h2 = D - h1;   // split as evenly as possible, in 10s
    log(`Joint Strike repelled — return ${D} split ${h1}/${h2}.`);
    const share = [h1, h2];
    lanes.forEach((li, i) => { if (heroAt({ pi, li }) && share[i] > 0) dealDamage({ pi, li }, share[i], { combat: true, killer: def, sourceName: "Joint Strike" }); });
  } else log(`Joint Strike evenly matched — no damage.`);
  checkWin();
}

// Choose the two Heroes and target for a Joint Strike, then resolve it.
// initiator: "self" (must include the source lane) or "any" (any neighboring pair).
async function initiateJointStrike(pi, ctx) {
  const P = G.players[pi];
  const ready = (li) => heroAt({ pi, li }) && canAttack(pi, li);
  const lanesN = P.lanes.length;
  // build candidate neighboring pairs
  const pairs = [];
  for (let a = 0; a < lanesN - 1; a++) if (ready(a) && ready(a + 1)) pairs.push([a, a + 1]);
  let usable = pairs;
  if (ctx.initiator === "self" && ctx.laneIdx != null) usable = pairs.filter(pr => pr.includes(ctx.laneIdx));
  if (!usable.length) { if (!P.isAI) UI.toast("No two neighboring Heroes are ready to Joint Strike."); return; }
  // pick the pair
  let pair;
  if (P.isAI) pair = usable.sort((x, y) => (effAtk(pi, y[0]) + effAtk(pi, y[1])) - (effAtk(pi, x[0]) + effAtk(pi, x[1])))[0];
  else {
    const idx = promptPick("Joint Strike — which pair of neighboring Heroes?", usable.map(pr => `${cardById(heroAt({ pi, li: pr[0] }).cardId).name} + ${cardById(heroAt({ pi, li: pr[1] }).cardId).name}`));
    if (idx == null) return;
    pair = usable[idx];
  }
  // the pair coordinates on any one enemy lane they can reach (taunt/protection honored)
  const reachable = attackableEnemyLanes(pi);
  let tgt;
  if (reachable.length) {
    if (P.isAI) tgt = reachable.sort((a, b) => effAtk(O_of(pi), a.li) - effAtk(O_of(pi), b.li))[0];
    else tgt = await UI.pickHero("Joint Strike — choose the target", reachable);
    if (!tgt) return;
  } else if (!heroesOf(O_of(pi)).length) tgt = { face: true };
  else { if (!P.isAI) UI.toast("No legal Joint Strike target."); return; }
  await jointStrike(pi, pair, tgt);
}
function O_of(pi) { return 1 - pi; }

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
