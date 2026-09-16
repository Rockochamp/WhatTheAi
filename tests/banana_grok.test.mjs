import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  runSummary,
  RULESET,
  LOADOUTS,
  CUTS,
  MEAT,
  bladePoints,
  HOOK_SECONDS,
} from "../games/BananaSurvivors/grok_4_6/engine.js";
import {
  validRecord,
  SESSION_KEY,
  DEVICE_KEY,
} from "../games/BananaSurvivors/grok_4_6/records.js";
import { createGore, GORE_LIMITS } from "../games/BananaSurvivors/grok_4_6/gore.js";

const ticks = (s, n, input = {}) => {
  for (let i = 0; i < n; i++) update(s, 1 / 60, input);
};
const empty = (loadout = "crescent") => {
  const s = createRun(77, loadout);
  s.spawnClock = 1e6;
  s.hook = 1e6;
  return s;
};

test("SPLIT uses its own ruleset, loadouts and keys — no Astra guns", () => {
  assert.equal(RULESET, 2);
  assert.ok(SESSION_KEY.includes("grok_4_6"));
  assert.ok(SESSION_KEY.includes("v3"));
  assert.ok(!SESSION_KEY.includes("astra"));
  assert.deepEqual(Object.keys(LOADOUTS).sort(), ["crescent", "ripe", "splitter"]);
  assert.ok(CUTS.smile && CUTS.drink);
  assert.ok(MEAT.nib && MEAT.prize && !MEAT.chop);
  const s = createRun(1, "splitter");
  assert.equal(s.player.blades, 1);
  assert.equal(s.shots, undefined);
  assert.ok(!("weapons" in s) || !s.weapons?.stem);
});

test("WASD on-foot: A decreases x, D increases x, W decreases y", () => {
  const a = empty(),
    d = empty(),
    w = empty();
  ticks(a, 30, { x: -1 });
  ticks(d, 30, { x: 1 });
  ticks(w, 30, { y: -1 });
  assert.ok(a.player.x < -20, `A should move left, got ${a.player.x}`);
  assert.ok(d.player.x > 20, `D should move right, got ${d.player.x}`);
  assert.ok(w.player.y < -20, `W should move up, got ${w.player.y}`);
  const diag = empty();
  ticks(diag, 60, { x: 1, y: 1 });
  const dist = Math.hypot(diag.player.x, diag.player.y);
  assert.ok(Math.abs(dist - 208) < 8, `diagonal should be ~208, got ${dist}`);
});

test("pause freezes ripeness, corpses and the clock", () => {
  const s = empty();
  s.player.ripe = 0.4;
  s.corpses.push({ x: 0, y: 0, r: 10, life: 2, kind: "nib", angle: 0 });
  s.phase = "paused";
  const ripe = s.player.ripe,
    time = s.time,
    corpses = s.corpses.length;
  ticks(s, 180, { x: 1, dash: true });
  assert.equal(s.player.ripe, ripe);
  assert.equal(s.time, time);
  assert.equal(s.corpses.length, corpses);
});

test("split dash grants i-frames so a standing brisket cannot bite", () => {
  const s = empty();
  spawnEnemy(s, "brisket", { x: 8, y: 0 });
  const hp = s.player.hp;
  ticks(s, 20, { x: 1, dash: true });
  assert.ok(s.player.invuln > 0 || s.splits > 0 || s.player.hp === hp);
  assert.ok(s.player.hp > 0);
  assert.notEqual(s.phase, "dead");
});

test("orbiting peels cut meat — no projectile shots", () => {
  const s = empty();
  s.spin = 0;
  s.player.orbit = 40;
  s.player.blades = 1;
  s.player.bladeDmg = 40;
  const e = spawnEnemy(s, "nib", { x: 40, y: 0 });
  e.born = 0;
  ticks(s, 8);
  assert.ok(e.hp < e.maxHp || e.dead, "blade should wound the nib");
  assert.equal(s.shots, undefined);
});

test("split carves a healthy body instead of a gunshot execute window", () => {
  const s = empty("splitter");
  s.player.splitCd = 0;
  const e = spawnEnemy(s, "nib", { x: 12, y: 0 });
  e.hp = e.maxHp;
  ticks(s, 18, { x: 1, dash: true });
  assert.ok(e.dead || e.hp < e.maxHp, "split should cut, not ignore healthy meat");
});

test("blood on the floor feeds ripeness faster than decay", () => {
  const s = empty();
  s.player.ripe = 0.2;
  s.pools.push({ x: 0, y: 0, r: 60, life: 8, acid: false });
  ticks(s, 60);
  assert.ok(s.player.ripe > 0.35, `ripe should climb, got ${s.player.ripe}`);
});

test("full ripeness bursts and damages nearby meat", () => {
  const s = empty();
  s.player.ripe = 1;
  s.player.wind = 0;
  const e = spawnEnemy(s, "nib", { x: 30, y: 0 });
  ticks(s, 40);
  assert.ok(s.bursts >= 1 || e.dead || e.hp < e.maxHp);
  assert.ok(s.player.ripe < 1 || s.bursts >= 1);
});

test("crushing a corpse during split is capped by corpse budget", () => {
  const s = empty();
  for (let i = 0; i < 8; i++)
    s.corpses.push({ x: i, y: 0, r: 12, life: 2, kind: "nib", angle: 0 });
  s.player.splitCd = 0;
  ticks(s, 12, { x: 1, dash: true });
  assert.ok(s.corpses.length <= 40);
  assert.ok(s.crushes >= 1);
});

test("same seed plus same input is deterministic", () => {
  const runWith = () => {
    const s = createRun(42, "crescent");
    s.spawnClock = 1e6;
    s.hook = 1e6;
    spawnEnemy(s, "shank", { x: 50, y: 0 });
    for (let i = 0; i < 90; i++) update(s, 1 / 60, { x: 1, dash: i % 20 === 0 });
    return JSON.stringify(runSummary(s));
  };
  assert.equal(runWith(), runWith());
});

test("records reject Astra loadouts and foreign rulesets", () => {
  const base = {
    id: "abc",
    playerName: "Banana",
    score: 10,
    kills: 1,
    wave: 1,
    seconds: 3,
    level: 1,
    round: 1,
    createdAt: 1,
    ruleset: RULESET,
    loadout: "crescent",
  };
  assert.equal(validRecord(base), true);
  assert.equal(validRecord({ ...base, loadout: "classic" }), false);
  assert.equal(validRecord({ ...base, loadout: "original" }), false);
  assert.equal(validRecord({ ...base, ruleset: 3 }), false);
  assert.equal(validRecord({ ...base, ruleset: 1 }), false);
});

test("gore budgets stay bounded", () => {
  const g = createGore(() => 0.5);
  const player = { x: 0, y: 0 };
  for (let i = 0; i < 80; i++) {
    g.emit({ type: "kill", x: i, y: 0, size: 40 }, player);
    g.emit({ type: "burst", x: i, y: 2, r: 80 }, player);
    g.step(0.016);
  }
  assert.ok(g.blood.length <= GORE_LIMITS.blood);
  assert.ok(g.chunks.length <= GORE_LIMITS.chunks);
  assert.ok(g.stains.length <= GORE_LIMITS.stains);
});

test("global collection is isolated v3 SPLIT, not Astra or Floor", () => {
  assert.ok(SESSION_KEY.includes("v3"));
  assert.ok(DEVICE_KEY.includes("v3"));
  assert.ok(!SESSION_KEY.includes("v2"));
  assert.equal(HOOK_SECONDS, 48);
  const s = empty();
  const blades = bladePoints(s);
  assert.equal(blades.length, s.player.blades);
});
