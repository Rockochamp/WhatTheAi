import { Flight, PHASE_COOLDOWN, SECTORS, clamp } from './engine.js';
import { readRecords, addRecord, fetchGlobalRecords, saveGlobalRecord, isLiveSite } from './records.js';

const $ = id => document.getElementById(id);
const canvas = $('space');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const pref = (key, fallback) => { try { return storage.getItem(key) ?? fallback; } catch { return fallback; } };
const setPref = (key, value) => { try { storage.setItem(key, value); } catch { /* Gameplay works without storage. */ } };
const formatScore = value => Math.floor(value).toLocaleString('en-US');
const formatTime = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
let flight = new Flight();
let records = readRecords(storage);
let pilot = pref('cosmic_dodge_astra_pilot', '');
let runId = '';
let board = 'local';
let boardRequest = 0;
let recordGeneration = 0;
let target = null;
let pointerId = null;
let keys = new Set();
let accumulator = 0;
let lastTime = 0;
let clock = 0;
let hudTimer = 0;
let flash = 0;
let messageUntil = 0;
let particles = [];
let labels = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stars = Array.from({ length: 150 }, (_, index) => ({ x: (Math.sin(index * 127.1 + 19) * 43758.5453) % 1, y: (Math.cos(index * 311.7) * 15731.743) % 1, size: index % 8 === 0 ? 1.7 : .7, layer: (index % 3 + 1) / 3 }));
let sound = pref('cosmic_dodge_astra_sound', 'false') === 'true';
let audioContext;
function activateAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audioContext && Audio) audioContext = new Audio();
    audioContext?.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}
