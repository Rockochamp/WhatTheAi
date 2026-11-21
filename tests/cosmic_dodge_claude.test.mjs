import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Run, autopilot, STEP, H, REF_W, MIN_W, MAX_W, GRAZE, PLAYER_R, FLOW_FLOOR, WARP_SCALE,
  fieldWidth, speedAt, rateAt, multiplierAt, dailySeed, sweptDistance, barDistance, SECTORS,
} from "../games/cosmic_dodge/claude_fable_5_2/engine.js";
import { validRecord, compareRecords, makeRecord, board } from "../games/cosmic_dodge/claude_fable_5_2/records.js";
import { cleanName, nameAllowed, rng, hashString, dayKey, prefs } from "../js/fable/kit.js";

const fly = (run, seconds, pilot = (r) => autopilot(r, 0)) => {
  let input = { x: 0, y: 0, warp: false };
  for (let i = 0; i < seconds / STEP && run.status === "playing"; i++) {
    if (i % 4 === 0) input = pilot(run);
    run.update(STEP, input);
  }
  return run;
};
const idle = () => ({ x: 0, y: 0, warp: false });
/** A run with the director silenced, for placing hazards by hand. */
const quiet = (options) => {
  const run = new Run(options);
  run.start();
  run.nextFormation = Infinity;
  run.dustIn = Infinity;
  return run;
};

test("field width follows the screen within limits", () => {
  assert.equal(fieldWidth(0.2), MIN_W);
  assert.equal(fieldWidth(0.8), 800);
  assert.equal(fieldWidth(3), MAX_W);
  assert.equal(fieldWidth(NaN), 800);
});

test("difficulty rises every level and stays finite", () => {
  for (let level = 1; level < 200; level++) {
    assert.ok(speedAt(level + 1) > speedAt(level));
    assert.ok(rateAt(level + 1) >= rateAt(level));
  }
  assert.ok(rateAt(500) <= 7.6);
});

test("multiplier steps from 1 to 8 with flow", () => {
  assert.equal(multiplierAt(0), 1);
  assert.equal(multiplierAt(FLOW_FLOOR), 1);
  assert.equal(multiplierAt(28), 2);
  assert.equal(multiplierAt(99.9), 7);
  assert.equal(multiplierAt(100), 8);
  for (let f = 0; f < 100; f++) assert.ok(multiplierAt(f + 1) >= multiplierAt(f));
});

test("the same seed and inputs replay identically", () => {
  const a = fly(new Run({ seed: 77 }), 40),
    b = fly(new Run({ seed: 77 }), 40);
  a.status === "ready" && a.start();
  const one = new Run({ seed: 77 }),
    two = new Run({ seed: 77 });
  one.start();
  two.start();
  fly(one, 40);
  fly(two, 40);
  assert.equal(one.points, two.points);
  assert.equal(one.cleared, two.cleared);
  assert.equal(one.player.x, two.player.x);
  assert.deepEqual(one.hazards.map((h) => [h.kind, h.x, h.y]), two.hazards.map((h) => [h.kind, h.x, h.y]));
  assert.equal(a.time, b.time);
});

test("different seeds give different fields", () => {
  const a = new Run({ seed: 1 }),
    b = new Run({ seed: 2 });
  a.start();
  b.start();
  fly(a, 6, idle);
  fly(b, 6, idle);
  assert.notDeepEqual(a.hazards.map((h) => h.x), b.hazards.map((h) => h.x));
});

test("daily seed is stable per day and differs between days", () => {
  assert.equal(dailySeed("2026-11-21"), dailySeed("2026-11-21"));
  assert.notEqual(dailySeed("2026-11-21"), dailySeed("2026-11-22"));
  assert.match(dayKey(new Date("2026-11-21T23:59:59Z")), /^2026-11-21$/);
});

test("ten rocks make one level at the reference width", () => {
  const run = quiet({ width: REF_W });
  run.shield = 0;
  for (let i = 0; i < 10; i++) run.clear({});
  assert.equal(run.level, 2);
  assert.equal(run.cleared, 10);
});

test("wider fields need proportionally more rocks per level", () => {
  const wide = quiet({ width: 1600 });
  for (let i = 0; i < 19; i++) wide.clear({});
  assert.equal(wide.level, 1);
  wide.clear({});
  assert.equal(wide.level, 2);
});

test("a new sector starts every five levels with a bonus and a breather", () => {
  const run = quiet({ width: REF_W });
  run.nextFormation = 0;
  for (let i = 0; i < 50; i++) run.clear({}, false);
  const events = run.drainEvents();
  const sector = events.find((e) => e.type === "sector");
  assert.equal(run.level, 6);
  assert.equal(sector.sector, 1);
  assert.equal(sector.name, SECTORS[1].name);
  assert.equal(sector.bonus, 200);
  assert.equal(run.points, 200);
  assert.ok(run.nextFormation >= run.world + 2.3);
});

