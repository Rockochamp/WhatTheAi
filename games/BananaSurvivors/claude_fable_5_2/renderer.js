// Canvas drawing for Peel Out. Everything is a few arcs and curves: a
// cartoon, not a painting, so two hundred tumbling monkeys stay cheap.
import { clamp, rng, TAU } from "../../../js/fable/kit.js?v=1";
import { ARENA } from "./engine.js?v=1";

const COAT = {
  monkey: ["#8a5a33", "#ecc8a0"],
  baby: ["#b57a44", "#f4d9b8"],
  thrower: ["#70452a", "#e6bd92"],
  gorilla: ["#4b4c59", "#8d909e"],
  boss: ["#34343f", "#8d909e"],
};

function groundTile() {
  const c = document.createElement("canvas"),
    S = (c.width = c.height = 320),
    g = c.getContext("2d"),
    r = rng(77);
  g.fillStyle = "#3d9a57";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    const x = r() * S,
      y = r() * S,
      rad = 14 + r() * 34;
    g.fillStyle = r() < 0.5 ? "rgba(30,110,60,0.22)" : "rgba(120,200,110,0.16)";
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      g.beginPath();
      g.ellipse(x + ox, y + oy, rad, rad * 0.6, r() * 3, 0, TAU);
      g.fill();
    }
  }
  g.strokeStyle = "rgba(20,90,50,0.5)";
  g.lineWidth = 2;
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = r() * S,
      y = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 5, y - 5 - r() * 5);
    g.stroke();
  }
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d", { alpha: false });
    this.tile = groundTile();
    this.pattern = this.g.createPattern(this.tile, "repeat");
    this.puffs = [];
    this.words = [];
    this.trail = [];
    this.shake = 0;
    this.t = 0;
    this.cam = { x: ARENA / 2, y: ARENA / 2 };
    this.view = { w: 1, h: 1, dpr: 1, scale: 1 };
  }
  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 1.5e6 ? 1.5 : 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.view = { w, h, dpr, scale: clamp(Math.min(w, h) / 620, 0.62, 1.45) };
  }
  toWorld(x, y) {
    const { w, h, scale } = this.view;
    return { x: this.cam.x + (x - w / 2) / scale, y: this.cam.y + (y - h / 2) / scale };
  }
  reset() {
    this.puffs.length = this.words.length = this.trail.length = 0;
    this.shake = 0;
  }
  puff(x, y, n = 4, color = "rgba(255,255,255,0.75)", speed = 60) {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n && this.puffs.length < 260; i++) {
      const a = Math.random() * TAU,
        v = speed * (0.4 + Math.random());
      this.puffs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 4 + Math.random() * 6, life: 0.45, max: 0.45, color });
    }
  }
  word(x, y, text, color = "#fff", size = 20) {
    if (this.words.length < 26) this.words.push({ x, y, text, color, size, life: 0.7, max: 0.7, rot: (Math.random() - 0.5) * 0.5 });
  }
  handle(e) {
    switch (e.type) {
      case "bonk":
        this.word(e.x, e.y - 22, e.golden ? "BONK!!" : "BONK!", e.golden ? "#ffe45c" : "#ffffff", e.golden ? 26 : 19);
        this.puff(e.x, e.y, 5);
        break;
      case "bump":
        this.puff(e.x, e.y, 3);
        break;
      case "ko":
        this.puff(e.x, e.y, 6, "rgba(255,240,170,0.9)", 110);
        if (e.kind === "boss") this.shake = 22;
        break;
      case "crash":
        this.word(e.x, e.y - 40, "CRASH!", "#fff2b0", 24);
        this.puff(e.x, e.y, 8, "rgba(190,240,170,0.9)", 140);
        this.shake = Math.max(this.shake, 6);
        break;
      case "thunk":
        this.puff(e.x, e.y, 9, e.friendly ? "rgba(255,255,255,0.85)" : "rgba(255,140,120,0.9)", 150);
        this.shake = Math.max(this.shake, e.friendly ? 4 : 8);
        break;
      case "burst":
        this.puff(e.x, e.y, 16, "rgba(255,225,90,0.9)", 260);
        this.word(e.x, e.y - 30, "SPLAT!", "#ffe45c", 26);
        break;
      case "hurt":
        this.shake = 12;
        break;
      case "combo":
        this.word(e.x, e.y - 50, e.label, "#ffe45c", 34);
        break;
    }
  }

  draw(game, dt, { reduced = false, dim = 0 } = {}) {
    const g = this.g,
      { w, h, dpr, scale } = this.view,
      p = game.player;
    this.reduced = reduced;
    this.t += dt;
    const halfW = w / scale / 2,
      halfH = h / scale / 2,
      pad = 90;
    const tx = halfW * 2 >= ARENA + pad * 2 ? ARENA / 2 : clamp(p.x, halfW - pad, ARENA - halfW + pad),
      ty = halfH * 2 >= ARENA + pad * 2 ? ARENA / 2 : clamp(p.y, halfH - pad, ARENA - halfH + pad);
    const k = 1 - Math.exp(-10 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    let sx = 0,
      sy = 0;
    if (this.shake > 0.4 && !reduced) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    this.shake *= Math.exp(-8 * dt);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0e3b2b";
    g.fillRect(0, 0, w, h);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w / 2 - this.cam.x * scale + sx), dpr * (h / 2 - this.cam.y * scale + sy));
    const L = this.cam.x - halfW - 60,
      T = this.cam.y - halfH - 60,
      Rr = this.cam.x + halfW + 60,
      B = this.cam.y + halfH + 60,
      seen = (o, m = 60) => o.x > L - m && o.x < Rr + m && o.y > T - m && o.y < B + m;
    g.fillStyle = this.pattern;
    g.fillRect(0, 0, ARENA, ARENA);
    g.strokeStyle = "#17573a";
    g.lineWidth = 26;
    g.strokeRect(-13, -13, ARENA + 26, ARENA + 26);
    g.fillStyle = "#1f7a4a";
    for (let i = 0; i <= ARENA; i += 74) {
      for (const [x, y] of [[i, -8], [i, ARENA + 8], [-8, i], [ARENA + 8, i]]) {
        if (x < L || x > Rr || y < T || y > B) continue;
        g.beginPath();
        g.arc(x, y, 30 + ((i * 7) % 13), 0, TAU);
        g.fill();
      }
    }

    // ground things: warnings, peels, drops
    for (const c of game.coconuts) {
      if (!seen(c)) continue;
      const k2 = clamp(1 - c.t / 1, 0, 1);
      g.fillStyle = c.friendly ? `rgba(255,255,255,${0.1 + 0.2 * k2})` : `rgba(255,90,70,${0.14 + 0.3 * k2})`;
      g.beginPath();
      g.arc(c.x, c.y, c.r, 0, TAU);
      g.fill();
      g.strokeStyle = c.friendly ? "rgba(255,255,255,0.7)" : "#ff5a46";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c.x, c.y, c.r * (c.friendly ? 1 : 0.3 + 0.7 * k2), 0, TAU);
      g.stroke();
    }
    for (const e of game.enemies)
      if (e.type === "boss" && e.phase === "wind" && seen(e, 700)) {
        g.strokeStyle = "rgba(255,90,70,0.55)";
        g.lineWidth = e.r * 1.6;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(e.x, e.y);
        g.lineTo(e.x + e.cx * 480, e.y + e.cy * 480);
        g.stroke();
      }
    for (const o of game.orbs) {
      if (!seen(o)) continue;
      g.fillStyle = "#35d0ba";
      g.beginPath();
      g.arc(o.x, o.y + Math.sin(this.t * 5 + o.x) * 2, 5.5, 0, TAU);
      g.fill();
      g.fillStyle = "#d8fff7";
      g.fillRect(o.x - 2.5, o.y - 3 + Math.sin(this.t * 5 + o.x) * 2, 2.5, 2.5);
    }
    for (const q of game.peels) if (seen(q)) this.peel(g, q);

    // standing things, back to front
    const list = [];
    for (const e of game.enemies) if (seen(e)) list.push(e);
    for (const t of game.trees) if (seen(t, 110)) list.push(t);
    list.push(p);
    list.sort((a, b) => a.y - b.y);
    if (p.dash > 0) this.trail.push({ x: p.x, y: p.y, life: 0.25 });
    for (const q of this.trail) {
      q.life -= dt;
      g.globalAlpha = Math.max(0, q.life * 2);
      this.banana(g, { ...p, x: q.x, y: q.y }, game, true);
    }
    g.globalAlpha = 1;
    this.trail = this.trail.filter((q) => q.life > 0);
    for (const o of list) {
      if (o === p) this.banana(g, p, game);
      else if (o.shake !== undefined) this.trunk(g, o);
      else this.monkey(g, o);
    }
    for (const t of game.trees) if (seen(t, 110)) this.canopy(g, t);
    for (const c of game.coconuts) {
      if (!seen(c)) continue;
      const fall = Math.max(0, c.t) * 620;
      g.fillStyle = "#6b4226";
      g.beginPath();
      g.arc(c.x, c.y - fall, 11, 0, TAU);
      g.fill();
      g.fillStyle = "#3a2314";
      g.fillRect(c.x - 4, c.y - fall - 3, 2.5, 2.5);
      g.fillRect(c.x + 2, c.y - fall - 3, 2.5, 2.5);
    }

    // puffs and words
    for (const q of this.puffs) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      g.globalAlpha = clamp(q.life / q.max, 0, 1) * 0.8;
      g.fillStyle = q.color;
      g.beginPath();
      g.arc(q.x, q.y, q.r * (1.6 - q.life / q.max), 0, TAU);
      g.fill();
    }
    this.puffs = this.puffs.filter((q) => q.life > 0);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    for (const q of this.words) {
      q.life -= dt;
      const kk = clamp(q.life / q.max, 0, 1),
        pop = 1 + 0.5 * Math.max(0, kk - 0.8) * 5;
      g.save();
      g.translate(q.x, q.y - (1 - kk) * 26);
      g.rotate(q.rot);
      g.scale(pop, pop);
      g.globalAlpha = Math.min(1, kk * 3);
      g.font = `700 ${q.size}px Fredoka, system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = "#1a2b1f";
      g.strokeText(q.text, 0, 0);
      g.fillStyle = q.color;
      g.fillText(q.text, 0, 0);
      g.restore();
    }
    this.words = this.words.filter((q) => q.life > 0);
    g.globalAlpha = 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (p.hurt > 0.45 && !reduced) {
      g.fillStyle = `rgba(255,70,50,${(p.hurt - 0.45) * 1.2})`;
      g.fillRect(0, 0, w, h);
    }
    if (dim) {
      g.fillStyle = `rgba(8,30,22,${dim})`;
      g.fillRect(0, 0, w, h);
    }
  }

  shadow(g, x, y, r) {
    g.fillStyle = "rgba(10,50,30,0.3)";
    g.beginPath();
    g.ellipse(x, y + r * 0.75, r * 0.95, r * 0.42, 0, 0, TAU);
    g.fill();
  }
  peel(g, q) {
    g.save();
    g.translate(q.x, q.y - (q.flying ? 10 : 0));
    g.rotate(q.spin);
    if (q.golden) {
      g.fillStyle = "rgba(255,230,90,0.45)";
      g.beginPath();
      g.arc(0, 0, 17, 0, TAU);
      g.fill();
    }
    g.fillStyle = q.golden ? "#fff3a0" : q.ripe ? "#d9a520" : "#ffd93b";
    g.strokeStyle = "#7a5a10";
    g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      g.rotate(TAU / 3);
      g.beginPath();
      g.ellipse(8, 0, 9, 4.2, 0, 0, TAU);
      g.fill();
      g.stroke();
    }
    g.fillStyle = q.ripe ? "#5a3a10" : "#8a6a1a";
    g.beginPath();
    g.arc(0, 0, 3, 0, TAU);
    g.fill();
    g.restore();
  }
  banana(g, p, game, ghost = false) {
    const moving = Math.hypot(p.vx, p.vy) > 30,
      step = moving ? Math.sin(this.t * 18) : 0,
      flip = p.faceX < -0.1 ? -1 : 1;
    if (!ghost) this.shadow(g, p.x, p.y, 15);
    g.save();
    g.translate(p.x, p.y - 6 - Math.abs(step) * 2);
    g.scale(flip, 1);
    if (p.dash > 0) g.rotate(0.5);
    if (!ghost && p.hurt > 0 && Math.floor(this.t * 20) % 2) g.globalAlpha = 0.45;
    g.fillStyle = "#3a2a12";
    g.fillRect(-7 + step * 3, 14, 6, 5);
    g.fillRect(2 - step * 3, 14, 6, 5);
    g.lineCap = "round";
    g.strokeStyle = "#8a6a1a";
    g.lineWidth = 17;
    g.beginPath();
    g.moveTo(-5, -18);
    g.quadraticCurveTo(13, 0, -5, 16);
    g.stroke();
    g.strokeStyle = "#ffd93b";
    g.lineWidth = 13.5;
    g.stroke();
    g.strokeStyle = "#fff0a0";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-2, -12);
    g.quadraticCurveTo(8, 0, -2, 10);
    g.stroke();
    g.fillStyle = "#5a3a10";
    g.beginPath();
    g.arc(-6, -20, 3, 0, TAU);
    g.arc(-6, 18, 2.4, 0, TAU);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(6, -5, 3.6, 0, TAU);
    g.arc(7, 4, 3.6, 0, TAU);
    g.fill();
    g.fillStyle = "#1a1a1a";
    g.beginPath();
    g.arc(7.2, -5, 1.7, 0, TAU);
    g.arc(8.2, 4, 1.7, 0, TAU);
    g.fill();
    g.restore();
    void game;
  }
  trunk(g, t) {
    this.shadow(g, t.x, t.y + 6, 30);
    g.fillStyle = "#6f4a2a";
    g.beginPath();
    g.arc(t.x, t.y, t.r, 0, TAU);
    g.fill();
    g.strokeStyle = "#4e321b";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(t.x, t.y, t.r - 7, 0, TAU);
    g.stroke();
  }
  canopy(g, t) {
    const sway = t.shake > 0 ? Math.sin(this.t * 40) * 0.12 * t.shake : Math.sin(this.t * 0.8 + t.x) * 0.03;
    g.save();
    g.translate(t.x, t.y - 34);
    g.rotate(sway);
    g.globalAlpha = 0.9;
    for (let i = 0; i < 7; i++) {
      g.rotate(TAU / 7);
      g.fillStyle = i % 2 ? "#249a4c" : "#30b55c";
      g.beginPath();
      g.ellipse(40, 0, 44, 13, 0, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = "#6b4226";
    for (const [x, y] of [[-7, 2], [6, -3], [1, 8]]) {
      g.beginPath();
      g.arc(x, y, 7, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  monkey(g, e) {
    const [fur, skin] = COAT[e.type],
      r = e.r,
      big = e.type === "gorilla" || e.type === "boss";
    let lift = 0,
      rot = 0,
      scale = 1,
      alpha = 1;
    if (e.state === "walk") rot = Math.sin(this.t * 11 + e.wob) * 0.14;
    else if (e.state === "slide") rot = Math.atan2(e.sy, e.sx) + Math.PI / 2;
    else if (e.state === "ko") {
      lift = e.t * 190;
      rot = e.t * 16;
      scale = 1 - e.t * 0.6;
      alpha = clamp(1 - e.t / 0.7, 0, 1);
    }
    if (e.state !== "ko") this.shadow(g, e.x, e.y, r);
    if (e.state === "slide" && !this.reduced) {
      g.strokeStyle = "rgba(255,255,255,0.5)";
      g.lineWidth = 2.5;
      const n = Math.hypot(e.sx, e.sy) || 1;
      for (const o of [-r * 0.6, 0, r * 0.6]) {
        g.beginPath();
        g.moveTo(e.x - (e.sx / n) * (r + 6) - (e.sy / n) * o, e.y - (e.sy / n) * (r + 6) + (e.sx / n) * o);
        g.lineTo(e.x - (e.sx / n) * (r + 26) - (e.sy / n) * o, e.y - (e.sy / n) * (r + 26) + (e.sx / n) * o);
        g.stroke();
      }
    }
    g.save();
    g.translate(e.x, e.y - r * 0.3 - lift);
    g.rotate(rot);
    g.scale(scale, scale);
    g.globalAlpha = alpha;
    const body = e.flash > 0 ? "#ffffff" : fur;
    // tail, limbs
    g.strokeStyle = fur;
    g.lineCap = "round";
    g.lineWidth = big ? r * 0.36 : r * 0.24;
    g.beginPath();
    if (e.state === "slide" || e.state === "ko") {
      g.moveTo(-r * 0.7, -r * 0.2);
      g.lineTo(-r * 1.35, -r * 0.8);
      g.moveTo(r * 0.7, -r * 0.2);
      g.lineTo(r * 1.35, -r * 0.8);
      g.moveTo(-r * 0.5, r * 0.6);
      g.lineTo(-r * 0.9, r * 1.4);
      g.moveTo(r * 0.5, r * 0.6);
      g.lineTo(r * 0.9, r * 1.4);
    } else {
      g.moveTo(-r * 0.8, r * 0.1);
      g.lineTo(-r * 1.15, r * 0.75);
      g.moveTo(r * 0.8, r * 0.1);
      g.lineTo(r * 1.15, r * 0.75);
      if (!big) {
        g.moveTo(r * 0.5, r * 0.6);
        g.quadraticCurveTo(r * 1.6, r * 0.7, r * 1.3, -r * 0.3);
      }
    }
    g.stroke();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, r * 0.2, r * 0.92, r * 0.86, 0, 0, TAU);
    g.fill();
    if (big) {
      g.fillStyle = e.flash > 0 ? "#fff" : skin;
      g.beginPath();
      g.ellipse(0, r * 0.4, r * 0.55, r * 0.4, 0, 0, TAU);
      g.fill();
    }
    // head
    g.fillStyle = body;
    g.beginPath();
    g.arc(-r * 0.66, -r * 0.62, r * 0.3, 0, TAU);
    g.arc(r * 0.66, -r * 0.62, r * 0.3, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(0, -r * 0.6, r * 0.66, 0, TAU);
    g.fill();
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(0, -r * 0.5, r * 0.46, r * 0.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#231710";
    g.strokeStyle = "#231710";
    g.lineWidth = Math.max(1.5, r * 0.1);
    if (e.state === "walk") {
      g.beginPath();
      g.arc(-r * 0.2, -r * 0.58, r * 0.09, 0, TAU);
      g.arc(r * 0.2, -r * 0.58, r * 0.09, 0, TAU);
      g.fill();
    } else {
      for (const x of [-r * 0.2, r * 0.2]) {
        g.beginPath();
        g.moveTo(x - r * 0.1, -r * 0.68);
        g.lineTo(x + r * 0.1, -r * 0.48);
        g.moveTo(x + r * 0.1, -r * 0.68);
        g.lineTo(x - r * 0.1, -r * 0.48);
        g.stroke();
      }
      g.beginPath();
      g.arc(0, -r * 0.3, r * 0.1, 0, TAU);
      g.stroke();
    }
    if (e.type === "thrower") {
      g.fillStyle = "#e0463a";
      g.fillRect(-r * 0.66, -r * 1.05, r * 1.32, r * 0.22);
    }
    if (e.type === "boss") {
      g.fillStyle = "#ffd23b";
      g.beginPath();
      g.moveTo(-r * 0.5, -r * 1.05);
      g.lineTo(-r * 0.5, -r * 1.5);
      g.lineTo(-r * 0.25, -r * 1.25);
      g.lineTo(0, -r * 1.6);
      g.lineTo(r * 0.25, -r * 1.25);
      g.lineTo(r * 0.5, -r * 1.5);
      g.lineTo(r * 0.5, -r * 1.05);
      g.fill();
    }
    g.restore();
    if (e.state === "dizzy" || (e.type === "boss" && e.phase === "stun")) {
      g.fillStyle = "#ffe45c";
      for (let i = 0; i < 3; i++) {
        const a = this.t * 7 + (i * TAU) / 3;
        g.beginPath();
        g.arc(e.x + Math.cos(a) * r * 0.8, e.y - r * 1.5 + Math.sin(a) * r * 0.25, 3, 0, TAU);
        g.fill();
      }
    }
    if (big && e.state !== "ko" && e.hp < e.maxHp) {
      const wBar = r * 2;
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(e.x - wBar / 2, e.y - r * 2 - (e.type === "boss" ? 24 : 4), wBar, 6);
      g.fillStyle = e.type === "boss" ? "#ffd23b" : "#ff8a70";
      g.fillRect(e.x - wBar / 2, e.y - r * 2 - (e.type === "boss" ? 24 : 4), wBar * clamp(e.hp / e.maxHp, 0, 1), 6);
    }
  }
}
