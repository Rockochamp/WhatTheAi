import { createAudio } from "./audio.js";
import { Pulse, bpmOf, feverOf, RULESET } from "./engine.js";
import { CoreRenderer } from "./renderer.js";
import {
  readRecords,
  readSessionRecords,
  addSessionRecord,
  addRecord,
  fetchGlobalRecords,
  saveGlobalRecord,
  isLiveSite,
} from "./records.js";

const $ = (id) => document.getElementById(id);
const canvas = $("core");
const stage = $("stage");
const storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const tabStorage = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
};
const pref = (key, fallback) => {
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const setPref = (key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* Session play remains available. */
  }
};

let pulse = new Pulse();
let records = readRecords(storage);
let rounds = readSessionRecords(tabStorage);
let pilot = pref("crazy_clicker_grok_pilot", "");
let runId = "";
let generation = 0;
let board = "session";
let roundNumber = rounds.reduce((max, record) => Math.max(max, record.round), 0);
let boardRequest = 0;
let lastGhost = 0;
let finishing = false;
let lastFrame = 0;
const renderer = new CoreRenderer(canvas);
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced =
  pref("crazy_clicker_grok_reduce_motion", String(motionQuery.matches)) ===
  "true";
let sound = pref("crazy_clicker_grok_sound", "true") === "true";
let shake = pref("crazy_clicker_grok_shake", "true") === "true";
const audio = createAudio();
audio.setMuted(!sound);
audio.setVolume(Number(pref("crazy_clicker_grok_volume", "0.7")) || 0.7);

function soundUI() {
  $("sound-button").setAttribute("aria-pressed", String(sound));
  $("sound-button").setAttribute(
    "aria-label",
    sound ? "Turn sound off" : "Turn sound on",
  );
  $("sound-button").innerHTML = sound
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM15 8q5 4 0 8m3-11q8 7 0 14"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/></svg>';
}

function motionUI() {
  $("motion-button").textContent = `Reduce effects: ${reduced ? "on" : "off"}`;
  $("motion-button").setAttribute("aria-pressed", String(reduced));
}

function tempoText(taktMs) {
  if (!taktMs) return "—";
  return `${Math.round(taktMs)}ms · ${bpmOf(taktMs)} BPM`;
}

function visual(now) {
  const elapsed = pulse.lastHitAt > 0 ? now - pulse.lastHitAt : 0;
  const beatPhase = pulse.taktMs > 0 ? elapsed / pulse.taktMs : 0;
  const fever = feverOf(pulse.score);
  return {
    heat: Math.min(1, fever + (pulse.phase === "live" ? 0.15 : 0)),
    combo: pulse.score,
    comboCap: Math.max(10, pulse.best || 10),
    crazy: fever >= 0.75,
    crazyT: fever,
    crazyMeter: fever * 100,
    stage: fever >= 0.9 ? 5 : fever >= 0.5 ? 3 : 1,
    energy: pulse.score,
    shake,
    reduced,
    beatPhase,
    fever,
    taktMs: pulse.taktMs,
    live: pulse.phase === "live",
    over: pulse.phase === "over",
    ember: pulse.ember,
    label: "",
  };
}

function showBoard(items, status) {
  $("leaderboard").replaceChildren();
  items.forEach((record, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    name.className = "pilot";
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent =
      board === "session"
        ? `Round ${record.round} · ${record.playerName}`
        : record.playerName;
    detail.textContent = tempoText(record.taktMs);
    name.append(title, detail);
    if (board === "session" && record.id === runId)
      item.classList.add("latest-round");
    score.className = "points";
    score.textContent = String(record.score);
    item.append(rank, name, score);
    $("leaderboard").append(item);
  });
  $("board-status").textContent = status;
}

