// Leos Smash Racer — Claude Fable 5.2 edition. The page around the race:
// garage, colour cube, big buttons, sounds, and the board at the end.
import { prefs, formatInt, runId, isLiveSite, clamp, rng, TAU, Sound } from "../../../js/fable/kit.js?v=1";
import { Race, CARS, TRACKS, STEP, driver } from "./sim.js?v=1";
import { Renderer } from "./render.js?v=1";
import { scramble, turn, isSolved, solve } from "./cube.js?v=1";
import { board, makeRecord, NAME_A, NAME_B } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const store = prefs("leoRacerFable.");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const sound = new Sound();

// ---------- words, in English and German ----------
const TEXT = {
  en: {
    title: "Leos Smash Racer, Claude Fable 5.2 edition",
    by: "A racing game designed by Leo, age 4. Smash everything.",
    pickCar: "Pick a car",
    pickTrack: "Pick a road",
    helper: "Helper on: the car steers a little by itself",
    cubeFirst: "Cube first, for a full boost",
    raceNow: "Race now",
    keys: "Steer with the arrow keys or the big buttons. Space is boost. H honks.",
    cubeTitle: "Make every side one colour",
    cubeHow: "Tap a side to turn it. Keys 1, 2 and 3 work too.",
    cubeDone: "Solved! Full boost!",
    cubeHint: "Tap the side that glows.",
    hint: "Show me",
    skip: "Skip",
    boost: "Boost",
    points: "points",
    alias: "Racing name:",
    again: "Again",
    garage: "Garage",
    ranks: "Rankings",
    everyone: "Everyone",
    device: "This device",
    go: "Go!",
    place: ["1st!", "2nd!", "3rd!", "4th", "5th", "6th", "7th", "8th"],
    detail: (n, combo, time) => `${n} toys smashed, best chain ×${combo}, ${time} seconds`,
    best: "New best on this device!",
    notSaved: "This browser would not keep the record.",
    previewOnly: "The shared board works on whatthe.ai. This copy keeps records on this device.",
    sending: "Sending…",
    sent: (name) => `${name} is on the shared board!`,
    refused: "The shared board refused this score. This board still has to be allowed in the site’s Firebase rules.",
    sendFailed: "The shared board did not answer. The record is still on this device.",
    empty: "No races here yet.",
    loading: "Loading…",
    loadFailed: "The shared board did not answer.",
    langLabel: "Sprache wechseln: Deutsch",
    langButton: "DE",
    withHelper: "helper",
    honk: "Honk!",
  },
  de: {
    title: "Leos Smash Racer, Claude Fable 5.2 Edition",
    by: "Ein Rennspiel, ausgedacht von Leo, 4 Jahre. Fahr alles um.",
    pickCar: "Such ein Auto aus",
    pickTrack: "Such eine Strecke aus",
    helper: "Hilfe an: Das Auto lenkt ein bisschen selbst",
    cubeFirst: "Erst der Würfel, für vollen Turbo",
    raceNow: "Gleich losfahren",
    keys: "Lenken mit den Pfeiltasten oder den grossen Knöpfen. Leertaste ist Turbo. H hupt.",
    cubeTitle: "Mach jede Seite einfarbig",
    cubeHow: "Tippe auf eine Seite, um sie zu drehen. Die Tasten 1, 2 und 3 gehen auch.",
    cubeDone: "Geschafft! Voller Turbo!",
    cubeHint: "Tippe auf die Seite, die leuchtet.",
    hint: "Zeig es mir",
    skip: "Überspringen",
    boost: "Turbo",
    points: "Punkte",
    alias: "Rennname:",
    again: "Nochmal",
    garage: "Garage",
    ranks: "Bestenliste",
    everyone: "Alle",
    device: "Dieses Gerät",
    go: "Los!",
    place: ["1. Platz!", "2. Platz!", "3. Platz!", "4. Platz", "5. Platz", "6. Platz", "7. Platz", "8. Platz"],
    detail: (n, combo, time) => `${n} Sachen umgefahren, beste Kette ×${combo}, ${time} Sekunden`,
    best: "Neuer Rekord auf diesem Gerät!",
    notSaved: "Dieser Browser wollte den Rekord nicht behalten.",
    previewOnly: "Die gemeinsame Bestenliste gibt es auf whatthe.ai. Diese Kopie speichert nur auf diesem Gerät.",
    sending: "Wird gesendet…",
    sent: (name) => `${name} steht auf der gemeinsamen Tafel!`,
    refused: "Die gemeinsame Tafel hat das Ergebnis abgelehnt. Sie muss in den Firebase-Regeln der Seite noch erlaubt werden.",
    sendFailed: "Die gemeinsame Tafel antwortet nicht. Der Rekord bleibt auf diesem Gerät.",
    empty: "Hier ist noch niemand gefahren.",
    loading: "Lädt…",
    loadFailed: "Die gemeinsame Tafel antwortet nicht.",
    langLabel: "Switch language: English",
    langButton: "EN",
    withHelper: "Hilfe",
    honk: "Tuut!",
  },
};
let lang = store.get("lang") || ((navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en");
const t = (key) => TEXT[lang][key] ?? TEXT.en[key];

function applyLanguage() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  $("btn-lang").textContent = t("langButton");
  $("btn-lang").setAttribute("aria-label", t("langLabel"));
  for (const b of document.querySelectorAll(".pick")) b.querySelector("span").textContent = b.item.name[lang];
  if (race?.status === "finished" && !attract) showFinishText();
}

// ---------- state ----------
const canvas = $("road"),
  renderer = new Renderer(canvas),
  game = $("game");
let carId = CARS.some((c) => c.id === store.get("car")) ? store.get("car") : "rocket",
  trackId = TRACKS.some((x) => x.id === store.get("track")) ? store.get("track") : "hills",
  race = null,
  attract = true, // the race behind the garage drives itself
  record = null,
  shown = { place: 0, score: -1 };
const input = { left: false, right: false, boost: false };
const setState = (s) => {
  game.dataset.state = s;
  $("garage").hidden = s !== "garage";
  $("cube").hidden = s !== "cube";
  $("finish").hidden = s !== "finish";
  $("hud").hidden = $("pads").hidden = s !== "race";
  if (s !== "race") $("count").textContent = "";
};

// ---------- sounds: all made on the spot ----------
const engine = {
  start() {
    const ctx = sound.unlock();
    if (!ctx || this.osc) return;
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc.connect(this.filter).connect(this.gain).connect(sound.fx);
    this.osc.start();
  },
  set(pct, boosting) {
    if (!this.osc) return;
    const now = sound.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(52 + pct * 88 + (boosting ? 36 : 0), now, 0.08);
    this.filter.frequency.setTargetAtTime(380 + pct * 900, now, 0.1);
    this.gain.gain.setTargetAtTime(sound.muted ? 0 : 0.045 + pct * 0.03, now, 0.1);
  },
  stop() {
    if (!this.osc) return;
    this.gain.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.08);
    const osc = this.osc;
    setTimeout(() => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.osc = null;
  },
};
const sfx = {
  smash(kind, combo) {
    if (kind === "duck") {
      sound.tone({ freq: 900, to: 500, dur: 0.12, type: "square", gain: 0.12 });
      sound.tone({ freq: 700, to: 420, dur: 0.14, type: "square", gain: 0.12, at: 0.13 });
    } else sound.noise({ dur: 0.22, gain: 0.3, freq: kind === "wall" ? 500 : 1400, to: 200, q: 0.8 });
    sound.tone({ freq: 392 * 2 ** ((combo - 1) / 6), dur: 0.14, type: "triangle", gain: 0.16 });
  },
  count: () => sound.tone({ freq: 440, dur: 0.18, type: "square", gain: 0.14 }),
  go: () => sound.tone({ freq: 880, dur: 0.5, type: "square", gain: 0.14 }),
  boost() {
    sound.noise({ dur: 0.9, gain: 0.22, freq: 300, to: 3200, q: 1.5 });
    sound.tone({ freq: 180, to: 720, dur: 0.6, type: "sawtooth", gain: 0.1 });
  },
  ready: () => [0, 4, 7].forEach((n, i) => sound.tone({ freq: 660 * 2 ** (n / 12), dur: 0.1, type: "triangle", gain: 0.14, at: i * 0.07 })),
  bump: () => sound.tone({ freq: 150, to: 70, dur: 0.16, type: "square", gain: 0.16 }),
  pass: () => sound.tone({ freq: 520, to: 1040, dur: 0.18, type: "triangle", gain: 0.12 }),
  honk() {
    sound.tone({ freq: 392, dur: 0.28, type: "square", gain: 0.12 });
    sound.tone({ freq: 494, dur: 0.28, type: "square", gain: 0.12 });
  },
  finish: (stars) => [0, 4, 7, 12, 16].slice(0, 2 + stars).forEach((n, i) => sound.tone({ freq: 523 * 2 ** (n / 12), dur: 0.22, type: "triangle", gain: 0.16, at: i * 0.13 })),
  turn: () => sound.noise({ dur: 0.08, gain: 0.16, freq: 2400, q: 2 }),
  tap: () => sound.tone({ freq: 620, dur: 0.06, type: "triangle", gain: 0.1 }),
};
function setMuted(muted) {
  sound.setMuted(muted);
  store.set("muted", muted ? "1" : "0");
  $("btn-sound").setAttribute("aria-pressed", String(!muted));
  $("btn-sound").textContent = muted ? "🔇" : "🔊";
  if (muted) engine.stop();
}

// ---------- garage ----------
function buildPicks(host, items, current, onPick, paint) {
  for (const item of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick";
    b.setAttribute("role", "radio");
    b.item = item;
    paint(b, item);
    b.append(document.createElement("span"));
    b.addEventListener("click", () => {
      sound.unlock();
      sfx.tap();
      onPick(item.id);
      for (const o of host.children) o.setAttribute("aria-checked", String(o === b));
    });
    b.setAttribute("aria-checked", String(item.id === current));
    host.append(b);
  }
}
buildPicks($("cars"), CARS, carId, (id) => {
  store.set("car", (carId = id));
  startAttract();
}, (b, car) => {
  const c = document.createElement("canvas");
  c.width = 168;
  c.height = 126;
  renderer.car(c.getContext("2d"), car, 84, 112, 128);
  b.append(c);
});
buildPicks($("tracks"), TRACKS, trackId, (id) => {
  store.set("track", (trackId = id));
  startAttract();
}, (b, track) => {
  const i = document.createElement("i");
  i.style.background = `linear-gradient(${track.sky[0]} 0 45%, ${track.grass[0]} 45% 62%, ${track.road[0]} 62%)`;
  b.append(i);
});
$("assist").checked = store.get("helper") !== "0";
$("assist").addEventListener("change", () => store.set("helper", $("assist").checked ? "1" : "0"));

function startAttract() {
  attract = true;
  race = new Race({ track: trackId, car: carId, assist: true });
  race.count = 0.01;
  renderer.reset();
}
function showGarage() {
  engine.stop();
  startAttract();
  setState("garage");
}
function startRace(boost = 0) {
  sound.unlock();
  attract = false;
  record = null;
  race = new Race({ track: trackId, car: carId, assist: $("assist").checked, boost });
  race.steerShown = 0;
  renderer.reset();
  shown = { place: 0, score: -1 };
  input.left = input.right = input.boost = false;
  setState("race");
  engine.start();
  canvas.focus?.();
}

// ---------- the colour cube ----------
const cube = { state: null, anim: null, hint: null, done: false, quads: [] };
const AXIS = { U: 1, R: 0, F: 2 };
const NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1] };
function rotate([x, y, z], face, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return face === "U" ? [x * c - z * s, y, x * s + z * c] : face === "R" ? [x, y * c + z * s, -y * s + z * c] : [x * c + y * s, -x * s + y * c, z];
}
function openCube() {
  sound.unlock();
  cube.state = scramble(rng((Date.now() & 0xffff) + 7), 3);
  cube.anim = cube.hint = null;
  cube.done = false;
  $("cube-status").textContent = "";
  setState("cube");
  drawCube();
}
function tapFace(face) {
  if (cube.done || cube.anim) return;
  cube.state = turn(cube.state, face);
  cube.hint = null;
  sfx.turn();
  cube.anim = { face, t: reduced.matches ? 1 : 0 };
  if (isSolved(cube.state)) {
    cube.done = true;
    $("cube-status").textContent = t("cubeDone");
    sfx.ready();
    setTimeout(() => game.dataset.state === "cube" && startRace(1), 1100);
  }
}
function drawCube(dt = 0) {
  const c = $("cube-view"),
    g = c.getContext("2d"),
    s = 74,
    cx = c.width / 2,
    cy = c.height / 2 + 22,
    k = Math.cos(Math.PI / 6);
  const project = ([x, y, z]) => [cx + (x - z) * k * s, cy + (x + z) * 0.5 * s - y * s];
  if (cube.anim) {
    cube.anim.t = Math.min(1, cube.anim.t + dt * 5);
    if (cube.anim.t >= 1) cube.anim = null;
  }
  const anim = cube.anim,
    angle = anim ? -(1 - (1 - (1 - anim.t) ** 3)) * (Math.PI / 2) : 0,
    faces = [];
  const add = (corners, normal, color, moving, face) => {
    if (moving) {
      corners = corners.map((p) => rotate(p, anim.face, angle));
      normal = rotate(normal, anim.face, angle);
    }
    if (normal[0] + normal[1] + normal[2] <= 0.01) return;
    const mid = corners.reduce((m, p) => [m[0] + p[0], m[1] + p[1], m[2] + p[2]], [0, 0, 0]);
    faces.push({ pts: corners.map(project), depth: mid[0] + mid[1] + mid[2], color, face });
  };
  for (const st of cube.state) {
    const ax = st.n.findIndex((v) => v),
      [a, b] = [0, 1, 2].filter((i) => i !== ax),
      corner = (da, db) => {
        const p = [0, 0, 0];
        p[ax] = st.n[ax];
        p[a] = st.p[a] * 0.5 + da * 0.5;
        p[b] = st.p[b] * 0.5 + db * 0.5;
        return p;
      };
    const face = Object.keys(NORMAL).find((f) => NORMAL[f].join() === st.n.join());
    add([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], st.n, st.c, anim && st.p[AXIS[anim.face]] === 1, face);
  }
  if (anim) {
    // the dark insides you glimpse while a layer turns
    const ax = AXIS[anim.face],
      [a, b] = [0, 1, 2].filter((i) => i !== ax),
      quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
        const p = [0, 0, 0];
        p[a] = u;
        p[b] = v;
        return p;
      });
    add(quad, NORMAL[anim.face], "#1c2340", false, null);
  }
  faces.sort((p, q) => p.depth - q.depth);
  g.clearRect(0, 0, c.width, c.height);
  g.lineJoin = "round";
  for (const f of faces) {
    g.beginPath();
    f.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = f.color;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#1c2340";
    g.stroke();
  }
  cube.quads = anim ? [] : faces.filter((f) => f.face);
  if (cube.hint && !anim) {
    const pulse = reduced.matches ? 1 : 0.5 + 0.5 * Math.sin(performance.now() / 140);
    for (const f of cube.quads.filter((q) => q.face === cube.hint)) {
      g.beginPath();
      f.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = `rgba(255,255,255,${0.45 * pulse})`;
      g.fill();
      g.lineWidth = 6 + 5 * pulse;
      g.strokeStyle = "#1c2340";
      g.stroke();
    }
  }
}
const inside = (pts, x, y) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
$("cube-view").addEventListener("pointerdown", (e) => {
  const c = e.currentTarget,
    r = c.getBoundingClientRect(),
    x = ((e.clientX - r.left) / r.width) * c.width,
    y = ((e.clientY - r.top) / r.height) * c.height;
  const hit = [...cube.quads].reverse().find((f) => inside(f.pts, x, y));
  if (hit) tapFace(hit.face);
});
$("btn-hint").addEventListener("click", () => {
  if (cube.done) return;
  cube.hint = solve(cube.state)?.[0] ?? null;
  $("cube-status").textContent = cube.hint ? t("cubeHint") : "";
});
$("btn-skip").addEventListener("click", () => startRace(0));
$("btn-cube").addEventListener("click", openCube);
$("btn-race").addEventListener("click", () => startRace(0));