test("a close pass is a graze: flow, points and one event per hazard", () => {
  const run = quiet({ width: REF_W });
  const p = run.player;
  run.spawn({ kind: "rock", x: p.x + 26 * 0.8 + PLAYER_R + 12, y: p.y - 80, r: 26, vx: 0, vy: 400, spin: 0 });
  fly(run, 1, idle);
  const grazes = run.drainEvents().filter((e) => e.type === "graze");
  assert.equal(grazes.length, 1);
  assert.equal(run.grazes, 1);
  assert.ok(run.flow > FLOW_FLOOR + 5);
  assert.ok(run.points >= 5);
  assert.equal(run.status, "playing");
  assert.equal(run.shield, 1);
});

test("a rock outside graze range gives nothing", () => {
  const run = quiet({ width: REF_W });
  const p = run.player;
  run.spawn({ kind: "rock", x: p.x + 26 * 0.8 + PLAYER_R + GRAZE + 8, y: p.y - 80, r: 26, vx: 0, vy: 400, spin: 0 });
  fly(run, 1, idle);
  assert.equal(run.grazes, 0);
});

test("the shield absorbs one hit and clears nearby hazards; the next hit ends the run", () => {
  const run = quiet({ width: REF_W });
  const p = run.player;
  run.spawn({ kind: "rock", x: p.x, y: p.y - 60, r: 26, vx: 0, vy: 400, spin: 0 });
  run.spawn({ kind: "rock", x: p.x + 150, y: p.y - 60, r: 26, vx: 0, vy: 400, spin: 0 });
  fly(run, 0.4, idle);
  let events = run.drainEvents();
  assert.equal(run.shield, 0);
  assert.equal(run.status, "playing");
  assert.ok(run.invulnerable > 0);
  assert.equal(events.find((e) => e.type === "shield").swept, 2);
  assert.equal(run.hazards.length, 0);
  run.invulnerable = 0;
  run.spawn({ kind: "rock", x: p.x, y: p.y - 60, r: 26, vx: 0, vy: 400, spin: 0 });
  fly(run, 0.4, idle);
  events = run.drainEvents();
  assert.equal(run.status, "over");
  assert.ok(events.some((e) => e.type === "over" && e.by === "rock"));
});

test("fast hazards cannot tunnel through the ship", () => {
  const run = quiet({ width: REF_W });
  run.shield = 0;
  const p = run.player;
  run.spawn({ kind: "comet", x: p.x, y: p.y - 500, r: 17, vx: 0, vy: 30000, spin: 0 });
  run.update(0.05, idle());
  assert.equal(run.status, "over");
});

test("warp slows the world, drains flow and stops when flow runs out", () => {
  const run = quiet({ width: REF_W });
  run.flow = 50;
  const rock = run.spawn({ kind: "rock", x: 40, y: 0, r: 20, vx: 0, vy: 100, spin: 0 });
  for (let i = 0; i < 120; i++) run.update(STEP, { warp: true });
  assert.ok(run.warping);
  assert.ok(run.flow < 30);
  assert.ok(rock.y < 100 * (WARP_SCALE + 0.15), `rock fell ${rock.y}`);
  assert.ok(run.world < run.time * 0.5);
  for (let i = 0; i < 600; i++) run.update(STEP, { warp: true });
  assert.equal(run.warping, false);
  for (let i = 0; i < 1200; i++) run.update(STEP, idle());
  assert.ok(Math.abs(run.flow - FLOW_FLOOR) < 0.5, "flow recovers to the reserve");
});

test("flow above the reserve decays only after a pause", () => {
  const run = quiet({ width: REF_W });
  run.flow = 80;
  for (let i = 0; i < 2 / STEP; i++) run.update(STEP, idle());
  assert.equal(run.flow, 80);
  for (let i = 0; i < 3 / STEP; i++) run.update(STEP, idle());
  assert.ok(run.flow < 80 && run.flow > FLOW_FLOOR);
});

