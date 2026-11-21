import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SNAPSHOT, ZONES, countListings, dropIndex, readLabs, combined, zoneFor, needleAngle, percent, addReading, isFresh, sparkPoints, KEEP_READINGS, CACHE_HOURS } from "../apps/agi_barometer/claude_fable_5_2/core.js";

test("the shipped counts are the sourced counts in the Grokbot Edition's data file", () => {
  const file = JSON.parse(readFileSync(new URL("../apps/agi_barometer/grokbot/data/listings.json", import.meta.url), "utf8"));
  assert.equal(SNAPSHOT.date, file.latest_date);
  assert.equal(SNAPSHOT.labs.length, file.labs.length);
  for (const lab of SNAPSHOT.labs) {
    const theirs = file.labs.find((l) => l.id === lab.id);
    assert.equal(lab.recorded, theirs.latest, lab.id);
    assert.equal(lab.source, theirs.source, lab.id);
    assert.deepEqual(lab.history, Object.values(theirs.history).filter((v) => v !== null), lab.id);
  }
});

test("the index is one minus latest over peak, clamped, and null without data", () => {
  assert.equal(dropIndex(100, 100), 0);
  assert.equal(dropIndex(50, 100), 0.5);
  assert.equal(dropIndex(0, 100), 1);
  assert.equal(dropIndex(120, 100), 0, "above the peak is still zero");
  for (const [l, p] of [[1, 0], [NaN, 5], [5, NaN], [-1, 5], [undefined, 5]]) assert.equal(dropIndex(l, p), null);
});

test("recorded reading: only DeepMind sits below its peak", () => {
  const rows = readLabs();
  assert.deepEqual(rows.map((r) => r.id), ["openai", "anthropic", "deepmind", "xai", "meta"]);
  assert.deepEqual(rows.map((r) => r.peak), [815, 645, 102, 305, 1135]);
  assert.ok(rows.every((r) => !r.live && r.change === 0));
  assert.equal(rows[2].index, 1 - 94 / 102);
  assert.ok(rows.filter((r) => r.index === 0).length === 4);
  const all = combined(rows);
  assert.equal(all, 1 - 2994 / 3002);
  assert.equal(percent(all), "0.3%");
  assert.equal(zoneFor(all).name, "Hiring spree");
  assert.deepEqual(rows.map((r) => r.canReadLive), [true, true, false, true, false]);
});

test("a live reading replaces the latest count and can raise the peak", () => {
  const rows = readLabs(SNAPSHOT, { openai: 700, anthropic: 900, deepmind: 1, bogus: 5 });
  const [openai, anthropic, deepmind] = rows;
  assert.deepEqual([openai.live, openai.latest, openai.peak, openai.change], [true, 700, 815, -115]);
  assert.deepEqual([anthropic.latest, anthropic.peak, anthropic.index], [900, 900, 0]);
  assert.equal(deepmind.latest, 1, "a count is taken as given for any known lab");
  assert.equal(openai.trail.at(-1).kind, "live");
  assert.equal(openai.trail.filter((t) => t.kind === "recorded").length, 1);
  for (const bad of [{ openai: -5 }, { openai: 1.5 }, { openai: "815" }, { openai: 1e9 }, null])
    assert.equal(readLabs(SNAPSHOT, bad)[0].live, false, JSON.stringify(bad));
});

test("earlier readings in this browser count toward the peak", () => {
  const rows = readLabs(SNAPSHOT, { xai: 200 }, [{ t: 1, counts: { xai: 400 } }, { t: 2, counts: { xai: "junk" } }, null]);
  assert.equal(rows[3].peak, 400);
  assert.equal(rows[3].index, 0.5);
});

