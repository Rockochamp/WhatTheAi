import {
  initialState,
  forecast,
  advanceYear,
  wellbeing,
} from "./engine.js?v=1";
import {
  readSession,
  addSession,
  rankRecords,
  fetchGlobalRecords,
  saveGlobalRecord,
  isLiveSite,
} from "./records.js?v=1";
import { createMusic } from "./music.js?v=1";
const $ = (id) => document.getElementById(id);
const fmt = (value) =>
  Number.isFinite(value) ? Math.floor(value).toLocaleString() : "—";
const signed = (value) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmt(Math.abs(value))}`;
const memory = new Map();
function safeStorage(kind) {
  return {
    getItem(key) {
      try {
        return window[kind].getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        window[kind].setItem(key, value);
      } catch {}
    },
  };
}
const local = safeStorage("localStorage"),
  session = safeStorage("sessionStorage");
const music = createMusic($("music"), $("music-button"), $("volume"), local);
let sessions = readSession(session),
  state = null,
  player = "",
  round = 0,
  history = [],
  locked = false,
  finished = false,
  currentRecord = null;
const savesInFlight = new Set();
let globalRecords = [],
  globalTotal = null,
  globalState = "loading",
  globalRequest = null,
  rankScope = "global";
$("player-name").value = (local.getItem("hammurabi_astra_name") || "").slice(
  0,
  10,
);
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function openDialog(id) {
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
}
for (const button of document.querySelectorAll("[data-dialog]"))
  button.addEventListener("click", () => openDialog(button.dataset.dialog));
for (const button of document.querySelectorAll("[data-close]"))
  button.addEventListener("click", () => $(button.dataset.close).close());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
function readPlan() {
  const number = (id) =>
    $(id).value.trim() === "" ? NaN : Number($(id).value);
  return {
    buy: $("trade-type").value === "buy" ? number("trade") : 0,
    sell: $("trade-type").value === "sell" ? number("trade") : 0,
    plant: number("plant"),
    feed: number("feed"),
  };
}
function previewPlan() {
  if (!state || finished) return;
  const plan = readPlan(),
    budget = forecast(state, plan);
  $("budget-trade").textContent = fmt(budget.available);
  $("budget-spend").textContent = Number.isFinite(budget.foodForPeople)
    ? `−${fmt(plan.plant + budget.foodForPeople)}`
    : "—";
  $("budget-reserve").textContent = fmt(budget.reserve);
  $("budget-reserve").classList.toggle("danger", budget.reserve < 0);
  $("harvest-range").textContent = Number.isFinite(budget.harvestMin)
    ? `Harvest range: ${fmt(budget.harvestMin)}–${fmt(budget.harvestMax)} bushels, before events`
    : "Enter a whole number in every field.";
  $("plan-error").textContent = budget.errors[0]?.message || "";
  $("end-year").disabled = !budget.valid || locked;
  for (const id of ["trade", "plant", "feed"])
    $(id).setAttribute(
      "aria-invalid",
      String(
        budget.errors.some(
          (e) =>
            e.field === id ||
            (id === "trade" && ["buy", "sell"].includes(e.field)),
        ),
      ),
    );
  const trade = plan.buy || plan.sell;
  $("trade-note").textContent =
    Number.isFinite(trade) && trade > 0
      ? `${plan.buy ? "Costs" : "Releases"} ${fmt(trade * state.landPrice)} bushels · ${fmt(budget.land)} acres after trade`
      : "0 acres means no trade this year.";
  $("plant-note").textContent =
    `1 bushel / acre · ${fmt(budget.plantLimit)} acres available before feeding`;
  $("feed-note").textContent = Number.isFinite(budget.foodForPeople)
    ? `${fmt(state.pawns)} people × ${fmt(plan.feed)} = ${fmt(budget.foodForPeople)} bushels`
    : "20 bushels per person maintains health.";
  const health = wellbeing(budget.risk ?? state.starvationRisk);
  $("risk-warning").textContent = !Number.isFinite(plan.feed)
    ? ""
    : plan.feed < 20
      ? `Rations below 20 build hunger. Projected health: ${health.label.toLowerCase()}.`
      : budget.risk > 0.85
        ? `Health is recovering, but earlier hunger can still cause deaths this year.`
        : "";
  for (const button of document.querySelectorAll("[data-feed]"))
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.feed) === plan.feed),
    );
}
function resetPlan(feed = 20) {
  $("trade-type").value = "buy";
  $("trade").value = "0";
  $("feed").value = String(feed);
  $("plant").value = String(
    Math.min(
      state.land,
      state.pawns * 10,
      Math.max(0, state.food - feed * state.pawns),
    ),
  );
  previewPlan();
}
function renderState(report) {
  const names = [
    "The first year",
    "A kingdom takes shape",
    "The road ahead",
    "The fourth year",
    "Halfway to a legacy",
    "The sixth year",
    "The seventh year",
    "The eighth year",
    "The final stretch",
    "One last harvest",
  ];
  $("year-title").textContent = finished
    ? "The story of your reign"
    : names[Math.min(state.year, 9)];
  $("ruler-caption").textContent =
    `${player.toUpperCase()}'S REIGN · ROUND ${round}`;
  $("council-heading").textContent = finished
    ? "Reign complete"
    : `Plan year ${state.year + 1}`;
  document.querySelector(".seal").textContent = finished
    ? "X"
    : ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][state.year];
  $("year-track").replaceChildren(
    ...Array.from({ length: 10 }, (_, i) => {
      const e = element(
        "span",
        i < state.year
          ? "complete"
          : i === state.year && !finished
            ? "current"
            : "",
        String(i + 1),
      );
      e.title = `Year ${i + 1}${i < state.year ? " complete" : i === state.year && !finished ? " — current" : ""}`;
      if (i === state.year && !finished) e.setAttribute("aria-current", "step");
      return e;
    }),
  );
  $("year-track").setAttribute(
    "aria-label",
    `${state.year} of 10 years completed`,
  );
  for (const id of ["pawns", "food", "land"])
    $(id).textContent = fmt(state[id]);
  $("price").textContent = String(state.landPrice);
  $("labor").textContent = `${fmt(state.pawns * 10)} acres of labor`;
  $("population-delta").textContent = report
    ? `${signed(report.populationChange)} this year`
    : "Your reign begins";
  $("food-delta").textContent = report
    ? `${signed(report.foodChange)} this year`
    : "In the granary";
  const health = wellbeing(state.starvationRisk);
  $("health-badge").textContent = state.pawns ? health.label : "Kingdom lost";
  $("health-badge").className =
    `health ${state.pawns ? health.tone : "danger"}`;
}
function renderEvents(parent, events) {
  parent.replaceChildren(
    ...events.map((event) => {
      const item = element("div", "event");
      item.append(
        element("h3", event.tone, event.title),
        element("p", "", event.text),
      );
      return item;
    }),
  );
}
function renderChronicle(report) {
  $("chronicle-heading").textContent = report.harvest
    ? "The harvest is in."
    : "A year without a harvest.";
  $("chronicle-year").textContent = `Year ${report.year}`;
  const summary = element("div", "harvest-summary");
  for (const [label, value] of [
    ["Harvest", `${fmt(report.harvest + report.bonus)} bushels`],
    ["People", `${signed(report.populationChange)} this year`],
  ]) {
    const cell = element("div");
    cell.append(element("span", "", label), element("strong", "", value));
    summary.append(cell);
  }
  const events = element("div");
  renderEvents(events, report.events);
  $("chronicle-content").replaceChildren(summary, events);
  $("history-details").hidden = history.length < 2;
  $("history-list").replaceChildren(
    ...history
      .slice(0, -1)
      .reverse()
      .map((entry) => {
        const row = element("div", "history-row");
        row.append(
          element(
            "h3",
            "",
            `Year ${entry.report.year} · ${entry.after.pawns} people`,
          ),
        );
        const plan = entry.plan;
        row.append(
          element(
            "p",
            "",
            `${plan.buy ? `Bought ${plan.buy} acres` : plan.sell ? `Sold ${plan.sell} acres` : "Held land"} · planted ${plan.plant} · fed ${plan.feed} per person.`,
          ),
          element(
            "p",
            "",
            `Harvest: ${fmt(entry.report.harvest + entry.report.bonus)} bushels. ${entry.report.events.map((e) => e.text).join(" ")}`,
          ),
        );
        return row;
      }),
  );
}
function showYearReport(report) {
  $("report-eyebrow").textContent =
    `YEAR ${report.year} · SEALED IN THE CHRONICLE`;
  $("report-title").textContent =
    state.pawns === 0
      ? "The kingdom falls silent."
      : finished
        ? "Your ten years are complete."
        : report.plague
          ? "A shadow over the kingdom."
          : report.starved
            ? "A difficult year."
            : report.harvest >= readPlan().plant * 6
              ? "The fields were generous."
              : "The year turns.";
  $("report-subtitle").textContent =
    state.pawns === 0
      ? "No people remain. Your reign has ended."
      : `${fmt(report.harvest)} bushels harvested · ${report.yield} per planted acre`;
  const cells = [
    ["People", state.pawns, signed(report.populationChange)],
    ["Food", state.food, signed(report.foodChange)],
    ["Land", state.land, "acres"],
  ];
  $("report-numbers").replaceChildren(
    ...cells.map(([label, value, delta]) => {
      const e = element("div");
      e.append(
        element("span", "", label),
        element("strong", "", fmt(value)),
        element("small", "", delta),
      );
      return e;
    }),
  );
  renderEvents($("report-events"), report.events);
  $("report-health").textContent = state.pawns
    ? `Your people are ${wellbeing(state.starvationRisk).label.toLowerCase()}.${state.starvationRisk > 0.85 ? " Hunger persists across years; returning to 20 bushels gradually restores health." : ""}`
    : "Every reign has a lesson. A new kingdom awaits.";
  $("continue-year").textContent = finished
    ? "See your legacy →"
    : `Plan year ${state.year + 1} →`;
  openDialog("year-dialog");
}
function startReign() {
  state = initialState();
  history = [];
  finished = false;
  locked = false;
  currentRecord = null;
  round = Math.max(0, ...sessions.map((r) => r.round)) + 1;
  $("welcome").hidden = true;
  $("welcome-bottom").hidden = true;
  $("play").hidden = false;
  $("plan-form").hidden = false;
  $("finished-panel").hidden = true;
  $("retry-save").hidden = true;
  $("chronicle-heading").textContent = "A new era begins";
  $("chronicle-year").textContent = "Year 0";
  $("chronicle-content").replaceChildren(
    element(
      "p",
      "advisor",
      "You inherited 100 acres and 4,000 bushels. Feeding everyone costs 2,000 a year, while 100 planted acres yield just 300–700. A comfortable first year is not a lasting strategy.",
    ),
    element(
      "p",
      "subtle",
      "Expand carefully. Food is both your currency and your people's lifeline.",
    ),
  );
  $("history-details").hidden = true;
  $("history-details").open = false;
  renderState();
  resetPlan();
  music.start();
  $("year-title").focus();
  window.scrollTo({ top: 0, behavior: "instant" });
}
$("start-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("player-name").value.trim().slice(0, 10);
  if (!name) {
    $("name-error").textContent =
      "Give your ruler a name to enter the rankings.";
    return;
  }
  const blocked =
    typeof offensiveWords !== "undefined" &&
    offensiveWords.some((word) =>
      word.length >= 3
        ? name.toLowerCase().includes(word)
        : name.toLowerCase() === word,
    );
  if (blocked) {
    $("name-error").textContent =
      "Choose a different ruler name for the leaderboard.";
    return;
  }
  player = name;
  local.setItem("hammurabi_astra_name", player);
  $("name-error").textContent = "";
  startReign();
});
for (const id of ["trade", "plant", "feed"])
  $(id).addEventListener("input", previewPlan);
