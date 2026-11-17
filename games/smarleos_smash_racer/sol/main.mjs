import { CIRCUITS, RACERS, INPUT, STEP, createRace, position, result, step } from './sim.mjs';
import { RaceView, drawMap, spriteURL } from './render.mjs';
import { RaceSound } from './audio.mjs';
import { ALIASES, top, submit } from './board.mjs';
import { FACES, MOVES, createCube, faceColors, solved, turn } from './cube.mjs';

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const integers = new Intl.NumberFormat('de-CH');
const count = value => integers.format(value);
const clock = ms => {
  const seconds = Math.floor(ms / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0') + '.' + String(ms % 1000).padStart(3,'0');
};
const saveKey = 'smarleos.sol.v1';
const storage = (() => {
  try { return JSON.parse(localStorage.getItem(saveKey)) || {}; }
  catch { return {}; }
})();
const preferences = {
  racer: RACERS.find(r => r.id === storage.racer) ?? RACERS[0],
  course: CIRCUITS.find(c => c.id === storage.course) ?? CIRCUITS[0],
  mode: storage.mode === 'pro' ? 'pro' : 'crew',
  sound: storage.sound !== false,
  reduced: storage.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
  alias: ALIASES.includes(storage.alias) ? storage.alias : ALIASES[0],
  best: typeof storage.best === 'object' && storage.best ? storage.best : {},
};
function save() {
  try { localStorage.setItem(saveKey, JSON.stringify({ ...preferences, racer: preferences.racer.id, course: preferences.course.id })); }
  catch { /* Settings are still retained for the open game. */ }
}

function el(tag, text, style) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (style) node.className = style;
  return node;
}
function option(label, value = label) {
  const node = el('option', label);
  node.value = value;
  return node;
}
function pressed(button, value) { button.setAttribute('aria-pressed', String(value)); }
function show(id) { if (!$(id).open) $(id).showModal(); }
const audio = new RaceSound(preferences.sound);

function createGarage() {
  for (const racer of RACERS) {
    const button = el('button',undefined,'racer-card');
    button.type = 'button';
    button.dataset.id = racer.id;
    const img = el('img');
    img.src = spriteURL(racer.id);
    img.alt = '';
    img.width = img.height = 44;
    button.append(img,el('span',racer.name));
    button.addEventListener('click',() => { preferences.racer = racer; refreshGarage(); save(); });
    $('racers').append(button);
  }
  for (const course of CIRCUITS) {
    const button = el('button',undefined,'course-card');
    button.type = 'button';
    button.dataset.id = course.id;
    const canvas = el('canvas');
    canvas.width = 100;
    canvas.height = 80;
    canvas.setAttribute('aria-hidden','true');
    drawMap(canvas,course);
    const info = el('span');
    info.append(el('strong',course.name),el('small',course.type));
    button.append(canvas,info);
    button.addEventListener('click',() => { preferences.course = course; refreshGarage(); save(); });
    $('courses').append(button);
    $('board-course').append(option(course.name,course.id));
  }
  for (const name of ALIASES) $('alias').append(option(name));
  $('alias').value = preferences.alias;
  for (const button of all('[data-mode]')) button.addEventListener('click',() => {
    preferences.mode = button.dataset.mode;
    refreshGarage();
    save();
  });
  refreshGarage();
}

function refreshGarage() {
  for (const button of all('.racer-card')) pressed(button,button.dataset.id === preferences.racer.id);
  for (const button of all('.course-card')) pressed(button,button.dataset.id === preferences.course.id);
  for (const button of all('[data-mode]')) pressed(button,button.dataset.mode === preferences.mode);
  const r = preferences.racer;
  const text = el('div');
  const name = el('strong',r.move);
  name.style.color = r.color;
  text.append(name,el('p',r.desc));
  const meters = el('div',undefined,'spec-meters');
  for (const [label,value,max] of [['Tempo',r.speed-155,83],['Grip',r.grip-.55,.77],['Panzer',r.armor-.5,1]]) {
    const line = el('div');
    const meter = el('meter');
    meter.max = max;
    meter.value = value;
    meter.style.setProperty('--meter',r.color);
    meter.setAttribute('aria-label',label);
    line.append(el('span',label),meter);
    meters.append(line);
  }
  $('racer-spec').replaceChildren(text,meters);
  const best = preferences.best[preferences.course.id + ':' + preferences.mode];
  $('course-notes').textContent = preferences.course.map + (best ? ' · Bestwert ' + count(best.score) : '');
}

