// Page lifecycle, input and instruments for Cosmic Dodge (Claude Fable 5.2).
import { clamp, prefs, cleanName, nameAllowed, dayKey, formatInt, formatTime, runId, share, isLiveSite } from "../../../js/fable/kit.js?v=1";
import { Run, autopilot, STEP, fieldWidth, dailySeed } from "./engine.js?v=1";
import { Renderer } from "./renderer.js?v=1";
import { Score } from "./audio.js?v=1";
import { board, makeRecord } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const game = $("game"),
  canvas = $("field"),
  store = prefs("cd_fable_"),
  renderer = new Renderer(canvas),
  score = new Score(),
  coarse = matchMedia("(pointer: coarse)"),
  motion = matchMedia("(prefers-reduced-motion: reduce)");
const PAGE = "https://whatthe.ai/games/cosmic_dodge/cosmic_dodge_claude_fable_5_2.html";
const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];

let reduced = store.get("reduced", String(motion.matches)) === "true",
  muted = store.get("muted", "false") === "true",
  mode = store.get("mode", "endless") === "daily" ? "daily" : "endless",
  pilot = cleanName(store.get("name", ""));
score.sound.muted = muted;
score.sound.musicVolume = clamp(Number(store.get("music", "0.6")) || 0, 0, 1);

let state = "menu", // menu | playing | paused | dying | over
  run = null,
  demo = null,
  demoInput = { x: 0, y: 0, warp: false },
  demoTick = 0,
  demoRest = 0,
  id = "",
  dieAt = 0,
  last = 0,
  acc = 0,
  bannerTimer = 0;

/* ------------------------------------------------------------ layout */
const view = () => ({ w: Math.max(200, game.clientWidth), h: Math.max(200, game.clientHeight) });
function newDemo() {
  const { w, h } = view();
  demo = new Run({ width: fieldWidth(w / h), seed: (Math.random() * 2 ** 32) >>> 0 });
  demo.progress = 30; // skip the quiet opening so the menu shows real traffic
  demo.start();
  if (state === "menu") renderer.reset(demo.sector);
}
function layout() {
  const { w, h } = view();
  if (state === "menu" && (!demo || Math.abs(demo.width - fieldWidth(w / h)) > 30)) newDemo();
  renderer.resize(w, h, (state === "menu" ? demo : run).width);
}
new ResizeObserver(layout).observe(game);

function setState(next) {
  state = next;
  game.dataset.state = next === "dying" ? "playing" : next;
  $("menu").hidden = next !== "menu";
  $("hud").hidden = !["playing", "paused", "dying"].includes(next);
  $("over").hidden = next !== "over";
  $("pause").hidden = next !== "paused";
  $("btn-warp").hidden = !(next === "playing" && coarse.matches);
  if (next !== "playing") releaseInputs();
}

/* ------------------------------------------------------------- input */
const keys = new Set(),
  touches = new Set(),
  input = { x: 0, y: 0, target: null, warp: false },
  pad = { x: 0, y: 0, warp: false, start: false, go: false };
let device = "keys",
  keyWarp = false,
  pointerWarp = false,
  buttonWarp = false,
  drag = null,
  pointerTarget = null;
