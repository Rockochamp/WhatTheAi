import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const SIM = require("../games/leo_smash_race/grokbot/sim.js");
const CUBE = require("../games/leo_smash_race/grokbot/cube.js");

function play(opts, policy) {
  const R = SIM.createRace(opts); let n = 0;
  while (!R.finished && n < 200000) { const i = policy ? policy(R, n) : { jump: false, jumpPressed: false, boostPressed: false, lane: 0 }; SIM.step(R, SIM.STEP, i); R.events.length = 0; n++; }
  return R;
}

test("every hero finishes every track in about 90 seconds, never last", () => {
  for (const v of SIM.VEHICLE_ORDER) for (const t of SIM.TRACKS) {
    const R = play({ vehicle: v, track: t.id, seed: 11, assist: false });
    assert.ok(R.finished, `${v} ${t.id} finished`);
    assert.ok(R.finT > 75 && R.finT < 100, `${v} ${t.id} time ${R.finT}`);
    assert.ok(R.place >= 1 && R.place <= 3, "always on the podium");
    assert.ok(R.award >= 1 && R.award <= 3, "at least one award star");
  }
});

test("no-fail: hands-off play still smashes things (assist) and boosting earns 1st", () => {
  const idle = play({ vehicle: "truck", track: "desert", seed: 3, assist: true });
  assert.ok(idle.smashes > 20, `assist smashes ${idle.smashes}`);
  const boosted = play({ vehicle: "truck", track: "desert", seed: 3, assist: true, fullBoost: true }, (R, n) => ({ jump: n % 600 < 80, jumpPressed: n % 600 === 0, boostPressed: n % 1200 === 7, lane: 0 }));
  assert.equal(boosted.place, 1);
  assert.ok(boosted.score > idle.score);
});

test("combo multiplier chains within 1.5 s and caps at x5", () => {
  const R = SIM.createRace({ vehicle: "dragster", track: "toyroom", seed: 1, countdown: 0 });
  const cones = R.tr.objs.filter(o => o.kind === "cone").slice(0, 7);
  cones.forEach((o, i) => { R.t = i * 0.5; SIM.smashGroup(R, o, "ram"); });
  assert.equal(R.mult, 5); assert.equal(R.bestMult, 5);
  R.t += 2; SIM.smashGroup(R, R.tr.objs.find(o => o.alive && o.lead), "ram"); assert.equal(R.mult, 1);
});

test("flying: holding jump climbs, releasing glides down slowly, ceiling holds", () => {
  const R = SIM.createRace({ vehicle: "sword", track: "castle", seed: 2, countdown: 0 });
  for (let i = 0; i < 240; i++) SIM.step(R, SIM.STEP, { jump: true, jumpPressed: i === 0, boostPressed: false, lane: 0 });
  assert.ok(R.p.z > 300, `climbed to ${R.p.z}`);
  for (let i = 0; i < 600; i++) SIM.step(R, SIM.STEP, { jump: true, jumpPressed: false, boostPressed: false, lane: 0 });
  assert.ok(R.p.z <= SIM.MAXZ + 1);
  for (let i = 0; i < 60; i++) SIM.step(R, SIM.STEP, { jump: false, jumpPressed: false, boostPressed: false, lane: 0 });
  assert.ok(R.p.vz >= SIM.VEHICLES.sword.glide - 1, "glide speed limited");
});

test("2x2 cube: scrambles are 1-3 twists, Help always solves it", () => {
  for (let i = 0; i < 300; i++) {
    const p = CUBE.newPuzzle(1 + (i % 3));
    assert.equal(CUBE.isSolved(p.cube), false);
    const names = CUBE.movesFor(2);
    for (let k = 0; k < i % 5; k++) CUBE.play(p, CUBE.MOVES[names[(k * 3 + i) % names.length]]);
    let guard = 0; while (!CUBE.isSolved(p.cube) && guard++ < 50) CUBE.play(p, CUBE.MOVES[CUBE.hint(p)]);
    assert.ok(CUBE.isSolved(p.cube));
  }
});

test("3x3 Pro cube: real shuffle, Help still solves it", () => {
  const p = CUBE.newPuzzle(20, null, 3);
  assert.equal(p.cube.cubies.length, 26);
  let guard = 0; while (!CUBE.isSolved(p.cube) && guard++ < 200) CUBE.play(p, CUBE.MOVES[CUBE.hint(p)]);
  assert.ok(CUBE.isSolved(p.cube));
});

/* ---- Addendum B: Whirly Pup and Chomp Rex ---- */
const go = (R, n, inp) => { for (let i = 0; i < n; i++) SIM.step(R, SIM.STEP, Object.assign({ jump: false, jumpPressed: false, boostPressed: false, lane: 0 }, inp && inp(i))); };

test("10 heroes, new ones last, original five unchanged", () => {
  assert.deepEqual(SIM.VEHICLE_ORDER, ["dragster", "bibi", "truck", "sword", "jet", "pup", "rex", "comet", "laser", "ira"]);
  const V = SIM.VEHICLES;
  assert.deepEqual([V.dragster.speed, V.bibi.speed, V.truck.speed, V.sword.speed, V.jet.speed], [640, 440, 520, 560, 540]);
  for (const id of ["dragster", "bibi", "truck", "sword", "jet"]) { assert.equal(V[id].laneT, undefined); assert.equal(V[id].accelT, undefined); assert.equal(V[id].superMult, undefined); }
  const pup = V.pup, rex = V.rex;
  assert.equal(pup.name, "Whirly Pup"); assert.equal(pup.special, "whirl"); assert.equal(pup.fly, "wings");
  assert.equal(pup.speed, 600); assert.equal(pup.grav, 1300); assert.equal(pup.bounce, 0.5); assert.equal(pup.glide, -150); assert.equal(pup.laneT, 0.12); assert.equal(pup.superMult, 1.4);
  assert.deepEqual(pup.stats, { speed: 2, smash: 1, fly: 3 });
  assert.ok(Math.abs(pup.len / V.bibi.len - 0.7) < 0.02 && Math.abs(pup.h / V.bibi.h - 0.7) < 0.02, "pup hitbox ~70% of Bibi");
  assert.equal(rex.name, "Chomp Rex"); assert.equal(rex.special, "chomp"); assert.equal(rex.fly, "wings");
  assert.equal(rex.speed, 500); assert.equal(rex.grav, 1900); assert.equal(rex.bounce, 0.45); assert.equal(rex.laneT, 0.22); assert.equal(rex.accelT, 1.0);
  assert.equal(rex.maxUp, 380); assert.equal(rex.glide, -320); assert.equal(rex.superMult, 1.3); assert.ok(rex.flatten);
  assert.deepEqual(rex.stats, { speed: 2, smash: 3, fly: 1 });
  // B3 feel ranking: speed Dragster > Pup > Sword/Patroller > Bat Truck > Rex > Bibi; Rex is the heaviest, Pup the lightest of the ground heroes
  assert.ok(V.dragster.speed > pup.speed && pup.speed > V.sword.speed && V.truck.speed > rex.speed && rex.speed > V.bibi.speed);
  assert.ok(rex.grav > V.truck.grav && pup.grav < Math.min(V.dragster.grav, V.bibi.grav, V.truck.grav));
  // no brand names anywhere in the new heroes
  const txt = JSON.stringify([pup, rex]).toLowerCase();
  for (const bad of ["skye", "paw", "patrol", "wrex", "hot wheels", "mattel", "spin master"]) assert.ok(!txt.includes(bad), bad);
});

