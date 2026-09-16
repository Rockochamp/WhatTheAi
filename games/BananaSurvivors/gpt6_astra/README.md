# Banana Survivors · GPT-6 Astra

An illustrated jungle survival roguelite. Open `game.html` through an HTTP server; no install or build step is needed. The Gemini 3 Pro original remains at `../game.html` and in the homepage selector.

## Death replay · v6

Real deaths now cut the combat score and effects for an original terminal-impact stinger: a sub drop, metallic dissonance and a falling tail. After a half-second freeze, the last 1.8 simulation seconds replay automatically at 0.3× speed over a quiet heartbeat bed, followed by a final-impact hold and the existing results/rankings. Touch/click **Skip replay**, or press Escape, to go directly to results. Retirement still opens results immediately. The replay and sound respect mute, gore and reduced-effects preferences; hiding the tab freezes the replay and stops its audio.

The fatal enemy, projectile or area attack is highlighted and named, with post-armor damage and health before impact. Projectile and hazard ownership survive their creator's death. The engine stops processing combat as soon as the fatal hit lands, preventing later projectiles, hazards or pickups from altering the final result.

`replay.js` stores render-only snapshots at 20 Hz (maximum 38 frames) and interpolates positions. It never re-simulates combat, consumes gameplay RNG, stores a video, changes scores or submits records. Effects are bounded to 48 per snapshot; simulation grids and projectile hit sets are excluded. A new run/results clear the buffer. Gameplay balance, ruleset 3 and its existing leaderboard remain unchanged.

The saturated recording probe (220 enemies, 280 shots, 360 pickups, 65 hazards) retained about 6.4 MB on the development PC; recording averaged 0.17 ms per simulation step (0.52 ms p95), and replay interpolation was 0.83 ms p95. These are local CPU measurements, not phone FPS guarantees.

All 55 tests passed, including fatal-source attribution, immediate combat termination, replay isolation/timing, bounded history, silence when muted and audio cleanup. Local browser checks covered desktop, 390 × 844 and 320 × 568 portrait, and 812 × 375 landscape. Projectile, contact and area deaths replayed; automatic results, click/Escape skipping, retry, one ranking entry per completed round and immediate retirement results were checked without browser errors. Temporary fixture controls are excluded from the release.

## Play

- Move with WASD, arrows, held mouse steering, or a floating touch joystick.
- Dash with Space, Shift, right-click, or the separate touch button. Releasing a pointer stops steering; keyboard movement takes priority. A dash grants brief invulnerability.
- Weapons fire automatically. Collect golden XP and choose one of three upgrades; 1–3 and R work on the upgrade screen.
- Each stage starts with a 50-second hunt and ends with a boss showdown. Each boss combines three telegraphed abilities and enrages at half health or after 45 seconds. Defeating a champion heals 25 HP, awards an upgrade, restores a reroll (maximum three), and attracts all XP.
- Five weapon families, four equipped slots, five ranks per weapon. Rank V changes the weapon's behavior. Eight supporting perks apply to the whole build. Four uncapped masteries unlock at XP level 35, with four evolved weapons, or when ordinary choices run low. XP overflow is preserved.
- Classic starts with a rank II blaster. Ranger starts with a blaster and bananarang, 90 HP and faster movement. Bruiser starts with a blaster and orbiting peel, 125 HP and slower movement.
- Session rankings retain every completed run. This-device rankings retain the best 100. A finished or retired run can submit a global score on the live site. Preview runs never submit.
- Score = combat points with streak multiplier + two points per elapsed second + 250 per champion. No accounts, purchases or permanent stat bonuses.

## Stage challenge · v5

The stage challenge uses ruleset 3, with fresh session, device and global leaderboards. Existing v1/v2 records remain stored separately; the UI only shows the current board. The old Gemini game stays available. The HUD distinguishes stage progress from XP level, counts down the hunt and explains boss warnings.

