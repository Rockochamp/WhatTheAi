// Yes! I Said It. (Claude Fable 5.2): the page.
import { hashString } from "../../../js/fable/kit.js?v=1";
import { MAX_LENGTH, HIDDEN_KEY, COOLDOWN_MS, SPARKS, MODES, validId, split, sortPosts, statements, deck, roomRecord, relativeTime, signScale, strongLanguage } from "./core.js?v=1";
import { connect, readJson, writeJson, readVotes } from "./store.js?v=1";

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = "yesisaidit_fable_draft";
const posts = new Map(), // id -> post, everything loaded so far
  seen = new Set(), // passed or judged this visit
  pages = Object.fromEntries(MODES.map((m) => [m, { cursor: null, hasMore: true, loaded: false, busy: false }]));
let store = null,
  hidden = new Set(readJson(HIDDEN_KEY, []).filter(validId)),
  view = "deck",
  wallMode = "latest",
  current = null, // statement on the sign
  revealed = false,
  thread = null, // statement open in the dialog
  unmasked = new Set(),
  lastPostAt = 0;
const words = () => (typeof offensiveWords !== "undefined" ? offensiveWords : []); // eslint-disable-line no-undef
const paint = (id) => hashString(id) % 4;
const votesNow = () => readVotes();
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const friendly = (error) => (error?.message && !/firebase|firestore|permission|quota/i.test(error.message) ? error.message : "The board did not answer. Try again in a moment.");

function setBar(el, post) {
  const s = split(post),
    [y, n] = el.children;
  y.style.setProperty("--w", s.total ? `${s.yes}%` : "0%");
  n.style.setProperty("--w", s.total ? `${s.no}%` : "0%");
  el.setAttribute("aria-label", s.total ? `${s.yes}% yes, ${s.no}% no, ${plural(s.total, "vote")}` : "No votes yet");
  return s;
}
function absorb(list) {
  for (const p of list) if (p.text) posts.set(p.id, p);
}
async function loadPage(mode) {
  const state = pages[mode];
  if (state.busy || !state.hasMore) return false;
  state.busy = true;
  try {
    const page = await store.page(mode, state.cursor);
    absorb(page.posts);
    Object.assign(state, { cursor: page.cursor, hasMore: page.hasMore && page.posts.length > 0, loaded: true });
    return true;
  } finally {
    state.busy = false;
  }
}

