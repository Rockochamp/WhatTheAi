// CLEAR SIGNAL — original 126 BPM analog-electronic score in C# minor.
// 32-bar arrangement: ignition / drift / drop / vacuum / final drive.
// Audio-clock scheduling keeps the groove stable when rendering is busy.
export const BPM = 126;
export const STEP = 60 / BPM / 4;
const CHORDS = [
  [49, 52, 56, 61],
  [45, 49, 52, 56],
  [52, 56, 59, 64],
  [47, 51, 54, 59],
];
const MELODIES = [
  [73, null, 76, 80, null, 76, 75, null, 73, 71, null, 68, 71, null, 75, 76],
  [73, null, 76, 80, null, 76, 73, null, 69, 68, null, 64, 68, null, 71, 73],
  [76, null, 80, 83, null, 80, 78, null, 76, 75, null, 71, 75, null, 78, 80],
  [75, null, 78, 83, null, 78, 76, null, 75, 73, null, 71, 73, null, 75, 78],
];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function scoreStep(index, level = 1) {
  const bar = Math.floor(index / 16) % 32,
    step = index % 16;
  const chord = CHORDS[Math.floor(bar / 2) % 4];
  const melody = MELODIES[Math.floor(bar / 2) % 4];
  const vacuum = bar >= 16 && bar < 20;
  const ignition = bar < 4;
  const drop = (bar >= 8 && bar < 16) || bar >= 24;
  const notes = [];
  const add = (voice, note, duration, volume, pan = 0) =>
    notes.push({ voice, note, duration, volume, pan });
  if (step === 0)
    chord.forEach((note, i) =>
      add(
        "pad",
        note + 12,
        STEP * 15.7,
        vacuum ? 0.036 : 0.016,
        (i - 1.5) * 0.4,
      ),
    );
  if (!vacuum) {
    if (step % 4 === 0 || (drop && step === 14)) add("kick", 0, 0.34, 0.52);
    if (!ignition && (step === 4 || step === 12)) add("snare", 0, 0.2, 0.15);
    if (
      step % 2 === 0 ||
      (drop && step >= 13) ||
      (level >= 20 && step % 4 === 3)
    )
      add(
        "hat",
        0,
        step % 4 === 2 ? 0.11 : 0.038,
        step % 4 === 2 ? 0.07 : 0.03,
        step % 4 === 0 ? -0.3 : 0.3,
      );
    if ([0, 3, 6, 8, 10, 14].includes(step))
      add(
        "bass",
        chord[0] - 12 + (step === 14 ? 12 : 0),
        STEP * (step === 0 ? 2.6 : 1.6),
        0.12,
      );
    if (bar % 8 === 7 && step >= 12)
      add(
        "snare",
        0,
        0.09,
        0.04 + (step - 12) * 0.015,
        (step % 2 ? 1 : -1) * 0.28,
      );
  }
  if (step % 2 === 0 || (level >= 10 && !ignition)) {
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    add(
      "pluck",
      chord[pattern[Math.floor(step / 2)]] + 24,
      0.26,
      vacuum ? 0.046 : 0.032,
      Math.sin(step * 1.6) * 0.62,
    );
  }
  if (
    (drop || (level >= 25 && !ignition && !vacuum)) &&
    melody[step] !== null
  ) {
    add("lead", melody[step], STEP * 1.7, 0.042, -0.1);
  }
  if (step === 0 && [4, 8, 20, 24].includes(bar)) add("crash", 0, 1.6, 0.06);
  if (bar % 8 === 7 && step === 8) add("rise", 0, STEP * 8, 0.042);
  return notes;
}