const hud = Object.fromEntries(['place','lap','time','points','speed','health','nitro','charge','charge-name','special-meter','touch-special','race-message'].map(id => [id,$(id)]));
const keyboard = new Map(Object.entries({
  ArrowLeft: INPUT.left, KeyA: INPUT.left, ArrowRight: INPUT.right, KeyD: INPUT.right,
  ArrowDown: INPUT.drift, KeyS: INPUT.drift, ShiftLeft: INPUT.boost, ShiftRight: INPUT.boost, KeyX: INPUT.boost,
  Space: INPUT.jump, ArrowUp: INPUT.jump, KeyE: INPUT.special, Enter: INPUT.special, KeyF: INPUT.fire, KeyZ: INPUT.fire,
}));
const keys = new Set();
const pointers = new Map();
let taps = 0;
let race, view, finalRecord;
let phase = 'garage';
let lastFrame = 0, accumulator = 0, countdown = 0, countShown = 0, noticeUntil = 0;
let frameId = 0;
let raceWarmup = false;
const notices = {
  hit: 'Treffer!', pit: 'Boxenstopp · Reparatur', pass: 'Überholmanöver!', oil: 'Öl auf der Strecke!',
  lap: 'Letzte Runde!', pickup: { cell:'Nitro +', repair:'Reparatur +', shield:'Schild!', pad:'Turbo!', ramp:'Sprung!', ring:'Bonusring +280' },
};

function updateSound() {
  $('sound').textContent = preferences.sound ? 'Ton an' : 'Ton aus';
  pressed($('sound'),preferences.sound);
  pressed($('race-sound'),preferences.sound);
}
function toggleSound() {
  preferences.sound = !preferences.sound;
  audio.set(preferences.sound);
  updateSound();
  save();
}

function clearInput() {
  keys.clear();
  pointers.clear();
  taps = 0;
  for (const button of all('.touch .held')) button.classList.remove('held');
}
function inputMask() {
  let mask = taps;
  taps = 0;
  for (const code of keys) mask |= keyboard.get(code);
  for (const button of pointers.values()) mask |= INPUT[button.dataset.input];
  return mask;
}
function active() { return phase === 'countdown' || phase === 'racing'; }
let beforePause;
function pause() {
  if (!active()) return;
  beforePause = phase;
  phase = 'paused';
  cancelAnimationFrame(frameId);
  audio.stop();
  clearInput();
  show('paused');
}
function resume() {
  if (phase !== 'paused') return;
  $('paused').close();
  phase = beforePause;
  lastFrame = 0;
  clearInput();
  audio.unlock();
  frameId = requestAnimationFrame(frame);
}

function launch(warmed = false) {
  for (const dialog of all('dialog[open]')) dialog.close();
  cancelAnimationFrame(frameId);
  clearInput();
  audio.unlock();
  audio.stop();
  raceWarmup = warmed;
  race = createRace(preferences.course.id,preferences.racer.id,preferences.mode,warmed);
  $('pit').hidden = true;
  $('race').hidden = false;
  document.body.style.overflow = 'hidden';
  view = new RaceView($('track'),$('minimap'),race);
  $('race-track').textContent = race.circuit.name;
  hud['charge-name'].textContent = race.racer.move;
  hud['charge-name'].title = race.racer.move;
  countdown = 2.65;
  countShown = 0;
  noticeUntil = 0;
  finalRecord = null;
  accumulator = 0;
  lastFrame = 0;
  phase = 'countdown';
  hud['race-message'].className = '';
  updateHud();
  frameId = requestAnimationFrame(frame);
}

