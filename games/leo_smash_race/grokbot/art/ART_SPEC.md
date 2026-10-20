# Leo's Smash Race: art spec (for Muse and Pixel)

The game ships with **interim vector art drawn in code** (`proc.js`). Every sprite and layer below is listed in
`art/manifest.js`; give an entry a `src` and the real file replaces the interim art automatically. A missing or broken
file falls back to the interim art, so you can drop art in a bit at a time.

## How to drop art in
1. Put the file under `games/leo_smash_race/grokbot/art/<folder>/` (folders: `vehicles/`, `rivals/`, `smash/`, `debris/`, `items/`, `layers/`, `ui/`).
2. In `art/manifest.js`, set the entry's `src` to the path relative to `art/`, e.g. `src: 'vehicles/dragster_drive.webp'`.
3. **Bump `version`** at the top of the manifest (or give the entry its own `v: 2`). The CDN caches each URL for 30 days, so a changed file needs a new `?v=`.
   Also bump `?v=` on `art/manifest.js` in `game.html` when the manifest itself changes.
4. If the art's proportions differ from the listed canvas, update `size`, `anchor` and `wu` for that entry; nothing else needs to change.

## Formats
- **Transparent WebP** (lossy, quality about 85, with alpha) preferred; PNG-24 with alpha also works. sRGB. Opaque sky layers can be plain WebP.
- Cleanly keyed: no grey halo or fringe from the generation background, no baked drop shadow. **The game draws the soft contact shadow itself** as a separate ellipse under the wheels (it shrinks and fades with altitude).
- Trim to the canvas sizes below, keeping about 4 px of transparent padding.
- No text and no logos inside images (titles and labels are drawn in code).

## Camera and style constraints
- Side-scrolling, hero always **faces right**. Glossy toy render at a **slight 3/4 angle** (we see a little of the near side and top), soft studio light from top-left.
- `anchor` is the point that sits on the road (the contact line under the wheels). With the 3/4 angle, the anchor is the **near-side** wheels' contact point; the far-side wheels may sit a few px higher.
- Every pose of one vehicle uses the **same canvas size and the same baseline** (wheels at the same height), so switching poses never jumps.
- The road has 3 depth lanes; sprites are scaled about ±7% per lane in code, so no per-lane art is needed.

## Sprite list (name: canvas px, anchor, drawn width in world units)
World scale: the screen shows about 600-1200 world units across, so 100 wu is roughly 55 px on a 390 px phone and 130 px on a 1280 px desktop.

