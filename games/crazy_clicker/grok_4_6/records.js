export const RECORD_KEY = "crazy_clicker_grok_4_6_v1";
export const SESSION_KEY = "crazy_clicker_grok_4_6_session_v1";
export const RULESET = 1;

export const validRecord = (r) =>
  r &&
  typeof r.id === "string" &&
  typeof r.playerName === "string" &&
  Number.isSafeInteger(r.score) &&
  r.score >= 0 &&
  r.score <= 100000000 &&
  r.ruleset === RULESET &&
  Number.isFinite(r.taktMs) &&
  r.taktMs >= 0;

export const rankRecords = (records, limit = 10) =>
  records
    .filter(validRecord)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.perfects || 0) - (a.perfects || 0) ||
        (a.taktMs || 0) - (b.taktMs || 0),
    )
    .slice(0, limit);

export function rankSessionRecords(records) {
  return rankRecords(
    records.filter((r) => Number.isSafeInteger(r?.round) && r.round > 0),
    Infinity,
  );
}

export function readSessionRecords(storage) {
  try {
    const value = JSON.parse(storage.getItem(SESSION_KEY) || "[]");
    return Array.isArray(value) ? rankSessionRecords(value) : [];
  } catch {
    return [];
  }
}

export function addSessionRecord(records, record, storage) {
  const ranked = rankSessionRecords([
    ...records.filter((r) => r.id !== record.id),
    record,
  ]);
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(ranked));
  } catch {
    /* Keep every completed round in memory when storage is blocked. */
  }
  return ranked;
}

export function readRecords(storage) {
  try {
    const value = JSON.parse(storage.getItem(RECORD_KEY) || "[]");
    return Array.isArray(value) ? rankRecords(value) : [];
  } catch {
    return [];
  }
}

export function addRecord(records, record, storage) {
  const ranked = rankRecords([
    ...records.filter((r) => r.id !== record.id),
    record,
  ]);
  try {
    storage.setItem(RECORD_KEY, JSON.stringify(ranked));
    return { records: ranked, persisted: true };
  } catch {
    return { records: ranked, persisted: false };
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
  authDomain: "cosmicdodge-5ae20.firebaseapp.com",
  projectId: "cosmicdodge-5ae20",
  storageBucket: "cosmicdodge-5ae20.appspot.com",
  messagingSenderId: "940230809594",
  appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643",
};
const COLLECTION = "leaderboard_crazy_clicker_grok_4_6_v1";
let databasePromise;
const scriptLoads = new Map();

function loadScript(src) {
  if (scriptLoads.has(src)) return scriptLoads.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error("Connection timed out"));
    }, 8000);
    script.src = src;
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("Connection unavailable"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptLoads.delete(src);
    throw error;
  });
  scriptLoads.set(src, promise);
  return promise;
}

export function isLiveSite() {
  return (
    typeof location !== "undefined" &&
    ["whatthe.ai", "www.whatthe.ai"].includes(location.hostname)
  );
}

async function database() {
  if (!isLiveSite()) throw new Error("preview");
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
      () => reject(new Error("Connection timed out")),
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
  const snapshot = await bounded(
    db.collection(COLLECTION).orderBy("score", "desc").limit(10).get(),
  );
  return rankRecords(
    snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
  );
}

export async function saveGlobalRecord(record) {
  if (!validRecord(record)) throw new Error("Invalid clicker record");
  const db = await database();
  const reference = db.collection(COLLECTION).doc(record.id);
  const stats = db
    .collection("globalStats")
    .doc("stats_crazy_clicker_grok_4_6_v1");
  await bounded(
    db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return;
      transaction.set(reference, {
        ...record,
        version: "grok_4_6",
        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(
        stats,
        {
          gameTitle: "crazy_clicker",
          version: "grok_4_6",
          totalGamesPlayed: window.firebase.firestore.FieldValue.increment(1),
        },
        { merge: true },
      );
    }),
  );
}
