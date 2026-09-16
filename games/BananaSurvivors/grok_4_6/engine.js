// SPLIT — Grok 4.6 Banana Survivors.
// You are the blade. No guns. Deterministic. No DOM, no wall clock.
export const RULESET = 2,
  VERSION = "grok_4_6",
  HOOK_SECONDS = 48,
  ARENA = 900,
  MAX_ENEMIES = 140,
  MAX_DROPS = 180,
  MAX_CORPSES = 40,
  MAX_POOLS = 28,
  SPLIT_TIME = 0.26,
  SPLIT_IFRAME = 0.34,
  SPLIT_COOLDOWN = 1.12,
  BURST_WINDUP = 0.42,
  BURST_RADIUS = 168,
  BLADE_ICD = 0.16,
  CORPSE_LIFE = 2.8,
  POOL_LIFE = 5.2;

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function rng(seed) {
  let n = seed >>> 0 || 1;
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}

export const LOADOUTS = {
  crescent: {
    name: "Crescent",
    detail: "Two peels. Walk into them.",
    hp: 100,
    speed: 208,
    blades: 2,
    orbit: 58,
    splitDmg: 52,
    splitCd: SPLIT_COOLDOWN,
    ripe: 0,
    burst: 1,
  },
  splitter: {
    name: "Splitter",
    detail: "One peel. You are the cut.",
    hp: 86,
    speed: 236,
    blades: 1,
    orbit: 50,
    splitDmg: 84,
    splitCd: 0.7,
    ripe: 0,
    burst: 0.88,
  },
  ripe: {
    name: "Overripe",
    detail: "Already splitting. Burst bigger.",
    hp: 128,
    speed: 184,
    blades: 2,
    orbit: 62,
    splitDmg: 42,
    splitCd: SPLIT_COOLDOWN,
    ripe: 0.55,
    burst: 1.38,
  },
};

export const CUTS = {
  smile: {
    name: "Wider smile",
    blurb: "Another peel-blade in orbit.",
    max: 3,
    color: "#e4b45a",
  },
  reach: {
    name: "Longer peel",
    blurb: "Orbit grows. The locker feels smaller.",
    max: 3,
    color: "#d8c49a",
  },
  edge: {
    name: "Razor edge",
    blurb: "Blades and splits hit harder.",
    max: 4,
    color: "#e06048",
  },
  dash: {
    name: "Hot split",
    blurb: "Split more often. Stay in them.",
    max: 3,
    color: "#f0c35a",
  },
  rind: {
    name: "Thicker rind",
    blurb: "More peel to lose.",
    max: 3,
    color: "#c8b070",
  },
  drink: {
    name: "Blood drink",
    blurb: "Standing in gore knits the rind.",
    max: 1,
    color: "#c41e1e",
  },
  haste: {
    name: "Slippery",
    blurb: "Move and spin faster.",
    max: 3,
    color: "#d8d0c0",
  },
  flood: {
    name: "Fatter burst",
    blurb: "Overripe detonations grow.",
    max: 3,
    color: "#a01818",
  },
  marrow: {
    name: "Marrow soak",
    blurb: "Kills feed ripeness faster.",
    max: 1,
    color: "#8a3030",
  },
  thick: {
    name: "Callus",
    blurb: "Bites take less.",
    max: 3,
    color: "#9a8a70",
  },
};

export const MEAT = {
  nib: { hp: 14, speed: 80, r: 13, damage: 8, xp: 2, score: 8, size: 26 },
  shank: { hp: 24, speed: 114, r: 14, damage: 11, xp: 3, score: 14, size: 30 },
  brisket: { hp: 130, speed: 32, r: 30, damage: 18, xp: 8, score: 42, size: 64 },
  drip: { hp: 36, speed: 44, r: 17, damage: 10, xp: 4, score: 20, size: 36 },
  twin: { hp: 42, speed: 52, r: 18, damage: 12, xp: 5, score: 22, size: 40 },
  snare: { hp: 50, speed: 58, r: 16, damage: 14, xp: 5, score: 26, size: 34 },
  prize: { hp: 1, speed: 30, r: 54, damage: 16, xp: 50, score: 520, size: 132 },
};

