import test from "node:test";
import assert from "node:assert/strict";
import {
  Flight,
  PHASE_COOLDOWN,
  NEAR_MISS_REFUND,
  sweptDistance,
  difficultyAt,
} from "../games/cosmic_dodge/grok_4_6/engine.js";
import {
  addRecord,
  rankRecords,
  RECORD_KEY,
  readRecords,
  isLiveSite,
  saveGlobalRecord,
  fetchGlobalRecords,
} from "../games/cosmic_dodge/grok_4_6/records.js";

function flight() {
  const f = new Flight({ seed: 53 });
  f.start();
  f.spawnIn = 1000;
  f.pickupIn = 1000;
  f.repairIn = 1000;
  return f;
}
function rock(f, x = f.player.x, y = f.player.y) {
  return {
    x,
    y,
    radius: 20,
    speed: 0,
    drift: 0,
    spin: 0,
    rotation: 0,
    shape: [],
    hit: false,
    passed: false,
  };
}
function advance(f, seconds, input = {}) {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 120) f.update(1 / 120, input);
}
test("movement remains bounded on desktop and mobile", () => {
  for (const [width, height] of [
    [390, 700],
    [960, 640],
    [844, 346],
  ]) {
    const f = flight();
    f.resize(width, height);
    advance(f, 4, { axis: -1, vertical: -1 });
    assert.equal(f.player.x, f.bounds.left);
    assert.equal(f.player.y, f.bounds.top);
    advance(f, 6, { axis: 1, vertical: 1 });
    assert.equal(f.player.x, f.bounds.right);
    assert.equal(f.player.y, f.bounds.bottom);
    assert.ok(f.player.y <= height - 90, "leave space for thumb controls");
  }
});
test("movement and survival clock are independent of update frequency", () => {
  const a = flight(),
    b = flight();
  for (let i = 0; i < 60; i++) a.update(1 / 60, { axis: 1 });
  for (let i = 0; i < 120; i++) b.update(1 / 120, { axis: 1 });
  assert.ok(Math.abs(a.player.x - b.player.x) < 1e-8);
  assert.ok(Math.abs(a.elapsed - b.elapsed) < 1e-8);
  assert.equal(a.score, b.score);
});
test("phase protects against impacts, then requires a full cooldown", () => {
  const f = flight();
  assert.equal(f.phase(), true);
  assert.equal(f.phase(), false);
  f.asteroids.push(rock(f));
  f.update(1 / 120);
  assert.equal(f.hp, 1);
  advance(f, PHASE_COOLDOWN + 0.02);
  assert.equal(f.phase(), true);
});
test("one asteroid cannot repeatedly damage the player", () => {
  const f = flight();
  f.hp = 2;
  f.asteroids.push(rock(f));
  advance(f, 2);
  assert.equal(f.hp, 1);
});
test("a collected shield absorbs overlapping impacts only once", () => {
  const f = flight();
  f.hp = 2;
  f.asteroids.push(rock(f), rock(f), rock(f));
  f.update(1 / 120);
  assert.equal(f.hp, 1);
});
test("game over emits once and freezes the final score", () => {
  const f = flight();
  f.hp = 1;
  f.asteroids.push(rock(f));
  f.update(1 / 120);
  assert.equal(f.status, "over");
  const score = f.score;
  advance(f, 10);
  assert.equal(f.score, score);
  assert.equal(f.drainEvents().filter((e) => e.type === "over").length, 1);
  assert.equal(f.drainEvents().length, 0);
});
test("a close pass scores once and builds a capped multiplier", () => {
  const f = flight();
  const r = rock(f, f.player.x + 48, f.player.y - 1);
  r.speed = 240;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.nearMisses, 1);
  assert.equal(f.combo, 2);
  assert.equal(f.bonus, 120);
  advance(f, 0.2);
  assert.equal(f.nearMisses, 1);
  for (let i = 0; i < 8; i++) {
    const r2 = rock(f, f.player.x + 48, f.player.y - 1);
    r2.speed = 240;
    f.asteroids.push(r2);
    f.update(1 / 120);
  }
  assert.equal(f.combo, 5);
  advance(f, 5.1);
  assert.equal(f.combo, 1);
});
test("phasing does not farm close-call bonuses", () => {
  const f = flight();
  f.phase();
  const r = rock(f, f.player.x + 48, f.player.y - 1);
  r.speed = 240;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.nearMisses, 0);
});
test("pickups award points and repair without exceeding full hull", () => {
  const f = flight();
  const pickup = (type) => ({
    x: f.player.x,
    y: f.player.y,
    radius: 10,
    speed: 0,
    type,
  });
  f.pickups.push(pickup("star"));
  f.update(1 / 120);
  assert.equal(f.bonus, 50);
  assert.equal(f.starlight, 1);
  f.hp = 1;
  f.pickups.push(pickup("repair"), pickup("repair"));
  f.update(1 / 120);
  assert.equal(f.hp, 2);
  assert.equal(f.pickups.length, 0);
});
test("pause freezes movement, score, spawning and phase recharge", () => {
  const f = flight();
  f.phase();
  f.pause();
  const before = JSON.stringify(f);
  advance(f, 3, { axis: 1 });
  assert.equal(JSON.stringify(f), before);
  assert.equal(f.phase(), false);
  f.resume();
  f.update(0.02);
  assert.ok(f.elapsed > 0);
});
test("resizing keeps objects aligned and player in bounds", () => {
  const f = flight();
  f.asteroids.push(rock(f));
  const oldY = f.player.y;
  f.resize(480, 720);
  assert.equal(f.player.x, 240);
  assert.ok(Math.abs(f.player.y - (oldY * 720) / 640) < 0.001);
  assert.equal(f.asteroids[0].x, 240);
});
test("seeded runs replay deterministically", () => {
  const a = new Flight({ seed: 500 }),
    b = new Flight({ seed: 500 });
  a.start();
  b.start();
  advance(a, 12);
  advance(b, 12);
  assert.equal(
    JSON.stringify(a),
    JSON.stringify(b),
    "simulation state should match",
  );
});
test("invalid timesteps do not corrupt state", () => {
  const f = flight();
  f.update(NaN);
  f.update(-5);
  assert.equal(f.elapsed, 0);
});

