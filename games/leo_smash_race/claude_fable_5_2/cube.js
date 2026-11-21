// The warm-up from Leo's design: a small colour cube. Solve it for a full
// boost at the start. Only the three faces you can see ever turn, so a
// short scramble is something a small child can undo.
const FACE = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1] };
export const COLORS = { "0,1,0": "#ffffff", "1,0,0": "#ff4d4d", "0,0,1": "#3ddc6a", "0,-1,0": "#ffd93b", "-1,0,0": "#ff9a3d", "0,0,-1": "#3d7bff" };

/** Stickers of a solved 2×2 cube: a position (±1 on each axis), a facing and a colour. */
export function solvedCube() {
  const out = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1])
    for (const n of [[x, 0, 0], [0, y, 0], [0, 0, z]]) out.push({ p: [x, y, z], n, c: COLORS[n.join(",")] });
  return out;
}
const spin = ([x, y, z], face) => (face === "U" ? [-z, y, x] : face === "R" ? [x, z, -y] : [y, -x, z]);
/** A quarter turn of one visible face. Four of them bring it back. */
export function turn(cube, face) {
  const axis = FACE[face].findIndex((v) => v);
  return cube.map((s) => (s.p[axis] === 1 ? { p: spin(s.p, face), n: spin(s.n, face), c: s.c } : s));
}
export function isSolved(cube) {
  const seen = {};
  for (const s of cube) {
    const k = s.n.join(",");
    if ((seen[k] ??= s.c) !== s.c) return false;
  }
  return true;
}
export function scramble(random, moves = 3) {
  let cube = solvedCube(),
    last = "";
  for (let i = 0; i < moves || isSolved(cube); i++) {
    const face = "URF".replace(last, "")[Math.floor(random() * 2)];
    cube = turn(turn(turn(cube, face), face), face); // a turn backwards, so one tap forwards undoes it
    last = face;
  }
  return cube;
}
const key = (cube) => [...cube].sort((a, b) => (a.p + a.n > b.p + b.n ? 1 : -1)).map((s) => s.c).join("");
/** Shortest list of faces to turn (each a quarter turn) that solves the cube, or null. */
export function solve(cube, depth = 9) {
  if (isSolved(cube)) return [];
  const seen = new Set([key(cube)]);
  let frontier = [[cube, []]];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const [c, path] of frontier)
      for (const face of "URF") {
        const t = turn(c, face),
          k = key(t);
        if (seen.has(k)) continue;
        if (isSolved(t)) return [...path, face];
        seen.add(k);
        next.push([t, [...path, face]]);
      }
    frontier = next;
  }
  return null;
}
/** The visible stickers of one face as a 2×2 grid of colours, row by row, for drawing. */
export function faceGrid(cube, face) {
  const n = FACE[face].join(","),
    [a, b] = face === "U" ? [0, 2] : face === "R" ? [2, 1] : [0, 1];
  const grid = [[null, null], [null, null]];
  for (const s of cube) if (s.n.join(",") === n) grid[(s.p[b] + 1) / 2][(s.p[a] + 1) / 2] = s.c;
  return grid;
}
