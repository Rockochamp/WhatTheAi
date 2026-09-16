// MEATGRINDER: phase-aligned original industrial score + positional combat Foley.
export const MUSIC_BPM = 144,
  MUSIC_SECONDS = (32 * 4 * 60) / MUSIC_BPM;
export const MAX_FX_VOICES = 40;
const lengths = {
  shot: 0.14,
  hit: 0.17,
  kill: 0.36,
  bigKill: 0.62,
  slice: 0.25,
  toss: 0.24,
  lightning: 0.42,
  explode: 0.95,
  hurt: 0.38,
  dash: 0.27,
  xp: 0.16,
  level: 0.8,
  upgrade: 0.45,
  evolution: 1.6,
  boss: 1.8,
  death: 2.4,
  replay: 6.3,
  replayImpact: 0.9,
  pickup: 0.42,
  cache: 0.72,
  frenzy: 1.05,
  wave: 0.7,
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function makeEffect(kind, sampleRate = 44100, seed = 734) {
  const duration = lengths[kind] || 0.2,
    data = new Float32Array(Math.round(duration * sampleRate));
  let random = seed >>> 0,
    low = 0,
    phase = 0,
    second = 0,
    peak = 0;
  const chime = [
    "xp",
    "level",
    "upgrade",
    "evolution",
    "pickup",
    "cache",
    "frenzy",
    "wave",
  ].includes(kind);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate,
      u = t / duration;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const noise = random / 2147483648 - 1;
    let value = 0,
      frequency = 90,
      decay = 14;
    if (kind === "shot") {
      frequency = 65 + 155 * Math.exp(-t * 85);
      decay = 32;
      low += 0.42 * (noise - low);
      value =
        low * Math.exp(-t * 68) * 0.85 + noise * Math.exp(-t * 280) * 0.42;
    } else if (kind === "hit" || kind === "kill" || kind === "bigKill") {
      const big = kind === "bigKill";
      frequency = (big ? 50 : 92) + (big ? 170 : 340) * Math.exp(-t * 25);
      decay = kind === "hit" ? 32 : big ? 7 : 12;
      const cutoff = 0.07 + 0.4 * Math.exp(-t * 17);
      low += cutoff * (noise - low);
      const pulse = 0.45 + 0.55 * Math.pow(Math.sin(t * (big ? 76 : 139)), 2);
      value =
        low * pulse * Math.exp(-t * (big ? 6 : 11)) * 1.6 +
        noise * Math.exp(-t * 100) * 0.22;
      value += Math.sin(t * 2 * Math.PI * 1370) * Math.exp(-t * 73) * 0.14;
    } else if (kind === "slice" || kind === "dash") {
      frequency = kind === "dash" ? 100 + u * 750 : 260 - u * 180;
      decay = 10;
      low += (0.03 + 0.55 * Math.sin(u * Math.PI)) * (noise - low);
      value = (noise - low) * Math.sin(Math.PI * u) ** 0.7 * 0.62;
    } else if (kind === "toss") {
      frequency = 180 - 110 * u;
      decay = 24;
      value = noise * Math.exp(-t * 100) * 0.45;
    } else if (kind === "lightning") {
      frequency = 65 + 40 * Math.sin(t * 63);
      decay = 8;
      low += 0.45 * (noise - low);
      value =
        (noise - low) *
          (Math.sin(t * 680) > -0.2 ? 1 : 0.05) *
          Math.exp(-t * 6) *
          0.85 +
        Math.sin(t * 2 * Math.PI * 191) * Math.exp(-t * 10) * 0.13;
    } else if (kind === "explode" || kind === "hurt") {
      frequency = (kind === "explode" ? 28 : 45) + 125 * Math.exp(-t * 32);
      decay = kind === "explode" ? 5 : 14;
      low += 0.16 * (noise - low);
      value =
        low * Math.exp(-t * (kind === "explode" ? 4 : 13)) * 1.7 +
        noise * Math.exp(-t * 115) * 0.4;
    } else if (kind === "boss") {
      frequency = 55 + 10 * Math.sin(t * 5);
      decay = 1.6;
      low += 0.06 * (noise - low);
      value =
        low * 0.6 * Math.exp(-t * 2) +
        Math.sin(2 * Math.PI * 58.27 * t) * Math.exp(-t * 1.4) * 0.34;
      value +=
        Math.sin(2 * Math.PI * (160 * t - 23 * t * t)) *
        0.22 *
        Math.sin(Math.PI * u);
    } else if (kind === "death") {
      // Terminal impact, sub drop, then a falling dissonant metal tail.
      frequency = 31 + 125 * Math.exp(-t * 15);
      decay = 2.2;
      low += 0.11 * (noise - low);
      value = low * Math.exp(-t * 10) * 2.8 + noise * Math.exp(-t * 95) * 0.5;
      for (const hz of [146.83, 155.56, 207.65])
        value +=
          Math.sin(2 * Math.PI * hz * (t - 0.065 * t * t)) *
          Math.exp(-t * 2.4) *
          (0.7 + 0.3 * Math.sin(t * 17)) *
          0.18;
      value += Math.sin(2 * Math.PI * 39 * t) * Math.exp(-t * 1.9) * 0.3;
    } else if (kind === "replay") {
      frequency = 34 + 3 * Math.sin(t * 0.8);
      decay = 0.4;
      low += 0.013 * (noise - low);
      const pulse = t % 1.15;
      const beat =
        Math.exp(-pulse * 28) +
        (pulse > 0.19 ? Math.exp(-(pulse - 0.19) * 34) * 0.5 : 0);
      value =
        Math.sin(2 * Math.PI * 57 * t) * beat * 0.52 +
        low * 0.65 +
        Math.sin(t * 2 * Math.PI * 73.4) * 0.06;
      value *= Math.min(1, t / 0.3) * Math.min(1, (duration - t) / 0.6);
    } else if (kind === "replayImpact") {
      frequency = 29 + 70 * Math.exp(-t * 20);
      decay = 6;
      low += 0.09 * (noise - low);
      value = low * Math.exp(-t * 10) * 1.3;
    } else if (chime) {
      const root =
        kind === "xp"
          ? 880
          : kind === "evolution"
            ? 146.83
            : kind === "frenzy"
              ? 110
              : 293.66;
      const notes = kind === "xp" ? [1, 1.5] : [1, 1.498, 2, 2.378];
      notes.forEach((ratio, j) => {
        const elapsed = t - j * (kind === "xp" ? 0 : 0.055);
        if (elapsed >= 0)
          value +=
            Math.sin(
              2 * Math.PI * root * ratio * elapsed +
                0.35 * Math.sin(2 * Math.PI * root * ratio * 2 * elapsed),
            ) *
            Math.exp(-elapsed * (kind === "xp" ? 31 : 6)) *
            0.28;
      });
      if (["evolution", "frenzy", "wave"].includes(kind)) {
        frequency = 42 + 90 * Math.exp(-t * 18);
        decay = 4;
        low += 0.2 * (noise - low);
        value += low * Math.exp(-t * 6) * 0.6;
      }
    }
    phase += (2 * Math.PI * frequency) / sampleRate;
    second += (2 * Math.PI * frequency * 1.97) / sampleRate;
    if (!chime || ["evolution", "frenzy", "wave"].includes(kind))
      value +=
        (Math.sin(phase) + 0.14 * Math.sin(second)) *
        Math.exp(-t * decay) *
        0.55;
    const envelope =
      Math.min(1, t / 0.0015) * Math.min(1, (duration - t) / 0.018);
    value = Math.tanh(value * 1.6) * envelope;
    data[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const gain = 0.78 / Math.max(0.78, peak);
  for (let i = 0; i < data.length; i++) data[i] *= gain;
  return data;
}
export function createAudio({ onStatus = () => {} } = {}) {
  let ctx,
    master,
    musicBus,
    fxBus,
    baseGain,
    surgeGain,
    compressor,
    loading,
    enabled = true,
    volume = 0.45,
    musicVolume = 0.8,
    effectsVolume = 0.9,
    playing = false,
    intensity = 0,
    offset = 0,
    started = 0,
    transport = false,
    disposed = false,
    xpPitch = 0,
    lastXP = 0,
    lastHeartbeat = -10;
  const buffers = [],
    samples = new Map(),
    tracks = [],
    voices = new Set(),
    lastSounds = new Map();
  let lowHealth = false;
  function init() {
    if (ctx || disposed) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    ctx = new Audio();
    master = ctx.createGain();
    master.gain.value = 0;
    musicBus = ctx.createGain();
    fxBus = ctx.createGain();
    baseGain = ctx.createGain();
    surgeGain = ctx.createGain();
    surgeGain.gain.value = 0;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -9;
    compressor.knee.value = 9;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.14;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 27;
    baseGain.connect(musicBus);
    surgeGain.connect(musicBus);
    musicBus.connect(master);
    fxBus.connect(master);
    master.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(ctx.destination);
  }
  function setMix() {
    if (!ctx) return;
    master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.035);
    musicBus.gain.setTargetAtTime(
      playing ? musicVolume : 0,
      ctx.currentTime,
      0.07,
    );
    fxBus.gain.setTargetAtTime(effectsVolume, ctx.currentTime, 0.04);
    surgeGain.gain.setTargetAtTime(
      intensity === 2 ? 0.9 : intensity === 1 ? 0.66 : lowHealth ? 0.25 : 0,
      ctx.currentTime,
      0.28,
    );
    baseGain.gain.setTargetAtTime(
      intensity > 0 ? 0.88 : 1,
      ctx.currentTime,
      0.2,
    );
  }
  async function loadTracks() {
    if (!ctx || loading || !enabled || disposed) return loading;
    if (buffers[0] && buffers[1]) return;
    onStatus("loading");
    loading = (async () => {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 16000);
      try {
        await Promise.all(
          ["meatgrinder.mp3", "meatgrinder-surge.mp3"].map(async (name, i) => {
            if (buffers[i]) return;
            const response = await fetch(new URL(name, import.meta.url), {
              signal: controller.signal,
            });
            if (!response.ok) throw Error("Soundtrack unavailable");
            const data = await response.arrayBuffer();
            const decoded = await ctx.decodeAudioData(data);
            if (!disposed) buffers[i] = decoded;
          }),
        );
        if (!disposed) {
          onStatus("ready");
          if (playing) {
            stopTracks();
            startTracks();
          }
        }
      } catch {
        if (!disposed) {
          onStatus("unavailable");
          if (playing && buffers[0]) startTracks();
        }
      } finally {
        clearTimeout(timeout);
        loading = null;
      }
    })();
    return loading;
  }
  function startTracks() {
    if (
      !ctx ||
      transport ||
      !playing ||
      !enabled ||
      !buffers[0] ||
      ctx.state !== "running" ||
      disposed
    )
      return;
    started = ctx.currentTime + 0.025;
    transport = true;
    buffers.forEach((buffer, i) => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = Math.min(MUSIC_SECONDS, buffer.duration);
      source.connect(i ? surgeGain : baseGain);
      source.start(started, offset % source.loopEnd);
      tracks.push(source);
    });
    setMix();
  }
  function stopTracks() {
    if (transport && ctx)
      offset =
        (offset + Math.max(0, ctx.currentTime - started)) % MUSIC_SECONDS;
    transport = false;
    for (const source of tracks.splice(0)) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
  }
  async function unlock() {
    try {
      init();
      if (ctx?.state === "suspended") await ctx.resume();
      setMix();
      loadTracks();
      startTracks();
    } catch {
      /* Audio failure must not stop a run. */
    }
  }
  function sample(name) {
    if (!samples.has(name)) {
      const data = makeEffect(name, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.copyToChannel(data, 0);
      samples.set(name, buffer);
    }
    return samples.get(name);
  }
  function play(
    name,
    { gain = 1, pan = 0, rate = 1, delay = 0, priority = false } = {},
  ) {
    if (!enabled || !ctx || ctx.state !== "running" || disposed) return;
    if (voices.size >= MAX_FX_VOICES) {
      if (!priority) return;
      const oldest = voices.values().next().value;
      oldest.stop();
    }
    const source = ctx.createBufferSource(),
      envelope = ctx.createGain(),
      panner = ctx.createStereoPanner?.();
    source.buffer = sample(name);
    source.playbackRate.value = rate;
    envelope.gain.value = gain;
    source.connect(envelope);
    if (panner) {
      panner.pan.value = clamp(pan, -0.8, 0.8);
      envelope.connect(panner);
      panner.connect(fxBus);
    } else envelope.connect(fxBus);
    let ended = false;
    const cleanup = () => {
      if (ended) return;
      ended = true;
      voices.delete(voice);
      source.disconnect();
      envelope.disconnect();
      panner?.disconnect();
    };
    const voice = {
      stop() {
        try {
          source.stop();
        } catch {}
        cleanup();
      },
    };
    voices.add(voice);
    source.onended = cleanup;
    source.start(ctx.currentTime + delay);
  }
  function sound(type, event = {}) {
    if (!ctx || !enabled || disposed) return;
    const t = ctx.currentTime,
      pan = clamp(event.pan || 0, -0.75, 0.75),
      jitter = 0.94 + Math.random() * 0.12;
    const limits = {
      hit: 0.035,
      kill: 0.045,
      shoot: 0.055,
      throw: 0.07,
      explode: 0.09,
      lightning: 0.09,
      xp: 0.08,
    };
    if (t - (lastSounds.get(type) ?? -100) < (limits[type] || 0)) return;
    lastSounds.set(type, t);
    if (type === "shoot") play("shot", { gain: 0.43, rate: jitter });
    else if (type === "hit")
      play(
        event.weapon === "peels" || event.weapon === "boomerang"
          ? "slice"
          : "hit",
        { gain: event.critical ? 0.56 : 0.28, pan, rate: jitter },
      );
    else if (type === "kill")
      play(event.size > 100 ? "bigKill" : "kill", {
        gain: event.size > 100 ? 0.82 : 0.62,
        pan,
        rate: jitter,
      });
    else if (type === "execute") {
      play("bigKill", { gain: 0.95, pan, rate: jitter * 0.86, priority: true });
      play("slice", { gain: 0.55, pan, rate: 0.7, delay: 0.04 });
    } else if (type === "cleave")
      play("slice", { gain: 0.72, pan, rate: jitter * 0.8 });
    else if (type === "crush")
      play("explode", { gain: 0.88, pan, priority: true });
    else if (type === "bloodlust")
      play("frenzy", { gain: 0.7, rate: 0.84 });
    else if (type === "throw")
      play(event.weapon === "coconut" ? "toss" : "slice", {
        gain: 0.47,
        rate: jitter,
      });
    else if (type === "explode") {
      play("explode", { gain: 0.76, pan, priority: true });
    } else if (type === "hurt") {
      play("hurt", { gain: 0.95, priority: true });
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setTargetAtTime(musicVolume * 0.58, t, 0.015);
      musicBus.gain.setTargetAtTime(playing ? musicVolume : 0, t + 0.2, 0.16);
    } else if (type === "xp") {
      if (t - lastXP > 1.1) xpPitch = 0;
      lastXP = t;
      play("xp", { gain: 0.17, rate: 2 ** (((xpPitch++ % 5) * 2) / 12) });
    } else if (type === "bossDefeated")
      play("evolution", { gain: 0.82, priority: true });
    else if (type === "dash") play("dash", { gain: 0.68 });
    else if (type === "lightning") play("lightning", { gain: 0.59, pan });
    else if (lengths[type])
      play(type, {
        gain: ["death", "boss", "evolution"].includes(type) ? 0.95 : 0.62,
        priority: true,
      });
  }
  function pause() {
    playing = false;
    stopTracks();
    setMix();
  }
  function stopEffects() {
    for (const voice of [...voices]) voice.stop();
  }
  function resume() {
    playing = true;
    setMix();
    startTracks();
    if (ctx) loadTracks();
  }
  function resetRun() {
    stopTracks();
    stopEffects();
    offset = 0;
    intensity = 0;
    lowHealth = false;
    lastSounds.clear();
    lastHeartbeat = -10;
    xpPitch = 0;
  }
  return {
    unlock,
    pause,
    resume,
    resetRun,
    stopEffects,
    death() {
      pause();
      stopEffects();
      play("death", { gain: 0.95, priority: true });
    },
    replay(impact = false) {
      if (impact) stopEffects();
      play(impact ? "replayImpact" : "replay", {
        gain: impact ? 0.64 : 0.3,
        priority: true,
      });
    },
    sound,
    setIntensity(value, { health = 1 } = {}) {
      const next = clamp(value, 0, 2),
        hurt = health < 0.3;
      if (next !== intensity || hurt !== lowHealth) {
        intensity = next;
        lowHealth = hurt;
        setMix();
      }
      if (playing && hurt && ctx && ctx.currentTime - lastHeartbeat > 1.1) {
        lastHeartbeat = ctx.currentTime;
        play("hit", { gain: 0.18, rate: 0.58 });
        play("hit", { gain: 0.1, rate: 0.65, delay: 0.17 });
      }
    },
    configure(options) {
      const wasEnabled = enabled;
      enabled = options.audio !== false;
      volume = clamp(
        Number.isFinite(options.volume) ? options.volume : 0.45,
        0,
        1,
      );
      musicVolume = clamp(options.musicVolume ?? 0.8, 0, 1);
      effectsVolume = clamp(options.effectsVolume ?? 0.9, 0, 1);
      setMix();
      if (!enabled) stopTracks();
      else if (!wasEnabled) {
        startTracks();
        if (ctx) loadTracks();
      }
    },
    retry() {
      return loadTracks();
    },
    dispose() {
      disposed = true;
      pause();
      for (const voice of [...voices]) voice.stop();
      samples.clear();
      buffers.length = 0;
      ctx?.close();
    },
  };
}