/* -------------------------------------------------------- one at a time */
function showDeck(statusText = "") {
  for (const id of ["march", "paddles", "verdict", "deck-empty"]) $(id).hidden = true;
  $("deck-status").hidden = !statusText;
  $("deck-status").textContent = statusText;
}
async function nextSign() {
  revealed = false;
  let queue = deck([...posts.values()], { votes: votesNow(), seen, hidden });
  while (!queue.length && pages.latest.hasMore) {
    showDeck("Fetching more…");
    try {
      await loadPage("latest");
    } catch (error) {
      return showDeck(friendly(error));
    }
    queue = deck([...posts.values()], { votes: votesNow(), seen, hidden });
  }
  current = queue[0] ?? null;
  showDeck();
  tally();
  if (!current) {
    $("deck-empty").hidden = false;
    return;
  }
  const march = $("march"),
    sign = $("sign"),
    text = $("sign-text"),
    masked = strongLanguage(current.text, words()) && !unmasked.has(current.id);
  sign.dataset.paint = paint(current.id);
  march.style.setProperty("--tilt", `${(hashString(current.id) % 5) - 2}deg`);
  march.style.transform = "";
  march.style.opacity = "";
  text.textContent = current.text;
  text.classList.toggle("masked", masked);
  $("sign-unmask").hidden = !masked;
  $("sign-meta").textContent = relativeTime(current.timestamp);
  march.hidden = false;
  $("paddles").hidden = false;
  for (const b of ["btn-yes", "btn-no"]) $(b).disabled = false;
  // let the words fill the sign without spilling
  let scale = signScale(current.text);
  text.style.setProperty("--scale", scale);
  for (let i = 0; i < 14 && text.scrollHeight > text.clientHeight + 4; i++) text.style.setProperty("--scale", (scale *= 0.92));
  march.classList.remove("enter");
  void march.offsetWidth;
  march.classList.add("enter");
}
async function judge(requested) {
  if (!current || revealed) return;
  const post = current;
  for (const b of ["btn-yes", "btn-no"]) $(b).disabled = true;
  try {
    const result = await store.vote(post.id, requested);
    if (result) posts.set(post.id, result.post);
  } catch (error) {
    for (const b of ["btn-yes", "btn-no"]) $(b).disabled = false;
    $("tally").textContent = friendly(error);
    return;
  }
  if (current !== post) return;
  reveal(posts.get(post.id), requested);
}
function reveal(post, mine) {
  revealed = true;
  seen.add(post.id);
  $("paddles").hidden = true;
  $("verdict").hidden = false;
  const bar = $("split-bar");
  for (const i of bar.children) i.style.setProperty("--w", "0%");
  void bar.offsetWidth;
  const s = setBar(bar, post);
  $("split-yes").textContent = `${s.yes}% yes`;
  $("split-no").textContent = `${s.no}% no`;
  const sided = s.yes === 50 ? "The room is split." : (s.yes > 50) === (mine === "upvote") ? "You are with the room." : "You are against the room.";
  $("split-total").textContent = `${sided} ${plural(s.total, "vote")}.`;
  $("btn-thread").textContent = "Replies";
  tally();
  $("btn-next").focus({ preventScroll: true });
}
function pass() {
  if (!current) return;
  seen.add(current.id);
  nextSign();
}
function tally() {
  const r = roomRecord([...posts.values()], votesNow());
  $("tally").textContent = !r.voted
    ? "Answer a few and you will see how often you side with the room."
    : r.decided
      ? `You have answered ${plural(r.voted, "statement")} here and sided with the majority on ${r.withRoom} of ${r.decided}.`
      : `You have answered ${plural(r.voted, "statement")} here.`;
}
$("btn-yes").addEventListener("click", () => judge("upvote"));
$("btn-no").addEventListener("click", () => judge("downvote"));
$("btn-pass").addEventListener("click", pass);
$("btn-next").addEventListener("click", nextSign);
$("btn-thread").addEventListener("click", () => current && openThread(current.id));
$("sign-unmask").addEventListener("click", () => {
  unmasked.add(current.id);
  $("sign-text").classList.remove("masked");
  $("sign-unmask").hidden = true;
});
// swipe the sign: right is yes, left is no
{
  const march = $("march");
  let drag = null;
  march.addEventListener("pointerdown", (e) => {
    if (revealed || e.target.closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, dx: 0 };
  });
  march.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (Math.abs(drag.dx) < 8) return;
    march.setPointerCapture?.(e.pointerId);
    march.classList.add("dragging");
    march.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 22}deg)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = drag.dx;
    drag = null;
    march.classList.remove("dragging");
    march.style.transform = "";
    if (e.type === "pointerup" && Math.abs(dx) > 90) judge(dx > 0 ? "upvote" : "downvote");
  };
  march.addEventListener("pointerup", end);
  march.addEventListener("pointercancel", end);
}
addEventListener("keydown", (e) => {
  if (view !== "deck" || document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
  if (e.code === "ArrowRight" || e.code === "KeyY") judge("upvote");
  else if (e.code === "ArrowLeft" || e.code === "KeyN") judge("downvote");
  else if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    revealed ? nextSign() : pass();
  }
});

/* -------------------------------------------------------------- the wall */
function drawWall() {
  const votes = votesNow(),
    list = sortPosts(statements([...posts.values()], { hidden, search: $("search").value }), wallMode),
    ul = $("wall");
  ul.replaceChildren();
  for (const p of list.slice(0, 240)) {
    const li = document.createElement("li"),
      row = document.createElement("button"),
      t = document.createElement("span"),
      bar = document.createElement("span"),
      m = document.createElement("span"),
      masked = strongLanguage(p.text, words()) && !unmasked.has(p.id);
    row.type = "button";
    row.className = "row";
    row.dataset.paint = paint(p.id);
    t.className = `t${p.text.length > 110 ? " long" : ""}`;
    t.textContent = masked ? "Strong language. Open to read." : p.text.length > 260 ? `${p.text.slice(0, 260)}…` : p.text;
    bar.className = "bar-split";
    bar.append(Object.assign(document.createElement("i"), { className: "y" }), Object.assign(document.createElement("i"), { className: "n" }));
    const s = setBar(bar, p),
      mine = votes[p.id];
    m.className = "m";
    m.textContent = `${s.total ? `${s.yes}% yes of ${plural(s.total, "vote")}` : "No votes yet"}, ${relativeTime(p.timestamp)}${mine ? `. You said ${mine === "upvote" ? "yes" : "no"}` : ""}`;
    row.append(t, bar, m);
    row.addEventListener("click", () => openThread(p.id));
    li.append(row);
    ul.append(li);
  }
  const state = pages[wallMode === "split" ? "latest" : wallMode];
  $("btn-more").hidden = !state.hasMore;
  $("btn-unhide").hidden = !hidden.size;
  $("wall-status").textContent = list.length
    ? wallMode === "split"
      ? "Most split is ranked among the statements loaded so far."
      : ""
    : $("search").value.trim()
      ? "Nothing loaded matches that search."
      : state.loaded
        ? "The wall is empty. Say something."
        : "Loading…";
}
async function fillWall() {
  const mode = wallMode === "split" ? "latest" : wallMode;
  drawWall();
  if (!pages[mode].loaded) {
    try {
      await loadPage(mode);
    } catch (error) {
      $("wall-status").textContent = friendly(error);
      return;
    }
    drawWall();
  }
}
for (const b of document.querySelectorAll(".sorts button"))
  b.addEventListener("click", () => {
    wallMode = b.dataset.mode;
    for (const o of document.querySelectorAll(".sorts button")) o.setAttribute("aria-pressed", String(o === b));
    fillWall();
  });
