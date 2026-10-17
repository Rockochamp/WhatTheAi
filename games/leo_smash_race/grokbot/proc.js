/* Leo's Game — INTERIM vector art, drawn in code at the manifest sizes. Every sprite here is replaced
   automatically when art/manifest.js gives it a src. Glossy toy look: thick outlines, gradients, highlights. */
(function (root) {
'use strict';
const OUT = '#1d1a2e';
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function lg(g, x0, y0, x1, y1, st) { const r = g.createLinearGradient(x0, y0, x1, y1); st.forEach(s => r.addColorStop(s[0], s[1])); return r; }
function rgr(g, x, y, r0, r1, st, ox, oy) { const r = g.createRadialGradient(x + (ox || 0), y + (oy || 0), r0, x, y, r1); st.forEach(s => r.addColorStop(s[0], s[1])); return r; }
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function poly(g, pts, smooth) { g.beginPath(); if (!smooth) { pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); return; }
  const n = pts.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let m = mid(pts[n - 1], pts[0]); g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mm = mid(p, q); g.quadraticCurveTo(p[0], p[1], mm[0], mm[1]); } g.closePath(); }
function ink(g, fill, w) { g.fillStyle = fill; g.fill(); g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = w || 6; g.strokeStyle = OUT; g.stroke(); }
function gloss(g, x, y, w, h, a) { g.save(); g.globalAlpha = a || 0.45; g.fillStyle = lg(g, 0, y, 0, y + h, [[0, '#fff'], [1, 'rgba(255,255,255,0)']]); rr(g, x, y, w, h, h / 2); g.fill(); g.restore(); }
function shade(hex, t) { const p = parseInt(hex.slice(1), 16); let r = (p >> 16) & 255, gg = (p >> 8) & 255, b = p & 255;
  if (t > 0) { r += (255 - r) * t; gg += (255 - gg) * t; b += (255 - b) * t; } else { r *= 1 + t; gg *= 1 + t; b *= 1 + t; }
  return `rgb(${r | 0},${gg | 0},${b | 0})`; }
function wheel(g, x, y, r, rim, opts) { opts = opts || {};
  const ty = opts.tyre || '#2a2736'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); ink(g, rgr(g, x, y, r * 0.2, r, [[0, shade(ty, 0.25)], [0.7, ty], [1, shade(ty, -0.45)]], -r * 0.2, -r * 0.3), 6);
  if (opts.chevron) { g.save(); g.strokeStyle = shade(ty, -0.5); g.lineWidth = r * 0.1; g.lineJoin = 'miter'; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, c1 = Math.cos(a), s1 = Math.sin(a), c2 = Math.cos(a + 0.18), s2 = Math.sin(a + 0.18); g.beginPath(); g.moveTo(x + c1 * r * 0.7, y + s1 * r * 0.7); g.lineTo(x + c2 * r * 0.88, y + s2 * r * 0.88); g.lineTo(x + c1 * r * 0.99, y + s1 * r * 0.99); g.stroke(); } g.restore(); }
  if (opts.tread) { g.save(); g.strokeStyle = '#0d0b16'; g.lineWidth = r * 0.12; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); g.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98); g.stroke(); } g.restore(); }
  const rr2 = r * (opts.rim || 0.52); g.beginPath(); g.arc(x, y, rr2, 0, Math.PI * 2); ink(g, rgr(g, x, y, 2, rr2, [[0, '#ffffff'], [0.35, shade(rim, 0.35)], [1, shade(rim, -0.25)]], -rr2 * 0.3, -rr2 * 0.3), 4);
  g.save(); g.strokeStyle = shade(rim, -0.45); g.lineWidth = Math.max(2, r * 0.06); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; g.beginPath(); g.moveTo(x + Math.cos(a) * rr2 * 0.3, y + Math.sin(a) * rr2 * 0.3); g.lineTo(x + Math.cos(a) * rr2 * 0.85, y + Math.sin(a) * rr2 * 0.85); g.stroke(); } g.restore();
  g.beginPath(); g.arc(x, y, rr2 * 0.25, 0, Math.PI * 2); ink(g, '#f2f2f6', 3);
  g.save(); g.globalAlpha = 0.25; g.strokeStyle = '#fff'; g.lineWidth = r * 0.1; g.beginPath(); g.arc(x, y, r * 0.88, Math.PI * 1.1, Math.PI * 1.5); g.stroke(); g.restore(); }
function flame(g, x, y, len, h, dir) { dir = dir || -1; // flame pointing left (dir -1) from (x,y)
  [[1, '#ff3d00'], [0.72, '#ff9800'], [0.45, '#ffe066'], [0.22, '#ffffff']].forEach(([s, c]) => { g.beginPath(); g.moveTo(x, y - h * s / 2);
    g.quadraticCurveTo(x + dir * len * s * 0.5, y - h * s * 0.7, x + dir * len * s, y); g.quadraticCurveTo(x + dir * len * s * 0.5, y + h * s * 0.7, x, y + h * s / 2); g.closePath(); g.fillStyle = c; g.fill(); }); }
function sparkle(g, x, y, r, c) { g.save(); g.fillStyle = c || '#fff8c4'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rad = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fill(); g.restore(); }
function starPath(g, x, y, r, ri) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); }
function rocketWing(g, x, y, s, col) { // pop-out rocket wings (flying pose)
  g.save(); g.translate(x, y); g.scale(s, s);
  poly(g, [[-70, 0], [60, -6], [10, 52], [-90, 58]], false); ink(g, lg(g, 0, -10, 0, 60, [[0, '#f4f6fb'], [0.5, '#b9c2d6'], [1, '#7c869e']]), 5);
  poly(g, [[-80, 40], [5, 40], [-6, 55], [-88, 56]]); g.fillStyle = col; g.fill();
  rr(g, -118, 20, 70, 26, 13); ink(g, lg(g, 0, 20, 0, 46, [[0, '#ffffff'], [1, '#8a93a8']]), 4);
  flame(g, -118, 33, 70, 26); g.restore(); }

