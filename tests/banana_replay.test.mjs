import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  update,
  spawnEnemy,
  runSummary,
  endRun,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
import {
  createHistory,
  createReplay,
  snapshot,
  REPLAY_FRAMES,
  DEATH_FREEZE,
} from "../games/BananaSurvivors/gpt6_astra/replay.js";
function empty() {
  const s = createRun(17);
  s.spawnClock = s.supplyClock = 1e6;
  s.weapons = {};
  s.player.hp = 5;
  s.player.invulnerable = 0;
  s.events = [];
  return s;
}
function shot(s, overrides = {}) {
  const b = {
    id: s.nextId++,
    kind: "bone",
    hostile: true,
    age: 0,
    life: 4,
    r: 8,
    x: -50,
    y: 0,
    vx: 3000,
    vy: 0,
    damage: 20,
    source: { name: "Ribcannon", attack: "Bone volley", enemyId: 123 },
    ...overrides,
  };
  s.shots.push(b);
  return b;
}
test("fatal contact identifies the actual enemy, damage after armor, and pre-hit health", () => {
  const s = empty();
  s.perks.shell = 2;
  const e = spawnEnemy(s, "hound", { x: 1, y: 0 });
  e.born = 0;
  e.damage = 20;
  e.charge = 0.3;
  e.ax = -1;
  e.ay = 0;
  update(s, 1 / 60);
  assert.equal(s.phase, "dead");
  assert.equal(s.deathCause.name, "Bloodhound");
  assert.equal(s.deathCause.attack, "Charge");
  assert.equal(s.deathCause.id, e.id);
  assert.equal(s.deathCause.damage, 15.2);
  assert.equal(s.deathCause.healthBefore, 5);
  assert.equal(s.events.filter((e) => e.type === "death").length, 1);
});
test("fatal projectile preserves its owner and stops later damage, kills and pickups", () => {
  const s = empty(),
    b = shot(s);
  const enemy = spawnEnemy(s, "meatball", { x: 100, y: 0 });
  enemy.born = 999;
  shot(s, {
    hostile: false,
    x: 100,
    vx: 0,
    damage: 999,
    weapon: "blaster",
    hitIds: new Set(),
    pierce: 1,
  });
  s.hazards.push({
    id: 900,
    x: 100,
    y: 0,
    age: 0,
    delay: 0,
    life: 5,
    r: 99,
    friendly: true,
    tick: 0,
    damage: 999,
    weapon: "coconut",
  });
  s.drops.push({ id: 901, kind: "heal", x: 0, y: 0, age: 0 });
  update(s, 1 / 60);
  assert.equal(s.phase, "dead");
  assert.equal(s.deathCause.kind, "shot");
  assert.equal(s.deathCause.name, "Ribcannon");
  assert.equal(s.deathCause.id, b.id);
  assert.equal(s.kills, 0);
  assert.equal(s.player.hp, 0);
  const result = runSummary(s),
    cause = { ...s.deathCause };
  for (let i = 0; i < 300; i++) update(s, 1 / 60, { dash: true, x: 1 });
  assert.deepEqual(runSummary(s), result);
  assert.deepEqual(s.deathCause, cause);
});
test("explosions retain attribution after the attacker is gone, and stop subsequent hazards", () => {
  const s = empty();
  s.hazards.push({
    id: 7,
    age: 0,
    delay: 0,
    life: 1,
    x: 0,
    y: 0,
    r: 108,
    damage: 30,
    friendly: false,
    source: { name: "Bloat", attack: "Rupture", enemyId: 99 },
  });
  s.hazards.push({
    id: 8,
    age: 0,
    delay: 0,
    life: 1,
    x: 0,
    y: 0,
    r: 50,
    damage: 100,
    friendly: false,
  });
  update(s, 1 / 60);
  assert.equal(s.deathCause.name, "Bloat");
  assert.equal(s.deathCause.attack, "Rupture");
  assert.equal(s.deathCause.kind, "hazard");
  assert.equal(s.hazards[1].triggered, undefined);
});
test("wards and dash grace produce no death cause; retirement does not invent one", () => {
  for (const defense of ["ward", "dash"]) {
    const s = empty();
    if (defense === "ward") s.ward = 5;
    else s.player.dash = 1;
    shot(s);
    update(s, 1 / 60);
    assert.equal(s.player.hp, 5);
    assert.equal(s.deathCause, undefined);
  }
  const s = empty();
  endRun(s);
  assert.equal(s.deathCause, undefined);
});
test("every ranged enemy stamps its real attacks with a durable source", () => {
  for (const [type, action, attack] of [
    ["spitter", "spit", "Acid spit"],
    ["ribcannon", "bones", "Bone volley"],
    ["boss", "fan", "Bone fan"],
    ["boss", "burst", "Spore ring"],
  ]) {
    const s = empty(),
      e = spawnEnemy(s, type, { x: 300, y: 0 });
    s.player.invulnerable = 99;
    e.born = 0;
    e.windup = 0.001;
    e.action = action;
    e.ax = -1;
    e.ay = 0;
    update(s, 1 / 60);
    const missiles = s.shots.filter((b) => b.hostile);
    assert.ok(missiles.length, type);
    assert.ok(
      missiles.every(
        (b) => b.source.enemyId === e.id && b.source.attack === attack,
      ),
    );
  }
});
test("history is bounded and detached from mutable game state, including effect points", () => {
  const s = empty(),
    h = createHistory(),
    points = [{ x: 0, y: 1 }];
  shot(s, { hitIds: new Set([1]), hitIdsBack: new Set([2]) });
  for (let i = 0; i < 1000; i++) {
    s.time = i / 60;
    s.player.x = i;
    s.events = [{ type: "lightning", points }];
    h.capture(s);
  }
  assert.ok(h.size <= REPLAY_FRAMES);
  s.phase = "dead";
  h.capture(s, true);
  const r = h.finish(s),
    finalX = s.player.x;
  s.player.x = -999;
  s.shots[0].x = -999;
  points[0].x = -999;
  let v = r.advance(0);
  assert.equal(v.state.player.x, finalX);
  assert.notEqual(v.state.shots[0].x, -999);
  assert.equal(v.state.shots[0].hitIds, undefined);
  for (let i = 0; i < 80; i++) {
    v = r.advance(0.1);
    for (const event of v.events) assert.notEqual(event.points?.[0]?.x, -999);
  }
  assert.equal(v.phase, "done");
  h.clear();
  assert.equal(h.size, 0);
});
test("replay freezes, interpolates at 0.3 speed, emits each impact once, then finishes", () => {
  const s = empty();
  s.time = 0;
  s.player.x = 0;
  const a = snapshot(s);
  s.time = 1.8;
  s.player.x = 180;
  s.player.hp = 0;
  const b = snapshot(s),
    frames = [
      { state: a, events: [] },
      { state: b, events: [{ type: "hurt", time: 1.8 }] },
    ];
  const r = createReplay(frames, { name: "Brute" });
  assert.equal(r.advance(0).phase, "freeze");
  for (let i = 0; i < DEATH_FREEZE * 10; i++) r.advance(0.1);
  let v = r.advance(0.1);
  assert.equal(v.phase, "replay");
  assert.ok(Math.abs(v.state.player.x - 3) < 0.0001);
  const frozen = r.advance(0);
  assert.equal(frozen.state.time, v.state.time);
  let hits = 0;
  for (let i = 0; i < 80; i++) {
    v = r.advance(0.1);
    hits += v.events.length;
  }
  assert.equal(hits, 1);
  assert.equal(v.phase, "done");
  assert.equal(v.state.player.hp, 0);
  assert.equal(a.player.x, 0);
});
test("very short runs and missing history finish without an invalid frame", () => {
  assert.equal(createReplay([], null), null);
  const s = empty(),
    h = createHistory();
  h.capture(s, true);
  const r = h.finish(s);
  let v;
  for (let i = 0; i < 20; i++) v = r.advance(0.1);
  assert.equal(v.phase, "done");
  assert.ok(Number.isFinite(v.progress));
});
