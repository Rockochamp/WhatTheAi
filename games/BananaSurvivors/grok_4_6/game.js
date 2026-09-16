import {
  createRun,
  update,
  chooseCut,
  reroll,
  cutInfo,
  runSummary,
  RULESET,
  HOOK_SECONDS,
  prizeName,
} from "./engine.js";
import { createRenderer } from "./renderer.js";
import { createControls } from "./controls.js";
import { createAudio } from "./audio.js";
import {
  SESSION_KEY,
  DEVICE_KEY,
  readRecords,
  addRecord,
  isLiveSite,
  fetchGlobalRecords,
  saveGlobalRecord,
} from "./records.js";

const $ = (id) => document.getElementById(id);
const all = (sel) => [...document.querySelectorAll(sel)];
const format = (n) => Math.floor(n).toLocaleString();
const clock = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

const local = window.localStorage;
const session = window.sessionStorage;
let sessionRecords = readRecords(session, SESSION_KEY);
let deviceRecords = readRecords(local, DEVICE_KEY);
let player = "Banana";
let loadout = "crescent";
let run = null;
let paused = false;
let finished = false;
let round = Math.max(0, ...sessionRecords.map((r) => r.round));
let last = 0;
let acc = 0;
let announceT = 0;
let scope = "session";
let currentRecord = null;
let options = {
  gore: local.getItem("banana_grok_gore") !== "false",
  quiet: local.getItem("banana_grok_quiet") === "true",
  audio: local.getItem("banana_grok_audio") !== "false",
};

const sound = createAudio();
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const canvas = $("arena");
const renderer = createRenderer(canvas);
const controls = createControls(canvas, $("split-button"));
const coarse = matchMedia("(pointer: coarse)");

function dirtyName(name) {
  return (
    typeof offensiveWords !== "undefined" &&
    offensiveWords.some((word) => name.toLowerCase().includes(word))
  );
}

function openDialog(id) {
  const d = $(id);
  if (d && !d.open) d.showModal();
  sound.pause();
}
function closeDialogs() {
  for (const d of all("dialog[open]")) d.close();
}
function showOverlay(id) {
  $("overlay").classList.add("open");
  $("start-content").hidden = id !== "start-content";
  $("result-content").hidden = id !== "result-content";
  $("pause-content").hidden = id !== "pause-content";
  $("upgrade-content").hidden = id !== "upgrade-content";
  $("overlay").hidden = false;
}
function hideOverlay() {
  $("overlay").classList.remove("open");
  $("overlay").hidden = true;
  $("start-content").hidden = true;
  $("result-content").hidden = true;
  $("pause-content").hidden = true;
  $("upgrade-content").hidden = true;
}
function announce(title, sub = "", seconds = 2.4) {
  $("announcement").querySelector("strong").textContent = title;
  $("announcement").querySelector("span").textContent = sub;
  $("announcement").classList.add("active");
  announceT = seconds;
}
function personal() {
  $("personal-best").textContent = deviceRecords[0]
    ? format(deviceRecords[0].score)
    : "—";
}

function paintHUD() {
  if (!run) return;
  const summary = runSummary(run);
  const p = run.player;
  $("hp-text").textContent = `${Math.max(0, Math.ceil(p.hp))}`;
  $("hp-fill").style.width = `${(p.hp / p.maxHp) * 100}%`;
  const prize = run.enemies.find((e) => e.id === run.prizeId && !e.dead);
  $("hook-label").textContent = prize ? "PRIZE" : "HOOK";
  $("hook-text").textContent = prize
    ? "NOW"
    : `${Math.max(0, Math.ceil(run.hook))}`;
  $("hook-detail").textContent = prize
    ? "Butcher it"
    : `${prizeName(run.wave)} is lowering`;
  $("hook-fill").style.width = prize
    ? "100%"
    : `${((HOOK_SECONDS - run.hook) / HOOK_SECONDS) * 100}%`;
  $("score-text").textContent = format(summary.score);
  $("combo-text").textContent =
    run.combo > 2 ? `STREAK ${run.combo}` : "WALK INTO THEM";
  $("ripe-fill").style.width = `${p.ripe * 100}%`;
  $("split-status").textContent =
    p.splitCd > 0 ? `SPLIT ${p.splitCd.toFixed(1)}` : "SPLIT READY";
  $("prize-hud").hidden = !prize;
  if (prize) {
    $("prize-name").textContent = prize.name.toUpperCase();
    $("prize-fill").style.width = `${(prize.hp / prize.maxHp) * 100}%`;
  }
}