/* ---------------- vehicles ---------------- */
function dragster(g, pose) {
  const W = 512; g.save();
  wheel(g, 150, 158, 64, '#9a9eab', { tyre: '#3f4252', rim: 0.48 }); wheel(g, 470, 206, 20, '#9a9eab', { tyre: '#3f4252' }); // far-side wheels (3/4 view)
  if (pose === 'celebrate') { g.translate(120, 236); g.rotate(-0.12); g.translate(-120, -236); }
  if (pose === 'boost') flame(g, 58, 150, 70, 50);
  // rear wing
  g.lineWidth = 6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(92, 150); g.lineTo(84, 62); g.moveTo(128, 150); g.lineTo(122, 62); g.stroke();
  g.strokeStyle = '#8f98ad'; g.lineWidth = 3; g.beginPath(); g.moveTo(92, 150); g.lineTo(84, 62); g.moveTo(128, 150); g.lineTo(122, 62); g.stroke();
  rr(g, 30, 34, 150, 30, 10); ink(g, lg(g, 0, 34, 0, 64, [[0, '#ff6f61'], [1, '#b3121b']]));
  rr(g, 24, 26, 16, 50, 6); ink(g, '#2a2736', 5); gloss(g, 44, 38, 120, 9, 0.5);
  // body
  poly(g, [[66, 154], [170, 140], [214, 116], [300, 114], [322, 142], [470, 176], [500, 190], [486, 206], [300, 210], [180, 204], [72, 198]]);
  ink(g, lg(g, 0, 112, 0, 212, [[0, '#ff7a6b'], [0.35, '#ef2b2d'], [0.8, '#b0101a'], [1, '#7a0a12']]));
  // flames decal
  g.save(); poly(g, [[66, 154], [170, 140], [214, 116], [300, 114], [322, 142], [470, 176], [500, 190], [486, 206], [300, 210], [180, 204], [72, 198]]); g.clip();
  for (let i = 0; i < 4; i++) { const y = 168 + i * 9; g.beginPath(); g.moveTo(490, 196); g.quadraticCurveTo(420 - i * 20, y - 30, 330 - i * 30, y - 6 - i * 4); g.quadraticCurveTo(370 - i * 20, y + 4, 330 - i * 26, y + 10); g.quadraticCurveTo(410, y + 20, 490, 200); g.closePath();
    g.fillStyle = ['#ffe03d', '#ffd000', '#ffe03d', '#ffc400'][i]; g.fill(); g.lineWidth = 3; g.strokeStyle = '#141220'; g.stroke(); }
  g.restore();
  gloss(g, 180, 124, 260, 14, 0.4);
  // engine blower + pipes
  rr(g, 170, 80, 56, 44, 10); ink(g, lg(g, 170, 0, 226, 0, [[0, '#eef1f7'], [0.5, '#a9b2c6'], [1, '#6f788f']]), 5);
  rr(g, 178, 62, 40, 22, 6); ink(g, '#2a2736', 5);
  for (let i = 0; i < 3; i++) { rr(g, 150 - i * 4, 112 + i * 9, 34, 9, 4); ink(g, '#c9cfdb', 3); }
  // cockpit
  g.beginPath(); g.ellipse(262, 116, 44, 28, 0, Math.PI, 0); ink(g, lg(g, 0, 88, 0, 118, [[0, '#9fe7ff'], [1, '#1f5f9e']]), 5);
  g.save(); g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(250, 102, 16, 6, -0.3, 0, Math.PI * 2); g.fill(); g.restore();
  // number 2
  g.beginPath(); g.arc(388, 182, 19, 0, Math.PI * 2); ink(g, '#fff', 4); g.fillStyle = OUT; g.font = '800 26px Fredoka, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', 388, 184);
  if (pose === 'fly') rocketWing(g, 260, 196, 0.95, '#ef2b2d');
  wheel(g, 122, 166, 70, '#b8bcc8', { tyre: '#55586a', rim: 0.48 });
  wheel(g, 452, 214, 22, '#b8bcc8', { tyre: '#55586a', rim: 0.6 });
  if (pose === 'celebrate') { sparkle(g, 330, 60, 18); sparkle(g, 420, 96, 12); sparkle(g, 250, 40, 10); }
  g.restore();
}
function bibi(g, pose) {
  g.save(); if (pose === 'celebrate') { g.translate(260, 236); g.rotate(-0.08); g.translate(-260, -236); }
  if (pose === 'boost') flame(g, 108, 168, 60, 34);
  const NAVY = '#22305e', MINT = '#7fe0c8', CREAM = '#f4ead2';
  const wh = (x, y, r) => wheel(g, x, y, r, MINT, { tyre: '#e9dcbc', rim: 0.62 });
  // far-side wheels (3/4 view, slightly up and back)
  wh(176, 198, 30); wh(402, 198, 30);
  const tube = (pts, w) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w + 10; g.strokeStyle = OUT; g.stroke(); g.lineWidth = w; g.strokeStyle = NAVY; g.stroke(); g.lineWidth = w * 0.25; g.strokeStyle = 'rgba(160,180,255,.45)'; g.stroke(); };
  tube([[156, 212], [200, 162], [342, 150], [366, 104]], 20); tube([[200, 162], [196, 212]], 14); tube([[342, 150], [398, 214]], 16); tube([[146, 212], [204, 212]], 12); tube([[380, 214], [420, 214]], 12);
  // flat board seat (mint)
  rr(g, 150, 136, 120, 22, 11); ink(g, lg(g, 0, 136, 0, 158, [[0, '#b5f3e3'], [1, '#3fbf9f']]), 5); gloss(g, 162, 139, 90, 6, 0.5);
  // handlebar with cream grips
  g.lineWidth = 12; g.strokeStyle = OUT; g.beginPath(); g.moveTo(366, 104); g.lineTo(354, 62); g.lineTo(322, 56); g.stroke(); g.lineWidth = 6; g.strokeStyle = NAVY; g.stroke();
  rr(g, 296, 46, 36, 20, 10); ink(g, CREAM, 4);
  // mustard bag with tiny white dots
  rr(g, 378, 94, 96, 70, 18); ink(g, lg(g, 0, 94, 0, 164, [[0, '#f0c24a'], [1, '#c7901a']]), 6);
  g.save(); rr(g, 378, 94, 96, 70, 18); g.clip(); g.fillStyle = 'rgba(255,255,255,.9)'; for (let y = 102; y < 164; y += 12) for (let x = 384 + ((y / 12) % 2) * 6; x < 474; x += 12) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } g.restore();
  rr(g, 374, 88, 104, 16, 8); ink(g, '#d9a52c', 5);
  g.lineWidth = 6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(392, 90); g.quadraticCurveTo(426, 60, 460, 90); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#d9a52c'; g.stroke();
  // cute face lights on the bag
  [[408, 128], [446, 128]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); ink(g, '#ffffff', 4); g.beginPath(); g.arc(x + 3, y + 1, 6, 0, Math.PI * 2); g.fillStyle = OUT; g.fill(); g.beginPath(); g.arc(x + 5, y - 2, 2.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); });
  g.beginPath(); g.arc(427, 142, 11, 0.2, Math.PI - 0.2); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = 'rgba(255,120,150,.6)'; g.beginPath(); g.arc(394, 146, 6, 0, 7); g.arc(460, 146, 6, 0, 7); g.fill();
  if (pose === 'fly') { [[210, 96], [246, 80]].forEach(([x, y], i) => { g.save(); g.translate(x, y); g.rotate(-0.5 - i * 0.2); g.beginPath(); g.ellipse(0, 0, 40, 16, 0, 0, Math.PI * 2); ink(g, 'rgba(255,255,255,.92)', 4); g.restore(); }); }
  // near-side wheels
  wh(156, 212, 32); wh(404, 212, 32);
  if (pose === 'celebrate') { sparkle(g, 300, 30, 16); sparkle(g, 480, 50, 12, '#ffe066'); }
  g.restore();
}
function truck(g, pose) {
  g.save(); if (pose === 'celebrate') { g.translate(140, 236); g.rotate(-0.1); g.translate(-140, -236); }
  if (pose === 'boost') { flame(g, 70, 120, 70, 38); flame(g, 70, 150, 50, 26); }
  wheel(g, 168, 170, 52, '#c9a72e', { tyre: '#4d5060', chevron: true, rim: 0.42 }); wheel(g, 408, 170, 52, '#c9a72e', { tyre: '#4d5060', chevron: true, rim: 0.42 });
  // suspension
  g.lineWidth = 10; g.strokeStyle = OUT; g.beginPath(); g.moveTo(140, 172); g.lineTo(190, 130); g.moveTo(380, 172); g.lineTo(330, 130); g.stroke();
  g.lineWidth = 5; g.strokeStyle = '#ffd23f'; g.stroke();
  // bat wing fins
  g.beginPath(); g.moveTo(150, 92); g.quadraticCurveTo(110, 40, 60, 30); g.quadraticCurveTo(84, 58, 70, 74); g.quadraticCurveTo(96, 70, 100, 88); g.quadraticCurveTo(122, 80, 130, 100); g.closePath();
  ink(g, lg(g, 60, 30, 150, 100, [[0, '#3b3550'], [1, '#121019']]), 5);
  // body
  poly(g, [[78, 92], [210, 86], [244, 46], [342, 44], [370, 86], [450, 92], [470, 112], [466, 138], [86, 140], [70, 120]]);
  ink(g, lg(g, 0, 44, 0, 140, [[0, '#55506a'], [0.25, '#2a2638'], [0.8, '#121019'], [1, '#07060b']]));
  gloss(g, 96, 96, 350, 10, 0.3); gloss(g, 252, 52, 80, 8, 0.35);
  // windows
  poly(g, [[256, 56], [334, 54], [354, 86], [244, 86]]); ink(g, lg(g, 0, 54, 0, 86, [[0, '#7fd0ff'], [1, '#22406b']]), 4);
  g.lineWidth = 5; g.strokeStyle = OUT; g.beginPath(); g.moveTo(298, 55); g.lineTo(298, 86); g.stroke();
  // bat emblem shape (generic) + stripe
  rr(g, 96, 112, 360, 8, 4); g.fillStyle = '#ffd23f'; g.fill();
  g.save(); g.translate(176, 104); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-14, -8, -8, -2); g.lineTo(-4, -8); g.lineTo(0, -3); g.lineTo(4, -8); g.lineTo(8, -2); g.quadraticCurveTo(14, -8, 26, 0); g.quadraticCurveTo(10, 2, 0, 9); g.quadraticCurveTo(-10, 2, -26, 0); g.fill(); g.restore();
  // headlights
  [[456, 104], [436, 102]].forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, 9 - i * 2, 0, 7); ink(g, rgr(g, x, y, 1, 10, [[0, '#ffffff'], [1, '#ffd23f']]), 3); });
  g.save(); g.globalAlpha = 0.25; g.fillStyle = '#ffe680'; g.beginPath(); g.moveTo(462, 98); g.lineTo(512, 84); g.lineTo(512, 126); g.closePath(); g.fill(); g.restore();
  if (pose === 'fly') rocketWing(g, 260, 140, 1.05, '#ffd23f');
  wheel(g, 140, 180, 56, '#ffd23f', { tyre: '#6b6e7d', chevron: true, rim: 0.42 }); wheel(g, 382, 180, 56, '#ffd23f', { tyre: '#6b6e7d', chevron: true, rim: 0.42 });
  if (pose === 'celebrate') { sparkle(g, 300, 20, 16); sparkle(g, 420, 40, 12); }
  g.restore();
}
function sword(g, pose) {
  g.save(); const cy = 128;
  if (pose === 'celebrate') { g.translate(256, 128); g.rotate(-0.35); g.translate(-256, -128); }
  if (pose === 'boost' || pose === 'fly') { g.save(); g.globalAlpha = pose === 'boost' ? 0.8 : 0.45; for (let i = 0; i < 4; i++) { g.fillStyle = ['#c4a3ff', '#8de8ff', '#fff3a8', '#ffffff'][i]; g.beginPath(); g.ellipse(80 - i * 12, cy, 70 - i * 10, 9 - i * 1.5, 0, 0, 7); g.fill(); } g.restore(); }
  // glow
  g.save(); g.shadowColor = pose === 'boost' ? '#b388ff' : '#8de8ff'; g.shadowBlur = pose === 'boost' ? 34 : 20;
  poly(g, [[206, cy - 17], [452, cy - 12], [500, cy], [452, cy + 12], [206, cy + 17]]); g.fillStyle = '#dff6ff'; g.fill(); g.restore();
  poly(g, [[206, cy - 17], [452, cy - 12], [500, cy], [452, cy + 12], [206, cy + 17]]); ink(g, lg(g, 0, cy - 17, 0, cy + 17, [[0, '#ffffff'], [0.45, '#cfe6f7'], [0.55, '#9db7d0'], [1, '#e6f3ff']]), 5);
  g.lineWidth = 4; g.strokeStyle = 'rgba(90,120,170,.6)'; g.beginPath(); g.moveTo(222, cy); g.lineTo(420, cy); g.stroke();
  // crossguard (winged, purple + gold)
  g.beginPath(); g.moveTo(196, cy); g.quadraticCurveTo(206, cy - 40, 236, cy - 78); g.quadraticCurveTo(214, cy - 30, 222, cy - 14); g.lineTo(222, cy + 14); g.quadraticCurveTo(214, cy + 30, 236, cy + 78); g.quadraticCurveTo(206, cy + 40, 196, cy); g.closePath();
  ink(g, lg(g, 196, 0, 236, 0, [[0, '#6a2fc0'], [1, '#9b5cf0']]), 5);
  rr(g, 186, cy - 30, 26, 60, 10); ink(g, lg(g, 0, cy - 30, 0, cy + 30, [[0, '#a874ff'], [0.5, '#6a2fc0'], [1, '#3d1680']]), 5);
  poly(g, [[199, cy - 13], [208, cy], [199, cy + 13], [190, cy]]); ink(g, lg(g, 0, cy - 13, 0, cy + 13, [[0, '#ffe680'], [1, '#e08a00']]), 3);
  // grip
  rr(g, 96, cy - 14, 92, 28, 10); ink(g, lg(g, 0, cy - 14, 0, cy + 14, [[0, '#4fd6c8'], [1, '#147a72']]), 5);
  g.save(); rr(g, 96, cy - 14, 92, 28, 10); g.clip(); g.strokeStyle = 'rgba(10,70,66,.55)'; g.lineWidth = 4; for (let x = 90; x < 200; x += 16) { g.beginPath(); g.moveTo(x, cy + 16); g.lineTo(x + 14, cy - 16); g.stroke(); } g.restore();
  // pommel
  g.beginPath(); g.arc(88, cy, 20, 0, 7); ink(g, rgr(g, 88, cy, 2, 20, [[0, '#c9a2ff'], [1, '#4a1d99']], -6, -6), 5);
  g.beginPath(); g.arc(88, cy, 7, 0, 7); ink(g, '#ffd23f', 3);
  sparkle(g, 470, cy - 14, 12); if (pose !== 'drive') { sparkle(g, 330, cy - 34, 10, '#fff3a8'); sparkle(g, 400, cy + 30, 8); }
  if (pose === 'celebrate') { sparkle(g, 500, 60, 18, '#fff3a8'); sparkle(g, 140, 40, 12); }
  g.restore();
}
function jet(g, pose) {
  g.save(); if (pose === 'celebrate') { g.translate(256, 180); g.rotate(-0.1); g.translate(-256, -180); }
  if (pose === 'boost') flame(g, 160, 182, 70, 30);
  // tail boom + fin
  poly(g, [[60, 118], [160, 132], [160, 162], [70, 146]]); ink(g, lg(g, 0, 118, 0, 160, [[0, '#ff6b6b'], [1, '#b51d2a']]), 5);
  poly(g, [[48, 70], [86, 70], [110, 128], [62, 132]]); ink(g, lg(g, 0, 70, 0, 130, [[0, '#ff6b6b'], [1, '#b51d2a']]), 5);
  rr(g, 52, 92, 40, 10, 5); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.arc(58, 132, 18, 0, 7); g.save(); g.globalAlpha = 0.45; g.fillStyle = '#d7dde8'; g.fill(); g.restore(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  // body
  g.beginPath(); g.ellipse(290, 160, 150, 56, 0, 0, Math.PI * 2); ink(g, lg(g, 0, 104, 0, 216, [[0, '#ff7b7b'], [0.4, '#ec2f3d'], [1, '#9e1424']]));
  g.save(); g.beginPath(); g.ellipse(290, 160, 150, 56, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = '#f7f8fc'; g.fillRect(130, 178, 330, 60); g.fillStyle = '#ffd23f'; g.fillRect(130, 172, 330, 8); g.restore();
  g.beginPath(); g.ellipse(290, 160, 150, 56, 0, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
  gloss(g, 190, 114, 190, 14, 0.45);
  // cockpit
  g.beginPath(); g.ellipse(392, 146, 50, 34, 0.2, -Math.PI * 0.95, Math.PI * 0.35); ink(g, lg(g, 0, 112, 0, 180, [[0, '#b6f0ff'], [1, '#1f5f9e']]), 5);
  g.save(); g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(380, 128, 16, 6, -0.4, 0, 7); g.fill(); g.restore();
  // wings + turbine
  poly(g, [[230, 180], [330, 176], [300, 214], [196, 222]]); ink(g, lg(g, 0, 176, 0, 222, [[0, '#ffffff'], [1, '#b9c2d6']]), 5);
  rr(g, 214, 196, 80, 26, 13); ink(g, lg(g, 0, 196, 0, 222, [[0, '#e5e9f2'], [1, '#7c869e']]), 4); g.beginPath(); g.arc(214, 209, 10, 0, 7); ink(g, '#2a2736', 3);
  // rotor
  rr(g, 280, 92, 16, 20, 4); ink(g, '#4a4658', 4);
  g.save(); g.globalAlpha = pose === 'drive' ? 0.85 : 0.5; g.beginPath(); g.ellipse(288, 88, 200, 12, 0, 0, 7); g.fillStyle = 'rgba(210,216,230,.75)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(29,26,46,.6)'; g.stroke(); g.restore();
  g.beginPath(); g.arc(288, 88, 9, 0, 7); ink(g, '#ffd23f', 3);
  // skids
  g.lineWidth = 7; g.strokeStyle = OUT; g.beginPath(); g.moveTo(220, 208); g.lineTo(212, 232); g.moveTo(350, 208); g.lineTo(358, 232); g.moveTo(180, 234); g.lineTo(400, 234); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#c9cfdb'; g.stroke();
  // friendly light
  g.beginPath(); g.arc(436, 176, 7, 0, 7); ink(g, '#ffe680', 3);
  if (pose === 'celebrate') { sparkle(g, 420, 50, 16); sparkle(g, 160, 60, 12); }
  g.restore();
}
function rival(g, col) {
  const D = shade(col, -0.35), Lt = shade(col, 0.35);
  g.beginPath(); g.ellipse(192, 176, 150, 10, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.0)'; g.fill();
  rr(g, 40, 82, 300, 84, 42); ink(g, lg(g, 0, 82, 0, 166, [[0, Lt], [0.5, col], [1, D]]));
  g.beginPath(); g.moveTo(130, 86); g.quadraticCurveTo(150, 30, 230, 34); g.quadraticCurveTo(300, 40, 312, 92); g.closePath(); ink(g, lg(g, 0, 34, 0, 92, [[0, Lt], [1, col]]));
  // windscreen face
  g.beginPath(); g.moveTo(232, 44); g.quadraticCurveTo(290, 50, 300, 90); g.lineTo(220, 90); g.closePath(); ink(g, lg(g, 0, 44, 0, 90, [[0, '#cff4ff'], [1, '#4a8fcf']]), 4);
  [[248, 70], [278, 70]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 11, 14, 0, 0, 7); ink(g, '#fff', 3); g.beginPath(); g.arc(x + 3, y + 2, 6, 0, 7); g.fillStyle = OUT; g.fill(); g.beginPath(); g.arc(x + 5, y - 1, 2, 0, 7); g.fillStyle = '#fff'; g.fill(); });
  g.beginPath(); g.arc(312, 118, 18, 0.15, Math.PI - 0.5); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
  gloss(g, 70, 90, 200, 12, 0.4);
  rr(g, 80, 120, 70, 12, 6); g.fillStyle = '#fff'; g.fill();
  wheel(g, 104, 150, 30, '#e8e8f0', { rim: 0.55 }); wheel(g, 284, 150, 30, '#e8e8f0', { rim: 0.55 });
}
/* ---------------- smashables, debris, items ---------------- */
const SPR = {};
function def(name, f) { SPR[name] = f; }
def('smash.cone', (g) => { poly(g, [[64, 14], [96, 140], [32, 140]]); ink(g, lg(g, 32, 0, 96, 0, [[0, '#ffb347'], [0.5, '#ff7a00'], [1, '#d65a00']]));
  g.save(); poly(g, [[64, 14], [96, 140], [32, 140]]); g.clip(); g.fillStyle = '#fff'; g.fillRect(0, 60, 128, 16); g.fillRect(0, 100, 128, 14); g.restore();
  poly(g, [[64, 14], [96, 140], [32, 140]]); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
  rr(g, 16, 136, 96, 18, 6); ink(g, lg(g, 0, 136, 0, 154, [[0, '#ff8f2a'], [1, '#b84a00']]), 5); gloss(g, 52, 30, 12, 60, 0.35); });
def('smash.box', (g) => { rr(g, 12, 22, 136, 132, 10); ink(g, lg(g, 0, 22, 0, 154, [[0, '#e8b77a'], [1, '#b47a3c']]));
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(66, 22, 28, 132); g.fillStyle = 'rgba(120,70,20,.35)'; g.fillRect(12, 70, 136, 4);
  g.font = '700 26px Fredoka, sans-serif'; g.fillStyle = 'rgba(110,60,20,.55)'; g.textAlign = 'center'; g.fillText('↑↑', 40, 120); gloss(g, 22, 28, 110, 10, 0.3); });
def('smash.crate', (g) => { rr(g, 10, 14, 140, 140, 8); ink(g, lg(g, 0, 14, 0, 154, [[0, '#d99a52'], [1, '#9a5a22']]));
  g.save(); rr(g, 10, 14, 140, 140, 8); g.clip(); g.strokeStyle = 'rgba(90,45,10,.45)'; g.lineWidth = 3; for (let y = 48; y < 154; y += 34) { g.beginPath(); g.moveTo(10, y); g.lineTo(150, y); g.stroke(); }
  g.lineWidth = 18; g.strokeStyle = '#b8742f'; g.beginPath(); g.moveTo(24, 28); g.lineTo(136, 140); g.moveTo(136, 28); g.lineTo(24, 140); g.stroke(); g.lineWidth = 4; g.strokeStyle = 'rgba(90,45,10,.5)'; g.stroke(); g.restore();
  rr(g, 10, 14, 140, 140, 8); g.lineWidth = 14; g.strokeStyle = '#c98640'; g.stroke(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
  [[22, 26], [138, 26], [22, 142], [138, 142]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fillStyle = '#6b6b78'; g.fill(); }); gloss(g, 24, 20, 112, 8, 0.3); });
const BLOCKC = ['#ff4d6d', '#4361ee', '#ffd23f', '#2ec4b6', '#9b5cf0', '#ff9f1c'];
function block(g, col, letter) { rr(g, 12, 14, 136, 136, 22); ink(g, lg(g, 0, 14, 0, 150, [[0, shade(col, 0.3)], [1, shade(col, -0.25)]]));
  rr(g, 30, 32, 100, 100, 14); g.fillStyle = shade(col, 0.15); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.9)'; if (letter) { g.font = '700 70px Fredoka, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 80, 86); } else { starPath(g, 80, 84, 36, 16); g.fill(); }
  gloss(g, 26, 20, 108, 12, 0.45); }
