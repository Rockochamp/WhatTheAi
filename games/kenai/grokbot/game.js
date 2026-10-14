/* Ken.AI v2 — "A Life". Static, no dependencies. Data in data.js, art in assets.js (KEN_ASSETS). */
(function(){
'use strict';
const D=window.KEN_DATA, ART=window.KEN_ART, ASSETS=window.KEN_ASSETS;
/* tech epochs (epochs.js): merge era actions and tech events into the data tables */
const EP={};for(const e of (window.KEN_EPOCHS||[])){EP[e.stage]=e;for(const a of e.actions)if(!D.ACTIONS.some(x=>x.id===a.id))D.ACTIONS.push(a);D.EVENTS[e.stage]=(D.EVENTS[e.stage]||[]).concat(e.events.map(v=>Object.assign({tech:1},v)));}
D.EVENTS.any.push({t:'Outage day',x:'A global cloud outage. Ken\'s assistants, agents and smart home all go silent.',minTech:65,tech:1,c:[{l:'Enjoy a quiet analog day',e:{happy:3,tech:-5,moment:'Survived an outage day'}},{l:'Panic and wait for the fix',e:{happy:-4,money:-200,moment:'Survived an outage day'}}]});
D.TRAITS.selfmade=D.TRAITS.selfmade||{l:'Self-made',mod:{energy:.95}};
const YEAR0=2026;
const SAVE_KEY='kenai.v2.save', BEST_KEY='kenai.v2.best', SCHEMA=2;
const DEBUG=/[?&]debug=1\b/.test(location.search);
const SPEEDS=[1,2,4];
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=Math.random;
const pick=a=>a[Math.floor(rnd()*a.length)];
const ALL_NEEDS=Object.keys(D.NEEDS);

/* ---------------- state ---------------- */
function freshLife(name){
  const needs={};for(const k of ALL_NEEDS) needs[k]=D.NEEDS[k].inv?15:80;
  return {schema:SCHEMA,name:(name||'Ken').trim().slice(0,16)||'Ken',age:0,needs,health:100,base:100,money:0,happy:60,happySum:0,happyN:0,
    rel:10,partner:false,kids:0,careerPeak:0,traits:{},ills:{},achs:[],cds:{},nextEvent:yearsToSec(.4+rnd()*.4),hospital:0,
    lastSleep:-99,tech:50,techSum:0,techN:0,moments:[],legacy:0,plush:0,exo:0,tutorRun:0,warnT:-99,alive:true,cause:'',stageIdx:0,seenStage:0,t:0,events:0};
}
function yearsToSec(y){return y*D.YEAR_SECONDS;}
let S=null, settings={speed:1,muted:false};
function load(){
  try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s&&s.schema===SCHEMA&&s.alive)return Object.assign(freshLife(s.name),s);
    if(s&&s.schema!==SCHEMA) return migrate(s);}catch(e){}
  return null;
}
function migrate(s){ /* only schema 2 exists; older or unknown saves are discarded safely */ return null; }
function save(){ try{ if(S) localStorage.setItem(SAVE_KEY,JSON.stringify(S)); localStorage.setItem('kenai.v2.settings',JSON.stringify(settings)); }catch(e){} }
try{Object.assign(settings,JSON.parse(localStorage.getItem('kenai.v2.settings')||'{}'));}catch(e){}
function bests(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'[]')}catch(e){return []}}

/* ---------------- helpers ---------------- */
const stage=()=>D.STAGES[S.stageIdx];
function stageIdxForAge(a){let i=0;D.STAGES.forEach((s,j)=>{if(a>=s.from)i=j});return i;}
function traitMod(k){let m=1;for(const t in S.traits){const T=D.TRAITS[t];if(T&&T.mod[k])m*=T.mod[k];}return m;}
function needVal(k){ if(k==='health') return S.health; if(k==='money'){const st=stage();return clamp(S.money/(st.moneyTarget||1000)*100,0,100);} return S.needs[k]; }
function goodness(k){const v=needVal(k);return D.NEEDS[k].inv?100-v:v;}
function isBad(k){return goodness(k)<15;}
function addAch(a){ if(!S.achs.includes(a)){S.achs.push(a);toast('🏆 '+a);play('fanfare');} }
function addTrait(t){ if(!S.traits[t]){S.traits[t]=1;const T=D.TRAITS[t];toast('Trait: '+T.l);if(T.base)S.base=clamp(S.base+T.base,10,100);} }
function addIll(id){ if(S.ills[id]) return; S.ills[id]={tx:0}; toast('🤒 '+D.ILLS[id].l); play('nope'); renderConds(); }
function techMod(){return S.tech>=65?'high':S.tech<=35?'low':'mid';}
function relGain(v){return v>0?v*(S.tech>=65?.6:S.tech<=35?1.3:1):v;}
function addMoment(m){if(m&&!S.moments.includes(m)){S.moments.push(m);toast('✨ Tech moment: '+m);}}
function setTech(d){S.tech=clamp(S.tech+d,0,100);if(S.tech<=20&&!S.traits.selfmade&&rnd()<.3)addTrait('selfmade');}
function score(){const avgH=S.happyN?S.happySum/S.happyN:S.happy;return Math.round(S.age*10+avgH*3+S.rel*2+S.careerPeak*50+S.achs.length*40+Math.min(500,Math.max(0,S.money)/200)+Math.min(300,S.legacy*2));}

