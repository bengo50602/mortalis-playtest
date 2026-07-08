#!/usr/bin/env python3
"""Parse rules_v1_7.md into cards.js + rules.js for the playtest app.
Re-run this any time you edit rules_v1_7.md to regenerate the default data:
    python3 build_data.py
(In-app edits are stored separately in your browser and layered on top.)
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "rules_v1_7.md"

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

constants = {
    "startingMortality": 250, "pulsePerTurn": 5, "startingHand": 7,
    "deckSize": 50, "copyLimit": 3, "lanes": 4, "auxSlotsPerLane": 2,
    "relicSlotsPerHero": 2, "sharedSlots": 4, "drawPerTurn": 1,
    "fatigueBase": 10, "fatigueStep": 10,
    "firstPlayerSkipsDraw": True, "firstPlayerNoAttackTurn1": True,
    "auxDiscount": 2, "relicRealmLocked": True,
}

out = HERE / "cards.js"
out.write_text(
    "// GENERATED by build_data.py from rules_v1_7.md — safe to hand-edit,\n"
    "// but re-running build_data.py will overwrite this file.\n"
    "window.DEFAULT_DATA = " +
    json.dumps({"realms": realms, "cards": cards, "constants": constants},
               indent=1, ensure_ascii=False) + ";\n",
    encoding="utf-8")

rules_out = HERE / "rules.js"
rules_out.write_text(
    "// GENERATED by build_data.py — full v1.7 rule text for the Edit rules tab.\n"
    "window.DEFAULT_RULES_TEXT = " + json.dumps(text, ensure_ascii=False) + ";\n",
    encoding="utf-8")
print(f"Wrote {out.name} and {rules_out.name}")