$("trade-type").addEventListener("change", previewPlan);
for (const button of document.querySelectorAll("[data-step]"))
  button.addEventListener("click", () => {
    const [id, step] = button.dataset.step.split(":");
    $(id).value = String(
      Math.max(0, (Number($(id).value) || 0) + Number(step)),
    );
    previewPlan();
  });
for (const button of document.querySelectorAll("[data-feed]"))
  button.addEventListener("click", () => {
    $("feed").value = button.dataset.feed;
    previewPlan();
  });
$("plant-max").addEventListener("click", () => {
  const plan = readPlan();
  const acres = state.land + plan.buy - plan.sell;
  const food =
    state.food +
    (plan.sell - plan.buy) * state.landPrice -
    plan.feed * state.pawns;
  $("plant").value = String(
    Math.max(0, Math.min(acres, state.pawns * 10, food)),
  );
  previewPlan();
});
$("plan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (locked || finished) return;
  const plan = readPlan(),
    outcome = advanceYear(state, plan);
  if (!outcome.ok) {
    previewPlan();
    return;
  }
  locked = true;
  state = outcome.state;
  finished = outcome.ended;
  history.push({ plan, report: outcome.report, after: { ...state } });
  renderState(outcome.report);
  renderChronicle(outcome.report);
  $("end-year").disabled = true;
  if (finished) finishReign();
  showYearReport(outcome.report);
  music.chime(finished ? "end" : "year");
});
$("continue-year").addEventListener("click", () => $("year-dialog").close());
$("year-dialog").addEventListener("close", () => {
  locked = false;
  if (!finished) resetPlan(readPlan().feed);
  $("year-title").focus();
  if (finished)
    $("finished-panel").scrollIntoView({ block: "start", behavior: "instant" });
  else
    $("council-heading").scrollIntoView({
      block: "start",
      behavior: "instant",
    });
});
function finishReign() {
  $("plan-form").hidden = true;
  $("finished-panel").hidden = false;
  $("finished-title").textContent =
    state.pawns === 0
      ? "Every kingdom has an ending."
      : state.pawns >= 100
        ? "A legacy that lives on."
        : "Your people endured.";
  $("finished-copy").textContent =
    state.pawns === 0
      ? `${player}, your kingdom fell in year ${state.year}. Your next reign begins with everything you learned.`
      : `${player}, you guided ${fmt(state.pawns)} people through ten uncertain years. Their future is your legacy.`;
  $("final-score").textContent = fmt(state.pawns);
  $("final-year").textContent = String(state.year);
  $("final-land").textContent = fmt(state.land);
  $("final-food").textContent = fmt(state.food);
  currentRecord = {
    id: crypto.randomUUID(),
    playerName: player,
    finalPawns: state.pawns,
    finalYear: state.year,
    round,
    createdAt: Date.now(),
    ruleset: 1,
  };
  sessions = addSession(sessions, currentRecord, session);
  submitRecord(currentRecord);
}
async function submitRecord(record) {
  if (!record || savesInFlight.has(record.id)) return;
  if (!isLiveSite()) {
    $("save-status").textContent =
      "Saved to this session. Global scores are submitted only on whatthe.ai.";
    return;
  }
  savesInFlight.add(record.id);
  $("retry-save").hidden = true;
  $("save-status").textContent = "Session saved. Submitting your global score…";
  try {
    await saveGlobalRecord(record);
    if (currentRecord?.id === record.id)
      $("save-status").textContent = "Saved to session and global rankings.";
    refreshGlobal();
  } catch {
    if (currentRecord?.id === record.id) {
      $("save-status").textContent =
        "Session saved. Global connection unavailable — retry when you are online.";
      $("retry-save").hidden = false;
    }
  } finally {
    savesInFlight.delete(record.id);
  }
}
$("retry-save").addEventListener("click", () => submitRecord(currentRecord));
$("play-again").addEventListener("click", startReign);
$("change-ruler").addEventListener("click", () => {
  $("play").hidden = true;
  $("welcome").hidden = false;
  $("welcome-bottom").hidden = false;
  $("player-name").focus();
  window.scrollTo({ top: 0, behavior: "instant" });
});
function renderRanking() {
  const global = rankScope === "global";
  $("global-tab").setAttribute("aria-pressed", String(global));
  $("session-tab").setAttribute("aria-pressed", String(!global));
  $("rank-description").textContent = global
    ? "The top 100 Astra reigns · ranked by final population."
    : "Every completed reign in this browser tab · ranked by final population.";
  $("games-played").textContent =
    global && globalTotal !== null
      ? `${fmt(globalTotal)} reigns completed worldwide`
      : !global
        ? `${sessions.length} ${sessions.length === 1 ? "reign" : "reigns"} completed this session`
        : "";
  $("refresh-ranking").hidden = !global;
  const records = global ? globalRecords : rankRecords(sessions, Infinity),
    content = $("ranking-content");
  if (global && globalState === "loading") {
    content.replaceChildren(
      element("p", "empty-state", "Loading the hall of rulers…"),
    );
    return;
  }
  if (global && globalState === "error") {
    content.replaceChildren(
      element(
        "p",
        "empty-state",
        isLiveSite()
          ? "The global ranking is temporarily unavailable. You can keep playing; session scores are saved here."
          : "Global rankings become available on whatthe.ai. Local preview games stay in your session ranking.",
      ),
    );
    return;
  }
  if (!records.length) {
    content.replaceChildren(
      element(
        "p",
        "empty-state",
        global
          ? "A new era has begun. Complete a reign to become the first ruler on this board."
          : "Your story starts here. Complete a reign to record your first score.",
      ),
    );
    return;
  }
  const list = element("ol", "rank-list");
  records.forEach((r, index) => {
    const row = element("li", currentRecord?.id === r.id ? "your-round" : "");
    const name = element("div");
    name.append(
      element("span", "rank-name", r.playerName),
      element(
        "small",
        "",
        `${global ? "" : `Round ${r.round} · `}${r.finalYear === 10 ? "10 years completed" : `Ended in year ${r.finalYear}`}`,
      ),
    );
    const score = element("div", "rank-score", fmt(r.finalPawns));
    score.append(element("small", "", "people"));
    row.append(
      element("span", "position", String(index + 1).padStart(2, "0")),
      name,
      score,
    );
    list.append(row);
  });
  content.replaceChildren(list);
}
for (const button of document.querySelectorAll("[data-rank]"))
  button.addEventListener("click", () => {
    rankScope = button.dataset.rank;
    renderRanking();
    openDialog("rank-dialog");
    if (rankScope === "global") refreshGlobal();
  });
async function refreshGlobal() {
  if (globalRequest) return globalRequest;
  globalState = "loading";
  if ($("rank-dialog").open && rankScope === "global") renderRanking();
  globalRequest = (async () => {
    try {
      const data = await fetchGlobalRecords();
      globalRecords = data.records;
      globalTotal = data.total;
      globalState = "ready";
      $("global-preview").textContent = globalRecords.length
        ? `${globalRecords[0].playerName} leads with ${fmt(globalRecords[0].finalPawns)} people. ${fmt(globalTotal)} reigns completed worldwide.`
        : "A new era. A fresh leaderboard. Will your kingdom be the first to make history?";
    } catch {
      globalState = "error";
      globalTotal = null;
      $("global-preview").textContent = isLiveSite()
        ? "The global board is temporarily unavailable. Session rankings are ready."
        : "Global rankings open on whatthe.ai. Your preview scores stay in this tab.";
    } finally {
      globalRequest = null;
      if ($("rank-dialog").open && rankScope === "global") renderRanking();
    }
  })();
  return globalRequest;
}
$("refresh-ranking").addEventListener("click", refreshGlobal);
refreshGlobal();
