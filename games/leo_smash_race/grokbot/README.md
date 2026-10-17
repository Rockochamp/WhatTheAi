# Leo's Smash Race (Grokbot build)

Designed by Leo, age 4. Static HTML/CSS/JS, no build step. Pick a hero, solve a 2x2 colour cube (3x3 Pro optional) for a full boost, then auto-drive a ~90 s side-scrolling race on 3 snap lanes: jump/fly and boost with two giant buttons, smash things for combos up to x5. No fail state.

| File | Purpose |
|---|---|
| `game.html` | Page, screens, HUD and controls; every script/style URL carries `?v=` |
| `sim.js` | Pure race simulation (vehicles, tracks, custom physics, smashing, combos, rivals, scoring); runs in Node for tests |
| `cube.js` | 2x2/3x3 cube logic, hint/Help solver stack and the canvas renderer |
| `game.js` | Loop (fixed timestep), DPR canvas renderer + camera + parallax, input, debris/particles, screens, saves |
| `assets.js` | Manifest-driven loader: real art when present, interim vector art otherwise |
| `proc.js` | Interim vector art (replaced automatically by real sprites) |
| `audio.js` | WebAudio synth SFX, horns, engine and music; mute is remembered |
| `rank.js` | Optional world board on the shared Firestore project (collection `leaderboard_leo_smash_race_grokbot_v1`, kid-safe preset names only) |
| `art/manifest.js`, `art/ART_SPEC.md` | Where real art goes and how |

Local preview: from the repo root run `python3 -m http.server 8765` and open http://127.0.0.1:8765/games/leo_smash_race/grokbot/game.html (`?seed=42` gives a repeatable track). Tests: `node --test tests/leo_smash_race.test.mjs`.