async function renderBoard() {
  const request = ++boardRequest;
  $("personal-best").textContent = records.length ? records[0].score : "—";
  $("personal-best-caption").textContent = records.length
    ? `${records[0].playerName} · ${tempoText(records[0].taktMs)}`
    : "Your next great run starts here.";
  for (const scope of ["session", "local", "global"]) {
    $(`${scope}-tab`).classList.toggle("active", scope === board);
    $(`${scope}-tab`).setAttribute("aria-pressed", String(scope === board));
  }
  $("board-heading").textContent =
    board === "session"
      ? "Session ranking"
      : board === "global"
        ? "Global ranking"
        : "Device bests";
  if (board === "session") {
    showBoard(
      rounds,
      rounds.length
        ? `${rounds.length} completed ${rounds.length === 1 ? "round" : "rounds"} in this tab. Highest streak first.`
        : "No rounds yet. Play a round to start your session ranking.",
    );
    return;
  }
  if (board === "local") {
    showBoard(
      records,
      records.length
        ? "Ranked by streak, then perfects. Your top ten on this device."
        : "Cold core. Your first lock is waiting.",
    );
    return;
  }
  if (!isLiveSite()) {
    showBoard(
      [],
      "Worldwide scores are available on whatthe.ai. Your runs here are saved on this device.",
    );
    return;
  }
  showBoard([], "Loading global ranking…");
  try {
    const items = await fetchGlobalRecords();
    if (request === boardRequest)
      showBoard(
        items,
        items.length
          ? "Highest streaks worldwide. Ties use perfects."
          : "Be the first to leave your mark.",
      );
  } catch {
    if (request === boardRequest)
      showBoard(
        [],
        "Global ranking is unavailable. Your session and device rankings still work. Tap Global to retry.",
      );
  }
}

function view(name) {
  stage.dataset.state =
    pulse.phase === "over"
      ? "over"
      : pulse.phase === "ready"
        ? "ready"
        : name === "pause"
          ? "paused"
          : "playing";
  $("overlay").hidden = !name;
  for (const id of ["start", "pause", "result"])
    $(`${id}-content`).hidden = id !== name;
  $("world-caption").hidden = name !== "start";
  $("hud").hidden = pulse.phase === "ready";
  updateHUD();
}

function hintFor() {
  if (pulse.phase === "first") return "Tap anywhere for the first beat";
  if (pulse.phase === "second") return "Tap again to lock the beat";
  if (pulse.phase === "live") return `Hold ${Math.round(pulse.taktMs)}ms`;
  return "";
}

function updateHUD() {
  $("score").textContent = String(pulse.score);
  $("best-line").textContent = `BEST ${Math.max(pulse.best, records[0]?.score || 0)}`;
  $("tempo").textContent = pulse.taktMs ? tempoText(pulse.taktMs) : "—";
  $("ember-chip").textContent = pulse.ember ? "EMBER READY" : "EMBER EMPTY";
  $("ember-chip").classList.toggle("off", !pulse.ember);
  $("play-hint").textContent = hintFor();
}

