import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  hit,
  runSummary,
  endRun,
  RULESET,
  EXECUTE_RATIO,
  CLEAVE_RADIUS,
  MAX_CORPSES,
  stats,
} from "../games/BananaSurvivors/grok_4_6/engine.js";
import {
  rankRecords,
  validRecord,
  readRecords,
  addRecord,
  SESSION_KEY,
  DEVICE_KEY,
  COLLECTION,
  fetchGlobalRecords,
  saveGlobalRecord,
} from "../games/BananaSurvivors/grok_4_6/records.js";
import {
  createGore,
  GORE_LIMITS,
} from "../games/BananaSurvivors/grok_4_6/gore.js";

const ticks = (s, n, input = {}) => {
  for (let i = 0; i < n; i++) update(s, 1 / 60, input);
};
const empty = () => {
  const s = createRun(77);
  s.spawnClock = 1e6;
  s.encounter = 7;
  s.supplyClock = 1e6;
  s.weapons = {};
  return s;
};

test("grok ruleset and storage keys stay off the astra boards", () => {
  assert.equal(RULESET, 1);
  assert.equal(EXECUTE_RATIO, 0.18);
  assert.equal(SESSION_KEY, "banana_survivors_grok_4_6_session_v1");
  assert.equal(DEVICE_KEY, "banana_survivors_grok_4_6_device_v1");
  assert.equal(COLLECTION, "leaderboard_banana_survivors_grok_4_6_v1");
  assert.ok(!SESSION_KEY.includes("astra"));
  assert.ok(!COLLECTION.includes("astra"));
});

test("dash still grants invulnerability and freeze still freezes bloodlust", () => {
  const s = empty();
  spawnEnemy(s, "brute", { x: 0, y: 0 }).born = 0;
  update(s, 1 / 60, { x: 1, dash: true });
  assert.equal(s.player.hp, 100);
  assert.equal(s.stats.dashes, 1);
  s.bloodlust = 3;
  s.phase = "paused";
  s.events = [];
  const frozen = s.bloodlust;
  const x = s.player.x;
  ticks(s, 600, { x: 1, dash: true });
  assert.equal(s.bloodlust, frozen);
  assert.equal(s.player.x, x);
  assert.equal(s.stats.dashes, 1);
});

test("a hit at or below 18% health executes, scores extra, and feeds bloodlust", () => {
  const s = empty();
  const e = spawnEnemy(s, "meatball", { x: 40, y: 0 });
  e.born = 0;
  e.maxHp = 100;
  e.hp = 18;
  const before = s.score;
  hit(s, e, 1, "blaster");
  assert.equal(e.dead, true);
  assert.equal(s.stats.executions, 1);
  assert.ok(s.score > before);
  assert.ok(s.bloodlust > 2);
  assert.ok(s.events.some((ev) => ev.type === "execute"));
  assert.equal(runSummary(s).executions, 1);
  const boosted = stats(s);
  s.bloodlust = 0;
  const calm = stats(s);
  assert.ok(boosted.speed > calm.speed);
  assert.ok(boosted.damage > calm.damage);
});

test("healthy targets are not executed", () => {
  const s = empty();
  const e = spawnEnemy(s, "meatball", { x: 40, y: 0 });
  e.born = 0;
  e.maxHp = 100;
  e.hp = 19;
  hit(s, e, 1, "blaster");
  assert.equal(e.dead, false);
  assert.equal(s.stats.executions, 0);
  assert.equal(s.bloodlust, 0);
  assert.ok(e.hp < 19);
});

test("overkill cleaves a nearby monster and stays depth-capped", () => {
  const s = empty();
  const a = spawnEnemy(s, "meatball", { x: 20, y: 0 });
  const b = spawnEnemy(s, "meatball", { x: 20 + CLEAVE_RADIUS / 2, y: 0 });
  const far = spawnEnemy(s, "meatball", { x: 800, y: 0 });
  a.born = b.born = far.born = 0;
  a.maxHp = b.maxHp = far.maxHp = 100;
  a.hp = 40;
  b.hp = 40;
  far.hp = 40;
  hit(s, a, 200, "blaster");
  assert.equal(a.dead, true);
  assert.ok(s.stats.cleaves >= 1);
  assert.ok(b.hp < 40 || b.dead);
  assert.equal(far.hp, 40);
  assert.ok(s.events.some((ev) => ev.type === "cleave"));
});

