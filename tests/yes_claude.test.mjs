import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_LENGTH, PAGE_SIZE, VOTE_KEY, validId, validateText, normalizePost, voteChange, split, divisiveness, sortPosts, statements, deck, roomRecord, relativeTime, signScale, strongLanguage, timestampMs,
} from "../apps/yes_i_said_it/claude_fable_5_2/core.js";
import { createLiveStore, createDemoStore, readVotes } from "../apps/yes_i_said_it/claude_fable_5_2/store.js";
import * as sol from "../apps/yes_i_said_it/gpt_6_1_sol_medium/core.js";

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data };
};
const post = (id, up, down, extra = {}) => normalizePost(id, { text: `statement ${id}`, upvotes: up, downvotes: down, timestamp: 1000, ...extra });

/** A tiny in-memory stand-in for the parts of Firestore the store uses. */
function fakeFirestore(seed = []) {
  const docs = new Map(seed.map((d) => [d.id, { ...d.data }]));
  let auto = 0,
    writes = 0;
  const snap = (rows) => ({ docs: rows.map(([id, data]) => ({ id, data: () => ({ ...data }), exists: true })), size: rows.length });
  const query = (filters = [], order = null, start = null, max = Infinity) => ({
    where: (f, op, v) => query([...filters, [f, v]], order, start, max),
    orderBy: (f, dir = "asc") => query(filters, [f, dir], start, max),
    startAfter: (doc) => query(filters, order, doc.id, max),
    limit: (n) => query(filters, order, start, n),
    async get() {
      let rows = [...docs].filter(([, d]) => filters.every(([f, v]) => d[f] === v));
      if (order) rows.sort(([, a], [, b]) => (order[1] === "desc" ? b[order[0]] - a[order[0]] : a[order[0]] - b[order[0]]));
      if (start) rows = rows.slice(rows.findIndex(([id]) => id === start) + 1);
      return snap(rows.slice(0, max));
    },
  });
  const ref = (id) => ({ id, get: async () => ({ id, exists: docs.has(id), data: () => ({ ...docs.get(id) }) }) });
  return {
    docs,
    get writes() {
      return writes;
    },
    collection: (name) => {
      assert.equal(name, "comments_yesisaidit");
      return { ...query(), doc: ref, add: async (data) => (docs.set(`new${++auto}`, { ...data }), writes++, { id: `new${auto}` }) };
    },
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        update: (r, change) => (docs.set(r.id, { ...docs.get(r.id), ...change }), writes++),
      });
    },
  };
}
const fieldValue = { serverTimestamp: () => 5000 };

test("text rules match the board's existing contract", () => {
  for (const sample of ["  hello  ", "a\r\nb", "é".repeat(MAX_LENGTH), "<img onerror=alert(1)>", " 😀 ".repeat(100)]) assert.equal(validateText(sample), sol.validateText(sample));
  assert.throws(() => validateText("  \n "));
  assert.throws(() => validateText("x".repeat(MAX_LENGTH + 1)));
  assert.throws(() => validateText("😀".repeat(MAX_LENGTH + 1)));
  assert.equal(MAX_LENGTH, sol.MAX_LENGTH);
  assert.equal(VOTE_KEY, sol.VOTE_KEY);
});

test("posts normalise exactly as the Sol edition normalises them", () => {
  for (const data of [{ text: "a", upvotes: 4, downvotes: 2, score: 999, parentId: "../bad", timestamp: { seconds: 100 } }, { text: 5, upvotes: -1, downvotes: 1.5 }, { text: "b", parentId: "ok_Id-1", timestamp: { toMillis: () => 77 } }, {}])
    assert.deepEqual(normalizePost("x", data), sol.normalizePost("x", data));
  assert.equal(timestampMs({ toMillis: () => { throw new Error("x"); } }), 0);
  assert.ok(validId("abc_DEF-123"));
  for (const bad of ["", "a/b", "../x", "a".repeat(129), 5, null]) assert.equal(validId(bad), false);
});

test("votes: new, take back, switch; matching the Sol edition", () => {
  for (const [data, prev, req] of [[{ upvotes: 4, downvotes: 2 }, null, "upvote"], [{ upvotes: 4, downvotes: 2 }, "upvote", "upvote"], [{ upvotes: 4, downvotes: 2 }, "upvote", "downvote"], [{ upvotes: 0, downvotes: 0 }, "upvote", "downvote"], [{}, null, "downvote"]])
    assert.deepEqual(voteChange(data, prev, req), sol.voteChange(data, prev, req));
  assert.throws(() => voteChange({}, null, "maybe"));
});

