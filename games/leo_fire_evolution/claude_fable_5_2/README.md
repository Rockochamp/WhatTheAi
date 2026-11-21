# Leo's Fire Evolution — Claude Fable 5.2 edition

A lion cub with a flame for a mane walks through ten places that have gone
dark. His flame is the only light until he finds the lanterns. By the time he
leaves each place his fire has taken a new form.

## What is different here

- **You walk freely, in the dark.** The other edition is a pixel-art board of
  tiles. This one is a scrolling place you steer through by holding a finger
  or the mouse where Leo should go. The dark is drawn over the scene with a
  hole wherever something burns, so the place is revealed as you light it.
- **The flame is the compass.** It leans toward the nearest lantern that is
  still dark, and sleeping lanterns glint now and then, so nobody is lost.
- **Every lantern is a note.** Each place has a scale; lighting a lantern
  adds its note to a loop, so the place's tune fills in as you go.
- **Forms do something.** Each of the ten fire forms keeps what the last one
  could do and adds one ability: fireflies come from farther off, a longer
  roar, more speed, gliding over water, a quicker roar, twice the light,
  lighting lanterns at a distance, fireflies the wind cannot take, and the
  Eternal Flame with all of it.
- **A choice worth making.** A lantern scores 100 plus 20 for each firefly
  with Leo when it lights, so gathering first pays. Wind sends half the
  fireflies home; a roar stills the wind. Two sleeping animals hide in every
  place. There are no enemies and no clock.
- **English and German**, and names for the board come from two lists.

## Files

| File | What it does |
| --- | --- |
| `world.js` | The rules without drawing: the ten forms and places, layout from a seed, one `Visit` with walking, fireflies, lanterns, wind, roar and scoring, and a scripted walker used by tests and the start screen. |
| `render.js` | Draws a place, the dark over it, the cub and his flame in each form. |
| `game.js` | Start card, controls, music, form book, end card, rankings, both languages. |
| `records.js` | Record format and checks. One row per journey. Shared board: Firestore collection `leaderboard_leo_fire_evolution_claude_fable_5_2_v1`, used only on whatthe.ai. |

Tests: `node --test tests/leo_fire_claude.test.mjs`. They walk all ten places
with the scripted walker, so a layout that could trap the cub fails the build.

Everything is drawn in code and all sound is synthesised. Display type is
Caprasimo (SIL Open Font Licence), served from `/fonts`.
