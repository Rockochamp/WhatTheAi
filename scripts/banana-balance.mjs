// Offline balance probe: real damage, normal XP, normal offered upgrades.
// This is a simple steering bot, not a substitute for human playtesting.
import {
  createRun,
  update,
  chooseUpgrade,
  runSummary,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
for (const loadout of ["classic", "ranger", "bruiser"])
  for (const seed of [19, 41, 77, 123]) {
    const s = createRun(seed, loadout);
    let firstUpgrade = null;
    const start = performance.now();
    for (let frame = 0; frame < 36000 && s.phase !== "dead"; frame++) {
      if (s.phase === "upgrade") {
        firstUpgrade ??= s.time;
        const grade = (id) =>
          id === "heal"
            ? s.player.hp < s.player.maxHp * 0.4
              ? 130
              : 0
            : id === "vitality" && s.player.hp < 50
              ? 120
              : s.weapons[id] === 4
                ? 150
                : s.weapons[id]
                  ? 95 + s.weapons[id] * 3
                  : ["coconut", "lightning", "peels"].includes(id)
                    ? 80
                    : id === "power"
                      ? 75
                      : id === "magnet"
                        ? 65
                        : id === "haste"
                          ? 70
                          : 25;
        chooseUpgrade(s, [...s.choices].sort((a, b) => grade(b) - grade(a))[0]);
      }
      const p = s.player;
      let target = null,
        best = 1e8;
      for (const d of s.drops) {
        const range = Math.hypot(d.x - p.x, d.y - p.y),
          priority =
            d.kind === "heal" && p.hp < p.maxHp * 0.8
              ? 0.25
              : d.kind === "magnet"
                ? 0.4
                : 1;
        if (range * priority < best) {
          best = range * priority;
          target = d;
        }
      }
      if (!s.cache.claimed && (!target || best > 300)) target = s.cache;
      let x = target ? target.x - p.x : Math.cos(s.time * 0.3) * 100,
        y = target ? target.y - p.y : Math.sin(s.time * 0.3) * 100;
      const len = Math.hypot(x, y) || 1;
      x /= len;
      y /= len;
      let danger = 0;
      for (const e of s.enemies) {
        if (e.born > 0) continue;
        const dx = p.x - e.x,
          dy = p.y - e.y,
          d = Math.hypot(dx, dy) || 1,
          r = e.r + 130;
        if (d < r) {
          const force = ((r - d) / r) * (e.type === "boss" ? 3 : 1.8);
          x += (dx / d) * force;
          y += (dy / d) * force;
          if (d < e.r + 50) danger++;
        }
      }
      for (const h of s.hazards)
        if (!h.friendly) {
          const dx = p.x - h.x,
            dy = p.y - h.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < h.r + 60) {
            x += (dx / d) * 3;
            y += (dy / d) * 3;
            danger++;
          }
        }
      if (Math.abs(p.x) > 1250) x -= Math.sign(p.x) * 2;
      if (Math.abs(p.y) > 1250) y -= Math.sign(p.y) * 2;
      update(s, 1 / 60, { x, y, dash: danger > 1 });
    }
    console.log(
      JSON.stringify({
        seed,
        loadout,
        firstUpgrade: Math.round(firstUpgrade || 0),
        ...runSummary(s),
        alive: s.phase !== "dead",
        simulationMs: Math.round(performance.now() - start),
      }),
    );
  }
