# Cosmic Dodge

Updated in the existing GPT-6 Astra slot at `/games/cosmic_dodge/cosmic_dodge_gpt6_astra.html?v=4`. No new game entry or route. Serve the repository root with a static HTTP server; no installation or build step is required.

## Levels and the original games

Both previous implementations use `floor(score / 10) + 1` for the level.

- **o3-mini-high:** one point when an asteroid leaves the bottom; one collision ends the run. At a 60 Hz baseline, speed is `120 + 30 × (level − 1)` pixels/second on its 800×600 canvas, and the random spawn rate is `1.2 + 0.3 × (level − 1)` asteroids/second.
- **Gemini 3.5 Flash:** the same ten-point level rule. Dodges earn one point; shooting earns two, with an additional eight for a giant meteor. Standard speed is `(2 + random×2 + 0.45×(level−1))×60`. Spawn intervals decrease from `1200−95×level` milliseconds to a 400 ms floor. Comets, giant meteors, shield pickups, and weapons alter the challenge.
- **This update:** one point per asteroid dodged off the bottom or shattered by Burst. Level and asteroid count determine ranking. Starlight and close calls earn separate style points. Waiting does not advance levels. The speed and target spawn-rate parameters use the o3 curve. A frame-independent random spawn timer has a 60 ms minimum spacing; from level 8, occasional warned comets replace ordinary spawns. These modern mechanics mean records are not identical difficulty comparisons with either older model.

Level 30 requires 290 cleared asteroids. Its standard falling speed is 990 logical pixels/second and its target spawn rate is 9.9/second, versus 120 and 1.2 at level 1. Level 35 requires 340 clears. There is no level cap. Falling speeds scale with height, hazard widths with width, and horizontal steering with width. Visuals, warning trails, swept collision detection, and responsive controls retain the current presentation while the challenge rises every level.

## Play

- WASD or arrow keys move freely. Diagonals are normalized. Mouse and touch use relative dragging anywhere in the field, with no teleport to the finger. A quick swipe finishes at its final target; cancellation stops it. A second thumb can press Burst while steering. Keyboard takeover clears the old drag target.
- One life. A green cell provides one shield; shields do not stack. A shield hit gives 1.2 seconds of collision protection.
- Space or Burst protects for 0.6 seconds and shatters nearby hazards. Recharge is 10 seconds. Comets show a trajectory for 1.3 seconds before spawning.
- P, Escape, or Pause freezes the run and music. Focus loss, switching tabs, or a substantial orientation change pauses automatically.
- Sound starts on the launch gesture, with a persistent mute button. Music volume and reduced effects are in How to play. Fullscreen is offered where supported.

## Original soundtrack

**Terminal Velocity** is an original 140 BPM, D minor, 32-bar electronic score, approximately 55 seconds per arrangement. It has synth chords, sub/buzz bass, stereo arpeggios, a chord-specific lead melody, kick, snare, hats, crashes, and risers. The arrangement moves through ignition, drive, drop, an airlock breakdown, and a final drive. Higher levels add arpeggio, percussion, and lead layers without speeding up the audio clock. A filtered dotted-eighth delay and compressor shape the mix.

The track uses native Web Audio with no downloads, samples, third-party music, or runtime packages. A 25 ms look-ahead scheduler places notes on the audio clock rather than animation frames. Pausing stops active voices and scheduling; an interrupted clock skips stale notes. Finished sources and their per-note nodes are disconnected. Music obeys user gesture playback restrictions and the saved sound preference.

## Files

- `engine.js`: deterministic simulation and level curve, fixed 1/120-second updates.
- `controls.js`: shared touch/mouse drag controller.
- `renderer.js`: cached artwork and asteroid sprites, ship, particles and reduced effects.
- `music.js`: original score, synthesis and audio scheduler.
- `game.js` / `game.css`: lifecycle, responsive UI, input wiring, preferences and audio integration.
- `records.js`: local records and production-only Firebase integration.

