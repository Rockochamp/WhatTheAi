import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET, actsCleared } from "./engine.js?v=1";

export const SLUG = "crazy_clicker_claude_fable_5_2_v1";
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  typeof r.playerName === "string" &&
  r.playerName.length > 0 &&
  r.playerName.length <= 16 &&
  int(r.score, 2, 100000) &&
  int(r.bpm, 60, 200) &&
  r.acts === actsCleared(r.score) &&
  int(r.perfects, 0, r.score) &&
  Number.isFinite(r.meanAbsError) &&
  r.meanAbsError >= 0 &&
  r.meanAbsError <= 50 &&
  r.ruleset === RULESET;

/** Longer streak first; between equal streaks, the tighter one. */
export const compareRecords = (a, b) => b.score - a.score || a.meanAbsError - b.meanAbsError;

export function makeRecord(summary, playerName, id) {
  return {
    id,
    playerName: playerName || "Anonymous",
    score: summary.score,
    bpm: summary.bpm,
    acts: summary.acts,
    perfects: summary.perfects,
    meanAbsError: summary.meanAbsError,
    ruleset: RULESET,
  };
}

export const board = createBoard({ slug: SLUG, game: "crazy_clicker", valid: validRecord, compare: compareRecords, keep: 10 });
