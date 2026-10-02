import { MAX_LENGTH, SPARKS, validId, visiblePosts, relativeTime, validateText } from './core.js';
import { connect, getVote, readStorage, writeStorage } from './store.js';

const $ = id => document.getElementById(id);
const state = {store:null, mode:'recent', first:[], older:[], cursor:null, hasMore:false, hidden:new Set((() => { const v=readStorage('yes-sol-hidden',[]); return Array.isArray(v) ? v.filter(validId) : []; })()), feedUnsub:null, feedGeneration:0, loadingMore:false, threadGeneration:0, threadId:null, focused:null, replies:[], threadUnsubs:[], busyVotes:new Set(), lastPost:0, posting:false, replying:false, loaded:false, feedError:false};
let toastTimer, sparkIndex = Math.floor(Date.now()/86400000) % SPARKS.length;

function node(tag, className, text) { const e=document.createElement(tag); if(className)e.className=className; if(text !== undefined)e.textContent=text; return e; }
function button(className,text,action) { const e=node('button',className,text); e.type='button'; e.addEventListener('click',action); return e; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=setTimeout(()=>$('toast').hidden=true,4200); }
function empty(container,title,description,retry) { const box=node('div','empty-state'); box.append(node('h3','',title),node('p','',description)); if(retry)box.append(button('','Try again',retry)); container.replaceChildren(box); }
function setConnection(text,live=false) { $('connection').textContent=text; $('connection').classList.toggle('live',live); }
function allPosts() { return [...new Map([...state.older,...state.first].map(p=>[p.id,p])).values()]; }
function updateComposer(which) {
  const isReply=which==='reply', input=$(isReply?'reply':'statement'), count=Array.from(input.value.trim()).length;
  const label=$(isReply?'reply-chars':'post-count'); label.textContent=`${count} / ${MAX_LENGTH}`; label.classList.toggle('over',count>MAX_LENGTH);
  $(isReply?'reply-submit':'post-submit').disabled=!count || count>MAX_LENGTH || !state.store || (isReply ? state.replying || !state.focused : state.posting);
}
function draftKey(which,id=state.threadId) { return which==='reply' ? `yes-sol-reply:${id}` : 'yes-sol-draft'; }
function restoreDraft(which) { const value=readStorage(draftKey(which),''); $(which==='reply'?'reply':'statement').value=typeof value==='string'?value:''; updateComposer(which); }
for (const which of ['post','reply']) {
  const input=$(which==='reply'?'reply':'statement');
  input.addEventListener('input',()=>{updateComposer(which); const saved=writeStorage(draftKey(which),input.value); if(which==='post')$('draft-state').textContent=input.value ? saved?'Draft saved on this device.':'Draft stays here while this page is open.' : 'Keep it human. Make it yours.'; });
  input.addEventListener('keydown',e=>{if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){e.preventDefault(); if(!$(which==='reply'?'reply-submit':'post-submit').disabled)$(which==='reply'?'reply-form':'post-form').requestSubmit();}});
}
restoreDraft('post');
if($('statement').value)$('draft-state').textContent='Your draft is waiting for you.';

