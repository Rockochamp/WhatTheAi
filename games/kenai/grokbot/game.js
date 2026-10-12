(() => {
'use strict';
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const SAVE_KEY = 'kenai.save.v1';

const STAGES = [
  {name:'Newborn', img:'assets/stage0.webp', h:.55, xpNeed:100, feed:'bottle', play:'duck',  txt:'Ken.AI is a crawler now! Watch out, cables…'},
  {name:'Crawler', img:'assets/stage1.webp', h:.62, xpNeed:140, feed:'bottle', play:'duck',  txt:'First steps! Ken.AI is a toddler and wants porridge.'},
  {name:'Toddler', img:'assets/stage2.webp', h:.82, xpNeed:180, feed:'porridge', play:'robot', txt:'Ken.AI is a big kid with a robot backpack. AGI achieved (almost).'},
  {name:'Kid',     img:'assets/stage3.webp', h:.92, xpNeed:Infinity, feed:'porridge', play:'robot'},
];
const MOOD_IMG = {happy:'assets/mood_happy.webp',neutral:'assets/mood_neutral.webp',crying:'assets/mood_crying.webp',sleeping:'assets/mood_sleeping.webp',hungry:'assets/mood_hungry.webp',dirty:'assets/mood_dirty.webp'};
const NEEDS = [
  {k:'hunger', ic:'🍼', lbl:'Food',   decay:1.0},
  {k:'hygiene',ic:'🧷', lbl:'Diaper', decay:0.7},
  {k:'energy', ic:'🌙', lbl:'Sleep',  decay:0.55},
  {k:'fun',    ic:'🦆', lbl:'Fun',    decay:0.85},
  {k:'health', ic:'❤️', lbl:'Health', decay:0},
];
// item: effects, fx type, sound
const ITEMS = {
  bottle:  {lbl:'Bottle',  img:'assets/bottle.webp',  eff:{hunger:35, fun:3}, fx:'hearts', snd:'slurp', need:'hunger', minStage:0, maxStage:1},
  porridge:{lbl:'Porridge',img:'assets/porridge.webp',eff:{hunger:40, energy:4}, fx:'hearts', snd:'slurp', need:'hunger', minStage:2, maxStage:3},
  diaper:  {lbl:'Diaper',  img:'assets/diaper.webp',  eff:{hygiene:60, fun:4}, fx:'sparkle', snd:'chime', need:'hygiene'},
  blanket: {lbl:'Sleep',   img:'assets/blanket.webp', eff:{}, fx:'stars', snd:'lullaby', special:'sleep'},
  duck:    {lbl:'Duck',    img:'assets/duck.webp',    eff:{fun:30, energy:-5}, fx:'notes', snd:'squeak', need:'fun'},
  robot:   {lbl:'Robo',    img:'assets/robot.webp',   eff:{fun:34, energy:-6}, fx:'notes', snd:'beep', need:'fun', minStage:1},
  sponge:  {lbl:'Bath',    img:'assets/sponge.webp',  eff:{hygiene:30, health:6, fun:8}, fx:'bubbles', snd:'bubble', need:'hygiene'},
  medicine:{lbl:'Care',    img:'assets/medicine.webp',eff:{health:35, fun:-2}, fx:'hearts', snd:'chime', need:'health'},
};
const ORDER = ['bottle','porridge','diaper','blanket','duck','robot','sponge','medicine'];

let S; // state
function fresh(){ return {stage:0, xp:0, needs:{hunger:80,hygiene:85,energy:80,fun:75,health:100}, sleeping:false, speed:1, muted:false, t:Date.now(), age:0, started:false}; }
function load(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if(s&&s.needs) return Object.assign(fresh(),s); }catch(e){}
  return fresh();
}
function save(){ S.t=Date.now(); try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){} }
S = load();
if(Q.has('reset')) S=fresh();
if(Q.has('stage')) S.stage=Math.max(0,Math.min(3,+Q.get('stage')|0));

