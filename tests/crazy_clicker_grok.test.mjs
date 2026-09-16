import test from "node:test";
import assert from "node:assert/strict";
import {
  Pulse,
  TOLERANCE_MS,
  MIN_TAKT_MS,
  PERFECT_MS,
  EMBER_PERFECTS,
  feverOf,
  bpmOf,
  RULESET,
} from "../games/crazy_clicker/grok_4_6/engine.js";
import {
  addRecord,
  rankRecords,
  RECORD_KEY,
  SESSION_KEY,
  readRecords,
  validRecord,
  isLiveSite,
} from "../games/crazy_clicker/grok_4_6/records.js";

function run() {
  const p = new Pulse();
  p.start(0);
  return p;
}

function lock(p, takt = 400) {
  p.tap(0);
  p.tap(takt);
  return p;
}

function hits(p, count, offset = 0, takt = 400) {
  for (let i = 0; i < count; i++) {
    const t = p.lastHitAt + takt + offset;
    p.tap(t);
  }
  return p;
}

test("first tap starts the lock and counts as 1", () => {
  const p = run();
  const result = p.tap(10);
  assert.equal(result.kind, "first");
  assert.equal(p.score, 1);
  assert.equal(p.phase, "second");
});

test("second tap locks takt and ignores clicks faster than 70ms", () => {
  const p = run();
  p.tap(0);
  const tooFast = p.tap(MIN_TAKT_MS - 1);
  assert.equal(tooFast.kind, "ignore");
  assert.equal(p.phase, "second");
  const locked = p.tap(400);
  assert.equal(locked.kind, "second");
  assert.equal(p.taktMs, 400);
  assert.equal(p.score, 2);
  assert.equal(p.phase, "live");
});

test("hits inside the 50ms window raise the streak", () => {
  const p = lock(new Pulse());
  const early = p.tap(400 + 400 - TOLERANCE_MS);
  assert.equal(early.kind, "early");
  assert.equal(p.score, 3);
  const late = p.tap(p.lastHitAt + 400 + TOLERANCE_MS);
  assert.equal(late.kind, "late");
  assert.equal(p.score, 4);
});

test("perfects are inside 16ms and charge ember after five", () => {
  const p = lock(new Pulse());
  hits(p, EMBER_PERFECTS, 0);
  assert.equal(p.perfects, EMBER_PERFECTS);
  assert.equal(p.ember, true);
  assert.equal(p.score, 2 + EMBER_PERFECTS);
  const still = p.tap(p.lastHitAt + 400);
  assert.equal(still.kind, "perfect");
  assert.equal(p.ember, true);
});

test("a miss without ember ends the run", () => {
  const p = lock(new Pulse());
  const miss = p.tap(400 + 400 + TOLERANCE_MS + 20);
  assert.equal(miss.kind, "miss");
  assert.equal(p.phase, "over");
});

test("timeout without ember ends the run", () => {
  const p = lock(new Pulse());
  const miss = p.tick(400 + 400 + TOLERANCE_MS + 20);
  assert.equal(miss.kind, "miss");
  assert.equal(miss.reason, "timeout");
  assert.equal(p.phase, "over");
});

test("ember saves one miss, then a second miss kills", () => {
  const p = lock(new Pulse());
  hits(p, EMBER_PERFECTS, 0);
  assert.equal(p.ember, true);
  const saved = p.tap(p.lastHitAt + 400 + TOLERANCE_MS + 40);
  assert.equal(saved.kind, "ember");
  assert.equal(p.phase, "live");
  assert.equal(p.ember, false);
  assert.equal(p.emberSaves, 1);
  const dead = p.tap(p.lastHitAt + 400 + TOLERANCE_MS + 40);
  assert.equal(dead.kind, "miss");
  assert.equal(p.phase, "over");
});

test("a non-perfect hit resets the ember charge streak", () => {
  const p = lock(new Pulse());
  hits(p, 4, 0);
  p.tap(p.lastHitAt + 400 + 30);
  assert.equal(p.ember, false);
  assert.equal(p.perfectRun, 0);
  hits(p, 4, 0);
  assert.equal(p.ember, false);
});

test("fever ramps with streak", () => {
  assert.equal(feverOf(0), 0);
  assert.ok(feverOf(10) >= 0.28);
  assert.ok(feverOf(25) >= 0.52);
  assert.ok(feverOf(50) >= 0.78);
  assert.equal(feverOf(100), 1);
});

test("bpm follows the locked takt", () => {
  assert.equal(bpmOf(0), 0);
  assert.equal(bpmOf(500), 120);
  assert.equal(bpmOf(400), 150);
});

test("leaderboard keys stay isolated from Gemini", () => {
  assert.equal(RECORD_KEY, "crazy_clicker_grok_4_6_v1");
  assert.equal(SESSION_KEY, "crazy_clicker_grok_4_6_session_v1");
  assert.equal(RULESET, 1);
});

test("valid records require the grok ruleset and reject gemini-shaped rows", () => {
  const good = {
    id: "a",
    playerName: "RC",
    score: 40,
    taktMs: 320,
    ruleset: 1,
    perfects: 8,
  };
  assert.equal(validRecord(good), true);
  assert.equal(validRecord({ ...good, ruleset: undefined }), false);
  assert.equal(validRecord({ ...good, score: 40.5 }), false);
  const ranked = rankRecords([
    good,
    { ...good, id: "b", score: 12 },
    { ...good, id: "c", score: 40, perfects: 12 },
  ]);
  assert.equal(ranked[0].id, "c");
  assert.equal(ranked[1].id, "a");
});

test("device records persist under the grok key only", () => {
  const mem = new Map();
  const storage = {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => mem.set(key, value),
  };
  const record = {
    id: "run-1",
    playerName: "Anon",
    score: 21,
    taktMs: 280,
    ruleset: 1,
    perfects: 3,
  };
  addRecord([], record, storage);
  assert.ok(mem.has(RECORD_KEY));
  assert.equal(mem.has("leaderboard_crazy_clicker_gemini_2_5_pro"), false);
  const loaded = readRecords(storage);
  assert.equal(loaded[0].score, 21);
});

test("live-site gate keeps preview scores off the worldwide board", () => {
  assert.equal(isLiveSite(), false);
});
