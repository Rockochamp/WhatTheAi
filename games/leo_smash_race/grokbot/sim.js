/* Leo's Game — race simulation (pure logic, no DOM).
   Custom side-scrolling physics: x = distance along the track, lane = depth (0 back, 1 middle, 2 front),
   z = height above the road. Units are "world units" (about 1 cm of toy scale). Runs at a fixed timestep. */
(function (root) {
'use strict';
const STEP = 1 / 120;          // fixed physics timestep (s)
const MAXZ = 560;              // flight ceiling
const COMBO_WINDOW = 1.5;      // s between smashes to keep the chain
const RACE_SECONDS = 86;       // target race length at the hero's cruise speed

const VEHICLES = {
  dragster: { id: 'dragster', name: 'Flame Dragster', speed: 640, len: 200, h: 72, fly: 'wings', jumpV: 560, thrust: 2600, maxUp: 470, glide: -250, grav: 1700, bounce: 0.28, special: 'nitro', specialName: 'Nitro Burst', stats: { speed: 3, smash: 2, fly: 2 }, horn: 'roar' },
  bibi:     { id: 'bibi', name: 'Bibi', speed: 440, len: 150, h: 82, fly: 'bounce', jumpV: 780, airJumpV: 640, airJumps: 2, grav: 1750, bounce: 0.62, special: 'toss', specialName: 'Basket Toss', stats: { speed: 1, smash: 2, fly: 1 }, horn: 'bell' },
  truck:    { id: 'truck', name: 'Bat Truck', speed: 520, len: 205, h: 118, fly: 'wings', jumpV: 680, thrust: 2300, maxUp: 430, glide: -280, grav: 1800, bounce: 0.34, special: 'pound', specialName: 'Big Jump', stats: { speed: 2, smash: 3, fly: 2 }, horn: 'rumble' },
  sword:    { id: 'sword', name: 'Hero Sword', speed: 560, len: 225, h: 56, fly: 'always', hover: 34, jumpV: 420, thrust: 2400, maxUp: 470, glide: -170, grav: 1000, bounce: 0.2, special: 'spin', specialName: 'Spin Slash', stats: { speed: 2, smash: 2, fly: 3 }, horn: 'shing' },
  jet:      { id: 'jet', name: 'Sky Patroller', speed: 540, len: 195, h: 84, fly: 'hover', hover: 26, jumpV: 420, thrust: 2300, maxUp: 440, glide: -130, grav: 900, bounce: 0.2, special: 'beam', specialName: 'Rescue Beam', stats: { speed: 2, smash: 2, fly: 3 }, horn: 'rotor', optional: true },
  /* Addendum B heroes. Optional per-hero fields (the first five keep the defaults):
     laneT = seconds per lane change (default 1/7), accelT = seconds to reach cruise speed (default 1/1.4),
     superMult = speed multiplier during the special (default 1.7), flatten = rams squash smashables flat. */
  pup:      { id: 'pup', name: 'Whirly Pup', speed: 600, len: 105, h: 58, fly: 'wings', jumpV: 640, thrust: 2900, maxUp: 500, glide: -150, grav: 1300, bounce: 0.5, laneT: 0.12, superMult: 1.4, special: 'whirl', specialName: 'Whirlwind Spin', stats: { speed: 2, smash: 1, fly: 3 }, horn: 'yip' },
  comet:    { id: 'comet', name: 'Comet 17', speed: 610, len: 145, h: 66, fly: 'wings', jumpV: 560, thrust: 2500, maxUp: 440, glide: -220, grav: 1650, bounce: 0.22, laneT: 0.13, accelT: 0.4, superMult: 1.6, special: 'comet', specialName: 'Comet Dash', stats: { speed: 3, smash: 1, fly: 2 }, horn: 'chirp' },
  /* Addendum D heroes. laser: the high-tech glider (best flyer among the cars). ira: RC's Mini Bull Terrier, she runs (runner: paws, no engine). */
  laser:    { id: 'laser', name: 'Laser Racer', speed: 590, len: 165, h: 62, fly: 'wings', jumpV: 560, thrust: 2600, maxUp: 470, glide: -180, grav: 1500, bounce: 0.25, laneT: 0.15, accelT: 0.5, superMult: 1.8, special: 'laser', specialName: 'Laser Drive', stats: { speed: 2, smash: 2, fly: 3 }, horn: 'vwee' },
  ira:      { id: 'ira', name: 'Ira', speed: 560, len: 150, h: 80, fly: 'bounce', jumpV: 700, airJumpV: 620, airJumps: 2, grav: 1600, bounce: 0.4, laneT: 0.11, accelT: 0.25, superMult: 1.7, special: 'toot', specialName: 'Turbo Toot', stats: { speed: 2, smash: 2, fly: 1 }, horn: 'woof', runner: true },
  rex:      { id: 'rex', name: 'Chomp Rex', speed: 500, len: 215, h: 120, fly: 'wings', jumpV: 620, thrust: 2000, maxUp: 380, glide: -320, grav: 1900, bounce: 0.45, laneT: 0.22, accelT: 1.0, superMult: 1.3, flatten: true, special: 'chomp', specialName: 'Shark Chomp', stats: { speed: 2, smash: 3, fly: 1 }, horn: 'growl' },
};
const VEHICLE_ORDER = ['dragster', 'bibi', 'truck', 'sword', 'jet', 'pup', 'rex', 'comet', 'laser', 'ira'];
const WHIRL = { reach: 260, back: 140, zReach: 320, orbit: 0.75, turns: 1.5, max: 28 };  // Whirly Pup's tornado
const CHOMP = { reach: 130, bite: 0.07, zReach: 230, hop: 0.3 };                        // Chomp Rex's jaw
/* Comet 17's Comet Dash (Addendum C): transform 0.3 s, lift 60, auto skip every 0.9 s (+ a skip per JUMP tap, 0.35 s apart),
   180-wide impacts over 3 lanes, a 260-wide final impact over all lanes at 3.2 s, then the pop-out. */
/* Laser Racer's Laser Drive (D1): twin lasers sweep out to 520 ahead over 0.25 s, slicing in its lane and both neighbours. */
const LASER = { reach: 520, lanes: 1.25, sweep: 0.25, zUp: 260, zDown: 60 };
/* Ira's Turbo Toot (D6): a 0.22 s surprised look back (she slows), then PFRRRT and x1.7, ramming through her lane like Nitro. */
const TOOT = { look: 0.22, slow: 0.35, reach: 130 };
/* Ira's Zoomie Chomp dash: whirl out at 2000 wu/s (relative), chew 0.3 s, whirl back in 0.18 s; a miss spins 0.45 s in place.
   It eats the target group plus the next object up to 300 wu behind it in the same lane. */
const DASH = { v: 2000, chew: 0.3, back: 0.18, spin: 0.45, next: 300 };
/* FIRE (Addendum D2/D3). One weapon per hero; cd = cooldown (s), v = projectile speed relative to the car (wu/s), r = hit radius,
   range = auto-aim / fizzle distance, hits = targets per shot, splash = extra radius, bounce = re-aims after a hit, ret = out and back,
   arc = lob height, dash = Ira runs there herself. Cooldowns are balanced so the time per kill in the hold-to-fire benchmark
   (tests/leo_smash_race.test.mjs, "FIRE balance") sits within +-15% across all heroes. */
const SHARP = 25; // flat Sharp Shot bonus per shot kill
const WEAPONS = {
  dragster: { id: 'rocket',    name: 'Turbo Rocket',   word: 'BOOM!',    cd: 0.75, v: 1500, r: 22, range: 650, splash: 60, fx: 'firepop',  col: '#ff6a2a' },
  bibi:     { id: 'ball',      name: 'Bouncy Ball',    word: 'BOING!',   cd: 1.2, v: 950,  r: 26, range: 650, hits: 2, bounce: true, range2: 420, fx: 'confetti', col: '#7df0b8' },
  truck:    { id: 'boomerang', name: 'Wing Boomerang', word: 'WHACK!',   cd: 0.7,  v: 1150, r: 26, range: 650, hits: 2, ret: true, fx: 'spark', col: '#ffd23f' },
  sword:    { id: 'wave',      name: 'Sword Wave',     word: 'SLASH!',   cd: 1.2,  v: 1300, r: 30, range: 650, hits: 2, fx: 'spark', col: '#c9a6ff' },
  jet:      { id: 'balloon',   name: 'Water Balloon',  word: 'SPLASH!',  cd: 0.65,  v: 950,  r: 26, range: 650, arc: 140, fx: 'splash', col: '#5cc8ff' },
  pup:      { id: 'gust',      name: 'Puppy Gust',     word: 'WHOOSH!',  cd: 0.65, v: 1800, r: 26, range: 450, fx: 'puff', col: '#ff8fc8' },
  rex:      { id: 'teeth',     name: 'Chatter Teeth',  word: 'CHOMP!',   cd: 0.65,  v: 650,  r: 30, range: 650, fx: 'bite', col: '#3fe0d0' },
  comet:    { id: 'meteor',    name: 'Mini Meteor',    word: 'KA-POW!',  cd: 0.9,  v: 1250, r: 24, range: 650, splash: 80, fx: 'firepop', tint: 'orange', col: '#ffa53a' },
  laser:    { id: 'bolt',      name: 'Laser Bolt',     word: 'ZAP!',     cd: 0.6,  v: 2400, r: 20, range: 650, fx: 'zap', col: '#46b4ff' },
  ira:      { id: 'zoomie',    name: 'Zoomie Chomp',   word: 'CHOMP-CHOMP!', cd: 1.1, v: DASH.v, r: 30, range: 420, dash: true, fx: 'bite', col: '#f0a05a' },
};
const COMET = { trans: 0.3, lift: 60, every: 0.9, gap: 0.35, dive: 0.12, hop: 0.45, hopH: 55, r: 180, rFinal: 260, finalAt: 3.2, burn: 40 };

/* Smashable kinds: points per smash group, world size, debris sprite and sound. */
const KINDS = {
  cone:    { pts: 10,  w: 60,  h: 66,  debris: 'cone',    snd: 'bonk',    chunks: 6 },
  box:     { pts: 10,  w: 76,  h: 76,  debris: 'card',    snd: 'bonk',    chunks: 7 },
  crate:   { pts: 50,  w: 84,  h: 84,  debris: 'wood',    snd: 'crash',   chunks: 7 },
  block:   { pts: 50,  w: 84,  h: 84,  debris: 'block',   snd: 'crash',   chunks: 6 },
  wall:    { pts: 100, w: 100, h: 152, debris: 'brick',   snd: 'crumble', chunks: 16 },
  wallw:   { pts: 100, w: 172, h: 126, debris: 'brick',   snd: 'crumble', chunks: 18 },
  barrel:  { pts: 300, w: 86,  h: 62,  debris: 'barrel',  snd: 'boom',    chunks: 7 },
  mega:    { pts: 300, w: 86,  h: 86,  debris: 'block',   snd: 'boom',    chunks: 6 },
  balloon: { pts: 150, w: 70,  h: 110, debris: 'balloon', snd: 'pop',     chunks: 8, sky: true },
  cloud:   { pts: 150, w: 120, h: 84,  debris: 'cloud',   snd: 'pop',     chunks: 8, sky: true },
};

const TRACKS = [
  { id: 'toyroom', name: 'Toy Room Rally', unlock: 0, small: ['cone', 'box'], tower: 'block', wall: 'block', pyr: 'mega', sky: ['balloon'],
    mix: { small: 5, tower: 3, wall: 1, sky: 2, stars: 4, ramp: 1 }, pyramidEvery: 13, music: 0 },
  { id: 'desert', name: 'Desert Demolition', unlock: 1, small: ['cone', 'box'], tower: 'crate', wall: 'wall', pyr: 'barrel', sky: ['balloon'],
    mix: { small: 4, tower: 4, wall: 2, sky: 2, stars: 3, ramp: 2 }, pyramidEvery: 11, gap: 0.42, music: 1 },
  { id: 'castle', name: 'Castle Sky Run', unlock: 3, small: ['cone', 'box'], tower: 'crate', wall: 'wall', pyr: 'barrel', sky: ['cloud', 'balloon'],
    mix: { small: 3, tower: 2, wall: 3, sky: 3, stars: 3, ramp: 2 }, pyramidEvery: 12, skyRun: 0.55, music: 2 },
  { id: 'city', name: 'Bat City Night', unlock: 5, small: ['cone', 'box'], tower: 'crate', wall: 'wall', pyr: 'barrel', sky: ['balloon', 'cloud'],
    mix: { small: 4, tower: 3, wall: 3, sky: 2, stars: 3, ramp: 2 }, pyramidEvery: 10, music: 3 },
];
const RIVALS = [{ id: 'orange', color: '#ff8a1f', f: 1.0 }, { id: 'green', color: '#27c46b', f: 1.03 }, { id: 'blue', color: '#2f8cff', f: 1.055 }];
const PLACE_BONUS = [500, 300, 150];

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function pickW(r, mix) { let tot = 0; for (const k in mix) tot += mix[k]; let v = r() * tot; for (const k in mix) { v -= mix[k]; if (v <= 0) return k; } return Object.keys(mix)[0]; }

/* Build the track: everything is placed by time (seconds of cruising) times the hero's speed, so every hero gets a ~90 s race. */
function buildTrack(track, veh, seed) {
  const r = rng(seed || 7), S = veh.speed, L = Math.round(S * RACE_SECONDS);
  const objs = [], ramps = [], gaps = []; let gid = 0;
  const add = (kind, x, lane, z, extra) => { const k = KINDS[kind]; const o = Object.assign({ kind, x, lane, z: z || 0, w: k.w, h: k.h, alive: true, pts: 0, group: 0 }, extra || {}); objs.push(o); return o; };
  const star = (x, lane, z) => objs.push({ kind: 'star', x, lane, z: z || 0, w: 50, h: 50, alive: true, star: true });
  let t = 2.2, nextPyr = 7;
  const gapAt = track.gap ? L * track.gap : -1;
  while (t < RACE_SECONDS - 2.5) {
    const x = t * S, lane = Math.floor(r() * 3);
    if (gapAt > 0 && Math.abs(x - gapAt) < S * 1.6) { // desert canyon: ramp, a gap, sky targets and a star arc over it
      if (!gaps.length) { ramps.push({ x: gapAt - S * 0.9, big: true }); gaps.push({ x0: gapAt - S * 0.55, x1: gapAt + S * 0.55 });
        for (let i = 0; i < 7; i++) star(gapAt - S * 0.5 + i * S * 0.17, 1, 200 + Math.sin(i / 6 * Math.PI) * 220);
        add(track.sky[0], gapAt, 0, 330, { pts: 150, group: ++gid, lead: true }); add(track.sky[0], gapAt + 60, 2, 300, { pts: 150, group: ++gid, lead: true }); }
      t += 0.5; continue;
    }
    if (t >= nextPyr) { // the big one: a pyramid, slow-mo explosion
      const g = ++gid, k = track.pyr, kk = KINDS[k];
      [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]].forEach(([c, row], i) => add(k, x + (c - 1) * kk.w * 0.98, lane, row * kk.h * 0.96, { group: g, pts: i === 0 ? kk.pts : 0, lead: i === 0, pyr: true }));
      for (let i = 0; i < 3; i++) star(x + S * 0.35 + i * 60, lane, 40);
      nextPyr += track.pyramidEvery * (0.85 + r() * 0.3); t += 1.3; continue;
    }
    const skyRun = track.skyRun && t > RACE_SECONDS * track.skyRun;
    const mix = skyRun ? Object.assign({}, track.mix, { sky: track.mix.sky * 2.4, ramp: track.mix.ramp * 1.5 }) : track.mix;
    const p = pickW(r, mix);
    if (p === 'small') {
      const n = 2 + Math.floor(r() * 3), across = r() < 0.45;
      for (let i = 0; i < n; i++) { const k = track.small[Math.floor(r() * track.small.length)]; add(k, x + (across ? (i % 2) * 40 : i * 95), across ? i % 3 : lane, 0, { group: ++gid, pts: KINDS[k].pts, lead: true }); }
      t += 0.55 + n * 0.12;
    } else if (p === 'tower') {
      const g = ++gid, k = track.tower, n = 3 + Math.floor(r() * 2), kk = KINDS[k];
      for (let i = 0; i < n; i++) add(k, x + (i % 2 ? 6 : -6), lane, i * kk.h * 0.97, { group: g, pts: i === 0 ? kk.pts : 0, lead: i === 0, tier: i });
      t += 0.95;
    } else if (p === 'wall') {
      const k = track.wall;
      if (k === 'wall') add(r() < 0.4 ? 'wallw' : 'wall', x, lane, 0, { group: ++gid, pts: 100, lead: true });
      else { const g = ++gid; for (let row = 0; row < 2; row++) for (let c = 0; c < 2; c++) add(k, x + c * 84, lane, row * 82, { group: g, pts: row + c === 0 ? 100 : 0, lead: row + c === 0 }); }
      t += 0.9;
    } else if (p === 'sky') {
      const n = 3 + Math.floor(r() * 3), z0 = 210 + r() * 120;
      for (let i = 0; i < n; i++) add(track.sky[Math.floor(r() * track.sky.length)], x + i * 120, lane, z0 + Math.sin(i / (n - 1) * Math.PI) * 90, { group: ++gid, pts: 150, lead: true });
      for (let i = 0; i < n - 1; i++) star(x + 60 + i * 120, lane, z0 - 40);
      t += 1.1;
    } else if (p === 'stars') {
      const n = 5, arc = r() < 0.5;
      for (let i = 0; i < n; i++) star(x + i * 70, lane, arc ? 30 + Math.sin(i / (n - 1) * Math.PI) * 150 : 20);
      t += 0.7;
    } else if (p === 'ramp') {
      ramps.push({ x });
      const lz = 260, n = 4;
      for (let i = 0; i < n; i++) star(x + S * 0.3 + i * 75, lane, lz + Math.sin(i / (n - 1) * Math.PI) * 80);
      add(track.sky[0], x + S * 0.95, lane, 360, { group: ++gid, pts: 150, lead: true });
      t += 1.4;
    }
  }
  objs.sort((a, b) => a.x - b.x); ramps.sort((a, b) => a.x - b.x);
  let maxPts = 0; for (const o of objs) maxPts += o.pts || 0;
  return { L, objs, ramps, gaps, maxPts };
}

function createRace(opts) {
  const veh = VEHICLES[opts.vehicle] || VEHICLES.dragster, track = TRACKS.find(t => t.id === opts.track) || TRACKS[0];
  const tr = buildTrack(track, veh, opts.seed || (Date.now() & 0xffff));
  const p = { x: 0, lane: 1, laneF: 1, z: veh.hover || 0, vz: 0, speed: 0, airJumps: veh.airJumps || 0, boostT: 0, boostMult: 1, superT: 0, wing: 0, pounding: false, celebrate: 0, onGround: true, lastLaneT: 0, assistT: 0, hopT: -9 };
  const rivals = RIVALS.map((rv, i) => ({ id: rv.id, color: rv.color, f: rv.f, x: -120 - i * 150, lane: i === 1 ? 1 : (i === 0 ? 0 : 2), laneF: i === 1 ? 1 : (i === 0 ? 0 : 2), z: 0, speed: 0, fin: 0, bob: i }));
  return { veh, track, tr, p, rivals, t: 0, countdown: opts.countdown == null ? 2.4 : opts.countdown, assist: opts.assist !== false,
    score: 0, smashPts: 0, stars: 0, smashes: 0, chain: 0, mult: 1, bestMult: 1, lastSmash: -9, boost: opts.fullBoost ? 1 : 0.15,
    weapon: WEAPONS[veh.id] || WEAPONS.dragster, fireCd: 0, proj: [], dash: null, hits: 0, shotPts: 0, fired: 0,
    events: [], queue: [], shots: [], idx: 0, finished: false, finT: 0, place: 0, slow: 0, specials: 0,
    reduced: !!opts.reduced, captured: [], bag: [], biteT: 0, eaten: 0, pulled: 0 };
}

function emit(R, e) { R.events.push(e); }

function smashGroup(R, o, how) {
  if (!o.alive) return;
  const g = o.group, now = R.t;
  if (now - R.lastSmash <= COMBO_WINDOW) R.chain++; else R.chain = 1;
  R.lastSmash = now; R.mult = Math.min(5, R.chain); if (R.mult > R.bestMult) R.bestMult = R.mult;
  let pts = 0, members = [o];
  if (g) for (let i = Math.max(0, R.idx - 40); i < R.tr.objs.length; i++) { const q = R.tr.objs[i]; if (q.x > o.x + 400) break; if (q !== o && q.alive && q.group === g) members.push(q); }
  members.forEach(m => pts += m.pts || 0);
  const gained = pts * R.mult; R.basePts = (R.basePts || 0) + pts; R.smashPts += gained; R.score += gained; R.smashes++;
  const k = KINDS[o.kind], bk = how === 'shot' ? 0.5 : 1; // a shot kill fills the boost at half the ram rate
  R.boost = Math.min(1, R.boost + (pts >= 300 ? 0.34 : pts >= 100 ? 0.18 : pts >= 50 ? 0.12 : 0.06) * bk);
  members.sort((a, b) => a.z - b.z);
  members.forEach((m, i) => { if (i === 0) { m.alive = false; emit(R, { type: 'smash', o: m, kind: m.kind, how, first: true, pts: gained, mult: R.mult, big: pts >= 300, snd: k.snd }); }
    else { m.alive = false; R.queue.push({ at: now + i * 0.05, o: m, how }); } });
  if (pts >= 300) { R.slow = 0.55; emit(R, { type: 'big', x: o.x }); }
  if (R.mult >= 2) emit(R, { type: 'combo', mult: R.mult });
}

function collectStar(R, o, how) { o.alive = false; R.stars++; R.score += 20; R.boost = Math.min(1, R.boost + 0.01); emit(R, { type: 'star', o, how }); }

/* Chomp Rex: one bite eats one object (towers go bottom-up, one piece per bite); every bite adds to the combo.
   Only the piece that carries the group's points scores, so eating a tower is worth the same as smashing it. */
function chompOne(R, o) {
  if (!o.alive) return;
  const now = R.t;
  if (now - R.lastSmash <= COMBO_WINDOW) R.chain++; else R.chain = 1;
  R.lastSmash = now; R.mult = Math.min(5, R.chain); if (R.mult > R.bestMult) R.bestMult = R.mult;
  o.alive = false; R.eaten++; R.bag.push(o.kind);
  if (o.star) { R.stars++; R.score += 20; R.boost = Math.min(1, R.boost + 0.01); emit(R, { type: 'chomp', o, kind: 'star', pts: 0, mult: R.mult }); return; }
  const pts = o.pts || 0, gained = pts * R.mult; R.basePts = (R.basePts || 0) + pts; R.smashPts += gained; R.score += gained; if (pts) R.smashes++;
  if (pts) R.boost = Math.min(1, R.boost + (pts >= 300 ? 0.34 : pts >= 100 ? 0.18 : pts >= 50 ? 0.12 : 0.06));
  emit(R, { type: 'chomp', o, kind: o.kind, pts: gained, mult: R.mult, snd: KINDS[o.kind].snd });
  if (R.mult >= 2) emit(R, { type: 'combo', mult: R.mult });
}
/* Comet 17: one meteor-skip impact (or the big final one). Smashes and collects in range, sets everything on fire. */
function cometImpact(R, final) {
  const P = R.p, r = final ? COMET.rFinal : COMET.r, zMax = final ? 340 : 240; let n = 0;
  for (let i = Math.max(0, R.idx - 20); i < R.tr.objs.length; i++) { const o = R.tr.objs[i], dx = o.x - P.x; if (dx > r + 120) break; if (!o.alive || o.cap) continue;
    if (Math.abs(dx) > r + (o.w || 0) * 0.5 || o.z > zMax) continue; if (!final && Math.abs(o.lane - P.laneF) > 1.25) continue;
    if (o.star) collectStar(R, o, 'comet'); else { smashGroup(R, o, 'comet'); n++; } }
  R.comet.impacts++; emit(R, { type: 'impact', x: P.x, lane: P.laneF, final, r, n });
}
// auto skips stay on a fixed 0.9 s beat (scheduled times, no per-step drift); a tap skip restarts the beat
function cometStep(R, input) {
  const P = R.p, C = R.comet, c = R.t - C.t0, E = COMET, ease = k => 1 - Math.pow(1 - k, 3);
  const lift = c < E.trans ? C.z0 + (E.lift - C.z0) * ease(c / E.trans) : E.lift;
  if (c >= E.finalAt) { // final impact, then the shell cracks and the car pops out with a hop
    if (!C.final) { C.final = true; C.dive = 0; cometImpact(R, true); }
    const k = Math.min(1, (c - E.finalAt) / (3.6 - E.finalAt)); P.z = Math.max(0, Math.sin(k * Math.PI) * 85);
    if (!C.popped && c >= E.finalAt + 0.08) { C.popped = true; emit(R, { type: 'cometPop', x: P.x, lane: P.laneF, z: P.z }); }
  } else {
    const canSkip = c >= E.trans && c < E.finalAt - E.dive && !C.dive, tap = input.jumpPressed && R.t - C.lastStart >= E.gap;
    if (canSkip && (R.t >= C.next || tap)) { if (R.t < C.next) C.taps++; C.dive = (R.t >= C.next ? C.next : R.t) + E.dive; C.diveT0 = R.t; C.diveFrom = P.z; C.lastStart = R.t; emit(R, { type: 'skip', tap: R.t < C.next }); }
    if (C.dive) { const k = Math.min(1, (R.t - C.diveT0) / (C.dive - C.diveT0)); P.z = C.diveFrom * (1 - k * k);
      if (R.t >= C.dive - 1e-9) { C.next = C.dive + E.every - E.dive; C.dive = 0; C.last = R.t; P.z = 0; cometImpact(R, false); } }
    else if (R.t - C.last < E.hop) { const k = (R.t - C.last) / E.hop; P.z = lift * k + Math.sin(k * Math.PI) * E.hopH; }
    else P.z = lift;
  }
  P.vz = 0;
}
/* Whirly Pup: capture a smashable (and the rest of its group) into the funnel; it orbits, then flies out. */
function capture(R, o) {
  const P = R.p, list = [o];
  if (o.group) for (let i = Math.max(0, R.idx - 40); i < R.tr.objs.length; i++) { const q = R.tr.objs[i]; if (q.x > o.x + 600) break; if (q !== o && q.alive && !q.cap && q.group === o.group) list.push(q); }
  list.forEach((q, i) => { const dx = q.x - P.x, dl = q.lane - P.laneF;
    q.cap = { t: -i * 0.06, x0: dx, l0: dl, z0: q.z, a0: Math.atan2(dl * 120, dx), r0: Math.max(80, Math.hypot(dx, dl * 120)), lane0: q.lane }; R.captured.push(q); });
  R.pulled += list.length; emit(R, { type: 'pull', o, n: list.length });
}
function releaseAll(R) { const list = R.captured.slice(); R.captured.length = 0; for (const q of list) if (q.alive) smashGroup(R, q, 'whirl'); }

/* ---------------- FIRE (Addendum D) ---------------- */
// nearest target ahead within range: own lane first, then a neighbouring lane. Stars, captured pieces and rivals are never targets.
function aimTarget(R, x0, lane0, range, skip) {
  let best = null, bd = 1e9, side = null, sd = 1e9; const objs = R.tr.objs;
  for (let i = R.idx; i < objs.length; i++) { const o = objs[i], dx = o.x - x0; if (dx > range) break; if (dx < -10 || !o.alive || o.star || o.cap) continue;
    if (skip && skip.has(o.group || o)) continue; const dl = Math.abs(o.lane - lane0);
    if (dl < 0.5) { if (dx < bd) { bd = dx; best = o; } } else if (dl < 1.5 && dx < sd) { sd = dx; side = o; } }
  return best || side;
}
function fireRange(R) { return Math.min(R.weapon.range, R.viewAhead || 1e9); }
function fire(R) {
  const P = R.p, V = R.veh, W = R.weapon, x0 = P.x + V.len * 0.45, tgt = aimTarget(R, x0, P.laneF, fireRange(R), null);
  R.fireCd = W.cd; R.fired++;
  if (W.dash) { R.dash = { tgt, t: 0, ph: tgt ? 'go' : 'spin', x: P.x, lane: P.laneF, z: P.z, from: null }; emit(R, { type: 'fire', w: W.id, dash: true, miss: !tgt }); return; }
  const s = { w: W, x: x0, lane: P.laneF, z: P.z + V.h * 0.55, vx: P.speed + W.v, t: 0, tgt, hits: 0, back: false, hitG: new Set(), xs: x0, zs: P.z + V.h * 0.55 };
  R.proj.push(s); emit(R, { type: 'fire', w: W.id, s, miss: !tgt });
}
// every killed group scores its points x combo + the flat Sharp Shot bonus; one event (one popup) per shot
function shotKills(R, list, W, x, lane, z) {
  let pts = 0; const done = [];
  for (const o of list) { if (!o.alive) continue; const b = R.smashPts; smashGroup(R, o, 'shot'); pts += R.smashPts - b + SHARP; R.hits++; R.shotPts += SHARP; R.score += SHARP; done.push(o); }
  if (done.length) emit(R, { type: 'shotHit', w: W.id, word: W.word, fx: W.fx, x, lane, z, pts, n: done.length, mult: R.mult, objs: done });
  return done.length;
}
function projHit(R, s, o) {
  const W = s.w, list = [o], objs = R.tr.objs; s.hitG.add(o.group || o); s.hits++;
  if (W.splash) for (let j = Math.max(0, R.idx - 10); j < objs.length; j++) { const q = objs[j]; if (q.x - s.x > W.splash + 120) break;
    if (!q.alive || q.star || q.cap || s.hitG.has(q.group || q)) continue;
    if (Math.abs(q.x - s.x) < W.splash + q.w * 0.5 && Math.abs(q.lane - o.lane) < 0.6 && q.z < s.z + W.splash + 60 && q.z + q.h > s.z - W.splash - 60) { s.hitG.add(q.group || q); list.push(q); } }
  shotKills(R, list, W, s.x, s.lane, s.z);
}
function stepProj(R, dt) {
  const P = R.p, V = R.veh, objs = R.tr.objs;
  for (let i = R.proj.length - 1; i >= 0; i--) {
    const s = R.proj[i], W = s.w; s.t += dt;
    if (s.tgt && (!s.tgt.alive || s.tgt.x < s.x - 60)) s.tgt = null;
    if (s.back) { s.vx = P.speed - W.v * 0.9; const k = Math.min(1, dt * 8); s.lane += (P.laneF - s.lane) * k; s.z += (P.z + V.h * 0.5 - s.z) * k; }
    else if (s.tgt) { const t = s.tgt, rem = Math.max(dt, (t.x - s.x) / Math.max(100, s.vx)), k = Math.min(1, dt / Math.max(dt, rem * 0.6)), zt = t.z + t.h * 0.5; // gentle homing: on line by ~60% of the flight
      s.lane += (t.lane - s.lane) * k;
      if (W.arc) { const q = Math.max(0, Math.min(1, (s.x - s.xs) / Math.max(1, t.x - s.xs))); s.z = s.zs + (zt - s.zs) * q + W.arc * 4 * q * (1 - q); } // lobbed
      else s.z += (zt - s.z) * k; }
    s.x += s.vx * dt;
    let hitO = null;
    for (let j = Math.max(0, R.idx - 10); j < objs.length; j++) { const o = objs[j]; if (o.x - s.x > 160) break; if (s.x - o.x > 160 || !o.alive || o.star || o.cap || s.hitG.has(o.group || o)) continue;
      if (Math.abs(o.x - s.x) < o.w * 0.5 + W.r && Math.abs(o.lane - s.lane) < 0.45 && s.z > o.z - W.r && s.z < o.z + o.h + W.r) { hitO = o; break; } }
    if (hitO) { projHit(R, s, hitO);
      if (s.hits >= (W.hits || 1)) { R.proj.splice(i, 1); emit(R, { type: 'projEnd', s, hit: true }); continue; }
      if (W.bounce) { s.tgt = aimTarget(R, s.x + 10, s.lane, W.range2 || 400, s.hitG); s.xs = s.x; s.zs = s.z; emit(R, { type: 'bounce', s }); }
      else if (W.ret) s.back = true; else s.tgt = null; } // the sword wave pierces on along its line
    const rel = s.x - P.x;
    if (W.ret && !s.back && rel > W.range * 0.9) s.back = true;
    if (s.back && rel < V.len * 0.4) { R.proj.splice(i, 1); emit(R, { type: 'projEnd', s, caught: true }); continue; }
    if ((!s.back && rel > W.range + 60) || s.t > 4) { R.proj.splice(i, 1); emit(R, { type: 'projEnd', s, fizzle: true }); }
  }
}
// Ira's Zoomie Chomp: her whirlwind body really runs to the target, chews the group + the next object behind it, then pops back
function stepDash(R, dt) {
  const D = R.dash, P = R.p, E = DASH; D.t += dt;
  if (D.ph === 'go') {
    if (!D.tgt.alive) { D.ph = 'back'; D.t = 0; D.from = { dx: D.x - P.x, lane: D.lane, z: D.z }; return; }
    const tx = D.tgt.x - D.tgt.w * 0.3, k = Math.min(1, dt * 16); D.x += (P.speed + E.v) * dt; D.lane += (D.tgt.lane - D.lane) * k; D.z += (D.tgt.z - D.z) * k;
    if (D.x >= tx) { D.x = tx; D.lane = D.tgt.lane; D.ph = 'chew'; D.t = 0; chewKill(R, D); }
  } else if (D.ph === 'chew') { if (D.t >= E.chew) { D.ph = 'back'; D.t = 0; D.from = { dx: D.x - P.x, lane: D.lane, z: D.z }; } }
  else if (D.ph === 'back') { const k = Math.min(1, D.t / E.back), f = D.from; D.x = P.x + f.dx * (1 - k); D.lane = f.lane + (P.laneF - f.lane) * k; D.z = f.z + (P.z - f.z) * k;
    if (k >= 1) { R.dash = null; emit(R, { type: 'dashEnd' }); } }
  else if (D.ph === 'spin') { D.x = P.x; D.lane = P.laneF; D.z = P.z; if (D.t >= E.spin) { R.dash = null; emit(R, { type: 'dizzy' }); } } // a miss: spin in place, pop out dizzy
}
function chewKill(R, D) {
  const g = D.tgt, objs = R.tr.objs; let maxX = g.x;
  if (g.group) for (let i = Math.max(0, R.idx - 40); i < objs.length; i++) { const q = objs[i]; if (q.x > g.x + 400) break; if (q.alive && q.group === g.group) maxX = Math.max(maxX, q.x); }
  let next = null; // greedy: the next object right behind the group, same lane
  for (let i = R.idx; i < objs.length; i++) { const q = objs[i]; if (q.x > maxX + DASH.next) break; if (q.x <= maxX + 1 || !q.alive || q.star || q.cap || (g.group && q.group === g.group)) continue;
    if (Math.abs(q.lane - g.lane) < 0.6) { next = q; break; } }
  shotKills(R, next ? [g, next] : [g], R.weapon, g.x, g.lane, g.z + g.h * 0.5);
}

/* One fixed physics step. input = { jump: held, jumpPressed, boostPressed, fire: held, firePressed, lane: -1|0|1 (edge) } */
function step(R, dt, input) {
  const P = R.p, V = R.veh, objs = R.tr.objs;
  if (R.slow > 0) { R.slow -= dt; }
  R.t += dt;
  // chained group pieces (topple chain)
  for (let i = R.queue.length - 1; i >= 0; i--) if (R.queue[i].at <= R.t) { const q = R.queue[i]; emit(R, { type: 'smash', o: q.o, kind: q.o.kind, how: q.how, chain: true, snd: KINDS[q.o.kind].snd }); R.queue.splice(i, 1); }
  if (R.countdown > 0) { R.countdown -= dt; if (R.countdown <= 0) emit(R, { type: 'go' }); return; }
  // ---- speed and boost ----
  if (input.boostPressed && !R.finished) {
    if (R.boost >= 0.999) { R.boost = 0; P.boostT = 3.6; P.boostMult = V.superMult || 1.7; P.superT = 3.6; R.specials++; emit(R, { type: 'super', special: V.special });
      if (V.special === 'chomp') { R.bag.length = 0; R.biteT = 0; }
      if (V.special === 'comet') { R.comet = { t0: R.t, z0: P.z, next: R.t + COMET.every - COMET.dive, dive: 0, diveT0: 0, diveFrom: 0, last: -9, lastStart: -9, final: false, popped: false, impacts: 0, taps: 0 }; P.vz = 0; }
      if (V.special === 'pound') { P.vz = 1050; P.pounding = true; }
      if (V.special === 'laser') R.laser = { t0: R.t, slices: 0 };
      if (V.special === 'toot') R.toot = { t0: R.t };
      if (R.dash) { R.dash = null; emit(R, { type: 'dashEnd', cut: true }); }
      if (V.special === 'toss') for (let i = 0; i < 6; i++) R.shots.push({ at: R.t + i * 0.22, x: 0, lane: i % 3, z: 0, vx: 0, vz: 0, live: false });
    } else if (R.boost >= 0.3) { R.boost -= 0.3; P.boostT = Math.max(P.boostT, 1.3); P.boostMult = Math.max(1.35, P.superT > 0 ? (V.superMult || 1.7) : 1.35); emit(R, { type: 'boost' }); }
    else emit(R, { type: 'nocharge' });
  }
  if (R.assist && !R.finished) R.boost = Math.min(1, R.boost + 0.018 * dt);
  if (P.boostT > 0) { P.boostT -= dt; if (P.boostT <= 0) P.boostMult = 1; }
  if (P.superT > 0) { P.superT -= dt;
    if (P.superT <= 0) { if (V.special === 'whirl') releaseAll(R); if (V.special === 'comet' && R.comet) { R.comet = null; P.z = V.hover || 0; P.vz = 0; emit(R, { type: 'cometEnd' }); } if (V.special === 'chomp') { emit(R, { type: 'burp', bag: R.bag.slice(), x: P.x, lane: P.laneF, z: P.z }); R.bag.length = 0; }
      if (R.laser) { emit(R, { type: 'laserEnd', slices: R.laser.slices }); R.laser = null; } if (R.toot) { emit(R, { type: 'tootEnd' }); R.toot = null; } } }
  let target = R.finished ? V.speed * 0.35 : V.speed * P.boostMult;
  if (R.toot && R.t - R.toot.t0 < TOOT.look && !R.finished) target = V.speed * TOOT.slow; // the surprised look back
  P.speed += Math.sign(target - P.speed) * Math.min(Math.abs(target - P.speed), V.speed / (V.accelT || 1 / 1.4) * dt);
  P.x += P.speed * dt;
  // ---- lanes (snap lanes, assist steers toward smashables) ----
  if (input.lane) { P.lane = Math.max(0, Math.min(2, P.lane + input.lane)); P.assistT = R.t + 1.6; }
  if (V.special === 'chomp' && P.superT > 0 && R.assist && R.t > P.assistT && !R.finished) { // hop toward the nearest cluster
    const sc = [0, 0, 0];
    for (let i = R.idx; i < objs.length; i++) { const o = objs[i], dx = o.x - P.x; if (dx > 800) break; if (dx < 40 || !o.alive || o.z > P.z + V.h + CHOMP.zReach) continue; sc[Math.round(o.lane)] += (o.star ? 0.5 : 1) / (1 + dx / 250); }
    let bl = P.lane; for (let l = 0; l < 3; l++) if (sc[l] > sc[bl] * 1.15 + 0.05) bl = l;
    if (bl !== P.lane && R.t - P.hopT > CHOMP.hop) { P.lane += Math.sign(bl - P.lane); P.hopT = R.t; P.lastLaneT = R.t; emit(R, { type: 'hop' }); }
  } else if (R.assist && R.t > P.assistT && !R.finished) {
    let best = null, bd = 1e9;
    for (let i = R.idx; i < objs.length; i++) { const o = objs[i]; const dx = o.x - P.x; if (dx > 900) break; if (dx < 60 || !o.alive) continue;
      const reach = o.z < 60 + P.z + V.h; if (!reach) continue; const sc = dx - (o.pts || 30) * 0.6 + Math.abs(o.lane - P.lane) * 60; if (sc < bd) { bd = sc; best = o; } }
    if (best && best.lane !== P.lane && R.t - P.lastLaneT > 0.35) { P.lane += Math.sign(best.lane - P.lane); P.lastLaneT = R.t; }
  }
  const dl = P.lane - P.laneF; P.laneF += Math.sign(dl) * Math.min(Math.abs(dl), dt / (V.laneT || 1 / 7));
  // ---- vertical: jump / fly / glide / bounce ----
  const floor = V.hover || 0, onG = P.z <= floor + 1;
  if (R.comet && P.superT > 0) cometStep(R, input); // Comet Dash owns the vertical motion (JUMP taps become skips)
  else {
  if (input.jumpPressed) {
    if (V.fly === 'bounce') { if (onG) { P.vz = V.jumpV; emit(R, { type: 'jump' }); } else if (P.airJumps > 0) { P.airJumps--; P.vz = V.airJumpV; emit(R, { type: 'jump', air: true }); } }
    else if (onG) { P.vz = V.jumpV; emit(R, { type: 'jump' }); }
  }
  const canThrust = V.fly !== 'bounce';
  if (input.jump && canThrust) { P.vz = Math.min(V.maxUp, P.vz + V.thrust * dt); }
  else {
    P.vz -= V.grav * dt;
    const gliding = canThrust && P.z > floor + 30 && !P.pounding;
    if (gliding && P.vz < V.glide) P.vz = V.glide;
    if (P.pounding && P.vz < 0) P.vz -= V.grav * dt; // slam down for the shockwave
  }
  P.z += P.vz * dt;
  const ceil = Math.min(MAXZ, R.maxZ || MAXZ); // R.maxZ: per-screen ceiling set by the renderer (keeps flyers below the HUD)
  if (P.z > ceil) { P.z = ceil; if (P.vz > 0) P.vz = 0; }
  // ramps launch you (no gap can stop you: the road is always there)
  if (P.z <= floor + 2) for (const rp of R.tr.ramps) if (!rp.used && P.x >= rp.x && P.x - rp.x < 120) { rp.used = true; P.vz = rp.big ? 1150 : 900; emit(R, { type: 'ramp' }); }
  if (P.z < floor) {
    const impact = -P.vz; P.z = floor;
    if (P.pounding) { P.pounding = false; emit(R, { type: 'pound' }); for (let i = R.idx; i < objs.length; i++) { const o = objs[i]; if (o.x - P.x > 700) break; if (o.alive && !o.star && Math.abs(o.x - P.x) < 700 && o.z < 260) smashGroup(R, o, 'pound'); } }
    if (impact > 300) { P.vz = impact * V.bounce; emit(R, { type: 'land', v: impact }); } else P.vz = 0;
    if (V.fly === 'bounce') P.airJumps = V.airJumps;
  }
  }
  if (V.fly === 'always' || V.fly === 'hover') P.z += Math.sin(R.t * 4) * 0.25;
  P.onGround = P.z <= floor + 2;
  P.wing += ((P.z > floor + 25 || input.jump) && V.fly === 'wings' ? 1 : -1) * dt * 5; P.wing = Math.max(0, Math.min(1, P.wing));
  // ---- smash and collect ----
  while (R.idx < objs.length && objs[R.idx].x < P.x - 500) R.idx++;
  const half = V.len * 0.5, sup = P.superT > 0, sp = V.special;
  // Whirlwind Spin: captured pieces spiral around the funnel (1.5 turns, rising), then fly out as debris
  if (R.captured.length) { const fr = Math.max(60, V.len * 0.7);
    for (let i = R.captured.length - 1; i >= 0; i--) { const q = R.captured[i], c = q.cap; c.t += dt; const k = Math.max(0, Math.min(1, c.t / WHIRL.orbit));
      if (!q.alive) { R.captured.splice(i, 1); continue; }
      if (R.reduced) { q.x = P.x + c.x0 * (1 - k) + 10 * k; q.lane = P.laneF + c.l0 * (1 - k); q.z = c.z0 + (P.z + V.h * 0.6 - c.z0) * k; } // reduced motion: straight pull, no orbit
      else { const a = c.a0 + k * WHIRL.turns * Math.PI * 2, r = c.r0 + (fr - c.r0) * Math.min(1, k * 2.2);
        q.x = P.x + Math.cos(a) * r; q.lane = P.laneF + Math.sin(a) * 0.55 * Math.min(1, r / 120); q.z = c.z0 * (1 - k) + (P.z + 10 + k * V.h * 1.5) * k; }
      if (c.t >= WHIRL.orbit) { R.captured.splice(i, 1); q.lane = Math.max(-0.4, Math.min(2.4, q.lane)); smashGroup(R, q, 'whirl'); } } }
  for (let i = R.idx; i < objs.length; i++) {
    const o = objs[i], dx = o.x - P.x; if (dx > 800) break; if (!o.alive || o.cap) continue;
    if (o.star) {
      const magnet = sup && ((sp === 'beam' && dx > -100 && dx < 650) || (sp === 'whirl' && dx > -WHIRL.back && dx < half + WHIRL.reach && o.z < P.z + WHIRL.zReach + 60));
      if (magnet) { o.x -= (o.x - P.x) * 6 * dt; o.z += (P.z + 30 - o.z) * 6 * dt; o.lane += (P.laneF - o.lane) * 6 * dt; }
      if (sup && sp === 'chomp' && dx > -half && dx < half + CHOMP.reach && Math.abs(o.lane - P.laneF) < 0.7 && o.z < P.z + V.h + CHOMP.zReach) { chompOne(R, o); continue; }
      if (Math.abs(dx) < half + 40 && Math.abs(o.lane - P.laneF) < 0.8 && o.z < P.z + V.h + 40 && o.z + 50 > P.z - 30) collectStar(R, o, magnet ? sp : undefined);
      continue;
    }
    if (sup && sp === 'comet' && R.comet) { // the fireball burns away whatever it touches in its lane, no slow-down
      if (Math.abs(o.lane - P.laneF) < 0.7 && dx > -half && dx < half + COMET.burn && o.z < P.z + V.h + 60 && o.z + o.h > P.z - 40) { smashGroup(R, o, 'burn'); continue; } }
    if (sup && sp === 'laser' && R.laser) { // twin lasers slice everything ahead in its lane and the neighbours
      const reach = LASER.reach * Math.min(1, (R.t - R.laser.t0) / LASER.sweep);
      if (dx > half * 0.2 && dx < half + reach && Math.abs(o.lane - P.laneF) <= LASER.lanes && o.z < P.z + LASER.zUp && o.z + o.h > P.z - LASER.zDown) { R.laser.slices++; smashGroup(R, o, 'laser'); continue; } }
    if (sup && sp === 'whirl') { if (dx > -WHIRL.back && dx < half + WHIRL.reach && o.z < P.z + WHIRL.zReach && R.captured.length < WHIRL.max) capture(R, o); continue; }
    if (sup && sp === 'chomp') { // eat everything in the lane, lowest piece first, one bite every CHOMP.bite seconds
      if (dx > -half && dx < half + CHOMP.reach && Math.abs(o.lane - P.laneF) < 0.7 && o.z < P.z + V.h + CHOMP.zReach) {
        if (R.t >= R.biteT) { let low = o; for (let j = i + 1; j < objs.length; j++) { const q = objs[j]; if (q.x - P.x > half + CHOMP.reach) break; if (q.alive && !q.star && Math.abs(q.lane - P.laneF) < 0.7 && q.z < low.z && q.z < P.z + V.h + CHOMP.zReach) low = q; }
          chompOne(R, low); R.biteT = R.t + CHOMP.bite; }
        continue; }
    }
    let hit = Math.abs(dx) < (half + o.w * 0.5) * 0.92 && Math.abs(o.lane - P.laneF) < 0.7 && o.z < P.z + V.h && o.z + o.h > P.z;
    if (!hit && sup) {
      if (sp === 'nitro') hit = dx > 0 && dx < 340 && o.z < P.z + 220;
      else if (sp === 'toot') hit = dx > 0 && dx < half + TOOT.reach && Math.abs(o.lane - P.laneF) < 0.8 && o.z < P.z + V.h + 60;
      else if (sp === 'spin') hit = Math.abs(dx) < 300 && Math.abs(o.z - P.z) < 360;
      else if (sp === 'beam') hit = dx > -60 && dx < 520 && Math.abs(o.z - P.z) < 320;
      else if (sp === 'pound' || sp === 'toss') hit = Math.abs(dx) < half + o.w * 0.5 && Math.abs(o.lane - P.laneF) < 1.2 && o.z < P.z + V.h + 30 && o.z + o.h > P.z - 30;
    }
    if (hit) smashGroup(R, o, sup ? sp : V.flatten ? 'flatten' : 'ram');
  }
  // Basket toss projectiles
  for (const s of R.shots) {
    if (!s.live && R.t >= s.at && s.at > 0) { s.live = true; s.x = P.x + 40; s.z = P.z + 70; s.vx = P.speed + 520; s.vz = 380; s.at = -1; emit(R, { type: 'toss' }); }
    if (!s.live) continue;
    s.x += s.vx * dt; s.vz -= 900 * dt; s.z += s.vz * dt;
    if (s.z < 0) { s.z = 0; s.vz = Math.abs(s.vz) * 0.6; }
    for (let i = R.idx; i < objs.length; i++) { const o = objs[i]; if (o.x - s.x > 120) break; if (!o.alive || o.star) continue;
      if (Math.abs(o.x - s.x) < o.w * 0.6 + 20 && Math.abs(o.lane - s.lane) < 0.8 && s.z < o.z + o.h + 30 && s.z > o.z - 40) { smashGroup(R, o, 'toss'); s.live = false; R.stars++; R.score += 20; emit(R, { type: 'star', bonus: true, x: s.x, z: s.z, lane: s.lane }); break; } }
    if (s.x - P.x > 1400) s.live = false;
  }
  // ---- FIRE: hold to repeat on the cooldown, disabled during a special (it is ready again right after) ----
  if (R.fireCd > 0) { R.fireCd -= dt; if (R.fireCd <= 0) { R.fireCd = 0; emit(R, { type: 'fireReady', held: !!input.fire }); } }
  if ((input.fire || input.firePressed) && !R.finished) { if (P.superT > 0) { if (input.firePressed) emit(R, { type: 'fireOff' }); } else if (R.fireCd <= 0 && !R.dash) fire(R); }
  if (R.proj.length) stepProj(R, dt);
  if (R.dash) stepDash(R, dt);
  // ---- rivals: friendly racers, a bit faster than cruising so boosting earns 1st ----
  for (const rv of R.rivals) {
    if (rv.fin) { rv.speed *= 0.985; rv.x += rv.speed * dt; continue; }
    let sp = V.speed * rv.f; const gap = rv.x - P.x;
    if (gap > 620) sp *= 0.88; else if (gap < -900) sp *= 1.25; else if (gap < -450) sp *= 1.08;
    rv.speed += (sp - rv.speed) * Math.min(1, 2 * dt); rv.x += rv.speed * dt;
    rv.bob += dt;
    if (rv.x >= R.tr.L) { rv.fin = R.t; }
  }
  // ---- finish ----
  if (!R.finished && P.x >= R.tr.L) {
    R.finished = true; R.finT = R.t;
    let ahead = R.rivals.filter(rv => rv.fin).length;
    if (ahead > 2) { // never last: one friendly racer "waits" for you
      const last = R.rivals.filter(rv => rv.fin).sort((a, b) => b.fin - a.fin)[0]; last.fin = 0; last.x = P.x - 160; last.speed = P.speed * 0.9; ahead = 2; }
    R.place = ahead + 1; R.placeBonus = PLACE_BONUS[R.place - 1]; R.score += R.placeBonus;
    const ratio = R.tr.maxPts ? (R.basePts || 0) / R.tr.maxPts : 0;
    R.award = 1 + (ratio >= 0.3 || R.place === 1 ? 1 : 0) + (ratio >= 0.6 ? 1 : 0);
    R.award = Math.min(3, R.award);
    P.celebrate = 1; emit(R, { type: 'finish', place: R.place });
  }
}

function summary(R) { return { score: Math.round(R.score), smashPts: Math.round(R.smashPts), stars: R.stars, starPts: R.stars * 20, place: R.place, placeBonus: R.placeBonus || 0, award: R.award || 1, smashes: R.smashes, shots: R.hits, shotPts: R.shotPts, bestMult: R.bestMult, track: R.track.id, vehicle: R.veh.id, time: Math.round(R.finT) }; }

const API = { STEP, MAXZ, COMBO_WINDOW, RACE_SECONDS, VEHICLES, VEHICLE_ORDER, KINDS, TRACKS, RIVALS, PLACE_BONUS, WHIRL, CHOMP, COMET, LASER, TOOT, DASH, WEAPONS, SHARP, rng, buildTrack, createRace, step, smashGroup, aimTarget, fire, chompOne, summary };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LeoSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
