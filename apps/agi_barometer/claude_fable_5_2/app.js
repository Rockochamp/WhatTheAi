// AGI Probability Barometer (Claude Fable 5.2): the dial and the readings.
import { prefs } from "../../../js/fable/kit.js?v=1";
import { SNAPSHOT, TIMEOUT_MS, ZONES, countListings, readLabs, combined, zoneFor, needleAngle, percent, addReading, isFresh, sparkPoints, dropIndex } from "./core.js?v=1";

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const store = prefs("agi_fable_");
let readings = store.json("readings", []),
  live = {},
  failed = new Set(),
  busy = false;
if (!Array.isArray(readings)) readings = [];

/* ------------------------------------------------------------- the dial */
function polar(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [300 + Math.cos(a) * r, 300 + Math.sin(a) * r];
}
function arc(r, from, to) {
  const [x1, y1] = polar(from, r),
    [x2, y2] = polar(to, r);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function buildDial() {
  let ticks = "",
    numbers = "",
    words = "",
    defs = "";
  for (let i = 0; i <= 100; i++) {
    const deg = needleAngle(i / 100),
      long = i % 10 === 0,
      mid = i % 5 === 0,
      [x1, y1] = polar(deg, 236),
      [x2, y2] = polar(deg, long ? 208 : mid ? 218 : 226);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${long ? 3 : mid ? 2 : 1}"/>`;
    if (long) {
      const [x, y] = polar(deg, 186);
      numbers += `<text x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}">${i}</text>`;
    }
  }
  let from = 0;
  ZONES.forEach((z, i) => {
    const to = Math.min(1, z.to),
      a = needleAngle(from) + 3,
      b = needleAngle(to) - 3;
    defs += `<path id="zone-arc-${i}" d="${arc(146, a, b)}"/>`;
    words += `<text><textPath href="#zone-arc-${i}" startOffset="50%" text-anchor="middle">${z.dial}</textPath></text>`;
    from = to;
  });
  $("dial").innerHTML = `
  <defs>
    <radialGradient id="brass" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#f3dc98"/><stop offset=".45" stop-color="#c9a24b"/><stop offset="1" stop-color="#6d4e16"/></radialGradient>
    <radialGradient id="face" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#fbf7ea"/><stop offset="1" stop-color="#e9dfc4"/></radialGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    ${defs}
  </defs>
  <circle cx="300" cy="300" r="296" fill="#3a2110"/>
  <circle cx="300" cy="300" r="288" fill="url(#brass)"/>
  <circle cx="300" cy="300" r="262" fill="#5c4212"/>
  <circle cx="300" cy="300" r="256" fill="url(#face)"/>
  <path d="${arc(236, -135, 135)}" fill="none" stroke="#2a2118" stroke-width="2"/>
  <path d="${arc(240, needleAngle(0.55), 135)}" fill="none" stroke="#a8322a" stroke-width="5" opacity=".75"/>
  <g stroke="#2a2118" stroke-linecap="butt">${ticks}</g>
  <g font-family="Fraunces, Georgia, serif" font-size="24" font-weight="500" fill="#2a2118" text-anchor="middle">${numbers}</g>
  <g font-family="Fraunces, Georgia, serif" font-size="17" font-style="italic" fill="#4a3a26">${words}</g>
  <text x="300" y="228" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="15" letter-spacing="3" fill="#6a5a44">PER CENT BELOW PEAK</text>
  <text x="300" y="404" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="27" font-weight="600" fill="#2a2118">Hiring-drop index</text>
  <text x="300" y="430" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="14" font-style="italic" fill="#6a5a44">not a probability of anything</text>
  <rect x="246" y="452" width="108" height="42" rx="6" fill="#16120c" stroke="#7a5a1c" stroke-width="2"/>
  <text id="window" x="300" y="482" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="26" fill="#f4eedc">–</text>
  <g id="set-hand"><path d="M298 300V92l2-14 2 14v208z" fill="url(#brass)" stroke="#5c4212" stroke-width=".8"/></g>
  <g id="needle">
    <path d="M296.5 352l-1-40L299 78l1-12 1 12 3.5 234-1 40z" fill="#1b2a4a"/>
    <circle cx="300" cy="336" r="9" fill="#1b2a4a"/>
  </g>
  <circle cx="300" cy="300" r="15" fill="url(#brass)" stroke="#5c4212"/>
  <circle cx="300" cy="300" r="5" fill="#3a2a0c"/>
  <circle cx="300" cy="300" r="256" fill="url(#shine)" pointer-events="none"/>`;
}

/* ------------------------------------------------------------- readings */
function spark(row) {
  const svg = document.createElementNS(NS, "svg"),
    pts = sparkPoints(row.trail.map((t) => t.v), 120, 34, 5);
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "34");
  svg.setAttribute("viewBox", "0 0 120 34");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Counts over time: ${row.trail.map((t) => t.v).join(", ")}`);
  if (pts.length > 1) {
    const line = document.createElementNS(NS, "polyline");
    line.setAttribute("points", pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" "));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "rgba(244,238,220,0.5)");
    line.setAttribute("stroke-width", "1.5");
    svg.append(line);
  }
  pts.forEach(([x, y], i) => {
    const c = document.createElementNS(NS, "circle"),
      kind = row.trail[i].kind;
    c.setAttribute("cx", x.toFixed(1));
    c.setAttribute("cy", y.toFixed(1));
    c.setAttribute("r", kind === "old" ? "3" : "3.6");
    c.setAttribute("fill", kind === "old" ? "#2a1012" : kind === "live" ? "#8fd6a8" : "#f4eedc");
    c.setAttribute("stroke", kind === "live" ? "#8fd6a8" : "#f4eedc");
    c.setAttribute("stroke-width", "1.5");
    svg.append(c);
  });
  return svg;
}
function cell(tag, cls, ...children) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...children);
  return el;
}
function draw() {
  const rows = readLabs(SNAPSHOT, live, readings),
    index = combined(rows),
    recorded = combined(readLabs(SNAPSHOT, {}, [])),
    zone = zoneFor(index ?? 0);
  $("needle").style.transform = `rotate(${needleAngle(index ?? 0)}deg)`;
  $("set-hand").style.transform = `rotate(${needleAngle(recorded ?? 0)}deg)`;
  $("window").textContent = percent(index);
  $("index").textContent = percent(index);
  $("zone").textContent = zone.name;
  $("zone-line").textContent = zone.line;
  $("dial").setAttribute("aria-label", `Barometer dial reading ${percent(index)} below peak: ${zone.name}. The brass hand marks the recorded reading, ${percent(recorded)}.`);
  const body = $("rows");
  body.replaceChildren();
  for (const r of rows) {
    const link = Object.assign(document.createElement("a"), { href: r.page, textContent: r.name, rel: "noopener noreferrer", target: "_blank" }),
      latest = cell("td", "n", r.latest.toLocaleString("en-US")),
      tag = cell("span", `tag${r.live ? " live" : failed.has(r.id) ? " fail" : ""}`, r.live ? "live now" : failed.has(r.id) ? "feed did not answer" : r.canReadLive ? `recorded ${SNAPSHOT.date}` : "recorded only");
    if (r.live && r.change) latest.append(cell("small", "", `${r.change > 0 ? "+" : "−"}${Math.abs(r.change).toLocaleString("en-US")} since the record`));
    const tr = cell("tr", "", cell("th", "", link), latest, cell("td", "n", r.peak.toLocaleString("en-US")), cell("td", "pct", percent(r.index)), cell("td", "", spark(r)), cell("td", "", tag));
    tr.firstElementChild.scope = "row";
    body.append(tr);
  }
  const mine = readings.length;
  $("yours").textContent = mine
    ? `You have taken ${mine} live ${mine === 1 ? "reading" : "readings"} in this browser, the latest on ${new Date(readings[mine - 1].t).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}. They stay here and raise the highest count on record when a lab lists more.`
    : "Live readings are kept in this browser only, up to sixty of them, so the highest count on record can grow as you check back.";
  $("btn-forget").hidden = !mine;
}

async function fetchCount(lab) {
  const control = new AbortController(),
    timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(lab.source, { signal: control.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) return null;
    return countListings(lab.board, await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function takeReading() {
  const glass = $("glass");
  glass.classList.remove("tapped");
  void glass.offsetWidth;
  glass.classList.add("tapped");
  if (busy) return;
  const cached = readings[readings.length - 1];
  if (isFresh(cached, Date.now()) && Object.keys(live).length) {
    $("status").textContent = "The needle is already showing a reading from the last few hours.";
    return;
  }
  busy = true;
  glass.classList.add("reading");
  $("status").textContent = "Asking the job boards…";
  const labs = SNAPSHOT.labs.filter((l) => l.board),
    counts = await Promise.all(labs.map(fetchCount)),
    got = {};
  failed = new Set();
  labs.forEach((lab, i) => (counts[i] === null ? failed.add(lab.id) : (got[lab.id] = counts[i])));
  glass.classList.remove("reading");
  busy = false;
  const n = Object.keys(got).length;
  if (n) {
    live = got;
    readings = addReading(readings, { t: Date.now(), counts: got });
    store.setJson("readings", readings);
  }
  $("status").textContent = !n
    ? "None of the job boards answered from this browser, so the needle shows the recorded counts."
    : n < labs.length
      ? `Live for ${n} of ${labs.length} labs. The rest show their recorded counts.`
      : `Live reading taken at ${new Date().toLocaleTimeString("en", { timeStyle: "short" })}.`;
  draw();
}

buildDial();
$("snap-date").textContent = SNAPSHOT.label;
$("snap-date-2").textContent = SNAPSHOT.label;
const lastReading = readings[readings.length - 1];
if (isFresh(lastReading, Date.now())) {
  live = lastReading.counts; // a recent reading of yours is still good
  $("status").textContent = "Showing your live reading from earlier.";
} else $("status").textContent = `Showing the counts recorded on ${SNAPSHOT.label}.`;
// start the needle at rest, then let it swing to the reading
$("needle").style.transform = `rotate(${needleAngle(0)}deg)`;
$("set-hand").style.transform = `rotate(${needleAngle(0)}deg)`;
requestAnimationFrame(() => requestAnimationFrame(draw));
$("glass").addEventListener("click", takeReading);
$("btn-forget").addEventListener("click", () => {
  readings = [];
  live = {};
  failed = new Set();
  store.setJson("readings", []);
  $("status").textContent = `Forgotten. Showing the counts recorded on ${SNAPSHOT.label}.`;
  draw();
});
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__barometer = { set(counts) { live = counts; draw(); }, dropIndex };
