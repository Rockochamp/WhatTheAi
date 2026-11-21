// Ken.AI (Claude Fable 5.2): the page.
import { prefs, cleanName, nameAllowed, formatInt, runId, share, isLiveSite, clamp } from "../../../js/fable/kit.js?v=1";
import { Life, STATS, STAT_NAMES, MAX_AGE } from "./life.js?v=1";
import { AMBITIONS, STAGES } from "./story.js?v=1";
import { board, makeRecord } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const store = prefs("ken_fable_"),
  PAGE = "https://whatthe.ai/games/kenai/claude_fable_5_2/game.html",
  DYE = { h: "#5f8f52", j: "#e0ae2f", b: "#b5394a", c: "#2b458f", m: "#8b6a45" },
  VAR = { h: "var(--moss)", j: "var(--weld)", b: "var(--madder)", c: "var(--indigo)", m: "var(--umber)" };
let life = null,
  id = "",
  player = cleanName(store.get("name", "")),
  shownLog = 0;

/* -------------------------------------------------------------- the loom */
function weave() {
  const c = $("weave"),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = c.clientWidth,
    h = c.clientHeight;
  if (!w || !h) return;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext("2d"),
    cols = MAX_AGE + 1,
    cw = w / cols,
    columns = life?.weave ?? [];
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#d6cdbb";
  g.fillRect(0, 0, w, h);
  // bare warp threads where no years have been woven yet
  g.fillStyle = "rgba(27,33,72,0.16)";
  for (let i = columns.length; i < cols; i++) g.fillRect(i * cw + cw / 2 - 0.5, 0, 1, h);
  columns.forEach((col, i) => {
    const total = STATS.reduce((s, k) => s + Math.max(col[k], 2), 0);
    let y = 0;
    for (const k of STATS) {
      const part = (Math.max(col[k], 2) / total) * h;
      g.fillStyle = DYE[k];
      g.fillRect(i * cw, y, Math.ceil(cw) - (cw > 3 ? 0.6 : 0), part + 0.5);
      if (col.mark === k) {
        // a knot: something worth remembering
        g.fillStyle = "#f3efe6";
        const s = Math.max(2.5, Math.min(cw * 0.9, 5));
        g.save();
        g.translate(i * cw + cw / 2, y + part / 2);
        g.rotate(Math.PI / 4);
        g.fillRect(-s / 2, -s / 2, s, s);
        g.restore();
      }
      y += part;
    }
  });
  // the weft: fine lines across everything that has been woven
  g.fillStyle = "rgba(255,255,255,0.13)";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, columns.length * cw, 1);
  g.fillStyle = "rgba(27,33,72,0.5)";
  for (const s of STAGES.slice(1)) g.fillRect(s.from * cw - 0.5, h - 9, 1.5, 9);
  if (life && life.phase !== "over") {
    g.fillStyle = "#1b2148";
    g.fillRect(columns.length * cw, 0, 2.5, h);
  }
  c.setAttribute(
    "aria-label",
    columns.length
      ? `${columns.length - 1} years woven. Now: ${STATS.map((k) => `${STAT_NAMES[k].toLowerCase()} ${Math.round(columns.at(-1)[k])}`).join(", ")}.`
      : "No years woven yet",
  );
}
new ResizeObserver(weave).observe($("weave"));

