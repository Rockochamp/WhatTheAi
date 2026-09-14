import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  chooseUpgrade,
  hordePressure,
  enemyForTime,
  ENCOUNTERS,
  ENEMIES,
  MAX_ENEMIES,
  MAX_SHOTS,
  SpatialGrid,
  RULESET,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
import {
  createGore,
  GORE_LIMITS,
} from "../games/BananaSurvivors/gpt6_astra/gore.js";
import {
  readRecords,
  validRecord,
  SESSION_KEY,
  DEVICE_KEY,
  LEGACY_SESSION_KEY,
  LEGACY_DEVICE_KEY,
} from "../games/BananaSurvivors/gpt6_astra/records.js";
const empty = () => {
  const s = createRun(13);
  s.spawnClock = 1e6;
  s.supplyClock = 1e6;
  s.encounter = ENCOUNTERS.length;
  s.weapons = {};
  return s;
};
const ticks = (s, n) => {
  for (let i = 0; i < n; i++) {
    if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
    update(s, 1 / 60);
  }
};

test("horde pressure grows from the start, continues during bosses, and ignores XP level", () => {
  const s = createRun(1);
  let prev = hordePressure(s);
  for (const time of [16, 32, 64, 100, 160, 300, 600]) {
    s.time = time;
    s.bossId = 999;
    s.level = 200;
    const p = hordePressure(s);
    assert.ok(
      p.interval <= prev.interval &&
        p.pack >= prev.pack &&
        p.health > prev.health &&
        p.damage > prev.damage,
    );
    assert.ok(p.pack <= 6 && p.interval >= 0.18);
    prev = p;
    s.level = 1;
    assert.deepEqual(hordePressure(s), p);
  }
});
test("new enemies unlock progressively, with no late specialists in early packs", () => {
  const s = createRun(11);
  for (const t of [0, 8, 20, 34, 58, 78, 100, 125]) {
    s.time = t;
    const seen = new Set(Array.from({ length: 2000 }, () => enemyForTime(s)));
    for (const e of ENCOUNTERS)
      assert.equal(seen.has(e.type), t >= e.at, `${e.type} at ${t}`);
  }
});
test("opening density grows sharply without exceeding the fixed enemy budget", () => {
  const s = createRun(81);
  s.weapons = {};
  s.player.invulnerable = 1e6;
  ticks(s, 600);
  assert.ok(s.enemies.length >= 15);
  const early = s.nextId;
  ticks(s, 1800);
  assert.ok(s.nextId > early + 70);
  assert.ok(s.enemies.length <= MAX_ENEMIES);
});
test("carvers flank on different sides instead of sharing a straight chase line", () => {
  const s = empty();
  s.player.invulnerable = 1e6;
  const a = spawnEnemy(s, "carver", { x: 260, y: 0 });
  a.born = 0;
  ticks(s, 30);
  assert.ok(Math.abs(a.y) > 15);
  assert.ok(a.x < 260);
});
test("bloat warns before bursting; killing it during the warning prevents its explosion", () => {
  const s = empty();
  const e = spawnEnemy(s, "bloat", { x: 120, y: 0 });
  e.born = 0;
  update(s, 1 / 60);
  assert.equal(e.action, "rupture");
  assert.ok(e.windup > 0.8);
  assert.equal(s.player.hp, 100);
  ticks(s, 54);
  assert.equal(s.kills, 1);
  assert.ok(s.player.hp < 100);
  ticks(s, 10);
  assert.equal(s.kills, 1);
  const safe = empty();
  const b = spawnEnemy(safe, "bloat", { x: 120, y: 0 });
  b.born = 0;
  update(safe, 1 / 60);
  safe.weapons = { lightning: 5 };
  b.hp = 1;
  ticks(safe, 70);
  assert.equal(safe.kills, 1);
  assert.equal(safe.player.hp, 100);
  assert.equal(safe.hazards.length, 0);
});
test("ribcannons telegraph and repeatedly fire bounded three-projectile fans", () => {
  const s = empty();
  s.player.invulnerable = 1e6;
  const e = spawnEnemy(s, "ribcannon", { x: 350, y: 0 });
  e.born = 0;
  e.attack = 0;
  update(s, 1 / 60);
  assert.equal(e.action, "bones");
  assert.equal(s.shots.length, 0);
  let volleys = 0;
  for (let i = 0; i < 700; i++) {
    update(s, 1 / 60);
    if (s.events.some((e) => e.type === "enemyVolley")) {
      volleys++;
      assert.equal(
        s.shots.filter((b) => b.kind === "bone" && b.age < 0.04).length,
        3,
      );
    }
    assert.ok(s.shots.length <= MAX_SHOTS);
  }
  assert.ok(volleys >= 3);
});
test("broodmothers hatch meatlings repeatedly but cannot create an unbounded swarm", () => {
  const s = empty();
  s.player.invulnerable = 1e6;
  for (let i = 0; i < 12; i++) {
    const e = spawnEnemy(s, "broodmother", {
      x: 350 + Math.cos(i) * 80,
      y: Math.sin(i) * 80,
    });
    e.born = 0;
    e.attack = 0;
  }
  ticks(s, 120);
  assert.ok(s.enemies.some((e) => e.type === "meatling"));
  ticks(s, 1200);
  assert.ok(s.enemies.filter((e) => e.type === "meatling").length <= 32);
  assert.ok(s.enemies.length <= MAX_ENEMIES);
});
test("late packs respect specialist limits even while replacing distant enemies", () => {
  const s = createRun(31);
  s.time = 300;
  s.player.invulnerable = 1e6;
  s.weapons = {};
  s.waveTime = -1000;
  s.encounter = ENCOUNTERS.length;
  ticks(s, 1800);
  for (const [type, cap] of Object.entries({
    broodmother: 4,
    ribcannon: 10,
    spitter: 12,
    bloat: 18,
  }))
    assert.ok(s.enemies.filter((e) => e.type === type).length <= cap);
  assert.ok(s.enemies.length <= MAX_ENEMIES);
});
test("numeric spatial grid preserves full combat queries and bounded separation queries", () => {
  const grid = new SpatialGrid();
  const mobs = Array.from({ length: 60 }, (_, id) => ({
    id,
    x: -1500 + id,
    y: 1490,
    dead: false,
  }));
  grid.rebuild(mobs);
  assert.equal(grid.query(-1470, 1490, 120).length, 60);
  assert.equal(grid.query(-1470, 1490, 120, 28).length, 28);
  assert.equal(grid.query(1470, -1490, 120).length, 0);
});
test("gore is stronger per kill while full and battery budgets remain fixed after landing", () => {
  const g = createGore(() => 0.5),
    p = { x: 0, y: 0 };
  g.emit({ type: "kill", x: 100, y: 0, size: 95 }, p);
  assert.ok(g.counts.blood >= 40);
  assert.equal(g.counts.chunks, 10);
  for (let i = 0; i < 500; i++) {
    g.emit({ type: "kill", x: i, y: 0, size: 160 }, p, { low: true });
    g.update(1 / 60);
  }
  for (let i = 0; i < 100; i++) g.update(1 / 60);
  assert.ok(
    g.counts.stains <= 60 && g.counts.chunks <= 24 && g.counts.blood <= 110,
  );
  assert.deepEqual(GORE_LIMITS, { blood: 280, chunks: 64, stains: 140 });
});
test("harder rules use separate local boards without deleting legacy history", () => {
  assert.equal(RULESET, 2);
  assert.notEqual(SESSION_KEY, LEGACY_SESSION_KEY);
  assert.notEqual(DEVICE_KEY, LEGACY_DEVICE_KEY);
  const record = {
    id: "old-run",
    playerName: "OldPeel",
    score: 500,
    kills: 20,
    wave: 1,
    bosses: 0,
    seconds: 30,
    level: 3,
    bestCombo: 10,
    round: 1,
    createdAt: 5,
    ruleset: 1,
    loadout: "classic",
  };
  assert.ok(validRecord(record));
  assert.ok(validRecord({ ...record, ruleset: 2 }));
  assert.ok(!validRecord({ ...record, ruleset: 3 }));
  const data = new Map([[LEGACY_DEVICE_KEY, JSON.stringify([record])]]);
  const storage = { getItem: (k) => data.get(k) };
  assert.equal(readRecords(storage, DEVICE_KEY).length, 0);
  assert.equal(
    readRecords(storage, LEGACY_DEVICE_KEY)[0].playerName,
    "OldPeel",
  );
});
