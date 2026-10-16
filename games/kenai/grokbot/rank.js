/* Ken.AI global rankings: same Firebase/Firestore backend as Cosmic Dodge, Hammurabi and Banana Survivors.
   These are public web-client identifiers (identical to the other games). */
(function(){
const CFG={apiKey:"AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",authDomain:"cosmicdodge-5ae20.firebaseapp.com",projectId:"cosmicdodge-5ae20",storageBucket:"cosmicdodge-5ae20.appspot.com",messagingSenderId:"940230809594",appId:"1:940230809594:web:0b3b1dabe1e5c2f5f47643"};
const COLLECTION="leaderboard_kenai_grokbot_v1",STATS="stats_kenai_grokbot_v1",RULESET=1,LIMIT=50,MINE="kenai.v2.myRanks";
const loads=new Map();
function loadScript(src){if(loads.has(src))return loads.get(src);const p=new Promise((res,rej)=>{const s=document.createElement('script');const t=setTimeout(()=>{s.remove();rej(new Error('Connection timed out'))},8000);s.src=src;s.onload=()=>{clearTimeout(t);res()};s.onerror=()=>{clearTimeout(t);s.remove();rej(new Error('Connection unavailable'))};document.head.appendChild(s);}).catch(e=>{loads.delete(src);throw e});loads.set(src,p);return p;}
function allowed(){return ['whatthe.ai','www.whatthe.ai','localhost','127.0.0.1'].includes(location.hostname);}
let dbP=null;
function db(){if(!allowed())return Promise.reject(new Error('Rankings are only available on whatthe.ai'));
  if(!dbP)dbP=(async()=>{if(!window.firebase)await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
    if(!window.firebase.firestore)await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js');
    if(!window.firebase.apps.length)window.firebase.initializeApp(CFG);return window.firebase.firestore();})().catch(e=>{dbP=null;throw e});return dbP;}
function bounded(p){return new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('Connection timed out')),10000);p.then(v=>{clearTimeout(t);res(v)},e=>{clearTimeout(t);rej(e)});});}
function uuid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));}
function mine(){try{return JSON.parse(localStorage.getItem(MINE)||'[]')}catch(e){return []}}
function addMine(id){const m=mine();m.unshift(id);try{localStorage.setItem(MINE,JSON.stringify(m.slice(0,200)))}catch(e){}}
const valid=r=>r&&typeof r.playerName==='string'&&Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=10000000&&r.ruleset===RULESET;
async function top(){const d=await db();const s=await bounded(d.collection(COLLECTION).orderBy('score','desc').limit(LIMIT).get());
  return s.docs.map(x=>Object.assign({},x.data(),{id:x.id})).filter(valid);}
async function rankOf(score){const d=await db();const q=d.collection(COLLECTION).where('score','>',score);
  try{const c=await bounded(q.count().get());return c.data().count+1;}catch(e){const s=await bounded(q.limit(1000).get());return s.size+1;}}
async function submit(rec){const r=Object.assign({id:uuid(),ruleset:RULESET},rec);r.playerName=String(r.playerName||'Ken').trim().slice(0,16)||'Ken';r.score=Math.max(0,Math.round(r.score));
  if(!valid(r))throw new Error('Invalid record');const d=await db();const F=window.firebase.firestore.FieldValue;const ref=d.collection(COLLECTION).doc(r.id);const st=d.collection('globalStats').doc(STATS);
  await bounded(d.runTransaction(async t=>{const ex=await t.get(ref);if(ex.exists)return;t.set(ref,Object.assign({},r,{version:'grokbot',timestamp:F.serverTimestamp()}));
    t.set(st,{gameTitle:'kenai',version:'grokbot',totalGamesPlayed:F.increment(1)},{merge:true});}));
  addMine(r.id);return {id:r.id,rank:await rankOf(r.score)};}
window.KENRANK={top,submit,rankOf,mine,allowed,LIMIT,COLLECTION};
})();
