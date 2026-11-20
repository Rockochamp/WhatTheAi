// All game positions use logical pixels. The landscape and atlas render at 2×.
export const TILE_W = 32,
  TILE_H = 27,
  HORIZON = 52,
  W = 384,
  H = 218,
  SCALE = 2;
export const center = (cell) => [16 + (cell % 12) * TILE_W, HORIZON + 14 + Math.floor(cell / 12) * TILE_H];

const ink = '#29303e',
  cream = '#fff3bf',
  gold = '#ffc253';
const atlas = new Image();
atlas.src = new URL('art/fire-forms.webp', import.meta.url);
const backdrops = [
  'lantern',
  'whisper',
  'cinder',
  'bridge',
  'garden',
  'isle',
  'sun',
  'starfall',
  'galaxy',
  'everheart',
];
const fallbackScenes = [
  'lantern',
  'lantern',
  'cinder',
  'sun',
  'lantern',
  'sun',
  'sun',
  'galaxy',
  'galaxy',
  'cinder',
];

function poly(c, vertices, fill, stroke) {
  c.beginPath();
  c.moveTo(...vertices[0]);
  for (const point of vertices.slice(1)) c.lineTo(...point);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.2;
    c.stroke();
  }
}
function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fill();
}
function gleam(c, x, y, r, color) {
  poly(
    c,
    [
      [x, y - r],
      [x + r * 0.23, y - r * 0.2],
      [x + r, y],
      [x + r * 0.23, y + r * 0.2],
      [x, y + r],
      [x - r * 0.22, y + r * 0.2],
      [x - r, y],
      [x - r * 0.22, y - r * 0.2],
    ],
    color,
  );
}
function glow(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export function portrait(world) {
  const node = document.createElement('span');
  node.className = 'portrait';
  node.setAttribute('aria-hidden', 'true');
  node.style.backgroundPosition = (world % 5) * 25 + '% ' + Math.floor(world / 5) * 100 + '%';
  return node;
}

export function cubSprite(c, x, y, world, time, walking, flip = false) {
  ellipse(c, x, y + 2, 9.5, 2.6, '#1c203b8c');
  const stride = Math.sin(time * (walking ? 16 : 2.8));
  const bob = walking ? Math.abs(stride) * 1.7 : (stride + 1) * 0.38;
  c.save();
  c.translate(x, y + 2 - bob);
  c.scale(flip ? -1 : 1, 1);
  if (walking) c.rotate(stride * 0.045);
  if (atlas.complete && atlas.naturalWidth) {
    const size = 34 + Math.min(world, 7) * 0.75;
    c.drawImage(
      atlas,
      (world % 5) * 160,
      Math.floor(world / 5) * 160,
      160,
      160,
      -size / 2,
      -size * 0.95,
      size,
      size,
    );
  } else {
    ellipse(c, 0, -9, 6, 9, '#df874a');
    ellipse(c, 0, -19, 8, 7, '#ffc375');
    poly(
      c,
      [
        [-6, -23],
        [-5, -29],
        [-1, -24],
      ],
      gold,
    );
    poly(
      c,
      [
        [4, -23],
        [9, -28],
        [8, -21],
      ],
      gold,
    );
    ellipse(c, 3, -20, 1.3, 1.8, ink);
  }
  c.restore();
}

const objects = new Image();
objects.src = new URL('art/relics.webp', import.meta.url);

function drawObject(c, frame, x, bottom, width, height = width) {
  if (!objects.complete || !objects.naturalWidth) return false;
  c.drawImage(
    objects,
    (frame % 4) * 128,
    Math.floor(frame / 4) * 128,
    128,
    128,
    x - width / 2,
    bottom - height,
    width,
    height,
  );
  return true;
}

export function obstacle(c, cell, worldIndex, w) {
  const [x, y] = center(cell);
  const tree = worldIndex === 0 || worldIndex === 1 || worldIndex === 4 || worldIndex === 7;
  ellipse(c, x + 1, y + 3, 10, 2.8, '#19213066');
  if (!drawObject(c, tree ? 0 : 1, x, y + 4, tree ? 27 : 23)) ellipse(c, x, y - 4, 8, 7, w.shade);
}

export function landscape(world, index) {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const c = canvas.getContext('2d');
  c.scale(SCALE, SCALE);
  function draw(image) {
    if (image) c.drawImage(image, 0, 0, W, H);
    else {
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, world.sky);
      sky.addColorStop(0.23, world.haze);
      sky.addColorStop(0.26, world.leaf);
      sky.addColorStop(1, world.turf);
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
    }
    c.fillStyle = '#14232c17';
    c.fillRect(0, 0, W, H);
  }
  draw(null);
  const sky = new Image();
  sky.onload = () => draw(sky);
  sky.onerror = () => {
    sky.onerror = null;
    if (fallbackScenes[index] !== backdrops[index])
      sky.src = new URL('art/' + fallbackScenes[index] + '.webp', import.meta.url);
  };
  sky.src = new URL('art/' + backdrops[index] + '.webp', import.meta.url);
  return canvas;
}