test("job-board responses are counted defensively", () => {
  assert.equal(countListings("greenhouse", { jobs: [{}, {}], meta: { total: 2 } }), 2);
  assert.equal(countListings("greenhouse", { jobs: [{}, {}, {}] }), 3);
  assert.equal(countListings("greenhouse", { meta: { total: -1 }, jobs: "x" }), null);
  assert.equal(countListings("ashby", { jobs: [{ isListed: true }, { isListed: false }, {}] }), 2);
  assert.equal(countListings("ashby", { jobs: {} }), null);
  for (const junk of [null, "text", 5, [], { error: "nope" }]) {
    assert.equal(countListings("greenhouse", junk), null);
    assert.equal(countListings("ashby", junk), null);
  }
  assert.equal(countListings("unknown", { jobs: [] }), null);
});

test("the needle sweeps 270 degrees and every value lands in a zone", () => {
  assert.equal(needleAngle(0), -135);
  assert.equal(needleAngle(0.5), 0);
  assert.equal(needleAngle(1), 135);
  assert.equal(needleAngle(7), 135);
  assert.equal(needleAngle(-1), -135);
  assert.equal(needleAngle(NaN), -135);
  for (let i = 0; i <= 100; i++) {
    const z = zoneFor(i / 100);
    assert.ok(z && z.name && z.dial.length <= 6 && z.line.endsWith("."));
    if (i) assert.ok(needleAngle(i / 100) > needleAngle((i - 1) / 100));
  }
  assert.equal(zoneFor(0).name, ZONES[0].name);
  assert.equal(zoneFor(1).name, ZONES.at(-1).name);
  assert.deepEqual(ZONES.map((z) => z.to), [...ZONES.map((z) => z.to)].sort((a, b) => a - b));
});

test("percent reads plainly", () => {
  assert.equal(percent(null), "no reading");
  assert.equal(percent(0), "0.0%");
  assert.equal(percent(0.078), "7.8%");
  assert.equal(percent(0.213), "21%");
  assert.equal(percent(1), "100%");
});

test("your readings: one an hour at most, capped, and fresh for six hours", () => {
  let list = [];
  const hour = 3600000;
  list = addReading(list, { t: 10 * hour, counts: { openai: 1 } });
  list = addReading(list, { t: 10.5 * hour, counts: { openai: 2 } });
  assert.equal(list.length, 1);
  assert.equal(list[0].counts.openai, 2, "a second reading within the hour replaces the first");
  list = addReading(list, { t: 12 * hour, counts: { openai: 3 } });
  assert.equal(list.length, 2);
  for (let i = 0; i < KEEP_READINGS + 20; i++) list = addReading(list, { t: (20 + i * 2) * hour, counts: {} });
  assert.equal(list.length, KEEP_READINGS);
  assert.deepEqual(addReading("junk", { t: 1, counts: {} }), [{ t: 1, counts: {} }]);
  assert.equal(addReading([null, { t: "x" }, { t: 5 }], { t: 9e9, counts: {} }).length, 1);
  const now = 100 * hour;
  assert.ok(isFresh({ t: now - (CACHE_HOURS - 1) * hour }, now));
  assert.ok(!isFresh({ t: now - (CACHE_HOURS + 1) * hour }, now));
  assert.ok(!isFresh({ t: now + hour }, now), "a reading from the future is not trusted");
  assert.ok(!isFresh(undefined, now));
});

test("trend points stay inside their box", () => {
  for (const values of [[1], [5, 5, 5], [452, 660, 712, 815], [102, 92, 25, 94, 0]]) {
    const pts = sparkPoints(values, 120, 34, 5);
    assert.equal(pts.length, values.length);
    for (const [x, y] of pts) assert.ok(x >= 5 && x <= 115 && y >= 5 && y <= 29);
  }
  assert.deepEqual(sparkPoints([]), []);
});

test("the page says what the instrument is not, and wires every control", () => {
  const dir = new URL("../apps/agi_barometer/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("app.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used) || ["needle", "set-hand", "window"].includes(used), `missing #${used}`);
  assert.match(html, /not a probability of anything/);
  assert.match(html, /Listings are adverts, not hires/);
  assert.match(js, /credentials: "omit"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});