function tone(frequency, duration = .12, shape = 'sine', volume = .025, end = frequency) {
  if (!sound || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = shape;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), audioContext.currentTime + duration);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function soundUI() {
  $('sound-button').setAttribute('aria-pressed', String(sound));
  $('sound-label').textContent = sound ? 'Sound on' : 'Sound off';
}
function showBoard(items, status) {
  $('leaderboard').replaceChildren();
  items.slice(0, 5).forEach((record, index) => {
    const item = document.createElement('li');
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span'); name.className = 'pilot'; name.textContent = record.playerName;
    const score = document.createElement('span'); score.className = 'points'; score.textContent = formatScore(record.score);
    item.append(rank, name, score); $('leaderboard').append(item);
  });
  $('board-status').textContent = status;
}
async function renderBoard() {
  const request = ++boardRequest;
  $('personal-best').textContent = records.length ? formatScore(records[0].score) : '—';
  $('personal-best-caption').textContent = records.length ? `${records[0].playerName} · ${formatTime(records[0].elapsed)} in flight` : 'Your first flight is waiting.';
  $('local-tab').classList.toggle('active', board === 'local');
  $('global-tab').classList.toggle('active', board === 'global');
  $('local-tab').setAttribute('aria-pressed', String(board === 'local'));
  $('global-tab').setAttribute('aria-pressed', String(board === 'global'));
  if (board === 'local') { showBoard(records, records.length ? 'Top flights on this device · Astra edition' : 'Your top 5 flights appear here.'); return; }
  if (!isLiveSite()) { showBoard([], 'Worldwide scores connect on whatthe.ai. Preview flights stay on this device.'); return; }
  showBoard([], 'Connecting to the worldwide flight log…');
  try {
    const global = await fetchGlobalRecords();
    if (request === boardRequest) showBoard(global, global.length ? 'Worldwide · GPT-6 Astra flights only' : 'No flights yet. Set the first record.');
  } catch {
    if (request === boardRequest) showBoard([], 'Worldwide log unavailable. You can still play and save locally. Tap Worldwide to retry.');
  }
}
function showOverlay(view) {
  stage.dataset.state = flight.status;
  $('overlay').hidden = !view;
  for (const name of ['start', 'result', 'pause']) $(`${name}-content`).hidden = name !== view;
  $('pause-button').disabled = !['playing', 'paused'].includes(flight.status);
  $('pause-button').setAttribute('aria-label', flight.status === 'paused' ? 'Resume flight' : 'Pause flight');
  $('pause-button').querySelector('span').textContent = flight.status === 'paused' ? 'Resume' : 'Pause';
  $('fullscreen-pause').textContent = flight.status === 'paused' ? 'Resume' : 'Pause';
  $('fullscreen-pause').disabled = !['playing', 'paused'].includes(flight.status);
  $('stage-pause').hidden = !['playing', 'paused'].includes(flight.status);
  $('stage-pause').setAttribute('aria-label', flight.status === 'paused' ? 'Resume flight' : 'Pause flight');
  $('stage-pause').textContent = flight.status === 'paused' ? '▷' : 'Ⅱ';
  updateHUD();
}
function clearInput() {
  keys.clear(); target = null;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  pointerId = null;
}
function startFlight() {
  const width = flight.width, height = flight.height;
  const seedArray = new Uint32Array(1);
  crypto.getRandomValues(seedArray);
  flight = new Flight({ width, height, seed: seedArray[0] });
  runId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${seedArray[0]}`;
  recordGeneration++;
  particles = []; labels = []; flash = 0; accumulator = 0; messageUntil = 0;
  clearInput(); activateAudio();
  flight.start(); showOverlay(null); canvas.focus({ preventScroll: true });
  tone(240, .3, 'sine', .04, 640);
}
function pauseFlight() {
  if (flight.status !== 'playing') return;
  flight.pause(); clearInput(); accumulator = 0; showOverlay('pause');
  $('resume-button').focus({ preventScroll: true });
}
function resumeFlight() {
  if (flight.status !== 'paused') return;
  flight.resume(); accumulator = 0; clearInput(); activateAudio(); showOverlay(null);
  canvas.focus({ preventScroll: true });
}
function togglePause() { if (flight.status === 'playing') pauseFlight(); else if (flight.status === 'paused') resumeFlight(); }
function phase() { activateAudio(); flight.phase(); }
async function finishFlight() {
  clearInput(); accumulator = 0;
  const generation = recordGeneration;
  const record = { id: runId, playerName: pilot || 'Anonymous', score: flight.score, elapsed: Number(flight.elapsed.toFixed(2)), level: flight.level, distance: flight.distance, nearMisses: flight.nearMisses, starlight: flight.starlight };
  const previousBest = records[0]?.score ?? -1;
  const saved = addRecord(records, record, storage); records = saved.records;
  $('result-title').textContent = record.score > previousBest ? 'A new personal best.' : 'Nice flying.';
  $('final-score').textContent = formatScore(record.score);
  $('final-time').textContent = formatTime(record.elapsed);
  $('final-near').textContent = String(record.nearMisses);
  $('final-stars').textContent = String(record.starlight);
  const localMessage = saved.persisted ? 'Saved on this device.' : 'Saved for this session. Browser storage is unavailable.';
  $('save-status').textContent = isLiveSite() ? `${localMessage} Syncing worldwide…` : `${localMessage} Preview scores stay local.`;
  showOverlay('result'); renderBoard(); $('restart-button').focus({ preventScroll: true });
  if (!isLiveSite()) return;
  try {
    await saveGlobalRecord(record);
    if (generation !== recordGeneration) return;
    $('save-status').textContent = `${localMessage} Worldwide score recorded.`;
    if (board === 'global') renderBoard();
  } catch {
    if (generation === recordGeneration) $('save-status').textContent = `${localMessage} Worldwide sync could not be confirmed.`;
  }
}
function updateHUD() {
  $('score').textContent = String(flight.score).padStart(6, '0');
  $('sector').textContent = `SECTOR ${String(flight.level).padStart(2, '0')}`;
  $('sector-name').textContent = SECTORS[Math.min(3, Math.floor((flight.level - 1) / 2))];
  Array.from($('hull').children).forEach((part, index) => part.classList.toggle('lost', index >= flight.hp));
  $('hull').setAttribute('aria-label', `${flight.hp} of 3 hull remaining`);
  $('distance').firstChild.textContent = `${String(flight.distance).padStart(4, '0')} M `;
  $('phase-label').textContent = flight.phaseLeft > 0 ? 'PHASING' : flight.cooldown > 0 ? `${flight.cooldown.toFixed(1)} S TO CHARGE` : 'PHASE READY';
  $('phase-button').disabled = flight.status !== 'playing' || flight.cooldown > 0;
  $('charge-fill').style.transform = `scaleX(${1 - flight.cooldown / PHASE_COOLDOWN})`;
}
function burst(x, y, color, count = 14) {
  if (reducedMotion.matches) count = Math.min(count, 6);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 170;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .5, color });
  }
  if (particles.length > 180) particles.splice(0, particles.length - 180);
}
function handleEvents() {
  for (const event of flight.drainEvents()) {
    if (event.type === 'near') {
      labels.push({ x: event.x, y: event.y, text: `CLOSE CALL +${event.points}`, life: 1.1, color: '#b8f7d2' });
      tone(640, .12, 'sine', .025, 1020);
    } else if (event.type === 'star' || event.type === 'repair') {
      burst(event.x, event.y, event.type === 'star' ? '#ffce8c' : '#b8f7d2');
      labels.push({ x: event.x, y: event.y, text: event.type === 'star' ? `+${event.points}` : 'HULL RESTORED', life: .9, color: event.type === 'star' ? '#ffce8c' : '#b8f7d2' });
      tone(event.type === 'star' ? 880 : 440, .18, 'sine', .025, 1320);
    } else if (event.type === 'hit') {
      flash = reducedMotion.matches ? .2 : .65;
      burst(event.x, event.y, '#ff947e', 30); tone(100, .28, 'sawtooth', .025, 30);
    } else if (event.type === 'phase') {
      burst(event.x, event.y, '#b8f7d2', 20); tone(140, .4, 'triangle', .025, 820);
    } else if (event.type === 'sector') {
      $('flight-message').textContent = `SECTOR ${String(event.level).padStart(2, '0')} / SPEED INCREASING`;
      messageUntil = clock + 2.2; tone(420, .2, 'sine', .018, 650);
    } else if (event.type === 'over') {
      tone(200, .5, 'triangle', .035, 40); finishFlight();
    }
  }
}

function drawBackground(time) {
  const w = flight.width, h = flight.height;
  ctx.fillStyle = '#090f1e'; ctx.fillRect(0, 0, w, h);
  const nebula = ctx.createRadialGradient(w * .83, h * .44, 0, w * .68, h * .52, w * .65);
  nebula.addColorStop(0, '#1c3144'); nebula.addColorStop(.45, '#111d31'); nebula.addColorStop(1, '#090f1e');
  ctx.fillStyle = nebula; ctx.fillRect(0, 0, w, h);
  // A distant ringed world gives the flight deck a fixed point in the moving field.
  ctx.save(); ctx.translate(w * .81, h * .39); ctx.rotate(-.32);
  ctx.strokeStyle = '#6b94a81c'; ctx.lineWidth = 18; ctx.beginPath(); ctx.ellipse(0, 0, w * .20, w * .058, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#9bc2c228'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, w * .225, w * .07, 0, 0, Math.PI * 2); ctx.stroke();
  const planet = ctx.createRadialGradient(-w * .02, -w * .034, 0, 0, 0, w * .105);
  planet.addColorStop(0, '#486373'); planet.addColorStop(.45, '#283e53'); planet.addColorStop(.9, '#101c2f'); planet.addColorStop(1, '#0a1426');
  ctx.fillStyle = planet; ctx.beginPath(); ctx.arc(0, 0, w * .10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9abbc72c'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  const starTime = flight.status === 'playing' ? time * (1 + Math.min(flight.level, 16) * .09) : time * .3;
  for (const star of stars) {
    const x = Math.abs(star.x) * w;
    const y = (Math.abs(star.y) * h + starTime * 22 * star.layer) % h;
    ctx.globalAlpha = .2 + star.layer * .55; ctx.fillStyle = '#c1d4e4';
    ctx.fillRect(x, y, star.size, flight.phaseLeft > 0 && !reducedMotion.matches ? star.size * 9 : star.size);
    if (star.size > 1) { ctx.globalAlpha *= .4; ctx.fillRect(x - 2, y + .5, 6, .7); }
  }
  ctx.globalAlpha = 1;
  // Subtle navigation lanes sit behind the hazards.
  ctx.strokeStyle = '#7196b00c'; ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 6) { ctx.beginPath(); ctx.moveTo(w / 2 + (x - w / 2) * .18, 0); ctx.lineTo(x, h); ctx.stroke(); }
  const floorGlow = ctx.createRadialGradient(w / 2, h * 1.15, 0, w / 2, h * 1.15, w * .6);
  floorGlow.addColorStop(0, '#65dcbd15'); floorGlow.addColorStop(1, '#65dcbd00'); ctx.fillStyle = floorGlow; ctx.fillRect(0, 0, w, h);
}
function drawRock(rock, alpha = 1) {
  ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.rotation); ctx.globalAlpha = alpha;
  ctx.beginPath(); rock.shape.forEach((edge, index) => { const angle = index * Math.PI * 2 / rock.shape.length; const x = Math.cos(angle) * rock.radius * edge, y = Math.sin(angle) * rock.radius * edge; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath();
  const shade = ctx.createLinearGradient(-rock.radius, -rock.radius, rock.radius, rock.radius);
  shade.addColorStop(0, '#7a818d'); shade.addColorStop(.28, '#4b5263'); shade.addColorStop(.65, '#272f42'); shade.addColorStop(1, '#151d2d');
  ctx.fillStyle = shade; ctx.fill(); ctx.strokeStyle = '#9ba6b577'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-rock.radius * .5, -rock.radius * .45); ctx.lineTo(rock.radius * .03, -rock.radius * .1); ctx.lineTo(rock.radius * .4, -rock.radius * .55); ctx.moveTo(rock.radius * .03, -rock.radius * .1); ctx.lineTo(rock.radius * .12, rock.radius * .63); ctx.strokeStyle = '#abb3c12a'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-rock.radius * .3, rock.radius * .1, rock.radius * .2, rock.radius * .14, .5, 0, Math.PI * 2); ctx.fillStyle = '#0b13272e'; ctx.fill();
  ctx.restore();
}
function drawShip(x, y, lean, time, phaseActive) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(lean * .23);
  if (phaseActive) { ctx.strokeStyle = '#b8f7d299'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 28, 36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .7; }
  const flame = reducedMotion.matches ? 28 : 28 + Math.sin(time * 37) * 8;
  const trail = ctx.createLinearGradient(0, 10, 0, flame + 35); trail.addColorStop(0, '#ceffee'); trail.addColorStop(.25, '#74dbcfaa'); trail.addColorStop(1, '#69cdd500');
  ctx.fillStyle = trail; ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(0, flame + 35); ctx.lineTo(7, 12); ctx.fill();
  ctx.shadowBlur = 18; ctx.shadowColor = '#b8f7d266'; ctx.fillStyle = '#bccad2';
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(8, -2); ctx.lineTo(23, 16); ctx.lineTo(8, 12); ctx.lineTo(0, 19); ctx.lineTo(-8, 12); ctx.lineTo(-23, 16); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#eff7f0'; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(3, 11); ctx.lineTo(-8, 12); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#344d5d'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(4, 1); ctx.lineTo(0, 8); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b8f7d2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, 15); ctx.lineTo(-13, 12); ctx.moveTo(20, 15); ctx.lineTo(13, 12); ctx.stroke();
  ctx.restore();
}
function drawPickup(pickup, time) {
  ctx.save(); ctx.translate(pickup.x, pickup.y); ctx.rotate(time * .8);
  const color = pickup.type === 'star' ? '#ffd292' : '#b8f7d2'; ctx.fillStyle = color; ctx.strokeStyle = color; ctx.shadowBlur = 17; ctx.shadowColor = color;
  if (pickup.type === 'star') {
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; const radius = i % 2 ? 4 : 12; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill();
  } else { ctx.rotate(-time * .8); ctx.lineWidth = 1.5; ctx.strokeRect(-10, -10, 20, 20); ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
  ctx.restore();
}
function draw(dt) {
  ctx.setTransform(canvas.width / flight.width, 0, 0, canvas.height / flight.height, 0, 0);
  const visualTime = reducedMotion.matches && flight.status !== 'playing' ? 0 : clock;
  drawBackground(visualTime);
  if (flight.status === 'ready') {
    for (let i = 0; i < 7; i++) {
      const r = 17 + (i % 3) * 10;
      const x = flight.width * (.58 + (Math.sin(i * 12.6) + 1) * .18);
      const y = (flight.height * (.1 + i * .13) + visualTime * (8 + i)) % (flight.height + 100) - 40;
      drawRock({ x, y, radius: r, rotation: i + visualTime * .05, shape: [.8, 1, .83, .93, .78, .97, .85, .76, .91] }, .7);
    }
    drawShip(flight.width * .72, flight.height * .8, -.15, visualTime, false);
    drawPickup({ x: flight.width * .76, y: flight.height * .63, type: 'star' }, visualTime);
  } else {
    for (const rock of flight.asteroids) drawRock(rock, rock.hit ? .35 : 1);
    for (const pickup of flight.pickups) drawPickup(pickup, visualTime);
    if (flight.status !== 'over' && (!flight.invulnerable || reducedMotion.matches || Math.floor(clock * 14) % 2 === 0)) drawShip(flight.player.x, flight.player.y, flight.player.lean, visualTime, flight.phaseLeft > 0);
    if (flight.combo > 1) { ctx.fillStyle = '#b8f7d2'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${flight.combo}× CLOSE-CALL CHAIN`, flight.width / 2, 94); ctx.fillStyle = '#b8f7d255'; ctx.fillRect(flight.width / 2 - 35, 102, 70 * flight.comboLeft / 5, 2); }
  }
  const effectDt = flight.status === 'paused' ? 0 : dt;
  for (const p of particles) { p.life -= effectDt; p.x += p.vx * effectDt; p.y += p.vy * effectDt; ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2.5, 2.5); }
  particles = particles.filter(p => p.life > 0); ctx.globalAlpha = 1;
  for (const label of labels) { label.life -= effectDt; label.y -= 25 * effectDt; ctx.globalAlpha = clamp(label.life * 2, 0, 1); ctx.fillStyle = label.color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(label.text, clamp(label.x, 90, flight.width - 90), label.y); }
  labels = labels.filter(label => label.life > 0); ctx.globalAlpha = 1;
  if (flash > 0) { flash = Math.max(0, flash - effectDt * 1.7); ctx.strokeStyle = `rgba(255,130,100,${flash})`; ctx.lineWidth = 9; ctx.strokeRect(0, 0, flight.width, flight.height); }
  if (clock > messageUntil && $('flight-message').textContent) $('flight-message').textContent = '';
}
function resize() {
  const rect = stage.getBoundingClientRect();
  const width = rect.width < 620 ? 480 : 960;
  const height = Math.round(width * rect.height / rect.width);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  flight.resize(width, height); target = null;
}
function frame(timestamp) {
  const dt = Math.min(.08, Math.max(0, (timestamp - (lastTime || timestamp)) / 1000)); lastTime = timestamp;
  if (flight.status !== 'paused' && !document.hidden) clock += dt;
  if (flight.status === 'playing') {
    accumulator += dt;
    const axis = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
    while (accumulator >= 1 / 120 && flight.status === 'playing') { flight.update(1 / 120, { axis, target }); accumulator -= 1 / 120; }
    handleEvents();
  }
  hudTimer += dt;
  if (hudTimer >= .05) { updateHUD(); hudTimer = 0; }
  if (!document.hidden) draw(dt);
  requestAnimationFrame(frame);
}

