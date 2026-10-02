import { PAGE_SIZE, VOTE_KEY, normalizePost, validateText, validId, voteChange } from './core.js';

export function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value === null ? fallback : value; } catch { return fallback; }
}
export function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function getVote(id) {
  const value = readStorage(VOTE_KEY, {});
  const vote = value && typeof value === 'object' ? value[id] : null;
  return ['upvote','downvote'].includes(vote) ? vote : null;
}
function saveVote(id, vote) {
  const old = readStorage(VOTE_KEY, {}), votes = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
  if (vote) votes[id] = vote; else delete votes[id];
  return writeStorage(VOTE_KEY, votes);
}
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url; script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('The board took too long to connect. Try again.')); }, 12000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('The board couldn’t connect. Check your connection and try again.')); };
    document.head.append(script);
  });
}
let connecting;
export function connect() {
  if (connecting) return connecting;
  connecting = (async () => {
    if (!window.firebase?.initializeApp) await loadScript('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
    if (!window.firebase?.firestore) await loadScript('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js');
    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp({
      apiKey:'AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE', authDomain:'cosmicdodge-5ae20.firebaseapp.com', projectId:'cosmicdodge-5ae20', storageBucket:'cosmicdodge-5ae20.appspot.com', messagingSenderId:'940230809594', appId:'1:940230809594:web:0b3b1dabe1e5c2f5f47643'
    });
    return createBoardStore(app.firestore(), window.firebase.firestore.FieldValue);
  })().catch(error => { connecting = null; throw error; });
  return connecting;
}
export function createBoardStore(db, fieldValue) {
  const collection = db.collection('comments_yesisaidit');
  const pendingVotes = new Set();
  function query(mode) { return mode === 'love' ? collection.orderBy('score','desc') : mode === 'hate' ? collection.orderBy('score','asc') : collection.orderBy('timestamp','desc'); }
  function posts(snapshot) { return snapshot.docs.map(doc => normalizePost(doc.id,doc.data())); }
  return {
    listenFeed(mode, receive, fail) {
      return query(mode).limit(PAGE_SIZE).onSnapshot({includeMetadataChanges:true}, snapshot => receive({posts:posts(snapshot), cursor:snapshot.docs.at(-1), hasMore:snapshot.size === PAGE_SIZE, cached:snapshot.metadata?.fromCache ?? false}), fail);
    },
    async more(mode, cursor) {
      const snapshot = await query(mode).startAfter(cursor).limit(PAGE_SIZE).get();
      return {posts:posts(snapshot), cursor:snapshot.docs.at(-1), hasMore:snapshot.size === PAGE_SIZE};
    },
    async getPost(id) {
      if (!validId(id)) throw new Error('This conversation link is invalid.');
      const doc = await collection.doc(id).get();
      return doc.exists ? normalizePost(doc.id,doc.data()) : null;
    },
    listenPost(id, receive, fail) {
      return collection.doc(id).onSnapshot(doc => receive(doc.exists ? normalizePost(doc.id,doc.data()) : null), fail);
    },
    listenReplies(id, receive, fail) {
      // Equality-only query uses Firestore's automatic single-field index.
      // No recursive scans and no composite index needed for existing data.
      return collection.where('parentId','==',id).limit(60).onSnapshot(snapshot => receive(posts(snapshot).sort((a,b)=>a.timestamp-b.timestamp)), fail);
    },
    async post(value, parentId = null) {
      if (navigator.onLine === false) throw new Error('You’re offline. Your draft is kept here; reconnect before sending.');
      const text = validateText(value);
      if (parentId !== null && !validId(parentId)) throw new Error('Choose a valid conversation first.');
      if (parentId !== null && !(await collection.doc(parentId).get()).exists) throw new Error('This conversation is no longer available.');
      return collection.add({text,parentId,upvotes:0,downvotes:0,score:0,timestamp:fieldValue.serverTimestamp()});
    },
    async vote(id, requested) {
      if (!validId(id)) throw new Error('This statement is unavailable.');
      if (pendingVotes.has(id)) return null;
      pendingVotes.add(id);
      const perform = async () => {
        const previous = getVote(id), ref = collection.doc(id);
        const result = await db.runTransaction(async transaction => {
          const doc = await transaction.get(ref);
          if (!doc.exists) throw new Error('This statement is no longer available.');
          const delta = voteChange(doc.data(),previous,requested);
          transaction.update(ref,{upvotes:delta.upvotes,downvotes:delta.downvotes,score:delta.score});
          return {post:normalizePost(id,{...doc.data(),...delta}),next:delta.next};
        });
        result.remembered = saveVote(id,result.next);
        return result;
      };
      try { return navigator.locks ? await navigator.locks.request(`yesisaidit-vote-${id}`,perform) : await perform(); }
      finally { pendingVotes.delete(id); }
    }
  };
}
