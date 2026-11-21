// Page logic for Steve Jobs – Hammurabi (Claude Fable 5.2).
import { clamp, prefs, cleanName, nameAllowed, dayKey, formatInt, runId, share, isLiveSite } from "../../../js/fable/kit.js?v=1";
import { RULES, fate, dailySeed, initialState, forecast, limits, resolve, advise, reign, mood, epithet, chronicle } from "./engine.js?v=1";
import { Frieze } from "./frieze.js?v=1";
import { Lyre } from "./audio.js?v=1";
import { board, makeRecord } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const store = prefs("hm_fable_"),
  frieze = new Frieze($("frieze")),
  lyre = new Lyre(),
  PAGE = "https://whatthe.ai/games/steve_jobs_hammurabi/claude_fable_5_2/game.html",
  COUNSELS = 3;

let muted = store.get("muted", "false") === "true",
  mode = store.get("mode", "daily") === "free" ? "free" : "daily",
  ruler = cleanName(store.get("name", "")),
  day = dayKey(),
  f = null,
  state = null,
  plan = { land: 0, plant: 0, feed: 0 },
  counsels = 0,
  reports = [],
  id = "",
  last = null; // the latest resolved year
lyre.sound.muted = muted;
lyre.sound.musicVolume = clamp(Number(store.get("music", "0.5")) || 0, 0, 1);

const signed = (v) => (v > 0 ? `+${formatInt(v)}` : v < 0 ? `−${formatInt(-v)}` : "0");
const plural = (v, one, many = `${one}s`) => `${formatInt(v)} ${v === 1 ? one : many}`;

function phase(name) {
  $("game").dataset.phase = name;
  for (const p of ["start", "work", "report", "legacy"]) $(p).hidden = p !== name;
}
function tally(s, planted = 0, food = s.food) {
  $("t-year").textContent = `${Math.min(s.year + 1, RULES.years)} of ${RULES.years}`;
  $("t-people").textContent = formatInt(s.people);
  $("t-food").textContent = formatInt(s.food);
  $("t-land").textContent = `${formatInt(s.land)} acres`;
  const m = mood(s.risk);
  $("t-mood").textContent = m.label;
  $("t-mood").dataset.tone = m.tone;
  frieze.show({ people: s.people, food, land: s.land, planted });
}

