/* Leo's Smash Race — game shell: fixed-timestep loop, DPR canvas renderer with camera and parallax,
   input (giant touch buttons + keyboard + swipe), debris/particles, screens, saves and the world board. */
(function () {
'use strict';
const SIM = window.LeoSim, AU = window.LeoAudio, ART = window.LeoArt, CUBE = window.LeoCube;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = 'leo.v1.';
const store = { get(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} } };
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const settings = Object.assign({ assist: true, reduced: mq.matches, pro: false, name: '', vehicle: 'dragster', track: 'toyroom', unlockAll: false }, store.get('settings', {}));
const prog = Object.assign({ stars: 0, cubeSolves: 0, best: {}, races: 0 }, store.get('progress', {}));
const saveSettings = () => store.set('settings', settings), saveProg = () => store.set('progress', prog);
const NAMES = ['', 'Leo', 'Turbo Leo', 'Rocket Kid', 'Smash Star', 'Speedy', 'Super Pilot', 'Bibi Rider', 'Night Racer', 'Sky Hero'];
const QS = new URLSearchParams(location.search);
const LANE_GAP = 52;

/* ---------------- canvas + view ---------------- */
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, view = {};
function resize() {
  const VW = innerWidth, VH = innerHeight, portrait = VH > VW * 1.05, racing = mode === 'race';
  document.body.classList.toggle('lay-portrait', portrait); document.body.classList.toggle('lay-landscape', !portrait);
  // thumb zones: the playfield (canvas) never sits under a button
  const lane = portrait || VH > 420 ? 80 : 72, btn = portrait ? Math.round(Math.max(96, Math.min(140, (VW - lane - 16 * 2 - 28) / 2))) : (VH <= 520 ? 104 : 128);
  /* Addendum D layout: FIRE is the big primary (same size as JUMP), BOOST (>= 64 px) sits above it.
     Portrait: JUMP left, lanes in the middle, a right-hand column BOOST over FIRE, all on the floor strip under the road.
     Landscape: JUMP in the left gutter; the right gutter holds the lane arrows next to the BOOST-over-FIRE column. */
  const fire = btn, boostS = Math.max(64, Math.round(btn * 0.66));
  const gut = btn + 24, gutR = portrait ? gut : 12 + lane + 12 + fire + 12;
  const strip = Math.round(Math.max(btn + 40, lane * 2 + 16 + 36, VH * 0.4, boostS + 26 + fire + 44));
  const colB = Math.round((strip - (boostS + 26 + fire)) / 2);
  const ctl = $('#controls'), sv = (k, v) => ctl.style.setProperty(k, v + 'px');
  sv('--btn', btn); sv('--gut', gut); sv('--gutR', gutR); sv('--strip', strip); sv('--lane', lane); sv('--fire', fire); sv('--boostS', boostS);
  sv('--fireB', colB); sv('--boostB', colB + fire + 26); sv('--jumpB', colB + Math.round((fire - btn) / 2)); sv('--laneX', Math.round((14 + btn + VW - 14 - fire - 9) / 2));
  document.documentElement.style.setProperty('--gut', gut + 'px'); document.documentElement.style.setProperty('--gutR', gutR + 'px');
  let L = 0, CW = VW, CH = VH;
  if (racing) { if (portrait) CH = VH - strip; else { L = gut; CW = VW - gut - gutR; } }
  document.documentElement.style.setProperty('--cx', (racing && !portrait ? L + CW / 2 : VW / 2) + 'px');
  cv.style.left = L + 'px'; cv.style.top = '0px'; cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
  W = CW; H = CH; DPR = Math.min(window.devicePixelRatio || 1, 2);
  if (W * H * DPR * DPR > 3.2e6) DPR = Math.max(1, Math.sqrt(3.2e6 / (W * H)));
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const s = portrait ? Math.min(W / 600, H / 640) : Math.min(W / 720, H / 560);
  const frontH = Math.min(H * 0.13, 130 * s), hasFront = (ART.layers(settings.track) || []).some(l => l.role === 'front');
  const groundY = H - LANE_GAP * s * 1.25 - Math.max(10, H * 0.03) - (racing && hasFront ? frontH * 0.45 : 0);
  view = { s, portrait, groundY, anchorX: W * 0.3, frontH };
  if (mode === 'cube') layoutCube();
  hudBottom = 0; // re-measured on the next race frame
}
addEventListener('resize', resize);

/* ---------------- state ---------------- */
let mode = 'title', race = null, demo = null, paused = false, acc = 0, lastT = 0, camZ = 0, shake = 0, flash = 0, hudScore = 0;
const debris = [], parts = [], pops = [], rings = [], gulps = [], scorch = [];
const hitFx = [], burns = [], toots = [], pellets = []; // Addendum D: shot bursts, laser burn marks, Ira's toot clouds and toy pellets
const input = { jump: false, jumpPressed: false, boostPressed: false, fire: false, firePressed: false, lane: 0 };
let cubeState = null;
const reduced = () => settings.reduced;

/* ---------------- helpers ---------------- */
const X = x => (x - camX()) * view.s + view.anchorX + (shake ? (Math.random() - 0.5) * shake : 0);
const laneY = l => view.groundY + (l - 1) * LANE_GAP * view.s + camZ * view.s + (shake ? (Math.random() - 0.5) * shake * 0.6 : 0);
const kL = l => 1 + (l - 1) * 0.07;
function scene() { return mode === 'race' || mode === 'party' ? race : demo; }
function camX() { const R = scene(); return R ? R.p.x : 0; }
function drawSprite(name, x, lane, z, opts) {
  const sp = ART.get(name), k = kL(lane), w = (opts && opts.wu || sp.wu) * view.s * k, h = w * sp.h / sp.w;
  const sx = X(x), sy = laneY(lane) - z * view.s * k;
  if (sx < -w * 1.2 || sx > W + w * 1.2) return;
  if (opts && opts.pivot) { ctx.save(); ctx.translate(sx, sy - (sp.ay - opts.pivot) * h); ctx.rotate(opts.rot || 0); if (opts.rim) rimPaint(sp, -w * sp.ax, -h * opts.pivot, w, h); ctx.drawImage(sp.img, -w * sp.ax, -h * opts.pivot, w, h); ctx.restore(); return; } // spin around an inner point
  if (opts && (opts.rot || opts.sq || opts.sc)) { ctx.save(); ctx.translate(sx, sy); if (opts.rot) ctx.rotate(opts.rot); if (opts.sq) ctx.scale(1 + opts.sq, 1 - opts.sq); if (opts.sc) ctx.scale(opts.sc, opts.sc); if (opts.alpha != null) ctx.globalAlpha = opts.alpha; if (opts.rim) rimPaint(sp, -w * sp.ax, -h * sp.ay, w, h); ctx.drawImage(sp.img, -w * sp.ax, -h * sp.ay, w, h); ctx.restore(); }
  else { if (opts && opts.alpha != null) { ctx.globalAlpha = opts.alpha; } ctx.drawImage(sp.img, sx - w * sp.ax, sy - h * sp.ay, w, h); ctx.globalAlpha = 1; }
}
/* Comet form: a 2 px white rim + a soft ~6 px teal glow around the car's silhouette, so it reads against the orange fireball. */
const silCache = new WeakMap();
function silhouette(img) { let c = silCache.get(img); if (c) return c; c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); silCache.set(img, c); return c; }
function rimPaint(sp, x, y, w, h) { const sil = silhouette(sp.img); ctx.save();
  ctx.shadowColor = 'rgba(70,235,220,.95)'; ctx.shadowBlur = 6 * DPR; ctx.globalAlpha = 0.9; ctx.drawImage(sil, x, y, w, h); ctx.drawImage(sil, x, y, w, h); // teal glow (twice = a bit stronger)
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.drawImage(sil, x + Math.cos(a) * 2, y + Math.sin(a) * 2, w, h); } // 2 px white rim
  ctx.restore(); }
function shadow(x, lane, z, wu, a) { const k = kL(lane), w = wu * view.s * k * Math.max(0.35, 1 - z / 700); ctx.fillStyle = `rgba(20,12,40,${(a || 0.28) * Math.max(0.2, 1 - z / 600)})`;
  ctx.beginPath(); ctx.ellipse(X(x), laneY(lane) + 2, w * 0.5, w * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- background + road ---------------- */
const topColor = {};
function layerTop(track, L) { const key = track + L.role; if (topColor[key] && topColor[key].img === L.img) return topColor[key].c;
  let c = '#bfe3ff'; try { const t = document.createElement('canvas'); t.width = t.height = 1; const g = t.getContext('2d'); g.drawImage(L.img, 0, 0, 4, 4, 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; c = `rgb(${d[0]},${d[1]},${d[2]})`; } catch (e) {}
  topColor[key] = { img: L.img, c }; return c; }
function tileH(L, H0) { const sc = H0 / L.h, tw = L.w * sc; return { sc, tw }; }
function drawLayer(L, top, h, par, cx) { const { tw } = tileH(L, h); if (tw < 4) return; let off = -((cx * par * view.s) % tw); if (off > 0) off -= tw;
  for (let x = off; x < W; x += tw) ctx.drawImage(L.img, Math.floor(x), top, Math.ceil(tw) + 1, h); }
function drawWorldBack(R) {
  const Ls = ART.layers(R.track.id), cx = camX(), roadTop = laneY(-0.8);
  // layers draw back to front in manifest order; placement depends on role
  let filled = false;
  for (const L of Ls) { if (!L.img) continue;
    if (L.role === 'sky') { if (!filled) { ctx.fillStyle = layerTop(R.track.id, L); ctx.fillRect(0, 0, W, H); filled = true; } const h = Math.max(roadTop + 30, H * 0.5); drawLayer(L, roadTop + 30 - h, h, L.par, cx); }
    else if (L.role === 'far') { const h = Math.min(roadTop * 0.8, 520 * view.s) / L.base; drawLayer(L, roadTop + 6 - h * L.base, h, L.par, cx); }
    else if (L.role === 'mid') { const h = Math.min(roadTop * 0.62, 380 * view.s) / L.base; drawLayer(L, roadTop + 8 - h * L.base, h, L.par, cx); }
    else if (L.role === 'ground') { const h0 = Math.max(80, H - (view.groundY - LANE_GAP * view.s * 1.8)); drawLayer(L, roadTop, h0 + camZ * view.s, L.par, cx); } }
  if (roadTop + 0 < H) { // road edge + lane stripes
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, roadTop, W, 6);
    const dash = 70 * view.s, off = -((cx * view.s) % (dash * 2));
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    [0.5, 1.5].forEach(l => { const y = laneY(l); for (let x = off; x < W; x += dash * 2) ctx.fillRect(x, y - 2, dash, 4); });
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, laneY(2.6), W, 4);
  }
  // desert canyon gaps (cosmetic: no way to fall)
  for (const gp of R.tr.gaps) { const x0 = X(gp.x0), x1 = X(gp.x1); if (x1 < 0 || x0 > W) continue; const yT = laneY(-0.8), yB = H;
    ctx.fillStyle = '#5a2d16'; ctx.fillRect(x0, yT, x1 - x0, yB - yT); ctx.fillStyle = '#3a1a0c'; ctx.fillRect(x0 + 10, yT + 10, x1 - x0 - 20, yB - yT);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + (x1 - x0) * (0.2 + i * 0.2), yT + 30 + i * 18, 6, 50); }
  // ramps (span all lanes, drawn on the back lane and front lane)
  for (const rp of R.tr.ramps) { const sx = X(rp.x); if (sx < -400 || sx > W + 400) continue; for (const l of [0, 1, 2]) drawSprite('item.ramp', rp.x - 60, l, 0, { wu: rp.big ? 230 : 190 }); }
  // finish arch
  if (Math.abs(R.tr.L - cx) < 2500) { drawSprite('item.finish', R.tr.L, -0.2, 0, { wu: 150 }); ctx.save(); const x = X(R.tr.L); ctx.globalAlpha = 0.9;
    for (let y = laneY(-0.7), r = 0; y < H; y += 14 * view.s, r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#1d1a2e' : '#fff'; ctx.fillRect(x + c * 14 * view.s, y, 14 * view.s, 14 * view.s); } ctx.restore(); }
}

/* ---------------- entity rendering ---------------- */
function vehSprite(R) { const P = R.p, V = R.veh, floor = V.hover || 0;
  if (P.celebrate && R.finished) return 'veh.' + V.id + '.celebrate';
  if (V.runner) { // Ira runs: run-a / run-b alternate; the surprised look back opens Turbo Toot; leaps use the fly pose
    if (R.tootFx && R.tootFx.t < 0.45) return 'veh.' + V.id + '.special';
    if (P.z > floor + 18) return 'veh.' + V.id + '.fly';
    return 'veh.' + V.id + ((R.runPh | 0) % 2 ? '.runb' : '.drive'); }
  if (R.comet) return 'veh.' + V.id + (cometC(R) >= SIM.COMET.finalAt + 0.08 ? '.drive' : '.boost'); // Comet 17: hot form in the shell, plain car after the pop-out
  if (V.special === 'laser') { if (P.superT > 0) return 'veh.' + V.id + '.special'; } // Laser Racer: hot pose only in Laser Drive; a small boost keeps the normal car + flame
  else if (P.boostT > 0) { if (V.special === 'chomp' && P.superT > 0 && R.snapT > 0.1) return 'veh.' + V.id + '.drive'; return 'veh.' + V.id + '.boost'; } // Chomp Rex: jaw snaps shut on each bite (frames line up)
  if (V.fly === 'always' || V.fly === 'hover' || P.z > floor + 25 || P.wing > 0.5) return 'veh.' + V.id + '.fly';
  return 'veh.' + V.id + '.drive'; }
// shadow widths matched to the visible footprint of Muse's art (v1); the interim art uses the hitbox length
const SHADOW_W = { dragster: 215, bibi: 125, truck: 195, sword: 185, jet: 150, pup: 89, rex: 220, comet: 150, laser: 170, ira: 150 };
/* Race-only draw scale (the picker card keeps the manifest size). Whirly Pup's art is ~58 wu tall at wu 215;
   x1.43 makes her ~83 wu, about 75% of the Bat Truck's ~111 wu visible height. Her hitbox stays len 105. */
const RACE_SCALE = { pup: 1.43 };
const raceWu = (R, name) => ART.get(name).wu * (RACE_SCALE[R.veh.id] || 1) * (ART.fx(name).scale || 1); // fx.scale: a pose drawn smaller in its frame (Comet 17's fly)
/* Fly ceiling: the top of a flying vehicle stays at least 12% of the scene height below the HUD.
   camNeed = the camera lift that keeps it there; R.maxZ = the highest z the camera can still cover (sim clamps to it). */
let hudBottom = 0;
function measureHud() { const c = cv.getBoundingClientRect(); let b = 0; document.querySelectorAll('#hud .hud-score, #hud .hud-stars, #hud .hud-prog').forEach(el => { const r = el.getBoundingClientRect(); if (r.height && r.right > c.left && r.left < c.right) b = Math.max(b, r.bottom - c.top); }); if (b) hudBottom = b; }
function vehTop(R) { const V = R.veh, a = ART.get('veh.' + V.id + '.fly'), d = ART.get('veh.' + V.id + '.drive'), rs = RACE_SCALE[V.id] || 1, fs = n => ART.fx('veh.' + V.id + '.' + n).scale || 1, top = (sp, k) => (sp.wu * sp.h / sp.w * sp.ay + sp.wu * 0.08) * rs * k; // + tilt slack (at the ceiling vz = 0, so wing tilt is ~0)
  return Math.max(top(a, fs('fly')), top(d, fs('drive'))) + 12; }
function camNeed(R, z, lane) { const limit = (hudBottom || 70) + H * 0.12; return (limit - view.groundY - (lane - 1) * LANE_GAP * view.s) / view.s + (z + vehTop(R)) * kL(lane); }
function setCeiling(R) { const cap = Math.max(240, (H - 10 - view.groundY) / view.s); let m = SIM.MAXZ;
  for (const l of [0, 1, 2]) { const limit = (hudBottom || 70) + H * 0.12, base = (limit - view.groundY - (l - 1) * LANE_GAP * view.s) / view.s; m = Math.min(m, (cap - base) / kL(l) - vehTop(R)); }
  R.maxZ = Math.max(120, m);
  // anything in the sky stays reachable under this screen's ceiling
  if (R.reachZ !== R.maxZ) { R.reachZ = R.maxZ; const top = R.maxZ + R.veh.h - 24;
    for (const o of R.tr.objs) { if (o.z0 == null) o.z0 = o.z; if (o.z0 > 0) o.z = Math.min(o.z0, o.star ? top - 30 : top - (SIM.KINDS[o.kind] ? 0 : 0)); } } }
function drawPlayer(R, t) {
  const P = R.p, V = R.veh, sp = vehSprite(R);
  if (R.dash) { drawZoomie(R, t); return; } // Ira's body is inside the whirlwind
  shadow(P.x, P.laneF, P.z, (ART.get(sp).real && SHADOW_W[V.id]) || V.len * 1.05, 0.32); const dw = raceWu(R, sp);
  let rot = 0, sq = 0;
  if (V.fly === 'wings' || V.fly === 'bounce') rot = Math.max(-0.3, Math.min(0.3, -P.vz / 2400)) * (P.onGround ? 0 : 1);
  if (V.fly === 'always' || V.fly === 'hover') rot = Math.max(-0.15, Math.min(0.15, -P.vz / 3000)) + Math.sin(t * 3) * 0.03;
  if (P.onGround && V.fly !== 'always') { rot += Math.sin(t * 30) * 0.004 * P.speed / V.speed; }
  if (R.p.superT > 0 && V.special === 'spin') rot = (t * 14) % (Math.PI * 2);
  const specialPose = /\.special$/.test(ART.resolve(sp));
  if (specialPose && V.special === 'whirl') rot = reduced() ? 0.0001 : ART.get(sp).real ? Math.sin(t * 9) * 0.12 : (t * 16) % (Math.PI * 2); // real ring pose wobbles; the interim ball spins
  let spin = false;
  if (V.special === 'comet') { // Comet 17: the sprites are not tilted, so tilt in code: 6 deg nose-down in comet form, 8 deg nose-up in the fly pose,
    // eased over ~0.15 s (this replaces the wing/vz tilt for her, so nothing stacks); a 360 on the pop-out
    const c = cometC(R), E = SIM.COMET, inForm = R.comet && c < E.finalAt, target = inForm ? COMET_TILT.special : /\.fly$/.test(ART.resolve(sp)) ? COMET_TILT.fly : 0;
    const dt = Math.min(0.05, Math.max(0, t - (R.tiltT == null ? t : R.tiltT))); R.tiltT = t; R.tilt = (R.tilt || 0) + (target - (R.tilt || 0)) * (1 - Math.exp(-dt / COMET_TILT.tau));
    rot = R.tilt + (P.onGround ? Math.sin(t * 30) * 0.004 * P.speed / V.speed : 0);
    if (R.comet && !inForm) { const k = (c - E.finalAt - 0.08) / 0.3; if (k > 0 && k < 1 && !reduced()) { spin = true; rot = -k * Math.PI * 2; R.tilt = 0; } } }
  if (R.landT > 0) sq = R.landT * (V.id === 'rex' ? 0.75 : 0.4); // Chomp Rex: big suspension squash
  if (R.snapT > 0 && V.special === 'chomp') sq += Math.sin((1 - R.snapT / 0.2) * Math.PI) * 0.07; // ...and a suspension dip on every chomp
  let sc = 0; if (R.snapT > 0) { const k = 1 - R.snapT / 0.2; sc = k < 0.35 ? 1 - 0.08 * (k / 0.35) : k < 0.7 ? 0.92 + 0.13 * ((k - 0.35) / 0.35) : 1.05 - 0.05 * ((k - 0.7) / 0.3); } // jaw snap 1.0 -> 0.92 -> 1.05 -> 1.0
  let bob = P.onGround && V.fly !== 'always' && V.fly !== 'hover' ? Math.abs(Math.sin(t * 18)) * 2 : 0;
  if (V.runner) { bob = P.onGround ? Math.abs(Math.sin((R.runPh || 0) * Math.PI)) * 4 / Math.max(0.3, view.s) : 0; if (R.wagT > 0) rot += Math.sin(t * 28) * 0.06; } // 4 px gallop bob; the end-of-toot wag
  if (R.finished) { bob += Math.abs(Math.sin(t * 6)) * 28; rot += Math.sin(t * 6) * 0.08; } // celebrate bounce (works with any art)
  // specials behind/around
  if (P.superT > 0) drawSpecial(R, t, true);
  if (V.special === 'laser' && R.laser) laserBack(R, t, sp, P.z + bob, rot || 0); // jet flame + twin lasers, all behind the car
  if (specialPose && V.special === 'whirl') drawSprite(sp, P.x, P.laneF, P.z + bob, { rot, pivot: ART.fx(sp).pivot || 0.633, wu: dw }); // spin the ball around its middle, not its feet
  else if (spin) drawSprite(sp, P.x, P.laneF, P.z + bob, { rot, pivot: ART.fx(sp).pivot || 0.72, wu: dw });
  else drawSprite(sp, P.x, P.laneF, P.z + bob, { rot: rot || 0.0001, sq, sc, wu: dw, rim: V.special === 'comet' && cometForm(R) });
  if (P.boostT > 0 && !R.comet && !V.runner && !R.laser && !ownBoostArt(V.id) && !ART.fx(sp).noFlame) boostFlame(R, sp, P.z + bob, rot, t);
  if (R.dizzyT > 0) dizzyStars(R, P.x, P.laneF, P.z + vehTop(R) * 0.75, t);
  if (ART.fx(sp).fins && P.wing > 0.02) finWings(R, sp, P.z + bob, rot, sq);
  if (P.superT > 0) drawSpecial(R, t, false);
  if (P.boostT > 0 && !reduced()) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = laneY(P.laneF) - (P.z + 10 + i * 14) * view.s, x = X(P.x) - V.len * 0.6 * view.s - ((t * 900 + i * 137) % 220); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 60, y); ctx.stroke(); } }
}
// true only when the boost pose has its own file (not an alias, and not the drive/fly file reused under the boost name)
function ownBoostArt(id) { const S = ART.manifest.sprites, n = 'veh.' + id + '.', b = S[ART.resolve(n + 'boost')]; if (!b || !b.src) return false;
  return ![n + 'drive', n + 'fly'].some(k => S[k] && S[k].src === b.src); }
