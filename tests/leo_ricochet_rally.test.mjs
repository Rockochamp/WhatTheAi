import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVERS,TABLES,RAIL,start,step} from '../games/leo_smash_race/astra_6_2/sim.js';

test('every toy finishes every table and the finish awards points once',()=>{
  for(const d of DRIVERS) for(const t of TABLES) for(const assist of [false,true]){
    const r=start(d.id,t.id,assist);
    for(let tick=0;!r.finished&&tick<4500;tick++){
      step(r,{steer:Math.sin(tick/53),pin:tick%135===0,power:tick%240===0});
      assert.ok(Math.abs(r.x)<=RAIL && Number.isFinite(r.speed));
    }
    assert.ok(r.finished && r.place>=1 && r.place<=3 && r.score>600);
    const score=r.score;step(r,{power:true});assert.equal(r.score,score);
  }
});
test('Geode Break forks ahead, leaves collectibles and cannot be fired twice on one charge',()=>{
  const r=start('golem','mine',false);
  r.objects=[{kind:'crate',x:49,s:100},{kind:'key',x:-58,s:97},{kind:'crate',x:178,s:105}].sort((a,b)=>a.s-b.s);
  const effects=[];
  for(let i=0;i<65;i++){step(r,{power:true});effects.push(...r.events.map(e=>e.kind));}
  assert.equal(effects.filter(e=>e==='fork').length,3);
  assert.equal(effects.filter(e=>e==='power').length,1);
  assert.equal(r.smashes,1);
  assert.ok(!r.objects[0].done&&!r.objects[2].done);
});
test('a ricochet reflects off the rail and rewards the bounce',()=>{
  const r=start();r.x=RAIL-2;step(r,{pin:true,steer:1});
  assert.equal(r.banks,1);assert.ok(r.vx<0 && r.pinWait>0 && r.rush>0);
  const score=r.score;step(r,{pin:true});assert.equal(r.banks,1);assert.equal(r.score,score);
});
test('a vault consumes three keys once; a missed vault carries keys forward',()=>{
  const r=start();r.keys=2;r.objects=[{kind:'vault',x:0,s:10}];step(r);
  assert.equal(r.keys,2);assert.equal(r.vaults,0);
  r.objects=[{kind:'key',x:0,s:r.s},{kind:'vault',x:0,s:r.s+4}];step(r);
  assert.equal(r.keys,0);assert.equal(r.vaults,1);assert.equal(r.energy,100);
  const score=r.score;step(r);assert.equal(r.score,score);
});
