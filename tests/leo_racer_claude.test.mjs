import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.offensiveWords ??= [];
const dir = "../games/leo_smash_race/claude_fable_5_2/";
const { Race, buildTrack, driver, CARS, TRACKS, SMASHABLES, STEP, SEG, RACERS, MAX_COMBO, PLACE_BONUS, RULESET } = await import(dir + "sim.js?v=1");
const { solvedCube, turn, isSolved, scramble, solve, faceGrid } = await import(dir + "cube.js?v=1");
const { validRecord, makeRecord, compareRecords, validName, NAME_A, NAME_B, SLUG, board } = await import(dir + "records.js?v=1");
const { rng } = await import("../js/fable/kit.js?v=1");

function run(options, pilot, limit = 60 * 400) {
  const race = new Race(options),
    events = [];
  for (let i = 0; i < limit && race.status !== "finished"; i++) {
    race.update(STEP, pilot(race));
    events.push(...race.drainEvents());
  }
  return { race, events };
}

test("every road is built the same way each time and holds toys to smash", () => {
  for (const spec of TRACKS) {
    const a = buildTrack(spec.id),
      b = buildTrack(spec.id);
    assert.equal(a.segments.length, b.segments.length);
    assert.deepEqual(a.segments.map((s) => [s.curve, s.y, s.things.length]), b.segments.map((s) => [s.curve, s.y, s.things.length]));
    const toys = a.segments.flatMap((s) => s.things.filter((t) => t.solid));
    assert.ok(toys.length > 120, `${spec.id} has ${toys.length} toys`);
    for (const t of toys) {
      assert.ok(SMASHABLES[t.kind], t.kind);
      assert.ok(Math.abs(t.offset) <= 0.8, "toys stand on the road");
    }
    assert.equal(a.segments.filter((s) => s.finish).length, 1);
    assert.ok(a.length < a.segments.length * SEG, "there is road left after the line");
    assert.equal(a.segments.slice(0, 60).flatMap((s) => s.things.filter((t) => t.solid)).length, 0, "the start is clear");
  }
});

test("the countdown runs three, two, one, go before anything moves", () => {
  const race = new Race(),
    seen = [];
  for (let i = 0; i < 60 * 3.2; i++) {
    race.update(STEP, { steer: 1, boost: true });
    seen.push(...race.drainEvents().map((e) => (e.type === "count" ? e.n : e.type)));
    if (race.status === "countdown") assert.equal(race.z, 0);
  }
  assert.deepEqual(seen.slice(0, 4), [3, 2, 1, "go"]);
  assert.equal(race.status, "racing");
});

test("a race cannot be lost: doing nothing still reaches the line", () => {
  for (const track of TRACKS)
    for (const assist of [true, false]) {
      const { race, events } = run({ track: track.id, assist }, () => ({}));
      assert.equal(race.status, "finished", `${track.id} assist=${assist}`);
      assert.ok(race.time < 200, `took ${race.time}`);
      assert.ok(race.place >= 1 && race.place <= RACERS);
      assert.equal(events.at(-1).type, "finish");
      assert.ok(race.stars >= 1);
    }
});

test("driving well beats doing nothing, and the helper alone does not win", () => {
  for (const track of TRACKS) {
    const idle = run({ track: track.id, assist: true }, () => ({})).race,
      good = run({ track: track.id, assist: true }, (r) => driver(r, 1)).race,
      solo = run({ track: track.id, assist: false }, (r) => driver(r, 1)).race;
    assert.ok(good.score > idle.score, `${track.id}: ${good.score} > ${idle.score}`);
    assert.ok(good.place <= idle.place);
    assert.ok(idle.place > 1, `${track.id}: hands off finished ${idle.place}`);
    assert.equal(good.place, 1, `${track.id}: a good drive wins`);
    assert.ok(solo.place <= 3, `${track.id}: without the helper a good drive placed ${solo.place}`);
  }
});