export const PRIZE_NAMES = ["The Rail", "The Press", "The Crown Cut"];

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
const event = (s, type, data = {}) =>
  s.events.length < 90 && s.events.push({ type, ...data });

class Grid {
  constructor(size = 80) {
    this.size = size;
    this.cells = new Map();
  }
  key(x, y) {
    return `${x},${y}`;
  }
  rebuild(items) {
    this.cells.clear();
    for (const item of items) {
      if (item.dead) continue;
      const cx = Math.floor(item.x / this.size);
      const cy = Math.floor(item.y / this.size);
      const k = this.key(cx, cy);
      let bin = this.cells.get(k);
      if (!bin) {
        bin = [];
        this.cells.set(k, bin);
      }
      bin.push(item);
    }
  }
  query(x, y, r) {
    const out = [];
    const x0 = Math.floor((x - r) / this.size);
    const y0 = Math.floor((y - r) / this.size);
    const x1 = Math.floor((x + r) / this.size);
    const y1 = Math.floor((y + r) / this.size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bin = this.cells.get(this.key(cx, cy));
        if (bin) out.push(...bin);
      }
    }
    return out;
  }
}

export function prizeName(wave) {
  return PRIZE_NAMES[(wave - 1) % PRIZE_NAMES.length];
}

export function bladePoints(s) {
  const p = s.player;
  const n = Math.max(1, p.blades | 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = s.spin + (i * Math.PI * 2) / n;
    out.push({
      x: p.x + Math.cos(a) * p.orbit,
      y: p.y + Math.sin(a) * p.orbit,
      a,
    });
  }
  return out;
}

function live(s) {
  return s.enemies.filter((e) => !e.dead);
}

