import test from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUITS, INPUT, RACERS, createRace, step, result } from '../games/leo_smash_race/sol/sim.js';

test('Knuckles emits three progressively wider punches and clears hazards without consuming pickups', () => {
  const race = createRace('workshop','knuckles','pro');
  race.objects = [
    { s:48, offset:0, kind:'crate', used:-1 },
    { s:72, offset:-49, kind:'stack', used:-1 },
    { s:128, offset:70, kind:'barrier', used:-1 },
    { s:57, offset:45, kind:'repair', used:-1 },
  ];
  race.rivals[0].distance = 40;
  race.special = 100;
  const punches = [];
  for (let tick = 0; tick < 55; tick++) {
    step(race,tick === 0 ? INPUT.special : 0);
    punches.push(...race.events.filter(event => event.type === 'punch'));
    if (tick === 0) assert.ok(race.rivals[0].hit > 1);
  }
  assert.deepEqual(punches.map(p => p.index),[0,1,2]);
  assert.ok(punches[0].radius < punches[1].radius && punches[1].radius < punches[2].radius);
  assert.equal(race.smash,3);
  assert.equal(race.objects[3].used,-1);
  assert.equal(race.bestCombo,3);
});

test('Knuckles can finish in both classes on every circuit', () => {
  assert.equal(RACERS.length,10);
  for (const mode of ['crew','pro']) for (const course of CIRCUITS) {
    const race = createRace(course.id,'knuckles',mode);
    while (!race.finished) {
      const controls = (race.tick%173 < 30 ? INPUT.boost : 0)
        | (race.tick%29 === 0 ? INPUT.special : 0)
        | INPUT.fire;
      step(race,controls);
    }
    const stats = result(race);
    assert.equal(stats.timeout,false,course.id+' '+mode);
    assert.ok(stats.score > 0);
  }
});
