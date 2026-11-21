// Leo's Fire Evolution — Claude Fable 5.2 edition. The page around the walk:
// start card, controls, music that grows as lanterns are lit, the form book,
// and the board at the end.
import { prefs, formatInt, runId, isLiveSite, clamp, Sound, Sequencer, midi } from "../../../js/fable/kit.js?v=1";
import { Visit, FORMS, PLACES, POINTS, STEP, guide } from "./world.js?v=1";
import { Renderer, portrait } from "./render.js?v=1";
import { board, makeRecord, NAME_A, NAME_B } from "./records.js?v=1";

const $ = (id) => document.getElementById(id);
const store = prefs("leoFireFable.");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const sound = new Sound();

// ---------- words, in English and German ----------
const TEXT = {
  en: {
    title: "Leo’s Fire Evolution, Claude Fable 5.2 edition",
    lead: "Ten places have gone dark. A lion cub with a small flame can light them again, and his fire grows into something new in each one.",
    how: "Hold a finger or the mouse where Leo should go, or use the arrow keys. Space makes him roar.",
    start: "Start",
    resume: (n) => `Go on: place ${n} of 10`,
    fresh: "Start over",
    freshSure: "Really start over?",
    forms: "Fire forms",
    ranks: "Rankings",
    everyone: "Everyone",
    device: "This device",
    roar: "Roar",
    points: "points",
    alias: "Name for the board:",
    post: "Post my score",
    again: "A new journey",
    next: "On to the next place",
    stop: "Stop here",
    evolved: "Leo’s fire has changed",
    lit: (name) => `${name} is lit`,
    coach1: "Hold a finger where Leo should go.",
    coach2: "Lanterns sleep in the dark. His flame leans toward the nearest one.",
    coach3: "Fireflies make every lantern worth more. Gather them first.",
    lantern: (n, of) => `Lantern ${n} of ${of}`,
    open: "Every lantern is lit. The gate is open.",
    scatter: (n) => (n === 1 ? "The wind took a firefly home." : `The wind took ${n} fireflies home.`),
    wake: { owl: "An owl woke up.", fox: "A fox woke up.", hedgehog: "A hedgehog woke up.", turtle: "A turtle woke up.", rabbit: "A rabbit woke up." },
    rowLanterns: "Lanterns",
    rowFireflies: "Fireflies",
    rowSleepers: "Sleepers woken",
    rowGate: "Through the gate",
    rowTotal: "This place",
    rowJourney: "Journey so far",
    endAll: "The night is lit",
    endAllText: "All ten places are bright again, and Leo carries the Eternal Flame.",
    endSome: (n) => (n === 1 ? "One place lit" : `${n} places lit`),
    endSomeText: "The journey ends here for now. The dark places will wait.",
    savedLocal: "Saved on this device.",
    notSaved: "This browser would not keep the record.",
    previewOnly: "The shared board works on whatthe.ai. This copy keeps records on this device.",
    sending: "Sending…",
    sent: "On the shared board!",
    sendFailed: "The shared board did not answer. The record is still on this device.",
    empty: "No journeys here yet.",
    loading: "Loading…",
    loadFailed: "The shared board did not answer.",
    places: (n) => `${n} of 10`,
    unknown: "Not found yet",
    langLabel: "Sprache wechseln: Deutsch",
    langButton: "DE",
    pips: (n, of) => `${n} of ${of} lanterns lit`,
  },
  de: {
    title: "Leo’s Fire Evolution, Claude Fable 5.2 Edition",
    lead: "Zehn Orte sind dunkel geworden. Ein Löwenjunges mit einer kleinen Flamme kann sie wieder hell machen, und an jedem Ort wird sein Feuer zu etwas Neuem.",
    how: "Halte den Finger oder die Maus dorthin, wo Leo hingehen soll, oder nimm die Pfeiltasten. Mit der Leertaste brüllt er.",
    start: "Los geht’s",
    resume: (n) => `Weiter: Ort ${n} von 10`,
    fresh: "Neu anfangen",
    freshSure: "Wirklich neu anfangen?",
    forms: "Feuerformen",
    ranks: "Bestenliste",
    everyone: "Alle",
    device: "Dieses Gerät",
    roar: "Brüll",
    points: "Punkte",
    alias: "Name für die Tafel:",
    post: "Punkte eintragen",
    again: "Eine neue Reise",
    next: "Weiter zum nächsten Ort",
    stop: "Hier aufhören",
    evolved: "Leos Feuer hat sich verwandelt",
    lit: (name) => `${name} leuchtet wieder`,
    coach1: "Halte den Finger dorthin, wo Leo hingehen soll.",
    coach2: "Im Dunkeln schlafen Laternen. Seine Flamme neigt sich zur nächsten.",
    coach3: "Mit Glühwürmchen zählt jede Laterne mehr. Sammle sie zuerst.",
    lantern: (n, of) => `Laterne ${n} von ${of}`,
    open: "Alle Laternen brennen. Das Tor ist offen.",
    scatter: (n) => (n === 1 ? "Der Wind hat ein Glühwürmchen heimgepustet." : `Der Wind hat ${n} Glühwürmchen heimgepustet.`),
    wake: { owl: "Eine Eule ist aufgewacht.", fox: "Ein Fuchs ist aufgewacht.", hedgehog: "Ein Igel ist aufgewacht.", turtle: "Eine Schildkröte ist aufgewacht.", rabbit: "Ein Hase ist aufgewacht." },
    rowLanterns: "Laternen",
    rowFireflies: "Glühwürmchen",
    rowSleepers: "Geweckte Schläfer",
    rowGate: "Durchs Tor",
    rowTotal: "Dieser Ort",
    rowJourney: "Die Reise bisher",
    endAll: "Die Nacht ist hell",
    endAllText: "Alle zehn Orte leuchten wieder, und Leo trägt die Ewige Flamme.",
    endSome: (n) => (n === 1 ? "Ein Ort leuchtet" : `${n} Orte leuchten`),
    endSomeText: "Hier endet die Reise fürs Erste. Die dunklen Orte warten.",
    savedLocal: "Auf diesem Gerät gespeichert.",
    notSaved: "Dieser Browser wollte den Eintrag nicht behalten.",
    previewOnly: "Die gemeinsame Bestenliste gibt es auf whatthe.ai. Diese Kopie speichert nur auf diesem Gerät.",
    sending: "Wird gesendet…",
    sent: "Steht auf der gemeinsamen Tafel!",
    sendFailed: "Die gemeinsame Tafel antwortet nicht. Der Eintrag bleibt auf diesem Gerät.",
    empty: "Hier ist noch niemand gereist.",
    loading: "Lädt…",
    loadFailed: "Die gemeinsame Tafel antwortet nicht.",
    places: (n) => `${n} von 10`,
    unknown: "Noch nicht entdeckt",
    langLabel: "Switch language: English",
    langButton: "EN",
    pips: (n, of) => `${n} von ${of} Laternen brennen`,
  },
};
let lang = store.get("lang") || ((navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en");
const t = (key) => TEXT[lang][key] ?? TEXT.en[key];

// ---------- state ----------
const canvas = $("night"),
  renderer = new Renderer(canvas),
  game = $("game");
const freshJourney = () => ({ id: runId(), next: 0, total: 0, stars: [] });
const usable = (j) =>
  !!j && typeof j.id === "string" && j.id.length <= 64 && Number.isInteger(j.next) && j.next >= 0 && j.next < PLACES.length && Number.isSafeInteger(j.total) && j.total >= 0 && Array.isArray(j.stars) && j.stars.length === j.next && j.stars.every((s) => [1, 2, 3].includes(s));
let journey = usable(store.json("journey")) ? store.json("journey") : freshJourney(),
  known = clamp(Math.max(Number(store.get("known")) || 1, journey.next + 1), 1, FORMS.length),
  visit = null,
  demo = true, // on the start card the cub finds his own way
  counts = null,
  sayTimer = 0,
  coach = 0;
const input = { left: false, right: false, up: false, down: false, roar: false };
const pointer = { held: false, x: 0, y: 0, goal: null, since: 0 };
const setState = (s) => {
  game.dataset.state = s;
  $("title").hidden = s !== "title";
  $("done").hidden = s !== "done";
  $("end").hidden = s !== "end";
  $("hud").hidden = $("btn-roar").hidden = s !== "walk";
  if (s !== "walk") say("");
};
function say(text, seconds = 4) {
  $("say").textContent = text;
  clearTimeout(sayTimer);
  if (text && seconds) sayTimer = setTimeout(() => ($("say").textContent = ""), seconds * 1000);
}

function applyLanguage() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  $("btn-lang").textContent = t("langButton");
  $("btn-lang").setAttribute("aria-label", t("langLabel"));
  $("btn-start").textContent = journey.next ? t("resume")(journey.next + 1) : t("start");
  $("btn-fresh").hidden = !journey.next;
  if (visit && !demo) fillHud();
}

// ---------- sound: every lantern is a note in the place's tune ----------
const music = new Sequencer(sound, 84, (step, at) => {
  if (!visit || sound.muted) return;
  const beat = step % 16,
    scale = visit.world.scale;
  if (beat === 0) sound.tone({ freq: midi(scale[0] - 24), dur: 2.6, type: "sine", gain: demo ? 0.03 : 0.06, attack: 0.4, at, bus: sound.music });
  for (const l of visit.world.lanterns)
    if (visit.lit.has(l.id) && l.beat === beat) {
      sound.tone({ freq: midi(l.note), dur: 0.7, type: "triangle", gain: demo ? 0.03 : 0.07, at, bus: sound.music, pan: (l.id % 3) - 1 });
      sound.tone({ freq: midi(l.note + 12), dur: 0.4, type: "sine", gain: 0.02, at: at + 0.18, bus: sound.music });
    }
  if (visit.status !== "walking" && beat % 2 === 0) sound.tone({ freq: midi(scale[(beat / 2) % scale.length] + 12), dur: 0.25, type: "sine", gain: 0.035, at, bus: sound.music });
});
const sfx = {
  gather: (n) => sound.tone({ freq: 900 * 2 ** ((n % 12) / 12), to: 1400 * 2 ** ((n % 12) / 12), dur: 0.09, type: "sine", gain: 0.07 }),
  light(note) {
    for (const [k, step] of [0, 7, 12].entries()) sound.tone({ freq: midi(note + step), dur: 0.9, type: "triangle", gain: 0.1, at: sound.now + k * 0.07 });
    sound.noise({ dur: 0.35, gain: 0.08, freq: 2400, to: 600, q: 0.7 });
  },
  wake: () => [0, 5].forEach((n, k) => sound.tone({ freq: midi(79 + n), dur: 0.16, type: "sine", gain: 0.09, at: sound.now + k * 0.12 })),
  roar() {
    sound.tone({ freq: 150, to: 62, dur: 0.6, type: "sawtooth", gain: 0.13 });
    sound.tone({ freq: 226, to: 90, dur: 0.5, type: "square", gain: 0.05 });
    sound.noise({ dur: 0.7, gain: 0.16, freq: 500, to: 2600, q: 0.6 });
  },
  scatter: () => sound.noise({ dur: 0.6, gain: 0.14, freq: 2200, to: 300, q: 1.2 }),
  open: (scale) => scale.forEach((n, k) => sound.tone({ freq: midi(n + 12), dur: 0.5, type: "triangle", gain: 0.09, at: sound.now + k * 0.09 })),
  done: (scale) => [0, 2, 4, 5].forEach((i, k) => sound.tone({ freq: midi(scale[i] + 12), dur: k === 3 ? 1.4 : 0.3, type: "triangle", gain: 0.11, at: sound.now + k * 0.16 })),
  tap: () => sound.tone({ freq: 520, dur: 0.06, type: "sine", gain: 0.07 }),
};
function wake() {
  if (sound.unlock()) music.start();
}
function setMuted(muted) {
  sound.setMuted(muted);
  store.set("muted", muted ? "1" : "0");
  $("btn-sound").setAttribute("aria-pressed", String(!muted));
  $("btn-sound").textContent = muted ? "🔇" : "🔊";
}

// ---------- walking ----------
function startDemo() {
  demo = true;
  visit = new Visit(journey.next);
  renderer.reset();
}
function showTitle() {
  startDemo();
  applyLanguage();
  setState("title");
}
function startVisit() {
  wake();
  demo = false;
  visit = new Visit(journey.next);
  counts = { fireflies: 0, lanterns: 0, sleepers: 0 };
  renderer.reset();
  pointer.held = false;
  pointer.goal = null;
  Object.keys(input).forEach((k) => (input[k] = false));
  fillHud();
  setState("walk");
  coach = journey.next === 0 ? 1 : 0;
  say(coach ? t("coach1") : `${visit.world.name[lang]}: ${visit.form.gift[lang]}`, coach ? 0 : 6);
}
function fillHud() {
  $("place").textContent = visit.world.name[lang];
  $("form").textContent = visit.form.name[lang];
  const pips = $("pips"),
    of = visit.world.lanterns.length;
  pips.replaceChildren(...Array.from({ length: of }, (_, i) => Object.assign(document.createElement("i"), { className: i < visit.lit.size ? "lit" : "" })));
  pips.setAttribute("aria-label", t("pips")(visit.lit.size, of));
  $("score").textContent = formatInt(visit.score);
}
function handle(e) {
  renderer.note(e, reduced.matches);
  if (demo) return;
  if (e.type === "gather") {
    sfx.gather(e.count);
    counts.fireflies = Math.max(counts.fireflies, e.count);
    if (coach === 2) (coach = 3), say(t("coach3"), 6);
  } else if (e.type === "light") {
    sfx.light(visit.world.lanterns[e.id].note);
    counts.lanterns += e.pts;
    if (e.count < e.of) say(t("lantern")(e.count, e.of), 3);
    if (navigator.vibrate && !reduced.matches) navigator.vibrate(15);
  } else if (e.type === "open") {
    sfx.open(visit.world.scale);
    say(t("open"), 6);
  } else if (e.type === "wake") {
    sfx.wake();
    counts.sleepers += e.pts;
    say(t("wake")[e.kind], 3);
  } else if (e.type === "roar") sfx.roar();
  else if (e.type === "scatter") {
    sfx.scatter();
    say(t("scatter")(e.lost.length), 4);
  } else if (e.type === "done") finishVisit();
  if (e.type !== "roar") fillHud();
}
function finishVisit() {
  sfx.done(visit.world.scale);
  const i = visit.world.index,
    v = visit;
  journey.total += v.score;
  journey.stars.push(v.stars);
  journey.next = i + 1;
  known = clamp(Math.max(known, i + 2), 1, FORMS.length);
  store.set("known", String(known));
  const last = journey.next >= PLACES.length;
  board.addLocal(makeRecord(journey, alias()));
  if (!last) store.setJson("journey", journey);
  setTimeout(() => {
    if (visit !== v) return;
    $("done-title").textContent = t("lit")(v.world.name[lang]);
    [...$("stars").children].forEach((star, k) => star.classList.toggle("off", k >= v.stars));
    $("stars").setAttribute("aria-label", `${v.stars} / 3`);
    const rows = [
      [t("rowFireflies"), v.with.length * POINTS.firefly],
      [t("rowLanterns"), counts.lanterns],
      [t("rowSleepers"), counts.sleepers],
      [t("rowGate"), POINTS.gate],
      [t("rowTotal"), v.score, "sum"],
      [t("rowJourney"), journey.total],
    ];
    $("sums").replaceChildren(
      ...rows.flatMap(([label, value, cls]) => {
        const dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = formatInt(value);
        if (cls) dt.className = dd.className = cls;
        return [dt, dd];
      }),
    );
    $("evolve").hidden = last;
    if (!last) {
      $("next-name").textContent = FORMS[journey.next].name[lang];
      $("next-gift").textContent = FORMS[journey.next].gift[lang];
    }
    $("btn-next").textContent = last ? t("endAll") : t("next");
    $("btn-stop").hidden = last;
    setState("done");
    $("btn-next").focus();
  }, 1500);
}
const alias = () => `${$("alias-a").value} ${$("alias-b").value}`;
let finished = null;
function showEnd() {
  finished = { ...journey, stars: [...journey.stars] };
  const all = finished.next >= PLACES.length;
  $("end-title").textContent = all ? t("endAll") : t("endSome")(finished.next);
  $("end-text").textContent = all ? t("endAllText") : t("endSomeText");
  $("end-score").textContent = formatInt(finished.total);
  const { persisted } = board.addLocal(makeRecord(finished, alias()));
  $("post-status").textContent = persisted ? t("savedLocal") : t("notSaved");
  $("btn-post").disabled = false;
  journey = freshJourney();
  store.setJson("journey", journey);
  startDemo();
  setState("end");
}
async function post() {
  if (!finished) return;
  const status = $("post-status"),
    record = makeRecord(finished, alias());
  store.set("aliasA", $("alias-a").value);
  store.set("aliasB", $("alias-b").value);
  board.addLocal(record);
  if (!isLiveSite()) return void (status.textContent = t("previewOnly"));
  $("btn-post").disabled = true;
  status.textContent = t("sending");
  try {
    await board.saveGlobal(record);
    status.textContent = t("sent");
  } catch {
    status.textContent = t("sendFailed");
    $("btn-post").disabled = false;
  }
}
for (const [sel, list, key] of [[$("alias-a"), NAME_A, "aliasA"], [$("alias-b"), NAME_B, "aliasB"]]) {
  for (const word of list) sel.append(new Option(word, word));
  if (list.includes(store.get(key))) sel.value = store.get(key);
}

// ---------- buttons, keys, fingers ----------
$("btn-start").addEventListener("click", startVisit);
let sure = 0;
$("btn-fresh").addEventListener("click", () => {
  if (Date.now() - sure > 4000) {
    sure = Date.now();
    $("btn-fresh").textContent = t("freshSure");
    return;
  }
  sure = 0;
  journey = freshJourney();
  store.setJson("journey", journey);
  showTitle();
});
$("btn-next").addEventListener("click", () => (journey.next >= PLACES.length ? showEnd() : startVisit()));
$("btn-stop").addEventListener("click", showEnd);
$("btn-post").addEventListener("click", post);
$("btn-again").addEventListener("click", showTitle);
$("btn-leave").addEventListener("click", showTitle);
$("btn-roar").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  input.roar = true;
});
$("btn-roar").addEventListener("click", () => (input.roar = true));
const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
addEventListener("keydown", (e) => {
  if (game.dataset.state !== "walk" || e.target.closest?.("dialog")) return;
  if (KEYS[e.key]) {
    input[KEYS[e.key]] = true;
    pointer.goal = null;
    e.preventDefault();
  } else if (e.key === " " || e.key === "Enter") {
    if (!e.repeat && e.target === document.body) input.roar = true;
    if (e.key === " ") e.preventDefault();
  } else if (e.key === "Escape") showTitle();
});
addEventListener("keyup", (e) => KEYS[e.key] && (input[KEYS[e.key]] = false));
addEventListener("blur", () => {
  for (const k of ["left", "right", "up", "down"]) input[k] = false;
  pointer.held = false;
});
canvas.addEventListener("pointerdown", (e) => {
  if (game.dataset.state !== "walk") return;
  wake();
  canvas.setPointerCapture?.(e.pointerId);
  Object.assign(pointer, { held: true, x: e.clientX, y: e.clientY, goal: null, since: performance.now() });
});
canvas.addEventListener("pointermove", (e) => pointer.held && Object.assign(pointer, { x: e.clientX, y: e.clientY }));
for (const type of ["pointerup", "pointercancel"])
  canvas.addEventListener(type, (e) => {
    if (!pointer.held) return;
    pointer.held = false;
    // a quick tap means "go there"; a long hold means "follow my finger"
    pointer.goal = type === "pointerup" && performance.now() - pointer.since < 280 ? renderer.worldOf(e.clientX, e.clientY) : null;
  });
