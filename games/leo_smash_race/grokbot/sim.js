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
};
const VEHICLE_ORDER = ['dragster', 'bibi', 'truck', 'sword', 'jet'];

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
  const p = { x: 0, lane: 1, laneF: 1, z: veh.hover || 0, vz: 0, speed: 0, airJumps: veh.airJumps || 0, boostT: 0, boostMult: 1, superT: 0, wing: 0, pounding: false, celebrate: 0, onGround: true, lastLaneT: 0, assistT: 0 };
  const rivals = RIVALS.map((rv, i) => ({ id: rv.id, color: rv.color, f: rv.f, x: -120 - i * 150, lane: i === 1 ? 1 : (i === 0 ? 0 : 2), laneF: i === 1 ? 1 : (i === 0 ? 0 : 2), z: 0, speed: 0, fin: 0, bob: i }));
  return { veh, track, tr, p, rivals, t: 0, countdown: opts.countdown == null ? 2.4 : opts.countdown, assist: opts.assist !== false,
    score: 0, smashPts: 0, stars: 0, smashes: 0, chain: 0, mult: 1, bestMult: 1, lastSmash: -9, boost: opts.fullBoost ? 1 : 0.15,
    events: [], queue: [], shots: [], idx: 0, finished: false, finT: 0, place: 0, slow: 0, specials: 0 };
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
  const k = KINDS[o.kind]; R.boost = Math.min(1, R.boost + (pts >= 300 ? 0.34 : pts >= 100 ? 0.18 : pts >= 50 ? 0.12 : 0.06));
  members.sort((a, b) => a.z - b.z);
  members.forEach((m, i) => { if (i === 0) { m.alive = false; emit(R, { type: 'smash', o: m, kind: m.kind, how, first: true, pts: gained, mult: R.mult, big: pts >= 300, snd: k.snd }); }
    else { m.alive = false; R.queue.push({ at: now + i * 0.05, o: m, how }); } });
  if (pts >= 300) { R.slow = 0.55; emit(R, { type: 'big', x: o.x }); }
  if (R.mult >= 2) emit(R, { type: 'combo', mult: R.mult });
}

function collectStar(R, o) { o.alive = false; R.stars++; R.score += 20; R.boost = Math.min(1, R.boost + 0.01); emit(R, { type: 'star', o }); }