function goGarage() {
  phase = 'garage';
  cancelAnimationFrame(frameId);
  for (const dialog of all('dialog[open]')) dialog.close();
  audio.stop();
  clearInput();
  $('race').hidden = true;
  $('pit').hidden = false;
  document.body.style.overflow = '';
  refreshGarage();
  $('start').focus({ preventScroll: true });
}

function updateHud() {
  const r = race;
  hud.place.textContent = position(r);
  hud.lap.textContent = Math.min(r.circuit.laps, Math.floor(r.distance/r.circuit.length)+1) + '/' + r.circuit.laps;
  hud.time.textContent = clock(Math.round(r.tick*1000/60));
  hud.points.textContent = count(r.points);
  hud.speed.textContent = String(Math.round(r.speed * 1.03)).padStart(3,'0');
  hud.health.value = r.hp;
  hud.health.classList.toggle('low',r.hp < 38);
  hud.nitro.value = r.nitro;
  hud.charge.value = r.special;
  hud['special-meter'].classList.toggle('ready',r.special >= 99.9);
  hud['touch-special'].classList.toggle('ready',r.special >= 99.9);
}

function announce(text, ticks, status = 'notice') {
  hud['race-message'].textContent = text;
  hud['race-message'].className = status;
  noticeUntil = race.tick + ticks;
}
function onEvent(event) {
  view.react(event,preferences.reduced);
  audio.fx(event.type);
  if (event.type === 'special') announce(race.racer.move,96);
  else if (event.type === 'smash') {
    if (event.combo > 1) announce('SMASH ×' + event.combo + '   +' + event.points,57);
    else announce('SMASH +' + event.points,38);
  } else if (event.type === 'pickup') announce(notices.pickup[event.object.kind],59);
  else if (notices[event.type]) announce(notices[event.type],event.type === 'pit' ? 120 : 65);
}

function frame(now) {
  if (!active()) return;
  const delta = lastFrame ? Math.min(.12,(now-lastFrame)/1000) : 1/60;
  lastFrame = now;
  if (phase === 'countdown') {
    countdown -= delta;
    const number = Math.ceil(countdown);
    if (number > 0 && countShown !== number) {
      countShown = number;
      hud['race-message'].textContent = String(number);
      audio.fx('ready');
    }
    if (countdown <= 0) {
      phase = 'racing';
      audio.fx('go');
      announce('Los!',45,'');
    }
  } else {
    accumulator += delta;
    while (accumulator >= STEP && !race.finished) {
      step(race,inputMask());
      for (const event of race.events) onEvent(event);
      accumulator -= STEP;
    }
    if (race.tick >= noticeUntil) hud['race-message'].textContent = '';
    updateHud();
    audio.update(race);
  }
  view.draw(preferences.reduced,delta);
  if (race.finished) finish();
  else frameId = requestAnimationFrame(frame);
}

function finish() {
  phase = 'finished';
  audio.stop();
  clearInput();
  const score = result(race);
  const key = race.circuit.id + ':' + race.mode;
  const prev = preferences.best[key];
  const best = !score.timeout && (!prev || score.score > prev.score || (score.score === prev.score && score.time < prev.time));
  if (best) {
    preferences.best[key] = { score:score.score, time:score.time };
    save();
  }
  $('finish-title').textContent = score.timeout ? 'Zeit abgelaufen' : 'Im Ziel';
  $('finish-place').textContent = score.timeout ? '–' : score.place + '.';
  $('finish-run').replaceChildren(
    el('span',race.circuit.name + ' · ' + (race.mode === 'crew' ? 'Crew' : 'Pro')),
    el('small',race.racer.name + ' · ' + clock(score.time) + (best ? ' · Neuer Bestwert' : '')),
  );
  const finishRows = [
    ['Smash-Punkte / Serie',count(score.smashPoints) + ' / ×' + Math.max(1,score.combo)],
    ['Platz, Zeit & Zustand','+' + count(score.racePoints + score.timePoints + score.clean)],
    ['Boxenstopps',score.pits ? '−' + count(score.pits * 500) : '0'],
    ['Gesamtpunktzahl',count(score.score)],
  ];
  $('finish-stats').replaceChildren(...finishRows.flatMap(([label,value]) => [el('dt',label),el('dd',value)]));
  $('submit-score').hidden = score.timeout;
  $('submit-score').querySelector('button').disabled = false;
  $('alias').disabled = false;
  $('finish-status').textContent = score.timeout ? 'Für die Weltrangliste zählt ein vollständiges Rennen.' : '';
  finalRecord = { ...score, course:race.circuit.id, mode:race.mode, racer:race.racer.id, id:crypto.randomUUID() };
  show('finish');
}

