// OPEN FRUIT — live WebAudio. Heartbeat, wet metal, no samples.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createAudio() {
  let ctx = null,
    master,
    fx,
    music,
    drone,
    pulse,
    enabled = true,
    volume = 0.55,
    musicVol = 0.72,
    fxVol = 0.9,
    last = new Map();

  function boot() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    fx = ctx.createGain();
    music = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    fx.gain.value = fxVol;
    music.gain.value = 0;
    master.gain.value = volume;
    fx.connect(comp);
    music.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    startBed();
    return ctx;
  }

  function startBed() {
    if (!ctx || drone) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc2.type = "triangle";
    osc.frequency.value = 38;
    osc2.frequency.value = 57;
    f.type = "lowpass";
    f.frequency.value = 160;
    g.gain.value = 0.07;
    osc.connect(f);
    osc2.connect(f);
    f.connect(g);
    g.connect(music);
    osc.start();
    osc2.start();
    drone = { osc, osc2, g, f };

    const pulseOsc = ctx.createOscillator();
    const pg = ctx.createGain();
    pulseOsc.type = "sine";
    pulseOsc.frequency.value = 52;
    pg.gain.value = 0;
    pulseOsc.connect(pg);
    pg.connect(music);
    pulseOsc.start();
    pulse = { osc: pulseOsc, g: pg };

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const ng = ctx.createGain();
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 1800;
    ng.gain.value = 0.01;
    src.connect(nf);
    nf.connect(ng);
    ng.connect(music);
    src.start();
    drone.drip = { src, ng };
  }

  function tone(freq, dur, type = "triangle", gain = 0.18, pan = 0) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    o.type = type;
    o.frequency.value = freq;
    p.pan.value = clamp(pan, -1, 1);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.connect(g);
    g.connect(p);
    p.connect(fx);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, freq, gain, pan = 0) {
    if (!ctx || !enabled) return;
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    f.type = "bandpass";
    f.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    p.pan.value = clamp(pan, -1, 1);
    src.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(fx);
    src.start();
  }

  function gated(name, gap) {
    const t = ctx ? ctx.currentTime : 0;
    if ((last.get(name) || 0) + gap > t) return false;
    last.set(name, t);
    return true;
  }

  return {
    unlock() {
      boot();
      ctx?.resume();
    },
    resume() {
      if (!enabled) return;
      boot();
      ctx?.resume();
      if (music) music.gain.setTargetAtTime(musicVol * 0.45, ctx.currentTime, 0.4);
    },
    pause() {
      if (music && ctx) music.gain.setTargetAtTime(0.02, ctx.currentTime, 0.2);
    },
    setEnabled(on) {
      enabled = on;
      if (!on && master) master.gain.value = 0;
      else if (master) master.gain.value = volume;
    },
    ripe(amount) {
      if (!pulse || !ctx) return;
      const t = ctx.currentTime;
      pulse.osc.frequency.setTargetAtTime(48 + amount * 36, t, 0.2);
      pulse.g.gain.setTargetAtTime(0.012 + amount * 0.05, t, 0.15);
      if (drone) drone.f.frequency.setTargetAtTime(140 + amount * 220, t, 0.25);
    },
    sound(type, { pan = 0 } = {}) {
      if (!ctx || !enabled) return;
      if (type === "hit" && gated("hit", 0.04)) {
        noiseBurst(0.08, 900, 0.16, pan);
        tone(180, 0.07, "sawtooth", 0.05, pan);
      } else if (type === "kill" && gated("kill", 0.03)) {
        noiseBurst(0.16, 420, 0.28, pan);
        tone(90, 0.18, "square", 0.08, pan);
      } else if (type === "split") {
        tone(220, 0.12, "sawtooth", 0.14, pan);
        noiseBurst(0.12, 1400, 0.18, pan);
        tone(70, 0.2, "sine", 0.1, pan);
      } else if (type === "burst") {
        noiseBurst(0.4, 180, 0.42, pan);
        tone(48, 0.5, "sawtooth", 0.22, pan);
        tone(140, 0.28, "square", 0.1, pan);
      } else if (type === "crush") {
        noiseBurst(0.2, 240, 0.3, pan);
        tone(60, 0.22, "sine", 0.12, pan);
      } else if (type === "hurt") {
        tone(140, 0.16, "square", 0.12, pan);
        noiseBurst(0.14, 700, 0.14, pan);
      } else if (type === "pulp") {
        tone(520, 0.08, "sine", 0.05, pan);
      } else if (type === "prize") {
        tone(80, 0.5, "sawtooth", 0.16);
        tone(160, 0.4, "triangle", 0.1);
      } else if (type === "yank") {
        tone(90, 0.12, "sawtooth", 0.08, pan);
      }
    },
  };
}