test("the ship stays inside the field and steers by keys or target", () => {
  const run = quiet({ width: REF_W });
  for (let i = 0; i < 600; i++) run.update(STEP, { x: -1, y: -1 });
  assert.equal(run.player.x, run.bounds.left);
  assert.equal(run.player.y, run.bounds.top);
  for (let i = 0; i < 600; i++) run.update(STEP, { target: { x: 5000, y: 5000 } });
  assert.equal(run.player.x, run.bounds.right);
  assert.equal(run.player.y, run.bounds.bottom);
  for (let i = 0; i < 240; i++) run.update(STEP, { target: { x: 400, y: 500 } });
  assert.ok(Math.hypot(run.player.x - 400, run.player.y - 500) < 2);
  run.update(STEP, { x: NaN, y: "left", target: { x: NaN, y: 1 } });
  assert.ok(Number.isFinite(run.player.x) && Number.isFinite(run.player.y));
});

test("bar distance measures to the nearest point of a rotated segment", () => {
  const bar = { x: 0, y: 0, half: 100, angle: 0, r: 15 };
  assert.equal(barDistance(0, 30, bar), 30);
  assert.equal(barDistance(130, 0, bar), 30);
  assert.ok(Math.abs(barDistance(30, 0, { ...bar, angle: Math.PI / 2 }) - 30) < 1e-9);
  assert.equal(sweptDistance(-10, 5, 10, 5), 5);
});

test("every wall leaves an opening wide enough for the ship at any level and width", () => {
  for (const width of [MIN_W, REF_W, 1200, MAX_W])
    for (const level of [2, 10, 30, 80]) {
      const run = quiet({ width, seed: level * 31 + width });
      run.progress = (level - 1) * 10;
      for (let k = 0; k < 20; k++) {
        run.queue.length = 0;
        run.wall(level, speedAt(level));
        const bars = run.queue.filter((s) => s.kind === "bar").map((s) => [s.x - s.half - s.r, s.x + s.half + s.r]).sort((a, b) => a[0] - b[0]);
        let widest = Math.max(bars[0][0], width - bars.at(-1)[1]);
        for (let i = 1; i < bars.length; i++) widest = Math.max(widest, bars[i][0] - bars[i - 1][1]);
        assert.ok(widest >= 140, `gap ${widest} at width ${width}, level ${level}`);
      }
    }
});

test("every formation produces hazards that eventually leave the field", () => {
  for (const name of ["rain", "wall", "chevron", "corridor", "spinner", "stream", "pincer", "comets", "splitters", "ribbon", "crossfire"])
    for (const width of [MIN_W, REF_W, MAX_W]) {
      const run = quiet({ width, seed: hashString(name) + width });
      run.shield = 0;
      run.invulnerable = Infinity;
      const made = run[name](12, speedAt(12));
      assert.ok(made.count >= 1 && made.duration >= 0, name);
      for (let i = 0; i < 14 / STEP; i++) run.update(STEP, idle());
      assert.equal(run.queue.length, 0, `${name} queue`);
      assert.equal(run.hazards.length, 0, `${name} leftovers at width ${width}`);
      assert.equal(run.telegraphs.length, 0, `${name} telegraphs`);
      assert.ok(run.cleared >= made.count - 1, `${name} cleared ${run.cleared} of ${made.count}`);
    }
});

test("comets and crossfire always warn before they arrive", () => {
  for (const name of ["comets", "crossfire"]) {
    const run = quiet({ seed: 5 });
    run[name](20, speedAt(20));
    const warnings = run.queue.filter((s) => s.telegraph),
      strikes = run.queue.filter((s) => !s.telegraph);
    assert.equal(warnings.length, strikes.length);
    warnings.forEach((w, i) => assert.ok(strikes[i].at - w.at >= 0.7, name));
  }
});

test("splitters break into three rocks", () => {
  const run = quiet({ seed: 9 });
  run.invulnerable = Infinity;
  run.spawn({ kind: "splitter", x: 400, y: 0, r: 44, vy: 600, splitY: 300 });
  for (let i = 0; i < 1 / STEP && !run.hazards.some((h) => h.kind === "rock"); i++) run.update(STEP, idle());
  assert.equal(run.hazards.length, 3);
  assert.ok(run.drainEvents().some((e) => e.type === "split"));
});

test("pickups: stardust adds flow and points, a hexagon restores the shield", () => {
  const run = quiet({});
  const p = run.player;
  run.shield = 0;
  run.pickups.push({ type: "dust", x: p.x, y: p.y - 40, vy: 200, r: 10, age: 0 }, { type: "aegis", x: p.x, y: p.y - 60, vy: 200, r: 15, age: 0 });
  fly(run, 0.6, idle);
  assert.equal(run.shield, 1);
  assert.ok(run.flow > FLOW_FLOOR);
  assert.ok(run.points >= 20);
  assert.equal(run.pickups.length, 0);
});