function releaseInputs() {
  keys.clear();
  touches.clear();
  keyWarp = pointerWarp = buttonWarp = false;
  drag = pointerTarget = null;
  $("btn-warp").classList.remove("held");
}
const MOVES = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};
function gather() {
  let kx = 0,
    ky = 0;
  for (const k of keys) {
    kx += MOVES[k][0];
    ky += MOVES[k][1];
  }
  if (kx || ky) device = "keys";
  else if (pad.x || pad.y) device = "pad";
  input.x = device === "keys" ? kx : device === "pad" ? pad.x : 0;
  input.y = device === "keys" ? ky : device === "pad" ? pad.y : 0;
  input.target = device === "mouse" || device === "touch" ? pointerTarget : null;
  input.warp = keyWarp || pointerWarp || buttonWarp || pad.warp;
}
function pollPad() {
  const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected);
  if (!gp) return;
  const dead = (v) => (Math.abs(v) < 0.2 ? 0 : v),
    b = (i) => !!gp.buttons[i]?.pressed;
  pad.x = dead(gp.axes[0] ?? 0) || (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
  pad.y = dead(gp.axes[1] ?? 0) || (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
  pad.warp = b(0) || b(5) || b(7);
  const start = b(9),
    go = b(0);
  if (start && !pad.start) togglePause();
  if (go && !pad.go && document.activeElement?.tagName !== "INPUT") {
    if (state === "over") launch();
    else if (state === "menu" && !document.querySelector("dialog[open]")) $("launch").requestSubmit();
  }
  pad.start = start;
  pad.go = go;
}
addEventListener("keydown", (e) => {
  score.unlock();
  if (state === "menu") score.start();
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (document.querySelector("dialog[open]") || (typing && e.code !== "Escape")) return;
  if (e.code in MOVES) {
    if (state === "playing") {
      keys.add(e.code);
      e.preventDefault();
    }
  } else if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (state === "playing") {
      keyWarp = true;
      e.preventDefault();
    } else if (state === "over" && e.code === "Space" && e.target.tagName !== "BUTTON") launch();
  } else if (e.code === "KeyP" || e.code === "Escape") togglePause();
  else if (e.code === "Enter" && state === "over" && e.target.tagName !== "BUTTON") launch();
  else if (e.code === "KeyM") setMuted(!muted);
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Space" || e.code.startsWith("Shift")) keyWarp = false;
});
function fieldPoint(e) {
  const r = canvas.getBoundingClientRect();
  return renderer.toField(e.clientX - r.left, e.clientY - r.top);
}
canvas.addEventListener("pointerdown", (e) => {
  score.unlock();
  if (state === "menu") score.start();
  if (state !== "playing") return;
  canvas.setPointerCapture?.(e.pointerId);
  if (e.pointerType === "mouse") {
    if (e.button === 0) pointerWarp = true;
    device = "mouse";
    pointerTarget = fieldPoint(e);
  } else {
    touches.add(e.pointerId);
    if (!drag) {
      const p = run.player;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: p.x, py: p.y };
      pointerTarget = { x: p.x, y: p.y };
      device = "touch";
    } else pointerWarp = true;
  }
  e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  if (state !== "playing") return;
  if (e.pointerType === "mouse") {
    device = "mouse";
    pointerTarget = fieldPoint(e);
  } else if (drag && e.pointerId === drag.id) {
    const b = run.bounds,
      gain = 1.3 / renderer.scale,
      x = drag.px + (e.clientX - drag.sx) * gain,
      y = drag.py + (e.clientY - drag.sy) * gain;
    pointerTarget = { x: clamp(x, b.left, b.right), y: clamp(y, b.top, b.bottom) };
    // at an edge, re-anchor so turning back responds at once
    if (pointerTarget.x !== x) {
      drag.sx = e.clientX;
      drag.px = pointerTarget.x;
    }
    if (pointerTarget.y !== y) {
      drag.sy = e.clientY;
      drag.py = pointerTarget.y;
    }
    device = "touch";
  }
});
function pointerEnd(e) {
  if (e.pointerType === "mouse") {
    if (e.button === 0 || e.type !== "pointerup") pointerWarp = false;
    return;
  }
  touches.delete(e.pointerId);
  if (drag?.id === e.pointerId) {
    drag = null;
    pointerTarget = null;
  }
  pointerWarp = touches.size - (drag ? 1 : 0) > 0;
}
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const warpButton = $("btn-warp");
warpButton.addEventListener("pointerdown", (e) => {
  buttonWarp = true;
  warpButton.setPointerCapture?.(e.pointerId);
  warpButton.classList.add("held");
  e.preventDefault();
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  warpButton.addEventListener(type, () => {
    buttonWarp = false;
    warpButton.classList.remove("held");
  });
warpButton.addEventListener("contextmenu", (e) => e.preventDefault());

/* --------------------------------------------------------------- hud */
const shown = {};
function put(key, value, apply) {
  if (shown[key] === value) return;
  shown[key] = value;
  apply(value);
}
const sectorLabel = (r) => r.sectorInfo.name + (ROMAN[r.sectorInfo.lap] ?? ` ${r.sectorInfo.lap + 1}`);
function updateHud() {
  put("score", formatInt(run.score), (v) => ($("score").textContent = v));
  put("level", `Level ${run.level}, ${sectorLabel(run)}`, (v) => ($("level-line").textContent = v));
  $("level-fill").style.transform = `scaleX(${run.levelProgress.toFixed(3)})`;
  $("flow-fill").style.transform = `scaleX(${(run.flow / 100).toFixed(3)})`;
  put("mult", run.multiplier, (v) => ($("mult").textContent = `×${v}`));
  put("flowAria", Math.round(run.flow / 10) * 10, (v) => $("flow-track").setAttribute("aria-label", `Flow ${v} percent`));
  put("full", run.flow >= 100, (v) => $("hud-flow").classList.toggle("full", v));
  put("warping", run.warping, (v) => $("hud-flow").classList.toggle("warping", v));
  put("shield", run.shield, (v) => {
    $("shield").classList.toggle("gone", !v);
    $("shield").setAttribute("aria-label", v ? "Shield ready" : "No shield");
  });
  put("clock", formatTime(run.time), (v) => ($("clock").textContent = v));
}
function banner(title, sub = "", ms = 2200) {
  const el = $("banner");
  el.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.append(strong);
  if (sub) {
    const span = document.createElement("span");
    span.textContent = sub;
    el.append(span);
  }
  el.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove("show"), ms);
}
const intensity = () => 2 + Math.min(3, Math.floor((run.level - 1) / 3));

/* ------------------------------------------------------------ events */
function react(now) {
  for (const e of run.drainEvents()) {
    renderer.handle(e, run);
    switch (e.type) {
      case "graze":
        score.graze(e.chain, e.closeness);
        break;
      case "multiplier": {
        score.multiplier(e.value);
        const el = $("hud-flow");
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
        if (e.value === 8) banner("Overflow", "Every point counts eight times.", 1600);
        break;
      }
      case "dust":
        score.dust();
        break;
      case "aegis":
        score.aegis();
        break;
      case "shield":
        score.shield();
        navigator.vibrate?.(60);
        break;
      case "warpOn":
        score.warpOn();
        break;
      case "warpOff":
        score.warpOff();
        break;
      case "telegraph":
        score.telegraph();
        break;
      case "level":
        score.level();
        score.setIntensity(intensity());
        break;
      case "sector":
        score.sector();
        banner(sectorLabel(run), `${e.line} +${formatInt(e.bonus)} points`, 2600);
        break;
      case "over":
        score.over();
        score.setWarp(false);
        score.setIntensity(0);
        navigator.vibrate?.([90, 40, 160]);
        dieAt = now + 1350;
        setState("dying");
        break;
    }
  }
}

/* ------------------------------------------------------------ flight */
function launch() {
  const { w, h } = view(),
    day = dayKey();
  run = new Run({
    width: fieldWidth(w / h),
    seed: mode === "daily" ? dailySeed(day) : (Math.random() * 2 ** 32) >>> 0,
    mode,
    day,
  });
  run.start();
  id = runId();
  acc = 0;
  for (const k of Object.keys(shown)) delete shown[k];
  renderer.reset(0);
  setState("playing");
  layout();
  updateHud();
  banner(mode === "daily" ? `Today’s run, ${day}` : sectorLabel(run), "Fly close. Hold to warp.", 2400);
  score.start();
  score.setWarp(false);
  score.setIntensity(intensity());
  canvas.focus({ preventScroll: true });
}
function togglePause() {
  if (state === "playing") {
    run.pause();
    score.setWarp(false);
    score.stop();
    setState("paused");
    $("btn-resume").focus();
  } else if (state === "paused") resume();
}
function resume() {
  if (state !== "paused") return;
  run.resume();
  last = performance.now();
  acc = 0;
  setState("playing");
  score.start();
  canvas.focus({ preventScroll: true });
}
function toMenu() {
  run = null;
  setState("menu");
  score.setWarp(false);
  score.setIntensity(0);
  score.start();
  newDemo();
  layout();
  showBest();
}
function showBest() {
  const best = board.readLocal()[0];
  $("best").textContent = best ? `${formatInt(best.score)} at level ${best.level}` : "no runs yet";
}
function showResult() {
  setState("over");
  const previous = board.readLocal()[0]?.score ?? 0,
    record = makeRecord(run, pilot, id),
    status = $("save-status");
  $("final-score").textContent = formatInt(run.score);
  $("final-line").textContent = `Level ${run.level} in ${sectorLabel(run)}${run.mode === "daily" ? `, today’s run` : ""}.`;
  $("st-grazes").textContent = formatInt(run.grazes);
  $("st-mult").textContent = `×${run.bestMultiplier}`;
  $("st-time").textContent = formatTime(run.time);
  $("st-warp").textContent = `${run.warpTime.toFixed(1)} s`;
  $("over-title").textContent = run.score > previous && previous > 0 ? "New personal best" : "Run over";
  const { persisted } = board.addLocal(record);
  const local = persisted ? "Saved on this device." : "This browser blocks storage, so the score lasts until you close the tab.";
  if (run.score <= 0) status.textContent = "No points this time. Graze a rock to get on the board.";
  else if (!isLiveSite()) status.textContent = `${local} Shared rankings work on whatthe.ai.`;
  else {
    const which = run.mode === "daily" ? "today’s ranking and the all-time ranking" : "the all-time ranking",
      mine = id;
    status.textContent = `Sending your score to ${which}…`;
    board.saveGlobal(record, { sub: run.mode === "daily" ? "_daily" : "" }).then(
      () => mine === id && (status.textContent = `Your score is in ${which}.`),
      () => mine === id && (status.textContent = `Could not reach the shared ranking. ${local}`),
    );
  }
  $("btn-again").focus();
}

/* ---------------------------------------------------------- rankings */
let boardRequest = 0;
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  records.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.id === id) li.className = "me";
    for (const [cls, text] of [["", i + 1], ["name", r.playerName], ["extra", `Level ${r.level}`], ["score", formatInt(r.score)]]) {
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
  if (which === "local") return fillBoard(board.readLocal(), "No runs on this device yet. Launch one.");
  fillBoard([], isLiveSite() ? "Loading…" : "Shared rankings work on whatthe.ai. This is a preview copy.");
  if (!isLiveSite()) return;
  try {
    const records =
      which === "daily"
        ? await board.fetchGlobal({ limit: 20, where: ["day", dayKey()], sub: "_daily" })
        : // all time means every run: the free ones and the daily ones
          board.rank((await Promise.all([board.fetchGlobal({ limit: 20 }), board.fetchGlobal({ limit: 20, sub: "_daily" })])).flat(), 20);
    if (request === boardRequest)
      fillBoard(records, which === "daily" ? "Nobody has flown today’s run yet. Be the first." : "No scores yet. Be the first.");
  } catch {
    if (request === boardRequest) fillBoard([], "The shared ranking did not answer. Try again in a moment.");
  }
}

