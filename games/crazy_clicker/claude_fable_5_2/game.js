// Crazy Clicker (Claude Fable 5.2): stage, sound and the tricks.
import { clamp, prefs, cleanName, nameAllowed, formatInt, runId, share, isLiveSite, Sound, TAU } from "../../../js/fable/kit.js?v=1";
import { Session, TOLERANCE_MS, GRACE_MAX, verdict } from "./engine.js?v=1";
import { board, makeRecord } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const store = prefs("cc_fable_"),
  sound = new Sound(),
  session = new Session(),
  canvas = $("stage"),
  g = canvas.getContext("2d"),
  motion = matchMedia("(prefers-reduced-motion: reduce)"),
  PAGE = "https://whatthe.ai/games/crazy_clicker/claude_fable_5_2/game.html";
const PALETTE = {
  base: ["#ffd60a", "#0d0d0d"],
  solo: ["#ff8fb1", "#0d0d0d"],
  dark: ["#0d0d0d", "#f6f1df"],
  rush: ["#6f9bff", "#0d0d0d"],
  sway: ["#74e0a0", "#0d0d0d"],
  drag: ["#ff7a45", "#0d0d0d"],
  flash: ["#c9a2ff", "#0d0d0d"],
  poly: ["#4fe0e0", "#0d0d0d"],
};
const EARLY = "#1f4bff",
  LATE = "#e0003c";

let phase = "start", // start | live | result
  muted = store.get("muted", "false") === "true",
  reduced = store.get("reduced", String(motion.matches)) === "true",
  player = cleanName(store.get("name", "")),
  id = "",
  ink = "#0d0d0d",
  stageKey = "",
  fx = { dark: false, flash: false, flashNext: 0, ring: 1 },
  rivals = [],
  ripples = [],
  punchAt = -1e9,
  view = { w: 1, h: 1, dpr: 1 };
sound.muted = muted;

/* ----------------------------------------------------------------- sound */
const audioTime = (perfMs) => sound.now + Math.max(0, perfMs - performance.now()) / 1000;
function drum(quality) {
  sound.tone({ freq: 165, to: 48, dur: 0.2, type: "sine", gain: 0.55, attack: 0.002 });
  sound.noise({ dur: 0.03, gain: 0.12, freq: 2400, q: 0.6 });
  if (quality === "perfect") sound.tone({ freq: 1320, dur: 0.16, type: "triangle", gain: 0.07 });
}
const VOICES = {
  aid: { freq: 1000, type: "square", gain: 0.06, dur: 0.03, pan: 0 },
  rush: { freq: 760, type: "triangle", gain: 0.22, dur: 0.06, pan: 0.6 },
  drag: { freq: 420, type: "triangle", gain: 0.16, dur: 0.07, pan: -0.6 },
  poly: { freq: 1560, type: "sine", gain: 0.16, dur: 0.05, pan: 0.3 },
};
const click = (perfMs, voice) => sound.tone({ ...VOICES[voice], at: audioTime(perfMs) });
function bang() {
  sound.noise({ dur: 0.18, gain: 0.3, freq: 900 + Math.random() * 2600, q: 0.5 });
  sound.tone({ freq: 90 + Math.random() * 60, to: 40, dur: 0.2, type: "sine", gain: 0.3 });
}
function fanfare(up) {
  (up ? [392, 523, 659] : [330, 262]).forEach((f, k) => sound.tone({ freq: f, dur: 0.14, type: "square", gain: 0.05, at: sound.now + k * 0.07 }));
}

/* ----------------------------------------------------------------- stage */
function paint(key) {
  const [bg, fg] = PALETTE[key] ?? PALETTE.base;
  ink = fg;
  document.documentElement.style.setProperty("--bg", bg);
  document.documentElement.style.setProperty("--ink", fg);
  document.querySelector('meta[name="theme-color"]').content = bg;
}
function caption(title, line = "") {
  const el = $("caption");
  $("cap-title").textContent = title;
  $("cap-line").textContent = line;
  el.hidden = false;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}