/* ---------------- simulation ---------------- */
let paused=false, acc=0, curEv=null;
function step(sdt){
  if(!S.alive) return;
  const st=stage();const yrs=sdt/D.YEAR_SECONDS;const prevAge=S.age;S.age+=yrs;S.t+=sdt;
  const diff=(1+S.age/110)*(S.tech>=65?.9:S.tech<=35?1.06:1);S.techSum+=S.tech*sdt;S.techN+=sdt;S.tech+=(50-S.tech)*.003*sdt;
  for(const k in st.needs){ if(k==='health'||k==='money') continue; const r=st.needs[k]*diff*traitMod(k)*((k==='fun'||k==='social')&&S.tutorRun>=3?1.5:1)*sdt; S.needs[k]=clamp(S.needs[k]+(D.NEEDS[k].inv?r:-r),0,100); }
  if(st.living) S.money-=st.living*sdt;
  if(S.age<18) S.money+=0.4*sdt; // pocket money
  if(S.age>=65) S.money+=(6+2*S.careerPeak)*sdt; // pension: scales with career peak
  // era mechanic: AI baby monitor warns early about the most urgent need
  if(EP[st.id]&&EP[st.id].mechanic==='monitor'&&S.tech>=30&&S.t-S.warnT>6){const w=Object.keys(st.needs).filter(k=>k!=='health').sort((a,b)=>goodness(a)-goodness(b))[0];if(goodness(w)<35){S.warnT=S.t;toast('📟 AI monitor: Ken will cry soon ('+D.NEEDS[w].l+')');}}
  // health
  let bad=0,sum=0,n=0;for(const k in st.needs){if(k==='health')continue;const g=goodness(k);sum+=g;n++;if(g<15)bad++;}
  if(S.money<0&&st.living){bad+=0.5;}
  let dh=-0.8*bad;for(const id in S.ills) dh-=D.ILLS[id].drain*(S.hospital>0?.4:1);
  if(bad===0&&sum/n>45&&!Object.keys(S.ills).length) dh+=0.5;
  S.health=clamp(S.health+dh*sdt,0,S.base);
  // baseline erodes with age
  const er=S.age<50?0:S.age<70?.25:S.age<80?.6:1.1;S.base=clamp(S.base-er*yrs*(S.traits.athletic?.8:1),5,100);
  // happiness
  const target=clamp(sum/n-(Object.keys(S.ills).length*8),0,100);S.happy+=(target-S.happy)*Math.min(1,.05*sdt);S.happySum+=S.happy*sdt;S.happyN+=sdt;
  if(S.hospital>0) S.hospital=Math.max(0,S.hospital-yrs);
  // illnesses by condition (rolled per sim second)
  const p=x=>rnd()<x*sdt;
  if((goodness('food')<20||(st.needs.hygiene&&goodness('hygiene')<20)||S.health<35)&&p(.012)) addIll('flu');
  if(S.age>=12&&S.happy<25&&p(.01)) addIll('depression');
  if(st.needs.stress&&S.needs.stress>85&&p(.02)) addIll('burnout');
  if(S.age>=45&&p(.0012*(S.age-44)/10*(st.needs.fitness&&S.needs.fitness<30?2:1))) addIll('back_pain');
  if(S.age>=50&&p(.0008*(S.age-49)/10*(S.traits.smoker?2.5:1)*(S.traits.athletic?.6:1))) addIll('heart');
  if(S.age>=65&&p(.0015*(S.age-64)/10)) addIll('arthritis');
  if(S.age>=82&&p(.001*(S.age-80)/5)) addIll('frailty');
  // milestones
  if(prevAge<80&&S.age>=80) addAch('Reached 80');
  if(prevAge<100&&S.age>=100) addAch('Centenarian');
  // old age: hazard per year after 80
  if(Math.floor(S.age)>Math.floor(prevAge)&&S.age>80){const h=.035*Math.pow(S.age-79,1.35)*(1+(100-S.health)/100);if(rnd()<h) return die('Old age');}
  if(S.health<=0){const il=Object.keys(S.ills);return die(il.length?'Untreated '+D.ILLS[il[0]].l.toLowerCase():'Neglect');}
  // stage change
  const si=stageIdxForAge(S.age);if(si!==S.stageIdx){S.stageIdx=si;for(const k in D.STAGES[si].needs){if(k!=='health'&&k!=='money')S.needs[k]=D.NEEDS[k].inv?20:75;}if(si===4&&S.money<300)S.money=300;stageUp();return;}
  // events
  S.nextEvent-=sdt;if(S.nextEvent<=0){S.nextEvent=yearsToSec(1+rnd());fireEvent();}
}

/* ---------------- events ---------------- */
function eventPool(){const st=stage();return (D.EVENTS[st.id]||[]).concat(D.EVENTS.any.filter(e=>S.age>=(e.min||0))).filter(e=>(!e.need||S.achs.includes(e.need))&&(!e.minTech||S.tech>=e.minTech)&&(!e.plush||S.plush)&&(!e.req||(e.req==='partner'?S.partner:e.req==='kids'?S.kids>0:true)));}
function fireEvent(ev){
  ev=ev||pick(eventPool());if(!ev) return;S.events++;
  paused=true;$('#evTitle').textContent=ev.t;curEv=ev;
  const js=JSON.stringify(ev.c);const kind=/"(ill|hospital|death)"/.test(js)?'health':/"ach"|"careerPeak"/.test(js)?'good':/"ill"|money":-/.test(js)&&!/"ach"/.test(js)?'bad':'normal';
  $('.event-card').dataset.kind=kind;$('#evKind').textContent=ev.tech?'Tech moment':{health:'Health',good:'Milestone',bad:'Setback',normal:'Life event'}[kind];$('#evText').textContent=ev.x;
  const box=$('#evChoices');box.innerHTML='';
  for(const c of ev.c){const b=document.createElement('button');b.className='choice';b.textContent=c.l;b.onclick=()=>{$('#eventModal').classList.add('hidden');paused=false;applyEff(c.e);if(c.msg)toast(c.msg);render(true);save();};box.appendChild(b);}
  $('#eventModal').classList.remove('hidden');play('chime');
  const KI={normal:['photo_album','📰'],good:['party_cup','⭐'],bad:['bandaid','⚡'],health:['stethoscope','✚']}[$('.event-card').dataset.kind];$('#evIcon').innerHTML=ART.icon(ev.tech?'holo_laptop':KI[0],KI[1]);
  setTimeout(()=>box.firstChild&&box.firstChild.focus(),50);
}
function applyEff(e){
  if(!e) return;
  if(e.chance){const [pr,a,b]=e.chance;applyEff(rnd()<pr?a:(b||{}));}
  for(const [k,v] of Object.entries(e)){
    if(k in S.needs&&k!=='health'){S.needs[k]=clamp(S.needs[k]+v,0,100);}
    else switch(k){
      case 'health':S.health=clamp(S.health+v,0,S.base);break;
      case 'happy':S.happy=clamp(S.happy+v*3,0,100);break;
      case 'money':S.money+=v;break;
      case 'base':S.base=clamp(S.base+v,5,100);break;
      case 'rel':S.rel=clamp(S.rel+relGain(v),0,100);break;
      case 'tech':setTech(v);break;
      case 'moment':addMoment(v);break;
      case 'legacy':S.legacy+=v;break;
      case 'exo':S.exo=1;break;
      case 'plush':S.plush=1;break;
      case 'trait':addTrait(v);break;
      case 'ill':addIll(v);break;
      case 'ach':addAch(v);break;
      case 'kids':S.kids+=v;break;
      case 'partner':S.partner=true;break;
      case 'careerPeak':S.careerPeak=Math.min(4,S.careerPeak+v);break;
      case 'hospital':S.hospital=1;break;
      case 'death':return die(v);
    }
  }
}

