// Run records: this device, all time, and today's shared seed.
import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET } from "./engine.js?v=1";

export const SLUG = "cosmic_dodge_claude_fable_5_2_v1";
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  typeof r.playerName === "string" &&
  r.playerName.length > 0 &&
  r.playerName.length <= 16 &&
  int(r.score, 0, 9_999_999) &&
  int(r.level, 1, 999) &&
  int(r.grazes, 0, 99_999) &&
  int(r.bestMultiplier, 1, 8) &&
  Number.isFinite(r.elapsed) &&
  r.elapsed >= 0 &&
  r.elapsed < 36_000 &&
  (r.mode === "endless" || (r.mode === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(r.day))) &&
  r.ruleset === RULESET;

export const compareRecords = (a, b) =>
  b.score - a.score || b.level - a.level || a.elapsed - b.elapsed;

export function makeRecord(run, playerName, id) {
  return {
    id,
    playerName: playerName || "Anonymous",
    score: run.score,
    level: run.level,
    grazes: run.grazes,
    bestMultiplier: run.bestMultiplier,
    elapsed: Math.round(run.time * 10) / 10,
    mode: run.mode,
    day: run.mode === "daily" ? run.day : "",
    ruleset: RULESET,
  };
}

export const board = createBoard({
  slug: SLUG,
  game: "cosmic_dodge",
  valid: validRecord,
  compare: compareRecords,
  keep: 10,
});
