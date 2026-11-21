// AGI Probability Barometer — Claude Fable 5.2 edition. Pure logic.
// The instrument reads one thing: how far each lab's count of open job
// listings sits below the highest count on record. It is not a probability.

export const TIMEOUT_MS = 12000;
export const CACHE_HOURS = 6;
export const KEEP_READINGS = 60;

/** The recorded counts this edition ships with: the sourced counts in the Grokbot Edition's listings.json. */
export const SNAPSHOT = {
  label: "10–11 October 2026",
  date: "2026-10-11",
  labs: [
    { id: "openai", name: "OpenAI", history: [452, 660, 712], recorded: 815, source: "https://api.ashbyhq.com/posting-api/job-board/openai", page: "https://openai.com/careers/search/", board: "ashby" },
    { id: "anthropic", name: "Anthropic", history: [309, 431, 374], recorded: 645, source: "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs", page: "https://www.anthropic.com/careers", board: "greenhouse" },
    { id: "deepmind", name: "Google DeepMind", history: [102, 92, 25], recorded: 94, source: "https://www.google.com/about/careers/applications/jobs/results?company=DeepMind", page: "https://www.google.com/about/careers/applications/jobs/results?company=DeepMind", board: null },
    { id: "xai", name: "xAI", history: [285, 247, 211], recorded: 305, source: "https://boards-api.greenhouse.io/v1/boards/xai/jobs", page: "https://x.ai/careers", board: "greenhouse" },
    { id: "meta", name: "Meta", history: [], recorded: 1135, source: "https://www.metacareers.com/jobs", page: "https://www.metacareers.com/jobs", board: null },
  ],
};

const count = (v) => (Number.isSafeInteger(v) && v >= 0 && v < 1e6 ? v : null);

/** Number of listings in a job-board API response, or null if it is not one. */
export function countListings(board, json) {
  if (!json || typeof json !== "object") return null;
  if (board === "greenhouse") return count(json.meta?.total) ?? (Array.isArray(json.jobs) ? count(json.jobs.length) : null);
  if (board === "ashby") return Array.isArray(json.jobs) ? count(json.jobs.filter((j) => j?.isListed !== false).length) : null;
  return null;
}

/** max(0, 1 − latest / peak): 0 at the peak, 1 with nothing listed. Null without data. */
export function dropIndex(latest, peak) {
  if (!Number.isFinite(latest) || !Number.isFinite(peak) || peak <= 0 || latest < 0) return null;
  return Math.max(0, Math.min(1, 1 - latest / peak));
}

/**
 * One row per lab from the snapshot, an optional live reading and the
 * reader's earlier readings. `live` and each earlier reading map lab id to a count.
 */
export function readLabs(snapshot = SNAPSHOT, live = {}, earlier = []) {
  return snapshot.labs.map((lab) => {
    const liveCount = count(live?.[lab.id]),
      latest = liveCount ?? lab.recorded,
      seen = [...lab.history, lab.recorded, ...earlier.map((r) => count(r?.counts?.[lab.id])).filter((v) => v !== null)];
    if (liveCount !== null) seen.push(liveCount);
    const peak = Math.max(...seen);
    return {
      id: lab.id,
      name: lab.name,
      page: lab.page,
      source: lab.source,
      canReadLive: !!lab.board,
      live: liveCount !== null,
      latest,
      peak,
      index: dropIndex(latest, peak),
      change: liveCount !== null ? liveCount - lab.recorded : 0,
      // unverified early values first, then the sourced record, then this visit
      trail: [...lab.history.map((v) => ({ v, kind: "old" })), { v: lab.recorded, kind: "recorded" }, ...(liveCount !== null ? [{ v: liveCount, kind: "live" }] : [])],
    };
  });
}

/** The whole instrument: summed latest against summed peaks. */
export function combined(rows) {
  const usable = rows.filter((r) => r.index !== null);
  if (!usable.length) return null;
  return dropIndex(usable.reduce((s, r) => s + r.latest, 0), usable.reduce((s, r) => s + r.peak, 0));
}

export const ZONES = [
  { to: 0.1, name: "Hiring spree", dial: "Spree", line: "The labs are advertising about as many jobs as they ever have." },
  { to: 0.3, name: "Still hiring", dial: "Hiring", line: "Fewer listings than at the peak, well within an ordinary slow quarter." },
  { to: 0.55, name: "Change", dial: "Change", line: "A real drop. Budgets, reorganisations and recruiting cycles all do this." },
  { to: 0.8, name: "Very quiet", dial: "Quiet", line: "Most of the listings are gone. Worth asking why." },
  { to: 1.01, name: "Nobody left to hire", dial: "Silent", line: "Almost nothing is advertised. The instrument cannot tell you the reason." },
];
export const zoneFor = (index) => ZONES.find((z) => index < z.to) ?? ZONES[ZONES.length - 1];

/** Needle rotation in degrees: −135 at 0%, 0 (straight up) at 50%, +135 at 100%. */
export const needleAngle = (index) => -135 + 270 * Math.max(0, Math.min(1, Number.isFinite(index) ? index : 0));

export function percent(index, digits = 1) {
  if (index === null || !Number.isFinite(index)) return "no reading";
  const v = index * 100;
  return `${v < 10 ? v.toFixed(digits) : Math.round(v)}%`;
}

/** Keeps a reader's own readings: newest last, one per hour at most, capped. */
export function addReading(list, reading) {
  const clean = (Array.isArray(list) ? list : []).filter((r) => r && Number.isFinite(r.t) && r.counts && typeof r.counts === "object");
  const last = clean[clean.length - 1];
  if (last && reading.t - last.t < 3600000) clean[clean.length - 1] = reading;
  else clean.push(reading);
  return clean.slice(-KEEP_READINGS);
}
export const isFresh = (reading, now) => !!reading && now - reading.t < CACHE_HOURS * 3600000 && now >= reading.t;

/** Points for a tiny trend line, scaled into a width × height box. */
export function sparkPoints(values, width = 120, height = 32, pad = 3) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return [];
  const lo = Math.min(...nums),
    hi = Math.max(...nums),
    span = hi - lo || 1;
  return nums.map((v, i) => [nums.length === 1 ? width / 2 : pad + (i / (nums.length - 1)) * (width - pad * 2), height - pad - ((v - lo) / span) * (height - pad * 2)]);
}