/* ---------------- actions ---------------- */
function doAction(a,el){
  if(!S.alive||paused) return;
  const now=S.t;if((S.cds[a.id]||0)>now){nope(el);toast('Not yet…');return;}
  if(a.req==='kids'&&!S.kids){nope(el);toast('No grandkids yet');return;}
  if(a.cost&&S.money<a.cost){nope(el);toast('Not enough money');return;}
  // energy-gated actions
  const st=stage();
  if(a.eff.energy<0&&st.needs.energy&&S.needs.energy<Math.abs(a.eff.energy)){nope(el);toast('Too tired');return;}
  if(a.cost) S.money-=a.cost;
  const em=(1+S.careerPeak*.15)*(S.tech>=65?1.1:1);if(a.earn) S.money+=a.earn*em;
  const parts=[];
  for(const [k,v] of Object.entries(a.eff)){ if(!v) continue; if(k==='health'){S.health=clamp(S.health+v,0,S.base);} else if(k in S.needs){S.needs[k]=clamp(S.needs[k]+v,0,100);} if(k in st.needs&&Math.abs(v)>=5) parts.push((v>0?'+':'')+v+' '+D.NEEDS[k].l); }
  if(a.earn) parts.push('+'+Math.round(a.earn*em)+' 💰');
  if(a.happy) S.happy=clamp(S.happy+a.happy*2,0,100);
  if(a.rel) S.rel=clamp(S.rel+relGain(a.rel),0,100);
  if(a.ai) setTech(a.ai*.3); else setTech(-.15);
  if(a.moment) addMoment(a.moment);
  if(a.plush) S.plush=1;
  if(a.exo) S.exo=1;
  if(a.legacy) S.legacy+=a.legacy;
  if(a.bondCost) S.rel=clamp(S.rel-a.bondCost*.5,0,100);
  if(a.companion) S.happy=clamp(S.happy+1,0,100); // AI companionship: small; real romance (date/partner events) always gives more
  if(a.id==='tutor') S.tutorRun++; if(a.id==='playout'||a.id==='friends'||a.id==='selfstudy') S.tutorRun=0;
  if(a.early&&Object.keys(S.ills).length) addMoment('AI caught an illness early');
  // low reliance: doing it yourself costs more time and energy
  if(!a.ai&&S.tech<=35&&st.needs.energy&&a.eff.energy<0) S.needs.energy=clamp(S.needs.energy-2,0,100);
  if(a.base) S.base=clamp(S.base+a.base,5,100);
  if(a.trait&&rnd()<a.trait[1]) addTrait(a.trait[0]);
  if(a.id==='work'||a.id==='sprint'||a.id==='agentsprint'){ if(S.needs.career>=95&&S.careerPeak<4&&rnd()<.03){S.careerPeak++;S.needs.career=55;toast('📈 Promoted on merit');addAch('Promoted');} }
  if(['nap','sleep','rest'].includes(a.id)) S.lastSleep=now;
  // treatment
  for(const id in S.ills){const I=D.ILLS[id];if(I.tx.includes(a.id)){S.ills[id].tx++;if(S.ills[id].tx>=I.need){delete S.ills[id];toast('✅ '+I.l+' treated');play('chime');renderConds();}}}
  S.cds[a.id]=now+(a.cd||1.2);
  bounce();float(parts.join('  '),el);burst(a.e);play(a.cost?'coin':'pop');render(true);
}

