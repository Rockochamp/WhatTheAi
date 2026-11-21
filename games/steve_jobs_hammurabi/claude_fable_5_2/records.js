// Reign records: this device, all time, and today's shared fate.
import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET, RULES } from "./engine.js?v=1";

export const SLUG = "steve_jobs_hammurabi_claude_fable_5_2_v1";
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  typeof r.playerName === "string" &&
  r.playerName.length > 0 &&
  r.playerName.length <= 16 &&
  int(r.years, 1, RULES.years) &&
  int(r.score, 0, RULES.people + RULES.arrivalCap * r.years) &&
  r.finalPawns === r.score &&
  int(r.counsels, 0, 3) &&
  (r.mode === "free" || (r.mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(r.day))) &&
  r.ruleset === RULESET;

/** More people first; then fewer consultations of the scribe. */
export const compareRecords = (a, b) => b.score - a.score || a.counsels - b.counsels;

export function makeRecord({ state, counsels, mode, day }, playerName, id) {
  return {
    id,
    playerName: playerName || "Anonymous",
    score: state.people,
    finalPawns: state.people, // the field name the site's other Hammurabi boards use
    years: state.year,
    counsels,
    mode,
    day: mode === "daily" ? day : "",
    ruleset: RULESET,
  };
}

export const board = createBoard({
  slug: SLUG,
  game: "steve_jobs_hammurabi",
  valid: validRecord,
  compare: compareRecords,
  keep: 10,
});
