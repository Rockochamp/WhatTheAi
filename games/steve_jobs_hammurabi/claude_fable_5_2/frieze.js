// The kingdom drawn as a three-band mosaic, after the inlaid panels of
// early Mesopotamia: people above, the granary between, the fields and the
// river below. Every figure, jar and plot stands for a counted amount.
const NS = "http://www.w3.org/2000/svg";
const W = 1200,
  BAND = 14,
  REG = 118,
  HEIGHT = BAND * 4 + REG * 3;

/** Smallest "nice" unit so that `value` fits in `slots` symbols. */
export function unitFor(value, slots, steps) {
  for (const s of steps) if (Math.ceil(value / s) <= slots) return s;
  return steps[steps.length - 1];
}
export const symbolsFor = (value, unit, slots) => Math.min(slots, Math.ceil(Math.max(0, value) / unit));

const SYMBOLS = `
<symbol id="fz-person" viewBox="0 0 22 52">
  <circle cx="11" cy="7" r="5.2" fill="var(--shell)"/>
  <path d="M5 14h12l1 12H4z" fill="var(--shell)"/>
  <path d="M4 26h14l3 19H1z" fill="var(--shell)"/>
  <path d="M2.5 37h17M1.8 41h18.4M1.2 45h19.6" stroke="var(--carnelian)" stroke-width="1.1" fill="none"/>
  <path d="M6 46h4v5H5zM12 46h4l1 5h-5z" fill="var(--shell)"/>
  <circle cx="13" cy="6.5" r="1" fill="var(--bitumen)"/>
</symbol>
<symbol id="fz-jar" viewBox="0 0 20 30">
  <path d="M6 1h8v4c5 3 6 8 6 12 0 7-4 12-10 12S0 24 0 17C0 13 1 8 6 5z" fill="var(--carnelian)"/>
  <path d="M1.2 12h17.6M.4 16h19.2" stroke="var(--shell)" stroke-width="1.3" fill="none"/>
  <rect x="5" y="0" width="10" height="2.4" fill="var(--gold)"/>
</symbol>
<symbol id="fz-plot" viewBox="0 0 34 24">
  <rect x=".5" y=".5" width="33" height="23" fill="var(--soil)" stroke="var(--lapis-deep)"/>
  <path d="M4 7h26M4 12h26M4 17h26" stroke="var(--furrow)" stroke-width="1.2"/>
</symbol>
<symbol id="fz-barley" viewBox="0 0 34 24">
  <path d="M7 23V8M17 23V5M27 23V8" stroke="var(--gold)" stroke-width="1.6"/>
  <path d="M7 12l-4-4M7 12l4-4M7 8l-3-4M7 8l3-4M17 9l-4-4M17 9l4-4M17 5l-3-4M17 5l3-4M27 12l-4-4M27 12l4-4M27 8l-3-4M27 8l3-4" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round"/>
</symbol>
<symbol id="fz-rat" viewBox="0 0 30 14">
  <path d="M6 12c-4 0-6-3-4-6s8-5 13-3c4 1 6-1 9 1 2 1 5 4 5 6l-4 2z" fill="var(--bitumen)"/>
  <path d="M2 9C-2 6-1 2 2 1" stroke="var(--bitumen)" stroke-width="1.3" fill="none"/>
</symbol>
<pattern id="fz-tess" width="24" height="24" patternUnits="userSpaceOnUse">
  <rect width="24" height="24" fill="var(--lapis)"/>
  <rect x="0" y="0" width="11" height="11" fill="#fff" opacity=".035"/>
  <rect x="12" y="12" width="11" height="11" fill="#000" opacity=".07"/>
  <rect x="12" y="0" width="11" height="11" fill="#fff" opacity=".015"/>
  <path d="M0 11.5h24M0 23.5h24M11.5 0v24M23.5 0v24" stroke="#000" stroke-opacity=".16"/>
</pattern>
<pattern id="fz-band" width="28" height="${BAND}" patternUnits="userSpaceOnUse">
  <rect width="28" height="${BAND}" fill="var(--shell)"/>
  <path d="M0 ${BAND / 2}L7 0h14l7 ${BAND / 2}-7 ${BAND / 2}H7z" fill="var(--carnelian)"/>
  <path d="M14 ${BAND / 2 - 3.5}l3.5 3.5-3.5 3.5-3.5-3.5z" fill="var(--lapis-deep)"/>
</pattern>`;

