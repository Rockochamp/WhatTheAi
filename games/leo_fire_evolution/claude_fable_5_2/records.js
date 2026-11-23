import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET, PLACES, buildWorld, maxScore } from "./world.js?v=1";

export const SLUG = "leo_fire_evolution_claude_fable_5_2_v1";
// Names are put together from two lists; nobody types anything.
export const NAME_A = ["Little", "Brave", "Bright", "Golden", "Wild", "Kind", "Swift", "Sunny"];
export const NAME_B = ["Spark", "Ember", "Cub", "Flame", "Lion", "Comet", "Lantern", "Star"];
export const validName = (name) => {
  if (typeof name !== "string") return false;
  const [a, b, ...rest] = name.split(" ");
  return rest.length === 0 && NAME_A.includes(a) && NAME_B.includes(b);
};
/** The most a journey can have scored after its first n places. */
export const MAX_TOTAL = PLACES.reduce((sums, _, i) => [...sums, sums[i] + maxScore(buildWorld(i))], [0]);
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  validName(r.playerName) &&
  int(r.places, 1, PLACES.length) &&
  int(r.score, 0, MAX_TOTAL[r.places]) &&
  int(r.stars, r.places, r.places * 3) &&
  (r.journey === undefined || (typeof r.journey === "string" && r.journey.length > 0 && r.journey.length <= 64)) &&
  r.ruleset === RULESET;

export const compareRecords = (a, b) => b.score - a.score || b.stars - a.stars;
export const makeRecord = (journey, playerName) => ({
  id: journey.id,
  playerName,
  score: journey.total,
  places: journey.next,
  stars: journey.stars.reduce((a, b) => a + b, 0),
  ruleset: RULESET,
});
/**
 * What goes to the shared board. A row there can be added but never changed, so
 * each place a journey lights adds a new row of its own, tied together by `journey`.
 */
export const sharedRecord = (journey, playerName) => ({ ...makeRecord(journey, playerName), id: `${journey.id}-p${journey.next}`, journey: journey.id });
/** Keeps only the furthest row of every journey. */
export function latestPerJourney(records) {
  const best = new Map();
  for (const r of records) {
    const key = r.journey ?? r.id,
      seen = best.get(key);
    if (!seen || r.places > seen.places || (r.places === seen.places && r.score > seen.score)) best.set(key, r);
  }
  return [...best.values()];
}
export const board = createBoard({ slug: SLUG, game: "leo_fire_evolution", valid: validRecord, compare: compareRecords, keep: 10 });
