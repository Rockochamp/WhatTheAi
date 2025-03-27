// ===============================================
// Global Offensive Word Blocklist v1.0
// ===============================================
// Used for basic client-side filtering of player names.
// Keep words lowercase for case-insensitive matching.
// NOTE: This is NOT foolproof and can be bypassed.
// Consider more robust server-side validation for critical applications.
// Add/Remove words as needed. Be mindful of potential false positives with common substrings.
// Using word boundary checks (\b) in the validation function helps mitigate some false positives.

const offensiveWords = [
    // Common English Profanity & Slurs (Examples - expand significantly)
    'anal', 'anus', 'arse', 'ass', 'assfucker', 'asshole', 'asswipe',
    'bastard', 'beaner', 'bitch', 'blowjob', 'bollocks', 'boner', 'boob', 'bugger', 'bum', 'butt', 'buttplug',
    'cameltoe', 'chink', 'clit', 'clitoris', 'cock', 'cocksucker', 'coon', 'crap', 'cum', 'cumshot', 'cunt',
    'damn', 'dick', 'dildo', 'dyke',
    'ejaculate',
    'fag', 'faggot', 'fanny', 'feck', 'felching', 'fellatio', 'flange', 'fuck', 'f u c k', 'fudgepacker',
    'gangbang', 'goddamn', 'god dam', 'gook', 'gringo', 'guido',
    'hell', 'heeb', 'ho', 'hoe', 'homo', 'hooker', 'horny', 'humping',
    'incest', 'injun',
    'jackoff', 'jap', 'jerk', 'jizz', 'junglebunny',
    'kike', 'knob', 'knobend', 'kunt', 'kyke',
    'labia', 'lust',
    'masochist', 'masturbate', 'milf', 'muff', 'motherfucker',
    'nazi', 'negro', 'nigga', 'nigger', 'n i g g e r', 'niger', 'hitler', 'adolf', 'cum',
    'orgasm',
    'paedo', 'paedophile', 'paki', 'pecker', 'penis', 'piss', 'poof', 'poon', 'porn', 'prick', 'prostitute', 'pube', 'pussy',
    'queaf', 'queef', 'queer',
    'rape', 'rapist', 'rectum', 'retard', 'rimjob', 'russki',
    'sadist', 'schlong', 'scrotum', 'semen', 'sex', 'shit', 's hit', 'shitter', 'shitting', 'skank', 'slut', 'smegma', 'spic', 'spunk', 'spastic',
    'stripper', 'suck',
    'tart', 'testicle', 'threesome', 'tit', 'tits', 'titties', 'titty', 'tosser', 'turd', 'twat',
    'unclefucker', 'urine',
    'vagina', 'viagra', 'vulva',
    'wank', 'wetback', 'whore', 'wtf',
    'xxx',
    'yid',
    // Add more terms, variations, leetspeak (e.g., fvck), etc.
    // Consider terms related to violence, hate speech categories (race, religion, orientation, etc.)
    // This list is illustrative and needs significant expansion for thoroughness.
  ];

  // Make it available globally (or could be exported as a module if using type="module")
  // Ensure this script is loaded BEFORE any game script that uses it.