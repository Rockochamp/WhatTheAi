/* Leo's Game — all sound is synthesised with WebAudio (no files). Volume starts at 60%, mute is remembered. */
(function (root) {
'use strict';
const LS = 'leo.v1.muted';
let ctx = null, master = null, sfx = null, mus = null, noiseBuf = null, muted = false, engine = null, music = null, lastSay = 0;
try { muted = localStorage.getItem(LS) === '1'; } catch (e) {}
function init() {
  if (ctx) return ctx; const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(comp);
  mus = ctx.createGain(); mus.gain.value = 0.32; mus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
function setMuted(m) { muted = !!m; try { localStorage.setItem(LS, muted ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.03); if (muted && root.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} }
const now = () => ctx.currentTime;
let gVol = 1, gRate = 1; // playMod: scales volume / pitch of everything one SFX plays (anti-spam for rapid FIRE)
function tone(f, d, o) { if (!ctx || muted) return; o = o || {}; const t = now() + (o.at || 0), os = ctx.createOscillator(), g = ctx.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f * gRate, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to * gRate, t + d);
  const v = (o.vol == null ? 0.3 : o.vol) * gVol; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  os.connect(g); g.connect(o.dest || sfx); os.start(t); os.stop(t + d + 0.05); }
function noise(d, o) { if (!ctx || muted) return; o = o || {}; const t = now() + (o.at || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime((o.f || 1200) * gRate, t); if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo * gRate, t + d); f.Q.value = o.q || 0.8;
  const v = (o.vol == null ? 0.3 : o.vol) * gVol; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(o.dest || sfx); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); }
const SFX = {
  tap: () => tone(660, 0.07, { type: 'triangle', vol: 0.2, to: 880 }),
  click: () => { tone(320, 0.05, { type: 'square', vol: 0.12 }); noise(0.04, { f: 3000, filter: 'highpass', vol: 0.15 }); tone(880, 0.12, { type: 'sine', vol: 0.18, at: 0.05, to: 1100 }); },
  bonk: (k) => { tone(220 * (k || 1), 0.16, { type: 'triangle', vol: 0.4, to: 120 }); noise(0.12, { f: 900, vol: 0.25 }); },
  crash: () => { noise(0.35, { f: 1400, fTo: 300, vol: 0.45 }); tone(140, 0.25, { type: 'triangle', vol: 0.35, to: 70 }); tone(520, 0.08, { type: 'square', vol: 0.08, at: 0.03 }); },
  crumble: () => { for (let i = 0; i < 5; i++) noise(0.16, { f: 700 - i * 80, vol: 0.28, at: i * 0.045 }); tone(110, 0.4, { type: 'sine', vol: 0.4, to: 55 }); },
  pop: () => { tone(500, 0.1, { type: 'sine', vol: 0.35, to: 1400 }); noise(0.06, { f: 4000, filter: 'highpass', vol: 0.25 }); tone(1500, 0.18, { type: 'triangle', vol: 0.12, at: 0.06, to: 2200 }); },
  boom: () => { tone(160, 0.9, { type: 'sine', vol: 0.6, to: 38 }); noise(0.9, { f: 1800, fTo: 120, vol: 0.55 }); for (let i = 0; i < 4; i++) tone(700 + i * 180, 0.12, { type: 'triangle', vol: 0.1, at: 0.25 + i * 0.07 }); },
  star: () => { tone(1320, 0.12, { type: 'triangle', vol: 0.18 }); tone(1980, 0.16, { type: 'sine', vol: 0.14, at: 0.05 }); },
  combo: (m) => { const b = 520 * Math.pow(1.122, m * 2); for (let i = 0; i < 3; i++) tone(b * [1, 1.25, 1.5][i], 0.12, { type: 'square', vol: 0.08, at: i * 0.05 }); },
  jump: () => tone(300, 0.2, { type: 'square', vol: 0.12, to: 780 }),
  land: () => { tone(120, 0.15, { type: 'sine', vol: 0.4, to: 60 }); noise(0.1, { f: 500, vol: 0.2 }); },
  boost: () => { tone(180, 0.6, { type: 'sawtooth', vol: 0.16, to: 720 }); noise(0.6, { f: 600, fTo: 3000, vol: 0.25 }); },
  super: () => { tone(160, 1.0, { type: 'sawtooth', vol: 0.2, to: 900 }); noise(1.0, { f: 500, fTo: 4000, vol: 0.3 }); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.1, at: 0.1 + i * 0.08 })); },
  nocharge: () => tone(240, 0.12, { type: 'triangle', vol: 0.15, to: 200 }),
  count: (hi) => tone(hi ? 1046 : 523, hi ? 0.5 : 0.18, { type: 'square', vol: 0.15 }),
  ramp: () => tone(260, 0.35, { type: 'triangle', vol: 0.2, to: 900 }),
  pound: () => { tone(90, 0.8, { type: 'sine', vol: 0.7, to: 30 }); noise(0.6, { f: 900, fTo: 90, vol: 0.5 }); },
  fanfare: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.7 : 0.16, { type: 'square', vol: 0.12, at: i * 0.13 })); [262, 330, 392].forEach(f => tone(f, 1.3, { type: 'triangle', vol: 0.1, at: 0.65 })); },
  cheer: () => { for (let i = 0; i < 8; i++) noise(0.3, { f: 1500 + i * 300, filter: 'bandpass', q: 2, vol: 0.06, at: i * 0.05 }); },
  firework: () => { tone(400, 0.5, { type: 'sine', vol: 0.1, to: 1400 }); noise(0.5, { f: 2500, fTo: 400, vol: 0.3, at: 0.45 }); },
  // Addendum B: Whirly Pup and Chomp Rex
  arf: () => { tone(620, 0.09, { type: 'triangle', vol: 0.3, to: 980 }); tone(900, 0.12, { type: 'square', vol: 0.08, to: 700, at: 0.02 }); noise(0.07, { f: 2500, filter: 'bandpass', q: 2, vol: 0.18 }); },
  whirr: (d) => whirr(d || 3.6),
  pull: (n) => { const f = 900 + Math.random() * 500; tone(f, 0.08, { type: 'sine', vol: 0.22, to: f * 1.8 }); if ((n || 1) > 1) tone(f * 1.5, 0.08, { type: 'triangle', vol: 0.1, at: 0.05, to: f * 2.4 }); },
  chomp: (k) => { k = k || 1; tone(130 * k, 0.14, { type: 'square', vol: 0.3, to: 55 * k }); noise(0.09, { f: 900 * k, vol: 0.32 }); tone(2200, 0.03, { type: 'square', vol: 0.06, at: 0.07 }); },
  growl: () => { for (let i = 0; i < 6; i++) tone(58 + i * 4, 0.16, { type: 'sawtooth', vol: 0.22, at: i * 0.1, to: 70 + i * 4 }); noise(0.7, { f: 300, vol: 0.25 }); },
  // Addendum C: Comet 17
  fwoom: () => { noise(0.75, { f: 200, fTo: 2400, filter: 'bandpass', q: 1.2, vol: 0.5 }); tone(70, 0.7, { type: 'sawtooth', vol: 0.22, to: 180 }); tone(240, 0.45, { type: 'sine', vol: 0.14, at: 0.08, to: 90 }); },
  crackle: (d) => crackle(d || 3.6),
  mboom: (k) => { k = k || 1; tone(140 * k, 0.55, { type: 'sine', vol: 0.55, to: 42 * k }); noise(0.5, { f: 2200 * k, fTo: 180, vol: 0.45 }); noise(0.08, { f: 4000, filter: 'highpass', vol: 0.2 }); },
  kaboom: () => { tone(90, 1.2, { type: 'sine', vol: 0.75, to: 26 }); tone(55, 1.0, { type: 'triangle', vol: 0.4, at: 0.05, to: 30 }); noise(1.2, { f: 1500, fTo: 80, vol: 0.6 }); noise(0.5, { f: 3500, filter: 'highpass', vol: 0.18, at: 0.15 }); },
  ting: () => { tone(1760, 0.5, { type: 'sine', vol: 0.22 }); tone(2640, 0.35, { type: 'sine', vol: 0.1, at: 0.01 }); },
  hiss: () => noise(0.7, { f: 5000, fTo: 2500, filter: 'highpass', vol: 0.22, at: 0.05 }),
  burp: () => { for (let i = 0; i < 7; i++) tone(150 - i * 9 + (i % 2) * 14, 0.11, { type: 'sawtooth', vol: 0.26, at: i * 0.075 }); noise(0.55, { f: 500, fTo: 200, filter: 'bandpass', q: 3, vol: 0.3 }); tone(900, 0.12, { type: 'sine', vol: 0.12, at: 0.6, to: 1500 }); },
  // Addendum D: FIRE. A launch and a hit sound per weapon (matching the popup word) and a quiet ready click.
  ready: () => tone(1500, 0.04, { type: 'square', vol: 0.05, to: 1800 }),
  fireOff: () => tone(900, 0.08, { type: 'triangle', vol: 0.06, to: 1300 }),
  fizzle: () => noise(0.18, { f: 2500, fTo: 600, filter: 'bandpass', q: 1.5, vol: 0.12 }),
  fire_rocket: () => { noise(0.3, { f: 900, fTo: 3000, filter: 'bandpass', q: 1, vol: 0.3 }); tone(220, 0.25, { type: 'sawtooth', vol: 0.1, to: 660 }); },
  hit_rocket: () => { tone(120, 0.4, { type: 'sine', vol: 0.5, to: 40 }); noise(0.35, { f: 1600, fTo: 200, vol: 0.45 }); },
  fire_ball: () => tone(300, 0.14, { type: 'sine', vol: 0.3, to: 520 }),
  hit_ball: () => { tone(260, 0.25, { type: 'sine', vol: 0.4, to: 700 }); tone(700, 0.2, { type: 'triangle', vol: 0.15, at: 0.08, to: 350 }); noise(0.1, { f: 4000, filter: 'highpass', vol: 0.15 }); },
  fire_boomerang: () => { for (let i = 0; i < 4; i++) noise(0.08, { f: 700 + i * 200, filter: 'bandpass', q: 3, vol: 0.18, at: i * 0.07 }); },
  hit_boomerang: () => { tone(500, 0.08, { type: 'square', vol: 0.18, to: 200 }); noise(0.15, { f: 1200, vol: 0.35 }); },
  fire_wave: () => { tone(1400, 0.3, { type: 'sine', vol: 0.15, to: 3000 }); noise(0.2, { f: 6000, filter: 'highpass', vol: 0.18 }); },
  hit_wave: () => { tone(2600, 0.25, { type: 'sine', vol: 0.18, to: 1800 }); noise(0.12, { f: 5000, filter: 'highpass', vol: 0.25 }); },
  fire_balloon: () => tone(420, 0.18, { type: 'triangle', vol: 0.2, to: 260 }),
  hit_balloon: () => { noise(0.45, { f: 1200, fTo: 300, filter: 'bandpass', q: 0.8, vol: 0.5 }); tone(900, 0.1, { type: 'sine', vol: 0.15, to: 300 }); },
  fire_gust: () => noise(0.25, { f: 600, fTo: 2500, filter: 'bandpass', q: 1.2, vol: 0.3 }),
  hit_gust: () => { noise(0.4, { f: 2200, fTo: 500, filter: 'bandpass', q: 1, vol: 0.35 }); tone(700, 0.3, { type: 'sine', vol: 0.1, to: 1400 }); },
  fire_teeth: () => { for (let i = 0; i < 5; i++) tone(1800, 0.025, { type: 'square', vol: 0.08, at: i * 0.06 }); },
  hit_teeth: () => { tone(140, 0.14, { type: 'square', vol: 0.3, to: 60 }); noise(0.1, { f: 900, vol: 0.3 }); tone(2400, 0.03, { type: 'square', vol: 0.08, at: 0.06 }); },
  fire_meteor: () => { noise(0.35, { f: 400, fTo: 1800, filter: 'bandpass', q: 1, vol: 0.3 }); tone(90, 0.3, { type: 'sawtooth', vol: 0.1, to: 160 }); },
  hit_meteor: () => { tone(110, 0.5, { type: 'sine', vol: 0.55, to: 35 }); noise(0.4, { f: 2000, fTo: 150, vol: 0.45 }); tone(1200, 0.06, { type: 'square', vol: 0.08, at: 0.04 }); },
  fire_bolt: () => { tone(1900, 0.09, { type: 'square', vol: 0.09, to: 700 }); tone(2300, 0.09, { type: 'square', vol: 0.06, at: 0.04, to: 800 }); },
  hit_bolt: () => { tone(3000, 0.12, { type: 'sawtooth', vol: 0.07, to: 1200 }); noise(0.1, { f: 6000, filter: 'highpass', vol: 0.22 }); },
  fire_zoomie: () => { for (let i = 0; i < 3; i++) tone(300 + i * 40, 0.07, { type: 'triangle', vol: 0.22, at: i * 0.09, to: 200 }); tone(500, 0.12, { type: 'sawtooth', vol: 0.14, at: 0.3, to: 900 }); for (let i = 0; i < 6; i++) tone(70, 0.05, { type: 'sawtooth', vol: 0.12, at: i * 0.05 }); }, // nom-nom-nom-RARF + a growly brrr
  hit_zoomie: () => { for (let i = 0; i < 4; i++) { tone(160, 0.07, { type: 'square', vol: 0.22, at: i * 0.075, to: 70 }); noise(0.05, { f: 1000, vol: 0.2, at: i * 0.075 }); } },
  // Laser Racer: Laser Drive
  vwoom: () => { tone(60, 0.8, { type: 'sawtooth', vol: 0.25, to: 400 }); noise(0.8, { f: 300, fTo: 5000, filter: 'bandpass', q: 0.9, vol: 0.4 }); },
  jet: (d) => jetRoar(d || 3.6),
  pew: () => tone(2200, 0.08, { type: 'square', vol: 0.06, to: 900 }),
  sizzle: () => noise(0.18, { f: 5000, fTo: 2000, filter: 'highpass', vol: 0.2 }),
  pewdown: () => { [0, 0.16, 0.32].forEach((at, i) => { tone(1700 - i * 400, 0.1, { type: 'square', vol: 0.07, at, to: 500 - i * 100 }); noise(0.09, { f: 900, vol: 0.18, at }); }); },
  // Ira: paws, Zoomie Chomp, Turbo Toot (cartoon raspberries, never realistic)
  paw: () => tone(240 + Math.random() * 60, 0.03, { type: 'triangle', vol: 0.08, to: 160 }),
  skid: () => noise(0.12, { f: 2400, filter: 'bandpass', q: 2, vol: 0.12 }),
  pfrrt: () => { const o = { type: 'sawtooth', vol: 0.18 }; for (let i = 0; i < 14; i++) tone(95 + (i % 2) * 20, 0.04, Object.assign({}, o, { at: i * 0.035 })); noise(0.5, { f: 500, fTo: 250, filter: 'bandpass', q: 4, vol: 0.2 }); tone(700, 0.12, { type: 'sine', vol: 0.1, at: 0.5, to: 1100 }); },
  toot: () => { tone(330 + Math.random() * 80, 0.09, { type: 'square', vol: 0.06, to: 260 }); },
  boing: () => tone(500, 0.18, { type: 'sine', vol: 0.12, to: 1100 }),
  pft: () => { for (let i = 0; i < 4; i++) tone(140, 0.03, { type: 'sawtooth', vol: 0.12, at: i * 0.03 }); },
  sniff: () => { noise(0.08, { f: 3000, filter: 'bandpass', q: 3, vol: 0.12 }); noise(0.08, { f: 3200, filter: 'bandpass', q: 3, vol: 0.12, at: 0.13 }); },
  bark: () => { tone(380, 0.12, { type: 'sawtooth', vol: 0.18, to: 240 }); noise(0.08, { f: 900, filter: 'bandpass', q: 2, vol: 0.2 }); },
  solve: () => { [523, 659, 784, 988, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.18, at: i * 0.09 })); },
};
const HORNS = {
  roar: () => { tone(70, 0.9, { type: 'sawtooth', vol: 0.3, to: 140 }); noise(0.9, { f: 400, vol: 0.3 }); },
  bell: () => { tone(1568, 0.25, { type: 'sine', vol: 0.25 }); tone(1568, 0.3, { type: 'sine', vol: 0.25, at: 0.28 }); tone(2350, 0.3, { type: 'sine', vol: 0.08, at: 0.28 }); },
  rumble: () => { tone(55, 1.0, { type: 'sawtooth', vol: 0.35, to: 75 }); tone(110, 0.6, { type: 'square', vol: 0.12, at: 0.2 }); },
  shing: () => { tone(2200, 0.7, { type: 'sine', vol: 0.18, to: 3300 }); tone(3300, 0.7, { type: 'sine', vol: 0.08, at: 0.05 }); noise(0.25, { f: 6000, filter: 'highpass', vol: 0.15 }); },
  chirp: () => { tone(1180, 0.16, { type: 'square', vol: 0.11, to: 1250 }); tone(840, 0.2, { type: 'square', vol: 0.11, at: 0.17, to: 800 }); noise(0.09, { f: 2900, filter: 'bandpass', q: 6, vol: 0.28, at: 0.4 }); tone(2100, 0.08, { type: 'triangle', vol: 0.06, at: 0.4, to: 1700 }); }, // race "wee-woo" + tyre chirp
  yip: () => { tone(880, 0.09, { type: 'triangle', vol: 0.3, to: 1400 }); tone(980, 0.1, { type: 'triangle', vol: 0.3, at: 0.17, to: 1560 }); noise(0.05, { f: 3000, filter: 'bandpass', q: 2, vol: 0.12, at: 0.17 }); },
  growl: () => { tone(48, 0.8, { type: 'sawtooth', vol: 0.34, to: 82 }); tone(96, 0.5, { type: 'square', vol: 0.1, at: 0.15 }); noise(0.03, { f: 3500, filter: 'highpass', vol: 0.3, at: 0.82 }); noise(0.03, { f: 3500, filter: 'highpass', vol: 0.3, at: 0.92 }); }, // growl + tooth-clack
  vwee: () => { tone(300, 0.35, { type: 'sawtooth', vol: 0.12, to: 1400 }); tone(1400, 0.22, { type: 'sine', vol: 0.12, at: 0.36, to: 700 }); }, // rising synth vwee-oop
  woof: () => { [0, 0.28].forEach(at => { tone(170, 0.16, { type: 'sawtooth', vol: 0.3, at, to: 110 }); noise(0.1, { f: 700, filter: 'bandpass', q: 2, vol: 0.25, at }); }); noise(0.12, { f: 2000, filter: 'bandpass', q: 4, vol: 0.18, at: 0.6 }); }, // woof-woof + a happy snort
  rotor: () => { for (let i = 0; i < 8; i++) noise(0.07, { f: 300, vol: 0.35, at: i * 0.09 }); tone(660, 0.2, { type: 'square', vol: 0.08 }); tone(880, 0.3, { type: 'square', vol: 0.08, at: 0.22 }); },
};
/* Laser Drive: a jet roar for the whole 3.6 s window. */
function jetRoar(d) { if (!ctx || muted) return; const t = now(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1600, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.25); g.gain.setValueAtTime(0.22, t + d - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + d + 0.05); }
/* Comet 17's crackling rush: a looped airy roar plus random fire crackles for the whole Comet Dash. */
function crackle(d) { if (!ctx || muted) return; const t = now(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.3); g.gain.setValueAtTime(0.2, t + d - 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + d + 0.05);
  for (let i = 0; i < d * 11; i++) noise(0.025 + Math.random() * 0.03, { f: 2500 + Math.random() * 3000, filter: 'bandpass', q: 3, vol: 0.12 + Math.random() * 0.12, at: 0.2 + Math.random() * (d - 0.4) }); }
