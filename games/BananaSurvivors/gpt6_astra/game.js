import {
  createRun,
  update,
  chooseUpgrade,
  reroll,
  upgradeInfo,
  runSummary,
  endRun,
  WEAPONS,
  LOADOUTS,
  multiplier,
  bossName,
  RULESET,
} from "./engine.js?v=1";
import { createRenderer } from "./renderer.js?v=1";
import { createControls } from "./controls.js?v=1";
import { createAudio } from "./audio.js?v=1";
import {
  SESSION_KEY,
  DEVICE_KEY,
  readRecords,
  addRecord,
  rankRecords,
  isLiveSite,
  fetchGlobalRecords,
  saveGlobalRecord,
} from "./records.js?v=1";
const $ = (id) => document.getElementById(id),
  all = (selector) => [...document.querySelectorAll(selector)],
  format = (n) => Math.floor(n).toLocaleString(),
  clock = (n) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const roman = ["", "I", "II", "III", "IV", "V"];
function storage(name) {
  try {
    return window[name];
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
const local = storage("localStorage"),
  session = storage("sessionStorage");
const read = (key, fallback) => {
  try {
    return JSON.parse(local.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    local.setItem(key, JSON.stringify(value));
  } catch {
    /* Optional preferences. */
  }
};
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const saved = read("banana_astra_settings", {});
const options = {
  audio: saved.audio !== false,
  volume: Number.isFinite(saved.volume)
    ? Math.max(0, Math.min(1, saved.volume))
    : 0.45,
  quiet: !!saved.quiet,
  low: !!saved.low,
};
let sessionRecords = readRecords(session),
  deviceRecords = readRecords(local, DEVICE_KEY),
  scope = "session",
  rankRequest = 0,
  currentRecord = null,
  player = "Banana",
  loadout = "classic",
  run = null,
  renderer = null,
  controls = null,
  paused = false,
  finished = false,
  announcementTime = 0,
  last = 0,
  accumulator = 0,
  hudClock = 0,
  buildSignature = "",
  input = {},
  ready = false;
let round = Math.max(0, ...sessionRecords.map((r) => r.round));
const sound = createAudio();
sound.configure(options);
const paths = {
  seed: '<path d="M6 18C-1 4 16-1 19 5c3 6-7 16-13 13Z"/><path d="m7 16 9-10"/>',
  banana:
    '<path d="M4 3c1 11 7 14 16 11-3 10-17 8-17-6Z"/><path d="m4 3 2-2m12 13 3-2"/>',
  orbit:
    '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><circle cx="20" cy="6" r="2" fill="currentColor"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="m15 8 2-3c1-2 3-2 4-1M5 13c0-2 1-3 3-4M20 1v2m3 2h-2"/>',
  bolt: '<path d="m14 2-10 12h7l-1 8L21 9h-8Z"/>',
  dash: '<path d="m7 5 9 7-9 7m7-14 9 7-9 7M1 8h4M0 16h5"/>',
  shield:
    '<path d="m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6Z"/><path d="m8 12 3 3 5-6"/>',
  magnet:
    '<path d="M4 3v10a8 8 0 0 0 16 0V3h-5v10a3 3 0 0 1-6 0V3Z"/><path d="M4 8h5m6 0h5"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  heart:
    '<path d="M12 21S1 14 2 7c1-6 8-6 10-1 2-5 9-5 10 1 1 7-10 14-10 14Z"/>',
};
function icon(name) {
  const shell = document.createElement("span");
  shell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.seed}</svg>`;
  return shell.firstElementChild;
}
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
const isPlaying = () =>
  !!run && run.phase === "playing" && !paused && !finished && !document.hidden;
function topDialog() {
  return all("dialog[open]").at(-1);
}
function openDialog(id) {
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
  controls?.reset();
  sound.pause();
}
function closeDialogs() {
  for (const d of all("dialog[open]")) d.close();
}
function announce(title, subtitle = "", seconds = 3) {
  $("announcement").querySelector("strong").textContent = title;
  $("announcement").querySelector("span").textContent = subtitle;
  $("announcement").classList.add("active");
  announcementTime = seconds;
  $("live-message").textContent = `${title}. ${subtitle}`;
}
function pause() {
  if (!run || finished || run.phase !== "playing" || paused) return;
  paused = true;
  controls?.reset();
  sound.pause();
  openDialog("pause-dialog");
}
function resume() {
  if (!run || finished) return;
  $("pause-dialog").close();
  paused = false;
  controls.reset();
  accumulator = 0;
  last = performance.now();
  sound.unlock();
  sound.resume();
  $("arena").focus({ preventScroll: true });
}
function togglePause() {
  const top = topDialog();
  if (top) {
    if (top.id === "pause-dialog") resume();
    else if (top.id !== "upgrade-dialog" && top.id !== "results-dialog")
      top.close();
    return;
  }
  pause();
}
function configure() {
  sound.configure(options);
  write("banana_astra_settings", options);
  $("audio-enabled").checked = options.audio;
  $("volume").value = options.volume;
  $("reduced-effects").checked = options.quiet;
  $("battery-saver").checked = options.low;
  $("sound-button").textContent = options.audio ? "♫" : "♪̸";
  $("sound-button").setAttribute(
    "aria-label",
    options.audio ? "Mute sound" : "Enable sound",
  );
  $("sound-button").title = options.audio ? "Sound on" : "Sound off";
}
function personal() {
  const best = rankRecords(deviceRecords)[0];
  $("personal-best").textContent = best ? format(best.score) : "—";
  $("personal-wave").textContent = best
    ? Math.max(...deviceRecords.map((r) => r.wave))
    : "—";
}
function buildRail() {
  const signature = JSON.stringify(run.weapons);
  if (signature === buildSignature) return;
  buildSignature = signature;
  const rail = $("weapon-rail");
  rail.replaceChildren();
  for (const [id, rank] of Object.entries(run.weapons)) {
    const w = WEAPONS[id],
      slot = node("div", `weapon-slot${rank === 5 ? " evolved" : ""}`);
    slot.title = `${rank === 5 ? w.evolution : w.name} · rank ${roman[rank]}`;
    slot.setAttribute("aria-label", slot.title);
    slot.style.color = w.color;
    slot.append(icon(w.icon), node("span", "", roman[rank]));
    rail.append(slot);
  }
  for (let i = Object.keys(run.weapons).length; i < 4; i++)
    rail.append(node("div", "weapon-slot empty", "+"));
}
function paintHUD() {
  if (!run) return;
  const p = run.player,
    summary = runSummary(run),
    hp = Math.ceil(p.hp),
    health = $("hp-fill").parentElement;
  $("hp-text").textContent = `${hp} / ${p.maxHp}`;
  $("hp-fill").style.width = `${(p.hp / p.maxHp) * 100}%`;
  health.setAttribute("aria-valuemax", p.maxHp);
  health.setAttribute("aria-valuenow", hp);
  health.classList.toggle("danger", p.hp < p.maxHp * 0.3);
  $("wave-text").textContent = `WAVE ${String(run.wave).padStart(2, "0")}`;
  $("time-text").textContent = clock(run.time);
  $("score-text").textContent = format(summary.score);
  $("kills-text").textContent = format(run.kills);
  $("level-text").textContent = `LV ${run.level}`;
  $("xp-text").textContent = `${run.xp} / ${run.xpNext}`;
  $("xp-fill").style.width = `${(run.xp / run.xpNext) * 100}%`;
  $("xp-fill").parentElement.setAttribute(
    "aria-valuenow",
    Math.round((run.xp / run.xpNext) * 100),
  );
  const boss = run.enemies.find((e) => e.id === run.bossId && !e.dead);
  $("boss-hud").hidden = !boss;
  if (boss) {
    $("boss-name").textContent = bossName(run.wave).toUpperCase();
    $("boss-hp").textContent =
      `${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`;
    $("boss-fill").style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
  }
  $("combo-text").textContent =
    run.frenzy > 0
      ? "OVERRIPE! FIRE AT WILL"
      : run.combo > 1
        ? `${run.combo} STREAK · ×${multiplier(run).toFixed(2)}`
        : "MAKE IT A STREAK";
  $("combo-fill").style.width =
    `${run.frenzy > 0 ? Math.min(100, (run.frenzy / 7) * 100) : Math.min(100, run.charge)}%`;
  $("frenzy-text").textContent =
    run.frenzy > 0
      ? `${run.frenzy.toFixed(1)}s of overripe firepower`
      : `Overripe charge ${Math.min(100, run.charge)}%`;
  $("dash-time").textContent =
    p.dashCd > 0 ? `${p.dashCd.toFixed(1)}s` : "READY";
  $("dash-button").classList.toggle("cooldown", p.dashCd > 0);
  $("dash-button").setAttribute(
    "aria-label",
    p.dashCd > 0
      ? `Dash recharging, ${p.dashCd.toFixed(1)} seconds`
      : "Dash ready",
  );
  buildRail();
}
function renderChoices() {
  $("upgrade-level").textContent = run.level;
  $("upgrade-label").textContent =
    run.transition > 0 ? "CHAMPION DEFEATED" : "LEVEL UP";
  $("upgrade-title").textContent = run.choices.some(
    (id) => run.weapons[id] === 4,
  )
    ? "Time to evolve."
    : "Make it riper.";
  $("upgrade-subtitle").textContent =
    run.pending > 1
      ? `${run.pending} upgrades ready. Choose one at a time.`
      : "Choose your edge. The jungle can wait.";
  const cards = $("upgrade-cards");
  cards.replaceChildren();
  run.choices
    .map((id) => upgradeInfo(run, id))
    .forEach((choice, i) => {
      const button = node(
        "button",
        `upgrade-card${choice.kind === "EVOLUTION" ? " evolution" : ""}`,
      );
      button.style.setProperty("--card-color", choice.color);
      const glyph = node("span", "card-icon");
      glyph.append(icon(choice.icon));
      button.append(
        glyph,
        node("span", "card-kind", choice.kind),
        node("strong", "", choice.name),
        node("span", "card-description", choice.description),
        node(
          "span",
          "card-rank",
          choice.id === "heal"
            ? "RESTORE 40 HP"
            : `RANK ${roman[choice.rank]} / ${roman[choice.max]}`,
        ),
        node("span", "card-key", i + 1),
      );
      button.addEventListener("click", () => pick(i));
      cards.append(button);
    });
  $("reroll-button").textContent = `Reroll · ${run.rerolls} left`;
  $("reroll-button").disabled = run.rerolls <= 0;
  openDialog("upgrade-dialog");
  cards.querySelector("button")?.focus();
}
function consumeEvents() {
  if (!run.events.length) return;
  renderer.emit(run.events, run);
  for (const e of run.events) {
    sound.sound(e.type);
    if (e.type === "boss")
      announce(e.name, "CHAMPION INCOMING · WATCH THE ATTACK WARNINGS", 3.6);
    if (e.type === "bossDefeated")
      announce("CHAMPION DOWN", "+25 health · bonus upgrade · +1 reroll", 3.2);
    if (e.type === "wave")
      announce(
        `WAVE ${String(e.wave).padStart(2, "0")}`,
        "Stay moving. The jungle is getting hungry.",
        2.8,
      );
    if (e.type === "frenzy")
      announce("OVERRIPE!", "Your entire build fires faster.", 2);
    if (e.type === "evolution")
      announce(
        WEAPONS[e.id].evolution,
        "WEAPON EVOLVED · GIVE THEM SOMETHING TO FEAR",
        3.3,
      );
    if (e.type === "cache")
      announce("SUPPLY CACHE", "Health and a full-field XP magnet.", 1.8);
  }
  run.events = [];
}
function pick(index) {
  if (
    !run ||
    run.phase !== "upgrade" ||
    finished ||
    topDialog()?.id !== "upgrade-dialog"
  )
    return;
  const id = run.choices[index];
  if (!id) return;
  if (chooseUpgrade(run, id)) {
    consumeEvents();
    paintHUD();
    if (run.phase === "upgrade") renderChoices();
    else {
      $("upgrade-dialog").close();
      controls.reset();
      sound.resume();
      accumulator = 0;
      $("arena").focus({ preventScroll: true });
    }
  }
}
function doReroll() {
  if (topDialog()?.id === "upgrade-dialog" && run && reroll(run)) {
    sound.sound("xp");
    renderChoices();
  }
}
function start() {
  if (!ready) return;
  closeDialogs();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  run = createRun(seed, loadout);
  paused = false;
  finished = false;
  currentRecord = null;
  round++;
  renderer.reset();
  controls.reset();
  accumulator = 0;
  buildSignature = "";
  last = performance.now();
  $("menu").hidden = true;
  $("hud").hidden = false;
  $("arena").inert = false;
  $("control-hint").textContent = matchMedia("(pointer: coarse)").matches
    ? "DRAG TO MOVE · TAP DASH TO DODGE"
    : "WASD / ARROWS · HOLD MOUSE TO STEER · SPACE TO DASH";
  $("arena").focus({ preventScroll: true });
  sound.unlock();
  sound.resume();
  consumeEvents();
  announce(
    "STAY FRESH",
    "Collect the golden XP. Your weapons do the shooting.",
    4,
  );
  paintHUD();
}
async function save(record) {
  if (!isLiveSite()) {
    if (currentRecord?.id === record.id)
      $("save-status").textContent =
        "Saved to this session and device. Global rankings connect on whatthe.ai.";
    return;
  }
  if (currentRecord?.id === record.id) {
    $("save-status").textContent =
      "Saved here. Sending your score to the global ranking…";
    $("retry-save").hidden = true;
  }
  try {
    await saveGlobalRecord(record);
    if (currentRecord?.id === record.id) {
      $("save-status").textContent =
        "Saved to this session, this device, and the global ranking.";
      $("retry-save").hidden = true;
    }
  } catch {
    if (currentRecord?.id === record.id) {
      $("save-status").textContent =
        "Your score is saved here. The global ranking could not connect.";
      $("retry-save").hidden = false;
    }
  }
}
function finish(retired = false) {
  if (finished || !run) return;
  finished = true;
  paused = false;
  controls.reset();
  sound.pause();
  closeDialogs();
  const result = runSummary(run),
    oldBest = deviceRecords[0]?.score || 0;
  currentRecord = {
    ...result,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${run.seed}`,
    playerName: player,
    round,
    createdAt: Date.now(),
    ruleset: RULESET,
  };
  sessionRecords = addRecord(sessionRecords, currentRecord, session);
  deviceRecords = addRecord(deviceRecords, currentRecord, local, DEVICE_KEY);
  personal();
  $("result-label").textContent = retired
    ? "YOU LIVED TO PEEL ANOTHER DAY"
    : result.score > oldBest
      ? "A NEW PERSONAL BEST"
      : "A PEEL WELL FOUGHT";
  $("result-message").textContent = retired
    ? "You called it. Your score still counts."
    : result.bosses
      ? `${result.bosses} champion${result.bosses === 1 ? "" : "s"} defeated. The jungle will remember that.`
      : "The jungle got its snack. Your next build could be the one.";
  $("result-score").textContent = format(result.score);
  $("result-best").textContent =
    result.score > oldBest
      ? "YOUR BEST RUN YET"
      : `PERSONAL BEST ${format(deviceRecords[0]?.score || 0)}`;
  $("result-stats").replaceChildren();
  for (const [label, value] of [
    ["WAVE", result.wave],
    ["SURVIVED", clock(result.seconds)],
    ["KILLS", format(result.kills)],
    ["BEST STREAK", result.bestCombo],
  ]) {
    const cell = node("div");
    cell.append(node("strong", "", value), node("span", "", label));
    $("result-stats").append(cell);
  }
  const build = $("result-build");
  build.replaceChildren(node("span", "build-label", "YOUR FINAL BUILD"));
  for (const [id, rank] of Object.entries(result.weapons)) {
    const chip = node(
      "span",
      "build-chip",
      `${rank === 5 ? WEAPONS[id].evolution : WEAPONS[id].name} ${roman[rank]}`,
    );
    chip.style.color = WEAPONS[id].color;
    build.append(chip);
  }
  $("hud").hidden = true;
  openDialog("results-dialog");
  save(currentRecord);
}
async function showRanking() {
  const request = ++rankRequest;
  all("[data-scope]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.scope === scope)),
  );
  $("refresh-rank").hidden = scope !== "global";
  $("rank-list").replaceChildren();
  let records = scope === "session" ? sessionRecords : deviceRecords;
  if (scope === "global") {
    if (!isLiveSite()) {
      $("rank-status").textContent =
        "Global rankings are available on whatthe.ai. Preview runs stay on this device.";
      return;
    }
    $("rank-status").textContent = "Connecting to the hall of survivors…";
    try {
      const data = await fetchGlobalRecords();
      if (request !== rankRequest) return;
      records = data.records;
      $("rank-status").textContent =
        `Top ${records.length} survivors · ${format(data.total)} runs worldwide`;
    } catch {
      if (request === rankRequest)
        $("rank-status").textContent =
          "The global ranking could not connect. Your local scores are safe. Try refresh.";
      return;
    }
  } else
    $("rank-status").textContent =
      scope === "session"
        ? "Every scored run in this browser session, highest score first."
        : "Your best 100 runs on this browser and device.";
  if (!records.length) {
    $("rank-list").append(
      node(
        "li",
        "rank-empty",
        "No survivors yet. Be the first banana on the board.",
      ),
    );
    return;
  }
  records.forEach((record, i) => {
    const row = node(
        "li",
        `rank-row${record.id === currentRecord?.id ? " current" : ""}`,
      ),
      info = node("div", "rank-person"),
      score = node("div", "rank-score");
    info.append(
      node("strong", "", record.playerName),
      node(
        "small",
        "",
        `Wave ${record.wave} · ${clock(record.seconds)} · ${record.kills} kills${scope === "session" ? ` · run ${record.round}` : ""}`,
      ),
    );
    score.append(
      node("strong", "", format(record.score)),
      node("small", "", "POINTS"),
    );
    row.append(
      node("span", "rank-place", String(i + 1).padStart(2, "0")),
      info,
      score,
    );
    $("rank-list").append(row);
  });
}
function openPanel(name) {
  if (isPlaying()) pause();
  openDialog(`${name}-dialog`);
  if (name === "rank") showRanking();
}
all("[data-open]").forEach((button) =>
  button.addEventListener("click", () => openPanel(button.dataset.open)),
);
all("[data-close]").forEach((button) =>
  button.addEventListener("click", () => button.closest("dialog").close()),
);
all("dialog").forEach((dialog) =>
  dialog.addEventListener("cancel", (event) => {
    if (dialog.id === "upgrade-dialog" || dialog.id === "results-dialog")
      event.preventDefault();
    if (dialog.id === "pause-dialog") {
      event.preventDefault();
      resume();
    }
  }),
);
$("start-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("nickname").value.trim().slice(0, 10) || "Banana";
  const blocked =
    typeof offensiveWords !== "undefined" &&
    offensiveWords.some((word) =>
      word.length >= 3
        ? name.toLowerCase().includes(word)
        : name.toLowerCase() === word,
    );
  if (blocked) {
    $("name-error").textContent =
      "Pick another name for the hall of survivors.";
    $("nickname").focus();
    return;
  }
  $("name-error").textContent = "";
  player = name;
  loadout = document.querySelector('[name="loadout"]:checked').value;
  write("banana_astra_name", player);
  write("banana_astra_loadout", loadout);
  start();
});
$("nickname").value = String(read("banana_astra_name", "")).slice(0, 10);
const previousLoadout = read("banana_astra_loadout", "classic");
if (LOADOUTS[previousLoadout])
  document.querySelector(`[value="${previousLoadout}"]`).checked = true;
$("pause-button").addEventListener("click", pause);
$("resume-button").addEventListener("click", resume);
$("retire-button").addEventListener("click", () => {
  endRun(run);
  consumeEvents();
  finish(true);
});
$("again-button").addEventListener("click", start);
$("menu-button").addEventListener("click", () => {
  closeDialogs();
  run = null;
  finished = false;
  $("menu").hidden = false;
  $("arena").inert = true;
  $("start-button").focus();
});
$("result-rank").addEventListener("click", () => openPanel("rank"));
$("retry-save").addEventListener(
  "click",
  () => currentRecord && save(currentRecord),
);
$("reroll-button").addEventListener("click", doReroll);
all("[data-scope]").forEach((button) =>
  button.addEventListener("click", () => {
    scope = button.dataset.scope;
    showRanking();
  }),
);
$("refresh-rank").addEventListener("click", showRanking);
$("sound-button").addEventListener("click", () => {
  options.audio = !options.audio;
  sound.unlock();
  configure();
});
$("audio-enabled").addEventListener("change", () => {
  options.audio = $("audio-enabled").checked;
  sound.unlock();
  configure();
});
$("volume").addEventListener("input", () => {
  options.volume = Number($("volume").value);
  sound.unlock();
  configure();
  sound.sound("xp");
});
$("reduced-effects").addEventListener("change", () => {
  options.quiet = $("reduced-effects").checked;
  configure();
});
$("battery-saver").addEventListener("change", () => {
  options.low = $("battery-saver").checked;
  configure();
});
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else
      $("fullscreen-button").textContent =
        "Use your browser’s fullscreen or Add to Home Screen";
  } catch {
    $("fullscreen-button").textContent =
      "Fullscreen is unavailable in this browser";
  }
});
window.addEventListener("blur", () => {
  if (isPlaying()) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (run && run.phase === "playing" && !finished) pause();
    sound.pause();
    controls?.reset();
  }
});
document.addEventListener("pointerdown", () => sound.unlock(), { once: true });
for (const weapon of Object.values(WEAPONS)) {
  const item = node("div", "armory-item"),
    copy = node("div");
  item.style.color = weapon.color;
  copy.append(
    node("strong", "", weapon.name),
    node("small", "", `${weapon.description} → ${weapon.evolution}`),
  );
  item.append(icon(weapon.icon), copy);
  $("armory").append(item);
}
configure();
personal();
$("arena").inert = true;
async function boot() {
  try {
    renderer = await createRenderer($("arena"));
    controls = createControls($("arena"), $("touch-stick"), $("dash-button"), {
      onPause: togglePause,
      onChoice: pick,
      onReroll: doReroll,
      onActivity: () => {},
      isPlaying,
      screenToWorld: renderer.world,
    });
    ready = true;
    $("start-button").disabled = false;
    $("start-button").firstElementChild.textContent = "LET’S GO BANANAS";
    $("load-status").textContent = "Auto-fire. You bring the moves.";
    requestAnimationFrame(frame);
  } catch (error) {
    $("load-status").textContent = error.message;
    $("start-button").disabled = false;
    $("start-button").firstElementChild.textContent = "RETRY LOADING";
    $("start-button").addEventListener(
      "click",
      () => {
        if (!ready) {
          $("start-button").disabled = true;
          boot();
        }
      },
      { once: true },
    );
  }
}
function frame(timestamp) {
  const elapsed = Math.min(0.1, (timestamp - (last || timestamp)) / 1000);
  last = timestamp;
  if (run) {
    const playing = isPlaying();
    if (playing) {
      accumulator = Math.min(0.1, accumulator + elapsed);
      while (accumulator >= 1 / 60 && isPlaying()) {
        input = controls.sample(run.player);
        update(run, 1 / 60, input);
        consumeEvents();
        accumulator -= 1 / 60;
        if (run.phase === "upgrade") renderChoices();
        if (run.phase === "dead") finish();
      }
      announcementTime -= elapsed;
      if (announcementTime <= 0) $("announcement").classList.remove("active");
      sound.setIntensity(run.frenzy > 0 ? 2 : run.bossId ? 1 : 0);
    } else accumulator = 0;
    renderer.draw(run, playing ? elapsed : 0, {
      ...input,
      quiet: options.quiet || motion.matches,
      low: options.low,
    });
    hudClock += elapsed;
    if (hudClock > 0.08) {
      paintHUD();
      hudClock = 0;
    }
  }
  requestAnimationFrame(frame);
}
boot();