// ---------- racing ----------
function honk() {
  sfx.honk();
  renderer.words.push({ x: renderer.view.w / 2, y: renderer.view.h * 0.62, text: t("honk"), life: 0.7, big: false });
}
function handle(e) {
  if (attract) {
    if (e.type === "smash") renderer.smash(race, e);
    return;
  }
  if (e.type === "count" || e.type === "go") {
    const el = $("count");
    el.textContent = e.type === "go" ? t("go") : String(e.n);
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    e.type === "go" ? sfx.go() : sfx.count();
    if (e.type === "go") setTimeout(() => race?.status !== "countdown" && (el.textContent = ""), 800);
  } else if (e.type === "smash") {
    renderer.smash(race, e);
    sfx.smash(e.kind, e.combo);
    if (navigator.vibrate && !reduced.matches) navigator.vibrate(12);
  } else if (e.type === "boost") sfx.boost();
  else if (e.type === "boostReady") sfx.ready();
  else if (e.type === "bump") sfx.bump();
  else if (e.type === "pass") sfx.pass();
  else if (e.type === "finish") finish();
}
function hud() {
  if (race.place !== shown.place) $("place").textContent = shown.place = race.place;
  if (race.score !== shown.score) $("score").textContent = formatInt((shown.score = race.score));
  $("progress").style.transform = `scaleX(${race.progress.toFixed(4)})`;
  const pad = $("pad-boost"),
    ready = race.boost >= 1 && race.boosting <= 0;
  pad.classList.toggle("ready", ready);
  pad.style.setProperty("--fill", `${Math.round((race.boosting > 0 ? race.boosting / 2.6 : race.boost) * 100)}%`);
  $("pad-left").classList.toggle("held", input.left);
  $("pad-right").classList.toggle("held", input.right);
}
function showFinishText() {
  $("finish-title").textContent = t("place")[race.place - 1];
  [...$("stars").children].forEach((star, i) => star.classList.toggle("off", i >= race.stars));
  $("stars").setAttribute("aria-label", `${race.stars} / 3`);
  $("final-score").textContent = formatInt(race.score);
  $("detail").textContent = t("detail")(race.smashed, race.bestCombo, race.time.toFixed(1));
}
const alias = () => `${$("alias-a").value} ${$("alias-b").value}`;
function finish() {
  engine.stop();
  sfx.finish(race.stars);
  const best = board.readLocal()[0]?.score ?? 0;
  record = makeRecord(race, alias(), runId());
  const { persisted } = board.addLocal(record);
  showFinishText();
  sendShared(record, !persisted ? t("notSaved") : race.score > best && best > 0 ? t("best") : "");
  setTimeout(() => {
    if (race?.status !== "finished" || attract) return;
    setState("finish");
    $("btn-again").focus();
  }, 1400);
}
// Every finished race goes to the shared board by itself, under the name picked in the garage.
async function sendShared(mine, note) {
  const status = $("save-status"),
    say = (text) => record === mine && (status.textContent = [note, text].filter(Boolean).join(" "));
  if (!isLiveSite()) return say(t("previewOnly"));
  say(t("sending"));
  try {
    await board.saveGlobal(mine);
    say(t("sent")(mine.playerName));
  } catch (error) {
    say(error?.code === "permission-denied" ? t("refused") : t("sendFailed"));
  }
}
for (const [sel, list, key] of [[$("alias-a"), NAME_A, "aliasA"], [$("alias-b"), NAME_B, "aliasB"]]) {
  for (const word of list) sel.append(new Option(word, word));
  if (list.includes(store.get(key))) sel.value = store.get(key);
  sel.addEventListener("change", () => store.set(key, sel.value));
}
$("btn-again").addEventListener("click", () => startRace(0));
$("btn-garage").addEventListener("click", showGarage);
$("btn-quit").addEventListener("click", showGarage);

