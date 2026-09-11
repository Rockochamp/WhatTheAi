import { clamp } from "./engine.js?v=4";
const TAU = Math.PI * 2;
const polygon = (ctx, points, fill, stroke) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
};
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.backdrop = new Image();
    this.backdrop.src = new URL("./deep-space.webp", import.meta.url).href;
    this.backdrop.onload = () => {
      this.background = null;
    };
    this.stars = Array.from({ length: 125 }, (_, i) => ({
      x: ((i * 73.37) % 100) / 100,
      y: ((i * 41.19) % 100) / 100,
      z: 0.2 + (i % 5) / 5,
      size: i % 9 === 0 ? 1.5 : 0.65,
    }));
    this.particles = [];
    this.rings = [];
    this.labels = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
    this.rockCache = new WeakMap();
    this.background = null;
    this.starScroll = 0;
  }
  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.background = null;
    this.trail = [];
  }
  reset() {
    this.particles = [];
    this.rings = [];
    this.labels = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
  }
  burst(x, y, color, count = 20, force = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU,
        v = (35 + Math.random() * 200) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.6,
        max: 1,
        color,
        size: 1 + Math.random() * 3,
      });
    }
    if (this.particles.length > 240)
      this.particles.splice(0, this.particles.length - 240);
  }
  event(e, reduced = false) {
    const count = reduced ? 7 : 23;
    if (e.type === "phase") {
      this.rings.push({ x: e.x, y: e.y, r: 15, life: 0.65, color: "#7fffe6" });
      this.burst(e.x, e.y, "#91ffe8", count, 1.6);
    }
    if (e.type === "shatter") {
      this.burst(e.x, e.y, "#abbff3", count, 1.3);
      this.rings.push({ x: e.x, y: e.y, r: 5, life: 0.25, color: "#bcfcff" });
    }
    if (e.type === "hit") {
      this.burst(e.x, e.y, "#ff997c", count * 2, 1.5);
      this.shake = reduced ? 0 : 9;
      this.flash = 0.5;
    }
    if (e.type === "star" || e.type === "repair") {
      const color = e.type === "star" ? "#ffdf95" : "#7df8b5";
      this.burst(e.x, e.y, color, reduced ? 4 : 10, 0.5);
      this.labels.push({
        x: e.x,
        y: e.y,
        text: e.type === "repair" ? "SHIELD READY" : `+${e.points}`,
        color,
        life: 1,
      });
    }
    if (e.type === "near") {
      this.labels.push({
        x: e.x,
        y: e.y,
        text: `CLOSE CALL  +${e.points}`,
        color: "#81ffe5",
        life: 1.1,
      });
      this.burst(e.x, e.y + 30, "#84fff3", reduced ? 3 : 9, 0.4);
    }
  }
  backdropLayer(f, time, reduced) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    if (!this.background) {
      this.background = document.createElement("canvas");
      this.background.width = Math.ceil(w);
      this.background.height = Math.ceil(h);
      const b = this.background.getContext("2d");
      b.fillStyle = "#0b1024";
      b.fillRect(0, 0, w, h);
      if (this.backdrop.complete && this.backdrop.naturalWidth) {
        const size = Math.max(
          w / this.backdrop.width,
          h / this.backdrop.height,
        );
        const iw = this.backdrop.width * size,
          ih = this.backdrop.height * size;
        b.drawImage(this.backdrop, (w - iw) * 0.65, (h - ih) * 0.5, iw, ih);
      } else {
        const g = b.createRadialGradient(
          w * 0.7,
          h * 0.3,
          0,
          w * 0.6,
          h * 0.5,
          w * 0.7,
        );
        g.addColorStop(0, "#30345e");
        g.addColorStop(1, "#070b19");
        b.fillStyle = g;
        b.fillRect(0, 0, w, h);
      }
    }
    c.drawImage(this.background, 0, 0, w, h);
    const menu = f.status === "ready";
    c.fillStyle = menu ? "#05091610" : "#02081491";
    c.fillRect(0, 0, w, h);
    if (!menu && f.level > 1) {
      c.fillStyle = ["#39154612", "#072e3b20", "#37151520", "#15123b30"][
        Math.min(3, Math.floor((f.level - 1) / 10))
      ];
      c.fillRect(0, 0, w, h);
    }
    for (const star of this.stars) {
      const x = star.x * w,
        y = ((star.y * h + this.starScroll * star.z) % (h + 8)) - 4;
      c.globalAlpha = 0.23 + star.z * 0.55;
      c.fillStyle = star.z > 0.8 ? "#cad6ff" : "#829cb9";
      const stretch =
        !menu && !reduced ? (f.phaseLeft ? 16 : 2 + Math.min(4, f.level)) : 1;
      c.fillRect(x, y, star.size, star.size * stretch);
    }
    c.globalAlpha = 1;
  }
  rock(rock) {
    let sprite = this.rockCache.get(rock);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = 128;
      sprite.height = 128;
      const c = sprite.getContext("2d");
      c.translate(64, 64);
      const edges = rock.shape?.length
        ? rock.shape
        : [0.8, 1, 0.88, 0.93, 0.8, 0.95, 0.83, 0.91, 0.86, 0.9];
      const points = edges.map((r, i) => [
        Math.cos((i / edges.length) * TAU) * r * 52,
        Math.sin((i / edges.length) * TAU) * r * 52,
      ]);
      const g = c.createLinearGradient(-40, -48, 32, 47);
      g.addColorStop(0, "#cad3e0");
      g.addColorStop(0.2, "#7e899e");
      g.addColorStop(0.55, "#3a455c");
      g.addColorStop(1, "#171e31");
      polygon(c, points, g, "#b8cbe299");
      c.save();
      c.clip();
      for (let i = 0; i < 7; i++) {
        const x = Math.sin(i * 31 + 2) * 34,
          y = Math.cos(i * 18) * 32,
          r = 7 + (i % 3) * 4;
        const crater = c.createRadialGradient(x + 2, y + 3, 1, x, y, r);
        crater.addColorStop(0, "#09112288");
        crater.addColorStop(0.7, "#151f3344");
        crater.addColorStop(1, "#b3c4e01c");
        c.fillStyle = crater;
        c.beginPath();
        c.ellipse(x, y, r, r * 0.7, i, 0, TAU);
        c.fill();
      }
      c.strokeStyle = "#b9d3f324";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-39, -25);
      c.lineTo(-8, -5);
      c.lineTo(9, -34);
      c.moveTo(-8, -5);
      c.lineTo(12, 24);
      c.lineTo(35, 29);
      c.stroke();
      c.restore();
      this.rockCache.set(rock, sprite);
    }
    const c = this.ctx;
    c.save();
    c.translate(rock.x, rock.y);
    if (rock.kind === "meteor") {
      const a = Math.atan2(rock.drift, rock.speed);
      c.rotate(-a);
      const g = c.createLinearGradient(0, 0, 0, -rock.radius * 8);
      g.addColorStop(0, "#ffb989b0");
      g.addColorStop(0.35, "#f977533f");
      g.addColorStop(1, "#ff683000");
      polygon(
        c,
        [
          [-rock.radius, 0],
          [0, -rock.radius * 8],
          [rock.radius, 0],
        ],
        g,
      );
      c.rotate(a);
      c.shadowColor = "#ff8a69";
      c.shadowBlur = 17;
    }
    c.rotate(rock.rotation);
    c.globalAlpha = rock.hit ? 0.4 : 1;
    c.drawImage(
      sprite,
      -rock.radius * 1.23,
      -rock.radius * 1.23,
      rock.radius * 2.46,
      rock.radius * 2.46,
    );
    c.restore();
  }
  ship(x, y, scale, lean, time, phase = false, invulnerable = false) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(lean * 0.25);
    c.scale(scale, scale);
    // Twin ion drives, swept wings, layered titanium plating and a glass canopy.
    c.globalCompositeOperation = "lighter";
    for (const engineX of [-10, 10]) {
      const length = (phase ? 92 : 46) + Math.sin(time * 47 + engineX) * 7;
      const g = c.createLinearGradient(0, 14, 0, length);
      g.addColorStop(0, "#efffff");
      g.addColorStop(0.15, "#75ffefc0");
      g.addColorStop(0.55, "#508cff48");
      g.addColorStop(1, "#627fff00");
      polygon(
        c,
        [
          [engineX - 5, 13],
          [engineX - 4, length * 0.56],
          [engineX, length],
          [engineX + 4, length * 0.56],
          [engineX + 5, 13],
        ],
        g,
      );
    }
    c.globalCompositeOperation = "source-over";
    if (phase || invulnerable) {
      c.strokeStyle = phase ? "#90fff0dd" : "#ffbd94aa";
      c.lineWidth = 1.2;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 10;
      c.beginPath();
      c.ellipse(0, 0, 34, 40, 0, 0, TAU);
      c.stroke();
      c.fillStyle = phase ? "#80ffe90d" : "#ffad7d0a";
      c.fill();
      c.shadowBlur = 0;
    }
    polygon(
      c,
      [
        [-8, -9],
        [-17, -1],
        [-28, 20],
        [-13, 13],
        [-8, 18],
      ],
      "#8a9fc0",
      "#d4eaff80",
    );
    polygon(
      c,
      [
        [8, -9],
        [17, -1],
        [28, 20],
        [13, 13],
        [8, 18],
      ],
      "#435776",
      "#9cbbdf80",
    );
    polygon(
      c,
      [
        [-15, 1],
        [-23, 17],
        [-11, 10],
      ],
      "#d0dbee",
    );
    polygon(
      c,
      [
        [15, 1],
        [23, 17],
        [11, 10],
      ],
      "#8facc7",
    );
    polygon(
      c,
      [
        [-12, 1],
        [-6, -19],
        [0, -32],
        [6, -19],
        [12, 1],
        [8, 18],
        [0, 23],
        [-8, 18],
      ],
      "#839bb8",
      "#d8ebff99",
    );
    polygon(
      c,
      [
        [0, -32],
        [-3, -15],
        [-3, 15],
        [0, 23],
        [-8, 18],
        [-12, 1],
        [-6, -19],
      ],
      "#e6edf5",
    );
    polygon(
      c,
      [
        [0, -32],
        [6, -19],
        [12, 1],
        [8, 18],
        [3, 15],
        [3, -15],
      ],
      "#718ba9",
    );
    polygon(
      c,
      [
        [0, -19],
        [5, -6],
        [4, 5],
        [0, 9],
        [-4, 5],
        [-5, -6],
      ],
      "#071e32",
      "#a3e7ef",
    );
    polygon(
      c,
      [
        [0, -17],
        [2, -5],
        [0, 5],
        [-2, -5],
      ],
      "#8bece4",
    );
    polygon(
      c,
      [
        [-12, 8],
        [-7, 8],
        [-7, 19],
        [-12, 19],
      ],
      "#143549",
      "#77eadb",
    );
    polygon(
      c,
      [
        [12, 8],
        [7, 8],
        [7, 19],
        [12, 19],
      ],
      "#143549",
      "#77eadb",
    );
    c.strokeStyle = "#6dffdf";
    c.lineWidth = 1.6;
    c.shadowBlur = 7;
    c.shadowColor = "#5fffda";
    c.beginPath();
    c.moveTo(-24, 17);
    c.lineTo(-18, 13);
    c.moveTo(24, 17);
    c.lineTo(18, 13);
    c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = "#304c68";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-6, -13);
    c.lineTo(-8, 3);
    c.moveTo(6, -13);
    c.lineTo(8, 3);
    c.stroke();
    c.restore();
  }
  pickup(p, time) {
    const c = this.ctx,
      s = p.radius / 9;
    c.save();
    c.translate(p.x, p.y);
    c.scale(s, s);
    const repair = p.type === "repair",
      color = repair ? "#81ffb1" : "#ffd986";
    c.shadowBlur = repair ? 14 : 11;
    c.shadowColor = color;
    c.strokeStyle = color;
    c.fillStyle = color;
    if (repair) {
      c.rotate(Math.PI / 4);
      c.strokeRect(-7, -7, 14, 14);
      c.rotate(-Math.PI / 4);
      c.fillRect(-1.6, -5, 3.2, 10);
      c.fillRect(-5, -1.6, 10, 3.2);
    } else {
      c.rotate(time * 0.8);
      polygon(
        c,
        [
          [0, -10],
          [3, -3],
          [10, 0],
          [3, 3],
          [0, 10],
          [-3, 3],
          [-10, 0],
          [-3, -3],
        ],
        color,
      );
    }
    c.shadowBlur = 0;
    c.globalAlpha = 0.24;
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(0, 0, 15 + Math.sin(time * 3) * 2, 0, TAU);
    c.stroke();
    c.restore();
  }
  draw(f, time, dt, reduced = false) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    if (!w || !h) return;
    const paused = f.status === "paused",
      ed = paused ? 0 : dt;
    this.starScroll +=
      ed *
      (f.status === "ready" ? 10 : 80 + f.level * 12) *
      (f.phaseLeft && !reduced ? 4 : 1);
    c.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    this.backdropLayer(f, time, reduced);
    c.save();
    if (this.shake && !reduced) {
      c.translate(
        Math.sin(time * 83) * this.shake,
        Math.cos(time * 61) * this.shake * 0.65,
      );
      this.shake = Math.max(0, this.shake - ed * 30);
    }
    if (f.status === "ready") {
      this.menuRocks ??= Array.from({ length: 8 }, (_, i) => ({
        x: 0,
        y: 0,
        radius: 18 + (i % 3) * 12,
        rotation: i,
        shape: [0.8, 0.98, 0.83, 0.95, 0.81, 0.88, 0.97, 0.84],
      }));
      for (const [i, r] of this.menuRocks.entries()) {
        r.x = w * (0.54 + (Math.sin(i * 19) + 1) * 0.2);
        r.y =
          ((i * 0.173 * h + (reduced ? 0 : time) * (8 + i)) % (h + 160)) - 80;
        r.rotation = i + time * 0.06;
        this.rock(r);
      }
      const mobile = w < 700;
      this.ship(
        w * (mobile ? 0.83 : 0.72),
        h * (mobile ? 0.13 : 0.53) + Math.sin(time * 0.8) * (reduced ? 0 : 9),
        mobile ? 1.25 : clamp(h / 190, 2, 4),
        -1.1,
        time,
      );
    } else {
      for (const warning of f.warnings) {
        const alpha = 0.15 + 0.4 * (1 - warning.left / warning.duration);
        c.save();
        c.strokeStyle = `rgba(255,139,108,${alpha})`;
        c.lineWidth = 1.5;
        c.setLineDash([8, 10]);
        c.lineDashOffset = -time * 35;
        c.beginPath();
        c.moveTo(warning.x, 0);
        c.lineTo(warning.endX, h);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#ffae8e";
        c.font = "bold 18px sans-serif";
        c.textAlign = "center";
        c.fillText("!", warning.x, 30);
        c.restore();
      }
      if (!paused && f.status === "playing") {
        this.trail.push({ x: f.player.x, y: f.player.y + 12 * f.scale });
        if (this.trail.length > 22) this.trail.shift();
      }
      if (!reduced && this.trail.length > 1 && f.status !== "over") {
        c.lineCap = "round";
        for (let i = 1; i < this.trail.length; i++) {
          c.strokeStyle = `rgba(103,239,220,${(i / this.trail.length) * 0.16})`;
          c.lineWidth = (i / this.trail.length) * 10 * f.scale;
          c.beginPath();
          c.moveTo(
            this.trail[i - 1].x,
            this.trail[i - 1].y + (this.trail.length - i) * 3,
          );
          c.lineTo(
            this.trail[i].x,
            this.trail[i].y + (this.trail.length - i - 1) * 3,
          );
          c.stroke();
        }
      }
      for (const p of f.pickups) this.pickup(p, time);
      for (const r of f.asteroids) this.rock(r);
      if (f.status !== "over")
        this.ship(
          f.player.x,
          f.player.y,
          f.scale,
          f.player.lean,
          time,
          f.phaseLeft > 0,
          f.invulnerable > 0,
        );
    }
    for (const r of this.rings) {
      r.life -= ed;
      r.r += ed * 210 * f.scale;
      c.globalAlpha = Math.max(0, r.life);
      c.strokeStyle = r.color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, TAU);
      c.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    c.globalAlpha = 1;
    for (const p of this.particles) {
      p.life -= ed;
      p.x += p.vx * ed;
      p.y += p.vy * ed;
      p.vx *= Math.exp(-ed * 2);
      p.vy *= Math.exp(-ed * 2);
      c.globalAlpha = clamp(p.life * 2, 0, 1);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    c.globalAlpha = 1;
    for (const l of this.labels) {
      l.life -= ed;
      l.y -= ed * 32;
      c.globalAlpha = clamp(l.life * 2, 0, 1);
      c.textAlign = "center";
      c.font = `600 ${Math.max(10, 12 * f.scale)}px monospace`;
      c.fillStyle = l.color;
      c.fillText(l.text, clamp(l.x, 85, w - 85), l.y);
    }
    this.labels = this.labels.filter((l) => l.life > 0);
    c.globalAlpha = 1;
    c.restore();
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - ed * 1.4);
      c.strokeStyle = `rgba(255,140,107,${this.flash})`;
      c.lineWidth = 10;
      c.strokeRect(0, 0, w, h);
    }
  }
}
