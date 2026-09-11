// Presentation uses the resolved engine result. It never rolls random events,
// changes decisions, or writes scores; replay and skip cannot affect a reign.
export function yearSequence(before, plan, report, after) {
  let people = before.pawns;
  let food = before.food + report.trade - report.seed - report.feeding;
  const phases = [];
  const add = (kind, title, detail, duration, amount = 0) =>
    phases.push({
      kind,
      title,
      detail,
      duration,
      amount,
      people,
      food,
      land: after.land,
    });
  food += report.harvest;
  add(
    "harvest",
    report.harvest ? "The harvest comes home" : "The fields lie fallow",
    report.harvest
      ? `${report.harvest.toLocaleString()} bushels harvested · ${report.yield} per acre`
      : "No crops were planted this year.",
    1800,
    report.harvest,
  );
  if (report.starved) {
    people -= report.starved;
    add(
      "starvation",
      "Hunger takes its toll",
      `${report.starved} ${report.starved === 1 ? "person died" : "people died"} from sustained hunger.`,
      2400,
      report.starved,
    );
  }
  if (report.arrivals) {
    people += report.arrivals;
    add(
      "arrivals",
      "New families arrive",
      `${report.arrivals} ${report.arrivals === 1 ? "person joins" : "people join"} your kingdom.`,
      2800,
      report.arrivals,
    );
  }
  if (report.left) {
    people -= report.left;
    add(
      "emigration",
      "Some choose another life",
      `${report.left} ${report.left === 1 ? "person leaves" : "people leave"} in search of better conditions.`,
      2000,
      report.left,
    );
  }
  if (report.rats) {
    food -= report.rats;
    add(
      "rats",
      "Trouble in the granary",
      `Rats destroyed ${report.rats.toLocaleString()} bushels.`,
      1900,
      report.rats,
    );
  }
  if (report.bonus) {
    food += report.bonus;
    add(
      "bonus",
      "The river gives a little more",
      `Favorable weather adds ${report.bonus.toLocaleString()} bushels.`,
      1800,
      report.bonus,
    );
  }
  if (report.plague) {
    people -= report.plague;
    add(
      "plague",
      "Plague passes through the city",
      `${report.plague} ${report.plague === 1 ? "life was" : "lives were"} lost to disease.`,
      2400,
      report.plague,
    );
  }
  // Exact authoritative end values, including all round-off in the engine.
  phases.push({
    kind: "settled",
    title: after.pawns ? "Life goes on" : "The kingdom falls silent",
    detail: `Year ${after.year} · ${after.pawns} people remain`,
    duration: 700,
    amount: 0,
    people: after.pawns,
    food: after.food,
    land: after.land,
  });
  return phases;
}
export function seededRandom(seed = 407) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const MAX_PEOPLE = 600;
export const boundedPopulation = (value) =>
  Math.max(0, Math.min(MAX_PEOPLE, Math.floor(Number(value) || 0)));
export function cameraBounds(width, height, zoom = 1) {
  const aspect = Math.max(0.25, width / Math.max(1, height));
  const half = Math.max(14, 17 / aspect) / Math.max(0.85, Math.min(2.4, zoom));
  return {
    left: -half * aspect,
    right: half * aspect,
    top: half,
    bottom: -half,
  };
}
export function makeRoadGraph() {
  const xs = [-10, -5, 0, 5, 10],
    zs = [-8, -1, 5, 9];
  const nodes = zs.flatMap((z, row) =>
    xs.map((x, column) => ({ x, z, row, column, neighbors: [] })),
  );
  nodes.forEach((node, index) => {
    for (const offset of [-1, 1, -5, 5]) {
      const other = nodes[index + offset];
      if (!other) continue;
      if (Math.abs(offset) === 1 && other.row !== node.row) continue;
      // The sacred terrace occupies the center of the northern district.
      if (
        node.column === 2 &&
        other.column === 2 &&
        Math.min(node.row, other.row) === 0
      )
        continue;
      node.neighbors.push(index + offset);
    }
  });
  return nodes;
}