/* ---------------------------------------------------------- controls */
function setMuted(value, byUser = true) {
  muted = value;
  store.set("muted", value);
  score.sound.setMuted(value);
  if (!value && byUser) score.start();
  const b = $("btn-sound");
  b.setAttribute("aria-pressed", String(!value));
  b.setAttribute("aria-label", value ? "Sound off" : "Sound on");
  b.innerHTML = value
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM15 8q4 4 0 8m3-11q7 7 0 14"/></svg>';
}
function setReduced(value) {
  reduced = value;
  store.set("reduced", value);
  $("btn-motion").textContent = `Reduce effects: ${value ? "on" : "off"}`;
  $("btn-motion").setAttribute("aria-pressed", String(value));
}
function setMode(value) {
  mode = value;
  store.set("mode", value);
  $("mode-note").textContent =
    value === "daily"
      ? `One field for everyone on ${dayKey()}, with its own ranking. Resets at midnight UTC.`
      : "A new field every time.";
}
for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.checked = radio.value === mode;
  radio.addEventListener("change", () => radio.checked && setMode(radio.value));
}
$("pilot").value = pilot;
$("launch").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cleanName($("pilot").value);
  if (name && !nameAllowed(name)) {
    $("name-error").textContent = "Please pick a different nickname.";
    $("pilot").focus();
    return;
  }
  $("name-error").textContent = "";
  pilot = name;
  store.set("name", name);
  score.unlock();
  launch();
});
$("btn-again").addEventListener("click", launch);
$("btn-menu").addEventListener("click", toMenu);
$("btn-quit").addEventListener("click", toMenu);
$("btn-resume").addEventListener("click", resume);
$("btn-pause").addEventListener("click", togglePause);
$("btn-ranks").addEventListener("click", () => openBoard(mode === "daily" ? "daily" : "global"));
$("btn-over-ranks").addEventListener("click", () => openBoard(run?.mode === "daily" ? "daily" : "global"));
$("btn-best").addEventListener("click", () => openBoard("local"));
$("btn-help").addEventListener("click", () => $("dlg-help").showModal());
$("btn-sound").addEventListener("click", () => setMuted(!muted));
$("btn-motion").addEventListener("click", () => setReduced(!reduced));
$("btn-full").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else game.requestFullscreen?.().catch(() => {});
});
$("btn-share").addEventListener("click", async () => {
  const result = await share({
    title: "Cosmic Dodge",
    text: `I scored ${formatInt(run.score)} and reached level ${run.level} in Cosmic Dodge${run.mode === "daily" ? ` (today’s run, ${run.day})` : ""}.`,
    url: PAGE,
  });
  if (result === "copied") $("save-status").textContent = "Copied. Paste it anywhere.";
  if (result === "failed") $("save-status").textContent = "Sharing is not available in this browser.";
});
$("music-volume").value = String(Math.round(score.sound.musicVolume * 100));
$("music-volume").addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  score.sound.setMusicVolume(v);
  store.set("music", v);
});
for (const tab of document.querySelectorAll("#dlg-ranks [data-board]"))
  tab.addEventListener("click", () => openBoard(tab.dataset.board));
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state === "playing") togglePause();
    score.stop();
  } else if (state === "menu" || state === "over") score.start();
});
addEventListener("blur", () => state === "playing" && togglePause());
addEventListener("pointerdown", () => {
  score.unlock();
  if (state === "menu") score.start();
});
coarse.addEventListener?.("change", () => setState(state));