function edgePoint(s, rand) {
  const a = rand() * Math.PI * 2;
  const r = s.arenaR + 36;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function spawnEnemy(s, kind, at) {
  if (s.enemies.length >= MAX_ENEMIES) return null;
  const spec = MEAT[kind];
  if (!spec) return null;
  const pos = at || edgePoint(s, s.rand);
  const wave = Math.max(1, s.wave);
  const hpScale = kind === "prize" ? 380 + wave * 210 : 1 + (wave - 1) * 0.16;
  const enemy = {
    id: ++s.nextId,
    kind,
    x: pos.x,
    y: pos.y,
    r: spec.r,
    hp: spec.hp * hpScale,
    maxHp: spec.hp * hpScale,
    speed: spec.speed,
    damage: spec.damage,
    xp: spec.xp,
    score: spec.score,
    size: spec.size,
    dead: false,
    born: s.time,
    flash: 0,
    icd: 0,
    yank: 0,
    enraged: false,
    name: kind === "prize" ? prizeName(s.wave) : kind,
  };
  s.enemies.push(enemy);
  if (kind === "prize") {
    s.prizeId = enemy.id;
    s.arenaR = ARENA / 2 * 0.88;
    event(s, "prize", { name: enemy.name, x: enemy.x, y: enemy.y });
  }
  return enemy;
}

function dropPulp(s, x, y, value) {
  if (s.drops.length >= MAX_DROPS) {
    s.drops.splice(0, s.drops.length - MAX_DROPS + 1);
  }
  s.drops.push({ x, y, v: value, life: 12, magnet: false });
}

function pool(s, x, y, acid = false) {
  if (s.pools.length >= MAX_POOLS) s.pools.shift();
  s.pools.push({
    x,
    y,
    r: acid ? 38 : 46,
    life: POOL_LIFE,
    acid,
  });
}

function corpse(s, e) {
  if (s.corpses.length >= MAX_CORPSES) s.corpses.shift();
  s.corpses.push({
    x: e.x,
    y: e.y,
    r: e.r,
    life: CORPSE_LIFE,
    kind: e.kind,
    angle: s.rand() * Math.PI * 2,
  });
}

function kill(s, enemy, source) {
  if (enemy.dead) return;
  enemy.dead = true;
  s.kills += 1;
  s.combo += 1;
  s.comboT = 2.4;
  s.score += Math.floor(enemy.score * (1 + Math.min(4, s.combo) * 0.08));
  s.player.ripe = clamp(
    s.player.ripe + 0.05 * (s.player.marrow ? 1.7 : 1) * (source === "split" ? 1.4 : 1),
    0,
    1,
  );
  dropPulp(s, enemy.x, enemy.y, enemy.xp);
  pool(s, enemy.x, enemy.y, enemy.kind === "drip");
  corpse(s, enemy);
  event(s, "kill", {
    x: enemy.x,
    y: enemy.y,
    kind: enemy.kind,
    source,
    size: enemy.size,
  });
  if (source === "split") s.splits += 1;
  if (source === "burst") s.bursts += 1;
  if (source === "crush") s.crushes += 1;
  if (enemy.kind === "twin") {
    const a = s.rand() * Math.PI * 2;
    spawnEnemy(s, "nib", {
      x: enemy.x + Math.cos(a) * 16,
      y: enemy.y + Math.sin(a) * 16,
    });
    spawnEnemy(s, "nib", {
      x: enemy.x - Math.cos(a) * 16,
      y: enemy.y - Math.sin(a) * 16,
    });
  }
  if (enemy.id === s.prizeId) {
    s.prizeId = 0;
    s.prizes += 1;
    s.wave += 1;
    s.hook = HOOK_SECONDS;
    s.arenaR = ARENA / 2;
    s.rerolls += 1;
    s.player.hp = clamp(s.player.hp + 16, 0, s.player.maxHp);
    event(s, "prizeDown", { name: enemy.name, wave: s.wave - 1 });
  }
}

export function hit(s, enemy, amount, source) {
  if (!enemy || enemy.dead) return 0;
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= amount;
  enemy.flash = 0.09;
  event(s, "hit", { x: enemy.x, y: enemy.y, source, kind: enemy.kind });
  if (enemy.hp <= 0) kill(s, enemy, source);
  return dealt;
}

function rollCuts(s) {
  const pool = Object.keys(CUTS).filter((id) => (s.cuts[id] || 0) < CUTS[id].max);
  const picks = [];
  const bag = pool.slice();
  while (picks.length < 3 && bag.length) {
    const i = (s.rand() * bag.length) | 0;
    picks.push(bag.splice(i, 1)[0]);
  }
  return picks;
}

function maybeLevel(s) {
  while (s.xp >= s.xpNext && s.pending < 8) {
    s.xp -= s.xpNext;
    s.level += 1;
    s.pending += 1;
    s.xpNext = Math.floor(10 * s.level ** 1.18);
  }
  if (s.pending > 0 && !s.choices.length) {
    s.choices = rollCuts(s);
    if (s.choices.length) s.phase = "upgrade";
    else s.pending = 0;
  }
}

function applyCut(s, id) {
  const rank = (s.cuts[id] = (s.cuts[id] || 0) + 1);
  const p = s.player;
  if (id === "smile") p.blades = clamp(p.blades + 1, 1, 6);
  if (id === "reach") p.orbit += 11;
  if (id === "edge") {
    p.bladeDmg *= 1.18;
    p.splitDmg *= 1.14;
  }
  if (id === "dash") p.splitCdMax *= 0.84;
  if (id === "rind") {
    p.maxHp += 22;
    p.hp += 22;
  }
  if (id === "drink") p.drink = 1;
  if (id === "haste") {
    p.haste *= 1.12;
    p.speed *= 1.08;
  }
  if (id === "flood") p.burst *= 1.16;
  if (id === "marrow") p.marrow = 1;
  if (id === "thick") p.thick = clamp(p.thick + 0.1, 0, 0.45);
  event(s, "cut", { id, rank, name: CUTS[id].name });
}

export function cutInfo(s, id) {
  const cut = CUTS[id];
  const rank = s.cuts[id] || 0;
  return {
    id,
    kind: "CUT",
    name: cut.name,
    detail: cut.blurb,
    color: cut.color,
    rank,
    next: rank + 1,
  };
}

export function chooseCut(s, id) {
  if (s.phase !== "upgrade" || !s.choices.includes(id)) return s;
  applyCut(s, id);
  s.pending = Math.max(0, s.pending - 1);
  s.choices = [];
  if (s.pending > 0) {
    s.choices = rollCuts(s);
    if (!s.choices.length) {
      s.pending = 0;
      s.phase = "playing";
    }
  } else {
    s.phase = "playing";
  }
  return s;
}

export function reroll(s) {
  if (s.phase !== "upgrade" || s.rerolls <= 0) return s;
  s.rerolls -= 1;
  s.choices = rollCuts(s);
  return s;
}

function floodAt(s, x, y) {
  let n = 0;
  for (const p of s.pools) {
    if (!p.acid && (x - p.x) ** 2 + (y - p.y) ** 2 <= (p.r + 8) ** 2) n += 1;
  }
  return n;
}

function burst(s) {
  const p = s.player;
  const r = BURST_RADIUS * p.burst;
  const r2 = r * r;
  event(s, "burst", { x: p.x, y: p.y, r });
  for (const e of live(s)) {
    if (dist2(e, p) <= r2) hit(s, e, 58 * p.burst * (1 + p.bladeDmg / 22), "burst");
  }
  for (let i = s.corpses.length - 1; i >= 0; i--) {
    const c = s.corpses[i];
    if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 <= r2) {
      dropPulp(s, c.x, c.y, 1);
      s.corpses.splice(i, 1);
    }
  }
  p.ripe = 0;
  p.wind = 0;
  p.hp = clamp(p.hp + 8, 0, p.maxHp);
}

