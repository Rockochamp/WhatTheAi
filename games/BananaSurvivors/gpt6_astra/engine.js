// All gameplay lives here, independent of pixels, audio, storage and wall time.
export const RULESET = 1,
  WAVE_SECONDS = 50,
  MAX_ENEMIES = 220,
  MAX_SHOTS = 280,
  MAX_DROPS = 360,
  ARENA = 1450;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export const WEAPONS = {
  blaster: {
    name: "Seed blaster",
    icon: "seed",
    color: "#ffe096",
    evolution: "GOLDEN GATLING",
    description: "Rapid seeds seek the nearest monster.",
    steps: [
      "+25% base damage",
      "Fire two seeds per shot",
      "Seeds pierce one extra monster",
      "Triple piercing fire. Your seeds become homing.",
    ],
  },
  boomerang: {
    name: "Bananarang",
    icon: "banana",
    color: "#ffd54c",
    evolution: "GOLDEN CYCLONE",
    description: "A returning blade hits on the way out and back.",
    steps: [
      "+9 base damage per blade",
      "Throw two blades together",
      "Bigger blades; shorter cooldown",
      "Three giant blades spiral through the horde.",
    ],
  },
  peels: {
    name: "Peel patrol",
    icon: "orbit",
    color: "#79e0c4",
    evolution: "PEEL FORTRESS",
    description: "Orbiting peels knock back nearby monsters.",
    steps: [
      "A second orbiting peel",
      "Larger orbit; +3 damage per hit",
      "A third peel; faster orbit",
      "Five giant peels. Your dash leaves burning peel patches.",
    ],
  },
  coconut: {
    name: "Coconut mortar",
    icon: "bomb",
    color: "#ffa477",
    evolution: "TROPICAL SUPERNOVA",
    description: "Lob a coconut into the crowd. It explodes.",
    steps: [
      "Wider blast; +14 base damage",
      "Drop a second coconut",
      "Burning splash lingers after impact",
      "Three coconuts erupt in huge, lingering explosions.",
    ],
  },
  lightning: {
    name: "Storm fruit",
    icon: "bolt",
    color: "#99c9ff",
    evolution: "MONSOON",
    description: "Lightning jumps between nearby enemies.",
    steps: [
      "One extra chain jump",
      "+8 base damage; faster strikes",
      "Lightning chains to five enemies",
      "A seven-target storm. Struck enemies are slowed.",
    ],
  },
};
export const PERKS = {
  power: {
    name: "Sharp seeds",
    icon: "seed",
    max: 4,
    color: "#ffe096",
    description: "+15% damage to every weapon.",
  },
  haste: {
    name: "Quick hands",
    icon: "bolt",
    max: 3,
    color: "#99c9ff",
    description: "All weapons fire 12% faster.",
  },
  boots: {
    name: "Slipstream",
    icon: "dash",
    max: 3,
    color: "#79e0c4",
    description: "+8% speed and 12% faster dash recharge.",
  },
  shell: {
    name: "Thick skin",
    icon: "shield",
    max: 3,
    color: "#ffa477",
    description: "Take 12% less damage.",
  },
  magnet: {
    name: "Big attraction",
    icon: "magnet",
    max: 3,
    color: "#c1abff",
    description: "+45% pickup reach; draw in more XP.",
  },
  area: {
    name: "Bigger bunch",
    icon: "orbit",
    max: 3,
    color: "#ffd54c",
    description: "+16% size to blades, blasts and orbiting peels.",
  },
  luck: {
    name: "Lucky peel",
    icon: "star",
    max: 3,
    color: "#d6eda7",
    description: "+8% critical chance and more supply drops.",
  },
  vitality: {
    name: "Fresh fruit",
    icon: "heart",
    max: 3,
    color: "#ffadb0",
    description: "+20 max health. Heal 20 immediately.",
  },
};
export const LOADOUTS = {
  classic: {
    name: "The original",
    detail: "Seed blaster · balanced start",
    weapon: "blaster",
    hp: 100,
    speed: 205,
  },
  ranger: {
    name: "The ranger",
    detail: "Bananarang · +10% speed, 90 HP",
    weapon: "boomerang",
    hp: 90,
    speed: 225,
  },
  bruiser: {
    name: "The bruiser",
    detail: "Peel patrol · 125 HP, slower feet",
    weapon: "peels",
    hp: 125,
    speed: 190,
  },
};
export const ENEMIES = {
  meatball: {
    sprite: 1,
    hp: 24,
    speed: 48,
    r: 17,
    damage: 12,
    xp: 2,
    score: 10,
    size: 58,
  },
  hound: {
    sprite: 2,
    hp: 30,
    speed: 85,
    r: 16,
    damage: 15,
    xp: 3,
    score: 18,
    size: 67,
  },
  brute: {
    sprite: 3,
    hp: 120,
    speed: 35,
    r: 29,
    damage: 22,
    xp: 8,
    score: 40,
    size: 96,
  },
  spitter: {
    sprite: 4,
    hp: 58,
    speed: 42,
    r: 22,
    damage: 13,
    xp: 5,
    score: 25,
    size: 78,
  },
  splitter: {
    sprite: 5,
    hp: 110,
    speed: 40,
    r: 27,
    damage: 18,
    xp: 7,
    score: 35,
    size: 94,
  },
  meatling: {
    sprite: 6,
    hp: 14,
    speed: 94,
    r: 11,
    damage: 8,
    xp: 1,
    score: 5,
    size: 37,
  },
  boss: {
    sprite: 7,
    hp: 640,
    speed: 50,
    r: 43,
    damage: 25,
    xp: 40,
    score: 500,
    size: 160,
  },
};
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
const event = (s, type, data = {}) =>
  s.events.length < 100 && s.events.push({ type, ...data });