def('smash.block', (g, v) => block(g, BLOCKC[(v || 0) % BLOCKC.length], ['L', 'E', 'O', null][(v || 0) % 4]));
def('smash.mega', (g, v) => { const col = BLOCKC[(v || 0) % BLOCKC.length]; rr(g, 8, 40, 144, 112, 12); ink(g, lg(g, 0, 40, 0, 152, [[0, shade(col, 0.25)], [1, shade(col, -0.3)]]));
  for (let i = 0; i < 2; i++) { rr(g, 22 + i * 70, 16, 46, 30, 8); ink(g, lg(g, 0, 16, 0, 46, [[0, shade(col, 0.4)], [1, col]]), 5); }
  gloss(g, 20, 48, 120, 12, 0.4); });
def('smash.wall', (g) => { rr(g, 8, 10, 176, 366, 8); ink(g, '#a8442a');
  for (let r = 0; r < 9; r++) for (let c = -1; c < 3; c++) { const x = 12 + c * 86 + (r % 2 ? 43 : 0), y = 14 + r * 40; if (x > 180 || x + 80 < 10) continue;
    g.save(); rr(g, 8, 10, 176, 366, 8); g.clip(); rr(g, x, y, 80, 34, 6); g.fillStyle = lg(g, 0, y, 0, y + 34, [[0, ['#ef7a52', '#e06640', '#d9583a'][(r + c + 3) % 3]], [1, '#a8442a']]); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 6, y + 4, 60, 5); g.restore(); }
  rr(g, 8, 10, 176, 366, 8); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); });
