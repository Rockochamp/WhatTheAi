import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Game, autopilot, STEP, ARENA, MAX_ENEMIES, TYPES, UPGRADES, COMBOS, xpForLevel, hpScaleAt } from "../games/BananaSurvivors/claude_fable_5_2/engine.js";
import { validRecord, compareRecords, makeRecord, board } from "../games/BananaSurvivors/claude_fable_5_2/records.js";

/** A game with no troop arriving, for placing monkeys by hand. */
const quiet = (seed = 1) => {
  const g = new Game({ seed });
  g.spawnIn = Infinity;
  g.bossAt = Infinity;
  g.trees.length = 0;
  return g;
};
const run = (g, seconds, input = {}) => {
  for (let i = 0; i < seconds / STEP && g.status === "playing"; i++) g.update(STEP, input);
  return g;
};

test("the same seed and inputs replay identically", () => {
  const fly = (seed) => {
    const g = new Game({ seed });
    let input = {};
    for (let i = 0; i < 40 / STEP && g.status !== "over"; i++) {
      if (g.status === "choosing") g.choose(0);
      if (i % 6 === 0) input = autopilot(g);
      g.update(STEP, input);
    }
    return [g.time, g.points, g.kills, g.level, g.player.x, g.player.y, g.enemies.length];
  };
  assert.deepEqual(fly(42), fly(42));
  assert.notDeepEqual(fly(42), fly(43));
});

test("a thrown peel tips the nearest monkey away from the banana", () => {
  const g = quiet();
  const m = g.spawn("monkey", g.player.x + 120, g.player.y, 1);
  m.speed = 0;
  run(g, 1.2);
  const events = g.drainEvents().map((e) => e.type);
  assert.ok(events.includes("throw") && events.includes("bonk") && events.includes("slip"));
  assert.ok(m.x > g.player.x + 160, "it slid away");
  assert.ok(m.hp < m.maxHp);
});

test("a sliding monkey bowls over the ones behind it", () => {
  const g = quiet();
  g.throwIn = Infinity;
  const x = g.player.x + 200,
    y = g.player.y,
    first = g.spawn("monkey", x, y, 50);
  const row = [1, 2, 3].map((i) => {
    const m = g.spawn("monkey", x + i * 34, y, 50);
    m.speed = 0;
    return m;
  });
  first.speed = 0;
  g.slip(first, 1, 0, 600, 0, 7);
  run(g, 1);
  assert.ok(row.every((m) => m.hp < m.maxHp), "all three were hit");
  assert.ok(row[2].x > x + 3 * 34 + 5, "the chain reached the third");
  assert.ok(g.drainEvents().filter((e) => e.type === "bump").length >= 3);
});

test("chains stop at the chain depth", () => {
  const g = quiet();
  g.throwIn = Infinity;
  g.stats.chainDepth = 1;
  const x = g.player.x + 200,
    y = g.player.y,
    first = g.spawn("monkey", x, y, 50),
    second = g.spawn("monkey", x + 34, y, 50),
    third = g.spawn("monkey", x + 68, y, 50);
  for (const m of [first, second, third]) m.speed = 0;
  g.slip(first, 1, 0, 600, 0, 7);
  run(g, 0.5);
  assert.equal(second.depth, 1);
  assert.ok(third.hp < third.maxHp, "the last one is still knocked");
  assert.ok([first, second, third].every((m) => m.depth <= 1), "nobody slides deeper than the limit");
});

test("pile-ups are counted per peel and announced", () => {
  const g = quiet();
  g.throwIn = Infinity;
  const victims = Array.from({ length: 6 }, (_, i) => g.spawn("baby", 300 + i * 40, 300, 1));
  for (const m of victims) g.hurt(m, 999, 5);
  const events = g.drainEvents();
  assert.equal(g.kills, 6);
  assert.equal(g.bestChain, 6);
  assert.deepEqual(events.filter((e) => e.type === "combo").map((e) => e.label), [COMBOS[0][1]]);
  assert.equal(g.orbs.length, 6);
  assert.ok(g.points > 6 * TYPES.baby.points, "later tumbles in a chain are worth more");
});

