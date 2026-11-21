// Crazy Clicker — Claude Fable 5.2 edition.
// Two taps set a beat. Keep it within ±50 ms while the game does its best
// to talk you out of it. Pure timing logic; no DOM, no audio.

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const TOLERANCE_MS = 50; // the series rule
export const PERFECT_MS = 16;
export const MIN_BEAT_MS = 300; // 200 BPM
export const MAX_BEAT_MS = 1000; // 60 BPM
export const WARMUP_BEATS = 8;
export const ACT_BEATS = 8;
export const REST_BEATS = 4;
export const GRACE_EVERY = 8; // perfect hits per forgiven miss
export const GRACE_MAX = 2;

/** What the game does to you, in order. `aid` is the helper click. */
export const ACTS = [
  { id: "solo", name: "On your own", line: "The click has left. The beat has not." },
  { id: "dark", name: "Lights out", line: "Nothing to look at. Keep counting." },
  { id: "rush", name: "The other drummer", line: "He is faster than you. He is also wrong." },
  { id: "sway", name: "The room moves", line: "The floor is fine. Probably." },
  { id: "drag", name: "The lying ring", line: "The ring has slowed down. You should not." },
  { id: "flash", name: "Fireworks", line: "None of this is on the beat." },
  { id: "poly", name: "Three against two", line: "A waltz has wandered in." },
];

export const bpmOf = (beatMs) => (beatMs ? Math.round(60000 / beatMs) : 0);

/**
 * Where a beat falls in the show. `beat` counts taps after the two that set
 * the tempo: 0 is the first tap you had to keep in time.
 */
export function stageAt(beat) {
  if (beat < WARMUP_BEATS) return { kind: "warmup", aid: true, act: null, number: 0, level: 0, pos: beat, first: beat === 0 };
  const span = ACT_BEATS + REST_BEATS,
    i = beat - WARMUP_BEATS,
    index = Math.floor(i / span),
    pos = i % span,
    level = 1 + Math.floor(index / ACTS.length),
    act = ACTS[index % ACTS.length];
  if (pos >= ACT_BEATS) return { kind: "rest", aid: true, act: null, number: index + 1, level, pos: pos - ACT_BEATS, first: pos === ACT_BEATS };
  // from the second lap on, an older trick joins the current one
  const extra = level > 1 ? ACTS[(index + 3) % ACTS.length] : null;
  return { kind: "act", aid: false, act, extra, number: index + 1, level, pos, first: pos === 0 };
}
/** Acts fully survived at a given score. */
export function actsCleared(score) {
  const beat = score - 2 - WARMUP_BEATS;
  return beat < 0 ? 0 : Math.floor((beat + REST_BEATS) / (ACT_BEATS + REST_BEATS));
}

export class Session {
  constructor() {
    this.reset();
  }
  reset() {
    this.phase = "idle"; // idle | armed | live | over
    this.score = 0;
    this.beatMs = 0;
    this.lastHitAt = 0;
    this.startedAt = 0;
    this.endedAt = 0;
    this.perfects = 0;
    this.perfectRun = 0;
    this.grace = 0;
    this.graceUsed = 0;
    this.taps = []; // { error, quality, stage } for every kept beat
    this.ending = null;
  }
  /** Index of the beat you are about to tap. */
  get beat() {
    return Math.max(0, this.score - 2);
  }
  get stage() {
    return stageAt(this.beat);
  }
  get nextBeatAt() {
    return this.phase === "live" ? this.lastHitAt + this.beatMs : 0;
  }

