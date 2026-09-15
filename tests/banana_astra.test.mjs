import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  offerUpgrades,
  gainXP,
  chooseUpgrade,
  reroll,
  segmentHit,
  runSummary,
  endRun,
  MAX_ENEMIES,
  MAX_SHOTS,
  MAX_DROPS,
  WEAPONS,
  PERKS,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
import {
  rankRecords,
  validRecord,
  readRecords,
  addRecord,
  SESSION_KEY,
  DEVICE_KEY,
  fetchGlobalRecords,
  saveGlobalRecord,
} from "../games/BananaSurvivors/gpt6_astra/records.js";
import { createControls } from "../games/BananaSurvivors/gpt6_astra/controls.js";
const ticks = (s, n, input = {}) => {
  for (let i = 0; i < n; i++) update(s, 1 / 60, input);
};
const empty = () => {
  const s = createRun(77);
  s.spawnClock = 1e6;
  s.encounter = 7;
  s.supplyClock = 1e6;
  return s;
};
const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
test("fixed simulation: frame-rate independent movement, diagonal speed and invalid input", () => {
  const a = empty(),
    b = empty(),
    c = empty();
  ticks(a, 60, { x: 1 });
  ticks(b, 60, { x: 1, y: 1 });
  for (let i = 0; i < 30; i++) update(c, 1 / 30, { x: 1 });
  near(a.player.x, 205);
  near(Math.hypot(b.player.x, b.player.y), 205);
  near(c.player.x, a.player.x);
  update(a, NaN);
  update(a, -1);
  update(a, 1 / 60, { x: NaN, y: Infinity });
  assert.ok(Number.isFinite(a.player.x));
});
test("pausing freezes wave, projectiles, dash, drops, and the run clock", () => {
  const s = empty();
  spawnEnemy(s, "hound", { x: 120, y: 0 });
  ticks(s, 2, { dash: true });
  s.phase = "paused";
  const snapshot = JSON.stringify(s);
  ticks(s, 600, { x: 1, dash: true });
  assert.equal(JSON.stringify(s), snapshot);
});
test("dash grants invulnerability, observes cooldown, and remembers direction", () => {
  const s = empty();
  spawnEnemy(s, "brute", { x: 0, y: 0 }).born = 0;
  update(s, 1 / 60, { x: 1, dash: true });
  assert.equal(s.player.hp, 100);
  assert.equal(s.stats.dashes, 1);
  ticks(s, 60, { dash: true });
  assert.equal(s.stats.dashes, 1);
  assert.ok(s.player.x > 170);
});
test("contact damage has a shared grace period instead of stacking instantly", () => {
  const s = empty();
  s.weapons = {};
  for (let i = 0; i < 8; i++)
    spawnEnemy(s, "meatball", { x: 0, y: 0 }).born = 0;
  update(s, 1 / 60);
  assert.equal(s.player.hp, 88);
  ticks(s, 15);
  assert.equal(s.player.hp, 88);
});
test("swept projectile collisions include crossings and stationary overlap", () => {
  assert.ok(segmentHit(-100, 0, 100, 0, 0, 0, 10));
  assert.ok(segmentHit(0, 0, 0, 0, 0, 0, 10));
  assert.ok(!segmentHit(-100, 20, 100, 20, 0, 0, 10));
});
test("XP overflow queues every earned level and requires one valid choice each", () => {
  const s = empty();
  gainXP(s, 300);
  assert.equal(s.level, 7);
  assert.equal(s.pending, 6);
  assert.equal(s.xp, 60);
  assert.equal(chooseUpgrade(s, "invalid"), false);
  while (s.pending) {
    assert.equal(s.phase, "upgrade");
    assert.ok(chooseUpgrade(s, s.choices[0]));
  }
  assert.equal(s.phase, "playing");
  assert.equal(s.level, 7);
});
test("upgrade choices are unique, respect four slots and caps, guarantee an evolution", () => {
  const s = empty();
  s.weapons = { blaster: 4, boomerang: 5, peels: 2, coconut: 3 };
  s.perks.power = 4;
  for (let i = 0; i < 100; i++) {
    const choices = offerUpgrades(s);
    assert.equal(new Set(s.choices).size, s.choices.length);
    assert.ok(s.choices.includes("blaster"));
    assert.ok(!s.choices.includes("lightning"));
    assert.ok(!s.choices.includes("power"));
    assert.ok(!s.choices.includes("boomerang"));
    assert.equal(choices.find((c) => c.id === "blaster").kind, "EVOLUTION");
  }
  gainXP(s, 12);
  chooseUpgrade(s, "blaster");
  assert.equal(s.weapons.blaster, 5);
  assert.deepEqual(s.evolved, ["blaster"]);
});
test("rerolls cannot be free or consumed outside an upgrade", () => {
  const s = empty();
  assert.equal(reroll(s), false);
  gainXP(s, 12);
  assert.ok(reroll(s));
  assert.ok(reroll(s));
  assert.equal(reroll(s), false);
  assert.equal(s.rerolls, 0);
});
test("maxed builds offer permanent mastery choices", () => {
  const s = empty();
  s.weapons = { blaster: 5, boomerang: 5, coconut: 5, peels: 5 };
  for (const [id, p] of Object.entries(PERKS)) s.perks[id] = p.max;
  gainXP(s, 12);
  assert.equal(s.choices.length, 3);
  assert.ok(chooseUpgrade(s, s.choices[0]));
  assert.equal(s.phase, "playing");
});
test("the champion spawns at 50 seconds, including a saturated arena", () => {
  const s = empty();
  s.waveTime = 49.99;
  for (let i = 0; i < MAX_ENEMIES; i++)
    spawnEnemy(s, "meatball", { x: 700 + i, y: 0 });
  update(s, 1 / 60);
  assert.ok(s.bossId);
  assert.equal(s.enemies.length, 1);
  assert.equal(s.enemies.find((e) => e.id === s.bossId).type, "boss");
});
test("enemy special attacks repeat after each windup; all three boss patterns execute", () => {
  for (const type of ["hound", "spitter", "boss"])
    for (const wave of type === "boss" ? [1, 2, 3] : [2]) {
      const s = empty();
      s.wave = wave;
      s.weapons = {};
      s.player.invulnerable = 1e5;
      const e = spawnEnemy(s, type, { x: 200, y: 0 });
      e.born = 0;
      e.attack = 0;
      let starts = 0,
        wasWinding = false;
      for (let i = 0; i < 1100; i++) {
        update(s, 1 / 60);
        if (e.windup > 0 && !wasWinding) starts++;
        wasWinding = e.windup > 0;
      }
      assert.ok(starts >= 2, `${type} wave ${wave} only ${starts} attacks`);
    }
});
test("each weapon deals damage; evolved variants remain functional", () => {
  for (const weapon of Object.keys(WEAPONS))
    for (const rank of [1, 5]) {
      const s = empty();
      s.weapons = { [weapon]: rank };
      s.player.invulnerable = 1e5;
      const e = spawnEnemy(s, "boss", {
        x: weapon === "peels" ? 70 : 160,
        y: 0,
      });
      e.born = 0;
      e.speed = 0;
      e.attack = 1e5;
      e.hp = e.maxHp = 1e6;
      let events = new Set();
      for (let i = 0; i < 240; i++) {
        update(s, 1 / 60);
        for (const event of s.events) events.add(event.type);
      }
      assert.ok(s.stats.damage > 0, `${weapon} rank ${rank} no damage`);
      if (weapon === "lightning") assert.ok(events.has("lightning"));
      if (weapon === "coconut") assert.ok(events.has("explode"));
    }
});
test("boss death is counted once, clears hostile attacks, and awards healing plus an upgrade", () => {
  const s = empty();
  s.player.hp = 50;
  s.weapons = { lightning: 5 };
  const e = spawnEnemy(s, "boss", { x: 150, y: 0 });
  e.hp = 1;
  e.born = 0;
  e.attack = 100;
  update(s, 1 / 60);
  assert.equal(s.kills, 1);
  assert.equal(s.bosses, 1);
  assert.equal(s.bossId, null);
  assert.equal(s.player.hp, 75);
  assert.equal(s.rerolls, 3);
  assert.equal(s.phase, "upgrade");
  assert.equal(s.pending, 1);
  chooseUpgrade(s, s.choices[0]);
  for (let i = 0; i < 240; i++) {
    if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
    update(s, 1 / 60);
  }
  assert.equal(s.wave, 2);
  assert.equal(s.bosses, 1);
});
test("nukes do not award duplicate kills and XP survives pickup saturation", () => {
  const s = empty();
  s.weapons = {};
  for (let i = 0; i < 6; i++)
    spawnEnemy(s, "meatball", { x: 100 + i * 4, y: 30 }).born = 0;
  for (let i = 0; i < MAX_DROPS - 2; i++)
    s.drops.push({
      id: s.nextId++,
      x: 500,
      y: 500,
      kind: "xp",
      value: 2,
      age: 0,
      magnet: false,
    });
  s.drops.push(
    { id: s.nextId++, x: 0, y: 0, kind: "nuke", value: 1, age: 0 },
    { id: s.nextId++, x: 0, y: 0, kind: "nuke", value: 1, age: 0 },
  );
  update(s, 1 / 60);
  assert.equal(s.kills, 6);
  assert.equal(
    s.drops.filter((d) => d.kind === "xp").reduce((sum, d) => sum + d.value, 0),
    (MAX_DROPS - 2) * 2 + 12,
  );
  assert.ok(s.drops.length <= MAX_DROPS);
});
test("the same seed and input produce the same results; mob health does not punish XP level", () => {
  const a = createRun(41),
    b = createRun(41);
  for (let i = 0; i < 400; i++) {
    update(a, 1 / 60, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
    update(b, 1 / 60, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
  }
  assert.deepEqual(runSummary(a), runSummary(b));
  b.level = 80;
  assert.equal(spawnEnemy(a).hp, spawnEnemy(b).hp);
});
test("retiring is idempotent and final score includes survival and boss bonus", () => {
  const s = empty();
  s.score = 100;
  s.time = 33.6;
  s.bosses = 2;
  assert.equal(runSummary(s).score, 667);
  assert.ok(endRun(s));
  assert.equal(endRun(s), false);
});
const record = (id, score = 100) => ({
  id,
  playerName: "Banana",
  score,
  kills: 12,
  wave: 1,
  bosses: 0,
  seconds: 30,
  level: 2,
  bestCombo: 12,
  round: 1,
  createdAt: 100,
  ruleset: 1,
  loadout: "classic",
});
const memory = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
  };
};
test("rankings reject malformed scores, preserve deterministic ties, and deduplicate retries", () => {
  const good = record("a");
  assert.ok(validRecord(good));
  assert.ok(!validRecord({ ...good, score: Infinity }));
  assert.ok(!validRecord({ ...good, bestCombo: 999 }));
  assert.ok(!validRecord({ ...good, loadout: "other" }));
  assert.deepEqual(
    rankRecords([record("b"), record("a"), record("c", 200)]).map((r) => r.id),
    ["c", "a", "b"],
  );
  const store = memory();
  let list = addRecord([], good, store);
  list = addRecord(list, good, store);
  assert.equal(list.length, 1);
  assert.equal(readRecords(store).length, 1);
  assert.deepEqual(readRecords({ getItem: () => "{broken" }), []);
});
test("session history keeps every round while device history keeps best 100, even if storage is unavailable", () => {
  const store = memory();
  let a = [],
    b = [];
  for (let i = 0; i < 110; i++) {
    a = addRecord(a, record(String(i), i), store, SESSION_KEY);
    b = addRecord(b, record(String(i), i), store, DEVICE_KEY);
  }
  assert.equal(readRecords(store).length, 110);
  assert.equal(b.length, 100);
  assert.equal(
    addRecord([], record("x"), {
      setItem: () => {
        throw Error("blocked");
      },
    }).length,
    1,
  );
});
test("keyboard, mouse and multi-touch controls reset correctly and dash is edge-triggered", () => {
  class Surface {
    constructor() {
      this.listeners = {};
      this.style = {};
      this.classList = { add() {}, remove() {} };
      this.firstElementChild = { style: {} };
    }
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    }
    emit(type, props = {}) {
      for (const fn of this.listeners[type] || [])
        fn({
          code: "",
          target: { matches: () => false },
          preventDefault() {},
          stopPropagation() {},
          ...props,
        });
    }
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    }
    setPointerCapture() {}
  }
  const prior = globalThis.window;
  const win = new Surface();
  globalThis.window = win;
  try {
    const canvas = new Surface(),
      stick = new Surface(),
      button = new Surface();
    let playing = true,
      pauses = 0;
    const controls = createControls(canvas, stick, button, {
      onPause: () => pauses++,
      onChoice() {},
      onReroll() {},
      onActivity() {},
      isPlaying: () => playing,
      screenToWorld: (x, y) => ({ x, y }),
    });
    win.emit("keydown", { code: "KeyW" });
    win.emit("keydown", { code: "KeyD" });
    let result = controls.sample({ x: 0, y: 0 });
    near(Math.hypot(result.x, result.y), 1);
    assert.ok(result.x > 0 && result.y < 0);
    win.emit("keydown", { code: "Space" });
    assert.ok(controls.sample({ x: 0, y: 0 }).dash);
    assert.equal(controls.sample({ x: 0, y: 0 }).dash, false);
    win.emit("keydown", { code: "Space", repeat: true });
    assert.equal(controls.sample({ x: 0, y: 0 }).dash, false);
    win.emit("blur");
    assert.equal(controls.sample({ x: 0, y: 0 }).moving, false);
    canvas.emit("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    canvas.emit("pointermove", { pointerId: 1, clientX: 148, clientY: 100 });
    button.emit("pointerdown", { pointerId: 2 });
    result = controls.sample({ x: 0, y: 0 });
    assert.equal(result.x, 1);
    assert.ok(result.dash);
    assert.equal(stick.hidden, false);
    canvas.emit("pointercancel", { pointerId: 1 });
    assert.equal(controls.sample({ x: 0, y: 0 }).moving, false);
    canvas.emit("pointerdown", {
      pointerId: 3,
      pointerType: "mouse",
      button: 0,
      clientX: 200,
      clientY: 0,
    });
    assert.equal(controls.sample({ x: 0, y: 0 }).x, 1);
    canvas.emit("pointerup", { pointerId: 3 });
    assert.equal(controls.sample({ x: 0, y: 0 }).moving, false);
    playing = false;
    button.emit("pointerdown");
    assert.equal(controls.sample({ x: 0, y: 0 }).dash, false);
    win.emit("keydown", { code: "Escape" });
    assert.equal(pauses, 1);
  } finally {
    globalThis.window = prior;
  }
});
test("ten-minute stress run keeps all entity collections bounded", () => {
  const s = createRun(777);
  s.player.invulnerable = 1e6;
  s.weapons = { blaster: 5, boomerang: 5, peels: 5, coconut: 5 };
  s.perks = { power: 4, haste: 3, magnet: 3, area: 3 };
  let maxima = { enemies: 0, shots: 0, drops: 0, hazards: 0 };
  for (let i = 0; i < 36000; i++) {
    if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
    // Dash replaces the grace timer: replenish fixture-only immunity every step.
    s.player.invulnerable = 1e6;
    update(s, 1 / 60, {
      x: Math.cos(i / 180),
      y: Math.sin(i / 180),
      dash: i % 400 === 0,
    });
    for (const key of Object.keys(maxima))
      maxima[key] = Math.max(maxima[key], s[key].length);
    assert.ok(Number.isFinite(s.player.x));
  }
  assert.ok(maxima.enemies <= MAX_ENEMIES);
  assert.ok(maxima.shots <= MAX_SHOTS);
  assert.ok(maxima.drops <= MAX_DROPS);
  assert.ok(maxima.hazards <= 65);
  // The fixed orbit does not chase champions; pressure continues even with a boss alive.
  assert.ok(s.bosses >= 1);
  assert.ok(maxima.enemies >= 180);
  assert.ok(s.time > 590);
});

