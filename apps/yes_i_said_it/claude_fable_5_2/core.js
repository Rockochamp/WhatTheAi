// Yes! I Said It. — Claude Fable 5.2 edition. Pure logic, no DOM.
// The data contract is the board's existing one, so every edition reads and
// writes the same conversations: { text, parentId, upvotes, downvotes, score, timestamp }.

export const MAX_LENGTH = 420;
export const PAGE_SIZE = 40;
export const REPLY_LIMIT = 60;
export const VOTE_KEY = "yesisaidit_votes"; // shared with the other editions
export const HIDDEN_KEY = "yesisaidit_fable_hidden";
export const COOLDOWN_MS = 20000;

export const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);

export function validateText(value) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").normalize("NFC").trim();
  if (!text) throw new Error("Write something first.");
  if (Array.from(text).length > MAX_LENGTH) throw new Error(`Keep it to ${MAX_LENGTH} characters.`);
  return text;
}
const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
export function timestampMs(value) {
  try {
    const ms = typeof value?.toMillis === "function" ? value.toMillis() : typeof value?.seconds === "number" ? value.seconds * 1000 : typeof value === "number" ? value : 0;
    return Number.isFinite(ms) && ms >= 0 && ms <= 8.64e15 ? ms : 0;
  } catch {
    return 0;
  }
}
export function normalizePost(id, data = {}) {
  const upvotes = count(data.upvotes),
    downvotes = count(data.downvotes);
  return {
    id,
    text: typeof data.text === "string" ? data.text : "",
    parentId: validId(data.parentId) ? data.parentId : null,
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    timestamp: timestampMs(data.timestamp),
  };
}
/** New counts after a vote: the same button twice takes the vote back. */
export function voteChange(data, previous, requested) {
  if (requested !== "upvote" && requested !== "downvote") throw new Error("Unknown vote.");
  const next = previous === requested ? null : requested,
    upvotes = Math.max(0, count(data.upvotes) - (previous === "upvote") + (next === "upvote")),
    downvotes = Math.max(0, count(data.downvotes) - (previous === "downvote") + (next === "downvote"));
  return { next, upvotes, downvotes, score: upvotes - downvotes };
}

/** How the room splits on a statement. */
export function split(post) {
  const total = post.upvotes + post.downvotes;
  if (!total) return { total: 0, yes: 0, no: 0, verdict: "nobody has weighed in" };
  const yes = Math.round((post.upvotes / total) * 100);
  return {
    total,
    yes,
    no: 100 - yes,
    verdict: yes === 50 ? "split down the middle" : `${Math.max(yes, 100 - yes)}% say ${yes > 50 ? "yes" : "no"}`,
  };
}
/** Balanced and well-voted beats one-sided or unvoted. */
export function divisiveness(post) {
  const total = post.upvotes + post.downvotes;
  return total ? ((2 * Math.min(post.upvotes, post.downvotes)) / total) * Math.log2(total + 1) : 0;
}
export const MODES = ["latest", "yes", "no", "split"];
export function sortPosts(posts, mode = "latest") {
  const key = { latest: (p) => p.timestamp, yes: (p) => p.score, no: (p) => -p.score, split: divisiveness }[mode] ?? ((p) => p.timestamp);
  return [...posts].sort((a, b) => key(b) - key(a) || b.timestamp - a.timestamp || a.id.localeCompare(b.id));
}
/** Statements only (no replies), minus hidden ones, optionally filtered by a search term. */
export function statements(posts, { hidden = new Set(), search = "" } = {}) {
  const term = search.trim().toLocaleLowerCase();
  return posts.filter((p) => p.text && !p.parentId && !hidden.has(p.id) && (!term || p.text.toLocaleLowerCase().includes(term)));
}
/** The deck: statements you have not judged or passed on yet, newest first. */
export function deck(posts, { votes = {}, seen = new Set(), hidden = new Set() } = {}) {
  return sortPosts(statements(posts, { hidden }).filter((p) => !votes[p.id] && !seen.has(p.id)), "latest");
}
/** How often your vote matched the majority, over the statements loaded. */
export function roomRecord(posts, votes) {
  let voted = 0,
    withRoom = 0,
    decided = 0;
  for (const p of posts) {
    const v = votes[p.id];
    if (v !== "upvote" && v !== "downvote") continue;
    voted++;
    if (p.upvotes === p.downvotes) continue;
    decided++;
    if ((p.upvotes > p.downvotes) === (v === "upvote")) withRoom++;
  }
  return { voted, decided, withRoom };
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return "just now";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)} d ago`;
  const d = new Date(timestamp);
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: d.getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined });
}

/** Font size (in em of the sign's base) that lets a statement fill its sign. */
export function signScale(text) {
  const n = Array.from(text).length,
    longest = text.split(/\s+/).reduce((m, w) => Math.max(m, Array.from(w).length), 0);
  const byLength = n <= 24 ? 1 : n <= 60 ? 0.74 : n <= 120 ? 0.54 : n <= 220 ? 0.42 : n <= 320 ? 0.35 : 0.3;
  return Math.min(byLength, longest > 14 ? 13 / longest : 1);
}

/** True if a text contains a word from the site's shared blocklist as a whole word. */
export function strongLanguage(text, words = []) {
  const tokens = new Set(text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return words.some((w) => !w.includes(" ") && tokens.has(w));
}

export const SPARKS = [
  "The best part of a trip is planning it.",
  "Meetings should end the moment the agenda does.",
  "A game is better when you can finish it in an evening.",
  "Nobody has ever needed a sixth streaming service.",
  "Being bored is a skill worth practising.",
  "Cold pizza for breakfast is a real meal.",
];
