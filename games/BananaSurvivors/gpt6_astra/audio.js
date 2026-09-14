// Original, synthesized jungle breakbeat. No samples, downloads or autoplay.
export function createAudio() {
  let ctx,
    master,
    musicBus,
    fxBus,
    noise,
    timer,
    enabled = true,
    volume = 0.45,
    playing = false,
    next = 0,
    step = 0,
    intensity = 0,
    lastShot = 0,
    lastXP = 0,
    voices = 0;
  const BPM = 128,
    beat = 60 / BPM / 4;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function init() {
    if (ctx) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    ctx = new Audio();
    master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -15;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.68;
    fxBus = ctx.createGain();
    fxBus.gain.value = 0.6;
    musicBus.connect(master);
    fxBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 77;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }
  function tone(
    frequency,
    t,
    duration,
    gain = 0.15,
    type = "sine",
    bus = musicBus,
    endFrequency,
  ) {
    if (!ctx || voices > 70) return;
    voices++;
    const oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        t + duration,
      );
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain),
      t + 0.008,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.025);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      voices--;
    };
  }
  function hiss(t, duration, gain, freq = 6000, bus = musicBus) {
    if (!ctx || voices > 70) return;
    voices++;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      envelope = ctx.createGain();
    source.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = freq;
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    source.start(t);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      voices--;
    };
  }
  function schedule() {
    if (!playing || !enabled || !ctx || ctx.state !== "running") return;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.04;
    while (next < ctx.currentTime + 0.12) {
      const bar = Math.floor(step / 16),
        i = step % 16,
        root = [38, 34, 41, 36][Math.floor(bar / 2) % 4],
        t = next + (i % 2 ? 0.012 : 0);
      // Syncopated kick, a dry backbeat, shuffled hats, and woody percussion.
      if ([0, 6, 8, 11].includes(i) || (intensity > 0 && i === 14))
        tone(135, t, 0.17, 0.55, "sine", musicBus, 43);
      if (i === 4 || i === 12) {
        hiss(t, 0.11, 0.2, 1300);
        tone(175, t, 0.12, 0.15, "triangle", musicBus, 100);
      }
      if (i % 2 === 0 || intensity > 0)
        hiss(t, i === 10 ? 0.1 : 0.035, i % 4 === 2 ? 0.072 : 0.042, 7000);
      if ([3, 7, 15].includes(i))
        tone(310 + (i % 3) * 80, t, 0.045, 0.065, "sine", musicBus, 170);
      if ([0, 3, 6, 8, 10, 14].includes(i)) {
        const interval = { 0: 0, 3: 12, 6: 7, 8: 0, 10: 10, 14: 7 }[i];
        tone(
          midi(root + interval),
          t,
          beat * (i === 0 ? 2.7 : 1.4),
          0.19,
          "triangle",
        );
        tone(midi(root + interval - 12), t, 0.17, 0.1);
      }
      // Glassy marimba motif: a four-bar call and response, changing every phrase.
      const motifs = [
        [0, null, 7, 10, null, 12, 7, null],
        [0, 3, null, 7, 10, null, 7, 3],
        [12, null, 10, 7, null, 3, 7, null],
        [7, 3, null, 0, 3, 7, null, 10],
      ];
      if (i % 2 === 0) {
        const note = motifs[bar % 4][i / 2];
        if (note !== null) {
          const f = midi(root + 24 + note);
          tone(f, t, 0.25, 0.12);
          tone(f * 2.01, t, 0.085, 0.035);
        }
      }
      if (i === 0) {
        [0, 3, 7, 10].forEach((n, j) =>
          tone(midi(root + 12 + n), t + j * 0.025, 1.5, 0.023, "triangle"),
        );
      }
      if (intensity === 2 && i % 2 === 1)
        tone(midi(root + 36 + [0, 7, 10, 12][i % 4]), t, 0.09, 0.035, "sine");
      step++;
      next += beat;
    }
  }
  function apply() {
    if (master && ctx)
      master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.05);
  }
  async function unlock() {
    try {
      init();
      if (ctx?.state === "suspended") await ctx.resume();
      apply();
    } catch {
      /* Silent play remains available. */
    }
  }
  function start() {
    playing = true;
    if (!timer) timer = setInterval(schedule, 25);
    if (ctx) next = ctx.currentTime + 0.04;
  }
  function pause() {
    playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (musicBus && ctx)
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  }
  function resume() {
    if (musicBus && ctx)
      musicBus.gain.setTargetAtTime(0.68, ctx.currentTime, 0.05);
    start();
  }
  function sound(type) {
    if (!enabled || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    if (type === "shoot") {
      if (t - lastShot < 0.095) return;
      lastShot = t;
      tone(680, t, 0.05, 0.06, "triangle", fxBus, 250);
    } else if (type === "xp") {
      if (t - lastXP < 0.07) return;
      lastXP = t;
      tone(midi(79 + (step % 5)), t, 0.1, 0.075, "sine", fxBus);
    } else if (type === "hurt") {
      hiss(t, 0.12, 0.18, 300, fxBus);
      tone(135, t, 0.15, 0.2, "sawtooth", fxBus, 50);
    } else if (type === "dash" || type === "throw") {
      hiss(t, type === "dash" ? 0.2 : 0.08, 0.065, 2800, fxBus);
      tone(220, t, 0.12, 0.045, "triangle", fxBus, 650);
    } else if (type === "lightning") {
      hiss(t, 0.12, 0.09, 1700, fxBus);
    } else if (type === "explode") {
      hiss(t, 0.22, 0.14, 150, fxBus);
      tone(95, t, 0.2, 0.24, "sine", fxBus, 30);
    } else if (
      [
        "level",
        "upgrade",
        "cache",
        "pickup",
        "evolution",
        "bossDefeated",
        "frenzy",
      ].includes(type)
    ) {
      const notes =
        type === "evolution" ? [62, 65, 69, 74, 77, 81] : [74, 77, 81];
      notes.forEach((n, i) =>
        tone(midi(n), t + i * 0.055, 0.34, 0.1, "sine", fxBus),
      );
    } else if (type === "boss") {
      [38, 39, 38].forEach((n, i) =>
        tone(midi(n), t + i * 0.22, 0.38, 0.15, "sawtooth", fxBus),
      );
    } else if (type === "death") {
      [69, 65, 62, 50].forEach((n, i) =>
        tone(midi(n), t + i * 0.13, 0.5, 0.12, "triangle", fxBus),
      );
    }
  }
  return {
    unlock,
    resume,
    pause,
    sound,
    setIntensity(value) {
      intensity = value;
    },
    configure(options) {
      enabled = options.audio;
      volume = options.volume;
      apply();
      if (!enabled && timer) {
        clearInterval(timer);
        timer = null;
      } else if (enabled && playing && !timer)
        timer = setInterval(schedule, 25);
    },
    dispose() {
      pause();
      ctx?.close();
    },
  };
}
