export const MAX_LENGTH = 420;
export const PAGE_SIZE = 40;
export const VOTE_KEY = 'yesisaidit_votes'; // Shared with the original Gemini board.
export const SPARKS = [
  'AI makes us more creative, not less.',
  'A four-day workweek would make us better at our jobs.',
  'The best games don’t need photorealistic graphics.',
  'Social media was better before every feed became an algorithm.',
  'Being bored is a skill we need to learn again.',
  'An unpopular opinion can still be a good one.'
];
export function validId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id); }
export function validateText(value) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if (!text) throw new Error('Give your thought a few words first.');
  if (Array.from(text).length > MAX_LENGTH) throw new Error(`Keep it to ${MAX_LENGTH} characters. A little goes a long way.`);
  return text;
}
export function numericCount(value) { return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
export function timestampMs(value) {
  try {
    const milliseconds = typeof value?.toMillis === 'function' ? value.toMillis() : typeof value?.seconds === 'number' ? value.seconds * 1000 : 0;
    return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 8640000000000000 ? milliseconds : 0;
  } catch { return 0; }
}
export function normalizePost(id, data) {
  const upvotes = numericCount(data.upvotes), downvotes = numericCount(data.downvotes);
  return { id, text: typeof data.text === 'string' ? data.text : '', parentId: validId(data.parentId) ? data.parentId : null, upvotes, downvotes, score: upvotes - downvotes, timestamp: timestampMs(data.timestamp) };
}
export function voteChange(data, previous, requested) {
  if (!['upvote', 'downvote'].includes(requested)) throw new Error('Unknown vote.');
  const next = previous === requested ? null : requested;
  const upvotes = Math.max(0, numericCount(data.upvotes) - Number(previous === 'upvote') + Number(next === 'upvote'));
  const downvotes = Math.max(0, numericCount(data.downvotes) - Number(previous === 'downvote') + Number(next === 'downvote'));
  return { next, upvotes, downvotes, score: upvotes - downvotes };
}
// A balanced, well-voted statement outranks a one-sided or zero-vote statement.
export function divisiveness(post) {
  const total = post.upvotes + post.downvotes;
  return total ? (2 * Math.min(post.upvotes, post.downvotes) / total) * Math.log2(total + 1) : 0;
}
export function visiblePosts(posts, mode, search, hidden) {
  const term = search.trim().toLocaleLowerCase();
  return posts.filter(p => p.text && !hidden.has(p.id) && (!term || p.text.toLocaleLowerCase().includes(term))).sort((a,b) => {
    const primary = mode === 'love' ? b.score - a.score : mode === 'hate' ? a.score - b.score : mode === 'debate' ? divisiveness(b) - divisiveness(a) : b.timestamp - a.timestamp;
    return primary || b.timestamp - a.timestamp || a.id.localeCompare(b.id);
  });
}
export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return 'just now';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(timestamp).toLocaleDateString('en', { month:'short', day:'numeric', ...(new Date(timestamp).getFullYear() !== new Date(now).getFullYear() ? {year:'numeric'} : {}) });
}