def('smash.barrel', (g, v) => { const col = ['#e53935', '#2f6fdf', '#2ec46b'][(v || 0) % 3]; // lying on its side, 160x112
  g.beginPath(); g.moveTo(22, 14); g.quadraticCurveTo(80, 4, 138, 14); g.lineTo(138, 106); g.quadraticCurveTo(80, 112, 22, 106); g.closePath(); ink(g, lg(g, 0, 8, 0, 108, [[0, shade(col, 0.3)], [0.4, col], [1, shade(col, -0.45)]]));
  [44, 116].forEach(x => { rr(g, x - 7, 8, 14, 100, 6); ink(g, lg(g, x - 7, 0, x + 7, 0, [[0, '#e0e4ee'], [1, '#7c869e']]), 3); });
  g.beginPath(); g.ellipse(140, 60, 14, 46, 0, 0, 7); ink(g, shade(col, -0.2), 4); gloss(g, 30, 22, 96, 12, 0.35);
  g.fillStyle = '#fff'; starPath(g, 80, 60, 14, 6); g.fill(); });
def('smash.wallw', (g) => { rr(g, 10, 8, 364, 242, 8); ink(g, '#a8442a');
  for (let r = 0; r < 6; r++) for (let c = -1; c < 5; c++) { const x = 14 + c * 86 + (r % 2 ? 43 : 0), y = 12 + r * 40;
    g.save(); rr(g, 10, 8, 364, 242, 8); g.clip(); rr(g, x, y, 80, 34, 6); g.fillStyle = lg(g, 0, y, 0, y + 34, [[0, ['#ef7a52', '#e06640', '#d9583a'][(r + c + 3) % 3]], [1, '#a8442a']]); g.fill(); g.restore(); }
  rr(g, 10, 8, 364, 242, 8); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); });
