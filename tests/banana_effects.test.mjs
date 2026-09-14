import test from "node:test";
import assert from "node:assert/strict";
import {
  createGore,
  GORE_LIMITS,
} from "../games/BananaSurvivors/gpt6_astra/gore.js";
import {
  createAudio,
  makeEffect,
  MUSIC_SECONDS,
  MAX_FX_VOICES,
} from "../games/BananaSurvivors/gpt6_astra/audio.js";
import { rng } from "../games/BananaSurvivors/gpt6_astra/engine.js";

const player = { x: 0, y: 0 };
test("gore produces spray, flesh/bone fragments and persistent ground stains", () => {
  const gore = createGore(rng(17));
  gore.emit({ type: "kill", x: 80, y: 0, size: 160 }, player);
  assert.ok(gore.counts.blood >= 40);
  assert.equal(gore.counts.chunks, 12);
  assert.equal(gore.counts.stains, 1);
  for (let i = 0; i < 90; i++) gore.update(1 / 60);
  assert.equal(gore.counts.blood, 0);
  assert.ok(gore.counts.chunks > 0);
  assert.ok(gore.counts.stains > 1);
  for (let i = 0; i < 3100; i++) gore.update(1 / 60);
  assert.deepEqual(gore.counts, { blood: 0, chunks: 0, stains: 0 });
});
test("gore remains bounded during mass kills and repeated impacts", () => {
  const gore = createGore(rng(5));
  for (let i = 0; i < 1500; i++) {
    gore.emit({ type: "kill", x: i, y: 40, size: 160 }, player);
    gore.update(1 / 60);
    for (const [name, count] of Object.entries(gore.counts))
      assert.ok(count <= GORE_LIMITS[name]);
  }
  const paused = { ...gore.counts };
  gore.update(0);
  gore.update(NaN);
  assert.deepEqual(gore.counts, paused);
  gore.clear();
  assert.deepEqual(gore.counts, { blood: 0, chunks: 0, stains: 0 });
});
test("gore preference disables all gore while reduced effects still retain blood", () => {
  const a = createGore(rng(5)),
    b = createGore(rng(5));
  a.emit({ type: "kill", x: 0, y: 0, size: 160 }, player, { enabled: false });
  assert.deepEqual(a.counts, { blood: 0, chunks: 0, stains: 0 });
  b.emit({ type: "kill", x: 0, y: 0, size: 160 }, player, {
    low: true,
    quiet: true,
  });
  assert.ok(b.counts.blood > 0 && b.counts.blood < 30);
  assert.equal(b.counts.chunks, 2);
});
test("all combat sounds are finite, non-silent and end without a hard discontinuity", () => {
  const names = [
    "shot",
    "hit",
    "kill",
    "bigKill",
    "slice",
    "toss",
    "lightning",
    "explode",
    "hurt",
    "dash",
    "xp",
    "level",
    "upgrade",
    "evolution",
    "boss",
    "death",
    "pickup",
    "cache",
    "frenzy",
    "wave",
  ];
  for (const name of names) {
    const data = makeEffect(name, 22050);
    let energy = 0,
      peak = 0;
    for (const v of data) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    assert.ok(peak <= 0.781 && peak > 0.1, name);
    assert.ok(energy / data.length > 0.0001, name);
    assert.equal(data[0], 0);
    assert.ok(Math.abs(data.at(-1)) < 0.01, name);
  }
  assert.notDeepEqual(makeEffect("hit", 22050), makeEffect("kill", 22050));
});

