// Coordinates are board cells. Each chapter reworks the trail and its landmarks.
const chapters = [
  [
    'Lantern Wood',
    'First Spark',
    'Wake the forest lanterns',
    'lantern',
    '#fb9b39',
    '#30294f',
    '#da997a',
    '#528575',
    '#386655',
    '#224748',
    '#83aa70',
    '#ad9872',
  ],
  [
    'Whisper Valley',
    'Flame Spiral',
    'Set the wind wheels turning',
    'wind wheel',
    '#ffd16a',
    '#344568',
    '#f6bca0',
    '#66908b',
    '#4b8179',
    '#305866',
    '#b3ba86',
    '#c2ab87',
  ],
  [
    'Cinder Caverns',
    'Volcano Fire',
    'Melt the basalt seals',
    'basalt seal',
    '#ff7540',
    '#292139',
    '#e18059',
    '#835354',
    '#71474a',
    '#452f43',
    '#c57b57',
    '#aa735a',
  ],
  [
    'The Ember Bridge',
    'Leo Inferno',
    'Kindle the bridge beacons',
    'beacon',
    '#ffab49',
    '#44305c',
    '#e3a28e',
    '#71647c',
    '#645d70',
    '#463d59',
    '#ab9294',
    '#b19c85',
  ],
  [
    'Phoenix Garden',
    'Phoenix Fire',
    'Bring the fire lilies into bloom',
    'fire lily',
    '#ff8fa0',
    '#49365d',
    '#f7b69e',
    '#63947e',
    '#4b7869',
    '#365061',
    '#e69aab',
    '#c49c87',
  ],
  [
    'Drakeshell Isle',
    'Dragon Flame',
    'Warm the sleeping dragon eggs',
    'dragon egg',
    '#bbadff',
    '#3c3a60',
    '#ebbb9c',
    '#678d83',
    '#527968',
    '#344e55',
    '#a8b697',
    '#bcad8c',
  ],
  [
    'The Sun Temple',
    'Solar Fire',
    'Light the ancient sundials',
    'sundial',
    '#ffdf71',
    '#594166',
    '#ffbd84',
    '#b3976b',
    '#997b58',
    '#685352',
    '#e7bd7a',
    '#d4af7c',
  ],
  [
    'Starfall Hills',
    'Starfire',
    'Trace the lost constellations',
    'star chart',
    '#8bdffd',
    '#202544',
    '#a397bf',
    '#627a9a',
    '#506984',
    '#343d63',
    '#9cb4bb',
    '#978faa',
  ],
  [
    'The Galaxy Sea',
    'Galaxy Flame',
    'Align the orbit stones',
    'orbit stone',
    '#cb9dff',
    '#242142',
    '#b18db6',
    '#736c95',
    '#5a547e',
    '#383551',
    '#bda0cf',
    '#a294ad',
  ],
  [
    'The Everheart',
    'Eternal Flame',
    'Rekindle the twin fire hearts',
    'fire heart',
    '#ffd792',
    '#342547',
    '#efa98c',
    '#99767f',
    '#7e606f',
    '#514457',
    '#deac98',
    '#c7a692',
  ],
];

const trails = [
  ['....#.......', '.a.....s..p.', '...#..#..#..', '.s...m...a..', '...#...s....', '.l...m....m.'],
  ['..m...#...a.', '.s..#...s...', '..#...a.....', '.m..s...#..p', '....#..m....', '.l.......#..'],
  ['.p..#.....m.', '...s..a.#...', '.#..m.....s.', '....#...#...', '.a....s...m.', '...#.....l..'],
  ['.a...m....p.', '...#...#....', '.s...s....a.', '....#...#...', '..m...s...m.', '.l......#...'],
  ['.m....#..a..', '...#s.....p.', '.a....m.#...', '...#...s....', '.l...#....m.', '...s........'],
  ['...a..#....m', '.s.........p', '.#..m..#.s..', '.....#....a.', 'm..s....#...', '.l..........'],
  ['m...#..a...p', '..s...#..m..', '.#....s...#.', '...a...#....', '.s...m....l.', '....#.......'],
  ['.a..#.....m.', '...s...#..p.', '.m...s...#..', '....#..a....', '..#...m..s..', '.l..........'],
  ['.l...m.#..s.', '...#....a...', '.a...s...#..', '..#....m....', '.s...#....m.', '........p...'],
  ['.m...#....p.', '...a...s....', '.#...s...#..', '...m...a....', '.s..#.....m.', '.l.....#....'],
];
export const worlds = chapters.map(
  ([name, form, mission, relic, fire, sky, haze, ridge, turf, shade, leaf, trail], i) => {
    const layout = trails[i];
    return { name, form, mission, relic, fire, sky, haze, ridge, turf, shade, leaf, trail, layout };
  },
);
export const WIDTH = 12,
  HEIGHT = 6;
export const key = (x, y) => y * WIDTH + x;
export function readTrail(world) {
  const cells = { s: [], a: [], m: [], '#': [] };
  world.layout.forEach((row, y) =>
    [...row].forEach((mark, x) => {
      if (mark === 'p' || mark === 'l') cells[mark] = key(x, y);
      else if (cells[mark]) cells[mark].push(key(x, y));
    }),
  );
  return cells;
}
export function pathTo(from, to, walls) {
  if (from === to) return [];
  const queue = [from],
    previous = new Map([[from, null]]);
  for (const here of queue) {
    for (const next of [here - 1, here + 1, here - WIDTH, here + WIDTH]) {
      if (
        next < 0 ||
        next >= WIDTH * HEIGHT ||
        Math.abs((next % WIDTH) - (here % WIDTH)) > 1 ||
        walls.includes(next) ||
        previous.has(next)
      )
        continue;
      previous.set(next, here);
      if (next === to) {
        const path = [];
        for (let cell = to; cell !== from; cell = previous.get(cell)) path.unshift(cell);
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}
export const points = (moths, steps) => 500 + moths * 150 + Math.max(0, 100 - steps);