def('smash.balloon', (g, v) => { const col = ['#ff4d6d', '#ffd23f', '#4cc9f0', '#9b5cf0'][(v || 0) % 4];
  g.strokeStyle = '#6b6b78'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 170); g.quadraticCurveTo(66, 200, 84, 226); g.quadraticCurveTo(96, 244, 80, 254); g.stroke();
  g.beginPath(); g.ellipse(80, 90, 62, 76, 0, 0, 7); ink(g, rgr(g, 80, 90, 6, 80, [[0, shade(col, 0.6)], [0.5, col], [1, shade(col, -0.35)]], -22, -30));
  poly(g, [[72, 164], [88, 164], [94, 178], [66, 178]]); ink(g, col, 4);
  g.save(); g.globalAlpha = 0.75; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(56, 56, 12, 22, -0.5, 0, 7); g.fill(); g.restore(); });
def('smash.cloud', (g) => { g.save(); g.beginPath(); [[70, 100, 52], [128, 72, 64], [190, 100, 50], [100, 120, 44], [160, 124, 44]].forEach(([x, y, r]) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); }); g.restore();
  const p = new Path2D(); [[70, 100, 52], [128, 72, 64], [190, 100, 50], [100, 124, 44], [160, 126, 44]].forEach(([x, y, r]) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, 7); });
  g.lineWidth = 10; g.strokeStyle = OUT; g.stroke(p); g.fillStyle = lg(g, 0, 10, 0, 170, [[0, '#ffffff'], [1, '#c9dcf5']]); g.fill(p);
  [[108, 96], [150, 96]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fillStyle = OUT; g.fill(); });
  g.beginPath(); g.arc(129, 108, 12, 0.2, Math.PI - 0.2); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = 'rgba(255,140,170,.5)'; g.beginPath(); g.arc(92, 112, 7, 0, 7); g.arc(166, 112, 7, 0, 7); g.fill(); });