A showdown dismisses the hunt without granting free XP, seals a 560-unit arena and admits a bounded escort. Cleaver King: charge / fan / slam. Bonebreaker: slam / spore ring / fan. Marrow Witch: spore ring / blood rain / summons. Enrage increases attack frequency and pattern density; the arena shrinks toward 350 units after 65 seconds. Recovery windows take 35% extra damage. Boss knockback and slow resistance stop evolved weapons from suppressing every attack.

Horde HP uses multiplicative stage growth; damage grows quadratically, while speed, spawn rate, projectile count and population remain bounded. Stages 4 onward cycle feral packs, blood rain and iron tides; elites yield triple XP. Boss HP at stages 1/10/20/30 is approximately 1,200 / 19,026 / 88,231 / 310,661. XP increases additively through damage, boss damage, max HP and dash-healing masteries, without adding projectiles or unbounded firing rates.

Pickups use cached illustrated sprites. Amber, jade and violet seeds indicate XP value. Medicine, salvage magnets, overripe fuel and spore grenades retain their effects; peel wards block one hit within 16 seconds, and frost fruit slows ordinary monsters for seven seconds (boss slow resistance applies).

The normal-damage opening probe across 12 starter/seed combinations reached stages 2–3, with the first upgrade in 7–10 seconds. The fixed level-62 build probe cleared early bosses, died standing at stage 20 after three hits, and died circling stage 20 after 44 seconds. These are diagnostic bots, not predictions of human success.

## Earlier horde update · v3

The hero is now a scarred, rotten banana veteran, in both the game and menu artwork. Four new enemy types have distinct silhouettes and behavior: circling Carvers (20 seconds), telegraphed explosive Bloats (34 seconds), three-shot Ribcannons (78 seconds), and summoning Broodmothers (125 seconds). The Marrow Witch also has her own boss sprite. Hounds start at eight seconds; brutes, spitters and splitters join progressively. New arrivals get an on-screen introduction; the help panel explains their counters.

Packs grow every 32 seconds, up to six enemies per spawn. Spawn intervals shorten continuously, down to 0.18 seconds during hunts; v5 showdowns instead use a limited escort. Health, damage and movement pressure grow with elapsed time as well as wave, so stalling a champion does not freeze difficulty. Health drops are less frequent and frenzy takes more kills. Upgrades, movement speed, dash grace and all weapon evolutions remain available.

The deterministic steering probe across three starters and four seeds survived 47–432 seconds, with most runs ending in waves 2–3 and the first upgrade at 7–10 seconds. This is a comparative balance probe, not a prediction of human skill. The prior balance generally let that same probe reach waves 8–11.

## Implementation

`engine.js` is a deterministic, fixed-step simulation with no DOM, network or wall-clock dependencies. `renderer.js` draws cached sprite crops into Canvas 2D, with depth sorting, attack warnings, squash, recoil, shadows, weapon trails and bounded particles. It does not require WebGL or a framework CDN.

Entity limits are 220 monsters, 280 projectiles, 360 pickups and 65 area effects. Numeric spatial-grid keys avoid transient strings; separation examines at most 28 neighbors while combat collision queries remain complete. Specialists are capped at four broodmothers, ten ribcannons, twelve spitters and eighteen bloats. Broodmother summons stop at 32 meatlings. At saturation, new packs may replace distant enemies; nothing spawns on the player. XP merges at the pickup cap. Enemy difficulty never scales with the player's XP level. Rendering honors reduced motion and battery saver, caps pixel density, and lowers quality under sustained slow frames. Input and the simulation freeze on pause, upgrade selection and tab loss.

`audio.js` now plays **Meatgrinder**, an original 144 BPM industrial survival score with distorted power-chord guitar riffs, sub-bass, heavy breakbeats, metallic percussion, dark interval beds, breakdowns and lead variations. Two synchronized 32-bar stems let champion and frenzy combat bring in extra guitars, drums and a counterline. The transport preserves musical position across pause and resets for a new run. Low health adds a heartbeat.

The score is rendered by `scripts/render-banana-audio.py` using NumPy and ffmpeg; it contains no third-party samples. `meatgrinder.mp3` and `meatgrinder-surge.mp3` are decoded only after a user gesture. Music download failure leaves combat effects playable and offers retry. Music and combat effects have separate volume controls beneath the master volume.