test("smashing builds a chain, fills the boost, and boost doubles the points", () => {
  const { race, events } = run({ track: "hills" }, (r) => driver(r, 1));
  const smashes = events.filter((e) => e.type === "smash");
  assert.equal(smashes.length, race.smashed);
  assert.ok(smashes.every((e) => e.combo >= 1 && e.combo <= MAX_COMBO && e.pts > 0));
  assert.equal(race.bestCombo, MAX_COMBO);
  assert.ok(events.some((e) => e.type === "boostReady"));
  assert.ok(events.filter((e) => e.type === "boost").length >= 2);
  assert.equal(events.filter((e) => e.type === "boost").length, events.filter((e) => e.type === "boostEnd").length + (race.boosting > 0 ? 1 : 0));
  // one toy, with and without boost
  const one = (boosting) => {
    const r = new Race({ track: "hills" });
    r.count = 0;
    r.status = "racing";
    const seg = r.track.segments.find((s) => s.things.some((t) => t.solid)),
      toy = seg.things.find((t) => t.solid);
    r.z = seg.index * SEG - 10;
    r.x = toy.offset;
    r.speed = r.maxSpeed;
    r.boosting = boosting;
    r.update(STEP, {});
    return r.drainEvents().find((e) => e.type === "smash").pts;
  };
  assert.equal(one(1), one(0) * 2);
});

test("a full boost from the cube is there at the start and is spent by pressing", () => {
  const race = new Race({ boost: 1 });
  race.count = 0.01;
  race.update(STEP, {});
  race.update(STEP, { boost: true });
  assert.ok(race.boosting > 0);
  assert.equal(race.boost, 0);
  const top = race.maxSpeed;
  for (let i = 0; i < 60 * 2; i++) race.update(STEP, {});
  assert.ok(race.speed > top, "boost goes faster than the car's top speed");
  assert.ok(new Race({ boost: 9 }).boost === 1 && new Race({ boost: -1 }).boost === 0);
});

test("cars differ, and odd input cannot break a race", () => {
  assert.equal(new Set(CARS.map((c) => c.id)).size, CARS.length);
  for (const c of CARS) assert.ok(c.name.en && c.name.de && c.speed > 0.9 && c.speed < 1.1);
  const a = run({ car: "digger" }, (r) => driver(r, 1)).race,
    b = run({ car: "rocket" }, (r) => driver(r, 1)).race;
  assert.notEqual(a.score, b.score);
  const odd = new Race({ car: "nope", track: "nowhere" });
  assert.equal(odd.car.id, CARS[0].id);
  for (const input of [undefined, null, { steer: NaN }, { steer: "left" }, { steer: 1e9, boost: "yes" }]) {
    for (let i = 0; i < 400; i++) odd.update(STEP, input ?? undefined);
    assert.ok(Number.isFinite(odd.x) && Number.isFinite(odd.z) && Number.isFinite(odd.speed));
  }
  odd.update(-1, {});
  odd.update(NaN, {});
  odd.update(99, { steer: 1 });
  assert.ok(Math.abs(odd.x) <= 2.01 && odd.speed <= odd.maxSpeed * 1.31);
});

test("the same drive gives the same result, and the car rolls out after the line", () => {
  const a = run({ track: "canyon", car: "frog" }, (r) => driver(r, 0.8)).race,
    b = run({ track: "canyon", car: "frog" }, (r) => driver(r, 0.8)).race;
  assert.deepEqual([a.score, a.place, a.time, a.smashed], [b.score, b.place, b.time, b.smashed]);
  assert.ok(a.score >= PLACE_BONUS[a.place - 1]);
  const { score, place, z } = a;
  for (let i = 0; i < 600; i++) a.update(STEP, { steer: 1, boost: true });
  assert.deepEqual([a.score, a.place], [score, place], "nothing counts after the finish");
  assert.ok(a.z > z && a.z <= a.track.length + SEG * 44);
  assert.ok(a.speed < 10);
  assert.equal(a.drainEvents().filter((e) => e.type !== "finish").length, 0);
});

test("the colour cube: four turns come back, short scrambles are solved in as many taps", () => {
  const solved = solvedCube();
  assert.equal(solved.length, 24);
  assert.ok(isSolved(solved));
  for (const face of "URF") {
    let c = solved;
    for (let i = 0; i < 4; i++) {
      c = turn(c, face);
      assert.equal(isSolved(c), i === 3);
    }
    assert.deepEqual(faceGrid(solved, face).flat().length, 4);
    assert.equal(new Set(faceGrid(solved, face).flat()).size, 1);
  }
  for (let seed = 1; seed <= 40; seed++) {
    const c = scramble(rng(seed), 3);
    assert.ok(!isSolved(c));
    const path = solve(c);
    assert.ok(path && path.length >= 1 && path.length <= 3, `seed ${seed}: ${path}`);
    assert.ok(isSolved(path.reduce((cube, f) => turn(cube, f), c)));
  }
  assert.deepEqual(solve(solved), []);
});