export class Soundtrack {
  constructor(context, volume = 0.65) {
    this.context = context;
    this.volume = volume;
    this.index = 0;
    this.level = 1;
    this.voices = new Set();
    this.playing = false;
    this.bus = context.createGain();
    this.master = context.createGain();
    this.master.gain.value = volume * 1.1;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -17;
    this.compressor.knee.value = 15;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.bus
      .connect(this.compressor)
      .connect(this.master)
      .connect(context.destination);
    this.echo = context.createDelay(2);
    this.echo.delayTime.value = STEP * 3;
    this.echoFilter = context.createBiquadFilter();
    this.echoFilter.type = "lowpass";
    this.echoFilter.frequency.value = 2100;
    this.feedback = context.createGain();
    this.feedback.gain.value = 0.28;
    this.echo
      .connect(this.echoFilter)
      .connect(this.feedback)
      .connect(this.echo);
    this.echoWet = context.createGain();
    this.echoWet.gain.value = 0.24;
    this.echoFilter.connect(this.echoWet).connect(this.bus);
    this.noise = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    );
    const data = this.noise.getChannelData(0);
    let seed = 0xa11ce55;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = (seed >>> 0) / 2147483648 - 1;
    }
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.master.gain.setTargetAtTime(
      this.playing ? this.volume * 1.1 : 0,
      this.context.currentTime,
      0.025,
    );
  }
  start(reset = false) {
    if (reset) {
      this.stop();
      this.index = 0;
    }
    if (this.playing) return;
    this.playing = true;
    this.master.gain.setTargetAtTime(
      this.volume * 1.1,
      this.context.currentTime,
      0.035,
    );
    this.nextAt = this.context.currentTime + 0.04;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }
  tick() {
    if (!this.playing || this.context.state !== "running") return;
    const now = this.context.currentTime;
    if (this.nextAt < now - 0.2) this.nextAt = now + 0.03;
    while (this.nextAt < now + 0.14) {
      this.scheduleStep(this.index++, this.nextAt, this.level);
      this.nextAt += STEP;
    }
  }
  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.018);
    for (const source of this.voices) {
      try {
        source.stop(this.context.currentTime + 0.025);
      } catch {
        /* Already ended. */
      }
    }
  }
  scheduleStep(index, at, level) {
    for (const note of scoreStep(index, level)) this.voice(note, at);
  }
  voice({ voice, note, duration, volume, pan }, at) {
    const c = this.context;
    const gain = c.createGain(),
      filter = c.createBiquadFilter();
    const stereo = c.createStereoPanner();
    stereo.pan.value = pan;
    gain.connect(stereo).connect(this.bus);
    filter.connect(gain);
    const sources = [];
    const oscillator = (type, frequency, detune = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(frequency, at);
      o.detune.value = detune;
      o.connect(filter);
      sources.push(o);
      return o;
    };
    const noise = () => {
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.connect(filter);
      sources.push(source);
    };
    let attack = 0.004,
      release = duration;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(8000, at);
    if (voice === "kick") {
      const o = oscillator("sine", 148);
      o.frequency.exponentialRampToValueAtTime(44, at + 0.055);
      o.frequency.exponentialRampToValueAtTime(32, at + duration);
    } else if (voice === "snare") {
      noise();
      oscillator("triangle", 170);
      filter.type = "highpass";
      filter.frequency.setValueAtTime(880, at);
    } else if (["hat", "crash", "rise"].includes(voice)) {
      noise();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(voice === "hat" ? 7200 : 2400, at);
      if (voice === "rise") {
        filter.frequency.exponentialRampToValueAtTime(9200, at + duration);
        attack = duration * 0.85;
      }
    } else if (voice === "bass") {
      oscillator("sawtooth", hz(note));
      oscillator("sine", hz(note));
      filter.frequency.setValueAtTime(980, at);
      filter.frequency.exponentialRampToValueAtTime(120, at + duration);
      filter.Q.value = 1.6;
    } else if (voice === "pad") {
      oscillator("sawtooth", hz(note), -7);
      oscillator("triangle", hz(note), 7);
      filter.frequency.setValueAtTime(780, at);
      attack = 0.18;
    } else {
      oscillator(voice === "lead" ? "sawtooth" : "triangle", hz(note), -5);
      if (voice === "lead") oscillator("triangle", hz(note), 5);
      filter.frequency.setValueAtTime(voice === "lead" ? 2400 : 4800, at);
      filter.frequency.exponentialRampToValueAtTime(620, at + duration);
      gain.connect(this.echo);
    }
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    if (["pad", "bass", "lead"].includes(voice))
      gain.gain.exponentialRampToValueAtTime(volume * 0.6, at + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + release);
    let remaining = sources.length;
    for (const source of sources) {
      this.voices.add(source);
      source.onended = () => {
        source.disconnect();
        this.voices.delete(source);
        if (--remaining === 0) {
          filter.disconnect();
          gain.disconnect();
          stereo.disconnect();
        }
      };
      source.start(at);
      source.stop(at + duration + 0.03);
    }
  }
}
