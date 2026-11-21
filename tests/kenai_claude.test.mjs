import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Life, STATS, MAX_AGE, FULL_SPAN, BORN, mortality } from "../games/kenai/claude_fable_5_2/life.js";
import { STAGES, CARDS, EVENTS, AMBITIONS } from "../games/kenai/claude_fable_5_2/story.js";
import { validRecord, compareRecords, makeRecord, board } from "../games/kenai/claude_fable_5_2/records.js";

const live = (seed, policy = () => 0, ambition = "house") => {
  const life = new Life({ seed, ambition });
  for (let n = 0; life.phase !== "over" && n < 400; n++) assert.ok(life.pick(policy(life, n)));
  return life;
};
const value = (o, w) => Object.entries(o.fx ?? {}).reduce((s, [k, v]) => s + v * (w[k] ?? 1), 0);
const best = (w) => (l) => l.options.reduce((b, o, i) => (value(o, w(l)) > value(l.options[b], w(l)) ? i : b), 0);

test("the stages cover a whole life without gaps", () => {
  assert.equal(STAGES[0].from, 0);
  for (let i = 1; i < STAGES.length; i++) assert.equal(STAGES[i].from, STAGES[i - 1].to + 1);
  assert.equal(STAGES.at(-1).to, MAX_AGE);
  for (const s of STAGES) {
    assert.ok(CARDS[s.id].length >= 6, `${s.id} has enough choices`);
    assert.ok(EVENTS[s.id].length >= 2, `${s.id} has events`);
    assert.ok(s.era && s.note.endsWith("."));
  }
});

