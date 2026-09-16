export const TOLERANCE_MS = 50;
export const MIN_TAKT_MS = 70;
export const PERFECT_MS = 16;
export const MISS_BUFFER_MS = 12;
export const EMBER_PERFECTS = 5;
export const RULESET = 1;

export const ACHIEVEMENTS = {
  "first-beat": { name: "Contact", blurb: "The first tap." },
  locked: { name: "Locked in", blurb: "You set a beat." },
  ten: { name: "Warm", blurb: "Ten in a row." },
  "twenty-five": { name: "On fire", blurb: "Twenty-five in a row." },
  fifty: { name: "Unhinged", blurb: "Fifty in a row." },
  hundred: { name: "Possession", blurb: "A hundred in a row." },
  "perfect-streak": { name: "Split-second", blurb: "Five perfect hits." },
  "slow-hand": { name: "Slow hand", blurb: "Held a beat over 600ms." },
  machine: { name: "Machine", blurb: "Held a beat under 140ms." },
  ember: { name: "Ember", blurb: "The core held you once." },
};

export function feverOf(score) {
  if (score >= 100) return 1;
  if (score >= 50) return 0.78;
  if (score >= 25) return 0.52;
  if (score >= 10) return 0.28;
  return Math.min(1, score / 40);
}

export function bpmOf(taktMs) {
  if (!taktMs) return 0;
  return Math.round(60000 / taktMs);
}

export function missDeadline(lastHitAt, taktMs) {
  return lastHitAt + taktMs + TOLERANCE_MS + MISS_BUFFER_MS;
}

export class Pulse {
  constructor() {
    this.reset(true);
  }

  reset(full = false) {
    this.phase = "ready";
    this.score = 0;
    this.taktMs = 0;
    this.lastHitAt = 0;
    this.perfects = 0;
    this.perfectRun = 0;
    this.ember = false;
    this.emberSaves = 0;
    this.startedAt = 0;
    this.elapsed = 0;
    this.early = 0;
    this.late = 0;
    if (full) this.best = 0;
  }

  start(now = 0) {
    this.reset(false);
    this.phase = "first";
    this.startedAt = now;
  }

  tap(now) {
    switch (this.phase) {
      case "ready":
      case "first": {
        this.phase = "second";
        this.score = 1;
        this.lastHitAt = now;
        this.taktMs = 0;
        this.perfects = 0;
        this.perfectRun = 0;
        this.ember = false;
        this.emberSaves = 0;
        this.startedAt = now;
        return { kind: "first", deltaMs: 0, score: this.score, taktMs: 0 };
      }
      case "second": {
        const takt = now - this.lastHitAt;
        if (takt < MIN_TAKT_MS) {
          return { kind: "ignore", deltaMs: takt, score: this.score, taktMs: 0 };
        }
        this.taktMs = takt;
        this.score += 1;
        this.lastHitAt = now;
        this.phase = "live";
        return { kind: "second", deltaMs: takt, score: this.score, taktMs: this.taktMs };
      }
      case "live": {
        const delta = now - this.lastHitAt;
        const lo = this.taktMs - TOLERANCE_MS;
        const hi = this.taktMs + TOLERANCE_MS;
        if (delta >= lo && delta <= hi) {
          const err = delta - this.taktMs;
          const perfect = Math.abs(err) <= PERFECT_MS;
          this.score += 1;
          this.lastHitAt = now;
          if (err < -PERFECT_MS) this.early += 1;
          else if (err > PERFECT_MS) this.late += 1;
          if (perfect) {
            this.perfects += 1;
            this.perfectRun += 1;
            if (this.perfectRun >= EMBER_PERFECTS) this.ember = true;
          } else {
            this.perfectRun = 0;
          }
          return {
            kind: perfect ? "perfect" : err < 0 ? "early" : "late",
            deltaMs: err,
            score: this.score,
            taktMs: this.taktMs,
            ember: this.ember,
          };
        }
        return this.fail(now, delta - this.taktMs, "tap");
      }
      default:
        return { kind: "ignore", deltaMs: 0, score: this.score, taktMs: this.taktMs };
    }
  }

  tick(now) {
    if (this.phase !== "live") return null;
    if (now - this.lastHitAt > this.taktMs + TOLERANCE_MS + MISS_BUFFER_MS) {
      return this.fail(now, now - this.lastHitAt - this.taktMs, "timeout");
    }
    return null;
  }

  fail(now, deltaMs, reason) {
    if (this.ember) {
      this.ember = false;
      this.emberSaves += 1;
      this.perfectRun = 0;
      if (reason === "timeout") this.lastHitAt += this.taktMs;
      else this.lastHitAt = now;
      return {
        kind: "ember",
        deltaMs,
        score: this.score,
        taktMs: this.taktMs,
        reason,
      };
    }
    this.phase = "over";
    this.elapsed = this.startedAt ? (now - this.startedAt) / 1000 : 0;
    if (this.score > this.best) this.best = this.score;
    return {
      kind: "miss",
      deltaMs,
      score: this.score,
      taktMs: this.taktMs,
      reason,
    };
  }

  fever() {
    return feverOf(this.score);
  }
}