test("feel: Pup changes lanes fastest, Rex slowest and builds speed over ~1 s", () => {
  const laneTime = v => { const R = SIM.createRace({ vehicle: v, track: "toyroom", seed: 5, countdown: 0, assist: false }); let n = 0; go(R, 1, () => ({ lane: 1 })); while (Math.abs(R.p.laneF - 2) > 1e-6 && n < 500) { go(R, 1); n++; } return (n + 1) * SIM.STEP; };
  const tp = laneTime("pup"), td = laneTime("dragster"), tr = laneTime("rex");
  assert.ok(tp < td && td < tr, `lane change pup ${tp} dragster ${td} rex ${tr}`);
  assert.ok(Math.abs(tp - 0.12) < 0.02 && Math.abs(tr - 0.22) < 0.02);
  const reach = v => { const R = SIM.createRace({ vehicle: v, track: "toyroom", seed: 5, countdown: 0, assist: false }); let n = 0; while (R.p.speed < R.veh.speed - 1 && n < 1000) { go(R, 1); n++; } return n * SIM.STEP; };
  const rr = reach("rex"), rt = reach("truck");
  assert.ok(rr > 0.9 && rr < 1.1, `rex reaches cruise in ${rr}s`); assert.ok(rt < 0.8, `truck ${rt}s`);
});

test("Whirlwind Spin: pulls smashables from all 3 lanes within ~260 ahead, orbits them, flings them out, magnets stars", () => {
  const R = SIM.createRace({ vehicle: "pup", track: "toyroom", seed: 4, countdown: 0, assist: false, fullBoost: true });
  go(R, 120); // up to speed
  const P = R.p, x = P.x;
  R.tr.objs.forEach(o => { if (o.x > x - 300 && o.x < x + 1500) o.alive = false; });
  const mk = (dx, lane, kind) => { const k = SIM.KINDS[kind]; const o = { kind, x: x + dx, lane, z: 0, w: k.w, h: k.h, alive: true, pts: k.pts, group: 9000 + lane * 10 + dx, lead: true }; R.tr.objs.push(o); return o; };
  const a = mk(200, 0, "crate"), b = mk(240, 2, "cone"), c = mk(150, 1, "box"), far = mk(900, 0, "crate");
  const st = { kind: "star", x: x + 230, lane: 2, z: 0, w: 50, h: 50, alive: true, star: true }; R.tr.objs.push(st);
  R.tr.objs.sort((p, q) => p.x - q.x); R.idx = 0;
  let pulls = 0, smashes = [], orbitLanes = new Set(), stars0 = R.stars;
  go(R, 1, () => ({ boostPressed: true }));
  assert.equal(R.events.find(e => e.type === "super").special, "whirl");
  assert.ok(Math.abs(P.boostMult - 1.4) < 1e-9, "x1.4 speed");
  for (let i = 0; i < 120; i++) { go(R, 1); for (const e of R.events) { if (e.type === "pull") pulls++; if (e.type === "smash" && e.first) smashes.push(e); } R.events.length = 0; if (a.cap && a.alive) orbitLanes.add(Math.round(a.lane * 4)); }
  assert.ok(pulls >= 3, `pulled ${pulls}`);
  for (const o of [a, b, c]) assert.equal(o.alive, false);
  assert.ok(orbitLanes.size >= 3, "captured crate orbits around her (lane/depth changes)");
  assert.ok(smashes.every(e => e.how === "whirl"));
  assert.equal(st.alive, false); assert.ok(R.stars > stars0, "star vacuumed in from another lane");
  assert.equal(far.alive, true, "out of reach stays");
  go(R, 600); assert.ok(R.p.superT <= 0 && R.captured.length === 0);
});

test("Whirlwind Spin with reduced motion: straight pull, no orbit", () => {
  const R = SIM.createRace({ vehicle: "pup", track: "toyroom", seed: 4, countdown: 0, assist: false, fullBoost: true, reduced: true });
  go(R, 120); const x = R.p.x;
  R.tr.objs.forEach(o => { if (o.x > x - 300 && o.x < x + 1500) o.alive = false; });
  const o = { kind: "crate", x: x + 220, lane: 0, z: 0, w: 84, h: 84, alive: true, pts: 50, group: 77777, lead: true }; R.tr.objs.push(o); R.tr.objs.sort((p, q) => p.x - q.x); R.idx = 0;
  go(R, 1, () => ({ boostPressed: true })); let prev = o.lane, mono = true;
  for (let i = 0; i < 100 && o.alive; i++) { go(R, 1); if (o.lane < prev - 1e-9) mono = false; prev = o.lane; }
  assert.equal(o.alive, false); assert.ok(mono, "lane moves straight toward her");
});