test("pausing freezes the run", () => {
  const run = new Run({ seed: 3 });
  run.update(STEP, idle());
  assert.equal(run.time, 0);
  run.start();
  fly(run, 1, idle);
  run.pause();
  const t = run.time;
  run.update(1, idle());
  assert.equal(run.time, t);
  run.resume();
  run.update(STEP, idle());
  assert.ok(run.time > t);
});

test("the autopilot reaches the second sector on most seeds without cheating", () => {
  let reached = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const run = new Run({ seed: seed * 7919 });
    run.start();
    fly(run, 120);
    if (run.level >= 6) reached++;
    assert.ok(Number.isFinite(run.points) && run.points >= 0);
    assert.ok(run.hazards.length < 120);
  }
  assert.ok(reached >= 8, `only ${reached} of 12 runs reached level 6`);
});

test("long runs stay bounded", () => {
  const run = new Run({ seed: 2024, width: MAX_W });
  run.start();
  run.invulnerable = Infinity;
  let peak = 0;
  for (let i = 0; i < 240 / STEP; i++) {
    if (i % 480 === 0) run.invulnerable = Infinity;
    run.update(STEP, { warp: i % 2000 < 300 });
    peak = Math.max(peak, run.hazards.length + run.queue.length);
    run.events.length = 0;
  }
  assert.ok(run.level > 30, `level ${run.level}`);
  assert.ok(peak < 400, `peak ${peak}`);
  assert.ok(run.hazards.every((h) => Number.isFinite(h.x) && Number.isFinite(h.y)));
});

test("records validate, rank and round-trip through storage", () => {
  const run = new Run({ seed: 1, mode: "daily", day: "2026-11-21" });
  run.start();
  run.points = 1234.9;
  run.progress = 42;
  const record = makeRecord(run, "", "run-1");
  assert.equal(record.playerName, "Anonymous");
  assert.equal(record.score, 1234);
  assert.equal(record.level, 5);
  assert.ok(validRecord(record));
  for (const bad of [{ score: -1 }, { score: 1.5 }, { level: 0 }, { playerName: "" }, { playerName: "x".repeat(17) }, { ruleset: 0 }, { mode: "daily", day: "today" }, { mode: "other" }, { bestMultiplier: 9 }, { elapsed: NaN }, { id: "" }])
    assert.equal(validRecord({ ...record, ...bad }), false, JSON.stringify(bad));
  assert.equal(validRecord(null), false);
  const sorted = [{ ...record, id: "a", score: 5 }, { ...record, id: "b", score: 9 }, { ...record, id: "c", score: 9, level: 7 }].sort(compareRecords);
  assert.deepEqual(sorted.map((r) => r.id), ["c", "b", "a"]);
  const data = new Map(),
    storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  for (let i = 0; i < 14; i++) board.addLocal({ ...record, id: `r${i}`, score: i * 10 }, storage);
  board.addLocal({ ...record, id: "r13", score: 130 }, storage);
  const local = board.readLocal(storage);
  assert.equal(local.length, 10);
  assert.equal(local[0].score, 130);
  assert.equal(new Set(local.map((r) => r.id)).size, 10);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(board.readLocal(blocked), []);
  assert.equal(board.addLocal(record, blocked).persisted, false);
  assert.equal(board.collection, "leaderboard_cosmic_dodge_claude_fable_5_2_v1");
});

test("kit: names, generator and preferences", () => {
  assert.equal(cleanName("  Ada   <b>Lovelace</b>  "), "Ada bLovelace/b");
  assert.equal(cleanName("x".repeat(40)).length, 16);
  const words = ["ass", "shit", "nazi", "fuck"];
  assert.ok(nameAllowed("Cassie", words));
  assert.ok(nameAllowed("Passenger 7", words));
  assert.ok(!nameAllowed("big ass", words));
  assert.ok(!nameAllowed("ASS", words));
  assert.ok(!nameAllowed("sh.i.t", words));
  assert.ok(!nameAllowed("xXfuckerXx", ["fucker"]));
  const a = rng(5), b = rng(5);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  const p = prefs("t_", { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } });
  assert.equal(p.get("x", "fallback"), "fallback");
  assert.equal(p.set("x", 1), false);
});

test("the page wires every control the script expects", () => {
  const html = readFileSync(new URL("../games/cosmic_dodge/cosmic_dodge_claude_fable_5_2.html", import.meta.url), "utf8"),
    js = readFileSync(new URL("../games/cosmic_dodge/claude_fable_5_2/game.js", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, used] of js.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  assert.equal(ids.size, [...html.matchAll(/\sid="([^"]+)"/g)].length, "duplicate ids");
  assert.match(html, /Made with Claude Fable 5\.2/);
  assert.doesNotMatch(html + js, /fonts\.googleapis|cdn\.|unpkg/);
});
