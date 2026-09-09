# Cosmic Dodge: Astra Run

The GPT-6 Astra edition of Cosmic Dodge. It is a standalone Canvas game within the existing whatthe.ai static site. GPT-6 Astra is the authoring-model attribution; gameplay does not call an AI model API.

Open `/games/cosmic_dodge/cosmic_dodge_gpt6_astra.html` from a static server serving the repository root. No build or package installation is required. The browser modules use `.js` so the existing host serves the correct JavaScript content type. The local `package.json` only declares module syntax for Node-based tests.

## Controls and scoring

- Arrow keys or A/D: steer. Drag on the play area for mouse or touch steering.
- Space or the Phase button: 0.9 seconds of protection, with a 6-second cooldown.
- P, Escape, or Pause: pause/resume. Losing window focus or hiding the tab pauses automatically.
- Three hull segments; repair cells restore one segment.
- Survival earns 20 points/second. Starlight earns 50 times the current multiplier. Close calls raise the multiplier up to 5 and earn 60 times that multiplier. The chain expires after five seconds without another close call.

## Files

- `engine.js`: seeded, DOM-independent simulation. The controller advances it in fixed 1/120-second steps.
- `game.js`: Canvas rendering, input, interface, sound effects, and run lifecycle.
- `records.js`: safe local persistence and optional Firebase leaderboard access.
- `game.css`: responsive flight-deck styling, including touch and fullscreen controls.

## Records

Personal records are saved under `cosmic_dodge_gpt6_astra_records_v1`. When browser storage is unavailable, records remain usable for the current session.

On `whatthe.ai` and `www.whatthe.ai`, completed runs also use the existing Firebase project and a separate collection, `leaderboard_cosmic_dodge_gpt6_astra`. The global counter uses `globalStats/stats_cosmic_dodge_gpt6_astra`. Run IDs and a transaction avoid double-counting retries. The worldwide query uses one sort field (`score`) and renders names as text.

Other hosts and file previews keep scores local. Database access failures do not prevent gameplay. Production Firestore rules must permit the intended reads and transactions; those rules are managed outside this repository and were not changed or tested with live writes. Client-submitted scores retain the trust limitations of the existing site's leaderboard design.

Font loading is optional; local fallback fonts work offline. Firebase scripts load only when a live-site worldwide read or score sync is needed. Artwork and sound effects are generated in the browser.

## Validation

From the repository root:

```sh
node --test tests/cosmic_dodge_astra.test.mjs
```

The tests cover movement, frame-rate consistency, collision protection, phase recharge, close calls, pickups, death, pause, resizing, deterministic simulation, storage failure, and idempotent global writes against a mock database. Desktop and mobile browser smoke checks also covered launch, keyboard/touch input, pause/resume, sound, game over/restart, persistence, offline leaderboard behavior, and the homepage version selector. Live leaderboard writes were not exercised.
