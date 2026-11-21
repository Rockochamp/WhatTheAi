// A bouncy marimba tune and a box of cartoon noises, all synthesised.
import { Sound, Sequencer, midi } from "../../../js/fable/kit.js?v=1";

const CHORDS = [[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67], [45, 60, 64, 69], [53, 60, 65, 69], [55, 62, 65, 71], [48, 60, 64, 72]];
const TUNE = [0, 2, 1, 3, 2, 1, 3, 2, 0, 1, 3, 1, 2, 3, 1, 0];

export class Jukebox {
  constructor() {
    this.sound = new Sound();
    this.sound.musicVolume = 0.55;
    this.heat = 0;
    this.seq = new Sequencer(this.sound, 126, (step, t) => this.step(step, t));
  }
  start() {
    if (this.sound.unlock()) this.seq.start();
  }
  stop() {
    this.seq.stop();
  }
  mallet(note, at, gain = 0.07) {
    const s = this.sound;
    s.tone({ freq: midi(note), dur: 0.22, type: "sine", gain, attack: 0.003, at, bus: s.music });
    s.tone({ freq: midi(note + 24), dur: 0.05, type: "triangle", gain: gain * 0.5, attack: 0.002, at, bus: s.music });
  }
  step(step, t) {
    const s = this.sound,
      n = step % 16,
      chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    if (n % 8 === 0 || n === 6) s.tone({ freq: midi(chord[0] - 12), dur: 0.2, type: "triangle", gain: 0.16, at: t, bus: s.music });
    if (n % 2 === 0 || this.heat > 1) this.mallet(chord[1 + (TUNE[n] % 3)] + (TUNE[n] === 3 ? 12 : 0), t);
    if (n % 4 === 2) s.noise({ dur: 0.04, gain: 0.04, freq: 6000, type: "highpass", at: t, bus: s.music });
    if (this.heat > 0 && n % 4 === 0) s.tone({ freq: 140, to: 50, dur: 0.14, type: "sine", gain: 0.28, at: t, bus: s.music });
    if (this.heat > 1 && (n === 4 || n === 12)) s.noise({ dur: 0.1, gain: 0.09, freq: 1900, at: t, bus: s.music });
  }
  // effects, with a little variation so a pile-up does not sound like a machine gun
  bonk(deep = false) {
    const f = (deep ? 150 : 300) * (0.85 + Math.random() * 0.4);
    this.sound.tone({ freq: f * 1.6, to: f, dur: 0.11, type: "triangle", gain: 0.11 });
  }
  slip() {
    this.sound.tone({ freq: 900 + Math.random() * 300, to: 240, dur: 0.22, type: "sine", gain: 0.045 });
  }
  toss() {
    this.sound.noise({ dur: 0.06, gain: 0.03, freq: 1400, to: 3200, q: 2 });
  }
  pop() {
    this.sound.tone({ freq: 520 + Math.random() * 200, to: 1100, dur: 0.07, type: "sine", gain: 0.05 });
  }
  pickup() {
    this.sound.tone({ freq: midi(84 + Math.floor(Math.random() * 5)), dur: 0.05, type: "sine", gain: 0.03 });
  }
  thunk() {
    this.sound.tone({ freq: 170, to: 60, dur: 0.16, type: "sine", gain: 0.3 });
    this.sound.noise({ dur: 0.08, gain: 0.12, freq: 900, q: 0.7 });
  }
  dash() {
    this.sound.noise({ dur: 0.22, gain: 0.1, freq: 500, to: 3500, q: 1.5 });
  }
  hurt() {
    this.sound.tone({ freq: 320, to: 110, dur: 0.25, type: "sawtooth", gain: 0.13 });
  }
  level() {
    [72, 76, 79, 84].forEach((n, k) => this.mallet(n, this.sound.now + k * 0.07, 0.1));
  }
  combo(n) {
    [0, 4, 7, 12].forEach((semi, k) => this.sound.tone({ freq: midi(67 + Math.min(12, n / 3) + semi), dur: 0.16, type: "square", gain: 0.05, at: this.sound.now + k * 0.05 }));
  }
  boss() {
    this.sound.tone({ freq: 90, to: 45, dur: 1.1, type: "sawtooth", gain: 0.22 });
    this.sound.noise({ dur: 0.9, gain: 0.12, freq: 300, to: 90, type: "lowpass" });
  }
  over() {
    [67, 64, 60, 55, 48].forEach((n, k) => this.mallet(n, this.sound.now + k * 0.13, 0.12));
  }
}