function startRun() {
  generation++;
  finishing = false;
  roundNumber++;
  pulse = new Pulse();
  pulse.best = records[0]?.score || 0;
  pulse.start(performance.now());
  runId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${roundNumber}`;
  lastGhost = 0;
  view(null);
  canvas.focus({ preventScroll: true });
  audio.unlock();
  audio.setMuted(!sound);
  updateHUD();
}

function hangar() {
  generation++;
  finishing = false;
  pulse = new Pulse();
  pulse.best = records[0]?.score || 0;
  audio.stop();
  view("start");
  renderBoard();
  $("launch-form").querySelector("button").focus({ preventScroll: true });
}

function pauseRun() {
  if (pulse.phase !== "live" && pulse.phase !== "second" && pulse.phase !== "first")
    return;
  if (stage.dataset.state === "paused") return;
  audio.stop();
  view("pause");
  $("resume-button").focus({ preventScroll: true });
}

function resumeRun() {
  if (stage.dataset.state !== "paused") return;
  view(null);
  canvas.focus({ preventScroll: true });
  audio.unlock();
}

async function finishRun(showResults = true) {
  if (finishing) return;
  finishing = true;
  const token = generation;
  const record = {
    id: runId,
    round: roundNumber,
    playerName: pilot || "Anonymous",
    score: pulse.score,
    taktMs: Number(pulse.taktMs.toFixed(2)),
    perfects: pulse.perfects,
    emberSaves: pulse.emberSaves,
    elapsed: Number(pulse.elapsed.toFixed(2)),
    ruleset: RULESET,
  };
  const previousBest = records[0]?.score ?? -1;
  const saved = addRecord(records, record, storage);
  records = saved.records;
  rounds = addSessionRecord(rounds, record, tabStorage);
  const sessionPlace = rounds.findIndex((entry) => entry.id === record.id) + 1;
  $("round-summary").textContent =
    `Round ${record.round} · #${sessionPlace} of ${rounds.length} this session`;
  $("result-kicker").textContent =
    record.score > previousBest ? "NEW PERSONAL BEST" : "MISSED THE BEAT";
  $("result-title").textContent =
    record.score > previousBest
      ? "That’s a cleaner pulse."
      : "The pulse is still out there.";
  $("final-score").textContent = record.score;
  $("final-tempo").textContent = record.taktMs
    ? `${Math.round(record.taktMs)}ms`
    : "—";
  $("final-perfects").textContent = record.perfects;
  $("final-embers").textContent = record.emberSaves;
  const local = saved.persisted
    ? "Saved on this device."
    : "Saved for this session. Device storage is unavailable.";
  $("save-status").textContent = isLiveSite()
    ? `${local} Syncing worldwide…`
    : local;
  if (showResults) {
    view("result");
    $("restart-button").focus({ preventScroll: true });
  }
  renderBoard();
  if (isLiveSite()) {
    try {
      await saveGlobalRecord(record);
      if (token === generation) {
        $("save-status").textContent = `${local} Worldwide streak recorded.`;
        if (board === "global") renderBoard();
      }
    } catch {
      if (token === generation)
        $("save-status").textContent =
          `${local} Worldwide sync could not be confirmed.`;
    }
  }
}

function applyResult(result, x, y, now) {
  if (!result || result.kind === "ignore") return;
  const v = visual(now);
  if (result.kind === "first") {
    audio.hit(false, 0);
    renderer.burst(x, y, result.score, false, { ...v, label: "1" });
  } else if (result.kind === "second") {
    audio.lock(result.taktMs);
    renderer.burst(x, y, result.score, false, { ...v, label: "LOCKED" });
  } else if (result.kind === "perfect") {
    audio.hit(true, v.fever);
    renderer.burst(x, y, result.score, true, v);
  } else if (result.kind === "early" || result.kind === "late") {
    audio.hit(false, v.fever);
    renderer.burst(x, y, result.score, false, {
      ...v,
      label: result.kind.toUpperCase(),
    });
  } else if (result.kind === "ember") {
    audio.ember();
    renderer.emberPop();
  } else if (result.kind === "miss") {
    audio.miss();
    renderer.missPop();
    finishRun();
  }
  updateHUD();
  if (navigator.vibrate) {
    if (result.kind === "perfect") navigator.vibrate(16);
    else if (result.kind === "miss") navigator.vibrate([30, 40, 50]);
    else if (result.kind === "ember") navigator.vibrate([12, 20, 12]);
    else navigator.vibrate(8);
  }
}

function fireTap(clientX, clientY) {
  if (stage.dataset.state === "paused") return;
  if (pulse.phase === "ready" || pulse.phase === "over") return;
  audio.unlock();
  const now = performance.now();
  const pt =
    clientX == null
      ? { x: renderer.cx, y: renderer.cy }
      : renderer.localPoint(clientX, clientY);
  const result = pulse.tap(now);
  applyResult(result, pt.x, pt.y, now);
}