test("corpses linger, dash crush detonates them, and the cap holds", () => {
  const s = empty();
  const e = spawnEnemy(s, "meatball", { x: 28, y: 0 });
  e.born = 0;
  e.hp = 1;
  hit(s, e, 20, "blaster");
  assert.equal(s.corpses.length, 1);
  const other = spawnEnemy(s, "meatball", { x: 40, y: 0 });
  other.born = 0;
  other.hp = 40;
  s.player.dx = 1;
  s.player.dy = 0;
  update(s, 1 / 60, { dash: true });
  assert.ok(s.stats.crushes >= 1);
  assert.ok(s.events.some((ev) => ev.type === "crush"));
  assert.ok(other.hp < 40 || other.dead);
  assert.equal(s.corpses.length, 0);
  for (let i = 0; i < MAX_CORPSES + 8; i++) {
    const m = spawnEnemy(s, "meatball", { x: 200, y: i * 3 });
    if (!m) break;
    m.born = 0;
    m.hp = 1;
    hit(s, m, 20, "blaster");
  }
  assert.ok(s.corpses.length <= MAX_CORPSES);
});

test("bloodlust decays in play and corpses expire", () => {
  const s = empty();
  s.bloodlust = 0.05;
  s.corpses.push({ x: 10, y: 0, r: 16, size: 40, life: 0.02, max: 2.2 });
  ticks(s, 8);
  assert.equal(s.bloodlust, 0);
  assert.equal(s.corpses.length, 0);
});

test("same seed still matches; summary includes grok tallies", () => {
  const a = createRun(41),
    b = createRun(41);
  for (let i = 0; i < 240; i++) {
    update(a, 1 / 60, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
    update(b, 1 / 60, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
  }
  assert.deepEqual(runSummary(a), runSummary(b));
  const sum = runSummary(a);
  assert.ok("executions" in sum);
  assert.ok("cleaves" in sum);
  assert.ok("crushes" in sum);
  a.score = 100;
  a.time = 33.6;
  a.bosses = 2;
  assert.equal(runSummary(a).score, 667);
  assert.ok(endRun(a));
  assert.equal(endRun(a), false);
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

test("records reject astra-shaped rulesets and ignore astra storage keys", () => {
  assert.ok(validRecord(record("ok")));
  assert.equal(validRecord({ ...record("no"), ruleset: 3 }), false);
  assert.equal(validRecord({ ...record("no"), ruleset: 2 }), false);
  const data = new Map([
    ["banana_astra_session_v3", JSON.stringify([record("old", 99999)])],
  ]);
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  assert.equal(readRecords(storage).length, 0);
  addRecord([], record("fresh", 10), storage);
  assert.equal(readRecords(storage)[0].id, "fresh");
  assert.equal(rankRecords([record("b", 5), record("a", 50)])[0].id, "a");
});

test("gore budgets rose and execute/crush events emit extra viscera", () => {
  assert.deepEqual(GORE_LIMITS, { blood: 360, chunks: 88, stains: 180 });
  const gore = createGore(() => 0.5);
  const player = { x: 0, y: 0 };
  gore.emit({ type: "execute", x: 10, y: 0, size: 140 }, player);
  const afterExecute = { ...gore.counts };
  gore.emit({ type: "crush", x: 12, y: 0, size: 90, r: 80 }, player);
  assert.ok(afterExecute.blood > 40);
  assert.ok(afterExecute.chunks > 8);
  assert.ok(gore.counts.blood >= afterExecute.blood);
});

test("global save uses the grok collection and is idempotent", async () => {
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
    const result = await fetchGlobalRecords();
    assert.equal(result.records.length, 1);
    assert.equal(result.total, 1);
    await saveGlobalRecord({ ...record("second-run", 100), round: 2 });
    const ties = await fetchGlobalRecords();
    assert.equal(ties.records.length, 2);
    assert.equal(ties.total, 2);
    assert.ok([...docs.keys()].every((key) => key.includes("grok_4_6")));
    assert.ok([...docs.keys()].every((key) => !key.includes("astra")));
  } finally {
    delete globalThis.location;
    delete globalThis.window;
  }
});
