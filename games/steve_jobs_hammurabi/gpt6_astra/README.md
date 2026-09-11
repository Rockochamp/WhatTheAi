# Steve Jobs - Hammurabi · GPT-6 Astra

A ten-year strategy game for the existing What the Ai catalog. The original Grok 3 game remains intact and selectable.

## Preserved rules and features

- Start with 100 people (the original game's pawns), 4,000 bushels and 100 acres.
- Land market: 18–28 bushels per acre. Buy or sell in a year, never both.
- Seeds cost one bushel per acre; one person can tend ten acres; harvest yields 3–7 per acre.
- Feeding, cumulative starvation risk, migration, rats, bonus harvest and plague retain the exact Grok v6 probabilities and ordering.
- Reigns end after ten resolved years or zero population. Final population is the score.
- Ruler nickname, every session round, global top 100 and completed-game count, Elysium soundtrack, volume, mute, help, replay and home navigation.

The engine fixes the original collapse-year off-by-one. Invalid fractional/non-finite decisions cannot mutate a turn. Ranking ties no longer erase rounds. The new version has its own Firestore collection and stats, using the site's existing Firebase project; legacy records are not moved or changed. Run IDs make submission retries and game counts idempotent. As with the original, scores come from the client; competitive server-side validation is not part of this static game's backend.

## Interface

Responsive kingdom view, direct numeric entry and touch steppers, full before-harvest budget, feeding-risk preview, annual reports, chronicle history and final legacy. Native dialogs support Escape and keyboard focus. Reduced-motion preferences disable animation. Session ranking survives reload in the same tab; blocked storage falls back to memory. Network failures never block playing. Local previews never submit production scores.

## The living kingdom (v2)

A real-time 3D settlement replaces the static overview during play. Each person has an animated villager, up to the maximum possible 600. Houses, markets, palms, river water, a sailing boat, flags, smoke, planted fields and granary stores bring the town to life. Horizontal pointer dragging, on-screen 44px controls, and focused-scene arrow keys / + / − / Home rotate, zoom and reset the camera. Vertical touch scrolling stays available.

At year-end, a skippable sequence presents the actual engine report in order: harvest, starvation, arrivals, departures and the year's random event. Deaths are shown without gore; new families walk through the gate. Camera close-ups and population/food counters explain each event, including years with both arrivals and deaths. The report can replay the same sequence without rerolling a year or submitting another score.

Motion can be paused, follows the device's reduced-motion preference, and stops when the scene is offscreen or the tab is hidden. Architecture is batched by material; people and wheat use instanced rendering. Pixel density and shadow resolution are capped for mobile hardware, with an adaptive resolution fallback. If WebGL is unavailable or lost, the original panorama and the entire strategy/ranking interface remain usable.

The renderer is lazy-loaded only when a reign starts. All production JavaScript is served from this game folder, without a runtime CDN dependency. `scene-model.js` only translates resolved reports; its independent visual RNG cannot affect game outcomes.

### Rebuild the renderer

In this folder, run `pnpm install --frozen-lockfile`, then `pnpm run build:world`. Commit `world3d.bundle.js` and its generated legal notice with the source changes. Three.js and esbuild versions are pinned in `package.json` and `pnpm-lock.yaml`. Three.js is MIT licensed; see `THREE-LICENSE.txt`.

## Verification

`node --test tests/hammurabi_astra.test.mjs tests/hammurabi_scene.test.mjs` from the repository root. Includes 1,000 deterministic comparisons with the actual Grok source, 500 full campaigns, 2,000 checks of animation accounting against engine outcomes, independent visual randomness, connected walking routes, camera/population limits, input/resource boundaries, session round/tie preservation, malformed storage, and idempotent global submissions against a local database double.

## Artwork

Built-in imagegen generated one original panorama, saved as `kingdom.webp` in this folder. The source PNG is retained in the local task's `work/kingdom-art/mesopotamia-blue-hour.png`; the WebP is a format conversion for delivery, preserving the artwork. No original site images were overwritten.

Prompt: Premium cinematic isometric/panoramic aerial view of a thriving ancient Mesopotamian river city at blue hour, magnificent stepped ziggurat, terraced sandstone architecture, geometric irrigated fields, river winding through foreground, little warm gold window lights, subtle distant stars, rich midnight navy/teal shadows and copper/amber sunlight on stone. Sophisticated realistic miniature/diorama game art, polished high detail, atmospheric but readable on small screens. No text, no UI, no logos, no modern buildings, no people portraits. Landscape composition, landmark city slightly right of center, edges naturally dark; important structures central.
