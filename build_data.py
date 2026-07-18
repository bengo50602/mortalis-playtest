#!/usr/bin/env python3
"""Parse rules_current.md (the live rules document) into cards.js + rules.js.
Re-run this any time the rules document changes:
    python3 build_data.py
Card sets AND recognizable game constants (Mortality, Pulse/turn, lane unlock
schedule, Overkill cap, ...) are read from the document. In-app edits are
stored separately in the browser and layered on top.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "rules_current.md"

text = SRC.read_text(encoding="utf-8")
lines = text.split("\n")

realm_re = re.compile(r"^## Appendix ([A-Z]+): (.+?) Realm — Full Card Set")
section_re = re.compile(r"^### (Heroes|Relics|Hexes|Rites|Pacts|Incantations)")
name_re = re.compile(r"^\*\*(.+?)\*\*(.*)$")
hero_mode_re = re.compile(
    r"^Hero Mode — Cost: (\d+) Pulse \| Attack/Health: (\d+)/(\d+) \| Rarity: (.+)$")
aux_mode_re = re.compile(r"^Auxiliary Mode — Cost: (\d+) Pulse \| (\d+) slots?")
relic_hdr_re = re.compile(r"^— (\d+) slots? \| Cost: (\d+) Pulse\s*$")
spell_hdr_re = re.compile(r"^— Cost: (\d+) Pulse\s*$")

TYPE_MAP = {"Heroes": "hero", "Relics": "relic", "Hexes": "hex",
            "Rites": "rite", "Pacts": "pact", "Incantations": "incantation"}

realms = []
cards = []
realm = None
section = None
i = 0
n = len(lines)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


while i < n:
    line = lines[i].strip()
    m = realm_re.match(line)
    if m:
        realm = {"name": m.group(2), "letter": m.group(1), "identity": "", "notes": []}
        realms.append(realm)
        section = None
        i += 1
        continue
    if realm and line.startswith("**Realm identity:**"):
        realm["identity"] = line.replace("**Realm identity:**", "").strip()
        i += 1
        continue
    m = section_re.match(line)
    if m and realm:
        section = TYPE_MAP[m.group(1)]
        i += 1
        continue
    if realm and section is None and line.startswith("**") and ":" in line and not name_re.match(line):
        realm["notes"].append(line)
        i += 1
        continue
    if realm and section:
        m = name_re.match(line)
        if m:
            name, rest = m.group(1), m.group(2).strip()
            card = {"id": f"{slug(realm['name'])}--{slug(name)}",
                    "realm": realm["name"], "name": name, "type": section}
            if section == "hero":
                i += 1
                hm = hero_mode_re.match(lines[i].strip())
                if not hm:
                    sys.exit(f"Bad hero mode line for {name}: {lines[i]}")
                card.update(cost=int(hm.group(1)), atk=int(hm.group(2)),
                            hp=int(hm.group(3)), rarity=hm.group(4).strip().strip("*"))
                i += 1
                body = []
                while i < n and not aux_mode_re.match(lines[i].strip()):
                    if lines[i].strip():
                        body.append(lines[i].strip())
                    i += 1
                card["text"] = " ".join(body)
                am = aux_mode_re.match(lines[i].strip())
                card["auxCost"] = int(am.group(1))
                card["auxSlots"] = int(am.group(2))
                i += 1
                aux = []
                while i < n and lines[i].strip():
                    aux.append(lines[i].strip())
                    i += 1
                card["auxText"] = " ".join(aux)
            elif section == "relic":
                rm = relic_hdr_re.match(rest)
                if not rm:
                    sys.exit(f"Bad relic header for {name}: {rest}")
                card.update(slots=int(rm.group(1)), cost=int(rm.group(2)))
                i += 1
                body = []
                while i < n and lines[i].strip():
                    body.append(lines[i].strip())
                    i += 1
                card["text"] = " ".join(body)
            else:
                sm = spell_hdr_re.match(rest)
                if not sm:
                    sys.exit(f"Bad {section} header for {name}: {rest}")
                card["cost"] = int(sm.group(1))
                i += 1
                body = []
                while i < n and lines[i].strip():
                    body.append(lines[i].strip())
                    i += 1
                card["text"] = " ".join(body)
            cards.append(card)
            continue
    i += 1

for c in cards:
    if len([x for x in cards if x["id"] == c["id"]]) > 1:
        sys.exit(f"Duplicate id {c['id']}")

by_realm = {}
for c in cards:
    by_realm.setdefault(c["realm"], {})
    by_realm[c["realm"]][c["type"]] = by_realm[c["realm"]].get(c["type"], 0) + 1

print(f"Realms: {len(realms)}  Cards: {len(cards)}")
for r in realms:
    counts = by_realm.get(r["name"], {})
    print(f"  {r['name']:<14} " + " ".join(f"{t}:{counts.get(t, 0)}" for t in
          ["hero", "relic", "hex", "rite", "pact", "incantation"]))

# --- Game constants: parsed from the rules document where recognizable, so
# --- numeric rule changes made in the doc apply to the engine automatically.
core = text.split("## Appendix A")[0]


def grab(pattern, default):
    m = re.search(pattern, core)
    return int(m.group(1)) if m else default


overkill_m = re.search(
    r"capped at a maximum of \*{0,2}(\d+)\*{0,2} Mortality per Hero killed", core)

lane_unlocks = [1, 1, 1, 1]
# v1.8 wording: "**Lane 3:** unlocks at the start of each player's **3rd turn**"
for lane, turn in re.findall(
        r"\*\*Lane (\d+):\*\* unlocks at the start of each player's \*\*(\d+)(?:st|nd|rd|th) turn\*\*", core):
    idx = int(lane) - 1
    if 0 <= idx < 4:
        lane_unlocks[idx] = int(turn)
# v1.10 wording: "**Lane position 1 (one outer Lane):** unlocks at the start of each player's **3rd turn**"
for lane, turn in re.findall(
        r"\*\*Lane position (\d+)[^:*]*:\*\* unlocks at the start of each player's \*\*(\d+)(?:st|nd|rd|th) turn\*\*", core):
    idx = int(lane) - 1
    if 0 <= idx < 4:
        lane_unlocks[idx] = int(turn)

constants = {
    "startingMortality": grab(r"Starting Mortality: \*\*(\d+)\*\*", 250),
    "pulsePerTurn": grab(r"gain a flat \*\*(\d+) Pulse\*\*", 5),
    "startingHand": grab(r"Starting hand size: \*\*(\d+) cards?\*\*", 7),
    "maxHand": grab(r"\*\*Maximum hand size:\*\* (\d+)", 8),
    "firstTurnPulse": grab(r"gains only \*\*(\d+) Pulse\*\* on their first turn", 5),
    "deckSize": grab(r"\*\*Deck size:\*\* (\d+) cards", 50),
    "copyLimit": grab(r"\*\*Copy limit:\*\* \d+-(\d+)", 3),
    "lanes": 4, "auxSlotsPerLane": 2,
    "relicSlotsPerHero": grab(r"\*\*Slots:\*\* (\d+) per Hero", 2),
    "sharedSlots": grab(r"\*\*(\d+) total slots\*\*", 4),
    "drawPerTurn": grab(r"Draw (\d+) card per turn", 1),
    "fatigueBase": 10, "fatigueStep": 10,
    "firstPlayerSkipsDraw": True, "firstPlayerNoAttackTurn1": True,
    "auxDiscount": grab(r"fixed discount of \*\*[-−–](\d+) Pulse\*\*", 2),
    "relicRealmLocked": True,
    "overkillCap": int(overkill_m.group(1)) if overkill_m else None,
    "laneUnlockTurns": lane_unlocks,
}
print("Constants read from the document:")
print("  " + json.dumps(constants))

out = HERE / "cards.js"
out.write_text(
    "// GENERATED by build_data.py from rules_current.md — safe to hand-edit,\n"
    "// but re-running build_data.py will overwrite this file.\n"
    "window.DEFAULT_DATA = " +
    json.dumps({"realms": realms, "cards": cards, "constants": constants},
               indent=1, ensure_ascii=False) + ";\n",
    encoding="utf-8")

rules_out = HERE / "rules.js"
rules_out.write_text(
    "// GENERATED by build_data.py — full rule text for the Edit rules tab.\n"
    "window.DEFAULT_RULES_TEXT = " + json.dumps(text, ensure_ascii=False) + ";\n",
    encoding="utf-8")
print(f"Wrote {out.name} and {rules_out.name}")
