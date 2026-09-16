function makeNoise(ctx, seconds = 0.25) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(ctx, dest, attack, peak, decay) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(dest);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let drone = null;
  let droneOsc = null;
  let hat = null;
  let noise = null;
  let muted = false;
  let unlocked = false;
  let lastGhost = 0;
  let volume = 0.7;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.95;
    sfx.connect(master);
    drone = ctx.createGain();
    drone.gain.value = 0;
    drone.connect(master);
    noise = makeNoise(ctx, 0.4);
    droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.value = 46;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 160;
    droneOsc.connect(filt);
    filt.connect(drone);
    droneOsc.start();
    hat = ctx.createGain();
    hat.gain.value = 0;
    hat.connect(master);
  }

  function resume() {
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
  }

  return {
    unlock() {
      if (unlocked) {
        resume();
        return;
      }
      ensure();
      resume();
      unlocked = true;
    },
    setMuted(next) {
      muted = next;
      if (master && ctx) {
        master.gain.setTargetAtTime(next ? 0 : volume, ctx.currentTime, 0.04);
      }
    },
    setVolume(next) {
      volume = Math.max(0, Math.min(1, next));
      if (master && ctx && !muted) {
        master.gain.setTargetAtTime(volume, ctx.currentTime, 0.04);
      }
    },
    setDrone(fever, live) {
      if (!drone || !ctx || muted) return;
      const target = live ? 0.016 + fever * 0.05 : 0.01;
      drone.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      if (droneOsc) {
        droneOsc.frequency.setTargetAtTime(
          46 + fever * 38,
          ctx.currentTime,
          0.12,
        );
      }
    },
    hit(perfect, fever) {
      if (!ctx || !sfx || !noise || muted) return;
      resume();
      const t = ctx.currentTime;
      const pitch = 190 + fever * 90 + (perfect ? 40 : 0);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.42, t + 0.08);
      const g = envGain(ctx, sfx, 0.003, perfect ? 0.22 : 0.15, perfect ? 0.16 : 0.09);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.2);

      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = 2.2 + Math.random() * 0.5;
      const ng = envGain(ctx, sfx, 0.001, perfect ? 0.1 : 0.055, 0.04);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1600 + Math.random() * 800;
      src.connect(bp);
      bp.connect(ng);
      src.start(t);
      src.stop(t + 0.07);

      if (perfect) {
        const ping = ctx.createOscillator();
        ping.type = "triangle";
        ping.frequency.setValueAtTime(920, t);
        ping.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
        const pg = envGain(ctx, sfx, 0.003, 0.1, 0.14);
        ping.connect(pg);
        ping.start(t);
        ping.stop(t + 0.18);
      }
    },
    miss() {
      if (!ctx || !sfx || !noise || muted) return;
      resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.45);
      const g = envGain(ctx, sfx, 0.01, 0.2, 0.5);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(800, t);
      f.frequency.exponentialRampToValueAtTime(120, t + 0.4);
      osc.connect(f);
      f.connect(g);
      osc.start(t);
      osc.stop(t + 0.5);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = 0.45;
      const ng = envGain(ctx, sfx, 0.01, 0.16, 0.4);
      src.connect(ng);
      src.start(t);
      src.stop(t + 0.45);
    },
    ember() {
      if (!ctx || !sfx || muted) return;
      resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.28);
      const g = envGain(ctx, sfx, 0.008, 0.16, 0.32);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.4);
    },
    lock(taktMs) {
      if (!ctx || !sfx || muted) return;
      resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, 60000 / taktMs),
        t + 0.18,
      );
      const g = envGain(ctx, sfx, 0.006, 0.12, 0.22);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.28);
    },
    ghost() {
      if (!ctx || !sfx || muted) return;
      const t = ctx.currentTime;
      if (t - lastGhost < 0.05) return;
      lastGhost = t;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 92;
      const g = envGain(ctx, sfx, 0.004, 0.035, 0.07);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.1);
    },
    stop() {
      if (!drone || !ctx) return;
      drone.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    },
  };
}