function showUpgrade() {
  const cards = $("upgrade-cards");
  cards.replaceChildren();
  $("upgrade-title").textContent =
    run.pending > 1 ? "STACK THE CUTS" : "PICK A CUT";
  run.choices.forEach((id, i) => {
    const info = cutInfo(run, id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<small>CUT ${i + 1} · ${info.rank ? `+${info.next}` : "NEW"}</small><strong>${info.name}</strong><span>${info.detail}</span>`;
    btn.style.borderColor = info.color;
    btn.addEventListener("click", () => pick(id));
    cards.append(btn);
  });
  $("reroll-button").textContent = `Reroll · ${run.rerolls} left`;
  $("reroll-button").disabled = run.rerolls <= 0;
  $("stage").dataset.state = "upgrade";
  showOverlay("upgrade-content");
}

function pick(id) {
  if (!run) return;
  chooseCut(run, id);
  sound.sound("pulp");
  if (run.phase === "upgrade") showUpgrade();
  else {
    hideOverlay();
    $("stage").dataset.state = "playing";
  }
}

function consume() {
  if (!run?.events.length) return;
  renderer.emit(run.events, run, {
    enabled: options.gore,
    quiet: options.quiet || motion.matches,
    low: coarse.matches,
  });
  for (const e of run.events) {
    if (e.type !== "death")
      sound.sound(e.type, {
        pan: Number.isFinite(e.x) ? (e.x - run.player.x) / 420 : 0,
      });
    if (e.type === "prize") announce(e.name.toUpperCase(), "IT DROPPED. BUTCHER IT.", 3);
    if (e.type === "enrage") announce("ENRAGED", "The hook wants you.", 2);
    if (e.type === "prizeDown")
      announce(`HOOK ${e.wave} CLEARED`, "The next one is already lowering.", 2.6);
    if (e.type === "burst") announce("BURST", "Overripe.", 1.4);
    if (e.type === "split") {
      /* juice only */
    }
  }
  run.events = [];
}

function finish(retired = false) {
  if (finished || !run) return;
  finished = true;
  paused = false;
  sound.pause();
  closeDialogs();
  const result = runSummary(run);
  const oldBest = deviceRecords[0]?.score || 0;
  currentRecord = {
    ...result,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${run.seed}`,
    playerName: player,
    round: ++round,
    createdAt: Date.now(),
    ruleset: RULESET,
  };
  sessionRecords = addRecord(sessionRecords, currentRecord, session, SESSION_KEY);
  deviceRecords = addRecord(deviceRecords, currentRecord, local, DEVICE_KEY);
  personal();
  $("result-kicker").textContent = retired
    ? "WALKED OUT"
    : result.score > oldBest
      ? "A NEW PERSONAL BEST"
      : "THE LOCKER WINS";
  $("result-title").textContent = retired
    ? "You called it. The pulp still counts."
    : result.bosses
      ? `${result.bosses} prize${result.bosses === 1 ? "" : "s"} butchered.`
      : "They ate the snack.";
  $("final-score").textContent = format(result.score);
  $("result-stats").replaceChildren();
  for (const [label, value] of [
    ["HOOK", result.wave],
    ["TIME", clock(result.seconds)],
    ["KILLS", format(result.kills)],
    ["SPLITS", result.splits],
    ["BURSTS", result.bursts],
    ["CRUSHES", result.crushes],
  ]) {
    const cell = document.createElement("div");
    cell.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    $("result-stats").append(cell);
  }
  $("hud").hidden = true;
  $("ripe-hud").hidden = true;
  $("prize-hud").hidden = true;
  $("stage").dataset.state = "dead";
  showOverlay("result-content");
  save(currentRecord);
}

async function save(record) {
  $("retry-save").hidden = true;
  if (!isLiveSite()) {
    $("save-status").textContent = "Local preview — global board is live-only.";
    return;
  }
  try {
    await saveGlobalRecord(record);
    $("save-status").textContent = "Posted to the Grok 4.6 hall.";
  } catch {
    $("save-status").textContent = "Could not reach the global hall.";
    $("retry-save").hidden = false;
  }
}

async function showRanking(next = scope) {
  scope = next;
  all("[data-scope]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.scope === scope)),
  );
  $("refresh-rank").hidden = scope !== "global";
  $("rank-list").replaceChildren();
  let records = scope === "session" ? sessionRecords : deviceRecords;
  $("rank-status").textContent = "";
  if (scope === "global") {
    $("rank-status").textContent = "Loading the hall…";
    try {
      const data = await fetchGlobalRecords();
      records = data.records;
      $("rank-status").textContent = data.total
        ? `${data.total} runs on the Grok board.`
        : "No global runs yet.";
    } catch (err) {
      $("rank-status").textContent =
        err.message === "Local preview"
          ? "Global hall is live-site only."
          : "Could not load global hall.";
      records = [];
    }
  }
  records.slice(0, 20).forEach((r, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span><span>${r.playerName}<small> · hook ${r.wave} · ${r.kills}</small></span><strong>${format(r.score)}</strong>`;
    $("rank-list").append(li);
  });
  if (!records.length && scope !== "global")
    $("rank-status").textContent = "No runs here yet.";
  openDialog("rank-dialog");
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (!run) return;
  const input = controls.sample();
  if (run.phase === "playing" && !paused && !document.hidden) {
    acc += dt;
    while (acc >= 1 / 60) {
      update(run, 1 / 60, input);
      acc -= 1 / 60;
    }
    consume();
    sound.ripe(run.player.ripe);
    if (run.phase === "upgrade") showUpgrade();
    if (run.phase === "dead") finish(false);
  }
  announceT -= dt;
  if (announceT <= 0) $("announcement").classList.remove("active");
  renderer.draw(run, dt, {
    ...options,
    quiet: options.quiet || motion.matches,
  });
  paintHUD();
  if (window.__controlsTest && run) {
    window.__controlsTest.getX = () => run.player.x;
    window.__controlsTest.getY = () => run.player.y;
    window.__controlsTest.getSpeed = () =>
      Math.hypot(run.player.dx, run.player.dy);
  }
}

function start() {
  closeDialogs();
  hideOverlay();
  $("hud").hidden = false;
  $("ripe-hud").hidden = false;
  $("touch").hidden = !coarse.matches;
  $("stage").dataset.state = "playing";
  finished = false;
  paused = false;
  acc = 0;
  run = createRun((Math.random() * 1e9) | 0, loadout);
  sound.unlock();
  sound.resume();
  canvas.focus();
  announce("SPLIT", "Walk into them. Come apart.", 2.4);
}

function hangar() {
  run = null;
  paused = false;
  finished = false;
  controls.reset();
  $("hud").hidden = true;
  $("ripe-hud").hidden = true;
  $("prize-hud").hidden = true;
  $("touch").hidden = true;
  $("stage").dataset.state = "ready";
  $("overlay").hidden = false;
  $("overlay").classList.remove("open");
  $("start-content").hidden = false;
  $("result-content").hidden = true;
  $("pause-content").hidden = true;
  $("upgrade-content").hidden = true;
  sound.pause();
}

$("launch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("pilot-name").value.trim() || "Banana";
  if (dirtyName(name)) {
    $("name-error").textContent = "Pick another name.";
    return;
  }
  player = name.slice(0, 10);
  loadout = document.querySelector("input[name=loadout]:checked")?.value || "crescent";
  $("name-error").textContent = "";
  start();
});
$("restart-button").addEventListener("click", start);
$("menu-button").addEventListener("click", hangar);
$("resume-button").addEventListener("click", () => {
  paused = false;
  hideOverlay();
  $("stage").dataset.state = "playing";
  sound.resume();
});
$("quit-button").addEventListener("click", () => finish(true));
$("reroll-button").addEventListener("click", () => {
  if (run) {
    reroll(run);
    showUpgrade();
  }
});
$("records-button").addEventListener("click", () => showRanking("session"));
$("help-button").addEventListener("click", () => openDialog("help-dialog"));
$("settings-button").addEventListener("click", () => openDialog("settings-dialog"));
$("sound-button").addEventListener("click", () => {
  options.audio = !options.audio;
  local.setItem("banana_grok_audio", String(options.audio));
  sound.setEnabled(options.audio);
  if (options.audio) {
    sound.unlock();
    sound.resume();
  } else sound.pause();
  $("sound-button").setAttribute("aria-pressed", String(options.audio));
});
$("retry-save").addEventListener("click", () => currentRecord && save(currentRecord));
all("[data-ranking]").forEach((b) =>
  b.addEventListener("click", () => showRanking(b.dataset.ranking === "local" ? "local" : b.dataset.ranking)),
);
all("[data-scope]").forEach((b) =>
  b.addEventListener("click", () => showRanking(b.dataset.scope)),
);
$("refresh-rank").addEventListener("click", () => showRanking("global"));
$("opt-audio").checked = options.audio;
$("opt-gore").checked = options.gore;
$("opt-quiet").checked = options.quiet;
$("opt-audio").addEventListener("change", () => {
  options.audio = $("opt-audio").checked;
  local.setItem("banana_grok_audio", String(options.audio));
  sound.setEnabled(options.audio);
});
$("opt-gore").addEventListener("change", () => {
  options.gore = $("opt-gore").checked;
  local.setItem("banana_grok_gore", String(options.gore));
});
$("opt-quiet").addEventListener("change", () => {
  options.quiet = $("opt-quiet").checked;
  local.setItem("banana_grok_quiet", String(options.quiet));
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyP" || e.code === "Escape") {
    if (!run || run.phase !== "playing") return;
    paused = !paused;
    if (paused) {
      $("stage").dataset.state = "paused";
      showOverlay("pause-content");
      sound.pause();
    } else {
      hideOverlay();
      $("stage").dataset.state = "playing";
      sound.resume();
    }
  }
  if (run?.phase === "upgrade") {
    if (e.key === "1") pick(run.choices[0]);
    if (e.key === "2") pick(run.choices[1]);
    if (e.key === "3") pick(run.choices[2]);
  }
});

const stick = $("stick");
const knob = $("knob");
let stickId = null;
function stickAt(e) {
  const r = stick.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * 2 - 1;
  const y = (e.clientY - r.top) / r.height * 2 - 1;
  const len = Math.hypot(x, y) || 1;
  const nx = x / Math.max(1, len);
  const ny = y / Math.max(1, len);
  knob.style.left = `${33 + nx * 28}px`;
  knob.style.top = `${33 + ny * 28}px`;
  controls.setStick({ x: nx, y: ny });
}
stick.addEventListener("pointerdown", (e) => {
  stickId = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  stickAt(e);
});
stick.addEventListener("pointermove", (e) => {
  if (e.pointerId === stickId) stickAt(e);
});
const endStick = () => {
  stickId = null;
  knob.style.left = "33px";
  knob.style.top = "33px";
  controls.setStick(null);
};
stick.addEventListener("pointerup", endStick);
stick.addEventListener("pointercancel", endStick);

window.addEventListener("resize", () => renderer.resize());
window.__controlsTest = {
  getX: () => run?.player.x ?? 0,
  getY: () => run?.player.y ?? 0,
  getSpeed: () => (run ? Math.hypot(run.player.dx, run.player.dy) : 0),
  setKeys: (codes) => controls.setKeys(codes),
};

$("opt-audio").checked = options.audio;
sound.setEnabled(options.audio);
$("sound-button").setAttribute("aria-pressed", String(options.audio));
personal();
requestAnimationFrame(loop);
if (coarse.matches) $("touch").hidden = true;
