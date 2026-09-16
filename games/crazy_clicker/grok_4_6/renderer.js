function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export class CoreRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.t = 0;
    this.squash = 1;
    this.squashVel = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.targetTiltX = 0;
    this.targetTiltY = 0;
    this.trauma = 0;
    this.flash = 0;
    this.missTint = 0;
    this.hitTint = 0;
    this.emberFlash = 0;
    this.particles = [];
    this.waves = [];
    this.floats = [];
    this.dust = [];
    this.cx = 0;
    this.cy = 0;
    this.radius = 80;
    this.mobile = false;
    this.particleCap = 420;
    this.resize();
    this.seedDust();
  }

  seedDust() {
    this.dust = [];
    const n = this.mobile ? 18 : 36;
    for (let i = 0; i < n; i++) {
      this.dust.push({
        a: Math.random() * Math.PI * 2,
        r: 0.2 + Math.random() * 1.6,
        s: 0.6 + Math.random() * 1.8,
        sp: 0.08 + Math.random() * 0.25,
      });
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent
      ? parent.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();
    this.mobile = rect.width < 640;
    this.particleCap = this.mobile ? 180 : 420;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.75 : 2);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout();
  }

  layout() {
    this.cx = this.w * 0.5;
    this.cy = this.h * (this.mobile ? 0.42 : 0.48);
    this.radius = clamp(Math.min(this.w, this.h) * 0.168, 72, 168);
  }

  pointerTilt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    this.targetTiltX = ((x - this.cx) / this.w) * 18;
    this.targetTiltY = ((y - this.cy) / this.h) * 14;
  }

  localPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  burst(x, y, gain, crit, visual) {
    this.squash = Math.min(this.squash, crit ? 0.78 : 0.86);
    this.squashVel = -1.8;
    if (visual.shake && !visual.reduced) {
      this.trauma = Math.min(1, this.trauma + (crit ? 0.42 : 0.22));
    }
    this.flash = Math.min(1, this.flash + (crit ? 0.45 : 0.22));
    this.hitTint = 1;

    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    this.targetTiltX += nx * 8;
    this.targetTiltY += ny * 8;

    this.waves.push({
      r: this.radius * 0.6,
      max: this.radius * (crit ? 4.2 : 3.1),
      life: 1,
      w: crit ? 5 : 3,
    });

    const count = Math.min(
      this.mobile ? 16 : 28,
      (crit ? 22 : 14) + Math.floor(visual.heat * 10),
    );
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * (crit ? 420 : 260);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp + nx * 40,
        vy: Math.sin(a) * sp + ny * 40,
        life: 1,
        max: 0.35 + Math.random() * 0.45,
        size: crit ? 2.4 + Math.random() * 3.2 : 1.4 + Math.random() * 2.2,
        hue: crit ? 42 + Math.random() * 18 : 18 + Math.random() * 28,
        spark: crit || Math.random() < 0.25,
      });
    }
    if (this.particles.length > this.particleCap) {
      this.particles.splice(0, this.particles.length - this.particleCap);
    }

    const label = crit ? "PERFECT" : visual.label || String(Math.round(gain));
    this.floats.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 10,
      vy: -46 - Math.random() * 24,
      text: label,
      life: 1,
      max: crit ? 1.05 : 0.8,
      crit,
    });
    if (this.floats.length > 28) this.floats.splice(0, this.floats.length - 28);
  }

  missPop() {
    this.trauma = 1;
    this.missTint = 1;
    this.flash = 0.7;
    this.squash = 0.82;
    this.squashVel = -2.2;
  }

  emberPop() {
    this.emberFlash = 1;
    this.flash = 0.55;
    this.squash = 1.12;
    this.squashVel = 1.6;
    this.waves.push({
      r: this.radius * 0.8,
      max: this.radius * 3.4,
      life: 1,
      w: 6,
    });
    this.floats.push({
      x: this.cx,
      y: this.cy - this.radius,
      vy: -30,
      text: "EMBER HOLDS",
      life: 1,
      max: 1.2,
      crit: true,
    });
  }

  draw(dt, v) {
    this.t += dt;
    this.layout();

    const k = 1 - Math.exp(-10 * dt);
    this.tiltX += (this.targetTiltX - this.tiltX) * k;
    this.tiltY += (this.targetTiltY - this.tiltY) * k;
    this.targetTiltX *= Math.exp(-2.4 * dt);
    this.targetTiltY *= Math.exp(-2.4 * dt);

    const spring = 48;
    const damp = 8;
    const force = (1 - this.squash) * spring - this.squashVel * damp;
    this.squashVel += force * dt;
    this.squash += this.squashVel * dt;
    if (Math.abs(this.squash - 1) < 0.001 && Math.abs(this.squashVel) < 0.01) {
      this.squash = 1;
      this.squashVel = 0;
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.missTint = Math.max(0, this.missTint - dt * 0.85);
    this.hitTint = Math.max(0, this.hitTint - dt * 3.2);
    this.emberFlash = Math.max(0, this.emberFlash - dt * 1.4);

    const beatPulse =
      v.live && v.taktMs > 0 ? 1 + 0.05 * Math.pow(v.beatPhase, 3) : 1;
    const savedSquash = this.squash;
    this.squash *= beatPulse;

    const ctx = this.ctx;
    const { w, h } = this;
    const crazyBoost = v.fever >= 0.75 ? 0.3 + 0.12 * Math.sin(this.t * 11) : 0;
    const intensity = 0.55 + v.heat * 0.45 + crazyBoost + v.fever * 0.3;

    const shakeAmt = v.reduced || !v.shake ? 0 : this.trauma * this.trauma;
    const sx = (Math.random() * 2 - 1) * 14 * shakeAmt;
    const sy = (Math.random() * 2 - 1) * 12 * shakeAmt;
    const rot = (Math.random() * 2 - 1) * 0.018 * shakeAmt;

    const red = v.over ? 56 : 18 + this.missTint * 50;
    const bg = 10 + v.heat * 10 + v.fever * 16;
    ctx.fillStyle = `rgb(${red + bg}, ${5 + v.heat * 5}, ${4})`;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.cx + sx + this.tiltX, this.cy + sy + this.tiltY);
    ctx.rotate(rot);
    ctx.translate(-(this.cx + sx + this.tiltX), -(this.cy + sy + this.tiltY));

    this.drawField(ctx, v, intensity);
    this.updateDust(dt);
    this.drawDust(ctx, v);
    this.updateWaves(dt);
    this.drawWaves(ctx, v);
    this.drawCore(ctx, v, intensity);
    this.drawBeatRings(ctx, v);
    this.drawEmberRing(ctx, v);
    this.updateParticles(dt);
    this.drawParticles(ctx);
    this.updateFloats(dt);
    this.drawFloats(ctx);

    this.squash = savedSquash;
    ctx.restore();

    if (this.flash > 0.01 || this.missTint > 0.01 || this.hitTint > 0.01 || this.emberFlash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (this.missTint > 0.01) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(180, 12, 8, ${this.missTint * 0.42})`;
        ctx.fillRect(0, 0, w, h);
      } else if (this.emberFlash > 0.01) {
        ctx.fillStyle = `rgba(255, 196, 80, ${this.emberFlash * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      } else if (this.hitTint > 0.01) {
        ctx.fillStyle = v.crazy
          ? `rgba(80, 255, 90, ${this.hitTint * 0.16})`
          : `rgba(40, 220, 70, ${this.hitTint * 0.18})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = v.crazy
          ? `rgba(255, 210, 140, ${this.flash * 0.28})`
          : `rgba(255, 90, 30, ${this.flash * 0.18})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
  }

  drawField(ctx, v, intensity) {
    const r = this.radius * this.squash;
    const cx = this.cx;
    const cy = this.cy;
    const reach = Math.max(this.w, this.h) * 0.92;

    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, reach);
    const a0 = 0.55 * intensity;
    g.addColorStop(0, `rgba(255, 70, 18, ${a0})`);
    g.addColorStop(0.22, `rgba(190, 18, 8, ${0.42 * intensity})`);
    g.addColorStop(0.55, `rgba(60, 6, 4, ${0.55})`);
    g.addColorStop(1, "rgba(8, 2, 2, 1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4.8);
    bloom.addColorStop(
      0,
      `rgba(255, ${v.crazy ? 220 : 150}, ${v.crazy ? 90 : 40}, ${0.42 * intensity})`,
    );
    bloom.addColorStop(0.35, `rgba(255, 60, 10, ${0.16 * intensity})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  drawCore(ctx, v, intensity) {
    const cx = this.cx;
    const cy = this.cy;
    const r = this.radius * this.squash * (v.crazy ? 1.12 : 1);
    const t = this.t;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const corona = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 2.35);
    corona.addColorStop(0, `rgba(255, 190, 70, ${0.55 * intensity})`);
    corona.addColorStop(0.45, `rgba(255, 55, 12, ${0.28 * intensity})`);
    corona.addColorStop(1, "rgba(80, 0, 0, 0)");
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    const spikes = this.mobile ? 48 : 72;
    for (let i = 0; i <= spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const n =
        0.045 * Math.sin(a * 5 + t * 1.6) +
        0.03 * Math.sin(a * 9 - t * 2.15 + v.heat * 2) +
        0.02 * Math.sin(a * 3 + t * 0.7);
      const rr = r * (1 + n * (0.8 + v.heat * 0.8));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const body = ctx.createRadialGradient(
      cx - r * 0.18,
      cy - r * 0.22,
      r * 0.04,
      cx,
      cy,
      r * 1.05,
    );
    if (v.crazy) {
      body.addColorStop(0, "#fffdf2");
      body.addColorStop(0.1, "#ffe9a0");
      body.addColorStop(0.28, "#ffb03a");
      body.addColorStop(0.52, "#ff4a12");
      body.addColorStop(0.78, "#c01010");
      body.addColorStop(1, "#3a0208");
    } else {
      body.addColorStop(0, "#fff1c2");
      body.addColorStop(0.14, "#ffc45a");
      body.addColorStop(0.36, "#ff5a18");
      body.addColorStop(0.62, "#c4180c");
      body.addColorStop(0.88, "#4a0608");
      body.addColorStop(1, "#120103");
    }
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.28 + v.heat * 0.2;
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.35);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + t * 0.2;
      const gr = ctx.createLinearGradient(0, 0, Math.cos(ang) * r, Math.sin(ang) * r);
      gr.addColorStop(0, "rgba(255, 240, 180, 0.0)");
      gr.addColorStop(0.4, "rgba(255, 140, 40, 0.35)");
      gr.addColorStop(1, "rgba(255, 40, 0, 0)");
      ctx.strokeStyle = gr;
      ctx.lineWidth = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx - r * 0.16, cy - r * 0.2, r * 0.34, 0, Math.PI * 2);
    const hot = ctx.createRadialGradient(
      cx - r * 0.16,
      cy - r * 0.2,
      0,
      cx - r * 0.16,
      cy - r * 0.2,
      r * 0.34,
    );
    hot.addColorStop(0, "rgba(255, 252, 240, 0.95)");
    hot.addColorStop(0.45, "rgba(255, 210, 120, 0.45)");
    hot.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = hot;
    ctx.fill();
    ctx.restore();
  }

  drawBeatRings(ctx, v) {
    if (!v.live || v.taktMs <= 0) return;
    const cx = this.cx;
    const cy = this.cy;
    const coreR = this.radius * this.squash;
    const travel = Math.min(this.w, this.h) * 0.38;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const phase of [v.beatPhase, v.beatPhase - 1]) {
      if (phase < -0.02 || phase > 1.02) continue;
      const p = Math.max(0, Math.min(1, phase));
      const r = coreR + (1 - p) * travel;
      const a = 0.18 + p * 0.55;
      ctx.strokeStyle = v.fever > 0.7
        ? `rgba(255, 230, 160, ${a})`
        : `rgba(255, 90, 30, ${a})`;
      ctx.lineWidth = 2.5 + p * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const windowFrac = Math.min(0.45, 50 / v.taktMs);
    ctx.strokeStyle = "rgba(236, 230, 222, 0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, coreR + windowFrac * travel * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawEmberRing(ctx, v) {
    if (!v.ember) return;
    const r = this.radius * this.squash * 1.42;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 210, 120, ${0.55 + 0.25 * Math.sin(this.t * 6)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  updateDust(dt) {
    for (const d of this.dust) d.a += d.sp * dt;
  }

  drawDust(ctx, v) {
    const cx = this.cx;
    const cy = this.cy;
    const r = this.radius;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const d of this.dust) {
      const x = cx + Math.cos(d.a) * r * d.r;
      const y = cy + Math.sin(d.a) * r * d.r * 0.78;
      ctx.fillStyle = `rgba(255, 120, 50, ${0.12 + v.heat * 0.18})`;
      ctx.beginPath();
      ctx.arc(x, y, d.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  updateWaves(dt) {
    for (const w of this.waves) {
      w.life -= dt * 1.35;
      w.r += (w.max - w.r) * (1 - Math.exp(-5 * dt));
    }
    this.waves = this.waves.filter((w) => w.life > 0);
  }

  drawWaves(ctx, v) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const w of this.waves) {
      ctx.strokeStyle = v.crazy
        ? `rgba(255, 230, 160, ${w.life * 0.45})`
        : `rgba(255, 90, 30, ${w.life * 0.4})`;
      ctx.lineWidth = w.w * w.life;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.vy += 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.2 * dt);
      p.life -= dt / p.max;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const a = clamp(p.life, 0, 1);
      ctx.fillStyle = p.spark
        ? `rgba(255, 240, 200, ${a})`
        : `hsla(${p.hue}, 100%, 58%, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  updateFloats(dt) {
    for (const f of this.floats) {
      f.y += f.vy * dt;
      f.vy *= Math.exp(-0.8 * dt);
      f.life -= dt / f.max;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  drawFloats(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      const a = clamp(f.life, 0, 1);
      const pop = 0.85 + Math.sin((1 - a) * Math.PI) * 0.25;
      ctx.globalAlpha = a;
      ctx.font = `600 ${f.crit ? 22 * pop : 16 * pop}px Figtree, system-ui, sans-serif`;
      ctx.fillStyle = f.crit ? "#fff6d4" : "#ece6de";
      ctx.shadowColor = f.crit ? "rgba(255, 90, 20, 0.8)" : "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}