function clearTricks() {
  fx = { dark: false, flash: false, flashNext: 0, ring: 1 };
  rivals = [];
  $("sway").classList.remove("on");
  document.body.classList.remove("flash");
}
function applyStage(stage) {
  const key = `${stage.kind}:${stage.number}`;
  if (key === stageKey) return;
  stageKey = key;
  clearTricks();
  if (stage.kind !== "act") {
    paint("base");
    if (stage.kind === "rest") {
      caption("Breathe", "The click is back for four beats.");
      fanfare(true);
    }
    return;
  }
  const beat = session.beatMs,
    from = session.nextBeatAt,
    tricks = [stage.act.id, stage.extra?.id].filter(Boolean),
    harder = stage.level - 1;
  for (const trick of tricks) {
    if (trick === "dark") fx.dark = true;
    if (trick === "sway") {
      if (reduced) rivals.push({ voice: "rush", interval: beat * 0.86, next: from });
      else $("sway").classList.add("on");
    }
    if (trick === "rush") rivals.push({ voice: "rush", interval: beat * Math.max(0.78, 0.89 - 0.02 * harder), next: from });
    if (trick === "drag") {
      fx.ring = 1.14 + 0.03 * harder;
      rivals.push({ voice: "drag", interval: beat * fx.ring, next: from });
    }
    if (trick === "poly") rivals.push({ voice: "poly", interval: (beat * 2) / 3, next: from });
    if (trick === "flash") {
      fx.flash = true;
      fx.flashNext = from + beat * 0.4;
    }
  }
  paint(fx.dark ? "dark" : stage.act.id);
  caption(
    `Act ${stage.number}: ${stage.extra ? `${stage.act.name}, and ${stage.extra.name.toLowerCase()}` : stage.act.name}`,
    stage.act.line,
  );
  fanfare(false);
}
function showGrace() {
  const el = $("grace");
  el.replaceChildren();
  for (let i = 0; i < GRACE_MAX; i++) {
    const dot = document.createElement("i");
    if (i < session.grace) dot.className = "on";
    el.append(dot);
  }
  el.setAttribute("aria-label", session.grace ? `${session.grace} spare ${session.grace === 1 ? "miss" : "misses"}` : "No spare misses");
}

/* ------------------------------------------------------------------ taps */
function tap(at) {
  if (phase !== "live") return;
  sound.unlock();
  const r = session.tap(at);
  switch (r.kind) {
    case "first":
      drum();
      punchAt = at;
      $("score").textContent = "1";
      caption("One", "Now the second tap. The gap between them is your beat.");
      break;
    case "tooFast":
      caption("Too quick", "Leave at least a third of a second between the two.");
      break;
    case "tooSlow":
      drum();
      punchAt = at;
      caption("Too slow to be a beat", "That tap counts as your new first one.");
      break;
    case "lock":
      drum("perfect");
      punchAt = at;
      $("score").textContent = "2";
      $("tempo").textContent = `${r.bpm} beats a minute`;
      caption(`${r.bpm} beats a minute`, "That is your beat. Keep it. The click will help for eight.");
      showGrace();
      if (session.stage.aid) click(session.nextBeatAt, "aid");
      break;
    case "hit":
      drum(r.quality);
      punchAt = at;
      ripples.push({ at, color: r.quality === "perfect" ? ink : r.quality === "early" ? EARLY : LATE, big: r.quality === "perfect" });
      $("score").textContent = formatInt(r.score);
      if (r.earned) {
        showGrace();
        fanfare(true);
      }
      applyStage(r.stage);
      if (r.stage.aid) click(session.nextBeatAt, "aid");
      break;
    case "grace":
      sound.tone({ freq: 220, to: 140, dur: 0.25, type: "sawtooth", gain: 0.12 });
      ripples.push({ at, color: LATE, big: true });
      showGrace();
      caption("Spare used", r.reason === "early" ? "That tap was far too early. Forgiven." : "You missed one. Forgiven.");
      if (r.reason === "missed" && session.stage.aid) click(session.nextBeatAt, "aid");
      break;
    case "over":
      finish(r);
      break;
  }
}
function isControl(target) {
  return !!target.closest?.("button, a, input, dialog, .card");
}
$("game").addEventListener("pointerdown", (e) => {
  if (phase !== "live" || isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  tap(e.timeStamp);
});
addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.code === "Space" || e.code === "Enter") {
    if (phase === "live") {
      e.preventDefault();
      if (!e.repeat) tap(e.timeStamp);
    } else if (phase === "result" && !e.repeat && e.target.tagName !== "BUTTON") begin();
  } else if (e.code === "Escape" && phase === "live") toStart();
});

