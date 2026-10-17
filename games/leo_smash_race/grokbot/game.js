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
  const lane = 80, btn = portrait ? Math.round(Math.max(96, Math.min(140, (VW - lane - 16 * 2 - 28) / 2))) : (VH <= 520 ? 104 : 128);
  const gut = btn + 24, strip = Math.round(Math.max(btn + 40, lane * 2 + 16 + 36, VH * 0.4));
  const ctl = $('#controls'); ctl.style.setProperty('--btn', btn + 'px'); ctl.style.setProperty('--gut', gut + 'px'); ctl.style.setProperty('--strip', strip + 'px'); ctl.style.setProperty('--lane', lane + 'px');
  document.documentElement.style.setProperty('--gut', gut + 'px');
  let L = 0, CW = VW, CH = VH;
  if (racing) { if (portrait) CH = VH - strip; else { L = gut; CW = VW - gut * 2; } }
  cv.style.left = L + 'px'; cv.style.top = '0px'; cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
  W = CW; H = CH; DPR = Math.min(window.devicePixelRatio || 1, 2);
  if (W * H * DPR * DPR > 3.2e6) DPR = Math.max(1, Math.sqrt(3.2e6 / (W * H)));
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const s = portrait ? Math.min(W / 600, H / 640) : Math.min(W / 720, H / 560);
  const frontH = Math.min(H * 0.13, 130 * s), hasFront = (ART.layers(settings.track) || []).some(l => l.role === 'front');
  const groundY = H - LANE_GAP * s * 1.25 - Math.max(10, H * 0.03) - (racing && hasFront ? frontH * 0.45 : 0);
  view = { s, portrait, groundY, anchorX: W * 0.3, frontH };
  if (mode === 'cube') layoutCube();
}
addEventListener('resize', resize);

/* ---------------- state ---------------- */
let mode = 'title', race = null, demo = null, paused = false, acc = 0, lastT = 0, camZ = 0, shake = 0, flash = 0, hudScore = 0;
const debris = [], parts = [], pops = [], rings = [];
const input = { jump: false, jumpPressed: false, boostPressed: false, lane: 0 };
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
  if (opts && (opts.rot || opts.sq)) { ctx.save(); ctx.translate(sx, sy); if (opts.rot) ctx.rotate(opts.rot); if (opts.sq) ctx.scale(1 + opts.sq, 1 - opts.sq); if (opts.alpha != null) ctx.globalAlpha = opts.alpha; ctx.drawImage(sp.img, -w * sp.ax, -h * sp.ay, w, h); ctx.restore(); }
  else { if (opts && opts.alpha != null) { ctx.globalAlpha = opts.alpha; } ctx.drawImage(sp.img, sx - w * sp.ax, sy - h * sp.ay, w, h); ctx.globalAlpha = 1; }
}
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
  if (P.boostT > 0) return 'veh.' + V.id + '.boost';
  if (V.fly === 'always' || V.fly === 'hover' || P.z > floor + 25 || P.wing > 0.5) return 'veh.' + V.id + '.fly';
  return 'veh.' + V.id + '.drive'; }