def('item.star', (g) => { g.save(); g.shadowColor = 'rgba(255,200,0,.8)'; g.shadowBlur = 14; starPath(g, 64, 66, 54, 24); g.fillStyle = '#ffd23f'; g.fill(); g.restore();
  starPath(g, 64, 66, 54, 24); ink(g, lg(g, 0, 12, 0, 120, [[0, '#fff3a8'], [0.5, '#ffc300'], [1, '#e08a00']]), 5);
  g.save(); g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(50, 48, 10, 6, -0.6, 0, 7); g.fill(); g.restore(); });
def('item.shot', (g) => { starPath(g, 48, 50, 40, 18); ink(g, lg(g, 0, 8, 0, 90, [[0, '#fff3a8'], [1, '#ffb300']]), 4); });
def('item.ramp', (g) => { poly(g, [[8, 154], [312, 154], [312, 40]]); ink(g, lg(g, 0, 40, 0, 154, [[0, '#ffe066'], [1, '#e0a800']]));
  g.save(); poly(g, [[8, 154], [312, 154], [312, 40]]); g.clip(); g.fillStyle = OUT; for (let x = -40; x < 330; x += 56) { poly(g, [[x, 154], [x + 26, 154], [x + 66, 40], [x + 40, 40]]); g.fill(); } g.restore();
  poly(g, [[8, 154], [312, 154], [312, 40]]); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); });
def('item.finish', (g) => { [[30, 0], [210, 0]].forEach(([x]) => { rr(g, x, 40, 18, 466, 8); ink(g, lg(g, x, 0, x + 18, 0, [[0, '#fff'], [1, '#9aa3b8']]), 4); });
  rr(g, 14, 30, 228, 96, 14); ink(g, '#fff', 6); g.save(); rr(g, 14, 30, 228, 96, 14); g.clip(); for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2) { g.fillStyle = OUT; g.fillRect(14 + c * 24, 30 + r * 24, 24, 24); } g.restore();
  rr(g, 14, 30, 228, 96, 14); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); });
function debris(g, kind) { const c = { cone: ['#ff7a00', '#fff'], card: ['#d9a566', '#b47a3c'], wood: ['#d99a52', '#9a5a22'], block: ['#ff4d6d', '#4361ee'], brick: ['#e06640', '#a8442a'], barrel: ['#e53935', '#b9c2d6'], balloon: ['#ff4d6d', '#ffd23f'], cloud: ['#ffffff', '#d6e4f7'] }[kind] || ['#ccc', '#999'];
  if (kind === 'cloud') { g.beginPath(); g.arc(24, 34, 16, 0, 7); g.arc(40, 30, 18, 0, 7); g.fillStyle = '#fff'; g.fill(); return; }
  if (kind === 'brick') { rr(g, 8, 18, 48, 26, 5); ink(g, lg(g, 0, 18, 0, 44, [[0, c[0]], [1, c[1]]]), 4); return; }
  if (kind === 'wood') { poly(g, [[6, 26], [58, 18], [52, 36], [10, 44]]); ink(g, lg(g, 0, 18, 0, 44, [[0, c[0]], [1, c[1]]]), 4); return; }
  if (kind === 'balloon') { poly(g, [[12, 30], [30, 14], [52, 26], [40, 48], [20, 46]], true); ink(g, c[0], 3); return; }
  poly(g, [[10, 14], [50, 8], [56, 40], [26, 54], [8, 40]], false); ink(g, lg(g, 0, 8, 0, 54, [[0, c[0]], [1, c[1]]]), 4); }

