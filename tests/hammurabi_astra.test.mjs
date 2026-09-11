import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  initialState,
  forecast,
  advanceYear,
  riskAfter,
  wellbeing,
} from "../games/steve_jobs_hammurabi/gpt6_astra/engine.js";
import {
  validRecord,
  rankRecords,
  readSession,
  addSession,
  SESSION_KEY,
  fetchGlobalRecords,
  saveGlobalRecord,
} from "../games/steve_jobs_hammurabi/gpt6_astra/records.js";
const seedRandom = (seed) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const plan = { buy: 0, sell: 0, plant: 100, feed: 20 };
test("Original starting resources, ten-year horizon, and land market", () => {
  assert.deepEqual(
    initialState(() => 0),
    {
      year: 0,
      food: 4000,
      land: 100,
      pawns: 100,
      landPrice: 18,
      starvationRisk: 0,
    },
  );
  assert.equal(initialState(() => 0.9999).landPrice, 28);
});
test("The budget pays trade, seeds and feeding before any harvest", () => {
  const state = initialState(() => 0),
    budget = forecast(state, { ...plan, buy: 20 });
  assert.equal(budget.reserve, 1540);
  assert.equal(budget.land, 120);
  assert.equal(budget.harvestMin, 300);
  assert.equal(budget.harvestMax, 700);
  assert.equal(
    forecast({ ...state, food: 1500 }, plan).valid,
    false,
    "Cannot spend a harvest before it happens",
  );
  assert.equal(
    forecast({ ...state, food: 1500 }, { ...plan, sell: 50, plant: 50 }).valid,
    true,
    "Selling finances the current year",
  );
});
for (const [name, p] of [
  ["negative", { ...plan, feed: -1 }],
  ["fractional", { ...plan, plant: 2.5 }],
  ["missing", { ...plan, feed: NaN }],
  ["infinite", { ...plan, buy: Infinity }],
  ["both trades", { ...plan, buy: 1, sell: 1 }],
  ["land oversold", { ...plan, sell: 101 }],
  ["too much land planted", { ...plan, plant: 101 }],
  ["unaffordable food", { ...plan, feed: 100 }],
  ["unsafe number", { ...plan, feed: Number.MAX_SAFE_INTEGER + 1 }],
]) {
  test(`Invalid ${name} decision cannot mutate a reign or consume randomness`, () => {
    const state = initialState(() => 0),
      before = structuredClone(state);
    let calls = 0;
    const outcome = advanceYear(state, p, () => {
      calls++;
      return 0.5;
    });
    assert.equal(outcome.ok, false);
    assert.equal(calls, 0);
    assert.deepEqual(state, before);
  });
}
test("Labor and land both constrain crops", () => {
  assert.equal(
    forecast(
      { ...initialState(), land: 2000, food: 10000, pawns: 3 },
      { ...plan, plant: 31 },
    ).valid,
    false,
  );
  assert.equal(
    forecast(
      { ...initialState(), land: 2000, food: 10000, pawns: 3 },
      { ...plan, plant: 30 },
    ).valid,
    true,
  );
});
test("Hunger accumulates and recovery is gradual", () => {
  let risk = 0;
  for (let i = 0; i < 3; i++) risk = riskAfter(risk, 0);
  assert.ok(risk > 1.19);
  assert.equal(wellbeing(risk).label, "Critical");
  assert.ok(riskAfter(risk, 20) > 0.85);
  assert.equal(riskAfter(0, 30), 0);
});
test("Both natural completion and collapse have the correct final year", () => {
  const complete = advanceYear(
    { ...initialState(), year: 9, food: 10000 },
    plan,
    () => 0.9,
  );
  assert.equal(complete.ended, true);
  assert.equal(complete.state.year, 10);
  assert.equal(advanceYear(complete.state, plan).ok, false);
  const collapse = advanceYear(
    { ...initialState(), year: 3, pawns: 1, starvationRisk: 4 },
    { ...plan, plant: 0, feed: 0 },
    () => 0.9,
  );
  assert.equal(collapse.ended, true);
  assert.equal(collapse.state.year, 4);
  assert.equal(collapse.state.pawns, 0);
});

// Compare against the ACTUAL legacy source, using identical decisions and RNG.
// This catches accidental changes to event ordering, risk, food or migration.
const legacy = fs
  .readFileSync(
    new URL(
      "../games/steve_jobs_hammurabi/grok3_reasoning/game.js",
      import.meta.url,
    ),
    "utf8",
  )
  .match(/^function processTurn\(\).*$/m)[0];
