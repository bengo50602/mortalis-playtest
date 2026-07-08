# Mortalis: Realms — Playtest Program

A self-contained playtest app for the Mortalis: Realms card game (Core Rules v1.7, all 15 realms, 480 cards).

## How to run it

Double-click **index.html** — it opens in your browser. No install, no internet needed.
(It also runs in the Claude Code preview panel, or via `python3 -m http.server` if you prefer.)

## Sharing & publishing updates

The game is hosted on GitHub Pages — one link for all your playtesters:
**https://bengo50602.github.io/mortalis-playtest/**

Two ways to make changes; both end the same way:

**A) Rules-document workflow (the Claude "Mortalis: Realms" project):**
1. Update the rules document in the Claude project as usual
2. Download the document (it lands in Downloads — any `.md` name containing "mortalis" and "rules" works)
3. Double-click **Publish update.command** — the entire card database and rule text are rebuilt from the document, then published

**B) In-app workflow:**
1. Edit cards/constants/rules inside the playtest app, click **Export** (saves a `.json` to Downloads)
2. Double-click **Publish update.command**

If both exist, whichever is newer wins — a newly downloaded rules document becomes the single source of truth and clears older in-app publishes. If the document's card format ever drifts so far the parser can't read it, publishing safely aborts with a message instead of pushing a broken game.

The published data lands in `custom.js`: visitors get your cards/rules as their defaults (their own experiments stay local to their browsers; the Reset button returns them to your published version). `mortalis_playtest.html` is the offline single-file copy for people you'd rather send a file than a link.

## Playing

1. **Setup screen** (every new game): pick AI difficulty (Easy / Medium / Hard), assign a realm to each of your 4 lanes (repeats allowed), choose the AI's realms (random or hand-picked), and who goes first. Both 50-card decks auto-build from the chosen realms.
2. **Board**: AI on top, you on the bottom. Each lane shows its realm, 1 Hero slot, 2 Auxiliary slots, and the Hero's 2 Relic slots. Each side has 4 shared slots for Hexes / Rites / Pacts (Incantations resolve through an open slot).
3. **Click any card to zoom it** — hand, board, or slots. The zoomed card shows the exact rulebook text plus action buttons (Play as Hero, Play as Aux, Equip, Set face-down, Begin Rite, Cast, resolve-Rite-early, etc.).
4. **Attacking**: click your Hero to select it (click more Heroes to build an Onslaught), then click the red-highlighted target — or the AI's Mortality when a direct attack is legal. Redirects, Onslaughts, Overkill, fatigue, and the first-player restrictions all follow v1.7.
5. **Hexes** trigger automatically when their condition fires; you'll be asked to pay the Pulse cost at that moment (Cancel = fizzle), exactly per the rules.
6. **Undo** rolls back any number of steps (including a whole AI turn). **Sandbox tools** let you adjudicate anything by hand: adjust Mortality/Pulse, draw, add any card to your hand, and (via zooming a Hero) damage / heal / buff / destroy.

## Editing (the whole point)

- **Edit cards** tab: every card's name, realm, type, cost, Attack/Health, rarity, slots, and ability text. Duplicate, delete, or create new cards. Changes save instantly to your browser and stat/cost changes apply even mid-game.
- **Edit rules** tab: the 16 game constants that drive the engine (starting Mortality, Pulse per turn, hand size, deck size, copy limit, aux discount, fatigue, first-player rules…) plus your full working copy of the v1.7 rule text.
- **Export / Import**: download all your edits as a JSON file; import it later or on another machine. **Reset to v1.7** restores rulebook defaults.

### How scripted card behavior works

The engine re-reads every card's text and compiles wording it recognizes into real behavior (auras like "continuously has +20 Attack", "deal N damage…", "draw N", "gain N Pulse", stat reductions, sacrifices, hex triggers, rite timers, "can't attack", and more). The badge in the editor shows each card's status:

- **auto / partial** — some or all of the text is enforced by the engine (the badge lists what).
- **manual** (amber dot on the card) — the text is displayed but not enforced; the card still plays for its stats and cost, and you adjudicate the effect with the sandbox tools, like playing with physical cards.

Because compilation is wording-based, if you write ability text using the rulebook's phrasing, your new/edited cards often become scripted automatically.

## Files

| File | What it is |
|---|---|
| `index.html` | The app shell + styling |
| `engine.js` | All game rules, the text-to-effect compiler, combat, and the 3 AI levels — plain readable JS, edit freely |
| `ui.js` | Rendering and interaction |
| `cards.js` / `rules.js` | Default card database + rule text, **generated** from `rules_v1_7.md` |
| `rules_v1_7.md` | Your rulebook (copied from Downloads) |
| `build_data.py` | Regenerates `cards.js`/`rules.js` from the rulebook: `python3 build_data.py` |

Two editing layers: quick tweaks in the app (saved in the browser, exportable), or permanent changes by editing `rules_v1_7.md` and re-running `build_data.py` (then "Reset to v1.7" in the app to pick them up).

## AI levels

- **Easy** — plays and attacks mostly at random.
- **Medium** — curves out Heroes, equips Relics, only takes favorable trades, gangs up when a kill is guaranteed.
- **Hard** — Medium plus: checks for lethal, banks Pulse for its Hexes, prefers blocking your strongest lanes, and uses damage spells to finish off wounded Heroes.