test("Shark Chomp: eats everything in its lane one bite at a time, combo per bite, hops lanes with assist, burps what it ate", () => {
  const R = SIM.createRace({ vehicle: "rex", track: "desert", seed: 6, countdown: 0, assist: true, fullBoost: true });
  go(R, 150); const P = R.p, x = P.x;
  R.tr.objs.forEach(o => { if (o.x > x - 300 && o.x < x + 3000) o.alive = false; });
  const lane = P.lane, other = lane === 0 ? 2 : 0, add = [];
  for (let i = 0; i < 4; i++) add.push({ kind: "crate", x: x + 260, lane, z: i * 81, w: 84, h: 84, alive: true, pts: i === 0 ? 50 : 0, group: 55555, lead: i === 0, tier: i });
  const cluster = []; for (let i = 0; i < 6; i++) cluster.push({ kind: "cone", x: x + 900 + i * 70, lane: other, z: 0, w: 60, h: 66, alive: true, pts: 10, group: 66000 + i, lead: true });
  const st = { kind: "star", x: x + 400, lane, z: 0, w: 50, h: 50, alive: true, star: true };
  R.tr.objs.push(...add, ...cluster, st); R.tr.objs.sort((p, q) => p.x - q.x); R.idx = 0;
  go(R, 1, () => ({ boostPressed: true }));
  assert.ok(Math.abs(P.boostMult - 1.3) < 1e-9, "x1.3 speed");
  const chomps = [], burps = [], hops = []; const stars0 = R.stars;
  for (let i = 0; i < 520; i++) { go(R, 1); for (const e of R.events) { if (e.type === "chomp") chomps.push(e); if (e.type === "burp") burps.push(e); if (e.type === "hop") hops.push(e); } R.events.length = 0; }
  const towerBites = chomps.filter(e => e.o.group === 55555);
  assert.equal(towerBites.length, 4, "tower eaten in 4 bites");
  assert.deepEqual(towerBites.map(e => e.o.tier), [0, 1, 2, 3], "bottom-up");
  for (let i = 1; i < towerBites.length; i++) assert.ok(towerBites[i].mult >= towerBites[i - 1].mult, "each bite adds to the combo");
  assert.ok(towerBites[3].mult >= 4);
  assert.equal(st.alive, false); assert.ok(R.stars > stars0, "star eaten counts as collected");
  assert.ok(hops.length >= 1, "hopped toward the cluster"); assert.ok(cluster.filter(o => !o.alive).length >= 4, "ate most of the cluster");
  assert.equal(burps.length, 1); assert.ok(burps[0].bag.includes("crate") && burps[0].bag.includes("cone") && burps[0].bag.includes("star"));
});

test("Chomp Rex flattens smashables on a normal ram; existing heroes still ram", () => {
  for (const [v, how] of [["rex", "flatten"], ["truck", "ram"]]) {
    const R = SIM.createRace({ vehicle: v, track: "toyroom", seed: 8, countdown: 0, assist: false });
    go(R, 200); const x = R.p.x; R.tr.objs.forEach(o => { if (o.x > x - 300 && o.x < x + 1500) o.alive = false; });
    const o = { kind: "box", x: x + 200, lane: R.p.lane, z: 0, w: 76, h: 76, alive: true, pts: 10, group: 4242, lead: true }; R.tr.objs.push(o); R.tr.objs.sort((p, q) => p.x - q.x); R.idx = 0;
    const sp0 = R.p.speed; let ev = null; for (let i = 0; i < 120 && !ev; i++) { go(R, 1); ev = R.events.find(e => e.type === "smash"); R.events.length = 0; }
    assert.ok(ev && ev.how === how, `${v} ${ev && ev.how}`); assert.ok(R.p.speed >= sp0 - 1, "no slow-down bump");
  }
});

test("art: real pup/rex sprites wired in; boost -> special, celebrate -> fly (pup) / special (rex); original five keep drive", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/art/manifest.js", import.meta.url), "utf8");
  const win = {}; new Function("window", src)(win); const S = win.LEO_MANIFEST.sprites;
  assert.equal(S["veh.pup.boost"].alias, "veh.pup.special"); assert.equal(S["veh.rex.boost"].alias, "veh.rex.special");
  assert.equal(S["veh.pup.celebrate"].alias, "veh.pup.fly"); assert.equal(S["veh.rex.celebrate"].alias, "veh.rex.special");
  for (const p of ["drive", "fly", "special"]) { assert.equal(S[`veh.pup.${p}`].src, `vehicles/pup_${p}.webp`); assert.equal(S[`veh.rex.${p}`].src, `vehicles/rex_${p}.webp`);
    assert.ok(fs.existsSync(new URL(`../games/leo_smash_race/grokbot/art/vehicles/pup_${p}.webp`, import.meta.url))); assert.ok(fs.existsSync(new URL(`../games/leo_smash_race/grokbot/art/vehicles/rex_${p}.webp`, import.meta.url)));
    assert.equal(S[`veh.rex.${p}`].wu, 280); assert.equal(S[`veh.pup.${p}`].wu, 215); }
  assert.ok(win.LEO_MANIFEST.version >= 5, "cache bust for the new art");
  for (const p of ["drive", "fly", "special"]) for (const id of ["pup", "rex"]) { const e = S[`veh.${id}.${p}`]; assert.ok(e, `${id}.${p}`); assert.deepEqual(e.size, [512, 256]); assert.deepEqual(e.anchor, [0.5, 0.92]); }
  for (const id of ["dragster", "bibi", "truck", "jet"]) assert.ok(/_drive\.webp$/.test(S[`veh.${id}.boost`].src));
  assert.equal(win.LEO_MANIFEST.poseAliases.boost, "drive");
});

/* ---- Addendum C: Comet 17 ---- */
function cometRace(opts) {
  const R = SIM.createRace(Object.assign({ vehicle: "comet", track: "toyroom", seed: 9, countdown: 0, assist: false, fullBoost: true }, opts));
  go(R, 150); const x = R.p.x; R.tr.objs.forEach(o => { if (o.x > x - 300 && o.x < x + 6000) o.alive = false; }); R.idx = 0; return R;
}
const put = (R, list) => { R.tr.objs.push(...list); R.tr.objs.sort((p, q) => p.x - q.x); R.idx = 0; };
const box = (x, lane, g) => ({ kind: "box", x, lane, z: 0, w: 76, h: 76, alive: true, pts: 10, group: g, lead: true });

test("Comet 17: stats and feel (fast, quick accel and lanes, light glider)", () => {
  const V = SIM.VEHICLES, c = V.comet;
  assert.equal(c.name, "Comet 17"); assert.equal(c.special, "comet"); assert.equal(c.specialName, "Comet Dash"); assert.equal(c.fly, "wings"); assert.equal(c.horn, "chirp");
  assert.equal(c.speed, 610); assert.equal(c.grav, 1650); assert.equal(c.bounce, 0.22); assert.equal(c.laneT, 0.13); assert.equal(c.accelT, 0.4);
  assert.equal(c.maxUp, 440); assert.equal(c.glide, -220); assert.equal(c.h, 66); assert.equal(c.len, 145); // hitbox = the visible car assert.equal(c.superMult, 1.6);
  assert.deepEqual(c.stats, { speed: 3, smash: 1, fly: 2 });
  assert.ok(V.dragster.speed > c.speed && c.speed > V.pup.speed, "between the Dragster and the Pup");
  const R = SIM.createRace({ vehicle: "comet", track: "toyroom", seed: 5, countdown: 0, assist: false }); let n = 0;
  while (R.p.speed < c.speed - 1 && n < 1000) { go(R, 1); n++; } assert.ok(Math.abs(n * SIM.STEP - 0.4) < 0.03, `top speed in ${n * SIM.STEP}s`);
  const L = SIM.createRace({ vehicle: "comet", track: "toyroom", seed: 5, countdown: 0, assist: false }); go(L, 1, () => ({ lane: 1 })); n = 0; while (Math.abs(L.p.laneF - 2) > 1e-6 && n < 500) { go(L, 1); n++; }
  assert.ok(Math.abs((n + 1) * SIM.STEP - 0.13) < 0.02, "lane change ~0.13 s");
  const txt = JSON.stringify(c).toLowerCase(); for (const bad of ["hot wheels", "mattel", "ferrari", "lamborghini", "mclaren"]) assert.ok(!txt.includes(bad), bad);
});