test("Global score submission retries are idempotent, including the total count", async () => {
  const docs = new Map();
  const ref = (collection, id) => ({
    collection,
    id,
    key: `${collection}/${id}`,
    get: async () => ({
      exists: docs.has(`${collection}/${id}`),
      data: () => docs.get(`${collection}/${id}`),
    }),
  });
  const db = {
    collection(name) {
      return {
        doc: (id) => ref(name, id),
        orderBy(field, direction) {
          assert.equal(field, "score");
          assert.equal(direction, "desc");
          return {
            limit(count) {
              assert.equal(count, 100);
              return {
                get: async () => ({
                  docs: [...docs.entries()]
                    .filter(([key]) => key.startsWith(name + "/"))
                    .map(([key, value]) => ({
                      id: key.split("/")[1],
                      data: () => value,
                    })),
                }),
              };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        set(r, data) {
          const previous = docs.get(r.key) || {};
          const next = { ...previous, ...data };
          if (data.totalGamesPlayed?.increment)
            next.totalGamesPlayed =
              (previous.totalGamesPlayed || 0) +
              data.totalGamesPlayed.increment;
          docs.set(r.key, next);
        },
      });
    },
  };
  const firestore = () => db;
  firestore.FieldValue = {
    serverTimestamp: () => 123,
    increment: (value) => ({ increment: value }),
  };
  globalThis.location = { hostname: "whatthe.ai" };
  globalThis.window = { firebase: { apps: [{}], firestore } };
  try {
    await saveGlobalRecord(record("actual-run"));
    await saveGlobalRecord(record("actual-run"));
    const result = await fetchGlobalRecords(1);
    assert.equal(result.records.length, 1);
    assert.equal(result.total, 1);
    await saveGlobalRecord({ ...record("second-run", 100), round: 2 });
    const ties = await fetchGlobalRecords(1);
    assert.equal(ties.records.length, 2);
    assert.equal(ties.total, 2);
    assert.ok(
      [...docs.keys()].every((key) =>
        key.includes("banana_survivors_gpt6_astra_v1"),
      ),
    );
    const fresh = { ...record("horde-run", 250), ruleset: 3 };
    await saveGlobalRecord(fresh);
    await saveGlobalRecord(fresh);
    const current = await fetchGlobalRecords();
    assert.equal(current.records.length, 1);
    assert.equal(current.records[0].ruleset, 3);
    assert.equal(current.total, 1);
    assert.equal((await fetchGlobalRecords(1)).total, 2);
  } finally {
    delete globalThis.location;
    delete globalThis.window;
  }
});
