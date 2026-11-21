// A small lyre, synthesised: plucked notes in a D mode with a flattened
// second, a slow wandering melody and a drone underneath.
import { Sound, Sequencer, midi } from "../../../js/fable/kit.js?v=1";

const SCALE = [62, 63, 66, 67, 69, 70, 72, 74, 75, 78];
const MELODY = [0, -1, 4, -1, 3, 2, 1, -1, 0, -1, 2, 3, 4, -1, 6, 5, 4, -1, 3, -1, 2, 1, 0, -1, 4, -1, 5, 7, 6, 4, 3, -1];

export class Lyre {
  constructor() {
    this.sound = new Sound();
    this.sound.musicVolume = 0.5;
    this.seq = new Sequencer(this.sound, 66, (step, t) => this.step(step, t));
  }
  start() {
    if (this.sound.unlock()) this.seq.start();
  }
  stop() {
    this.seq.stop();
  }
  pluck(note, at = 0, gain = 0.09, bus = null) {
    const s = this.sound;
    s.tone({ freq: midi(note), dur: 0.9, type: "triangle", gain, attack: 0.004, at, bus });
    s.tone({ freq: midi(note + 12), dur: 0.35, type: "sine", gain: gain * 0.4, attack: 0.003, at, bus });
  }
  step(step, t) {
    const s = this.sound;
    if (step % 32 === 0) {
      s.tone({ freq: midi(38), dur: 7, type: "sine", gain: 0.07, attack: 1.2, at: t, bus: s.music });
      s.tone({ freq: midi(45), dur: 7, type: "sine", gain: 0.04, attack: 1.6, at: t, bus: s.music });
    }
    if (step % 2) return;
    const i = MELODY[(step / 2) % MELODY.length];
    if (i >= 0) this.pluck(SCALE[i], t, 0.06, s.music);
  }
  // effects
  seal() {
    [0, 4, 7].forEach((i, k) => this.pluck(SCALE[i], this.sound.now + k * 0.07, 0.1));
  }
  good() {
    [4, 6, 7, 9].forEach((i, k) => this.pluck(SCALE[i], this.sound.now + k * 0.08, 0.09));
  }
  bad() {
    this.sound.tone({ freq: midi(50), to: midi(44), dur: 0.9, type: "sawtooth", gain: 0.08 });
    this.pluck(SCALE[1] - 12, this.sound.now + 0.1, 0.1);
  }
  rats() {
    for (let k = 0; k < 6; k++) this.sound.noise({ dur: 0.04, gain: 0.07, freq: 3500 + k * 300, at: this.sound.now + k * 0.07 });
  }
  tick() {
    this.sound.tone({ freq: midi(86), dur: 0.03, type: "sine", gain: 0.02 });
  }
  finale(won) {
    (won ? [0, 2, 4, 7, 9] : [4, 3, 1, 0]).forEach((i, k) => this.pluck(SCALE[i], this.sound.now + k * 0.14, 0.11));
  }
}
