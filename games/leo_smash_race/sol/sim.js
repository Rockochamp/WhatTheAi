export const STEP = 1 / 60;
export const MAX_TICKS = 60 * 240;
export const INPUT = { left: 1, right: 2, drift: 4, boost: 8, special: 16, jump: 32, fire: 64 };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const mix = (a, b, t) => a + (b - a) * t;

export const RACERS = [
  { id: 'rex', name: 'Dino Rex', move: 'Knochenbrecher', desc: 'Beisst Hindernisse vor der Motorhaube weg und stösst Rivalen zur Seite.', color: '#35dfbc', speed: 208, grip: 0.94, armor: 1.28, width: 43, reach: 66, lane: 32, duration: 1.5 },
  { id: 'bat', name: 'Night Bat', move: 'EMP-Welle', desc: 'Bremst Rivalen in der Nähe und zerstört Hindernisse auf beiden Seiten.', color: '#96abfc', speed: 216, grip: 1.01, armor: 1.12, width: 39, reach: 52, lane: 60, duration: 1.25 },
  { id: 'sky', name: 'Sky Patrol', move: 'Tiefflug', desc: 'Hebt ab und rast über Öl, Kisten und Rivalen hinweg.', color: '#ff5f56', speed: 222, grip: 1.10, armor: 0.87, width: 44, reach: 0, lane: 0, duration: 2.6 },
  { id: 'digger', name: 'Gold Digger', move: 'Räumschaufel', desc: 'Räumt Hindernisse vor dir weg. Jedes davon repariert deinen Buggy.', color: '#ffbd46', speed: 205, grip: 0.97, armor: 1.4, width: 38, reach: 52, lane: 28, duration: 2.15 },
  { id: 'lime', name: 'Lime Hopper', move: 'Schildsprung', desc: 'Springt mit Schutzschild ab und landet in einer Schockwelle.', color: '#c3fa51', speed: 212, grip: 1.23, armor: 1.0, width: 34, reach: 31, lane: 47, duration: 1.7 },
  { id: 'comet', name: 'Blue Comet', move: 'Kometenstart', desc: 'Zündet den stärksten Turbo und durchbricht Kisten auf deiner Linie.', color: '#4aa9ff', speed: 232, grip: 0.94, armor: 0.8, width: 31, reach: 34, lane: 24, duration: 1.7 },
  { id: 'jade', name: 'Jade Racer', move: 'Magnetfeld', desc: 'Zieht Nitrozellen, Reparaturen und Schilde von der ganzen Fahrbahn an.', color: '#55ef8e', speed: 224, grip: 1.17, armor: 0.88, width: 31, reach: 115, lane: 100, duration: 2.7 },
  { id: 'pup', name: 'Plüsch-Pilot', move: 'Wirbelpfote', desc: 'Repariert deinen Kart sofort und wirbelt Hindernisse rundherum aus dem Weg.', color: '#ffc9a3', speed: 209, grip: 1.27, armor: 1.02, width: 35, reach: 38, lane: 60, duration: 1.9 },
  { id: 'blade', name: 'Neon Blade', move: 'Klingenschnitt', desc: 'Schickt einen Schnitt durch Hindernisse weit voraus und öffnet eine Überholspur.', color: '#e38eff', speed: 225, grip: 1.05, armor: 0.91, width: 32, reach: 154, lane: 31, duration: 1.2 },
  { id: 'knuckles', name: 'Knuckles', move: 'Bodenbrecher', desc: 'Rammt die Fäuste auf den Asphalt. Drei rote Druckwellen zertrümmern Kisten und bremsen Rivalen.', color: '#ff574e', speed: 213, grip: 1.12, armor: 1.21, width: 40, reach: 0, lane: 0, duration: 1.28 },
];