/* Chomp Rex's stubby fin-wings pop out in code on the fly pose (the art only hints at them), like the rocket wings on the others. */
function finWings(R, name, z, rot, sq) {
  const P = R.p, sp = ART.get(name), k = kL(P.laneF), w = raceWu(R, name) * view.s * k, h = w * sp.h / sp.w, e = P.wing, pop = e < 0.7 ? e / 0.7 * 1.15 : 1.15 - (e - 0.7) / 0.3 * 0.15; // ease out with a small overshoot
  ctx.save(); ctx.translate(X(P.x), laneY(P.laneF) - z * view.s * k); ctx.rotate(rot || 0); if (sq) ctx.scale(1 + sq, 1 - sq);
  ART.fx(name).fins.forEach(([fx, fy], i) => { const x = (fx - sp.ax) * w, y = (fy - sp.ay) * h, L = w * 0.24 * pop, T = h * 0.17;
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.28 + i * 0.08); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-L * 0.25, -T * 0.25); ctx.quadraticCurveTo(L * 0.4, -T * 0.6, L, -T * 0.1); ctx.lineTo(L * 0.75, T * 0.55); ctx.quadraticCurveTo(L * 0.2, T * 0.75, -L * 0.3, T * 0.45); ctx.closePath();
    const g = ctx.createLinearGradient(0, -T, 0, T); g.addColorStop(0, '#7fe6dc'); g.addColorStop(0.5, '#1fb5b0'); g.addColorStop(1, '#0d6f73'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.008); ctx.strokeStyle = '#1d1a2e'; ctx.stroke();
    ctx.fillStyle = '#ff9f1c'; ctx.fillRect(-L * 0.1, T * 0.28, L * 0.65, Math.max(2, T * 0.14)); ctx.restore(); });
  ctx.restore(); }
function boostFlame(R, name, z, rot, t) {
  const P = R.p, sp = ART.get(name), k = kL(P.laneF), w = raceWu(R, name) * view.s * k, h = w * sp.h / sp.w, ex = ART.fx(name).exhaust || [0.08, 0.6];
  const ox = (ex[0] - sp.ax) * w, oy = (ex[1] - sp.ay) * h, c = Math.cos(rot), s2 = Math.sin(rot);
  const x = X(P.x) + ox * c - oy * s2, y = laneY(P.laneF) - z * view.s * k + ox * s2 + oy * c, L = h * (0.9 + Math.random() * 0.35) * (P.superT > 0 ? 1.5 : 1), Hh = h * 0.32;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  [['#ff3d00', 1], ['#ff9800', 0.74], ['#ffe066', 0.48], ['#ffffff', 0.24]].forEach(([col, q]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -Hh * q / 2);
    ctx.quadraticCurveTo(-L * q * 0.5, -Hh * q * 0.75, -L * q, Math.sin(t * 40) * Hh * 0.08); ctx.quadraticCurveTo(-L * q * 0.5, Hh * q * 0.75, 0, Hh * q / 2); ctx.fill(); });
  ctx.restore(); }
