# Banana Survivors · GPT-6 Astra

An illustrated jungle survival roguelite. Open `game.html` through an HTTP server; no install or build step is needed. The Gemini 3 Pro original remains at `../game.html` and in the homepage selector.

## Play

- Move with WASD, arrows, held mouse steering, or a floating touch joystick.
- Dash with Space, Shift, right-click, or the separate touch button. Releasing a pointer stops steering; keyboard movement takes priority. A dash grants brief invulnerability.
- Weapons fire automatically. Collect golden XP and choose one of three upgrades; 1–3 and R work on the upgrade screen.
- Every 50 seconds brings a champion. Charges, slams and radial projectile attacks alternate by wave. Defeating a champion heals 25 HP, awards an upgrade, restores a reroll (maximum three), and attracts all XP.
- Five weapon families, four equipped slots, five ranks per weapon. Rank V changes the weapon's behavior. Eight supporting perks apply to the whole build. XP overflow is preserved.
- Classic starts with a rank II blaster. Ranger starts with a blaster and bananarang, 90 HP and faster movement. Bruiser starts with a blaster and orbiting peel, 125 HP and slower movement.
- Session rankings retain every completed run. This-device rankings retain the best 100. A finished or retired run can submit a global score on the live site. Preview runs never submit.
- Score = combat points with streak multiplier + two points per elapsed second + 250 per champion. No accounts, purchases or permanent stat bonuses.

## Horde update · v3

The hero is now a scarred, rotten banana veteran, in both the game and menu artwork. Four new enemy types have distinct silhouettes and behavior: circling Carvers (20 seconds), telegraphed explosive Bloats (34 seconds), three-shot Ribcannons (78 seconds), and summoning Broodmothers (125 seconds). The Marrow Witch also has her own boss sprite. Hounds start at eight seconds; brutes, spitters and splitters join progressively. New arrivals get an on-screen introduction; the help panel explains their counters.

Packs grow every 32 seconds, up to six enemies per spawn. Spawn intervals shorten continuously, down to 0.18 seconds; champion fights retain horde pressure. Health, damage and movement pressure grow with elapsed time as well as wave, so stalling a champion does not freeze difficulty. Health drops are less frequent and frenzy takes more kills. Upgrades, movement speed, dash grace and all weapon evolutions remain available.

The deterministic steering probe across three starters and four seeds survived 47–432 seconds, with most runs ending in waves 2–3 and the first upgrade at 7–10 seconds. This is a comparative balance probe, not a prediction of human skill. The prior balance generally let that same probe reach waves 8–11.

## Implementation

`engine.js` is a deterministic, fixed-step simulation with no DOM, network or wall-clock dependencies. `renderer.js` draws cached sprite crops into Canvas 2D, with depth sorting, attack warnings, squash, recoil, shadows, weapon trails and bounded particles. It does not require WebGL or a framework CDN.

Entity limits are 220 monsters, 280 projectiles, 360 pickups and 65 area effects. Numeric spatial-grid keys avoid transient strings; separation examines at most 28 neighbors while combat collision queries remain complete. Specialists are capped at four broodmothers, ten ribcannons, twelve spitters and eighteen bloats. Broodmother summons stop at 32 meatlings. At saturation, new packs may replace distant enemies; nothing spawns on the player. XP merges at the pickup cap. Enemy difficulty never scales with the player's XP level. Rendering honors reduced motion and battery saver, caps pixel density, and lowers quality under sustained slow frames. Input and the simulation freeze on pause, upgrade selection and tab loss.

`audio.js` now plays **Meatgrinder**, an original 144 BPM industrial survival score with distorted power-chord guitar riffs, sub-bass, heavy breakbeats, metallic percussion, dark interval beds, breakdowns and lead variations. Two synchronized 32-bar stems let champion and frenzy combat bring in extra guitars, drums and a counterline. The transport preserves musical position across pause and resets for a new run. Low health adds a heartbeat.

The score is rendered by `scripts/render-banana-audio.py` using NumPy and ffmpeg; it contains no third-party samples. `meatgrinder.mp3` and `meatgrinder-surge.mp3` are decoded only after a user gesture. Music download failure leaves combat effects playable and offers retry. Music and combat effects have separate volume controls beneath the master volume.

Combat effects are cached synthesized Foley: fleshy hit thuds, wet kill splashes, bone cracks, heavier large-monster deaths, punchy gunfire, blade whooshes, coconut throws, electrical crackle, bass-heavy explosions and distinct progression stingers. Hits are spatialized and rate-limited. A 40-voice cap and final compressor keep dense combat bounded.

`gore.js` adds longer arterial sprays, larger bouncing flesh and organ fragments, exposed bones, torn eyes with trailing tissue, broken rib sections, and wider blood pools. It uses its own RNG, runs entirely outside the gameplay simulation, and draws stains beneath danger warnings and pickups. Stronger individual effects keep the same full-quality budgets: 280 flying droplets, 64 chunks and 140 stains. Battery saver uses 110/24/60, including stains created when droplets land. Stain geometry is cached when created. The blood-and-gore preference defaults on; reduced effects lowers particle counts while keeping gore visible.

`records.js` uses the site's existing Firebase project. This harder update uses ruleset 2 and `leaderboard_banana_survivors_gpt6_astra_v2`, plus `stats_banana_survivors_gpt6_astra_v2`. Session and device storage also use separate v2 keys. The ranking's Difficulty era selector reads the original v1 session, device and global boards without deleting or migrating them. Immutable run IDs and transactions make retries idempotent. Client-side leaderboards share the existing site's trust model; scores are not server-authoritatively simulated or suitable for prizes. Names are rendered as text, never HTML. Network failure retains local scores and exposes retry.

## Validation

From the repository root: `node --test tests/banana_astra.test.mjs tests/banana_effects.test.mjs tests/banana_horde.test.mjs`.

The 38-test suite covers movement, pause timing, touch plus independent dash, input cleanup, collision tunneling, damage grace, repeat enemy attacks, champion rewards, every weapon at ranks I/V, upgrade limits, XP overflow, pickup saturation, ranking validation, global retry idempotency across both eras, progressive enemy unlocks, bloater interruption, bone volleys, summon caps, gore budgets and a ten-minute entity stress simulation. The stress fixture replenishes invulnerability every step (dash replaces the grace timer); it is not used by the shipped game.

`node scripts/banana-balance.mjs` runs a separate steering bot under normal damage and upgrade rules, across all starters and four seeds. It is a balance probe, not a claim that every player/device was tested.

Visual/input checks cover desktop, 390 px and 320 px portrait, and 812 × 375 landscape. Physical iOS/Android hardware remains a useful release follow-up.

For v3, a separate local render fixture held 220 enemies with evolved weapons and repeated full-budget gore for ten seconds. On the development computer, average simulation/render callback work was 3.28 ms at 1280 × 720 (95th percentile 4.90 ms), 2.82 ms at 390 × 844 (4.10 ms), and 2.26 ms in the phone-size battery mode (3.20 ms). These are local CPU-work measurements, not physical-phone frame-rate guarantees. Normal startup, pause, the new art silhouettes and both ranking eras were checked in the browser; the archive retained the earlier device records.

See [DESIGN.md](DESIGN.md) for the original-game review and [ART.md](ART.md) for asset provenance and generation briefs.
