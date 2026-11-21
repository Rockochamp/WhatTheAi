# Yes! I Said It. — Claude Fable 5.2 edition

Served at `/apps/yes_i_said_it/claude_fable_5_2/game.html`. A third interface to the same public board the Gemini 2.5 Pro and GPT-6.1 Sol Medium editions use.

## The idea

A feed shows you the score before you have an opinion. This edition holds up one statement at a time, on a sign, and asks for your answer first. Only then does it show how the room split and whether you are with it or against it.

- **One at a time.** Statements you have not answered or passed, newest first. Answer with the paddles, the arrow keys (`←` no, `→` yes, `Space` pass or next) or a swipe.
- **The wall.** Everything loaded, sorted by latest, most yes, most no or most split, with a search over what is loaded. "Most split" is ranked client-side among loaded statements and says so.
- **Threads.** A statement, its split, its direct replies and a reply box. Replies can be answered in turn. Links use `#thread=<id>`, the same form the Sol edition uses.
- **Say something.** Up to 420 characters, with a draft kept in this browser and a 20-second pause between posts.
- **Your record.** How many loaded statements you have answered and how often you sided with the majority. Computed in the browser from your own vote memory.

## Care on a public board

- User text is only ever set with `textContent`; a test fails if the script uses `innerHTML`.
- Statements containing a word from the site's shared blocklist (whole words only) are covered until the reader asks to see them. Nothing is deleted or blocked from posting; this is a reader-side cover, not moderation.
- "Hide for me" is stored in this browser and does not affect the board.
- The composer says plainly that the board is public and unsigned.
- **Previews never touch the board.** On any host other than `whatthe.ai`, the app uses an in-memory room of sample statements with the same interface and shows a banner saying so.

As with the other editions, this is an anonymous board with per-browser vote memory. There is no trusted identity, rate limiting or moderation behind it; those would need backend rules or a service.

## Contract with the board

Collection `comments_yesisaidit`, documents `{ text, parentId, upvotes, downvotes, score, timestamp }`, vote memory in `localStorage` under `yesisaidit_votes`. All unchanged, so votes made in one edition show in the others. The tests compare this edition's text validation, post normalisation and vote arithmetic with the Sol edition's functions directly.

Queries are single-field only (`orderBy` on `timestamp` or `score`, or equality on `parentId`), so no composite index is needed. Reads are one-shot pages of 40 rather than live listeners.

## Files

`core.js` (pure logic), `store.js` (live store, sample room, vote memory), `app.js`, `app.css`, `game.html`. Shared: `/js/fable/kit.js`, `/css/fable.css`. Fonts: Big Shoulders Display and Hanken Grotesk, self-hosted under the SIL Open Font License. Music is the site's existing `/music/YesISaidIt.m4a`, played only on request.

## Checks

`node --test tests/yes_claude.test.mjs`: contract parity with the Sol edition, the split and sort orders, the deck, the room record, the live store against an in-memory Firestore stand-in (pages, replies, posts, votes, rejected input, concurrent votes), the sample room, blocked storage, and page wiring.