export function spark(c, x, y, t) {
  const cy = y - 4 + Math.sin(t * 3 + x) * 1.4;
  ellipse(c, x, y + 3, 4.7, 1.2, '#3b2a394d');
  glow(c, x, cy, 10, '#ffc34b96');
  if (!drawObject(c, 14, x, cy + 4, 14, 15)) gleam(c, x, cy, 5, gold);
  gleam(c, x + 4, cy - 4, 1.6, cream);
}

export function moth(c, x, y, t) {
  const bottom = y + 3 + Math.sin(t * 3 + x) * 1.6;
  const width = 13 + Math.sin(t * 8) * 2.8;
  glow(c, x, bottom - 5, 8, '#c3fff252');
  if (!drawObject(c, 15, x, bottom, width, 11)) gleam(c, x, bottom - 4, 3, '#c6ffe9');
}

export function altar(c, x, y, index, lit, t, w) {
  ellipse(c, x, y + 4, 9, 2.3, '#22253670');
  if (lit) glow(c, x, y - 10, 17, w.fire + 'c0');
  if (!drawObject(c, 2 + index, x, y + 4, 24)) {
    ellipse(c, x, y - 5, 5, 8, lit ? w.fire : '#a9d8d6');
  }
  if (lit) {
    drawObject(c, 14, x, y - 15 + Math.sin(t * 5 + x), 7, 10);
    gleam(c, x + 5, y - 10, 1.8, cream);
  } else {
    const drift = Math.sin(t * 2 + x);
    gleam(c, x - 7, y - 10 + drift * 1.5, 1.8, '#e0fdff');
  }
}

export function portal(c, x, y, open, t, w) {
  ellipse(c, x, y + 4, 13, 3, '#25223d70');
  if (open) glow(c, x, y - 8, 19, '#8fffd898');
  if (!drawObject(c, open ? 13 : 12, x, y + 4, 31)) {
    ellipse(c, x, y - 7, 9, 13, ink);
    ellipse(c, x, y - 6, 6, 10, open ? '#75d4bc' : w.shade);
  }
  if (open) {
    for (let i = 0; i < 4; i++)
      gleam(c, x + Math.sin(t * 2 + i) * 4.5, y - 15 + ((t * 7 + i * 4) % 16), 1.2, cream);
  }
}

export function glints(c, w, t) {
  for (let i = 0; i < 12; i++) {
    const x = (i * 77 + t * (2 + (i % 3))) % W,
      y = 45 + ((i * 31) % 157) + Math.sin(t + i) * 3;
    if (Math.sin(t * 1.3 + i) > 0.15) gleam(c, x, y, i % 3 ? 0.7 : 1.8, w.fire);
  }
}

export function castTrail(c, from, to, progress, color) {
  const [sx, sy] = center(from),
    [tx, ty] = center(to);
  for (let i = 0; i < 7; i++) {
    const f = Math.max(0, progress - i * 0.052),
      x = sx + (tx - sx) * f,
      y = sy - 12 + (ty - sy) * f - Math.sin(f * Math.PI) * 9;
    const radius = (7 - i) * 0.57 * (1 - progress * 0.55);
    ellipse(c, x, y, radius, radius, i < 2 ? cream : color);
  }
}
