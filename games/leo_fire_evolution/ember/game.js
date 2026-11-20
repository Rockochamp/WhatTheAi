import { worlds, readTrail, pathTo, WIDTH, HEIGHT, points } from './worlds.js';
import {
  W,
  H,
  HORIZON,
  TILE_W,
  TILE_H,
  SCALE,
  center,
  landscape,
  obstacle,
  cubSprite,
  spark,
  moth,
  altar,
  portal,
  glints,
  portrait,
  castTrail,
} from './art.js';
import { aliases, leaders, publish, valid } from './board.js';

const el = (id) => document.getElementById(id);
const ctx = el('field').getContext('2d');
ctx.scale(SCALE, SCALE);
const prefix = 'leo-fire-evolution-ember-1:';
let storageAvailable = true;
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    storageAvailable = false;
  }
}
function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
    (c === 'x' ? Math.floor(Math.random() * 16) : 8 + Math.floor(Math.random() * 4)).toString(16),
  );
}
const fresh = (world) => ({
  world,
  id: newId(),
  cell: readTrail(worlds[world]).l,
  s: [],
  a: [],
  m: [],
  steps: 0,
  finished: false,
  shared: false,
  alias: aliases[0],
});
function usable(s) {
  if (!s || !worlds[s.world] || !Number.isInteger(s.world) || !/^[a-f0-9-]{36}$/.test(s.id)) return false;
  const tiles = readTrail(worlds[s.world]);
  return (
    Number.isInteger(s.cell) &&
    s.cell >= 0 &&
    s.cell < WIDTH * HEIGHT &&
    !tiles['#'].includes(s.cell) &&
    Number.isSafeInteger(s.steps) &&
    s.steps >= 0 &&
    aliases.includes(s.alias) &&
    ['s', 'a', 'm'].every(
      (k) =>
        Array.isArray(s[k]) &&
        new Set(s[k]).size === s[k].length &&
        s[k].every((cell) => tiles[k].includes(cell)),
    ) &&
    (!s.finished || (s.cell === tiles.p && s.s.length === 3 && s.a.length === 2))
  );
}
const saved = load('trail', null);
let trail = usable(saved) ? saved : fresh(0),
  known = load('known', 1),
  records = load('records', []);
known = Number.isInteger(known) ? Math.max(1, Math.min(10, known), trail.world + 1) : trail.world + 1;
records = Array.isArray(records) ? records.filter(valid) : [];
let tiles,
  ground,
  active = false,
  path = [],
  step = null,
  flip = false,
  keys = [],
  effect = [],
  noticeUntil = 0;
let dialogKind = '',
  dialogToken = 0,
  boardWorld = trail.world;
let targetRelic,
  fireArc,
  inputSteps = [];
let sound = load('sound', false) === true,
  audio = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function note(freq, duration = 0.12, delay = 0, type = 'sine') {
  if (!sound || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(),
    gain = audio.createGain(),
    t = audio.currentTime + delay;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.013);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}
async function wakeAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state !== 'running') await audio.resume();
  } catch {
    /* Audio is optional. */
  }
}
function soundLabel() {
  el('audio').textContent = sound ? 'Sound on' : 'Sound off';
  el('audio').setAttribute('aria-pressed', String(sound));
}
el('audio').onclick = async () => {
  sound = !sound;
  store('sound', sound);
  soundLabel();
  if (sound) {
    await wakeAudio();
    note(660);
  } else if (audio) {
    audio.suspend().catch(() => {});
  }
};
const keep = () => store('trail', trail);
const ready = () => trail.s.length === 3 && trail.a.length === 2;
const distance = (a, b) =>
  Math.abs((a % WIDTH) - (b % WIDTH)) + Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH));