/* ------------------------------------------------------------- lifecycle */
function setPhase(next) {
  phase = next;
  document.body.dataset.phase = next;
  $("start").hidden = next !== "start";
  $("result").hidden = next !== "result";
  $("readout").hidden = next !== "live";
  if (next !== "live") $("caption").hidden = true;
}
function begin() {
  session.reset();
  id = runId();
  stageKey = "";
  ripples = [];
  clearTricks();
  paint("base");
  $("score").textContent = "0";
  $("tempo").textContent = "";
  $("grace").replaceChildren();
  setPhase("live");
  caption("Tap twice", "Any steady pace between a slow walk and a sprint.");
}
function toStart() {
  session.reset();
  clearTricks();
  paint("base");
  setPhase("start");
  showBest();
}
function showBest() {
  const best = board.readLocal()[0];
  $("best").textContent = best ? `${formatInt(best.score)} beats at ${best.bpm} a minute` : "nothing yet";
}
function finish(r) {
  clearTricks();
  paint("base");
  sound.tone({ freq: 300, to: 60, dur: 0.6, type: "sawtooth", gain: 0.16 });
  sound.noise({ dur: 0.4, gain: 0.2, freq: 1200, to: 150 });
  navigator.vibrate?.(120);
  const s = session.summary(),
    previous = board.readLocal()[0]?.score ?? 0,
    status = $("save-status");
  setPhase("result");
  $("result-kicker").textContent =
    r.reason === "early"
      ? `You tapped ${Math.round(-r.error)} ms too early`
      : `You let a beat go by${r.stage.kind === "act" ? ` in “${r.stage.act.name}”` : ""}`;
  $("final-score").textContent = formatInt(s.score);
  $("verdict").textContent = (s.score > previous && previous > 0 ? "A new best. " : "") + verdict(s);
  $("st-bpm").textContent = s.bpm ? `${s.bpm} bpm` : "–";
  $("st-acts").textContent = String(s.acts);
  $("st-error").textContent = session.taps.length ? `${s.meanAbsError} ms` : "–";
  $("st-perfect").textContent = formatInt(s.perfects);
  drawTrace();
  $("trace-note").textContent = !session.taps.length
    ? "No kept beats to draw yet."
    : (s.tendency === "steady"
        ? "On average you sat right on the beat."
        : `On average you were ${s.tendency} by ${Math.abs(s.meanError)} ms.`) +
      (s.worst ? ` You ${s.worst.tendency} most during “${s.worst.act.name}”.` : "");
  if (s.score < 2) {
    status.textContent = "Set a beat with two taps to get on the board.";
    return;
  }
  const record = makeRecord(s, player, id),
    { persisted } = board.addLocal(record),
    local = persisted ? "Saved on this device." : "This browser blocks storage, so the score lasts until you close the tab.";
  if (!isLiveSite()) status.textContent = `${local} Shared rankings work on whatthe.ai.`;
  else {
    const mine = id;
    status.textContent = "Sending your streak to the ranking…";
    board.saveGlobal(record).then(
      () => mine === id && (status.textContent = "Your streak is in the ranking."),
      () => mine === id && (status.textContent = `Could not reach the shared ranking. ${local}`),
    );
  }
  $("btn-again").focus({ preventScroll: true });
}

