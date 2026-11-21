import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.offensiveWords ??= [];
const dir = "../games/leo_fire_evolution/claude_fable_5_2/";
const { Visit, guide, buildWorld, maxScore, starsFor, PLACES, FORMS, POINTS, STEP, LEO_R, RULESET, SLEEPERS } = await import(dir + "world.js?v=1");
const { validRecord, makeRecord, compareRecords, validName, NAME_A, NAME_B, SLUG, MAX_TOTAL, board } = await import(dir + "records.js?v=1");

const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function walk(index, options, limit = 60 * 600) {
  const visit = new Visit(index),
    events = [];
  for (let i = 0; i < limit && visit.status !== "done"; i++) {
    visit.update(STEP, guide(visit, options));
    events.push(...visit.drainEvents());
  }
  return { visit, events };
}

test("ten places and ten forms, each form keeping what the last could do", () => {
  assert.equal(PLACES.length, 10);
  assert.equal(FORMS.length, 10);
  assert.equal(new Set(PLACES.map((p) => p.id)).size, 10);
  assert.equal(new Set(FORMS.map((f) => f.id)).size, 10);
  for (const x of [...PLACES, ...FORMS]) assert.ok(x.name.en && x.name.de);
  for (const f of FORMS) assert.ok(f.gift.en && f.gift.de && f.look.colors.length === 3);
  for (let i = 1; i < FORMS.length; i++) {
    const a = FORMS[i - 1],
      b = FORMS[i];
    assert.ok(b.speed >= a.speed && b.light >= a.light && b.pull >= a.pull && b.roar >= a.roar && b.touch >= a.touch && b.cooldown <= a.cooldown);
    assert.ok(b.swim || !a.swim);
    assert.ok(b.guard || !a.guard);
    assert.notDeepEqual([b.speed, b.light, b.pull, b.roar, b.touch, b.cooldown, b.swim, b.guard], [a.speed, a.light, a.pull, a.roar, a.touch, a.cooldown, a.swim, a.guard], `${b.id} adds something`);
  }
  assert.ok(!FORMS[3].swim && FORMS[4].swim && !FORMS[7].guard && FORMS[8].guard);
});

test("every place is laid out the same each time, with everything where a cub can reach it", () => {
  PLACES.forEach((spec, i) => {
    const w = buildWorld(i);
    assert.deepEqual(JSON.parse(JSON.stringify(w)), JSON.parse(JSON.stringify(buildWorld(i))));
    assert.equal(w.lanterns.length, spec.lanterns, spec.id);
    assert.equal(w.fireflies.length, spec.fireflies, spec.id);
    assert.equal(w.sleepers.length, 2);
    assert.equal(w.gusts.length, spec.gusts);
    for (const s of w.sleepers) assert.ok(SLEEPERS.includes(s.kind));
    for (const p of [...w.lanterns, ...w.fireflies, ...w.sleepers, w.start, w.gate]) {
      assert.ok(p.x >= LEO_R && p.x <= w.w - LEO_R && p.y >= LEO_R && p.y <= w.h - LEO_R, `${spec.id}: inside the place`);
      for (const o of w.solids) assert.ok(far(p, o) > o.r + LEO_R, `${spec.id}: not inside a rock or pond`);
    }
    for (const a of w.solids) for (const b of w.solids) if (a !== b) assert.ok(far(a, b) > a.r + b.r + LEO_R * 3, `${spec.id}: room to walk between obstacles`);
    for (const a of w.lanterns) for (const b of w.lanterns) if (a !== b) assert.ok(far(a, b) > 110, `${spec.id}: lanterns stand apart`);
    assert.equal(w.solids.length, w.rocks.length + (FORMS[i].swim ? 0 : w.ponds.length));
    for (const l of w.lanterns) assert.ok(l.note >= 40 && l.note <= 90 && l.beat >= 0 && l.beat < 16);
  });
});

test("a careful walk lights every place for close to the most it can score", () => {
  PLACES.forEach((spec, i) => {
    const { visit, events } = walk(i, { thorough: true });
    assert.equal(visit.status, "done", spec.id);
    assert.equal(visit.lit.size, spec.lanterns);
    assert.equal(visit.woken.size, 2);
    assert.ok(visit.score <= maxScore(visit.world), `${spec.id}: ${visit.score} <= ${maxScore(visit.world)}`);
    assert.ok(visit.score >= maxScore(visit.world) * 0.8, `${spec.id}: ${visit.score} of ${maxScore(visit.world)}`);
    assert.ok(visit.stars >= 2);
    assert.ok(visit.time < 240, `${spec.id} took ${visit.time}`);
    assert.equal(events.filter((e) => e.type === "light").length, spec.lanterns);
    assert.equal(events.filter((e) => e.type === "open").length, 1);
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).score, visit.score);
  });
});

