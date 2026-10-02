# Yes! I Said It. — GPT-6.1 Sol Medium

A new implementation of the anonymous opinion board. Paper-and-ink editorial design, an orange accent, keyboard-accessible controls, responsive layouts, and an optional dark theme. No build step: open `game.html` through the repository's static server.

## Experience

- A 420-character composer, device-local drafts, accurate length feedback, and explicit send/failure states. Ctrl/Cmd+Enter sends; plain Enter makes a newline.
- Latest, Loved, and Hated use server-ordered live queries. Divisive ranks balanced disagreement in the recent posts already loaded; it does not claim to rank the whole database.
- Search filters loaded statements. More voices paginates 40 documents at a time; the first page remains live. Older loaded pages refresh when the board is refreshed.
- Voting works directly in the feed and thread: vote, cancel, or switch. Transactions maintain both counts and net score. A per-statement pending guard and Web Locks (where supported) avoid accidental simultaneous local votes.
- A native dialog presents the current statement, its direct replies, and up to 12 ancestor statements. A continuation link handles deeper conversations. Replies are capped at 60 documents per view, avoiding the original recursive collection scans and composite-index requirements.
- Conversation links use `#thread=<document-id>`. Browser history, Escape, close button, focus trapping, and device-local reply drafts are supported.
- Hide is private to this browser. Restore hidden posts reverses it. Conversation starter text is never presented as a real public post and is only published if the user submits it.
- Music starts only on request, at 25% volume, and pauses when the tab is hidden. No autoplay.
- Static introductory text, canonical URL, unique metadata, WebApplication JSON-LD, sitemap entry, and a new SVG catalog thumbnail.

## Existing board compatibility

The Firebase project, `comments_yesisaidit` collection, document shape (`text`, `parentId`, `upvotes`, `downvotes`, `score`, `timestamp`), and `yesisaidit_votes` storage key match Gemini 2.5 Pro. Both versions can read the same existing conversations and votes without a migration. Gemini's files remain unchanged and its URL is retained in the homepage selector, sitemap, and new version's links.

Firebase configuration identifies the existing public client project. No admin credentials are used. No database rules, indexes, or account permissions are changed. User text is inserted with `textContent`, never interpreted as markup. Invalid document paths, overlong text, blank posts, malformed counts and timestamps are handled locally.

This is still an anonymous board with browser-local vote memory, not authenticated one-person-one-vote. Clearing storage or using another browser can bypass that memory. The UI's posting cooldown and length limits are convenience checks, not server-enforced abuse prevention. Durable rate limits, trusted vote identity, moderation and content validation need backend rules or a trusted service. This release preserves the existing backend contract rather than claiming protections it cannot enforce.

## Validation

`node --test tests/yes_sol.test.mjs` from repository root covers validation, Unicode boundaries, new/cancel/switched votes, divisive sorting, search/hide filtering, legacy normalization, transaction retries and rollback, shared collection posting, and rejected orphan replies.

Browser smoke checks with a local Firebase test double cover live feed, voting, pagination, text rendered literally, reply and ancestor navigation, deep links, Escape, saved draft reload, failed send/retry, theme, 390px mobile overflow, and SDK-load failure. No test posts or votes are written to the production board.

After changing catalog routes, run `python scripts/update-seo.py` and commit the generated catalog JSON-LD and sitemap with the release.