// shadow widths matched to the visible footprint of Muse's art (v1); the interim art uses the hitbox length
const SHADOW_W = { dragster: 215, bibi: 125, truck: 195, sword: 185, jet: 150 };
function drawPlayer(R, t) {
  const P = R.p, V = R.veh, sp = vehSprite(R);
  shadow(P.x, P.laneF, P.z, (ART.get(sp).real && SHADOW_W[V.id]) || V.len * 1.05, 0.32);
  let rot = 0, sq = 0;
  if (V.fly === 'wings' || V.fly === 'bounce') rot = Math.max(-0.3, Math.min(0.3, -P.vz / 2400)) * (P.onGround ? 0 : 1);
  if (V.fly === 'always' || V.fly === 'hover') rot = Math.max(-0.15, Math.min(0.15, -P.vz / 3000)) + Math.sin(t * 3) * 0.03;
  if (P.onGround && V.fly !== 'always') { rot += Math.sin(t * 30) * 0.004 * P.speed / V.speed; }
  if (R.p.superT > 0 && V.special === 'spin') rot = (t * 14) % (Math.PI * 2);
  if (R.landT > 0) sq = R.landT * 0.4;
  let bob = P.onGround && V.fly !== 'always' && V.fly !== 'hover' ? Math.abs(Math.sin(t * 18)) * 2 : 0;
  if (R.finished) { bob += Math.abs(Math.sin(t * 6)) * 28; rot += Math.sin(t * 6) * 0.08; } // celebrate bounce (works with any art)
  // specials behind/around
  if (P.superT > 0) drawSpecial(R, t, true);
  drawSprite(sp, P.x, P.laneF, P.z + bob, { rot: rot || 0.0001, sq });
  if (P.boostT > 0 && !ownBoostArt(V.id)) boostFlame(R, sp, P.z + bob, rot, t);
  if (P.superT > 0) drawSpecial(R, t, false);
  if (P.boostT > 0 && !reduced()) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = laneY(P.laneF) - (P.z + 10 + i * 14) * view.s, x = X(P.x) - V.len * 0.6 * view.s - ((t * 900 + i * 137) % 220); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 60, y); ctx.stroke(); } }
}
// true only when the boost pose has its own file (not an alias, and not the drive/fly file reused under the boost name)
function ownBoostArt(id) { const S = ART.manifest.sprites, n = 'veh.' + id + '.', b = S[ART.resolve(n + 'boost')]; if (!b || !b.src) return false;
  return ![n + 'drive', n + 'fly'].some(k => S[k] && S[k].src === b.src); }
