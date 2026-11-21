// Banana Survivors: Peel Out (Claude Fable 5.2). Page, input and HUD.
import { clamp, prefs, cleanName, nameAllowed, formatInt, formatTime, runId, share, isLiveSite } from "../../../js/fable/kit.js?v=1";
import { Game, autopilot, STEP, UPGRADES, xpForLevel } from "./engine.js?v=1";
import { Renderer } from "./renderer.js?v=1";
import { Jukebox } from "./audio.js?v=1";
import { board, makeRecord } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const root = $("game"),
  canvas = $("field"),
  store = prefs("bn_fable_"),
  renderer = new Renderer(canvas),
  juke = new Jukebox(),
  coarse = matchMedia("(pointer: coarse)"),
  motion = matchMedia("(prefers-reduced-motion: reduce)"),
  PAGE = "https://whatthe.ai/games/BananaSurvivors/claude_fable_5_2/game.html";

let state = "menu", // menu | playing | choosing | paused | dying | over
  game = null,
  demo = null,
  demoInput = { x: 0, y: 0, dash: false },
  demoTick = 0,
  id = "",
  muted = store.get("muted", "false") === "true",
  reduced = store.get("reduced", String(motion.matches)) === "true",
  player = cleanName(store.get("name", "")),
  last = 0,
  acc = 0,
  dieAt = 0,
  bannerTimer = 0,
  soundBudget = 0;
juke.sound.muted = muted;
juke.sound.musicVolume = clamp(Number(store.get("music", "0.55")) || 0, 0, 1);

function layout() {
  renderer.resize(Math.max(200, root.clientWidth), Math.max(200, root.clientHeight));
}
new ResizeObserver(layout).observe(root);
function newDemo() {
  demo = new Game({ seed: (Math.random() * 2 ** 32) >>> 0 });
  for (const up of ["bunch", "slick", "domino", "quick", "ripe"]) demo.grant(up);
  demo.time = 40; // start the title screen with a proper crowd
}
function setState(next) {
  state = next;
  root.dataset.state = next === "dying" ? "playing" : next;
  $("menu").hidden = next !== "menu";
  $("hud").hidden = !["playing", "choosing", "paused", "dying"].includes(next);
  $("choose").hidden = next !== "choosing";
  $("pause").hidden = next !== "paused";
  $("over").hidden = next !== "over";
  $("btn-dash").hidden = !(next === "playing" && coarse.matches);
  if (next !== "playing") {
    keys.clear();
    pointer = null;
    $("stick").hidden = true;
    dashHeld = false;
  }
}

/* ----------------------------------------------------------------- input */
const keys = new Set(),
  MOVES = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] },
  pad = { x: 0, y: 0, dash: false, start: false, a: false };
let pointer = null, // { id, type, ox, oy, x, y }
  dashHeld = false,
  dashTap = false;