function startSplit(s, mx, my) {
  const p = s.player;
  if (p.splitT > 0 || p.splitCd > 0) return;
  let dx = mx,
    dy = my;
  if (Math.hypot(dx, dy) < 0.08) {
    dx = Math.cos(p.facing);
    dy = Math.sin(p.facing);
  }
  const u = unit(dx, dy);
  p.splitT = SPLIT_TIME;
  p.splitCd = p.splitCdMax;
  p.invuln = SPLIT_IFRAME;
  p.splitVx = u.x;
  p.splitVy = u.y;
  p.facing = Math.atan2(u.y, u.x);
  event(s, "split", { x: p.x, y: p.y, a: p.facing });
}

export function createRun(seed = 1, loadout = "crescent") {
  const spec = LOADOUTS[loadout] || LOADOUTS.crescent;
  const rand = rng(seed);
  const s = {
    seed,
    rand,
    loadout: LOADOUTS[loadout] ? loadout : "crescent",
    phase: "playing",
    time: 0,
    wave: 1,
    hook: HOOK_SECONDS,
    arenaR: ARENA / 2,
    nextId: 1,
    spin: 0,
    score: 0,
    kills: 0,
    splits: 0,
    bursts: 0,
    crushes: 0,
    prizes: 0,
    combo: 0,
    comboT: 0,
    xp: 0,
    xpNext: 10,
    level: 1,
    pending: 0,
    choices: [],
    cuts: {},
    rerolls: 1,
    spawnClock: 0.35,
    prizeId: 0,
    events: [],
    enemies: [],
    drops: [],
    corpses: [],
    pools: [],
    grid: new Grid(),
    deathCause: null,
    player: {
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      r: 18,
      hp: spec.hp,
      maxHp: spec.hp,
      speed: spec.speed,
      facing: 0,
      invuln: 0.6,
      hurtCd: 0,
      splitT: 0,
      splitCd: 0,
      splitCdMax: spec.splitCd,
      splitVx: 1,
      splitVy: 0,
      splitDmg: spec.splitDmg,
      blades: spec.blades,
      orbit: spec.orbit,
      bladeDmg: 16,
      haste: 1,
      ripe: spec.ripe,
      wind: 0,
      burst: spec.burst,
      drink: 0,
      marrow: 0,
      thick: 0,
    },
  };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.35;
    spawnEnemy(s, i === 2 ? "shank" : "nib", {
      x: Math.cos(a) * 88,
      y: Math.sin(a) * 88,
    });
  }
  return s;
}

export function runSummary(s) {
  return {
    score: s.score | 0,
    kills: s.kills | 0,
    wave: s.wave | 0,
    seconds: s.time | 0,
    level: s.level | 0,
    loadout: s.loadout,
    splits: s.splits | 0,
    bursts: s.bursts | 0,
    crushes: s.crushes | 0,
    bosses: s.prizes | 0,
    combo: s.combo | 0,
    cuts: { ...s.cuts },
  };
}