// gentle offline decay: 1/20 real rate, max 3h, never below 20
(function away(){
  const dt=Math.min((Date.now()-S.t)/1000,3*3600);
  if(dt>5 && S.started){
    for(const n of NEEDS){ if(!n.decay) continue; const d=n.decay*dt/20*(S.sleeping&&n.k==='energy'?-3:1); S.needs[n.k]=clamp(S.needs[n.k]-d, Math.min(S.needs[n.k],20),100); }
    if(S.sleeping && S.needs.energy>=100) S.sleeping=false;
    awayMsg = dt>60 ? `Welcome back! You were gone ${fmt(dt)}.` : null;
  }
})();
var awayMsg;
function fmt(s){ return s<3600? Math.round(s/60)+' min' : (s/3600).toFixed(1)+' h'; }
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

/* ---------- audio ---------- */
let AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function tone(f,dur,type='sine',vol=.15,when=0,slide=0){
  if(S.muted) return; const a=ac(); if(!a) return;
  const t=a.currentTime+when, o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.015); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+.05);
}
const SND = {
  giggle(){ [0,.09,.18,.27].forEach((w,i)=>tone(700+i*90+Math.random()*60,.08,'triangle',.12,w,1.3)); },
  chime(){ [880,1175,1568].forEach((f,i)=>tone(f,.45,'sine',.12,i*.07)); },
  slurp(){ for(let i=0;i<3;i++) tone(300+i*40,.12,'sine',.12,i*.13,2.2); setTimeout(SND.giggle,450); },
  squeak(){ tone(1400,.12,'square',.06,0,.6); tone(1500,.12,'square',.06,.16,.6); setTimeout(SND.giggle,350); },
  beep(){ [660,990,780,1320].forEach((f,i)=>tone(f,.09,'square',.06,i*.09)); setTimeout(SND.giggle,420); },
  bubble(){ for(let i=0;i<6;i++) tone(400+Math.random()*600,.07,'sine',.1,i*.06,2.5); },
  lullaby(){ [523,659,784,659,523].forEach((f,i)=>tone(f,.5,'sine',.09,i*.28)); },
  wake(){ [523,784,1046].forEach((f,i)=>tone(f,.25,'triangle',.1,i*.1)); },
  cry(){ tone(620,.7,'sawtooth',.05,0,.7); tone(640,.6,'sawtooth',.04,.75,.65); },
  nope(){ tone(220,.15,'square',.06); tone(180,.2,'square',.06,.15); },
  fanfare(){ [523,659,784,1046,784,1046,1318].forEach((f,i)=>tone(f,.3,'triangle',.12,i*.12)); },
  tap(){ tone(1000,.04,'sine',.06); },
};
function play(n){ (SND[n]||(()=>{}))(); }

/* ---------- UI build ---------- */
const needsEl=$('#needs'), trayEl=$('#tray'), babyImg=$('#babyImg'), baby=$('#baby'), wrap=$('#babyWrap'), stageEl=$('#stage'), fx=$('#fx'), ov=$('#overlay');
const bars={};
for(const n of NEEDS){ const d=document.createElement('div'); d.className='need'; d.innerHTML=`<div class="ic">${n.ic}</div>${n.lbl}<div class="bar"><i></i></div>`; needsEl.appendChild(d); bars[n.k]={el:d,i:d.querySelector('i')}; }
const itemEls={};
function buildTray(){
  trayEl.innerHTML='';
  const st=S.stage;
  const show=ORDER.filter(k=>{const it=ITEMS[k]; return st>=(it.minStage||0) && st<=(it.maxStage??3);});
  for(const k of show){ const it=ITEMS[k]; const b=document.createElement('button'); b.className='item'; b.dataset.k=k; b.innerHTML=`<img src="${it.img}" alt=""><span>${it.lbl}</span>`; trayEl.appendChild(b); itemEls[k]=b; bindDrag(b,k); }
  trayEl.style.gridTemplateColumns=`repeat(${Math.min(4,show.length)},1fr)`;
}

