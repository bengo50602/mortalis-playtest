# MORTALIS: REALMS
## Core Rules — Draft v1.5 (Combined Edition: Core Rules + All 10 Realm Card Sets)

## 1. Overview & Win Condition

Players build 50-card decks with total creative freedom — any card can go in any deck, with no rigid pre-built synergy packages required. Strategy comes from smart deckbuilding, resource management, and tactical combat decisions, not from being locked into a narrow set of "correct" card combinations.

**Win condition:** Reduce your opponent's **Mortality** to 0.

---

## 2. Core Resources

### Pulse
The universal resource used to pay for all cards. Pulse is **not colored or Realm-locked** — every card simply costs a number of Pulse, regardless of archetype.

- At the start of each of your turns, gain a flat **5 Pulse** (this amount does not increase as the game goes on — always 5)
- Unused Pulse **carries over indefinitely** between turns as a running tally — there is no "use it or lose it," and **no hard cap**
- Card-based Pulse ramp effects (e.g., Kessa Windrend's Auxiliary Mode) still function and stack on top of the flat 5/turn

### Mortality
Represents a player's life total.

- Starting Mortality: **250**
- When a player's Mortality reaches 0, they lose
- If a player must draw from an empty deck, they take escalating **fatigue damage** instead of losing instantly (damage increases each subsequent fatigue draw)

---

## 3. Realms & Lanes

Before the match begins, each player selects up to **4 Realms**. These are fixed for the entire game — they are **not** drawn from your deck.

- You may run duplicates of the same Realm (e.g., 4x the same Realm for a mono-archetype deck)
- Each Realm you choose creates **1 Lane** on your board
- Realms determine **archetype access**: to play a card from a given archetype, you must control a matching Realm in play. Realms do **not** affect a card's Pulse cost.
- Running fewer than 4 Realms, or duplicating one Realm type, carries no explicit game penalty — any trade-off (fewer total Heroes, less archetype diversity) is a natural consequence of the choice, not a rule.

---

## 4. Deckbuilding

- **Deck size:** 50 cards
- **Copy limit:** 2-3 copies max of any individual card
- Any card can be included in any deck — there is no forced synergy requirement, only the Realm-access gate described above

---

## 5. Turn Structure

Each turn follows a simple sequence:

**Draw → Play → Attack → End**

- Draw 1 card per turn
- Play cards (Heroes, Relics, Hexes, Rites, Pacts, Incantations) using available Pulse
- Declare attacks (optional, per Hero)
- End turn

**Game start:**
- Starting hand size: **7 cards**
- The player going first **skips their first draw** and **cannot attack on their first turn** (fairness correction)

---

## 6. Lanes & Board Structure

- Each Realm = 1 Lane, up to 4 Lanes total
- Each Lane holds a **maximum of 1 Hero**
- Total Heroes in play at once = number of Lanes filled (max 4)
- Each Lane also has **2 Auxiliary slots** (see Section 8 — Heroes, Auxiliary Mode)
- **Lane adjacency:** Lanes are arranged in a fixed left-to-right order, set when you choose your Realms before the match. A "neighboring" Lane (referenced by some card effects) means a Lane physically adjacent to it — a middle Lane has 2 neighbors, an end Lane has 1 (or 0 if you're only running a single Lane).

---

## 7. Combat

### Basic Combat
When Heroes fight (same-lane by default):

1. Compare the total **Attack** of the attacking side vs. the defending side
2. The side with **lower** total Attack takes damage equal to the **difference**, subtracted from Health
3. The side with **higher** total Attack takes **no damage**
4. If Attack values are equal, no damage is dealt to either side

### Redirects
If a Hero attacks but the opponent's matching lane is empty:
- The Hero may **redirect** to attack a Hero in a different occupied lane
- If the opponent's entire board is empty, the attack goes directly to their **Mortality**

### Onslaught (Gang-Ups)
Multiple Heroes can redirect onto the same single defending Hero — this is called an **Onslaught**.

- Sum the Attack of all attacking Heroes
- If the combined total **meets or exceeds** the defender's Health, the defender dies and all attackers survive undamaged
- If the combined total **falls short**, the defender survives, and **every individual attacking Hero** takes damage equal to the full shortfall (not divided among them) — a failed Onslaught can wipe out several attackers at once

### Overkill Damage
Whenever a Hero dies from combat damage — whether from basic combat, a successful Onslaught, or the shortfall damage from a failed Onslaught — any damage dealt in excess of that Hero's Health is dealt directly to its controller's Mortality instead of being wasted. This applies symmetrically: it can happen to a defender killed by an attack, or to an attacking Hero killed by a failed Onslaught's shortfall.

---

## 8. Card Types

**Effect duration (default rule):** Unless a card explicitly says otherwise, an effect that modifies stats or the board lasts only **while that card remains in play**. Effects worded "at the start of turn," "each turn," or similar are **recurring** — they happen every applicable turn, not just once. Card text should always specify duration/frequency explicitly (e.g., "while in play," "at the start of each of your turns," "once, when this enters play") to avoid ambiguity.

**No unconditional direct damage to Mortality:** Cards may not deal damage straight to a player's Mortality as a standalone, guaranteed effect (no plain "burn" spells). The only paths to direct Mortality damage are the existing combat rules — a Hero attacking into a lane with no enemy Hero, an opponent's fully empty board, or Overkill Damage (see Section 7). This keeps the game anchored in board state and lane combat rather than allowing a deck to bypass Heroes entirely.

**Multiples of 10:** All Attack, Health, and damage numbers on every card (not just Hero base stats) must be multiples of 10.

**Stat Reduction vs. Damage:** Some cards (mostly Balemaw) *reduce* a Hero's Attack or Health rather than dealing damage. A stat reduction is not damage: it cannot be prevented by damage-prevention effects, and Health lost to a reduction cannot be healed back (the Hero's maximum is lowered). A Hero whose Health is reduced to 0 by a stat reduction is destroyed, but since no damage was dealt, **no Overkill Damage occurs**. Attack cannot be reduced below 0.

### Heroes
The main monster cards. Every Hero card can be played in one of **two modes** — but a given card (by name) can only be in play **once total**, in either mode, not both at the same time.

**Hero Mode:**
- One per Lane, up to 4 Heroes in play at once
- **Cost:** Full Pulse cost listed on the card, gated by matching Realm access
- **Stats:** Attack and Health, generated from a stat budget of **cost × 30**, split in multiples of 10 (e.g., a 5-cost Hero has 150 points to split)
- **Ability text:** Full custom text, unique per Hero — no generic vanilla stat-sticks, no keyword jargon
- **Rarity:** Common → Uncommon → Rare → Ultra-Rare → **Eternal** (rarity governs ability complexity/power ceiling, not raw stats)
- **No flavor text** — cards are mechanics-only
- **Equipping:** Each Hero can hold Relics in 2 slots (see below)

**Auxiliary Mode:**
- Instead of playing a Hero card into its Lane, you may play it into one of that Lane's **2 Auxiliary slots**
- **Cost:** A fixed discount of **-2 Pulse** from the card's normal Hero cost (minimum 1 Pulse)
- Grants a separate, unique support effect written on the card — does not fight, does not have Attack/Health while in this mode
- Higher-power Auxiliary effects may take up **both slots** in the Lane instead of just 1
- This means a duplicate copy of a Hero you've already played isn't a dead draw — it becomes a support piece instead

### Relics
Equipment cards that attach to a Hero.

- **Slots:** 2 per Hero; more powerful Relics can occupy both slots
- **Realm-locked:** A Relic may only be attached to a Hero of its own Realm
- **Effects:** Stat boosts and/or granted abilities/keywords
- If the equipped Hero dies, its Relics are **permanently destroyed**

### Hexes
Reactive, trap-style cards.

- Played face-down for free — placing one only requires an open slot from the shared pool (see below), no Pulse cost at that moment
- Triggers automatically when their condition is met
- The listed Pulse cost is paid **at the moment the trigger condition occurs** — drawn from whatever Pulse you currently have banked, even during your opponent's turn. This is the **only** card type that can be paid for and resolved during the opponent's turn.
- If you cannot or choose not to pay the cost when it triggers, the Hex fizzles with no effect and is destroyed
- Scope varies by card: some are narrow-but-powerful (affecting a single Realm/lane), others are wide-but-weaker (affecting the whole board)

### Rites
Delayed setup/payoff cards.

- Effects vary by card: some resolve automatically after a set number of turns, some can be cashed in early for a smaller effect, and some build up based on an in-game trigger rather than a fixed timer

### Pacts
Risk/reward cards with a cost or downside.

- Cost type varies by card: life (Mortality), card advantage, board state (sacrifice), etc.

### Incantations
Direct-effect spells: damage, buffs/debuffs, removal, draw, disruption, or larger swing effects.

- **No full board wipes** — effects must be specific/targeted (a lane, a condition, a card), never an indiscriminate sweep of the entire board

### Shared Slot Pool (Hexes / Rites / Pacts / Incantations)
These four card types all draw from the same shared resource:

- **4 total slots**, fixed regardless of how many Realms you're running
- A slot is occupied while a Hex/Rite/Pact is active/pending, or briefly while an Incantation is cast
- Slots **free up** once the card resolves or triggers, allowing a new one to be played
- Since Incantations resolve immediately, you must have an **open slot available** to cast one — if all 4 slots are tied up with lingering Hexes/Rites/Pacts, you cannot cast a new Incantation until one frees up

---

## 9. Open Questions / Not Yet Decided
- Full ability-complexity guidelines per rarity tier
- Additional Realms beyond the current ten (Fangrend, Luminar, Runespire, Balemaw, Gildharbor, Ankhara, Karakhorde, Deepforge, Aurelium, Oathenhall)

---

## Appendix A: Fangrend Realm — Full Card Set

**Realm identity:** Storm-wolf warriors who trade safety for raw power. Mechanically: low Health / high Attack Heroes, self-damage-for-payoff effects, and direct aggression through combat rather than unconditional burn.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Vorka, Stormfang Reaver**
Hero Mode — Cost: 4 Pulse | Attack/Health: 70/50 | Rarity: Common
While Vorka is in play, her Attack is continuously increased by 1 for each point of Health she is currently missing.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +30 Attack. At the start of each of your turns, that Hero takes 20 damage.

**Skarn, the Unbound**
Hero Mode — Cost: 6 Pulse | Attack/Health: 140/40 | Rarity: Rare
While Skarn is in play, whenever he deals damage directly to an opponent's Mortality, draw 1 card.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, the Hero in this lane deals its full Attack as damage to any enemy Hero it fights in combat, even if that enemy Hero's Attack is higher (overriding the normal "higher Attack takes no damage" rule for this lane only).

**Riko, the Ashwolf Pup**
Hero Mode — Cost: 2 Pulse | Attack/Health: 40/20 | Rarity: Common
While Riko is in play, the first time each turn she deals combat damage to an enemy Hero, she gains +20 Attack until the end of your next turn.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
When this card enters play, deal 20 damage to the Hero in this lane.

**Gunnhild Stormscar**
Hero Mode — Cost: 5 Pulse | Attack/Health: 90/60 | Rarity: Uncommon
While Gunnhild is in play, all other Fangrend Heroes you control continuously have +20 Attack.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
While in this slot, all Fangrend Heroes you control continuously have +20 Attack (board-wide, not just this lane).

**Threnn, Widow of the Gale**
Hero Mode — Cost: 8 Pulse | Attack/Health: 180/60 | Rarity: Ultra-Rare
While Threnn is in play, whenever an enemy Hero dies from combat damage dealt by one of your Heroes, Threnn permanently gains +30 Attack.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While this card is in play, whenever any enemy Hero dies, deal 30 damage to an enemy Hero of your choice.

**Kessa Windrend**
Hero Mode — Cost: 3 Pulse | Attack/Health: 60/30 | Rarity: Common
Whenever you gain Pulse from a card effect, Kessa gains +20 Attack until the end of your next turn.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
At the start of each of your turns, if the Hero in this lane attacked during your previous turn, gain 1 Pulse.

**Snarl, the Wound-Fed**
Hero Mode — Cost: 2 Pulse | Attack/Health: 40/20 | Rarity: Common
Whenever Snarl takes damage, he permanently gains 10 Attack.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane heals 10 Health at the start of each of your turns.

**Hilde Scartongue**
Hero Mode — Cost: 4 Pulse | Attack/Health: 80/40 | Rarity: Uncommon
Whenever Hilde takes damage, she permanently gains Attack equal to the damage taken.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, at the end of each of your turns, the Hero in this lane takes 10 damage.

**Ragna, the Undying Fang**
Hero Mode — Cost: 6 Pulse | Attack/Health: 130/50 | Rarity: Rare
Whenever Ragna takes damage, she permanently gains Attack equal to the damage taken. The first time Ragna would die from damage each game, instead reduce her Health to 10 and she survives — when this happens, she only gains Attack equal to the amount of damage that was needed to reduce her Health to 0, not the full amount dealt (any excess/overkill damage grants no bonus Attack).
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, once per turn you may pay 2 Pulse to give the Hero in this lane +20 Attack until the end of the current turn.

**Vrist, Harbinger of Wounds**
Hero Mode — Cost: 8 Pulse | Attack/Health: 160/80 | Rarity: Ultra-Rare
Whenever Vrist takes damage, he permanently gains Attack equal to the damage taken. While Vrist is in play, whenever another Fangrend Hero you control takes damage, that Hero also permanently gains Attack equal to half the damage taken, rounded down to the nearest 10.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, whenever any Hero you control dies, the Hero in this lane permanently gains 20 Attack. At the end of each of your turns, the Hero in this lane takes 10 damage.

**Skoldir, the Last Howl**
Hero Mode — Cost: 10 Pulse | Attack/Health: 220/80 | Rarity: Eternal
Whenever Skoldir takes damage, he permanently gains Attack equal to double the damage taken. When Skoldir dies, deal damage equal to half his current Attack (rounded down to the nearest 10) to up to 2 enemy Heroes of your choice.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, the Hero in this lane may attack a second time each turn.

### Relics

**Fangrend Warpaint** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +20 Attack.

**Cracked Storm-Horn** — 1 slot | Cost: 2 Pulse
While equipped, whenever this Hero wins a fight (deals damage while taking none), also deal 20 damage to the Hero in the opposing lane, if one is present.

**Wolfskin Cloak** — 1 slot | Cost: 3 Pulse
While equipped, this Hero continuously has +50 Health.

**The Reaver's Tusk** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +80 Attack. At the start of each of your turns, this Hero takes 20 damage.

**Chain of the Bound Storm** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health. Whenever the equipped Hero dies, deal 50 damage to whichever Hero killed it. This triggers once, at the moment of death.

### Hexes
*(Played face-down, trigger automatically when their condition is met)*

**Snapping Ambush** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, deal 30 damage to the attacking Hero before combat damage is calculated. After this effect triggers once, destroy this card.

**Frostbitten Snare** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, reduce that enemy Hero's Attack by 30 for that combat only. After this effect triggers once, destroy this card.

**Vengeful Howl** — Cost: 3 Pulse
When a Hero in this lane dies, deal 50 damage to whichever Hero killed it. After this effect triggers once, destroy this card.

**Warded Threshold** — Cost: 4 Pulse
The first time each turn an enemy Hero attacks this lane, that attack is blocked — no combat occurs and no damage is dealt to either side. If this lane's Hero is instead targeted by an Onslaught (multiple attacking Heroes), this effect removes one attacking Hero of your choice from the Onslaught — that Hero's Attack no longer counts toward the total, and it does not participate in the resulting combat — while the remaining attackers' Onslaught proceeds as normal. This card is not destroyed after triggering and may trigger again on future turns.

**Feast of Wounds** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, deal 20 damage to the Hero in this lane (yours) before combat damage is calculated. After this effect triggers once, destroy this card.

### Rites
*(Delayed setup/payoff)*

**The Long Hunt** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, deal 90 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 30 damage to a Hero of your choice immediately.

**The Slow Thaw** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, your Hero in this lane permanently gains +30 Attack and +30 Health, then destroy this Rite. At any point before then, you may instead end this Rite early, granting +20 Attack and +20 Health immediately instead.

**Oath of the Unyielding Pack** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns. When it reaches 3 counters, destroy this Rite and give each Fangrend Hero you control +20 Attack permanently.

**Reckoning of the Storm** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Blood for the Storm** — Cost: 2 Pulse
When this Pact resolves, deal 50 damage to your own Hero in this lane. If that Hero survives, it permanently gains +40 Attack.

**Debt of Fang and Bone** — Cost: 2 Pulse
When this Pact resolves, discard 2 cards from your hand, then draw 3 cards.

**Sacrifice to the Storm** — Cost: 1 Pulse
When this Pact resolves, destroy a Hero you control in any lane. Gain Pulse equal to that Hero's cost, immediately and only once.

**Reckless Bargain** — Cost: 3 Pulse
When this Pact resolves, deal 30 damage to an enemy Hero of your choice, then deal 30 damage to your own Hero in this lane.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Fury Unleashed** — Cost: 4 Pulse
When this Incantation resolves, deal damage to an enemy Hero equal to the current Attack of your Hero in the same lane.

**Village Raid** — Cost: 5 Pulse
When this Incantation resolves, discard any number of cards from your hand. Choose one Fangrend Hero you control — it gains +20 Attack until the end of the current turn for each card discarded this way.

**Howling Retribution** — Cost: 5 Pulse
When this Incantation resolves, choose up to 2 Heroes (any Heroes in play, yours or your opponent's). Deal 30 damage to each chosen Hero.

---

## Appendix B: Luminar Realm — Full Card Set

**Realm identity:** A radiant order of Paladins built around balance, teamwork, and utility. Luminar Heroes run close to even Attack/Health splits (no glass cannons), and their effects lean into supporting other Realms on your board, generating Pulse, drawing cards, and disrupting Hexes/Rites/Pacts — the utility/glue Realm of the game. Several cards reference **neighboring lanes** (see Section 6 — Lane adjacency).

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Squire Elenya**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
When Elenya enters play, draw a card if you control a Hero from a Realm other than Luminar.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
At the start of each of your turns, if you control a Hero from another Realm, gain 1 Pulse.

**Brother Tomas**
Hero Mode — Cost: 2 Pulse | Attack/Health: 20/40 | Rarity: Common
While this card is in play, at the start of your turn, you may discard 1 card in your hand to give a Hero you control +20 Attack until end of turn.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane has +20 Health.

**Dame Ysolde**
Hero Mode — Cost: 3 Pulse | Attack/Health: 40/50 | Rarity: Common
While Ysolde is in play, whenever you play a Hero from a Realm other than Luminar, that Hero gains +10 Health permanently.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +20 Health.

**Sir Baldric Sunhelm**
Hero Mode — Cost: 4 Pulse | Attack/Health: 60/60 | Rarity: Common
Once per turn, you may destroy a Hex or Rite targeting one of your lanes.
Auxiliary Mode — Cost: 2 Pulse | 2 slots
Once per turn, you may destroy a Hex or Pact targeting this lane.

**Cassian Trueblade**
Hero Mode — Cost: 4 Pulse | Attack/Health: 70/50 | Rarity: Uncommon
Whenever Cassian deals combat damage to an enemy Hero, draw a card.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
When this card enters play, give the Hero in this lane +20 Health. Draw 1 card.

**Elowen Lightward**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
While Elowen is in play, all your Luminar Heroes have +20 Attack.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, neighboring Heroes gain +10 Attack and +10 Health.

**Thalia Oathkeeper**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
Whenever you play a Hero from a Realm other than Luminar, gain 1 Pulse.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
Once per turn, when you play a Hero from a Realm other than Luminar, gain 1 Pulse.

**Garrick Dawnshield**
Hero Mode — Cost: 6 Pulse | Attack/Health: 80/100 | Rarity: Rare
Once per turn, you may destroy a Relic or Auxiliary card affecting an enemy Hero.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
Once per turn, you may destroy a Relic attached to an enemy Hero in this lane.

**Seraphina Dawnbringer**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
At the start of each of your turns, draw a card. Whenever you draw a card this way, also gain 1 Pulse.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, the first time each turn an enemy targets a Hero in this lane or a neighboring lane with a Hex, you may pay 2 Pulse to negate and destroy that card.

**Aldric the Unwavering**
Hero Mode — Cost: 8 Pulse | Attack/Health: 110/130 | Rarity: Ultra-Rare
While Aldric is in play, all other Heroes you control continuously have +20 Attack and +30 Health. Once per turn, you may destroy an enemy Hex, Rite, or Pact.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
At the start of each of your turns, gain 1 Pulse for each neighboring lane with a Hero (max 2).

**Elyndra, Herald of Dawn**
Hero Mode — Cost: 10 Pulse | Attack/Health: 150/150 | Rarity: Eternal
While Elyndra is in play, Heroes you control in neighboring lanes continuously have +50 Attack. At the start of each of your turns, gain 2 Pulse.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While this card is in play, all Heroes you control continuously have +10 Attack and +10 Health. Whenever any battle occurs anywhere on the board, gain 1 Pulse. When this card enters play, draw 2 cards.

### Relics

**Blessed Sigil** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +20 Health.

**Lantern of Vigil** — 1 slot | Cost: 2 Pulse
While equipped, Heroes in neighboring lanes continuously have +10 Attack and +10 Health.

**Aegis Plate** — 1 slot | Cost: 3 Pulse
While equipped, this Hero continuously has +20 Attack and +20 Health.

**Halo of the Everwatch** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +40 Attack and +40 Health. Once per turn, you may destroy a Hex targeting this lane.

**Warhammer of Dawn** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +60 Attack. Whenever this Hero defeats an enemy Hero in combat, heal it for 30 Health.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Guardian's Ward** — Cost: 1 Pulse
The first time each turn a Hero in a neighboring lane would take combat damage, prevent 20 of that damage. After this effect triggers once, destroy this card.

**Radiant Rebuke** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, heal the defending Hero (the Hero in this lane being attacked) for 20 Health before combat damage is calculated. After this effect triggers once, destroy this card.

**Purging Light** — Cost: 3 Pulse
When an enemy Auxiliary or Relic card is played in an enemy lane, destroy it. After this effect triggers once, destroy this card.

**Vow of Retribution** — Cost: 3 Pulse
When a Hero in this lane dies, deal 40 damage to whichever Hero killed it, then draw a card. After this effect triggers once, destroy this card.

**Sanctified Ground** — Cost: 5 Pulse
The first time each turn an enemy Hero attacks this lane, treat that Hero's Attack as 0 for that combat only. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Vigil of Dawn** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, your Hero in this lane permanently gains +20 Attack and +20 Health, then destroy this Rite. At any point before then, you may instead end this Rite early, granting +10 Attack and +10 Health immediately instead.

**Choir of Ascension** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, draw 2 cards, then destroy this Rite. At any point before then, you may instead end this Rite early to draw 1 card immediately.

**Oath of the Faithful** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns. When it reaches 3 counters, destroy this Rite and give each Hero you control from a Realm other than Luminar +20 Attack and +20 Health permanently.

**Reckoning of the Dawnbreak** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Tithe of Faith** — Cost: 1 Pulse
When this Pact resolves, discard 1 card, then gain 2 Pulse.

**Sworn Sacrifice** — Cost: 2 Pulse
When this Pact resolves, destroy a Hero you control in any lane, then draw 1 card.

**Binding Oath** — Cost: 3 Pulse
When this Pact resolves, choose a Hero you control — it can't attack next turn. Draw 1 card and gain 1 Pulse.

**Last Rites** — Cost: 4 Pulse
When this Pact resolves, deal 40 damage to a Hero you control. Destroy up to 1 Hex, Rite, or Pact anywhere on the board.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Smite of Judgment** — Cost: 4 Pulse
When this Incantation resolves, deal damage to an enemy Hero equal to the current Attack of your Hero in the same lane.

**Radiant Cleansing** — Cost: 3 Pulse
When this Incantation resolves, destroy up to 1 Hex, Rite, or Pact anywhere on the board, then draw a card.

**Blessing of the Dawn** — Cost: 5 Pulse
When this Incantation resolves, choose up to 2 Heroes you control — each permanently gains +30 Attack.

---

## Appendix C: Runespire Realm — Full Card Set

**Realm identity:** Arcane magisters of a fractured spell-tower. Runespire Heroes lean toward Attack over Health (a real skew, but softer than Fangrend's glass cannons — think 60/40 splits rather than 75/25). Their engine is **conditional Pulse generation**: they profit when things die, when attacks are declared, when enemy cards are destroyed, when Mortality is lost. Interspersed throughout are effects that **destroy enemy support cards** (Relics, Auxiliary cards, Hexes, Rites, and Pacts).

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Ilsette, Novice of the Ninth Circle**
Hero Mode — Cost: 2 Pulse | Attack/Health: 40/20 | Rarity: Common
While Ilsette is in play, whenever an enemy Hero dies, gain 1 Pulse.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, whenever an enemy Relic or enemy Auxiliary card is destroyed, gain 1 Pulse.

**Quill, the Spark-Scribe**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Quill is in play, whenever you lose Mortality, gain 1 Pulse (maximum 2 Pulse per turn from this effect).
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, whenever a Hero you control dies, gain 1 Pulse.

**Corvus Hexwright**
Hero Mode — Cost: 3 Pulse | Attack/Health: 60/30 | Rarity: Common
The first time each turn Corvus declares an attack, gain 1 Pulse.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
Once per turn, you may pay 1 Pulse to look at one of your opponent's face-down Hexes. (You do not reveal it to anyone else, and it stays face-down.)

**Maelis the Unraveler**
Hero Mode — Cost: 4 Pulse | Attack/Health: 70/50 | Rarity: Common
Once per turn, you may pay 2 Pulse to destroy a Relic attached to an enemy Hero in this lane or a neighboring lane.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
When this card enters play, destroy one enemy Relic or enemy Auxiliary card of your choice, then destroy this card.

**Archivist Denna Vail**
Hero Mode — Cost: 4 Pulse | Attack/Health: 70/50 | Rarity: Uncommon
While Denna is in play, whenever an enemy Hex, Rite, or Pact is destroyed or fizzles, gain 1 Pulse and Denna gains +10 Attack until the end of your next turn.
Auxiliary Mode — Cost: 2 Pulse | 2 slots
Once per turn, you may pay 3 Pulse to destroy an enemy Rite or Pact.

**Sylvara Emberquill**
Hero Mode — Cost: 5 Pulse | Attack/Health: 90/60 | Rarity: Uncommon
While Sylvara is in play, whenever a Hero you control destroys an enemy Hero in combat, gain 2 Pulse.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, the first time each turn the Hero in this lane declares an attack, gain 1 Pulse.

**Thane Orrick Spellbreaker**
Hero Mode — Cost: 6 Pulse | Attack/Health: 100/80 | Rarity: Rare
While Orrick is in play, whenever an enemy Relic or enemy Auxiliary card is destroyed by any means, gain 2 Pulse. Once per turn, you may pay 2 Pulse to destroy an enemy Auxiliary card.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
Once per turn, when an enemy Relic or enemy Auxiliary card enters play, you may pay 2 Pulse to destroy it immediately.

**Miriel of the Drowned Library**
Hero Mode — Cost: 6 Pulse | Attack/Health: 110/70 | Rarity: Rare
Once per turn, you may pay any amount of Pulse (maximum 5): deal 10 damage to an enemy Hero in this lane or a neighboring lane for each 1 Pulse paid this way.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
At the start of each of your turns, if an enemy Hero died since the start of your previous turn, gain 2 Pulse.

**Zeraphel, Ninth Circle Ascendant**
Hero Mode — Cost: 8 Pulse | Attack/Health: 140/100 | Rarity: Ultra-Rare
While Zeraphel is in play, whenever any enemy card (Hero, Relic, Auxiliary, Hex, Rite, or Pact) is destroyed, gain 1 Pulse (maximum 3 Pulse per turn from this effect). Once per turn, you may pay 4 Pulse to destroy an enemy Auxiliary card.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, whenever you gain Pulse from a card effect, the Hero in this lane gains +10 Attack until end of turn.

**Grand Magus Ostrellan**
Hero Mode — Cost: 8 Pulse | Attack/Health: 150/90 | Rarity: Ultra-Rare
While Ostrellan is in play, whenever you cast an Incantation, you may pay 2 Pulse to resolve that Incantation's effect a second time (choosing new targets if needed). Once per turn only.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, your Incantations cost 1 less Pulse (minimum 1).

**Vhessune, the Living Sigil**
Hero Mode — Cost: 10 Pulse | Attack/Health: 170/130 | Rarity: Eternal
While Vhessune is in play, whenever any player declares an attack, gain 1 Pulse. Once per turn, you may pay 5 Pulse to destroy any one enemy Relic, Auxiliary card, Hex, Rite, or Pact.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
When this card enters play, destroy up to 2 enemy Relic and/or enemy Auxiliary cards. While in this slot, whenever an enemy Hero is destroyed, gain 3 Pulse.

### Relics

**Runed Focus** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +20 Attack.

**Siphon Band** — 1 slot | Cost: 2 Pulse
While equipped, whenever this Hero destroys an enemy Hero in combat, gain 2 Pulse.

**Nullglass Rod** — 1 slot | Cost: 3 Pulse
While equipped, whenever this Hero deals combat damage to an enemy Hero, you may destroy one Relic attached to that Hero.

**Mantle of Stolen Storms** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health. The first time each turn you gain Pulse from a card effect, gain 1 additional Pulse.

**Staff of Unmaking** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +50 Attack. Once per turn, you may pay 2 Pulse to destroy an enemy Hex, Rite, or Pact.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Tithing Ward** — Cost: 1 Pulse
When an enemy Hero attacks a Hero in this lane, gain 2 Pulse. After this effect triggers once, destroy this card.

**Rune of Recall** — Cost: 2 Pulse
When a Hero in this lane would die, instead return it to your hand (any Relics it was holding are still permanently destroyed). After this effect triggers once, destroy this card.

**Glyph of Reversal** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, swap the attacking Hero's Attack and Health values for that combat only. After this effect triggers once, destroy this card.

**Counterspell Glyph** — Cost: 3 Pulse
When your opponent casts an Incantation, negate its effect and destroy it. After this effect triggers once, destroy this card.

**Sigil of Shattering** — Cost: 3 Pulse
When an enemy Hero attacks a Hero in this lane, destroy all Relics attached to the attacking Hero before combat damage is calculated. After this effect triggers once, destroy this card.

### Rites
*(Delayed setup/payoff)*

**The Slow Unbinding** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, destroy up to 2 enemy Relic and/or enemy Auxiliary cards, then destroy this Rite. At any point before then, you may instead end this Rite early to destroy 1 enemy Relic or enemy Auxiliary card immediately.

**The Great Transmutation** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, gain 6 Pulse, then destroy this Rite. At any point before then, you may instead end this Rite early to gain 2 Pulse immediately.

**Inscription of Ruin** — Cost: 4 Pulse
This Rite gains 1 counter whenever an enemy Relic, Auxiliary card, Hex, Rite, or Pact is destroyed. When it reaches 3 counters, destroy this Rite and deal 80 damage to an enemy Hero of your choice.

**Reckoning of the Shattered Spire** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Burned Grimoire** — Cost: 1 Pulse
When this Pact resolves, discard 1 card, then destroy one enemy Relic or enemy Auxiliary card.

**Sacrificial Reagents** — Cost: 1 Pulse
When this Pact resolves, destroy one Relic or Auxiliary card you control. Gain 3 Pulse and draw 1 card.

**Pact of the Bleeding Sigil** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality, then gain 4 Pulse. (This Mortality loss triggers "whenever you lose Mortality" effects.)

**Overchannel** — Cost: 3 Pulse
When this Pact resolves, choose a Hero you control — it gains +50 Attack until end of turn, then takes 30 damage at the end of the turn.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Arcane Barter** — Cost: 2 Pulse
When this Incantation resolves, draw 2 cards, then discard 1 card.

**Unweave** — Cost: 3 Pulse
When this Incantation resolves, destroy up to 2 enemy Relic and/or enemy Auxiliary cards, then gain 1 Pulse for each card destroyed this way.

**Mana Detonation** — Cost: 4 Pulse
When this Incantation resolves, deal damage to an enemy Hero of your choice equal to 10 for every full 2 Pulse you have banked after paying this card's cost (maximum 60 damage).

---

## Appendix D: Balemaw Realm — Full Card Set

**Realm identity:** Bargain-binding demons of the Red Gate. Balemaw Heroes carry even, dependable stat lines — no glass cannons, no walls — because their power lives in **sabotage**. Their effects weaken enemy stats (some conditionally, triggered by what the opponent does; some as direct, immediate debuffs) and **deny functions outright**: blocking Relic play in a lane, forbidding redirects, silencing abilities, and taxing the opponent's Pulse. See the Stat Reduction vs. Damage clarification at the top of this document.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Grish, Pit-Spawned**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Grish is in play, the enemy Hero in the opposing lane continuously has −10 Attack.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the enemy Hero in the lane opposing this one continuously has −10 Attack.

**Skitter, the Nettle Imp**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
When Skitter enters play, an enemy Hero of your choice gets −20 Attack until the end of your next turn.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
When this card enters play, an enemy Hero of your choice permanently loses 20 Health (this is a stat reduction, not damage), then destroy this card.

**Vessa the Whisper-Tongue**
Hero Mode — Cost: 3 Pulse | Attack/Health: 50/40 | Rarity: Common
While Vessa is in play, whenever your opponent plays a Hero, that Hero enters play with −10 Attack permanently.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, enemy Heroes attacking this lane have −10 Attack during that combat.

**Morgruth Chainhide**
Hero Mode — Cost: 4 Pulse | Attack/Health: 60/60 | Rarity: Common
While Morgruth is in play, your opponent cannot attach Relics to the Hero in the opposing lane.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the enemy Hero in the lane opposing this one cannot be healed.

**Nharessa, Bride of Ash**
Hero Mode — Cost: 5 Pulse | Attack/Health: 80/70 | Rarity: Uncommon
While Nharessa is in play, whenever your opponent plays a Hero, all enemy Heroes get −10 Attack until the end of your next turn.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, the first Hero your opponent plays each turn costs them 1 additional Pulse.

**Baelgor the Shackler**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
Once per turn, you may pay 2 Pulse to choose an enemy Hero — it cannot attack during your opponent's next turn.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
While in this slot, enemy Heroes cannot redirect attacks into this lane (they may only attack it from the directly opposing lane).

**Ozzhûl, Eater of Names**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
Once per turn, you may pay 3 Pulse to choose an enemy Hero: its ability text is blank (has no effect) until the start of your next turn.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, enemy Auxiliary cards in the lane opposing this one have no effect.

**Draveth, Broker of Agonies**
Hero Mode — Cost: 6 Pulse | Attack/Health: 100/80 | Rarity: Rare
Once per turn, you may pay 2 Pulse: an enemy Hero of your choice gets −20 Attack until end of turn, and Draveth gains +20 Attack until end of turn.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, whenever an enemy Hero's Attack or Health is reduced by one of your card effects, gain 1 Pulse (maximum 2 Pulse per turn from this effect).

**Kravvax, Warden of the Red Gate**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
When Kravvax enters play, choose one of your opponent's lanes: while Kravvax remains in play, your opponent cannot play Relics or Auxiliary cards into that lane. Whenever an enemy Hero attacks Kravvax, that Hero has −30 Attack for that combat.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, at the start of each of your turns, all enemy Heroes get −10 Attack until end of turn.

**Mother Vhûl, the Hollow Choir**
Hero Mode — Cost: 8 Pulse | Attack/Health: 130/110 | Rarity: Ultra-Rare
When Mother Vhûl enters play, all enemy Heroes permanently lose 20 Health (stat reduction, not damage). While she is in play, whenever an enemy Hero dies, all remaining enemy Heroes get −10 Attack permanently.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, your opponent's Hexes cost 1 additional Pulse to pay for when they trigger (if they cannot pay, the Hex fizzles as normal).

**Azhmordai, the Final Bargain**
Hero Mode — Cost: 10 Pulse | Attack/Health: 150/150 | Rarity: Eternal
When Azhmordai enters play, choose one card type (Relic, Hex, Rite, Pact, or Incantation): while Azhmordai remains in play, your opponent cannot play cards of that type. While Azhmordai is in play, all enemy Heroes continuously have −20 Attack.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
When this card enters play, your opponent discards 1 card of their choice. While this card is in play, all enemy Heroes continuously have −30 Attack and −30 Health, and whenever your opponent plays a Hero, that Hero enters play with −20 Attack permanently.

### Relics

**Cinder Brand** — 1 slot | Cost: 1 Pulse
While equipped, the enemy Hero in the opposing lane continuously has −10 Attack.

**Yoke of Torment** — 1 slot | Cost: 2 Pulse
While equipped, whenever this Hero deals combat damage to an enemy Hero, that Hero gets −10 Attack permanently.

**Mask of the Usurper** — 1 slot | Cost: 3 Pulse
While equipped, this Hero continuously has +20 Attack, and an additional +20 Attack while the enemy Hero in the opposing lane has reduced Attack or Health.

**Chains of the Red Gate** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health. The enemy Hero in the opposing lane cannot redirect its attacks — it may only attack this Hero's lane.

**Crown of Hollow Kings** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +40 Attack and +40 Health. Once per turn, you may pay 2 Pulse to give an enemy Hero of your choice −20 Attack until end of turn.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Toll of Anguish** — Cost: 1 Pulse
When your opponent plays a Hero, that Hero enters play with −10 Attack and −10 Health permanently. After this effect triggers once, destroy this card.

**Snare of Despair** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, that Hero gets −20 Attack permanently. After this effect triggers once, destroy this card.

**Feast of Failure** — Cost: 2 Pulse
When an enemy Onslaught fails against a Hero in this lane, all Heroes that participated in that Onslaught get −20 Attack permanently. After this effect triggers once, destroy this card.

**Whispered Treason** — Cost: 4 Pulse
When an enemy Hero declares an attack against this lane, redirect that attack to another enemy Hero of your choice, if one exists — the attacker fights its own ally, resolving combat as normal. After this effect triggers once, destroy this card.

**Gate of Thorns** — Cost: 5 Pulse
The first time each turn an enemy Hero attacks this lane, that Hero takes 20 damage and has −10 Attack for that combat. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Summons of the Red Gate** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, the next Balemaw Hero you play this game costs 3 less Pulse (minimum 1), then destroy this Rite. At any point before then, you may instead end this Rite early to make your next Balemaw Hero cost 1 less Pulse.

**Litany of Rot** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, all enemy Heroes permanently lose 30 Health (stat reduction, not damage), then destroy this Rite. At any point before then, you may instead end this Rite early — all enemy Heroes permanently lose 10 Health immediately.

**The Gathering Dark** — Cost: 4 Pulse
This Rite gains 1 counter whenever an enemy Hero's Attack or Health is reduced by one of your card effects (maximum 1 counter per turn). When it reaches 4 counters, destroy this Rite and give an enemy Hero of your choice −50 Attack permanently.

**Reckoning of the Abyss** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**The Devourer's Due** — Cost: 1 Pulse
When this Pact resolves, destroy a Hero you control in any lane. All enemy Heroes get −20 Attack until the end of your next turn.

**Blood Tithe** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. An enemy Hero of your choice gets −30 Attack permanently.

**Contract of Chains** — Cost: 2 Pulse
When this Pact resolves, choose a Hero you control — it cannot attack next turn. Then choose an enemy Hero — it cannot attack during your opponent's next turn.

**Bargain of Broken Wills** — Cost: 3 Pulse
When this Pact resolves, discard 1 card. Enemy Heroes cannot redirect their attacks during your opponent's next turn.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Tongue of Lies** — Cost: 3 Pulse
When this Incantation resolves, choose an enemy Hero: its ability text is blank (has no effect) and it has −20 Attack until the start of your next turn.

**Sealed Gate** — Cost: 4 Pulse
When this Incantation resolves, choose one of your opponent's lanes. Your opponent cannot play any cards into that lane (Heroes, Relics, or Auxiliary cards) until the start of your next turn.

**Wave of Withering** — Cost: 5 Pulse
When this Incantation resolves, all enemy Heroes permanently lose 20 Health (stat reduction, not damage).

---

## Appendix E: Gildharbor Realm — Full Card Set

**Realm identity:** Merchant princes of a great trading port — coin, contracts, and hired shields. Gildharbor Heroes have weak Attack and high Health (roughly the inverse of Fangrend), and they are the game's premier **Pulse farmers**: most of their economy is unconditional ("at the start of each of your turns, gain X Pulse"), supported by effects that **boost Health** and **block or divert attacks**. A few single-use support pieces pay out conditionally when you gain Pulse, rewarding the realm's own engine.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Dockhand Petro**
Hero Mode — Cost: 2 Pulse | Attack/Health: 20/40 | Rarity: Common
At the start of each of your turns, gain 1 Pulse.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +30 Health.

**Old Bassam, Ledger-Keeper**
Hero Mode — Cost: 2 Pulse | Attack/Health: 20/40 | Rarity: Common
Once per turn, you may pay 2 Pulse to give a Hero you control +20 Health permanently.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
The next time you gain Pulse from another card effect, gain 2 additional Pulse, then destroy this card.

**Mira the Coinwright**
Hero Mode — Cost: 3 Pulse | Attack/Health: 30/60 | Rarity: Common
While Mira is in play, whenever you gain Pulse from a card effect, Mira gains +10 Health permanently (maximum +20 Health per turn from this effect).
Auxiliary Mode — Cost: 1 Pulse | 1 slot
At the start of each of your turns, gain 1 Pulse.

**Harbor-Guard Tessio**
Hero Mode — Cost: 4 Pulse | Attack/Health: 40/80 | Rarity: Common
While Tessio is in play, when an enemy Hero attacks a Hero you control in a neighboring lane, you may redirect that attack to Tessio instead.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the first time each turn the Hero in this lane would take combat damage, prevent 10 of that damage.

**Sindar the Toll-Master**
Hero Mode — Cost: 4 Pulse | Attack/Health: 40/80 | Rarity: Uncommon
While Sindar is in play, whenever an enemy Hero declares an attack, gain 1 Pulse.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +20 Health and heals 10 Health at the start of each of your turns.

**Captain Zarah of the Amber Fleet**
Hero Mode — Cost: 5 Pulse | Attack/Health: 50/100 | Rarity: Uncommon
At the start of each of your turns, gain 1 Pulse. Whenever you gain Pulse from a card effect, Zarah heals 10 Health.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
At the start of each of your turns, gain 2 Pulse.

**Guildmother Ottavia**
Hero Mode — Cost: 6 Pulse | Attack/Health: 60/120 | Rarity: Rare
At the start of each of your turns, gain 2 Pulse.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, all Heroes you control continuously have +20 Health.

**Benedar, Broker of Shields**
Hero Mode — Cost: 6 Pulse | Attack/Health: 70/110 | Rarity: Rare
Once per turn, you may pay 3 Pulse: the first attack declared against any Hero you control during your opponent's next turn is blocked — no combat occurs and no damage is dealt to either side.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
Once per turn, when a Hero you control is attacked, you may pay 2 Pulse to redirect that attack to the Hero in this lane instead.

**Nassrin, the Gilded Tide**
Hero Mode — Cost: 8 Pulse | Attack/Health: 90/150 | Rarity: Ultra-Rare
At the start of each of your turns, gain 2 Pulse. Once per turn, you may pay 4 Pulse to give a Hero you control +40 Health permanently.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
At the start of each of your turns, gain 1 Pulse for every full 10 Pulse you have banked (maximum 3 Pulse per turn from this effect).

**Admiral Corvazzo Ten-Fleets**
Hero Mode — Cost: 8 Pulse | Attack/Health: 100/140 | Rarity: Ultra-Rare
While Corvazzo is in play, whenever an enemy Hero attacks any other Hero you control, you may pay 2 Pulse to redirect that attack to Corvazzo instead (once per enemy attack).
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, whenever an enemy attack is blocked, prevented, or redirected by one of your card effects, gain 2 Pulse.

**Qeth-Amun, the Everflowing Purse**
Hero Mode — Cost: 10 Pulse | Attack/Health: 100/200 | Rarity: Eternal
At the start of each of your turns, gain 3 Pulse. While Qeth-Amun is in play, all Heroes you control continuously have +50 Health, and each Hero you control heals 10 Health at the start of each of your turns.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
At the start of each of your turns, gain 2 Pulse. Whenever you gain Pulse from any card effect, all Heroes you control heal 10 Health.

### Relics

**Coinmail Vest** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +20 Health.

**Ledger of Standing Accounts** — 1 slot | Cost: 2 Pulse
While equipped, at the start of each of your turns, gain 1 Pulse.

**Banner of Safe Passage** — 1 slot | Cost: 3 Pulse
While equipped, the first time each turn this Hero would take combat damage, prevent 20 of that damage.

**The Guild Charter** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +20 Attack and +40 Health. At the start of each of your turns, gain 1 Pulse.

**Colossus of the Harbor Gate** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +80 Health. When an enemy Hero redirects an attack into another of your lanes, you may pay 1 Pulse to pull that attack to this Hero instead.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Toll Gate** — Cost: 1 Pulse
When an enemy Hero attacks a Hero in this lane, gain 2 Pulse and prevent 10 of the combat damage dealt to your Hero. After this effect triggers once, destroy this card.

**Hired Blades** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, the defending Hero gains +30 Attack for that combat only. After this effect triggers once, destroy this card.

**Insurance Policy** — Cost: 2 Pulse
When a Hero in this lane dies, gain Pulse equal to that Hero's printed cost and draw 1 card. After this effect triggers once, destroy this card.

**Escort Detail** — Cost: 3 Pulse
When an enemy Hero attacks a Hero you control in a neighboring lane, redirect that attack to the Hero in this lane. After this effect triggers once, destroy this card.

**Closed Port** — Cost: 5 Pulse
The first time each turn a Hero in this lane would take combat damage, prevent 30 of that damage. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Slow-Built Bulwark** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, your Hero in this lane permanently gains +10 Attack and +50 Health, then destroy this Rite. At any point before then, you may instead end this Rite early, granting +30 Health immediately instead.

**The Long Voyage** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, gain 7 Pulse and draw 1 card, then destroy this Rite. At any point before then, you may instead end this Rite early to gain 3 Pulse immediately.

**Oath of the Guild Compact** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns. When it reaches 3 counters, destroy this Rite and give each Gildharbor Hero you control +40 Health permanently.

**Reckoning of the Broken Contract** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Loan Against the Tide** — Cost: 1 Pulse
When this Pact resolves, gain 4 Pulse immediately. At the start of your next turn, your flat base Pulse gain is 2 instead of 5.

**Cargo Manifest** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Gain 3 Pulse and a Hero you control gains +20 Health permanently.

**Protection Money** — Cost: 2 Pulse
When this Pact resolves, choose a Hero you control — it cannot attack next turn. That Hero gains +30 Health permanently and you gain 2 Pulse.

**Buyout** — Cost: 3 Pulse
When this Pact resolves, destroy a Relic you control. Gain Pulse equal to double that Relic's printed cost.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Emergency Provisions** — Cost: 3 Pulse
When this Incantation resolves, choose up to 2 Heroes you control — each heals 30 Health, then each gains +10 Health permanently.

**Flood the Market** — Cost: 4 Pulse
When this Incantation resolves, draw 2 cards, then gain 1 Pulse for each Gildharbor Hero you control.

**Hold the Line** — Cost: 5 Pulse
When this Incantation resolves, all Heroes you control continuously have +40 Health until the start of your next turn.

---

## Appendix F: Ankhara Realm — Full Card Set

**Realm identity:** Tomb-kings and priest-generals of a sun-scorched river empire. Ankhara Heroes carry balanced, even stat lines, and their signature mechanic is **Attack stealing**: draining Attack from enemy Heroes and claiming it for their own, most often during battle. Their strongest cards drain **every enemy Hero at once**. A secondary theme punishes enemy deployment — enemy Heroes entering play weakened (unlike Balemaw's versions, Ankhara's typically *transfer* what is taken) — rounded out with straightforward stat boosts, augmentation, and enemy support-card destruction.

**Stealing rule:** When a card "steals" Attack, two things happen simultaneously: the victim's Attack is reduced (this follows the Stat Reduction vs. Damage rules in Section 8) and the thief gains that much Attack as a normal boost. Both sides last for the duration stated on the card. The thief keeps its gained Attack for the stated duration even if the drained Hero leaves play.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Senb, Tomb-Sweeper**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
When Senb declares an attack, steal 10 Attack from the defending Hero for that combat only.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, when the Hero in this lane is attacked, steal 10 Attack from the attacking Hero for that combat only (the Hero in this lane gains it).

**Nefiri, Handmaiden of Dusk**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Nefiri is in play, whenever your opponent plays a Hero, that Hero enters play with −10 Health permanently.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +10 Attack and +10 Health.

**Khaftep the Embalmer**
Hero Mode — Cost: 3 Pulse | Attack/Health: 50/40 | Rarity: Common
Once per turn, you may pay 2 Pulse to destroy a Relic attached to an enemy Hero in this lane or a neighboring lane.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
When this card enters play, a Hero you control gains +10 Attack and +10 Health permanently, then destroy this card.

**Userhet, Oath-Sworn Blade**
Hero Mode — Cost: 4 Pulse | Attack/Health: 60/60 | Rarity: Common
When Userhet attacks or is attacked, steal 20 Attack from the enemy Hero in that combat, for that combat only.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +20 Attack.

**Priestess Amunet of the Veil**
Hero Mode — Cost: 5 Pulse | Attack/Health: 80/70 | Rarity: Uncommon
While Amunet is in play, whenever your opponent plays a Hero, that Hero enters play with −10 Attack permanently, and Amunet gains +10 Attack permanently.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, whenever an enemy Hero attacks this lane, the Hero in this lane gains +10 Attack permanently after that combat resolves.

**Sethnakh, Warden of Jackals**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
Once per turn, you may pay 3 Pulse to steal 10 Attack from an enemy Hero of your choice permanently.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
While in this slot, when an enemy Hero attacks this lane, steal 10 Attack from the attacker for that combat only (the Hero in this lane gains it).

**Rahotep, Sun-Crowned General**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
When Rahotep declares an attack, steal 20 Attack from the defending Hero for that combat only. If Rahotep destroys that Hero in the combat, the steal becomes permanent instead.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, when the Hero in this lane declares an attack, steal 10 Attack from the defending Hero for that combat only.

**Ithara, Mistress of a Thousand Names**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
While Ithara is in play, whenever your opponent plays a Hero, all Ankhara Heroes you control gain +10 Attack until the end of your next turn.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
Once per turn, you may pay 2 Pulse to destroy an enemy Relic or enemy Auxiliary card.

**Pharaoh Neferkha the Undying**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
When Neferkha enters play, steal 10 Attack from every enemy Hero permanently (each enemy Hero gets −10 Attack, and Neferkha gains +10 Attack for each Hero drained this way).
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, whenever your opponent plays a Hero, that Hero enters play with −10 Attack and −10 Health permanently.

**Khonsahr, the Devouring Moon**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
Once per turn, you may pay 3 Pulse to steal 20 Attack from an enemy Hero of your choice until the end of your next turn.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, the first time each turn a Hero you control destroys an enemy Hero in combat, the Hero in this lane gains +20 Attack permanently.

**Osiraket, God-King of the Silent River**
Hero Mode — Cost: 10 Pulse | Attack/Health: 150/150 | Rarity: Eternal
At the start of each of your turns, steal 10 Attack from every enemy Hero until the start of your next turn (each enemy Hero gets −10 Attack, and Osiraket gains +10 Attack for each Hero drained this way).
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, whenever any enemy Hero declares an attack, steal 20 Attack from it for that combat only (the defending Hero you control gains it).

### Relics

**Scarab Amulet** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +10 Attack and +10 Health.

**Khopesh of the Drinker** — 1 slot | Cost: 2 Pulse
While equipped, when this Hero declares an attack, steal 10 Attack from the defending Hero for that combat only.

**Death Mask of Kings** — 1 slot | Cost: 3 Pulse
While equipped, whenever this Hero destroys an enemy Hero in combat, this Hero gains +10 Attack and +10 Health permanently.

**Sarcophagus Plate** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health. The first time this Hero would die, it instead survives with 10 Health, then destroy this Relic.

**Crown of the Two Rivers** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +40 Attack and +40 Health. Whenever your opponent plays a Hero, this Hero gains +10 Attack permanently.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Jackal's Toll** — Cost: 2 Pulse
When your opponent plays a Hero, that Hero enters play with −10 Attack permanently, and the Hero in this lane gains +10 Attack permanently. After this effect triggers once, destroy this card.

**Curse of the Defiler** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, steal 20 Attack from the attacker for that combat only (the defending Hero gains it). After this effect triggers once, destroy this card.

**Mirror of Thoth** — Cost: 3 Pulse
When an enemy Hero attacks a Hero in this lane, the defending Hero's Attack becomes equal to the attacker's Attack for that combat only. After this effect triggers once, destroy this card.

**The Weighing of Hearts** — Cost: 3 Pulse
When an enemy Hero attacks a Hero in this lane and fails to destroy it, that enemy Hero gets −30 Attack permanently. After this effect triggers once, destroy this card.

**Plague of Locusts** — Cost: 4 Pulse
When your opponent plays a Hero, all enemy Heroes get −10 Attack until the end of your next turn. After this effect triggers once, destroy this card.

### Rites
*(Delayed setup/payoff)*

**Raising of the Obelisk** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, the Hero in this lane permanently gains +30 Attack and +30 Health, then destroy this Rite. At any point before then, you may instead end this Rite early — the Hero in this lane gains +10 Attack and +10 Health permanently immediately.

**The Long Mummification** — Cost: 4 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, play a Hero card of cost 6 or less from your discard pile into an empty lane without paying its cost, then destroy this Rite. At any point before then, you may instead end this Rite early to return a Hero card from your discard pile to your hand.

**Oath of the Dynasty** — Cost: 4 Pulse
This Rite gains 1 counter whenever one of your card effects steals Attack from an enemy Hero (maximum 1 counter per turn). When it reaches 3 counters, destroy this Rite and give all Ankhara Heroes you control +20 Attack permanently.

**Reckoning of the Silent River** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Offering to the Jackal God** — Cost: 1 Pulse
When this Pact resolves, destroy a Hero you control. Another Hero you control permanently gains Attack equal to half the destroyed Hero's printed Attack (rounded to the nearest 10).

**Tribute of Blood** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. Steal 20 Attack from an enemy Hero of your choice permanently (a Hero you control gains it).

**Unsealing the Vault** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Destroy one enemy Relic or enemy Auxiliary card, and a Hero you control gains +10 Attack permanently.

**Bargain with Eternity** — Cost: 3 Pulse
When this Pact resolves, choose a Hero you control — it cannot attack next turn. It gains +30 Attack and +30 Health permanently.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Gaze of the Sphinx** — Cost: 3 Pulse
When this Incantation resolves, steal 30 Attack from an enemy Hero of your choice until the start of your next turn (a Hero you control of your choice gains it).

**Sands of Ruin** — Cost: 4 Pulse
When this Incantation resolves, destroy one enemy Relic or enemy Auxiliary card, and an enemy Hero of your choice gets −20 Attack until the end of your next turn.

**Hand of the Devourer** — Cost: 5 Pulse
When this Incantation resolves, steal 10 Attack from every enemy Hero permanently (each enemy Hero gets −10 Attack, and a Hero you control of your choice gains +10 Attack for each Hero drained this way).

---

## Appendix G: Karakhorde Realm — Full Card Set

**Realm identity:** Horse-lords of the endless steppe. Karakhorde Heroes are Attack-leaning (a Runespire-like skew) with a cheap, aggressive curve, and their signature freedom is **unbound targeting**: many Karakhorde Heroes and effects may attack *any* enemy lane — not just the opposing or neighboring ones — striking wherever the enemy is weakest without ever leaving their own lane. Supporting themes are **momentum** (permanent Attack growth from relentless attacking) and Onslaught payoffs, plus effects that reduce the counter-damage a rider takes while attacking.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Temu, Steppe Scout**
Hero Mode — Cost: 2 Pulse | Attack/Health: 40/20 | Rarity: Common
Temu may attack any enemy lane, not just his opposing or neighboring lanes.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane may attack any enemy lane.

**Borja the Unbroken**
Hero Mode — Cost: 2 Pulse | Attack/Health: 40/20 | Rarity: Common
Whenever Borja declares an attack, he gains +10 Attack permanently.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, whenever the Hero in this lane declares an attack, it gains +10 Attack until the end of your next turn.

**Khulan Swift-Bow**
Hero Mode — Cost: 3 Pulse | Attack/Health: 60/30 | Rarity: Common
Khulan may attack any enemy lane. When she attacks a lane other than her directly opposing lane, she takes 10 less combat damage from that combat.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, when the Hero in this lane attacks a lane other than its directly opposing lane, it takes 10 less combat damage from that combat.

**Ogedei Twin-Blades**
Hero Mode — Cost: 4 Pulse | Attack/Health: 70/50 | Rarity: Common
When Ogedei participates in an Onslaught, he gains +20 Attack for that combat.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, Heroes you control attacking the same target as the Hero in this lane gain +10 Attack for that combat.

**Chagatai, Breaker of Gates**
Hero Mode — Cost: 5 Pulse | Attack/Health: 90/60 | Rarity: Uncommon
Chagatai may attack any enemy lane. Whenever Chagatai destroys an enemy Hero in combat, he gains +20 Attack permanently.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, whenever a Hero you control destroys an enemy Hero in combat, the Hero in this lane gains +10 Attack permanently.

**Yesugen, Horde-Mother**
Hero Mode — Cost: 5 Pulse | Attack/Health: 90/60 | Rarity: Uncommon
While Yesugen is in play, when you declare an Onslaught, each participating Hero gains +10 Attack for that combat.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
While in this slot, all Heroes you control may attack any enemy lane.

**Subotai the Far-Striker**
Hero Mode — Cost: 6 Pulse | Attack/Health: 110/70 | Rarity: Rare
Subotai may attack any enemy lane. The first time each turn Subotai attacks a lane other than his directly opposing lane, he takes no counter-damage from that combat.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, when the Hero in this lane attacks a lane other than its directly opposing lane, it gains +20 Attack for that combat.

**Khatun Erdene of the White Banner**
Hero Mode — Cost: 6 Pulse | Attack/Health: 100/80 | Rarity: Rare
At the start of each of your turns, if Erdene attacked last turn, she gains +20 Attack permanently.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, at the start of each of your turns, if the Hero in this lane attacked last turn, it gains +10 Attack permanently.

**Jebe, Arrow of the Endless Sky**
Hero Mode — Cost: 8 Pulse | Attack/Health: 150/90 | Rarity: Ultra-Rare
Jebe may attack any enemy lane and takes 20 less combat damage in any combat he initiates. Whenever Jebe destroys an enemy Hero in combat, gain 2 Pulse.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, all Heroes you control may attack any enemy lane.

**Tolui Stormhoof**
Hero Mode — Cost: 8 Pulse | Attack/Health: 140/100 | Rarity: Ultra-Rare
When Tolui participates in an Onslaught, all participating Heroes gain +20 Attack for that combat, and the defending Hero's controller cannot prevent, block, or redirect damage during that combat.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, whenever two or more Heroes you control attack on the same turn, gain 2 Pulse (once per turn).

**Khagan Temurzhin, Sky-Chosen**
Hero Mode — Cost: 10 Pulse | Attack/Health: 180/120 | Rarity: Eternal
Temurzhin may attack any enemy lane. Whenever any Hero you control declares an attack, Temurzhin gains +10 Attack until end of turn. Whenever Temurzhin destroys an enemy Hero in combat, he gains +20 Attack permanently and you gain 1 Pulse.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, all Heroes you control may attack any enemy lane, and Heroes you control participating in an Onslaught gain +10 Attack for that combat.

### Relics

**Steppe Recurve** — 1 slot | Cost: 1 Pulse
While equipped, this Hero may attack any enemy lane.

**Bloodmare Saddle** — 1 slot | Cost: 2 Pulse
While equipped, this Hero has +20 Attack during combats it initiates (not while defending).

**Wolf-Tail Standard** — 1 slot | Cost: 3 Pulse
While equipped, when this Hero participates in an Onslaught, all participating Heroes gain +10 Attack for that combat.

**Armor of the Red Wind** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +40 Attack and +20 Health, and takes 10 less combat damage in combats it initiates.

**The Khagan's Warbanner** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health, may attack any enemy lane, and takes 20 less combat damage when attacking a lane other than its directly opposing lane.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**The Open Steppe** — Cost: 1 Pulse
When an enemy Hero attacks a Hero in this lane, gain 1 Pulse and draw 1 card. After this effect triggers once, destroy this card.

**Poisoned Wells** — Cost: 2 Pulse
When your opponent plays a Hero, that Hero cannot attack during your opponent's next turn. After this effect triggers once, destroy this card.

**Hidden Riders** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, another Hero you control of your choice joins the defense, adding half its Attack (rounded to the nearest 10) to the defender's Attack for that combat. After this effect triggers once, destroy this card.

**Feigned Retreat** — Cost: 3 Pulse
When an enemy Hero attacks a Hero in this lane, cancel that combat; the Hero in this lane may then immediately attack the enemy Hero that attacked, with +20 Attack for that combat. After this effect triggers once, destroy this card.

**Thunder of Hooves** — Cost: 4 Pulse
The first time each turn the Hero in this lane declares an attack, it gains +20 Attack for that combat. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Gathering of the Clans** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, all Karakhorde Heroes you control gain +10 Attack permanently, then destroy this Rite. At any point before then, you may instead end this Rite early — one Hero you control gains +10 Attack permanently immediately.

**The Long Ride** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, until the end of your following turn, all Heroes you control may attack any enemy lane and gain +10 Attack during combats they initiate; then destroy this Rite. At any point before then, you may instead end this Rite early — one Hero you control may attack any enemy lane until the end of your next turn.

**Oath of the Eternal Sky** — Cost: 4 Pulse
This Rite gains 1 counter whenever a Hero you control destroys an enemy Hero in combat (maximum 1 counter per turn). When it reaches 3 counters, destroy this Rite and give all Karakhorde Heroes you control +20 Attack permanently.

**Reckoning of the Thundering Steppe** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Scorched Pastures** — Cost: 1 Pulse
When this Pact resolves, destroy an Auxiliary card you control. All Heroes you control gain +10 Attack until end of turn.

**Blood Brotherhood** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Two Heroes you control each gain +20 Attack until the end of your next turn.

**Tribute or Ruin** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. A Hero you control permanently gains the ability to attack any enemy lane.

**The Khan's Demand** — Cost: 3 Pulse
When this Pact resolves, a Hero you control gains +40 Attack permanently and loses 20 Health permanently (stat reduction, not damage).

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Ride Them Down** — Cost: 3 Pulse
When this Incantation resolves, choose a Hero you control: until end of turn, it may attack any enemy lane and has +20 Attack.

**Arrow Storm** — Cost: 4 Pulse
When this Incantation resolves, deal 20 damage to each of up to 3 different enemy Heroes of your choice.

**Break the Line** — Cost: 5 Pulse
When this Incantation resolves, until end of turn, all Heroes you control may attack any enemy lane, and your opponent's damage-prevention, attack-blocking, and redirect effects cannot trigger.

---

## Appendix H: Deepforge Realm — Full Card Set

**Realm identity:** Master-smiths of the mountain vaults. Deepforge Heroes are Health-leaning and durable, and the realm's power flows through **Relics** — the strongest in the game, and a toolkit that serves any deck it's splashed into: searching your deck for Relic cards of *any* realm (tutoring), reducing Relic costs, protecting Relics from destruction, **re-forging** (moving a Relic between your Heroes — normally impossible), recovering Relics from death, and **forge counters** that grow Relics over time.

**Forge counters:** A Relic with forge counters grants its equipped Hero an additional +10 Attack and +10 Health per counter, continuously. Counters stay on the Relic if it is moved to another Hero.

*(Reminder per the global Relic rule: Relics may only be attached to Heroes of their own realm. Deepforge's tutoring, cost-reduction, protection, and forge-counter effects work on Relics of any realm.)*

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Boldur Hammerhand**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Boldur has a Relic equipped, he continuously has +10 Attack and +10 Health.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, Relics you play cost 1 less Pulse (minimum 1).

**Nissa Coalbraid**
Hero Mode — Cost: 2 Pulse | Attack/Health: 20/40 | Rarity: Common
When Nissa enters play, you may search your deck for a Relic card, reveal it, and put it into your hand, then shuffle your deck.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
When this card enters play, search your deck for a Relic card costing 2 or less, reveal it, and put it into your hand, then shuffle your deck. Then destroy this card.

**Torvin Deepdelver**
Hero Mode — Cost: 3 Pulse | Attack/Health: 40/50 | Rarity: Common
Once per turn, you may pay 1 Pulse to move a Relic from one Hero you control to another Hero you control (slot limits and realm restrictions still apply).
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, once per turn, when a Hero you control dies, you may return one of its equipped Relics to your hand instead of destroying it.

**Hegga Shieldwright**
Hero Mode — Cost: 4 Pulse | Attack/Health: 50/70 | Rarity: Common
While Hegga has a Relic equipped, enemy Heroes attacking her have −10 Attack for that combat.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, each Relic equipped to the Hero in this lane grants an additional +10 Health.

**Karrick Vaultwarden**
Hero Mode — Cost: 4 Pulse | Attack/Health: 50/70 | Rarity: Uncommon
Relics equipped to Karrick cannot be destroyed by enemy card effects.
Auxiliary Mode — Cost: 2 Pulse | 2 slots
While in this slot, Relics equipped to Heroes you control in neighboring lanes cannot be destroyed by enemy card effects.

**Runa Emberveil**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
While Runa is in play, whenever you play a Relic, Runa gains +10 Attack and +10 Health permanently.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, whenever you play a Relic, gain 1 Pulse.

**Forgemaster Dvalna**
Hero Mode — Cost: 6 Pulse | Attack/Health: 80/100 | Rarity: Rare
Once per turn, you may pay 2 Pulse to place a forge counter on a Relic you control.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, at the start of each of your turns, place a forge counter on a Relic equipped to the Hero in this lane.

**Brokkir Gemtongue**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
When Brokkir enters play, you may attach a Relic card from your hand to a Hero you control without paying its cost.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, the first time each turn you play a Relic, draw 1 card.

**Queen Mardis Ironroot**
Hero Mode — Cost: 8 Pulse | Attack/Health: 110/130 | Rarity: Ultra-Rare
When Mardis enters play, search your deck for up to 2 Relic cards, reveal them, and put them into your hand, then shuffle your deck. While Mardis is in play, your Relics cost 1 less Pulse to play (minimum 1).
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, all Relics equipped to Heroes you control grant an additional +10 Attack and +10 Health.

**Thraindor, the Anvil Ascendant**
Hero Mode — Cost: 8 Pulse | Attack/Health: 110/130 | Rarity: Ultra-Rare
While both of Thraindor's Relic slots are filled, he continuously has +30 Attack and +30 Health, and his Relics cannot be destroyed by enemy card effects.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, once per turn, you may pay 2 Pulse to move a Relic from one Hero you control to another Hero you control (slot limits and realm restrictions still apply).

**Durgan Worldshaper, First of the Forge**
Hero Mode — Cost: 10 Pulse | Attack/Health: 130/170 | Rarity: Eternal
While Durgan is in play, all Relics equipped to Heroes you control grant double their printed Attack and Health bonuses (other Relic effects are not doubled).
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, at the start of each of your turns, place a forge counter on each of up to 2 different Relics you control.

### Relics
*(Deepforge's smithing shows: these run slightly above the standard Relic curve — that premium is the realm's identity.)*

**Forgeheart Band** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +20 Attack and +10 Health.

**Stonewall Pavise** — 1 slot | Cost: 2 Pulse
While equipped, this Hero continuously has +40 Health, and the first time each turn this Hero takes combat damage, prevent 10 of that damage.

**Grudgekeeper's Axe** — 1 slot | Cost: 3 Pulse
While equipped, this Hero continuously has +30 Attack. Whenever this Hero is attacked, it gains +10 Attack permanently after that combat resolves.

**Mountainheart Plate** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +40 Attack and +50 Health.

**The Worldshaper's Hammer** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +50 Attack and +40 Health. Once per turn, you may pay 1 Pulse to place a forge counter on this Relic.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Hidden Vein** — Cost: 1 Pulse
When an enemy Hero attacks a Hero in this lane, search your deck for a Relic card costing 2 or less, reveal it, and put it into your hand, then shuffle your deck. After this effect triggers once, destroy this card.

**Anvil Ward** — Cost: 2 Pulse
When an enemy card effect would destroy a Relic you control, prevent that destruction. After this effect triggers once, destroy this card.

**Molten Reprisal** — Cost: 2 Pulse
When an enemy Hero destroys a Hero you control in this lane in combat, that enemy Hero takes 40 damage. After this effect triggers once, destroy this card.

**Collapsing Tunnel** — Cost: 3 Pulse
When an enemy Hero attacks a Hero in this lane, cancel that combat and deal 20 damage to the attacking Hero. After this effect triggers once, destroy this card.

**The Deep Door** — Cost: 4 Pulse
The first time each turn a Hero in this lane would take combat damage, prevent 20 of that damage — or 30 if that Hero has a Relic equipped. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Stoking the Great Forge** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, return a Relic card from your discard pile to your hand and gain 1 Pulse, then destroy this Rite. At any point before then, you may instead end this Rite early to gain 1 Pulse immediately.

**The Masterwork** — Cost: 4 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, attach a Relic card from your hand to a Hero you control without paying its cost, and place 2 forge counters on it; then destroy this Rite. At any point before then, you may instead end this Rite early — Relics you play this turn cost 2 less Pulse (minimum 1).

**Oath of Stone** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns. When it reaches 3 counters, destroy this Rite and give all Deepforge Heroes you control +10 Attack and +30 Health permanently.

**Reckoning of the Molten Deep** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Smelt It Down** — Cost: 1 Pulse
When this Pact resolves, destroy a Relic you control. Gain Pulse equal to its printed cost and draw 1 card.

**Grudge Ledger** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. Search your deck for any Relic card, reveal it, and put it into your hand, then shuffle your deck.

**Overtempered** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Place 2 forge counters on a Relic you control.

**Seal the Vault** — Cost: 3 Pulse
When this Pact resolves, choose a Hero you control — it cannot attack next turn. It gains +20 Health permanently, and you may attach a Relic card from your hand to it, paying 2 less Pulse (minimum 1).

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Word of the Anvil** — Cost: 2 Pulse
When this Incantation resolves, search your deck for a Relic card, reveal it, and put it into your hand, then shuffle your deck.

**Shatterquake** — Cost: 4 Pulse
When this Incantation resolves, destroy up to 2 Relics attached to enemy Heroes. For each Relic destroyed this way, deal 20 damage to the Hero that held it.

**The Mountain Endures** — Cost: 5 Pulse
When this Incantation resolves, each Hero you control with at least one Relic equipped gains +20 Attack and +20 Health permanently.

---

## Appendix I: Aurelium Realm — Full Card Set

**Realm identity:** Disciplined legions of a marble empire. Aurelium Heroes carry perfectly even stat lines and win through **formation**: the game's first positional realm, where Heroes grow stronger while *allied Heroes of any realm* hold neighboring lanes — making Aurelium a natural backbone for diverse, multi-realm decks. Its second pillar is **Testudo** (sharing or absorbing combat damage for adjacent allies), and its third is **Triumph** (rewards for destroying enemy Heroes in combat).

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Legionary Marcus Vell**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While a Hero you control occupies a lane neighboring Marcus, he continuously has +10 Attack and +10 Health.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, Heroes you control in neighboring lanes continuously have +10 Health.

**Standard-Bearer Quinta**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Quinta is in play, Heroes you control in lanes neighboring hers continuously have +10 Attack.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +10 Attack and +10 Health.

**Centurion Drusus**
Hero Mode — Cost: 3 Pulse | Attack/Health: 50/40 | Rarity: Common
While Heroes you control occupy both lanes neighboring Drusus, he continuously has +20 Attack.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, when the Hero in this lane is attacked and a Hero you control occupies a neighboring lane, the attacker has −10 Attack for that combat.

**Shield-Brother Varro**
Hero Mode — Cost: 4 Pulse | Attack/Health: 60/60 | Rarity: Common
Testudo — When a Hero you control in a lane neighboring Varro would take combat damage, you may have Varro take half of that damage instead (rounded to the nearest 10).
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, the Hero in this lane takes 10 less combat damage while a Hero you control occupies a neighboring lane.

**Tribune Livia Sorel**
Hero Mode — Cost: 5 Pulse | Attack/Health: 80/70 | Rarity: Uncommon
While Livia is in play, whenever a Hero you control destroys an enemy Hero in combat, all Heroes you control in lanes neighboring the victor gain +10 Attack permanently.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, the first time each turn a Hero you control destroys an enemy Hero in combat, the Hero in this lane gains +10 Attack and +10 Health permanently.

**Praefect Gaius Mund**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
While Gaius is in play, when you declare an Onslaught, each participating Hero that has an allied Hero in a neighboring lane gains +10 Attack and takes 10 less combat damage for that combat.
Auxiliary Mode — Cost: 3 Pulse | 2 slots
While in this slot, Heroes you control in neighboring lanes continuously have +10 Attack and +10 Health.

**Legatus Octavia Ferrix**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
Triumph — The first time each turn Octavia destroys an enemy Hero in combat, gain 2 Pulse and draw 1 card.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, whenever any Hero you control destroys an enemy Hero in combat, gain 1 Pulse (maximum 2 Pulse per turn from this effect).

**Aquilifer Titus Crow**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
While Titus is in play, every Hero you control that has an allied Hero in a neighboring lane continuously has +10 Attack and +10 Health.
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, if Heroes you control occupy both lanes neighboring this one, those two Heroes continuously have +20 Attack.

**Consul Aurelia Vanth**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
When Aurelia enters play, each Hero you control with an allied Hero in a neighboring lane gains +20 Attack and +20 Health permanently.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
Testudo — While in this slot, when any Hero you control would take combat damage, if a Hero you control occupies a lane neighboring it, prevent 10 of that damage.

**Praetorian Kaeso the Wall**
Hero Mode — Cost: 8 Pulse | Attack/Health: 120/120 | Rarity: Ultra-Rare
Testudo — When any Hero you control would take combat damage, you may have Kaeso take half of that damage instead (rounded to the nearest 10), regardless of lane. Enemy Heroes attacking Kaeso have −20 Attack for that combat.
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, the Hero in this lane and Heroes you control in neighboring lanes take 10 less combat damage.

**Imperator Severan Ashmark, the Undefeated**
Hero Mode — Cost: 10 Pulse | Attack/Health: 150/150 | Rarity: Eternal
While Severan is in play, every Hero you control that has an allied Hero in a neighboring lane continuously has +20 Attack and +20 Health. Triumph — whenever a Hero you control destroys an enemy Hero in combat, gain 1 Pulse.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, when you declare an Onslaught, each participating Hero gains +20 Attack for that combat and takes 20 less combat damage in it.

### Relics

**Legion Gladius** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +10 Attack, and an additional +10 Attack while an allied Hero occupies a neighboring lane.

**Scutum of the Ninth** — 1 slot | Cost: 2 Pulse
While equipped, this Hero continuously has +30 Health, and takes 10 less combat damage while an allied Hero occupies a neighboring lane.

**Laurel of Triumph** — 1 slot | Cost: 3 Pulse
While equipped, whenever this Hero destroys an enemy Hero in combat, gain 1 Pulse and this Hero gains +10 Health permanently.

**Eagle Standard of the First** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health, and Heroes you control in neighboring lanes continuously have +10 Attack.

**Lorica of the Imperator** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +40 Attack and +40 Health. Testudo — once per turn, when an allied Hero in a neighboring lane would take combat damage, this Hero may take half of that damage instead (rounded to the nearest 10).

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**Pilum Volley** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, that attacker takes 20 damage before combat damage is calculated. After this effect triggers once, destroy this card.

**Shield Wall** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, prevent 20 of the combat damage dealt to your Hero — or 30 if an allied Hero occupies a neighboring lane. After this effect triggers once, destroy this card.

**Fortified Camp** — Cost: 3 Pulse
When an enemy Onslaught is declared against a Hero in this lane, each attacking Hero has −20 Attack for that combat. After this effect triggers once, destroy this card.

**Crossing the Rubicon** — Cost: 4 Pulse
When the Hero in this lane destroys an enemy Hero in combat, it gains +20 Attack and +20 Health permanently and you draw 1 card. After this effect triggers once, destroy this card.

**The Triumph Gate** — Cost: 5 Pulse
The first time each turn a Hero you control destroys an enemy Hero in combat, gain 1 Pulse and the victorious Hero gains +10 Health permanently. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Raising the Legion** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, the next Hero you play costs 2 less Pulse (minimum 1) and enters play with +10 Attack and +10 Health permanently; then destroy this Rite. At any point before then, you may instead end this Rite early — the next Hero you play costs 1 less Pulse.

**The Census** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, gain 1 Pulse and draw 1 card for every 2 Heroes you control (rounded up, maximum 3 of each), then destroy this Rite. At any point before then, you may instead end this Rite early to draw 1 card.

**Oath of the Legion** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns during which you control 2 or more Heroes. When it reaches 3 counters, destroy this Rite and give all Heroes you control (of any realm) +10 Attack and +20 Health permanently.

**Reckoning of the Broken Standard** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Decimation** — Cost: 1 Pulse
When this Pact resolves, destroy a Hero you control. All other Heroes you control gain +10 Attack and +10 Health permanently.

**Spoils of War** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Gain 2 Pulse, and a Hero you control gains +20 Health permanently.

**Blood on the Senate Floor** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. Destroy one enemy Relic or enemy Auxiliary card, and draw 1 card.

**March or Die** — Cost: 3 Pulse
When this Pact resolves, all Heroes you control gain +20 Attack until end of turn. Each Hero you control that does not attack this turn takes 20 damage at end of turn.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**Form Ranks** — Cost: 3 Pulse
When this Incantation resolves, until the start of your next turn, every Hero you control with an allied Hero in a neighboring lane has +20 Attack and +20 Health.

**Javelin Rain** — Cost: 4 Pulse
When this Incantation resolves, deal 30 damage to an enemy Hero of your choice and 20 damage to each enemy Hero in the lanes neighboring it.

**Veni Vidi Vici** — Cost: 5 Pulse
When this Incantation resolves, choose a Hero you control: it gains +30 Attack until end of turn. If it destroys an enemy Hero in combat this turn, it gains +30 Attack and +30 Health permanently and you gain 2 Pulse.

---

## Appendix J: Oathenhall Realm — Full Card Set

**Realm identity:** Kings, marshals, and sworn knights of the high feudal court. Oathenhall Heroes carry modest, Health-leaning bodies — the realm doesn't win fights itself, it **organizes them**. Its light Pulse and card-draw support keeps your hand full, but its true power is **command**: standing orders that let your *other* Heroes (of any Realm) act beyond their normal limits — striking twice, attacking together as one, counter-attacking, and rallying around a chosen Champion. Oathenhall rewards diverse, multi-Realm decks and makes every other Realm hit harder than it could alone.

**Knighting / your Champion:** Some cards "Knight" a Hero you control, making it your **Champion**. You may only have one Champion at a time — Knighting a new Hero removes the title from the previous one. A Hero keeps the title until it leaves play or is replaced. The title itself does nothing; cards that reference "your Champion" grant the benefits.

**Joint Strike:** Two Heroes you control in neighboring lanes attack a single enemy lane together as **one combat**: their Attacks are added together against the defender, and the combat damage dealt back is split as evenly as possible between the two attackers (rounded to multiples of 10, your choice on uneven splits). A Joint Strike counts as both Heroes attacking that turn.

### Heroes
*(Each Hero card lists both its Hero Mode and Auxiliary Mode)*

**Page Wilm**
Hero Mode — Cost: 2 Pulse | Attack/Health: 20/40 | Rarity: Common
When Wilm enters play, draw 1 card.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, at the start of each of your turns, if you control 3 or more Heroes, gain 1 Pulse.

**Herald Josselin**
Hero Mode — Cost: 2 Pulse | Attack/Health: 30/30 | Rarity: Common
While Josselin is in play, the first Hero you play each turn costs 1 less Pulse (minimum 1).
Auxiliary Mode — Cost: 1 Pulse | 1 slot
When this card enters play, draw 1 card, then destroy this card.

**Sir Aldous the Steadfast**
Hero Mode — Cost: 3 Pulse | Attack/Health: 40/50 | Rarity: Common
Once per turn, when Sir Aldous is attacked and survives the combat, he may immediately attack the Hero that attacked him.
Auxiliary Mode — Cost: 1 Pulse | 1 slot
While in this slot, the Hero in this lane continuously has +10 Attack and +10 Health.

**Marshal Berrick**
Hero Mode — Cost: 4 Pulse | Attack/Health: 50/70 | Rarity: Common
Once per turn, you may pay 2 Pulse: a Hero you control in a lane neighboring Berrick gains +20 Attack until end of turn.
Auxiliary Mode — Cost: 2 Pulse | 1 slot
While in this slot, Heroes you control in neighboring lanes gain +10 Attack during combats they initiate.

**Chancellor Hubert Mott**
Hero Mode — Cost: 4 Pulse | Attack/Health: 50/70 | Rarity: Uncommon
At the start of each of your turns, if you control Heroes from 2 or more different Realms, gain 1 Pulse.
Auxiliary Mode — Cost: 2 Pulse | 2 slots
While in this slot, at the start of each of your turns, if you control Heroes from 3 or more different Realms, draw 1 card.

**Dame Rosalind of the Vale**
Hero Mode — Cost: 5 Pulse | Attack/Health: 70/80 | Rarity: Uncommon
Once per turn, you may pay 3 Pulse to Knight a Hero you control (it becomes your Champion). While Rosalind is in play, your Champion continuously has +20 Attack and +20 Health.
Auxiliary Mode — Cost: 3 Pulse | 1 slot
While in this slot, your Champion continuously has +10 Attack and +10 Health, and heals 10 Health at the start of each of your turns.

**Sir Gareth Twicesworn**
Hero Mode — Cost: 6 Pulse | Attack/Health: 80/100 | Rarity: Rare
Once per turn, you may pay 3 Pulse: choose another Hero you control — it may attack twice this turn.
Auxiliary Mode — Cost: 4 Pulse | 2 slots
While in this slot, once per turn, you may pay 3 Pulse: a Hero you control in a lane neighboring this one may attack twice this turn.

**Warden Elsbeth of the Twin Banners**
Hero Mode — Cost: 6 Pulse | Attack/Health: 90/90 | Rarity: Rare
Once per turn, Elsbeth and a Hero you control in a lane neighboring her may perform a Joint Strike (see Joint Strike rule).
Auxiliary Mode — Cost: 4 Pulse | 1 slot
While in this slot, when Heroes you control perform a Joint Strike, each gains +10 Attack for that combat.

**Lord Commander Ravenshold**
Hero Mode — Cost: 8 Pulse | Attack/Health: 110/130 | Rarity: Ultra-Rare
Once per turn, you may pay 2 Pulse: two Heroes you control in neighboring lanes may perform a Joint Strike this turn. While Ravenshold is in play, Heroes you control performing Joint Strikes gain +10 Attack for that combat.
Auxiliary Mode — Cost: 6 Pulse | 2 slots
While in this slot, once per turn, when a Hero you control is attacked, another Hero you control in a lane neighboring the defender may add half its Attack (rounded to the nearest 10) to the defender's Attack for that combat.

**Queen Isolde the Unifier**
Hero Mode — Cost: 8 Pulse | Attack/Health: 110/130 | Rarity: Ultra-Rare
While Isolde is in play, all Heroes you control continuously have +10 Attack and +10 Health for each different Realm among the Heroes you control (maximum +20 Attack and +20 Health).
Auxiliary Mode — Cost: 6 Pulse | 1 slot
While in this slot, at the start of each of your turns, gain 1 Pulse; if you control Heroes from 3 or more different Realms, also draw 1 card.

**High King Aldemar Oathenkeeper**
Hero Mode — Cost: 10 Pulse | Attack/Health: 140/160 | Rarity: Eternal
When Aldemar enters play, Knight a Hero you control (it becomes your Champion). While Aldemar is in play, your Champion continuously has +30 Attack and +30 Health and may attack twice each turn, and at the start of each of your turns you gain 1 Pulse and draw 1 card.
Auxiliary Mode — Cost: 8 Pulse | 2 slots
While in this slot, once per turn, two Heroes you control in neighboring lanes may perform a Joint Strike, and Heroes you control gain +10 Attack during Joint Strikes.

### Relics

**Squire's Oathband** — 1 slot | Cost: 1 Pulse
While equipped, this Hero continuously has +10 Attack and +10 Health — or +20 Attack and +20 Health if this Hero is your Champion.

**Heraldic Shield** — 1 slot | Cost: 2 Pulse
While equipped, this Hero continuously has +30 Health. Once per turn, when this Hero survives being attacked, gain 1 Pulse.

**Sword of Sworn Service** — 1 slot | Cost: 3 Pulse
While equipped, this Hero continuously has +10 Attack for each other Hero you control (maximum +30 Attack).

**Crown Regalia of Oathenhall** — 2 slots | Cost: 4 Pulse
While equipped, this Hero continuously has +30 Attack and +30 Health. When this Relic is equipped, you may Knight this Hero (it becomes your Champion).

**The Unifier's Banner** — 2 slots | Cost: 5 Pulse
While equipped, this Hero continuously has +30 Attack and +40 Health, and Heroes you control in neighboring lanes continuously have +10 Attack and +10 Health.

### Hexes
*(Played face-down, cost paid at the moment they trigger, may be paid for during either player's turn)*

**The King's Levy** — Cost: 1 Pulse
When your opponent plays a Hero, gain 1 Pulse and draw 1 card. After this effect triggers once, destroy this card.

**Call to Arms** — Cost: 2 Pulse
When an enemy Hero attacks a Hero in this lane, the defender gains +10 Attack and +20 Health for that combat only. After this effect triggers once, destroy this card.

**Oathbound Vengeance** — Cost: 3 Pulse
When the Hero in this lane is destroyed in combat, Knight another Hero you control (it becomes your Champion) and it gains +20 Attack permanently. After this effect triggers once, destroy this card.

**Counter-Charge** — Cost: 4 Pulse
When an enemy Hero attacks a Hero in this lane and the defender survives, the defender and one Hero you control in a neighboring lane may immediately perform a Joint Strike against the attacking Hero. After this effect triggers once, destroy this card.

**Standing Garrison** — Cost: 5 Pulse
The first time each turn the Hero in this lane is attacked and survives, it may immediately attack the Hero that attacked it. This card is not destroyed after triggering and may trigger again on future turns.

### Rites
*(Delayed setup/payoff)*

**Mustering the Banners** — Cost: 2 Pulse
Starting the turn after this Rite is played, count 2 of your turns. At the end of the 2nd counted turn, gain 2 Pulse and draw 2 cards, then destroy this Rite. At any point before then, you may instead end this Rite early to draw 1 card immediately.

**The Coronation** — Cost: 3 Pulse
Starting the turn after this Rite is played, count 3 of your turns. At the end of the 3rd counted turn, Knight a Hero you control (it becomes your Champion) and it gains +30 Attack and +30 Health permanently, then destroy this Rite. At any point before then, you may instead end this Rite early to Knight a Hero you control (no stat bonus).

**Oath of Fealty** — Cost: 4 Pulse
This Rite gains 1 counter at the start of each of your turns during which you control 3 or more Heroes. When it reaches 3 counters, destroy this Rite; your Champion gains +40 Attack and +40 Health permanently, and each other Hero you control gains +10 Attack and +10 Health permanently.

**Reckoning of the Broken Oath** — Cost: 5 Pulse
Starting the turn after this Rite is played, count 4 of your turns. At the end of the 4th counted turn, deal 120 damage to a Hero of your choice, then destroy this Rite. At any point before then, you may instead end this Rite early to deal 50 damage to a Hero of your choice immediately.

### Pacts
*(Risk/reward, cost varies by card)*

**Conscription** — Cost: 1 Pulse
When this Pact resolves, destroy an Auxiliary card you control. The next Hero you play this turn costs 2 less Pulse (minimum 1) and enters play with +10 Attack and +10 Health permanently.

**Royal Decree** — Cost: 2 Pulse
When this Pact resolves, discard 1 card. Two Heroes you control in neighboring lanes may perform a Joint Strike this turn.

**The King's Ransom** — Cost: 2 Pulse
When this Pact resolves, lose 20 Mortality. Gain 3 Pulse and draw 1 card.

**Feast of Allegiance** — Cost: 3 Pulse
When this Pact resolves, choose a Hero you control — it cannot attack next turn. Gain 2 Pulse, draw 1 card, and that Hero gains +20 Health permanently.

### Incantations
*(Direct spells, no full board wipes, no unconditional Mortality burn)*

**By Royal Command** — Cost: 3 Pulse
When this Incantation resolves, choose a Hero you control: it may attack twice this turn.

**Rally the Realms** — Cost: 4 Pulse
When this Incantation resolves, all Heroes you control gain +10 Attack until end of turn — or +20 Attack if you control Heroes from 3 or more different Realms. Draw 1 card.

**For King and Country** — Cost: 5 Pulse
When this Incantation resolves, until end of turn: your Champion has +20 Attack and may attack twice, and all other Heroes you control have +10 Attack.
