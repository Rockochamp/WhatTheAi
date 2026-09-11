import {
  Flight,
  PHASE_COOLDOWN,
  SECTOR_LENGTH,
  SECTORS,
  clamp,
} from "./engine.js?v=2";
import { Renderer } from "./renderer.js?v=2";
import {
  readRecords,
  addRecord,
  fetchGlobalRecords,
  saveGlobalRecord,
  isLiveSite,
} from "./records.js?v=2";
const $ = (id) => document.getElementById(id),
  canvas = $("space"),
  stage = $("stage");
const storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
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
const scoreText = (value) => Math.floor(value).toLocaleString("en-US");
const timeText = (value) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
let flight = new Flight(),
  records = readRecords(storage),
  pilot = pref("cosmic_dodge_astra_pilot", "");
let runId = "",
  generation = 0,
  board = "local",
  boardRequest = 0;
let keys = new Set(),
  pointer = null,
  target = null;
let lastTime = 0,
  clock = 0,
  accumulator = 0,
  hudTime = 0,
  endAt = 0,
  messageUntil = 0;
const renderer = new Renderer(canvas),
  motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced =
  pref("cosmic_dodge_reduce_motion", String(motionQuery.matches)) === "true";
let sound = pref("cosmic_dodge_astra_sound", "false") === "true",
  audioContext,
  beat = 0,
  beatTime = 0;
function activateAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audioContext && Audio) audioContext = new Audio();
    audioContext?.resume().catch(() => {});
  } catch {
    /* Optional audio. */
  }
}
function tone(
  frequency,
  duration = 0.12,
  shape = "sine",
  volume = 0.03,
  end = frequency,
  delay = 0,
) {
  if (!sound || !audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain(),
    at = audioContext.currentTime + delay;
  oscillator.type = shape;
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, end),
    at + duration,
  );
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
function updateMusic(dt) {
  if (!sound || flight.status !== "playing") return;
  beatTime -= dt;
  if (beatTime <= 0) {
    beatTime += 0.24;
    const notes = [130.81, 196, 261.63, 196, 155.56, 233.08, 311.13, 233.08];
    tone(notes[beat % 8], 0.38, "sine", 0.013);
    if (beat % 4 === 0) tone(55, 0.22, "sine", 0.027, 30);
    beat++;
  }
}
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
function showBoard(items, status) {
  $("leaderboard").replaceChildren();
  items.slice(0, 5).forEach((record, index) => {
    const item = document.createElement("li"),
      rank = document.createElement("span"),
      name = document.createElement("span"),
      score = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    name.className = "pilot";
    name.textContent = record.playerName;
    score.className = "points";
    score.textContent = scoreText(record.score);
    item.append(rank, name, score);
    $("leaderboard").append(item);
  });
  $("board-status").textContent = status;
}
async function renderBoard() {
  const request = ++boardRequest;
  $("personal-best").textContent = records.length
    ? scoreText(records[0].score)
    : "—";
  $("personal-best-caption").textContent = records.length
    ? `${records[0].playerName} · ${timeText(records[0].elapsed)} in flight`
    : "Your next great run starts here.";
  for (const scope of ["local", "global"]) {
    $(`${scope}-tab`).classList.toggle("active", scope === board);
    $(`${scope}-tab`).setAttribute("aria-pressed", String(scope === board));
  }
  if (board === "local") {
    showBoard(
      records,
      records.length
        ? "Your top five flights on this device."
        : "Clear skies. Your first flight is waiting.",
    );
    return;
  }
  if (!isLiveSite()) {
    showBoard(
      [],
      "Worldwide scores are available on whatthe.ai. Your flights here are saved on this device.",
    );
    return;
  }
  showBoard([], "Connecting to the worldwide flight log…");
  try {
    const items = await fetchGlobalRecords();
    if (request === boardRequest)
      showBoard(
        items,
        items.length
          ? "Top flights from around the world."
          : "Be the first to leave your mark.",
      );
  } catch {
    if (request === boardRequest)
      showBoard(
        [],
        "The worldwide log is unavailable. Your device records still work. Tap Worldwide to retry.",
      );
  }
}
function view(name) {
  stage.dataset.state = flight.status;
  $("overlay").hidden = !name;
  for (const id of ["start", "pause", "result"])
    $(`${id}-content`).hidden = id !== name;
  $("world-caption").hidden = name !== "start";
  $("hud").hidden = flight.status === "ready";
  $("play-controls").hidden = flight.status !== "playing";
  if (name) $("flight-message").textContent = "";
  updateHUD();
}
function clearInput() {
  keys.clear();
  target = null;
  if (pointer && canvas.hasPointerCapture(pointer.id))
    canvas.releasePointerCapture(pointer.id);
  pointer = null;
}
function message(text, duration = 2.2, warning = false) {
  $("flight-message").textContent = text;
  $("flight-message").classList.toggle("warning", warning);
  messageUntil = clock + duration;
}
function startFlight() {
  clearInput();
  generation++;
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  flight = new Flight({ width: renderer.w, height: renderer.h, seed: seed[0] });
  runId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${seed[0]}`;
  renderer.reset();
  accumulator = 0;
  endAt = 0;
  beatTime = 0;
  beat = 0;
  lastTime = 0;
  flight.start();
  view(null);
  canvas.focus({ preventScroll: true });
  activateAudio();
  tone(160, 0.4, "triangle", 0.045, 650);
  tone(330, 0.5, "sine", 0.025, 990, 0.12);
  message("FIND YOUR FLOW", 1.8);
}
function pauseFlight() {
  if (flight.status !== "playing") return;
  flight.pause();
  clearInput();
  accumulator = 0;
  view("pause");
  $("resume-button").focus({ preventScroll: true });
}
function resumeFlight() {
  if (flight.status !== "paused") return;
  flight.resume();
  clearInput();
  accumulator = 0;
  lastTime = 0;
  activateAudio();
  view(null);
  canvas.focus({ preventScroll: true });
}
function hangar() {
  generation++;
  clearInput();
  flight = new Flight({ width: renderer.w, height: renderer.h });
  renderer.reset();
  accumulator = 0;
  endAt = 0;
  view("start");
  renderBoard();
  $("launch-form").querySelector("button").focus({ preventScroll: true });
}
function phase() {
  if (flight.phase()) {
    activateAudio();
    handleEvents();
    updateHUD();
  }
}
async function finishFlight(showResults = true) {
  clearInput();
  accumulator = 0;
  endAt = 0;
  const token = generation;
  const record = {
    id: runId,
    playerName: pilot || "Anonymous",
    score: flight.score,
    elapsed: Number(flight.elapsed.toFixed(2)),
    level: flight.level,
    distance: flight.distance,
    nearMisses: flight.nearMisses,
    starlight: flight.starlight,
    ruleset: 2,
  };
  const previousBest = records[0]?.score ?? -1,
    saved = addRecord(records, record, storage);
  records = saved.records;
  $("result-kicker").textContent =
    record.score > previousBest ? "NEW PERSONAL BEST" : "FLIGHT COMPLETE";
  $("result-title").textContent =
    record.score > previousBest ? "That’s a new orbit." : "One more run?";
  $("final-score").textContent = scoreText(record.score);
  $("final-time").textContent = timeText(record.elapsed);
  $("final-near").textContent = record.nearMisses;
  $("final-stars").textContent = record.starlight;
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
        $("save-status").textContent = `${local} Worldwide score recorded.`;
        if (board === "global") renderBoard();
      }
    } catch {
      if (token === generation)
        $("save-status").textContent =
          `${local} Worldwide sync could not be confirmed.`;
    }
  }
}
function updateHUD() {
  $("score").textContent = String(flight.score).padStart(6, "0");
  $("sector").textContent = `SECTOR ${String(flight.level).padStart(2, "0")}`;
  $("sector-name").textContent =
    SECTORS[Math.min(SECTORS.length - 1, flight.level - 1)];
  $("sector-fill").style.transform =
    `scaleX(${(flight.elapsed % SECTOR_LENGTH) / SECTOR_LENGTH})`;
  $("combo").textContent = `${flight.combo}×`;
  $("combo-fill").style.transform = `scaleX(${flight.comboLeft / 5})`;
  $("combo-description").textContent =
    flight.combo > 1 ? "KEEP IT CLOSE" : "CLOSE CALLS BUILD COMBOS";
  Array.from($("hull").children).forEach((part, i) =>
    part.classList.toggle("lost", i >= flight.hp),
  );
  $("hull").setAttribute("aria-label", `${flight.hp} of 3 shields remaining`);
  $("timer").textContent = timeText(flight.elapsed);
  $("phase-label").textContent =
    flight.phaseLeft > 0
      ? "ACTIVE"
      : flight.cooldown > 0
        ? `${flight.cooldown.toFixed(1)}s`
        : "BURST";
  $("phase-button").disabled =
    flight.status !== "playing" || flight.cooldown > 0;
  $("phase-button").classList.toggle("active", flight.phaseLeft > 0);
  $("charge-ring").style.strokeDashoffset = String(
    (226.2 * flight.cooldown) / PHASE_COOLDOWN,
  );
  $("steering-hint").style.opacity = flight.elapsed < 9 ? "1" : "0";
}
function handleEvents() {
  for (const e of flight.drainEvents()) {
    renderer.event(e, reduced);
    switch (e.type) {
      case "star":
        tone(650 + flight.combo * 100, 0.15, "sine", 0.023, 1400);
        break;
      case "repair":
        tone(400, 0.2, "sine", 0.035, 850);
        tone(800, 0.25, "sine", 0.02, 1200, 0.1);
        break;
      case "near":
        tone(430 + e.combo * 90, 0.16, "triangle", 0.025, 950);
        break;
      case "hit":
        tone(90, 0.24, "sawtooth", 0.025, 25);
        if (flight.hp === 1) message("LAST SHIELD · MAKE IT COUNT", 1.8, true);
        break;
      case "shatter":
        tone(180, 0.12, "triangle", 0.016, 50);
        break;
      case "phase":
        tone(80, 0.5, "sawtooth", 0.018, 500);
        tone(500, 0.35, "sine", 0.025, 1800);
        break;
      case "sector":
        message(
          `SECTOR ${e.level} · ${SECTORS[Math.min(3, e.level - 1)].toUpperCase()}`,
          2.5,
        );
        tone(300, 0.5, "sine", 0.025, 600);
        break;
      case "warning":
        message(e.text, 1.5, true);
        tone(280, 0.16, "square", 0.008);
        break;
      case "over":
        clearInput();
        $("play-controls").hidden = true;
        stage.dataset.state = "over";
        endAt = clock + 0.75;
        tone(120, 0.65, "triangle", 0.04, 30);
        renderer.burst(
          flight.player.x,
          flight.player.y,
          "#acecfa",
          reduced ? 10 : 65,
          1.8,
        );
        break;
    }
  }
}
function resize() {
  const rect = stage.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 100) return;
  const changed = renderer.w && Math.abs(rect.width - renderer.w) > 100;
  if (changed && flight.status === "playing") pauseFlight();
  const w = rect.width,
    h = rect.height;
  renderer.resize(w, h, Math.min(devicePixelRatio || 1, 1.75));
  flight.resize(w, h);
  clearInput();
  updateHUD();
}
function frame(timestamp) {
  const dt = Math.min(
    0.075,
    Math.max(0, (timestamp - (lastTime || timestamp)) / 1000),
  );
  lastTime = timestamp;
  if (!document.hidden && flight.status !== "paused") clock += dt;
  if (flight.status === "playing") {
    accumulator += dt;
    const axis =
      Number(keys.has("ArrowRight") || keys.has("KeyD")) -
      Number(keys.has("ArrowLeft") || keys.has("KeyA"));
    const vertical =
      Number(keys.has("ArrowDown") || keys.has("KeyS")) -
      Number(keys.has("ArrowUp") || keys.has("KeyW"));
    while (accumulator >= 1 / 120 && flight.status === "playing") {
      flight.update(1 / 120, { axis, vertical, target });
      accumulator -= 1 / 120;
    }
    handleEvents();
    updateMusic(dt);
  }
  if (endAt && clock >= endAt) finishFlight();
  if (clock > messageUntil) $("flight-message").textContent = "";
  hudTime += dt;
  if (hudTime > 0.06) {
    updateHUD();
    hudTime = 0;
  }
  if (!document.hidden) renderer.draw(flight, clock, dt, reduced);
  requestAnimationFrame(frame);
}
$("pilot-name").value = pilot;
$("launch-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("pilot-name").value.trim().replace(/\s+/g, " ").slice(0, 16);
  const blocked =
    typeof offensiveWords !== "undefined" &&
    offensiveWords.some((word) => name.toLowerCase().includes(word));
  if (blocked) {
    $("name-error").textContent = "Please choose another callsign.";
    $("pilot-name").focus();
    return;
  }
  pilot = name;
  setPref("cosmic_dodge_astra_pilot", pilot);
  $("name-error").textContent = "";
  startFlight();
});
$("restart-button").addEventListener("click", startFlight);
$("menu-button").addEventListener("click", hangar);
$("pause-button").addEventListener("click", pauseFlight);
$("resume-button").addEventListener("click", resumeFlight);
$("quit-button").addEventListener("click", () => {
  flight.status = "over";
  finishFlight(false);
  hangar();
});
$("phase-button").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  phase();
});
$("phase-button").addEventListener("click", (event) => {
  if (event.detail === 0) phase();
});
$("local-tab").addEventListener("click", () => {
  board = "local";
  renderBoard();
});
$("global-tab").addEventListener("click", () => {
  board = "global";
  renderBoard();
});
function openDialog(id) {
  pauseFlight();
  $(id).showModal();
}
$("records-button").addEventListener("click", () => {
  openDialog("records-dialog");
  renderBoard();
});
$("help-button").addEventListener("click", () => openDialog("help-dialog"));
document
  .querySelectorAll(".close-dialog")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  }),
);
$("sound-button").addEventListener("click", () => {
  sound = !sound;
  setPref("cosmic_dodge_astra_sound", String(sound));
  soundUI();
  if (sound) {
    activateAudio();
    tone(660, 0.12);
  } else audioContext?.suspend().catch(() => {});
});
$("motion-button").addEventListener("click", () => {
  reduced = !reduced;
  setPref("cosmic_dodge_reduce_motion", String(reduced));
  motionUI();
});
motionQuery.addEventListener("change", (event) => {
  reduced = event.matches;
  motionUI();
});
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("arcade").requestFullscreen();
  } catch {
    message("Fullscreen is unavailable in this browser.", 3);
  }
});
if (!document.fullscreenEnabled) $("fullscreen-button").hidden = true;
document.addEventListener("fullscreenchange", () => {
  $("fullscreen-button").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  );
  resize();
});
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target.isContentEditable ||
    document.querySelector("dialog[open]")
  )
    return;
  if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
    if (["playing", "paused"].includes(flight.status)) {
      event.preventDefault();
      flight.status === "playing" ? pauseFlight() : resumeFlight();
    }
    return;
  }
  if (flight.status !== "playing") return;
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "KeyA",
      "KeyD",
      "KeyW",
      "KeyS",
      "Space",
    ].includes(event.code)
  ) {
    if (event.code === "Space" && event.target instanceof HTMLButtonElement)
      return;
    event.preventDefault();
    if (event.code === "Space") {
      if (!event.repeat) phase();
    } else {
      keys.add(event.code);
      target = null;
    }
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
canvas.addEventListener("pointerdown", (event) => {
  if (
    flight.status !== "playing" ||
    pointer ||
    (event.pointerType === "mouse" && event.button !== 0)
  )
    return;
  event.preventDefault();
  keys.clear();
  canvas.setPointerCapture(event.pointerId);
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    shipX: flight.player.x,
    shipY: flight.player.y,
  };
  target = { x: flight.player.x, y: flight.player.y };
  canvas.focus({ preventScroll: true });
  activateAudio();
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointer || pointer.id !== event.pointerId || flight.status !== "playing")
    return;
  event.preventDefault();
  const b = flight.bounds;
  target = {
    x: clamp(
      pointer.shipX + (event.clientX - pointer.x) * 1.15,
      b.left,
      b.right,
    ),
    y: clamp(
      pointer.shipY + (event.clientY - pointer.y) * 1.15,
      b.top,
      b.bottom,
    ),
  };
  // Re-anchor at the edges so dragging back responds immediately, without a dead zone.
  if (target.x === b.left || target.x === b.right) {
    pointer.x = event.clientX;
    pointer.shipX = target.x;
  }
  if (target.y === b.top || target.y === b.bottom) {
    pointer.y = event.clientY;
    pointer.shipY = target.y;
  }
});
function endPointer(event) {
  if (pointer?.id === event.pointerId) {
    pointer = null;
    // Finish a quick swipe at its last target; cancellation must stop immediately.
    if (event.type !== "pointerup") target = null;
  }
}
for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(name, endPointer);
window.addEventListener("blur", pauseFlight);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseFlight();
  lastTime = 0;
});
new ResizeObserver(resize).observe(stage);
soundUI();
motionUI();
renderBoard();
resize();
view("start");
requestAnimationFrame(frame);
