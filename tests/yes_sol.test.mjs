import test from 'node:test';
import assert from 'node:assert/strict';
import {validateText, voteChange, normalizePost, visiblePosts, divisiveness, validId} from '../apps/yes_i_said_it/gpt_6_1_sol_medium/core.js';
import {createBoardStore, getVote} from '../apps/yes_i_said_it/gpt_6_1_sol_medium/store.js';

test('opinions reject blank and over-limit text, preserve literal markup and Unicode',()=>{
  assert.throws(()=>validateText(' \n '));assert.throws(()=>validateText('a'.repeat(421)));
  assert.equal(validateText(' 😀 '.repeat(140)).length>0,true);
  assert.equal(validateText('  <img onerror=alert(1)>\r\nI said it. '),'<img onerror=alert(1)>\nI said it.');
  assert.equal(validateText('é'.repeat(420)).length,420);assert.throws(()=>validateText('😀'.repeat(421)));
});
test('vote new, cancel and switch keep both counters and net score consistent',()=>{
  assert.deepEqual(voteChange({upvotes:4,downvotes:2},null,'upvote'),{next:'upvote',upvotes:5,downvotes:2,score:3});
  assert.deepEqual(voteChange({upvotes:4,downvotes:2},'upvote','upvote'),{next:null,upvotes:3,downvotes:2,score:1});
  assert.deepEqual(voteChange({upvotes:4,downvotes:2},'upvote','downvote'),{next:'downvote',upvotes:3,downvotes:3,score:0});
  assert.deepEqual(voteChange({upvotes:0,downvotes:0},'upvote','downvote'),{next:'downvote',upvotes:0,downvotes:1,score:-1});
  assert.throws(()=>voteChange({},null,'bogus'));
});
test('divisive feed prioritises actual balanced debate, filters search and hidden voices',()=>{
  const a={id:'a',text:'AI creativity',upvotes:10,downvotes:10,score:0,timestamp:1};
  const b={id:'b',text:'Games',upvotes:100,downvotes:0,score:100,timestamp:2};
  assert.ok(divisiveness(a)>divisiveness(b));
  assert.equal(visiblePosts([b,a],'debate','',new Set())[0].id,'a');
  assert.equal(visiblePosts([a,b],'love','',new Set())[0].id,'b');
  assert.equal(visiblePosts([a,b],'hate','',new Set())[0].id,'a');
  assert.deepEqual(visiblePosts([a,b],'recent','ai',new Set()).map(p=>p.id),['a']);
  assert.equal(visiblePosts([a,b],'recent','',new Set(['a'])).length,1);
});
test('legacy posts normalise safely and invalid IDs cannot become document paths',()=>{
  const p=normalizePost('safe',{text:'hello',upvotes:4,downvotes:2,score:999,parentId:'../bad',timestamp:{seconds:100}});
  assert.equal(p.score,2);assert.equal(p.parentId,null);assert.equal(p.timestamp,100000);
  assert.equal(normalizePost('a',{upvotes:NaN,downvotes:-4}).score,0);
  assert.ok(validId('Abc_123-x'));assert.ok(!validId('a/b'));assert.ok(!validId(''));
});
test('transaction retries do not multiply votes; storage changes only after success',async()=>{
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  let saved={text:'A thought',parentId:null,upvotes:5,downvotes:1,timestamp:{seconds:100}};
  let fail=false,writes=0;
  const ref={id:'voice',get:async()=>({exists:true,id:'voice',data:()=>saved})};
  const db={collection:()=>({doc:()=>ref}),runTransaction:async fn=>{
    const updates=[];const t={get:ref.get,update:(_,v)=>updates.push(v)};
    await fn(t);const result=await fn(t);if(fail)throw new Error('denied');
    saved={...saved,...updates.at(-1)};writes++;return result;
  }};
  const store=createBoardStore(db,{});await store.vote('voice','upvote');
  assert.equal(saved.upvotes,6);assert.equal(getVote('voice'),'upvote');
  fail=true;await assert.rejects(store.vote('voice','downvote'));assert.equal(getVote('voice'),'upvote');assert.equal(saved.downvotes,1);
  fail=false;await store.vote('voice','downvote');assert.equal(saved.upvotes,5);assert.equal(saved.downvotes,2);assert.equal(getVote('voice'),'downvote');assert.equal(writes,2);
});
test('posting uses the existing shared collection and refuses orphan replies',async()=>{
  let name,posted;
  const store=createBoardStore({collection:n=>{name=n;return{add:async data=>{posted=data;return{id:'new'}},doc:()=>({get:async()=>({exists:false})})}}},{serverTimestamp:()=> 'SERVER_TIME'});
  await store.post(' A real opinion ');assert.equal(name,'comments_yesisaidit');assert.equal(posted.text,'A real opinion');assert.equal(posted.parentId,null);assert.equal(posted.timestamp,'SERVER_TIME');
  await assert.rejects(store.post('reply','missing'),/no longer/);
  await assert.rejects(store.post('reply','bad/path'),/valid conversation/);
});