function createPost(post,{focused=false,inThread=false}={}) {
  const article=node('article','post'); article.dataset.postId=post.id;
  const voteStack=node('div','vote-stack'), chosen=getVote(post.id);
  const up=button('vote-button','↑',()=>vote(post.id,'upvote')), down=button('vote-button','↓',()=>vote(post.id,'downvote'));
  up.setAttribute('aria-label','Agree with this statement'); down.setAttribute('aria-label','Disagree with this statement');
  up.setAttribute('aria-pressed',String(chosen==='upvote')); down.setAttribute('aria-pressed',String(chosen==='downvote'));
  up.disabled=down.disabled=state.busyVotes.has(post.id) || !state.store;
  const score=node('span','vote-score',String(post.score)); score.setAttribute('aria-label',`Net score ${post.score}; ${post.upvotes} agree, ${post.downvotes} disagree`);
  voteStack.append(up,score,down);
  if(post.upvotes+post.downvotes){const ratio=node('div','sentiment'); ratio.title=`${post.upvotes} agree · ${post.downvotes} disagree`;const agree=node('span','agree'),disagree=node('span','disagree');agree.style.flex=String(post.upvotes);disagree.style.flex=String(post.downvotes);ratio.append(agree,disagree);voteStack.append(ratio);}
  const body=node('div','post-body'),meta=node('div','post-meta');
  meta.append(node('span','voice-label',`VOICE / ${post.id.slice(0,5).toUpperCase()}`));
  const time=node('time','',relativeTime(post.timestamp)); if(post.timestamp){time.dateTime=new Date(post.timestamp).toISOString();time.title=new Date(post.timestamp).toLocaleString();}meta.append(time);
  if(post.parentId)meta.append(node('span','reply-badge','A REPLY'));
  const text=node('p','post-text',post.text); // Never interpolate public content into HTML.
  const actions=node('div','post-actions');
  if(!focused)actions.append(button('conversation-button',inThread?'Follow this reply ↗':'Join the conversation ↗',()=>openThread(post.id)));
  else actions.append(button('conversation-button','Add your perspective ↓',()=>{$('reply').focus();}));
  actions.append(button('','Copy link',()=>share(post.id)));
  if(!inThread && !focused)actions.append(button('','Hide',()=>{state.hidden.add(post.id);writeStorage('yes-sol-hidden',[...state.hidden]);renderFeed();toast('Hidden on this device.');}));
  body.append(meta,text,actions);article.append(voteStack,body);return article;
}
function renderFeed() {
  const posts=visiblePosts(allPosts(),state.mode,$('search').value,state.hidden);
  $('restore-hidden').hidden=state.hidden.size===0;
  if(posts.length)$('feed').replaceChildren(...posts.map(p=>createPost(p)));
  else if(state.feedError)empty($('feed'),'The board is taking a breather.','We couldn’t load public posts. Your draft is still here.',startFeed);
  else if(state.loaded)empty($('feed'),$('search').value?'No matches in the loaded posts.':state.hidden.size?'Nothing to show here.':'A quiet board. A good moment.', $('search').value?'Try another phrase, clear the search, or load more voices.':state.hidden.size?'Try restoring hidden posts or loading more voices.':'Be the first to put a thought out there.');
  $('load-more').hidden=!state.hasMore || state.mode==='debate' && state.feedError;
  $('load-more').disabled=state.loadingMore;
  const captions={recent:'Recent voices, in real time.',love:'Highest net scores first.',hate:'Lowest net scores first.',debate:'Balanced disagreement among loaded recent posts.'};
  $('feed-caption').textContent=$('search').value ? `${posts.length} matches in ${allPosts().length} loaded posts.` : captions[state.mode];
}
function renderThreadPosts() {
  if(state.focused)$('focused-post').replaceChildren(createPost(state.focused,{focused:true,inThread:true}));
  $('reply-count').textContent=state.replies.length===60?'60 shown':String(state.replies.length);
  if(state.replies.length)$('replies').replaceChildren(...state.replies.map(p=>createPost(p,{inThread:true})));
  else empty($('replies'),'Room for another perspective.','Agree, disagree, or take it somewhere new.');
}
async function vote(id,type) {
  if(!state.store || state.busyVotes.has(id))return;
  state.busyVotes.add(id);
  document.querySelectorAll('[data-post-id]').forEach(e=>{if(e.dataset.postId===id)e.querySelectorAll('.vote-button').forEach(b=>b.disabled=true);});
  try {
    const result=await state.store.vote(id,type);if(!result)return;
    for(const key of ['first','older','replies'])state[key]=state[key].map(p=>p.id===id?result.post:p);
    if(state.focused?.id===id)state.focused=result.post;
    if(!result.remembered)toast('Vote saved. This browser couldn’t remember your selection.');
  } catch(error){toast(error.message || 'Your vote didn’t save. Try again.');}
  finally{state.busyVotes.delete(id);renderFeed();if(state.threadId)renderThreadPosts();}
}
async function share(id) {
  const url=new URL(location.href);url.hash=`thread=${id}`;
  try {await navigator.clipboard.writeText(url.href);toast('Conversation link copied.');}
  catch {const a=node('a','',url.href);a.href=url.href; const box=$('toast');clearTimeout(toastTimer);box.replaceChildren(document.createTextNode('Copy this link: '),a);box.hidden=false;toastTimer=setTimeout(()=>box.hidden=true,12000);}
}
function startFeed() {
  if(!state.store){boot();return;}
  state.feedUnsub?.(); const generation=++state.feedGeneration;
  state.first=[];state.older=[];state.cursor=null;state.hasMore=false;state.loaded=false;state.feedError=false;state.loadingMore=false;
  $('feed').setAttribute('aria-busy','true');setConnection('Connecting…');
  empty($('feed'),'Finding the conversation…','Connecting to the public board.');$('load-more').hidden=true;
  const timer=setTimeout(()=>{if(generation===state.feedGeneration && !state.loaded){state.feedError=true;setConnection('Connection is slow');$('feed').setAttribute('aria-busy','false');renderFeed();}},15000);
  state.feedUnsub=state.store.listenFeed(state.mode,result=>{
    if(generation!==state.feedGeneration)return;clearTimeout(timer);
    state.first=result.posts;state.loaded=true;state.feedError=false;
    if(!state.older.length){state.cursor=result.cursor;state.hasMore=result.hasMore;}
    $('feed').setAttribute('aria-busy','false');setConnection(result.cached?'Saved snapshot · reconnecting':'Live board',!result.cached);renderFeed();
  },()=>{
    if(generation!==state.feedGeneration)return;clearTimeout(timer);state.loaded=true;state.feedError=true;setConnection('Connection interrupted');$('feed').setAttribute('aria-busy','false');renderFeed();
  });
}
let booting=false;
async function boot() {
  if(booting)return;booting=true;setConnection('Connecting…');
  try{state.store=await connect();updateComposer('post');startFeed();readHash();}
  catch(error){setConnection('Offline');state.loaded=true;state.feedError=true;empty($('feed'),'The board is taking a breather.',error.message,boot);$('feed').setAttribute('aria-busy','false');}
  finally{booting=false;}
}
$('refresh').addEventListener('click',startFeed);
$('search').addEventListener('input',renderFeed);
$('restore-hidden').addEventListener('click',()=>{state.hidden.clear();writeStorage('yes-sol-hidden',[]);renderFeed();});
document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{if(state.mode===b.dataset.sort)return;state.mode=b.dataset.sort;document.querySelectorAll('[data-sort]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));startFeed();}));
$('load-more').addEventListener('click',async()=>{
  if(!state.store || !state.cursor || state.loadingMore)return;state.loadingMore=true;$('load-more').disabled=true;$('load-more').textContent='Loading voices…';const generation=state.feedGeneration;
  try{const result=await state.store.more(state.mode,state.cursor);if(generation!==state.feedGeneration)return;state.older.push(...result.posts);state.cursor=result.cursor;state.hasMore=result.hasMore;renderFeed();}
  catch{if(generation===state.feedGeneration)toast('More posts couldn’t load. Try again.');}
  finally{if(generation===state.feedGeneration){state.loadingMore=false;$('load-more').disabled=false;$('load-more').textContent='More voices ↓';}}
});

function resetThread() { ++state.threadGeneration;state.threadUnsubs.forEach(f=>f());state.threadUnsubs=[];state.threadId=null;state.focused=null;state.replies=[]; }
async function openThread(id,{writeHash=true}={}) {
  if(!validId(id)){toast('This conversation link is invalid.');return;}
  if(!state.store){toast('The board is still connecting.');return;}
  resetThread();state.threadId=id;const generation=state.threadGeneration;
  if(writeHash && location.hash!==`#thread=${id}`)history.pushState(null,'',`#thread=${id}`);
  $('ancestors').replaceChildren();$('focused-post').replaceChildren();$('replies').replaceChildren();$('reply-count').textContent='';$('reply-message').textContent='';
  empty($('focused-post'),'Opening the conversation…','One thought leads to another.');
  restoreDraft('reply');if(!$('thread-dialog').open)$('thread-dialog').showModal();document.body.style.overflow='hidden';
  const fail=()=>{if(generation!==state.threadGeneration)return;state.focused=null;empty($('focused-post'),'The conversation couldn’t load.','Check your connection and give it another try.',()=>openThread(id));updateComposer('reply');};
  const timer=setTimeout(()=>{if(generation===state.threadGeneration && !state.focused)fail();},15000);
  let loadedAncestors=false;
  state.threadUnsubs.push(state.store.listenPost(id,post=>{
    if(generation!==state.threadGeneration)return;clearTimeout(timer);state.focused=post;updateComposer('reply');
    if(!post){empty($('focused-post'),'This voice is no longer here.','The statement may have been removed.');return;}
    renderThreadPosts();if(!loadedAncestors){loadedAncestors=true;loadAncestors(post.parentId,generation);}
  },fail));
  state.threadUnsubs.push(state.store.listenReplies(id,replies=>{if(generation!==state.threadGeneration)return;state.replies=replies;if(state.focused)renderThreadPosts();},()=>{if(generation===state.threadGeneration)empty($('replies'),'Replies couldn’t load.','You can retry the conversation.',()=>openThread(id));}));
}
async function loadAncestors(parentId,generation) {
  const seen=new Set([state.threadId]),ancestors=[];let id=parentId;
  try{
    for(let i=0;i<12 && id && !seen.has(id);i++){seen.add(id);const post=await state.store.getPost(id);if(generation!==state.threadGeneration)return;if(!post)break;ancestors.unshift(post);id=post.parentId;}
    if(generation!==state.threadGeneration)return;
    const items=ancestors.map(p=>button('',`↳ ${p.text.length>160?p.text.slice(0,157)+'…':p.text}`,()=>openThread(p.id)));
    if(id && ancestors.length===12)items.unshift(button('','Continue further back ↗',()=>openThread(id)));
    $('ancestors').replaceChildren(...items);
  }catch{if(generation===state.threadGeneration)$('ancestors').replaceChildren(node('p','','Earlier statements couldn’t load.'))}
}
function finishThread() { resetThread();document.body.style.overflow='';if(location.hash.startsWith('#thread='))history.replaceState(null,'',location.pathname+location.search); }
function closeThread() { $('thread-dialog').close();finishThread(); }
$('close-thread').addEventListener('click',closeThread);
$('thread-dialog').addEventListener('cancel',event=>{event.preventDefault();closeThread();});
$('thread-dialog').addEventListener('click',e=>{if(e.target===$('thread-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)closeThread();}});
$('thread-dialog').addEventListener('close',()=>{if(!$('thread-dialog').open)finishThread();});
function readHash() {
  if(location.hash.startsWith('#thread=')){const id=location.hash.slice(8);if(validId(id))openThread(id,{writeHash:false});else toast('This conversation link is invalid.');}
  else if($('thread-dialog').open)closeThread();
}
window.addEventListener('hashchange',readHash);
window.addEventListener('popstate',readHash);

async function submit(which,event) {
  event.preventDefault();const isReply=which==='reply',input=$(isReply?'reply':'statement'),message=$(isReply?'reply-message':'post-message');message.textContent='';
  if(!state.store){message.textContent='Connect to the board before posting.';return;}
  if(state.posting || state.replying)return;
  let text;try{text=validateText(input.value);}catch(error){message.textContent=error.message;return;}
  if(Date.now()-state.lastPost<8000){message.textContent='Give that thought a moment to land. Try again in a few seconds.';return;}
  const parentId=isReply?state.threadId:null;if(isReply && !state.focused){message.textContent='This conversation isn’t available.';return;}
  const key=draftKey(which,parentId),generation=state.threadGeneration;
  state[isReply?'replying':'posting']=true;updateComposer(which);input.disabled=true;
  $(isReply?'reply-submit':'post-submit').textContent='Sending…';
  try{
    await state.store.post(text,parentId);state.lastPost=Date.now();writeStorage(key,'');
    // A slow reply request must never erase a draft in a different conversation.
    if(!isReply || generation===state.threadGeneration){input.value='';message.textContent=isReply?'Perspective added.':'Your thought is out there.';if(!isReply)$('draft-state').textContent='Keep it human. Make it yours.';}
    toast(isReply?'Reply posted.':'Yes. You said it.');
  }catch(error){if(!isReply || generation===state.threadGeneration)message.textContent=error.message || 'That didn’t send. Your draft is still here. Please try again.';}
  finally{state[isReply?'replying':'posting']=false;input.disabled=false;$(isReply?'reply-submit':'post-submit').textContent=isReply?'Reply ↗':'I said it ↗';updateComposer(which);}
}
$('post-form').addEventListener('submit',e=>submit('post',e));$('reply-form').addEventListener('submit',e=>submit('reply',e));
function showSpark(){$('spark-text').textContent=SPARKS[sparkIndex];}
showSpark();$('next-spark').addEventListener('click',()=>{sparkIndex=(sparkIndex+1)%SPARKS.length;showSpark();});
$('use-spark').addEventListener('click',()=>{if($('statement').value.trim()){toast('Your draft is already here. Clear it to use this starter.');$('statement').focus();return;}$('statement').value=SPARKS[sparkIndex];$('statement').dispatchEvent(new Event('input'));$('statement').focus();});
function themeButton(){const dark=document.documentElement.dataset.theme==='dark';$('theme').setAttribute('aria-pressed',String(dark));$('theme').setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');}
themeButton();$('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('yes-sol-theme',dark?'dark':'light')}catch{}themeButton();});
let musicOn=false;
$('music').addEventListener('click',async()=>{const audio=$('soundtrack');if(musicOn){audio.pause();musicOn=false;}else{try{audio.volume=.25;await audio.play();musicOn=true;}catch{toast('Music couldn’t play. Try again.');}}$('music').setAttribute('aria-pressed',String(musicOn));$('music').setAttribute('aria-label',musicOn?'Turn music off':'Turn music on');$('music').title=musicOn?'Music on':'Music off';});
document.addEventListener('visibilitychange',()=>{if(document.hidden && musicOn){$('soundtrack').pause();musicOn=false;$('music').setAttribute('aria-pressed','false');$('music').setAttribute('aria-label','Turn music on');$('music').title='Music off';}});
window.addEventListener('storage',event=>{if(event.key==='yesisaidit_votes'){renderFeed();if(state.threadId)renderThreadPosts();}});
window.addEventListener('offline',()=>setConnection('Offline · draft kept here'));
window.addEventListener('online',()=>{if(!state.store)boot();else startFeed();});
boot();