## Records and deployment

New records use `ruleset: 3` and local key `cosmic_dodge_gpt6_astra_levels_v3`. The global collection is `leaderboard_cosmic_dodge_gpt6_astra_levels_v3`, with counter `globalStats/stats_cosmic_dodge_gpt6_astra_levels_v3`. Previous point-based device records and Firebase collections remain untouched. The new board ranks levels, then clears, with style as a final tie breaker among retrieved records. It starts fresh because the rules changed.

Firebase loads only on whatthe.ai / www.whatthe.ai. Local previews never upload runs. Failed storage or sync does not prevent play. Run IDs and transactions prevent duplicate submissions. Existing main-branch hosting deploys the static files. Homepage, HTML, and module links use `?v=4` to refresh cached code at the same route.

## Validation

```
node --test tests/cosmic_dodge_astra.test.mjs tests/cosmic_dodge_controls_music.test.mjs tests/cosmic_dodge_session.test.mjs
```

34 automated checks cover progression, legacy difficulty parameters, device scaling, single-life/shield collisions, high-speed swept collisions, one-time clears, burst cooldown, pickups, pause, deterministic simulation, resizing, long-run cleanup, record isolation, mocked idempotent submissions, touch/mouse handoff, a second steering pointer, cancellation, musical looping and scheduler interruptions.

Browser checks: 1280×720 desktop, 390×844 portrait, 320×568 small phone, and 844×390 landscape. Launch, mouse drag, keyboard movement/burst, pause/resume, results, restart, records, instructions, music volume and layout were checked with no console errors. Touch behavior also has controller-level event tests. These are viewport and automated input checks, not physical iOS/Android device testing.

An offline Web Audio render verifies all nine instruments produce finite, unclipped samples and release their voices. No production test scores are submitted.

## Artwork provenance

Generated with the built-in ImageGen tool for this project, then converted to WebP with Sharp. Final asset: `games/cosmic_dodge/gpt6_astra/deep-space.webp`.

Prompt: "Use case: stylized-concept. Asset type: original background artwork for the playable Cosmic Dodge space arcade game. Create a cinematic deep-space environment, wide 1536x1024 composition, premium science-fiction game art with rich painterly volumetric detail. A gigantic dark violet planet with a brilliant thin lavender-blue atmospheric crescent occupies the right third, partially cropped by the right edge. A diagonal glowing belt of icy planetary rings sweeps behind it from lower right to upper center. Delicate teal nebula filaments and sparse distant stars in an almost black navy cosmos. The left half is mostly dark negative space for game title overlay, with restrained purple nebula. Cold electric cyan and ultraviolet highlights, small warm sunlight accents. Sublime scale, deep contrast, refined physical lighting, beautiful and atmospheric. This is a background layer: NO spaceships, NO foreground asteroids, NO text, NO logos, NO letters, NO UI. Avoid overly bright or busy central gameplay area."

## Nicknames and rankings

The nickname field is above Play and saved between visits. Blank names still play as Anonymous. Session ranking and Global ranking buttons are on both the start and results screens; Rankings in the header opens the same panel. Device bests remains available as a third tab.

Every completed round is retained in the session ranking, including ties and rounds below the top ten. Each entry shows its round number, nickname, level, cleared asteroids, and survival time. Results show the round number and its position in this session. Session history uses sessionStorage key `cosmic_dodge_gpt6_astra_session_v3`, survives refresh in that tab, and falls back to memory if storage is blocked. A new tab has a separate session. Existing device bests and global records use their unchanged ruleset-3 storage and collection. Both now display the available top ten entries.

During play the cursor is hidden over the canvas. Pause, results, menus, and interactive buttons retain a visible cursor.

The additional three session tests cover all-round retention, tied levels, idempotent saves, refresh persistence, storage isolation, corrupted history, and blocked storage. Total automated checks: 37.