let bot = false; // localhost only: lets a script walk for him
function steering() {
  if (bot) return guide(visit);
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0),
    dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (!dx && !dy) {
    const at = renderer.screenOf(visit);
    let vx = 0,
      vy = 0;
    if (pointer.held) (vx = pointer.x - at.x), (vy = pointer.y - (at.y - 20));
    else if (pointer.goal) (vx = pointer.goal.x - visit.x), (vy = pointer.goal.y - visit.y);
    const d = Math.hypot(vx, vy);
    if (d > 16) (dx = (vx / d) * Math.min(1, d / 60)), (dy = (vy / d) * Math.min(1, d / 60));
    else pointer.goal = null;
  }
  const roar = input.roar;
  input.roar = false;
  return { dx, dy, roar };
}

// ---------- form book and rankings ----------
const formsDlg = $("dlg-forms"),
  ranksDlg = $("dlg-ranks");
let formCanvases = [];
function openForms() {
  const list = $("forms");
  formCanvases = [];
  list.replaceChildren(
    ...FORMS.map((f, i) => {
      const li = document.createElement("li"),
        c = document.createElement("canvas"),
        name = document.createElement("strong"),
        gift = document.createElement("span"),
        seen = i < known;
      c.width = c.height = 220;
      li.className = seen ? "" : "locked";
      name.textContent = seen ? f.name[lang] : `${i + 1}`;
      gift.textContent = seen ? f.gift[lang] : t("unknown");
      li.append(c, name, gift);
      formCanvases.push([c, i, seen]);
      portrait(c, i, 1, seen);
      return li;
    }),
  );
  formsDlg.showModal();
}
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
    extra.textContent = t("places")(r.places);
    score.className = "score";
    score.textContent = formatInt(r.score);
    if (r.id === journey.id || r.id === finished?.id) li.className = "me";
    li.append(name, extra, score);
    list.append(li);
  }
}
async function showBoard(which) {
  for (const b of ranksDlg.querySelectorAll("[data-board]")) b.setAttribute("aria-pressed", String(b.dataset.board === which));
  if (which === "local") return fillBoard(board.readLocal(), t("empty"));
  fillBoard([], isLiveSite() ? t("loading") : t("previewOnly"));
  if (!isLiveSite()) return;
  try {
    fillBoard(await board.fetchGlobal({ limit: 25 }), t("empty"));
  } catch {
    $("board-status").textContent = t("loadFailed");
  }
}
$("btn-forms").addEventListener("click", openForms);
$("btn-ranks").addEventListener("click", () => {
  ranksDlg.showModal();
  showBoard(isLiveSite() ? "global" : "local");
});
for (const dlg of [formsDlg, ranksDlg])
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
    const tab = e.target.closest("[data-board]");
    if (tab) showBoard(tab.dataset.board);
  });
