import { yearSequence } from "./scene-model.js?v=2";

export function createKingdomScene(storage) {
  const $ = (id) => document.getElementById(id),
    canvas = $("kingdom-canvas"),
    shell = $("world-shell"),
    dock = $("world-dock"),
    dialog = $("cinema-dialog");
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = storage.getItem("hammurabi_kingdom_motion") !== "false",
    world = null,
    ready = null,
    state = null,
    plan = null,
    pending = null,
    raf = 0;
  const motion = () => enabled && !preference.matches;
  function status() {
    $("motion-toggle").textContent = motion() ? "Ⅱ" : "▶";
    $("motion-toggle").setAttribute("aria-pressed", String(motion()));
    $("motion-toggle").setAttribute(
      "aria-label",
      motion() ? "Pause kingdom motion" : "Enable kingdom motion",
    );
    $("motion-toggle").title = preference.matches
      ? "Reduced motion is enabled in your device settings"
      : motion()
        ? "Pause kingdom motion"
        : "Enable kingdom motion";
    $("world-status").textContent = world
      ? `${state?.pawns || 0} villagers · 1 villager = 1 person`
      : "Scenic view · the game is fully playable";
    world?.setMotion(motion());
  }
  async function ensureWorld() {
    if (ready) return ready;
    ready = (async () => {
      $("world-status").textContent = "Bringing the kingdom to life…";
      try {
        const module = await import("./world3d.bundle.js?v=2");
        canvas.hidden = false;
        world = module.createWorld(canvas, {
          onContextLost: () => {
            world?.dispose();
            world = null;
            canvas.hidden = true;
            shell.classList.remove("world-ready");
            finish();
            status();
          },
        });
        shell.classList.add("world-ready");
        if (state) world.setState(state);
        if (plan) world.setPlan(plan);
        status();
        return world;
      } catch {
        canvas.hidden = true;
        world = null;
        shell.classList.remove("world-ready");
        status();
        return null;
      }
    })();
    return ready;
  }
  function setState(value) {
    state = { ...value };
    ensureWorld();
    world?.setState(state);
    status();
  }
  function setPlan(value) {
    plan = { ...value };
    world?.setPlan(plan);
  }
  function finish() {
    if (!pending) return;
    const completed = pending;
    pending = null;
    cancelAnimationFrame(raf);
    raf = 0;
    dock.append(shell);
    shell.classList.remove("cinematic");
    if (dialog.open) dialog.close();
    state = { ...completed.after };
    world?.setState(state);
    if (plan) world?.setPlan(plan);
    status();
    completed.resolve();
  }
  async function playYear(before, decisions, report, after) {
    if (pending) finish();
    if (!motion() || document.hidden) {
      setState(after);
      return;
    }
    await Promise.race([
      ensureWorld(),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ]);
    if (!world || !motion() || document.hidden) {
      setState(after);
      return;
    }
    return new Promise((resolve) => {
      const phases = yearSequence(before, decisions, report, after);
      let phaseIndex = -1,
        startTime = null,
        phaseStart = 0;
      const total = phases.reduce((sum, p) => sum + p.duration, 0);
      pending = { resolve, after };
      state = { ...before };
      world.setState(before);
      world.control("reset");
      world.setPlan(decisions);
      shell.classList.add("cinematic");
      $("cinema-stage").append(shell);
      $("cinema-title").textContent = `Year ${report.year} unfolds`;
      dialog.showModal();
      world.resize();
      const progress = $("cinema-progress-fill"),
        progressRole = progress.parentElement;
      function frame(now) {
        if (!pending) return;
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;
        if (elapsed >= total) {
          finish();
          return;
        }
        let cumulative = 0,
          nextIndex = 0;
        for (let i = 0; i < phases.length; i++) {
          if (elapsed < cumulative + phases[i].duration) {
            nextIndex = i;
            break;
          }
          cumulative += phases[i].duration;
        }
        if (phaseIndex !== nextIndex) {
          phaseIndex = nextIndex;
          phaseStart = cumulative;
          const current = phases[phaseIndex];
          world.showPhase(current);
          $("cinema-event").textContent = current.title;
          $("cinema-detail").textContent = current.detail;
          $("cinema-caption")?.setAttribute("data-kind", current.kind);
        }
        const current = phases[phaseIndex],
          previous = phaseIndex
            ? phases[phaseIndex - 1]
            : { people: before.pawns, food: before.food, land: before.land };
        const amount = Math.min(
          1,
          (elapsed - phaseStart) / Math.min(900, current.duration),
        );
        for (const [id, key] of [
          ["cinema-people", "people"],
          ["cinema-food", "food"],
          ["cinema-land", "land"],
        ])
          $(id).textContent = Math.round(
            previous[key] + (current[key] - previous[key]) * amount,
          ).toLocaleString();
        const percent = Math.round((elapsed / total) * 100);
        progress.style.width = `${percent}%`;
        progressRole.setAttribute("aria-valuenow", String(percent));
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    });
  }
  $("skip-year").addEventListener("click", finish);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish();
  });
  dialog.addEventListener("close", () => {
    if (pending) finish();
  });
  $("motion-toggle").addEventListener("click", () => {
    enabled = !motion();
    storage.setItem("hammurabi_kingdom_motion", String(enabled));
    status();
    if (!motion()) finish();
  });
  preference.addEventListener("change", () => {
    status();
    if (!motion()) finish();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finish();
  });
  for (const button of document.querySelectorAll("[data-camera]"))
    button.addEventListener("click", () =>
      world?.control(button.dataset.camera),
    );
  return {
    setState,
    setPlan,
    playYear,
    canAnimate: () => !!world && motion(),
    reset() {
      finish();
    },
  };
}