test("crashing into a palm hurts and shakes coconuts loose on the troop", () => {
  const g = quiet();
  g.throwIn = Infinity;
  g.trees.push({ x: 1000, y: 1000, r: 24, shake: 0 });
  const m = g.spawn("monkey", 900, 1000, 50);
  m.speed = 0;
  g.slip(m, 1, 0, 700, 0, 3);
  run(g, 0.4);
  const events = g.drainEvents().map((e) => e.type);
  assert.ok(events.includes("crash"));
  assert.ok(g.coconuts.length >= 1 || events.includes("thunk"));
  assert.ok(m.hp < m.maxHp);
  assert.ok(m.x < 1000, "it bounced back");
});

test("the king cannot be tipped, but a palm stops his charge", () => {
  const g = quiet();
  g.throwIn = Infinity;
  const king = g.spawn("boss", g.player.x + 300, g.player.y, 1);
  assert.equal(g.slip(king, 1, 0, 900, 0, 1), false);
  assert.notEqual(king.state, "slide");
  assert.ok(king.hp < king.maxHp, "peels still sting");
  g.trees.push({ x: g.player.x + 150, y: g.player.y, r: 24, shake: 0 });
  king.phaseT = 0;
  run(g, 3, {});
  assert.ok(g.drainEvents().some((e) => e.type === "crash"));
});

test("touching a monkey hurts once, then a moment of safety; health runs out", () => {
  const g = quiet();
  g.throwIn = Infinity;
  const m = g.spawn("monkey", g.player.x + 5, g.player.y, 1);
  m.dmg = 10;
  run(g, 0.1);
  assert.equal(g.player.hp, 90);
  run(g, 0.3);
  assert.equal(g.player.hp, 90, "still safe");
  m.dmg = 500;
  run(g, 1);
  assert.equal(g.status, "over");
  assert.equal(g.player.hp, 0);
  const t = g.time;
  g.update(STEP, {});
  assert.equal(g.time, t, "a finished run stays finished");
});

test("dashing is untouchable and bowls through", () => {
  const g = quiet();
  g.throwIn = Infinity;
  const m = g.spawn("monkey", g.player.x + 40, g.player.y, 50);
  m.speed = 0;
  g.update(STEP, { x: 1, y: 0, dash: true });
  run(g, 0.3, { x: 1, y: 0 });
  assert.equal(g.player.hp, 100);
  assert.ok(m.hp < m.maxHp);
  assert.ok(g.player.dashCd > 0);
  const x = g.player.x;
  g.update(STEP, { x: 1, y: 0, dash: true });
  assert.ok(g.player.x - x < 10, "no second dash while it recharges");
});

test("thrown coconuts warn first and can be stepped out of", () => {
  const g = quiet();
  g.throwIn = Infinity;
  g.coconuts.push({ x: g.player.x, y: g.player.y, t: 1, r: 44, friendly: false, dmg: 20 });
  run(g, 0.5, { x: 1, y: 0 });
  assert.equal(g.player.hp, 100);
  run(g, 0.7, { x: 1, y: 0 });
  assert.equal(g.player.hp, 100, "walked clear");
  g.coconuts.push({ x: g.player.x, y: g.player.y, t: 0.2, r: 44, friendly: false, dmg: 20 });
  run(g, 0.4);
  assert.equal(g.player.hp, 80);
});