function readInput() {
  let x = 0,
    y = 0;
  for (const k of keys) {
    x += MOVES[k][0];
    y += MOVES[k][1];
  }
  if (!x && !y && pointer) {
    if (pointer.type === "mouse") {
      const r = canvas.getBoundingClientRect(),
        w = renderer.toWorld(pointer.x - r.left, pointer.y - r.top),
        dx = w.x - game.player.x,
        dy = w.y - game.player.y,
        d = Math.hypot(dx, dy);
      if (d > 14) {
        x = dx / d;
        y = dy / d;
      }
    } else {
      x = clamp((pointer.x - pointer.ox) / 46, -1, 1);
      y = clamp((pointer.y - pointer.oy) / 46, -1, 1);
    }
  }
  if (!x && !y) {
    x = pad.x;
    y = pad.y;
  }
  const dash = dashHeld || dashTap || pad.dash;
  dashTap = false;
  return { x, y, dash };
}
addEventListener("keydown", (e) => {
  juke.sound.unlock();
  if (document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (state === "choosing" && /^(Digit|Numpad)[1-3]$/.test(e.code)) return pick(Number(e.code.slice(-1)) - 1);
  if (e.code in MOVES) {
    if (state === "playing") {
      keys.add(e.code);
      e.preventDefault();
    }
  } else if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (state === "playing") {
      dashTap = true;
      e.preventDefault();
    } else if (state === "over" && e.code === "Space" && e.target.tagName !== "BUTTON") start();
  } else if (e.code === "KeyP" || e.code === "Escape") togglePause();
  else if (e.code === "Enter" && state === "over" && e.target.tagName !== "BUTTON") start();
});
addEventListener("keyup", (e) => keys.delete(e.code));
canvas.addEventListener("pointerdown", (e) => {
  juke.sound.unlock();
  if (state === "menu") juke.start();
  if (state !== "playing") return;
  e.preventDefault();
  if (e.pointerType === "mouse") {
    if (e.button === 2) return void (dashTap = true);
    if (e.button !== 0) return;
  } else if (pointer) return void (dashTap = true); // a second finger dashes
  canvas.setPointerCapture?.(e.pointerId);
  pointer = { id: e.pointerId, type: e.pointerType, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  if (e.pointerType !== "mouse") {
    const s = $("stick");
    s.hidden = false;
    s.style.left = `${e.clientX}px`;
    s.style.top = `${e.clientY}px`;
    s.firstElementChild.style.translate = "0 0";
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (pointer.type !== "mouse") {
    const dx = clamp(pointer.x - pointer.ox, -46, 46),
      dy = clamp(pointer.y - pointer.oy, -46, 46);
    $("stick").firstElementChild.style.translate = `${dx}px ${dy}px`;
  }
});
function pointerEnd(e) {
  if (!pointer || e.pointerId !== pointer.id) return;
  pointer = null;
  $("stick").hidden = true;
}
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const dashButton = $("btn-dash");
dashButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  dashTap = true;
});
dashButton.addEventListener("contextmenu", (e) => e.preventDefault());
function pollPad() {
  const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected);
  if (!gp) return;
  const dead = (v) => (Math.abs(v) < 0.2 ? 0 : v),
    b = (i) => !!gp.buttons[i]?.pressed;
  pad.x = dead(gp.axes[0] ?? 0) || (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
  pad.y = dead(gp.axes[1] ?? 0) || (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
  pad.dash = b(0) || b(5) || b(7);
  if (b(9) && !pad.start) togglePause();
  if (b(0) && !pad.a) {
    if (state === "over") start();
    else if (state === "choosing") pick(0);
  }
  pad.start = b(9);
  pad.a = b(0);
}

/* ------------------------------------------------------------------- hud */
const shown = {};
function put(key, value, apply) {
  if (shown[key] !== value) {
    shown[key] = value;
    apply(value);
  }
}
function hud() {
  const p = game.player,
    s = game.stats;
  put("hp", Math.ceil(p.hp), (v) => {
    $("hp").firstElementChild.style.transform = `scaleX(${clamp(v / s.maxHp, 0, 1)})`;
    $("hp-text").textContent = `${v} / ${s.maxHp}`;
  });
  put("xp", Math.round((game.xp / xpForLevel(game.level)) * 100), (v) => ($("xp").firstElementChild.style.transform = `scaleX(${v / 100})`));
  put("level", game.level, (v) => ($("level").textContent = `Level ${v}`));
  put("score", game.score, (v) => ($("score").textContent = formatInt(v)));
  put("clock", formatTime(game.time), (v) => ($("clock").textContent = v));
  put("kills", game.kills, (v) => ($("kills").textContent = `${formatInt(v)} tumbled`));
  put("dash", Math.round((1 - p.dashCd / s.dashEvery) * 36), (v) => dashButton.style.setProperty("--ready", `${v * 10}deg`));
}
function banner(text, small = "", ms = 1500) {
  const el = $("banner");
  el.replaceChildren(text);
  if (small) el.append(Object.assign(document.createElement("small"), { textContent: small }));
  el.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove("show"), ms);
}
function react(g, quiet = false) {
  for (const e of g.drainEvents()) {
    renderer.handle(e);
    if (quiet) continue;
    const loud = soundBudget > 0; // cap the noises per frame so a pile-up stays musical
    switch (e.type) {
      case "bonk":
        if (loud) juke.bonk(), soundBudget--;
        break;
      case "bump":
        if (loud) juke.bonk(true), soundBudget--;
        break;
      case "slip":
        if (loud && e.depth === 0) juke.slip(), soundBudget--;
        break;
      case "ko":
        if (loud) juke.pop(), soundBudget--;
        break;
      case "throw":
        juke.toss();
        break;
      case "pickup":
        if (loud) juke.pickup(), soundBudget--;
        break;
      case "thunk":
      case "crash":
        juke.thunk();
        break;
      case "dash":
        juke.dash();
        break;
      case "hurt":
        juke.hurt();
        navigator.vibrate?.(40);
        break;
      case "level":
        juke.level();
        break;
      case "combo":
        juke.combo(e.n);
        banner(e.label, `${e.n} from one peel`);
        break;
      case "boss":
        juke.boss();
        banner("The king is here", "He cannot be tipped. Make him hit a palm.", 2600);
        break;
      case "bossDown":
        banner("The king is down", "Two upgrades for you.", 2000);
        break;
      case "over":
        juke.over();
        navigator.vibrate?.([80, 40, 140]);
        dieAt = performance.now() + 1300;
        setState("dying");
        break;
    }
  }
}

