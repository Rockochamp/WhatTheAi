// TERMINAL VELOCITY — original 140 BPM electronic score in D minor.
// 32-bar arrangement: ignition / drive / drop / airlock / final drive.
// Audio-clock scheduling keeps the groove stable when rendering is busy.
export const BPM = 140;
export const STEP = 60 / BPM / 4;
const CHORDS = [
  [50, 53, 57, 64],
  [46, 50, 53, 57],
  [53, 57, 60, 67],
  [48, 52, 55, 62],
];
const MELODIES = [
  [74, null, 77, 81, null, 77, 76, null, 74, 72, null, 69, 72, null, 76, 77],
  [74, null, 77, 81, null, 77, 74, null, 70, 69, null, 65, 69, null, 72, 74],
  [77, null, 81, 84, null, 81, 79, null, 77, 76, null, 72, 76, null, 79, 81],
  [76, null, 79, 84, null, 79, 77, null, 76, 74, null, 72, 74, null, 76, 79],
];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Pure score data is shared by playback and the offline listening/QA render.
export function scoreStep(index, level = 1) {
  const bar = Math.floor(index / 16) % 32,
    step = index % 16;
  const chord = CHORDS[Math.floor(bar / 2) % 4];
  const melody = MELODIES[Math.floor(bar / 2) % 4];
  const airlock = bar >= 16 && bar < 20;
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
        airlock ? 0.032 : 0.014,
        (i - 1.5) * 0.38,
      ),
    );
  if (!airlock) {
    if (step % 4 === 0 || (drop && step === 14)) add("kick", 0, 0.32, 0.55);
    if (!ignition && (step === 4 || step === 12)) add("snare", 0, 0.19, 0.16);
    if (
      step % 2 === 0 ||
      (drop && step >= 13) ||
      (level >= 20 && step % 4 === 3)
    )
      add(
        "hat",
        0,
        step % 4 === 2 ? 0.1 : 0.035,
        step % 4 === 2 ? 0.075 : 0.032,
        step % 4 === 0 ? -0.32 : 0.32,
      );
    if ([0, 3, 6, 8, 10, 14].includes(step))
      add(
        "bass",
        chord[0] - 12 + (step === 14 ? 12 : 0),
        STEP * (step === 0 ? 2.6 : 1.6),
        0.115,
      );
    if (bar % 8 === 7 && step >= 12)
      add(
        "snare",
        0,
        0.09,
        0.045 + (step - 12) * 0.016,
        (step % 2 ? 1 : -1) * 0.3,
      );
  }
  if (step % 2 === 0 || (level >= 10 && !ignition)) {
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    add(
      "pluck",
      chord[pattern[Math.floor(step / 2)]] + 24,
      0.25,
      airlock ? 0.043 : 0.035,
      Math.sin(step * 1.7) * 0.65,
    );
  }
  if (
    (drop || (level >= 25 && !ignition && !airlock)) &&
    melody[step] !== null
  ) {
    add("lead", melody[step], STEP * 1.7, 0.045, -0.12);
  }
  if (step === 0 && [4, 8, 20, 24].includes(bar)) add("crash", 0, 1.6, 0.065);
  if (bar % 8 === 7 && step === 8) add("rise", 0, STEP * 8, 0.045);
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
    this.echoFilter.frequency.value = 2400;
    this.feedback = context.createGain();
    this.feedback.gain.value = 0.26;
    this.echo
      .connect(this.echoFilter)
      .connect(this.feedback)
      .connect(this.echo);
    this.echoWet = context.createGain();
    this.echoWet.gain.value = 0.22;
    this.echoFilter.connect(this.echoWet).connect(this.bus);
    this.noise = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    );
    const data = this.noise.getChannelData(0);
    let seed = 0xdecafbad;
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
    // Skip stale notes after an OS interruption; never replay a backlog at once.
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
      const o = oscillator("sine", 150);
      o.frequency.exponentialRampToValueAtTime(46, at + 0.055);
      o.frequency.exponentialRampToValueAtTime(35, at + duration);
    } else if (voice === "snare") {
      noise();
      oscillator("triangle", 180);
      filter.type = "highpass";
      filter.frequency.setValueAtTime(900, at);
    } else if (["hat", "crash", "rise"].includes(voice)) {
      noise();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(voice === "hat" ? 7500 : 2600, at);
      if (voice === "rise") {
        filter.frequency.exponentialRampToValueAtTime(9500, at + duration);
        attack = duration * 0.85;
      }
    } else if (voice === "bass") {
      oscillator("sawtooth", hz(note));
      oscillator("sine", hz(note));
      filter.frequency.setValueAtTime(1100, at);
      filter.frequency.exponentialRampToValueAtTime(130, at + duration);
      filter.Q.value = 1.5;
    } else if (voice === "pad") {
      oscillator("sawtooth", hz(note), -6);
      oscillator("sawtooth", hz(note), 6);
      filter.frequency.setValueAtTime(850, at);
      attack = 0.16;
    } else {
      oscillator(voice === "lead" ? "sawtooth" : "triangle", hz(note), -4);
      if (voice === "lead") oscillator("sawtooth", hz(note), 4);
      filter.frequency.setValueAtTime(voice === "lead" ? 2800 : 5200, at);
      filter.frequency.exponentialRampToValueAtTime(650, at + duration);
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