$('pilot-name').value = pilot;
$('launch-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('pilot-name').value.trim().replace(/\s+/g, ' ').slice(0, 16);
  const blocked = typeof offensiveWords !== 'undefined' && offensiveWords.some(word => name.toLowerCase().includes(word));
  if (blocked) { $('name-error').textContent = 'Please choose another callsign.'; $('pilot-name').focus(); return; }
  pilot = name; setPref('cosmic_dodge_astra_pilot', pilot); $('name-error').textContent = ''; startFlight();
});
$('restart-button').addEventListener('click', startFlight);
$('change-pilot').addEventListener('click', () => { recordGeneration++; flight = new Flight({ width: flight.width, height: flight.height }); showOverlay('start'); $('pilot-name').focus(); });
$('pause-button').addEventListener('click', togglePause);
$('stage-pause').addEventListener('click', togglePause);
$('fullscreen-pause').addEventListener('click', togglePause);
$('fullscreen-exit').addEventListener('click', () => { document.exitFullscreen().catch(() => {}); });
$('resume-button').addEventListener('click', resumeFlight);
$('phase-button').addEventListener('click', phase);
$('local-tab').addEventListener('click', () => { board = 'local'; renderBoard(); });
$('global-tab').addEventListener('click', () => { board = 'global'; renderBoard(); });
$('sound-button').addEventListener('click', () => { sound = !sound; setPref('cosmic_dodge_astra_sound', String(sound)); activateAudio(); soundUI(); if (sound) tone(660, .1); else audioContext?.suspend().catch(() => {}); });
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.requestFullscreen) await stage.requestFullscreen();
  } catch { $('fullscreen-button').querySelector('span').textContent = 'Unavailable'; }
});
if (!document.fullscreenEnabled) $('fullscreen-button').hidden = true;
document.addEventListener('fullscreenchange', () => { $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); resize(); });
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable) return;
  if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) { event.preventDefault(); togglePause(); return; }
  if (flight.status !== 'playing') return;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(event.code)) {
    // Preserve normal keyboard activation of focused buttons.
    if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (event.code === 'Space') { if (!event.repeat) phase(); }
    else keys.add(event.code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('pointerdown', event => {
  if (flight.status !== 'playing' || pointerId !== null || !event.isPrimary) return;
  pointerId = event.pointerId; canvas.setPointerCapture(pointerId);
  const rect = canvas.getBoundingClientRect(); target = (event.clientX - rect.left) / rect.width * flight.width;
  canvas.focus({ preventScroll: true }); activateAudio();
});
canvas.addEventListener('pointermove', event => {
  if (pointerId !== event.pointerId || flight.status !== 'playing') return;
  const rect = canvas.getBoundingClientRect(); target = (event.clientX - rect.left) / rect.width * flight.width;
});
const endPointer = event => { if (event.pointerId === pointerId) { pointerId = null; target = null; } };
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer); canvas.addEventListener('lostpointercapture', endPointer);
window.addEventListener('blur', pauseFlight);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseFlight(); lastTime = 0; });
new ResizeObserver(resize).observe(stage);
soundUI(); renderBoard(); resize(); showOverlay('start'); requestAnimationFrame(frame);