test("the split, the wall orders and the deck", () => {
  assert.deepEqual(split(post("a", 0, 0)), { total: 0, yes: 0, no: 0, verdict: "nobody has weighed in" });
  assert.equal(split(post("a", 3, 1)).yes, 75);
  assert.equal(split(post("a", 3, 1)).verdict, "75% say yes");
  assert.equal(split(post("a", 1, 3)).verdict, "75% say no");
  assert.equal(split(post("a", 2, 2)).verdict, "split down the middle");
  const a = post("a", 10, 10, { timestamp: 1 }),
    b = post("b", 100, 0, { timestamp: 2 }),
    c = post("c", 0, 30, { timestamp: 3 }),
    reply = post("r", 5, 0, { parentId: "a", timestamp: 4 });
  assert.equal(divisiveness(a), sol.divisiveness(a));
  assert.deepEqual(sortPosts([a, b, c], "latest").map((p) => p.id), ["c", "b", "a"]);
  assert.deepEqual(sortPosts([a, b, c], "yes").map((p) => p.id), ["b", "a", "c"]);
  assert.deepEqual(sortPosts([a, b, c], "no").map((p) => p.id), ["c", "a", "b"]);
  assert.equal(sortPosts([a, b, c], "split")[0].id, "a");
  assert.deepEqual(statements([a, b, c, reply]).map((p) => p.id), ["a", "b", "c"], "replies are not statements");
  assert.deepEqual(statements([a, b, c], { hidden: new Set(["b"]), search: "STATEMENT" }).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(deck([a, b, c, reply], { votes: { b: "upvote" }, seen: new Set(["c"]) }).map((p) => p.id), ["a"]);
  assert.deepEqual(deck([a, b, c]).map((p) => p.id), ["c", "b", "a"]);
});

test("the room record counts majority matches and ignores ties", () => {
  const list = [post("a", 9, 1), post("b", 1, 9), post("c", 5, 5), post("d", 7, 0)];
  assert.deepEqual(roomRecord(list, { a: "upvote", b: "upvote", c: "downvote" }), { voted: 3, decided: 2, withRoom: 1 });
  assert.deepEqual(roomRecord(list, {}), { voted: 0, decided: 0, withRoom: 0 });
  assert.deepEqual(roomRecord(list, { a: "bogus" }), { voted: 0, decided: 0, withRoom: 0 });
});

test("signs shrink for long statements and long words; time reads plainly", () => {
  assert.equal(signScale("Short."), 1);
  assert.ok(signScale("x ".repeat(100)) < signScale("x ".repeat(20)));
  assert.ok(signScale("Supercalifragilisticexpialidocious") < 0.5);
  const now = Date.UTC(2026, 10, 21, 12);
  assert.equal(relativeTime(0, now), "just now");
  assert.equal(relativeTime(now - 5 * 60000, now), "5 min ago");
  assert.equal(relativeTime(now - 3 * 3600000, now), "3 h ago");
  assert.equal(relativeTime(now - 4 * 86400000, now), "4 d ago");
  assert.match(relativeTime(Date.UTC(2024, 0, 5), now), /2024/);
});

test("strong language is matched on whole words only", () => {
  const words = ["ass", "hell", "f u c k"];
  assert.ok(strongLanguage("What the hell.", words));
  assert.ok(strongLanguage("HELL no", words));
  assert.ok(!strongLanguage("Hello, classy passengers of Seashell Road", words));
  assert.ok(!strongLanguage("anything", []));
});

test("live store: pages, replies, posting and voting use the shared collection", async () => {
  const seed = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({ id: `p${i}`, data: { text: `t${i}`, parentId: null, upvotes: i, downvotes: 0, score: i, timestamp: i } }));
  seed.push({ id: "r1", data: { text: "reply", parentId: "p3", upvotes: 0, downvotes: 0, score: 0, timestamp: 900 } });
  const db = fakeFirestore(seed),
    storage = memory(),
    store = createLiveStore(db, fieldValue, storage);
  const first = await store.page("yes");
  assert.equal(first.posts.length, PAGE_SIZE);
  assert.equal(first.posts[0].id, `p${PAGE_SIZE + 4}`);
  assert.ok(first.hasMore);
  const second = await store.page("yes", first.cursor);
  assert.equal(second.posts.length, 6);
  assert.equal(second.hasMore, false);
  assert.deepEqual((await store.replies("p3")).map((p) => p.id), ["r1"]);
  assert.deepEqual(await store.replies("../x"), []);
  assert.equal(await store.get("nope"), null);
  assert.equal((await store.get("p3")).text, "t3");

  const made = await store.post("  A new thought  ");
  assert.deepEqual(db.docs.get(made.id), { text: "A new thought", parentId: null, upvotes: 0, downvotes: 0, score: 0, timestamp: 5000 });
  await assert.rejects(() => store.post("x", "missing"), /no longer/);
  await assert.rejects(() => store.post("x", "../bad"));
  await assert.rejects(() => store.post("   "));
  const before = db.writes;
  await assert.rejects(() => store.post("y".repeat(MAX_LENGTH + 1)));
  assert.equal(db.writes, before, "rejected text writes nothing");

  let r = await store.vote("p3", "upvote");
  assert.deepEqual([r.next, r.post.upvotes, r.post.score], ["upvote", 4, 4]);
  assert.equal(readVotes(storage).p3, "upvote");
  r = await store.vote("p3", "downvote");
  assert.deepEqual([r.next, r.post.upvotes, r.post.downvotes, db.docs.get("p3").score], ["downvote", 3, 1, 2]);
  r = await store.vote("p3", "downvote");
  assert.equal(r.next, null);
  assert.equal(readVotes(storage).p3, undefined);
  assert.deepEqual([db.docs.get("p3").upvotes, db.docs.get("p3").downvotes], [3, 0]);
  await assert.rejects(() => store.vote("missing", "upvote"), /no longer/);
  await assert.rejects(() => store.vote("a/b", "upvote"));
});