let boardRequest = 0;
let boardReturn = '';
async function refreshBoard() {
  const id = ++boardRequest;
  const course = $('board-course').value, mode = $('board-mode').value;
  $('board-status').textContent = 'Lade Fahrerfeld …';
  $('board-list').replaceChildren();
  try {
    const rows = await top(course,mode);
    if (id !== boardRequest) return;
    $('board-status').textContent = rows.length ? 'Die besten ' + rows.length + ' Rennläufe' : 'Hier steht noch kein Rennlauf. Schnapp dir den ersten Platz!';
    $('board-list').replaceChildren(...rows.map((row,index) => {
      const li = el('li');
      const name = el('div');
      name.append(el('b',row.playerName),el('small',RACERS.find(r => r.id === row.racer).name));
      li.append(el('span',String(index+1).padStart(2,'0')),name,el('span',clock(row.time)),el('strong',count(row.score)));
      return li;
    }));
  } catch {
    if (id === boardRequest) $('board-status').textContent = 'Weltrangliste gerade nicht erreichbar. Erneut öffnen zum Wiederholen.';
  }
}
function openBoard(fromFinish = false) {
  boardReturn = fromFinish ? 'finish' : '';
  if (fromFinish) $('finish').close();
  $('board-course').value = preferences.course.id;
  $('board-mode').value = preferences.mode;
  show('board');
  refreshBoard();
}

$('submit-score').addEventListener('submit',async event => {
  event.preventDefault();
  const record = finalRecord;
  if (!record || record.timeout) return;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  $('alias').disabled = true;
  const playerName = $('alias').value;
  $('finish-status').textContent = 'Rennlauf wird eingetragen …';
  try {
    await submit({ ...record, playerName });
    if (record === finalRecord) $('finish-status').textContent = 'Dein Rennlauf steht in der Weltrangliste.';
  } catch {
    if (record !== finalRecord) return;
    $('finish-status').textContent = 'Speichern fehlgeschlagen. Probier es nochmals.';
    button.disabled = false;
    $('alias').disabled = false;
  }
});
$('alias').addEventListener('change', () => { preferences.alias = $('alias').value; save(); });
$('board').addEventListener('close',() => {
  boardRequest++;
  if (boardReturn && phase === 'finished') show(boardReturn);
  boardReturn = '';
});
$('board-course').addEventListener('change',refreshBoard);
$('board-mode').addEventListener('change',refreshBoard);