test("diagonal movement has the same speed as horizontal movement", () => {
  const a = flight(),
    b = flight(),
    x = a.player.x,
    y = a.player.y;
  advance(a, 0.2, { axis: 1 });
  advance(b, 0.2, { axis: 1, vertical: -1 });
  assert.ok(
    Math.abs(Math.hypot(b.player.x - x, b.player.y - y) - (a.player.x - x)) <
      0.001,
  );
});

test("pointer targets move in two dimensions without teleporting or overshooting", () => {
  const f = flight(),
    x = f.player.x,
    y = f.player.y;
  f.update(1 / 120, { target: { x: x + 100, y: y - 80 } });
  assert.ok(f.player.x > x && f.player.x < x + 10);
  assert.ok(f.player.y < y && f.player.y > y - 10);
  advance(f, 1, { target: { x: x + 100, y: y - 80 } });
  assert.equal(f.player.x, x + 100);
  assert.equal(f.player.y, y - 80);
});

test("a burst clears nearby hazards once and cannot be spammed for score", () => {
  const f = flight();
  f.asteroids.push(rock(f, f.player.x + 65), rock(f, f.player.x + 250));
  assert.equal(f.phase(), true);
  assert.equal(f.destroyed, 1);
  assert.equal(f.bonus, 25);
  assert.equal(f.phase(), false);
  assert.equal(f.bonus, 25);
  f.update(0.01);
  assert.equal(f.hp, 1);
});

test("fast moving hazards use swept collision detection", () => {
  const f = flight(),
    r = rock(f, f.player.x, f.player.y - 80);
  r.speed = 24000;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.hp, 0);
  assert.equal(sweptDistance(-20, 0, 20, 0), 0);
});

test("meteor warnings provide reaction time and do not fire while paused", () => {
  const f = flight();
  f.cleared = 70;
  f.warnMeteor();
  assert.equal(f.warnings.length, 1);
  assert.ok(f.warnings.every((w) => w.left >= 1.3));
  f.pause();
  const warnings = JSON.stringify(f.warnings);
  advance(f, 2);
  assert.equal(JSON.stringify(f.warnings), warnings);
  f.resume();
  advance(f, 1);
  assert.ok(f.asteroids.every((r) => r.kind !== "meteor"));
  advance(f, 0.4);
  assert.ok(f.asteroids.some((r) => r.kind === "meteor"));
});

