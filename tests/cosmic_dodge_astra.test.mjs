import test from "node:test";
import assert from "node:assert/strict";
import {
  Flight,
  PHASE_COOLDOWN,
  sweptDistance,
} from "../games/cosmic_dodge/gpt6_astra/engine.js";
import {
  addRecord,
  readRecords,
  isLiveSite,
  saveGlobalRecord,
  fetchGlobalRecords,
} from "../games/cosmic_dodge/gpt6_astra/records.js";

function flight() {
  const f = new Flight({ seed: 53 });
  f.start();
  f.spawnIn = 1000;
  f.pickupIn = 1000;
  f.waveIn = 1000;
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
test("movement and elapsed score are independent of update frequency", () => {
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
  assert.equal(f.hp, 3);
  advance(f, PHASE_COOLDOWN + 0.02);
  assert.equal(f.phase(), true);
});
test("one asteroid cannot repeatedly damage the player", () => {
  const f = flight();
  f.asteroids.push(rock(f));
  advance(f, 2);
  assert.equal(f.hp, 2);
});
test("invulnerability prevents overlapping impacts from taking every hull segment", () => {
  const f = flight();
  f.asteroids.push(rock(f), rock(f), rock(f));
  f.update(1 / 120);
  assert.equal(f.hp, 2);
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
  f.hp = 2;
  f.pickups.push(pickup("repair"), pickup("repair"));
  f.update(1 / 120);
  assert.equal(f.hp, 3);
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
  assert.equal(f.hp, 3);
});

test("fast moving hazards use swept collision detection", () => {
  const f = flight(),
    r = rock(f, f.player.x, f.player.y - 80);
  r.speed = 24000;
  f.asteroids.push(r);
  f.update(1 / 120);
  assert.equal(f.hp, 2);
  assert.equal(sweptDistance(-20, 0, 20, 0), 0);
});

test("meteor warnings provide reaction time and do not fire while paused", () => {
  const f = flight();
  f.elapsed = 15;
  f.waveNumber = 1;
  f.wave();
  assert.ok(f.warnings.length >= 2);
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

test("formation waves leave a ship-sized corridor on desktop and phone", () => {
  for (const [w, h] of [
    [390, 700],
    [1280, 640],
  ]) {
    const f = flight();
    f.resize(w, h);
    f.wave();
    const xs = f.asteroids.map((r) => r.x).sort((a, b) => a - b);
    const maxGap = Math.max(...xs.slice(1).map((x, i) => x - xs[i]));
    assert.ok(
      maxGap - 52 * f.scale > f.player.radius * 4,
      "corridor must fit the entire ship comfortably",
    );
    assert.equal(f.pickups.length, 4);
  }
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
    elapsed: 5,
  };
  const two = { id: "two", playerName: "Astra", score: 900, elapsed: 9 };
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
    { id: "one", playerName: "Astra", score: 100, elapsed: 5 },
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