/* Rising "whoosh-whirr" for Whirly Pup's tornado: a looping band-passed noise sweeping up, with a wobbling whistle. */
function whirr(d) { if (!ctx || muted) return; const t = now(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(2600, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.25); g.gain.setValueAtTime(0.28, t + d - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.type = 'triangle'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(900, t + d); lfo.frequency.value = 7; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + 0.3); og.gain.setValueAtTime(0.05, t + d - 0.3); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(sfx); o.connect(og); og.connect(sfx); s.start(t); o.start(t); lfo.start(t); s.stop(t + d + 0.05); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05); }
function play(name, a) { if (!ctx || muted) return; const f = SFX[name]; if (f) try { f(a); } catch (e) {} }
function playMod(name, vol, rate) { gVol = vol; gRate = rate; try { play(name); } finally { gVol = 1; gRate = 1; } }
function horn(id) { unlock(); if (!ctx || muted) return; const f = HORNS[id]; if (f) try { f(); } catch (e) {} }
/* Continuous engine voice, pitched by speed. */
function engineStart(kind) { if (!ctx || engine) return; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = kind === 'shing' || kind === 'yip' ? 'sine' : 'sawtooth'; o2.type = kind === 'yip' ? 'triangle' : 'square'; f.type = 'lowpass'; f.frequency.value = kind === 'shing' ? 2000 : 520; g.gain.value = 0;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx); o.start(); o2.start(); engine = { o, o2, f, g, kind }; }
function engineSet(speed, boost) { if (!engine || !ctx) return; const b = { roar: 55, bell: 140, rumble: 38, shing: 440, rotor: 48, yip: 120, growl: 34, chirp: 64, vwee: 70 }[engine.kind] || 50;
  const f = b * (1 + speed * 1.2 + (boost ? 0.5 : 0)); engine.o.frequency.setTargetAtTime(f, now(), 0.08); engine.o2.frequency.setTargetAtTime(f * 0.5, now(), 0.08);
  engine.g.gain.setTargetAtTime(muted ? 0 : (engine.kind === 'shing' || engine.kind === 'yip' ? 0.025 : 0.05) * (0.5 + speed * 0.5), now(), 0.1); }
