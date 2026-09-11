export const RECORD_KEY = "cosmic_dodge_gpt6_astra_levels_v3";
export const validRecord = (r) =>
  r &&
  typeof r.id === "string" &&
  typeof r.playerName === "string" &&
  Number.isSafeInteger(r.score) &&
  r.score >= 0 &&
  r.score <= 100000000 &&
  Number.isFinite(r.elapsed) &&
  r.elapsed >= 0 &&
  r.ruleset === 3 &&
  Number.isSafeInteger(r.level) &&
  r.level === Math.floor(r.score / 10) + 1;
export const rankRecords = (records) =>
  records
    .filter(validRecord)
    .sort(
      (a, b) =>
        b.level - a.level ||
        b.score - a.score ||
        (b.style || 0) - (a.style || 0),
    )
    .slice(0, 10);
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

// Match the existing site's Firebase project; these are public web-client identifiers.
const firebaseConfig = {
  apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
  authDomain: "cosmicdodge-5ae20.firebaseapp.com",
  projectId: "cosmicdodge-5ae20",
  storageBucket: "cosmicdodge-5ae20.appspot.com",
  messagingSenderId: "940230809594",
  appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643",
};
const COLLECTION = "leaderboard_cosmic_dodge_gpt6_astra_levels_v3";
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
  if (!validRecord(record)) throw new Error("Invalid level record");
  const db = await database();
  const reference = db.collection(COLLECTION).doc(record.id);
  const stats = db
    .collection("globalStats")
    .doc("stats_cosmic_dodge_gpt6_astra_levels_v3");
  // A run ID makes retries idempotent, including the global game counter.
  await bounded(
    db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return;
      transaction.set(reference, {
        ...record,
        version: "gpt6_astra",
        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(
        stats,
        {
          gameTitle: "cosmic_dodge",
          version: "gpt6_astra",
          totalGamesPlayed: window.firebase.firestore.FieldValue.increment(1),
        },
        { merge: true },
      );
    }),
  );
}