// keys, buttons, and a finger anywhere on the road
const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "boost", ArrowUp: "boost", w: "boost", W: "boost" };
addEventListener("keydown", (e) => {
  if (e.target.closest?.("select, dialog")) return;
  const state = game.dataset.state;
  if (state === "cube" && "123".includes(e.key)) return tapFace("UFR"["123".indexOf(e.key)]);
  if (state !== "race") return;
  if (KEYS[e.key]) {
    input[KEYS[e.key]] = true;
    e.preventDefault();
  } else if ((e.key === "h" || e.key === "H") && !e.repeat) honk();
  else if (e.key === "Escape") showGarage();
});
addEventListener("keyup", (e) => KEYS[e.key] && (input[KEYS[e.key]] = false));
addEventListener("blur", () => (input.left = input.right = input.boost = false));
function hold(el, key) {
  const set = (v) => (e) => {
    e.preventDefault();
    input[key] = v;
    if (v) el.setPointerCapture?.(e.pointerId);
  };
  el.addEventListener("pointerdown", set(true));
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(type, set(false));
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}
hold($("pad-left"), "left");
hold($("pad-right"), "right");
hold($("pad-boost"), "boost");
$("pad-honk").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  honk();
});
const fingers = new Map();
const fingerSteer = () => {
  if (game.dataset.state !== "race") return;
  const sides = [...fingers.values()];
  input.left = sides.includes("left");
  input.right = sides.includes("right");
};
canvas.addEventListener("pointerdown", (e) => {
  if (game.dataset.state !== "race") return;
  fingers.set(e.pointerId, e.clientX < innerWidth / 2 ? "left" : "right");
  fingerSteer();
});
for (const type of ["pointerup", "pointercancel", "pointerleave"])
  canvas.addEventListener(type, (e) => fingers.delete(e.pointerId) && fingerSteer());