function engineStop() { if (!engine) return; const e = engine; engine = null; try { e.g.gain.setTargetAtTime(0, now(), 0.05); e.o.stop(now() + 0.3); e.o2.stop(now() + 0.3); } catch (x) {} }
/* Bouncy chiptune-rock loop per track. */
const SONGS = [
  { bpm: 132, root: 60, prog: [0, 5, 7, 5], lead: [0, 4, 7, 9, 7, 4, 2, 4, 0, 4, 7, 12, 9, 7, 4, 2] },
  { bpm: 140, root: 57, prog: [0, 3, 5, 3], lead: [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 5, 7, 5, 3, 0, -2] },
  { bpm: 128, root: 62, prog: [0, 5, 3, 7], lead: [7, 9, 12, 9, 7, 4, 7, 9, 12, 14, 12, 9, 7, 4, 2, 4] },
  { bpm: 146, root: 55, prog: [0, 0, 3, 5], lead: [0, 7, 3, 7, 5, 7, 3, 2, 0, 7, 10, 7, 5, 3, 2, 0] },
];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function musicStart(i) { musicStop(); if (!ctx) return; const S = SONGS[i % SONGS.length], st = 60 / S.bpm / 2; let n = 0, next = now() + 0.1;
  const tick = () => { if (!ctx) return; while (next < now() + 0.25) { if (!muted) { const bar = Math.floor(n / 16) % 4, r = S.root + S.prog[bar], s = n % 16;
        if (s % 4 === 0) { tone(60, 0.18, { type: 'sine', vol: 0.5, to: 40, dest: mus, at: next - now() }); }
        if (s % 4 === 2) noise(0.06, { f: 6000, filter: 'highpass', vol: 0.12, dest: mus, at: next - now() });
        if (s % 8 === 4) noise(0.14, { f: 1800, filter: 'bandpass', vol: 0.22, dest: mus, at: next - now() });
        if (s % 2 === 0) tone(hz(r - 24 + (s % 4 === 2 ? 12 : 0)), st * 1.6, { type: 'square', vol: 0.09, dest: mus, at: next - now() });
        const L = S.lead[s]; if (L != null && (s % 2 === 0 || n % 32 > 16)) tone(hz(r + L + (bar === 3 ? 0 : 0)), st * 0.9, { type: 'square', vol: 0.045, dest: mus, at: next - now() }); }
      next += st; n++; } };
  music = setInterval(tick, 60); tick(); }
function musicStop() { if (music) clearInterval(music); music = null; }
/* Tiny announcer via the browser voice, when there is one (no reading needed). */
function say(t) { if (muted || !root.speechSynthesis) return; const n = Date.now(); if (n - lastSay < 1500) return; lastSay = n;
  try { const u = new SpeechSynthesisUtterance(t); u.rate = 1.1; u.pitch = 1.5; u.volume = 0.8; u.lang = 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
root.LeoAudio = { init, unlock, play, playMod, horn, engineStart, engineSet, engineStop, musicStart, musicStop, say, setMuted, get muted() { return muted; } };
})(window);
