import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET, MAX_AGE } from "./life.js?v=1";
import { AMBITIONS } from "./story.js?v=1";

export const SLUG = "kenai_claude_fable_5_2_v1";
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  typeof r.playerName === "string" &&
  r.playerName.length > 0 &&
  r.playerName.length <= 16 &&
  int(r.score, 0, 2400) &&
  int(r.age, 1, MAX_AGE) &&
  AMBITIONS.some((a) => a.id === r.ambition) &&
  r.ruleset === RULESET;

export const compareRecords = (a, b) => b.score - a.score || b.age - a.age;

export function makeRecord(life, playerName, id) {
  return { id, playerName: playerName || "Anonymous", score: life.score, age: life.age, ambition: life.ambition.id, ruleset: RULESET };
}
export const board = createBoard({ slug: SLUG, game: "kenai", valid: validRecord, compare: compareRecords, keep: 10 });
