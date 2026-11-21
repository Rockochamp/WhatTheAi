import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Session, stageAt, actsCleared, bpmOf, verdict, ACTS, TOLERANCE_MS, PERFECT_MS, MIN_BEAT_MS, MAX_BEAT_MS, WARMUP_BEATS, ACT_BEATS, REST_BEATS, GRACE_EVERY, GRACE_MAX,
} from "../games/crazy_clicker/claude_fable_5_2/engine.js";
import { validRecord, compareRecords, makeRecord, board } from "../games/crazy_clicker/claude_fable_5_2/records.js";

/** Locks a beat and plays `errors.length` more taps, each off by the given ms. */
function play(beat, errors, start = 1000) {
  const s = new Session(),
    out = [s.tap(start), s.tap(start + beat)];
  let last = start + beat;
  for (const e of errors) {
    const r = s.tap(last + beat + e);
    out.push(r);
    if (r.kind === "hit") last = last + beat + e;
    if (r.kind === "over") break;
  }
  return { s, out, last };
}

test("two taps set the beat; the series tolerance is fifty milliseconds", () => {
  const { s, out } = play(500, []);
  assert.equal(out[0].kind, "first");
  assert.equal(out[1].kind, "lock");
  assert.equal(out[1].bpm, 120);
  assert.equal(s.score, 2);
  assert.equal(TOLERANCE_MS, 50);
  assert.equal(bpmOf(0), 0);
});

test("the second tap must make a beat between 60 and 200 a minute", () => {
  const s = new Session();
  s.tap(0);
  assert.equal(s.tap(MIN_BEAT_MS - 1).kind, "tooFast");
  assert.equal(s.phase, "armed");
  assert.equal(s.tap(MIN_BEAT_MS).kind, "lock");
  const t = new Session();
  t.tap(0);
  assert.equal(t.tap(MAX_BEAT_MS + 1).kind, "tooSlow");
  assert.equal(t.phase, "armed");
  assert.equal(t.tap(MAX_BEAT_MS + 1 + 600).kind, "lock", "the slow tap became the new first tap");
  assert.equal(t.beatMs, 600);
});

test("hits inside the window score and are graded", () => {
  const { s, out } = play(500, [0, PERFECT_MS, -PERFECT_MS, PERFECT_MS + 1, -(PERFECT_MS + 1), TOLERANCE_MS, -TOLERANCE_MS]);
  assert.deepEqual(out.slice(2).map((r) => r.quality), ["perfect", "perfect", "perfect", "late", "early", "late", "early"]);
  assert.equal(s.score, 9);
  assert.equal(s.perfects, 3);
  assert.equal(s.taps.length, 7);
});

test("a tap before the window ends the run", () => {
  const { s, out } = play(500, [0, -(TOLERANCE_MS + 1)]);
  assert.equal(out.at(-1).kind, "over");
  assert.equal(out.at(-1).reason, "early");
  assert.equal(s.phase, "over");
  assert.equal(s.score, 3);
  assert.equal(s.tap(99999).kind, "ignore");
});

test("letting the window pass ends the run on the next tick", () => {
  const { s, last } = play(500, [0]);
  assert.equal(s.tick(last + 500 + TOLERANCE_MS), null);
  const r = s.tick(last + 500 + TOLERANCE_MS + 1);
  assert.equal(r.kind, "over");
  assert.equal(r.reason, "missed");
  assert.equal(new Session().tick(5), null);
});

test("timing is relative to your last tap, so a steady drift inside the window survives", () => {
  const { s } = play(500, Array(40).fill(30));
  assert.equal(s.phase, "live");
  assert.equal(s.score, 42);
});

test("eight dead-on hits earn a spare miss, two at most", () => {
  const { s, out } = play(500, Array(GRACE_EVERY * 4).fill(0));
  assert.equal(out[2 + GRACE_EVERY - 1].earned, true);
  assert.equal(out[2 + GRACE_EVERY - 2].earned, false);
  assert.equal(s.grace, GRACE_MAX);
});

test("a spare forgives a missed beat and keeps the grid", () => {
  const { s, last } = play(500, Array(GRACE_EVERY).fill(0));
  assert.equal(s.grace, 1);
  const r = s.tick(last + 500 + TOLERANCE_MS + 1);
  assert.equal(r.kind, "grace");
  assert.equal(s.grace, 0);
  assert.equal(s.phase, "live");
  assert.equal(s.tap(last + 1000).kind, "hit", "the next beat is still where it was");
  assert.equal(s.tick(last + 1000 + 500 + TOLERANCE_MS + 1).kind, "over");
});

test("a spare forgives a stray early tap without moving the beat", () => {
  const { s, last } = play(500, Array(GRACE_EVERY).fill(0));
  const stray = s.tap(last + 200);
  assert.equal(stray.kind, "grace");
  assert.equal(stray.reason, "early");
  assert.equal(s.tap(last + 500).quality, "perfect");
});