/* ---------- drag / tap ---------- */
let ghost=null, dragK=null, moved=false, sx=0, sy=0;
function overBaby(x,y){ const r=babyImg.getBoundingClientRect(); const pad=30; return x>r.left-pad&&x<r.right+pad&&y>r.top-pad&&y<r.bottom+pad; }
function bindDrag(el,k){
  el.addEventListener('pointerdown',e=>{ ac(); dragK=k; moved=false; sx=e.clientX; sy=e.clientY; el.setPointerCapture(e.pointerId); el.classList.add('sel'); });
  el.addEventListener('pointermove',e=>{
    if(dragK!==k) return;
    if(!moved && Math.hypot(e.clientX-sx,e.clientY-sy)>10){ moved=true; ghost=document.createElement('img'); ghost.id='ghost'; ghost.src=ITEMS[k].img; document.body.appendChild(ghost); }
    if(moved){ ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px'; wrap.classList.toggle('target',overBaby(e.clientX,e.clientY)); }
  });
  const end=e=>{
    if(dragK!==k) return; el.classList.remove('sel'); wrap.classList.remove('target');
    if(moved){ if(ghost){ghost.remove();ghost=null;} if(e.type==='pointerup'&&overBaby(e.clientX,e.clientY)) use(k); }
    else if(e.type==='pointerup') use(k); // tap = use
    dragK=null;
  };
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end);
}
// tapping baby = tickle
wrap.style.pointerEvents='auto';
babyImg.style.pointerEvents='auto';
babyImg.addEventListener('pointerdown',()=>{ ac(); if(S.sleeping){ toast('Shhh… Ken.AI is sleeping 😴'); return;} bounce(); S.needs.fun=clamp(S.needs.fun+3,0,100); play('giggle'); burst('hearts',4); floatTxt('+3 Fun'); });

/* ---------- actions ---------- */
function use(k){
  const it=ITEMS[k]; const N=S.needs;
  if(it.special==='sleep'){
    S.sleeping=!S.sleeping;
    if(S.sleeping){ play('lullaby'); burst('stars',10); toast('Good night, Ken.AI 🌙'); }
    else { play('wake'); toast('Rise and shine! ☀️'); bounce(); }
    render(); save(); return;
  }
  if(S.sleeping){ nope(); toast('Let him sleep! Tap 🛏 again to wake.'); return; }
  if(it.need && N[it.need]>=95){ nope(); toast(it.need==='hunger'?'Too full! 🙅':it.need==='fun'?'Needs a break…':'Already perfect ✨'); return; }
  const parts=[];
  for(const [n,v] of Object.entries(it.eff)){ N[n]=clamp(N[n]+v,0,100); if(v>0) parts.push(`+${v} ${NEEDS.find(x=>x.k===n).lbl}`); }
  if(it.need==='hunger') N.hygiene=clamp(N.hygiene-8,0,100); // what goes in…
  S.xp+=2*(STAGES[S.stage].xpNeed===Infinity?0:1);
  play(it.snd); bounce(); burst(it.fx,14); parts.forEach((p,i)=>setTimeout(()=>floatTxt(p),i*220));
  render(); save();
}
function nope(){ baby.classList.remove('nope','bounce'); void baby.offsetWidth; baby.classList.add('nope'); play('nope'); setTimeout(()=>baby.classList.remove('nope'),500); }
function bounce(){ baby.classList.remove('bounce','nope'); void baby.offsetWidth; baby.classList.add('bounce'); setTimeout(()=>baby.classList.remove('bounce'),600); }