/* One fixed physics step. input = { jump: held, jumpPressed, boostPressed, lane: -1|0|1 (edge) } */
function step(R, dt, input) {
  const P = R.p, V = R.veh, objs = R.tr.objs;
  if (R.slow > 0) { R.slow -= dt; }
  R.t += dt;
  // chained group pieces (topple chain)
  for (let i = R.queue.length - 1; i >= 0; i--) if (R.queue[i].at <= R.t) { const q = R.queue[i]; emit(R, { type: 'smash', o: q.o, kind: q.o.kind, how: q.how, chain: true, snd: KINDS[q.o.kind].snd }); R.queue.splice(i, 1); }
  if (R.countdown > 0) { R.countdown -= dt; if (R.countdown <= 0) emit(R, { type: 'go' }); return; }
  // ---- speed and boost ----
  if (input.boostPressed && !R.finished) {
    if (R.boost >= 0.999) { R.boost = 0; P.boostT = 3.6; P.boostMult = 1.7; P.superT = 3.6; R.specials++; emit(R, { type: 'super', special: V.special });
      if (V.special === 'pound') { P.vz = 1050; P.pounding = true; }
      if (V.special === 'toss') for (let i = 0; i < 6; i++) R.shots.push({ at: R.t + i * 0.22, x: 0, lane: i % 3, z: 0, vx: 0, vz: 0, live: false });
    } else if (R.boost >= 0.3) { R.boost -= 0.3; P.boostT = Math.max(P.boostT, 1.3); P.boostMult = Math.max(1.35, P.superT > 0 ? 1.7 : 1.35); emit(R, { type: 'boost' }); }
    else emit(R, { type: 'nocharge' });
  }
  if (R.assist && !R.finished) R.boost = Math.min(1, R.boost + 0.018 * dt);
  if (P.boostT > 0) { P.boostT -= dt; if (P.boostT <= 0) P.boostMult = 1; }
  if (P.superT > 0) P.superT -= dt;
  const target = R.finished ? V.speed * 0.35 : V.speed * P.boostMult;
  P.speed += Math.sign(target - P.speed) * Math.min(Math.abs(target - P.speed), V.speed * 1.4 * dt);
  P.x += P.speed * dt;
  // ---- lanes (snap lanes, assist steers toward smashables) ----
  if (input.lane) { P.lane = Math.max(0, Math.min(2, P.lane + input.lane)); P.assistT = R.t + 1.6; }
  if (R.assist && R.t > P.assistT && !R.finished) {
    let best = null, bd = 1e9;
    for (let i = R.idx; i < objs.length; i++) { const o = objs[i]; const dx = o.x - P.x; if (dx > 900) break; if (dx < 60 || !o.alive) continue;
      const reach = o.z < 60 + P.z + V.h; if (!reach) continue; const sc = dx - (o.pts || 30) * 0.6 + Math.abs(o.lane - P.lane) * 60; if (sc < bd) { bd = sc; best = o; } }
    if (best && best.lane !== P.lane && R.t - P.lastLaneT > 0.35) { P.lane += Math.sign(best.lane - P.lane); P.lastLaneT = R.t; }
  }
  const dl = P.lane - P.laneF; P.laneF += Math.sign(dl) * Math.min(Math.abs(dl), 7 * dt);
  // ---- vertical: jump / fly / glide / bounce ----
  const floor = V.hover || 0, onG = P.z <= floor + 1;
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
  if (V.fly === 'always' || V.fly === 'hover') P.z += Math.sin(R.t * 4) * 0.25;
  P.onGround = P.z <= floor + 2;
  P.wing += ((P.z > floor + 25 || input.jump) && V.fly === 'wings' ? 1 : -1) * dt * 5; P.wing = Math.max(0, Math.min(1, P.wing));
  // ---- smash and collect ----
  while (R.idx < objs.length && objs[R.idx].x < P.x - 500) R.idx++;
  const half = V.len * 0.5, sup = P.superT > 0, sp = V.special;
  for (let i = R.idx; i < objs.length; i++) {
    const o = objs[i], dx = o.x - P.x; if (dx > 800) break; if (!o.alive) continue;
    if (o.star) {
      const magnet = sup && sp === 'beam' && dx > -100 && dx < 650;
      if (magnet) { o.x -= (o.x - P.x) * 6 * dt; o.z += (P.z + 30 - o.z) * 6 * dt; o.lane += (P.laneF - o.lane) * 6 * dt; }
      if (Math.abs(dx) < half + 40 && Math.abs(o.lane - P.laneF) < 0.8 && o.z < P.z + V.h + 40 && o.z + 50 > P.z - 30) collectStar(R, o);
      continue;
    }
    let hit = Math.abs(dx) < (half + o.w * 0.5) * 0.92 && Math.abs(o.lane - P.laneF) < 0.7 && o.z < P.z + V.h && o.z + o.h > P.z;
    if (!hit && sup) {
      if (sp === 'nitro') hit = dx > 0 && dx < 340 && o.z < P.z + 220;
      else if (sp === 'spin') hit = Math.abs(dx) < 300 && Math.abs(o.z - P.z) < 360;
      else if (sp === 'beam') hit = dx > -60 && dx < 520 && Math.abs(o.z - P.z) < 320;
      else if (sp === 'pound' || sp === 'toss') hit = Math.abs(dx) < half + o.w * 0.5 && Math.abs(o.lane - P.laneF) < 1.2 && o.z < P.z + V.h + 30 && o.z + o.h > P.z - 30;
    }
    if (hit) smashGroup(R, o, sup ? sp : 'ram');
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

function summary(R) { return { score: Math.round(R.score), smashPts: Math.round(R.smashPts), stars: R.stars, starPts: R.stars * 20, place: R.place, placeBonus: R.placeBonus || 0, award: R.award || 1, smashes: R.smashes, bestMult: R.bestMult, track: R.track.id, vehicle: R.veh.id, time: Math.round(R.finT) }; }

const API = { STEP, MAXZ, COMBO_WINDOW, RACE_SECONDS, VEHICLES, VEHICLE_ORDER, KINDS, TRACKS, RIVALS, PLACE_BONUS, rng, buildTrack, createRace, step, smashGroup, summary };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LeoSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