| Group | Names | Canvas | Anchor | wu |
|---|---|---|---|---|
| Vehicles | `veh.<id>.drive`, `.fly`, `.boost`, `.celebrate` for ids `dragster`, `bibi`, `truck`, `sword`, `jet` (20 images) | 512×256 (2:1) | 0.5, 0.92 (sword 0.5, 0.80) | dragster 235, bibi 190, truck 245, sword 250, jet 235 |
| Vehicles (Addendum B) | `veh.pup.drive`, `.fly`, `.special`; `veh.rex.drive`, `.fly`, `.special` (boost = special; celebrate = fly for pup, special for rex) | 512×256 (2:1) | 0.5, 0.92 | pup 215, rex 280 |
| Rivals | `rival.orange`, `rival.green`, `rival.blue` | 384×192 | 0.5, 0.93 | 175 |
| Smashables | `smash.cone` 128×160, `smash.box` 160×160, `smash.crate` 160×160, `smash.block` 160×160, `smash.mega` 160×160, `smash.barrel` 160×192, `smash.wall` 192×384, `smash.balloon` 160×256, `smash.cloud` 256×176 | as listed | bottom centre (balloon 0.5, 0.60) | 66-132 |
| Debris | `debris.cone`, `.card`, `.wood`, `.block`, `.brick`, `.barrel`, `.balloon`, `.cloud` | 64×64 | centre | 24-40 |
| Items | `item.star` 128×128, `item.ramp` 320×160, `item.finish` 256×512, `item.shot` 96×96 (Bibi's thrown star) | as listed | star/shot centre, ramp/finish bottom | 52 / 190 / 150 / 44 |
| UI | `ui.fly`, `ui.boost`, `ui.star`, `ui.trophy` 256×256; `ui.logo` 1200×400 | square / 3:1 | n/a | HTML `<img>` overrides |

Notes:
- Towers, walls of blocks and pyramids are **stacked in code from single pieces**, so one crate, one block and one barrel are enough. Colour variants are optional: `smash.block.0`..`.5`, `smash.mega.0`..`.5`, `smash.barrel.0`..`.2`, `smash.balloon.0`..`.3` fall back to the base entry when absent.
- Poses: `drive` = wheels on the road; `fly` = wings or rockets out (dragster and truck pop rocket wings, Bibi can show little wings mid-bounce); `boost` = flames out the back; `celebrate` = wheelie or happy pose at the finish. If time is short, ship `drive` and `fly`; `boost` and `celebrate` fall back to the interim versions, and the game adds speed lines and the special-move FX in code.
- Sword: flies point-first; there is no ground pose, so `drive` can equal `fly`.

## Parallax layers (per track: `toyroom`, `desert`, `castle`, `city`)
Supported roles, drawn back to front in manifest order (up to 5 per track):

| role | authored size | placement | par (scroll) |
|---|---|---|---|
| `sky` | 1920×1080, opaque | fills the screen top down to the horizon; its top-left pixel colour fills any space above it when the camera follows a flyer | 0.04 |
| `far` | 1920×720, transparent | bottom on the horizon, up to 80% of the sky height | 0.12 |
| `mid` | 1920×720, transparent | bottom on the horizon, up to 62% of the sky height | 0.35 |
| `ground` | 1920×540, opaque | the road surface from the horizon to the screen bottom; lane stripes are drawn on top in code, so leave the surface plain | 1.0 |
| `front` (optional) | 1920×300, transparent | foreground props along the bottom edge, drawn over everything; keep it sparse and low (it must not hide the hero or the buttons) | 1.25 |

- Every layer must **tile seamlessly horizontally** (the left and right edges must match). Each layer is scaled to its placement height and repeated.
- Keep important details out of the bottom 25% of `sky`/`far`/`mid` (the road covers it) and away from the top 70 px (HUD).

## Technical constraints
- **Physics**: custom side-scroller physics in `sim.js`, no library. Fixed 120 Hz timestep; x = distance, 3 snap lanes for depth, z = height. Collision is axis-aligned boxes from each object's `w`/`h` in `sim.js` `KINDS` (art can be a little bigger than the box).
- **Rendering**: Canvas 2D with devicePixelRatio scaling (capped at 2× and about 3.2 MP), one `drawImage` per sprite, debris capped at 240 pieces (90 with reduced motion) and particles at 500.
- **Performance budget**: 60 fps on a mid-range phone. First race within about 15 s of opening the page: keep the vehicles, rivals, smashables, debris and items under **1.5 MB total** (about 60 KB per vehicle pose, 30 KB per smashable, 5 KB per debris piece) and each track's layers under **700 KB** (layers load only for the chosen track). Decoded memory matters too: avoid canvases larger than the sizes above.
- **Cube**: rendered in code (`cube.js`), no sprites needed.

## Art drop v1 (Muse, 2026-10-17): wired in
- 61 of 75 manifest entries are real files now (vehicles, rivals, cone/crate/wall/wall_wide/barrel/balloon/cloud, debris, all 4 tracks x sky/mid/ground/front). Code art is still used for smash.box, smash.block, smash.mega, debris.card, debris.block, item.* and ui.*.
- No far layer on any track. `base` (0..1) on a layer is the image row that sits on the horizon; toyroom_mid uses 0.725 because its bottom band is transparent.
- smash.barrel lies on its side: the canvas is 160x112 (cropped from the 160x192 delivery), hitbox 86x62.
- smash.wallw (wall_wide.webp, 384x256, wu 200) has its own hitbox (172x126) and turns up in about 40% of wall spawns.
- Debris variants: `debris.<type>.2`, `.3`, ... are picked at random per chunk. Just add entries to the manifest.
- Smashables and debris draw at their manifest `wu`. Sim hitboxes in sim.js KINDS are matched to the visible art.