/* ------------------------------------------------------------ the decree */
function fit() {
  // keep the plan inside what the granary, the land and the people allow
  let lim = limits(state, plan);
  plan.land = clamp(plan.land, lim.minLand, lim.maxLand);
  lim = limits(state, plan);
  plan.plant = clamp(plan.plant, 0, lim.plantMax);
  lim = limits(state, plan);
  plan.feed = clamp(plan.feed, 0, Math.max(0, lim.feedMax));
  return lim;
}
function drawPlan() {
  const lim = fit(),
    b = forecast(state, plan),
    set = (name, value, min, max) => {
      for (const kind of ["range", "num"]) {
        const el = $(`${name}-${kind}`);
        el.min = min;
        el.max = max;
        if (document.activeElement !== el || kind === "range") el.value = value;
      }
    };
  set("land", plan.land, lim.minLand, lim.maxLand);
  set("plant", plan.plant, 0, lim.plantMax);
  set("feed", plan.feed, 0, Math.max(lim.feedMax, 0));
  $("land-price").textContent = `at ${state.price} bushels an acre`;
  $("land-hint").textContent =
    plan.land > 0
      ? `Buy ${plural(plan.land, "acre")} for ${formatInt(plan.land * state.price)} bushels. You will own ${formatInt(b.land)}.`
      : plan.land < 0
        ? `Sell ${plural(-plan.land, "acre")} for ${formatInt(-plan.land * state.price)} bushels. You will own ${formatInt(b.land)}.`
        : `No trade. You own ${plural(state.land, "acre")}; you could buy up to ${formatInt(lim.maxLand)}.`;
  $("plant-hint").textContent =
    lim.plantMax === 0
      ? "Nothing can be sown: no land, no hands or no seed."
      : `${plural(plan.plant, "acre")} of ${formatInt(lim.plantMax)} possible. ${formatInt(state.people)} people can work ${formatInt(state.people * RULES.acresPerPerson)}.`;
  $("feed-hint").textContent =
    plan.feed >= RULES.fullRation
      ? "A feast. Newcomers are certain."
      : plan.feed >= RULES.ration
        ? "Enough. Hunger eases."
        : plan.feed > 0
          ? "Short rations. Hunger builds."
          : "Nobody eats this year. Hunger builds fast.";
  // ledger
  const total = Math.max(1, state.food + Math.max(0, -b.cost)),
    part = (v) => `${(clamp(v / total, 0, 1) * 100).toFixed(2)}%`,
    bars = $("grain").children;
  bars[0].style.flexBasis = part(Math.max(0, b.cost));
  bars[1].style.flexBasis = part(plan.plant);
  bars[2].style.flexBasis = part(b.rations);
  bars[3].style.flexBasis = part(Math.max(0, b.reserve));
  $("grain").setAttribute("aria-label", `Of ${formatInt(total)} bushels: ${formatInt(Math.max(0, b.cost))} on land, ${formatInt(plan.plant)} on seed, ${formatInt(b.rations)} on rations, ${formatInt(Math.max(0, b.reserve))} kept.`);
  $("l-trade").textContent = b.cost ? signed(-b.cost) : "0";
  $("l-seed").textContent = signed(-plan.plant);
  $("l-feed").textContent = signed(-b.rations);
  $("l-keep").textContent = formatInt(b.reserve);
  $("o-harvest").textContent = plan.plant ? `${formatInt(b.harvestMin)} to ${formatInt(b.harvestMax)} bushels` : "none";
  const m = mood(b.risk);
  $("hunger").firstElementChild.style.transform = `scaleX(${clamp(b.risk / 1.2, 0, 1).toFixed(3)})`;
  $("hunger").classList.toggle("bad", b.starving > 0);
  $("hunger").setAttribute("aria-label", `Hunger ${Math.round(clamp(b.risk / 0.85, 0, 1.5) * 100)} percent of the breaking point`);
  $("o-hunger").textContent = b.starving > 0 ? `${plural(b.starving, "person", "people")} will starve` : m.label;
  $("o-arrive").textContent =
    b.arrivalChance <= 0 ? "none will come" : `${Math.round(b.arrivalChance * 100)}% chance, up to ${b.arrivalMax}`;
  $("plan-error").textContent = b.valid ? "" : b.errors[0].message;
  $("btn-seal").disabled = !b.valid;
  frieze.show({ people: state.people, food: Math.max(0, b.reserve), land: Math.max(0, b.land), planted: plan.plant });
}
function openYear() {
  $("decree-title").textContent =
    state.year === RULES.years - 1 ? "Decree for the tenth and last year" : `Decree for year ${state.year + 1}`;
  const feed = Math.min(RULES.ration, Math.floor(state.food / Math.max(1, state.people)));
  plan = { land: 0, plant: Infinity, feed };
  // default: standard rations first, then sow what the rest allows
  plan.plant = Math.max(0, Math.min(state.land, state.people * RULES.acresPerPerson, state.food - feed * state.people));
  $("counsel").textContent = "";
  $("btn-scribe").textContent = counsels < COUNSELS ? `Ask the scribe (${COUNSELS - counsels} left)` : "The scribe has spoken";
  $("btn-scribe").disabled = counsels >= COUNSELS;
  phase("work");
  tally(state);
  drawPlan();
}
for (const name of ["land", "plant", "feed"])
  for (const kind of ["range", "num"])
    $(`${name}-${kind}`).addEventListener("input", (e) => {
      const v = Math.round(Number(e.target.value));
      if (!Number.isFinite(v)) return;
      plan[name] = v;
      drawPlan();
      if (kind === "range") lyre.tick();
    });
for (const name of ["land", "plant", "feed"]) $(`${name}-num`).addEventListener("blur", drawPlan);
$("btn-scribe").addEventListener("click", () => {
  if (counsels >= COUNSELS) return;
  const advice = advise(state);
  if (!advice) return;
  counsels++;
  plan = { ...advice.plan };
  $("btn-scribe").textContent = counsels < COUNSELS ? `Ask the scribe (${COUNSELS - counsels} left)` : "The scribe has spoken";
  $("btn-scribe").disabled = counsels >= COUNSELS;
  drawPlan();
  $("counsel").textContent = `The scribe sets the plan above. ${advice.reasons.join(" ")}`;
  lyre.good();
});
$("decree").addEventListener("submit", (e) => {
  e.preventDefault();
  const before = state,
    out = resolve(state, plan, f);
  if (!out.ok) {
    $("plan-error").textContent = out.errors[0].message;
    return;
  }
  state = out.state;
  last = out;
  reports.push(out.report);
  showReport(before, out);
});

