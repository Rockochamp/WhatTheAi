import test from 'node:test';
import assert from 'node:assert/strict';
import { Flight, PHASE_COOLDOWN } from '../games/cosmic_dodge/gpt6_astra/engine.js';
import { addRecord, readRecords, isLiveSite, saveGlobalRecord, fetchGlobalRecords } from '../games/cosmic_dodge/gpt6_astra/records.js';

function flight() { const f = new Flight({ seed: 53 }); f.start(); f.spawnIn = 1000; f.pickupIn = 1000; return f; }
function rock(f, x = f.player.x, y = f.player.y) { return { x, y, radius: 20, speed: 0, drift: 0, spin: 0, rotation: 0, shape: [], hit: false, passed: false }; }
function advance(f, seconds, input = {}) { for (let t = 0; t < seconds - 1e-8; t += 1 / 120) f.update(1 / 120, input); }
test('movement remains bounded on desktop and mobile', () => {
  for (const width of [480, 960]) { const f = new Flight({ width }); f.start(); advance(f, 2, { axis: -1 }); assert.equal(f.player.x, 22); advance(f, 3, { axis: 1 }); assert.equal(f.player.x, width - 22); }
});
test('movement and elapsed score are independent of update frequency', () => {
  const a = flight(), b = flight();
  for (let i = 0; i < 60; i++) a.update(1 / 60, { axis: 1 });
  for (let i = 0; i < 120; i++) b.update(1 / 120, { axis: 1 });
  assert.ok(Math.abs(a.player.x - b.player.x) < 1e-8); assert.ok(Math.abs(a.elapsed - b.elapsed) < 1e-8); assert.equal(a.score, b.score);
});
test('phase protects against impacts, then requires a full cooldown', () => {
  const f = flight(); assert.equal(f.phase(), true); assert.equal(f.phase(), false);
  f.asteroids.push(rock(f)); f.update(1 / 120); assert.equal(f.hp, 3);
  advance(f, PHASE_COOLDOWN + .02); assert.equal(f.phase(), true);
});
test('one asteroid cannot repeatedly damage the player', () => {
  const f = flight(); f.asteroids.push(rock(f)); advance(f, 2); assert.equal(f.hp, 2);
});
test('invulnerability prevents overlapping impacts from taking every hull segment', () => {
  const f = flight(); f.asteroids.push(rock(f), rock(f), rock(f)); f.update(1 / 120); assert.equal(f.hp, 2);
});
test('game over emits once and freezes the final score', () => {
  const f = flight(); f.hp = 1; f.asteroids.push(rock(f)); f.update(1 / 120);
  assert.equal(f.status, 'over'); const score = f.score;
  advance(f, 10); assert.equal(f.score, score); assert.equal(f.drainEvents().filter(e => e.type === 'over').length, 1); assert.equal(f.drainEvents().length, 0);
});
test('a close pass scores once and builds a capped multiplier', () => {
  const f = flight(); const r = rock(f, f.player.x + 48, f.player.y - 1); r.speed = 240; f.asteroids.push(r);
  f.update(1 / 120); assert.equal(f.nearMisses, 1); assert.equal(f.combo, 2); assert.equal(f.bonus, 120);
  advance(f, .2); assert.equal(f.nearMisses, 1);
  for (let i = 0; i < 8; i++) { const r2 = rock(f, f.player.x + 48, f.player.y - 1); r2.speed = 240; f.asteroids.push(r2); f.update(1 / 120); }
  assert.equal(f.combo, 5); advance(f, 5.1); assert.equal(f.combo, 1);
});
test('phasing does not farm close-call bonuses', () => {
  const f = flight(); f.phase(); const r = rock(f, f.player.x + 48, f.player.y - 1); r.speed = 240; f.asteroids.push(r); f.update(1 / 120); assert.equal(f.nearMisses, 0);
});
test('pickups award points and repair without exceeding full hull', () => {
  const f = flight(); const pickup = type => ({ x: f.player.x, y: f.player.y, radius: 10, speed: 0, type });
  f.pickups.push(pickup('star')); f.update(1 / 120); assert.equal(f.bonus, 50); assert.equal(f.starlight, 1);
  f.hp = 2; f.pickups.push(pickup('repair'), pickup('repair')); f.update(1 / 120); assert.equal(f.hp, 3); assert.equal(f.pickups.length, 0);
});
test('pause freezes movement, score, spawning and phase recharge', () => {
  const f = flight(); f.phase(); f.pause(); const before = JSON.stringify(f); advance(f, 3, { axis: 1 }); assert.equal(JSON.stringify(f), before); assert.equal(f.phase(), false); f.resume(); f.update(.02); assert.ok(f.elapsed > 0);
});
test('resizing keeps objects aligned and player in bounds', () => {
  const f = flight(); f.asteroids.push(rock(f)); f.resize(480, 720); assert.equal(f.player.x, 240); assert.equal(f.player.y, 648); assert.equal(f.asteroids[0].x, 240);
});
test('seeded runs replay deterministically', () => {
  const a = new Flight({ seed: 500 }), b = new Flight({ seed: 500 }); a.start(); b.start(); advance(a, 12); advance(b, 12); assert.equal(JSON.stringify(a), JSON.stringify(b), 'simulation state should match');
});
test('invalid timesteps do not corrupt state', () => { const f = flight(); f.update(NaN); f.update(-5); assert.equal(f.elapsed, 0); });
test('record storage sorts, deduplicates runs, and survives corruption', () => {
  let raw = null; const store = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const one = { id: 'one', playerName: '<script>pilot</script>', score: 500, elapsed: 5 };
  const two = { id: 'two', playerName: 'Astra', score: 900, elapsed: 9 };
  let result = addRecord([], one, store); result = addRecord(result.records, two, store); result = addRecord(result.records, two, store);
  assert.equal(result.records.length, 2); assert.equal(readRecords(store)[0].score, 900);
  raw = '{'; assert.deepEqual(readRecords(store), []); raw = '{}'; assert.deepEqual(readRecords(store), []);
});
test('blocked storage preserves a session record', () => {
  const blocked = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  assert.deepEqual(readRecords(blocked), []);
  const result = addRecord([], { id: 'one', playerName: 'Astra', score: 100, elapsed: 5 }, blocked);
  assert.equal(result.persisted, false); assert.equal(result.records.length, 1);
});
test('local test processes cannot access the production leaderboard', () => { assert.equal(isLiveSite(), false); });
test('global retries record a run and increment the counter only once (mock database)', async () => {
  const saved = new Map(); let counter = 0;
  const fakeDB = { collection(name) { return { doc(id) { return { name, id }; }, orderBy(field, direction) { assert.equal(field, 'score'); assert.equal(direction, 'desc'); return { limit() { return { get: async () => ({ docs: [...saved].map(([id,value]) => ({ id, data: () => value })) }) }; } }; } }; }, async runTransaction(callback) { await callback({ get: async ref => ({ exists: saved.has(ref.id) }), set(ref, data) { if (ref.name === 'globalStats') counter++; else saved.set(ref.id, data); } }); } };
  const firestore = () => fakeDB; firestore.FieldValue = { serverTimestamp: () => 'mock-time', increment: value => value };
  globalThis.location = { hostname: 'whatthe.ai' }; globalThis.window = { firebase: { apps: [{}], firestore } };
  try { const record = { id: 'same-run', playerName: 'Pilot', score: 700, elapsed: 35 }; await saveGlobalRecord(record); await saveGlobalRecord(record); assert.equal(counter, 1); assert.equal(saved.size, 1); assert.equal((await fetchGlobalRecords())[0].score, 700); }
  finally { delete globalThis.location; delete globalThis.window; }
});
