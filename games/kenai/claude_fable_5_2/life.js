// Ken.AI — Claude Fable 5.2 edition. One life, played as a few dozen choices.
// Deterministic: a seed and the list of picks rebuild the whole life, which
// is also how a life in progress is saved.
import { rng, clamp } from "../../../js/fable/kit.js?v=1";
import { STAGES, CARDS, EVENTS, AMBITIONS } from "./story.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const BORN = 2026;
export const STATS = ["h", "j", "b", "c", "m"];
export const STAT_NAMES = { h: "Health", j: "Joy", b: "Bonds", c: "Craft", m: "Means" };
export const MAX_AGE = 104;
export const FULL_SPAN = 85;

/** Chance of dying of old age in a given year, before health is considered. */
export const mortality = (age) => (age < 60 ? 0 : Math.min(1, 0.004 * Math.exp((age - 60) / 9.5)));

export class Life {
  constructor({ seed = 1, ambition = "house" } = {}) {
    this.seed = seed >>> 0;
    this.ambition = AMBITIONS.find((a) => a.id === ambition) ?? AMBITIONS[0];
    this.random = rng(this.seed);
    this.age = 0;
    this.stage = 0;
    this.stats = { h: 72, j: 62, b: 58, c: 8, m: 38 };
    this.lean = 0;
    this.flags = new Set();
    this.tags = [];
    this.log = [];
    this.weave = []; // one column per year lived
    this.picks = [];
    this.used = new Set();
    this.eventsLeft = [...EVENTS[STAGES[0].id]];
    this.eventSeen = false;
    this.sum = { j: 0, b: 0, years: 0 };
    this.peakCraft = this.stats.c;
    this.phase = "choose"; // choose | event | over
    this.offer = [];
    this.event = null;
    this.cause = "";
    this.mark = null;
    this.record(); // the year he is born
    this.log.push({ age: 0, kind: "era", text: `${STAGES[0].era}. ${STAGES[0].note}` });
    this.deal();
  }
  get year() {
    return BORN + this.age;
  }
  get stageInfo() {
    return STAGES[this.stage];
  }
  get options() {
    return this.phase === "choose" ? this.offer : this.phase === "event" ? this.event.options : [];
  }

  apply(fx = {}, extra = {}) {
    for (const k of STATS) if (fx[k]) this.stats[k] = clamp(this.stats[k] + fx[k], 0, 100);
    if (extra.lean) this.lean = clamp(this.lean + extra.lean, -100, 100);
    if (extra.set) this.flags.add(extra.set);
    if (extra.tag && !this.tags.some((t) => t.text === extra.tag)) {
      this.tags.push({ age: this.age, text: extra.tag });
      this.mark = STATS.reduce((best, k) => ((fx[k] ?? 0) > (fx[best] ?? 0) ? k : best), "j");
    }
    this.peakCraft = Math.max(this.peakCraft, this.stats.c);
  }
  available() {
    return CARDS[this.stageInfo.id].filter((c) => (!c.needs || this.flags.has(c.needs)) && (!c.not || !this.flags.has(c.not)));
  }
  deal() {
    let pool = this.available().filter((c) => !this.used.has(c.title));
    if (pool.length < 3) {
      // seen everything this stage offers: the best cards come round again
      this.used.clear();
      pool = this.available();
    }
    pool = [...pool];
    this.offer = [];
    while (this.offer.length < 3 && pool.length) this.offer.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    this.phase = "choose";
    this.event = null;
  }
  /** Chooses option `i` of whatever is on the table. Returns false if there is no such option. */
  pick(i) {
    const option = this.options[i];
    if (!option || this.phase === "over") return false;
    this.picks.push(i);
    if (this.phase === "choose") {
      this.used.add(option.title);
      this.apply(option.fx, option);
      this.log.push({ age: this.age, kind: "choice", title: option.title, text: option.text });
      const stage = this.stageInfo,
        lastTurn = this.age + stage.step > stage.to;
      if (this.eventsLeft.length && (this.random() < (this.eventSeen ? 0.2 : 0.45) || (lastTurn && !this.eventSeen))) {
        this.event = this.eventsLeft.splice(Math.floor(this.random() * this.eventsLeft.length), 1)[0];
        this.eventSeen = true;
        this.phase = "event";
        return true;
      }
    } else {
      this.apply(option.fx, option);
      this.log.push({ age: this.age, kind: "event", title: this.event.title, text: option.label });
    }
    this.pass();
    return true;
  }
  /** The years go by. */
  pass() {
    const s = this.stats;
    for (let y = 0; y < this.stageInfo.step && this.phase !== "over"; y++) {
      this.age++;
      s.h -= 0.35 + this.age / 42;
      s.j += (40 - s.j) * 0.06;
      s.b -= 2.2;
      s.c -= 0.25;
      s.m += this.flags.has("career") && this.age < 68 ? 0.9 : this.age < 19 ? 0.2 : -0.9;
      if (this.age > 70) s.c -= 0.3;
      if (s.m < 10) (s.j -= 1.2), (s.h -= 0.5);
      if (s.b < 15) s.j -= 1.5;
      if (s.j < 15) s.h -= 1;
      for (const k of STATS) s[k] = clamp(s[k], 0, 100);
      this.record();
      const risk = mortality(this.age) * (1.7 - s.h / 100);
      if (s.h <= 0) this.end("his health gave out");
      else if (this.age >= MAX_AGE || this.random() < risk) this.end(this.age >= 95 ? "he had simply finished" : "of old age, more or less on time");
    }
    if (this.phase === "over") return;
    if (this.age > this.stageInfo.to && this.stage < STAGES.length - 1) {
      this.stage++;
      this.used.clear();
      this.eventsLeft = [...EVENTS[this.stageInfo.id]];
      this.eventSeen = false;
      this.log.push({ age: this.age, kind: "era", text: `${this.stageInfo.era}. ${this.stageInfo.note}` });
    }
    this.deal();
  }
  record() {
    const s = this.stats;
    this.weave.push({ age: this.age, h: s.h, j: s.j, b: s.b, c: s.c, m: s.m, mark: this.mark });
    this.mark = null;
    this.sum.j += s.j;
    this.sum.b += s.b;
    this.sum.years++;
  }
  end(cause) {
    this.phase = "over";
    this.cause = cause;
    this.offer = [];
    this.event = null;
    this.log.push({ age: this.age, kind: "end", text: `Ken.AI died at ${this.age}; ${cause}.` });
  }