/* ---------------- death ---------------- */
function die(cause){
  if(!S.alive) return;S.alive=false;S.cause=cause;paused=true;save();
  const sc=score();const list=bests();list.push({name:S.name,age:Math.floor(S.age),score:sc,cause,when:new Date().toISOString().slice(0,10)});list.sort((a,b)=>b.score-a.score);
  try{localStorage.setItem(BEST_KEY,JSON.stringify(list.slice(0,5)));localStorage.removeItem(SAVE_KEY);}catch(e){}
  heartbeatOut(()=>{ showEpitaph(sc,list[0]); });
}
function showEpitaph(sc,best){
  $('#tomb').innerHTML=ART.tombstone()+(S.legacy>0||S.tech>=50?`<div class="avatar" title="AI avatar">${ART.avatar('elder')}</div>`:'');
  const bg=ART.deathBg();$('#death').style.backgroundImage=bg||'';
  $('#epName').textContent=S.name;
  $('#epLine').textContent=`${YEAR0}–${YEAR0+Math.floor(S.age)} · aged ${Math.floor(S.age)} · ${S.cause}`;
  const avgH=Math.round(S.happyN?S.happySum/S.happyN:S.happy);
  const careers=['None','Entry level','Senior','Manager','Director','Executive'];
  const items=[`Life satisfaction: ${avgH}/100`,`Relationships: ${Math.round(S.rel)}/100${S.partner?' · had a partner':''}${S.kids?` · ${S.kids} child${S.kids>1?'ren':''}`:''}`,`Career peak: ${careers[Math.min(careers.length-1,S.careerPeak+(S.achs.includes('First job')?1:0))]}`,`Savings: ${Math.round(S.money)}`,`Traits: ${Object.keys(S.traits).map(t=>D.TRAITS[t].l).join(', ')||'none'}`,`Achievements: ${S.achs.join(', ')||'none'}`];
  const ta=S.techN?S.techSum/S.techN:S.tech;const style=ta>=65?'Early adopter':ta<=35?'Analog soul':'Balanced';const path=ta>=65?'Embraced AI':ta<=35?'Stayed human':'Balanced';
  items.push(`Tech style: ${style}`,`Tech path: ${path} (reliance ${Math.round(ta)}/100)`,`Tech moments: ${S.moments.join(' · ')||'none'}`);if(S.legacy)items.push(`Digital legacy: ${Math.round(S.legacy)} (adds ${Math.min(300,Math.round(S.legacy*2))} to score)`);
  $('#epSummary').innerHTML=items.map((t,i)=>`<li style="animation-delay:${.15*i}s">${esc(t)}</li>`).join('');lastShare=`${S.name} (${YEAR0}–${YEAR0+Math.floor(S.age)}) lived to ${Math.floor(S.age)} in Ken.AI. Life score ${sc}. ${items.find(x=>x.startsWith('Tech path'))}.`;
  $('#epScore').textContent=sc;$('#epBest').textContent=best&&best.score>sc?`(best: ${best.score}, ${best.name})`:'(new best!)';
  $('#death').classList.remove('hidden');
}
let lastShare='';
$('#btnShare').onclick=async()=>{try{if(navigator.share){await navigator.share({text:lastShare});}else{await navigator.clipboard.writeText(lastShare);toastDeath('Copied to clipboard');}}catch(e){}};
function toastDeath(t){const b=$('#btnShare');const o=b.textContent;b.textContent=t;setTimeout(()=>b.textContent=o,1500);}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

/* ---------------- render ---------------- */
let lastMoodKey='',lastStageRendered=-1,uiT=0;
function moodNow(){
  if(S.hospital>0) return 'sleeping'; // SPEC: hospital uses the sleeping pose
  if(S.t-S.lastSleep<2.5) return 'sleeping';
  const il=Object.keys(S.ills);if(il.length) return D.ILLS[il[0]].mood||'sick';
  const st=stage();
  if(st.needs.stress&&S.needs.stress>70) return 'stressed';
  if(st.needs.pain&&S.needs.pain>70) return 'stressed'; // senior/elder 'pain' sprite
  if(Object.keys(st.needs).some(isBad)||S.happy<30) return 'sad';
  if(S.happy>65) return 'happy';
  return 'neutral';
}
/* sprite anchoring (SPEC): all sprites share one scale (adult ~528px tall = 45% of the stage view), foot baseline = bottom - 8px */
const SPRITE_REF=528;
/* tech-prop anchor table, % of the sprite box: [left, top, width] (glasses on the face, watch on the wrist, brace on the knee) */
const ANCHORS={
  smartwatch:{adult:[10,47,16],middle:[10,47,16]},
  exo_knee_brace:{senior:[33,66,22],elder:[33,66,22]}
};
const BADGES=['bandage','arm_cast_sling'];
/* SPEC: worn injuries exist only for the adult as full replacement sprites (gown = hospital stay, bandage = head injury, sling = broken arm) */
function injuryAlt(st,ills){if(!S.alive||!ASSETS['char.'+st.id+'.gown'])return null;if(S.hospital>0)return 'gown';const ov=ills.map(id=>D.ILLS[id].ov);if(ov.includes('arm_cast_sling'))return 'sling';if(ov.includes('bandage'))return 'bandage';return null;}
function badgeOv(id){const o=D.ILLS[id].ov;if(!BADGES.includes(o))return '';if(S&&ASSETS['char.'+stage().id+'.gown'])return '';return ART.overlay(o);}
/* Scene rule (Muse, round 3): Ken always stands in the FOREGROUND, feet at FOOT_AT of the scene height, in front of the
   furniture, with a contact shadow. Adult height = ADULT_H of the scene; other ages keep their ratios to the adult and
   baby/toddler get an extra 1.3x so they stay readable. Rooms are pulled-back portraits shown cover, bottom-aligned.
   NEUTRAL_H = natural px height of <stage>_neutral.webp (manifest). */
const FOOT_AT=.93, ADULT_H=.52;
const STAGE_RATIO={baby:.455*1.3,toddler:.606*1.3,child:.758,teen:.909,youngadult:.985,adult:1,middle:.985,senior:.955,elder:.909};
const NEUTRAL_H={baby:200,toddler:282,child:374,teen:487,youngadult:528,adult:528,middle:523,senior:502,elder:477};
const BED_Y={hospital:.52};
function spriteK(){const id=S?stage().id:'adult';return ($('#stage').clientHeight||400)*ADULT_H*(STAGE_RATIO[id]||1)/(NEUTRAL_H[id]||SPRITE_REF);}
function placeScene(){const sv=$('#stage');const W=sv.clientWidth,H=sv.clientHeight;if(!W||!H||!S)return;
  const room=$('#bg').dataset.room||stage().room;const w=$('#charWrap');const inbed=w.classList.contains('inbed');
  const c=$('#bg img.contain');
  if(c){ // nursery: old art shown nearly whole (much less zoom), blurred copy fills the sides
    const iw=c.naturalWidth||1280,ih=c.naturalHeight||720;let ihs=H*.75,iws=ihs*iw/ih;if(iws<W){iws=W;ihs=W*ih/iw;}
    c.style.cssText=`width:${iws}px;height:${ihs}px;left:${clamp(W/2-.38*iws,W-iws,0)}px;top:${H-ihs}px`;}
  let foot=(1-FOOT_AT)*H;
  if(inbed&&BED_Y[room]){const im=$('#bg img.bgimg');const iw=(im&&im.naturalWidth)||720,ih=(im&&im.naturalHeight)||1280;const ihs=ih*Math.max(W/iw,H/ih);foot=(1-BED_Y[room])*ihs;}
  else if(inbed)foot=.30*H;
  sv.style.setProperty('--foot',foot+'px');w.style.bottom=foot+'px';}
