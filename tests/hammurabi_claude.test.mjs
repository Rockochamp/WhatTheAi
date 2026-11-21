import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RULES, fate, dailySeed, initialState, forecast, limits, resolve, advise, reign, riskAfter, starvationShare, mood, epithet, chronicle,
} from "../games/steve_jobs_hammurabi/claude_fable_5_2/engine.js";
import { validRecord, compareRecords, makeRecord, board } from "../games/steve_jobs_hammurabi/claude_fable_5_2/records.js";
import { unitFor, symbolsFor } from "../games/steve_jobs_hammurabi/claude_fable_5_2/frieze.js";
import * as astra from "../games/steve_jobs_hammurabi/gpt6_astra/engine.js";
import { rng } from "../js/fable/kit.js";

const randomPlan = (state, r) => {
  const plan = { land: Math.floor((r() - 0.4) * 160), plant: Math.floor(r() * 400), feed: Math.floor(r() * 36) };
  return plan;
};
const fitPlan = (state, r) => {
  const plan = randomPlan(state, r);
  let lim = limits(state, plan);
  plan.land = Math.max(lim.minLand, Math.min(lim.maxLand, plan.land));
  lim = limits(state, plan);
  plan.plant = Math.min(plan.plant, lim.plantMax);
  lim = limits(state, plan);
  plan.feed = Math.min(plan.feed, lim.feedMax);
  return plan;
};

test("a fate is fixed by its seed and stays within the rules", () => {
  assert.deepEqual(fate(42), fate(42));
  assert.notDeepEqual(fate(42).years, fate(43).years);
  assert.equal(dailySeed("2026-11-21"), dailySeed("2026-11-21"));
  assert.notEqual(dailySeed("2026-11-21"), dailySeed("2026-11-22"));
  for (let seed = 1; seed < 300; seed++) {
    const f = fate(seed);
    assert.equal(f.years.length, RULES.years);
    assert.ok(f.firstPrice >= 18 && f.firstPrice <= 28);
    for (const y of f.years) {
      assert.ok(Number.isInteger(y.yield) && y.yield >= 3 && y.yield <= 7);
      assert.ok(y.nextPrice >= 18 && y.nextPrice <= 28);
      for (const k of ["arrive", "arriveSize", "leave", "leaveSize", "event", "eventSize"]) assert.ok(y[k] >= 0 && y[k] < 1);
    }
  }
});

test("a reign starts as the classic game does", () => {
  const s = initialState(fate(1));
  assert.deepEqual({ food: s.food, land: s.land, people: s.people, year: s.year, risk: s.risk }, { food: 4000, land: 100, people: 100, year: 0, risk: 0 });
});

test("budgets and validity match the GPT-6 Astra engine for 3,000 random plans", () => {
  const r = rng(7);
  for (let i = 0; i < 3000; i++) {
    const state = { year: Math.floor(r() * 10), food: Math.floor(r() * 9000), land: Math.floor(r() * 600), people: 1 + Math.floor(r() * 300), price: 18 + Math.floor(r() * 11), risk: r() * 1.4 };
    const plan = randomPlan(state, r),
      mine = forecast(state, plan),
      theirs = astra.forecast(
        { year: state.year, food: state.food, land: state.land, pawns: state.people, landPrice: state.price, starvationRisk: state.risk },
        { buy: Math.max(0, plan.land), sell: Math.max(0, -plan.land), plant: plan.plant, feed: plan.feed },
      );
    assert.equal(mine.valid, theirs.valid, JSON.stringify({ state, plan, mine: mine.errors, theirs: theirs.errors }));
    if (mine.valid) {
      assert.equal(mine.land, theirs.land);
      assert.equal(mine.reserve, theirs.reserve);
      assert.equal(mine.risk, theirs.risk);
    }
  }
});

