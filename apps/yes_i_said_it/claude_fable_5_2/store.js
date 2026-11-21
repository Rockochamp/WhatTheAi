// Two stores with one interface: the live public board on whatthe.ai, and
// an in-memory room of sample statements everywhere else, so previews and
// tests can never write to the real board.
import { PAGE_SIZE, REPLY_LIMIT, VOTE_KEY, normalizePost, validateText, validId, voteChange, sortPosts } from "./core.js?v=1";

export function readJson(key, fallback, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}
export function writeJson(key, value, storage = globalThis.localStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function readVotes(storage) {
  const v = readJson(VOTE_KEY, {}, storage);
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function rememberVote(id, vote, storage) {
  const votes = readVotes(storage);
  if (vote) votes[id] = vote;
  else delete votes[id];
  return writeJson(VOTE_KEY, votes, storage);
}

const ORDER = { latest: ["timestamp", "desc"], yes: ["score", "desc"], no: ["score", "asc"], split: ["timestamp", "desc"] };

/** The live board. `db` is a Firestore compat instance. */
export function createLiveStore(db, fieldValue, storage) {
  const col = db.collection("comments_yesisaidit"),
    busy = new Set(),
    list = (snap) => snap.docs.map((d) => normalizePost(d.id, d.data()));
  return {
    live: true,
    async page(mode = "latest", cursor = null) {
      let q = col.orderBy(...(ORDER[mode] ?? ORDER.latest));
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.limit(PAGE_SIZE).get();
      return { posts: list(snap), cursor: snap.docs.at(-1) ?? null, hasMore: snap.size === PAGE_SIZE };
    },
    async get(id) {
      if (!validId(id)) return null;
      const doc = await col.doc(id).get();
      return doc.exists ? normalizePost(doc.id, doc.data()) : null;
    },
    async replies(id) {
      if (!validId(id)) return [];
      // equality-only query: served by Firestore's automatic single-field index
      const snap = await col.where("parentId", "==", id).limit(REPLY_LIMIT).get();
      return list(snap).sort((a, b) => a.timestamp - b.timestamp);
    },
    async post(value, parentId = null) {
      if (globalThis.navigator?.onLine === false) throw new Error("You are offline. Your words are kept here until you reconnect.");
      const text = validateText(value);
      if (parentId !== null) {
        if (!validId(parentId)) throw new Error("That statement cannot be replied to.");
        if (!(await col.doc(parentId).get()).exists) throw new Error("That statement is no longer on the board.");
      }
      const ref = await col.add({ text, parentId, upvotes: 0, downvotes: 0, score: 0, timestamp: fieldValue.serverTimestamp() });
      return normalizePost(ref.id, { text, parentId, upvotes: 0, downvotes: 0, timestamp: Date.now() });
    },
    async vote(id, requested) {
      if (!validId(id)) throw new Error("That statement is unavailable.");
      if (busy.has(id)) return null;
      busy.add(id);
      try {
        const previous = readVotes(storage)[id] ?? null,
          ref = col.doc(id);
        const result = await db.runTransaction(async (tx) => {
          const doc = await tx.get(ref);
          if (!doc.exists) throw new Error("That statement is no longer on the board.");
          const change = voteChange(doc.data(), previous, requested);
          tx.update(ref, { upvotes: change.upvotes, downvotes: change.downvotes, score: change.score });
          return { post: normalizePost(id, { ...doc.data(), ...change }), next: change.next };
        });
        result.remembered = rememberVote(id, result.next, storage);
        return result;
      } finally {
        busy.delete(id);
      }
    },
  };
}

const SAMPLES = [
  ["Pineapple belongs on pizza.", 61, 58],
  ["The sequel is almost never better.", 44, 19],
  ["Remote work made us better at writing and worse at talking.", 37, 33],
  ["Every app should have an undo button for everything.", 92, 4],
  ["Breakfast is the least interesting meal.", 12, 71],
  ["A walk fixes more problems than a meeting.", 80, 9],
  ["Spoilers do not ruin a good story.", 28, 30],
  ["Board games are better with exactly four people.", 21, 17],
  ["Homework for small children should not exist.", 55, 22],
  ["Dark mode is easier on the eyes and harder to read.", 18, 24],
  ["The best feature a phone ever had was a battery that lasted a week.", 70, 6],
  ["If a recipe needs a story first, it should at least be a good story.", 33, 3],
];
/** An in-memory room with the same interface. Nothing leaves the page. */
export function createDemoStore(storage, now = () => Date.now()) {
  let n = 0;
  const posts = SAMPLES.map(([text, up, down], i) => normalizePost(`sample-${i + 1}`, { text, upvotes: up, downvotes: down, timestamp: now() - (i * 5 + 2) * 3600000 }));
  posts.push(normalizePost("sample-reply-1", { text: "Only if the pizza agrees.", parentId: "sample-1", upvotes: 9, downvotes: 1, timestamp: now() - 3000000 }));
  posts.push(normalizePost("sample-reply-2", { text: "Sweet and salty is the whole point.", parentId: "sample-1", upvotes: 14, downvotes: 6, timestamp: now() - 1000000 }));
  const find = (id) => posts.find((p) => p.id === id);
  return {
    live: false,
    async page(mode = "latest", cursor = null) {
      const all = sortPosts(posts, mode === "split" ? "latest" : mode),
        from = cursor ?? 0;
      return { posts: all.slice(from, from + PAGE_SIZE).map((p) => ({ ...p })), cursor: from + PAGE_SIZE, hasMore: from + PAGE_SIZE < all.length };
    },
    async get(id) {
      const p = find(id);
      return p ? { ...p } : null;
    },
    async replies(id) {
      return posts.filter((p) => p.parentId === id).sort((a, b) => a.timestamp - b.timestamp).map((p) => ({ ...p }));
    },
    async post(value, parentId = null) {
      const text = validateText(value);
      if (parentId !== null && !find(parentId)) throw new Error("That statement is no longer on the board.");
      const post = normalizePost(`mine-${++n}`, { text, parentId, upvotes: 0, downvotes: 0, timestamp: now() });
      posts.push(post);
      return { ...post };
    },
    async vote(id, requested) {
      const p = find(id);
      if (!p) throw new Error("That statement is no longer on the board.");
      const change = voteChange(p, readVotes(storage)[id] ?? null, requested);
      Object.assign(p, { upvotes: change.upvotes, downvotes: change.downvotes, score: change.score });
      return { post: { ...p }, next: change.next, remembered: rememberVote(id, change.next, storage) };
    },
  };
}

const SDK = "https://www.gstatic.com/firebasejs/9.22.2/";
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script"),
      timer = setTimeout(() => {
        el.remove();
        reject(new Error("The board took too long to connect."));
      }, 12000);
    el.src = src;
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      el.remove();
      reject(new Error("The board could not connect. Check your connection."));
    };
    document.head.append(el);
  });
}
let connecting;
/** The live board on whatthe.ai; the sample room anywhere else. */
export function connect() {
  connecting ??= (async () => {
    if (!["whatthe.ai", "www.whatthe.ai"].includes(location.hostname)) return createDemoStore();
    if (!window.firebase?.initializeApp) await loadScript(SDK + "firebase-app-compat.js");
    if (!window.firebase?.firestore) await loadScript(SDK + "firebase-firestore-compat.js");
    const app = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp({
          apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
          authDomain: "cosmicdodge-5ae20.firebaseapp.com",
          projectId: "cosmicdodge-5ae20",
          storageBucket: "cosmicdodge-5ae20.appspot.com",
          messagingSenderId: "940230809594",
          appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643",
        });
    return createLiveStore(app.firestore(), window.firebase.firestore.FieldValue);
  })().catch((error) => {
    connecting = null;
    throw error;
  });
  return connecting;
}
