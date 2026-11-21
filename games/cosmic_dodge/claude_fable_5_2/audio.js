// "Slipstream": an original, fully synthesised score in F-sharp minor at
// 116 BPM. Layers join as the run climbs, grazes play notes from the scale,
// and warping pulls the whole mix under water.
import { Sound, Sequencer, midi, clamp } from "../../../js/fable/kit.js?v=1";

// Bass note and chord tones for each one-bar chord: F#m9, C#m7/E, Dmaj9, Bm11.
const CHORDS = [
  { bass: 42, tones: [54, 57, 61, 64, 68] },
  { bass: 40, tones: [52, 56, 59, 61, 64] },
  { bass: 38, tones: [54, 57, 61, 64, 66] },
  { bass: 35, tones: [50, 54, 57, 59, 64] },
];
const ARP = [0, 2, 1, 3, 2, 4, 3, 1, 0, 3, 2, 4, 1, 3, 2, 4];
const LEAD = [73, 0, 0, 76, 0, 73, 0, 71, 0, 0, 69, 0, 71, 0, 0, 0, 68, 0, 0, 71, 0, 69, 0, 66, 0, 0, 64, 0, 66, 0, 69, 0];
const PENTA = [66, 69, 71, 73, 76, 78, 81, 83, 85, 88, 90];

export class Score {
  constructor() {
    this.sound = new Sound();
    this.intensity = 0;
    this.seq = new Sequencer(this.sound, 116, (step, t) => this.step(step, t));
  }
  /** Call from a tap or key press. Builds the graph once. */
  unlock() {
    const ctx = this.sound.unlock();
    if (ctx && !this.lens) {
      const s = this.sound;
      this.lens = ctx.createBiquadFilter(); // the warp filter
      this.lens.type = "lowpass";
      this.lens.frequency.value = 18000;
      this.lens.Q.value = 0.7;
      s.music.disconnect();
      s.music.connect(this.lens).connect(s.master);
      this.padBus = ctx.createBiquadFilter();
      this.padBus.type = "lowpass";
      this.padBus.frequency.value = 950;
      this.padBus.connect(s.music);
      this.bassBus = ctx.createBiquadFilter();
      this.bassBus.type = "lowpass";
      this.bassBus.frequency.value = 520;
      this.bassBus.Q.value = 4;
      this.bassBus.connect(s.music);
    }
    return ctx;
  }
  start() {
    if (this.unlock()) this.seq.start();
  }
  stop() {
    this.seq.stop();
  }
  /** 0 = menu ambience … 5 = everything. */
  setIntensity(level) {
    this.intensity = clamp(Math.round(level), 0, 5);
  }
  setWarp(on) {
    if (!this.lens) return;
    const t = this.sound.now;
    this.lens.frequency.cancelScheduledValues(t);
    this.lens.frequency.setTargetAtTime(on ? 360 : 18000, t, on ? 0.06 : 0.12);
  }
  step(step, t) {
    const s = this.sound,
      i = this.intensity,
      bar = Math.floor(step / 16),
      n = step % 16,
      chord = CHORDS[bar % 4],
      beat = 60 / 116;
    if (n === 0)
      for (const [k, note] of chord.tones.slice(0, 4).entries()) {
        s.tone({ freq: midi(note), dur: beat * 4.1, type: "sawtooth", gain: 0.03, attack: 0.5, at: t, bus: this.padBus, detune: k % 2 ? 7 : -7 });
      }
    if (i === 0 ? n % 4 === 0 : true) {
      const note = chord.tones[ARP[n] % chord.tones.length] + (i >= 4 && n % 2 ? 12 : 0);
      s.tone({ freq: midi(note + 12), dur: 0.2, type: "triangle", gain: i === 0 ? 0.035 : 0.05, at: t, bus: s.music, pan: n % 2 ? 0.35 : -0.35 });
    }
    if (i >= 2 && n % 4 === 0) {
      s.tone({ freq: 150, to: 42, dur: 0.2, type: "sine", gain: 0.42, attack: 0.002, at: t, bus: s.music });
    }
    if (i >= 3) {
      if (n % 4 === 2 || (i >= 4 && n % 2 === 1))
        s.tone({ freq: midi(chord.bass + (n === 14 ? 12 : 0)), dur: 0.16, type: "sawtooth", gain: 0.13, at: t, bus: this.bassBus });
      if (n % 2 === 1) s.noise({ dur: 0.035, gain: 0.035, freq: 9000, type: "highpass", at: t, bus: s.music });
      if (n % 4 === 2) s.noise({ dur: 0.09, gain: 0.03, freq: 7500, type: "highpass", at: t, bus: s.music });
      if (n === 4 || n === 12) s.noise({ dur: 0.15, gain: 0.13, freq: 1700, q: 0.9, at: t, bus: s.music });
    }
    if (i >= 5) {
      const note = LEAD[step % 32];
      if (note) s.tone({ freq: midi(note), dur: 0.26, type: "square", gain: 0.028, at: t, bus: s.music });
    }
  }