export function endRun(s, cause = null) {
  s.phase = "dead";
  if (cause) s.deathCause = cause;
  return runSummary(s);
}

export function update(s, dt, input = {}) {
  if (s.phase !== "playing") return s;
  s.events.length = 0;
  const p = s.player;
  s.time += dt;
  s.hook -= dt;
  s.comboT -= dt;
  if (s.comboT <= 0) s.combo = 0;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  p.splitCd = Math.max(0, p.splitCd - dt);
  p.flash = Math.max(0, (p.flash || 0) - dt);

  let mx = input.x || 0,
    my = input.y || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  if (input.dash) startSplit(s, mx, my);

  const wet = floodAt(s, p.x, p.y);
  const slow = 1 - Math.min(0.2, wet * 0.07);
  const juice = 1 + Math.min(0.35, wet * 0.12);
  let vx = mx * p.speed * p.haste * slow;
  let vy = my * p.speed * p.haste * slow;
  if (p.splitT > 0) {
    vx += p.splitVx * 420;
    vy += p.splitVy * 420;
    p.splitT = Math.max(0, p.splitT - dt);
  }
  p.dx = vx;
  p.dy = vy;
  p.x += vx * dt;
  p.y += vy * dt;
  if (len > 0.05 && p.splitT <= 0) p.facing = Math.atan2(my, mx);
  const maxR = s.arenaR - p.r;
  const pr = Math.hypot(p.x, p.y);
  if (pr > maxR) {
    p.x *= maxR / pr;
    p.y *= maxR / pr;
  }

  s.spin += 3.15 * p.haste * dt;
  s.grid.rebuild(s.enemies);

  const blades = bladePoints(s);
  for (const b of blades) {
    for (const e of s.grid.query(b.x, b.y, 22)) {
      if (e.dead || e.icd > 0) continue;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 <= (e.r + 13) ** 2) {
        e.icd = BLADE_ICD;
        hit(s, e, p.bladeDmg * juice, "blade");
      }
    }
  }

  if (p.splitT > 0) {
    const perp = { x: -p.splitVy, y: p.splitVx };
    const ghosts = [
      { x: p.x + perp.x * 20, y: p.y + perp.y * 20 },
      { x: p.x - perp.x * 20, y: p.y - perp.y * 20 },
      { x: p.x, y: p.y },
    ];
    for (const g of ghosts) {
      for (const e of s.grid.query(g.x, g.y, 36)) {
        if (e.dead) continue;
        if ((e.x - g.x) ** 2 + (e.y - g.y) ** 2 <= (e.r + 22) ** 2) {
          hit(s, e, p.splitDmg * juice * dt * 7.2, "split");
        }
      }
    }
    for (let i = s.corpses.length - 1; i >= 0; i--) {
      const c = s.corpses[i];
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 <= 42 ** 2) {
        s.crushes += 1;
        dropPulp(s, c.x, c.y, 1);
        pool(s, c.x, c.y, false);
        event(s, "crush", { x: c.x, y: c.y });
        s.corpses.splice(i, 1);
      }
    }
  }

  if (p.ripe >= 1) {
    p.wind += dt;
    if (p.wind >= BURST_WINDUP) burst(s);
  } else {
    p.wind = 0;
    p.ripe = clamp(p.ripe - dt * 0.035, 0, 1);
  }

  for (const e of s.enemies) {
    if (e.dead) continue;
    e.icd = Math.max(0, e.icd - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.yank = Math.max(0, e.yank - dt);
    const to = unit(p.x - e.x, p.y - e.y);
    let spd = e.speed * (e.enraged ? 1.28 : 1);
    if (e.kind === "prize" && e.hp < e.maxHp * 0.5 && !e.enraged) {
      e.enraged = true;
      event(s, "enrage", { name: e.name });
    }
    e.x += to.x * spd * dt;
    e.y += to.y * spd * dt;
    if (e.kind === "snare" && e.yank <= 0 && dist2(e, p) < 220 ** 2 && p.splitT <= 0) {
      const tug = unit(e.x - p.x, e.y - p.y);
      p.x += tug.x * 26;
      p.y += tug.y * 26;
      e.yank = 2.6;
      event(s, "yank", { x: p.x, y: p.y });
    }
    if (e.kind === "prize" && e.yank <= 0) {
      const tug = unit(e.x - p.x, e.y - p.y);
      if (p.splitT <= 0 && p.invuln <= 0) {
        p.x += tug.x * (e.enraged ? 38 : 24);
        p.y += tug.y * (e.enraged ? 38 : 24);
      }
      e.yank = e.enraged ? 2.2 : 3.4;
      event(s, "yank", { x: p.x, y: p.y, prize: true });
    }
    if (
      p.invuln <= 0 &&
      p.hurtCd <= 0 &&
      dist2(e, p) <= (e.r + p.r - 4) ** 2
    ) {
      const dmg = e.damage * (1 - p.thick);
      p.hp -= dmg;
      p.hurtCd = 0.38;
      p.flash = 0.12;
      event(s, "hurt", { x: p.x, y: p.y, by: e.name, attack: "bite" });
      if (p.hp <= 0) {
        p.hp = 0;
        return endRun(s, { name: e.name, attack: "bite" });
      }
    }
  }

  // Light separation so the locker does not become one meat pile.
  const bodies = live(s);
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (const b of s.grid.query(a.x, a.y, 40)) {
      if (b.id <= a.id || b.dead) continue;
      const dx = a.x - b.x,
        dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      const min = a.r + b.r - 4;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2) || 1;
        const push = ((min - d) / d) * 0.45;
        a.x += dx * push;
        a.y += dy * push;
        b.x -= dx * push;
        b.y -= dy * push;
      }
    }
  }

  for (let i = s.drops.length - 1; i >= 0; i--) {
    const d = s.drops[i];
    d.life -= dt;
    const mag = dist2(d, p) < (110 + p.orbit) ** 2;
    if (mag) {
      const u = unit(p.x - d.x, p.y - d.y);
      d.x += u.x * 240 * dt;
      d.y += u.y * 240 * dt;
    }
    if (dist2(d, p) < 26 ** 2) {
      s.xp += d.v;
      s.score += d.v;
      s.drops.splice(i, 1);
      event(s, "pulp", { x: d.x, y: d.y });
    } else if (d.life <= 0) s.drops.splice(i, 1);
  }
  maybeLevel(s);

  for (let i = s.pools.length - 1; i >= 0; i--) {
    const o = s.pools[i];
    o.life -= dt;
    if (o.life <= 0) {
      s.pools.splice(i, 1);
      continue;
    }
    if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 <= (o.r + p.r * 0.4) ** 2) {
      if (o.acid && p.invuln <= 0) {
        p.hp -= 7 * dt * (1 - p.thick);
        if (p.hp <= 0) {
          p.hp = 0;
          return endRun(s, { name: "bile", attack: "soak" });
        }
      } else if (!o.acid) {
        p.ripe = clamp(p.ripe + dt * 0.42 * (p.marrow ? 1.5 : 1), 0, 1);
        if (p.drink) p.hp = clamp(p.hp + 7 * dt, 0, p.maxHp);
      }
    }
  }

  for (let i = s.corpses.length - 1; i >= 0; i--) {
    s.corpses[i].life -= dt;
    if (s.corpses[i].life <= 0) s.corpses.splice(i, 1);
  }

  if (!s.prizeId && s.hook <= 0) {
    spawnEnemy(s, "prize");
    s.hook = 0;
  }

  s.spawnClock -= dt;
  if (s.spawnClock <= 0 && !s.prizeId && s.enemies.filter((e) => !e.dead).length < MAX_ENEMIES) {
    const t = s.time;
    const bag = ["nib", "nib"];
    if (t > 8) bag.push("shank", "shank");
    if (t > 18) bag.push("drip");
    if (t > 28) bag.push("twin");
    if (t > 40) bag.push("brisket");
    if (t > 55) bag.push("snare");
    const kind = bag[(s.rand() * bag.length) | 0];
    spawnEnemy(s, kind);
    const rate = clamp(0.82 - s.wave * 0.05 - s.time * 0.004, 0.22, 0.9);
    s.spawnClock = rate;
  }

  if (s.enemies.length > MAX_ENEMIES + 20) {
    s.enemies = s.enemies.filter((e) => !e.dead).slice(-MAX_ENEMIES);
  }

  return s;
}