addEventListener('resize',()=>placeScene());
function trayEnd(){const t=$('#tray');t.classList.toggle('end',t.scrollLeft+t.clientWidth>=t.scrollWidth-4);}
$('#tray').addEventListener('scroll',trayEnd,{passive:true});
function fitSprite(){const k=spriteK();const w=$('#charWrap');w.style.setProperty('--k',k);
  const im=$('#char img');if(im){const set=()=>{w.style.setProperty('--sh',(im.naturalHeight*k)+'px');};if(im.complete&&im.naturalHeight)set();else im.onload=set;w.style.setProperty('--mask',`url("${im.getAttribute('src')}")`);}
  else w.style.setProperty('--sh',($('#stage').clientHeight*.5)+'px');
  const pr=$('#props img');if(pr){const s=()=>$('#props').style.setProperty('--ph',(pr.naturalHeight*k*.35)+'px');if(pr.complete&&pr.naturalHeight)s();else pr.onload=s;}}
addEventListener('resize',()=>{if(S){fitSprite();lastMoodKey='';}});
function setWideBg(room){const wb=$('#wideBg');if(!wb)return;const u=ASSETS[`bg.${room}.wide`];wb.style.backgroundImage=u?`url(${u})`:'';}
function ageDigits(n){const el=$('#hudAge');const s=String(n);if(el.dataset.v===s)return;const old=el.dataset.v||'';el.dataset.v=s;
  el.innerHTML=s.split('').map((c,i)=>`<span class="${old[i]!==c||old.length!==s.length?'d':''}">${c}</span>`).join('');}
