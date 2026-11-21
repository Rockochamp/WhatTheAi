// Shared helpers for the Claude Fable 5.2 editions on whatthe.ai.
// Pure functions are safe to import in Node tests; browser APIs are only
// touched inside functions that need them.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** Small, fast, seedable generator (mulberry32). Returns floats in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** UTC calendar day, e.g. "2026-11-21". Everyone shares the same daily seed. */
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const formatInt = (n) => Math.floor(n).toLocaleString("en-US");
export const formatTime = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function runId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- storage ---------- */

/** localStorage wrapper that never throws (private mode, blocked storage). */
export function prefs(prefix, storage) {
  const s = () => storage ?? globalThis.localStorage;
  return {
    get(key, fallback = null) {
      try {
        const v = s().getItem(prefix + key);
        return v === null || v === undefined ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        s().setItem(prefix + key, String(value));
        return true;
      } catch {
        return false;
      }
    },
    json(key, fallback) {
      try {
        const v = s().getItem(prefix + key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    setJson(key, value) {
      return this.set(key, JSON.stringify(value));
    },
  };
}

/* ---------- nicknames ---------- */

export function cleanName(raw, max = 16) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

/**
 * Checks a nickname against the site's shared blocklist. Short words must
 * match a whole token so that names such as "Cassie" stay allowed.
 */
export function nameAllowed(name, words) {
  const list =
    words ?? (typeof offensiveWords !== "undefined" ? offensiveWords : []); // eslint-disable-line no-undef
  const lower = name.toLowerCase();
  const squashed = lower.replace(/[^a-z0-9]/g, "");
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  return !list.some((word) => {
    const w = word.replace(/\s+/g, "");
    if (!w) return false;
    if (w.length >= 5) return squashed.includes(w);
    return tokens.includes(w) || squashed === w;
  });
}

/* ---------- leaderboards ---------- */

// Public web-client identifiers of the site's existing Firebase project.
const FIREBASE = {
  apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
  authDomain: "cosmicdodge-5ae20.firebaseapp.com",
  projectId: "cosmicdodge-5ae20",
  storageBucket: "cosmicdodge-5ae20.appspot.com",
  messagingSenderId: "940230809594",
  appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643",
};
const SDK = "https://www.gstatic.com/firebasejs/9.22.2/";

export const isLiveSite = () =>
  typeof location !== "undefined" &&
  ["whatthe.ai", "www.whatthe.ai"].includes(location.hostname);

const loads = new Map();
function loadScript(src) {
  if (loads.has(src)) return loads.get(src);
  const p = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    const timer = setTimeout(() => {
      el.remove();
      reject(new Error("Connection timed out"));
    }, 8000);
    el.src = src;
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      el.remove();
      reject(new Error("Connection unavailable"));
    };
    document.head.appendChild(el);
  }).catch((error) => {
    loads.delete(src);
    throw error;
  });
  loads.set(src, p);
  return p;
}

let dbPromise;
async function database() {
  if (!isLiveSite()) throw new Error("preview");
  dbPromise ??= (async () => {
    if (!window.firebase) await loadScript(SDK + "firebase-app-compat.js");
    if (!window.firebase.firestore)
      await loadScript(SDK + "firebase-firestore-compat.js");
    if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE);
    return window.firebase.firestore();
  })().catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function bounded(promise, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connection timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * A leaderboard with device-local records and an optional shared board.
 *
 * @param {object} o
 * @param {string} o.slug       e.g. "cosmic_dodge_claude_fable_5_2_v1"
 * @param {string} o.game       gameTitle stored in the global counter
 * @param {(r:object)=>boolean} o.valid  record validator
 * @param {(a:object,b:object)=>number} [o.compare]  best first
 * @param {number} [o.keep]     local records kept
 */
export function createBoard({ slug, game, valid, compare, keep = 10 }) {
  const order = compare ?? ((a, b) => b.score - a.score);
  const rank = (records, limit = keep) =>
    records.filter(valid).sort(order).slice(0, limit);
  const key = `fable_board_${slug}`;
  const collection = `leaderboard_${slug}`;

  return {
    slug,
    collection,
    rank,
    readLocal(storage = globalThis.localStorage) {
      try {
        const v = JSON.parse(storage.getItem(key) || "[]");
        return Array.isArray(v) ? rank(v) : [];
      } catch {
        return [];
      }
    },
    addLocal(record, storage = globalThis.localStorage) {
      const ranked = rank([
        ...this.readLocal(storage).filter((r) => r.id !== record.id),
        record,
      ]);
      let persisted = true;
      try {
        storage.setItem(key, JSON.stringify(ranked));
      } catch {
        persisted = false;
      }
      return { records: ranked, persisted };
    },
    /** Top shared records. `where` is an optional [field, value] equality. */
    async fetchGlobal({ limit = 20, where = null, sub = "" } = {}) {
      const db = await database();
      let q = db.collection(collection + sub);
      q = where
        ? q.where(where[0], "==", where[1]).limit(200)
        : q.orderBy("score", "desc").limit(limit);
      const snap = await bounded(q.get());
      return rank(
        snap.docs.map((d) => ({ ...d.data(), id: d.id })),
        limit,
      );
    },
    /** Idempotent: the run id is the document id, so retries cannot double count. */
    async saveGlobal(record, { sub = "" } = {}) {
      if (!valid(record)) throw new Error("Invalid record");
      const db = await database();
      const ref = db.collection(collection + sub).doc(record.id);
      const stats = db.collection("globalStats").doc(`stats_${slug}`);
      const fv = window.firebase.firestore.FieldValue;
      await bounded(
        db.runTransaction(async (tx) => {
          if ((await tx.get(ref)).exists) return;
          tx.set(ref, {
            ...record,
            version: "claude_fable_5_2",
            timestamp: fv.serverTimestamp(),
          });
          tx.set(
            stats,
            {
              gameTitle: game,
              version: "claude_fable_5_2",
              totalGamesPlayed: fv.increment(1),
            },
            { merge: true },
          );
        }),
      );
    },
  };
}

/* ---------- sharing ---------- */

/** Uses the native share sheet when present, otherwise copies to the clipboard. */
export async function share({ title, text, url }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "failed";
  }
}