/* --------------------------------------------------------------- drawing */
function resize() {
  const r = canvas.getBoundingClientRect(),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  view = { w: r.width, h: r.height, dpr };
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
new ResizeObserver(resize).observe(canvas);
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(),
    { w, h, dpr } = view,
    live = session.phase === "live";
  if (phase === "live") {
    const ended = session.tick(now);
    if (ended) {
      if (ended.kind === "over") finish(ended);
      else handleGrace(ended);
    }
    for (const rival of rivals)
      while (rival.next < now + 120) {
        if (rival.next > now - 20) click(rival.next, rival.voice);
        rival.next += rival.interval;
      }
    if (fx.flash && now >= fx.flashNext) {
      bang();
      fx.flashNext = now + session.beatMs * (0.35 + Math.random() * 0.9);
      if (!reduced) {
        document.body.classList.add("flash");
        setTimeout(() => document.body.classList.remove("flash"), 90);
      }
    }
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cx = w / 2,
    cy = h * 0.46,
    R = Math.min(w, h * 0.62) * 0.2,
    since = now - punchAt,
    punch = since < 140 ? 1 - 0.07 * Math.sin((since / 140) * Math.PI) : 1,
    idle = phase !== "live" || !live ? 1 + 0.02 * Math.sin(now / 420) : 1;
  g.lineCap = "round";
  if (fx.dark && phase === "live") {
    g.globalAlpha = 0.22;
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
    return;
  }
  if (live) {
    const beat = session.beatMs,
      reach = R * 0.9,
      zone = (reach * TOLERANCE_MS) / beat;
    g.fillStyle = ink;
    g.globalAlpha = 0.14;
    g.beginPath();
    g.arc(cx, cy, R + zone, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    const t = (now - session.lastHitAt) / (beat * fx.ring),
      r = R + (1 - t) * reach;
    if (r > 4) {
      g.strokeStyle = ink;
      g.lineWidth = 7;
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.stroke();
    }
  }
  g.fillStyle = ink;
  g.beginPath();
  g.arc(cx, cy, R * punch * idle, 0, TAU);
  g.fill();
  for (const rp of ripples) {
    const k = (now - rp.at) / 520;
    if (k >= 1) continue;
    g.globalAlpha = 1 - k;
    g.strokeStyle = rp.color;
    g.lineWidth = (rp.big ? 12 : 7) * (1 - k);
    g.beginPath();
    g.arc(cx, cy, R * (1 + k * (rp.big ? 1.0 : 0.7)), 0, TAU);
    g.stroke();
  }
  g.globalAlpha = 1;
  ripples = ripples.filter((rp) => now - rp.at < 520);
  if (live && session.taps.length) tape(w, h);
}
function handleGrace(r) {
  sound.tone({ freq: 220, to: 140, dur: 0.25, type: "sawtooth", gain: 0.12 });
  showGrace();
  caption("Spare used", "You missed one. Forgiven.");
  if (session.stage.aid) click(session.nextBeatAt, "aid");
  void r;
}
function dot(ctx, x, y, t, r = 5) {
  ctx.fillStyle = t.quality === "perfect" ? ink : t.quality === "early" ? EARLY : LATE;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function tape(w, h) {
  // the last taps, newest on the right: above the line is early
  const mid = h * (1 - 0.08 / 1.16) - 46, // the canvas overhangs the screen by 8% so the sway has no edges
    half = 26,
    step = Math.min(30, (w - 60) / 26),
    taps = session.taps.slice(-26),
    x0 = w / 2 - ((taps.length - 1) * step) / 2;
  g.fillStyle = ink;
  g.globalAlpha = 0.1;
  g.fillRect(x0 - 16, mid - half, (taps.length - 1) * step + 32, half * 2);
  g.globalAlpha = 0.45;
  g.fillRect(x0 - 16, mid - 1, (taps.length - 1) * step + 32, 2);
  g.globalAlpha = 1;
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.beginPath();
  taps.forEach((t, i) => {
    const x = x0 + i * step,
      y = mid + (t.error / TOLERANCE_MS) * half;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
  taps.forEach((t, i) => dot(g, x0 + i * step, mid + (t.error / TOLERANCE_MS) * half, t, i === taps.length - 1 ? 7 : 4.5));
}
function drawTrace() {
  const c = $("trace"),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = c.clientWidth || 480,
    h = c.clientHeight || 110,
    ctx = c.getContext("2d"),
    taps = session.taps,
    n = Math.max(taps.length, 2),
    X = (i) => 10 + (i / (n - 1)) * (w - 20),
    Y = (e) => h / 2 + (e / TOLERANCE_MS) * (h / 2 - 10);
  c.width = w * dpr;
  c.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let from = -1;
  taps.forEach((t, i) => {
    // shade the acts so the trouble is visible
    const act = t.kind === "act";
    if (act && from < 0) from = i;
    if (from >= 0 && (!act || i === taps.length - 1)) {
      ctx.fillStyle = "rgba(13,13,13,0.09)";
      ctx.fillRect(X(from) - 3, 0, X(act ? i : i - 1) - X(from) + 6, h);
      from = -1;
    }
  });
  ctx.fillStyle = "rgba(13,13,13,0.5)";
  ctx.fillRect(0, h / 2 - 1, w, 2);
  ctx.strokeStyle = "#0d0d0d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  taps.forEach((t, i) => (i ? ctx.lineTo(X(i), Y(t.error)) : ctx.moveTo(X(i), Y(t.error))));
  ctx.stroke();
  const keepInk = ink;
  ink = "#0d0d0d";
  taps.forEach((t, i) => dot(ctx, X(i), Y(t.error), t, taps.length > 90 ? 2.2 : 3.6));
  ink = keepInk;
  ctx.fillStyle = "rgba(13,13,13,0.7)";
  ctx.font = "600 11px 'Hanken Grotesk', sans-serif";
  ctx.fillText("early", 6, 13);
  ctx.fillText("late", 6, h - 6);
}

/* -------------------------------------------------------------- rankings */
let boardRequest = 0;
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  records.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.id === id) li.className = "me";
    for (const [cls, text] of [["", i + 1], ["name", r.playerName], ["extra", `${r.bpm} bpm, ±${r.meanAbsError} ms`], ["score", formatInt(r.score)]]) {
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
  if (which === "local") return fillBoard(board.readLocal(), "No streaks on this device yet.");
  fillBoard([], isLiveSite() ? "Loading…" : "Shared rankings work on whatthe.ai. This is a preview copy.");
  if (!isLiveSite()) return;
  try {
    const records = await board.fetchGlobal({ limit: 25 });
    if (request === boardRequest) fillBoard(records, "No streaks yet. Be the first.");
  } catch {
    if (request === boardRequest) fillBoard([], "The ranking did not answer. Try again in a moment.");
  }
}

/* -------------------------------------------------------------- controls */
function setMuted(value, byUser = true) {
  muted = value;
  store.set("muted", value);
  sound.setMuted(value);
  if (!value && byUser) sound.unlock();
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
  $("btn-motion").textContent = `Reduce motion: ${value ? "on" : "off"}`;
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
  sound.unlock();
  document.activeElement?.blur?.();
  begin();
});
$("btn-again").addEventListener("click", begin);
$("btn-sound").addEventListener("click", () => setMuted(!muted));
$("btn-motion").addEventListener("click", () => setReduced(!reduced));
$("btn-help").addEventListener("click", () => $("dlg-help").showModal());
$("btn-ranks").addEventListener("click", () => openBoard("global"));
$("btn-result-ranks").addEventListener("click", () => openBoard("global"));
$("btn-best").addEventListener("click", () => openBoard("local"));
$("btn-share").addEventListener("click", async () => {
  const s = session.summary(),
    result = await share({
      title: "Crazy Clicker",
      text: `I held ${formatInt(s.score)} beats at ${s.bpm} a minute through ${s.acts} ${s.acts === 1 ? "act" : "acts"} of Crazy Clicker.`,
      url: PAGE,
    });
  if (result === "copied") $("save-status").textContent = "Copied. Paste it anywhere.";
  if (result === "failed") $("save-status").textContent = "Sharing is not available in this browser.";
});
for (const tab of document.querySelectorAll("#dlg-ranks [data-board]"))
  tab.addEventListener("click", () => openBoard(tab.dataset.board));
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
}
document.addEventListener("visibilitychange", () => {
  // a hidden tab cannot keep time: end the run quietly instead of failing it on return
  if (document.hidden && phase === "live") toStart();
});

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__crazyClicker = { session, tap, get phase() { return phase; } };

setMuted(muted, false);
setReduced(reduced);
resize();
toStart();
requestAnimationFrame(frame);
