import { createBoard } from "../../../js/fable/kit.js?v=1";
import { RULESET, CARS, TRACKS } from "./sim.js?v=1";

export const SLUG = "leo_smash_race_claude_fable_5_2_v1";
// Racing names are built from two lists, so a child never types anything
// and nothing unkind can end up on the board.
export const NAME_A = ["Turbo", "Super", "Mega", "Rocket", "Dino", "Zippy", "Mighty", "Flash"];
export const NAME_B = ["Leo", "Racer", "Smasher", "Tiger", "Fox", "Bear", "Star", "Comet"];
export const validName = (name) => {
  if (typeof name !== "string") return false;
  const [a, b, ...rest] = name.split(" ");
  return rest.length === 0 && NAME_A.includes(a) && NAME_B.includes(b);
};
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const validRecord = (r) =>
  !!r &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 64 &&
  validName(r.playerName) &&
  int(r.score, 0, 250000) &&
  int(r.place, 1, 8) &&
  int(r.tenths, 300, 6000) &&
  int(r.smashed, 0, 400) &&
  CARS.some((c) => c.id === r.car) &&
  TRACKS.some((t) => t.id === r.track) &&
  typeof r.helper === "boolean" &&
  r.ruleset === RULESET;

export const compareRecords = (a, b) => b.score - a.score || a.tenths - b.tenths;

export function makeRecord(race, playerName, id) {
  return {
    id,
    playerName,
    score: race.score,
    place: race.place,
    tenths: Math.round(race.time * 10),
    smashed: race.smashed,
    car: race.car.id,
    track: race.track.id,
    helper: !!race.assist,
    ruleset: RULESET,
  };
}
export const board = createBoard({ slug: SLUG, game: "leo_smash_race", valid: validRecord, compare: compareRecords, keep: 10 });