function drawSpecial(R, t, back) {
  const P = R.p, V = R.veh, x = X(P.x), y = laneY(P.laneF) - (P.z + V.h * 0.5) * view.s, s = view.s;
  if (V.special === 'nitro' && !back) { ctx.save(); ctx.globalAlpha = 0.85; const len = 340 * s * (0.9 + Math.random() * 0.2);
    [['#ff3d00', 1], ['#ff9800', 0.75], ['#ffe066', 0.5], ['#fff', 0.25]].forEach(([c, k]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + V.len * 0.45 * s, y - 40 * s * k); ctx.quadraticCurveTo(x + V.len * 0.45 * s + len * k * 0.6, y - 70 * s * k, x + V.len * 0.45 * s + len * k, y); ctx.quadraticCurveTo(x + V.len * 0.45 * s + len * k * 0.6, y + 70 * s * k, x + V.len * 0.45 * s, y + 40 * s * k); ctx.fill(); }); ctx.restore(); }
  if (V.special === 'spin' && back) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 10); ctx.strokeStyle = 'rgba(255,230,120,.8)'; ctx.lineWidth = 14 * s; ctx.beginPath(); ctx.arc(0, 0, 230 * s, 0, Math.PI * 1.4); ctx.stroke(); ctx.strokeStyle = 'rgba(180,140,255,.6)'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.arc(0, 0, 270 * s, Math.PI, Math.PI * 2.3); ctx.stroke(); ctx.restore(); }
  if (V.special === 'beam' && back) { ctx.save(); const g = ctx.createLinearGradient(x, 0, x + 520 * s, 0); g.addColorStop(0, 'rgba(120,230,255,.6)'); g.addColorStop(1, 'rgba(120,230,255,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x + 60 * s, y); ctx.lineTo(x + 560 * s, y - 220 * s); ctx.lineTo(x + 560 * s, y + 260 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const r = ((t * 500 + i * 130) % 520) * s; ctx.beginPath(); ctx.arc(x + 60 * s, y, r, -0.4, 0.45); ctx.stroke(); } ctx.restore(); }
  if (V.special === 'whirl') drawWhirl(R, t, back);
  if (V.special === 'comet') drawComet(R, t, back);
  if (V.special === 'chomp' && back) { ctx.save(); ctx.globalAlpha = 0.28 + Math.sin(t * 14) * 0.08; const jx = X(P.x + V.len * 0.5), jy = laneY(P.laneF) - (P.z + V.h * 0.45) * view.s * kL(P.laneF);
    const g = ctx.createRadialGradient(jx, jy, 4, jx, jy, 150 * s); g.addColorStop(0, 'rgba(127,230,220,.9)'); g.addColorStop(1, 'rgba(127,230,220,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(jx, jy, 150 * s, 0, 7); ctx.fill(); ctx.restore(); }
  if ((V.special === 'pound' || V.special === 'toss') && back) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.2; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y, V.len * 0.75 * s, V.h * 0.9 * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
}
/* Comet 17's Comet Dash (all code VFX): a fireball shell (radial gradient + wobbling flame tongues) that scales in over 0.3 s,
   a heat shimmer over the ember tail, and the shell cracking like an eggshell when the car pops out. */
const cometC = R => R.comet ? R.t - R.comet.t0 : -1;
const cometForm = R => !!R.comet && cometC(R) < SIM.COMET.finalAt + 0.08; // until the shell cracks
// score pops in comet form float ~40 px above the car's top edge (car top ~68 wu over its z), not over the body
const cometPopZ = R => R.p.z + 70 + 56 / Math.max(0.3, view.s); // pop text centre: 40 px gap + half the text height
const COMET_TILT = { special: 6 * Math.PI / 180, fly: -8 * Math.PI / 180, tau: 0.05 }; // tau 0.05 s: ~95% of the way in 0.15 s
function drawComet(R, t, back) {
  const P = R.p, V = R.veh, C = R.comet; if (!C) return;
  const E = SIM.COMET, c = R.t - C.t0, k = kL(P.laneF), s = view.s * k, red = reduced();
  const cx = X(P.x) + V.len * 0.04 * s, cy = laneY(P.laneF) - (P.z + V.h * 0.55) * s;
  const grow = c < E.trans ? Math.sin(Math.min(1, c / E.trans) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1; // ease out with a small overshoot
  const rx = 140 * s * grow, ry = 67 * s * grow; // sized to the visible car (~147 x 68 wu), not the hitbox
  ctx.save();
  if (c >= E.finalAt) { // the shell cracks into two halves that tumble away and fade
    const q = (c - E.finalAt) / 0.38; if (q >= 1 || !back) { ctx.restore(); return; }
    ctx.globalAlpha = 1 - q; ctx.fillStyle = 'rgba(255,150,50,.85)'; ctx.strokeStyle = 'rgba(255,240,200,.9)'; ctx.lineWidth = 3 * s;
    [[-1, -0.6], [1, 0.5]].forEach(([dir, spinA]) => { ctx.save(); ctx.translate(cx + dir * q * 90 * s, cy + (dir < 0 ? -1 : 1) * q * 50 * s - (dir < 0 ? q * 40 * s : 0)); ctx.rotate(spinA * q * 2);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, dir < 0 ? Math.PI : 0, dir < 0 ? Math.PI * 2 : Math.PI); // the open edge is zig-zag like an eggshell
      for (let i = 0; i <= 8; i++) { const xx = (dir < 0 ? 1 : -1) * rx * (1 - i / 4); ctx.lineTo(xx, (i % 2 ? 1 : -1) * 9 * s * -dir); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
    ctx.restore(); return; }
  const wob = red ? 0 : 1;
  if (back) {
    // heat shimmer: faint wavy lines over the tail
    if (!red) { ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const yy = cy - ry * 0.6 + i * ry * 0.4; ctx.beginPath(); for (let x = 0; x < 520 * s; x += 12) ctx.lineTo(cx - rx * 0.8 - x, yy + Math.sin(x * 0.05 - t * 22 + i) * 5 * s); ctx.stroke(); } }
    // outer glow
    const g = ctx.createRadialGradient(cx + rx * 0.2, cy, 2, cx, cy, rx * 1.2); g.addColorStop(0, 'rgba(255,225,150,.5)'); g.addColorStop(0.5, 'rgba(255,165,60,.5)'); g.addColorStop(0.8, 'rgba(255,105,20,.6)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.2, ry * 1.15, 0, 0, 7); ctx.fill(); // translucent middle so the car reads inside the shell
    // flame tongues streaming backwards off the rear half
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.55 + i * 0.1), bx = cx + Math.cos(a) * rx * 0.92, by = cy + Math.sin(a) * ry * 0.92;
      const L = rx * (0.55 + 0.3 * Math.sin(t * 13 * wob + i * 1.7)) * grow, wdt = ry * 0.24, tipY = by + Math.sin(t * 17 * wob + i) * wdt * 0.8 - wdt * 0.3;
      [['rgba(255,90,10,.75)', 1], ['rgba(255,190,60,.85)', 0.6]].forEach(([col, q]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx + 4 * s, by - wdt * q); ctx.quadraticCurveTo(bx - L * q * 0.5, by - wdt * q * 1.2, bx - L * q, tipY); ctx.quadraticCurveTo(bx - L * q * 0.5, by + wdt * q * 1.1, bx + 4 * s, by + wdt * q); ctx.fill(); }); }
    // a ring of short tongues licking out around the halo's top and bottom edge (still behind the car)
    for (let i = 0; i < 10; i++) { const a = (i % 2 ? -1 : 1) * Math.PI * (0.22 + (i >> 1) * 0.13), bx = cx + Math.cos(a) * rx * 1.02, by = cy + Math.sin(a) * ry * 1.02;
      const L = ry * (0.35 + 0.18 * Math.sin(t * 15 * wob + i * 2.1)) * grow, nx = Math.cos(a), ny = Math.sin(a), w2 = ry * 0.13;
      ctx.fillStyle = i % 3 ? 'rgba(255,150,40,.7)' : 'rgba(255,210,90,.75)'; ctx.beginPath(); ctx.moveTo(bx - ny * w2, by + nx * w2); ctx.quadraticCurveTo(bx + nx * L * 0.6 - ny * w2, by + ny * L * 0.6 + nx * w2, bx + nx * L - L * 0.35, by + ny * L); ctx.quadraticCurveTo(bx + nx * L * 0.5 + ny * w2, by + ny * L * 0.5 - nx * w2, bx + ny * w2, by - nx * w2); ctx.fill(); }
  } // front: nothing. The fireball is a halo behind the car; no shape is ever drawn over the body.
  ctx.restore();
}
/* Whirly Pup's tornado: 4 rotating translucent pink/white bands, wider at the top. Back halves are drawn behind her, front halves in front.
   Reduced motion: one static swirl ring. */
function drawWhirl(R, t, back) {
  const P = R.p, V = R.veh, k = kL(P.laneF), s = view.s * k, x = X(P.x), y0 = laneY(P.laneF) - P.z * view.s * k, Hh = whirlH(R) * s;
  const fade = Math.min(1, P.superT / 0.3, (3.6 - P.superT) / 0.25);
  ctx.save(); ctx.globalAlpha = Math.max(0, fade);
  if (reduced()) { if (back) { ctx.strokeStyle = 'rgba(255,150,200,.75)'; ctx.lineWidth = 10 * s; ctx.beginPath(); ctx.ellipse(x, y0 - Hh * 0.5, 95 * s, 26 * s, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); return; }
  const bands = 4;
  for (let i = 0; i < bands; i++) { const f = (i + 0.5) / bands, yy = y0 - Hh * f, rx = (34 + 72 * f) * s, ry = (10 + 16 * f) * s, a0 = t * (9 + i * 1.7) + i * 1.3, col = i % 2 ? 'rgba(255,226,240,' : 'rgba(255,110,180,';
    ctx.lineWidth = (17 - i * 2) * s; ctx.lineCap = 'round';
    // a band is a partial ellipse arc; split it at the horizon line of the ellipse (sin = 0) into near (front) and far (back) parts
    for (let seg = 0; seg < 2; seg++) { const st = a0 + seg * Math.PI * 1.05, en = st + Math.PI * 0.8; // two swirling arcs per band
      for (let a = st; a < en; a += 0.18) { const a2 = Math.min(en, a + 0.2), mid = (a + a2) / 2, front = Math.sin(mid) > 0; if (front === back) continue;
        const ex = x + Math.sin(t * 3 + i) * 6 * s, lw = ctx.lineWidth; // thin white outline so the funnel reads on light tracks
        ctx.strokeStyle = `rgba(255,255,255,${front ? 0.9 : 0.75})`; ctx.lineWidth = lw + 3 * s; ctx.beginPath(); ctx.ellipse(ex, yy, rx, ry, 0, a, a2); ctx.stroke(); ctx.lineWidth = lw;
        ctx.strokeStyle = col + (front ? 0.78 : 0.72) + ')'; ctx.beginPath(); ctx.ellipse(ex, yy, rx, ry, 0, a, a2); ctx.stroke(); } } }
  if (back) { const g = ctx.createLinearGradient(0, y0 - Hh, 0, y0); g.addColorStop(0, 'rgba(255,190,225,.30)'); g.addColorStop(1, 'rgba(255,255,255,.10)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 110 * s, y0 - Hh); ctx.quadraticCurveTo(x, y0 - Hh - 18 * s, x + 110 * s, y0 - Hh); ctx.lineTo(x + 30 * s, y0); ctx.lineTo(x - 30 * s, y0); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
// funnel height = 1.6x her sprite height (the 512x256 canvas at her drawn width), so it stays right when Pixel's art lands
function whirlH(R) { const sp = ART.get('veh.' + R.veh.id + '.drive'); return 1.6 * sp.wu * sp.h / sp.w; }
/* ---------------- Addendum D: FIRE, Laser Drive, Ira ---------------- */
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };
const AIM_ROT = { rocket: 1, meteor: 1, bolt: 1, wave: 1 };
function drawProj(R, t) {
  for (const s of R.proj) { const W = s.w, name = 'proj.' + W.id, wu = ART.get(name).wu; let z = s.z, rot = 0.0001, sc = 1;
    if (W.id === 'ball') { z += Math.abs(Math.sin(s.t * 13)) * 22; rot = s.t * 12; }
    else if (W.id === 'teeth') { z += Math.abs(Math.sin(s.t * 11)) * 14; sc = 1 + Math.sin(s.t * 40) * 0.07; } // chattering hop
    else if (W.id === 'boomerang') rot = s.t * 22;
    else if (W.id === 'gust') { rot = -s.t * 14; sc = 1 + s.t * 0.8; }
    else if (W.id === 'balloon') rot = Math.sin(s.t * 9) * 0.15;
    else if (AIM_ROT[W.id] && s.tgt) { const tg = s.tgt; rot = Math.max(-0.7, Math.min(0.7, -Math.atan2((tg.z + tg.h * 0.5 - s.z), Math.max(40, tg.x - s.x)))) || 0.0001; }
    drawSprite(name, s.x, s.lane, z, { rot, sc, wu }); } }
function drawHitFx() { for (const h of hitFx) { const k = h.t / 0.42, e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
    if (h.tint) ctx.filter = 'sepia(.5) saturate(2) hue-rotate(-12deg)';
    drawSprite(h.spr, h.x, h.lane, h.z, { sc: 0.35 + 0.9 * e, alpha: Math.max(0, 1 - k * k), rot: h.rot || 0.0001 }); if (h.tint) ctx.filter = 'none'; } }
function drawBurns() { if (!burns.length) return; ctx.save(); ctx.lineCap = 'round';
  for (const d of [-1, 1]) { let prev = null; for (const b of burns) { if (b.d !== d) continue; const p2 = [X(b.x), laneY(b.lane)];
      if (prev && Math.abs(prev[0] - p2[0]) < 120 * view.s) { const a = Math.max(0, 1 - b.t / 1.6), hot = Math.max(0, 1 - b.t / 0.5); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p2[0], p2[1]); // a dark scorch line that glows hot first
        ctx.strokeStyle = `rgba(45,28,20,${a * 0.42})`; ctx.lineWidth = 8 * view.s; ctx.stroke(); ctx.strokeStyle = `rgba(255,140,60,${hot * 0.6})`; ctx.lineWidth = 4 * view.s; ctx.stroke(); ctx.strokeStyle = `rgba(255,240,200,${hot * 0.9})`; ctx.lineWidth = 1.6 * view.s; ctx.stroke(); } prev = p2; } }
  ctx.restore(); }
// Laser Drive: a big blue-white jet flame with an orange core (~1.5 car lengths) at the nozzles, and two sweeping lasers from the nose
function laserBack(R, t, sp, z, rot) {
  const P = R.p, V = R.veh, c = R.t - R.laser.t0, s0 = ART.get(sp), k = kL(P.laneF), w = raceWu(R, sp) * view.s * k, h = w * s0.h / s0.w, F = ART.fx(sp), cs = Math.cos(rot), sn = Math.sin(rot);
  const pt = q => { const ox = (q[0] - s0.ax) * w, oy = (q[1] - s0.ay) * h; return [X(P.x) + ox * cs - oy * sn, laneY(P.laneF) - z * view.s * k + ox * sn + oy * cs]; };
  const [jx, jy] = pt(F.nozzle || [0.09, 0.8]), L = V.len * 1.5 * view.s * k * (0.85 + Math.random() * 0.3) * Math.min(1, c / 0.12), Hh = h * 0.34;
  ctx.save(); ctx.translate(jx, jy); ctx.rotate(rot);
  [['rgba(60,140,255,.55)', 1], ['rgba(150,215,255,.85)', 0.74], ['#ffffff', 0.5], ['#ffa040', 0.3]].forEach(([col, q]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(4, -Hh * q / 2);
    ctx.quadraticCurveTo(-L * q * 0.5, -Hh * q * 0.8, -L * q, Math.sin(t * 40) * Hh * 0.1); ctx.quadraticCurveTo(-L * q * 0.5, Hh * q * 0.8, 4, Hh * q / 2); ctx.fill(); });
  ctx.restore();
  const [nx, ny] = pt(F.nose || [0.94, 0.76]), reach = SIM.LASER.reach * Math.min(1, c / SIM.LASER.sweep), red = reduced();
  ctx.save(); ctx.lineCap = 'round';
  for (const d of [-1, 1]) { const sw = red ? 0.6 : Math.abs(Math.sin(t * 5 + (d > 0 ? 1.3 : 0))), el = Math.max(-0.3, Math.min(2.3, P.laneF + d * SIM.LASER.lanes * (0.2 + 0.8 * sw)));
    const exw = P.x + V.len * 0.5 + reach, ex = X(exw), ey = laneY(el) - (P.z + V.h * 0.45) * view.s * kL(el), pu = 0.75 + 0.25 * Math.sin(t * 38 + d);
    [['rgba(70,170,255,.32)', 16], ['rgba(130,215,255,.85)', 6.5], ['#ffffff', 2.6]].forEach(([col, lw]) => { ctx.strokeStyle = col; ctx.lineWidth = lw * view.s * pu + 1; ctx.beginPath(); ctx.moveTo(nx, ny + d * 2); ctx.lineTo(ex, ey); ctx.stroke(); });
    ctx.fillStyle = 'rgba(220,245,255,.9)'; ctx.beginPath(); ctx.arc(ex, ey, 7 * view.s * pu + 2, 0, 7); ctx.fill();
    if (mode === 'race' && reach > 60) { burns.push({ x: exw, lane: el, t: 0, d }); if (burns.length > 220) burns.splice(0, burns.length - 220); } }
  ctx.fillStyle = 'rgba(200,240,255,.95)'; ctx.beginPath(); ctx.arc(nx, ny, 6 * view.s + 2, 0, 7); ctx.fill();
  ctx.restore(); }
// a sliced half: the object's sprite clipped to its top or bottom half, with a glowing blue cut edge
function drawHalf(d) { const sp = ART.get(d.spr), k = kL(d.lane), w = sp.wu * view.s * k, h = w * sp.h / sp.w, a = Math.min(1, (d.life - d.t) / 0.2);
  const sx = X(d.x), cy = laneY(d.lane) - d.z * view.s * k - h * sp.ay + h * 0.5;
  ctx.save(); ctx.translate(sx, cy); ctx.rotate(d.r); ctx.globalAlpha = a; ctx.beginPath(); ctx.rect(-w, d.half < 0 ? -h : 0, w * 2, h); ctx.clip();
  ctx.drawImage(sp.img, -w * sp.ax, -h * 0.5, w, h); ctx.restore();
  ctx.save(); ctx.translate(sx, cy); ctx.rotate(d.r); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(120,220,255,.95)'; ctx.lineWidth = 4; ctx.shadowColor = '#7fd4ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(-w * 0.45, 0); ctx.lineTo(w * 0.45, 0); ctx.stroke(); ctx.restore(); }
function slice(o, R) { const sp = R ? R.p.speed : 400; AU.play('sizzle');
  [-1, 1].forEach(hf => debris.push({ half: hf, spr: objSprite(o), whole: o, x: o.x, lane: o.lane, z: o.z, vx: sp * 0.55 + (hf < 0 ? 260 : 80), vz: hf < 0 ? 520 : 120, r: 0, vr: hf < 0 ? 3.5 : -2, life: 0.42, t: 0, sz: 1 }));
  for (let i = 0; i < 8 && parts.length < 500; i++) parts.push({ kind: 'spark', x: o.x, lane: o.lane, z: o.z + o.h * 0.5, vx: rand(-300, 700), vz: rand(-200, 500), life: rand(0.2, 0.4), t: 0, r: rand(3, 5), c: i % 2 ? '255,255,255' : '120,210,255' }); }
// Ira's Zoomie Chomp: a tan-and-white dust whirlwind with her spin pose flickering in the middle
function drawZoomie(R, t) { const D = R.dash, V = R.veh, k = kL(D.lane), s = view.s * k, x = X(D.x), y0 = laneY(D.lane) - D.z * view.s * k, Hh = 120 * s, red = reduced();
  shadow(D.x, D.lane, D.z, 140, 0.3);
  const bands = (front) => { for (let i = 0; i < 4; i++) { const f = (i + 0.5) / 4, yy = y0 - Hh * f, rx = (46 + 40 * f) * s, ry = (12 + 10 * f) * s, a0 = t * (16 + i * 2) + i;
      ctx.lineWidth = (13 - i * 2) * s; ctx.lineCap = 'round'; ctx.strokeStyle = i % 2 ? 'rgba(251,246,239,.85)' : 'rgba(200,115,58,.8)';
      for (let a = a0; a < a0 + Math.PI * 1.5; a += 0.25) { const fr = Math.sin(a + 0.125) > 0; if (fr !== front) continue; ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, 0, a, a + 0.27); ctx.stroke(); } } };
  ctx.save(); if (!red) bands(false);
  const sp = ART.get('veh.' + V.id + '.spin'), w = sp.wu * view.s * k * 0.62, h = w * sp.h / sp.w; ctx.save(); ctx.translate(x, y0 - Hh * 0.45); ctx.rotate(red ? 0 : t * 22); if (!red && (t * 14 | 0) % 2) ctx.scale(-1, 1);
  ctx.drawImage(sp.img, -w / 2, -h / 2, w, h); ctx.restore();
  if (!red) bands(true); else { ctx.strokeStyle = 'rgba(200,115,58,.8)'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.ellipse(x, y0 - Hh * 0.45, 80 * s, 24 * s, 0, 0, 7); ctx.stroke(); }
  ctx.restore();
  if (!red && Math.random() < 0.5 && parts.length < 480) parts.push({ kind: 'dust', x: D.x + rand(-60, 60), lane: D.lane + rand(-0.1, 0.1), z: D.z + rand(0, 20), vx: rand(-200, 100), vz: rand(20, 120), life: rand(0.3, 0.5), t: 0, r: rand(8, 16), c: '230,205,170' }); }
function dizzyStars(R, x, lane, z, t) { const k = kL(lane), cx = X(x), cy = laneY(lane) - z * view.s * k; ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1d1a2e'; ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const a = t * 7 + i * Math.PI; window.LeoProc.starPath(ctx, cx + Math.cos(a) * 34 * view.s, cy + Math.sin(a) * 9 * view.s, 10 * view.s + 3, 4 * view.s + 1.4); ctx.fill(); ctx.stroke(); } ctx.restore(); }
function drawToots(t) { for (const c of toots) { const L = c.big ? 1.25 : 1, k = c.t / L, g = c.big ? Math.min(1, c.t / 0.25) : 1;
    drawSprite('fx.toot', c.x, c.lane, c.z, { sc: (c.big ? 0.4 + 1.1 * g : 0.38) * (1 + k * 0.3), alpha: Math.max(0, 1 - k * k), rot: 0.0001 + Math.sin(c.t * 3) * 0.05 }); }
  for (const p of pellets) { const a = Math.max(0, 1 - p.t); drawSprite('fx.pellet', p.x, p.lane, p.z, { alpha: a, sq: p.sq || 0, rot: 0.0001 });
    const tw = Math.max(0, Math.sin(p.t * 9)); if (tw > 0.3) { ctx.save(); ctx.globalAlpha = a * tw; ctx.fillStyle = '#fff8c4'; window.LeoProc.starPath(ctx, X(p.x) + 9 * view.s, laneY(p.lane) - (p.z + 16) * view.s, 6 * view.s + 2, 2 * view.s + 0.8); ctx.fill(); ctx.restore(); } } }
function hintArrow(R, t) { const P = R.p, o = SIM.aimTarget(R, P.x + R.veh.len * 0.45, P.laneF, Math.min(R.weapon.range, R.viewAhead || 650), null); if (!o) return;
  const k = kL(o.lane), x = X(o.x), y = laneY(o.lane) - (o.z + o.h + 30 + Math.abs(Math.sin(t * 6)) * 14) * view.s * k, s = Math.max(0.8, view.s);
  ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16 * s, -20 * s); ctx.lineTo(-7 * s, -20 * s); ctx.lineTo(-7 * s, -40 * s); ctx.lineTo(7 * s, -40 * s); ctx.lineTo(7 * s, -20 * s); ctx.lineTo(16 * s, -20 * s); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1d1a2e'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
function onFire(R, e) { const P = R.p, V = R.veh, W = R.weapon, c = hexRgb(W.col); AU.play('fire_' + e.w);
  if (R.hint) { R.hint = false; prog.fired = true; saveProg(); }
  if (e.dash) return;
  for (let i = 0; i < 6 && parts.length < 500; i++) parts.push(i < 3 ? { kind: 'dust', x: P.x + V.len * 0.5, lane: P.laneF, z: P.z + V.h * 0.55, vx: rand(100, 300), vz: rand(-40, 60), life: 0.22, t: 0, r: rand(6, 10), c: '255,255,255', a: 0.8 } // muzzle puff at the nose
    : { kind: 'spark', x: P.x + V.len * 0.5, lane: P.laneF, z: P.z + V.h * 0.55, vx: rand(200, 600), vz: rand(-200, 200), life: 0.18, t: 0, r: 4, c }); }
function onShotHit(R, e) { const W = R.weapon; AU.play('hit_' + e.w); bumpScore();
  popText(e.word, e.x, e.lane, e.z + 70, W.col, true, '+' + e.pts);
  hitFx.push({ spr: 'hitfx.' + e.fx, x: e.x, lane: e.lane, z: e.z, t: 0, tint: !!W.tint, rot: rand(-0.3, 0.3) }); if (hitFx.length > 10) hitFx.shift();
  if (e.w === 'zoomie') for (let i = 0; i < 14 && parts.length < 560; i++) parts.push({ kind: 'conf', x: e.x + rand(-40, 40), lane: e.lane + rand(-0.2, 0.2), z: e.z + rand(-20, 30), vx: rand(-300, 300), vz: rand(200, 600), life: rand(0.6, 1.1), t: 0, r: rand(3, 6), rot: rand(0, 6), c: ['#c98640', '#e8c69a', '#fff'][i % 3] }); // crumbs
  if (e.w === 'balloon') for (let i = 0; i < 12 && parts.length < 560; i++) parts.push({ kind: 'spark', x: e.x, lane: e.lane, z: e.z, vx: rand(-500, 500), vz: rand(0, 600), life: rand(0.3, 0.5), t: 0, r: rand(4, 7), c: i % 2 ? '140,215,255' : '255,255,255' });
  shake = Math.max(shake, reduced() ? 0 : 2); } // reduced motion: shots never shake the screen
function drawRival(rv, t) { shadow(rv.x, rv.laneF, 0, 170, 0.26); drawSprite('rival.' + rv.id, rv.x, rv.laneF, Math.abs(Math.sin(t * 16 + rv.bob)) * 2); }
function objSprite(o) { const k = o.kind; if (k === 'block' || k === 'mega') return 'smash.' + k + '.' + ((o.x / 7 | 0) % 6); if (k === 'balloon') return 'smash.balloon.' + ((o.x / 11 | 0) % 4); if (k === 'barrel') return 'smash.barrel.' + ((o.x / 13 | 0) % 3); return 'smash.' + k; }
function drawObj(o, t) {
  if (o.star) { const k = kL(o.lane); const sc = 1 + Math.sin(t * 6 + o.x) * 0.08; drawSprite('item.star', o.x, o.lane, o.z + 26, { rot: Math.sin(t * 3 + o.x) * 0.25, sq: 0, wu: 52 * sc }); return; }
  if (o.z < 5) shadow(o.x, o.lane, 0, o.w * 1.2, 0.22);
  const bob = SIM.KINDS[o.kind].sky ? Math.sin(t * 2.5 + o.x * 0.01) * 8 : 0;
  drawSprite(objSprite(o), o.x, o.lane, o.z + bob);
}

/* ---------------- debris + particles ---------------- */
const CAP = () => reduced() ? 90 : 240;
function burst(o, R, how) {
  const K = SIM.KINDS[o.kind], n = Math.round(K.chunks * (reduced() ? 0.5 : 1)), sp = R ? R.p.speed : 400;
  const vars = ART.variants('debris.' + K.debris);
  const fl = how === 'whirl' ? 1.5 : 1, fireHow = how === 'comet' || how === 'burn'; let lit = fireHow ? debris.reduce((n, d) => n + (d.fire ? 1 : 0), 0) : 0; // the tornado flings pieces up and out; Comet 17 sets them on fire
  for (let i = 0; i < n && debris.length < CAP(); i++) debris.push({ spr: vars[Math.random() * vars.length | 0], x: o.x + rand(-o.w * 0.4, o.w * 0.4), lane: o.lane + rand(-0.25, 0.25), z: o.z + rand(0.1, 0.9) * o.h, vx: sp * 0.5 + rand(-200, 600) * fl, vz: rand(250, 900) * (how === 'comet' ? 1.25 : fl), r: rand(0, 6), vr: rand(-12, 12) * fl, life: rand(1.1, 1.8), t: 0, sz: rand(0.7, 1.3), fire: fireHow && lit++ < FIRE_CAP });
  if (how === 'flatten' && o.z < 10) debris.push({ spr: objSprite(o), x: o.x, lane: o.lane, z: 0, vx: 0, vz: 0, r: 0, vr: 0, life: 0.45, t: 0, sz: 1, flat: true }); // Chomp Rex squashes it flat
  const pc = reduced() ? 4 : 10, dc = fireHow ? pc >> 1 : pc; // Comet 17: half the smoke, lower alpha, kept low
  for (let i = 0; i < dc && parts.length < 500; i++) parts.push(fireHow ? { kind: 'dust', x: o.x, lane: o.lane, z: o.z + o.h * 0.15, vx: rand(-200, 200), vz: rand(-20, 60), life: rand(0.35, 0.6), t: 0, r: rand(8, 16), c: K.sky ? '255,255,255' : '230,220,200', a: 0.5 }
    : { kind: 'dust', x: o.x, lane: o.lane, z: o.z + o.h * 0.4, vx: rand(-200, 300), vz: rand(-50, 250), life: rand(0.4, 0.8), t: 0, r: rand(10, 24), c: K.sky ? '255,255,255' : '230,220,200' });
  for (let i = 0; i < pc && parts.length < 500; i++) parts.push({ kind: 'spark', x: o.x, lane: o.lane, z: o.z + o.h * 0.5, vx: rand(-600, 900), vz: rand(-400, 800), life: rand(0.25, 0.5), t: 0, r: rand(3, 6), c: ['255,210,63', '255,255,255', '255,120,80'][i % 3] });
}
const FIRE_CAP = 12; // Comet 17: at most ~12 burning pieces on screen
function topple(o, R, how) { debris.push({ fire: (how === 'comet' || how === 'burn') && debris.reduce((n, d) => n + (d.fire ? 1 : 0), 0) < FIRE_CAP, spr: objSprite(o), x: o.x, lane: o.lane, z: o.z, vx: (R ? R.p.speed : 400) * 0.6 + rand(100, 400), vz: rand(200, 600), r: 0, vr: rand(-5, 5), life: 2, t: 0, sz: 1, whole: o, burstOnLand: true }); }
function confetti(n, x, lane, z) { for (let i = 0; i < n && parts.length < 600; i++) parts.push({ kind: 'conf', x: x + rand(-200, 200), lane: lane + rand(-0.5, 0.5), z: z + rand(0, 200), vx: rand(-300, 300), vz: rand(200, 900), life: rand(1.5, 2.6), t: 0, r: rand(5, 9), rot: rand(0, 6), c: ['#ff4d6d', '#ffd23f', '#2ec4b6', '#4361ee', '#9b5cf0', '#ff9f1c'][i % 6] }); }
function popText(text, x, lane, z, col, big, sub) { if (pops.length > 24) pops.shift(); pops.push({ text, x, lane, z, t: 0, col: col || '#fff', big: !!big, sub }); }
function updateFx(dt, R) {
  for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.t += dt; d.vz -= 1900 * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.r += d.vr * dt; if (d.vl) d.lane += d.vl * dt;
    if (d.half) { if (d.z < 0) { d.z = 0; d.vz = 0; } if (d.t > d.life) { if (d.half > 0) burst(d.whole, R); debris.splice(i, 1); } continue; } // sliced halves part, then pop
    if (d.z < 0) { d.z = 0; if (d.burstOnLand) { burst(d.whole, R, d.fire ? 'burn' : undefined); debris.splice(i, 1); continue; } d.vz = -d.vz * 0.38; d.vx *= 0.7; d.vr *= 0.6; }
    if (d.fire && parts.length < 480 && Math.random() < dt * (reduced() ? 8 : 22)) parts.push({ kind: 'ember', x: d.x, lane: d.lane, z: d.z + 10, vx: rand(-40, 40), vz: rand(20, 80), life: rand(0.3, 0.5), t: 0, r: rand(4, 7) }); // ember trail
    if (d.t > d.life) debris.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= (p.kind === 'conf' ? 500 : p.kind === 'dust' || p.kind === 'ember' ? 0 : 1400) * dt; if (p.kind === 'conf') { p.vx *= 0.99; p.rot += dt * 6; if (p.vz < -160) p.vz = -160; } if (p.t > p.life) parts.splice(i, 1); }
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.1) pops.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > (rings[i].life || 0.7)) rings.splice(i, 1); }
  for (let i = scorch.length - 1; i >= 0; i--) { scorch[i].t += dt; if (scorch[i].t > 1.5) scorch.splice(i, 1); }
  for (let i = gulps.length - 1; i >= 0; i--) { gulps[i].t += dt; if (gulps[i].t > 0.2) gulps.splice(i, 1); }
  for (let i = hitFx.length - 1; i >= 0; i--) { hitFx[i].t += dt; if (hitFx[i].t > 0.42) hitFx.splice(i, 1); }
  for (let i = burns.length - 1; i >= 0; i--) { burns[i].t += dt; if (burns[i].t > 1.6) burns.splice(i, 1); }
  for (let i = toots.length - 1; i >= 0; i--) { const c = toots[i]; c.t += dt; c.z += dt * 18; if (c.rel != null && R) { c.rel -= dt * 100; c.x = R.p.x + c.rel; } if (c.t > (c.big ? 1.25 : 1)) toots.splice(i, 1); }
  for (let i = pellets.length - 1; i >= 0; i--) { const p = pellets[i]; p.t += dt; p.vz -= 1400 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.sq = Math.max(0, (p.sq || 0) - dt * 3);
    if (p.z < 0) { p.z = 0; if (!p.bounced) { p.bounced = true; p.vz = 160; p.sq = 0.35; AU.play('boing'); } else { p.vz = 0; p.vx *= 0.5; } } if (p.t > 1) pellets.splice(i, 1); }
  if (R && R.proj.length && !reduced()) for (const s of R.proj) if (parts.length < 470 && s.w.id !== 'wave' && s.w.id !== 'bolt') parts.push({ kind: 'dust', x: s.x - 20, lane: s.lane, z: s.z, vx: -60, vz: 0, life: 0.28, t: 0, r: 6, c: hexRgb(s.w.col), a: 0.7 }); // tiny trails in the hero's colour
  if (R) heroFx(R, dt);
}
/* Per-frame FX for the Addendum B specials: tornado sparkles, cloud puffs and a short pink cloud trail. */
function heroFx(R, dt) {
  const P = R.p, V = R.veh; if (R.snapT > 0) R.snapT -= dt;
  if (R.dizzyT > 0) R.dizzyT -= dt; if (R.wagT > 0) R.wagT -= dt;
  if (V.special === 'laser') laserFx(R, dt);
  if (V.runner) iraFx(R, dt);
  if (R.comet && cometC(R) < SIM.COMET.finalAt) { // Comet 17's ember tail, ~3 car lengths (embers hang in the air as the car rushes on)
    R.trailAcc = (R.trailAcc || 0) + dt * (reduced() ? 30 : 70);
    while (R.trailAcc >= 1 && parts.length < 480) { R.trailAcc -= 1; parts.push({ kind: 'ember', tail: true, x: P.x - V.len * 0.45 + rand(-30, 20), lane: P.laneF + rand(-0.12, 0.12), z: P.z + V.h * 0.55 + rand(-28, 28), vx: rand(-60, 80), vz: rand(10, 80), life: rand(0.5, 0.7), t: 0, r: rand(6, 12) }); }
    return; }
  if (V.special !== 'whirl' || P.superT <= 0) return;
  const red = reduced(), H0 = whirlH(R);
  R.trailAcc = (R.trailAcc || 0) + dt * (red ? 10 : 34);
  while (R.trailAcc >= 1 && parts.length < 480) { R.trailAcc -= 1;
    parts.push({ kind: 'dust', x: P.x - V.len * 0.4 + rand(-20, 20), lane: P.laneF + rand(-0.15, 0.15), z: P.z + rand(0, H0 * 0.5), vx: -rand(40, 140), vz: rand(-10, 40), life: rand(0.45, 0.8), t: 0, r: rand(10, 20), c: Math.random() < 0.6 ? '255,170,215' : '255,255,255' }); // pink cloud trail
    if (!red && Math.random() < 0.5) { const a = rand(0, 6.28), f = Math.random(); parts.push({ kind: 'spark', x: P.x + Math.cos(a) * (40 + 70 * f), lane: P.laneF + Math.sin(a) * 0.5, z: P.z + f * H0, vx: P.speed * 0.9 + rand(-200, 200), vz: rand(100, 400), life: rand(0.2, 0.4), t: 0, r: rand(3, 5), c: Math.random() < 0.5 ? '255,255,255' : '255,140,200' }); } }
}
function laserFx(R, dt) { const P = R.p, V = R.veh;
  if (R.laser) { R.pewT = (R.pewT || 0) - dt; if (R.pewT <= 0 && mode === 'race') { R.pewT = 0.28; AU.play('pew'); } }
  if (R.sputter) { const S = R.sputter; S.t += dt; while (S.n < 3 && S.t >= S.n * 0.15) { S.n++; // the thruster sputters out with 3 puffs
      for (let i = 0; i < 5 && parts.length < 500; i++) parts.push({ kind: 'dust', x: P.x - V.len * 0.5, lane: P.laneF, z: P.z + V.h * 0.35, vx: rand(-220, -60), vz: rand(10, 80), life: rand(0.4, 0.6), t: 0, r: rand(10, 18), c: i % 2 ? '200,225,255' : '235,240,250' }); }
    if (S.t > 0.5) R.sputter = null; } }
function iraFx(R, dt) { const P = R.p, V = R.veh, red = reduced(), live = mode === 'race';
  // run cycle: ~6 Hz at cruise, 9 Hz in Turbo Toot; a paw-dust puff + a soft footstep on every other frame swap
  if (P.onGround && !R.dash) { const hz = P.superT > 0 ? 9 : 6 * Math.min(1.25, Math.max(0.2, P.speed / V.speed)), was = R.runPh | 0; R.runPh = (R.runPh || 0) + dt * hz * 2;
    if ((R.runPh | 0) !== was) { if ((R.runPh | 0) % 2 === 0 && live) AU.play('paw'); if (parts.length < 480) parts.push({ kind: 'dust', x: P.x - V.len * 0.35 + rand(-10, 10), lane: P.laneF, z: 2, vx: -rand(40, 120), vz: rand(10, 50), life: rand(0.25, 0.4), t: 0, r: rand(5, 9), c: '230,215,190', a: 0.7 }); } }
  // lane change: a tiny skid overshoot (~8 px past, then back) and a paw-dust puff
  const dl = P.lane - P.laneF; if (Math.abs(dl) > 1e-3) R.laneMove = Math.sign(dl);
  else if (R.laneMove) { R.skid = { t: 0, d: R.laneMove }; R.laneMove = 0; if (live) AU.play('skid'); for (let i = 0; i < (red ? 2 : 5) && parts.length < 490; i++) parts.push({ kind: 'dust', x: P.x + rand(-50, 40), lane: P.laneF, z: 0, vx: rand(-120, 60), vz: rand(20, 90), life: rand(0.3, 0.5), t: 0, r: rand(8, 14), c: '230,215,190' }); }
  if (R.skid) { R.skid.t += dt; if (R.skid.t > 0.2) R.skid = null; }
  // Turbo Toot: PFRRRT after the look back, a green puff every 0.25 s (0.5 s with reduced motion), 5 toy pellets across the boost
  const T = R.tootFx; if (T) { T.t += dt;
    if (!T.pf && T.t >= SIM.TOOT.look) { T.pf = true; if (live) { AU.play('pfrrt'); banner('PFRRRT!'); } toots.push({ big: true, x: P.x - V.len * 0.55, rel: -V.len * 0.55, lane: P.laneF, z: P.z + V.h * 0.4, t: 0 }); shake = Math.max(shake, red ? 0 : 5); }
    if (T.pf && T.t >= T.next && P.superT > 0) { T.next += red ? 0.5 : 0.25; toots.push({ x: P.x - V.len * 0.6, lane: P.laneF + rand(-0.08, 0.08), z: P.z + V.h * 0.4 + rand(-8, 8), t: 0 }); if (toots.length > 24) toots.shift(); if (live) AU.play('toot'); }
    while (T.pel.length && T.t >= T.pel[0]) { T.pel.shift(); pellets.push({ x: P.x - V.len * 0.45, lane: P.laneF + rand(-0.08, 0.08), z: P.z + V.h * 0.3, vx: P.speed * 0.15, vz: 140, t: 0 }); }
    if (P.superT <= 0) R.tootFx = null; }
  const E = R.tootEnd; if (E) { E.t += dt; if (E.n === 0 && E.t > 0.3) { E.n = 1; if (live) AU.play('sniff'); } if (E.n === 1 && E.t > 0.7) { E.n = 2; if (live) AU.play('bark'); R.wagT = 0.9; R.tootEnd = null; } } }
/* layer: undefined = everything (all heroes, as before). Comet form splits it so the car stays readable:
   'back' = debris, dust, smoke, embers, rings (drawn before the car), 'front' = only the few sparks flagged `front` + the score pops. */
function drawFx(layer) {
  const back = layer !== 'front', front = layer !== 'back';
  if (back) {
  for (const d of debris) { if (d.half) { drawHalf(d); continue; } const a = Math.min(1, (d.life - d.t) / 0.4); if (d.flat) { drawSprite(d.spr, d.x, d.lane, 0, { sq: 0.75, alpha: a, rot: 0.0001 }); continue; } drawSprite(d.spr, d.x, d.lane, d.z, { rot: d.r || 0.0001, alpha: a, wu: d.wu || ART.get(d.spr).wu * d.sz });
    if (d.fire) { const wu = d.wu || ART.get(d.spr).wu * d.sz, r = Math.max(8, wu * 0.45 * view.s), x = X(d.x), y = laneY(d.lane) - (d.z + wu * 0.2) * view.s; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.75; // burning: orange tint + glow
      const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(255,170,60,.9)'); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); } }
  }
  ctx.globalAlpha = 1; const Rn = scene();
  for (const p of parts) { if (layer && (layer === 'front') !== !!p.front) continue; const a = Math.max(0, 1 - p.t / p.life), x = X(p.x), y = laneY(p.lane) - p.z * view.s;
    if (p.kind === 'dust') { ctx.fillStyle = `rgba(${p.c},${a * 0.6 * (p.a || 1)})`; ctx.beginPath(); ctx.arc(x, y, p.r * view.s * (1 + p.t * 2), 0, 7); ctx.fill(); }
    else if (p.kind === 'ember') { const q = p.t / p.life, teal = Math.min(1, q * (Rn && Rn.track.id === 'city' ? 1.9 : 1.25)); // orange -> teal (more teal on the night track)
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${255 - 215 * teal | 0},${150 + 70 * teal | 0},${40 + 170 * teal | 0},${a * 0.85})`; ctx.beginPath(); ctx.arc(x, y, p.r * view.s * (1 - q * 0.6), 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.kind === 'spark') { ctx.strokeStyle = `rgba(${p.c},${a})`; ctx.lineWidth = p.r * view.s * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03 * view.s, y + p.vz * 0.03 * view.s); ctx.stroke(); }
    else { ctx.save(); ctx.globalAlpha = Math.min(1, a * 2); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r * view.s, -p.r * 0.5 * view.s, p.r * 2 * view.s, p.r * view.s); ctx.restore(); } }
  if (back) {
  const Rg = scene(); if (Rg && gulps.length) for (const q of gulps) { const k = Math.min(1, q.t / 0.2), P = Rg.p, mx = P.x + Rg.veh.len * 0.42, mz = P.z + Rg.veh.h * 0.45; // shrinks into the mouth
    drawSprite(q.spr, q.x + (mx - q.x) * k, q.lane + (P.laneF - q.lane) * k, q.z + (mz - q.z) * k, { sc: Math.max(0.05, 1 - k * 0.95), rot: 0.0001 + k * 0.6, wu: q.wu }); }
  for (const r of rings) { const L = r.life || 0.7, k = r.t / L, e = r.fixed ? 0.75 : k; ctx.strokeStyle = `rgba(${r.col || '255,230,120'},${(1 - k) * (r.a || 1)})`; ctx.lineWidth = 12 * (1 - k) + 2; ctx.beginPath(); ctx.ellipse(X(r.x), laneY(r.lane == null ? 1 : r.lane), r.r * e * view.s, r.r * e * 0.25 * view.s, 0, 0, 7); ctx.stroke(); } // fixed = reduced motion: no expanding
  }
  if (!front) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const p of pops) { const k = Math.min(1, p.t * 6), a = Math.min(1, (1.1 - p.t) * 3); let x = X(p.x); const y = laneY(p.lane) - (p.z + p.t * 120) * view.s;
    if (p.sub != null) { // Sharp Shot: the weapon word in the hero's colour, big and bouncy, with the points under it; kept inside the canvas
      const fs = Math.round(36 * Math.max(0.8, view.s) * (1 + Math.sin(Math.min(1, p.t * 4) * Math.PI) * 0.28)), fs2 = Math.round(fs * 0.66);
      ctx.font = `700 ${fs}px Fredoka, "Baloo 2", system-ui, sans-serif`; const hw = ctx.measureText(p.text).width / 2 + 6; x = Math.max(hw, Math.min(W - hw, x));
      ctx.globalAlpha = a; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = '#1d1a2e'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
      ctx.font = `700 ${fs2}px Fredoka, "Baloo 2", system-ui, sans-serif`; ctx.lineWidth = fs2 * 0.2; ctx.strokeText(p.sub, x, y + fs * 0.8); ctx.fillStyle = '#fff'; ctx.fillText(p.sub, x, y + fs * 0.8); ctx.globalAlpha = 1; continue; }
    const fs = Math.round((p.big ? 46 : 30) * Math.max(0.75, view.s) * (0.6 + 0.4 * k + (p.big ? Math.sin(p.t * 20) * 0.04 : 0)));
    ctx.font = `700 ${fs}px Fredoka, "Baloo 2", system-ui, sans-serif`; ctx.globalAlpha = a; ctx.lineWidth = fs * 0.18; ctx.strokeStyle = '#1d1a2e'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y); ctx.globalAlpha = 1; }
}

/* ---------------- frame render ---------------- */
function render(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const R = scene(); if (!R) { ctx.fillStyle = '#7cc8ff'; ctx.fillRect(0, 0, W, H); return; }
  drawWorldBack(R);
  for (const d of scorch) { const a = 1 - d.t / 1.5, x = X(d.x), y = laneY(d.lane), rx = d.r * view.s * kL(d.lane), ry = rx * 0.24; // Comet 17 crater scorch, fades in 1.5 s
    ctx.fillStyle = `rgba(40,22,14,${a * 0.55})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    if (d.t < 0.5) { ctx.strokeStyle = `rgba(255,130,40,${(1 - d.t / 0.5) * 0.8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, 7); ctx.stroke(); } }
  drawBurns();
  const objs = R.tr.objs, cx = camX(), x0 = cx - view.anchorX / view.s - 300, x1 = cx + (W - view.anchorX) / view.s + 300;
  // painter order: back lane to front lane; within a lane, ground pieces bottom-up
  for (let lane = 0; lane < 3; lane++) {
    for (let i = Math.max(0, R.idx - 40); i < objs.length; i++) { const o = objs[i]; if (o.x > x1) break; if (o.x < x0 || !o.alive) continue; if (Math.round(o.lane) === lane) drawObj(o, t); }
    for (const rv of R.rivals) if (Math.round(rv.laneF) === lane && rv.x > x0 && rv.x < x1) drawRival(rv, t);
    if (Math.round(R.p.laneF) === lane) { if (cometForm(R)) drawFx('back'); if (toots.length || pellets.length) drawToots(t);
      if (R.skid) { const k = R.skid.t / 0.2; ctx.save(); ctx.translate(0, R.skid.d * 8 * Math.sin(k * Math.PI) * (1 - k * 0.5)); drawPlayer(R, t); ctx.restore(); } else drawPlayer(R, t); } // comet form: dust/smoke/chunks go behind the car
  }
  for (const s of R.shots) if (s.live) drawSprite('item.shot', s.x, s.lane, s.z, { rot: t * 10 });
  if (R.proj.length) drawProj(R, t);
  if (hitFx.length) drawHitFx();
  if (R.hint && mode === 'race' && R.countdown <= 0) hintArrow(R, t);
  drawFx(cometForm(R) ? 'front' : undefined);
  for (const L of ART.layers(R.track.id)) if (L.role === 'front' && L.img) { const h = view.frontH; drawLayer(L, H - h + camZ * view.s, h, L.par, camX()); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (mode === 'title' || mode === 'pick' || mode === 'cube') { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- events -> juice ---------------- */
function handleEvents(R, live) {
  for (const e of R.events) {
    if (e.type === 'smash') { if (e.how === 'laser') slice(e.o, R); // Laser Drive cuts things in half
      else if (e.how === 'toot' || (e.how === 'shot' && R.weapon.id === 'gust' && e.first)) { topple(e.o, R, e.how); const d = debris[debris.length - 1]; if (d && d.whole === e.o) { d.vr = rand(-12, 12); if (e.how === 'shot') { d.vl = (e.o.lane >= 1 ? 1 : -1) * rand(2.5, 4); d.vz = 700; } } } // comic tumble / blown off the road
      else if (e.chain) topple(e.o, R, e.how); else burst(e.o, R, e.how);
      if (!live) continue;
      if (e.first && e.how === 'shot') continue; // the shotHit event makes one popup for the group + bonus
      if (e.first) { AU.play(e.snd, 1 + Math.random() * 0.3); if (cometForm(R)) popText('+' + e.pts, Math.max(e.o.x, R.p.x + 60), R.p.laneF, Math.max(e.o.z + e.o.h + 20, cometPopZ(R)), e.mult >= 2 ? '#ffd23f' : '#fff', e.pts >= 300); // up and out, above the car
        else popText('+' + e.pts, e.o.x, e.o.lane, e.o.z + e.o.h + 20, e.mult >= 2 ? '#ffd23f' : '#fff', e.pts >= 300);
        shake = Math.max(shake, reduced() ? 0 : (e.big ? 14 : e.pts >= 100 ? 6 : 3)); bumpScore(); if (e.big) { flash = reduced() ? 0.2 : 0.7; banner(['MEGA SMASH!', 'KABOOM!', 'SUPER!'][Math.random() * 3 | 0]); AU.say('Super!'); } } }
    else if (!live) continue;
    else if (e.type === 'star') { AU.play('star'); if (e.o) { for (let i = 0; i < 5 && parts.length < 500; i++) parts.push({ kind: 'spark', x: e.o.x, lane: e.o.lane, z: e.o.z + 26, vx: rand(-300, 300), vz: rand(-300, 300), life: 0.35, t: 0, r: 4, c: '255,220,80' }); } }
    else if (e.type === 'combo') { comboShow(e.mult); AU.play('combo', e.mult); if (e.mult === 5) AU.say('Smash!'); }
    else if (e.type === 'jump') AU.play('jump');
    else if (e.type === 'land') { AU.play('land'); R.landT = Math.min(0.35, e.v / 3000); for (let i = 0; i < 6 && parts.length < 500; i++) parts.push({ kind: 'dust', x: R.p.x + rand(-60, 60), lane: R.p.laneF, z: 0, vx: rand(-200, 200), vz: rand(20, 120), life: 0.5, t: 0, r: rand(10, 20), c: '230,220,200' }); }
    else if (e.type === 'ramp') { AU.play('ramp'); popText('WHEEE!', R.p.x, R.p.laneF, 200, '#8de8ff'); }
    else if (e.type === 'boost') { AU.play('boost'); banner('BOOST!'); }
    else if (e.type === 'super') { AU.play('super'); banner(R.veh.specialName + '!', true); AU.say(R.veh.specialName + '!'); flash = reduced() ? 0.15 : 0.5;
      if (e.special === 'whirl') { AU.play('arf'); AU.play('whirr', 3.6); } else if (e.special === 'chomp') AU.play('growl');
      else if (e.special === 'comet') { AU.play('fwoom'); AU.play('crackle', 3.6); flash = reduced() ? 0.3 : 0.9; }
      else if (e.special === 'laser') { AU.play('vwoom'); AU.play('jet', 3.6); R.pewT = 0.2; }
      else if (e.special === 'toot') { const pel = [], n = 5; for (let i = 0; i < n; i++) pel.push(0.6 + i * 0.6 + rand(-0.15, 0.15)); R.tootFx = { t: 0, pf: false, next: SIM.TOOT.look + 0.25, pel }; } }
    else if (e.type === 'impact') cometImpact(R, e);
    else if (e.type === 'cometPop') cometPop(R, e);
    else if (e.type === 'pull') { AU.play('pull', e.n); for (let i = 0; i < 6 && parts.length < 500; i++) parts.push({ kind: 'spark', x: e.o.x, lane: e.o.lane, z: e.o.z + e.o.h * 0.5, vx: rand(-300, 300), vz: rand(-200, 400), life: 0.3, t: 0, r: 4, c: '255,160,210' }); }
    else if (e.type === 'chomp') { AU.play('chomp', 0.8 + Math.random() * 0.45); R.snapT = 0.2; const o = e.o;
      if (gulps.length < 12) gulps.push({ spr: o.star ? 'item.star' : objSprite(o), x: o.x, lane: o.lane, z: o.z + (o.star ? 26 : 0), t: 0, wu: o.star ? 52 : undefined });
      if (e.pts || Math.random() < 0.5) popText(e.pts ? '+' + e.pts : 'CHOMP!', R.p.x + R.veh.len * 0.55, R.p.laneF, R.p.z + R.veh.h + 30, e.mult >= 2 ? '#ffd23f' : '#8ff5e8', e.pts >= 300); // pops at the jaw
      for (let i = 0; i < 7 && parts.length < 500; i++) parts.push({ kind: 'spark', x: R.p.x + R.veh.len * 0.45, lane: R.p.laneF, z: R.p.z + R.veh.h * 0.5, vx: rand(-200, 500), vz: rand(-300, 400), life: rand(0.2, 0.35), t: 0, r: rand(3, 5), c: ['255,255,255', '127,230,220', '255,243,214'][i % 3] }); // bite-mark burst
      if (e.pts) { bumpScore(); shake = Math.max(shake, reduced() ? 0 : (e.pts >= 300 ? 8 : 3)); } }
    else if (e.type === 'burp') burp(R, e);
    else if (e.type === 'nocharge') AU.play('nocharge');
    else if (e.type === 'fire') onFire(R, e);
    else if (e.type === 'shotHit') onShotHit(R, e);
    else if (e.type === 'projEnd') { if (e.fizzle) { AU.play('fizzle'); for (let i = 0; i < 5 && parts.length < 500; i++) parts.push({ kind: 'dust', x: e.s.x, lane: e.s.lane, z: e.s.z, vx: rand(-80, 80), vz: rand(-30, 60), life: 0.35, t: 0, r: rand(8, 14), c: '255,255,255', a: 0.8 }); } }
    else if (e.type === 'bounce') AU.play('fire_ball');
    else if (e.type === 'fireReady') { if (!e.held) { AU.play('ready'); bF.classList.remove('pulse'); void bF.offsetWidth; bF.classList.add('pulse'); } }
    else if (e.type === 'fireOff') AU.play('fireOff');
    else if (e.type === 'dizzy') R.dizzyT = 0.9;
    else if (e.type === 'laserEnd') { R.sputter = { t: 0, n: 0 }; AU.play('pewdown'); }
    else if (e.type === 'tootEnd') { R.tootEnd = { t: 0, n: 0 }; AU.play('pft'); toots.push({ x: R.p.x - R.veh.len * 0.6, lane: R.p.laneF, z: R.p.z + R.veh.h * 0.4, t: 0 }); }
    else if (e.type === 'pound') { AU.play('pound'); rings.push({ x: R.p.x, r: 1400, t: 0 }); shake = reduced() ? 0 : 18; }
    else if (e.type === 'toss') AU.play('tap');
    else if (e.type === 'go') { AU.play('count', true); countdown('GO!'); AU.say('Go!'); }
    else if (e.type === 'finish') { AU.play('fanfare'); AU.play('cheer'); banner('FINISH!'); confetti(reduced() ? 40 : 120, R.p.x + 200, 1, 100); setTimeout(() => { if (race === R && mode === 'race') showParty(); }, 2300); }
  }
  R.events.length = 0;
}
/* Comet 17: each meteor skip leaves an orange shockwave ring per lane in reach, a scorch decal, sparks and a BOOM; the final one is bigger. */
function cometImpact(R, e) { const red = reduced(), P = R.p, main = Math.round(e.lane);
  if (e.final) AU.play('kaboom'); else AU.play('mboom', 0.82 + Math.random() * 0.36);
  for (let l = 0; l < 3; l++) { if (!e.final && Math.abs(l - e.lane) > 1.25) continue; const m = e.final || l === main;
    rings.push({ x: e.x, lane: l, r: e.r * (e.final ? 1.3 : 1.15), t: 0, life: e.final ? 0.75 : 0.55, col: '255,140,40', a: m ? 1 : 0.55, fixed: red });
    if (m) scorch.push({ x: e.x, lane: l, r: e.final ? 170 : 120, t: 0 }); }
  if (scorch.length > 12) scorch.splice(0, scorch.length - 12);
  const n = red ? 8 : e.final ? 30 : 16;
  for (let i = 0; i < n && parts.length < 520; i++) parts.push(i % 2 ? { kind: 'spark', x: e.x + rand(-40, 40), lane: e.lane + rand(-0.3, 0.3), z: 6, vx: rand(-500, 900), vz: rand(200, 900), life: rand(0.25, 0.5), t: 0, r: rand(3, 6), c: ['255,200,80', '255,120,40', '255,255,255'][i % 3], front: i % 6 === 1 } // only a few sparks cross in front of the car
    : i % 8 ? { kind: 'ember', x: e.x + rand(-120, 120), lane: e.lane + rand(-0.4, 0.4), z: rand(0, 30), vx: rand(-150, 250), vz: rand(150, 500), life: rand(0.4, 0.7), t: 0, r: rand(5, 9) }
    : { kind: 'dust', x: e.x + rand(-90, 90), lane: e.lane + rand(-0.4, 0.4), z: 0, vx: rand(-150, 200), vz: rand(0, 40), life: rand(0.3, 0.5), t: 0, r: rand(8, 14), c: '110,85,70', a: 0.5 });
  popText(e.final ? 'KA-BOOM!' : 'BOOM!', e.x + 40, e.lane, cometPopZ(R) + 30 / Math.max(0.3, view.s), '#ffb347', e.final);
  if (e.final) { shake = Math.max(shake, red ? 0 : 7); flash = Math.max(flash, red ? 0.1 : 0.35); }
  if (e.n) bumpScore(); }
function cometPop(R, e) { AU.play('ting'); AU.play('hiss'); const red = reduced();
  for (let i = 0; i < (red ? 5 : 12) && parts.length < 520; i++) parts.push({ kind: 'dust', x: e.x + rand(-80, 60), lane: e.lane + rand(-0.2, 0.2), z: e.z + rand(10, 70), vx: rand(-160, 60), vz: rand(60, 200), life: rand(0.6, 1.0), t: 0, r: rand(16, 30), c: '240,244,250' }); // steam puff
  for (let i = 0; i < (red ? 4 : 10) && parts.length < 520; i++) parts.push({ kind: 'spark', x: e.x, lane: e.lane, z: e.z + 40, vx: rand(-500, 700), vz: rand(100, 700), life: rand(0.25, 0.45), t: 0, r: rand(4, 7), c: '255,170,70' }); }
/* Chomp Rex's finale: a big comic burp sprays confetti and chunks of everything it ate, in their own colours. */
const KIND_COL = { cone: ['#ff7a00', '#ffffff'], box: ['#d9a566', '#b47a3c'], crate: ['#d99a52', '#9a5a22'], block: ['#ff4d6d', '#4361ee', '#ffd23f', '#2ec4b6'], mega: ['#9b5cf0', '#ff9f1c', '#2ec4b6'], wall: ['#e06640', '#a8442a'], wallw: ['#e06640', '#a8442a'], barrel: ['#e53935', '#2f6fdf', '#2ec46b'], balloon: ['#ff4d6d', '#ffd23f', '#4cc9f0'], cloud: ['#ffffff', '#d6e4f7'], star: ['#ffd23f', '#fff3a8'] };
function burp(R, e) {
  AU.play('burp'); banner('BUURP!'); const P = R.p, mx = P.x + R.veh.len * 0.45, mz = P.z + R.veh.h * 0.5, bag = e.bag.slice(-40), red = reduced();
  bag.forEach((kind, i) => { if (i % (red ? 3 : 1)) return; const K = SIM.KINDS[kind];
    if (K && debris.length < CAP()) { const vars = ART.variants('debris.' + K.debris); debris.push({ spr: vars[Math.random() * vars.length | 0], x: mx, lane: P.laneF + rand(-0.4, 0.4), z: mz, vx: P.speed + rand(150, 700), vz: rand(350, 950), r: 0, vr: rand(-10, 10), life: rand(1.2, 1.9), t: 0, sz: rand(0.8, 1.3) }); }
    else if (kind === 'star' && debris.length < CAP()) debris.push({ spr: 'item.star', x: mx, lane: P.laneF, z: mz, vx: P.speed + rand(150, 600), vz: rand(400, 900), r: 0, vr: rand(-6, 6), life: 1.4, t: 0, sz: 1, wu: 30 });
    const cols = KIND_COL[kind] || ['#ffd23f']; for (let j = 0; j < (red ? 2 : 5) && parts.length < 600; j++) parts.push({ kind: 'conf', x: mx + rand(-20, 20), lane: P.laneF + rand(-0.4, 0.4), z: mz + rand(-10, 30), vx: P.speed + rand(0, 600), vz: rand(250, 800), life: rand(1.2, 2.2), t: 0, r: rand(5, 9), rot: rand(0, 6), c: cols[j % cols.length] }); });
  if (!bag.length) confetti(red ? 10 : 30, mx, P.laneF, mz);
  shake = Math.max(shake, red ? 0 : 6); }
let bannerT = 0;
// special = a hero's special-move name: smaller, high up (~20% from the top) and fading out after ~0.9 s so the action and combo stay visible
function banner(t, special) { const b = $('#banner'); b.textContent = t; b.classList.remove('on'); b.classList.toggle('sp', !!special); void b.offsetWidth; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), special ? 900 : 1100); }
let comboT = 0;
function comboShow(m) { const c = $('#combo'); c.textContent = 'x' + m; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); clearTimeout(comboT); comboT = setTimeout(() => c.classList.remove('on'), 1200); }
function bumpScore() { const s = $('.hud-score'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
let cdLast = '';
function countdown(t) { const el = $('#countdown'); if (t === cdLast) return; cdLast = t; el.classList.remove('hidden'); el.innerHTML = '<span>' + t + '</span>'; if (t === 'GO!') setTimeout(() => { el.classList.add('hidden'); cdLast = ''; }, 700); }

/* ---------------- demo driver (title background) ---------------- */
function demoInput(R) { const P = R.p, i = { jump: false, jumpPressed: false, boostPressed: false, lane: 0 };
  for (let k = R.idx; k < R.tr.objs.length; k++) { const o = R.tr.objs[k], dx = o.x - P.x; if (dx > 500) break; if (dx > 60 && o.alive && o.z > 150 && Math.abs(o.lane - P.lane) < 0.5) { i.jump = true; break; } }
  if (R.boost >= 1) i.boostPressed = true; if (P.onGround && i.jump) i.jumpPressed = true; return i; }
function newDemo() { demo = SIM.createRace({ vehicle: settings.vehicle, track: settings.track, seed: 99, countdown: 0, assist: true, reduced: settings.reduced }); demo.boost = 0.5; }

/* ---------------- main loop (fixed timestep) ---------------- */
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000; let dt = Math.min(0.1, lastT ? t - lastT : 0); lastT = t;
  if (mode === 'race' && !paused && race) {
    const ts2 = race.slow > 0 && !reduced() ? 0.35 : 1; acc += dt * ts2;
    while (acc >= SIM.STEP) { SIM.step(race, SIM.STEP, input); input.jumpPressed = false; input.boostPressed = false; input.firePressed = false; input.lane = 0; acc -= SIM.STEP; handleEvents(race, true); }
    if (race.countdown > 0) countdown(String(Math.ceil(race.countdown / 0.8)));
    if (race.landT > 0) race.landT -= dt;
    updateFx(dt * ts2, race); updateHud(dt);
    AU.engineSet(race.p.speed / race.veh.speed, race.p.boostT > 0);
  } else if (mode === 'party' && race) { acc = 0; SIM.step(race, dt, { jump: false, jumpPressed: false, boostPressed: false, lane: 0 }); handleEvents(race, false); updateFx(dt, race); }
  else if (demo && (mode === 'title' || mode === 'pick' || mode === 'cube')) { acc += dt; while (acc >= SIM.STEP) { SIM.step(demo, SIM.STEP, demoInput(demo)); acc -= SIM.STEP; handleEvents(demo, false); } if (demo.finished) newDemo(); updateFx(dt, demo); }
  if (race && mode === 'race') { if (!hudBottom) measureHud(); setCeiling(race); race.viewAhead = Math.max(300, (W - view.anchorX) / view.s - 40); } // auto-aim only at what Leo can see
  const R = scene(); if (R) { const room = (view.groundY - 150) / view.s; const target = Math.min(240, Math.max(0, R.p.z - room * 0.7)); camZ += (target - camZ) * Math.min(1, dt * 4);
    camZ = Math.max(camZ, camNeed(R, R.p.z, R.p.laneF)); }
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 2.5);
  render(t);
  if (mode === 'cube') renderCube(dt);
  pupIdle(dt, t);
}

/* ---------------- HUD ---------------- */
let hudStars = -1;
function updateHud(dt) { const R = race; hudScore += (R.score - hudScore) * Math.min(1, dt * 8); if (Math.abs(R.score - hudScore) < 1) hudScore = R.score;
  $('#hScore').textContent = Math.round(hudScore); if (hudStars !== R.stars) { hudStars = R.stars; $('#hStars').textContent = R.stars; }
  const L = R.tr.L, pct = x => Math.max(0, Math.min(100, x / L * 100)) + '%'; $('#prMe').style.left = pct(R.p.x); R.rivals.forEach((rv, i) => { $('#pr' + i).style.left = pct(rv.x); });
  $('#ringFg').style.strokeDashoffset = String(283 * (1 - R.boost)); $('#bBoost').classList.toggle('ready', R.boost >= 0.999);
  fireFg.style.strokeDashoffset = String(283 * Math.min(1, R.fireCd / R.weapon.cd)); bF.classList.toggle('off', R.p.superT > 0); bF.classList.toggle('hint', !!R.hint && R.countdown <= 0);
  const V = R.veh, canFly = V.fly !== 'bounce' && (V.fly === 'always' || V.fly === 'hover' || !R.p.onGround);
  if (bJ.classList.contains('fly') !== canFly) { bJ.classList.toggle('fly', canFly); $('#bJump .lb').textContent = canFly ? 'FLY' : 'JUMP'; bJ.setAttribute('aria-label', canFly ? 'Fly. Hold to fly up.' : 'Jump'); } }

/* ---------------- input ---------------- */
function press(btn, down) { btn.classList.toggle('down', down); }
const bJ = $('#bJump'), bB = $('#bBoost');
function jumpDown() { AU.unlock(); if (!input.jump) input.jumpPressed = true; input.jump = true; press(bJ, true); }
function jumpUp() { input.jump = false; press(bJ, false); }
bJ.addEventListener('pointerdown', e => { e.preventDefault(); bJ.setPointerCapture && bJ.setPointerCapture(e.pointerId); jumpDown(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => bJ.addEventListener(n, jumpUp));
bB.addEventListener('pointerdown', e => { e.preventDefault(); AU.unlock(); input.boostPressed = true; press(bB, true); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(n => bB.addEventListener(n, () => press(bB, false)));
$('#bUp').addEventListener('pointerdown', e => { e.preventDefault(); input.lane = -1; AU.play('tap'); });
$('#bDown').addEventListener('pointerdown', e => { e.preventDefault(); input.lane = 1; AU.play('tap'); });
const bF = $('#bFire'), fireFg = $('#fireFg');
function fireDown() { AU.unlock(); if (!input.fire) input.firePressed = true; input.fire = true; press(bF, true); }
function fireUp() { input.fire = false; press(bF, false); }
bF.addEventListener('pointerdown', e => { e.preventDefault(); bF.setPointerCapture && bF.setPointerCapture(e.pointerId); fireDown(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => bF.addEventListener(n, fireUp));
[bJ, bB, bF, $('#bUp'), $('#bDown')].forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));
// canvas: hold = fly, vertical swipe = lane
let sw = null;
cv.addEventListener('pointerdown', e => { if (mode !== 'race') return; sw = { y: e.clientY, x: e.clientX, id: e.pointerId, used: false }; jumpDown(); });
cv.addEventListener('pointermove', e => { if (!sw || sw.id !== e.pointerId || sw.used) return; const dy = e.clientY - sw.y; if (Math.abs(dy) > 45) { input.lane = dy > 0 ? 1 : -1; sw.used = true; } });
['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { sw = null; jumpUp(); }));
const KJ = ['Space', 'ArrowUp', 'KeyW'], KB = ['Enter', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyX', 'NumpadEnter'], KF = ['KeyF', 'KeyZ', 'KeyJ'];
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (mode === 'race' && !paused) {
    if (KJ.includes(e.code)) { e.preventDefault(); if (!e.repeat) jumpDown(); }
    else if (KF.includes(e.code)) { e.preventDefault(); if (!e.repeat) fireDown(); }
    else if (KB.includes(e.code)) { e.preventDefault(); if (!e.repeat) { AU.unlock(); input.boostPressed = true; press(bB, true); setTimeout(() => press(bB, false), 120); } }
    else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); input.lane = -1; }
    else if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); input.lane = 1; }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); setPause(true); }
  } else if (mode === 'race' && paused && (e.code === 'KeyP' || e.code === 'Escape')) { e.preventDefault(); setPause(false); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape' && !$('#rankModal').classList.contains('hidden')) $('#rankModal').classList.add('hidden');
});
addEventListener('keyup', e => { if (KJ.includes(e.code)) jumpUp(); if (KF.includes(e.code)) fireUp(); });
addEventListener('blur', () => { jumpUp(); fireUp(); if (mode === 'race' && race && !race.finished) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'race' && race && !race.finished) setPause(true); });

/* ---------------- screens ---------------- */
function show(id) { ['title', 'pick', 'cube', 'party'].forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
  const racing = id === 'race'; $('#hud').classList.toggle('hidden', !racing); $('#controls').classList.toggle('hidden', !racing); if (!racing) $('#countdown').classList.add('hidden'); }
function setMode(m) { const was = mode; mode = m; document.body.dataset.mode = m; if ((was === 'race') !== (m === 'race')) resize(); }
function toggleMute() { AU.unlock(); AU.setMuted(!AU.muted); $('#bMute').textContent = AU.muted ? '🔇' : '🔊'; }
$('#bMute').addEventListener('click', toggleMute);
function applyReduced() { document.documentElement.classList.toggle('reduced', !!settings.reduced); }

// title
function buildTitle() {
  const box = $('#names'); box.innerHTML = '';
  NAMES.forEach(n => { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.name === n)); b.textContent = n || 'No name';
    b.onclick = () => { settings.name = n; saveSettings(); AU.unlock(); AU.play('tap'); buildTitle(); toggleNames(false); }; box.appendChild(b); });
  $('#bName').textContent = settings.name ? 'Name: ' + settings.name + ' ✎' : 'Pick a name';
  $('#oAssist').checked = settings.assist; $('#oMotion').checked = settings.reduced; $('#oPro').checked = settings.pro; $('#oUnlock').checked = settings.unlockAll;
  const b = prog.best, rows = SIM.TRACKS.filter(t => b[t.id]).map(t => `<span>🏆 ${t.name}: <b>${b[t.id]}</b></span>`);
  $('#bests').innerHTML = (prog.stars ? `<span>⭐ ${prog.stars} stars</span>` : '') + rows.join('');
}
function toggleNames(open) { const box = $('#names'), b = $('#bName'); open = open == null ? box.classList.contains('hidden') : open; box.classList.toggle('hidden', !open); b.setAttribute('aria-expanded', String(open)); }
$('#bName').onclick = () => { AU.unlock(); AU.play('tap'); toggleNames(); };
$('#oAssist').onchange = e => { settings.assist = e.target.checked; saveSettings(); };
$('#oMotion').onchange = e => { settings.reduced = e.target.checked; saveSettings(); applyReduced(); };
$('#oPro').onchange = e => { settings.pro = e.target.checked; saveSettings(); };
$('#oUnlock').onchange = e => { settings.unlockAll = e.target.checked; saveSettings(); };
function showTitle() { setMode('title'); show('title'); buildTitle(); AU.engineStop(); AU.musicStop(); if (!demo) newDemo(); }
$('#bPlay').onclick = () => { AU.unlock(); AU.play('tap'); showPick(); };

// pick
const unlocked = t => settings.unlockAll || prog.stars >= t.unlock;
function drawPreview(c, name, img) { const sp = img ? { img, w: img.width, h: img.height, ay: ART.get(name).ay } : ART.get(name), g = c.getContext('2d'); const w = c.width, h = c.height; g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(20,12,40,.22)'; g.beginPath(); g.ellipse(w / 2, h * 0.9, w * 0.36, h * 0.06, 0, 0, 7); g.fill();
  const sc = Math.min(w / sp.w, h / sp.h) * 0.94; g.drawImage(sp.img, (w - sp.w * sc) / 2, h * 0.92 - sp.h * sc * sp.ay, sp.w * sc, sp.h * sc); }
function buildPick() {
  const hb = $('#heroes'); hb.innerHTML = '';
  SIM.VEHICLE_ORDER.forEach(id => { const V = SIM.VEHICLES[id], b = document.createElement('button'); b.type = 'button'; b.className = 'hero' + (settings.vehicle === id ? ' sel' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.vehicle === id)); b.setAttribute('aria-label', V.name);
    const dots = n => [0, 1, 2].map(i => `<b class="pip${i < n ? ' on' : ''}"></b>`).join('');
    const Wp = SIM.WEAPONS[id];
    b.innerHTML = `<canvas class="pv" width="440" height="220"></canvas><span class="nm">${V.name}${V.runner ? '<span class="paw" aria-hidden="true">🐾</span>' : ''}</span><span class="stats"><span title="Speed" aria-label="Speed ${V.stats.speed} of 3">⚡${dots(V.stats.speed)}</span><span title="Smash" aria-label="Smash ${V.stats.smash} of 3">💥${dots(V.stats.smash)}</span><span title="Fly" aria-label="Fly ${V.stats.fly} of 3">🪽${dots(V.stats.fly)}</span></span><span class="wp"><canvas class="wpi" width="44" height="44" aria-hidden="true"></canvas><span>${Wp.name}</span></span><span class="sp">${V.specialName}</span>`;
    b.setAttribute('aria-label', `${V.name}, weapon ${Wp.name}`); { const ic = b.querySelector('.wpi'), sp = ART.get('proj.' + Wp.id); ic.getContext('2d').drawImage(sp.img, 0, 0, 44, 44); }
    drawPreview(b.querySelector('canvas'), 'veh.' + id + (V.fly === 'always' || V.fly === 'hover' ? '.fly' : '.drive'));
    if (id === 'pup') pupCard = b.querySelector('canvas');
    b.onclick = () => { settings.vehicle = id; saveSettings(); AU.horn(V.horn); $$('.hero').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('sel', 'cheer'); b.setAttribute('aria-checked', 'true');
      const c = b.querySelector('canvas'), rest = 'veh.' + id + (V.fly === 'always' || V.fly === 'hover' ? '.fly' : '.drive');
      clearTimeout(b._t); (b._seq || []).forEach(clearTimeout);
      if (V.special === 'chomp') { // Chomp Rex chomps on the picker: open, snap, open, snap...
        b._seq = [0, 1, 2, 3, 4, 5].map(i => setTimeout(() => { drawPreview(c, 'veh.' + id + (i % 2 ? '.drive' : '.special')); if (i % 2 === 0) AU.play('chomp', 0.9 + i * 0.08); }, 120 + i * 140));
        b._t = setTimeout(() => { b.classList.remove('cheer'); drawPreview(c, rest); }, 1000);
      } else if (V.special === 'comet') { // Comet 17 flares into her hot form: glow pulse + FWOOM
        b.classList.remove('glow'); void b.offsetWidth; b.classList.add('glow'); drawPreview(c, 'veh.' + id + '.special'); b._seq = [setTimeout(() => AU.play('fwoom'), 380)];
        b._t = setTimeout(() => { b.classList.remove('cheer', 'glow'); drawPreview(c, rest); }, 1000);
      } else if (V.runner) { // Ira: a happy zoomie spin and a bark
        b.classList.remove('zoom'); void b.offsetWidth; b.classList.add('zoom'); drawPreview(c, 'veh.' + id + '.spin'); b._seq = [setTimeout(() => AU.play('bark'), 420)];
        b._t = setTimeout(() => { b.classList.remove('cheer', 'zoom'); drawPreview(c, rest); }, 950);
      } else if (V.special === 'laser') { b.classList.remove('glow'); void b.offsetWidth; b.classList.add('glow'); drawPreview(c, 'veh.' + id + '.special'); b._seq = [setTimeout(() => AU.play('vwoom'), 380)];
        b._t = setTimeout(() => { b.classList.remove('cheer', 'glow'); drawPreview(c, rest); }, 1000);
      } else { pupHold = id === 'pup' ? 900 : pupHold; drawPreview(c, 'veh.' + id + '.celebrate'); b._t = setTimeout(() => { b.classList.remove('cheer'); drawPreview(c, rest); }, 900); }
      newDemo(); };
    hb.appendChild(b); });
  const tb = $('#tracks'); tb.innerHTML = '';
  SIM.TRACKS.forEach(T => { const open = unlocked(T), b = document.createElement('button'); b.type = 'button'; b.className = 'trk' + (settings.track === T.id ? ' sel' : '') + (open ? '' : ' locked'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.track === T.id)); b.setAttribute('aria-label', T.name + (open ? '' : ', locked'));
    b.innerHTML = `<canvas width="320" height="140"></canvas><span class="tn">${T.name}</span>${open ? '' : `<span class="lock">🔒 ⭐${T.unlock}</span>`}`;
    const g = b.querySelector('canvas').getContext('2d'); ART.layers(T.id).forEach(L => { if (!L.img) return; if (L.role === 'sky') g.drawImage(L.img, 0, 0, 320, 140); else if (L.role === 'far') g.drawImage(L.img, 0, 20, 320 * 1.2, 100); else if (L.role === 'mid') g.drawImage(L.img, 0, 40, 320 * 1.3, 80); else if (L.role === 'ground') g.drawImage(L.img, 0, 112, 320 * 1.4, 40); });
    b.onclick = () => { if (!open) { AU.play('nocharge'); b.animate && !reduced() && b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); return; }
      settings.track = T.id; saveSettings(); AU.play('tap'); $$('.trk').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('sel'); b.setAttribute('aria-checked', 'true'); newDemo(); };
    tb.appendChild(b); });
  if (!unlocked(SIM.TRACKS.find(t => t.id === settings.track))) settings.track = 'toyroom';
  $('#totStars').textContent = '⭐ ' + prog.stars;
}
function showPick() { setMode('pick'); show('pick'); buildPick(); }
/* Whirly Pup's ears flop while she waits on the picker (interim art only; real art keeps the gentle card bob). */
let pupCard = null, pupHold = 0, pupBuf = null;
function pupIdle(dt, t) { if (mode !== 'pick' || !pupCard || !pupCard.isConnected || !window.LeoProc.heroFrame) return;
  if (pupHold > 0) { pupHold -= dt * 1000; return; }
  if (ART.get('veh.pup.drive').real) return;
  if (!pupBuf) { pupBuf = document.createElement('canvas'); pupBuf.width = 512; pupBuf.height = 256; }
  const ear = reduced() ? 0 : Math.sin(t * 5) * 0.28 + Math.sin(t * 11) * 0.06;
  window.LeoProc.heroFrame(pupBuf, 'pup', 'drive', { ear }); drawPreview(pupCard, 'veh.pup.drive', pupBuf); }
$('#bPickBack').onclick = () => { AU.play('tap'); showTitle(); };
$('#bGo').onclick = () => { AU.unlock(); AU.play('tap'); showCube(); };
$('#bRaceNow').onclick = () => { AU.unlock(); AU.play('tap'); startRace(false); };

/* ---------------- cube warm-up ---------------- */
const ccv = $('#cubeCv'), cctx = ccv.getContext('2d');
let cW = 0, cH = 0, cDPR = 1;
function layoutCube() { const r = $('#cubeWrap').getBoundingClientRect(); cW = r.width; cH = r.height; cDPR = Math.min(2, devicePixelRatio || 1); ccv.width = Math.round(cW * cDPR); ccv.height = Math.round(cH * cDPR); placeArrows(); }
const ARW = { topLeft: '◀', topRight: '▶', midLeft: '◀', midRight: '▶', botLeft: '◀', botRight: '▶', leftUp: '▲', leftDown: '▼', midUp: '▲', midDown: '▼', rightUp: '▲', rightDown: '▼' };
function placeArrows() { if (!cubeState) return; const box = $('#arrows'); const L = CUBE.layout(cW, cH, cubeState.n === 3 ? 0.92 : 1, cubeState.n);
  const want = []; L.rows.forEach(r => { want.push([r.l, r.a[0] - 36, r.a[1]]); want.push([r.r, r.b[0] + 36, r.b[1]]); }); L.cols.forEach(c => { want.push([c.u, c.a[0], c.a[1] - 36]); want.push([c.d, c.b[0], c.b[1] + 36]); });
  if (box.childElementCount !== want.length) { box.innerHTML = ''; want.forEach(([m]) => { const b = document.createElement('button'); b.className = 'arr'; b.dataset.m = m; b.textContent = ARW[m]; b.setAttribute('aria-label', m.replace(/([A-Z])/g, ' $1').toLowerCase());
      b.addEventListener('pointerdown', e => { e.preventDefault(); cubeMove(b.dataset.m); }); box.appendChild(b); }); }
  [...box.children].forEach((b, i) => { const w = want[i]; b.dataset.m = w[0]; b.textContent = ARW[w[0]]; b.style.left = Math.max(30, Math.min(cW - 30, w[1])) + 'px'; b.style.top = Math.max(30, Math.min(cH - 30, w[2])) + 'px'; });
  $('#cube').classList.toggle('pro', cubeState.n === 3); }
function showCube() {
  setMode('cube'); show('cube'); const n = settings.pro ? 3 : 2, tw = n === 3 ? 20 : Math.min(3, 1 + prog.cubeSolves);
  cubeState = { n, pz: CUBE.newPuzzle(tw, null, n), anim: null, idle: 0, done: false, fw: [], wob: 0, t: 0, lastGood: 0 };
  $('#arrows').classList.remove('hinting'); $('#cubeWin').classList.add('hidden'); $('#bHelp').classList.add('hidden'); $('#cubeMoves').textContent = ''; $('#arrows').innerHTML = ''; $('#arrows').classList.remove('hidden');
  $('#cubeTip').textContent = n === 3 ? '3x3 Pro: make every side one colour!' : tw === 1 ? 'One twist to fix it! Tap an arrow.' : 'Make every side one colour!';
  requestAnimationFrame(layoutCube);
}
function cubeMove(m, help) {
  const C = cubeState; if (!C || C.done || C.anim) return; AU.unlock(); const mv = CUBE.MOVES[m]; if (!mv) return;
  const before = C.pz.sol.length, solvedNow = CUBE.play(C.pz, mv); if (C.pz.sol.length < before) C.lastGood = C.t; C.anim = { axis: mv.axis, layer: mv.layer, q: mv.q, t: 0, e: 0 }; C.idle = 0; AU.play('click'); C.wob = 1;
  $('#cubeMoves').textContent = C.pz.moves + (C.pz.moves === 1 ? ' move' : ' moves');
  if (!help && C.pz.moves >= 6) $('#bHelp').classList.remove('hidden');
  if (solvedNow) { C.done = true; setTimeout(cubeWin, 360); }
}
function cubeWin() { const C = cubeState; prog.cubeSolves++; saveProg(); AU.play('solve'); setTimeout(() => AU.play('firework'), 300); AU.say(settings.name ? 'You did it, ' + settings.name + '!' : 'You did it!');
  $('#cubeWinT').textContent = settings.name ? `You did it, ${settings.name}!` : 'You did it!'; $('#cubeWin').classList.remove('hidden'); $('#arrows').classList.add('hidden'); $('#bHelp').classList.add('hidden');
  for (let i = 0; i < (reduced() ? 2 : 6); i++) setTimeout(() => firework(), i * 280);
  clearTimeout(C.auto); C.auto = setTimeout(() => { if (mode === 'cube' && cubeState === C) startRace(true); }, 5000); }
function firework() { const C = cubeState; if (!C) return; const x = rand(cW * 0.2, cW * 0.8), y = rand(cH * 0.15, cH * 0.5), col = ['#ff4d6d', '#ffd23f', '#2ec4b6', '#4361ee', '#9b5cf0'][Math.random() * 5 | 0];
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, v = rand(120, 260); C.fw.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, col }); } AU.play('firework'); }
$('#bHelp').onclick = () => { const h = cubeState && CUBE.hint(cubeState.pz); if (h) cubeMove(h, true); };
$('#bSkip').onclick = () => { AU.unlock(); startRace(false); };
$('#bCubeGo').onclick = () => { clearTimeout(cubeState && cubeState.auto); startRace(true); };
$('#bCubeBack').onclick = () => { if (cubeState) clearTimeout(cubeState.auto); showPick(); };
// swipe on the cube
let csw = null;
ccv.addEventListener('pointerdown', e => { const r = ccv.getBoundingClientRect(); csw = { x: e.clientX - r.left, y: e.clientY - r.top }; });
ccv.addEventListener('pointerup', e => { if (!csw || !cubeState) return; const r = ccv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = x - csw.x, dy = y - csw.y; const s0 = csw; csw = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; const L = CUBE.layout(cW, cH, cubeState.n === 3 ? 0.92 : 1, cubeState.n);
  if (Math.abs(dx) > Math.abs(dy)) { let best = L.rows[0], bd = 1e9; L.rows.forEach(rw => { const d = Math.abs(rw.a[1] - s0.y); if (d < bd) { bd = d; best = rw; } }); cubeMove(dx > 0 ? best.r : best.l); }
  else { let best = L.cols[0], bd = 1e9; L.cols.forEach(c => { const d = Math.abs(c.b[0] - s0.x); if (d < bd) { bd = d; best = c; } }); cubeMove(dy < 0 ? best.u : best.d); } });
function renderCube(dt) {
  const C = cubeState; if (!C || !cW) return; C.t += dt; C.idle += dt;
  if (C.anim) { C.anim.t += dt / (reduced() ? 0.12 : 0.24); const t = Math.min(1, C.anim.t); C.anim.e = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 3) * 1 : 1; if (C.anim.t >= 1) C.anim = null; }
  C.wob = Math.max(0, C.wob - dt * 4);
  const g = cctx; g.setTransform(cDPR, 0, 0, cDPR, 0, 0); g.clearRect(0, 0, cW, cH);
  const sc = (C.n === 3 ? 0.92 : 1) * (1 + (reduced() ? 0 : Math.sin(C.wob * Math.PI) * 0.05)) * (C.done ? 1 + Math.sin(C.t * 5) * 0.04 : 1);
  CUBE.render(g, C.pz.cube, cW, cH, C.anim, { scale: sc });
  // hint glow after 5 s idle
  const h = !C.done && !C.anim && C.t - C.lastGood > 4 ? CUBE.hint(C.pz) : null; $$('.arr').forEach(b => b.classList.toggle('hint', b.dataset.m === h)); $('#arrows').classList.toggle('hinting', !!h);
  for (let i = C.fw.length - 1; i >= 0; i--) { const p = C.fw[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; if (p.t > 1.3) { C.fw.splice(i, 1); continue; }
    g.globalAlpha = 1 - p.t / 1.3; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill(); } g.globalAlpha = 1;
  if (C.done && !reduced() && Math.random() < dt * 1.2) firework();
}

/* ---------------- race ---------------- */
function startRace(fullBoost) {
  if (cubeState) clearTimeout(cubeState.auto); cubeState = null;
  const seed = QS.get('seed') ? +QS.get('seed') : (Date.now() & 0xffff);
  race = SIM.createRace({ vehicle: settings.vehicle, track: settings.track, seed, assist: settings.assist, fullBoost, reduced: settings.reduced });
  debris.length = parts.length = pops.length = rings.length = gulps.length = scorch.length = 0; hitFx.length = burns.length = toots.length = pellets.length = 0; hudScore = 0;
  race.hint = !prog.fired; input.fire = input.firePressed = false; press(bF, false); $('#controls').style.setProperty('--hero', race.weapon.col); // first race: FIRE glows + an arrow points at the first target hudStars = -1; camZ = 0; acc = 0; paused = false;
  setMode('race'); show('race'); $('#pause').classList.add('hidden'); $('#bMute').textContent = AU.muted ? '🔇' : '🔊';
  AU.unlock(); if (!race.veh.runner) AU.engineStart(race.veh.horn); // Ira runs: footsteps, no engine AU.musicStart(race.track.music); AU.play('count'); setTimeout(() => mode === 'race' && AU.play('count'), 800); setTimeout(() => mode === 'race' && AU.play('count'), 1600);
  if (fullBoost) setTimeout(() => mode === 'race' && banner('⚡ FULL BOOST!'), 200);
  ART.preload(['veh.' + race.veh.id + '.drive', 'veh.' + race.veh.id + '.fly', 'veh.' + race.veh.id + '.boost', 'veh.' + race.veh.id + '.celebrate', 'proj.' + race.weapon.id].concat(race.veh.runner ? ['veh.ira.runb', 'veh.ira.spin', 'fx.toot', 'fx.pellet'] : []));
}
function setPause(p) { if (mode !== 'race') return; paused = p; $('#pause').classList.toggle('hidden', !p); $('#pAssist').checked = settings.assist; $('#pMotion').checked = settings.reduced; jumpUp(); fireUp(); if (p) { AU.engineSet(0, false); setTimeout(() => $('#bResume').focus(), 30); } }
$('#bPause').onclick = () => setPause(true);
$('#bResume').onclick = () => setPause(false);
$('#pAssist').onchange = e => { settings.assist = e.target.checked; if (race) race.assist = settings.assist; saveSettings(); };
$('#pMotion').onchange = e => { settings.reduced = e.target.checked; if (race) race.reduced = settings.reduced; saveSettings(); applyReduced(); };
$('#bQuit').onclick = () => { paused = false; $('#pause').classList.add('hidden'); showTitle(); };

/* ---------------- party ---------------- */
let lastSummary = null, submitted = false;
function showParty() {
  const S = SIM.summary(race); lastSummary = S; submitted = false; setMode('party'); show('party'); AU.engineStop(); AU.musicStop();
  const newBest = S.score > (prog.best[S.track] || 0); if (newBest) prog.best[S.track] = S.score; prog.stars += S.award; prog.races++; saveProg();
  $('#pMedal').textContent = ['🥇', '🥈', '🥉'][S.place - 1] || '🏅';
  $('#pTitle').textContent = settings.name ? `You did it, ${settings.name}!` : 'You did it!';
  $('#pBreak').innerHTML = `<li><span>💥 Smash points</span><b>${S.smashPts}</b></li><li><span>⭐ Stars ${S.stars} × 20</span><b>${S.starPts}</b></li><li class="sharp"><span>🎯 Sharp Shots ${S.shots} × 25</span><b>${S.shotPts}</b></li>${S.shots >= 10 ? '<li class="sharp-medal"><span>🏅 Sharp Shooter!</span><b></b></li>' : ''}<li><span>🏁 ${['1st', '2nd', '3rd'][S.place - 1]} place</span><b>${S.placeBonus}</b></li><li><span>🔨 ${S.smashes} smashes · best combo x${S.bestMult}</span><b></b></li><li class="tot"><span>Total</span><b>${S.score}</b></li>`;
  $('#pBest').textContent = newBest ? '🏆 New best on ' + race.track.name + '!' : 'Best on ' + race.track.name + ': ' + prog.best[S.track];
  const st = $$('#pAward .st'); st.forEach(s => s.classList.remove('on'));
  st.forEach((s, i) => { if (i < S.award) setTimeout(() => { s.classList.add('on'); AU.play('star'); }, 450 + i * 420); });
  AU.say(settings.name ? 'You did it, ' + settings.name + '!' : 'You did it!');
  const R = window.LEORANK; $('#bSubmit').classList.toggle('hidden', !(R && R.allowed())); $('#bSubmit').disabled = false; $('#bSubmit').classList.remove('holding'); $('#pRank').textContent = '';
  confetti(reduced() ? 40 : 140, race.p.x + 300, 1, 200);
  setTimeout(() => $('#bAgain').focus(), 60);
}
$('#bAgain').onclick = () => { AU.unlock(); AU.play('tap'); showCube(); };
$('#bNewHero').onclick = () => { AU.play('tap'); showPick(); };
function submitScore() { const R = window.LEORANK; if (!R || !lastSummary || submitted) return; submitted = true; $('#bSubmit').disabled = true; $('#pRank').textContent = 'Putting you on the world board…';
  const S = lastSummary; R.submit({ playerName: settings.name || 'Racer', score: S.score, track: S.track, vehicle: S.vehicle, place: S.place, stars: S.stars, award: S.award })
    .then(r => { $('#pRank').textContent = `🌍 You are #${r.rank} in the world!`; }, () => { submitted = false; $('#bSubmit').disabled = false; $('#pRank').textContent = 'The world board is busy right now. Try again later.'; }); }
// hold-to-confirm (1.5 s) so a tapping child never posts by accident
const bS = $('#bSubmit'); let holdT = 0;
const holdStart = e => { if (e) e.preventDefault(); if (submitted || bS.disabled) return; bS.classList.add('holding'); $('#pRank').textContent = 'Keep holding…'; clearTimeout(holdT); holdT = setTimeout(() => { bS.classList.remove('holding'); submitScore(); }, 1500); };
const holdEnd = () => { if (!bS.classList.contains('holding')) return; bS.classList.remove('holding'); clearTimeout(holdT); if (!submitted) $('#pRank').textContent = 'Hold the button to put your score on the world board.'; };
bS.addEventListener('pointerdown', holdStart); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => bS.addEventListener(n, holdEnd));
bS.addEventListener('keydown', e => { if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) holdStart(e); }); bS.addEventListener('keyup', e => { if (e.code === 'Enter' || e.code === 'Space') holdEnd(); });
bS.addEventListener('click', e => e.preventDefault()); bS.addEventListener('contextmenu', e => e.preventDefault());
async function openBoard() { const m = $('#rankModal'), L = $('#rkList'), me = $('#rkMe'); m.classList.remove('hidden'); me.textContent = ''; const R = window.LEORANK;
  if (!R || !R.allowed()) { L.innerHTML = '<p class="rkmsg">The world board works on whatthe.ai.</p>'; return; }
  L.innerHTML = '<p class="rkmsg">Loading…</p>';
  try { const rows = await R.top(), mine = R.mine(); if (!rows.length) { L.innerHTML = '<p class="rkmsg">No scores yet. Be the first!</p>'; return; }
    const tn = id => (SIM.TRACKS.find(t => t.id === id) || {}).name || '', vn = id => (SIM.VEHICLES[id] || {}).name || '';
    L.innerHTML = rows.map((r, i) => `<div class="rkrow${mine.includes(r.id) ? ' me' : ''}"><span class="rn">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="nm">${esc(r.playerName)}<small>${esc(vn(r.vehicle))} · ${esc(tn(r.track))}</small></span><b>${r.score}</b></div>`).join('');
  } catch (e) { L.innerHTML = '<p class="rkmsg">Could not load the world board. Check your connection.</p>'; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
$('#bBoard').onclick = openBoard; $('#rkClose').onclick = () => $('#rankModal').classList.add('hidden');
$('#rankModal').addEventListener('click', e => { if (e.target.id === 'rankModal') $('#rankModal').classList.add('hidden'); });

/* ---------------- boot ---------------- */
mq.addEventListener && mq.addEventListener('change', e => { if (e.matches) { settings.reduced = true; applyReduced(); } });
applyReduced(); resize(); ART.decorate(); ART.onChange(() => { if (mode === 'pick') buildPick(); });
showTitle(); requestAnimationFrame(frame);
// test hooks (used by the screenshot/QA scripts; harmless for players)
window.LEOGAME = { flyCheck() { const R = race; if (!R) return null; const P = R.p, sp = ART.get(vehSprite(R)), k = kL(P.laneF), w = raceWu(R, vehSprite(R)) * view.s * k, h = w * sp.h / sp.w;
    const yA = laneY(P.laneF) - P.z * view.s * k, limit = (hudBottom || 70) + H * 0.12; return { z: Math.round(P.z), maxZ: Math.round(R.maxZ || 0), spriteTop: Math.round(yA - h * sp.ay), limit: Math.round(limit), hudBottom: Math.round(hudBottom), H, camZ: Math.round(camZ), roadY: Math.round(laneY(1)) }; },
  submitScore, fireDown, fireUp, get view() { return view; }, get mode() { return mode; }, get race() { return race; }, settings, prog, startRace, showCube, showPick, showTitle, showParty, cubeMove, get cube() { return cubeState; }, input, setPause };
if (QS.get('screen') === 'pick') showPick();
})();
