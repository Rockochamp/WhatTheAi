export const SESSION_KEY = "hammurabi_astra_session_v1";
export function validRecord(r) {
  return (
    !!r &&
    typeof r.id === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(r.id) &&
    typeof r.playerName === "string" &&
    r.playerName.length > 0 &&
    r.playerName.length <= 10 &&
    Number.isInteger(r.finalYear) &&
    r.finalYear >= 1 &&
    r.finalYear <= 10 &&
    Number.isInteger(r.finalPawns) &&
    r.finalPawns >= 0 &&
    r.finalPawns <= 100 + 50 * r.finalYear &&
    Number.isInteger(r.round) &&
    r.round > 0 &&
    Number.isFinite(r.createdAt) &&
    r.ruleset === 1
  );
}
export function rankRecords(records, limit = 100) {
  return records
    .filter(validRecord)
    .slice()
    .sort(
      (a, b) =>
        b.finalPawns - a.finalPawns ||
        b.finalYear - a.finalYear ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
export function readSession(storage) {
  try {
    const records = JSON.parse(storage.getItem(SESSION_KEY) || "[]");
    return Array.isArray(records) ? rankRecords(records, Infinity) : [];
  } catch {
    return [];
  }
}
export function addSession(records, record, storage) {
  const ranked = rankRecords(
    [...records.filter((r) => r.id !== record.id), record],
    Infinity,
  );
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(ranked));
  } catch {
    /* A blocked store must never discard a finished round in memory. */
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
const COLLECTION = "leaderboard_steve_jobs_hammurabi_gpt6_astra_v1";
const STATS = "stats_steve_jobs_hammurabi_gpt6_astra_v1";
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
    const timer = setTimeout(
      () => reject(Error("Connection timed out")),
      10000,
    );
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
      db.collection(COLLECTION).orderBy("finalPawns", "desc").limit(100).get(),
      db.collection("globalStats").doc(STATS).get(),
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
  if (!validRecord(record)) throw Error("Invalid reign");
  const db = await database(),
    reference = db.collection(COLLECTION).doc(record.id),
    stats = db.collection("globalStats").doc(STATS);
  // One immutable run ID makes both the score and game count safe to retry.
  await bounded(
    db.runTransaction(async (transaction) => {
      if ((await transaction.get(reference)).exists) return;
      transaction.set(reference, {
        ...record,
        version: "gpt6_astra_v1",
        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(
        stats,
        {
          gameTitle: "steve_jobs_hammurabi",
          version: "gpt6_astra_v1",
          totalGamesPlayed: window.firebase.firestore.FieldValue.increment(1),
        },
        { merge: true },
      );
    }),
  );
}