test("levels follow ten cleared asteroids, never time or style bonuses", () => {
  const f = flight();
  advance(f, 120);
  f.bonus = 999999;
  assert.equal(f.level, 1);
  for (let i = 0; i < 10; i++) {
    f.asteroids.push(rock(f, 20, f.height + 25));
    f.update(1 / 120);
    assert.equal(f.score, i + 1);
  }
  assert.equal(f.level, 2);
  assert.equal(f.levelProgress, 0);
  assert.equal(f.dodged, 10);
  assert.equal(f.drainEvents().filter((e) => e.type === "level").length, 1);
  advance(f, 2);
  assert.equal(f.score, 10, "offscreen asteroids are counted once");
});
test("burst-cleared asteroids advance levels once, impacted rocks do not", () => {
  const f = flight();
  f.cleared = 9;
  const r = rock(f);
  f.asteroids.push(r);
  f.phase();
  f.shatter(r);
  assert.equal(f.score, 10);
  assert.equal(f.level, 2);
  const hit = rock(f, 20, f.height + 25);
  hit.hit = true;
  f.asteroids.push(hit);
  f.update(1 / 120);
  assert.equal(f.score, 10);
});
test("level 30 retains the original speed and density curve, with no level cap", () => {
  assert.deepEqual(difficultyAt(1), { speed: 120, spawnRate: 1.2 });
  assert.equal(difficultyAt(30).speed, 990);
  assert.ok(Math.abs(difficultyAt(30).spawnRate - 9.9) < 1e-9);
  assert.equal(difficultyAt(35).speed, 1140);
  assert.ok(difficultyAt(40).spawnRate > difficultyAt(35).spawnRate);
});
test("falling times, hazard width and horizontal steering scale across screens", () => {
  const values = [
    [390, 700],
    [1280, 640],
    [844, 300],
  ].map(([width, height]) => {
    const f = new Flight({ width, height, seed: 53 });
    f.start();
    f.cleared = 290;
    const r = f.spawnAsteroid();
    const before = f.player.x;
    f.update(1 / 120, { axis: 1 });
    return [r.speed / height, r.radius / width, (f.player.x - before) / width];
  });
  for (const value of values)
    for (let i = 0; i < 3; i++)
      assert.ok(Math.abs(value[i] - values[0][i]) < 1e-8);
});
test("a fast asteroid crossing ship and bottom in one step still ends the run", () => {
  const f = flight(),
    r = rock(f, f.player.x, 0);
  r.speed = 120000;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.status, "over");
  assert.equal(f.score, 0);
});