function buildStageUI(){
  const st=stage();
  const ne=$('#needs');ne.innerHTML='';
  for(const k in st.needs){const N=D.NEEDS[k];const d=document.createElement('div');d.className='need'+(N.inv?' inv':'');d.dataset.k=k;d.title=N.l;d.innerHTML=`<div class="ic" aria-hidden="true">${N.i}</div><span>${N.l}</span><div class="bar" role="meter" aria-label="${N.l}" aria-valuemin="0" aria-valuemax="100"><i></i></div><b class="val">0</b>`;ne.appendChild(d);}
  const tr=$('#tray');tr.innerHTML='';
  for(const a of D.ACTIONS.filter(a=>a.st.includes(st.id))){const b=document.createElement('button');b.className='card';b.dataset.id=a.id;b.innerHTML=`${ART.icon(a.icon,a.e)}<span class="lbl">${a.l}</span>${a.cost?`<span class="cost">${a.cost}</span>`:''}<i class="cdbar"></i>`;b.setAttribute('aria-label',a.l+(a.cost?`, costs ${a.cost}`:''));b.onclick=()=>doAction(a,b);tr.appendChild(b);}
  lastStageRendered=S.stageIdx;lastMoodKey='';renderConds();requestAnimationFrame(trayEnd);
}
function renderConds(){ if(!S) return; $('#conditions').innerHTML=Object.keys(S.ills).map(id=>{const I=D.ILLS[id];return `<span class="cond" title="Treat with: ${I.tx.join(', ')}">${badgeOv(id)?`<i class="cbadge">${badgeOv(id)}</i>`:'🤒'} ${I.l} <small>${S.ills[id].tx}/${I.need} · ${I.tx.map(t=>(D.ACTIONS.find(a=>a.id===t)||{l:t}).l).join(' / ')}</small></span>`}).join(''); lastMoodKey=''; }
let lastBadges='';
function render(force){
  if(!S) return;
  if(lastStageRendered!==S.stageIdx) buildStageUI();
  const st=stage();
  $('#hudName').textContent=S.name;$('#hudStage').textContent=st.name;$('#hudEra').textContent=EP[st.id]?EP[st.id].era:'';
  ageDigits(Math.floor(S.age));$('#hudYear').textContent=YEAR0+Math.floor(S.age);
  $('#hudMoney').textContent=Math.round(S.money);$('#hudHappy').textContent=Math.round(S.happy);$('#hudBase').textContent=Math.round(S.base);$('#hudScore').textContent=score();
  for(const el of document.querySelectorAll('#needs .need')){const k=el.dataset.k;const v=needVal(k);const g=goodness(k);const b=el.querySelector('.bar');b.firstChild.style.width=v+'%';b.setAttribute('aria-valuenow',Math.round(v));el.querySelector('.val').textContent=Math.round(v);el.classList.toggle('low',g<40);el.classList.toggle('crit',g<20);}
  for(const c of document.querySelectorAll('#tray .card')){const a=D.ACTIONS.find(x=>x.id===c.dataset.id);const left=(S.cds[a.id]||0)-S.t;const tot=a.cd||1.2;c.querySelector('.cdbar').style.width=(left>0?left/tot*100:0)+'%';c.classList.toggle('cant',!!(a.cost&&S.money<a.cost)||(a.req==='kids'&&!S.kids));}
  if(!S.alive&&force!==1&&force!==2){if(DEBUG)renderDebug();return;}
  const room=S.hospital>0?'hospital':st.room;const mood=S.alive?moodNow():'sleeping';
  let ovs=Object.keys(S.ills).map(id=>D.ILLS[id].ov);
  if(st.id==='elder') ovs=ovs.filter(o=>o!=='cane'); // elder sprites already hold a cane
  if((st.id==='teen'||st.id==='youngadult')&&S.tech>=40)ovs.push('ar_glasses');if((st.id==='adult'||st.id==='middle')&&S.tech>=35)ovs.push('smartwatch');if((st.id==='senior'||st.id==='elder')&&S.exo)ovs.push('exo_knee_brace');
  ovs=[...new Set(ovs)];
  const plush=S.plush&&st.id==='toddler'?'ai_plush_new':S.plush&&st.id==='elder'?'ai_plush_worn':'';
  const ills=Object.keys(S.ills);
  const sick=ills.some(id=>D.ILLS[id].ov==='pale'||D.ILLS[id].mood==='sick'),fever=ills.some(id=>['flu','teething'].includes(id)),blue=ills.some(id=>id==='depression'||id==='burnout');
  document.body.classList.toggle('blue',blue);$('#stage').classList.toggle('hosp',S.hospital>0);
  const key=st.id+mood+room+ovs.join()+plush+sick+fever+(S.hospital>0);
  if(key!==lastMoodKey||force===2){
    const roomChanged=$('#bg').dataset.room!==room;
    if(roomChanged&&$('#bg').dataset.room&&force!==2){$('#bgOld').innerHTML=$('#bg').innerHTML;$('#bgOld').classList.remove('out');void $('#bgOld').offsetWidth;$('#bgOld').classList.add('out');}
    if(roomChanged||force===2){$('#bg').innerHTML=ART.bg(room);$('#bg').dataset.room=room;setWideBg(room);}
    lastMoodKey=key;const alt=injuryAlt(st,ills);$('#char').innerHTML=(alt&&ART.charAlt(st.id,alt))||ART.char(st.id,mood);
    $('#roomProp').innerHTML=ART.roomProp(room);
    $('#under').innerHTML=ovs.includes('wheelchair')?ART.overlay('wheelchair'):'';
    $('#overlay').innerHTML=ovs.filter(o=>mood!=='sleeping'&&ANCHORS[o]&&ANCHORS[o][st.id]).map(o=>{const [l,t,w]=ANCHORS[o][st.id];return `<div class="anc anc-${o}" style="left:${l}%;top:${t}%;width:${w}%">${ART.overlay(o)}</div>`}).join('');
    const bd=ovs.filter(o=>BADGES.includes(o)).join();
    if(bd!==lastBadges){const gone=lastBadges&&lastBadges.split(',').filter(o=>o&&!bd.includes(o));
      if(gone&&gone.length){const fx=$('#fx');for(let i=0;i<5;i++){const s=document.createElement('div');s.className='spark';s.textContent='✦';s.style.left=(70+rnd()*20)+'%';s.style.top=(55+rnd()*15)+'%';s.style.setProperty('--dx',(rnd()-.5)*40+'px');s.style.setProperty('--dy',-30-rnd()*30+'px');fx.appendChild(s);setTimeout(()=>s.remove(),800);}}
      lastBadges=bd;}
    $('#techBadge').innerHTML=ovs.includes('ar_glasses')&&mood!=='sleeping'?`<div class="badge" title="Wearing AR glasses">${ART.overlay('ar_glasses')}</div>`:'';
    $('#props').innerHTML=plush&&ASSETS['char.plush.'+(plush.endsWith('new')?'new':'worn')]?`<img src="${ASSETS['char.plush.'+(plush.endsWith('new')?'new':'worn')]}" alt="AI plush">`:plush?ART.overlay(plush):'';
    const w=$('#charWrap');w.classList.toggle('sick',sick&&S.hospital<=0);w.classList.toggle('fever',fever&&S.hospital<=0);w.classList.toggle('gown',S.hospital>0&&!alt);w.classList.toggle('inbed',S.hospital>0&&!alt);
    ['m-neutral','m-happy','m-sad','m-sick','m-sleeping','m-stressed'].forEach(c=>w.classList.remove(c));w.classList.add('m-'+mood);
    fitSprite();placeScene();{const bi=$('#bg img');if(bi&&!bi.complete)bi.addEventListener('load',placeScene,{once:true});}
  }
  $('#btnSpeed').textContent=settings.speed+'×';$('#btnMute').textContent=settings.muted?'🔇':'🔊';
  document.body.classList.toggle('danger',S.health<25&&S.alive);
  if(DEBUG) renderDebug();
}
/* stage-up (~1.5s, SPEC): flash + chime, age odometer, chip pop, sprite morph, bg crossfade, toast */
function stageUp(){
  paused=true;const st=stage();
  const f=$('#flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');play('chime');
  setTimeout(()=>{$('#hudAge').dataset.v='';render();const c=$('#hudStage');c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop');},200);
  setTimeout(()=>{buildStageUI();render(1);const ch=$('#char');ch.classList.remove('xfade');void ch.offsetWidth;ch.classList.add('xfade');},300);
  setTimeout(()=>{toast(`${S.name} is now ${/^[aeiou]/i.test(st.name)?'an':'a'} ${st.name}${EP[st.id]?' · '+EP[st.id].era:''}`);if(st.id!=='baby')confetti();},900);
  setTimeout(()=>{paused=false;save();},1500);
}
$('#btnSuOk').onclick=()=>{$('#stageUp').classList.add('hidden');paused=false;};

/* ---------------- juice ---------------- */
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),2200);}
function bounce(){const c=$('#charWrap');c.classList.remove('bounce');void c.offsetWidth;c.classList.add('bounce');}
function nope(el){if(!el)return;el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');play('nope');}
function float(txt,el){if(!txt)return;const f=document.createElement('div');f.className='float';f.textContent=txt;$('#fx').appendChild(f);setTimeout(()=>f.remove(),1400);}
function burst(emo){const fx=$('#fx');for(let i=0;i<6;i++){const p=document.createElement('div');p.className='pt';p.textContent=emo;const dx=(rnd()-.5)*160,dy=-60-rnd()*90;p.style.setProperty('--dx',dx+'px');p.style.setProperty('--dy',dy+'px');fx.appendChild(p);setTimeout(()=>p.remove(),900);}}
function confetti(){const fx=$('#fx');for(let i=0;i<30;i++){const p=document.createElement('div');p.className='cf';p.style.left=rnd()*100+'%';p.style.background=pick(['#2ff3ff','#a78bfa','#ffe066','#ff7a59','#7dd3fc']);p.style.animationDelay=rnd()*.4+'s';fx.appendChild(p);setTimeout(()=>p.remove(),2200);}}

/* ---------------- audio ---------------- */
let AC=null;function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function tone(f,d,type,vol,when){const c=ac();if(!c||settings.muted)return;const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.value=f;const t=c.currentTime+(when||0);g.gain.setValueAtTime(vol||.08,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(c.destination);o.start(t);o.stop(t+d+.02);}
function play(n){({pop:()=>tone(660,.12,'triangle'),coin:()=>{tone(880,.08,'square',.04);tone(1320,.12,'square',.04,.07)},nope:()=>tone(160,.18,'sawtooth',.05),chime:()=>{tone(784,.3);tone(1046,.4,'sine',.06,.12)},fanfare:()=>[523,659,784,1046].forEach((f,i)=>tone(f,.25,'triangle',.07,i*.11))}[n]||(()=>{}))();}
/* death sequence (~7s, SPEC), skippable after 2s; reduced motion: grayscale snap + 400ms fade */
let deathTimers=[],deathDone=null;
function heartbeatOut(done){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;deathDone=done;deathTimers=[];
  const T=(ms,f)=>deathTimers.push(setTimeout(f,ms));
  document.body.classList.add('dying');
  if(reduce){T(400,finishDeath);return;}
  // heartbeat 70 bpm for 1.5s, slowing to 40 bpm by 3.5s
  let t=0,bpm=70;while(t<3500){const at=t;T(at,()=>{tone(70,.18,'sine',.25);setTimeout(()=>tone(60,.2,'sine',.2),160);});bpm=t<1500?70:70-30*Math.min(1,(t-1500)/2000);t+=60000/bpm;}
  T(1500,()=>document.body.classList.add('dying2'));
  T(2000,()=>{$('#skipHint').classList.remove('hidden');});
  T(3500,()=>{lastMoodKey='';render(1);$('#char').innerHTML=ART.char(stage().id,'sleeping');fitSprite();placeScene();});
  T(4700,()=>$('#charWrap').classList.add('gone')); // lying pose held 1.2s at full opacity, then 1.2s fade
  T(5900,()=>{$('#flat').classList.add('go');tone(1000,.8,'sine',.06);});
  T(6700,finishDeath);
}
function finishDeath(){deathTimers.forEach(clearTimeout);deathTimers=[];$('#skipHint').classList.add('hidden');const d=deathDone;deathDone=null;if(d)d();}
$('#stage').addEventListener('click',()=>{if(deathDone&&!$('#skipHint').classList.contains('hidden'))finishDeath();});

/* ---------------- loop ---------------- */
let last=performance.now();
function frame(now){
  const dt=Math.min(.25,(now-last)/1000);last=now;
  if(S&&S.alive&&gameVisible()&&autopilot)autoAct();
  if(S&&S.alive&&!paused&&gameVisible()){acc+=dt*settings.speed;const stepSize=.1;let guard=0;while(acc>=stepSize&&guard++<700){step(stepSize);acc-=stepSize;if(autopilot&&S.alive&&(S.t*2|0)!==(lastAuto*2|0)){lastAuto=S.t;autoAct();}if(paused||!S.alive)break;}if(guard>=700)acc=0;}
  uiT+=dt;if(S&&uiT>.1){uiT=0;render();}
  requestAnimationFrame(frame);
}
function gameVisible(){return !$('#game').classList.contains('hidden');}
setInterval(()=>{if(S&&S.alive)save();},5000);
addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();last=performance.now();});

