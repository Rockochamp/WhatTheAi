/* Leo's Game — ART MANIFEST. This is the only file to edit when real art arrives (see art/ART_SPEC.md).
   - src: path relative to this art/ folder (transparent WebP or PNG). null = use the built-in interim vector art.
   - v:   bump the global `version` (or a per-entry `v`) whenever a file changes: the CDN caches each URL for 30 days.
   - size: the canvas size the art is authored at, [w, h] px. anchor: [ax, ay] point (0..1) that sits on the ground/contact line.
   - wu:  drawn width in world units (the game scales art to this; height follows the image aspect ratio).
   A missing or broken file silently falls back to the interim art, so partial drops are safe. */
window.LEO_MANIFEST = {
  version: 1,
  base: 'art/',
  sprites: {
    // Vehicles: side view facing right, 2:1 canvas. Wheels (or the bottom of the hull) touch y = 92% in every pose.
    'veh.dragster.drive': { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.dragster.fly':   { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.dragster.boost': { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.dragster.celebrate': { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.bibi.drive':     { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 190 },
    'veh.bibi.fly':       { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 190 },
    'veh.bibi.boost':     { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 190 },
    'veh.bibi.celebrate': { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 190 },
    'veh.truck.drive':    { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 245 },
    'veh.truck.fly':      { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 245 },
    'veh.truck.boost':    { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 245 },
    'veh.truck.celebrate': { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 245 },
    'veh.sword.drive':    { src: null, size: [512, 256], anchor: [0.5, 0.80], wu: 250 },
    'veh.sword.fly':      { src: null, size: [512, 256], anchor: [0.5, 0.80], wu: 250 },
    'veh.sword.boost':    { src: null, size: [512, 256], anchor: [0.5, 0.80], wu: 250 },
    'veh.sword.celebrate': { src: null, size: [512, 256], anchor: [0.5, 0.80], wu: 250 },
    'veh.jet.drive':      { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.jet.fly':        { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.jet.boost':      { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    'veh.jet.celebrate':  { src: null, size: [512, 256], anchor: [0.5, 0.92], wu: 235 },
    // Rivals: friendly smiley racers, drive pose only.
    'rival.orange': { src: null, size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    'rival.green':  { src: null, size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    'rival.blue':   { src: null, size: [384, 192], anchor: [0.5, 0.93], wu: 175 },
    // Smashables (intact). Bottom edge on the ground; towers and pyramids are stacked in code from single pieces.
    'smash.cone':    { src: null, size: [128, 160], anchor: [0.5, 0.97], wu: 66 },
    'smash.box':     { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 82 },
    'smash.crate':   { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 90 },
    'smash.block':   { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 90 },
    'smash.wall':    { src: null, size: [192, 384], anchor: [0.5, 0.98], wu: 108 },
    'smash.barrel':  { src: null, size: [160, 192], anchor: [0.5, 0.97], wu: 84 },
    'smash.mega':    { src: null, size: [160, 160], anchor: [0.5, 0.97], wu: 92 },
    'smash.balloon': { src: null, size: [160, 256], anchor: [0.5, 0.60], wu: 82 },
    'smash.cloud':   { src: null, size: [256, 176], anchor: [0.5, 0.92], wu: 132 },
    // Debris chunks (centre anchored, spun in code). 3-4 variants per material look best; add .2/.3 later.
    'debris.cone':    { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.card':    { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.wood':    { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.block':   { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.brick':   { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 30 },
    'debris.barrel':  { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 34 },
    'debris.balloon': { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 24 },
    'debris.cloud':   { src: null, size: [64, 64], anchor: [0.5, 0.5], wu: 40 },
    // Items and track props
    'item.star':   { src: null, size: [128, 128], anchor: [0.5, 0.5], wu: 52 },
    'item.ramp':   { src: null, size: [320, 160], anchor: [0.5, 0.97], wu: 190 },
    'item.finish': { src: null, size: [256, 512], anchor: [0.5, 0.98], wu: 150 },
    'item.shot':   { src: null, size: [96, 96], anchor: [0.5, 0.5], wu: 44 },
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
    toyroom: [
      { role: 'sky', src: null, size: [1920, 1080], par: 0.04 },
      { role: 'far', src: null, size: [1920, 720], par: 0.12 },
      { role: 'mid', src: null, size: [1920, 720], par: 0.35 },
      { role: 'ground', src: null, size: [1920, 540], par: 1 },
    ],
    desert: [
      { role: 'sky', src: null, size: [1920, 1080], par: 0.04 },
      { role: 'far', src: null, size: [1920, 720], par: 0.12 },
      { role: 'mid', src: null, size: [1920, 720], par: 0.35 },
      { role: 'ground', src: null, size: [1920, 540], par: 1 },
    ],
    castle: [
      { role: 'sky', src: null, size: [1920, 1080], par: 0.04 },
      { role: 'far', src: null, size: [1920, 720], par: 0.12 },
      { role: 'mid', src: null, size: [1920, 720], par: 0.35 },
      { role: 'ground', src: null, size: [1920, 540], par: 1 },
    ],
    city: [
      { role: 'sky', src: null, size: [1920, 1080], par: 0.04 },
      { role: 'far', src: null, size: [1920, 720], par: 0.12 },
      { role: 'mid', src: null, size: [1920, 720], par: 0.35 },
      { role: 'ground', src: null, size: [1920, 540], par: 1 },
    ],
  },
};