$("btn-sound").addEventListener("click", () => {
  setMuted(!sound.muted);
  if (!sound.muted) {
    wake();
    sfx.tap();
  }
});
$("btn-lang").addEventListener("click", () => {
  store.set("lang", (lang = lang === "de" ? "en" : "de"));
  applyLanguage();
});

// ---------- the loop ----------
const resize = () => renderer.resize(innerWidth, innerHeight);
addEventListener("resize", resize);
resize();
let last = performance.now(),
  bank = 0,
  clock = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (document.hidden) return requestAnimationFrame(frame);
  clock += dt;
  const state = game.dataset.state;
  if (visit) {
    bank += dt;
    while (bank >= STEP) {
      bank -= STEP;
      if (demo) {
        if (!reduced.matches) visit.update(STEP * 0.7, guide(visit));
        if (visit.status === "done") startDemo();
      } else if (state === "walk") {
        const before = visit.walked;
        visit.update(STEP, steering());
        if (coach === 1 && visit.walked > 120 && before <= 120) (coach = 2), say(t("coach2"), 7);
      }
      for (const e of visit.drainEvents()) handle(e);
    }
    renderer.draw(visit, dt, { reduced: reduced.matches, lang });
    if (state === "walk") {
      const ready = 1 - visit.roarWait / visit.form.cooldown,
        btn = $("btn-roar");
      btn.style.setProperty("--ready", `${Math.round(ready * 100)}%`);
      btn.classList.toggle("waiting", ready < 1);
    }
  }
  if (state === "done" && !$("evolve").hidden) portrait($("next-form"), Math.min(journey.next, FORMS.length - 1), reduced.matches ? 1 : clock);
  if (formsDlg.open && !reduced.matches) for (const [c, i, seen] of formCanvases) if (seen) portrait(c, i, clock + i);
  requestAnimationFrame(frame);
}

setMuted(store.get("muted") === "1");
document.title ||= t("title");
showTitle();
requestAnimationFrame(frame);
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
  window.__fire = {
    get visit() { return visit; },
    get journey() { return journey; },
    input,
    guide,
    auto(on = true) { bot = on; },
  };