test("records: only names from the two lists, only plausible numbers", () => {
  assert.equal(SLUG, "leo_smash_race_claude_fable_5_2_v1");
  assert.equal(board.collection, "leaderboard_" + SLUG);
  for (const a of NAME_A) for (const b of NAME_B) assert.ok(validName(`${a} ${b}`) && `${a} ${b}`.length <= 16);
  for (const bad of ["", "Leo", "Turbo  Leo", "Turbo Leo Leo", "turbo leo", "<b>x</b> Leo", null, 5]) assert.ok(!validName(bad), String(bad));
  const { race } = run({ track: "night", car: "dino" }, (r) => driver(r, 1));
  const record = makeRecord(race, "Dino Comet", "run-1");
  assert.ok(validRecord(record));
  assert.equal(record.ruleset, RULESET);
  assert.equal(record.helper, true);
  for (const change of [{ playerName: "Mister X" }, { score: -1 }, { score: 1e7 }, { score: 1.5 }, { place: 0 }, { place: 9 }, { tenths: 10 }, { car: "tank" }, { track: "moon" }, { helper: "yes" }, { ruleset: 0 }, { id: "" }])
    assert.ok(!validRecord({ ...record, ...change }), JSON.stringify(change));
  assert.ok(!validRecord(null));
  const slower = { ...record, tenths: record.tenths + 5 },
    higher = { ...record, score: record.score + 1 };
  assert.ok(compareRecords(higher, record) < 0 && compareRecords(record, slower) < 0);
  const memory = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); } };
  assert.ok(board.addLocal(record, memory).persisted);
  board.addLocal({ ...record, id: "bad", playerName: "Nope" }, memory);
  assert.deepEqual(board.readLocal(memory).map((r) => r.id), ["run-1"]);
});

test("the page: no remote code or fonts, nothing typed by players, both languages complete", () => {
  const read = (f) => readFileSync(new URL(dir + f, import.meta.url), "utf8");
  const html = read("game.html"),
    js = read("game.js"),
    css = read("game.css");
  assert.ok(!/<script[^>]+src="https?:|<link[^>]+rel="(stylesheet|preload)"[^>]+href="https?:/.test(html), "no code, styles or fonts from other sites");
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js));
  assert.ok(!/<input[^>]+type="text"|<textarea/.test(html), "children never type a name");
  assert.ok(!/url\(["']?https?:/.test(css));
  assert.match(css, /prefers-reduced-motion/);
  for (const id of js.match(/\$\("([\w-]+)"\)/g).map((m) => m.slice(3, -2))) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
  const block = (lang) => js.slice(js.indexOf(`  ${lang}: {`), js.indexOf("\n  },", js.indexOf(`  ${lang}: {`)));
  const keys = (lang) => [...block(lang).matchAll(/^    (\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(keys("en"), keys("de"));
  for (const key of html.match(/data-t="(\w+)"/g).map((m) => m.slice(8, -1))) assert.ok(keys("en").includes(key), `text for ${key}`);
  assert.match(js, /sendShared\(record/, "a finished race is sent to the shared board without a button");
  assert.ok(!/btn-save/.test(js + html));
  assert.ok(html.indexOf('id="alias-a"') < html.indexOf('id="cube"'), "the racing name is picked in the garage, before the race");
  const seen = {};
  for (const f of ["sim.js", "render.js", "cube.js", "records.js", "game.js"])
    for (const m of read(f).matchAll(/from "(\.[^"]+)"/g)) {
      // one query per file, so a module is never loaded twice under two addresses
      const [file, query] = m[1].split("?");
      assert.match(query ?? "", /^v=\d+$/, `${f}: ${m[1]}`);
      assert.equal((seen[file] ??= query), query, `${file} is imported under two versions`);
    }
});