$("search").addEventListener("input", drawWall);
$("btn-more").addEventListener("click", async () => {
  $("btn-more").disabled = true;
  try {
    await loadPage(wallMode === "split" ? "latest" : wallMode);
  } catch (error) {
    $("wall-status").textContent = friendly(error);
  }
  $("btn-more").disabled = false;
  drawWall();
});
$("btn-unhide").addEventListener("click", () => {
  hidden = new Set();
  writeJson(HIDDEN_KEY, []);
  drawWall();
});
function setView(next) {
  view = next;
  $("deck-view").hidden = next !== "deck";
  $("wall-view").hidden = next !== "wall";
  $("tab-deck").setAttribute("aria-pressed", String(next === "deck"));
  $("tab-wall").setAttribute("aria-pressed", String(next === "wall"));
  if (next === "wall") fillWall();
  else if (!current || revealed) nextSign();
}
$("tab-deck").addEventListener("click", () => setView("deck"));
$("tab-wall").addEventListener("click", () => setView("wall"));

/* ------------------------------------------------------------- a thread */
function drawThread() {
  const p = thread,
    mine = votesNow()[p.id] ?? null,
    masked = strongLanguage(p.text, words()) && !unmasked.has(p.id);
  $("thread-text").textContent = masked ? "This statement uses strong language." : p.text;
  $("thread-meta").textContent = relativeTime(p.timestamp);
  const s = setBar($("thread-bar"), p);
  $("thread-split").textContent = s.total ? `${s.yes}% yes, ${s.no}% no, ${plural(s.total, "vote")}` : "No votes yet. Yours can be the first.";
  $("thread-yes").setAttribute("aria-pressed", String(mine === "upvote"));
  $("thread-no").setAttribute("aria-pressed", String(mine === "downvote"));
  const parent = $("thread-parent");
  parent.hidden = !p.parentId;
  if (p.parentId) parent.textContent = "Show what this replies to";
  if (masked) {
    unmasked.add(p.id); // opening it is asking to read it; the next draw shows the text
    setTimeout(drawThread, 900);
  }
}
async function openThread(id, push = true) {
  if (!validId(id)) return;
  const dlg = $("dlg-thread");
  $("replies").replaceChildren();
  $("thread-status").textContent = "Loading…";
  $("reply-error").textContent = "";
  try {
    thread = posts.get(id) ?? (await store.get(id));
  } catch (error) {
    thread = null;
    $("thread-status").textContent = friendly(error);
  }
  if (!thread) {
    if (!dlg.open) dlg.showModal();
    $("thread-text").textContent = "That statement is not on the board any more.";
    $("thread-meta").textContent = "";
    $("thread-status").textContent = "";
    return;
  }
  posts.set(thread.id, thread);
  drawThread();
  if (!dlg.open) dlg.showModal();
  if (push) history.replaceState(null, "", `#thread=${id}`);
  try {
    const replies = await store.replies(id);
    if (thread?.id !== id) return;
    absorb(replies);
    drawReplies(replies);
  } catch (error) {
    $("thread-status").textContent = friendly(error);
  }
}
function drawReplies(replies) {
  const ul = $("replies"),
    visible = replies.filter((r) => r.text && !hidden.has(r.id));
  ul.replaceChildren();
  for (const r of visible) {
    const li = document.createElement("li"),
      t = document.createElement("div"),
      m = document.createElement("div"),
      open = document.createElement("button"),
      s = split(r);
    t.className = "rt";
    t.textContent = strongLanguage(r.text, words()) && !unmasked.has(r.id) ? "Strong language. Open to read." : r.text;
    m.className = "rm";
    open.type = "button";
    open.className = "linklike";
    open.textContent = "Answer this";
    open.addEventListener("click", () => openThread(r.id));
    m.append(`${relativeTime(r.timestamp)}${s.total ? `, ${s.yes}% yes of ${s.total}` : ""}`, open);
    li.append(t, m);
    ul.append(li);
  }
  $("replies-title").textContent = visible.length ? plural(visible.length, "reply", "replies") : "No replies yet";
  $("thread-status").textContent = "";
}
async function threadVote(requested) {
  if (!thread) return;
  const id = thread.id;
  try {
    const result = await store.vote(id, requested);
    if (result) posts.set(id, result.post);
    if (thread?.id === id) {
      thread = posts.get(id);
      drawThread();
    }
    if (current?.id === id && !revealed && result?.next) reveal(posts.get(id), result.next);
    tally();
  } catch (error) {
    $("thread-status").textContent = friendly(error);
  }
}
$("thread-yes").addEventListener("click", () => threadVote("upvote"));
$("thread-no").addEventListener("click", () => threadVote("downvote"));
$("thread-parent").addEventListener("click", () => thread?.parentId && openThread(thread.parentId));
$("thread-link").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#thread=${thread.id}`;
  try {
    await navigator.clipboard.writeText(url);
    $("thread-status").textContent = "Link copied.";
  } catch {
    $("thread-status").textContent = url;
  }
});
$("thread-hide").addEventListener("click", () => {
  if (!thread) return;
  hidden.add(thread.id);
  writeJson(HIDDEN_KEY, [...hidden].slice(-500));
  const was = thread.id;
  $("dlg-thread").close();
  if (current?.id === was) nextSign();
  if (view === "wall") drawWall();
});
$("dlg-thread").addEventListener("close", () => {
  thread = null;
  if (location.hash.startsWith("#thread=")) history.replaceState(null, "", location.pathname + location.search);
  if (view === "wall") drawWall();
});