test("a full year resolves exactly as the GPT-6 Astra engine does with the same rolls", () => {
  const r = rng(99);
  let compared = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const f = fate(seed * 13);
    let state = initialState(f);
    while (state.year < RULES.years && state.people > 0) {
      const plan = fitPlan(state, r),
        out = resolve(state, plan, f);
      assert.ok(out.ok, JSON.stringify(out.errors));
      const luck = f.years[state.year],
        rep = out.report,
        afterHunger = state.people - rep.starved,
        rolls = [(luck.yield - 3 + 0.5) / 5];
      if (afterHunger > 0) {
        rolls.push(luck.arrive);
        if (rep.arrivals) rolls.push(luck.arriveSize);
        if (plan.feed < 10) {
          rolls.push(luck.leave);
          if (luck.leave < 0.05) rolls.push(luck.leaveSize);
        }
        rolls.push(luck.event);
        if (rep.rats || rep.bonus || rep.plague) rolls.push(luck.eventSize);
      }
      rolls.push((luck.nextPrice - 18 + 0.5) / 11);
      const theirs = astra.advanceYear(
        { year: state.year, food: state.food, land: state.land, pawns: state.people, landPrice: state.price, starvationRisk: state.risk },
        { buy: Math.max(0, plan.land), sell: Math.max(0, -plan.land), plant: plan.plant, feed: plan.feed },
        () => rolls.shift(),
      );
      assert.equal(rolls.length, 0, "every roll was consumed");
      assert.deepEqual(
        { food: out.state.food, land: out.state.land, people: out.state.people, price: out.state.price, year: out.state.year },
        { food: theirs.state.food, land: theirs.state.land, people: theirs.state.pawns, price: theirs.state.landPrice, year: theirs.state.year },
        `seed ${seed} year ${state.year}`,
      );
      assert.equal(out.ended, theirs.ended);
      state = out.state;
      compared++;
    }
  }
  assert.ok(compared > 3000);
});

test("resolving never changes its inputs and rejects invalid plans", () => {
  const f = fate(5),
    s = initialState(f),
    frozen = JSON.stringify(s);
  for (const plan of [{ land: 0, plant: 100, feed: 20 }, { land: 999, plant: 0, feed: 0 }, { land: 0.5, plant: 0, feed: 0 }, { land: 0, plant: -1, feed: 0 }, { land: -101, plant: 0, feed: 0 }, { land: 0, plant: 101, feed: 0 }, { land: 0, plant: 0, feed: 41 }, { land: 0, plant: NaN, feed: 0 }]) {
    const out = resolve(s, plan, f);
    if (!out.ok) assert.equal(out.state, s);
  }
  assert.equal(JSON.stringify(s), frozen);
  assert.equal(resolve(s, { land: 999, plant: 0, feed: 0 }, f).ok, false);
  assert.equal(resolve(s, { land: 0, plant: 0, feed: 41 }, f).ok, false);
  assert.equal(resolve({ ...s, year: 10 }, { land: 0, plant: 0, feed: 0 }, f).ok, false);
  assert.equal(resolve({ ...s, people: 0 }, { land: 0, plant: 0, feed: 0 }, f).ok, false);
});

test("limits keep any plan valid", () => {
  const r = rng(3);
  for (let i = 0; i < 2000; i++) {
    const state = { year: 2, food: Math.floor(r() * 6000), land: Math.floor(r() * 500), people: 1 + Math.floor(r() * 250), price: 18 + Math.floor(r() * 11), risk: 0 };
    assert.ok(forecast(state, fitPlan(state, r)).valid);
  }
});

test("hunger builds below twenty bushels, heals at twenty, and kills past the breaking point", () => {
  assert.equal(riskAfter(0, 20), 0);
  assert.ok(Math.abs(riskAfter(0, 0) - 0.4) < 1e-12);
  assert.ok(Math.abs(riskAfter(0.8, 20) - 0.45) < 1e-12);
  assert.equal(starvationShare(0.85), 0);
  assert.ok(starvationShare(0.9) > 0);
  assert.equal(starvationShare(99), 0.45);
  assert.equal(mood(0).tone, "good");
  assert.equal(mood(0.6).tone, "warn");
  assert.equal(mood(0.9).tone, "bad");
});

test("the scribe always offers a valid plan and beats a routine ruler", () => {
  let scribe = 0,
    routine = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const f = fate(seed * 101);
    let state = initialState(f);
    while (state.year < RULES.years && state.people > 0) {
      const advice = advise(state);
      assert.ok(forecast(state, advice.plan).valid, `seed ${seed} year ${state.year}`);
      assert.ok(advice.reasons.length >= 1);
      state = resolve(state, advice.plan, f).state;
    }
    scribe += state.people;
    routine += reign(f, (s) => {
      const feed = Math.min(20, Math.floor(s.food / s.people));
      return { land: 0, feed, plant: Math.max(0, Math.min(s.land, s.people * 10, s.food - feed * s.people)) };
    }).state.people;
  }
  assert.ok(scribe / 150 > 95, `scribe average ${scribe / 150}`);
  assert.ok(scribe > routine * 2);
  assert.equal(advise({ ...initialState(fate(1)), year: 10 }), null);
});