/* ---------- particles ---------- */
const FX={hearts:['💖','💕','💗'],sparkle:['✨','⭐','💫'],stars:['⭐','🌟','✨','🌙'],notes:['🎵','🎶','✨'],bubbles:['🫧','○','◯']};
function center(){ const r=babyImg.getBoundingClientRect(), s=stageEl.getBoundingClientRect(); return {x:r.left-s.left+r.width/2, y:r.top-s.top+r.height*.4, w:r.width}; }
function burst(type,n){
  const c=center(); const set=FX[type]||FX.hearts;
  for(let i=0;i<n;i++){
    const p=document.createElement('div'); p.className='p'; let ch=set[i%set.length];
    if(type==='bubbles'){ p.style.cssText+=`width:${10+Math.random()*24}px;height:${0}px;`; const s=10+Math.random()*26; p.style.width=p.style.height=s+'px'; p.style.borderRadius='50%'; p.style.background='radial-gradient(circle at 30% 30%,#fff,rgba(160,230,255,.5) 40%,rgba(120,200,255,.15) 70%)'; p.style.border='1px solid rgba(255,255,255,.7)'; ch=''; }
    p.textContent=ch; p.style.fontSize=(18+Math.random()*18)+'px'; p.style.left=c.x+'px'; p.style.top=c.y+'px';
    fx.appendChild(p);
    const a=Math.random()*Math.PI*2, d=60+Math.random()*c.w*.7, dx=Math.cos(a)*d, dy=Math.sin(a)*d*.7-60-Math.random()*60;
    p.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:`translate(calc(-50% + ${dx*.4}px),calc(-50% + ${dy*.4}px)) scale(1.2)`,opacity:1,offset:.25},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.8) rotate(${(Math.random()-.5)*90}deg)`,opacity:0}],{duration:1100+Math.random()*700,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>p.remove();
  }
}
function floatTxt(t){ const c=center(); const d=document.createElement('div'); d.className='float'; d.textContent=t; d.style.left=(c.x+(Math.random()-.5)*60)+'px'; d.style.top=(c.y-40)+'px'; fx.appendChild(d); setTimeout(()=>d.remove(),1400); }
let toastT; function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>e.classList.remove('show'),2200); }

/* ---------- mood & render ---------- */
function mood(){
  const N=S.needs; if(S.sleeping) return 'sleeping';
  const min=Math.min(N.hunger,N.hygiene,N.energy,N.fun,N.health);
  if(min<15) return 'crying';
  if(N.hygiene<35) return 'dirty';
  if(N.hunger<35) return 'hungry';
  if(N.energy<25) return 'tired';
  if(N.health<40) return 'sick';
  if(N.fun<35) return 'bored';
  const avg=(N.hunger+N.hygiene+N.energy+N.fun+N.health)/5;
  return avg>68 ? 'happy':'neutral';
}
let lastMood='', lastStage=-1, cryT=0;
function render(){
  const N=S.needs;
  for(const n of NEEDS){ const v=N[n.k]; const b=bars[n.k]; b.i.style.width=v+'%'; b.i.style.background= v<25?'linear-gradient(90deg,#ff3b6b,#ff7a59)': v<50?'linear-gradient(90deg,#ffb84f,#ffe066)':'linear-gradient(90deg,#00c2d9,#2ff3ff)'; b.el.classList.toggle('low',v<25); }
  const st=STAGES[S.stage];
  const frac= st.xpNeed===Infinity?1:S.xp/st.xpNeed;
  $('#thriveFill').style.width=(frac*100)+'%'; $('#thriveTxt').textContent= st.xpNeed===Infinity?'MAX':Math.floor(frac*100)+'%';
  $('#stageName').textContent=st.name;
  $('#btnSpeed').textContent=S.speed+'×'; $('#btnMute').textContent=S.muted?'🔇':'🔊';
  const m=mood();
  if(m!==lastMood||S.stage!==lastStage){
    lastMood=m;
    if(S.stage!==lastStage){ lastStage=S.stage; buildTray(); wrap.style.height=(st.h*68)+'%'; }
    // toddler stage uses the dedicated mood sheet
    const moodSheet = S.stage===2 && MOOD_IMG[m];
    babyImg.src = moodSheet ? MOOD_IMG[m] : (S.stage===2 ? MOOD_IMG.neutral : st.img);
    stageEl.className=''; stageEl.classList.add(m==='crying'?'crying':m==='happy'?'happy':m==='sleeping'?'sleeping':'m-'+m);
    drawOverlay(m, !!moodSheet);
  }
  // hint which item is needed
  const want={hungry:STAGES[S.stage].feed,dirty:'diaper',tired:'blanket',sick:'medicine',bored:STAGES[S.stage].play}[m];
  let cryNeed=null; if(m==='crying'){ const k=NEEDS.reduce((a,b)=>N[a.k]<N[b.k]?a:b).k; cryNeed={hunger:STAGES[S.stage].feed,hygiene:'diaper',energy:'blanket',fun:STAGES[S.stage].play,health:'medicine'}[k]; }
  for(const [k,el] of Object.entries(itemEls)) if(el.isConnected) el.classList.toggle('hint',k===(want||cryNeed));
}
function drawOverlay(m, sheet){
  ov.innerHTML='';
  const add=(cls,html,css)=>{const d=document.createElement('div'); d.className='ov '+cls; d.innerHTML=html||''; d.style.cssText+=css; ov.appendChild(d); return d;};
  if(m==='sleeping'){ for(let i=0;i<3;i++){ const z=add('zzz','Z',`right:${2+i*3}%;top:${8+i*4}%;animation-delay:${i*.8}s`);} }
  if(sheet && m!=='sleeping') return; // toddler mood sprite already shows it
  if(m==='crying'){ const eyeY=S.stage===0?'30%':'22%'; for(let i=0;i<4;i++) add('tear','',`left:${i%2?58:36}%;top:${eyeY};animation-delay:${i*.25}s`); add('emote','😭','left:68%;top:-4%'); }
  if(m==='dirty'){ for(let i=0;i<4;i++) add('stink','',`left:${[5,72,12,80][i]}%;top:${[45,40,70,68][i]}%;animation-delay:${i*.6}s`); add('emote','💩','left:68%;top:-4%'); }
  if(m==='hungry') add('emote','🍼','left:68%;top:-4%');
  if(m==='tired') add('emote','🥱','left:68%;top:-4%');
  if(m==='sick')  add('emote','🤒','left:68%;top:-4%');
  if(m==='bored') add('emote','🧸?','left:66%;top:-4%');
  if(m==='happy' && S.stage!==2) add('emote','😊','left:70%;top:-2%;font-size:1.8rem');
}

/* ---------- loop ---------- */
let last=performance.now(), saveAcc=0, running=false, evolving=false;
function tick(now){
  const dt=Math.min(.25,(now-last)/1000)*S.speed; last=now;
  if(running && !evolving){
    const N=S.needs, sl=S.sleeping;
    const stageMul=1+S.stage*.12; // older kids need a bit more
    N.hunger -=1.0*dt*stageMul*(sl?.4:1);
    N.hygiene-=0.7*dt*(sl?.5:1);
    N.energy += sl? 4.5*dt : -0.55*dt*stageMul;
    N.fun    -= sl? 0 : 0.85*dt*stageMul;
    const low=[N.hunger,N.hygiene,N.energy,N.fun].filter(v=>v<20).length;
    N.health += low? -0.5*low*dt : (Math.min(N.hunger,N.hygiene,N.energy,N.fun)>50?0.25*dt:0);
    for(const k in N) N[k]=clamp(N[k],0,100);
    if(sl && N.energy>=100){ S.sleeping=false; play('wake'); toast('Ken.AI woke up refreshed! ☀️'); }
    const avg=(N.hunger+N.hygiene+N.energy+N.fun+N.health)/5;
    const st=STAGES[S.stage];
    if(st.xpNeed!==Infinity){
      if(avg>=60) S.xp+= dt*(avg>=80?1.6:1);
      else if(avg<35) S.xp=Math.max(0,S.xp-dt*.5);
      if(S.xp>=st.xpNeed) evolve();
    }
    S.age+=dt;
    const m=mood();
    if(m==='crying'){ cryT-=dt/S.speed; if(cryT<=0){ play('cry'); cryT=4; } } else cryT=0;
    saveAcc+=dt/S.speed; if(saveAcc>3){ saveAcc=0; save(); }
    render();
  }
  requestAnimationFrame(tick);
}
function evolve(){
  if(S.stage>=3) return;
  evolving=true; S.stage++; S.xp=0; S.sleeping=false;
  for(const k in S.needs) S.needs[k]=Math.max(S.needs[k],70);
  save();
  $('#evoImg').src=STAGES[S.stage].img; $('#evoTxt').textContent=STAGES[S.stage-1].txt;
  $('#evolve').classList.remove('hidden'); play('fanfare');
  confetti();
}
function confetti(){
  const host=$('#evolve'); const cols=['#2ff3ff','#ff4fd8','#ffe066','#7cff8a','#fff'];
  for(let i=0;i<70;i++){ const p=document.createElement('div'); p.className='p'; p.style.cssText=`left:${Math.random()*100}%;top:-20px;width:${6+Math.random()*6}px;height:${10+Math.random()*8}px;background:${cols[i%5]};border-radius:2px;z-index:1`; host.appendChild(p);
    p.animate([{transform:`translateY(0) rotate(0)`},{transform:`translate(${(Math.random()-.5)*160}px,${innerHeight+40}px) rotate(${Math.random()*900}deg)`}],{duration:2200+Math.random()*2200,delay:Math.random()*900,easing:'cubic-bezier(.3,.6,.6,1)',fill:'forwards'}).onfinish=()=>p.remove(); }
}
$('#btnEvoOk').onclick=()=>{ $('#evolve').classList.add('hidden'); evolving=false; lastStage=-1; render(); bounce(); burst('stars',16); play('giggle'); };

/* ---------- screens & controls ---------- */
function start(){ ac(); S.started=true; $('#title').classList.add('hidden'); $('#game').classList.remove('hidden'); running=true; lastStage=-1; lastMood=''; render(); play('chime'); if(awayMsg){toast(awayMsg); awayMsg=null;} save(); }
$('#btnStart').onclick=start;
$('#btnReset').onclick=()=>{ if(confirm('Start over with a brand-new baby?')){ const m=S.muted; S=fresh(); S.muted=m; save(); $('#btnStart').textContent='▶ Start'; toast('New baby!'); } };
if(S.started && (S.stage>0||S.xp>0)) $('#btnStart').textContent='▶ Continue';
$('#btnHome').onclick=()=>{ running=false; save(); $('#game').classList.add('hidden'); $('#title').classList.remove('hidden'); $('#btnStart').textContent='▶ Continue'; };
const SPEEDS=DEBUG?[1,2,4,10,30]:[1,2,4];
$('#btnSpeed').onclick=()=>{ S.speed=SPEEDS[(SPEEDS.indexOf(S.speed)+1)%SPEEDS.length]||1; toast(`Time speed ${S.speed}×`); render(); save(); };
$('#btnMute').onclick=()=>{ S.muted=!S.muted; render(); save(); if(!S.muted) play('tap'); };
document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); else { last=performance.now(); } });
window.addEventListener('pagehide',save);

if(DEBUG){
  const d=$('#debug'); d.classList.remove('hidden');
  const btn=(t,f)=>{const b=document.createElement('button'); b.textContent=t; b.onclick=f; d.appendChild(b);};
  btn('+XP',()=>{S.xp+=STAGES[S.stage].xpNeed*.34;}); btn('Evolve',()=>{S.xp=1e9;});
  btn('Drain',()=>{for(const k in S.needs) S.needs[k]=10;}); btn('Dirty',()=>{S.needs.hygiene=20;}); btn('Reset',()=>{S=fresh();S.started=true;lastStage=-1;});
  if(Q.has('speed')) S.speed=+Q.get('speed')||1;
  if(Q.has('needs')){ const v=Q.get('needs').split(',').map(Number); NEEDS.forEach((n,i)=>{ if(!isNaN(v[i])) S.needs[n.k]=v[i]; }); }
  if(Q.has('sleep')) S.sleeping=true;
}
if(Q.has('autostart')) start();
if(DEBUG && Q.has('evolve')) setTimeout(()=>{S.xp=1e9;},300);
render();
requestAnimationFrame(tick);
})();
