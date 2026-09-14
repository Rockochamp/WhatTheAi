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

## Implementation

`engine.js` is a deterministic, fixed-step simulation with no DOM, network or wall-clock dependencies. `renderer.js` draws cached sprite crops into Canvas 2D, with depth sorting, attack warnings, squash, recoil, shadows, weapon trails and bounded particles. It does not require WebGL or a framework CDN.

Entity limits are 220 monsters, 280 projectiles, 360 pickups and 65 area effects. A spatial grid limits collision searches. XP merges at the pickup cap. Later waves increase health, damage and pack size; enemy difficulty never scales with the player's XP level. Rendering honors reduced motion and battery saver, caps pixel density, and lowers quality under sustained slow frames. Input and the simulation freeze on pause, upgrade selection and tab loss.

`audio.js` synthesizes the original **Overripe After Dark** soundtrack: 128 BPM syncopated jungle percussion, sub-bass, marimba-like call-and-response and shifting minor chords. Bosses and frenzy add layers. All sounds start after a user gesture, with volume/mute controls. Audio buffers are reused and synth voices disconnect after playback.

`records.js` uses the site's existing Firebase project and a separate `leaderboard_banana_survivors_gpt6_astra_v1` collection, plus `stats_banana_survivors_gpt6_astra_v1`. Immutable run IDs and transactions make retries idempotent. Client-side leaderboards share the existing site's trust model; scores are not server-authoritatively simulated or suitable for prizes. Names are rendered as text, never HTML. Network failure retains local scores and exposes retry.

## Validation

From the repository root: `node --test tests/banana_astra.test.mjs`.

The suite covers movement, pause timing, touch plus independent dash, input cleanup, collision tunneling, damage grace, repeat enemy attacks, champion rewards, every weapon at ranks I/V, upgrade limits, XP overflow, pickup saturation, ranking validation, global retry idempotency, and a ten-minute entity stress simulation. The stress fixture deliberately grants invulnerability to keep every subsystem active; it is not used by the shipped game.

`node scripts/banana-balance.mjs` runs a separate steering bot under normal damage and upgrade rules, across all starters and four seeds. It is a balance probe, not a claim that every player/device was tested.

Visual/input checks cover desktop, 390 px and 320 px portrait, and 812 × 375 landscape. Physical iOS/Android hardware remains a useful release follow-up.

See [DESIGN.md](DESIGN.md) for the original-game review and [ART.md](ART.md) for asset provenance and generation briefs.