/* ------------------------------------------------------------ the report */
function showReport(before, { report, ended }) {
  phase("report");
  $("report-title").textContent = `Year ${report.year}`;
  const list = $("report-lines");
  list.replaceChildren();
  chronicle(report).forEach((line, i) => {
    const li = document.createElement("li");
    li.dataset.tone = line.tone;
    li.textContent = line.text;
    li.style.animationDelay = `${i * 0.18}s`;
    list.append(li);
  });
  for (const [key, value] of [["people", report.peopleChange], ["food", report.foodChange], ["land", report.plan.land]]) {
    const el = $(`d-${key}`);
    el.textContent = signed(value);
    el.dataset.sign = value > 0 ? "+" : value < 0 ? "-" : "";
  }
  $("btn-next").textContent = ended ? "See your legacy" : `Go to year ${report.year + 1}`;
  tally(state);
  lyre.seal();
  if (report.rats) {
    frieze.effect("rats");
    setTimeout(() => lyre.rats(), 300);
  }
  if (report.plague) frieze.effect("plague");
  else if (report.starved) frieze.effect("starve");
  if (report.plague || report.starved) setTimeout(() => lyre.bad(), 400);
  if (report.bonus) frieze.effect("bonus");
  if (report.arrivals) {
    frieze.effect("arrive");
    if (!report.plague && !report.starved) setTimeout(() => lyre.good(), 500);
  }
  // one compact entry for the running chronicle
  const li = document.createElement("li"),
    strong = document.createElement("strong");
  strong.textContent = `Year ${report.year}: ${formatInt(report.people)} people`;
  li.append(strong, chronicle(report).filter((l) => l.tone !== "plain").map((l) => l.text).join(" ") || "A quiet year.");
  $("chronicle").append(li);
  $("chronicle-wrap").hidden = false;
  $("btn-next").focus({ preventScroll: true });
  void before;
}
$("btn-next").addEventListener("click", () => (last.ended ? showLegacy() : openYear()));

/* ------------------------------------------------------------ the legacy */
function showLegacy() {
  phase("legacy");
  const name = ruler || "Anonymous",
    scribe = reign(f).state.people,
    previous = board.readLocal()[0]?.score ?? -1,
    record = makeRecord({ state, counsels, mode, day }, ruler, id),
    status = $("save-status");
  $("legacy-kicker").textContent =
    state.people <= 0 ? `The city emptied in year ${state.year}` : mode === "daily" ? `Today’s fate, ${day}` : "The reign is over";
  $("legacy-name").textContent = `${name} ${epithet(state.people)}`;
  $("legacy-score").textContent = formatInt(state.people);
  const diff = state.people - scribe,
    aid = counsels ? ` You asked the scribe ${counsels === 1 ? "once" : `${counsels} times`}.` : " You never asked the scribe.";
  $("legacy-versus").textContent =
    (diff > 0
      ? `Given the same harvests and plagues, the scribe would have ended with ${formatInt(scribe)}. You out-ruled the scribe by ${formatInt(diff)}.`
      : diff === 0
        ? `Given the same harvests and plagues, the scribe would have ended with exactly ${formatInt(scribe)} as well.`
        : `Given the same harvests and plagues, the scribe would have ended with ${formatInt(scribe)}, which is ${formatInt(-diff)} more.`) + aid;
  lyre.finale(diff >= 0 && state.people > 0);
  tally(state);
  const { persisted } = board.addLocal(record);
  const local = persisted ? "Saved on this device." : "This browser blocks storage, so the result lasts until you close the tab.";
  if (state.people > previous && previous >= 0) $("legacy-kicker").textContent += ". Your best reign yet";
  if (!isLiveSite()) status.textContent = `${local} Shared rankings work on whatthe.ai.`;
  else {
    const which = mode === "daily" ? "today’s ranking" : "the all-time ranking",
      mine = id;
    status.textContent = `Sending your reign to ${which}…`;
    board.saveGlobal(record, { sub: mode === "daily" ? "_daily" : "" }).then(
      () => mine === id && (status.textContent = `Your reign is in ${which}.`),
      () => mine === id && (status.textContent = `Could not reach the shared ranking. ${local}`),
    );
  }
  showBest();
  $("btn-again").focus({ preventScroll: true });
}

