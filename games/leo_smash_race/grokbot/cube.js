/* Leo's Game — Cube Warm-up: a real 2x2 colour cube (logic + canvas renderer), rendered in code so it stays crisp.
   Moves are the 8 arrow moves a child can tap: top/bottom row left/right, left/right column up/down. */
(function (root) {
'use strict';
const FACES = [ // normal, colour, shape (shapes help colour-blind kids and pre-readers)
  { n: [0, 1, 0],  c: '#ffd23f', s: '★' }, { n: [0, -1, 0], c: '#f4f4f8', s: '●' },
  { n: [0, 0, 1],  c: '#ff4d6d', s: '♥' }, { n: [0, 0, -1], c: '#ff9f1c', s: '♦' },
  { n: [1, 0, 0],  c: '#2ec4b6', s: '▲' }, { n: [-1, 0, 0], c: '#4361ee', s: '■' },
];
const MOVES = { // axis, layer (+1/-1 side, 0 = middle on the 3x3), q (+1 = +90° right-hand)
  topRight: { axis: 1, layer: 1, q: 1 },  topLeft: { axis: 1, layer: 1, q: -1 },
  botRight: { axis: 1, layer: -1, q: 1 }, botLeft: { axis: 1, layer: -1, q: -1 },
  rightUp: { axis: 0, layer: 1, q: -1 },  rightDown: { axis: 0, layer: 1, q: 1 },
  leftUp: { axis: 0, layer: -1, q: -1 },  leftDown: { axis: 0, layer: -1, q: 1 },
  midRight: { axis: 1, layer: 0, q: 1 },  midLeft: { axis: 1, layer: 0, q: -1 },
  midUp: { axis: 0, layer: 0, q: -1 },    midDown: { axis: 0, layer: 0, q: 1 },
};
const movesFor = n => Object.keys(MOVES).filter(k => n === 3 || !k.startsWith('mid'));
const key = v => v.join(',');
function rot(v, axis, q) { const [x, y, z] = v;
  if (axis === 0) return [x, -z * q, y * q];
  if (axis === 1) return [z * q, y, -x * q];
  return [-y * q, x * q, z]; }
function solved(n) {
  n = n === 3 ? 3 : 2; const cs = n === 3 ? [-1, 0, 1] : [-1, 1], cubies = [];
  for (const x of cs) for (const y of cs) for (const z of cs) {
    if (n === 3 && !x && !y && !z) continue;
    const st = {}; FACES.forEach((f, i) => { if ((f.n[0] && f.n[0] === x) || (f.n[1] && f.n[1] === y) || (f.n[2] && f.n[2] === z)) st[key(f.n)] = i; });
    cubies.push({ p: [x, y, z], st }); }
  return { n, cubies };
}
function apply(cube, mv) {
  for (const c of cube.cubies) if (c.p[mv.axis] === mv.layer) {
    c.p = rot(c.p, mv.axis, mv.q); const st = {};
    for (const k in c.st) st[key(rot(k.split(',').map(Number), mv.axis, mv.q))] = c.st[k]; c.st = st; }
  return cube;
}
function isSolved(cube) {
  for (const f of FACES) { let col = -1; const k = key(f.n);
    for (const c of cube.cubies) if (c.st[k] != null) { if (col < 0) col = c.st[k]; else if (col !== c.st[k]) return false; } }
  return true;
}
const inv = m => ({ axis: m.axis, layer: m.layer, q: -m.q });
const same = (a, b) => a.axis === b.axis && a.layer === b.layer && a.q === b.q;
const nameOf = m => Object.keys(MOVES).find(k => same(MOVES[k], m));
/* A puzzle keeps a solution stack: the exact inverse of everything applied, so "Help!" is always a correct move. */
function newPuzzle(twists, rnd, n) {
  rnd = rnd || Math.random; n = n === 3 ? 3 : 2; const cube = solved(n); const sol = []; const names = movesFor(n); let last = null;
  for (let tries = 0; tries < 50; tries++) {
    cube.cubies = solved(n).cubies; sol.length = 0; last = null;
    for (let i = 0; i < twists; i++) { let m; do { m = MOVES[names[Math.floor(rnd() * names.length)]]; } while (last && (same(m, inv(last)) || (twists > 1 && m.axis === last.axis && m.layer !== last.layer && m.q === last.q)));
      apply(cube, m); sol.push(inv(m)); last = m; }
    if (!isSolved(cube)) break;
  }
  return { cube, sol, moves: 0, n };
}
function play(pz, mv) {
  apply(pz.cube, mv); pz.moves++;
  const top = pz.sol[pz.sol.length - 1];
  if (top && same(top, mv)) pz.sol.pop(); else pz.sol.push(inv(mv));
  // collapse three equal quarter turns into one inverse, so hints stay short
  const n = pz.sol.length; if (n >= 3 && same(pz.sol[n - 1], pz.sol[n - 2]) && same(pz.sol[n - 2], pz.sol[n - 3])) { const m = pz.sol[n - 1]; pz.sol.length = n - 3; pz.sol.push(inv(m)); }
  if (isSolved(pz.cube)) pz.sol.length = 0;
  return isSolved(pz.cube);
}
const hint = pz => { const m = pz.sol[pz.sol.length - 1]; return m ? nameOf(m) : null; };

/* ---------- renderer: orthographic 3D, painter-sorted quads, animated layer turns ---------- */
function rotA(v, axis, a) { const c = Math.cos(a), s = Math.sin(a), [x, y, z] = v;
  if (axis === 0) return [x, y * c - z * s, y * s + z * c];
  if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z]; }
const YAW = -0.52, PITCH = 0.42;
const view = v => rotA(rotA(v, 1, YAW), 0, PITCH);
function render(g, cube, W, H, anim, opts) {
  opts = opts || {}; const S = Math.min(W, H) * 0.27 * (opts.scale || 1), cx = W / 2, cy = H / 2 + S * 0.08;
  const quads = [];
  const U = cube.n === 3 ? 2 / 3 : 0.5, HF = cube.n === 3 ? 0.315 : 0.47;
  for (const c of cube.cubies) {
    const moving = anim && c.p[anim.axis] === anim.layer, ang = moving ? -anim.q * (Math.PI / 2) * (1 - anim.e) : 0;
    const T = v => { let w = v; if (moving) w = rotA(w, anim.axis, ang); return view(w); };
    for (const f of FACES) {
      const n = f.n, ax = n[0] ? 0 : n[1] ? 1 : 2, o = [0, 1, 2].filter(i => i !== ax), center = c.p.map((p, i) => p * U + n[i] * HF);
      const corner = (a, b) => { const v = center.slice(); v[o[0]] += a * HF; v[o[1]] += b * HF; return v; };
      const nn = T(n); if (nn[2] <= 0.02) continue;
      const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(T);
      const col = c.st[key(n)]; if (col == null && cube.n === 3 && !moving) continue;
      quads.push({ pts, z: pts.reduce((s, p) => s + p[2], 0) / 4, col, light: nn[2], up: nn[1] });
    }
  }
  quads.sort((a, b) => a.z - b.z);
  const P = p => [cx + p[0] * S, cy - p[1] * S];
  // soft floor shadow
  g.save(); g.fillStyle = 'rgba(30,20,60,.18)'; g.beginPath(); g.ellipse(cx, cy + S * 1.45, S * 1.35, S * 0.28, 0, 0, Math.PI * 2); g.fill(); g.restore();
  for (const q of quads) {
    const p = q.pts.map(P);
    g.beginPath(); p.forEach((v, i) => i ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1])); g.closePath();
    g.fillStyle = '#1f1b33'; g.fill(); g.lineJoin = 'round'; g.lineWidth = Math.max(2, S * 0.03); g.strokeStyle = '#1f1b33'; g.stroke();
    if (q.col == null) continue;
    const m = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2], ins = p.map(v => [m[0] + (v[0] - m[0]) * 0.84, m[1] + (v[1] - m[1]) * 0.84]);
    g.beginPath();
    for (let i = 0; i < 4; i++) { const a = ins[i], b = ins[(i + 1) % 4], pr = ins[(i + 3) % 4];
      const s0 = [a[0] + (pr[0] - a[0]) * 0.18, a[1] + (pr[1] - a[1]) * 0.18], s1 = [a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18];
      i ? g.lineTo(s0[0], s0[1]) : g.moveTo(s0[0], s0[1]); g.quadraticCurveTo(a[0], a[1], s1[0], s1[1]); }
    g.closePath();
    const F = FACES[q.col], shade = 0.72 + 0.28 * q.light + (q.up > 0.3 ? 0.06 : 0);
    const gr = g.createLinearGradient(ins[0][0], ins[0][1], ins[2][0], ins[2][1]);
    gr.addColorStop(0, mix(F.c, '#ffffff', 0.25 * shade)); gr.addColorStop(1, mix(F.c, '#000000', 0.3 * (1 - shade) + 0.08));
    g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(m[0] - S * 0.07, m[1] - S * 0.08, S * 0.12 * q.light, S * 0.05 * q.light, -0.5, 0, Math.PI * 2); g.fill();
    g.save(); g.globalAlpha = 0.35 + 0.55 * q.light; g.fillStyle = F.c === '#f4f4f8' || F.c === '#ffd23f' ? 'rgba(60,40,90,.75)' : 'rgba(255,255,255,.92)';
    g.font = `700 ${Math.round(S * (cube.n === 3 ? 0.2 : 0.3) * (0.6 + 0.4 * q.light))}px Fredoka, "Baloo 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(F.s, m[0], m[1] + S * 0.01); g.restore();
  }
  return { S, cx, cy };
}
/* Screen positions of the front face rows and columns (for placing arrow buttons). */
/* For each layer: [screen point for the "left/up" arrow, screen point for the "right/down" arrow]. */
function layout(W, H, scale, n) {
  const S = Math.min(W, H) * 0.27 * (scale || 1), cx = W / 2, cy = H / 2 + S * 0.08, P = v => { const p = view(v); return [cx + p[0] * S, cy - p[1] * S]; };
  const U = n === 3 ? 2 / 3 : 0.5, layers = n === 3 ? [1, 0, -1] : [1, -1], nm = { 1: 'top', 0: 'mid', '-1': 'bot' }, cn = { '-1': 'left', 0: 'mid', 1: 'right' };
  const rows = layers.map(l => ({ l: nm[l] + 'Left', r: nm[l] + 'Right', a: P([-1.08, l * U, 1]), b: P([1.5, l * U, 0.2]) }));
  const cols = layers.slice().reverse().map(l => ({ u: cn[l] + 'Up', d: cn[l] + 'Down', a: P([l * U, 1.5, 0.25]), b: P([l * U, -1.08, 1]) }));
  return { S, rows, cols, center: [cx, cy] };
}
function mix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${gg},${bl})`; }

const API = { FACES, MOVES, movesFor, solved, apply, isSolved, newPuzzle, play, hint, inv, render, layout };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LeoCube = API;
})(typeof window !== 'undefined' ? window : globalThis);
