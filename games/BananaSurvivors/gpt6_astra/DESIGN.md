# Banana Survivors — Astra design notes

## Original review

Reviewed and played `../game.html` (Gemini 3 Pro / Gold Edition). The premise is excellent: a plucky banana against meat monsters, automatic fire, XP pickups, dash invulnerability, loot, splitters and a boss every 45 seconds. Preserve that identity and keep the original selectable.

The main shortcomings are an empty grid arena; mostly indistinguishable pursuit enemies; slow, small percentage upgrades competing against the much stronger extra projectile; exponential boss HP without matching growth; unclear mouse/keyboard switching; double-tap-only mobile dash; no run persistence or ranking. Technical problems include unbounded enemy/particle/gem objects, quadratic separation, per-hit DOM effects and GPU allocations, discarded XP overflow, wall-clock wave transitions that ignore pause, and no blur/input reset.

## Successor direction

Hand-painted 2.5D jungle arcade. Warm banana gold, moonlit teal foliage, coral enemies and unmistakable amber danger warnings. Expressive sprites, squash/stretch, recoil, trails, luminous pickups and carefully limited hit effects. The hero stays readable through a horde. UI is quiet during play and rich only when the player has time to choose.

- Keep automatic nearest-enemy targeting, with keyboard/arrow movement, held mouse steering, floating touch stick and a separate thumb dash button. Dash is directional, invulnerable, edge-triggered, and leaves a damaging peel trail after its upgrade.
- 50-second escalating waves with alternating champion patterns: telegraphed charge, ground slam and radial projectiles. Bosses grant recovery, XP collection and a chosen reward. Progression uses elapsed waves, not the player's level, so collecting XP never secretly punishes the player.
- Five weapon families, four equipped slots, five ranks each. Rank five transforms a weapon into its evolution. Eight supporting perks offer distinct builds. Three unique choices; two rerolls per run. Preserve excess XP and queue multiple level-ups safely.
- Short-lived combo multiplier rewards engaging the horde. Kills charge a temporary overripe frenzy. Optional supply caches give movement a purpose and provide healing or powerups. Keep heal, screen-clear and overdrive drops from the original.
- Save every completed run in the session and the best 100 runs locally. Global rankings use a new collection in the site's existing backend, with immutable run IDs and idempotent submission. Preview runs never submit global records.
- Endless wave progression, honest run summaries, weapon evolution tracking, quick restart and all rules visible in help. No ads, paid progression, login or grind requirements.

## Implementation constraints

Pure fixed-step simulation; all run timers freeze during menus, blur and hidden tabs. Separate seeded presentation randomness. Spatial indexing for hits, strict effect/entity budgets, cached sprite silhouettes, pixel-density cap, reduced effects and motion options. Canvas 2D keeps the game playable without a WebGL dependency. Full page and modal scrolling remain available outside the play canvas. Test mobile portrait/landscape, pointer cancellation, choices, pause, death, replay/restart, storage failure and score retries.


## Stage challenge follow-up · v5

The reported XP-62 plateau exposed finite upgrade choices and pressure that eventually stopped demanding new decisions. The successor loop separates XP from stage progression: 50-second hunt → sealed boss showdown → healing, upgrade and reroll → next stage. No final stage. Stage 20 is an aspirational skill target, not a guaranteed win rate.

Bosses alternate three attacks, enrage halfway through the fight, expose short damage windows and eventually tighten the arena. Their escorts stay bounded. Early readable counters remain valid late: cross charge lanes, leave circles, find projectile gaps, save the dash and move closer during recovery. Multiplicative enemy health and quadratic damage outgrow additive mastery bonuses without increasing render budgets. The four repeatable masteries trade general damage, boss specialization, durability and active dash recovery; no finished build falls back to healing alone.

Illustrated pickups distinguish effects by shape as well as color, with larger silhouettes for supplies and value tiers for XP. A ward offers a single mistake buffer; frost buys room against the horde. UI explicitly says STAGE and XP LV, displays the stage objective and names boss attacks. The stage challenge gets a current-only ruleset-3 board so old endless-wave scores do not compete with its new rules; old data remains intact.
