import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const SIM = require("../games/leo_smash_race/grokbot/sim.js");
const CUBE = require("../games/leo_smash_race/grokbot/cube.js");

function play(opts, policy) {
  const R = SIM.createRace(opts); let n = 0;
  while (!R.finished && n < 200000) { const i = policy ? policy(R, n) : { jump: false, jumpPressed: false, boostPressed: false, lane: 0 }; SIM.step(R, SIM.STEP, i); R.events.length = 0; n++; }
  return R;
}

test("every hero finishes every track in about 90 seconds, never last", () => {
  for (const v of SIM.VEHICLE_ORDER) for (const t of SIM.TRACKS) {
    const R = play({ vehicle: v, track: t.id, seed: 11, assist: false });
    assert.ok(R.finished, `${v} ${t.id} finished`);
    assert.ok(R.finT > 75 && R.finT < 100, `${v} ${t.id} time ${R.finT}`);
    assert.ok(R.place >= 1 && R.place <= 3, "always on the podium");
    assert.ok(R.award >= 1 && R.award <= 3, "at least one award star");
  }
});

test("no-fail: hands-off play still smashes things (assist) and boosting earns 1st", () => {
  const idle = play({ vehicle: "truck", track: "desert", seed: 3, assist: true });
  assert.ok(idle.smashes > 20, `assist smashes ${idle.smashes}`);
  const boosted = play({ vehicle: "truck", track: "desert", seed: 3, assist: true, fullBoost: true }, (R, n) => ({ jump: n % 600 < 80, jumpPressed: n % 600 === 0, boostPressed: n % 1200 === 7, lane: 0 }));
  assert.equal(boosted.place, 1);
  assert.ok(boosted.score > idle.score);
});

test("combo multiplier chains within 1.5 s and caps at x5", () => {
  const R = SIM.createRace({ vehicle: "dragster", track: "toyroom", seed: 1, countdown: 0 });
  const cones = R.tr.objs.filter(o => o.kind === "cone").slice(0, 7);
  cones.forEach((o, i) => { R.t = i * 0.5; SIM.smashGroup(R, o, "ram"); });
  assert.equal(R.mult, 5); assert.equal(R.bestMult, 5);
  R.t += 2; SIM.smashGroup(R, R.tr.objs.find(o => o.alive && o.lead), "ram"); assert.equal(R.mult, 1);
});

test("flying: holding jump climbs, releasing glides down slowly, ceiling holds", () => {
  const R = SIM.createRace({ vehicle: "sword", track: "castle", seed: 2, countdown: 0 });
  for (let i = 0; i < 240; i++) SIM.step(R, SIM.STEP, { jump: true, jumpPressed: i === 0, boostPressed: false, lane: 0 });
  assert.ok(R.p.z > 300, `climbed to ${R.p.z}`);
  for (let i = 0; i < 600; i++) SIM.step(R, SIM.STEP, { jump: true, jumpPressed: false, boostPressed: false, lane: 0 });
  assert.ok(R.p.z <= SIM.MAXZ + 1);
  for (let i = 0; i < 60; i++) SIM.step(R, SIM.STEP, { jump: false, jumpPressed: false, boostPressed: false, lane: 0 });
  assert.ok(R.p.vz >= SIM.VEHICLES.sword.glide - 1, "glide speed limited");
});

test("2x2 cube: scrambles are 1-3 twists, Help always solves it", () => {
  for (let i = 0; i < 300; i++) {
    const p = CUBE.newPuzzle(1 + (i % 3));
    assert.equal(CUBE.isSolved(p.cube), false);
    const names = CUBE.movesFor(2);
    for (let k = 0; k < i % 5; k++) CUBE.play(p, CUBE.MOVES[names[(k * 3 + i) % names.length]]);
    let guard = 0; while (!CUBE.isSolved(p.cube) && guard++ < 50) CUBE.play(p, CUBE.MOVES[CUBE.hint(p)]);
    assert.ok(CUBE.isSolved(p.cube));
  }
});

test("3x3 Pro cube: real shuffle, Help still solves it", () => {
  const p = CUBE.newPuzzle(20, null, 3);
  assert.equal(p.cube.cubies.length, 26);
  let guard = 0; while (!CUBE.isSolved(p.cube) && guard++ < 200) CUBE.play(p, CUBE.MOVES[CUBE.hint(p)]);
  assert.ok(CUBE.isSolved(p.cube));
});