  // --- effects ---------------------------------------------------------
  graze(chain, closeness = 0.5) {
    const note = PENTA[Math.min(PENTA.length - 1, Math.max(0, chain - 1))];
    this.sound.tone({ freq: midi(note), dur: 0.13, type: "triangle", gain: 0.07 + closeness * 0.05 });
    this.sound.tone({ freq: midi(note + 12), dur: 0.06, type: "sine", gain: 0.03 });
  }
  multiplier(value) {
    const base = 61 + value * 2;
    [0, 4, 7].forEach((semi, k) =>
      this.sound.tone({ freq: midi(base + semi), dur: 0.22, type: "triangle", gain: 0.07, at: this.sound.now + k * 0.05 }),
    );
  }
  dust() {
    this.sound.tone({ freq: midi(85), to: midi(90), dur: 0.1, type: "sine", gain: 0.06 });
  }
  aegis() {
    [69, 73, 76, 81].forEach((n, k) =>
      this.sound.tone({ freq: midi(n), dur: 0.3, type: "sine", gain: 0.07, at: this.sound.now + k * 0.06 }),
    );
  }
  shield() {
    this.sound.noise({ dur: 0.5, gain: 0.3, freq: 2400, to: 200, q: 0.5 });
    this.sound.tone({ freq: 220, to: 55, dur: 0.5, type: "sawtooth", gain: 0.16 });
  }
  over() {
    this.sound.noise({ dur: 1.3, gain: 0.34, freq: 3000, to: 90, q: 0.4, type: "lowpass" });
    this.sound.tone({ freq: 330, to: 32, dur: 1.2, type: "sawtooth", gain: 0.2 });
    this.sound.tone({ freq: 90, to: 28, dur: 0.9, type: "sine", gain: 0.4 });
  }
  warpOn() {
    this.setWarp(true);
    this.sound.tone({ freq: 620, to: 110, dur: 0.35, type: "sine", gain: 0.09 });
  }
  warpOff() {
    this.setWarp(false);
    this.sound.tone({ freq: 160, to: 520, dur: 0.22, type: "sine", gain: 0.06 });
  }
  level() {
    this.sound.tone({ freq: midi(73), dur: 0.12, type: "triangle", gain: 0.06 });
    this.sound.tone({ freq: midi(78), dur: 0.2, type: "triangle", gain: 0.06, at: this.sound.now + 0.09 });
  }
  sector() {
    [54, 61, 66, 69, 73, 78].forEach((n, k) =>
      this.sound.tone({ freq: midi(n), dur: 0.5, type: "triangle", gain: 0.07, at: this.sound.now + k * 0.07 }),
    );
    this.sound.noise({ dur: 1.1, gain: 0.08, freq: 400, to: 6000, q: 1.2 });
  }
  telegraph() {
    this.sound.tone({ freq: 880, dur: 0.07, type: "square", gain: 0.035 });
    this.sound.tone({ freq: 880, dur: 0.07, type: "square", gain: 0.035, at: this.sound.now + 0.12 });
  }
  click() {
    this.sound.tone({ freq: 520, to: 700, dur: 0.05, type: "sine", gain: 0.04 });
  }
}
