# Cosmic Dodge

The current GPT-6 Astra slot has been rebuilt in place. The game is called **Cosmic Dodge**, and its existing URL, homepage entry, model attribution, record storage, and Firebase collections are retained.

Serve the repository root with a static HTTP server, then open `/games/cosmic_dodge/cosmic_dodge_gpt6_astra.html`. There is no package installation or build step.

## Play

- Move freely with WASD or arrow keys. Diagonal movement is normalized.
- On touch or with a mouse, drag anywhere in the playfield. Steering is relative to the drag origin, with no jump under the finger. A quick swipe finishes at its final target. Cancellation stops movement.
- Space or the Burst button activates one second of protection, breaks nearby asteroids, and strengthens starlight attraction. Recharge takes five seconds.
- Three shields; green repair cells restore one. Hits provide 1.7 seconds of protection against overlapping hazards.
- Survival scores 20 points/second. Starlight scores 50 times the combo. Close calls raise the combo up to 5 and score 60 times that combo. A burst-shattered asteroid scores 25.
- Sectors advance every 25 seconds. Formation waves leave an open corridor. Meteor showers show their trajectories for at least 1.3 seconds before spawning.
- P, Escape, or Pause freezes the run. Switching tabs or losing focus pauses automatically. Rotating between substantially different widths also pauses.
- Audio, reduced effects, fullscreen where supported, device records, and worldwide records are available from the header.

## Structure

- `engine.js`: seeded simulation, 2D input, wave generation, swept collisions, pickups, burst, and scoring. The controller uses fixed 1/120-second steps.
- `renderer.js`: cached space backdrop and asteroid sprites, layered ship illustration, starfield, trails, bounded particles, feedback and reduced effects.
- `game.js`: lifecycle, DOM interface, relative pointer controls, keyboard handling, synthesized audio, preferences and leaderboard integration.
- `game.css`: full-height desktop, phone portrait and landscape layouts, safe areas, and dialogs.
- `records.js`: existing local persistence and production-only Firebase integration.
- `deep-space.webp`: original space artwork, encoded at 1536×1024, approximately 163 KB.

## Records and deployment

The local key remains `cosmic_dodge_gpt6_astra_records_v1`; previous device records are preserved. The worldwide collection remains `leaderboard_cosmic_dodge_gpt6_astra`, with the existing `globalStats/stats_cosmic_dodge_gpt6_astra` counter. New runs include `ruleset: 2` to identify the revised scoring rules. Existing and new records are displayed together.

Firebase loads only on `whatthe.ai` or `www.whatthe.ai`. Other hosts keep runs local. Device storage or worldwide connection failures do not prevent gameplay. Run IDs and transactions prevent duplicate global writes. Server rules and production leaderboard writes are outside local verification.

Deploy the repository's static files through the existing site's hosting integration. The HTML uses `?v=2` for the replacement stylesheet and modules to avoid loading the prior game from browser caches. No additional homepage version or route is introduced.

## Validation

```sh
node --test tests/cosmic_dodge_astra.test.mjs
```

The 24 tests cover 2D bounds, diagonal speed, pointer targeting, timestep consistency, shield burst, collision protection, swept collisions, close calls, pickups, pause, resize, deterministic replay, meteor warning time, safe formation corridors, three-minute simulation stability at desktop and phone aspect ratios, corrupted/blocked storage, and idempotent global writes against a mock database.

Browser QA uses desktop 1280×720, phone portrait 390×844 and 320×568, and landscape 844×390. Checks include launch, steering, burst, pause/resume, game over/restart, dialog controls, layout, and console errors. These are browser viewport checks, not tests on physical phones.

## Artwork provenance

Generated with the built-in ImageGen tool for this project, then converted to WebP with Sharp. Final asset: `games/cosmic_dodge/gpt6_astra/deep-space.webp`.

Prompt: "Use case: stylized-concept. Asset type: original background artwork for the playable Cosmic Dodge space arcade game. Create a cinematic deep-space environment, wide 1536x1024 composition, premium science-fiction game art with rich painterly volumetric detail. A gigantic dark violet planet with a brilliant thin lavender-blue atmospheric crescent occupies the right third, partially cropped by the right edge. A diagonal glowing belt of icy planetary rings sweeps behind it from lower right to upper center. Delicate teal nebula filaments and sparse distant stars in an almost black navy cosmos. The left half is mostly dark negative space for game title overlay, with restrained purple nebula. Cold electric cyan and ultraviolet highlights, small warm sunlight accents. Sublime scale, deep contrast, refined physical lighting, beautiful and atmospheric. This is a background layer: NO spaceships, NO foreground asteroids, NO text, NO logos, NO letters, NO UI. Avoid overly bright or busy central gameplay area."
