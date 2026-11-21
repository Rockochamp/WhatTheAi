import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET } from "./engine.js?v=1";

export const SLUG = "banana_survivors_claude_fable_5_2_v1";
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  typeof r.playerName === "string" &&
  r.playerName.length > 0 &&
  r.playerName.length <= 16 &&
  int(r.score, 0, 99_999_999) &&
  int(r.kills, 0, 9_999_999) &&
  int(r.level, 1, 999) &&
  int(r.chain, 0, 99_999) &&
  Number.isFinite(r.elapsed) &&
  r.elapsed >= 0 &&
  r.elapsed < 36_000 &&
  r.score >= Math.floor(r.elapsed * 2) - 1 &&
  r.ruleset === RULESET;

export const compareRecords = (a, b) => b.score - a.score || b.elapsed - a.elapsed;

export function makeRecord(game, playerName, id) {
  return {
    id,
    playerName: playerName || "Anonymous",
    score: game.score,
    kills: game.kills,
    level: game.level,
    chain: game.bestChain,
    elapsed: Math.round(game.time * 10) / 10,
    ruleset: RULESET,
  };
}
export const board = createBoard({ slug: SLUG, game: "banana_survivors", valid: validRecord, compare: compareRecords, keep: 10 });