/* ---------- sound ---------- */

/**
 * A tiny Web Audio toolkit: one context, a limiter, a music bus and an
 * effects bus. Everything is synthesised; nothing is downloaded.
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVolume = 0.6;
  }
  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.muted) return null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!this.ctx && AC) {
        const ctx = (this.ctx = new AC());
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -14;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.004;
        this.limiter.release.value = 0.18;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.limiter).connect(ctx.destination);
        this.music = ctx.createGain();
        this.music.gain.value = this.musicVolume;
        this.fx = ctx.createGain();
        this.fx.gain.value = 0.9;
        this.music.connect(this.master);
        this.fx.connect(this.master);
        const len = ctx.sampleRate;
        this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
    return this.ctx;
  }
  get ready() {
    return !this.muted && this.ctx?.state === "running";
  }
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  setMuted(muted) {
    this.muted = muted;
    if (this.master)
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.now, 0.02);
  }
  setMusicVolume(v) {
    this.musicVolume = clamp(v, 0, 1);
    if (this.music)
      this.music.gain.setTargetAtTime(this.musicVolume, this.now, 0.05);
  }
  suspend() {
    this.ctx?.suspend?.().catch(() => {});
  }
  /** One enveloped oscillator note. Returns nothing; nodes clean themselves up. */
  tone({
    freq = 440,
    to = null,
    dur = 0.12,
    type = "sine",
    gain = 0.08,
    attack = 0.006,
    at = 0,
    bus = null,
    detune = 0,
    pan = 0,
  } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx,
      t = Math.max(ctx.currentTime, at || 0) || ctx.currentTime,
      osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      tail = p;
    }
    osc.connect(g);
    tail.connect(bus ?? this.fx);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      if (tail !== g) tail.disconnect();
    };
  }
  /** A filtered noise burst: hits, whooshes, hi-hats. */
  noise({
    dur = 0.2,
    gain = 0.1,
    freq = 2000,
    to = null,
    q = 0.8,
    type = "bandpass",
    at = 0,
    bus = null,
    attack = 0.004,
  } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx,
      t = Math.max(ctx.currentTime, at || 0) || ctx.currentTime,
      src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus ?? this.fx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
}

/** Equal-tempered frequency for a MIDI note number. */
export const midi = (n) => 440 * 2 ** ((n - 69) / 12);

/**
 * Look-ahead step sequencer on the audio clock. `onStep(step, time)` is
 * called slightly ahead of each sixteenth note; pausing drops stale steps.
 */
export class Sequencer {
  constructor(sound, bpm, onStep) {
    this.sound = sound;
    this.bpm = bpm;
    this.onStep = onStep;
    this.step = 0;
    this.next = 0;
    this.timer = null;
  }
  get stepLength() {
    return 60 / this.bpm / 4;
  }
  start() {
    if (this.timer || !this.sound.ctx) return;
    this.next = this.sound.now + 0.06;
    this.timer = setInterval(() => this.pump(), 25);
  }
  pump() {
    const s = this.sound;
    if (!s.ready) return;
    if (this.next < s.now - 0.2) this.next = s.now + 0.05;
    while (this.next < s.now + 0.12) {
      this.onStep(this.step, this.next);
      this.step++;
      this.next += this.stepLength;
    }
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}