test("the show: eight easy beats, then acts of eight with four of rest", () => {
  for (let b = 0; b < WARMUP_BEATS; b++) assert.equal(stageAt(b).kind, "warmup");
  assert.ok(stageAt(0).aid && stageAt(0).first);
  const first = stageAt(WARMUP_BEATS);
  assert.equal(first.kind, "act");
  assert.equal(first.act.id, ACTS[0].id);
  assert.equal(first.aid, false);
  assert.equal(first.number, 1);
  assert.ok(first.first);
  assert.equal(stageAt(WARMUP_BEATS + ACT_BEATS - 1).kind, "act");
  assert.equal(stageAt(WARMUP_BEATS + ACT_BEATS).kind, "rest");
  assert.ok(stageAt(WARMUP_BEATS + ACT_BEATS).aid);
  assert.equal(stageAt(WARMUP_BEATS + ACT_BEATS + REST_BEATS).act.id, ACTS[1].id);
  const span = ACT_BEATS + REST_BEATS;
  for (let i = 0; i < ACTS.length; i++) {
    const st = stageAt(WARMUP_BEATS + i * span);
    assert.equal(st.act.id, ACTS[i].id);
    assert.equal(st.level, 1);
    assert.equal(st.extra, null);
  }
  const lap2 = stageAt(WARMUP_BEATS + ACTS.length * span);
  assert.equal(lap2.level, 2);
  assert.equal(lap2.act.id, ACTS[0].id);
  assert.ok(lap2.extra && lap2.extra.id !== lap2.act.id);
  for (let b = 0; b < 2000; b++) {
    const st = stageAt(b);
    assert.ok(["warmup", "act", "rest"].includes(st.kind));
    if (st.kind === "act") assert.ok(st.act && st.pos < ACT_BEATS);
  }
});

test("acts cleared counts whole acts only", () => {
  assert.equal(actsCleared(0), 0);
  assert.equal(actsCleared(2 + WARMUP_BEATS + ACT_BEATS - 1), 0);
  assert.equal(actsCleared(2 + WARMUP_BEATS + ACT_BEATS), 1);
  assert.equal(actsCleared(2 + WARMUP_BEATS + ACT_BEATS + REST_BEATS + ACT_BEATS - 1), 1);
  assert.equal(actsCleared(2 + WARMUP_BEATS + ACT_BEATS + REST_BEATS + ACT_BEATS), 2);
  for (let s = 0; s < 500; s++) assert.ok(actsCleared(s + 1) >= actsCleared(s));
});

test("the summary reports tempo, tendency and the act that hurt most", () => {
  const errors = [...Array(WARMUP_BEATS).fill(0), ...Array(ACT_BEATS).fill(-30), ...Array(REST_BEATS).fill(0), ...Array(ACT_BEATS).fill(10)];
  const { s } = play(600, errors);
  s.tick(1e9);
  const sum = s.summary();
  assert.equal(sum.bpm, 100);
  assert.equal(sum.score, 2 + errors.length);
  assert.equal(sum.acts, 2);
  assert.equal(sum.tendency, "rushing");
  assert.equal(sum.worst.act.id, ACTS[0].id);
  assert.equal(sum.worst.tendency, "rushed");
  assert.equal(sum.worst.meanAbsError, 30);
  assert.ok(sum.meanAbsError > 0 && sum.meanAbsError <= 50);
  assert.equal(sum.perfects, WARMUP_BEATS + REST_BEATS + ACT_BEATS);
  const empty = new Session().summary();
  assert.equal(empty.score, 0);
  assert.equal(empty.worst, null);
  assert.equal(typeof verdict(empty), "string");
  assert.notEqual(verdict(sum), verdict(empty));
});

test("bad timestamps are ignored", () => {
  const s = new Session();
  assert.equal(s.tap(NaN).kind, "ignore");
  assert.equal(s.tap(undefined).kind, "ignore");
  assert.equal(s.phase, "idle");
});

test("records validate and rank by streak, then tightness", () => {
  const { s } = play(500, Array(30).fill(5));
  s.tick(1e9);
  const record = makeRecord(s.summary(), "", "r1");
  assert.ok(validRecord(record), JSON.stringify(record));
  assert.equal(record.playerName, "Anonymous");
  for (const bad of [{ score: 1 }, { bpm: 59 }, { bpm: 201 }, { acts: 99 }, { perfects: 999 }, { meanAbsError: 51 }, { meanAbsError: NaN }, { ruleset: 0 }, { playerName: "" }])
    assert.equal(validRecord({ ...record, ...bad }), false, JSON.stringify(bad));
  const sorted = [{ ...record, id: "a", meanAbsError: 20 }, { ...record, id: "b", meanAbsError: 4 }, { ...record, id: "c", score: record.score + 1 }].sort(compareRecords);
  assert.deepEqual(sorted.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(board.collection, "leaderboard_crazy_clicker_claude_fable_5_2_v1");
});

test("the page wires every control the script expects", () => {
  const dir = new URL("../games/crazy_clicker/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("game.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  for (const act of ACTS) assert.ok(js.includes(`"${act.id}"`) || js.includes(`${act.id}:`), `no trick for ${act.id}`);
  assert.doesNotMatch(html + js, /fonts\.googleapis|unpkg|cdnjs/);
});