function boostFlame(R, name, z, rot, t) {
  const P = R.p, sp = ART.get(name), k = kL(P.laneF), w = sp.wu * view.s * k, h = w * sp.h / sp.w, ex = ART.fx(name).exhaust || [0.08, 0.6];
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
  if ((V.special === 'pound' || V.special === 'toss') && back) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.2; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y, V.len * 0.75 * s, V.h * 0.9 * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
}
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
  for (let i = 0; i < n && debris.length < CAP(); i++) debris.push({ spr: vars[Math.random() * vars.length | 0], x: o.x + rand(-o.w * 0.4, o.w * 0.4), lane: o.lane + rand(-0.25, 0.25), z: o.z + rand(0.1, 0.9) * o.h, vx: sp * 0.5 + rand(-200, 600), vz: rand(250, 900), r: rand(0, 6), vr: rand(-12, 12), life: rand(1.1, 1.8), t: 0, sz: rand(0.7, 1.3) });
  const pc = reduced() ? 4 : 10;
  for (let i = 0; i < pc && parts.length < 500; i++) parts.push({ kind: 'dust', x: o.x, lane: o.lane, z: o.z + o.h * 0.4, vx: rand(-200, 300), vz: rand(-50, 250), life: rand(0.4, 0.8), t: 0, r: rand(10, 24), c: K.sky ? '255,255,255' : '230,220,200' });
  for (let i = 0; i < pc && parts.length < 500; i++) parts.push({ kind: 'spark', x: o.x, lane: o.lane, z: o.z + o.h * 0.5, vx: rand(-600, 900), vz: rand(-400, 800), life: rand(0.25, 0.5), t: 0, r: rand(3, 6), c: ['255,210,63', '255,255,255', '255,120,80'][i % 3] });
}
function topple(o, R) { debris.push({ spr: objSprite(o), x: o.x, lane: o.lane, z: o.z, vx: (R ? R.p.speed : 400) * 0.6 + rand(100, 400), vz: rand(200, 600), r: 0, vr: rand(-5, 5), life: 2, t: 0, sz: 1, whole: o, burstOnLand: true }); }
function confetti(n, x, lane, z) { for (let i = 0; i < n && parts.length < 600; i++) parts.push({ kind: 'conf', x: x + rand(-200, 200), lane: lane + rand(-0.5, 0.5), z: z + rand(0, 200), vx: rand(-300, 300), vz: rand(200, 900), life: rand(1.5, 2.6), t: 0, r: rand(5, 9), rot: rand(0, 6), c: ['#ff4d6d', '#ffd23f', '#2ec4b6', '#4361ee', '#9b5cf0', '#ff9f1c'][i % 6] }); }
function popText(text, x, lane, z, col, big) { if (pops.length > 24) pops.shift(); pops.push({ text, x, lane, z, t: 0, col: col || '#fff', big: !!big }); }
function updateFx(dt, R) {
  for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.t += dt; d.vz -= 1900 * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.r += d.vr * dt;
    if (d.z < 0) { d.z = 0; if (d.burstOnLand) { burst(d.whole, R); debris.splice(i, 1); continue; } d.vz = -d.vz * 0.38; d.vx *= 0.7; d.vr *= 0.6; }
    if (d.t > d.life) debris.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= (p.kind === 'conf' ? 500 : p.kind === 'dust' ? 0 : 1400) * dt; if (p.kind === 'conf') { p.vx *= 0.99; p.rot += dt * 6; if (p.vz < -160) p.vz = -160; } if (p.t > p.life) parts.splice(i, 1); }
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.1) pops.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.7) rings.splice(i, 1); }
}
function drawFx() {
  for (const d of debris) { const a = Math.min(1, (d.life - d.t) / 0.4); drawSprite(d.spr, d.x, d.lane, d.z, { rot: d.r || 0.0001, alpha: a, wu: d.wu || ART.get(d.spr).wu * d.sz }); }
  ctx.globalAlpha = 1;
  for (const p of parts) { const a = Math.max(0, 1 - p.t / p.life), x = X(p.x), y = laneY(p.lane) - p.z * view.s;
    if (p.kind === 'dust') { ctx.fillStyle = `rgba(${p.c},${a * 0.6})`; ctx.beginPath(); ctx.arc(x, y, p.r * view.s * (1 + p.t * 2), 0, 7); ctx.fill(); }
    else if (p.kind === 'spark') { ctx.strokeStyle = `rgba(${p.c},${a})`; ctx.lineWidth = p.r * view.s * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03 * view.s, y + p.vz * 0.03 * view.s); ctx.stroke(); }
    else { ctx.save(); ctx.globalAlpha = Math.min(1, a * 2); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r * view.s, -p.r * 0.5 * view.s, p.r * 2 * view.s, p.r * view.s); ctx.restore(); } }
  for (const r of rings) { const k = r.t / 0.7; ctx.strokeStyle = `rgba(255,230,120,${1 - k})`; ctx.lineWidth = 12 * (1 - k) + 2; ctx.beginPath(); ctx.ellipse(X(r.x), laneY(1), r.r * k * view.s, r.r * k * 0.25 * view.s, 0, 0, 7); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const p of pops) { const k = Math.min(1, p.t * 6), a = Math.min(1, (1.1 - p.t) * 3), x = X(p.x), y = laneY(p.lane) - (p.z + p.t * 120) * view.s;
    const fs = Math.round((p.big ? 46 : 30) * Math.max(0.75, view.s) * (0.6 + 0.4 * k + (p.big ? Math.sin(p.t * 20) * 0.04 : 0)));
    ctx.font = `700 ${fs}px Fredoka, "Baloo 2", system-ui, sans-serif`; ctx.globalAlpha = a; ctx.lineWidth = fs * 0.18; ctx.strokeStyle = '#1d1a2e'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y); ctx.globalAlpha = 1; }
}

