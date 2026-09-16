import { ARENA, HOOK_SECONDS, bladePoints, clamp } from "./engine.js";
import { createGore } from "./gore.js";

const TAU = Math.PI * 2;
const GOLD = "#e4b45a";
const BONE = "#ece6de";
const BLOOD = "#c41e1e";
const DRIED = "#6a1010";
const IRON = "#12090a";

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const gore = createGore();
  const floor = new Image();
  floor.src = new URL("./locker.webp", import.meta.url).href;
  let w = 1,
    h = 1,
    dpr = 1,
    trauma = 0,
    flash = 0,
    camX = 0,
    camY = 0,
    labels = [];
  const hooks = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * TAU,
    len: 80 + ((i * 47) % 70),
    swing: i * 0.7,
  }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  function world(x, y, scale) {
    return {
      x: w / 2 + (x - camX) * scale,
      y: h / 2 + (y - camY) * scale,
    };
  }

  function drawBanana(p, scale, t) {
    const split = p.splitT > 0 ? 1 - p.splitT / 0.26 : 0;
    const halves = p.splitT > 0 ? 2 : 1;
    for (let hix = 0; hix < halves; hix++) {
      ctx.save();
      const perp = hix === 0 ? 1 : -1;
      const ox = p.splitT > 0 ? -p.splitVy * 16 * perp : 0;
      const oy = p.splitT > 0 ? p.splitVx * 16 * perp : 0;
      ctx.translate(p.x + ox, p.y + oy);
      ctx.rotate(p.facing + Math.PI / 2);
      const pulse = 1 + Math.sin(t * 8) * (p.ripe >= 1 ? 0.08 : 0.015);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(-7, -22);
      ctx.quadraticCurveTo(-22, -4, -16, 18);
      ctx.quadraticCurveTo(-4, 28, 4, 22);
      ctx.quadraticCurveTo(20, 6, 10, -20);
      ctx.quadraticCurveTo(2, -28, -7, -22);
      const g = ctx.createLinearGradient(-16, -20, 14, 22);
      g.addColorStop(0, "#f6e27a");
      g.addColorStop(0.45, "#e4b45a");
      g.addColorStop(1, "#b07820");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#5a3a10";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (p.splitT > 0) {
        ctx.beginPath();
        ctx.moveTo(-2, -18);
        ctx.lineTo(2, 20);
        ctx.strokeStyle = "#f4e8c8";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      ctx.quadraticCurveTo(-2, -32, 3, -30);
      ctx.strokeStyle = "#3a2810";
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-2, -6, 3.2, 4.4, -0.3, 0, TAU);
      ctx.fillStyle = "#1a1008";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-1.2, -7.2, 1.1, 1.4, -0.3, 0, TAU);
      ctx.fillStyle = "#f4ead0";
      ctx.fill();
      if (p.ripe > 0.55) {
        ctx.strokeStyle = `rgba(196,30,30,${0.25 + p.ripe * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 6);
        ctx.quadraticCurveTo(0, 16, 8, 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (p.ripe > 0.05) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.orbit + 10, -Math.PI / 2, -Math.PI / 2 + TAU * p.ripe);
      ctx.strokeStyle = p.ripe >= 1 ? BLOOD : GOLD;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawBlade(b, p) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.quadraticCurveTo(-10, 0, -2, 16);
    ctx.quadraticCurveTo(6, 2, 4, -12);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -14, 0, 16);
    g.addColorStop(0, "#f3d98a");
    g.addColorStop(1, "#c41e1e");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#2a1808";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  function drawMeat(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const s = e.size / 36;
    ctx.scale(s, s);
    if (e.flash > 0) ctx.globalAlpha = 0.55 + e.flash * 4;
    ctx.fillStyle = e.kind === "prize" ? "#8a2020" : e.kind === "drip" ? "#6a3018" : "#7a1818";
    ctx.strokeStyle = e.enraged ? GOLD : "#2a0a0a";
    ctx.lineWidth = 1.6 / s;
    if (e.kind === "brisket" || e.kind === "prize") {
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 16, 0.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BONE;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 7 - 2, -14, 3, 12);
      }
    } else if (e.kind === "twin") {
      ctx.beginPath();
      ctx.arc(-8, 0, 12, 0, TAU);
      ctx.arc(8, 2, 11, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === "snare") {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.quadraticCurveTo(22, -16, 18, 2);
      ctx.strokeStyle = "#c8c0b4";
      ctx.lineWidth = 2.4 / s;
      ctx.stroke();
    } else if (e.kind === "shank") {
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, -0.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#1a0808";
    ctx.beginPath();
    ctx.arc(-4, -3, 2.2, 0, TAU);
    ctx.arc(5, -2, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (e.kind === "prize") {
      ctx.font = "700 11px Oswald, sans-serif";
      ctx.fillStyle = GOLD;
      ctx.textAlign = "center";
      ctx.fillText(e.name.toUpperCase(), e.x, e.y - e.size * 0.55);
    }
  }

  function draw() {
    /* filled in draw(run) */
  }

  return {
    resize,
    emit(events, run, opts) {
      for (const e of events) {
        gore.emit(e, run.player, opts);
        if (e.type === "kill" || e.type === "burst" || e.type === "split") {
          trauma = Math.min(1, trauma + (e.type === "burst" ? 0.55 : 0.22));
          labels.push({
            x: e.x,
            y: e.y,
            text: e.type === "burst" ? "BURST" : e.type === "split" ? "SPLIT" : "PULP",
            life: 0.7,
            color: e.type === "burst" ? BLOOD : GOLD,
          });
        }
        if (e.type === "hurt") {
          trauma = Math.min(1, trauma + 0.35);
          flash = 0.18;
        }
        if (e.type === "crush") {
          trauma = Math.min(1, trauma + 0.28);
          labels.push({ x: e.x, y: e.y, text: "CRUSH", life: 0.55, color: BLOOD });
        }
      }
    },
    draw(run, dt, opts = {}) {
      if (!run) return;
      const p = run.player;
      const scale = Math.min(w, h) / 340;
      const follow = 1 - Math.exp(-10 * dt);
      camX += (p.x - camX) * follow;
      camY += (p.y - camY) * follow;
      trauma = Math.max(0, trauma - dt * 1.8);
      flash = Math.max(0, flash - dt);
      const shake = trauma * trauma;
      const ox = (Math.random() - 0.5) * 18 * shake;
      const oy = (Math.random() - 0.5) * 18 * shake;
      gore.step(dt);
      for (const l of labels) l.life -= dt;
      labels = labels.filter((l) => l.life > 0);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = IRON;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2 + ox, h / 2 + oy);
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      const tile = 220;
      if (floor.complete && floor.naturalWidth) {
        const x0 = Math.floor((camX - w / scale) / tile) * tile;
        const y0 = Math.floor((camY - h / scale) / tile) * tile;
        for (let x = x0; x < camX + w / scale + tile; x += tile) {
          for (let y = y0; y < camY + h / scale + tile; y += tile) {
            ctx.drawImage(floor, x, y, tile, tile);
          }
        }
      }

      ctx.beginPath();
      ctx.arc(0, 0, run.arenaR + 8, 0, TAU);
      ctx.strokeStyle = "#e4b45a33";
      ctx.lineWidth = 6;
      ctx.stroke();

      for (const hk of hooks) {
        const a = hk.a + Math.sin(run.time * 0.7 + hk.swing) * 0.08;
        const x = Math.cos(a) * (run.arenaR - 18);
        const y = Math.sin(a) * (run.arenaR - 18);
        ctx.strokeStyle = "#6a6460";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - hk.len);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, Math.PI * 0.15, Math.PI * 1.1);
        ctx.strokeStyle = "#c8c0b4";
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }

      const drop = 1 - clamp(run.hook / HOOK_SECONDS, 0, 1);
      if (!run.prizeId && drop > 0.02) {
        const y = -run.arenaR + drop * (run.arenaR * 0.55);
        ctx.strokeStyle = "#aaa49e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -run.arenaR - 40);
        ctx.lineTo(0, y);
        ctx.stroke();
        ctx.fillStyle = "#6a1818";
        ctx.beginPath();
        ctx.ellipse(0, y + 18, 22, 16, 0, 0, TAU);
        ctx.fill();
      }

      for (const st of gore.stains) {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(st.angle);
        ctx.globalAlpha = clamp(st.life / st.max, 0, 0.7);
        ctx.fillStyle = st.heavy ? DRIED : "#7a1414";
        ctx.beginPath();
        st.points.forEach(([px, py], i) => {
          const x = px * st.size,
            y = py * st.size;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      for (const o of run.pools) {
        ctx.globalAlpha = clamp(o.life / 5.2, 0.2, 0.55);
        ctx.fillStyle = o.acid ? "#4a6a18" : BLOOD;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.r, o.r * 0.72, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const c of run.corpses) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.globalAlpha = clamp(c.life / 2.8, 0.15, 0.7);
        ctx.fillStyle = "#4a1010";
        ctx.beginPath();
        ctx.ellipse(0, 0, c.r * 1.1, c.r * 0.7, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      for (const d of run.drops) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = BLOOD;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2, 0, TAU);
        ctx.fill();
      }

      for (const e of run.enemies) if (!e.dead) drawMeat(e);
      for (const b of bladePoints(run)) drawBlade(b, p);
      drawBanana(p, scale, run.time);

      for (const b of gore.blood) {
        ctx.globalAlpha = clamp(b.life, 0, 1);
        ctx.fillStyle = b.red === 0 ? BLOOD : b.red === 1 ? "#8a1010" : "#e06048";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y - b.z * 0.12, b.size, b.size * 0.7 + b.streak * 0.15, 0, 0, TAU);
        ctx.fill();
      }
      for (const c of gore.chunks) {
        ctx.save();
        ctx.translate(c.x, c.y - c.z * 0.12);
        ctx.rotate(c.angle);
        ctx.globalAlpha = clamp(c.life / 16, 0, 1);
        ctx.fillStyle = c.kind % 2 ? BLOOD : "#c8b090";
        ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      for (const l of labels) {
        ctx.font = "700 14px Oswald, sans-serif";
        ctx.fillStyle = l.color;
        ctx.globalAlpha = clamp(l.life / 0.7, 0, 1);
        ctx.textAlign = "center";
        ctx.fillText(l.text, l.x, l.y - (0.7 - l.life) * 28);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (flash > 0) {
        ctx.fillStyle = `rgba(160,16,16,${flash * 0.45})`;
        ctx.fillRect(0, 0, w, h);
      }
      const flood = Math.min(1, run.pools.length / 16);
      if (flood > 0.05) {
        ctx.fillStyle = `rgba(40,4,6,${flood * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (opts.quiet) {
        /* reduced motion already used quieter gore */
      }
    },
  };
}