Combat effects are cached synthesized Foley: fleshy hit thuds, wet kill splashes, bone cracks, heavier large-monster deaths, punchy gunfire, blade whooshes, coconut throws, electrical crackle, bass-heavy explosions and distinct progression stingers. Hits are spatialized and rate-limited. A 40-voice cap and final compressor keep dense combat bounded.

`gore.js` adds longer arterial sprays, larger bouncing flesh and organ fragments, exposed bones, torn eyes with trailing tissue, broken rib sections, and wider blood pools. It uses its own RNG, runs entirely outside the gameplay simulation, and draws stains beneath danger warnings and pickups. Stronger individual effects keep the same full-quality budgets: 280 flying droplets, 64 chunks and 140 stains. Battery saver uses 110/24/60, including stains created when droplets land. Stain geometry is cached when created. The blood-and-gore preference defaults on; reduced effects lowers particle counts while keeping gore visible.

`records.js` uses the site's existing Firebase project. This harder update uses ruleset 2 and `leaderboard_banana_survivors_gpt6_astra_v2`, plus `stats_banana_survivors_gpt6_astra_v2`. Session and device storage also use separate v2 keys. As of v4, the ranking UI shows only the current ruleset's session, device and global boards; the unused difficulty-era selector and archive note have been removed. Existing storage is not deleted or migrated. Immutable run IDs and transactions make retries idempotent. Client-side leaderboards share the existing site's trust model; scores are not server-authoritatively simulated or suitable for prizes. Names are rendered as text, never HTML. Network failure retains local scores and exposes retry.

## Validation

From the repository root: `node --test tests/banana_astra.test.mjs tests/banana_effects.test.mjs tests/banana_horde.test.mjs tests/banana_stages.test.mjs tests/banana_replay.test.mjs`.

The 38-test suite covers movement, pause timing, touch plus independent dash, input cleanup, collision tunneling, damage grace, repeat enemy attacks, champion rewards, every weapon at ranks I/V, upgrade limits, XP overflow, pickup saturation, ranking validation, global retry idempotency across both eras, progressive enemy unlocks, bloater interruption, bone volleys, summon caps, gore budgets and a ten-minute entity stress simulation. The stress fixture replenishes invulnerability every step (dash replaces the grace timer); it is not used by the shipped game.

`node scripts/banana-balance.mjs` runs a separate steering bot under normal damage and upgrade rules, across all starters and four seeds. It is a balance probe, not a claim that every player/device was tested.

Visual/input checks cover desktop, 390 px and 320 px portrait, and 812 × 375 landscape. Physical iOS/Android hardware remains a useful release follow-up.

For v3, a separate local render fixture held 220 enemies with evolved weapons and repeated full-budget gore for ten seconds. On the development computer, average simulation/render callback work was 3.28 ms at 1280 × 720 (95th percentile 4.90 ms), 2.82 ms at 390 × 844 (4.10 ms), and 2.26 ms in the phone-size battery mode (3.20 ms). These are local CPU-work measurements, not physical-phone frame-rate guarantees. Normal startup, pause, the new art silhouettes and both ranking eras were checked in the browser; the archive retained the earlier device records.

See [DESIGN.md](DESIGN.md) for the original-game review and [ART.md](ART.md) for asset provenance and generation briefs.

Stage checks also cover 300 successive uncapped mastery choices, real mastery effects, stage gates, arena corners/dashes, all three boss combinations, enrage, pause, shields, frost, and bounded late-stage builds. `node scripts/banana-stage-balance.mjs` reproduces the late-build probe.

For v5, all 47 simulation, input, effects and record tests passed. Local browser checks covered 390 × 844 portrait, 320 × 568 with a scrolling upgrade dialog, and 812 × 375 landscape. A ten-second renderer fixture with 220 enemies and evolved weapons measured 2.05 ms average / 2.70 ms p95 draw work at 390 × 844, and 2.15 / 4.00 ms at 1280 × 720 on the development PC. These exclude simulation time and are not physical-phone FPS measurements. The separate ten-minute simulation stress test also passed. Temporary browser fixtures are excluded from the release.
