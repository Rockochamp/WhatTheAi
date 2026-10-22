/* Leo's Game — ART MANIFEST. This is the only file to edit when real art arrives (see art/ART_SPEC.md).
   - src: path relative to this art/ folder (transparent WebP or PNG). null = use the built-in interim vector art.
   - v:   bump the global `version` (or a per-entry `v`) whenever a file changes: the CDN caches each URL for 30 days.
   - size: the canvas size the art is authored at, [w, h] px. anchor: [ax, ay] point (0..1) that sits on the ground/contact line.
   - wu:  drawn width in world units (the game scales art to this; height follows the image aspect ratio).
   - layers: base (0..1, default 1) is the image row that sits on the horizon, for art with a transparent bottom band.
   - alias: 'other.name' reuses another sprite; fx.exhaust: [x, y] (0..1 of the drive canvas) is where boost flames come out.
   A missing or broken file silently falls back to the interim art, so partial drops are safe. */
window.LEO_MANIFEST = {
  version: 9,  // Muse art drop 5: Addendum D Laser Racer + Ira (D6) + FIRE projectiles / hit FX / Ira FX; v8 was drop 4 (Comet 17)
  base: 'art/',
  // Vehicle poses without their own file borrow another pose; the game adds the boost flames and the celebrate bounce in code.
  poseAliases: { boost: 'drive', celebrate: 'fly' },
  sprites: {
    // Vehicles: side view facing right, 2:1 canvas. Wheels (or the bottom of the hull) touch y = 92% in every pose.
    'veh.dragster.drive': { src: 'vehicles/dragster_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { exhaust: [0.07, 0.62] } },
    'veh.dragster.fly':   { src: 'vehicles/dragster_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.dragster.boost': { src: 'vehicles/dragster_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },  // = drive (no boost pose yet; flames/speed FX in code)
    'veh.dragster.celebrate': { src: 'vehicles/dragster_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },  // = fly (no celebrate pose yet)
    'veh.bibi.drive':     { src: 'vehicles/bibi_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 190, fx: { exhaust: [0.24, 0.70] } },
    'veh.bibi.fly':       { src: 'vehicles/bibi_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 190 },
    'veh.bibi.boost':     { src: 'vehicles/bibi_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 190 },  // = drive (no boost pose yet; flames/speed FX in code)
    'veh.bibi.celebrate': { src: 'vehicles/bibi_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 190 },  // = fly (no celebrate pose yet)
    'veh.truck.drive':    { src: 'vehicles/truck_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 245, fx: { exhaust: [0.20, 0.40] } },  // Grokbot: moved onto the rear of the v3 body (0.13/0.44 sat in the air behind the tyre)
    'veh.truck.fly':      { src: 'vehicles/truck_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 245 },
    'veh.truck.boost':    { src: 'vehicles/truck_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 245 },  // = drive (no boost pose yet; flames/speed FX in code)
    'veh.truck.celebrate': { src: 'vehicles/truck_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 245 },  // = fly (no celebrate pose yet)
    'veh.sword.drive':    { src: 'vehicles/sword_fly.webp', size: [512, 256], anchor: [0.5, 0.80], wu: 250, fx: { exhaust: [0.14, 0.50] } },  // = fly (sword has one pose)
    'veh.sword.fly':      { src: 'vehicles/sword_fly.webp', size: [512, 256], anchor: [0.5, 0.80], wu: 250 },
    'veh.sword.boost':    { src: 'vehicles/sword_fly.webp', size: [512, 256], anchor: [0.5, 0.80], wu: 250 },  // = fly (sword has one pose)
    'veh.sword.celebrate': { src: 'vehicles/sword_fly.webp', size: [512, 256], anchor: [0.5, 0.80], wu: 250 },  // = fly (sword has one pose)
    'veh.jet.drive':      { src: 'vehicles/jet_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { exhaust: [0.22, 0.66] } },
    'veh.jet.fly':        { src: 'vehicles/jet_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.jet.boost':      { src: 'vehicles/jet_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },  // = drive (no boost pose yet; flames/speed FX in code)
    'veh.jet.celebrate':  { src: 'vehicles/jet_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235 },  // = fly (no celebrate pose yet)
    // Addendum B heroes (Muse art drop 3, cut to the art/out format: 512x256, 0.92 baseline, one shared scale per hero).
    // The new `special` pose is the boost pose for these two only; celebrate = fly (pup) / special (rex).
    // Pup is drawn small on purpose (~60% of the Bat Truck's height). fx.pivot = centre of her ring pose (for the wobble).
    'veh.pup.drive':      { src: 'vehicles/pup_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 215, fx: { exhaust: [0.30, 0.70], noFlame: true } },
    'veh.pup.fly':        { src: 'vehicles/pup_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 215 },
    'veh.pup.special':    { src: 'vehicles/pup_special.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 215, fx: { noFlame: true, pivot: 0.668 } },
    'veh.pup.boost':      { alias: 'veh.pup.special' },
    'veh.pup.celebrate':  { alias: 'veh.pup.fly' },
    // Rex: special lines up with drive to within 1 px, so chomps swap the frames straight. fx.fins = where the code fin-wings pop out on the fly pose.
    'veh.rex.drive':      { src: 'vehicles/rex_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 280, fx: { exhaust: [0.10, 0.42] } },
    'veh.rex.fly':        { src: 'vehicles/rex_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 280, fx: { fins: [[0.36, 0.52], [0.62, 0.54]] } },
    'veh.rex.special':    { src: 'vehicles/rex_special.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 280 },
    'veh.rex.boost':      { alias: 'veh.rex.special' },
    'veh.rex.celebrate':  { alias: 'veh.rex.special' },
    // Addendum C: Comet 17 (Muse drop 4). 512x256, 0.92 baseline, one shared scale (0.2774 of source), drive visible height 128 px = 55% of truck_drive's 231 px.
    // boost = special (hot comet form); celebrate = fly. Sprites are not tilted: the game tilts in code (special 6 deg nose-down, fly 8 deg nose-up).
    // fx.scale: the fly pose is drawn smaller in its frame (111 px vs drive 128), so the game draws it x1.1 and the car keeps its size on takeoff.
    // fx.pivot = middle of the car (pop-out spin); fx.exhaust = rear of the body.
    'veh.comet.drive':    { src: 'vehicles/comet_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { exhaust: [0.25, 0.74], pivot: 0.66 } },
    'veh.comet.fly':      { src: 'vehicles/comet_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { scale: 1.1, exhaust: [0.27, 0.72], pivot: 0.66 } },
    'veh.comet.special':  { src: 'vehicles/comet_special.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { exhaust: [0.24, 0.74], pivot: 0.66 } },
    'veh.comet.boost':    { alias: 'veh.comet.special' },
    'veh.comet.celebrate': { alias: 'veh.comet.fly' },
    // Addendum D1: Laser Racer (Muse drop 5). 512x256, 0.92 baseline, one shared scale 0.3283 of source; drive visible h 128 px = 55% of truck_drive (231).
    // fx.nozzle = where the Laser Drive jet flame starts, fx.nose = where the twin lasers start (measured on the cut: nozzle glow / nose emitters of laser_special;
    // fly values follow the fly body, registered to drive). Visible car on the canvas: 370 x 128 px = about 190 x 66 wu at wu 265 (for sim.js len/h).
    'veh.laser.drive':    { src: 'vehicles/laser_drive.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { exhaust: [0.165, 0.73], nozzle: [0.165, 0.73], nose: [0.85, 0.755], pivot: 0.66 } },
    'veh.laser.fly':      { src: 'vehicles/laser_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { exhaust: [0.176, 0.728], nozzle: [0.176, 0.728], nose: [0.845, 0.795], pivot: 0.66 } },
    'veh.laser.special':  { src: 'vehicles/laser_special.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 265, fx: { exhaust: [0.165, 0.73], nozzle: [0.165, 0.73], nose: [0.85, 0.755], pivot: 0.66, noFlame: true } },
    'veh.laser.boost':    { alias: 'veh.laser.special' },
    'veh.laser.celebrate': { alias: 'veh.laser.fly' },
    // Addendum D6: Ira (she runs). drive = the run_a/run_b gallop pair (frames, alternated by the game at about 6 Hz cruise / 9 Hz special); one shared scale 0.324,
    // run_a visible h 163 px = 70% of truck_drive. run_b uses run_a's exact transform so the head stays put (head offset 0.1 px); her tucked paws sit 6 px above the baseline in run_b.
    // runb is kept for code that reads it as its own key. boost = special (toot surprise), celebrate = fly, fire = spin (Zoomie Chomp, shown inside the code whirlwind).
    'veh.ira.drive':      { src: 'vehicles/ira_run_a.webp', frames: ['vehicles/ira_run_a.webp', 'vehicles/ira_run_b.webp'], size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { noFlame: true, pivot: 0.6 } },
    'veh.ira.runb':       { src: 'vehicles/ira_run_b.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { noFlame: true, pivot: 0.6 } },
    'veh.ira.fly':        { src: 'vehicles/ira_fly.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { noFlame: true, pivot: 0.6 } },
    'veh.ira.special':    { src: 'vehicles/ira_special.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { noFlame: true, pivot: 0.6 } },
    'veh.ira.spin':       { src: 'vehicles/ira_spin.webp', size: [512, 256], anchor: [0.5, 0.92], wu: 235, fx: { noFlame: true, pivot: 0.6 } },
    'veh.ira.boost':      { alias: 'veh.ira.special' },
    'veh.ira.celebrate':  { alias: 'veh.ira.fly' },
    'veh.ira.fire':       { alias: 'veh.ira.spin' },
    // Rivals: friendly smiley racers, drive pose only.
    'rival.orange': { src: 'rivals/rival_orange.webp', size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    'rival.green':  { src: 'rivals/rival_green.webp', size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    'rival.blue':   { src: 'rivals/rival_blue.webp', size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    // Smashables (intact). Bottom edge on the ground; towers and pyramids are stacked in code from single pieces.
    'smash.cone':    { src: 'smash/cone.webp', size: [128, 160], anchor: [0.5, 0.97], wu: 66 },
    'smash.box':     { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 82 },
    'smash.crate':   { src: 'smash/crate.webp', size: [160, 160], anchor: [0.5, 0.97], wu: 90 },
    'smash.block':   { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 90 },
    'smash.wall':    { src: 'smash/wall.webp', size: [192, 384], anchor: [0.5, 0.98], wu: 108 },
    'smash.barrel':  { src: 'smash/barrel.webp', size: [160, 112], anchor: [0.5, 0.97], wu: 92 },  // horizontal barrel, canvas cropped from 160x192
    'smash.wallw':   { src: 'smash/wall_wide.webp', size: [384, 256], anchor: [0.5, 0.977], wu: 200 },  // wide brick wall (own hitbox in sim.js KINDS.wallw)
    'smash.mega':    { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 92 },
    'smash.balloon': { src: 'smash/balloon.webp', size: [160, 256], anchor: [0.5, 0.60], wu: 82 },
    'smash.cloud':   { src: 'smash/cloud.webp', size: [256, 176], anchor: [0.5, 0.92], wu: 132 },
    // Debris chunks (centre anchored, spun in code). 3-4 variants per material look best; add .2/.3 later.
    'debris.cone':    { src: 'debris/cone_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.card':    { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.wood':    { src: 'debris/wood_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.block':   { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.brick':   { src: 'debris/brick_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.barrel':  { src: 'debris/barrel_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.balloon': { src: 'debris/balloon_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.cloud':   { src: 'debris/cloud_1.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 40 },
    // Debris variants (Muse, v2)
    'debris.balloon.2': { src: 'debris/balloon_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.balloon.3': { src: 'debris/balloon_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.balloon.4': { src: 'debris/balloon_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.balloon.5': { src: 'debris/balloon_5.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.balloon.6': { src: 'debris/balloon_6.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.barrel.2': { src: 'debris/barrel_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.barrel.3': { src: 'debris/barrel_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.barrel.4': { src: 'debris/barrel_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.barrel.5': { src: 'debris/barrel_5.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.barrel.6': { src: 'debris/barrel_6.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.brick.2': { src: 'debris/brick_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.brick.3': { src: 'debris/brick_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.brick.4': { src: 'debris/brick_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.cloud.2': { src: 'debris/cloud_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 40 },
    'debris.cloud.3': { src: 'debris/cloud_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 40 },
    'debris.cloud.4': { src: 'debris/cloud_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 40 },
    'debris.cone.2': { src: 'debris/cone_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.cone.3': { src: 'debris/cone_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.cone.4': { src: 'debris/cone_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.cone.5': { src: 'debris/cone_5.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.wood.2': { src: 'debris/wood_2.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.wood.3': { src: 'debris/wood_3.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.wood.4': { src: 'debris/wood_4.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.wood.5': { src: 'debris/wood_5.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.wood.6': { src: 'debris/wood_6.webp', size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    // Items and track props
    'item.star':   { src: null, size: [128, 128], anchor: [0.5, 0.5], wu: 52 },
    'item.ramp':   { src: null, size: [320, 160], anchor: [0.5, 0.97], wu: 190 },
    'item.finish': { src: null, size: [256, 512], anchor: [0.5, 0.98], wu: 150 },
    'item.shot':   { src: null, size: [96, 96], anchor: [0.5, 0.5], wu: 44 },
    // FIRE (Addendum D3), Muse drop 5. Projectiles: 128x128, transparent, centred, facing right. Hit FX: 256x256 single bursts (the game scales them up and fades).
    // Sword Wave, Laser Bolt and Zoomie are code-only (src: null).
    'proj.rocket':    { src: 'fx/proj_turbo_rocket.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 54 },
    'proj.ball':      { src: 'fx/proj_bouncy_ball.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 46 },
    'proj.boomerang': { src: 'fx/proj_wing_boomerang.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 56 },
    'proj.wave':      { src: null, size: [128, 128], anchor: [0.5, 0.5], wu: 80 },  // code-only
    'proj.balloon':   { src: 'fx/proj_water_balloon.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 50 },  // translucent: body alpha >= 0.6
    'proj.gust':      { src: 'fx/proj_puppy_gust.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 52 },  // swirl core; the code adds the swirl
    'proj.teeth':     { src: 'fx/proj_chatter_teeth.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 50 },
    'proj.meteor':    { src: 'fx/proj_mini_meteor.webp', size: [128, 128], anchor: [0.5, 0.5], wu: 54 },  // ember tail included (bbox-centred, tail on the left)
    'proj.bolt':      { src: null, size: [128, 128], anchor: [0.5, 0.5], wu: 60 },  // code-only
    'proj.zoomie':    { src: null, size: [128, 128], anchor: [0.5, 0.5], wu: 50 },  // picker icon only (Ira dashes herself)
    'hitfx.firepop':  { src: 'fx/hitfx_fire_pop.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 150 }, // Dragster; Comet tinted orange
    'hitfx.confetti': { src: 'fx/hitfx_confetti.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 150 },
    'hitfx.spark':    { src: 'fx/hitfx_spark.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 140 }, // Bat Truck + Sword
    'hitfx.splash':   { src: 'fx/hitfx_splash.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 160 },
    'hitfx.puff':     { src: 'fx/hitfx_puff.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 140 },
    'hitfx.bite':     { src: 'fx/hitfx_bite.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 140 }, // Rex + Ira; the bite-mark hole is transparent
    'hitfx.zap':      { src: 'fx/hitfx_zap.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 140 },
    'fx.toot':        { src: 'fx/toot_cloud.webp', size: [256, 256], anchor: [0.5, 0.5], wu: 150 }, // Ira's Turbo Toot
    'fx.pellet':      { src: 'fx/poop_pellet.webp', size: [64, 64], anchor: [0.5, 0.75], wu: 16 },   // pellet bottom on y=48 (0.75); twinkle top-right
    // UI (HTML <img> overrides; square, transparent)
    'ui.fly':    { src: null, size: [256, 256] },
    'ui.boost':  { src: null, size: [256, 256] },
    'ui.star':   { src: null, size: [256, 256] },
    'ui.trophy': { src: null, size: [256, 256] },
    'ui.logo':   { src: null, size: [1200, 400] },
  },
  /* Parallax layers per track, back to front. role: sky | far | mid | ground | front.
     par = scroll factor (0 = fixed, 1 = moves with the road). Up to 5 layers per track are supported. */
  layers: {
    toyroom: [  // far omitted: no separate far art; sky includes the horizon scenery
      { role: 'sky', src: 'layers/toyroom_sky.webp', size: [1920, 1080], par: 0.04 },
      { role: 'mid', src: 'layers/toyroom_mid.webp', size: [1920, 720], par: 0.35, base: 0.725 },  // base: content ends at 72.5% of the image height; that line sits on the horizon
      { role: 'ground', src: 'layers/toyroom_ground.webp', size: [1920, 540], par: 1 },
      { role: 'front', src: 'layers/toyroom_front.webp', size: [1920, 300], par: 1.25 },
    ],
    desert: [  // far omitted: no separate far art; sky includes the horizon scenery
      { role: 'sky', src: 'layers/desert_sky.webp', size: [1920, 1080], par: 0.04 },
      { role: 'mid', src: 'layers/desert_mid.webp', size: [1920, 720], par: 0.35 },
      { role: 'ground', src: 'layers/desert_ground.webp', size: [1920, 540], par: 1 },
      { role: 'front', src: 'layers/desert_front.webp', size: [1920, 300], par: 1.25 },
    ],
    castle: [  // far omitted: no separate far art; sky includes the horizon scenery
      { role: 'sky', src: 'layers/castle_sky.webp', size: [1920, 1080], par: 0.04 },
      { role: 'mid', src: 'layers/castle_mid.webp', size: [1920, 720], par: 0.35 },
      { role: 'ground', src: 'layers/castle_ground.webp', size: [1920, 540], par: 1 },
      { role: 'front', src: 'layers/castle_front.webp', size: [1920, 300], par: 1.25 },
    ],
    city: [  // far omitted: no separate far art; sky includes the horizon scenery
      { role: 'sky', src: 'layers/city_sky.webp', size: [1920, 1080], par: 0.04 },
      { role: 'mid', src: 'layers/city_mid.webp', size: [1920, 720], par: 0.35 },
      { role: 'ground', src: 'layers/city_ground.webp', size: [1920, 540], par: 1 },
      { role: 'front', src: 'layers/city_front.webp', size: [1920, 300], par: 1.25 },
    ],
  },
};