test("a hurried walk still gets through, for fewer points and fewer stars", () => {
  PLACES.forEach((spec, i) => {
    const quick = walk(i, { thorough: false }).visit,
      full = walk(i, { thorough: true }).visit;
    assert.equal(quick.status, "done", spec.id);
    assert.ok(quick.score < full.score * 0.7, `${spec.id}: ${quick.score} vs ${full.score}`);
    assert.ok(quick.stars <= full.stars);
    assert.ok(quick.score >= spec.lanterns * POINTS.lantern + POINTS.gate);
  });
});

test("fireflies make a lantern worth more, and the stars follow the score", () => {
  const v = new Visit(0),
    lantern = v.world.lanterns[0];
  v.with.push(0, 1, 2);
  v.x = lantern.x;
  v.y = lantern.y + 10;
  v.update(STEP, {});
  const e = v.drainEvents().find((x) => x.type === "light");
  assert.equal(e.pts, POINTS.lantern + 3 * POINTS.perFirefly);
  const w = buildWorld(0);
  assert.equal(maxScore(w), w.fireflies.length * 10 + w.lanterns.length * (100 + 20 * w.fireflies.length) + 500 + 300);
  assert.equal(starsFor(maxScore(w), w), 3);
  assert.equal(starsFor(maxScore(w) * 0.6, w), 2);
  assert.equal(starsFor(0, w), 1);
});

test("a roar lights, gathers and wakes what is inside its ring, then needs a rest", () => {
  const v = new Visit(0),
    lantern = v.world.lanterns[0];
  v.x = lantern.x + v.form.roar - 30;
  v.y = lantern.y;
  v.update(STEP, {});
  assert.equal(v.lit.size, 0, "too far to touch");
  v.update(STEP, { roar: true });
  const events = v.drainEvents();
  assert.ok(events.some((e) => e.type === "roar" && e.r === v.form.roar));
  assert.ok(v.lit.has(lantern.id));
  assert.equal(v.roars, 1);
  assert.ok(v.roarWait > v.form.cooldown - 0.1);
  v.update(STEP, { roar: true });
  assert.equal(v.roars, 1, "no second roar straight away");
  for (let i = 0; i < 60 * v.form.cooldown + 2; i++) v.update(STEP, {});
  v.update(STEP, { roar: true });
  assert.equal(v.roars, 2);
});

test("wind sends half the fireflies home, a roar stills it, and the Galaxy Flame is safe from it", () => {
  const blow = (index, { roarFirst = false } = {}) => {
    const v = new Visit(index),
      g = v.world.gusts[0],
      at = v.gustAt(g, STEP * (roarFirst ? 2 : 1));
    v.with.push(...v.world.fireflies.slice(0, 6).map((f) => f.id));
    v.score = 60;
    v.x = at.x;
    v.y = at.y;
    if (roarFirst) v.update(STEP, { roar: true });
    v.update(STEP, {});
    return v;
  };
  const hit = blow(1);
  assert.ok(hit.with.length <= 6 && hit.with.length >= 3 && hit.away.size >= 3, "half went home");
  assert.ok(hit.drainEvents().some((e) => e.type === "scatter"));
  const lostThenBack = hit.away.size;
  for (let i = 0; i < 60 * 3; i++) hit.update(STEP, {});
  assert.equal(hit.away.size, 0, `${lostThenBack} fireflies can be gathered again`);
  const calmed = blow(1, { roarFirst: true });
  assert.ok(!calmed.drainEvents().some((e) => e.type === "scatter"));
  const guarded = blow(8);
  assert.ok(FORMS[8].guard);
  assert.ok(!guarded.drainEvents().some((e) => e.type === "scatter"));
});

test("water stops him until the Phoenix Fire, rocks always do, and odd input is harmless", () => {
  const v = new Visit(2),
    pond = v.world.ponds[0];
  v.x = pond.x - pond.r - LEO_R - 2;
  v.y = pond.y;
  for (let i = 0; i < 120; i++) v.update(STEP, { dx: 1, dy: 0 });
  assert.ok(far(v, pond) >= pond.r + LEO_R - 0.01, "walks round the lava, not through");
  const p = new Visit(4),
    lake = p.world.ponds[0];
  p.x = lake.x - lake.r - LEO_R - 2;
  p.y = lake.y;
  for (let i = 0; i < 60; i++) p.update(STEP, { dx: 1, dy: 0 });
  assert.ok(far(p, lake) < lake.r && p.overWater, "glides over the lake");
  const rock = p.world.rocks[0];
  p.x = rock.x - rock.r - LEO_R - 2;
  p.y = rock.y;
  for (let i = 0; i < 120; i++) p.update(STEP, { dx: 1, dy: 0 });
  assert.ok(far(p, rock) >= rock.r + LEO_R - 0.01);
  const odd = new Visit(99);
  assert.equal(odd.world.index, 0);
  for (const input of [undefined, null, { dx: NaN }, { dx: "x", dy: {} }, { dx: 1e9, dy: -1e9, roar: 1 }]) {
    for (let i = 0; i < 300; i++) odd.update(STEP, input ?? undefined);
    assert.ok(Number.isFinite(odd.x) && Number.isFinite(odd.y) && Number.isFinite(odd.score));
    assert.ok(odd.x >= LEO_R && odd.x <= odd.world.w - LEO_R && odd.y >= LEO_R && odd.y <= odd.world.h - LEO_R);
  }
  odd.update(-1, { dx: 1 });
  odd.update(NaN, { dx: 1 });
  const before = odd.time;
  odd.update(50, { dx: 1 });
  assert.ok(odd.time - before <= 0.051, "a long pause is not a long step");
});

