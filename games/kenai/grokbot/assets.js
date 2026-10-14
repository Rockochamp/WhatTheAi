/* Ken.AI v2 — single asset map. Every visual goes through KEN_ASSETS.
   Value = image path (relative to index.html) or null = built-in CSS/SVG placeholder.
   Source of truth: Muse's art/manifest.json (142 WebPs). MUSE_FILES below is that manifest's file list;
   if Muse replaces files under the same names, nothing here changes. Keep MUSE_FILES in sync with art/manifest.json
   Keys (game-side names; aliases to Muse's file names are applied below):
     char.<stage>.<mood>   stage: baby toddler child teen youngadult adult middle senior elder
                           mood: neutral happy sad sick sleeping stressed (stressed -> fussy/tantrum/pain per SPEC)
     char.plush.new / char.plush.worn
     bg.<room>.portrait / bg.<room>.wide   rooms: nursery kids_room teen_room apartment office family_home senior_living hospital
     char.adult.<gown|bandage|sling>  injury replacement sprites   frame.event.<neutral|good|bad|health>  card frames
     prop.<room>           era prop sprite for the phone layout (nursery, family_home, apartment, hospital)
     scene.death.portrait / scene.death.wide / scene.tombstone / scene.avatar (CSS glow fallback)
     icon.<name>           60 names from icon/*.webp (bottle diaper ... ai_plush_new ... home_robot)
     overlay.<name>        bandage arm_cast_sling cane wheelchair ar_glasses smartwatch exo_knee_brace ai_plush_new ai_plush_worn
                           (pale, gown: CSS only)    frame.event: CSS fallback until delivered
*/
(function(){
const ART_BASE='art/';
const MUSE_FILES=["char/baby_neutral.webp", "char/baby_happy.webp", "char/baby_sad.webp", "char/baby_sick.webp", "char/baby_sleeping.webp", "char/baby_fussy.webp", "char/toddler_neutral.webp", "char/toddler_happy.webp", "char/toddler_sad.webp", "char/toddler_sick.webp", "char/toddler_sleeping.webp", "char/toddler_tantrum.webp", "char/child_neutral.webp", "char/child_happy.webp", "char/child_sad.webp", "char/child_sick.webp", "char/child_sleeping.webp", "char/child_stressed.webp", "char/teen_neutral.webp", "char/teen_happy.webp", "char/teen_sad.webp", "char/teen_sick.webp", "char/teen_sleeping.webp", "char/teen_stressed.webp", "char/young_adult_neutral.webp", "char/young_adult_happy.webp", "char/young_adult_sad.webp", "char/young_adult_sick.webp", "char/young_adult_sleeping.webp", "char/young_adult_stressed.webp", "char/adult_neutral.webp", "char/adult_happy.webp", "char/adult_sad.webp", "char/adult_sick.webp", "char/adult_sleeping.webp", "char/adult_stressed.webp", "char/middle_age_neutral.webp", "char/middle_age_happy.webp", "char/middle_age_sad.webp", "char/middle_age_sick.webp", "char/middle_age_sleeping.webp", "char/middle_age_stressed.webp", "char/senior_neutral.webp", "char/senior_happy.webp", "char/senior_sad.webp", "char/senior_sick.webp", "char/senior_sleeping.webp", "char/senior_pain.webp", "char/elder_neutral.webp", "char/elder_happy.webp", "char/elder_sad.webp", "char/elder_sick.webp", "char/elder_sleeping.webp", "char/elder_pain.webp", "icon/bottle.webp", "icon/diaper.webp", "icon/crib.webp", "icon/teddy.webp", "icon/medicine.webp", "icon/food_bowl.webp", "icon/bath.webp", "icon/nap_pillow.webp", "icon/blocks.webp", "icon/bandaid.webp", "icon/lunchbox.webp", "icon/school_bag.webp", "icon/ball.webp", "icon/homework.webp", "icon/stethoscope.webp", "icon/snack.webp", "icon/ar_glasses.webp", "icon/study_books.webp", "icon/rose.webp", "icon/party_cup.webp", "icon/coffee.webp", "icon/briefcase.webp", "icon/ai_companion.webp", "icon/piggy_bank.webp", "icon/gym.webp", "icon/meal.webp", "icon/holo_laptop.webp", "icon/family_house.webp", "icon/digital_wallet.webp", "icon/yoga_mat.webp", "icon/salad.webp", "icon/helper_robot.webp", "icon/health_band.webp", "icon/pills.webp", "icon/vacation.webp", "icon/tea.webp", "icon/exoskeleton.webp", "icon/holo_call.webp", "icon/physio_band.webp", "icon/garden.webp", "icon/soup.webp", "icon/armchair.webp", "icon/photo_album.webp", "icon/pill_organizer.webp", "icon/hospital_bed.webp", "icon/memory_chip.webp", "icon/gene_therapy.webp", "icon/digital_twin.webp", "icon/ai_plush_new.webp", "char/ai_plush_new.webp", "icon/ai_plush_worn.webp", "char/ai_plush_worn.webp", "icon/ai_nanny.webp", "icon/vr_headset.webp", "icon/ai_wingman.webp", "icon/agent_team.webp", "icon/robotaxi.webp", "icon/smartwatch.webp", "overlay/smartwatch.webp", "icon/exo_knee_brace.webp", "overlay/exo_knee_brace.webp", "icon/memory_archive.webp", "icon/tutor_tablet.webp", "icon/home_robot.webp", "death/tombstone.webp", "overlay/bandage.webp", "overlay/arm_cast_sling.webp", "overlay/cane.webp", "overlay/wheelchair.webp", "overlay/ar_glasses.webp", "bg/nursery_portrait.webp", "bg/nursery_wide.webp", "bg/kids_room_portrait.webp", "bg/kids_room_wide.webp", "bg/teen_room_portrait.webp", "bg/teen_room_wide.webp", "bg/apartment_portrait.webp", "bg/apartment_wide.webp", "bg/office_portrait.webp", "bg/office_wide.webp", "bg/family_home_portrait.webp", "bg/family_home_wide.webp", "bg/senior_living_portrait.webp", "bg/senior_living_wide.webp", "bg/hospital_portrait.webp", "bg/hospital_wide.webp", "death/death_candle_portrait.webp", "death/death_candle_wide.webp", "char/adult_gown.webp", "char/adult_bandage.webp", "char/adult_sling.webp"];
/* floor line (fraction of the PORTRAIT bg height) where Ken's feet go; from manifest.json "floorY", checked visually per bg */
/* floor lines no longer used: Ken stands in the foreground at a fixed scene fraction (game.js FOOT_AT) */
const STAGES=['baby','toddler','child','teen','youngadult','adult','middle','senior','elder'];
const MOODS=['neutral','happy','sad','sick','sleeping','stressed'];
const FILE_STAGE={youngadult:'young_adult',middle:'middle_age'};
const SIXTH={baby:'fussy',toddler:'tantrum',senior:'pain',elder:'pain'};
const has=f=>MUSE_FILES.includes(f)?ART_BASE+f:null;
const A={};
for(const s of STAGES)for(const m of MOODS){const fs=FILE_STAGE[s]||s,fm=m==='stressed'?(SIXTH[s]||'stressed'):m;A[`char.${s}.${m}`]=has(`char/${fs}_${fm}.webp`);}
A['char.plush.new']=has('char/ai_plush_new.webp');A['char.plush.worn']=has('char/ai_plush_worn.webp');
const ROOMS=['nursery','kids_room','teen_room','apartment','office','family_home','senior_living','hospital'];
for(const r of ROOMS){A[`bg.${r}.portrait`]=has(`bg/${r}_portrait.webp`);A[`bg.${r}.wide`]=has(`bg/${r}_wide.webp`);}
A['scene.death.portrait']=has('death/death_candle_portrait.webp');A['scene.death.wide']=has('death/death_candle_wide.webp');
A['scene.tombstone']=has('death/tombstone.webp');A['scene.avatar']=null;
for(const k of ['neutral','good','bad','health'])A[`frame.event.${k}`]=has(`ui/card_${k}.webp`);
for(const k of ['gown','bandage','sling'])A[`char.adult.${k}`]=has(`char/adult_${k}.webp`); // full replacement injury sprites (adult only)
/* era props placed as separate sprites on the phone layout (SPEC round 2): room -> [icon, css class] */
const ROOM_PROPS={apartment:['robotaxi','rp-drone']}; // round 3: only the robotaxi drone (the new rooms already contain their robots)
const ICONS=MUSE_FILES.filter(f=>f.startsWith('icon/')).map(f=>f.slice(5,-5));
for(const i of ICONS)A[`icon.${i}`]=ART_BASE+`icon/${i}.webp`;
/* after the icon keys exist (was before them, so no room prop ever showed) */
for(const r in ROOM_PROPS)A[`prop.${r}`]=A[`icon.${ROOM_PROPS[r][0]}`]||null;
const OVERLAYS=['bandage','arm_cast_sling','cane','wheelchair','ar_glasses','smartwatch','exo_knee_brace'];
for(const o of OVERLAYS)A[`overlay.${o}`]=has(`overlay/${o}.webp`);
A['overlay.ai_plush_new']=A['char.plush.new'];A['overlay.ai_plush_worn']=A['char.plush.worn'];A['overlay.pale']=null;A['overlay.gown']=null;
window.KEN_ASSETS=A;

/* ---------- placeholders (SVG, generated) ---------- */
const AGE={baby:[.42,0],toddler:[.55,0],child:[.7,0],teen:[.88,0],youngadult:[1,0],adult:[1,.1],middle:[1,.35],senior:[.97,.7],elder:[.94,1]};
const SKIN='#e9b991',HAIR='#5a3a22',SHIRT={baby:'#f3efe6',toddler:'#3d6fa8',child:'#3d6fa8',teen:'#2c3e57',youngadult:'#40546e',adult:'#3a3f4b',middle:'#4b4a42',senior:'#6b6253',elder:'#7b7468'};
function mix(a,b,t){const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function charSVG(stage,mood){
  const [sc,grey]=AGE[stage]||[1,0];const hair=mix(HAIR,'#d9d6d0',grey);const skin=mood==='sick'?mix(SKIN,'#c9d3b6',.5):SKIN;
  const lying=mood==='sleeping';const baby=stage==='baby';
  const mouth={happy:'M88 92 Q100 104 112 92',sad:'M88 100 Q100 90 112 100',sick:'M90 98 Q100 94 110 98',sleeping:'M94 96 L106 96',stressed:'M88 98 L96 94 L104 98 L112 94',neutral:'M90 96 Q100 100 110 96'}[mood]||'M90 96 Q100 100 110 96';
  const eyes=lying?'<path d="M78 76 q6 4 12 0 M110 76 q6 4 12 0" stroke="#2b2b2b" stroke-width="3" fill="none"/>':`<circle cx="84" cy="76" r="${baby?5:4}" fill="#2b2b2b"/><circle cx="116" cy="76" r="${baby?5:4}" fill="#2b2b2b"/>`;
  const tears=mood==='sad'?'<path d="M84 84 q-3 10 0 14 q3-4 0-14z M116 84 q-3 10 0 14 q3-4 0-14z" fill="#7cc6ff"/>':'';
  const brow=mood==='stressed'?'<path d="M74 64 L92 68 M108 68 L126 64" stroke="#2b2b2b" stroke-width="3"/>':'';
  const wrinkles=grey>.5?'<path d="M76 88 q4 3 8 0 M116 88 q4 3 8 0 M88 58 q12 -4 24 0" stroke="#b78560" stroke-width="2" fill="none" opacity=".7"/>':'';
  const body=baby?`<ellipse cx="100" cy="170" rx="58" ry="52" fill="${SHIRT.baby}" stroke="#d8d0c0" stroke-width="3"/>`
   :`<rect x="58" y="122" width="84" height="${stage==='toddler'?70:96}" rx="30" fill="${SHIRT[stage]}"/><rect x="66" y="${stage==='toddler'?180:206}" width="28" height="${stage==='toddler'?40:64}" rx="12" fill="#2d2f36"/><rect x="106" y="${stage==='toddler'?180:206}" width="28" height="${stage==='toddler'?40:64}" rx="12" fill="#2d2f36"/>`;
  const hairPath=grey>.9?`<path d="M58 70 q4-30 42-32 q38 2 42 32 q-8-18 -42-18 q-34 0-42 18z" fill="${hair}" opacity=".9"/>`:`<path d="M54 74 q0-44 46-44 q46 0 46 44 q-10-22 -46-22 q-36 0-46 22z" fill="${hair}"/>`;
  const g=`<g>${body}<circle cx="100" cy="80" r="${baby?50:44}" fill="${skin}"/>${baby?'':hairPath}${brow}${eyes}${tears}${wrinkles}<path d="${mouth}" stroke="#7a3b2e" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="76" cy="90" r="7" fill="#f08a7a" opacity="${mood==='sick'?0:.35}"/><circle cx="124" cy="90" r="7" fill="#f08a7a" opacity="${mood==='sick'?0:.35}"/></g>`;
  const h=280;const t=lying?`translate(${100-140*sc} ${h-60}) rotate(-90 100 140) scale(${sc})`:`translate(${100-100*sc} ${h-h*sc}) scale(${sc})`;
  return `<svg viewBox="0 0 200 ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet"><g transform="${t}">${g}</g></svg>`;
}
const BG={kids_room:['#2d4a63','#5f86a6','🪁'],teen_room:['#2a2d45','#49507a','🎧'],family_home:['#3d3530','#76655a','🏡'],senior_living:['#3b3a33','#6e6a5c','🪑'],nursery:['#3a3350','#6c5a7c','🧸'],kidsroom:['#2d4a63','#5f86a6','🪁'],teenroom:['#2a2d45','#49507a','🎧'],apartment:['#33363f','#5a6070','🪴'],office:['#2b3440','#56677a','💼'],familyhome:['#3d3530','#76655a','🏡'],seniorroom:['#3b3a33','#6e6a5c','🪑'],hospital:['#2f3e44','#8fb3bd','🏥']};
function bgSVG(room){const [a,b,e]=BG[room]||BG.apartment;return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><rect x="250" y="40" width="110" height="90" rx="6" fill="#0d1526" stroke="#c9c2b0" stroke-width="5"/><circle cx="330" cy="70" r="8" fill="#f4efd0" opacity=".8"/><rect y="220" width="400" height="80" fill="#000" opacity=".22"/><text x="40" y="110" font-size="46">${e}</text></svg>`;}
const OV={pale:'<rect width="200" height="280" fill="#d7e6c8" opacity=".25"/>',bandage:'<rect x="70" y="40" width="60" height="12" rx="5" fill="#f6f1e4" stroke="#c9bfa8"/>',cast:'<rect x="130" y="150" width="26" height="58" rx="10" fill="#f8f8f4" stroke="#bdbdb0" stroke-width="2"/>',sling:'<path d="M70 140 L140 210 L60 200 Z" fill="#7aa0c4" opacity=".85"/>',cane:'<path d="M160 160 q14 0 14 12 L170 276" stroke="#6b4a2b" stroke-width="7" fill="none" stroke-linecap="round"/>',wheelchair:'<circle cx="100" cy="240" r="36" fill="none" stroke="#9aa3ad" stroke-width="7"/><rect x="58" y="196" width="84" height="12" rx="4" fill="#5b636d"/>',smartwatch:'<rect x="128" y="168" width="14" height="14" rx="3" fill="#2ff3ff"/>',exo_knee_brace:'<rect x="64" y="236" width="72" height="14" rx="5" fill="#9aa3ad"/>',ai_plush_new:'<text x="150" y="270" font-size="40">🐰</text>',ai_plush_worn:'<text x="150" y="270" font-size="40" opacity=".6">🐰</text>',ar_glasses:'<rect x="72" y="68" width="56" height="16" rx="6" fill="#2ff3ff" opacity=".55"/>',arm_cast_sling:'<rect x="130" y="150" width="26" height="58" rx="10" fill="#f8f8f4"/>',gown:'<rect x="56" y="120" width="88" height="110" rx="26" fill="#9fc7d6" opacity=".85"/>'};
function iconTxt(emoji){return `<span class="emo">${emoji}</span>`;}
function tomb(){return `<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg"><path d="M40 210 V80 q0-60 60-60 q60 0 60 60 V210z" fill="#5d6168" stroke="#3b3e44" stroke-width="4"/><text x="100" y="105" font-size="22" text-anchor="middle" fill="#d9dce1" font-family="serif">R.I.P.</text><rect x="20" y="205" width="160" height="12" rx="4" fill="#2f3a2a"/><g transform="translate(150 160)"><rect x="-6" y="0" width="12" height="40" fill="#efe6cf"/><path class="flame" d="M0 -18 q8 10 0 18 q-8 -8 0 -18z" fill="#ffb84f"/></g></svg>`;}
/* render helpers: return HTML for a key, preferring real art */
function orient(){const e=document.getElementById('app');return e&&e.clientWidth>=e.clientHeight?'wide':'portrait';}
function img(path,cls){return `<img src="${path}" alt="" class="${cls||''}" draggable="false" onerror="this.style.visibility='hidden'">`;}
window.KEN_ART={
  char(stage,mood){const k=`char.${stage}.${mood}`;return A[k]?img(A[k],'sprite'):charSVG(stage,mood);},
  overlay(name){const k=`overlay.${name}`;return A[k]?img(A[k],'ov ov-'+name):`<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">${OV[name]||''}</svg>`;},
  bg(room){if(room==='nursery'&&A['bg.nursery.wide']){const u=A['bg.nursery.wide'];return img(u,'bgblur')+img(u,'bgimg contain');}
    const k=`bg.${room}.${orient()}`;return A[k]?img(A[k],'bgimg'):bgSVG(room);},
  icon(name,emoji){const k=`icon.${name}`;return A[k]?img(A[k],'icon'):iconTxt(emoji);},
  tombstone(){return A['scene.tombstone']?img(A['scene.tombstone'],'tombimg'):tomb();},
  deathBg(){const k='scene.death.'+(orient());return A[k]?`url(${A[k]})`:'';},
  avatar(stage){return A['scene.avatar']?img(A['scene.avatar'],'avatar'):'<div class="glow"></div>'+this.char(stage||'elder','neutral');},
  eventFrame(kind){const u=A['frame.event.'+(kind==='normal'?'neutral':kind)];return u?`url(${u})`:'';},
  roomProp(room){const p=ROOM_PROPS[room];return p&&A['prop.'+room]&&orient()==='portrait'?`<img src="${A['prop.'+room]}" alt="" class="roomprop ${p[1]}">`:'';},
  charAlt(stage,alt){const k=`char.${stage}.${alt}`;return A[k]?img(A[k],'sprite'):null;},
  STAGES,MOODS,OVERLAYS,ROOMS,ICONS,MUSE_FILES
};
})();