export class SpatialGrid {
  constructor(size = 90) {
    this.size = size;
    this.cells = new Map();
  }
  rebuild(items) {
    this.cells.clear();
    for (const item of items) {
      if (item.dead) continue;
      const key = `${Math.floor(item.x / this.size)},${Math.floor(item.y / this.size)}`;
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, (cell = []));
      cell.push(item);
    }
  }
  query(x, y, r) {
    const out = [];
    for (
      let cx = Math.floor((x - r) / this.size);
      cx <= Math.floor((x + r) / this.size);
      cx++
    )
      for (
        let cy = Math.floor((y - r) / this.size);
        cy <= Math.floor((y + r) / this.size);
        cy++
      ) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (cell) out.push(...cell);
      }
    return out;
  }
}
export function createRun(seed = 1, loadout = "classic") {
  const kit = LOADOUTS[loadout] || LOADOUTS.classic;
  const s = {
    seed: seed >>> 0,
    random: rng(seed),
    phase: "playing",
    time: 0,
    wave: 1,
    waveTime: 0,
    bossId: null,
    bosses: 0,
    kills: 0,
    score: 0,
    level: 1,
    xp: 0,
    xpNext: 12,
    pending: 0,
    choices: [],
    rerolls: 2,
    loadout,
    combo: 0,
    bestCombo: 0,
    comboTime: 0,
    frenzy: 0,
    charge: 0,
    evolved: [],
    weapons:
      loadout === "classic" ? { blaster: 2 } : { blaster: 1, [kit.weapon]: 1 },
    perks: {},
    cooldowns: {},
    enemies: [],
    shots: [],
    drops: [],
    hazards: [],
    events: [],
    grid: new SpatialGrid(),
    nextId: 1,
    spawnClock: 1.0,
    supplyClock: 16,
    transition: 0,
    cache: { x: 280, y: -170, claimed: false },
    player: {
      x: 0,
      y: 0,
      hp: kit.hp,
      maxHp: kit.hp,
      speed: kit.speed,
      r: 16,
      dx: 1,
      dy: 0,
      angle: 0,
      dash: 0,
      dashCd: 0,
      invulnerable: 0,
      hit: 0,
      distance: 0,
    },
    stats: { damage: 0, pickups: 0, dashes: 0 },
    weaponDamage: {},
  };
  event(s, "start");
  return s;
}
export function multiplier(s) {
  return 1 + Math.min(3, Math.floor(s.combo / 12)) * 0.25;
}
export function stats(s) {
  return {
    damage: 1 + (s.perks.power || 0) * 0.15,
    haste: 1 + (s.perks.haste || 0) * 0.12 + (s.frenzy > 0 ? 0.65 : 0),
    speed: s.player.speed * (1 + (s.perks.boots || 0) * 0.08),
    area: 1 + (s.perks.area || 0) * 0.16,
    magnet: 95 * (1 + (s.perks.magnet || 0) * 0.45),
    armor: 1 - (s.perks.shell || 0) * 0.12,
    crit: 0.08 + (s.perks.luck || 0) * 0.08,
    dashCd: 2.4 * (1 - (s.perks.boots || 0) * 0.12),
  };
}
export function upgradeInfo(s, id) {
  const weapon = WEAPONS[id],
    rank = (weapon ? s.weapons[id] : s.perks[id]) || 0;
  if (weapon)
    return {
      id,
      name: rank === 4 ? weapon.evolution : weapon.name,
      description: rank ? weapon.steps[rank - 1] : weapon.description,
      kind: rank === 4 ? "EVOLUTION" : rank ? "WEAPON UPGRADE" : "NEW WEAPON",
      rank: rank + 1,
      max: 5,
      icon: weapon.icon,
      color: weapon.color,
    };
  if (PERKS[id])
    return { id, ...PERKS[id], kind: "SURVIVAL PERK", rank: rank + 1 };
  return {
    id: "heal",
    name: "A fresh start",
    description: "Restore 40 health. Sometimes living is the best build.",
    kind: "RECOVERY",
    rank: 1,
    max: 1,
    icon: "heart",
    color: "#ffadb0",
  };
}
export function offerUpgrades(s) {
  const pool = [
    ...Object.keys(WEAPONS).filter(
      (id) =>
        (s.weapons[id] || 0) < 5 &&
        (s.weapons[id] || Object.keys(s.weapons).length < 4),
    ),
    ...Object.keys(PERKS).filter((id) => (s.perks[id] || 0) < PERKS[id].max),
  ];
  if (s.player.hp < s.player.maxHp * 0.85 || pool.length < 3) pool.push("heal");
  const selected = [];
  const evolutions = pool.filter((id) => s.weapons[id] === 4);
  if (evolutions.length) {
    const id = evolutions[Math.floor(s.random() * evolutions.length)];
    selected.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  // Bias one choice toward the current build, then allow new directions.
  if (!selected.length) {
    const owned = pool.filter((id) => s.weapons[id]);
    if (owned.length) {
      const id = owned[Math.floor(s.random() * owned.length)];
      selected.push(id);
      pool.splice(pool.indexOf(id), 1);
    }
  }
  while (selected.length < 3 && pool.length) {
    const i = Math.floor(s.random() * pool.length);
    selected.push(pool.splice(i, 1)[0]);
  }
  s.choices = selected;
  return selected.map((id) => upgradeInfo(s, id));
}
export function chooseUpgrade(s, id) {
  if (s.phase !== "upgrade" || !s.choices.includes(id)) return false;
  if (WEAPONS[id]) {
    s.weapons[id] = (s.weapons[id] || 0) + 1;
    if (s.weapons[id] === 5) {
      s.evolved.push(id);
      event(s, "evolution", { id });
    }
  } else if (PERKS[id]) {
    s.perks[id] = (s.perks[id] || 0) + 1;
    if (id === "vitality") {
      s.player.maxHp += 20;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 20);
    }
  } else s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40);
  s.pending = Math.max(0, s.pending - 1);
  s.choices = [];
  if (s.pending) offerUpgrades(s);
  else s.phase = "playing";
  event(s, "upgrade", { id });
  return true;
}
export function reroll(s) {
  if (s.phase !== "upgrade" || s.rerolls <= 0) return false;
  s.rerolls--;
  offerUpgrades(s);
  return true;
}
export function gainXP(s, amount) {
  s.xp += amount;
  while (s.xp >= s.xpNext) {
    s.xp -= s.xpNext;
    s.level++;
    s.pending++;
    s.xpNext = Math.floor(12 + s.level * 5 + Math.pow(s.level, 1.38) * 2);
  }
  if (s.pending && s.phase === "playing") {
    s.phase = "upgrade";
    offerUpgrades(s);
    event(s, "level", { level: s.level });
  }
}
export function spawnEnemy(s, type = "meatball", position) {
  if (s.enemies.length >= MAX_ENEMIES) {
    if (type !== "boss") return null;
    let farthest = -1,
      distance = -1;
    s.enemies.forEach((e, i) => {
      const d = dist2(e, s.player);
      if (e.type !== "boss" && d > distance) {
        distance = d;
        farthest = i;
      }
    });
    if (farthest < 0) return null;
    s.enemies.splice(farthest, 1);
  }
  const def = ENEMIES[type] || ENEMIES.meatball,
    a = s.random() * Math.PI * 2,
    range = 480 + s.random() * 130;
  const x =
      position?.x ?? clamp(s.player.x + Math.cos(a) * range, -ARENA, ARENA),
    y = position?.y ?? clamp(s.player.y + Math.sin(a) * range, -ARENA, ARENA);
  const scale =
    1 + (s.wave - 1) * 0.22 + Math.pow(Math.max(0, s.wave - 4), 2) * 0.12;
  const hp =
    type === "boss"
      ? 500 + s.wave * 180 + s.wave * s.wave * 28
      : def.hp * scale;
  const e = {
    id: s.nextId++,
    type,
    ...def,
    damage:
      def.damage * (1 + (s.wave - 1) * 0.055 + Math.max(0, s.wave - 5) * 0.055),
    x,
    y,
    hp,
    maxHp: hp,
    speed: def.speed * (1 + Math.min(0.8, (s.wave - 1) * 0.025)),
    born: 0.65,
    age: 0,
    hit: 0,
    slow: 0,
    kx: 0,
    ky: 0,
    dead: false,
    attack: 2 + s.random() * 2,
    windup: 0,
    action: "",
    ax: 0,
    ay: 0,
    charge: 0,
    tick: 0,
  };
  s.enemies.push(e);
  if (type === "boss") {
    s.bossId = e.id;
    event(s, "boss", { wave: s.wave, name: bossName(s.wave) });
  }
  return e;
}
export function bossName(wave) {
  return ["The Cleaver King", "The Bonebreaker", "The Marrow Witch"][
    (wave - 1) % 3
  ];
}
function nearest(s, x, y, range = 650, excluded) {
  let best = null,
    d = range * range;
  for (const e of s.grid.query(x, y, range)) {
    if (e.dead || e.born > 0 || excluded?.has(e.id)) continue;
    const n = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (n < d) {
      d = n;
      best = e;
    }
  }
  return best;
}
function drop(s, x, y, kind, value = 1) {
  if (s.drops.length >= MAX_DROPS) {
    if (kind === "xp") {
      const existing = s.drops.find((d) => d.kind === "xp");
      if (existing) existing.value += value;
      return;
    }
    const i = s.drops.findIndex((d) => d.kind === "xp");
    if (i >= 0) {
      const old = s.drops.splice(i, 1)[0];
      const target = s.drops.find((d) => d.kind === "xp");
      if (target) target.value += old.value;
    } else return;
  }
  s.drops.push({ id: s.nextId++, x, y, kind, value, age: 0, magnet: false });
}
function kill(s, e, weapon) {
  if (e.dead) return;
  e.dead = true;
  s.kills++;
  s.combo++;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.comboTime = 3.8;
  s.score += Math.round(e.score * multiplier(s));
  s.charge += e.type === "boss" ? 25 : 3;
  event(s, "kill", { x: e.x, y: e.y, size: e.size, sprite: e.sprite, weapon });
  drop(s, e.x, e.y, "xp", e.xp);
  if (e.type === "splitter")
    for (let i = 0; i < 4; i++)
      spawnEnemy(s, "meatling", {
        x: e.x + Math.cos((i * Math.PI) / 2) * 18,
        y: e.y + Math.sin((i * Math.PI) / 2) * 18,
      });
  if (e.type === "boss") {
    s.bossId = null;
    s.bosses++;
    s.transition = 3.5;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25);
    s.rerolls = Math.min(3, s.rerolls + 1);
    s.hazards = [];
    s.shots = s.shots.filter((b) => !b.hostile);
    for (const d of s.drops) d.magnet = true;
    s.pending++;
    event(s, "bossDefeated", {
      wave: s.wave,
      score: Math.round(e.score * multiplier(s)),
    });
  } else if (s.random() < 0.012 + (s.perks.luck || 0) * 0.005) {
    const r = s.random();
    drop(s, e.x, e.y, r < 0.6 ? "heal" : r < 0.82 ? "magnet" : "nuke");
  }
  if (s.charge >= 100 && s.frenzy <= 0) {
    s.charge = 0;
    s.frenzy = 7;
    event(s, "frenzy");
  }
}
function hit(s, e, damage, weapon, kx = 0, ky = 0) {
  if (e.dead || e.born > 0) return;
  const critical = s.random() < stats(s).crit,
    amount = damage * (critical ? 1.8 : 1);
  e.hp -= amount;
  e.hit = 0.12;
  e.kx += kx;
  e.ky += ky;
  s.stats.damage += Math.min(e.hp + amount, amount);
  s.weaponDamage[weapon] =
    (s.weaponDamage[weapon] || 0) + Math.min(e.hp + amount, amount);
  event(s, "hit", { x: e.x, y: e.y, amount: Math.round(amount), critical });
  if (e.hp <= 0) kill(s, e, weapon);
}
function hurt(s, amount, dx = 0, dy = 0) {
  const p = s.player;
  if (p.invulnerable > 0 || p.dash > 0 || s.phase === "dead") return;
  p.hp = Math.max(0, p.hp - amount * stats(s).armor);
  p.invulnerable = 0.68;
  p.hit = 0.25;
  p.x = clamp(p.x + dx * 12, -ARENA, ARENA);
  p.y = clamp(p.y + dy * 12, -ARENA, ARENA);
  s.combo = 0;
  s.comboTime = 0;
  event(s, "hurt", { amount });
  if (p.hp <= 0) {
    s.phase = "dead";
    event(s, "death");
  }
}
function shoot(s, b) {
  if (s.shots.length < MAX_SHOTS)
    s.shots.push({
      id: s.nextId++,
      age: 0,
      life: 2,
      r: 5,
      hitIds: new Set(),
      hostile: false,
      ...b,
    });
}
function hazard(s, h) {
  if (s.hazards.length < 65)
    s.hazards.push({ id: s.nextId++, age: 0, triggered: false, ...h });
}
function explode(s, x, y, r, damage, weapon) {
  event(s, "explode", {
    x,
    y,
    r,
    color: weapon === "coconut" ? "#ffb36c" : "#ffe18a",
  });
  for (const e of s.grid.query(x, y, r + 70))
    if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) {
      const d = unit(e.x - x, e.y - y);
      hit(s, e, damage, weapon, d.x * 90, d.y * 90);
    }
}
function fireWeapons(s, dt) {
  const st = stats(s),
    p = s.player,
    target = nearest(s, p.x, p.y);
  p.angle = target
    ? Math.atan2(target.y - p.y, target.x - p.x)
    : Math.atan2(p.dy, p.dx);
  for (const [id, rank] of Object.entries(s.weapons)) {
    s.cooldowns[id] = (s.cooldowns[id] || 0) - dt;
    if (id === "peels") continue;
    if (s.cooldowns[id] > 0 || !target) continue;
    const angle = Math.atan2(target.y - p.y, target.x - p.x),
      damage = st.damage;
    if (id === "blaster") {
      const count = rank >= 5 ? 3 : rank >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * 0.13;
        shoot(s, {
          kind: "seed",
          weapon: id,
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * 590,
          vy: Math.sin(a) * 590,
          damage: 18 * (1 + (rank - 1) * 0.25) * damage,
          pierce: rank >= 4 ? 2 : 1,
          homing: rank === 5,
        });
      }
      s.cooldowns[id] = 0.32 / st.haste;
      event(s, "shoot");
    } else if (id === "boomerang") {
      const count = rank >= 5 ? 3 : rank >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * 0.45;
        shoot(s, {
          kind: "banana",
          weapon: id,
          x: p.x,
          y: p.y,
          ox: p.x,
          oy: p.y,
          angle: a,
          damage: (26 + rank * 9) * damage,
          r: 19 * st.area * (rank === 5 ? 1.45 : 1),
          life: 1.45,
          hitIdsBack: new Set(),
        });
      }
      s.cooldowns[id] = (rank >= 4 ? 1.1 : 1.35) / st.haste;
      event(s, "throw");
    } else if (id === "coconut") {
      const count = rank >= 5 ? 3 : rank >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++)
        shoot(s, {
          kind: "coconut",
          weapon: id,
          x: p.x,
          y: p.y,
          ox: p.x,
          oy: p.y,
          tx: target.x + (i - (count - 1) / 2) * 70,
          ty: target.y + (s.random() - 0.5) * 50,
          life: 0.72,
          damage: (38 + rank * 14) * damage,
          blast: (62 + rank * 8) * st.area,
          burn: rank >= 4,
        });
      s.cooldowns[id] = 2.4 / st.haste;
      event(s, "throw");
    } else if (id === "lightning") {
      const points = [{ x: p.x, y: p.y }],
        seen = new Set();
      let t = target;
      const count = rank === 5 ? 7 : rank >= 4 ? 5 : rank + 1;
      for (let i = 0; i < count && t; i++) {
        points.push({ x: t.x, y: t.y });
        seen.add(t.id);
        hit(s, t, (24 + rank * 8) * damage, id);
        if (rank === 5) t.slow = 1.5;
        t = nearest(s, t.x, t.y, 210, seen);
      }
      event(s, "lightning", { points });
      s.cooldowns[id] = (rank >= 3 ? 1.65 : 2.0) / st.haste;
    }
  }
  const rank = s.weapons.peels;
  if (rank) {
    const count = rank === 5 ? 5 : rank >= 4 ? 3 : rank >= 2 ? 2 : 1,
      orbit = (rank >= 3 ? 82 : 65) * st.area;
    if (s.cooldowns.peels <= 0) {
      s.cooldowns.peels = 0.15;
      for (let i = 0; i < count; i++) {
        const a = s.time * (rank >= 4 ? 2.8 : 2.1) + (i * Math.PI * 2) / count,
          x = p.x + Math.cos(a) * orbit,
          y = p.y + Math.sin(a) * orbit;
        for (const e of s.grid.query(x, y, 75))
          if (!e.dead && Math.hypot(e.x - x, e.y - y) < e.r + 18 * st.area) {
            const d = unit(e.x - p.x, e.y - p.y);
            hit(s, e, (7 + rank * 3) * st.damage, "peels", d.x * 70, d.y * 70);
          }
      }
    }
  }
}
function updateShots(s, dt) {
  for (const b of s.shots) {
    b.age += dt;
    if (b.age > b.life) {
      if (b.kind === "coconut") {
        explode(s, b.tx, b.ty, b.blast, b.damage, b.weapon);
        if (b.burn)
          hazard(s, {
            x: b.tx,
            y: b.ty,
            r: b.blast * 0.8,
            delay: 0,
            life: 2.5,
            friendly: true,
            damage: b.damage * 0.12,
            weapon: "coconut",
            tick: 0,
          });
      }
      b.remove = true;
      continue;
    }
    const ox = b.x,
      oy = b.y;
    if (b.kind === "banana") {
      const t = b.age / b.life;
      const reach = Math.sin(t * Math.PI) * 300;
      b.x =
        s.player.x +
        Math.cos(b.angle) * reach +
        Math.sin(b.angle) * Math.sin(t * Math.PI * 2) * 50;
      b.y =
        s.player.y +
        Math.sin(b.angle) * reach -
        Math.cos(b.angle) * Math.sin(t * Math.PI * 2) * 50;
    } else if (b.kind === "coconut") {
      const t = b.age / b.life;
      b.x = b.ox + (b.tx - b.ox) * t;
      b.y = b.oy + (b.ty - b.oy) * t;
      continue;
    } else {
      if (b.homing) {
        const t = nearest(s, b.x, b.y, 180, b.hitIds);
        if (t) {
          const d = unit(t.x - b.x, t.y - b.y);
          b.vx += (d.x * 590 - b.vx) * Math.min(1, dt * 5);
          b.vy += (d.y * 590 - b.vy) * Math.min(1, dt * 5);
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    if (b.hostile) {
      if (
        segmentHit(ox, oy, b.x, b.y, s.player.x, s.player.y, b.r + s.player.r)
      ) {
        hurt(s, b.damage);
        b.remove = true;
      }
      continue;
    }
    const hitIds =
      b.kind === "banana" && b.age / b.life > 0.5 ? b.hitIdsBack : b.hitIds;
    for (const e of s.grid.query(
      b.x,
      b.y,
      75 + Math.hypot(b.x - ox, b.y - oy),
    )) {
      if (e.dead || hitIds.has(e.id)) continue;
      if (segmentHit(ox, oy, b.x, b.y, e.x, e.y, e.r + b.r)) {
        hitIds.add(e.id);
        const d = unit(e.x - s.player.x, e.y - s.player.y);
        hit(s, e, b.damage, b.weapon, d.x * 26, d.y * 26);
        if (b.kind !== "banana" && --b.pierce <= 0) {
          b.remove = true;
          break;
        }
      }
    }
  }
  s.shots = s.shots.filter((b) => !b.remove);
}
export function segmentHit(ax, ay, bx, by, x, y, r) {
  const dx = bx - ax,
    dy = by - ay,
    t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2 <= r * r;
}
function enemiesStep(s, dt) {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.age += dt;
    e.born = Math.max(0, e.born - dt);
    e.hit = Math.max(0, e.hit - dt);
    e.slow = Math.max(0, e.slow - dt);
    if (e.born > 0) continue;
    const dx = p.x - e.x,
      dy = p.y - e.y,
      distance = Math.hypot(dx, dy),
      d = unit(dx, dy);
    let mx = d.x,
      my = d.y,
      speed = e.speed;
    e.attack -= dt;
    if (e.type === "spitter") {
      if (distance < 230) {
        mx = -d.x;
        my = -d.y;
      } else if (distance < 350) {
        mx = 0;
        my = 0;
      }
      if (e.attack <= 0 && distance < 540 && !e.windup) {
        e.windup = 0.65;
        e.action = "spit";
        e.ax = d.x;
        e.ay = d.y;
      }
    } else if (
      e.type === "hound" &&
      e.attack <= 0 &&
      distance < 310 &&
      !e.windup &&
      !e.charge
    ) {
      e.windup = 0.62;
      e.action = "charge";
      e.ax = d.x;
      e.ay = d.y;
    } else if (e.type === "boss" && e.attack <= 0 && !e.windup && !e.charge) {
      const pattern = (s.wave - 1) % 3;
      e.windup = pattern === 0 ? 0.9 : 1.05;
      e.action = pattern === 0 ? "charge" : pattern === 1 ? "slam" : "burst";
      e.ax = d.x;
      e.ay = d.y;
      if (e.action === "slam")
        hazard(s, {
          x: p.x,
          y: p.y,
          r: 115,
          delay: 1.05,
          life: 1.5,
          friendly: false,
          damage: 28,
        });
    }
    if (e.windup > 0) {
      speed = 0;
      e.windup -= dt;
      if (e.windup <= 0) {
        e.windup = 0;
        if (e.action === "charge") e.charge = e.type === "boss" ? 0.8 : 0.55;
        if (e.action === "spit") {
          shoot(s, {
            kind: "acid",
            hostile: true,
            x: e.x,
            y: e.y,
            vx: e.ax * 195,
            vy: e.ay * 195,
            life: 3.6,
            r: 9,
            damage: 13,
          });
          e.attack = 2.7;
        }
        if (e.action === "burst") {
          for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6 + s.time * 0.2;
            shoot(s, {
              kind: "acid",
              hostile: true,
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 160,
              vy: Math.sin(a) * 160,
              life: 4,
              r: 9,
              damage: 18,
            });
          }
          e.attack = 3.7;
        }
        if (e.action === "slam") {
          event(s, "slam", { x: p.x, y: p.y });
          e.attack = 3.2;
        }
      }
    }
    if (e.charge > 0) {
      e.charge -= dt;
      mx = e.ax;
      my = e.ay;
      speed = e.type === "boss" ? 430 : 340;
      if (e.charge <= 0) {
        e.charge = 0;
        e.attack = e.type === "boss" ? 3.4 : 3.2;
        e.action = "";
      }
    } else if (!e.windup) {
      let sx = 0,
        sy = 0;
      for (const other of s.grid.query(e.x, e.y, e.r + 50)) {
        if (other.id === e.id || other.dead) continue;
        const dd = Math.hypot(e.x - other.x, e.y - other.y),
          rr = e.r + other.r;
        if (dd > 0 && dd < rr) {
          sx += (((e.x - other.x) / dd) * (rr - dd)) / rr;
          sy += (((e.y - other.y) / dd) * (rr - dd)) / rr;
        }
      }
      mx += sx * 0.85;
      my += sy * 0.85;
      const norm = Math.hypot(mx, my);
      if (norm > 1) {
        mx /= norm;
        my /= norm;
      }
    }
    if (e.slow > 0) speed *= 0.55;
    e.kx *= Math.exp(-dt * 8);
    e.ky *= Math.exp(-dt * 8);
    e.x = clamp(e.x + (mx * speed + e.kx) * dt, -ARENA - 70, ARENA + 70);
    e.y = clamp(e.y + (my * speed + e.ky) * dt, -ARENA - 70, ARENA + 70);
    if (distance < e.r + p.r) hurt(s, e.damage, -d.x, -d.y);
    // Recycle far-away mobs instead of accumulating unreachable objects.
    if (distance > 1050 && e.type !== "boss") {
      const a = s.random() * Math.PI * 2;
      e.x = clamp(p.x + Math.cos(a) * 620, -ARENA, ARENA);
      e.y = clamp(p.y + Math.sin(a) * 620, -ARENA, ARENA);
      e.born = 0.7;
    }
  }
}
function dropsStep(s, dt) {
  const p = s.player,
    st = stats(s);
  let xp = 0;
  for (const d of s.drops) {
    d.age += dt;
    const distance = Math.hypot(d.x - p.x, d.y - p.y);
    if ((distance < st.magnet || d.magnet) && d.kind === "xp") {
      const direction = unit(p.x - d.x, p.y - d.y),
        step = Math.min(
          distance,
          (170 + 450 * (1 - Math.min(1, distance / 400))) * dt,
        );
      d.x += direction.x * step;
      d.y += direction.y * step;
    }
    if (Math.hypot(d.x - p.x, d.y - p.y) < p.r + 12) {
      d.remove = true;
      s.stats.pickups++;
      if (d.kind === "xp") xp += d.value;
      else if (d.kind === "heal") {
        p.hp = Math.min(p.maxHp, p.hp + 25);
        event(s, "pickup", { kind: d.kind });
      } else if (d.kind === "magnet") {
        for (const gem of s.drops) if (gem.kind === "xp") gem.magnet = true;
        event(s, "pickup", { kind: d.kind });
      } else if (d.kind === "frenzy") {
        s.frenzy = 9;
        event(s, "frenzy");
      } else if (d.kind === "nuke") {
        explode(s, p.x, p.y, 760, 220 + s.wave * 30, "nuke");
        event(s, "pickup", { kind: d.kind });
      }
    } else if (d.age > 70 && d.kind !== "xp") d.remove = true;
  }
  s.drops = s.drops.filter((d) => !d.remove);
  if (xp) {
    event(s, "xp", { amount: xp });
    gainXP(s, xp);
  }
}
function hazardsStep(s, dt) {
  for (const h of s.hazards) {
    h.age += dt;
    if (h.age < h.delay) continue;
    if (h.friendly) {
      h.tick -= dt;
      if (h.tick <= 0) {
        h.tick = 0.3;
        for (const e of s.grid.query(h.x, h.y, h.r + 60))
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + h.r)
            hit(s, e, h.damage, h.weapon);
      }
    } else if (!h.triggered) {
      h.triggered = true;
      event(s, "explode", { x: h.x, y: h.y, r: h.r, color: "#ff8063" });
      if (Math.hypot(s.player.x - h.x, s.player.y - h.y) < h.r + s.player.r)
        hurt(s, h.damage);
    }
  }
  s.hazards = s.hazards.filter((h) => h.age < h.life);
}
export function update(s, dt, input = {}) {
  s.events = [];
  if (s.phase !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  const p = s.player,
    st = stats(s);
  s.time += dt;
  s.frenzy = Math.max(0, s.frenzy - dt);
  s.comboTime -= dt;
  if (s.comboTime <= 0) s.combo = 0;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.hit = Math.max(0, p.hit - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dash = Math.max(0, p.dash - dt);
  let x = Number.isFinite(input.x) ? input.x : 0,
    y = Number.isFinite(input.y) ? input.y : 0;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  if (length > 0.05 && p.dash <= 0) {
    p.dx = x / (Math.hypot(x, y) || 1);
    p.dy = y / (Math.hypot(x, y) || 1);
  }
  if (input.dash && p.dashCd <= 0) {
    p.dash = 0.22;
    p.dashCd = st.dashCd;
    p.invulnerable = 0.28;
    s.stats.dashes++;
    event(s, "dash", { x: p.x, y: p.y, dx: p.dx, dy: p.dy });
    if (s.weapons.peels === 5)
      hazard(s, {
        x: p.x,
        y: p.y,
        r: 65 * st.area,
        delay: 0,
        life: 2.5,
        friendly: true,
        damage: 18 * st.damage,
        weapon: "peels",
        tick: 0,
      });
  }
  if (p.dash > 0) {
    x = p.dx;
    y = p.dy;
  }
  const speed = p.dash > 0 ? 820 : st.speed;
  p.x = clamp(p.x + x * speed * dt, -ARENA, ARENA);
  p.y = clamp(p.y + y * speed * dt, -ARENA, ARENA);
  p.distance += Math.hypot(x, y) * speed * dt;
  if (s.transition > 0) {
    s.transition -= dt;
    if (s.transition <= 0) {
      s.wave++;
      s.waveTime = 0;
      s.spawnClock = 1;
      s.cache = {
        x: clamp(p.x + Math.cos(s.wave * 2.4) * 360, -ARENA + 80, ARENA - 80),
        y: clamp(p.y + Math.sin(s.wave * 2.4) * 360, -ARENA + 80, ARENA - 80),
        claimed: false,
      };
      event(s, "wave", { wave: s.wave });
    }
  } else if (!s.bossId) {
    s.waveTime += dt;
    if (s.waveTime >= WAVE_SECONDS) spawnEnemy(s, "boss");
  }
  if (s.transition <= 0) {
    s.spawnClock -= dt;
    if (s.spawnClock <= 0) {
      s.spawnClock = s.bossId
        ? Math.max(0.65, 1.8 - s.wave * 0.07)
        : Math.max(
            0.19,
            0.9 - s.wave * 0.055 - Math.min(0.35, s.waveTime * 0.005),
          );
      const r = s.random();
      const type =
        s.wave >= 3 && r > 0.86
          ? "splitter"
          : s.wave >= 2 && r > 0.73
            ? "spitter"
            : s.wave >= 2 && r > 0.57
              ? "brute"
              : s.waveTime > 16 && r > 0.6
                ? "hound"
                : "meatball";
      const pack = 1 + Math.min(4, Math.floor((s.wave - 1) / 4));
      for (let i = 0; i < pack; i++) spawnEnemy(s, type);
    }
  }
  s.supplyClock -= dt;
  if (s.supplyClock <= 0) {
    s.supplyClock = 22 + s.random() * 14;
    const a = s.random() * Math.PI * 2;
    drop(
      s,
      clamp(p.x + Math.cos(a) * 250, -ARENA, ARENA),
      clamp(p.y + Math.sin(a) * 250, -ARENA, ARENA),
      p.hp < p.maxHp * 0.55 ? "heal" : s.random() < 0.5 ? "frenzy" : "magnet",
    );
  }
  if (!s.cache.claimed && Math.hypot(p.x - s.cache.x, p.y - s.cache.y) < 44) {
    s.cache.claimed = true;
    drop(s, s.cache.x, s.cache.y, "heal");
    drop(s, s.cache.x + 12, s.cache.y + 10, "magnet");
    s.score += 100;
    event(s, "cache");
  }
  s.grid.rebuild(s.enemies);
  enemiesStep(s, dt);
  if (s.phase === "dead") return;
  s.grid.rebuild(s.enemies);
  fireWeapons(s, dt);
  updateShots(s, dt);
  hazardsStep(s, dt);
  if (s.phase === "dead") return;
  s.enemies = s.enemies.filter((e) => !e.dead);
  dropsStep(s, dt);
  if (s.pending && s.phase === "playing") {
    s.phase = "upgrade";
    offerUpgrades(s);
    event(s, "level", { level: s.level });
  }
}
export function endRun(s) {
  if (s.phase === "dead") return false;
  s.phase = "dead";
  event(s, "death");
  return true;
}
export function runSummary(s) {
  return {
    score: Math.floor(s.score + s.time * 2 + s.bosses * 250),
    kills: s.kills,
    wave: s.wave,
    bosses: s.bosses,
    seconds: Math.floor(s.time),
    level: s.level,
    bestCombo: s.bestCombo,
    evolved: s.evolved.slice(),
    weapons: { ...s.weapons },
    loadout: s.loadout,
  };
}