/* ---------------------------------------------------------------- phases */
function start() {
  game = new Game({ seed: (Math.random() * 2 ** 32) >>> 0 });
  id = runId();
  acc = 0;
  for (const k of Object.keys(shown)) delete shown[k];
  renderer.reset();
  renderer.cam.x = game.player.x;
  renderer.cam.y = game.player.y;
  setState("playing");
  hud();
  juke.start();
  juke.heat = 0;
  banner("Run!", "Peels fly on their own. You just stay alive.", 2200);
  canvas.focus({ preventScroll: true });
}
function showChoices() {
  setState("choosing");
  $("choose-title").textContent = `Level ${game.level - game.pendingLevels + 1}. Pick one`;
  const box = $("choices");
  box.replaceChildren();
  game.choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    const name = Object.assign(document.createElement("b"), { textContent: c.name }),
      text = Object.assign(document.createElement("span"), { textContent: c.text }),
      rank = Object.assign(document.createElement("small"), { textContent: c.rank === 1 ? "New" : `Rank ${c.rank} of ${c.max}` }),
      key = Object.assign(document.createElement("kbd"), { textContent: String(i + 1) });
    b.append(name, text, rank, key);
    b.addEventListener("click", () => pick(i));
    box.append(b);
  });
  box.firstElementChild?.focus({ preventScroll: true });
}
function pick(i) {
  if (state !== "choosing" || !game.choose(i)) return;
  react(game);
  if (game.status === "choosing") showChoices();
  else {
    setState("playing");
    last = performance.now();
    acc = 0;
    canvas.focus({ preventScroll: true });
  }
}
function togglePause() {
  if (state === "playing") {
    juke.stop();
    const list = $("build");
    list.replaceChildren();
    for (const u of UPGRADES)
      if (game.ranks[u.id]) list.append(Object.assign(document.createElement("li"), { textContent: `${u.name} ${game.ranks[u.id]}` }));
    if (!list.children.length) list.append(Object.assign(document.createElement("li"), { textContent: "No upgrades yet" }));
    setState("paused");
    $("btn-resume").focus();
  } else if (state === "paused") {
    setState("playing");
    last = performance.now();
    acc = 0;
    juke.start();
    canvas.focus({ preventScroll: true });
  }
}
function toMenu() {
  game = null;
  newDemo();
  setState("menu");
  juke.heat = 0;
  showBest();
}
function showBest() {
  const best = board.readLocal()[0];
  $("best").textContent = best ? `${formatInt(best.score)} points in ${formatTime(best.elapsed)}` : "none yet";
}
function finish() {
  setState("over");
  const previous = board.readLocal()[0]?.score ?? 0,
    record = makeRecord(game, player, id),
    status = $("save-status");
  $("over-kicker").textContent = game.score > previous && previous > 0 ? "A new best. Also, the troop got you" : "The troop got you";
  $("final-score").textContent = formatInt(game.score);
  $("st-time").textContent = formatTime(game.time);
  $("st-kills").textContent = formatInt(game.kills);
  $("st-chain").textContent = formatInt(game.bestChain);
  $("st-level").textContent = String(game.level);
  const { persisted } = board.addLocal(record),
    local = persisted ? "Saved on this device." : "This browser blocks storage, so the score lasts until you close the tab.";
  if (!isLiveSite()) status.textContent = `${local} Shared rankings work on whatthe.ai.`;
  else {
    const mine = id;
    status.textContent = "Sending your run to the ranking…";
    board.saveGlobal(record).then(
      () => mine === id && (status.textContent = "Your run is in the ranking."),
      () => mine === id && (status.textContent = `Could not reach the shared ranking. ${local}`),
    );
  }
  $("btn-again").focus();
}

