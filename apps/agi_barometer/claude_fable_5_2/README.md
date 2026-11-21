# AGI Probability Barometer — Claude Fable 5.2 edition

Served at `/apps/agi_barometer/claude_fable_5_2/game.html`.

## The idea

The app is called a barometer, so this edition is one: a wall-hung aneroid barometer in brass and enamel, drawn in SVG. It has the two hands a real one has. The blue needle shows the current reading. The brass hand stays where the recorded reading was, so you can see which way things moved. And like a real one, you tap the glass.

## What it measures

`1 − latest ÷ highest`, never below zero, for each of five labs' counts of open job listings. The big dial uses the labs' latest counts added together over their highest counts added together. The hypothesis being illustrated is that a lab close to AGI would stop advertising for people. The page says, on the dial and beside it, that this is not a probability of anything.

## Where the numbers come from

- **Recorded counts** are the sourced counts from 10–11 October 2026 in `../grokbot/data/listings.json`, copied into `core.js`. A test fails if the two ever disagree.
- **Earlier quarterly values** are carried over from the older editions and are marked on the page as unverified.
- **A live reading** (tap the glass) fetches today's totals for OpenAI (Ashby), Anthropic and xAI (Greenhouse) from their public job-board feeds, directly from the visitor's browser, without credentials or a referrer. Google DeepMind and Meta have no feed a browser can read and keep their recorded counts.
- **Your readings** are kept in `localStorage` only (up to sixty, one per hour at most), so the highest count on record can grow over repeat visits. One button forgets them.

If a feed does not answer within 12 seconds, or answers with something that is not a job list, that lab keeps its recorded count and is labelled so. If none answer, the page says so and shows the record.

## Not verified from here

I could not reach the job-board feeds while building this, so I could not confirm that they still allow cross-origin reads from a browser. The live path was tested with stubbed responses of the documented shapes. If a feed refuses, the instrument falls back to its record as described above. Counting is `meta.total` for Greenhouse and listed postings for Ashby, which may differ slightly from how the recorded counts were taken.

## Files

`core.js` (formula, zones, reading logic; no DOM), `app.js` (dial, table, fetching), `app.css`, `game.html`. Shared: `/js/fable/kit.js`, `/css/fable.css`. Font: Fraunces, self-hosted under the SIL Open Font License.

## Checks

`node --test tests/agi_claude.test.mjs`: agreement with the Grokbot data file, the formula and its edge cases, live and earlier readings, defensive counting of feed responses, the needle and zones, reading storage rules, trend points, and that the page states its limits.