test("nothing happens after the gate, and his flame always has somewhere to lean", () => {
  const v = new Visit(0);
  assert.ok(v.world.lanterns.includes(v.target()));
  const { visit } = walk(0, { thorough: true });
  assert.equal(visit.target(), null);
  const { score, x } = visit;
  for (let i = 0; i < 200; i++) visit.update(STEP, { dx: -1, roar: true });
  assert.deepEqual([visit.score, visit.x], [score, x]);
  assert.equal(visit.drainEvents().length, 0);
  const open = new Visit(0);
  for (const l of open.world.lanterns) open.lit.add(l.id);
  open.status = "open";
  assert.equal(open.target(), open.world.gate);
});

test("records: names from two lists, and no score higher than the places allow", () => {
  assert.equal(SLUG, "leo_fire_evolution_claude_fable_5_2_v1");
  assert.equal(board.collection, "leaderboard_" + SLUG);
  assert.equal(MAX_TOTAL.length, 11);
  assert.equal(MAX_TOTAL[1], maxScore(buildWorld(0)));
  for (const a of NAME_A) for (const b of NAME_B) assert.ok(validName(`${a} ${b}`) && `${a} ${b}`.length <= 16);
  for (const bad of ["", "Spark", "little spark", "Little  Spark", "Little Spark Cub", "<i>Little</i> Cub", null, 7]) assert.ok(!validName(bad), String(bad));
  const journey = { id: "j-1", next: 2, total: 4000, stars: [3, 2] },
    record = makeRecord(journey, "Brave Ember");
  assert.deepEqual(record, { id: "j-1", playerName: "Brave Ember", score: 4000, places: 2, stars: 5, ruleset: RULESET });
  assert.ok(validRecord(record));
  for (const change of [{ playerName: "Someone" }, { score: -1 }, { score: MAX_TOTAL[2] + 1 }, { score: 1.5 }, { places: 0 }, { places: 11 }, { stars: 1 }, { stars: 7 }, { ruleset: 2 }, { id: "" }])
    assert.ok(!validRecord({ ...record, ...change }), JSON.stringify(change));
  assert.ok(validRecord({ ...record, places: 10, stars: 30, score: MAX_TOTAL[10] }));
  assert.ok(compareRecords({ ...record, score: 5000 }, record) < 0);
  const memory = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); } };
  board.addLocal(record, memory);
  board.addLocal({ ...record, score: 4500, places: 3, stars: 7 }, memory);
  assert.deepEqual(board.readLocal(memory).map((r) => [r.id, r.score]), [["j-1", 4500]], "one row per journey, kept up to date");
});

test("the page: no remote code or fonts, nothing typed by players, both languages complete", () => {
  const read = (f) => readFileSync(new URL(dir + f, import.meta.url), "utf8");
  const html = read("game.html"),
    js = read("game.js"),
    css = read("game.css");
  assert.ok(!/<script[^>]+src="https?:|<link[^>]+rel="(stylesheet|preload)"[^>]+href="https?:/.test(html), "no code, styles or fonts from other sites");
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js + read("render.js")));
  assert.ok(!/<input|<textarea/.test(html), "nobody types anything");
  assert.ok(!/url\(["']?https?:/.test(css));
  assert.match(css, /prefers-reduced-motion/);
  for (const id of js.match(/\$\("([\w-]+)"\)/g).map((m) => m.slice(3, -2))) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
  const block = (lang) => js.slice(js.indexOf(`  ${lang}: {`), js.indexOf("\n  },", js.indexOf(`  ${lang}: {`)));
  const keys = (lang) => [...block(lang).matchAll(/^    (\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(keys("en"), keys("de"));
  assert.ok(keys("en").length > 40);
  for (const key of html.match(/data-t="(\w+)"/g).map((m) => m.slice(8, -1))) assert.ok(keys("en").includes(key), `text for ${key}`);
  for (const kind of SLEEPERS) assert.ok(block("en").includes(`${kind}:`) && block("de").includes(`${kind}:`));
  for (const f of ["world.js", "render.js", "records.js", "game.js"])
    for (const m of read(f).matchAll(/from "(\.[^"]+)"/g)) assert.ok(m[1].endsWith("?v=1"), `${f}: ${m[1]}`);
});