/* ---------------- frame render ---------------- */
function render(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const R = scene(); if (!R) { ctx.fillStyle = '#7cc8ff'; ctx.fillRect(0, 0, W, H); return; }
  drawWorldBack(R);
  const objs = R.tr.objs, cx = camX(), x0 = cx - view.anchorX / view.s - 300, x1 = cx + (W - view.anchorX) / view.s + 300;
  // painter order: back lane to front lane; within a lane, ground pieces bottom-up
  for (let lane = 0; lane < 3; lane++) {
    for (let i = Math.max(0, R.idx - 40); i < objs.length; i++) { const o = objs[i]; if (o.x > x1) break; if (o.x < x0 || !o.alive) continue; if (Math.round(o.lane) === lane) drawObj(o, t); }
    for (const rv of R.rivals) if (Math.round(rv.laneF) === lane && rv.x > x0 && rv.x < x1) drawRival(rv, t);
    if (Math.round(R.p.laneF) === lane) drawPlayer(R, t);
  }
  for (const s of R.shots) if (s.live) drawSprite('item.shot', s.x, s.lane, s.z, { rot: t * 10 });
  drawFx();
  for (const L of ART.layers(R.track.id)) if (L.role === 'front' && L.img) { const h = view.frontH; drawLayer(L, H - h + camZ * view.s, h, L.par, camX()); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (mode === 'title' || mode === 'pick' || mode === 'cube') { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- events -> juice ---------------- */
function handleEvents(R, live) {
  for (const e of R.events) {
    if (e.type === 'smash') { if (e.chain) topple(e.o, R); else burst(e.o, R, e.how);
      if (!live) continue;
      if (e.first) { AU.play(e.snd, 1 + Math.random() * 0.3); popText('+' + e.pts, e.o.x, e.o.lane, e.o.z + e.o.h + 20, e.mult >= 2 ? '#ffd23f' : '#fff', e.pts >= 300);
        shake = Math.max(shake, reduced() ? 0 : (e.big ? 14 : e.pts >= 100 ? 6 : 3)); bumpScore(); if (e.big) { flash = reduced() ? 0.2 : 0.7; banner(['MEGA SMASH!', 'KABOOM!', 'SUPER!'][Math.random() * 3 | 0]); AU.say('Super!'); } } }
    else if (!live) continue;
    else if (e.type === 'star') { AU.play('star'); if (e.o) { for (let i = 0; i < 5 && parts.length < 500; i++) parts.push({ kind: 'spark', x: e.o.x, lane: e.o.lane, z: e.o.z + 26, vx: rand(-300, 300), vz: rand(-300, 300), life: 0.35, t: 0, r: 4, c: '255,220,80' }); } }
    else if (e.type === 'combo') { comboShow(e.mult); AU.play('combo', e.mult); if (e.mult === 5) AU.say('Smash!'); }
    else if (e.type === 'jump') AU.play('jump');
    else if (e.type === 'land') { AU.play('land'); R.landT = Math.min(0.35, e.v / 3000); for (let i = 0; i < 6 && parts.length < 500; i++) parts.push({ kind: 'dust', x: R.p.x + rand(-60, 60), lane: R.p.laneF, z: 0, vx: rand(-200, 200), vz: rand(20, 120), life: 0.5, t: 0, r: rand(10, 20), c: '230,220,200' }); }
    else if (e.type === 'ramp') { AU.play('ramp'); popText('WHEEE!', R.p.x, R.p.laneF, 200, '#8de8ff'); }
    else if (e.type === 'boost') { AU.play('boost'); banner('BOOST!'); }
    else if (e.type === 'super') { AU.play('super'); banner(R.veh.specialName + '!'); AU.say(R.veh.specialName + '!'); flash = reduced() ? 0.15 : 0.5; }
    else if (e.type === 'nocharge') AU.play('nocharge');
    else if (e.type === 'pound') { AU.play('pound'); rings.push({ x: R.p.x, r: 1400, t: 0 }); shake = reduced() ? 0 : 18; }
    else if (e.type === 'toss') AU.play('tap');
    else if (e.type === 'go') { AU.play('count', true); countdown('GO!'); AU.say('Go!'); }
    else if (e.type === 'finish') { AU.play('fanfare'); AU.play('cheer'); banner('FINISH!'); confetti(reduced() ? 40 : 120, R.p.x + 200, 1, 100); setTimeout(() => { if (race === R && mode === 'race') showParty(); }, 2300); }
  }
  R.events.length = 0;
}
let bannerT = 0;
function banner(t) { const b = $('#banner'); b.textContent = t; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 1100); }
let comboT = 0;
function comboShow(m) { const c = $('#combo'); c.textContent = 'x' + m; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); clearTimeout(comboT); comboT = setTimeout(() => c.classList.remove('on'), 1200); }
function bumpScore() { const s = $('.hud-score'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
let cdLast = '';
function countdown(t) { const el = $('#countdown'); if (t === cdLast) return; cdLast = t; el.classList.remove('hidden'); el.innerHTML = '<span>' + t + '</span>'; if (t === 'GO!') setTimeout(() => { el.classList.add('hidden'); cdLast = ''; }, 700); }

/* ---------------- demo driver (title background) ---------------- */
function demoInput(R) { const P = R.p, i = { jump: false, jumpPressed: false, boostPressed: false, lane: 0 };
  for (let k = R.idx; k < R.tr.objs.length; k++) { const o = R.tr.objs[k], dx = o.x - P.x; if (dx > 500) break; if (dx > 60 && o.alive && o.z > 150 && Math.abs(o.lane - P.lane) < 0.5) { i.jump = true; break; } }
  if (R.boost >= 1) i.boostPressed = true; if (P.onGround && i.jump) i.jumpPressed = true; return i; }
function newDemo() { demo = SIM.createRace({ vehicle: settings.vehicle, track: settings.track, seed: 99, countdown: 0, assist: true }); demo.boost = 0.5; }

/* ---------------- main loop (fixed timestep) ---------------- */
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000; let dt = Math.min(0.1, lastT ? t - lastT : 0); lastT = t;
  if (mode === 'race' && !paused && race) {
    const ts2 = race.slow > 0 && !reduced() ? 0.35 : 1; acc += dt * ts2;
    while (acc >= SIM.STEP) { SIM.step(race, SIM.STEP, input); input.jumpPressed = false; input.boostPressed = false; input.lane = 0; acc -= SIM.STEP; handleEvents(race, true); }
    if (race.countdown > 0) countdown(String(Math.ceil(race.countdown / 0.8)));
    if (race.landT > 0) race.landT -= dt;
    updateFx(dt * ts2, race); updateHud(dt);
    AU.engineSet(race.p.speed / race.veh.speed, race.p.boostT > 0);
  } else if (mode === 'party' && race) { acc = 0; SIM.step(race, dt, { jump: false, jumpPressed: false, boostPressed: false, lane: 0 }); handleEvents(race, false); updateFx(dt, race); }
  else if (demo && (mode === 'title' || mode === 'pick' || mode === 'cube')) { acc += dt; while (acc >= SIM.STEP) { SIM.step(demo, SIM.STEP, demoInput(demo)); acc -= SIM.STEP; handleEvents(demo, false); } if (demo.finished) newDemo(); updateFx(dt, demo); }
  const R = scene(); if (R) { const room = (view.groundY - 150) / view.s; const target = Math.min(240, Math.max(0, R.p.z - room * 0.7)); camZ += (target - camZ) * Math.min(1, dt * 4); }
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 2.5);
  render(t);
  if (mode === 'cube') renderCube(dt);
}

/* ---------------- HUD ---------------- */
let hudStars = -1;
function updateHud(dt) { const R = race; hudScore += (R.score - hudScore) * Math.min(1, dt * 8); if (Math.abs(R.score - hudScore) < 1) hudScore = R.score;
  $('#hScore').textContent = Math.round(hudScore); if (hudStars !== R.stars) { hudStars = R.stars; $('#hStars').textContent = R.stars; }
  const L = R.tr.L, pct = x => Math.max(0, Math.min(100, x / L * 100)) + '%'; $('#prMe').style.left = pct(R.p.x); R.rivals.forEach((rv, i) => { $('#pr' + i).style.left = pct(rv.x); });
  $('#ringFg').style.strokeDashoffset = String(283 * (1 - R.boost)); $('#bBoost').classList.toggle('ready', R.boost >= 0.999);
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
[bJ, bB, $('#bUp'), $('#bDown')].forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));
// canvas: hold = fly, vertical swipe = lane
let sw = null;
cv.addEventListener('pointerdown', e => { if (mode !== 'race') return; sw = { y: e.clientY, x: e.clientX, id: e.pointerId, used: false }; jumpDown(); });
cv.addEventListener('pointermove', e => { if (!sw || sw.id !== e.pointerId || sw.used) return; const dy = e.clientY - sw.y; if (Math.abs(dy) > 45) { input.lane = dy > 0 ? 1 : -1; sw.used = true; } });
['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { sw = null; jumpUp(); }));
const KJ = ['Space', 'ArrowUp', 'KeyW'], KB = ['Enter', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyX', 'NumpadEnter'];
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (mode === 'race' && !paused) {
    if (KJ.includes(e.code)) { e.preventDefault(); if (!e.repeat) jumpDown(); }
    else if (KB.includes(e.code)) { e.preventDefault(); if (!e.repeat) { AU.unlock(); input.boostPressed = true; press(bB, true); setTimeout(() => press(bB, false), 120); } }
    else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); input.lane = -1; }
    else if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); input.lane = 1; }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); setPause(true); }
  } else if (mode === 'race' && paused && (e.code === 'KeyP' || e.code === 'Escape')) { e.preventDefault(); setPause(false); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape' && !$('#rankModal').classList.contains('hidden')) $('#rankModal').classList.add('hidden');
});
addEventListener('keyup', e => { if (KJ.includes(e.code)) jumpUp(); });
addEventListener('blur', () => { jumpUp(); if (mode === 'race' && race && !race.finished) setPause(true); });
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
function drawPreview(c, name) { const sp = ART.get(name), g = c.getContext('2d'); const w = c.width, h = c.height; g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(20,12,40,.22)'; g.beginPath(); g.ellipse(w / 2, h * 0.9, w * 0.36, h * 0.06, 0, 0, 7); g.fill();
  const sc = Math.min(w / sp.w, h / sp.h) * 0.94; g.drawImage(sp.img, (w - sp.w * sc) / 2, h * 0.92 - sp.h * sc * sp.ay, sp.w * sc, sp.h * sc); }