/* --------------------------------------------------------------- saying */
function cooling() {
  const left = COOLDOWN_MS - (Date.now() - lastPostAt);
  return left > 0 ? `Give it ${Math.ceil(left / 1000)} more seconds before posting again.` : "";
}
async function publish(textarea, errorEl, button, parentId) {
  errorEl.textContent = cooling();
  if (errorEl.textContent) return null;
  button.disabled = true;
  try {
    const post = await store.post(textarea.value, parentId);
    lastPostAt = Date.now();
    posts.set(post.id, post);
    textarea.value = "";
    return post;
  } catch (error) {
    errorEl.textContent = friendly(error);
    return null;
  } finally {
    button.disabled = false;
  }
}
function countSay() {
  const left = MAX_LENGTH - Array.from($("say-text").value).length;
  $("say-count").textContent = left >= 0 ? `${left} left` : `${-left} too many`;
  writeJson(DRAFT_KEY, $("say-text").value.slice(0, 2000));
}
function openSay() {
  $("say-error").textContent = "";
  $("say-text").value = readJson(DRAFT_KEY, "") || "";
  countSay();
  const sparks = $("sparks");
  sparks.replaceChildren();
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "Stuck? Borrow an opener";
  b.addEventListener("click", () => {
    $("say-text").value = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    countSay();
    $("say-text").focus();
  });
  sparks.append(b);
  $("dlg-say").showModal();
}
$("say-text").addEventListener("input", countSay);
$("say-text").addEventListener("keydown", (e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && $("say-form").requestSubmit());
$("say-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const post = await publish($("say-text"), $("say-error"), $("say-send"), null);
  if (!post) return;
  writeJson(DRAFT_KEY, "");
  $("dlg-say").close();
  seen.add(post.id);
  openThread(post.id);
  if (view === "wall") drawWall();
});
$("reply-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!thread) return;
  const id = thread.id,
    post = await publish($("reply-text"), $("reply-error"), $("reply-send"), id);
  if (post && thread?.id === id) drawReplies(await store.replies(id).catch(() => [post]));
});
$("btn-say").addEventListener("click", openSay);
$("btn-say-empty").addEventListener("click", openSay);
$("btn-about").addEventListener("click", () => $("dlg-about").showModal());
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
}
$("btn-music").addEventListener("click", async () => {
  const audio = $("soundtrack"),
    b = $("btn-music");
  if (audio.paused) {
    audio.volume = 0.25;
    try {
      await audio.play();
    } catch {
      return;
    }
  } else audio.pause();
  b.setAttribute("aria-pressed", String(!audio.paused));
  b.setAttribute("aria-label", audio.paused ? "Play music" : "Pause music");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !$("soundtrack").paused) $("btn-music").click();
});
addEventListener("hashchange", () => {
  const id = location.hash.match(/^#thread=([A-Za-z0-9_-]{1,128})$/)?.[1];
  if (id && thread?.id !== id) openThread(id, false);
});

/* ----------------------------------------------------------------- start */
(async () => {
  try {
    store = await connect();
    $("preview").hidden = store.live;
    await loadPage("latest");
  } catch (error) {
    showDeck(friendly(error));
    return;
  }
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__yes = { posts, store };
  await nextSign();
  const id = location.hash.match(/^#thread=([A-Za-z0-9_-]{1,128})$/)?.[1];
  if (id) openThread(id, false);
})();