test("long runs stay finite and cleanup keeps the simulation bounded", () => {
  for (const [width, height] of [
    [390, 700],
    [1280, 640],
    [844, 346],
  ]) {
    const f = new Flight({ width, height, seed: 987 });
    f.start();
    for (let i = 0; i < 120 * 180; i++) {
      f.invulnerable = 10;
      f.update(1 / 120, {
        axis: Math.sin(i / 600),
        vertical: Math.cos(i / 500) * 0.3,
      });
      assert.ok(Number.isFinite(f.player.x) && Number.isFinite(f.player.y));
      assert.ok(
        f.asteroids.length < 120 &&
          f.pickups.length < 50 &&
          f.warnings.length < 10,
      );
    }
    assert.ok(f.level >= 7);
  }
});
test("record storage sorts, deduplicates runs, and survives corruption", () => {
  let raw = null;
  const store = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  const one = {
    id: "one",
    playerName: "<script>pilot</script>",
    score: 500,
    level: 51,
    ruleset: 1,
    elapsed: 5,
  };
  const two = {
    id: "two",
    playerName: "Grok",
    score: 900,
    level: 91,
    ruleset: 1,
    elapsed: 9,
  };
  let result = addRecord([], one, store);
  result = addRecord(result.records, two, store);
  result = addRecord(result.records, two, store);
  assert.equal(result.records.length, 2);
  assert.equal(readRecords(store)[0].score, 900);
  raw = "{";
  assert.deepEqual(readRecords(store), []);
  raw = "{}";
  assert.deepEqual(readRecords(store), []);
});
test("blocked storage preserves a session record", () => {
  const blocked = {
    getItem() {
      throw new Error();
    },
    setItem() {
      throw new Error();
    },
  };
  assert.deepEqual(readRecords(blocked), []);
  const result = addRecord(
    [],
    {
      id: "one",
      playerName: "Grok",
      score: 100,
      level: 11,
      ruleset: 1,
      elapsed: 5,
    },
    blocked,
  );
  assert.equal(result.persisted, false);
  assert.equal(result.records.length, 1);
});
test("local test processes cannot access the production leaderboard", () => {
  assert.equal(isLiveSite(), false);
});
test("global retries record a run and increment the counter only once (mock database)", async () => {
  const saved = new Map();
  let counter = 0;
  const fakeDB = {
    collection(name) {
      return {
        doc(id) {
          return { name, id };
        },
        orderBy(field, direction) {
          assert.equal(field, "score");
          assert.equal(direction, "desc");
          return {
            limit() {
              return {
                get: async () => ({
                  docs: [...saved].map(([id, value]) => ({
                    id,
                    data: () => value,
                  })),
                }),
              };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      await callback({
        get: async (ref) => ({ exists: saved.has(ref.id) }),
        set(ref, data) {
          if (ref.name === "globalStats") counter++;
          else saved.set(ref.id, data);
        },
      });
    },
  };
  const firestore = () => fakeDB;
  firestore.FieldValue = {
    serverTimestamp: () => "mock-time",
    increment: (value) => value,
  };
  globalThis.location = { hostname: "whatthe.ai" };
  globalThis.window = { firebase: { apps: [{}], firestore } };
  try {
    const record = {
      id: "same-run",
      playerName: "Pilot",
      score: 700,
      level: 71,
      ruleset: 1,
      elapsed: 35,
    };
    await saveGlobalRecord(record);
    await saveGlobalRecord(record);
    assert.equal(counter, 1);
    assert.equal(saved.size, 1);
    assert.equal((await fetchGlobalRecords())[0].score, 700);
  } finally {
    delete globalThis.location;
    delete globalThis.window;
  }
});

test("level rankings exclude old point runs and prefer progress over style", () => {
  const base = {
    id: "a",
    playerName: "Pilot",
    score: 290,
    level: 30,
    ruleset: 1,
    elapsed: 100,
  };
  const ranked = rankRecords([
    { ...base, id: "old", ruleset: 2, score: 99999 },
    { ...base, id: "lower", level: 29, score: 289, style: 99999 },
    base,
    { ...base, id: "higher", score: 295, style: 0 },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["higher", "a", "lower"],
  );
  assert.equal(RECORD_KEY, "cosmic_dodge_grok_4_6_levels_v1");
});

test("close calls refund burst cooldown", () => {
  const f = flight();
  f.cooldown = 8;
  const r = rock(f, f.player.x + 48, f.player.y - 1);
  r.speed = 240;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.nearMisses, 1);
  assert.ok(Math.abs(f.cooldown - (8 - NEAR_MISS_REFUND)) < 0.02);
});
test("gravity well pulls the ship and slingshots once", () => {
  const f = flight();
  const well = {
    x: f.player.x + 50,
    y: f.player.y,
    radius: 16 * f.scale,
    pull: 118 * f.scale,
    speed: 0,
    drift: 0,
    slung: false,
    spin: 0,
  };
  f.wells.push(well);
  const x = f.player.x;
  f.update(1 / 120);
  assert.ok(f.player.x > x, "well should pull the ship toward it");
  assert.equal(f.slingshots, 1);
  assert.equal(well.slung, true);
  const bonus = f.bonus;
  advance(f, 0.5);
  assert.equal(f.slingshots, 1);
  assert.equal(f.bonus, bonus);
});
test("falling into a well core costs a life", () => {
  const f = flight();
  f.wells.push({
    x: f.player.x,
    y: f.player.y,
    radius: 20,
    pull: 80,
    speed: 0,
    drift: 0,
    slung: true,
    spin: 0,
  });
  f.update(1 / 120);
  assert.equal(f.status, "over");
});
test("burst protects against the well core", () => {
  const f = flight();
  f.phase();
  f.wells.push({
    x: f.player.x,
    y: f.player.y,
    radius: 20,
    pull: 80,
    speed: 0,
    drift: 0,
    slung: true,
    spin: 0,
  });
  f.update(1 / 120);
  assert.equal(f.hp, 1);
  assert.equal(f.status, "playing");
});
test("cluster asteroids split into shards when burst", () => {
  const f = flight();
  const r = rock(f, f.player.x + 40, f.player.y);
  r.kind = "cluster";
  r.radius = 24;
  f.asteroids.push(r);
  f.phase();
  assert.equal(f.destroyed >= 1, true);
  assert.ok(f.asteroids.some((a) => a.kind === "shard") || f.destroyed >= 3);
});
test("wells freeze while paused", () => {
  const f = flight();
  f.wells.push({
    x: 200,
    y: 80,
    radius: 16,
    pull: 100,
    speed: 80,
    drift: 10,
    slung: false,
    spin: 0,
  });
  f.pause();
  const before = JSON.stringify(f.wells);
  advance(f, 2);
  assert.equal(JSON.stringify(f.wells), before);
});
test("Grok records are isolated from the Astra leaderboard key", () => {
  assert.equal(RECORD_KEY, "cosmic_dodge_grok_4_6_levels_v1");
  assert.notEqual(RECORD_KEY, "cosmic_dodge_gpt6_astra_levels_v3");
});