const nearby = () => tiles.a.find((n) => !trail.a.includes(n) && distance(trail.cell, n) <= 1);
function hud() {
  const w = worlds[trail.world];
  el('chapter').textContent = 'World ' + String(trail.world + 1).padStart(2, '0') + ' / 10';
  el('world').textContent = w.name;
  el('form').textContent = w.form;
  el('mission').textContent = ready()
    ? 'Step through the open gate'
    : trail.a.length === 2
      ? 'Gather the remaining sparks'
      : w.mission;
  el('sparks').textContent = trail.s.length + '/3';
  el('relics').textContent = trail.a.length + '/2';
  el('moths').textContent = trail.m.length + '/3';
  el('cast').classList.toggle('ready', nearby() !== undefined);
}
function journal() {
  const list = el('forms');
  list.replaceChildren();
  el('unlocked').textContent = known + ' / 10 discovered';
  worlds.forEach((w, i) => {
    const li = document.createElement('li');
    li.append(portrait(i), document.createTextNode(w.form));
    if (i < known) li.className = 'known';
    list.append(li);
  });
}
function notice(text, ms = 2100) {
  el('toast').textContent = text;
  noticeUntil = performance.now() + ms;
}
function scene() {
  tiles = readTrail(worlds[trail.world]);
  ground = landscape(worlds[trail.world], trail.world);
  path = [];
  keys = [];
  inputSteps = [];
  step = null;
  targetRelic = undefined;
  fireArc = null;
  effect = [];
  flip = false;
  el('toast').textContent = '';
  hud();
  journal();
}
function enter() {
  el('cover').hidden = true;
  el('play').hidden = false;
  if (!active) {
    active = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  scene();
  wakeAudio();
  keep();
  el('field').focus({ preventScroll: true });
  if (trail.finished) report();
  else notice(ready() ? 'The gate is open!' : 'Find three sparks and light both relics.', 3200);
}
if (usable(saved)) {
  el('cover-world').textContent = 'World ' + (saved.world + 1) + ' of 10 · ' + worlds[saved.world].name;
  el('start').textContent = saved.finished ? 'View trail result' : 'Continue adventure';
  el('save-hint').textContent = 'Saved in ' + worlds[saved.world].name;
}
el('start').onclick = enter;
function burst(cell, color) {
  const [x, y] = center(cell);
  for (let i = 0; i < 14; i++) {
    const a = i * 0.449;
    effect.push({
      x,
      y: y - 5,
      vx: Math.cos(a) * (8 + (i % 3) * 8),
      vy: Math.sin(a) * 18 - 12,
      life: 0.52,
      color,
    });
  }
}
function cast(preferred) {
  if (!active || trail.finished || el('modal').open) return;
  const cell = preferred ?? nearby();
  if (cell === undefined) {
    burst(trail.cell, worlds[trail.world].fire);
    note(294, 0.09);
    notice(trail.a.length === 2 ? 'Both relics are awake.' : 'Tap a relic, or move beside it to cast fire.');
    return;
  }
  trail.a.push(cell);
  fireArc = { from: trail.cell, to: cell, progress: 0 };
  burst(cell, worlds[trail.world].fire);
  note(392);
  note(588, 0.2, 0.09);
  hud();
  keep();
  notice(
    ready()
      ? 'The gate is open!'
      : worlds[trail.world].relic.replace(/^./, (s) => s.toUpperCase()) + ' awakened!',
  );
}
el('cast').onclick = () => {
  cast();
  el('field').focus({ preventScroll: true });
};
function record() {
  return {
    world: trail.world,
    id: trail.id,
    steps: trail.steps,
    moths: trail.m.length,
    score: points(trail.m.length, trail.steps),
    alias: trail.alias,
  };
}
function remember() {
  const r = record();
  records = [...records.filter((e) => e.id !== r.id), r].sort((a, b) => b.score - a.score);
  records = worlds.flatMap((_, i) => records.filter((e) => e.world === i).slice(0, 10));
  store('records', records);
}
function land() {
  for (const type of ['s', 'm']) {
    if (tiles[type].includes(trail.cell) && !trail[type].includes(trail.cell)) {
      trail[type].push(trail.cell);
      burst(trail.cell, type === 's' ? '#ffdc94' : '#b8edd8');
      note(type === 's' ? 554 : 880);
      note(type === 's' ? 740 : 1108, 0.16, 0.08);
      notice(
        ready()
          ? 'The gate is open!'
          : type === 's'
            ? 'Ember spark · ' + trail.s.length + ' / 3'
            : 'Moon moth · ' + trail.m.length + ' / 3',
      );
    }
  }
  if (targetRelic !== undefined && trail.cell === targetRelic) {
    const relic = targetRelic;
    targetRelic = undefined;
    if (!trail.a.includes(relic)) cast(relic);
  }
  if (trail.cell === tiles.p) {
    if (ready()) {
      trail.finished = true;
      path = [];
      keys = [];
      remember();
      keep();
      hud();
      note(523);
      note(659, 0.18, 0.12);
      note(784, 0.3, 0.24);
      report();
      return;
    } else notice('The gate needs three sparks and two awakened relics.');
  } else if (nearby() !== undefined && !trail.a.includes(trail.cell))
    notice('Cast fire to wake the ' + worlds[trail.world].relic + '.');
  hud();
  keep();
}
// Tall relics and gates extend above their tile. Touching the visible sprite
// should select it, even when its crown is in the row above its base.
function targetAt(px, py) {
  const column = Math.floor(px / TILE_W),
    row = Math.floor((py - HORIZON) / TILE_H);
  const base = column >= 0 && column < WIDTH && row >= 0 && row < HEIGHT ? row * WIDTH + column : undefined;
  const candidates = [
    tiles.p,
    ...tiles.a,
    ...tiles.s.filter((n) => !trail.s.includes(n)),
    ...tiles.m.filter((n) => !trail.m.includes(n)),
  ];
  let target = base,
    best = Infinity;
  for (const n of candidates) {
    const [x, y] = center(n),
      tall = n === tiles.p || tiles.a.includes(n);
    const distance = Math.hypot((px - x) / (tall ? 11 : 8), (py - y + (tall ? 8 : 3)) / (tall ? 15 : 9));
    if (distance <= 1 && distance < best) {
      target = n;
      best = distance;
    }
  }
  return target;
}
el('field').onpointerdown = (e) => {
  if (!e.isPrimary || e.button !== 0 || !active || trail.finished || el('modal').open) return;
  const b = el('field').getBoundingClientRect();
  const target = targetAt(((e.clientX - b.left) * W) / b.width, ((e.clientY - b.top) * H) / b.height);
  if (target === undefined) return;
  if (tiles['#'].includes(target)) {
    notice('Try the ground beside it.');
    return;
  }
  keys = [];
  inputSteps = [];
  targetRelic = tiles.a.includes(target) && !trail.a.includes(target) ? target : undefined;
  if (targetRelic !== undefined && !step && distance(trail.cell, targetRelic) <= 1) {
    path = [];
    cast(targetRelic);
    targetRelic = undefined;
  } else {
    path = pathTo(step?.to ?? trail.cell, target, tiles['#']);
  }
  el('field').focus({ preventScroll: true });
};
const dirs = {
  ArrowLeft: -1,
  a: -1,
  ArrowRight: 1,
  d: 1,
  ArrowUp: -WIDTH,
  w: -WIDTH,
  ArrowDown: WIDTH,
  s: WIDTH,
};
function keyName(e) {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}
window.addEventListener('keydown', (e) => {
  if (!active || trail.finished || el('modal').open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('button,a,select,input') && e.code === 'Space') return;
  const k = keyName(e);
  if (Object.hasOwn(dirs, k)) {
    e.preventDefault();
    if (!keys.includes(k)) {
      keys.push(k);
      inputSteps.push(k);
    }
    targetRelic = undefined;
    path = [];
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) cast();
  }
});
window.addEventListener('keyup', (e) => {
  keys = keys.filter((k) => k !== keyName(e));
});
window.addEventListener('blur', () => {
  keys = [];
  inputSteps = [];
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys = [];
    inputSteps = [];
  }
});
function move(dt) {
  if (!step) {
    let next;
    if (inputSteps.length || keys.length) {
      const direction = inputSteps.shift() ?? keys[keys.length - 1];
      const n = trail.cell + dirs[direction];
      if (n >= 0 && n < WIDTH * HEIGHT && distance(n, trail.cell) === 1 && !tiles['#'].includes(n)) next = n;
    } else next = path.shift();
    if (next === undefined) return;
    if (next % WIDTH !== trail.cell % WIDTH) flip = next % WIDTH < trail.cell % WIDTH;
    step = { from: trail.cell, to: next, t: 0 };
  }
  step.t += dt * 6.6;
  if (step.t >= 1) {
    trail.cell = step.to;
    trail.steps++;
    step = null;
    land();
  }
}
function render(t, dt) {
  const w = worlds[trail.world];
  ctx.drawImage(ground, 0, 0, W, H);
  let [x, y] = center(trail.cell);
  if (step) {
    const [tx, ty] = center(step.to);
    x += (tx - x) * step.t;
    y += (ty - y) * step.t;
  }
  if (path.length) {
    ctx.fillStyle = '#fff1b9bc';
    for (const cell of path) {
      const [mx, my] = center(cell);
      ctx.fillRect(mx - 1, my + 1, 2, 1.5);
    }
    const [mx, my] = center(path[path.length - 1]);
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(mx, my + 1, 4, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const actors = [{ y: center(tiles.p)[1], draw: () => portal(ctx, ...center(tiles.p), ready(), t, w) }];
  for (const n of tiles['#']) actors.push({ y: center(n)[1], draw: () => obstacle(ctx, n, trail.world, w) });
  for (const n of tiles.s)
    if (!trail.s.includes(n)) actors.push({ y: center(n)[1], draw: () => spark(ctx, ...center(n), t) });
  for (const n of tiles.m)
    if (!trail.m.includes(n)) actors.push({ y: center(n)[1], draw: () => moth(ctx, ...center(n), t) });
  for (const n of tiles.a)
    actors.push({
      y: center(n)[1],
      draw: () => altar(ctx, ...center(n), trail.world, trail.a.includes(n), t, w),
    });
  actors.push({ y, draw: () => cubSprite(ctx, x, y, trail.world, t, !!step, flip) });
  actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
  if (!reduced.matches) glints(ctx, w, t);
  for (const p of effect) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += dt * 32;
    ctx.fillStyle = p.color;
    if (!reduced.matches) ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  effect = effect.filter((p) => p.life > 0);
  if (fireArc) {
    fireArc.progress = Math.min(1, fireArc.progress + dt * 3.2);
    if (!reduced.matches) castTrail(ctx, fireArc.from, fireArc.to, fireArc.progress, w.fire);
    if (fireArc.progress === 1) fireArc = null;
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.08, (now - last) / 1000);
  last = now;
  if (active && !document.hidden) {
    if (!trail.finished && !el('modal').open) move(dt);
    render(reduced.matches ? 1 : now / 1000, dt);
    if (now > noticeUntil && el('toast').textContent) el('toast').textContent = '';
  }
  requestAnimationFrame(frame);
}
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function dialog(kind, kicker, title) {
  dialogKind = kind;
  dialogToken++;
  keys = [];
  inputSteps = [];
  el('modal-kicker').textContent = kicker;
  el('modal-title').textContent = title;
  el('modal-content').replaceChildren();
  el('actions').replaceChildren();
  if (!el('modal').open) el('modal').showModal();
  return el('modal-content');
}
function action(text, fn, primary = false) {
  const b = element('button', text);
  if (primary) b.className = 'primary';
  b.onclick = fn;
  el('actions').append(b);
  return b;
}
function closeDialog() {
  dialogToken++;
  el('modal').close();
  dialogKind = '';
  if (active) el('field').focus({ preventScroll: true });
}
function back() {
  if (dialogKind !== 'report' && active && trail.finished) report();
  else closeDialog();
}
el('modal').addEventListener('cancel', (e) => {
  e.preventDefault();
  if (dialogKind !== 'report') back();
});
el('restart').onclick = () => {
  const body = dialog('restart', 'Adventure', 'Start over?');
  body.append(
    element(
      'p',
      'Return to Lantern Wood with a fresh trail. Your discovered forms and best scores stay in the journal.',
    ),
  );
  action('Keep exploring', back);
  action(
    'Restart adventure',
    () => {
      closeDialog();
      trail = fresh(0);
      enter();
    },
    true,
  );
};
function selectField(label, options, selected) {
  const wrapper = element('label', label),
    select = document.createElement('select');
  for (const [value, name] of options) select.add(new Option(name, value));
  select.value = selected;
  wrapper.append(select);
  return [wrapper, select];
}
function report() {
  const final = trail.world === 9,
    w = worlds[trail.world],
    r = record();
  const body = dialog(
    'report',
    final ? 'Adventure complete' : 'Trail complete',
    final ? 'The Everheart burns again' : w.name + ' restored',
  );
  const next = final ? trail.world : trail.world + 1;
  const reveal = element('div', '');
  reveal.className = 'reveal';
  reveal.style.setProperty('--fire', worlds[next].fire);
  reveal.append(portrait(next));
  const caption = element('div', '');
  caption.append(
    element('small', final ? 'Final fire form' : 'Next fire form'),
    element('strong', worlds[next].form),
  );
  reveal.append(caption);
  body.append(reveal);
  const score = element('p', r.score + ' points');
  score.className = 'score';
  body.append(score);
  body.append(
    element(
      'p',
      r.moths +
        ' / 3 moon moths · ' +
        r.steps +
        ' steps. ' +
        (final ? 'Leo carries the Eternal Flame.' : 'Beyond the gate lies ' + worlds[next].name + '.'),
    ),
  );
  const [label, sel] = selectField(
    'Trail alias',
    aliases.map((a) => [a, a]),
    trail.alias,
  );
  body.append(label);
  sel.disabled = trail.shared;
  sel.onchange = () => {
    trail.alias = sel.value;
    remember();
    keep();
  };
  const status = element(
    'p',
    trail.shared
      ? 'Posted to the world board.'
      : storageAvailable
        ? 'Score saved on this device.'
        : 'Score kept for this session.',
  );
  status.setAttribute('role', 'status');
  body.append(status);
  const onward = action(
    final ? 'Play again' : 'Enter next world',
    () => {
      closeDialog();
      trail = fresh(final ? 0 : trail.world + 1);
      known = Math.max(known, trail.world + 1);
      store('known', known);
      enter();
    },
    true,
  );
  const share = action('Post score', async () => {
    const snapshot = record(),
      token = dialogToken;
    share.disabled = true;
    sel.disabled = true;
    onward.disabled = true;
    rankings.disabled = true;
    status.textContent = 'Posting…';
    try {
      const postedAlias = await publish(snapshot);
      if (trail.id === snapshot.id) {
        trail.alias = postedAlias;
        sel.value = postedAlias;
        remember();
        trail.shared = true;
        keep();
      }
      if (dialogToken === token) status.textContent = 'Posted to the world board.';
    } catch {
      if (dialogToken === token) {
        status.textContent = 'Could not reach the world board. Your local score is safe. Try again.';
        share.disabled = false;
        sel.disabled = false;
      }
    } finally {
      onward.disabled = false;
      rankings.disabled = false;
    }
  });
  share.disabled = trail.shared;
  const rankings = action('Rankings', () => openBoard(trail.world));
}
function listScores(container, rows, empty) {
  if (!rows.length) {
    container.append(element('p', empty));
    return;
  }
  const ol = document.createElement('ol');
  for (const r of rows) {
    const li = element('li', r.alias);
    li.append(element('b', r.score + ' pts'));
    ol.append(li);
  }
  container.append(ol);
}
function openBoard(index) {
  boardWorld = index;
  const body = dialog('board', 'Trail rankings', 'The ember ledger'),
    token = dialogToken;
  const [wrap, select] = selectField(
    'World',
    worlds.map((w, i) => [String(i), w.name]),
    String(index),
  );
  body.append(wrap);
  select.onchange = () => openBoard(Number(select.value));
  body.append(
    element(
      'p',
      'Each gate earns 500 points. Each moon moth adds 150. Finish in under 100 steps to earn one extra point for each step saved.',
    ),
  );
  body.append(element('h3', storageAvailable ? 'On this device' : 'This session'));
  listScores(
    body,
    records.filter((r) => r.world === index),
    'Complete this trail to set a score.',
  );
  body.append(element('h3', 'World top 10'));
  const remote = document.createElement('div');
  remote.setAttribute('aria-live', 'polite');
  remote.textContent = 'Gathering scores…';
  body.append(remote);
  leaders(index)
    .then((rows) => {
      if (dialogToken === token) {
        remote.replaceChildren();
        listScores(remote, rows, 'The first place on this trail is still open.');
      }
    })
    .catch(() => {
      if (dialogToken === token) {
        remote.textContent = 'World board unavailable. ';
        const retry = element('button', 'Try again');
        retry.onclick = () => openBoard(index);
        remote.append(retry);
      }
    });
  action('Back', back, true);
}
el('ranks').onclick = () => openBoard(active ? trail.world : boardWorld);
soundLabel();
journal();
