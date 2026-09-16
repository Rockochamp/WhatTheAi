// Render-only history. No RNG, simulation, persistence or media encoding runs here.
export const REPLAY_SECONDS = 1.8;
export const REPLAY_HZ = 20;
export const REPLAY_FRAMES = Math.ceil(REPLAY_SECONDS * REPLAY_HZ) + 2;
export const REPLAY_RATE = 0.3;
export const DEATH_FREEZE = 0.5;
export const IMPACT_HOLD = 0.9;
const visualEvents = new Set([
  "hit",
  "hurt",
  "kill",
  "dash",
  "explode",
  "lightning",
]);
function entity(value) {
  const { hitIds, hitIdsBack, source, ...copy } = value;
  return copy;
}
export function snapshot(s, input = {}) {
  return {
    time: s.time,
    wave: s.wave,
    bossId: s.bossId,
    phase: s.phase,
    moving: !!input.moving,
    ward: s.ward,
    frost: s.frost,
    frenzy: s.frenzy,
    player: { ...s.player },
    weapons: { ...s.weapons },
    perks: { ...s.perks },
    mastery: { ...s.mastery },
    cache: { ...s.cache },
    showdown: s.showdown ? { ...s.showdown } : null,
    enemies: s.enemies.map(entity),
    shots: s.shots.map(entity),
    drops: s.drops.map(entity),
    hazards: s.hazards.map(entity),
  };
}
export function createHistory() {
  let frames = [],
    pending = [],
    last = -Infinity;
  return {
    capture(s, force = false, input = {}) {
      // Keep impact events even if a busy frame exhausts the normal effect budget.
      for (const e of s.events) {
        if (!visualEvents.has(e.type)) continue;
        const copy = { ...e, time: s.time };
        if (e.points) copy.points = e.points.map((p) => ({ ...p }));
        pending.push(copy);
        if (pending.length > 48) pending.shift();
      }
      if (!force && s.time - last < 1 / REPLAY_HZ - 0.00001) return;
      const frame = { state: snapshot(s, input), events: pending };
      pending = [];
      if (frames.at(-1)?.state.time === s.time) frames.pop();
      frames.push(frame);
      last = s.time;
      while (frames.length > REPLAY_FRAMES) frames.shift();
    },
    finish(s) {
      if (last !== s.time) this.capture(s, true);
      return createReplay(frames, s.deathCause);
    },
    clear() {
      frames = [];
      pending = [];
      last = -Infinity;
    },
    get size() {
      return frames.length;
    },
  };
}
const mix = (a, b, t) => a + (b - a) * t;
function position(a, b, t) {
  return {
    ...a,
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    ...(Number.isFinite(a.age) ? { age: mix(a.age, b.age, t) } : {}),
  };
}
function interpolate(a, b, time) {
  if (!b || time >= b.time) return b || a;
  const t = Math.max(0, (time - a.time) / (b.time - a.time || 1));
  const state = { ...a, time, player: position(a.player, b.player, t) };
  for (const field of ["enemies", "shots", "drops", "hazards"]) {
    const next = new Map(b[field].map((e) => [e.id, e]));
    state[field] = a[field].map((e) =>
      next.has(e.id) ? position(e, next.get(e.id), t) : e,
    );
  }
  return state;
}
export function createReplay(frames, cause) {
  if (!frames.length) return null;
  const end = frames.at(-1).state.time,
    start = Math.max(frames[0].state.time, end - REPLAY_SECONDS),
    duration = (end - start) / REPLAY_RATE,
    events = frames.flatMap((f) => f.events).filter((e) => e.time > start);
  let elapsed = 0,
    eventIndex = 0,
    previous = start,
    priorPhase = "freeze";
  return {
    cause: cause ? { ...cause } : null,
    advance(dt = 0) {
      elapsed += Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      const phase =
        elapsed < DEATH_FREEZE
          ? "freeze"
          : elapsed < DEATH_FREEZE + duration
            ? "replay"
            : elapsed < DEATH_FREEZE + duration + IMPACT_HOLD
              ? "impact"
              : "done";
      const time =
        phase === "freeze"
          ? end
          : Math.min(
              end,
              start + Math.max(0, elapsed - DEATH_FREEZE) * REPLAY_RATE,
            );
      let i = 0;
      while (i < frames.length - 1 && frames[i + 1].state.time <= time) i++;
      const state = interpolate(frames[i].state, frames[i + 1]?.state, time);
      const emitted = [];
      if (phase !== "freeze") {
        while (eventIndex < events.length && events[eventIndex].time <= time)
          emitted.push(events[eventIndex++]);
      }
      const switched = phase !== priorPhase;
      priorPhase = phase;
      const delta = phase === "freeze" ? 0 : Math.max(0, time - previous);
      if (phase !== "freeze") previous = time;
      return {
        state,
        phase,
        switched,
        events: emitted,
        dt: delta,
        progress: Math.min(1, Math.max(0, (time - start) / (end - start || 1))),
        remaining: Math.max(0, end - time),
        cause: this.cause,
      };
    },
  };
}