// ---------- rankings ----------
const dlg = $("dlg-ranks");
function fillBoard(records, emptyText) {
  const list = $("board");
  list.replaceChildren();
  $("board-status").textContent = records.length ? "" : emptyText;
  for (const r of records) {
    const li = document.createElement("li"),
      name = document.createElement("span"),
      extra = document.createElement("span"),
      score = document.createElement("span");
    name.className = "name";
    name.textContent = r.playerName;
    extra.className = "extra";
    extra.textContent = `${TRACKS.find((x) => x.id === r.track)?.name[lang] ?? ""}${r.helper ? `, ${t("withHelper")}` : ""}`;
    score.className = "score";
    score.textContent = formatInt(r.score);
    if (record && r.id === record.id) li.className = "me";
    li.append(name, extra, score);
    list.append(li);
  }
}
async function showBoard(which) {
  for (const b of dlg.querySelectorAll("[data-board]")) b.setAttribute("aria-pressed", String(b.dataset.board === which));
  if (which === "local") return fillBoard(board.readLocal(), t("empty"));
  fillBoard([], isLiveSite() ? t("loading") : t("previewOnly"));
  if (!isLiveSite()) return;
  try {
    fillBoard(await board.fetchGlobal({ limit: 25 }), t("empty"));
  } catch {
    $("board-status").textContent = t("loadFailed");
  }
}
$("btn-ranks").addEventListener("click", () => {
  dlg.showModal();
  showBoard(isLiveSite() ? "global" : "local");
});
dlg.addEventListener("click", (e) => {
  if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
  const tab = e.target.closest("[data-board]");
  if (tab) showBoard(tab.dataset.board);
});
$("btn-sound").addEventListener("click", () => {
  setMuted(!sound.muted);
  if (!sound.muted) {
    sound.unlock();
    sfx.tap();
  }
});
$("btn-lang").addEventListener("click", () => {
  store.set("lang", (lang = lang === "de" ? "en" : "de"));
  applyLanguage();
});

// ---------- the loop ----------
function resize() {
  renderer.resize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
resize();
let last = performance.now(),
  bank = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const state = game.dataset.state;
  if (document.hidden) return requestAnimationFrame(frame);
  if (state === "cube") drawCube(dt);
  if (race) {
    bank += attract && reduced.matches ? 0 : dt;
    while (bank >= STEP) {
      bank -= STEP;
      if (attract) {
        race.update(STEP * 0.6, driver(race, 0.6));
        if (race.status === "finished" && race.speed < 400) startAttract();
      } else {
        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        race.update(STEP, { steer, boost: input.boost });
        race.steerShown += (steer - race.steerShown) * 0.2;
      }
      for (const e of race.drainEvents()) handle(e);
    }
    if (!attract && race.status !== "finished") {
      hud();
      engine.set(race.speed / race.maxSpeed, race.boosting > 0);
    }
    renderer.draw(race, dt, { reduced: reduced.matches });
  }
  requestAnimationFrame(frame);
}

setMuted(store.get("muted") === "1");
document.title ||= t("title");
applyLanguage();
showGarage();
requestAnimationFrame(frame);
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__leo = { get race() { return race; }, get cube() { return cube; }, input, startRace, tapFace, solve: () => solve(cube.state) };
