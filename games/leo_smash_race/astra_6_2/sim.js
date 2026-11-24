export const DT = 1 / 60;
export const RAIL = 193;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export const DRIVERS = [
  { id: 'golem', name: 'Crystal Golem', power: 'Geode Break', color: '#cda3ff', speed: 276, grip: 1.02, art: 'art/golem-top.webp', portrait: 'art/golem-hero.webp', hint: 'Punch the table. Three crystal forks split across the track.' },
  { id: 'rex', name: 'Dino Rex', power: 'Chomp Rush', color: '#65f2be', speed: 286, grip: .94, art: '../sol/art/rex.webp', portrait: '../grokbot/art/vehicles/rex_special.webp', hint: 'Open wide and charge. Crates and rivals feed your rush.' },
  { id: 'knuckles', name: 'Knuckles', power: 'Triple Slam', color: '#ff756b', speed: 280, grip: 1.13, art: '../sol/art/knuckles.webp', portrait: '../sol/art/knuckles-garage.webp', hint: 'Drop three expanding shockwaves as you drive through the pack.' },
];
export const TABLES = [
  { id: 'mine', name: 'Amethyst Mine', tag: 'Crystal vaults', color: '#c998ff', dark: '#1b0d30', floor: '#32204b', rail: '#a17ae2', seed: 181, length: 13200, grip: 1 },
  { id: 'pier', name: 'Sunset Pier', tag: 'Bumper alleys', color: '#ffae69', dark: '#281020', floor: '#4b2938', rail: '#f88357', seed: 258, length: 13900, grip: 1.06 },
  { id: 'ice', name: 'Aurora Run', tag: 'Ice drift', color: '#65ecd8', dark: '#09242b', floor: '#163c49', rail: '#4cc9bf', seed: 399, length: 14700, grip: .68 },
];
const LANES = [-125, 0, 125];
function random(seed) {
  let state = seed;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function layout(table) {
  const rng = random(table.seed), objects = [];
  const put = (kind, x, s) => objects.push({ kind, x, s, done: false });
  let bank = 0;
  for (let s = 390; s < table.length - 360; s += 310, bank++) {
    const lane = bank === 0 ? 1 : Math.floor(rng() * 3);
    const x = LANES[lane], next = LANES[(lane + 1) % 3];
    if (bank % 10 === 8) { put('vault', 0, s); continue; }
    if (bank % 10 === 1 || bank % 10 === 4 || bank % 10 === 6) put('key', x, s);
    else if (bank % 4 === 2) put('pad', x, s);
    else put('crate', x, s);
    if (bank % 3 === 0 || table.id === 'pier' && bank % 3 === 1) put('bumper',next, s+85);
    else put('crate', next, s+68);
    for (let j = 0; j < (table.id === 'mine' ? 4 : 3); j++) {
      put('gem', x + (next-x)*j/4, s+117+j*36);
    }
  }
  return objects.sort((a,b) => a.s-b.s);
}
export function start(driverId='golem', tableId='mine', assist=true) {
  const driver = DRIVERS.find(d => d.id === driverId) || DRIVERS[0];
  const table = TABLES.find(t => t.id === tableId) || TABLES[0];
  return { driver, table, assist, objects: layout(table), first: 0, x: 0, vx: 0, s: 0, speed: driver.speed*.72,
    aim: 1, time: 0, pin: 0, pinWait: 0, rush: 0, powerTime: 0, pulse: 0, energy: 100, combo: 0, chainTime: 0,
    score: 0, smashes: 0, banks: 0, keys: 0, vaults: 0, bestCombo: 0, finished: false, place: 3, events: [],
    rivals: ['comet','bat'].map((id,i)=>({id, x: i ? 112 : -108, s: i ? 56 : 108, vx:0, hit: 0, touch: 0, seed:i+1, finishTime:null})),
  };
}
function event(r, kind, x=r.x, s=r.s, detail={}) { r.events.push({kind,x,s,...detail}); }
function points(r, base) {
  r.combo = Math.min(8, r.chainTime > 0 ? r.combo+1 : 1);
  r.chainTime = 2.05;
  r.bestCombo = Math.max(r.bestCombo,r.combo);
  const value = base * r.combo;
  r.score += value;
  return value;
}
function smash(r, o) {
  o.done = true; r.smashes++;
  const gain = points(r, 45);
  r.energy = Math.min(100, r.energy+9);
  event(r, 'smash', o.x, o.s, {gain});
}
function stun(r, rival) {
  if (rival.hit > 0 || rival.finishTime !== null) return;
  rival.hit = 1.22;
  r.score += 65; event(r,'overtake',rival.x,rival.s);
}
function usePower(r) {
  r.energy = 0; r.pulse = 0;
  r.powerTime = r.driver.id === 'rex' ? 2.2 : 1.04;
  if (r.driver.id === 'rex') r.rush = 2.2;
  event(r,'power');
}
function pulse(r) {
  if (r.driver.id === 'rex' || r.pulse >= 3) return;
  if (1.04-r.powerTime + .0001 < r.pulse*.31) return;
  const fork = r.driver.id === 'golem', n = r.pulse++;
  const x = r.x, s = r.s;
  const reach = fork ? 135+n*47 : 78+n*28, spread = fork ? 48+n*14 : reach;
  const hits = o => {
    const ahead = o.s-s, side = Math.abs(o.x-x);
    return fork ? ahead >= -15 && ahead < reach && (side < 32 || Math.abs(side-ahead*.52) < spread*.68)
      : Math.hypot(side,ahead) < reach;
  };
  for (let i=r.first;i<r.objects.length && r.objects[i].s<=s+reach;i++) {
    const o = r.objects[i];
    if (!o.done && o.kind === 'crate' && hits(o)) smash(r,o);
  }
  for (const v of r.rivals) if (hits(v)) stun(r,v);
  event(r,fork ? 'fork' : 'slam',x,s,{reach});
}
function collide(r, o) {
  const dx = r.x-o.x;
  if (o.kind === 'gem' || o.kind === 'key') {
    o.done=true; r.score+=o.kind==='key' ? 100 : 15;
    r.energy = Math.min(100, r.energy + (o.kind==='key' ? 10 : 3));
    if (o.kind === 'key') r.keys = Math.min(3, r.keys+1);
    event(r,o.kind,o.x,o.s);
  } else if (o.kind === 'crate') {
    smash(r,o);
    if (r.driver.id==='rex' && r.powerTime>0) r.rush=Math.max(r.rush,.65);
  } else if (o.kind === 'bumper') {
    o.done=true; r.banks++; points(r,70); r.rush=Math.max(r.rush,.72); r.pin=.63;
    const dir = Math.abs(dx)>7 ? Math.sign(dx) : (o.x>0 ? -1 : 1);
    r.aim=dir; r.vx=dir*530; r.energy=Math.min(100,r.energy+12); event(r,'bumper',o.x,o.s);
  } else if (o.kind === 'pad') {
    o.done=true; r.rush=Math.max(r.rush,1.35); event(r,'pad',o.x,o.s);
  } else if (o.kind === 'vault') {
    o.done=true;
    if (r.keys===3) {
      r.keys=0; r.vaults++; r.score+=1000; r.energy=100; r.rush=1.6; event(r,'jackpot',o.x,o.s);
    } else event(r,'locked',o.x,o.s);
  }
}
export function step(r, controls={}) {
  r.events.length=0;
  if (r.finished) return;
  r.time+=DT;
  for (const k of ['rush','pin','pinWait','powerTime','chainTime']) r[k]=Math.max(0,r[k]-DT);
  if (!r.chainTime) r.combo=0;
  const steer = clamp(controls.steer || 0,-1,1);
  if (steer) r.aim=Math.sign(steer);
  if (controls.pin && r.pinWait===0) {
    r.pin=.87; r.pinWait=1.35; r.vx=r.aim*580; r.rush=Math.max(r.rush,.65); event(r,'pin');
  }
  if (controls.power && r.energy>=99.99 && !r.powerTime) usePower(r);
  if (r.powerTime) pulse(r);
  let assistX=0;
  if (!steer && !r.pin && r.assist) {
    for (let i=r.first;i<r.objects.length;i++) {
      const o=r.objects[i], gap=o.s-r.s;
      if (gap>170) break;
      if (!o.done && gap>0 && Math.abs(o.x-r.x)<96 && (o.kind==='key'||o.kind==='crate'||(o.kind==='vault' && r.keys===3))) {
        assistX=clamp((o.x-r.x)*3,-145,145); break;
      }
    }
  }
  if (r.pin>0) r.vx+=(steer*110-r.vx*.45)*DT;
  else r.vx+=((steer*330+assistX)-r.vx)*DT*9*r.driver.grip*r.table.grip;
  r.x+=r.vx*DT;
  if (Math.abs(r.x)>=RAIL) {
    const wall=Math.sign(r.x); r.x=wall*RAIL;
    if (r.pin>0 && r.vx*wall>80) {
      r.vx=-wall*Math.max(420,Math.abs(r.vx)*.9); r.aim=-wall; r.banks++;
      r.score+=75*Math.max(1,r.combo); r.energy=Math.min(100,r.energy+7);
      r.rush=Math.max(.6,r.rush); event(r,'bank');
    } else if (r.vx*wall>0) r.vx=0;
  }
  const oldS=r.s;
  r.speed+=((r.driver.speed+(r.rush>0 ? 125 : 0))-r.speed)*DT*3.5;
  r.s+=r.speed*DT;
  r.energy=Math.min(100,r.energy+DT*3.2);
  while (r.first<r.objects.length && r.objects[r.first].s<oldS-115) r.first++;
  for (let i=r.first;i<r.objects.length;i++) {
    const o=r.objects[i], gap=o.s-r.s;
    if (gap>72) break;
    if (o.done) continue;
    const bite=r.powerTime>0 && r.driver.id==='rex' && o.kind==='crate';
    const radius = o.kind==='gem' ? 25 : o.kind==='bumper' ? 34 : o.kind==='vault' ? 54 : 32;
    if (Math.abs(gap)<radius+(bite ? 36 : 0) && Math.abs(o.x-r.x)<radius+(bite ? 48 : 7)) collide(r,o);
  }
  for (const rival of r.rivals) {
    if (rival.finishTime!==null) continue;
    rival.hit=Math.max(0,rival.hit-DT); rival.touch=Math.max(0,rival.touch-DT);
    rival.x=126*Math.sin(rival.s/(280+rival.seed*41)+rival.seed*2);
    const previousS=rival.s;
    rival.s+=DT*(r.driver.speed + (rival.seed===1 ? 20 : 7) + 19*Math.sin(r.time*.76+rival.seed) - (rival.hit>0 ? 114 : 0));
    if (Math.abs(rival.s-r.s)<33 && Math.abs(rival.x-r.x)<44 && !rival.touch) {
      rival.touch=1;
      if (r.pin||r.powerTime||r.rush) stun(r,rival);
      else { r.vx+=r.x>=rival.x ? 72 : -72; event(r,'tap',rival.x,rival.s); }
    }
    if (rival.s>=r.table.length) {
      rival.finishTime=r.time-(rival.s-r.table.length)/Math.max(1,(rival.s-previousS)/DT);
      rival.s=r.table.length;
    }
  }
  r.place=1+r.rivals.filter(v=>v.finishTime!==null || v.s>r.s).length;
  if (r.s>=r.table.length) {
    r.time-= (r.s-r.table.length)/r.speed;
    r.s=r.table.length; r.finished=true;
    r.place=1+r.rivals.filter(v=>v.finishTime!==null && v.finishTime<r.time).length;
    r.score += [0,1500,950,600][r.place]; event(r,'finish');
  }
}