test("Comet Dash: lift + x1.6, lane burn, 4 auto meteor skips (180 over 3 lanes), final 260 over all lanes, pop-out back to normal", () => {
  const R = cometRace(), P = R.p, x = P.x, lane = P.lane, far = lane === 0 ? 2 : 0, near = lane === 1 ? 0 : 1;
  const ahead = box(x + 160, lane, 701);          // in the fireball's path
  const side = box(x + 2.7 * 980, near, 702);     // next lane, near an impact point later on
  const twoAway = box(x + 2.75 * 980, far, 703);   // two lanes away: only the final impact may reach it
  const st = { kind: "star", x: x + 1.8 * 980, lane: near, z: 0, w: 50, h: 50, alive: true, star: true };
  put(R, [ahead, side, twoAway, st]);
  go(R, 1, () => ({ boostPressed: true }));
  assert.equal(R.events.find(e => e.type === "super").special, "comet"); R.events.length = 0;
  assert.ok(Math.abs(P.boostMult - 1.6) < 1e-9, "x1.6 speed");
  const ev = []; let zAt03 = null, sp0 = null; const t0 = R.comet.t0;
  for (let i = 0; i < 3.7 * 120; i++) { go(R, 1); ev.push(...R.events.map(e => Object.assign({ at: R.t - t0 }, e))); R.events.length = 0;
    if (zAt03 == null && R.comet && R.t - t0 >= 0.3) zAt03 = P.z; if (R.comet && R.t - t0 > 0.5 && sp0 == null) sp0 = P.speed; }
  assert.ok(Math.abs(zAt03 - 60) < 2, `lifted to ${zAt03}`); assert.ok(sp0 > SIM.VEHICLES.comet.speed * 1.55, "rushing at ~x1.6");
  const burn = ev.find(e => e.type === "smash" && e.o === ahead); assert.ok(burn && burn.how === "burn", "lane burn");
  const imp = ev.filter(e => e.type === "impact");
  assert.equal(imp.length, 4, `impacts ${imp.map(e => e.at.toFixed(2))}`);
  assert.deepEqual(imp.map(e => e.final), [false, false, false, true]);
  imp.slice(0, 3).forEach((e, i) => { assert.ok(Math.abs(e.at - 0.9 * (i + 1)) < 0.02, `auto skip ${i} at ${e.at}`); assert.equal(e.r, 180); });
  assert.ok(Math.abs(imp[3].at - 3.2) < 0.02); assert.equal(imp[3].r, 260);
  assert.equal(side.alive, false); assert.equal(ev.find(e => e.type === "smash" && e.o === side).how, "comet");
  assert.equal(st.alive, false, "star in range collected");
  assert.ok(ev.some(e => e.type === "cometPop")); assert.ok(ev.some(e => e.type === "cometEnd"));
  assert.equal(R.comet, null); assert.ok(P.z <= 0.01);
  go(R, 120); assert.ok(Math.abs(P.speed - SIM.VEHICLES.comet.speed) < 1, "back to normal speed");
});

test("Comet Dash: skip impacts reach 1 lane each side, the final reaches all lanes", () => {
  const R = cometRace(), P = R.p; while (P.lane !== 0) go(R, 1, () => ({ lane: -1 })); go(R, 60);
  const x = P.x, sp = SIM.VEHICLES.comet.speed * 1.6, firstAt = x + sp * 0.9;
  const l2 = box(firstAt + 20, 2, 801), l1 = box(firstAt + 20, 1, 802);
  put(R, [l1, l2]); go(R, 1, () => ({ boostPressed: true }));
  const hits = []; for (let i = 0; i < 1.1 * 120; i++) { go(R, 1); for (const e of R.events) if (e.type === "smash") hits.push(e.o); R.events.length = 0; }
  assert.ok(hits.includes(l1), "neighbour lane smashed"); assert.ok(!hits.includes(l2), "two lanes away: not by a skip");
});

test("Comet Dash: JUMP taps add skips (min gap 0.35 s), lanes stay steerable", () => {
  const imps = tap => { const R = cometRace(); go(R, 1, () => ({ boostPressed: true })); const out = []; const lanes = new Set();
    for (let i = 0; i < 3.7 * 120; i++) { go(R, 1, () => ({ jumpPressed: tap && i % 6 === 0, lane: i === 200 ? (R.p.lane === 0 ? 1 : -1) : 0 })); for (const e of R.events) if (e.type === "impact") out.push(R.t); R.events.length = 0; lanes.add(R.p.lane); }
    return { out, lanes }; };
  const idle = imps(false), mash = imps(true);
  assert.equal(idle.out.length, 4); assert.ok(mash.out.length >= 8, `taps -> ${mash.out.length} impacts`);
  for (let i = 1; i < mash.out.length - 1; i++) assert.ok(mash.out[i] - mash.out[i - 1] >= 0.35 - 1e-6, "min gap");
  assert.ok(mash.lanes.size >= 2, "steered during the dash");
});