/* -------------------------------------------------------------- rankings */
let boardRequest = 0;
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  records.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.id === id) li.className = "me";
    for (const [cls, text] of [["", i + 1], ["name", r.playerName], ["extra", `${formatTime(r.elapsed)}, level ${r.level}`], ["score", formatInt(r.score)]]) {
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
  if (which === "local") return fillBoard(board.readLocal(), "No runs on this device yet.");
  fillBoard([], isLiveSite() ? "Loading…" : "Shared rankings work on whatthe.ai. This is a preview copy.");
  if (!isLiveSite()) return;
  try {
    const records = await board.fetchGlobal({ limit: 25 });
    if (request === boardRequest) fillBoard(records, "No runs yet. Be the first.");
  } catch {
    if (request === boardRequest) fillBoard([], "The ranking did not answer. Try again in a moment.");
  }
}

/* -------------------------------------------------------------- controls */
function setMuted(value, byUser = true) {
  muted = value;
  store.set("muted", value);
  juke.sound.setMuted(value);
  if (!value && byUser) juke.start();
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
$("player").value = player;
$("begin").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cleanName($("player").value);
  if (name && !nameAllowed(name)) {
    $("name-error").textContent = "Please pick a different nickname.";
    $("player").focus();
    return;
  }
  $("name-error").textContent = "";
  player = name;
  store.set("name", name);
  juke.sound.unlock();
  start();
});
$("btn-again").addEventListener("click", start);
$("btn-menu").addEventListener("click", toMenu);
$("btn-quit").addEventListener("click", toMenu);
$("btn-resume").addEventListener("click", togglePause);
$("btn-pause").addEventListener("click", togglePause);
$("btn-sound").addEventListener("click", () => setMuted(!muted));
$("btn-motion").addEventListener("click", () => setReduced(!reduced));
$("btn-help").addEventListener("click", () => $("dlg-help").showModal());
$("btn-ranks").addEventListener("click", () => openBoard("global"));
$("btn-over-ranks").addEventListener("click", () => openBoard("global"));
$("btn-best").addEventListener("click", () => openBoard("local"));
$("btn-share").addEventListener("click", async () => {
  const result = await share({
    title: "Banana Survivors",
    text: `I tumbled ${formatInt(game.kills)} monkeys and scored ${formatInt(game.score)} in Banana Survivors: Peel Out.`,
    url: PAGE,
  });
  if (result === "copied") $("save-status").textContent = "Copied. Paste it anywhere.";
  if (result === "failed") $("save-status").textContent = "Sharing is not available in this browser.";
});
$("music-volume").value = String(Math.round(juke.sound.musicVolume * 100));
$("music-volume").addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  juke.sound.setMusicVolume(v);
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
    juke.stop();
  } else if (state === "menu" || state === "over") juke.start();
});
addEventListener("blur", () => state === "playing" && togglePause());
coarse.addEventListener?.("change", () => setState(state));

/* ------------------------------------------------------------------ loop */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000 || 0, 0, 0.1);
  last = now;
  pollPad();
  soundBudget = 4;
  if (state === "menu") {
    if (demo.status === "over" || demo.time > 150) newDemo();
    if (demo.status === "choosing") demo.choose(0);
    if (demoTick++ % 5 === 0) demoInput = autopilot(demo);
    demo.update(Math.min(dt, 0.033), demoInput);
    react(demo, true);
    renderer.draw(demo, dt, { reduced, dim: 0.42 });
    return;
  }
  if (state === "playing") {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5 && state === "playing") {
      game.update(STEP, readInput());
      acc -= STEP;
      steps++;
      react(game);
      if (game.status === "choosing" && state === "playing") showChoices();
    }
    if (steps === 5) acc = 0;
    juke.heat = game.time > 150 ? 2 : game.time > 45 ? 1 : 0;
    hud();
  }
  renderer.draw(game, state === "playing" || state === "dying" ? dt : 0, {
    reduced,
    dim: state === "over" ? 0.55 : state === "paused" || state === "choosing" ? 0.45 : 0,
  });
  if (state === "dying" && now >= dieAt) finish();
}

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__banana = { get game() { return game; }, get demo() { return demo; }, get state() { return state; } };

setMuted(muted, false);
setReduced(reduced);
newDemo();
layout();
setState("menu");
showBest();
requestAnimationFrame(frame);