  tap(now) {
    if (!Number.isFinite(now)) return { kind: "ignore" };
    switch (this.phase) {
      case "idle":
        this.phase = "armed";
        this.score = 1;
        this.lastHitAt = this.startedAt = now;
        return { kind: "first", score: 1 };
      case "armed": {
        const gap = now - this.lastHitAt;
        if (gap < MIN_BEAT_MS) return { kind: "tooFast", gap };
        if (gap > MAX_BEAT_MS) {
          // too long to be a beat: treat this tap as a fresh first tap
          this.lastHitAt = this.startedAt = now;
          return { kind: "tooSlow", gap };
        }
        this.beatMs = gap;
        this.score = 2;
        this.lastHitAt = now;
        this.phase = "live";
        return { kind: "lock", beatMs: gap, bpm: bpmOf(gap), score: 2, stage: this.stage };
      }
      case "live": {
        const error = now - this.lastHitAt - this.beatMs;
        if (error < -TOLERANCE_MS) return this.miss(now, error, "early");
        // a tap can only be late by less than the tolerance: tick() ends it first
        const stage = this.stage,
          quality = Math.abs(error) <= PERFECT_MS ? "perfect" : error < 0 ? "early" : "late";
        this.score++;
        this.lastHitAt = now;
        this.taps.push({ error, quality, kind: stage.kind, act: stage.act?.id ?? null, number: stage.number });
        let earned = false;
        if (quality === "perfect") {
          this.perfects++;
          this.perfectRun++;
          if (this.perfectRun % GRACE_EVERY === 0 && this.grace < GRACE_MAX) {
            this.grace++;
            earned = true;
          }
        } else this.perfectRun = 0;
        return { kind: "hit", quality, error, score: this.score, stage: this.stage, earned, grace: this.grace };
      }
      default:
        return { kind: "ignore" };
    }
  }
  /** Call every frame. Ends the run once a beat has been missed. */
  tick(now) {
    if (this.phase !== "live" || now - this.lastHitAt <= this.beatMs + TOLERANCE_MS) return null;
    return this.miss(now, now - this.lastHitAt - this.beatMs, "missed");
  }
  miss(now, error, reason) {
    if (this.grace > 0) {
      this.grace--;
      this.graceUsed++;
      this.perfectRun = 0;
      // a missed beat is counted as if it had landed; a stray early tap is ignored
      if (reason === "missed") this.lastHitAt += this.beatMs;
      return { kind: "grace", reason, error, grace: this.grace, score: this.score };
    }
    this.phase = "over";
    this.endedAt = now;
    this.ending = { reason, error, stage: this.stage };
    return { kind: "over", reason, error, score: this.score, stage: this.stage };
  }

  /** Numbers for the result screen. */
  summary() {
    const taps = this.taps,
      n = taps.length || 1,
      mean = taps.reduce((s, t) => s + t.error, 0) / n,
      spread = taps.reduce((s, t) => s + Math.abs(t.error), 0) / n,
      byAct = new Map();
    for (const t of taps) {
      if (t.kind !== "act") continue;
      const a = byAct.get(t.act) ?? { id: t.act, sum: 0, abs: 0, n: 0 };
      a.sum += t.error;
      a.abs += Math.abs(t.error);
      a.n++;
      byAct.set(t.act, a);
    }
    let worst = null;
    for (const a of byAct.values()) if (a.n >= 4 && (!worst || a.abs / a.n > worst.abs / worst.n)) worst = a;
    return {
      score: this.score,
      beatMs: this.beatMs,
      bpm: bpmOf(this.beatMs),
      acts: actsCleared(this.score),
      perfects: this.perfects,
      meanError: Math.round(mean * 10) / 10,
      meanAbsError: Math.round(spread * 10) / 10,
      tendency: Math.abs(mean) < 4 ? "steady" : mean < 0 ? "rushing" : "dragging",
      worst: worst && {
        act: ACTS.find((a) => a.id === worst.id),
        tendency: worst.sum < 0 ? "rushed" : "dragged",
        meanAbsError: Math.round((worst.abs / worst.n) * 10) / 10,
      },
      seconds: this.endedAt ? (this.endedAt - this.startedAt) / 1000 : 0,
      graceUsed: this.graceUsed,
    };
  }
}

export function verdict(summary) {
  const s = summary.score;
  if (s < 2) return "You tapped once. That is a sound, not a beat.";
  if (s < 10) return "The beat got away before the trouble even started.";
  if (s < 22) return "You held it while it was easy.";
  if (summary.acts < 3) return "You have a beat. It can be argued with.";
  if (summary.acts < 7) return "Steady. The room tried and mostly failed.";
  if (summary.acts < 14) return "Every trick once, and you are still here.";
  return "You are the metronome now.";
}
