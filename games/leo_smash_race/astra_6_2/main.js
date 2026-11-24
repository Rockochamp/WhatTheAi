import { DT, DRIVERS, TABLES, clamp, start, step } from './sim.js';
import { Display } from './render.js';
import { RaceSound } from '../sol/audio.js?v=2';

const $ = id=>document.getElementById(id);
const number=new Intl.NumberFormat('en');
const text=(tag,value,cls)=>{const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node;};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('ricochet-v1:'+key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem('ricochet-v1:'+key,JSON.stringify(value));}catch{/* A private session can still race. */}};
let driver=DRIVERS.find(d=>d.id===read('driver',''))||DRIVERS[0];
let table=TABLES.find(t=>t.id===read('table',''))||TABLES[0];
const sound=new RaceSound(read('sound',true)===true,true);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const view=new Display($('track'));
const dialog=$('panel');
let race=null, mode='garage', beforePause='running', clock=0, countdown=0, previousStamp=0, frame=0, nextNote=0, noteIndex=0;
let samples=[], ghost=null, noticeUntil=0, noticePriority=0;
const sampleTicks=12;
let ticks=0;
const keyboard=new Set(), pointers=new Map();
let pinPressed=false, powerPressed=false, garageFocus=null;
const fmtTime=t=>t.toFixed(2)+' s';
const recordKey=(t=table,d=driver)=>'record:'+t.id+':'+d.id;
const getRecord=(t=table,d=driver)=>read(recordKey(t,d),{});
function choose(container,items,kind){
  for(const item of items){
    const b=document.createElement('button');b.type='button';b.className='choice '+kind+'-choice';b.dataset.id=item.id;
    const art=document.createElement('span');art.className='art-frame';
    const img=new Image();img.alt='';img.src=item.portrait||'art/'+item.id+'.webp';art.append(img);b.append(art,text('b',item.name),text('small',item.power||item.tag));
    if(item.color)b.style.setProperty('--wash',item.color+'77');
    b.addEventListener('click',()=>{
      sound.unlock();sound.fx('touch');
      if(kind==='driver'){driver=item;save('driver',item.id);}else{table=item;save('table',item.id);}
      refresh();
    });
    container.append(b);
  }
}
function refresh(){
  for(const [id,selected] of [['drivers',driver],['tables',table]])for(const b of $(id).children)b.setAttribute('aria-pressed',String(b.dataset.id===selected.id));
  $('move-name').textContent=driver.power;$('move-detail').textContent=driver.hint;
  document.querySelector('[data-sound]').setAttribute('aria-pressed',String(sound.enabled));
}
choose($('drivers'),DRIVERS,'driver');choose($('tables'),TABLES,'table');refresh();
$('assist').checked=read('assist',true)!==false;
$('assist').addEventListener('change',()=>save('assist',$('assist').checked));
function toggleSound(){sound.set(!sound.enabled);save('sound',sound.enabled);nextNote=0;refresh();}
document.querySelector('[data-sound]').onclick=toggleSound;
function panel(tag,title,body,buttons){
  $('panel-tag').textContent=tag;$('panel-title').textContent=title;
  $('panel-body').replaceChildren(...body);$('panel-actions').replaceChildren();
  for(const [name,fn,primary] of buttons){
    const b=text('button',name,primary?'primary':'secondary');b.type='button';
    b.onclick=()=>{dialog.close();fn?.();};$('panel-actions').append(b);
  }
  dialog.setAttribute('aria-labelledby','panel-title');
  if(!dialog.open)dialog.showModal();
  $('panel-actions').querySelector('button')?.focus({preventScroll:true});
}
function help(){
  const list=document.createElement('ul');list.className='instructions';
  for(const line of ['Steer with A / D, the arrow keys or the two arrow buttons. Your toy runs forward by itself.',
    'Tap Ricochet or Space to launch in the direction you last steered. A rail or a star bumper bounces you across the table.',
    'Smash crates and collect purple gems to charge your special. Tap the crystal button or press E when it lights up.',
    'Pick up three gold keys, then drive into a vault for 1,000 points and a full special. Unspent keys carry to the next vault.'])list.append(text('li',line));
  panel('How to play','Hit the rails',[list],[['Got it',null,true]]);
}
document.querySelector('[data-help]').onclick=help;
function records(){
  const body=[text('p','Best score and fastest finish on this device for '+driver.name+'.')];
  for(const t of TABLES){
    const rec=getRecord(t),row=text('div','','record-row');
    row.append(text('b',t.name),text('span',rec.bestTime ? number.format(rec.bestScore)+' · '+fmtTime(rec.bestTime) : 'No finish yet'));body.push(row);
  }
  panel('Table records',driver.name,body,[['Back to garage',null,true]]);
}
$('records').onclick=records;
function clearInput(){keyboard.clear();pointers.clear();pinPressed=powerPressed=false;document.querySelectorAll('.held').forEach(el=>el.classList.remove('held'));}
function begin(){
  if(dialog.open)dialog.close();
  if(mode==='garage')garageFocus=document.activeElement;
  cancelAnimationFrame(frame);clearInput();sound.unlock();sound.restart();
  race=start(driver.id,table.id,$('assist').checked);
  const rec=getRecord();
  ghost=Array.isArray(rec.trace)&&rec.trace.length>=2&&rec.trace.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)) ? rec.trace : null;
  samples=[[0,0]];ticks=0;noticePriority=0;noticeUntil=0;
  $('callout').textContent='';$('garage').hidden=true;$('race').hidden=false;document.body.classList.add('racing');
  $('table-name').textContent=table.name;$('power-label').textContent=driver.power;
  countdown=2.35;clock=0;noteIndex=nextNote=0;mode='countdown';previousStamp=0;view.effects=[];view.shake=0;
  view.resize();$('countdown').hidden=false;$('countdown').textContent='3';hud();
  $('pause').focus({preventScroll:true});sound.fx('ready');frame=requestAnimationFrame(loop);
}
$('play').onclick=begin;$('launch').onclick=begin;
function garage(){
  cancelAnimationFrame(frame);clearInput();mode='garage';sound.stop();
  $('race').hidden=true;$('garage').hidden=false;document.body.classList.remove('racing');race=null;refresh();
  if(garageFocus?.isConnected)garageFocus.focus({preventScroll:true});
}
function announce(message,duration=1.05,priority=1){
  if(noticeUntil>race.time && priority<noticePriority)return;
  $('callout').textContent=message;noticeUntil=race.time+duration;noticePriority=priority;
}
function event(e){
  view.react(race,e,reduced.matches);
  switch(e.kind){
    case 'power':sound.fx('special');announce(driver.power,1.25,4);break;
    case 'fork':case 'slam':sound.fx('punch',{index:race.pulse-1});break;
    case 'bank':case 'bumper':sound.fx('boost');announce(e.kind==='bank'?'Bank shot!':'Pop bumper!',.72);break;
    case 'pin':sound.fx('jump');break;
    case 'smash':sound.fx('smash',{combo:race.combo});if(race.combo>=3)announce('Smash ×'+race.combo,.72);break;
    case 'gem':sound.fx('pickup');break;
    case 'key':sound.fx('pickup',{object:{kind:'ring'}});announce(race.keys===3?'Vault ready!':'Key '+race.keys+' / 3',.95,2);break;
    case 'locked':announce('Vault needs 3 keys',.9,2);break;
    case 'jackpot':sound.fx('finish');announce('Vault jackpot +1,000',1.45,5);break;
    case 'pad':sound.fx('boost');break;
    case 'overtake':sound.fx('pass');break;
    case 'finish':sound.fx('finish');break;
  }
}
function row(label,value){const d=text('div','','result-row');d.append(text('span',label),text('b',value));return d;}
function finish(){
  mode='result';clearInput();sound.stop();
  const rec=getRecord(), fastest=!rec.bestTime||race.time<rec.bestTime, high=!rec.bestScore||race.score>rec.bestScore;
  const result={bestTime:fastest?race.time:rec.bestTime,bestScore:high?race.score:rec.bestScore,trace:fastest?samples:rec.trace};
  save(recordKey(),result);
  const score=text('div',number.format(race.score)+' pts','result-score');
  const details=[score,row('Race time',fmtTime(race.time)),row('Smashes / rail & bumper hits',race.smashes+' / '+race.banks),row('Best chain / vaults','×'+race.bestCombo+' / '+race.vaults)];
  if(fastest)details.push(text('p','New fastest run. Chase your ghost on this table next time.'));
  panel(table.name+' · '+driver.name,['','First place!','Second place!','Third place!'][race.place],details,[
    ['Race again',begin,true],['Next table',()=>{table=TABLES[(TABLES.indexOf(table)+1)%TABLES.length];save('table',table.id);begin();}],['Garage',garage],
  ]);
}
function pause(){
  if(mode!=='running' && mode!=='countdown')return;
  beforePause=mode;mode='paused';cancelAnimationFrame(frame);clearInput();sound.stop();
  const actions=[['Resume',resume,true],[sound.enabled?'Mute sound':'Enable sound',()=>{toggleSound();mode=beforePause;pause();}],['Restart',begin],['Garage',garage]];
  panel(table.name,'Paused',[text('p',driver.name+' · '+number.format(race.score)+' points')],actions);
}
function resume(){if(mode!=='paused')return;mode=beforePause;previousStamp=0;nextNote=0;frame=requestAnimationFrame(loop);$('pause').focus({preventScroll:true});}
$('pause').onclick=pause;
dialog.addEventListener('cancel',e=>{
  if(mode==='paused'||mode==='result'){e.preventDefault();dialog.close();if(mode==='paused')resume();else garage();}
});
const motionKeys=new Set(['ArrowLeft','ArrowRight','KeyA','KeyD','Space','KeyE','ArrowUp']);
window.addEventListener('keydown',e=>{
  if(dialog.open || (mode!=='running' && mode!=='countdown'))return;
  if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();pause();return;}
  if(!motionKeys.has(e.code))return;e.preventDefault();
  keyboard.add(e.code);
  if(!e.repeat && mode==='running'){if(e.code==='Space')pinPressed=true;if(e.code==='KeyE'||e.code==='ArrowUp')powerPressed=true;}
});
window.addEventListener('keyup',e=>keyboard.delete(e.code));
for(const b of document.querySelectorAll('[data-steer]')){
  b.onpointerdown=e=>{
    if(mode!=='running' && mode!=='countdown')return;
    e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,Number(b.dataset.steer));b.classList.add('held');
  };
  b.onlostpointercapture=e=>{pointers.delete(e.pointerId);b.classList.remove('held');};
}
$('bank-btn').onclick=()=>{if(mode==='running')pinPressed=true;};
$('power-btn').onclick=()=>{if(mode==='running')powerPressed=true;};
const canvas=$('track');
function drag(e){
  const center=canvas.getBoundingClientRect().left+view.w/2,worldX=clamp((e.clientX-center)/view.base,-193,193);
  pointers.set(e.pointerId,clamp((worldX-race.x)/30,-1,1));
}
canvas.onpointerdown=e=>{if(mode==='running'){canvas.setPointerCapture(e.pointerId);drag(e);}};
canvas.onpointermove=e=>{if(race && canvas.hasPointerCapture(e.pointerId))drag(e);};
canvas.onlostpointercapture=e=>pointers.delete(e.pointerId);
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',()=>{if(race){view.resize();view.draw(race,0,reduced.matches,ghostAt());}});
function ghostAt(){
  if(!ghost)return null;
  const i=Math.floor(ticks/sampleTicks),a=ghost[i],b=ghost[i+1];
  if(!a||!b)return null;
  const f=(ticks%sampleTicks)/sampleTicks;
  return {x:a[0]+(b[0]-a[0])*f,s:a[1]+(b[1]-a[1])*f};
}
function hud(){
  const progress=clamp(race.s/table.length,0,1);
  $('distance').style.transform='scaleX('+progress+')';$('distance').parentElement.setAttribute('aria-valuenow',Math.round(progress*100));
  $('place').textContent=race.place+' / 3';$('score').textContent=number.format(race.score);
  $('keys').textContent='Vault keys · '+race.keys+' / 3';$('chain').textContent=race.combo>=2?'Smash ×'+race.combo:'';
  const ready=race.energy>=99.99&&!race.powerTime;
  $('bank-btn').disabled=race.pinWait>0;$('bank-btn').classList.toggle('ready',!race.pinWait);
  $('power-btn').disabled=!ready;$('power-btn').classList.toggle('ready',ready);$('power-level').textContent=ready?'Ready · E':Math.floor(race.energy)+'%';
  if(race.time>noticeUntil)$('callout').textContent='';
}
function music(){
  if(!sound.enabled || sound.ctx?.state!=='running')return;
  const now=sound.ctx.currentTime;
  if(nextNote<now)nextNote=now+.025;
  while(nextNote<now+.13){sound.scheduleNote(nextNote,noteIndex++,race.rush>0||race.s/table.length>.78);nextNote+=60/144/4;}
}
function loop(stamp){
  if(!race || (mode!=='countdown'&&mode!=='running'))return;
  const dt=previousStamp?Math.min(.09,(stamp-previousStamp)/1000):0;previousStamp=stamp;
  if(mode==='countdown'){
    const prev=Math.ceil(countdown);countdown-=dt;
    if(countdown<=0){mode='running';$('countdown').hidden=true;sound.fx('go');announce('Go!',.75,2);}
    else if(prev!==Math.ceil(countdown)){sound.fx('ready');$('countdown').textContent=Math.ceil(countdown);}
  }else{
    clock+=dt;
    while(clock>=DT && !race.finished){
      const keyAxis=Number(keyboard.has('ArrowRight')||keyboard.has('KeyD'))-Number(keyboard.has('ArrowLeft')||keyboard.has('KeyA'));
      const steer=clamp(keyAxis+[...pointers.values()].reduce((a,b)=>a+b,0),-1,1);
      step(race,{steer,pin:pinPressed,power:powerPressed});pinPressed=false;powerPressed=false;clock-=DT;ticks++;
      if(ticks%sampleTicks===0)samples.push([Math.round(race.x),Math.round(race.s)]);
      race.events.forEach(event);
    }
    music();hud();
  }
  view.draw(race,dt,reduced.matches,ghostAt());
  if(race.finished){finish();return;}
  frame=requestAnimationFrame(loop);
}