/* -------------------------------------------------------------- the page */
function setPhase(name) {
  document.body.dataset.phase = name;
  $("start").hidden = name !== "start";
  $("life").hidden = name !== "life";
  $("stone").hidden = name !== "stone";
  $("story-wrap").hidden = name === "start";
}
function spools() {
  const dl = $("spools");
  if (!dl.children.length)
    for (const k of STATS) {
      const div = document.createElement("div"),
        dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.append(STAT_NAMES[k], Object.assign(document.createElement("span"), { id: `n-${k}` }));
      dd.append(Object.assign(document.createElement("i"), { id: `s-${k}` }));
      dd.firstChild.style.setProperty("--c", VAR[k]);
      dd.id = `d-${k}`;
      div.append(dt, dd);
      dl.append(div);
    }
  for (const k of STATS) {
    const v = life.stats[k];
    $(`s-${k}`).style.transform = `scaleX(${clamp(v / 100, 0, 1)})`;
    $(`n-${k}`).textContent = Math.round(v);
    $(`d-${k}`).classList.toggle("low", v < 18);
    $(`d-${k}`).setAttribute("aria-label", `${STAT_NAMES[k]} ${Math.round(v)} of 100`);
  }
}
function pulls(fx) {
  const box = document.createElement("div");
  box.className = "pulls";
  for (const k of STATS) {
    const v = fx?.[k];
    if (!v) continue;
    const tag = document.createElement("span");
    tag.className = `pull${v < 0 ? " down" : ""}`;
    tag.style.setProperty("--c", VAR[k]);
    tag.textContent = `${STAT_NAMES[k]} ${v >= 10 ? "++" : v > 0 ? "+" : v <= -8 ? "−−" : "−"}`;
    tag.setAttribute("aria-label", `${STAT_NAMES[k]} ${v > 0 ? "up" : "down"}${Math.abs(v) >= 10 ? " a lot" : ""}`);
    box.append(tag);
  }
  return box;
}
function story() {
  const list = $("story");
  if (shownLog > life.log.length) {
    list.replaceChildren();
    shownLog = 0;
  }
  for (const entry of life.log.slice(shownLog)) {
    const li = document.createElement("li"),
      when = Object.assign(document.createElement("span"), { textContent: entry.kind === "era" ? "" : String(entry.age) }),
      what = document.createElement("span");
    if (entry.kind === "era") li.className = "era";
    if (entry.title) what.append(Object.assign(document.createElement("b"), { textContent: `${entry.title}. ` }));
    what.append(entry.text);
    li.append(when, what);
    list.prepend(li);
  }
  shownLog = life.log.length;
}
function draw() {
  weave();
  story();
  if (life.phase === "over") return finish();
  setPhase("life");
  $("age").textContent = life.age;
  $("year").textContent = life.year;
  $("stage").textContent = life.stageInfo.name;
  $("era").textContent = life.stageInfo.era;
  spools();
  const event = life.phase === "event" ? life.event : null;
  $("prompt").textContent = event ? event.title : life.age === 0 ? "He has just arrived. What comes first?" : "What do these years go to?";
  $("event-text").hidden = !event;
  $("event-text").textContent = event?.text ?? "";
  const box = $("cards");
  box.replaceChildren();
  life.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card";
    b.append(Object.assign(document.createElement("b"), { textContent: o.title ?? o.label }), Object.assign(document.createElement("span"), { textContent: o.text ?? "" }), pulls(o.fx), Object.assign(document.createElement("kbd"), { textContent: String(i + 1) }));
    b.addEventListener("click", () => choose(i));
    box.append(b);
  });
  store.setJson("life", life.save());
}
function choose(i) {
  if (!life || life.phase === "over" || !life.pick(i)) return;
  draw();
  if (life.phase !== "over") $("cards").firstElementChild?.focus({ preventScroll: true });
}
function finish() {
  setPhase("stone");
  store.setJson("life", null);
  const record = makeRecord(life, player, id),
    previous = board.readLocal()[0]?.score ?? 0,
    status = $("save-status");
  $("stone-kicker").textContent = `${life.age} years, ${life.picks.length} choices${life.score > previous && previous > 0 ? ". Your best life yet" : ""}`;
  const ep = $("epitaph");
  ep.replaceChildren(...life.epitaph().map((line) => Object.assign(document.createElement("p"), { textContent: line })));
  $("score").textContent = formatInt(life.score);
  $("grade").textContent = life.grade;
  const { persisted } = board.addLocal(record),
    local = persisted ? "Saved on this device." : "This browser blocks storage, so the result lasts until you close the tab.";
  if (!isLiveSite()) status.textContent = `${local} Shared rankings work on whatthe.ai.`;
  else {
    const mine = id;
    status.textContent = "Adding his life to the ranking…";
    board.saveGlobal(record).then(
      () => mine === id && (status.textContent = "His life is in the ranking."),
      () => mine === id && (status.textContent = `Could not reach the shared ranking. ${local}`),
    );
  }
  $("btn-again").focus({ preventScroll: true });
}
function begin(ambition) {
  life = new Life({ seed: (Math.random() * 2 ** 32) >>> 0, ambition });
  id = runId();
  shownLog = 0;
  $("story").replaceChildren();
  draw();
  scrollTo({ top: 0 });
}
function toStart() {
  life = null;
  setPhase("start");
  weave();
  const saved = Life.restore(store.json("life", null));
  $("btn-continue").hidden = !saved || saved.phase === "over";
  if (saved) $("btn-continue").textContent = `Carry on with Ken at ${saved.age}`;
}