test("the scribe does not peek at the fate", () => {
  const s = initialState(fate(1));
  assert.deepEqual(advise(s), advise({ ...s }));
  assert.equal(advise.length, 1);
});

test("ruling the same fate twice gives the same reign", () => {
  const a = reign(fate(2024)),
    b = reign(fate(2024));
  assert.deepEqual(a, b);
  assert.ok(a.reports.length <= RULES.years);
  assert.throws(() => reign(fate(1), () => ({ land: 9999, plant: 0, feed: 0 })));
});

test("epithets and chronicles", () => {
  assert.equal(epithet(0), "the Forgotten");
  assert.equal(epithet(100), "the Steward");
  assert.equal(epithet(400), "the Lawgiver");
  const { reports } = reign(fate(8));
  for (const r of reports) {
    const lines = chronicle(r);
    assert.ok(lines.length >= 1);
    for (const l of lines) assert.ok(["plain", "good", "warn", "bad"].includes(l.tone) && l.text.endsWith("."));
  }
  const one = chronicle({ plan: { land: 1, plant: 1, feed: 20 }, price: 20, yield: 5, harvest: 5, bonus: 0, rats: 0, starved: 1, plague: 1, left: 1, arrivals: 1 }).map((l) => l.text).join(" ");
  assert.match(one, /1 acre at/);
  assert.match(one, /1 person starved/);
  assert.match(one, /1 life\./);
  assert.match(one, /1 newcomer settled/);
});

test("mosaic units always fit their slots", () => {
  for (const [value, slots, steps] of [[100, 68, [1, 2, 5, 10, 25, 50]], [600, 68, [1, 2, 5, 10, 25, 50]], [4000, 76, [50, 100, 250, 500, 1000, 2500, 10000]], [90000, 76, [50, 100, 250, 500, 1000, 2500, 10000]], [1, 78, [5, 10, 20, 50, 100, 250]]]) {
    const unit = unitFor(value, slots, steps);
    assert.ok(symbolsFor(value, unit, slots) <= slots);
    assert.ok(symbolsFor(value, unit, slots) >= 1);
  }
  assert.equal(unitFor(100, 68, [1, 2, 5]), 2);
  assert.equal(symbolsFor(0, 5, 10), 0);
});

test("records validate and rank", () => {
  const record = makeRecord({ state: { people: 131, year: 10 }, counsels: 1, mode: "daily", day: "2026-11-21" }, "", "r1");
  assert.ok(validRecord(record));
  assert.equal(record.playerName, "Anonymous");
  assert.equal(record.finalPawns, 131);
  for (const bad of [{ score: 601 }, { score: 131.5 }, { finalPawns: 130 }, { counsels: 4 }, { years: 11 }, { mode: "daily", day: "" }, { ruleset: 2 }, { playerName: "" }])
    assert.equal(validRecord({ ...record, ...bad }), false, JSON.stringify(bad));
  assert.ok(validRecord({ ...record, mode: "free", day: "" }));
  const sorted = [{ ...record, id: "a", counsels: 3 }, { ...record, id: "b", counsels: 0 }, { ...record, id: "c", score: 140, finalPawns: 140 }].sort(compareRecords);
  assert.deepEqual(sorted.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(board.collection, "leaderboard_steve_jobs_hammurabi_claude_fable_5_2_v1");
});

test("the page wires every control the script expects", () => {
  const dir = new URL("../games/steve_jobs_hammurabi/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("game.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  for (const name of ["land", "plant", "feed"]) for (const kind of ["range", "num"]) assert.ok(ids.has(`${name}-${kind}`));
  for (const key of ["people", "food", "land"]) assert.ok(ids.has(`d-${key}`));
  assert.doesNotMatch(html + js, /fonts\.googleapis|unpkg|cdnjs/);
});