export const COURSES = [
  { id: 'workshop', name: 'Werkstatt-Ring', type: 'Asphalt · Schnell', map: 'Ein schneller Einstieg mit langen Geraden und Kisten am Kurvenausgang.', seed: 43, width: 87, ground: '#161d21', road: '#343e43', border: '#d6ed6b', light: '#e7ffc5', points: [[0,400],[280,360],[530,105],[450,-250],[130,-350],[-100,-220],[-400,-280],[-520,20],[-340,330]] },
  { id: 'quarry', name: 'Schotterbruch', type: 'Schotter · Sprünge', map: 'Enge Bögen, Ölfallen und mehr Rampen für Abkürzungen durch die Luft.', seed: 2323, width: 79, ground: '#312522', road: '#5a4236', border: '#ffaa54', light: '#ffe0b3', points: [[0,460],[370,420],[545,165],[385,-170],[500,-395],[170,-495],[-45,-260],[-340,-410],[-495,-95],[-310,135],[-365,370]] },
  { id: 'neon', name: 'Neonhafen', type: 'Nacht · Präzision', map: 'Schnelle Richtungswechsel und enge Linien zwischen den Hafenlichtern.', seed: 277, width: 74, ground: '#101e2f', road: '#26334b', border: '#54deff', light: '#c1caff', points: [[0,440],[315,470],[500,260],[335,25],[540,-185],[415,-428],[80,-430],[-190,-260],[-510,-300],[-455,15],[-215,135],[-355,405]] },
  { id: 'overdrive', name: 'Turbo-Terrasse', type: 'Finale · Highspeed', map: 'Schnelle Geraden, eine technische Kehre und viele Chancen auf eine Smash-Serie.', seed: 711, width: 81, ground: '#1d2127', road: '#42384a', border: '#e995ff', light: '#ffdcf5', points: [[0,480],[400,480],[575,220],[475,-30],[125,-65],[25,-270],[375,-440],[-10,-575],[-475,-470],[-555,-140],[-340,145],[-360,410]] },
];

function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function spline(a, b, c, d, t) {
  return 0.5 * (2 * b + (-a + c) * t + (2*a - 5*b + 4*c - d) * t*t + (-a + 3*b - 3*c + d) * t*t*t);
}

export function buildCircuit(course) {
  const points = course.points;
  const nodes = [];
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(j => points[(i + j + points.length) % points.length]);
    for (let j = 0; j < 32; j++) {
      const t = j / 32;
      const x = spline(a[0], b[0], c[0], d[0], t);
      const y = spline(a[1], b[1], c[1], d[1], t);
      const previous = nodes.at(-1);
      if (previous) length += Math.hypot(x - previous.x, y - previous.y);
      nodes.push({ x, y, s: length });
    }
  }
  length += Math.hypot(nodes[0].x - nodes.at(-1).x, nodes[0].y - nodes.at(-1).y);
  return { ...course, nodes, length, laps: 2 };
}

export const CIRCUITS = COURSES.map(buildCircuit);