test("drops level you up and every level offers three different upgrades", () => {
  const g = quiet();
  g.gainXp(xpForLevel(1));
  assert.equal(g.level, 2);
  assert.equal(g.status, "choosing");
  assert.equal(g.choices.length, 3);
  assert.equal(new Set(g.choices.map((c) => c.id)).size, 3);
  const t = g.time;
  g.update(STEP, {});
  assert.equal(g.time, t, "the world waits while you choose");
  assert.equal(g.choose(9), false);
  const pick = g.choices[0];
  assert.ok(g.choose(0));
  assert.equal(g.ranks[pick.id], 1);
  assert.equal(g.status, "playing");
  for (let l = 1; l < 60; l++) assert.ok(xpForLevel(l + 1) > xpForLevel(l));
});

test("every upgrade applies up to its cap and never past it", () => {
  const g = quiet();
  for (const u of UPGRADES) {
    for (let i = 0; i < u.max; i++) assert.ok(g.grant(u.id), u.id);
    assert.equal(g.grant(u.id), false, `${u.id} is capped`);
    assert.ok(u.name && u.text.endsWith("."));
  }
  const s = g.stats;
  for (const [k, v] of Object.entries(s)) assert.ok(Number.isFinite(v) && v > 0, `${k} = ${v}`);
  assert.ok(s.throwEvery < 0.95 && s.peels === 5 && s.ripeEvery === 2 && s.maxHp === 200);
  assert.equal(g.offer().length, 0);
  g.gainXp(9999);
  assert.equal(g.status, "playing", "with everything maxed, levels heal instead of asking");
});

test("the troop grows, the king comes at two minutes, and the crowd is capped", () => {
  const g = new Game({ seed: 9 });
  g.throwIn = Infinity;
  g.stats.maxHp = 1e9;
  g.player.hp = 1e9;
  let peak = 0,
    sawBoss = false;
  for (let i = 0; i < 200 / STEP; i++) {
    g.update(STEP, {});
    peak = Math.max(peak, g.enemies.length);
    for (const e of g.drainEvents()) if (e.type === "boss") sawBoss = true;
    if (g.status === "choosing") g.choose(0);
  }
  assert.ok(sawBoss);
  assert.ok(peak > 100 && peak <= MAX_ENEMIES + 10, `peak ${peak}`);
  assert.ok(g.enemies.every((e) => e.x >= 0 && e.x <= ARENA && e.y >= 0 && e.y <= ARENA && Number.isFinite(e.hp)));
  assert.ok(new Set(g.enemies.map((e) => e.type)).size >= 3);
  assert.ok(hpScaleAt(300) > hpScaleAt(100));
});

test("a careless pilot still lasts a while and a run always ends", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const g = new Game({ seed: seed * 977 });
    let input = {};
    for (let i = 0; i < 900 / STEP && g.status !== "over"; i++) {
      if (g.status === "choosing") g.choose(i % 3);
      if (i % 6 === 0) input = autopilot(g);
      g.update(STEP, input);
      g.events.length = 0;
    }
    assert.equal(g.status, "over", `seed ${seed} never ended`);
    assert.ok(g.time > 45, `seed ${seed} lasted ${g.time}`);
    assert.ok(g.kills > 50);
  }
});

test("records validate and rank", () => {
  const g = quiet();
  g.time = 61.49;
  g.points = 1000;
  g.kills = 40;
  const record = makeRecord(g, "", "r1");
  assert.ok(validRecord(record), JSON.stringify(record));
  for (const bad of [{ score: -1 }, { score: 5 }, { kills: 1.5 }, { level: 0 }, { elapsed: NaN }, { ruleset: 0 }, { playerName: "" }, { id: "" }])
    assert.equal(validRecord({ ...record, ...bad }), false, JSON.stringify(bad));
  assert.deepEqual([{ ...record, id: "a", score: 5000 }, { ...record, id: "b", score: 9000 }].sort(compareRecords).map((r) => r.id), ["b", "a"]);
  assert.equal(board.collection, "leaderboard_banana_survivors_claude_fable_5_2_v1");
});

test("the page wires every control the script expects", () => {
  const dir = new URL("../games/BananaSurvivors/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("game.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  assert.doesNotMatch(html + js, /fonts\.googleapis|unpkg|cdnjs/);
});