function buildPick() {
  const hb = $('#heroes'); hb.innerHTML = '';
  SIM.VEHICLE_ORDER.forEach(id => { const V = SIM.VEHICLES[id], b = document.createElement('button'); b.type = 'button'; b.className = 'hero' + (settings.vehicle === id ? ' sel' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.vehicle === id)); b.setAttribute('aria-label', V.name);
    const dots = n => [0, 1, 2].map(i => `<b class="pip${i < n ? ' on' : ''}"></b>`).join('');
    b.innerHTML = `<canvas width="440" height="220"></canvas><span class="nm">${V.name}</span><span class="stats"><span title="Speed" aria-label="Speed ${V.stats.speed} of 3">⚡${dots(V.stats.speed)}</span><span title="Smash" aria-label="Smash ${V.stats.smash} of 3">💥${dots(V.stats.smash)}</span><span title="Fly" aria-label="Fly ${V.stats.fly} of 3">🪽${dots(V.stats.fly)}</span></span><span class="sp">${V.specialName}</span>`;
    drawPreview(b.querySelector('canvas'), 'veh.' + id + (V.fly === 'always' || V.fly === 'hover' ? '.fly' : '.drive'));
    b.onclick = () => { settings.vehicle = id; saveSettings(); AU.horn(V.horn); $$('.hero').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('sel', 'cheer'); b.setAttribute('aria-checked', 'true');
      const c = b.querySelector('canvas'); drawPreview(c, 'veh.' + id + '.celebrate'); setTimeout(() => { b.classList.remove('cheer'); drawPreview(c, 'veh.' + id + (V.fly === 'always' || V.fly === 'hover' ? '.fly' : '.drive')); }, 900); newDemo(); };
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
  race = SIM.createRace({ vehicle: settings.vehicle, track: settings.track, seed, assist: settings.assist, fullBoost });
  debris.length = parts.length = pops.length = rings.length = 0; hudScore = 0; hudStars = -1; camZ = 0; acc = 0; paused = false;
  setMode('race'); show('race'); $('#pause').classList.add('hidden'); $('#bMute').textContent = AU.muted ? '🔇' : '🔊';
  AU.unlock(); AU.engineStart(race.veh.horn); AU.musicStart(race.track.music); AU.play('count'); setTimeout(() => mode === 'race' && AU.play('count'), 800); setTimeout(() => mode === 'race' && AU.play('count'), 1600);
  if (fullBoost) setTimeout(() => mode === 'race' && banner('⚡ FULL BOOST!'), 200);
  ART.preload(['veh.' + race.veh.id + '.drive', 'veh.' + race.veh.id + '.fly', 'veh.' + race.veh.id + '.boost', 'veh.' + race.veh.id + '.celebrate']);
}
function setPause(p) { if (mode !== 'race') return; paused = p; $('#pause').classList.toggle('hidden', !p); $('#pAssist').checked = settings.assist; $('#pMotion').checked = settings.reduced; jumpUp(); if (p) { AU.engineSet(0, false); setTimeout(() => $('#bResume').focus(), 30); } }
$('#bPause').onclick = () => setPause(true);
$('#bResume').onclick = () => setPause(false);
$('#pAssist').onchange = e => { settings.assist = e.target.checked; if (race) race.assist = settings.assist; saveSettings(); };
$('#pMotion').onchange = e => { settings.reduced = e.target.checked; saveSettings(); applyReduced(); };
$('#bQuit').onclick = () => { paused = false; $('#pause').classList.add('hidden'); showTitle(); };

/* ---------------- party ---------------- */
let lastSummary = null, submitted = false;
function showParty() {
  const S = SIM.summary(race); lastSummary = S; submitted = false; setMode('party'); show('party'); AU.engineStop(); AU.musicStop();
  const newBest = S.score > (prog.best[S.track] || 0); if (newBest) prog.best[S.track] = S.score; prog.stars += S.award; prog.races++; saveProg();
  $('#pMedal').textContent = ['🥇', '🥈', '🥉'][S.place - 1] || '🏅';
  $('#pTitle').textContent = settings.name ? `You did it, ${settings.name}!` : 'You did it!';
  $('#pBreak').innerHTML = `<li><span>💥 Smash points</span><b>${S.smashPts}</b></li><li><span>⭐ Stars ${S.stars} × 20</span><b>${S.starPts}</b></li><li><span>🏁 ${['1st', '2nd', '3rd'][S.place - 1]} place</span><b>${S.placeBonus}</b></li><li><span>🔨 ${S.smashes} smashes · best combo x${S.bestMult}</span><b></b></li><li class="tot"><span>Total</span><b>${S.score}</b></li>`;
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
window.LEOGAME = { submitScore, get mode() { return mode; }, get race() { return race; }, settings, prog, startRace, showCube, showPick, showTitle, showParty, cubeMove, get cube() { return cubeState; }, input, setPause };
if (QS.get('screen') === 'pick') showPick();
})();