/* ---------------- parallax layers (seamless: everything wraps horizontally) ---------------- */
function wrap(W, x, w, f) { f(x); if (x + w > W) f(x - W); if (x < 0) f(x + W); }
function layer(track, role, W, H) {
  const c = cv(W, H), g = c.getContext('2d'), R = (root.LeoSim ? root.LeoSim.rng : null)((track.length * 97 + role.length * 13) | 0);
  const T = track;
  if (role === 'sky') {
    const sk = { toyroom: ['#bfe3ff', '#e8f6ff'], desert: ['#ffb26b', '#ffe3a3'], castle: ['#5eb8ff', '#d4efff'], city: ['#0d1238', '#3b2a6b'] }[T];
    g.fillStyle = lg(g, 0, 0, 0, H, [[0, sk[0]], [1, sk[1]]]); g.fillRect(0, 0, W, H);
    if (T === 'toyroom') { // wallpaper: soft stars + stripes, a window
      for (let x = 0; x < W; x += 120) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, 0, 50, H); }
      for (let i = 0; i < 40; i++) { const x = R() * W, y = R() * H * 0.8; g.fillStyle = ['rgba(255,210,63,.55)', 'rgba(255,120,160,.45)', 'rgba(70,140,255,.35)'][i % 3]; wrap(W, x, 30, xx => { starPath(g, xx, y, 16, 7); g.fill(); }); }
      [W * 0.2, W * 0.7].forEach(x => { rr(g, x, H * 0.12, 300, 260, 18); g.fillStyle = '#fff'; g.fill(); rr(g, x + 16, H * 0.12 + 16, 268, 228, 10); g.fillStyle = lg(g, 0, H * 0.12, 0, H * 0.12 + 240, [[0, '#7cc8ff'], [1, '#d8f1ff']]); g.fill();
        g.fillStyle = '#fff'; g.fillRect(x + 145, H * 0.12, 10, 260); g.fillRect(x, H * 0.12 + 125, 300, 10);
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x + 80, H * 0.12 + 80, 26, 0, 7); g.arc(x + 110, H * 0.12 + 72, 30, 0, 7); g.fill(); });
    } else if (T === 'desert') {
      g.fillStyle = 'rgba(255,248,200,.9)'; g.beginPath(); g.arc(W * 0.7, H * 0.32, 90, 0, 7); g.fill(); g.fillStyle = 'rgba(255,248,200,.3)'; g.beginPath(); g.arc(W * 0.7, H * 0.32, 140, 0, 7); g.fill();
      for (let i = 0; i < 6; i++) { const x = R() * W, y = H * 0.15 + R() * H * 0.3; wrap(W, x, 260, xx => { g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, xx, y, 220 + R() * 80, 26, 13); g.fill(); }); }
    } else if (T === 'castle') {
      for (let i = 0; i < 12; i++) { const x = R() * W, y = H * 0.08 + R() * H * 0.55, s = 0.6 + R() * 0.9; wrap(W, x, 260 * s, xx => { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(xx, y, 40 * s, 0, 7); g.arc(xx + 50 * s, y - 20 * s, 55 * s, 0, 7); g.arc(xx + 110 * s, y, 42 * s, 0, 7); g.rect(xx, y, 110 * s, 40 * s); g.fill(); }); }
    } else {
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; g.fillRect(R() * W, R() * H * 0.75, 2 + R() * 2, 2 + R() * 2); }
      g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(W * 0.3, H * 0.25, 70, 0, 7); g.fill(); g.fillStyle = 'rgba(255,246,201,.15)'; g.beginPath(); g.arc(W * 0.3, H * 0.25, 120, 0, 7); g.fill();
      for (let i = 0; i < 5; i++) { const x = R() * W, y = H * 0.1 + R() * H * 0.35; wrap(W, x, 300, xx => { g.fillStyle = 'rgba(120,100,200,.25)'; rr(g, xx, y, 240 + R() * 60, 30, 15); g.fill(); }); }
    }
  } else if (role === 'far') {
    if (T === 'toyroom') { // bookshelf + skirting
      for (let x = 0; x < W; x += 640) { rr(g, x + 40, H * 0.25, 360, H * 0.75, 12); ink(g, '#c98a5a', 6); for (let s = 0; s < 3; s++) { const y = H * 0.25 + 30 + s * (H * 0.22); g.fillStyle = '#a86a3c'; g.fillRect(x + 50, y + H * 0.18, 340, 12);
          for (let b = 0; b < 9; b++) { const bw = 22 + R() * 14, bh = H * 0.12 + R() * H * 0.05; rr(g, x + 60 + b * 36, y + H * 0.18 - bh, bw, bh, 4); ink(g, BLOCKC[(b + s) % 6], 3); } } }
    } else if (T === 'desert') { g.fillStyle = '#e59a5a'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 40) g.lineTo(x, H * 0.45 + Math.sin(x / W * Math.PI * 6) * 30 + Math.sin(x / W * Math.PI * 14) * 14); g.lineTo(W, H); g.fill();
      for (let i = 0; i < 4; i++) { const x = i * W / 4 + 60; g.fillStyle = '#d4814a'; rr(g, x, H * 0.3, 220, H * 0.7, 18); g.fill(); g.fillStyle = '#c06e3e'; g.fillRect(x, H * 0.45, 220, 10); } }
    else if (T === 'castle') { g.fillStyle = '#8fd17a'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 30) g.lineTo(x, H * 0.55 + Math.sin(x / W * Math.PI * 4) * 50); g.lineTo(W, H); g.fill();
      g.fillStyle = '#9db0d6'; for (let i = 0; i < 3; i++) { const x = i * W / 3 + 100; rr(g, x, H * 0.25, 60, H * 0.4, 6); g.fill(); poly(g, [[x - 10, H * 0.25], [x + 30, H * 0.08], [x + 70, H * 0.25]]); g.fill(); } }
    else { g.fillStyle = '#1b1f4e'; let x = 0; while (x < W) { const w = 60 + R() * 90, h = H * (0.35 + R() * 0.55); g.fillRect(x, H - h, w, h); x += w + 6; }
      g.fillStyle = 'rgba(255,230,120,.5)'; for (let i = 0; i < 220; i++) g.fillRect(R() * W, H * 0.4 + R() * H * 0.6, 4, 6); }
  } else if (role === 'mid') {
    if (T === 'toyroom') { // giant plush hills and toys
      for (let i = 0; i < 5; i++) { const x = i * W / 5 + 40, col = ['#ff9ec7', '#9be7ff', '#ffe08a', '#b7f0a8', '#d5b8ff'][i];
        g.beginPath(); g.ellipse(x + 150, H, 200, H * 0.42, 0, Math.PI, 0); ink(g, lg(g, 0, H * 0.55, 0, H, [[0, shade(col, 0.2)], [1, shade(col, -0.15)]]), 6);
        if (i % 2 === 0) { for (let b = 0; b < 3; b++) { g.save(); g.translate(x + 60 + b * 10, H * 0.62 - b * 70); g.rotate((b - 1) * 0.06); g.scale(0.55, 0.5); block(g, BLOCKC[(i + b) % 6], null); g.restore(); } }
        else { g.beginPath(); g.arc(x + 230, H * 0.55, 46, 0, 7); ink(g, '#c7905c', 6); g.beginPath(); g.arc(x + 200, H * 0.5, 16, 0, 7); g.arc(x + 260, H * 0.5, 16, 0, 7); ink(g, '#c7905c', 5); g.fillStyle = OUT; g.beginPath(); g.arc(x + 216, H * 0.55, 5, 0, 7); g.arc(x + 244, H * 0.55, 5, 0, 7); g.fill(); } }
    } else if (T === 'desert') { for (let i = 0; i < 7; i++) { const x = i * W / 7 + R() * 60; // cacti + rocks
        if (i % 2) { const h = H * (0.3 + R() * 0.2); rr(g, x, H - h, 46, h, 23); ink(g, '#3fa34d', 6); rr(g, x - 34, H - h * 0.7, 30, h * 0.35, 15); ink(g, '#3fa34d', 5); rr(g, x + 50, H - h * 0.8, 30, h * 0.3, 15); ink(g, '#3fa34d', 5); }
        else { g.beginPath(); g.ellipse(x + 80, H, 120, H * 0.22, 0, Math.PI, 0); ink(g, lg(g, 0, H * 0.78, 0, H, [[0, '#d98a52'], [1, '#a85a2c']]), 6); } } }
    else if (T === 'castle') { for (let i = 0; i < 2; i++) { const x = i * W / 2 + 120; // castle walls with towers
        rr(g, x, H * 0.45, 520, H * 0.55, 6); ink(g, lg(g, 0, H * 0.45, 0, H, [[0, '#d7dbe8'], [1, '#9aa3b8']]), 6);
        for (let m = 0; m < 10; m++) { rr(g, x + m * 54, H * 0.4, 34, 34, 4); ink(g, '#c6cbdb', 5); }
        [x - 30, x + 470].forEach(tx => { rr(g, tx, H * 0.2, 90, H * 0.8, 8); ink(g, lg(g, tx, 0, tx + 90, 0, [[0, '#e3e6f0'], [1, '#a2abc0']]), 6); poly(g, [[tx - 14, H * 0.2], [tx + 45, H * 0.02], [tx + 104, H * 0.2]]); ink(g, '#9b5cf0', 6);
          rr(g, tx + 30, H * 0.35, 30, 46, 15); ink(g, '#3a3256', 4); }); } }
    else { for (let i = 0; i < 6; i++) { const x = i * W / 6, w = 220, h = H * (0.5 + R() * 0.45); // neon buildings
        g.fillStyle = lg(g, 0, H - h, 0, H, [[0, '#2b2f6e'], [1, '#141638']]); g.fillRect(x + 20, H - h, w, h); g.lineWidth = 6; g.strokeStyle = OUT; g.strokeRect(x + 20, H - h, w, h);
        for (let r = 0; r < h / 40 - 1; r++) for (let c2 = 0; c2 < 5; c2++) if (R() > 0.35) { g.fillStyle = R() > 0.5 ? '#ffd86b' : '#5ad1ff'; g.fillRect(x + 36 + c2 * 40, H - h + 20 + r * 40, 22, 22); }
        g.fillStyle = ['#ff3df0', '#36f1ff', '#ffe03d'][i % 3]; g.shadowColor = g.fillStyle; g.shadowBlur = 16; rr(g, x + 50, H - h - 26, 140, 20, 10); g.fill(); g.shadowBlur = 0; } }
  } else if (role === 'ground') {
    const gr = { toyroom: ['#e9b47c', '#b9783f'], desert: ['#f0c27a', '#c98b47'], castle: ['#b7bfd0', '#7d8699'], city: ['#3d3f55', '#22233a'] }[T];
    g.fillStyle = lg(g, 0, 0, 0, H, [[0, gr[0]], [1, gr[1]]]); g.fillRect(0, 0, W, H);
    if (T === 'toyroom') { g.strokeStyle = 'rgba(120,70,30,.35)'; g.lineWidth = 4; for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (y / 54 % 2) * 120; x < W; x += 240) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 54); g.stroke(); } }
      g.fillStyle = 'rgba(255,90,140,.35)'; g.fillRect(0, H * 0.18, W, H * 0.5); g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < W; x += 60) g.fillRect(x, H * 0.18, 30, 10); }
    else if (T === 'desert') { for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(150,90,40,${R() * 0.3})`; g.fillRect(R() * W, R() * H, 4, 3); } }
    else if (T === 'castle') { g.strokeStyle = 'rgba(60,64,90,.35)'; g.lineWidth = 4; for (let y = 0; y < H; y += 48) for (let x = (y / 48 % 2) * 60; x < W; x += 120) { rr(g, x + 3, y + 3, 114, 42, 10); g.stroke(); } }
    else { g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 400; i++) g.fillRect(R() * W, R() * H, 3, 3); g.fillStyle = '#ffd23f'; for (let x = 0; x < W; x += 160) g.fillRect(x, H * 0.02, 80, 10); }
  }
  return c;
}

/* Public: sprite(name) -> canvas at the manifest size. */
function sprite(name, size) {
  const [w, h] = size || [256, 256], c = cv(w, h), g = c.getContext('2d');
  const m = name.match(/^veh\.(\w+)\.(\w+)$/);
  if (m) { g.save(); g.scale(w / 512, h / 256); ({ dragster, bibi, truck, sword, jet })[m[1]](g, m[2]); g.restore(); return c; }
  const rv = name.match(/^rival\.(\w+)$/); if (rv) { g.save(); g.scale(w / 384, h / 192); rival(g, { orange: '#ff8a1f', green: '#27c46b', blue: '#2f8cff' }[rv[1]] || '#ff8a1f'); g.restore(); return c; }
  const db = name.match(/^debris\.(\w+)(?:\.\d+)?$/); if (db) { g.save(); g.scale(w / 64, h / 64); debris(g, db[1]); g.restore(); return c; }
  const base = name.replace(/\.\d+$/, ''), v = +(name.match(/\.(\d+)$/) || [0, 0])[1];
  if (SPR[base]) { SPR[base](g, v); return c; }
  // UI icons
  if (name === 'ui.star') { g.scale(w / 128, h / 128); SPR['item.star'](g); return c; }
  return c;
}
root.LeoProc = { sprite, layer, starPath, rr, lg, shade, BLOCKC };
})(window);
