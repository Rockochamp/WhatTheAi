// Diagnostic only: established level-62 build, normal incoming damage.
// Standing and orbiting probes expose degenerate builds; neither predicts human skill.
import {
  createRun,
  update,
  chooseUpgrade,
  PERKS,
  runSummary,
} from "../games/BananaSurvivors/gpt6_astra/engine.js";
for (const stage of [5, 10, 20, 30])
  for (const mode of ["standing", "orbit"]) {
    const s = createRun(41);
    s.wave = stage;
    s.level = 62;
    s.time = stage * 70;
    s.waveTime = 49.99;
    s.weapons = { blaster: 5, boomerang: 5, peels: 5, coconut: 5 };
    for (const [id, p] of Object.entries(PERKS)) s.perks[id] = p.max;
    s.mastery = { force: 8, hunter: 8, vigor: 8, resolve: 4 };
    s.player.hp = s.player.maxHp = 224;
    const start = s.time;
    let attacked = 0;
    for (let i = 0; i < 60 * 100 && s.phase !== "dead" && s.bosses === 0; i++) {
      if (s.phase === "upgrade") chooseUpgrade(s, s.choices[0]);
      const boss = s.enemies.find((e) => e.id === s.bossId),
        p = s.player;
      const a = Math.atan2(p.y - (boss?.y || 0), p.x - (boss?.x || 0));
      update(
        s,
        1 / 60,
        mode === "orbit"
          ? {
              x: Math.cos(a + 1.05),
              y: Math.sin(a + 1.05),
              dash: !!boss && (boss.windup > 0 || boss.charge > 0),
            }
          : {},
      );
      attacked += s.events.filter((e) => e.type === "hurt").length;
    }
    console.log(
      JSON.stringify({
        stage,
        mode,
        result: s.bosses ? "cleared" : s.phase === "dead" ? "died" : "timeout",
        duration: Math.round(s.time - start),
        hp: Math.round(s.player.hp),
        hits: attacked,
        bossHp: Math.round(s.enemies.find((e) => e.id === s.bossId)?.hp || 0),
      }),
    );
  }