  /* ------------------------------------------------------------ summing up */
  /** Joy and bonds averaged over a full span, so a life cut short counts for less. */
  get averages() {
    const span = Math.max(FULL_SPAN, this.sum.years);
    return { j: this.sum.j / span, b: this.sum.b / span };
  }
  get ambitionValue() {
    const a = this.ambition.stat;
    return a === "b" ? this.averages.b : a === "j" ? this.averages.j : a === "c" ? this.peakCraft : clamp(50 - this.lean, 0, 100);
  }
  get score() {
    const { j, b } = this.averages;
    return Math.round(j * 4 + b * 4 + this.peakCraft * 2 + this.age * 6 + this.tags.length * 6 + this.ambitionValue * 4);
  }
  get grade() {
    const s = this.score;
    return s >= 1650 ? "A life and a half" : s >= 1500 ? "A good life" : s >= 1300 ? "A decent life" : s >= 1000 ? "A life" : "A short story";
  }
  /** A few sentences for the stone, built from what actually happened. */
  epitaph() {
    const t = this.tags,
      chosen = t.length <= 5 ? t : [0, 1, 2, 3, 4].map((i) => t[Math.round((i * (t.length - 1)) / 4)]),
      texts = [...new Set(chosen.map((x) => x.text))],
      list = texts.length > 1 ? `${texts.slice(0, -1).join(", ")} and ${texts.at(-1)}` : texts[0],
      { j, b } = this.averages,
      closing =
        this.lean > 40 ? "Half of what he knew, he asked a machine." : this.lean < -40 ? "He did most of it with his own hands." : b > 62 ? "He was seldom alone." : j > 62 ? "He enjoyed nearly all of it." : this.peakCraft > 70 ? "He was very good at what he did." : "He did what he could with the time.",
      wanted = this.ambitionValue >= 62 ? `He ${this.ambition.line}, and got it.` : `He ${this.ambition.line}. It did not quite work out.`;
    return [`Ken.AI, ${BORN}–${this.year}.`, list ? `He ${list}.` : "He left very little to write down.", wanted, closing];
  }
  save() {
    return { v: RULESET, seed: this.seed, ambition: this.ambition.id, picks: [...this.picks] };
  }
  static restore(data) {
    if (!data || data.v !== RULESET || !Number.isSafeInteger(data.seed) || !Array.isArray(data.picks) || data.picks.length > 400) return null;
    const life = new Life({ seed: data.seed, ambition: data.ambition });
    for (const i of data.picks) if (!life.pick(i)) return null;
    return life;
  }
}
