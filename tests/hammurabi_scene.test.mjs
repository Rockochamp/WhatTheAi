import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceYear,initialState} from '../games/steve_jobs_hammurabi/gpt6_astra/engine.js';
import {yearSequence,seededRandom,makeRoadGraph,cameraBounds,boundedPopulation,MAX_PEOPLE} from '../games/steve_jobs_hammurabi/gpt6_astra/scene-model.js';

test('A year shows losses and arrivals separately, even with no net population change',()=>{
  const before=Object.freeze({...initialState(()=>0),food:6000,starvationRisk:2});
  const decisions=Object.freeze({buy:0,sell:0,plant:100,feed:20});
  const report=Object.freeze({year:1,trade:0,seed:100,feeding:2000,harvest:500,yield:5,starved:6,arrivals:10,left:0,rats:0,bonus:0,plague:4});
  const after=Object.freeze({...before,year:1,food:4400});
  const phases=yearSequence(before,decisions,report,after);
  assert.deepEqual(phases.map(p=>p.kind),['harvest','starvation','arrivals','plague','settled']);
  assert.deepEqual(phases.map(p=>p.people),[100,94,104,100,100]);
  assert.deepEqual(phases.filter(p=>p.kind==='plague').map(p=>p.amount),[4]);
  assert.equal(phases.at(-1).food,4400);
  assert.deepEqual(yearSequence(before,decisions,report,after),phases,'Replaying an existing report must be deterministic');
});

test('Presentation balances every event against 2,000 real engine outcomes',()=>{
  const random=seededRandom(5489),seen=new Set();
  for(let i=0;i<2000;i++){
    const before=Object.freeze({...initialState(random),pawns:1+Math.floor(random()*550),food:100000,land:100+Math.floor(random()*1000),starvationRisk:random()*4});
    const decisions=Object.freeze({buy:0,sell:0,plant:Math.min(before.land,before.pawns*10),feed:Math.floor(random()*31)});
    const result=advanceYear(before,decisions,random);assert.equal(result.ok,true);
    const report=Object.freeze(result.report),after=Object.freeze(result.state);
    const snapshot=JSON.stringify([before,decisions,report,after]);
    const phases=yearSequence(before,decisions,report,after);
    let people=before.pawns,food=before.food+report.trade-report.seed-report.feeding;
    for(const phase of phases){
      seen.add(phase.kind);
      if(phase.kind==='arrivals')people+=phase.amount;
      if(['starvation','plague','emigration'].includes(phase.kind))people-=phase.amount;
      if(['harvest','bonus'].includes(phase.kind))food+=phase.amount;
      if(phase.kind==='rats')food-=phase.amount;
      assert.equal(phase.people,people,phase.kind);assert.equal(phase.food,food,phase.kind);
      assert.ok(Number.isInteger(people)&&people>=0);assert.ok(phase.duration>0);
    }
    assert.equal(people,after.pawns);assert.equal(food,after.food);
    assert.equal(JSON.stringify([before,decisions,report,after]),snapshot,'Animation may not mutate decisions, engine state, or the report');
  }
  for(const event of ['harvest','starvation','arrivals','emigration','rats','bonus','plague','settled'])assert.ok(seen.has(event),event);
});

test('Town motion cannot consume or change game randomness',()=>{
  const original=Math.random;
  Math.random=()=>{throw Error('Presentation consumed global RNG');};
  try{
    const visual=seededRandom(7);for(let i=0;i<5000;i++)assert.ok(visual()>=0&&visual()<1);
    const before=initialState(()=>0),decisions={buy:0,sell:0,plant:0,feed:0};
    const {state,report}=advanceYear(before,decisions,()=>.8);
    yearSequence(before,decisions,report,state);
  }finally{Math.random=original;}
});

test('Walking routes are connected, bidirectional, and avoid the temple',()=>{
  const nodes=makeRoadGraph(),visited=new Set(),queue=[15];
  while(queue.length){const index=queue.pop();if(visited.has(index))continue;visited.add(index);queue.push(...nodes[index].neighbors);}
  assert.equal(visited.size,nodes.length);
  nodes.forEach((node,i)=>node.neighbors.forEach(j=>{
    const other=nodes[j];assert.ok(other.neighbors.includes(i));
    assert.ok(node.x===other.x||node.z===other.z);
    assert.ok(!(node.x===0&&other.x===0&&Math.min(node.z,other.z)<-1));
  }));
});

test('Camera remains finite across small phones, landscape, tablets, and desktop',()=>{
  for(const [w,h] of [[0,0],[292,330],[358,480],[812,160],[768,440],[1080,600],[1920,1080]]){
    for(const z of [-10,.85,1,1.7,2.4,100]){
      const b=cameraBounds(w,h,z);
      assert.ok(Object.values(b).every(Number.isFinite));assert.ok(b.left<b.right&&b.bottom<b.top);
      assert.equal(b.left,-b.right);assert.equal(b.bottom,-b.top);
    }
    assert.deepEqual(cameraBounds(w,h,100),cameraBounds(w,h,2.4));
  }
});

test('The instanced population budget covers every possible ten-year reign',()=>{
  assert.equal(MAX_PEOPLE,100+10*50);
  for(const n of [0,1,100,599,600])assert.equal(boundedPopulation(n),n);
  assert.equal(boundedPopulation(-5),0);assert.equal(boundedPopulation(NaN),0);assert.equal(boundedPopulation(9999),600);
});
