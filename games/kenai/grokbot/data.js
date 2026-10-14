/* Ken.AI v2 — game data (stages, needs, actions, illnesses, events, traits). Pure data, no logic. */
window.KEN_DATA=(function(){
const YEAR_SECONDS=50; // one in-game year at 1x
/* need: label, icon, inverted (high = bad), base decay per second at 1x */
const NEEDS={
 food:{l:'Food',i:'🍽️'},diaper:{l:'Diaper',i:'🧷'},sleep:{l:'Sleep',i:'🌙'},comfort:{l:'Comfort',i:'🤗'},health:{l:'Health',i:'❤️'},
 hygiene:{l:'Hygiene',i:'🧼'},play:{l:'Play',i:'🧸'},energy:{l:'Energy',i:'⚡'},fun:{l:'Fun',i:'🎈'},school:{l:'School',i:'📚'},
 social:{l:'Social',i:'💬'},mood:{l:'Mood',i:'🙂'},career:{l:'Career',i:'💼'},money:{l:'Money',i:'💰'},family:{l:'Family',i:'👪'},
 stress:{l:'Stress',i:'😣',inv:true},fitness:{l:'Fitness',i:'🏃'},mobility:{l:'Mobility',i:'🦯'},pain:{l:'Pain',i:'🩹',inv:true},
 rest:{l:'Rest',i:'🛋️'},company:{l:'Company',i:'🫂'}
};
/* stages: from/to age, room, needs with decay/s, moneyTarget for the Money bar, living cost per second, difficulty */
const STAGES=[
 {id:'baby',name:'Baby',from:0,to:1,room:'nursery',needs:{food:3.2,diaper:3.0,sleep:2.2,comfort:2.6,health:0},text:'A new life begins.'},
 {id:'toddler',name:'Toddler',from:1,to:5,room:'nursery',needs:{food:2.6,hygiene:2.2,sleep:2.0,play:2.8,health:0},text:'First steps, first words, first tantrums.'},
 {id:'child',name:'Child',from:5,to:12,room:'kids_room',needs:{food:2.4,energy:2.0,fun:2.4,school:1.8,health:0},text:'School days and best friends.'},
 {id:'teen',name:'Teen',from:12,to:18,room:'teen_room',needs:{food:2.4,energy:2.2,social:2.6,school:2.0,mood:1.8},text:'Crushes, exams and big feelings.'},
 {id:'youngadult',name:'Young adult',from:18,to:30,room:'apartment',needs:{food:2.6,energy:2.4,social:2.4,career:1.6,money:0},moneyTarget:4000,living:16,text:'Your own place. Your own rules. Your own bills.'},
 {id:'adult',name:'Adult',from:30,to:50,room:'family_home',needs:{food:2.6,energy:2.6,family:2.2,career:1.8,money:0,stress:2.2},moneyTarget:20000,living:32,text:'Deadlines, promotions and a family to look after.'},
 {id:'middle',name:'Middle age',from:50,to:65,room:'office',needs:{food:2.6,fitness:2.4,family:2.0,career:1.6,stress:2.2,health:0},moneyTarget:30000,living:28,text:'The view from the middle of the road.'},
 {id:'senior',name:'Senior',from:65,to:80,room:'senior_living',needs:{food:2.8,mobility:2.6,social:2.6,pain:2.4,health:0},moneyTarget:30000,living:12,text:'Retirement, grandkids and creaky joints.'},
 {id:'elder',name:'Elder',from:80,to:999,room:'hospital',needs:{food:3.0,rest:2.8,company:2.8,pain:2.8,health:0},moneyTarget:30000,living:10,text:'Every day is a gift now.'}
];
/* actions: stages it appears in, effects, costs, cooldown (s), cures */
const ACTIONS=[
 {id:'bottle',icon:'bottle',l:'Bottle',e:'🍼',st:['baby'],eff:{food:45,comfort:5}},
 {id:'change',icon:'diaper',l:'Change',e:'🧷',st:['baby'],eff:{diaper:60}},
 {id:'nap',icon:'crib',l:'Nap',e:'😴',st:['baby','toddler'],eff:{sleep:55},cd:4},
 {id:'cuddle',icon:'teddy',l:'Cuddle',e:'🤗',st:['baby'],eff:{comfort:40},happy:1},
 {id:'meal',icon:'food_bowl',l:'Meal',e:'🥣',st:['toddler','child','teen'],eff:{food:45}},
 {id:'bath',icon:'bath',l:'Bath',e:'🛁',st:['toddler'],eff:{hygiene:60}},
 {id:'toys',icon:'blocks',l:'Play',e:'🧸',st:['toddler'],eff:{play:45,sleep:-6},happy:1},
 {id:'sleep',icon:'nap_pillow',l:'Sleep',e:'🛏️',st:['child','teen','youngadult','adult'],eff:{energy:60,stress:-10},cd:5},
 {id:'playout',icon:'ball',l:'Play outside',e:'⚽',st:['child'],eff:{fun:40,energy:-12,fitness:0},happy:1,trait:['athletic',.06]},
 {id:'homework',icon:'homework',l:'Homework',e:'📚',st:['child','teen'],eff:{school:40,energy:-10,fun:-6,mood:-4},trait:['bookworm',.06]},
 {id:'friends',icon:'party_cup',l:'Hang out',e:'💬',st:['teen','youngadult','senior'],eff:{social:42,energy:-10,mood:8},happy:1,rel:1},
 {id:'music',l:'Music',e:'🎧',st:['teen'],eff:{mood:35,energy:-4}},
 {id:'cook',icon:'meal',l:'Cook',e:'🍳',st:['youngadult','adult','middle'],eff:{food:50},cost:30},
 {id:'takeout',icon:'salad',l:'Takeout',e:'🍔',st:['youngadult','adult'],eff:{food:60,energy:5},cost:70,base:-.05},
 {id:'work',icon:'briefcase',l:'Work shift',e:'💼',st:['youngadult','adult','middle'],eff:{career:30,energy:-18,stress:10},earn:220,cd:2.5,trait:['workaholic',.04]},
 {id:'sprint',icon:'holo_laptop',l:'Work sprint',e:'🚀',st:['adult'],eff:{career:50,energy:-30,stress:22},earn:400,cd:6},
 {id:'date',icon:'rose',l:'Date',e:'🌹',st:['youngadult'],eff:{social:40,energy:-8},cost:80,happy:2,rel:3},
 {id:'familytime',icon:'family_house',l:'Family time',e:'👪',st:['adult','middle'],eff:{family:45,stress:-12,energy:-8},happy:2,rel:2},
 {id:'gym',icon:'gym',l:'Gym',e:'🏋️',st:['youngadult','adult','middle'],eff:{energy:-14,stress:-14,fitness:40},cost:20,base:.1,trait:['athletic',.05]},
 {id:'relax',icon:'tea',l:'Unwind',e:'🛀',st:['adult','middle'],eff:{stress:-35,energy:10}},
 {id:'doctor',icon:'stethoscope',l:'Doctor',e:'🩺',st:['baby','toddler','child','teen','youngadult','adult','middle','senior','elder'],eff:{health:12},cost:0,cd:8,treat:true},
 {id:'meds',icon:'pills',l:'Meds',e:'💊',st:['toddler','child','teen','youngadult','adult','middle','senior','elder'],eff:{health:6,pain:-20},cost:25,cd:4,treat:true},
 {id:'therapy',icon:'armchair',l:'Therapy',e:'🛋️',st:['teen','youngadult','adult','middle','senior'],eff:{mood:20,stress:-25},cost:90,cd:8,treat:true},
 {id:'physio',icon:'physio_band',l:'Physio',e:'🦵',st:['middle','senior','elder'],eff:{mobility:35,fitness:20,pain:-20},cost:60,cd:5,treat:true},
 {id:'walk',icon:'garden',l:'Walk',e:'🚶',st:['middle','senior'],eff:{fitness:25,mobility:20,stress:-8},base:.05},
 {id:'callfam',icon:'holo_call',l:'Call family',e:'📞',st:['senior','elder','middle'],eff:{social:30,company:40,family:25},happy:2,rel:1},
 {id:'eatsoft',icon:'soup',l:'Eat',e:'🍲',st:['senior','elder'],eff:{food:45}},
 {id:'rest',icon:'armchair',l:'Rest',e:'🛋️',st:['senior','elder'],eff:{rest:50,pain:-10,mobility:-4},cd:3},
 {id:'memories',icon:'photo_album',l:'Photo album',e:'📷',st:['elder'],eff:{company:25,rest:10},happy:2},
 {id:'visit',icon:'family_house',l:'Grandkids',e:'🧒',st:['senior','elder'],eff:{company:45,social:35,rest:-12},happy:3,cd:10,req:'kids'}
];
/* illnesses: overlay, extra health drain/s, needs effect, treatment actions + required treatments, onset hints */
const ILLS={
 flu:{l:'Flu',ov:'pale',drain:.5,tx:['doctor','meds','aicheckup'],need:2,mood:'sick'},
 colic:{l:'Colic',ov:'pale',drain:.4,tx:['cuddle','doctor'],need:3,mood:'sad'},
 teething:{l:'Teething fever',ov:'pale',drain:.5,tx:['doctor','cuddle'],need:2,mood:'sick'},
 scrape:{l:'Scraped knee',ov:'bandage',drain:.15,tx:['doctor','meds'],need:1,mood:'sad'},
 broken_arm:{l:'Broken arm',ov:'arm_cast_sling',drain:.3,tx:['doctor'],need:2,mood:'sad'},
 depression:{l:'Depression',ov:'pale',drain:.35,tx:['therapy'],need:3,mood:'sad'},
 burnout:{l:'Burnout',ov:'pale',drain:.5,tx:['therapy','relax','doctor'],need:3,mood:'stressed'},
 back_pain:{l:'Back pain',ov:'pale',drain:.25,tx:['physio','meds'],need:3,mood:'sad'},
 heart:{l:'Heart condition',ov:'gown',drain:.6,tx:['doctor','meds'],need:4,mood:'sick',chronic:true},
 arthritis:{l:'Arthritis',ov:'cane',drain:.3,tx:['physio','meds'],need:4,mood:'sad',chronic:true},
 frailty:{l:'Frailty',ov:'wheelchair',drain:.35,tx:['physio','rest','doctor'],need:4,mood:'sick',chronic:true}
};
const TRAITS={athletic:{l:'Athletic',mod:{energy:.8,fitness:.75,mobility:.8}},bookworm:{l:'Bookworm',mod:{school:.75,career:.85}},party:{l:'Party animal',mod:{social:.75},base:-6},smoker:{l:'Smoker',mod:{},base:-12},workaholic:{l:'Workaholic',mod:{career:.75,stress:1.25}},kind:{l:'Kind-hearted',mod:{family:.8,company:.8,social:.85}}};
/* events: per stage, choices. c effects: needs, happy, money, base (health baseline), rel, trait, ill, ach, kids, partner, careerPeak, chance:[p, ...alt effects], death */
const EVENTS={
 baby:[
  {t:'Colic',x:'Ken.AI has been crying for hours. Nothing seems to help.',c:[{l:'Walk the hallway all night',e:{comfort:30,sleep:-30}},{l:'Call the pediatrician',e:{ill:'colic',money:0},msg:'Colic diagnosed. Cuddles and the doctor will help.'}]},
  {t:'Teething',x:'A first tooth is coming in, and with it a fever.',c:[{l:'Cold teething ring',e:{comfort:20}},{l:'Wait and see',e:{ill:'teething'}}]},
  {t:'First laugh',x:'Ken.AI laughs for the first time at a peekaboo.',c:[{l:'Do it again!',e:{happy:6,comfort:20}}]}],
 toddler:[
  {t:'First steps',x:'Ken.AI pulls up on the couch and takes three wobbly steps.',c:[{l:'Cheer loudly',e:{happy:6,ach:'First steps'}}]},
  {t:'Tantrum',x:'Supermarket. Candy aisle. Full meltdown.',c:[{l:'Hold firm',e:{play:-15,happy:-2}},{l:'Buy the candy',e:{play:20,food:5,base:-1}}]},
  {t:'Scraped knee',x:'Ken.AI tripped on the playground and is bleeding a little.',c:[{l:'Clean and bandage it',e:{ill:'scrape'}},{l:'Kiss it better',e:{comfort:0,chance:[.4,{ill:'scrape'}]}}]}],
 child:[
  {t:'Homework pile',x:'A big project is due tomorrow and nothing is done.',c:[{l:'Stay up and finish it',e:{school:30,energy:-30}},{l:'Wing it',e:{school:-20,fun:10}}]},
  {t:'Bully',x:'An older kid keeps taking Ken.AI\'s lunch.',c:[{l:'Tell a teacher',e:{school:5,happy:-2}},{l:'Stand up to him',e:{chance:[.5,{ill:'broken_arm',happy:-4},{happy:6,trait:'athletic'}]}},{l:'Make friends with him',e:{happy:3,trait:'kind',rel:4}}]},
  {t:'Birthday party',x:'Ken.AI\'s best friend is having a big party.',c:[{l:'Go and dance',e:{fun:35,energy:-15,rel:3}},{l:'Stay home and read',e:{school:15,trait:'bookworm'}}]}],
 teen:[
  {t:'A crush',x:'Ken.AI can\'t stop thinking about someone in class.',c:[{l:'Ask them out',e:{chance:[.55,{social:30,happy:8,rel:6,ach:'First love'},{mood:-30,happy:-4}]}},{l:'Keep it secret',e:{mood:-10}}]},
  {t:'Breakup',x:'The relationship is over. Ken.AI is heartbroken.',c:[{l:'Talk it out with friends',e:{social:20,mood:-10}},{l:'Shut everyone out',e:{mood:-30,chance:[.35,{ill:'depression'}]}}],need:'First love'},
  {t:'Exams',x:'Final exams are next week.',c:[{l:'Study hard',e:{school:35,social:-15,energy:-20,trait:'bookworm'}},{l:'Cram the night before',e:{school:10,energy:-25}}]},
  {t:'House party',x:'Friends pressure Ken.AI to try a cigarette and drink at a party.',c:[{l:'Say no, dance instead',e:{social:15,mood:10}},{l:'Go along with it',e:{social:30,base:-6,trait:'party',chance:[.3,{trait:'smoker'}]}},{l:'Leave early',e:{social:-10,energy:10}}]}],
 youngadult:[
  {t:'First job offer',x:'A company wants Ken.AI. The pay is low, but it\'s a start.',c:[{l:'Take it',e:{career:30,money:400,ach:'First job'}},{l:'Hold out for better',e:{chance:[.5,{career:40,money:800,ach:'First job'},{money:-200,mood:-10}]}}]},
  {t:'Apartment',x:'A nicer apartment opens up. The rent is steep.',c:[{l:'Move in',e:{money:-800,happy:6}},{l:'Stay put and save',e:{money:300}}]},
  {t:'Relationship',x:'Things are getting serious with someone special.',c:[{l:'Move in together',e:{rel:12,happy:8,partner:1,ach:'Found a partner'}},{l:'Keep it casual',e:{social:15}}]},
  {t:'Weekend plans',x:'Big festival weekend, or a quiet weekend saving money?',c:[{l:'Party all weekend',e:{social:40,money:-300,base:-3,trait:'party'}},{l:'Save the money',e:{money:250,social:-15}}]}],
 adult:[
  {t:'Deadline',x:'A huge deliverable is due Friday. The team is behind.',c:[{l:'Pull all-nighters',e:{career:35,stress:30,energy:-30,trait:'workaholic',chance:[.25,{ill:'burnout'}]}},{l:'Push back on scope',e:{career:-5,stress:-10}}]},
  {t:'Promotion',x:'There\'s an opening one level up.',c:[{l:'Go for it',e:{chance:[.6,{career:40,money:1500,happy:6,careerPeak:1,ach:'Promoted'},{stress:20,happy:-3}]}},{l:'Not now',e:{family:15}}]},
  {t:'A baby?',x:'Ken.AI and their partner talk about starting a family.',c:[{l:'Yes, let\'s do it',e:{kids:1,family:30,money:-1000,stress:15,happy:8,ach:'Became a parent'}},{l:'Not yet',e:{}}],req:'partner'},
  {t:'Running on empty',x:'Ken.AI feels exhausted every single morning.',c:[{l:'Take a vacation',e:{stress:-40,money:-900,happy:4}},{l:'Push through',e:{chance:[.6,{ill:'burnout'}]}}]}],
 middle:[
  {t:'Back pain',x:'Ken.AI\'s back seizes up after lifting a box.',c:[{l:'See a physio',e:{ill:'back_pain'}},{l:'Ignore it',e:{chance:[.7,{ill:'back_pain',base:-3}]}}]},
  {t:'Checkup',x:'The doctor recommends a full checkup.',c:[{l:'Book it',e:{money:-150,base:3}},{l:'Skip it',e:{chance:[.3,{ill:'heart'}]}}]},
  {t:'Midlife',x:'Ken.AI wonders whether this is all there is.',c:[{l:'Buy a sports car',e:{money:-3000,happy:5,stress:-15}},{l:'Start running marathons',e:{fitness:40,trait:'athletic',base:3}},{l:'Change careers',e:{career:-30,happy:8,stress:-20}}]}],
 senior:[
  {t:'Retirement',x:'Ken.AI\'s last day at work. A cake and a card.',c:[{l:'Retire happily',e:{happy:8,ach:'Retired'}},{l:'Keep consulting',e:{money:2000,stress:10}}]},
  {t:'Grandkids visit',x:'The grandkids are coming for the weekend!',c:[{l:'Bake cookies together',e:{company:0,social:40,happy:8,ach:'Grandparent'}}],req:'kids'},
  {t:'Joint pain',x:'Ken.AI\'s knees ache on the stairs.',c:[{l:'See a doctor',e:{ill:'arthritis',money:-100}},{l:'Grit your teeth',e:{pain:30,chance:[.6,{ill:'arthritis'}]}}]},
  {t:'Feeling unwell',x:'A cough that won\'t go away.',c:[{l:'Go to the doctor',e:{ill:'flu'}},{l:'Rest at home',e:{chance:[.5,{ill:'flu',base:-4}]}}]}],
 elder:[
  {t:'A fall',x:'Ken.AI slipped in the bathroom.',c:[{l:'Go to the hospital',e:{ill:'frailty',hospital:1}},{l:'Rest and hope',e:{chance:[.5,{ill:'frailty',base:-6}]}}]},
  {t:'Memories',x:'An old photo of Ken.AI\'s first day at school turns up.',c:[{l:'Tell the story to someone',e:{company:30,happy:4}},{l:'Keep it to yourself',e:{rest:10}}]},
  {t:'Hospital stay',x:'Ken.AI needs a few days in the hospital.',c:[{l:'Follow every instruction',e:{hospital:1,base:2}},{l:'Discharge early',e:{base:-6}}]}],
 any:[
  {t:'Close call',x:'A car runs a red light as Ken.AI crosses the street.',c:[{l:'Jump back',e:{chance:[.7,{happy:-1},{ill:'broken_arm'}]}},{l:'Freeze',e:{chance:[.92,{happy:-3},{death:'Traffic accident'}]}}],min:12},
  {t:'Flu season',x:'Everyone at work or school is sick.',c:[{l:'Get the flu shot',e:{money:-30}},{l:'Tough it out',e:{chance:[.5,{ill:'flu'}]}}],min:3}]
};
const ACHS=['First steps','First love','First job','Found a partner','Promoted','Became a parent','Retired','Grandparent','Reached 80','Centenarian'];
return {YEAR_SECONDS,NEEDS,STAGES,ACTIONS,ILLS,TRAITS,EVENTS,ACHS};
})();
