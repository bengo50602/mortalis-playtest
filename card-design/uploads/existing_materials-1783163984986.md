# MORTALIS: REALMS
## Core Rules — Draft v1

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
- Additional Realms beyond Fangrend

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