test("Comet 17 art: Muse's sprites wired in (manifest v8); boost -> special, celebrate -> fly; fly drawn x1.1", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/art/manifest.js", import.meta.url), "utf8");
  const win = {}; new Function("window", src)(win); const S = win.LEO_MANIFEST.sprites;
  assert.equal(S["veh.comet.boost"].alias, "veh.comet.special"); assert.equal(S["veh.comet.celebrate"].alias, "veh.comet.fly");
  for (const p of ["drive", "fly", "special"]) { const e = S[`veh.comet.${p}`]; assert.equal(e.src, `vehicles/comet_${p}.webp`); assert.deepEqual(e.size, [512, 256]); assert.deepEqual(e.anchor, [0.5, 0.92]); assert.equal(e.wu, 265);
    assert.ok(fs.existsSync(new URL(`../games/leo_smash_race/grokbot/art/vehicles/comet_${p}.webp`, import.meta.url))); }
  assert.equal(S["veh.comet.fly"].fx.scale, 1.1); assert.ok(win.LEO_MANIFEST.version >= 8, "cache bust for the comet art");
  const proc = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/proc.js", import.meta.url), "utf8");
  assert.ok(/function comet\(g, pose\)/.test(proc) && proc.includes("pup, rex, comet })"));
  const body = proc.slice(proc.indexOf("function comet(g, pose)"), proc.indexOf("function rival("));
  assert.ok(!/g\.rotate\(/.test(body.split("// the only marking")[0]), "no tilt baked into the interim art (the game tilts in code)");
  assert.ok(!/if \(fly\) \{ g\.lineWidth/.test(body), "no wing flip: the wing stays on its struts in fly");
  const game = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/game.js", import.meta.url), "utf8");
  assert.ok(/COMET_TILT = \{ special: 6 \* Math\.PI \/ 180, fly: -8 \* Math\.PI \/ 180/.test(game), "tilts in code: 6 deg down / 8 deg up");
  const audio = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/audio.js", import.meta.url), "utf8");
  for (const k of ["fwoom:", "crackle:", "mboom:", "kaboom:", "ting:", "hiss:", "chirp:"]) assert.ok(audio.includes(k), k);
});

test("leaderboard collection unchanged", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/rank.js", import.meta.url), "utf8");
  assert.ok(src.includes('COLLECTION="leaderboard_leo_smash_race_grokbot_v1"'));
});

/* ---------------- Addendum D: FIRE, Laser Racer, Ira ---------------- */
// an empty stretch of road ahead of the hero, then hand-placed objects
function darena(v, opts) {
  const R = SIM.createRace(Object.assign({ vehicle: v, track: "toyroom", seed: 5, countdown: 0, assist: false }, opts));
  go(R, 120); R.tr.objs.forEach(o => { if (o.x > R.p.x - 400) o.alive = false; }); R.boost = 0; R.events.length = 0;
  return R;
}
let GID = 90000;
function dput(R, kind, dx, lane, extra) {
  const k = SIM.KINDS[kind], o = Object.assign({ kind, x: R.p.x + dx, lane, z: 0, w: k.w, h: k.h, alive: true, pts: 10, group: ++GID, lead: true }, extra);
  R.tr.objs.push(o); R.tr.objs.sort((a, b) => a.x - b.x); R.idx = 0; return o;
}
const evs = (R, type) => R.events.filter(e => e.type === type);

test("Laser Racer + Ira: D1/D6 stats and feel, look-alike names only", () => {
  const L = SIM.VEHICLES.laser, I = SIM.VEHICLES.ira;
  assert.equal(L.name, "Laser Racer"); assert.equal(L.specialName, "Laser Drive"); assert.equal(L.fly, "wings");
  assert.deepEqual([L.speed, L.accelT, L.grav, L.bounce, L.laneT, L.maxUp, L.glide, L.superMult], [590, 0.5, 1500, 0.25, 0.15, 470, -180, 1.8]);
  assert.deepEqual(L.stats, { speed: 2, smash: 2, fly: 3 }); assert.deepEqual([L.len, L.h], [190, 66], "hitbox = the visible car of Muse's cut");
  assert.equal(I.name, "Ira"); assert.equal(I.specialName, "Turbo Toot"); assert.equal(I.fly, "bounce"); assert.ok(I.runner);
  assert.deepEqual([I.speed, I.accelT, I.laneT, I.grav, I.bounce, I.jumpV, I.airJumpV, I.airJumps, I.superMult], [560, 0.25, 0.11, 1600, 0.4, 700, 620, 2, 1.7]);
  assert.deepEqual(I.stats, { speed: 2, smash: 2, fly: 1 });
  const txt = JSON.stringify([L, I, SIM.WEAPONS]).toLowerCase();
  for (const bad of ["hot wheels", "mattel", "lightning", "mcqueen", "pixar", "disney", "nerf", "marvel", "paw patrol"]) assert.ok(!txt.includes(bad), bad);
});

test("Laser Drive: x1.8, slices everything ~520 px ahead in its lane and both neighbours, nothing beyond", () => {
  const R = darena("laser"); const V = R.veh, nose = () => R.p.x + V.len / 2;
  R.p.lane = 1; R.p.laneF = 1; R.boost = 1;
  const near = [0, 1, 2].map(l => dput(R, "box", V.len / 2 + 300, l)); // three lanes, inside the reach
  go(R, 1, () => ({ boostPressed: true })); assert.ok(R.laser, "laser drive on");
  const far = dput(R, "box", V.len / 2 + 1400, 1);
  go(R, 36); // the beams sweep out to full reach over LASER.sweep (0.25 s)
  for (const o of near) assert.equal(o.alive, false, `lane ${o.lane} sliced`);
  assert.ok(far.alive && far.x - nose() > SIM.LASER.reach, "out of reach stays");
  go(R, 240); assert.ok(Math.abs(R.p.speed - V.speed * 1.8) < 5, `speed ${R.p.speed}`);
  go(R, 240); assert.equal(R.laser, null, "ends after 3.6 s");
});

test("Turbo Toot: the take, x1.7, rams through its own lane like Nitro", () => {
  const R = darena("ira"); const V = R.veh; R.p.lane = 1; R.p.laneF = 1; R.boost = 1;
  go(R, 1, () => ({ boostPressed: true })); assert.ok(R.toot);
  go(R, 12); assert.ok(R.p.speed < V.speed, "slows for the take (a surprised look at the camera)"); assert.equal(SIM.TOOT.take, 0.22); assert.equal(SIM.TOOT.look, undefined);
  go(R, 150); assert.ok(Math.abs(R.p.speed - V.speed * 1.7) < 5, `speed ${R.p.speed}`);
  const mine = dput(R, "box", 400, 1), side = dput(R, "box", 400, 0); go(R, 60);
  assert.equal(mine.alive, false, "own lane rammed"); assert.equal(side.alive, true, "neighbour lane untouched");
  let ended = false; for (let i = 0; i < 400 && !ended; i++) { SIM.step(R, SIM.STEP, { lane: 0 }); ended = R.events.some(e => e.type === "tootEnd"); R.events.length = 0; }
  assert.ok(ended && !R.toot);
});

test("FIRE: aims own lane first, then a neighbour; stars and rivals are never targets", () => {
  const R = darena("dragster"); R.p.lane = 1; R.p.laneF = 1; const x0 = R.p.x;
  const star = dput(R, "box", 150, 1, { star: true });
  const side = dput(R, "box", 200, 0), mine = dput(R, "box", 450, 1);
  assert.equal(SIM.aimTarget(R, x0, 1, 650, null), mine, "own lane beats a closer neighbour");
  mine.alive = false; assert.equal(SIM.aimTarget(R, x0, 1, 650, null), side, "then the neighbour lane");
  side.alive = false; assert.equal(SIM.aimTarget(R, x0, 1, 650, null), null, "a star alone is not a target");
  dput(R, "box", 300, 2 + 1); // two lanes away does not count (lane 3 does not exist; here it is just |dl| = 2)
  assert.equal(SIM.aimTarget(R, x0, 1, 650, null), null);
  assert.ok(star.alive);
  for (const rv of R.rivals || []) assert.ok(!R.tr.objs.includes(rv), "rivals are not track objects");
});

test("FIRE: one hit destroys one whole group; points x combo + 25 Sharp Shot, half the ram boost; summary has shots/shotPts", () => {
  const R = darena("truck"); R.p.lane = 1; R.p.laneF = 1;
  const G = ++GID; const tower = [0, 1, 2].map(k => dput(R, "crate", 500, 1, { group: G, z: k * 81, pts: k ? 0 : 50, lead: !k }));
  const s0 = R.score;
  go(R, 1, () => ({ firePressed: true })); assert.equal(R.fired, 1);
  let hit = null; for (let i = 0; i < 240 && !hit; i++) { SIM.step(R, SIM.STEP, { lane: 0 }); hit = R.events.find(e => e.type === "shotHit"); R.events.length = 0; }
  assert.ok(hit, "hit"); assert.equal(hit.word, SIM.WEAPONS.truck.word);
  for (const o of tower) assert.equal(o.alive, false);
  assert.equal(R.hits, 1); assert.ok(R.score - s0 >= 50 + SIM.SHARP, `score +${R.score - s0}`); assert.equal(hit.pts, R.score - s0);
  const sum = SIM.summary(R); assert.equal(sum.shots, 1); assert.ok(sum.shotPts >= SIM.SHARP);
  // boost: a shot fills half of what a ram does
  const A = darena("truck"), B = darena("truck"); const oa = dput(A, "box", 300, 1), ob = dput(B, "box", 300, 1);
  SIM.smashGroup(A, oa, "ram"); SIM.smashGroup(B, ob, "shot");
  assert.ok(A.boost > 0 && Math.abs(B.boost - A.boost / 2) < 1e-9, `ram ${A.boost} shot ${B.boost}`);
});

test("FIRE: hold repeats on the cooldown; a miss fizzles; LIVE during a special (normal points, no Sharp Shot bonus, the special keeps going)", () => {
  const R = darena("laser"); const cd = R.weapon.cd;
  go(R, Math.round(2 / SIM.STEP), () => ({ fire: true }));
  assert.equal(R.fired, Math.floor(2 / cd) + 1, `fired ${R.fired} with cd ${cd}`);
  const F = darena("dragster"); let fizz = false;
  go(F, 1, () => ({ firePressed: true }));
  for (let i = 0; i < 600 && !fizz; i++) { SIM.step(F, SIM.STEP, { lane: 0 }); fizz = F.events.some(e => e.type === "projEnd" && e.fizzle); F.events.length = 0; }
  assert.ok(fizz, "nothing to hit: it fizzles"); assert.equal(F.hits, 0);
  for (const v of SIM.VEHICLE_ORDER) { // every hero can fire in its special
    const S = darena(v); S.p.lane = 1; S.p.laneF = 1; S.boost = 1; go(S, 1, () => ({ boostPressed: true })); assert.ok(S.p.superT > 0, `${v} special on`); S.events.length = 0;
    SIM.step(S, SIM.STEP, { lane: 0, fire: true, firePressed: true });
    assert.equal(S.fired, 1, `${v} fired in its special`); assert.ok(!S.events.some(e => e.type === "fireOff"), v);
    assert.ok(S.events.some(e => e.type === "fire" && e.special), `${v} shot flagged as a special shot`); }
  // a special shot: base x current combo, no combo step, NO +25; the special keeps running
  const T = darena("dragster"); T.p.lane = 1; T.p.laneF = 1; T.boost = 1; go(T, 1, () => ({ boostPressed: true }));
  T.tr.objs.forEach(o => { if (o.x > T.p.x - 400) o.alive = false; }); const sup0 = T.p.superT;
  const side = dput(T, "box", 450, 0); T.lastSmash = T.t; T.chain = 2; T.mult = 2; const m0 = T.mult, s0 = T.score, h0 = T.hits, sp0 = T.shotPts;
  go(T, 1, () => ({ firePressed: true })); let hit = null; for (let i = 0; i < 120 && !hit; i++) { SIM.step(T, SIM.STEP, { lane: 0 }); hit = T.events.find(e => e.type === "shotHit"); T.events.length = 0; }
  assert.ok(hit && hit.special && !side.alive); assert.equal(hit.pts, 10 * m0, "base x current combo, no bonus"); assert.equal(T.mult, m0);
  assert.equal(T.hits, h0, "not a Sharp Shot"); assert.equal(T.shotPts, sp0); assert.equal(T.spShots, 1); assert.equal(T.score - s0, 10 * m0);
  assert.ok(T.p.superT > 0 && T.p.superT < sup0, "the special keeps running");
});

test("Zoomie Chomp: dashes to the target, eats the group + the next object behind it, pops back; a miss spins and goes dizzy", () => {
  const R = darena("ira"); R.p.lane = 1; R.p.laneF = 1;
  assert.equal(R.weapon.word, "CHOMP-CHOMP!"); assert.ok(R.weapon.dash);
  const a = dput(R, "box", 350, 1), b = dput(R, "box", 350 + 220, 1), c = dput(R, "box", 350 + 220 + 400, 1);
  go(R, 1, () => ({ firePressed: true })); assert.ok(R.dash && R.dash.ph === "go");
  let hit = null; for (let i = 0; i < 240 && R.dash; i++) { SIM.step(R, SIM.STEP, { lane: 0 }); hit = hit || R.events.find(e => e.type === "shotHit"); R.events.length = 0; }
  assert.ok(hit && hit.n === 2 && hit.word === "CHOMP-CHOMP!"); assert.equal(R.hits, 1, "one Sharp Shot for the whole chomp"); assert.equal(R.shotPts, SIM.SHARP);
  assert.equal(a.alive, false); assert.equal(b.alive, false); assert.equal(c.alive, true, "only the next one behind");
  assert.equal(R.dash, null, "popped back");
  const M = darena("ira"); let dizzy = false; go(M, 1, () => ({ firePressed: true })); assert.equal(M.dash.ph, "spin");
  for (let i = 0; i < 120 && !dizzy; i++) { SIM.step(M, SIM.STEP, { lane: 0 }); dizzy = M.events.some(e => e.type === "dizzy"); M.events.length = 0; }
  assert.ok(dizzy);
});

test("FIRE time-to-kill stays sensible: every shot connects in the benchmark, cooldowns 0.3-0.7 s, slowest <= 2x the fastest", () => {
  function bench(v, seed) {
    const R = darena(v); const S = R.veh.speed; let r = SIM.rng(seed);
    for (let t = 0.6, i = 0; t < 22; t += 0.3, i++) { const X = t * S, lane = r() < 0.5 ? 0 : 2, p = i % 4;
      if (p === 1) { dput(R, "cone", X, lane); dput(R, "cone", X + 70, lane); }
      else if (p === 2) { const G = ++GID; for (let k = 0; k < 3; k++) dput(R, "crate", X, lane, { group: G, z: k * 81, pts: k ? 0 : 50, lead: !k }); }
      else dput(R, "box", X, lane); }
    R.p.lane = 1; R.p.laneF = 1;
    go(R, Math.round(20 / SIM.STEP), () => ({ fire: true }));
    return { spk: 20 / R.hits, acc: R.hits / R.fired };
  }
  const spk = {};
  for (const v of SIM.VEHICLE_ORDER) { const b = [1, 2, 3].map(s => bench(v, s)); spk[v] = b.reduce((t, x) => t + x.spk, 0) / 3;
    const cd = SIM.WEAPONS[v].cd; assert.ok(cd >= 0.3 && cd <= 0.7, `${v} cd ${cd}`);
    assert.ok(b.every(x => x.acc >= 0.9), `${v} accuracy ${b.map(x => x.acc.toFixed(2))}`); }
  const vals = Object.values(spk); assert.ok(Math.max(...vals) / Math.min(...vals) <= 2, JSON.stringify(spk));
});

// Muse's review of PR #24: the score bots. Same seeds for every bot; assist on, BOOST pressed whenever full.
const BLOCK = new Set(["wall", "wallw", "balloon", "cloud"]); // walls + sky targets Leo can't ram from the road
function bot(v, track, seed, mode) {
  const R = SIM.createRace({ vehicle: v, track, seed, assist: true }); let n = 0;
  while (!R.finished && n < 200000) {
    const i = { jump: false, jumpPressed: false, boostPressed: R.boost >= 0.999 && R.p.superT <= 0, lane: 0, fire: mode === "hold", firePressed: false };
    if (mode === "ram" && R.fireCd <= 0 && !R.dash) { const P = R.p, t = SIM.aimTarget(R, P.x + R.veh.len * 0.45, P.laneF, Math.min(R.weapon.range, 650), null);
      if (t && (Math.abs(t.lane - P.laneF) > 0.5 || BLOCK.has(t.kind))) i.firePressed = true; }
    SIM.step(R, SIM.STEP, i); R.events.length = 0; n++; }
  return R.score;
}
test("FIRE score balance: hold-fire beats never-firing; a ram-first player who fires at side lanes + blockers scores at least as much", () => {
  const seeds = [11, 23, 37, 41, 53, 67, 79, 97, 101, 113], avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  // FIRE is live in specials (Muse's final review): ram-first >= hold-fire must hold for Sword, Sky Patroller and the PR's four reference heroes
  for (const v of ["sword", "jet", "dragster", "rex", "laser", "ira"]) for (const tr of ["toyroom", "desert"]) {
    const sc = m => avg(seeds.map(s => bot(v, tr, s, m))), none = sc("none"), hold = sc("hold"), ram = sc("ram");
    if (!["sword", "jet"].includes(v)) assert.ok(hold > none * 1.1, `${v} ${tr} hold ${hold} vs none ${none}`); // FIRE is worth having
    assert.ok(ram >= hold, `${v} ${tr} ram ${ram} < hold ${hold}`);
  }
});

test("FIRE rules: in-lane targets closer than 240 are ignored, side lanes at any distance; shots keep the combo alive but never raise it", () => {
  const R = darena("dragster"); R.p.lane = 1; R.p.laneF = 1; const x0 = R.p.x + R.veh.len * 0.45;
  assert.equal(SIM.AIM_MIN, 240);
  const close = dput(R, "box", R.veh.len * 0.45 + 150, 1);
  assert.equal(SIM.aimTarget(R, x0, 1, 650, null), null, "too close in lane: Leo rams it");
  const side = dput(R, "box", R.veh.len * 0.45 + 60, 2); assert.equal(SIM.aimTarget(R, x0, 1, 650, null), side, "a side lane counts at any distance");
  const far = dput(R, "box", R.veh.len * 0.45 + 300, 1); assert.equal(SIM.aimTarget(R, x0, 1, 650, null), far, "own lane beyond 240 still comes first");
  void close;
  // combo: ram, ram (x2), shot (scores base x2, stays x2), ram (x3)
  const C = darena("dragster"); const cones = [0, 1, 2, 3].map(i => dput(C, "cone", 2000 + i * 300, 0));
  C.t = 10; SIM.smashGroup(C, cones[0], "ram"); C.t += 0.5; SIM.smashGroup(C, cones[1], "ram"); assert.equal(C.mult, 2);
  C.t += 0.5; const b = C.score; SIM.smashGroup(C, cones[2], "shot"); assert.equal(C.mult, 2, "a shot never adds a step"); assert.equal(C.score - b, 10 * 2, "base x the current combo");
  C.t += 1.2; SIM.smashGroup(C, cones[3], "ram"); assert.equal(C.mult, 3, "the shot kept the combo alive (1.2 s after it, 1.7 s after the last ram)");
  const D = darena("dragster"); const d = [0, 1].map(i => dput(D, "cone", 2000 + i * 300, 0)); D.t = 10; SIM.smashGroup(D, d[0], "ram"); SIM.smashGroup(D, d[0], "ram");
  D.t += 3; const b2 = D.score; SIM.smashGroup(D, d[1], "shot"); assert.equal(D.mult, 1); assert.equal(D.score - b2, 10, "after the window ran out a shot scores x1");
});

test("Sharp Shot: +25 flat, never multiplied, once per shot even when a splash or a pierce gets several kills", () => {
  // rocket splash: two boxes side by side, one shot
  const R = darena("dragster"); R.p.lane = 1; R.p.laneF = 1; R.t = 10; R.lastSmash = 9.5; R.chain = 3; R.mult = 3;
  const a = dput(R, "box", 500, 1), b = dput(R, "box", 540, 1); const s0 = R.score;
  go(R, 1, () => ({ firePressed: true })); let hits = []; for (let i = 0; i < 240 && R.proj.length; i++) { SIM.step(R, SIM.STEP, { lane: 0 }); hits = hits.concat(R.events.filter(e => e.type === "shotHit")); R.events.length = 0; }
  assert.ok(!a.alive && !b.alive, "splash got both"); assert.equal(hits.length, 1); assert.equal(R.hits, 1); assert.equal(R.shotPts, SIM.SHARP);
  assert.equal(R.score - s0, hits[0].pts); assert.equal(hits[0].pts, 10 * 3 + 10 * 3 + SIM.SHARP, "kills x combo, bonus flat");
  // sword wave pierces 2 targets in a row: still one bonus
  const S = darena("sword"); S.p.lane = 1; S.p.laneF = 1; const p1 = dput(S, "box", 400, 1), p2 = dput(S, "box", 560, 1);
  go(S, 1, () => ({ firePressed: true })); for (let i = 0; i < 300 && S.proj.length; i++) { SIM.step(S, SIM.STEP, { lane: 0 }); S.events.length = 0; }
  assert.ok(!p1.alive && !p2.alive, "pierced both"); assert.equal(S.hits, 1); assert.equal(S.shotPts, SIM.SHARP);
  assert.equal(SIM.summary(S).shots, 1); assert.equal(SIM.summary(S).shotPts, SIM.SHARP);
});

test("Addendum D art: Muse drop 5 wired in (manifest v9, fx/ folder), Ira run frames + fire = spin, laser jet/laser points, 735 KB sprite budget", async () => {
  const fs = await import("node:fs"), path = await import("node:path");
  const base = new URL("../games/leo_smash_race/grokbot/art/", import.meta.url);
  const src = fs.readFileSync(new URL("manifest.js", base), "utf8"); const win = {}; new Function("window", src)(win); const M = win.LEO_MANIFEST, S = M.sprites;
  assert.ok(M.version >= 9, "cache bust for drop 5");
  for (const [k, e] of Object.entries(S)) if (e.src) assert.ok(fs.existsSync(new URL(e.src, base)), `${k} -> ${e.src}`);
  for (const p of ["drive", "fly", "special"]) assert.equal(S[`veh.laser.${p}`].src, `vehicles/laser_${p}.webp`);
  assert.deepEqual(S["veh.laser.drive"].fx.nozzle, [0.165, 0.73]); assert.deepEqual(S["veh.laser.drive"].fx.nose, [0.85, 0.755]); assert.ok(S["veh.laser.special"].fx.noFlame);
  assert.deepEqual(S["veh.ira.drive"].frames, ["vehicles/ira_run_a.webp", "vehicles/ira_run_b.webp"]); assert.equal(S["veh.ira.runb"].src, "vehicles/ira_run_b.webp");
  assert.equal(S["veh.ira.fire"].alias, "veh.ira.spin"); assert.equal(S["veh.ira.boost"].alias, "veh.ira.special"); assert.equal(S["veh.ira.celebrate"].alias, "veh.ira.fly");
  for (const k of ["rocket", "ball", "boomerang", "balloon", "gust", "teeth", "meteor"]) assert.ok(/^fx\/proj_/.test(S[`proj.${k}`].src), k);
  for (const k of ["wave", "bolt", "zoomie"]) assert.equal(S[`proj.${k}`].src, null, `${k} stays code-drawn`);
  for (const k of ["firepop", "confetti", "spark", "splash", "puff", "bite", "zap"]) assert.ok(/^fx\/hitfx_/.test(S[`hitfx.${k}`].src), k);
  assert.equal(S["fx.toot"].src, "fx/toot_cloud.webp"); assert.equal(S["fx.pellet"].src, "fx/poop_pellet.webp");
  // budget: every sprite file outside the track layers
  let bytes = 0; const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== "layers") walk(p); } else if (/\.(webp|png)$/.test(f.name)) bytes += fs.statSync(p).size; } };
  walk(base.pathname); assert.ok(bytes <= 736000, `sprites ${bytes} bytes`);
  const spec = fs.readFileSync(new URL("ART_SPEC.md", base), "utf8"); assert.ok(spec.includes("`fx/`"));
  const proc = fs.readFileSync(new URL("../proc.js", base), "utf8"); assert.ok(/laser\s*\(g, pose\)/.test(proc) && /ira\s*\(g, pose\)/.test(proc), "code-art fallbacks stay");
  const html = fs.readFileSync(new URL("../game.html", base), "utf8");
  assert.ok(html.includes('id="bFire"') && /manifest\.js\?v=10/.test(html) && /sim\.js\?v=10/.test(html) && /game\.js\?v=14/.test(html));
  const game = fs.readFileSync(new URL("../game.js", base), "utf8");
  assert.ok(/if \(Math\.round\(R\.p\.laneF\) === lane\) \{ drawFx\('back'\);/.test(game) && game.includes("drawFx('front');"), "debris behind every hero, sparks in front");
  assert.ok(game.includes("fs2 = Math.round(fs / 1.15)"), "Sharp Shot word ~15% bigger than the +points line");
});