/* ---------------- screens ---------------- */
function showTitle(){
  $('#game').classList.add('hidden');$('#death').classList.add('hidden');$('#title').classList.remove('hidden');
  const s=load();$('#btnContinue').classList.toggle('hidden',!s);if(s)$('#btnContinue').textContent=`▶ Continue ${s.name} (age ${Math.floor(s.age)})`;
  const b=bests();$('#bestBox').innerHTML=b.length?'<h3>Best lives</h3><ol>'+b.map(x=>`<li><b>${esc(x.name)}</b>, ${x.age} y · ${esc(x.cause)} · <b>${x.score}</b></li>`).join('')+'</ol>':'';
  $('#titleArt').innerHTML=ART.char('youngadult','happy');
}
function startGame(s){S=s;paused=false;deathDone=null;deathTimers.forEach(clearTimeout);document.body.classList.remove('dying','dying2','blue','danger');$('#charWrap').className='';$('#flat').classList.remove('go');$('#skipHint').classList.add('hidden');$('#bg').dataset.room='';lastBadges='';$('#title').classList.add('hidden');$('#death').classList.add('hidden');$('#game').classList.remove('hidden');lastStageRendered=-1;buildStageUI();render(2);save();ac();}
$('#btnNew').onclick=()=>{ if(load()&&!confirm('Start a new life? The current life will be lost.')) return; startGame(freshLife($('#nameInput').value)); play('chime'); };
$('#btnContinue').onclick=()=>{const s=load();if(s)startGame(s);};
$('#btnAgain').onclick=()=>{const n=S?S.name:'Ken';startGame(freshLife(n));play('chime');};
$('#btnMenu').onclick=()=>{save();showTitle();};
$('#btnSpeed').onclick=()=>{const all=DEBUG?SPEEDS.concat([16,64]):SPEEDS;settings.speed=all[(all.indexOf(settings.speed)+1)%all.length]||1;toast('Time speed '+settings.speed+'×');render();save();};
$('#btnMute').onclick=()=>{settings.muted=!settings.muted;render();save();};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#game').classList.contains('hidden')&&$('#eventModal').classList.contains('hidden')){save();showTitle();}});

