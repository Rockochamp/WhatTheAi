// Presentation-only gore. Separate randomness and strict budgets protect gameplay.
export const GORE_LIMITS = { blood: 280, chunks: 64, stains: 140 };
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
    const shape = Math.floor(random() * 6);
    stains.push({
      x,
      y,
      size,
      angle: random() * TAU,
      points: Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * TAU;
        const r =
          0.64 + 0.27 * Math.sin(i * 2.7 + shape) + 0.1 * Math.cos(i * 5.1);
        return [Math.cos(a) * r, Math.sin(a) * r * 0.72];
      }),
      life: heavy ? 48 : 30,
      max: heavy ? 48 : 30,
      heavy,
    });
    trim(stains, budget.stains);
  }
  function emit(
    event,
    player,
    { low = false, quiet = false, enabled = true } = {},
  ) {
    if (!enabled || !["hit", "kill", "hurt"].includes(event.type)) return;
    budget = low ? { blood: 110, chunks: 24, stains: 60 } : GORE_LIMITS;
    const dead = event.type === "kill",
      hurt = event.type === "hurt";
    const x = hurt ? player.x : event.x,
      y = hurt ? player.y : event.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const boss = event.size >= 130,
      big = event.size >= 90,
      amount = dead
        ? boss
          ? 65
          : big
            ? 42
            : 29
        : hurt
          ? 18
          : event.critical
            ? 12
            : 6;
    const count = Math.max(
      2,
      Math.round(amount * (low ? 0.38 : quiet ? 0.5 : 1)),
    );
    const direction = Math.atan2(y - player.y, x - player.x),
      spread = dead ? TAU : 1.5;
    for (let i = 0; i < count; i++) {
      const angle = direction + (random() - 0.5) * spread,
        speed = (dead ? 90 : 45) + random() * (boss ? 310 : dead ? 215 : 130);
      blood.push({
        x,
        y,
        z: 12 + random() * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 55 + random() * 150,
        size: (dead ? 3.4 : 2.1) + random() * (big ? 4.5 : 3.2),
        streak: dead && i < 4 ? 5.5 : 2.5,
        life: 1.1,
        red: hurt ? 2 : i % 3,
      });
    }
    if (dead) {
      stain(x, y, (boss ? 62 : big ? 43 : 31) * (0.8 + random() * 0.4), true);
      const pieces = low ? 2 : quiet ? 4 : boss ? 16 : big ? 10 : 7;
      for (let i = 0; i < pieces; i++) {
        const angle = random() * TAU,
          speed = 85 + random() * (boss ? 245 : 160);
        chunks.push({
          x,
          y,
          z: 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: 105 + random() * 170,
          size: (big ? 9 : 6.5) + random() * 5,
          angle: random() * TAU,
          spin: (random() - 0.5) * 16,
          kind: i % 5,
          life: 15 + random() * 6,
          max: 21,
          bounced: false,
        });
      }
    } else if (hurt || event.critical) stain(x, y, hurt ? 13 : 7);
    trim(blood, budget.blood);
    trim(chunks, budget.chunks);
    trim(stains, budget.stains);
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const drop of blood) {
      drop.life -= dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;
      drop.vz -= 720 * dt;
      if (drop.z <= 0) {
        stain(drop.x, drop.y, drop.size * (1.3 + random()));
        drop.life = 0;
      }
    }
    for (const chunk of chunks) {
      chunk.life -= dt;
      if (chunk.z > 0 || chunk.vz > 0) {
        chunk.x += chunk.vx * dt;
        chunk.y += chunk.vy * dt;
        chunk.z += chunk.vz * dt;
        chunk.vz -= 760 * dt;
        chunk.angle += chunk.spin * dt;
        if (chunk.z <= 0) {
          chunk.z = 0;
          if (!chunk.bounced) {
            chunk.bounced = true;
            chunk.vz = Math.abs(chunk.vz) * 0.23;
            chunk.vx *= 0.32;
            chunk.vy *= 0.32;
            chunk.spin *= 0.3;
            stain(chunk.x, chunk.y, chunk.size * 1.4);
          } else chunk.vz = 0;
        }
      }
    }
    for (const s of stains) s.life -= dt;
    for (const list of [blood, chunks, stains])
      for (let i = list.length - 1; i >= 0; i--)
        if (list[i].life <= 0) list.splice(i, 1);
  }
  function ground(ctx, point, scale, visible) {
    ctx.save();
    for (const s of stains) {
      if (!visible(s.x, s.y, 70)) continue;
      const p = point(s.x, s.y),
        size = s.size * scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(1, s.life / 6) * (s.heavy ? 0.8 : 0.62);
      ctx.fillStyle = s.heavy ? "#721017" : "#9d1420";
      ctx.beginPath();
      for (let i = 0; i < s.points.length; i++) {
        const x = s.points[i][0] * size,
          y = s.points[i][1] * size;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      if (s.heavy) {
        ctx.fillStyle = "#b6222d";
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.ellipse(
          -size * 0.15,
          -size * 0.1,
          size * 0.42,
          size * 0.23,
          0.4,
          0,
          TAU,
        );
        ctx.fill();
        ctx.fillStyle = "#d64142";
        ctx.globalAlpha *= 0.45;
        ctx.beginPath();
        ctx.ellipse(
          -size * 0.23,
          -size * 0.14,
          size * 0.19,
          size * 0.06,
          0.4,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function airborne(ctx, point, scale, visible) {
    ctx.save();
    for (const c of chunks) {
      if (!visible(c.x, c.y, 80)) continue;
      const p = point(c.x, c.y),
        r = c.size * scale;
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life / 3);
      ctx.fillStyle = "#12070770";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.3, r * 0.46, 0, 0, TAU);
      ctx.fill();
      ctx.translate(p.x, p.y - c.z * scale);
      ctx.rotate(c.angle);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (c.kind === 1) {
        ctx.strokeStyle = "#781321";
        ctx.lineWidth = r * 0.9;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
        ctx.strokeStyle = "#dfc6a0";
        ctx.lineWidth = r * 0.48;
        ctx.stroke();
        ctx.fillStyle = "#ebd6ad";
        for (const x of [-r, r])
          for (const y of [-r * 0.23, r * 0.23]) {
            ctx.beginPath();
            ctx.arc(x, y, r * 0.3, 0, TAU);
            ctx.fill();
          }
      } else if (c.kind === 2) {
        ctx.strokeStyle = "#540814";
        ctx.lineWidth = r * 0.73;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r, -r, r, -r, r, 0);
        ctx.bezierCurveTo(r, r, -r * 0.4, r, -r * 0.3, 0.1 * r);
        ctx.stroke();
        ctx.strokeStyle = "#d94d59";
        ctx.lineWidth = r * 0.38;
        ctx.stroke();
      } else if (c.kind === 3) {
        // A torn eye socket with a dangling strand of tissue.
        ctx.strokeStyle = "#c34250";
        ctx.lineWidth = r * 0.28;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r, r, r * 1.7, -r, r * 2, r * 0.6);
        ctx.stroke();
        ctx.fillStyle = "#82111d";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.2, r, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#efcead";
        ctx.beginPath();
        ctx.arc(-r * 0.1, -r * 0.12, r * 0.65, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#e99a32";
        ctx.beginPath();
        ctx.arc(r * 0.1, -r * 0.14, r * 0.36, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#1a0809";
        ctx.beginPath();
        ctx.arc(r * 0.17, -r * 0.14, r * 0.16, 0, TAU);
        ctx.fill();
      } else if (c.kind === 4) {
        // Broken ribs and wet connective tissue, readable even at phone scale.
        ctx.fillStyle = "#8b1725";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.4, r * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#e7c7a3";
        ctx.lineWidth = r * 0.22;
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.moveTo(j * r * 0.48, r * 0.7);
          ctx.quadraticCurveTo(
            j * r * 0.48 - r * 0.45,
            -r * 0.25,
            j * r * 0.48 + r * 0.25,
            -r,
          );
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#82111d";
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.55);
        ctx.lineTo(r * 0.7, -r);
        ctx.lineTo(r, r * 0.4);
        ctx.lineTo(-r * 0.3, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#df6366";
        ctx.beginPath();
        ctx.ellipse(-r * 0.12, -r * 0.2, r * 0.55, r * 0.27, -0.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#f0b2a2";
        ctx.lineWidth = Math.max(1, r * 0.16);
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.2);
        ctx.lineTo(r * 0.3, r * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
    const reds = ["#bd1527", "#e22a38", "#a51324"];
    for (const d of blood) {
      if (!visible(d.x, d.y, 70)) continue;
      const p = point(d.x, d.y),
        speed = Math.hypot(d.vx, d.vy) || 1;
      ctx.strokeStyle = reds[d.red];
      ctx.lineWidth = Math.max(1, d.size * scale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - d.z * scale);
      ctx.lineTo(
        p.x - (d.vx / speed) * d.size * d.streak * scale,
        p.y - d.z * scale - (d.vy / speed) * d.size * d.streak * scale,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
  return {
    emit,
    update,
    ground,
    airborne,
    clear() {
      blood.length = chunks.length = stains.length = 0;
    },
    get counts() {
      return {
        blood: blood.length,
        chunks: chunks.length,
        stains: stains.length,
      };
    },
  };
}
