import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  offerUpgrades,
  chooseUpgrade,
  PERKS,
  stats,
  bossHealth,
  hordePressure,
  MAX_ENEMIES,
  MAX_SHOTS,
  MAX_DROPS,
  RULESET,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
const idle = () => {
  const s = createRun(41);
  s.weapons = {};
  s.spawnClock = s.supplyClock = 1e6;
  s.encounter = 7;
  return s;
};
const tick = (s, n, input = {}) => {
  for (let i = 0; i < n; i++) {
    if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
    update(s, 1 / 60, input);
  }
};
const maxed = () => {
  const s = idle();
  s.weapons = { blaster: 5, boomerang: 5, coconut: 5, peels: 5 };
  for (const [id, p] of Object.entries(PERKS)) s.perks[id] = p.max;
  return s;
};
test("level 62 and much later builds always get three distinct permanent masteries", () => {
  const s = maxed();
  s.level = 62;
  for (let i = 0; i < 300; i++) {
    s.phase = "upgrade";
    s.pending = 1;
    const choices = offerUpgrades(s);
    assert.equal(choices.length, 3);
    assert.equal(new Set(s.choices).size, 3);
    assert.ok(
      choices.every(
        (c) =>
          c.kind === "ENDLESS MASTERY" && c.max === Infinity && c.description,
      ),
    );
    assert.ok(chooseUpgrade(s, s.choices[i % 3]));
  }
  assert.equal(
    Object.values(s.mastery).reduce((a, b) => a + b, 0),
    300,
  );
  assert.equal(
    Object.values(s.weapons).reduce((a, b) => a + b, 0),
    20,
  );
  assert.ok(stats(s).damage > 10);
  assert.ok(s.player.maxHp > 100);
});
test("mastery affects real damage and dash recovery instead of just its label", () => {
  const a = idle(),
    b = idle();
  for (const s of [a, b]) {
    s.weapons = { lightning: 5 };
    const e = spawnEnemy(s, "boss", { x: 200, y: 0 });
    e.born = 0;
    e.attack = 1e6;
    e.hp = e.maxHp = 1e7;
  }
  b.mastery = { force: 10, hunter: 10, resolve: 4 };
  update(a, 1 / 60);
  update(b, 1 / 60);
  assert.ok(b.stats.damage > a.stats.damage * 3.9);
  b.player.hp = 40;
  update(b, 1 / 60, { x: 1, dash: true });
  assert.equal(b.player.hp, 48);
});
test("a full hunt becomes a bounded showdown; time alone cannot advance a stage", () => {
  const s = idle();
  s.player.invulnerable = 1e6;
  s.waveTime = 49.99;
  for (let i = 0; i < MAX_ENEMIES; i++)
    spawnEnemy(s, "meatball", { x: 700, y: i });
  update(s, 1 / 60);
  assert.equal(s.enemies.length, 1);
  assert.ok(s.showdown);
  assert.equal(s.kills, 0);
  assert.equal(s.xp, 0);
  tick(s, 60 * 120);
  assert.equal(s.wave, 1);
  assert.ok(s.bossId);
  assert.ok(s.enemies.length <= 13);
  assert.equal(s.enemies.find((e) => e.id === s.bossId).enraged, true);
  assert.ok(s.showdown.radius < 560 && s.showdown.radius >= 350);
});
test("arena confinement works in every world corner and during repeated dashes", () => {
  for (const sign of [-1, 1]) {
    const s = idle();
    s.player.x = sign * 1450;
    s.player.y = sign * 1450;
    s.waveTime = 49.99;
    s.player.invulnerable = 1e6;
    update(s, 1 / 60);
    tick(s, 200, { x: sign, y: sign, dash: true });
    const c = s.showdown;
    assert.ok(
      Math.hypot(s.player.x - c.x, s.player.y - c.y) <=
        c.radius - s.player.r + 1e-7,
    );
    assert.ok(Math.abs(s.player.x) <= 1450 && Math.abs(s.player.y) <= 1450);
  }
});
test("every boss uses three distinct telegraphed abilities and repeats with recovery windows", () => {
  for (const stage of [1, 2, 3, 19, 20, 21]) {
    const s = idle();
    s.wave = stage;
    s.player.invulnerable = 1e6;
    const boss = spawnEnemy(s, "boss", { x: 250, y: 0 });
    boss.born = 0;
    boss.attack = 0;
    const seen = new Set();
    let exposed = 0;
    for (let i = 0; i < 2100; i++) {
      update(s, 1 / 60);
      for (const e of s.events)
        if (e.type === "bossAttack") {
          seen.add(e.action);
          assert.ok(boss.windup > 0.7);
        }
      if (boss.recovery > 0) exposed++;
    }
    assert.equal(seen.size, 3, `stage ${stage}`);
    assert.ok(exposed > 120);
    assert.ok(s.shots.length <= MAX_SHOTS);
  }
});
test("half-health enrage is one event, and pause freezes the fight and pickups", () => {
  const s = idle();
  s.player.invulnerable = 1e6;
  const boss = spawnEnemy(s, "boss", { x: 250, y: 0 });
  boss.born = 0;
  boss.hp = boss.maxHp * 0.49;
  update(s, 1 / 60);
  assert.equal(s.events.filter((e) => e.type === "enrage").length, 1);
  update(s, 1 / 60);
  assert.ok(!s.events.some((e) => e.type === "enrage"));
  s.ward = 16;
  s.frost = 7;
  s.phase = "paused";
  const data = JSON.stringify(s);
  tick(s, 120);
  assert.equal(JSON.stringify(s), data);
});
test("ward blocks exactly one hit; frost slows actual movement and expires", () => {
  const s = idle();
  s.drops.push({ id: 1, kind: "ward", x: 0, y: 0, age: 0 });
  update(s, 1 / 60);
  assert.equal(s.ward, 16);
  const e = spawnEnemy(s, "meatball", { x: 0, y: 0 });
  e.born = 0;
  update(s, 1 / 60);
  assert.equal(s.player.hp, 100);
  assert.equal(s.ward, 0);
  tick(s, 60);
  assert.ok(s.player.hp < 100);
  const a = idle(),
    b = idle();
  for (const state of [a, b]) {
    spawnEnemy(state, "meatball", { x: 300, y: 0 }).born = 0;
  }
  b.frost = 7;
  tick(a, 60);
  tick(b, 60);
  assert.ok(b.enemies[0].x > a.enemies[0].x + 20);
  tick(b, 361);
  assert.equal(b.frost, 0);
});
test("stage scaling keeps climbing beyond 20 without linking enemy strength to XP", () => {
  let previous = 0;
  for (const stage of [1, 5, 10, 20, 30, 60, 200]) {
    const s = idle();
    s.wave = stage;
    s.time = stage * 75;
    const p = hordePressure(s);
    assert.ok(p.health > previous);
    previous = p.health;
    assert.ok(Number.isFinite(bossHealth(stage)));
    assert.ok(p.pack <= 6 && p.speed <= 2.25);
    s.level = 10000;
    assert.deepEqual(hordePressure(s), p);
  }
  assert.ok(bossHealth(20) > bossHealth(10) * 4);
  assert.ok(bossHealth(30) > bossHealth(20) * 3);
});
test("late-stage full builds and boss abilities respect all performance budgets", () => {
  for (const stage of [10, 20, 30]) {
    const s = maxed();
    s.wave = stage;
    s.level = 80;
    s.time = stage * 75;
    s.mastery = { force: 15, hunter: 10, vigor: 10, resolve: 10 };
    s.waveTime = 49.99;
    s.player.invulnerable = 1e6;
    for (let i = 0; i < 3600; i++) {
      if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
      s.player.invulnerable = 1e6;
      update(s, 1 / 60, { x: Math.cos(i / 110), y: Math.sin(i / 110) });
      assert.ok(
        s.enemies.length <= MAX_ENEMIES &&
          s.shots.length <= MAX_SHOTS &&
          s.drops.length <= MAX_DROPS &&
          s.hazards.length <= 65,
      );
    }
  }
  assert.equal(RULESET, 3);
});
