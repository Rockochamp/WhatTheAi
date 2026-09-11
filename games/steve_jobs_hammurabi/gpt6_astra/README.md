# Steve Jobs - Hammurabi · GPT-6 Astra

A ten-year strategy game for the existing What the Ai catalog. The original Grok 3 game remains intact and selectable.

## Preserved rules and features

- Start with 100 people (the original game's pawns), 4,000 bushels and 100 acres.
- Land market: 18–28 bushels per acre. Buy or sell in a year, never both.
- Seeds cost one bushel per acre; one person can tend ten acres; harvest yields 3–7 per acre.
- Feeding, cumulative starvation risk, migration, rats, bonus harvest and plague retain the exact Grok v6 probabilities and ordering.
- Reigns end after ten resolved years or zero population. Final population is the score.
- Ruler nickname, every session round, global top 100 and completed-game count, Elysium soundtrack, volume, mute, help, replay and home navigation.

The engine fixes the original collapse-year off-by-one. Invalid fractional/non-finite decisions cannot mutate a turn. Ranking ties no longer erase rounds. The new version has its own Firestore collection and stats, using the site's existing Firebase project; legacy records are not moved or changed. Run IDs make submission retries and game counts idempotent. As with the original, scores come from the client; competitive server-side validation is not part of this static game's backend.

## Interface

Responsive kingdom view, direct numeric entry and touch steppers, full before-harvest budget, feeding-risk preview, annual reports, chronicle history and final legacy. Native dialogs support Escape and keyboard focus. Reduced-motion preferences disable animation. Session ranking survives reload in the same tab; blocked storage falls back to memory. Network failures never block playing. Local previews never submit production scores.

## Verification

`node --test tests/hammurabi_astra.test.mjs` from the repository root. Includes 1,000 deterministic comparisons with the actual Grok source, 500 full campaigns, input/resource boundaries, session round/tie preservation, malformed storage, and idempotent global submissions against a local database double.

## Artwork

Built-in imagegen generated one original panorama, saved as `kingdom.webp` in this folder. The source PNG is retained in the local task's `work/kingdom-art/mesopotamia-blue-hour.png`; the WebP is a format conversion for delivery, preserving the artwork. No original site images were overwritten.

Prompt: Premium cinematic isometric/panoramic aerial view of a thriving ancient Mesopotamian river city at blue hour, magnificent stepped ziggurat, terraced sandstone architecture, geometric irrigated fields, river winding through foreground, little warm gold window lights, subtle distant stars, rich midnight navy/teal shadows and copper/amber sunlight on stone. Sophisticated realistic miniature/diorama game art, polished high detail, atmospheric but readable on small screens. No text, no UI, no logos, no modern buildings, no people portraits. Landscape composition, landmark city slightly right of center, edges naturally dark; important structures central.