test("music stems stay synchronized, pause preserves position, and combat voices are capped", async () => {
  const prior = { window: globalThis.window, fetch: globalThis.fetch };
  let ctx;
  const active = new Set(),
    starts = [],
    gains = [];
  class Param {
    constructor(value = 0) {
      this.value = value;
    }
    setTargetAtTime(v) {
      assert.ok(Number.isFinite(v));
      this.value = v;
    }
    cancelScheduledValues() {}
  }
  class Node {
    connect() {}
    disconnect() {}
  }
  class Context {
    constructor() {
      ctx = this;
      this.currentTime = 0;
      this.sampleRate = 22050;
      this.state = "suspended";
      this.destination = new Node();
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
    }
    createGain() {
      const n = new Node();
      n.gain = new Param();
      gains.push(n);
      return n;
    }
    createBiquadFilter() {
      const n = new Node();
      n.frequency = new Param();
      return n;
    }
    createDynamicsCompressor() {
      const n = new Node();
      for (const k of ["threshold", "knee", "ratio", "attack", "release"])
        n[k] = new Param();
      return n;
    }
    createStereoPanner() {
      const n = new Node();
      n.pan = new Param();
      return n;
    }
    createBuffer(channels, length, rate) {
      return { duration: length / rate, copyToChannel() {} };
    }
    decodeAudioData() {
      return Promise.resolve({ duration: MUSIC_SECONDS });
    }
    createBufferSource() {
      const n = new Node();
      n.playbackRate = new Param(1);
      n.start = (time, offset) => {
        starts.push({ n, time, offset });
        active.add(n);
      };
      n.stop = () => {
        active.delete(n);
        n.onended?.();
      };
      return n;
    }
  }
  globalThis.window = { AudioContext: Context };
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const statuses = [],
    audio = createAudio({ onStatus: (s) => statuses.push(s) });
  try {
    audio.resume();
    await audio.unlock();
    await audio.retry();
    let loops = [...active].filter((n) => n.loop);
    assert.equal(loops.length, 2);
    const first = starts.filter((s) => s.n.loop);
    assert.equal(first[0].time, first[1].time);
    assert.equal(first[0].offset, first[1].offset);
    assert.ok(statuses.includes("ready"));
    assert.equal(requests, 2);
    ctx.currentTime = 8;
    audio.pause();
    assert.equal([...active].filter((n) => n.loop).length, 0);
    ctx.currentTime = 15;
    audio.resume();
    const resumed = starts.filter((s) => s.n.loop).slice(-2);
    assert.equal(resumed[0].offset, resumed[1].offset);
    assert.ok(resumed[0].offset > 7 && resumed[0].offset < 8);
    audio.setIntensity(2);
    assert.equal(gains[4].gain.value, 0.9);
    audio.setIntensity(0);
    assert.equal(gains[4].gain.value, 0);
    for (let i = 0; i < 120; i++) {
      ctx.currentTime += 0.06;
      audio.sound("kill", { size: 160 });
    }
    assert.ok([...active].filter((n) => !n.loop).length <= MAX_FX_VOICES);
    audio.sound("boss");
    assert.ok([...active].filter((n) => !n.loop).length <= MAX_FX_VOICES);
    audio.configure({ audio: false, volume: 0.4 });
    assert.equal(gains[0].gain.value, 0);
    assert.equal([...active].filter((n) => n.loop).length, 0);
    audio.configure({
      audio: true,
      volume: 0.4,
      musicVolume: 0.7,
      effectsVolume: 0.6,
    });
    assert.equal([...active].filter((n) => n.loop).length, 2);
    audio.pause();
    audio.resetRun();
    audio.resume();
    assert.equal(starts.filter((s) => s.n.loop).at(-1).offset, 0);
  } finally {
    audio.dispose();
    assert.equal(active.size, 0);
    Object.assign(globalThis, prior);
  }
});
test("a missing soundtrack fails softly and can be retried", async () => {
  const prior = { window: globalThis.window, fetch: globalThis.fetch };
  let requests = 0;
  const node = () => ({
    gain: { setTargetAtTime() {} },
    frequency: {},
    connect() {},
    disconnect() {},
  });
  class Context {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = node();
      this.sampleRate = 22050;
    }
    createGain() {
      return node();
    }
    createBiquadFilter() {
      return node();
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: {},
        knee: {},
        ratio: {},
        attack: {},
        release: {},
      };
    }
    close() {}
  }
  globalThis.window = { AudioContext: Context };
  globalThis.fetch = async () => {
    requests++;
    throw Error("offline");
  };
  const statuses = [],
    audio = createAudio({ onStatus: (s) => statuses.push(s) });
  try {
    await audio.unlock();
    await audio.retry();
    assert.ok(statuses.includes("unavailable"));
    const before = requests;
    await audio.retry();
    assert.ok(requests > before);
  } finally {
    audio.dispose();
    Object.assign(globalThis, prior);
  }
});
