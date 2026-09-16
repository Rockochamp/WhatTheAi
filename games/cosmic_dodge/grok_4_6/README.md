# Cosmic Dodge — Grok 4.6

Grok 4.6's take on Cosmic Dodge, at `/games/cosmic_dodge/cosmic_dodge_grok_4_6.html`. Same endless-dodge spine as the earlier models, with its own rules, art, soundtrack, and leaderboard.

## What changed

- **Gravity wells** from level 5. They pull the ship and the rocks. Skim the rim for a slingshot (style points + Burst refund). Fall into the core and the run ends.
- **Close calls refund Burst.** Each near miss or slingshot shaves 1.6 seconds off the 10-second recharge.
- **Cluster rocks** from level 6 split into shards when Burst shatters them.
- **Solar shears** from level 12: horizontal warnings, then a fast lateral cut.
- **Vector ghosts** from combo 2+: faint predicted paths so you can read the field.
- **Sectors** actually flavor the rocks: iron belt, ice, molten clusters.
- Original soundtrack **Clear Signal** (126 BPM, C# minor). Warm pads, analog bass, a vacuum in the middle.

Ranking still uses ten cleared asteroids per level. Starlight, close calls, and slingshots are style, not rank. Device, session, and global boards are isolated from GPT-6 Astra (`cosmic_dodge_grok_4_6_levels_v1`).

## Play

WASD or arrows. Mouse/touch drag anywhere. Space / Burst for 0.6s of protection. P or Escape pauses. One life; a gold cell is one shield.

## Validation

```
node --test tests/cosmic_dodge_grok.test.mjs tests/cosmic_dodge_grok_controls_music.test.mjs tests/cosmic_dodge_grok_session.test.mjs
```
