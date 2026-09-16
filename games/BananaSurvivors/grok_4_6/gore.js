// Presentation-only viscera. Own RNG. Never touches the sim.
export const GORE_LIMITS = { blood: 420, chunks: 110, stains: 220 };
const TAU = Math.PI * 2;

export function createGore(random = Math.random) {
  const blood = [],
    chunks = [],
    stains = [];
  let budget = GORE_LIMITS;
  const trim = (list, cap) => {
    if (list.length > cap) list.splice(0, list.length - cap);
  };
  function stain(x, y, size, heavy = false) {
    stains.push({
      x,
      y,
      size,
      angle: random() * TAU,
      points: Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * TAU;
        const r = 0.58 + 0.3 * Math.sin(i * 2.1 + size) + 0.12 * Math.cos(i * 4.4);
        return [Math.cos(a) * r, Math.sin(a) * r * 0.72];
      }),
      life: heavy ? 56 : 30,
      max: heavy ? 56 : 30,
      heavy,
    });
    trim(stains, budget.stains);
  }
  function spray(x, y, toward, amount, speed, size) {
    for (let i = 0; i < amount; i++) {
      const a = toward + (random() - 0.5) * (amount > 22 ? TAU : 1.8);
      const v = speed * (0.4 + random());
      blood.push({
        x,
        y,
        z: 12 + random() * 18,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vz: 80 + random() * 170,
        size: size * (0.55 + random()),
        streak: i < 6 ? 7 : 2.6,
        life: 1.2,
        red: i % 3,
      });
    }
    trim(blood, budget.blood);
  }
  function gib(x, y, pieces, scale) {
    for (let i = 0; i < pieces; i++) {
      const a = random() * TAU,
        v = 80 + random() * 240;
      chunks.push({
        x,
        y,
        z: 20,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vz: 120 + random() * 190,
        size: (5 + random() * 8) * scale,
        angle: random() * TAU,
        spin: (random() - 0.5) * 20,
        kind: i % 6,
        life: 15 + random() * 8,
        bounced: false,
      });
    }
    trim(chunks, budget.chunks);
  }
  function emit(event, player, { low = false, quiet = false, enabled = true } = {}) {
    if (!enabled) return;
    budget = low ? { blood: 140, chunks: 32, stains: 80 } : GORE_LIMITS;
    const type = event.type;
    if (!["hit", "kill", "hurt", "split", "burst", "crush", "yank"].includes(type))
      return;
    const x = type === "hurt" ? player.x : event.x;
    const y = type === "hurt" ? player.y : event.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const toward = Math.atan2(y - player.y, x - player.x);
    const scale = quiet || low ? 0.42 : 1;
    if (type === "hit") {
      spray(x, y, toward, Math.floor(7 * scale), 140, 2.4);
    } else if (type === "kill") {
      stain(x, y, (event.size || 30) * 0.7, true);
      spray(x, y, toward, Math.floor(28 * scale), 260, 3.4);
      gib(x, y, Math.floor(8 * scale), (event.size || 30) / 36);
    } else if (type === "split") {
      spray(x, y, event.a || 0, Math.floor(18 * scale), 220, 2.8);
      stain(x, y, 26, false);
    } else if (type === "burst") {
      stain(x, y, event.r ? event.r * 0.45 : 70, true);
      spray(x, y, 0, Math.floor(54 * scale), 340, 4.2);
      gib(x, y, Math.floor(16 * scale), 1.6);
    } else if (type === "crush") {
      stain(x, y, 34, true);
      spray(x, y, toward, Math.floor(16 * scale), 180, 3);
      gib(x, y, Math.floor(5 * scale), 0.9);
    } else if (type === "hurt") {
      spray(player.x, player.y, toward + Math.PI, Math.floor(12 * scale), 160, 2.2);
    } else if (type === "yank") {
      spray(x, y, toward, Math.floor(6 * scale), 90, 1.8);
    }
  }
  function step(dt) {
    for (let i = blood.length - 1; i >= 0; i--) {
      const b = blood[i];
      b.life -= dt;
      b.vz -= 520 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.z < 0) {
        b.z = 0;
        b.vz *= -0.18;
        b.vx *= 0.4;
        b.vy *= 0.4;
        if (b.life > 0.2) stain(b.x, b.y, b.size * 1.6, false);
        b.life -= 0.35;
      }
      if (b.life <= 0) blood.splice(i, 1);
    }
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      c.life -= dt * 8;
      c.vz -= 540 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.angle += c.spin * dt;
      if (c.z < 0) {
        c.z = 0;
        if (!c.bounced) {
          c.vz *= -0.22;
          c.bounced = true;
        } else c.life -= 4;
      }
      if (c.life <= 0) chunks.splice(i, 1);
    }
    for (let i = stains.length - 1; i >= 0; i--) {
      stains[i].life -= dt;
      if (stains[i].life <= 0) stains.splice(i, 1);
    }
  }
  return { blood, chunks, stains, emit, step };
}