function oldTurn(state, p, seed) {
  const math = Object.create(Math);
  math.random = seedRandom(seed);
  const context = {
    Math: math,
    gameState: structuredClone(state),
    gameStarted: true,
    gameEnded: false,
    maxYears: 10,
    requiredFoodPerPawn: 20,
    pawnPlantingRatio: 10,
    minYield: 3,
    maxYield: 7,
    riskRecoveryRate: 0.35,
    riskIncreaseFactor: 0.4,
    deathThreshold: 0.85,
    deathRateFactor: 0.2,
    maxDeathFraction: 0.45,
    criticalRiskThreshold: 1.2,
    buyLandInput: { value: p.buy },
    sellLandInput: { value: p.sell },
    plantInput: { value: p.plant },
    feedInput: { value: p.feed },
    messageEl: {},
    nextTurnBtn: {},
    updateUI() {},
    handleGameOver() {
      context.gameEnded = true;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${legacy};processTurn();`, context);
  return context;
}
test("1,000 deterministic years preserve the Grok economy, migration and random events", () => {
  const chooser = seedRandom(59);
  let compared = 0;
  for (let i = 0; i < 1000; i++) {
    const s = {
      year: i % 9,
      food: 1500 + Math.floor(chooser() * 10000),
      land: 100 + Math.floor(chooser() * 200),
      pawns: 50 + Math.floor(chooser() * 100),
      landPrice: 18 + Math.floor(chooser() * 11),
      starvationRisk: chooser() * 2,
    };
    const p = {
      buy: 0,
      sell: i % 3 === 0 ? Math.floor(s.land * 0.1) : 0,
      plant: 50 + Math.floor(chooser() * 50),
      feed: Math.floor(chooser() * 31),
    };
    if (!forecast(s, p).valid) {
      p.feed = 0;
      p.plant = 0;
    }
    const old = oldTurn(s, p, i + 1),
      next = advanceYear(s, p, seedRandom(i + 1));
    assert.equal(next.ok, true);
    assert.deepEqual(next.state, old.gameState, `seed ${i + 1}`);
    compared++;
    assert.equal(next.report.foodChange, next.state.food - s.food);
    assert.equal(next.report.populationChange, next.state.pawns - s.pawns);
  }
  assert.equal(compared, 1000);
});
test("500 complete campaigns stay within resource bounds and always terminate", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const rng = seedRandom(seed);
    let s = initialState(rng),
      ended = false;
    for (let turn = 0; turn < 10 && !ended; turn++) {
      const feed = Math.min(
        20,
        Math.floor(Math.max(0, s.food - s.land) / s.pawns),
      );
      const p = {
        buy: 0,
        sell: 0,
        plant: Math.min(
          s.land,
          s.pawns * 10,
          Math.max(0, s.food - feed * s.pawns),
        ),
        feed,
      };
      const result = advanceYear(s, p, rng);
      assert.equal(result.ok, true);
      s = result.state;
      ended = result.ended;
      for (const key of ["food", "land", "pawns", "year"])
        assert.ok(Number.isInteger(s[key]) && s[key] >= 0);
    }
    assert.equal(ended, true);
  }
});
const record = (id, score = 100) => ({
  id,
  playerName: "Nova",
  finalPawns: score,
  finalYear: 10,
  round: 1,
  createdAt: 1,
  ruleset: 1,
});
test("Session ranking retains every round, including tied and zero scores", () => {
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  let records = [];
  for (const [i, score] of [100, 0, 100, 125].entries())
    records = addSession(
      records,
      { ...record(`run-${i}`, score), round: i + 1 },
      storage,
    );
  assert.equal(records.length, 4);
  assert.deepEqual(
    records.map((r) => r.finalPawns),
    [125, 100, 100, 0],
  );
  assert.equal(
    addSession(records, records[0], storage).length,
    4,
    "Retry is not another round",
  );
  assert.deepEqual(readSession(storage), []);
});
test("Session survives reload and malformed storage fails safely", () => {
  const storage = {
    data: "[]",
    getItem(key) {
      assert.equal(key, SESSION_KEY);
      return this.data;
    },
    setItem(key, value) {
      this.data = value;
    },
  };
  addSession([], record("one"), storage);
  assert.equal(readSession(storage).length, 1);
  storage.data = "{}";
  assert.deepEqual(readSession(storage), []);
  storage.data = "broken";
  assert.deepEqual(readSession(storage), []);
});
test("Invalid scores and names cannot enter the ranking renderer", () => {
  assert.equal(validRecord(record("one")), true);
  for (const invalid of [
    { ...record("one"), finalPawns: 601 },
    { ...record("one"), finalYear: 0 },
    { ...record("one"), playerName: "too-long-for-this" },
    { ...record("one"), id: "bad/path" },
    { ...record("one"), ruleset: 2 },
  ])
    assert.equal(validRecord(invalid), false);
  assert.equal(
    rankRecords([record("one"), null, { finalPawns: 999999 }]).length,
    1,
  );
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
          assert.equal(field, "finalPawns");
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
    assert.ok(
      [...docs.keys()].every((key) =>
        key.includes("steve_jobs_hammurabi_gpt6_astra_v1"),
      ),
    );
  } finally {
    delete globalThis.location;
    delete globalThis.window;
  }
});