/* -------------------------------------------------------------- loop */
function stepDemo(dt) {
  if (demo.status !== "playing") {
    demoRest += dt;
    if (demoRest > 1.6) {
      demoRest = 0;
      newDemo();
    }
    return;
  }
  let t = Math.min(dt, 0.05);
  while (t > 0) {
    if (demoTick++ % 4 === 0) demoInput = autopilot(demo);
    demo.update(Math.min(STEP, t), demoInput);
    t -= STEP;
  }
  for (const e of demo.drainEvents()) renderer.handle(e, demo);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000 || 0, 0, 0.1);
  last = now;
  pollPad();
  if (state === "menu") {
    stepDemo(dt);
    renderer.draw(demo, dt, { reduced, dim: 0.3 });
    return;
  }
  if (state === "playing") {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 10 && state === "playing") {
      gather();
      run.update(STEP, input);
      acc -= STEP;
      steps++;
      if (run.events.length) react(now);
    }
    if (steps === 10) acc = 0;
    updateHud();
  }
  renderer.draw(run, state === "paused" ? 0 : dt, {
    reduced,
    dim: state === "over" ? 0.5 : state === "paused" ? 0.55 : 0,
  });
  if (state === "dying" && now >= dieAt) showResult();
}

// Local previews expose the run so automated checks can jump ahead.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__cosmicDodge = { get run() { return run; }, get demo() { return demo; }, get state() { return state; } };

setMuted(muted, false);
setReduced(reduced);
setMode(mode);
setState("menu");
newDemo();
layout();
showBest();
requestAnimationFrame(frame);