export function pointAt(circuit, distance, offset = 0) {
  const s = ((distance % circuit.length) + circuit.length) % circuit.length;
  const nodes = circuit.nodes;
  let lo = 0;
  let hi = nodes.length;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (nodes[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = nodes[lo];
  const b = nodes[hi % nodes.length];
  const t = (s - a.s) / ((hi === nodes.length ? circuit.length : b.s) - a.s);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return { x: mix(a.x, b.x, t) - Math.sin(angle) * offset, y: mix(a.y, b.y, t) + Math.cos(angle) * offset, angle };
}

export const PROPS = {
  crate: { value: 110, damage: 14, radius: 14, color: '#d49962' },
  stack: { value: 220, damage: 23, radius: 23, color: '#e8ab6b' },
  barrier: { value: 325, damage: 34, radius: 28, color: '#fe714b' },
  oil: { radius: 21, color: '#746796' },
  cell: { radius: 13, color: '#e8ff6d' },
  repair: { radius: 13, color: '#6efbad' },
  shield: { radius: 13, color: '#79dcff' },
  pad: { radius: 27, color: '#c9fb56' },
  ramp: { radius: 24, color: '#fba944' },
  ring: { radius: 18, color: '#dcabff' },
};

function populate(circuit) {
  const roll = random(circuit.seed);
  const objects = [];
  const lanes = [-0.63, -0.28, 0, 0.28, 0.63];
  for (let s = 195, i = 0; s < circuit.length - 120; s += 88 + roll() * 38, i++) {
    const offset = circuit.width * lanes[Math.floor(roll() * lanes.length)];
    const chance = roll();
    const kind = i === 1 ? 'cell' : i === 3 ? 'pad' : i === 5 ? 'ramp'
      : chance < 0.12 ? 'pad' : chance < 0.19 ? 'repair' : chance < 0.25 ? 'shield'
      : chance < (circuit.id === 'quarry' ? 0.38 : 0.32) ? 'ramp' : chance < 0.45 ? 'cell'
      : chance < 0.54 ? 'oil' : chance < 0.69 ? 'crate' : chance < 0.86 ? 'stack' : 'barrier';
    objects.push({ s, offset, kind, used: -1 });
    if (kind === 'ramp') objects.push({ s: s + 56, offset, kind: 'ring', used: -1 });
    if (kind === 'pad') objects.push({ s: s + 34, offset, kind: 'crate', used: -1 });
  }
  return objects;
}

export function createRace(courseId, racerId, mode = 'crew', warmup = false) {
  const circuit = CIRCUITS.find(c => c.id === courseId);
  const racer = RACERS.find(r => r.id === racerId);
  if (!circuit || !racer || !['crew', 'pro'].includes(mode)) throw new Error('Ungültiges Rennen');
  const rivals = RACERS.filter(r => r !== racer && r.id !== 'knuckles');
  const offset = circuit.seed % rivals.length;
  return {
    circuit, racer, mode, objects: populate(circuit), events: [], tick: 0, input: 0, distance: 0, speed: 68,
    offset: 0, side: 0, hp: 100, nitro: mode === 'crew' && warmup ? 100 : 47, special: 75,
    specialTime: 0, boostTime: 0, turbo: 0, shield: 0, air: 0, hit: 0, recover: 0, slick: 0,
    jumpWait: 0, fireWait: 0, shot: 0, punchTick: 0, punchIndex: 0, combo: 0, comboTime: 0, bestCombo: 0,
    smash: 0, points: 0, rings: 0, pitStops: 0, drifting: false, nitroFiring: false, finished: false, timeout: false,
    rivals: Array.from({ length: 4 }, (_, i) => ({
      racer: rivals[(offset + i) % rivals.length], distance: [14,-18,-47,-75][i],
      offset: [-29,37,-35,32][i], lane: [-32,38,-40,40][i], hit: 0,
    })),
  };
}

function emit(r, type, data) {
  r.events.push({ type, ...data });
}

function breakProp(r, object, lap, powered = false) {
  object.used = lap;
  r.combo = r.comboTime > 0 ? Math.min(6, r.combo + 1) : 1;
  r.comboTime = 1.8;
  r.bestCombo = Math.max(r.combo, r.bestCombo);
  r.smash++;
  const points = PROPS[object.kind].value * r.combo + (powered ? 30 : 0);
  r.points += points;
  r.nitro += powered ? 5 : 12;
  r.special += 13;
  if (r.racer.id === 'digger' && r.specialTime > 0) r.hp = Math.min(100, r.hp + 9);
  emit(r, 'smash', { object, points, combo: r.combo });
}

function damage(r, amount) {
  if (r.hit > 0 || r.shield > 0 || r.recover > 0 || (r.racer.id === 'sky' && r.specialTime > 0)) return;
  r.hit = 0.47;
  r.hp = Math.max(0, r.hp - amount / r.racer.armor * (r.mode === 'crew' ? 0.73 : 1));
  r.speed *= 0.78;
  emit(r, 'hit');
  if (r.hp <= 0) {
    r.pitStops++;
    r.recover = 2.65;
    r.hp = 100;
    r.nitro = Math.max(15, r.nitro - 25);
    emit(r, 'pit');
  }
}

function useSpecial(r) {
  r.special = 0;
  r.specialTime = r.racer.duration;
  if (r.racer.id === 'pup') r.hp = Math.min(100, r.hp + 40);
  if (r.racer.id === 'lime') { r.shield = 3; r.air = 0.85; }
  if (r.racer.id === 'sky') r.air = r.specialTime;
  if (r.racer.id === 'comet') r.turbo = 1.7;
  if (r.racer.id === 'knuckles') {
    r.punchTick = r.tick;
    r.punchIndex = 0;
    r.shield = Math.max(r.shield, 0.9);
  }
  if (r.racer.id === 'bat') for (const rival of r.rivals) {
    if (Math.abs(rival.distance - r.distance) < 155) rival.hit = 2.2;
  }
  emit(r, 'special');
}

const PUNCH_RADII = [64, 91, 120];

function punch(r) {
  if (r.punchTick !== r.tick) return;
  const index = r.punchIndex++;
  const radius = PUNCH_RADII[index];
  r.punchTick = index < PUNCH_RADII.length - 1 ? r.tick + 16 : 0;
  const lapLength = r.circuit.length;
  const nearLap = Math.max(0, Math.floor((r.distance - radius) / lapLength));
  const farLap = Math.min(r.circuit.laps - 1, Math.floor((r.distance + radius) / lapLength));
  for (let lap = nearLap; lap <= farLap; lap++) {
    for (const object of r.objects) {
      const ahead = object.s + lap * lapLength - r.distance;
      if (object.used >= lap || ahead < -20 || ahead > radius || !PROPS[object.kind].damage) continue;
      if (Math.hypot(ahead, object.offset - r.offset) <= radius) breakProp(r, object, lap, true);
    }
  }
  for (const rival of r.rivals) {
    if (rival.finishTick === undefined && Math.hypot(rival.distance - r.distance, rival.offset - r.offset) <= radius) {
      rival.hit = Math.max(rival.hit, 1.25 + index * 0.18);
    }
  }
  emit(r, 'punch', { distance: r.distance, offset: r.offset, radius, index });
}

function collect(r, object, lap) {
  object.used = lap;
  if (object.kind === 'cell') { r.nitro += 34; r.special += 17; }
  if (object.kind === 'repair') r.hp = Math.min(100, r.hp + 37);
  if (object.kind === 'shield') r.shield = 4.5;
  if (object.kind === 'pad') { r.turbo = 1.25; r.nitro += 10; }
  if (object.kind === 'ramp') { r.air = Math.max(r.air, 1.22); r.turbo = Math.max(r.turbo, 0.55); }
  if (object.kind === 'ring') { r.rings++; r.points += 280; r.special += 23; r.nitro += 20; }
  emit(r, 'pickup', { object });
}

function interact(r, previousDistance, previousOffset) {
  const firstLap = Math.max(0, Math.floor((previousDistance - 55) / r.circuit.length));
  const lastLap = Math.min(r.circuit.laps - 1, Math.floor((r.distance + 155) / r.circuit.length));
  for (let lap = firstLap; lap <= lastLap; lap++) {
    for (const object of r.objects) {
      if (object.used >= lap) continue;
      const prop = PROPS[object.kind];
      const d = object.s + lap * r.circuit.length - r.distance;
      if (d < -70 || d > 170) continue;
      const lateral = Math.abs(object.offset - r.offset);
      const solid = Boolean(prop.damage);
      const active = r.specialTime > 0;
      const radius = prop.radius + 10;
      const specialHits = active && solid && d > -18 && d <= r.racer.reach && lateral <= r.racer.lane + prop.radius
        && !['sky','jade','knuckles'].includes(r.racer.id);
      const shotHits = r.shot > 0 && solid && d > -6 && d < (1 - r.shot / 0.28) * 112 && lateral < 12 + prop.radius;
      if (specialHits || shotHits) {
        breakProp(r, object, lap, true);
        if (shotHits) r.shot = 0;
        continue;
      }
      const passed = d <= 4 && d >= previousDistance - r.distance - 4;
      const at = mix(previousOffset, r.offset, clamp(1 + d / Math.max(0.01, r.distance - previousDistance), 0, 1));
      const magnet = active && r.racer.id === 'jade' && ['cell','repair','shield'].includes(object.kind) && d >= 0 && d < r.racer.reach;
      if (!magnet && (!passed || Math.abs(object.offset - at) > radius)) continue;
      if (object.kind === 'ring' && r.air <= 0) continue;
      if (object.kind !== 'ring' && r.air > 0 && !magnet && (solid || ['oil','ramp'].includes(object.kind))) continue;
      if (solid) {
        const powered = r.nitroFiring || r.turbo > 0 || r.shield > 0;
        breakProp(r, object, lap, powered);
        if (!powered) damage(r, prop.damage);
      } else if (object.kind === 'oil') {
        object.used = lap;
        if (r.shield <= 0) r.slick = 0.85;
        emit(r, 'oil', { object });
      } else collect(r, object, lap);
    }
  }
}

export function position(r) {
  return 1 + r.rivals.filter(v => (v.finishTick ?? Infinity) < (r.finishTick ?? Infinity)
    || (v.finishTick === undefined && !r.finished && v.distance > r.distance)).length;
}

export function step(r, input) {
  if (r.finished) return;
  r.events.length = 0;
  r.tick++;
  const pressed = input & ~r.input;
  r.input = input;
  for (const key of ['specialTime','boostTime','turbo','shield','air','hit','recover','slick','jumpWait','fireWait','shot','comboTime']) {
    r[key] = Math.max(0, r[key] - STEP);
  }
  if (!r.comboTime) r.combo = 0;
  const steering = Number(Boolean(input & INPUT.right)) - Number(Boolean(input & INPUT.left));
  const width = r.circuit.width;
  const motion = Math.min(1, r.speed / 160);
  r.drifting = Boolean(steering && (input & INPUT.drift) && r.speed > 100 && r.air <= 0);
  if ((pressed & INPUT.special) && r.special >= 99.9) useSpecial(r);
  if ((pressed & INPUT.jump) && r.jumpWait <= 0 && r.air <= 0) {
    r.air = 0.66;
    r.jumpWait = 1.55;
    emit(r, 'jump');
  }
  if (input & INPUT.fire && r.fireWait <= 0) {
    r.fireWait = 0.78;
    r.shot = 0.28;
    emit(r, 'fire');
  }

  r.nitroFiring = Boolean(input & INPUT.boost) && r.nitro >= (r.boostTime > 0 ? 0.37 : 4) && r.recover <= 0;
  if (r.nitroFiring) {
    r.nitro -= 23 * STEP;
    if (r.boostTime <= 0) emit(r, 'boost');
    r.boostTime = 0.12;
  }
  const prior = r.distance;
  const beforeOffset = r.offset;
  const angle = pointAt(r.circuit, prior).angle;
  const ahead = pointAt(r.circuit, prior + 32).angle;
  const bend = Math.atan2(Math.sin(ahead - angle), Math.cos(ahead - angle));
  const assist = r.mode === 'crew' ? 0.43 : 1;
  const slip = r.slick > 0 ? 0.4 : 1;
  const responsiveness = (r.drifting ? 3.6 : 8.8) * r.racer.grip * slip;
  const targetSide = steering * (r.drifting ? 158 : 125) * r.racer.grip * (0.62 + 0.38 * motion)
    - bend * r.speed * 0.45 * assist - (steering === 0 && r.mode === 'crew' ? r.offset * 0.7 : 0);
  r.side = mix(r.side, targetSide, STEP * responsiveness);
  r.offset += r.side * STEP;
  const out = Math.abs(r.offset) > width - 11;
  if (Math.abs(r.offset) > width + 12) {
    r.offset = Math.sign(r.offset) * (width + 12);
    if (Math.abs(r.side) > 38) damage(r, 12);
    r.side *= -0.23;
  }
  if (out && r.air <= 0) r.speed *= 1 - STEP * 1.7;
  if (r.drifting && !out) { r.nitro += 16 * STEP; r.special += 9 * STEP; }
  const target = r.recover > 0 ? 81 : r.racer.speed + (r.nitroFiring ? 95 : 0) + (r.turbo > 0 ? 64 : 0)
    + (r.racer.id === 'sky' && r.specialTime > 0 ? 49 : 0) - (input & INPUT.drift ? 29 : 0) - (out ? 23 : 0);
  r.speed = mix(r.speed, target, STEP * (target > r.speed ? 1.65 : 3.2));
  r.distance += r.speed * STEP * clamp(1 - bend * r.offset / 32, 0.74, 1.23);
  r.nitro = clamp(r.nitro + 2.3 * STEP, 0, 100);
  r.special = clamp(r.special + 4.3 * STEP, 0, 100);
  punch(r);
  interact(r, prior, beforeOffset);
  r.nitro = clamp(r.nitro, 0, 100);
  r.special = clamp(r.special, 0, 100);

  const finish = r.circuit.length * r.circuit.laps;
  for (let i = 0; i < r.rivals.length; i++) {
    const v = r.rivals[i];
    if (v.finishTick !== undefined) continue;
    v.hit = Math.max(0, v.hit - STEP);
    v.offset = v.lane + 22 * Math.sin(v.distance / (177 + i * 29) + i * 2.4);
    if (r.air <= 0 && Math.abs(v.distance - r.distance) < 16 && Math.abs(v.offset - r.offset) < 23 && r.recover <= 0) {
      if (r.nitroFiring || r.turbo > 0 || r.shield > 0 || (r.racer.id === 'rex' && r.specialTime > 0)) {
        if (v.hit <= 0) { v.hit = 0.95; emit(r, 'pass'); }
      } else {
        if (r.mode === 'pro') damage(r, 7);
        r.side += (r.offset >= v.offset ? 1 : -1) * 14;
      }
    }
    const pace = (r.mode === 'pro' ? 211 : 174) - i * 5 + 12 * Math.sin(v.distance / 180 + i) - (v.hit > 0 ? 65 : 0);
    v.distance += pace * STEP * Math.min(1, 0.55 + r.tick / 90);
    if (v.distance >= finish) {
      v.distance = finish;
      v.finishTick = r.tick;
    }
  }
  if (Math.floor(prior / r.circuit.length) < Math.floor(r.distance / r.circuit.length) && r.distance < finish) emit(r, 'lap');
  if (r.distance >= finish || r.tick >= MAX_TICKS) {
    r.timeout = r.distance < finish;
    r.finishTick = r.tick;
    r.finished = true;
    r.distance = Math.min(r.distance, finish);
    emit(r, 'finish');
  }
}

export function result(r) {
  const time = Math.round(r.tick * 1000 / 60);
  const place = position(r);
  const racePoints = r.timeout ? 0 : [0,4000,3100,2300,1550,850][place];
  const timePoints = r.timeout ? 0 : Math.max(0, Math.round((r.circuit.length * r.circuit.laps / 154 - time / 1000) * 100));
  const clean = r.timeout ? 0 : Math.round(r.hp * 8);
  return {
    time, place, smash: r.smash, combo: r.bestCombo, rings: r.rings, pits: r.pitStops,
    smashPoints: r.points, racePoints, timePoints, clean, timeout: r.timeout,
    score: Math.max(0, r.points + racePoints + timePoints + clean - r.pitStops * 500),
  };
}