test("live store ignores a second vote on the same statement while one is in flight", async () => {
  const db = fakeFirestore([{ id: "a", data: { text: "t", parentId: null, upvotes: 0, downvotes: 0, score: 0, timestamp: 1 } }]),
    store = createLiveStore(db, fieldValue, memory());
  const [one, two] = await Promise.all([store.vote("a", "upvote"), store.vote("a", "upvote")]);
  assert.ok(one && two === null);
  assert.equal(db.docs.get("a").upvotes, 1);
});

test("the sample room behaves like the board and never needs a network", async () => {
  const storage = memory(),
    store = createDemoStore(storage, () => 1e12);
  assert.equal(store.live, false);
  const page = await store.page("latest");
  assert.ok(page.posts.length >= 12 && !page.hasMore);
  const top = statements(page.posts)[0];
  const r = await store.vote(top.id, "upvote");
  assert.equal(r.post.upvotes, top.upvotes + 1);
  assert.equal(readVotes(storage)[top.id], "upvote");
  assert.equal((await store.vote(top.id, "upvote")).post.upvotes, top.upvotes);
  const mine = await store.post("Mine");
  assert.equal((await store.get(mine.id)).text, "Mine");
  const reply = await store.post("Indeed", mine.id);
  assert.deepEqual((await store.replies(mine.id)).map((p) => p.id), [reply.id]);
  await assert.rejects(() => store.post("x", "nope"));
  await assert.rejects(() => store.vote("nope", "upvote"));
  assert.ok((await store.replies("sample-1")).length >= 2);
});

test("blocked storage does not break voting", async () => {
  const blocked = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } },
    store = createDemoStore(blocked);
  const r = await store.vote("sample-2", "downvote");
  assert.equal(r.remembered, false);
  assert.equal(r.next, "downvote");
});

test("the page wires every control and renders user text as text", () => {
  const dir = new URL("../apps/yes_i_said_it/claude_fable_5_2/", import.meta.url),
    html = readFileSync(new URL("game.html", dir), "utf8"),
    js = readFileSync(new URL("app.js", dir), "utf8"),
    storeJs = readFileSync(new URL("store.js", dir), "utf8");
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    ids = new Set(all);
  assert.equal(ids.size, all.length, "duplicate ids");
  for (const [, used] of js.matchAll(/\$\("([^"`$]+)"\)/g)) assert.ok(ids.has(used), `missing #${used}`);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write/, "statements must never be parsed as markup");
  assert.match(storeJs, /whatthe\.ai/);
  assert.match(storeJs, /createDemoStore\(\)/, "previews use the sample room");
  assert.equal((html.match(/<h1/g) || []).length, 1);
});