function frame(now) {
  const dt = Math.min(0.08, Math.max(0.001, (now - (lastFrame || now)) / 1000));
  lastFrame = now;
  if (stage.dataset.state !== "paused") {
    const died = pulse.tick(now);
    if (died) applyResult(died, renderer.cx, renderer.cy, now);
  }
  const v = visual(now);
  if (
    pulse.phase === "live" &&
    stage.dataset.state !== "paused" &&
    pulse.taktMs > 0 &&
    v.beatPhase >= 0.98 &&
    v.beatPhase <= 1.08 &&
    now - lastGhost > pulse.taktMs * 0.6
  ) {
    lastGhost = now;
    audio.ghost();
  }
  renderer.draw(dt, v);
  audio.setDrone(
    v.fever,
    stage.dataset.state !== "paused" &&
      (pulse.phase === "live" || pulse.phase === "second"),
  );
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (pulse.phase === "over" || pulse.phase === "ready") return;
  canvas.setPointerCapture(event.pointerId);
  fireTap(event.clientX, event.clientY);
});
canvas.addEventListener("pointermove", (event) => {
  renderer.pointerTilt(event.clientX, event.clientY);
});
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    if (event.repeat) return;
    if (pulse.phase === "ready") return;
    if (pulse.phase === "over") {
      event.preventDefault();
      startRun();
      return;
    }
    event.preventDefault();
    fireTap();
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    event.preventDefault();
    if (stage.dataset.state === "paused") resumeRun();
    else pauseRun();
  }
  if (event.code === "KeyR" && pulse.phase === "over") startRun();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseRun();
});
window.addEventListener("resize", () => renderer.resize());

$("pilot-name").value = pilot;
$("launch-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("pilot-name").value.trim().replace(/\s+/g, " ").slice(0, 16);
  const blocked =
    typeof offensiveWords !== "undefined" &&
    offensiveWords.some((word) => name.toLowerCase().includes(word));
  if (blocked) {
    $("name-error").textContent = "Please choose another nickname.";
    $("pilot-name").focus();
    return;
  }
  pilot = name;
  setPref("crazy_clicker_grok_pilot", pilot);
  $("name-error").textContent = "";
  startRun();
});
$("restart-button").addEventListener("click", startRun);
$("menu-button").addEventListener("click", hangar);
$("resume-button").addEventListener("click", resumeRun);
$("quit-button").addEventListener("click", () => {
  if (pulse.phase !== "over") {
    pulse.phase = "over";
    finishRun(false);
  }
  hangar();
});
$("sound-button").addEventListener("click", () => {
  sound = !sound;
  setPref("crazy_clicker_grok_sound", String(sound));
  audio.setMuted(!sound);
  if (sound) audio.unlock();
  soundUI();
});
$("music-volume").addEventListener("input", (event) => {
  const value = Number(event.target.value) / 100;
  audio.setVolume(value);
  setPref("crazy_clicker_grok_volume", String(value));
});
$("motion-button").addEventListener("click", () => {
  reduced = !reduced;
  setPref("crazy_clicker_grok_reduce_motion", String(reduced));
  motionUI();
});
for (const scope of ["session", "local", "global"]) {
  $(`${scope}-tab`).addEventListener("click", () => {
    board = scope;
    renderBoard();
  });
}
function openDialog(id) {
  pauseRun();
  $(id).showModal();
}
function openRankings(scope = "session") {
  board = scope;
  openDialog("records-dialog");
  renderBoard();
}
$("records-button").addEventListener("click", () => openRankings());
document
  .querySelectorAll("[data-ranking]")
  .forEach((button) =>
    button.addEventListener("click", () => openRankings(button.dataset.ranking)),
  );
$("help-button").addEventListener("click", () => openDialog("help-dialog"));
document.querySelectorAll(".close-dialog").forEach((button) =>
  button.addEventListener("click", () => button.closest("dialog").close()),
);
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }),
);

soundUI();
motionUI();
$("music-volume").value = String(
  Math.round((Number(pref("crazy_clicker_grok_volume", "0.7")) || 0.7) * 100),
);
view("start");
renderBoard();
requestAnimationFrame(frame);