export class Frieze {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute("viewBox", `0 0 ${W} ${HEIGHT}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMid slice");
    const y1 = BAND,
      y2 = BAND * 2 + REG,
      y3 = BAND * 3 + REG * 2;
    svg.innerHTML = `<defs>${SYMBOLS}</defs>
      <rect width="${W}" height="${HEIGHT}" fill="var(--bitumen)"/>
      ${[y1, y2, y3].map((y) => `<rect x="0" y="${y}" width="${W}" height="${REG}" fill="url(#fz-tess)"/>`).join("")}
      ${[0, y2 - BAND, y3 - BAND, HEIGHT - BAND].map((y) => `<rect x="0" y="${y}" width="${W}" height="${BAND}" fill="url(#fz-band)"/>`).join("")}
      <g class="fz-city" transform="translate(40 ${y1})">
        <path d="M0 ${REG}V86h18V64h18V42h18V22h44v20h18v22h18v22h18v${REG - 86}z" fill="var(--shell)"/>
        <path d="M18 86h116M36 64h80M54 42h44" stroke="var(--carnelian)" stroke-width="3"/>
        <rect x="68" y="${REG - 26}" width="16" height="26" fill="var(--lapis-deep)"/>
        <path d="M76 22V6l14 5-14 5" fill="var(--gold)" stroke="var(--gold)" stroke-width="2"/>
      </g>
      <g id="fz-people"></g>
      <g id="fz-jars"></g>
      <g id="fz-plots"></g>
      <g class="fz-river" transform="translate(0 ${y3 + REG - 24})">
        <rect width="${W}" height="24" fill="var(--lapis-deep)"/>
        <path class="fz-wave" d="${Array.from({ length: 26 }, (_, i) => `M${i * 48} 9q12-8 24 0t24 0`).join("")}" fill="none" stroke="var(--shell)" stroke-opacity=".5" stroke-width="2"/>
        <path class="fz-wave late" d="${Array.from({ length: 26 }, (_, i) => `M${i * 48 - 20} 18q12-7 24 0t24 0`).join("")}" fill="none" stroke="var(--shell)" stroke-opacity=".3" stroke-width="2"/>
      </g>
      <g id="fz-rats" transform="translate(0 ${y2 + REG - 16})"></g>
      <g class="fz-keys" font-size="15" fill="var(--shell)" text-anchor="end">
        <text id="fz-key-people" x="${W - 16}" y="${y1 + 22}"></text>
        <text id="fz-key-jars" x="${W - 16}" y="${y2 + 22}"></text>
        <text id="fz-key-plots" x="${W - 16}" y="${y3 + 22}"></text>
      </g>`;
    const make = (group, id, cols, rows, x0, y0, dx, dy, w, h, extra = "") => {
      const g = svg.querySelector(group),
        nodes = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const el = document.createElementNS(NS, "g");
          el.setAttribute("class", "fz-unit");
          el.setAttribute("transform", `translate(${x0 + c * dx + (r % 2) * (dx / 2)} ${y0 + r * dy})`);
          el.innerHTML = `<use href="#${id}" width="${w}" height="${h}"/>${extra}`;
          g.append(el);
          nodes.push(el);
        }
      return nodes;
    };
    // filled back row first, so a small kingdom still reads as a crowd
    this.people = make("#fz-people", "fz-person", 34, 2, 214, y1 + 12, 23.6, 52, 22, 52);
    this.jars = make("#fz-jars", "fz-jar", 38, 2, 40, y2 + 26, 25, 40, 20, 30);
    this.plots = make("#fz-plots", "fz-plot", 26, 3, 34, y3 + 10, 36, 27, 34, 24, `<use class="fz-crop" href="#fz-barley" width="34" height="24"/>`);
    for (let i = 0; i < 3; i++) {
      const rat = document.createElementNS(NS, "use");
      rat.setAttribute("href", "#fz-rat");
      rat.setAttribute("width", "30");
      rat.setAttribute("height", "14");
      rat.setAttribute("class", "fz-rat");
      rat.style.animationDelay = `${i * 0.25}s`;
      svg.querySelector("#fz-rats").append(rat);
    }
  }
  /** Shows a kingdom. `planted` and `food` may be a plan's preview values. */
  show({ people, food, land, planted = 0 }) {
    const set = (nodes, count, key, unit, noun) => {
      nodes.forEach((n, i) => n.classList.toggle("on", i < count));
      this.svg.querySelector(key).textContent = unit === 1 ? "" : `one ${noun[0]} = ${unit.toLocaleString("en-US")} ${noun[1]}`;
    };
    const pu = unitFor(people, this.people.length, [1, 2, 5, 10, 25, 50]),
      ju = unitFor(food, this.jars.length, [50, 100, 250, 500, 1000, 2500, 10000]),
      lu = unitFor(Math.max(land, planted), this.plots.length, [5, 10, 20, 50, 100, 250]);
    set(this.people, symbolsFor(people, pu, this.people.length), "#fz-key-people", pu, ["figure", "people"]);
    set(this.jars, symbolsFor(food, ju, this.jars.length), "#fz-key-jars", ju, ["jar", "bushels"]);
    set(this.plots, symbolsFor(land, lu, this.plots.length), "#fz-key-plots", lu, ["plot", "acres"]);
    const sown = symbolsFor(planted, lu, this.plots.length);
    this.plots.forEach((n, i) => n.classList.toggle("sown", i < sown));
    this.svg.setAttribute("aria-label", `The kingdom: ${people} people, ${food} bushels of grain, ${land} acres, ${planted} planted.`);
  }
  /** Plays a short one-off effect: "rats", "plague", "starve", "bonus", "arrive". */
  effect(name) {
    const cls = `ev-${name}`;
    this.svg.classList.remove(cls);
    void this.svg.getBoundingClientRect();
    this.svg.classList.add(cls);
    setTimeout(() => this.svg.classList.remove(cls), 2400);
  }
}