let puzzle, history;
function scramble(size) {
  puzzle = createCube(size);
  history = [];
  for (let i = 0; i < (size === 2 ? 3 : 8); i++) {
    const options = MOVES.filter(move => move !== history.at(-1)?.[0]);
    const move = options[Math.floor(Math.random()*options.length)];
    const direction = Math.random() < .5 ? -1 : 1;
    turn(puzzle,move,direction);
    history.push([move,direction]);
  }
  drawCube();
}
function drawCube() {
  $('cube-net').replaceChildren(...FACES.map(face => {
    const grid = el('div',undefined,'cube-face');
    grid.style.gridArea = face.grid.join(' / ');
    grid.style.gridTemplateColumns = 'repeat(' + puzzle.size + ', 1fr)';
    const colors = faceColors(puzzle,face).map(id => FACES.find(f => f.id === id));
    grid.setAttribute('aria-label',face.name + ': ' + colors.map(c => c.id).join(' '));
    for (const item of colors) {
      const tile = el('span');
      tile.style.background = item.color;
      grid.append(tile);
    }
    return grid;
  }));
  for (const button of all('[data-size]')) pressed(button,Number(button.dataset.size) === puzzle.size);
  $('cube-note').textContent = 'Drehe die Seiten, bis jede Seite eine Farbe hat.' + (preferences.mode === 'crew' ? ' Das füllt den Nitro-Tank.' : ' Im Pro-Modus gelten gleiche Startwerte.');
  $('cube-status').textContent = solved(puzzle) ? (preferences.mode === 'crew' ? 'Gelöst! Nitro-Tank voll.' : 'Würfel gelöst!') : '';
  $('cube-hint').disabled = history.length === 0;
}
for (const move of MOVES) for (const direction of [-1,1]) {
  const face = FACES.find(f => f.id === move);
  const button = el('button',face.name + (direction === -1 ? ' ↻' : ' ↺'),'secondary');
  button.type = 'button';
  button.addEventListener('click',() => {
    turn(puzzle,move,direction);
    history.push([move,direction]);
    drawCube();
  });
  $('cube-turns').append(button);
}
for (const button of all('[data-size]')) button.addEventListener('click',() => scramble(Number(button.dataset.size)));
$('cube-hint').addEventListener('click',() => {
  const previous = history.pop();
  if (previous) turn(puzzle,previous[0],-previous[1]);
  drawCube();
});
$('warmup').addEventListener('click',() => { scramble(2); show('cube'); });
$('cube-go').addEventListener('click',() => launch(solved(puzzle)));

for (const button of all('[data-open]')) button.addEventListener('click',() => {
  if (button.dataset.open === 'board') openBoard();
  else show(button.dataset.open);
});
for (const button of all('[data-close]')) button.addEventListener('click',() => button.closest('dialog').close());
$('start').addEventListener('click',() => launch());
$('quick-start').addEventListener('click',() => launch());
$('again').addEventListener('click',() => launch(raceWarmup));
$('restart').addEventListener('click',() => launch(raceWarmup));
$('finish-back').addEventListener('click',goGarage);
$('finish-board').addEventListener('click',() => openBoard(true));
$('quit').addEventListener('click',goGarage);
$('pause').addEventListener('click',pause);
$('resume').addEventListener('click',resume);
$('sound').addEventListener('click',toggleSound);
$('race-sound').addEventListener('click',toggleSound);
$('paused').addEventListener('cancel',event => { event.preventDefault(); resume(); });
$('finish').addEventListener('cancel',event => { event.preventDefault(); goGarage(); });
$('reduced').checked = preferences.reduced;
$('reduced').addEventListener('change',() => { preferences.reduced = $('reduced').checked; save(); });

window.addEventListener('keydown',event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if ((event.code === 'KeyP' || event.code === 'Escape') && active()) {
    event.preventDefault();
    pause();
    return;
  }
  if (event.code === 'KeyP' && phase === 'paused' && !event.repeat) { resume(); return; }
  if (!active()) return;
  if (event.code === 'KeyM' && !event.repeat) toggleSound();
  if (!keyboard.has(event.code)) return;
  if (event.target instanceof HTMLButtonElement && ['Enter','Space'].includes(event.code)) return;
  event.preventDefault();
  if (!keys.has(event.code)) taps |= keyboard.get(event.code);
  keys.add(event.code);
});
window.addEventListener('keyup',event => keys.delete(event.code));
window.addEventListener('blur',() => { if (active()) pause(); });
document.addEventListener('visibilitychange',() => { if (document.hidden && active()) pause(); });

for (const button of all('[data-input]')) {
  button.addEventListener('pointerdown',event => {
    if (!active() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,button);
    taps |= INPUT[button.dataset.input];
    button.classList.add('held');
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name,event => {
    pointers.delete(event.pointerId);
    if (![...pointers.values()].includes(button)) button.classList.remove('held');
  });
}
createGarage();
updateSound();