/* -------------------------------------------------------------- controls */
const wishes = $("wishes"),
  wished = store.get("ambition", AMBITIONS[0].id);
for (const a of AMBITIONS) {
  const label = document.createElement("label"),
    input = Object.assign(document.createElement("input"), { type: "radio", name: "ambition", value: a.id, checked: a.id === wished }),
    span = document.createElement("span");
  label.className = "wish";
  span.append(Object.assign(document.createElement("b"), { textContent: a.name }), Object.assign(document.createElement("small"), { textContent: a.text }));
  label.append(input, span);
  wishes.append(label);
}
if (!wishes.querySelector("input:checked")) wishes.querySelector("input").checked = true;
$("player").value = player;
$("begin").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cleanName($("player").value);
  if (name && !nameAllowed(name)) {
    $("name-error").textContent = "Please pick a different name.";
    $("player").focus();
    return;
  }
  $("name-error").textContent = "";
  player = name;
  store.set("name", name);
  const ambition = wishes.querySelector("input:checked").value;
  store.set("ambition", ambition);
  begin(ambition);
});
$("btn-continue").addEventListener("click", () => {
  life = Life.restore(store.json("life", null));
  if (!life) return toStart();
  id = runId();
  shownLog = 0;
  $("story").replaceChildren();
  draw();
});
$("btn-again").addEventListener("click", toStart);
addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || !life) return;
  if (/^(Digit|Numpad)[1-3]$/.test(e.code)) choose(Number(e.code.slice(-1)) - 1);
});
$("btn-share").addEventListener("click", async () => {
  const result = await share({ title: "Ken.AI", text: `${life.epitaph().slice(0, 2).join(" ")} (${life.grade}, ${formatInt(life.score)} points.)`, url: PAGE });
  if (result === "copied") $("save-status").textContent = "Copied. Paste it anywhere.";
  if (result === "failed") $("save-status").textContent = "Sharing is not available in this browser.";
});
let boardRequest = 0;
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  records.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.id === id) li.className = "me";
    for (const [cls, text] of [["", i + 1], ["name", r.playerName], ["extra", `lived to ${r.age}`], ["score", formatInt(r.score)]]) {
      const span = document.createElement("span");
      if (cls) span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    list.append(li);
  });
  $("board-status").textContent = records.length ? "" : emptyText;
}
async function openBoard(which) {
  const request = ++boardRequest;
  for (const tab of document.querySelectorAll("#dlg-ranks [data-board]"))
    tab.setAttribute("aria-pressed", String(tab.dataset.board === which));
  if (!$("dlg-ranks").open) $("dlg-ranks").showModal();
  if (which === "local") return fillBoard(board.readLocal(), "No lives on this device yet.");
  fillBoard([], isLiveSite() ? "Loading…" : "Shared rankings work on whatthe.ai. This is a preview copy.");
  if (!isLiveSite()) return;
  try {
    const records = await board.fetchGlobal({ limit: 25 });
    if (request === boardRequest) fillBoard(records, "No lives yet. Be the first.");
  } catch {
    if (request === boardRequest) fillBoard([], "The ranking did not answer. Try again in a moment.");
  }
}
$("btn-ranks").addEventListener("click", () => openBoard("global"));
$("btn-stone-ranks").addEventListener("click", () => openBoard("global"));
$("btn-help").addEventListener("click", () => $("dlg-help").showModal());
for (const tab of document.querySelectorAll("#dlg-ranks [data-board]"))
  tab.addEventListener("click", () => openBoard(tab.dataset.board));
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
}
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__ken = { get life() { return life; }, choose };
toStart();