/* -------------------------------------------------------------- starting */
function begin() {
  day = dayKey();
  f = fate(mode === "daily" ? dailySeed(day) : (Math.random() * 2 ** 32) >>> 0);
  state = initialState(f);
  counsels = 0;
  reports = [];
  last = null;
  id = runId();
  $("chronicle").replaceChildren();
  $("chronicle-wrap").hidden = true;
  openYear();
  lyre.start();
  $("land-range").focus({ preventScroll: true });
}
function toStart() {
  phase("start");
  setMode(mode);
  tally(initialState(fate(1)));
  showBest();
}
function showBest() {
  const best = board.readLocal()[0];
  $("best").textContent = best ? `${formatInt(best.score)} people` : "none yet";
}
function setMode(value) {
  mode = value;
  store.set("mode", value);
  const today = dayKey();
  $("mode-note").textContent =
    value === "daily"
      ? `The same harvests, prices and plagues for everyone on ${today}. Play it as often as you like.`
      : "Fresh luck that nobody else has seen.";
  $("par").textContent =
    value === "daily"
      ? `Today the scribe ends with ${formatInt(reign(fate(dailySeed(today))).state.people)} people. Do better.`
      : "At the end you will see what the scribe would have made of the same luck.";
}
for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.checked = radio.value === mode;
  radio.addEventListener("change", () => radio.checked && setMode(radio.value));
}
$("ruler").value = ruler;
$("begin").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cleanName($("ruler").value);
  if (name && !nameAllowed(name)) {
    $("name-error").textContent = "Please pick a different name.";
    $("ruler").focus();
    return;
  }
  $("name-error").textContent = "";
  ruler = name;
  store.set("name", name);
  lyre.sound.unlock();
  begin();
});
$("btn-again").addEventListener("click", begin);
$("btn-home").addEventListener("click", toStart);

/* -------------------------------------------------------------- rankings */
let boardRequest = 0;
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  records.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.id === id) li.className = "me";
    const cells = [["", i + 1], ["name", r.playerName], ["extra", r.counsels ? `scribe ×${r.counsels}` : "unaided"], ["score", formatInt(r.score)]];
    for (const [cls, text] of cells) {
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
  if (which === "local") return fillBoard(board.readLocal(), "No reigns on this device yet.");
  fillBoard([], isLiveSite() ? "Loading…" : "Shared rankings work on whatthe.ai. This is a preview copy.");
  if (!isLiveSite()) return;
  try {
    const records =
      which === "daily"
        ? await board.fetchGlobal({ limit: 25, where: ["day", dayKey()], sub: "_daily" })
        : await board.fetchGlobal({ limit: 25 });
    if (request === boardRequest)
      fillBoard(records, which === "daily" ? "Nobody has ruled today’s fate yet." : "No reigns yet. Be the first.");
  } catch {
    if (request === boardRequest) fillBoard([], "The shared ranking did not answer. Try again in a moment.");
  }
}
$("btn-ranks").addEventListener("click", () => openBoard(mode === "daily" ? "daily" : "global"));
$("btn-legacy-ranks").addEventListener("click", () => openBoard(mode === "daily" ? "daily" : "global"));
$("btn-best").addEventListener("click", () => openBoard("local"));
for (const tab of document.querySelectorAll("#dlg-ranks [data-board]"))
  tab.addEventListener("click", () => openBoard(tab.dataset.board));
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
}
$("btn-help").addEventListener("click", () => $("dlg-help").showModal());
$("btn-share").addEventListener("click", async () => {
  const result = await share({
    title: "Steve Jobs – Hammurabi",
    text: `My city ended with ${formatInt(state.people)} people after ${state.year} years in Hammurabi${mode === "daily" ? ` (today’s fate, ${day})` : ""}.`,
    url: PAGE,
  });
  if (result === "copied") $("save-status").textContent = "Copied. Paste it anywhere.";
  if (result === "failed") $("save-status").textContent = "Sharing is not available in this browser.";
});

/* ----------------------------------------------------------------- sound */
function setMuted(value, byUser = true) {
  muted = value;
  store.set("muted", value);
  lyre.sound.setMuted(value);
  if (!value && byUser) lyre.start();
  const b = $("btn-sound");
  b.setAttribute("aria-pressed", String(!value));
  b.setAttribute("aria-label", value ? "Sound off" : "Sound on");
  b.innerHTML = value
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM15 8q4 4 0 8m3-11q7 7 0 14"/></svg>';
}
$("btn-sound").addEventListener("click", () => setMuted(!muted));
$("music-volume").value = String(Math.round(lyre.sound.musicVolume * 100));
$("music-volume").addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  lyre.sound.setMusicVolume(v);
  store.set("music", v);
});
document.addEventListener("visibilitychange", () => (document.hidden ? lyre.stop() : state && lyre.start()));

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__hammurabi = { frieze, get state() { return state; }, get plan() { return plan; }, get fate() { return f; } };

setMuted(muted, false);
toStart();
