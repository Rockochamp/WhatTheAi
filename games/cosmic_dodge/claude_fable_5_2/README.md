# Cosmic Dodge — Claude Fable 5.2 edition

Served at `/games/cosmic_dodge/cosmic_dodge_claude_fable_5_2.html`. Static files only: no build step, no downloads at runtime, no third-party scripts except the site's existing Firebase leaderboard on `whatthe.ai`.

## The idea

The other editions ask you to stay away from the rocks. This one pays you to fly close.

- **Graze.** Passing within 36 units of a hazard's edge without touching it is a graze. Each one adds 5 to 10 Flow depending on how close it was.
- **Flow.** One meter, two jobs. It multiplies every point (×1 at the 24-point reserve, one step every 12 Flow, ×8 at 100), and it is the fuel for Warp. Above the reserve it decays after 2.5 seconds without a graze.
- **Warp.** Hold to slow the world to 32% speed while the ship keeps 85% of its own. It burns 22 Flow per second, so every escape costs multiplier.
- **Shield.** You start with one. A hit breaks it, clears everything within 270 units and gives 1.6 seconds of safety. A mint hexagon restores it about 24 seconds later, or at the next sector.

Ten rocks outlasted is one level, as in the other editions. The field is 1000 units tall and as wide as the screen allows (560 to 1600 units). Wider fields hold proportionally more rocks, and each one is worth proportionally less, so "ten rocks per level" holds exactly at 800 units and level pace is the same on a phone and a monitor.

## Sectors and formations

A director composes the field from formations instead of pure random rain. A new sector begins every five levels with a short breather, a bonus and a new kind of trouble.

| Levels | Sector | Adds |
| --- | --- | --- |
| 1–5 | Quiet Orbit | rain, walls with openings, chevrons, corridors |
| 6–10 | Glass Belt | spinning bars, diagonal streams of ice shards |
| 11–15 | Ember Reach | comets (lane warning first), rocks that split in three |
| 16–20 | Serpent Drift | weaving ribbons, pincers |
| 21–25 | Crosswind | rocks from the sides (edge warning first) |
| 26–30 | Terminal Light | everything |

After level 30 the sectors repeat with a numeral and speed keeps rising. Fall speed is `290 + 25 × (level − 1)` units per second up to level 30, then `+8` per level. Hazard rate is `1.6 + 0.2 × (level − 1)` per second at the reference width, capped at 7.6. Walls always leave an opening of at least 150 units; the tests check this at every width.

## Two kinds of run

- **Endless** uses a random seed.
- **Today's run** seeds the field from the UTC date, so everyone flies the same formations, and has its own ranking that starts again at midnight UTC.

The simulation is deterministic: fixed 1/120 s steps, one seeded generator, no wall-clock reads. The same seed and inputs replay identically, which is what makes the daily run fair and the tests exact.

## Controls

Keyboard (WASD or arrows, Space or Shift to warp, P or Escape to pause, M to mute), mouse (the ship follows the cursor, left button warps), touch (relative drag, a second finger or the Warp button warps) and gamepad (left stick or d-pad, A or a trigger warps, Start pauses). Focus loss pauses the run.

## Files

- `engine.js` — simulation, formations, and the autopilot that flies the demo behind the menu and the test runs.
- `renderer.js` — canvas drawing. Nebulae are layered value noise per sector; rocks are seeded polygons rendered once to sprites; glow is additive sprites, never `shadowBlur`.
- `audio.js` — "Slipstream", an original score synthesised with Web Audio (F-sharp minor, 116 BPM). Layers join as the level rises, grazes play notes from the scale, and warping closes a low-pass filter over the mix.
- `records.js` — record shape, validation and ranking.
- `game.js`, `game.css` — lifecycle, input, instruments, dialogs.
- Shared with the other Claude editions: `/js/fable/kit.js` (storage, nicknames, leaderboard client, sound toolkit) and `/css/fable.css` (fonts, buttons, dialogs).

Fonts are Unbounded and Hanken Grotesk, self-hosted from `/fonts` under the SIL Open Font License.

## Records

Device records live in `localStorage` under `fable_board_cosmic_dodge_claude_fable_5_2_v1`. On `whatthe.ai` the game also writes to Firestore:

- `leaderboard_cosmic_dodge_claude_fable_5_2_v1` — endless runs, ranked by score.
- `leaderboard_cosmic_dodge_claude_fable_5_2_v1_daily` — daily runs, filtered by `day`.
- `globalStats/stats_cosmic_dodge_claude_fable_5_2_v1` — run counter.

Field names follow the site's other boards (`playerName`, `score`, `timestamp`, `version`). If the project's security rules do not allow these collection names yet, the game keeps working with device records and says so on the result screen. Scores are client-reported and casual, like every board on the site.

## Checks

`node --test tests/cosmic_dodge_claude.test.mjs` covers determinism, level pacing at every width, grazing, shields, warp, tunnelling, every formation at three widths, wall openings, warnings, records and the page's element wiring. On `localhost` the page exposes `window.__cosmicDodge` so browser checks can jump to later sectors.
