import test from "node:test";
import assert from "node:assert/strict";
import {
  addSessionRecord,
  readSessionRecords,
  rankSessionRecords,
  SESSION_KEY,
  RECORD_KEY,
} from "../games/cosmic_dodge/gpt6_astra/records.js";
const record = (round, score = 10) => ({
  id: `round-${round}`,
  round,
  playerName: "Pilot",
  score,
  level: Math.floor(score / 10) + 1,
  elapsed: 20,
  style: 0,
  ruleset: 3,
});
test("session rankings keep every round, including ties and rounds outside the top ten", () => {
  let rounds = [];
  const storage = { setItem() {} };
  for (let i = 1; i <= 15; i++)
    rounds = addSessionRecord(rounds, record(i), storage);
  assert.equal(rounds.length, 15);
  assert.deepEqual(
    rounds.map((r) => r.round),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
  rounds = addSessionRecord(rounds, record(16, 300), storage);
  assert.equal(rounds[0].round, 16);
  assert.equal(rounds[0].level, 31);
  assert.equal(rounds.length, 16);
});
test("session saves are idempotent and survive a same-tab refresh without changing device bests", () => {
  const values = new Map([[RECORD_KEY, "preserved"]]);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  let rounds = addSessionRecord([], record(1), storage);
  rounds = addSessionRecord(rounds, record(1), storage);
  rounds = addSessionRecord(
    rounds,
    { ...record(2, 29), playerName: "Second pilot" },
    storage,
  );
  assert.equal(rounds.length, 2);
  assert.deepEqual(readSessionRecords(storage), rounds);
  assert.equal(values.get(RECORD_KEY), "preserved");
  assert.notEqual(SESSION_KEY, RECORD_KEY);
});
test("invalid session history is ignored and blocked storage still keeps in-memory rounds", () => {
  assert.deepEqual(readSessionRecords({ getItem: () => "{" }), []);
  assert.deepEqual(readSessionRecords({ getItem: () => "{}" }), []);
  assert.deepEqual(
    rankSessionRecords([
      record(0),
      { ...record(1), round: 1.5 },
      { ...record(2), level: 99 },
      null,
    ]),
    [],
  );
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.deepEqual(readSessionRecords(blocked), []);
  assert.equal(addSessionRecord([], record(1), blocked).length, 1);
});