/* ---------------- debug (?debug=1) ---------------- */
let autopilot=false,lastAuto=0;
function renderDebug(){const d=$('#debug');const ag=d.querySelector('.dbg-age');if(ag)ag.textContent=`age ${S.age.toFixed(2)} · hp ${S.health.toFixed(0)}/${S.base.toFixed(0)} · next event ${(S.nextEvent/D.YEAR_SECONDS).toFixed(2)}y`;}
function setupDebug(){
  const d=$('#debug');d.classList.remove('hidden');
  const opt=(arr,f)=>arr.map(x=>`<option value="${f?f(x)[0]:x}">${f?f(x)[1]:x}</option>`).join('');
  const evs=[];for(const k in D.EVENTS)D.EVENTS[k].forEach((e,i)=>evs.push([k+':'+i,k+' · '+e.t]));
  d.innerHTML=`<button class="dbg-toggle" data-a="min">DEBUG ▾</button> <span class="dbg-age"></span><br>
  <button data-a="y1">+1y</button><button data-a="y5">+5y</button><button data-a="y10">+10y</button>
  <select class="dbg-stage">${opt(D.STAGES,s=>[s.from,s.name])}</select><button data-a="jump">Jump</button><br>
  <select class="dbg-need">${opt(ALL_NEEDS.concat(['money','base','happy','tech','legacy']))}</select><input class="dbg-val" type="number" value="100" style="width:64px"><button data-a="set">Set</button><button data-a="fill">Fill all</button><button data-a="drain">Drain all</button><br>
  <select class="dbg-ev">${opt(evs,x=>x)}</select><button data-a="ev">Event</button>
  <select class="dbg-ill">${opt(Object.keys(D.ILLS))}</select><button data-a="ill">Illness</button><br>
  <button data-a="kill">Kill</button><button data-a="s16">16×</button><button data-a="s64">64×</button><button data-a="auto">Autopilot</button><button data-a="wipe">Wipe saves</button>`;
  d.onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(a==='min'){d.classList.toggle('min');return;}if(!a||!S)return;
    const skip=y=>{for(let i=0;i<y*D.YEAR_SECONDS/0.5&&S.alive&&!paused;i++)step(.5);};
    if(a[0]==='y'){S.health=S.base;skip(+a.slice(1));}
    if(a==='jump'){const to=+d.querySelector('.dbg-stage').value;S.age=to;S.stageIdx=stageIdxForAge(to);if(to>=18&&S.money<300)S.money=500;for(const k in S.needs)S.needs[k]=D.NEEDS[k].inv?20:75;S.base=Math.max(20,100-Math.max(0,to-50)*0.6);S.health=S.base;stageUp();}
    if(a==='set'){const k=d.querySelector('.dbg-need').value,v=+d.querySelector('.dbg-val').value;if(k==='money')S.money=v;else if(k==='base')S.base=v;else if(k==='happy')S.happy=v;else if(k==='tech')S.tech=v;else if(k==='legacy')S.legacy=v;else if(k==='health')S.health=Math.min(v,S.base);else S.needs[k]=v;}
    if(a==='fill'){for(const k in S.needs)S.needs[k]=D.NEEDS[k].inv?0:100;S.health=S.base;}
    if(a==='drain'){for(const k in S.needs)S.needs[k]=D.NEEDS[k].inv?100:0;}
    if(a==='ev'){const [k,i]=d.querySelector('.dbg-ev').value.split(':');fireEvent(D.EVENTS[k][+i]);}
    if(a==='ill')addIll(d.querySelector('.dbg-ill').value);
    if(a==='kill')die('Debug');
    if(a==='min'){d.classList.toggle('min');return;}
    if(a==='s16'||a==='s64'){settings.speed=+a.slice(1);}
    if(a==='auto'){autopilot=!autopilot;toast('Autopilot '+(autopilot?'on':'off'));}
    if(a==='wipe'){localStorage.removeItem(SAVE_KEY);localStorage.removeItem(BEST_KEY);toast('Saves wiped');}
    render(2);};
}
/* Autopilot (debug/testing). policy: 'first' | 'random' | 'human' (non-AI: picks the lowest-reliance choice and avoids AI actions) */
let autoPolicy='first';
function choiceTech(c){let t=0;const w=e=>{if(!e)return;if(e.tech)t+=e.tech;if(e.chance){w(e.chance[1]);}};w(c.e);return t;}
function autoAct(){ if(!autopilot||!S||!S.alive) return;
    if(!$('#eventModal').classList.contains('hidden')){const bs=[...$('#evChoices').children];if(!bs.length)return;let i=0;
      if(autoPolicy==='random')i=Math.floor(rnd()*bs.length);
      else if(autoPolicy==='human'&&curEv){const ts=curEv.c.map(choiceTech);i=ts.indexOf(Math.min(...ts));if(Math.min(...ts)===0&&Math.max(...ts)===0)i=Math.floor(rnd()*bs.length);}
      bs[i].click();return;}
    if(!$('#stageUp').classList.contains('hidden'))$('#btnSuOk').click();
    const st=stage();let acts=D.ACTIONS.filter(a=>a.st.includes(st.id)&&!(a.cost>=1000)&&(S.cds[a.id]||0)<=S.t&&!(a.cost>S.money)&&!(a.req==='kids'&&!S.kids)&&!(a.eff.energy<0&&st.needs.energy&&S.needs.energy<Math.abs(a.eff.energy)));
    if(autoPolicy==='human'){const h=acts.filter(a=>!(a.ai>0));acts=h.length?h:acts;}
    for(const id in S.ills){const a=acts.find(x=>D.ILLS[id].tx.includes(x.id));if(a){doAction(a);return;}}
    if(st.needs.money!==undefined&&needVal('money')<60){const w=acts.find(x=>x.earn);if(w){doAction(w);return;}}
    // worst need first, but fall through to the next need when nothing helps (fixes elder pain lock)
    const order=Object.keys(st.needs).filter(k=>k!=='money'&&k!=='health').sort((a,b)=>goodness(a)-goodness(b));
    for(const k of order){if(goodness(k)>85)break;const sgn=D.NEEDS[k].inv?-1:1;
      let c=acts.filter(x=>(x.eff[k]||0)*sgn>0);if(!c.length)continue;
      c.sort((x,y)=>Math.abs(y.eff[k])-Math.abs(x.eff[k]));const a=autoPolicy==='random'?pick(c):c[0];doAction(a);return;}
    if(st.needs.health!==undefined&&S.health<S.base*.7){const d=acts.find(x=>x.eff.health>0);if(d){doAction(d);return;}}
}
window.KEN={get S(){return S},step,die,fireEvent,addIll,D,ASSETS,score,setAutopilot:(v,p)=>{autopilot=v;if(p)autoPolicy=p;}};

/* ---------------- boot ---------------- */
showTitle();if(DEBUG)setupDebug();requestAnimationFrame(frame);
})();