test("anti-spam: the big popup word at most once per 0.6 s per hero; rapid shots (< 0.5 s apart) are flagged for a quieter, re-pitched launch sound", async () => {
  assert.equal(SIM.WORD_GAP, 0.6); assert.equal(SIM.RAPID, 0.5);
  const R = darena("laser"); R.p.lane = 1; R.p.laneF = 1; // cd 0.35: shots come faster than the word gap
  for (let k = 0; k < 10; k++) dput(R, "box", 300 + k * 260, k % 2 ? 0 : 2);
  const hits = [], fires = []; for (let i = 0; i < Math.round(3 / SIM.STEP); i++) { SIM.step(R, SIM.STEP, { lane: 0, fire: true }); for (const e of R.events) { if (e.type === "shotHit") hits.push({ t: R.t, big: e.big }); if (e.type === "fire") fires.push(e.rapid); } R.events.length = 0; }
  assert.ok(hits.length >= 4, `hits ${hits.length}`);
  const bigs = hits.filter(h => h.big).map(h => h.t); for (let i = 1; i < bigs.length; i++) assert.ok(bigs[i] - bigs[i - 1] >= 0.6 - 1e-9, `words ${bigs}`);
  assert.ok(hits.some(h => !h.big), "some hits show only the +points line"); assert.equal(hits[0].big, true);
  assert.equal(fires[0], false, "the first shot is not rapid"); assert.ok(fires.slice(1).every(r => r === true), "0.35 s apart: rapid");
  const fs = await import("node:fs");
  const audio = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/audio.js", import.meta.url), "utf8"), game = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/game.js", import.meta.url), "utf8");
  assert.ok(/function playMod\(name, vol, rate\)/.test(audio) && /\* gVol/.test(audio) && /\* gRate/.test(audio));
  assert.ok(/e\.rapid && AU\.playMod\) AU\.playMod\('fire_' \+ e\.w, 0\.7, rand\(/.test(game), "-30% + random pitch");
  assert.ok(/c\.classList\.toggle\('below', !!special\)/.test(game), "the combo moves below a special banner");
});
