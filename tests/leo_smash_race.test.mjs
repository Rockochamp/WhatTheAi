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

test("8 heroes, new ones last, original five unchanged", () => {
  assert.deepEqual(SIM.VEHICLE_ORDER, ["dragster", "bibi", "truck", "sword", "jet", "pup", "rex", "comet"]);
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
  assert.equal(c.maxUp, 440); assert.equal(c.glide, -220); assert.equal(c.h, 60); assert.equal(c.len, 210); assert.equal(c.superMult, 1.6);
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

test("Comet 17 art: interim code art until Muse's sprites land; boost -> special, celebrate -> fly", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/art/manifest.js", import.meta.url), "utf8");
  const win = {}; new Function("window", src)(win); const S = win.LEO_MANIFEST.sprites;
  assert.equal(S["veh.comet.boost"].alias, "veh.comet.special"); assert.equal(S["veh.comet.celebrate"].alias, "veh.comet.fly");
  for (const p of ["drive", "fly", "special"]) { const e = S[`veh.comet.${p}`]; assert.equal(e.src, null); assert.deepEqual(e.size, [512, 256]); assert.deepEqual(e.anchor, [0.5, 0.92]); }
  const proc = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/proc.js", import.meta.url), "utf8");
  assert.ok(/function comet\(g, pose\)/.test(proc) && proc.includes("pup, rex, comet })"));
  const audio = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/audio.js", import.meta.url), "utf8");
  for (const k of ["fwoom:", "crackle:", "mboom:", "kaboom:", "ting:", "hiss:", "chirp:"]) assert.ok(audio.includes(k), k);
});

test("leaderboard collection unchanged", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../games/leo_smash_race/grokbot/rank.js", import.meta.url), "utf8");
  assert.ok(src.includes('COLLECTION="leaderboard_leo_smash_race_grokbot_v1"'));
});
