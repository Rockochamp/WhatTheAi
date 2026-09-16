export const SESSION_KEY = "banana_survivors_grok_4_6_session_v3";
export const DEVICE_KEY = "banana_survivors_grok_4_6_device_v3";
export const RULESET = 2;
const COLLECTION = "leaderboard_banana_survivors_grok_4_6_v3";
const STATS_DOC = "stats_banana_survivors_grok_4_6_v3";

const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

export function validRecord(r) {
  return (
    !!r &&
    typeof r.id === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(r.id) &&
    typeof r.playerName === "string" &&
    r.playerName.length > 0 &&
    r.playerName.length <= 10 &&
    integer(r.score, 1e10) &&
    integer(r.kills, 1e7) &&
    integer(r.wave, 100000) &&
    r.wave > 0 &&
    integer(r.seconds, 86400) &&
    integer(r.level, 100000) &&
    r.level > 0 &&
    integer(r.round, 1e7) &&
    r.round > 0 &&
    Number.isFinite(r.createdAt) &&
    r.ruleset === RULESET &&
    ["crescent", "splitter", "ripe"].includes(r.loadout)
  );
}

export function rankRecords(records, limit = 100) {
  return records
    .filter(validRecord)
    .slice()
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.wave - a.wave ||
        b.kills - a.kills ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

export function readRecords(storage, key = SESSION_KEY) {
  try {
    const list = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(list)
      ? rankRecords(list, key === SESSION_KEY ? Infinity : 100)
      : [];
  } catch {
    return [];
  }
}

export function addRecord(records, record, storage, key = SESSION_KEY) {
  const ranked = rankRecords(
    [...records.filter((r) => r.id !== record.id), record],
    key === SESSION_KEY ? Infinity : 100,
  );
  try {
    storage.setItem(key, JSON.stringify(ranked));
  } catch {
    /* Keep the run in memory if storage is blocked. */
  }
  return ranked;
}

const firebaseConfig = {
  apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
  authDomain: "cosmicdodge-5ae20.firebaseapp.com",
  projectId: "cosmicdodge-5ae20",
  storageBucket: "cosmicdodge-5ae20.appspot.com",
  messagingSenderId: "940230809594",
  appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643",
};

export const isLiveSite = () =>
  typeof location !== "undefined" &&
  ["whatthe.ai", "www.whatthe.ai"].includes(location.hostname);

let databasePromise;
const scriptLoads = new Map();
function loadScript(src) {
  if (scriptLoads.has(src)) return scriptLoads.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      script.remove();
      reject(Error("Connection timed out"));
    }, 8000);
    script.src = src;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(Error("Connection unavailable"));
    };
    document.head.append(script);
  }).catch((error) => {
    scriptLoads.delete(src);
    throw error;
  });
  scriptLoads.set(src, promise);
  return promise;
}

async function database() {
  if (!isLiveSite()) throw Error("Local preview");
  if (!databasePromise)
    databasePromise = (async () => {
      if (!window.firebase)
        await loadScript(
          "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js",
        );
      if (!window.firebase.firestore)
        await loadScript(
          "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js",
        );
      if (!window.firebase.apps.length)
        window.firebase.initializeApp(firebaseConfig);
      return window.firebase.firestore();
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  return databasePromise;
}

function bounded(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Connection timed out")), 10000);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function fetchGlobalRecords() {
  const db = await database();
  const [snapshot, stats] = await bounded(
    Promise.all([
      db.collection(COLLECTION).orderBy("score", "desc").limit(100).get(),
      db.collection("globalStats").doc(STATS_DOC).get(),
    ]),
  );
  return {
    records: rankRecords(
      snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
    ),
    total: stats.exists
      ? Math.max(0, Number(stats.data().totalGamesPlayed) || 0)
      : 0,
  };
}

export async function saveGlobalRecord(record) {
  if (!validRecord(record)) throw Error("Invalid run");
  const db = await database(),
    reference = db.collection(COLLECTION).doc(record.id),
    stats = db.collection("globalStats").doc(STATS_DOC);
  await bounded(
    db.runTransaction(async (transaction) => {
      if ((await transaction.get(reference)).exists) return;
      transaction.set(reference, {
        ...record,
        version: "grok_4_6_v3",
        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(
        stats,
        {
          gameTitle: "banana_survivors",
          version: "grok_4_6_v3",
          totalGamesPlayed: window.firebase.firestore.FieldValue.increment(1),
        },
        { merge: true },
      );
    }),
  );
}