test("every card and event is well formed, and gated cards can be unlocked", () => {
  const sets = new Set(),
    titles = new Set();
  const check = (o, where) => {
    for (const [k, v] of Object.entries(o.fx)) assert.ok(STATS.includes(k) && Number.isInteger(v) && Math.abs(v) <= 20, `${where}: ${k} ${v}`);
    if (o.lean) assert.ok(Math.abs(o.lean) <= 10);
    if (o.set) sets.add(o.set);
    if (o.tag) assert.match(o.tag, /^[a-z'].*[^.]$/, `${where}: a tag is a lower-case clause without a full stop`);
  };
  for (const [stage, cards] of Object.entries(CARDS))
    for (const c of cards) {
      assert.ok(c.title && c.text.endsWith("."), c.title);
      assert.ok(!titles.has(c.title), `duplicate title ${c.title}`);
      titles.add(c.title);
      assert.ok(Object.keys(c.fx).length >= 1);
      check(c, `${stage}/${c.title}`);
    }
  for (const [stage, events] of Object.entries(EVENTS))
    for (const e of events) {
      assert.ok(e.title && /[.?!]['’]?$/.test(e.text) && e.options.length >= 2, e.title);
      for (const o of e.options) check(o, `${stage}/${e.title}/${o.label}`);
    }
  for (const cards of Object.values(CARDS)) for (const c of cards) if (c.needs) assert.ok(sets.has(c.needs), `${c.title} needs "${c.needs}", which nothing sets`);
  for (const stage of STAGES) assert.ok(CARDS[stage.id].filter((c) => !c.needs).length >= 3, `${stage.id} always has three ungated cards`);
});

test("a life is fully determined by its seed and picks", () => {
  const a = live(7, (l, n) => n % l.options.length),
    b = live(7, (l, n) => n % l.options.length);
  assert.deepEqual([a.age, a.score, a.tags, a.weave.length], [b.age, b.score, b.tags, b.weave.length]);
  assert.notEqual(live(8, (l, n) => n % l.options.length).log.length + live(8).score, a.log.length + a.score);
});

test("each turn offers three different, allowed cards", () => {
  const life = new Life({ seed: 3 });
  for (let n = 0; life.phase !== "over" && n < 300; n++) {
    if (life.phase === "choose") {
      assert.equal(life.offer.length, 3);
      assert.equal(new Set(life.offer.map((c) => c.title)).size, 3);
      for (const c of life.offer) {
        assert.ok(CARDS[life.stageInfo.id].some((x) => x.title === c.title), `${c.title} belongs to the stage`);
        if (c.needs) assert.ok(life.flags.has(c.needs));
        if (c.not) assert.ok(!life.flags.has(c.not));
      }
    } else assert.ok(life.event.options.length >= 2);
    life.pick(n % life.options.length);
  }
  assert.equal(life.phase, "over");
  assert.equal(life.pick(0), false);
  assert.equal(new Life({ seed: 1 }).pick(9), false);
});

test("the years pass, the stages change, and one column is woven per year", () => {
  const life = live(11);
  assert.equal(life.weave.length, life.age + 1);
  assert.deepEqual(life.weave.map((c) => c.age), Array.from({ length: life.age + 1 }, (_, i) => i));
  for (const col of life.weave) for (const k of STATS) assert.ok(col[k] >= 0 && col[k] <= 100);
  assert.equal(life.year, BORN + life.age);
  const eras = life.log.filter((e) => e.kind === "era").length;
  assert.equal(eras, life.stage + 1);
  assert.equal(life.log.at(-1).kind, "end");
  assert.ok(life.weave.some((c) => c.mark), "something was worth remembering");
  for (const stage of STAGES.slice(0, life.stage)) assert.ok(life.log.some((e) => e.kind === "event" && EVENTS[stage.id].some((x) => x.title === e.title)), `an event happened in ${stage.id}`);
});

test("everyone dies, nobody passes 104, and health decides how soon", () => {
  assert.equal(mortality(40), 0);
  assert.ok(mortality(90) > mortality(70) && mortality(70) > 0);
  const ages = (policy) => Array.from({ length: 120 }, (_, i) => live(i * 13 + 1, policy).age).sort((a, b) => a - b);
  const careless = ages((l) => l.options.reduce((b, o, i) => ((o.fx.h ?? 0) < (l.options[b].fx.h ?? 0) ? i : b), 0)),
    careful = ages(best(() => ({ h: 3 })));
  assert.ok(careful.at(-1) <= MAX_AGE);
  assert.ok(careful[60] >= careless[60] + 20, `careful ${careful[60]} vs careless ${careless[60]}`);
  assert.ok(careless[0] >= 25, "even a careless life is not over in childhood");
});

test("choices matter: a tended life outscores a random one, and a short life scores less", () => {
  const median = (policy) => Array.from({ length: 150 }, (_, i) => live(i * 7 + 1, policy).score).sort((a, b) => a - b)[75];
  const random = median((l) => Math.floor(l.random() * l.options.length)),
    tended = median(best((l) => ({ h: l.stats.h < 55 ? 3 : 1, b: l.stats.b < 60 ? 3 : 1.5, j: l.stats.j < 55 ? 2.5 : 1.5, c: 1, m: l.stats.m < 25 ? 3 : 0.5 }))),
    short = median((l) => l.options.reduce((b, o, i) => ((o.fx.h ?? 0) < (l.options[b].fx.h ?? 0) ? i : b), 0));
  assert.ok(tended > random + 150, `tended ${tended}, random ${random}`);
  assert.ok(random > short + 150, `random ${random}, short ${short}`);
  assert.equal(FULL_SPAN, 85);
});

test("what he wanted changes the score and the last lines", () => {
  for (const a of AMBITIONS) {
    const life = live(21, best(() => ({ b: 3, j: 2 })), a.id);
    assert.equal(life.ambition.id, a.id);
    const lines = life.epitaph();
    assert.equal(lines.length, 4);
    assert.match(lines[0], new RegExp(`^Ken\\.AI, ${BORN}–${life.year}\\.$`));
    assert.ok(lines[2].includes(a.line));
    for (const l of lines) assert.ok(l.endsWith("."), l);
    assert.ok(life.score > 0 && life.grade);
  }
  assert.equal(new Life({ ambition: "nonsense" }).ambition.id, AMBITIONS[0].id);
});

test("a life in progress can be saved and picked up again", () => {
  const life = new Life({ seed: 99, ambition: "craft" });
  for (let n = 0; n < 15; n++) life.pick(n % life.options.length);
  const again = Life.restore(JSON.parse(JSON.stringify(life.save())));
  assert.deepEqual([again.age, again.stats, again.phase, again.options.map((o) => o.title ?? o.label), again.tags], [life.age, life.stats, life.phase, life.options.map((o) => o.title ?? o.label), life.tags]);
  for (const bad of [null, {}, { v: 1, seed: 1.5, picks: [] }, { v: 1, seed: 1, picks: "x" }, { v: 2, seed: 1, picks: [] }, { v: 1, seed: 1, ambition: "house", picks: [7] }, { v: 1, seed: 1, picks: Array(500).fill(0) }])
    assert.equal(Life.restore(bad), null, JSON.stringify(bad)?.slice(0, 60));
});

test("records validate and rank", () => {
  const life = live(5),
    record = makeRecord(life, "", "r1");
  assert.ok(validRecord(record));
  for (const bad of [{ score: -1 }, { score: 9999 }, { age: 0 }, { age: 200 }, { ambition: "x" }, { ruleset: 9 }, { playerName: "" }])
    assert.equal(validRecord({ ...record, ...bad }), false, JSON.stringify(bad));
  assert.deepEqual([{ ...record, id: "a", score: 900 }, { ...record, id: "b", score: 1500 }].sort(compareRecords).map((r) => r.id), ["b", "a"]);
  assert.equal(board.collection, "leaderboard_kenai_claude_fable_5_2_v1");
});

test("the page wires every control and never parses story text as markup", () => {
  const dir = new URL("../games/kenai/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("game.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  assert.doesNotMatch(js, /innerHTML/);
  assert.match(html, /Speculative fiction, not a forecast/);
});
