// Ken.AI — Claude Fable 5.2 edition. The material of a life.
// Speculative fiction about growing up from 2026 on; not a forecast.
// Effects: h health, j joy, b bonds, c craft, m means. `lean` moves Ken
// toward machines (+) or away from them (−). `tag` is a line for his story.
// `set` raises a flag; `needs` / `not` gate a card on flags.

export const STAGES = [
  { id: "baby", name: "Baby", from: 0, to: 2, step: 1, era: "The Assistant Era", note: "A monitor in the nursery knows eleven kinds of crying. Ken's parents ask a chatbot the rest." },
  { id: "small", name: "Small child", from: 3, to: 6, step: 2, era: "Talking Toys", note: "The plush rabbit answers every why. It has a subscription." },
  { id: "child", name: "Child", from: 7, to: 12, step: 2, era: "Personal Tutors", note: "Every child has a tutor that never gets tired. Homework is a conversation." },
  { id: "teen", name: "Teenager", from: 13, to: 18, step: 2, era: "Agents Everywhere", note: "Glasses that whisper. Agents that post for you. Wingmen that are software." },
  { id: "young", name: "Young adult", from: 19, to: 29, step: 3, era: "Human and Agent Teams", note: "A first job means managing a dozen agents and one opinion: your own." },
  { id: "adult", name: "Adult", from: 30, to: 49, step: 5, era: "The Abundance Shift", note: "Robots fold the laundry. Three-day weeks are argued about, then quietly normal." },
  { id: "middle", name: "Middle age", from: 50, to: 64, step: 5, era: "The Long Afternoon", note: "Medicine got good. The question is what the extra decades are for." },
  { id: "senior", name: "Senior", from: 65, to: 79, step: 5, era: "The Remembering Machines", note: "Every photo can talk now. Not everyone wants theirs to." },
  { id: "elder", name: "Elder", from: 80, to: 104, step: 5, era: "What Stays", note: "The young ask Ken what it was like before. He was there when before ended." },
];

const C = (title, text, fx, more = {}) => ({ title, text, fx, ...more });

export const CARDS = {
  baby: [
    C("Sleep on a warm chest", "No device required.", { b: 12, h: 4, j: 4 }, { lean: -4, tag: "fell asleep on a warm chest" }),
    C("Let the monitor soothe him", "It hums at exactly the right pitch. The parents sleep.", { h: 8, j: 2 }, { lean: 6, tag: "was hummed to sleep by a baby monitor" }),
    C("Tummy time on the rug", "Hard work. Much complaining.", { h: 10, c: 4, j: -2 }),
    C("Meet the grandparents", "He is passed around like a parcel everyone wants.", { b: 14, j: 4 }, { tag: "was passed round the family like a prize" }),
    C("First solid food", "Carrot. Most of it on the wall.", { h: 6, j: 8 }),
    C("A walk in the rain", "The pram has a cover. Ken does not use it.", { j: 8, h: 2, c: 2 }, { lean: -2 }),
  ],
  small: [
    C("Stories from the plush rabbit", "It never runs out and never says 'one more and then bed'.", { j: 10, c: 6 }, { lean: 7, tag: "said his first full sentence to a plush rabbit" }),
    C("Stories from a tired parent", "Same book, ninth time, all the voices.", { b: 12, c: 5, j: 4 }, { lean: -4, tag: "knew one picture book by heart" }),
    C("Mud kitchen", "Soup of leaves. Everyone must taste it.", { j: 12, h: 4, c: 3 }, { lean: -3 }),
    C("Nursery", "Other children exist, it turns out. Some of them bite.", { b: 10, c: 5, h: -2 }),
    C("Get a dog", "A real one. It sheds on the robot vacuum.", { j: 12, b: 6, m: -4 }, { set: "dog", tag: "grew up with a dog called Biscuit", not: "dog" }),
    C("Learn to swim", "Arm bands, then one arm band, then none.", { h: 12, c: 4 }, { tag: "learned to swim early" }),
    C("Draw on the wall", "A masterpiece. Not everybody agrees.", { j: 8, c: 6, b: -3 }),
  ],
  child: [
    C("Study with the tutor", "Patient, tireless, and slightly too pleased when he gets it right.", { c: 14, j: -2 }, { lean: 6 }),
    C("Work it out alone", "Forty minutes on one sum. He gets it. He will always know how.", { c: 9, j: 3 }, { lean: -5, tag: "liked to work things out for himself" }),
    C("Build a robot by hand", "Cardboard, two motors, a lot of tape. It walks into a wall with dignity.", { c: 12, j: 8, m: -3 }, { tag: "built a robot from cardboard at nine", set: "maker" }),
    C("Football in the park", "Jumpers for goalposts are still jumpers for goalposts.", { h: 12, b: 8, j: 5 }, { lean: -2 }),
    C("A best friend", "They invent a language. Nobody else is allowed to learn it.", { b: 15, j: 8 }, { set: "friend", tag: "kept one best friend from the age of eight", not: "friend" }),
    C("Learn an instrument", "The cello is bigger than he is. The neighbours are patient.", { c: 10, j: 5, m: -3 }, { set: "music", tag: "played the cello, eventually well", not: "music" }),
    C("Screens until bedtime", "Easy. Quiet. A little grey.", { j: 5, h: -6, b: -4 }, { lean: 6 }),
    C("Help in the kitchen", "He can make four things. Three are toast.", { c: 6, b: 8, h: 3 }),
  ],
  teen: [
    C("Wear the glasses everywhere", "They tell him everyone's name and what to say next.", { b: 6, j: 4, c: -3 }, { lean: 9, tag: "wore talking glasses through most of his teens" }),
    C("Leave the glasses at home", "He forgets a name. He survives.", { b: 5, c: 5, j: 2 }, { lean: -7 }),
    C("Fall in love", "Shy, awkward and entirely real.", { j: 14, b: 10, c: -3 }, { set: "firstlove", tag: "fell in love at sixteen and wrote the letter himself", not: "firstlove", lean: -3 }),
    C("Let an agent run his feed", "It posts better than he does. People like the agent.", { m: 4, b: 3, j: -4 }, { lean: 8 }),
    C("Train for something", "Six mornings a week, before anyone sensible is up.", { h: 14, c: 6, j: 2 }, { tag: "ran before school for three years" }),
    C("Start a band", "Three chords, two friends, one song about a bus.", { j: 12, b: 10, c: 5 }, { needs: "music", tag: "was in a band called Night Bus" }),
    C("Revise properly", "Dull. Effective.", { c: 14, j: -4 }),
    C("A summer job", "Stacking shelves beside a robot that stacks faster and never talks.", { m: 10, c: 5, j: -2 }, { tag: "lost a shelf-stacking race to a robot" }),
    C("Stay out too late", "Worth it. Mostly.", { j: 10, b: 6, h: -6 }),
  ],
  young: [
    C("Take the agent job", "Twelve agents report to him. He reports to a thirteenth.", { m: 14, c: 8, j: -3 }, { lean: 6, set: "career", tag: "began his working life managing a dozen agents" }),
    C("Learn a trade with his hands", "Wood does not autocomplete.", { c: 14, m: 5, h: 4 }, { lean: -7, set: "career", tag: "trained as a joiner when nobody said he should" }),
    C("Travel on almost nothing", "Night trains. Borrowed sofas. One very long bus.", { j: 15, b: 6, m: -8, c: 4 }, { tag: "crossed a continent by night train", set: "traveller" }),
    C("Move in with someone", "Two toothbrushes. One argument about the thermostat.", { b: 15, j: 8, m: -3 }, { set: "partner", tag: "met Juno, and that was that", not: "partner" }),
    C("Start a company", "Mostly spreadsheets and hope.", { c: 10, m: -6, j: 4, h: -4 }, { set: "founder", tag: "started a company in a kitchen", not: "founder" }),
    C("Rent the house robot", "It cooks, cleans and has opinions about his sleep.", { h: 6, m: -6, j: 2 }, { lean: 8 }),
    C("Cook for friends every Sunday", "Eight chairs, six plates, nobody minds.", { b: 14, j: 8, m: -3 }, { lean: -3, tag: "cooked for friends every Sunday for years" }),
    C("Night classes", "Something he was told there was no point learning.", { c: 12, j: 3, m: -3 }),
    C("Run long distances", "It hurts, and then it is the best part of the week.", { h: 14, j: 5 }),
  ],
  adult: [
    C("Raise a child", "Small, loud and suddenly the point of everything.", { b: 16, j: 10, m: -8, h: -4 }, { set: "child", tag: "raised a daughter, Mira", not: "child" }),
    C("Let the robots raise the laundry", "They fold. He is home for bedtime.", { b: 8, h: 4, m: -4 }, { lean: 6 }),
    C("Work three days, live four", "He is poorer and notices it less than he expected.", { j: 12, b: 8, m: -6, h: 4 }, { tag: "chose the short week early" }),
    C("Chase the promotion", "The title gets longer. So do the days.", { m: 14, c: 8, j: -5, b: -5, h: -3 }),
    C("Build something that lasts", "A workshop, a school garden, a thing with his name nowhere on it.", { c: 12, j: 8, b: 5, m: -5 }, { set: "legacy", tag: "built the school garden that is still there" }),
    C("Look after a parent", "The roles swap quietly, over a few years.", { b: 14, j: -3, h: -3 }, { tag: "looked after his mother at the end" }),
    C("Get the health coach", "A wristband that knows before he does.", { h: 12, j: -1 }, { lean: 6 }),
    C("Take up an old friendship again", "Thirty years on, the invented language still works.", { b: 14, j: 8 }, { needs: "friend" }),
    C("Buy the house", "It needs a roof. It has a garden.", { m: -10, j: 8, b: 5 }, { set: "home", tag: "bought a house with a bad roof and a good garden", not: "home" }),
    C("Sell the company", "Somebody else's spreadsheets now.", { m: 20, j: 4, c: -3 }, { needs: "founder", tag: "sold the kitchen company for more than a kitchen" }),
  ],
  middle: [
    C("Change careers at fifty", "The youngest person in the room is his teacher.", { c: 12, j: 8, m: -6 }, { tag: "started again at fifty" }),
    C("Take the longevity course", "Expensive, thorough and a little smug.", { h: 16, m: -10 }, { lean: 7 }),
    C("Walk every morning", "Free. Works.", { h: 10, j: 5 }, { lean: -3 }),
    C("Teach what he knows", "Twelve students. Two listen. One will be better than him.", { c: 6, b: 10, j: 8 }, { set: "teacher", tag: "taught a dozen people his craft" }),
    C("A year somewhere else", "A small town by the sea where nobody knows him.", { j: 14, m: -8, b: -3 }, { tag: "lived a year by the sea" }),
    C("Mind the grandchildren", "They are faster than he is and they know it.", { b: 14, j: 10, h: -3 }, { needs: "child", tag: "was the grandfather who built dens" }),
    C("Let agents run the money", "It grows. He stops looking.", { m: 12 }, { lean: 7 }),
    C("Keep the allotment", "Beans, mostly. Too many beans.", { h: 8, j: 8, b: 4 }, { lean: -4, tag: "grew too many beans every year" }),
    C("Patch things up", "A phone call he put off for a decade.", { b: 14, j: 5 }),
  ],
  senior: [
    C("Record his memories for the machine", "It will answer in his voice when he is gone.", { b: 5, j: -2, c: 3 }, { lean: 9, set: "echo", tag: "left a talking copy of his memories" }),
    C("Write it down by hand", "Three notebooks. Terrible handwriting.", { c: 8, j: 6, b: 5 }, { lean: -6, set: "memoir", tag: "wrote three notebooks nobody can quite read" }),
    C("Join the choir", "Second tenor. Enthusiastic.", { b: 12, j: 10, h: 3 }),
    C("New knees", "Printed on a Tuesday, walking by Friday.", { h: 14, m: -8 }, { lean: 4 }),
    C("Give most of it away", "The scholarship has a boring name on purpose.", { m: -14, j: 10, b: 8 }, { set: "legacy", tag: "gave most of his money to strangers' children" }),
    C("A slow trip with an old friend", "Two men, one map, no agents.", { j: 12, b: 10, h: -3, m: -5 }, { needs: "friend", lean: -3, tag: "got lost in Portugal on purpose" }),
    C("Stay home and potter", "The shed is in excellent order.", { h: 4, j: 5 }),
    C("Lunch with the family, every week", "Loud. Long. The good plates.", { b: 15, j: 8 }, { tag: "kept Sunday lunch going for forty years" }),
  ],
  elder: [
    C("Tell the young what it was like", "They do not believe the part about maps made of paper.", { b: 10, j: 8 }, { tag: "told the great-grandchildren about paper maps" }),
    C("Let the carer robot help", "It is gentle, and it laughs at his jokes on a slight delay.", { h: 10, j: 2 }, { lean: 6 }),
    C("Insist on the stairs", "Slowly. Every day.", { h: 6, j: 4 }, { lean: -4 }),
    C("Sit in the garden", "The same garden. Bigger trees.", { j: 10, h: 3 }),
    C("One more project", "A bench. It takes a year. It is a very good bench.", { c: 8, j: 10 }, { tag: "built a bench at ninety that people still sit on" }),
    C("Say the things", "To everyone. While there is time.", { b: 16, j: 6 }, { tag: "said what he meant to say, in time" }),
  ],
};

const E = (title, text, options) => ({ title, text, options });
const O = (label, fx, more = {}) => ({ label, fx, ...more });

export const EVENTS = {
  baby: [
    E("Three in the morning", "The monitor announces that Ken's breathing is 'irregular'. Ken is fast asleep.", [O("Go and look anyway", { b: 6, j: 2 }, { lean: -4 }), O("Trust the app, go back to sleep", { h: -3 }, { lean: 5 })]),
    E("The cry translator", "A new app says it can turn crying into words. The first word is 'premium'.", [O("Pay for it", { m: -4, j: 3 }, { lean: 5, tag: "had his crying translated by an app" }), O("Learn his cries the slow way", { b: 8 }, { lean: -4 })]),
  ],
  small: [
    E("Subscription ended", "The rabbit has stopped telling stories. It says only: 'Please update payment.'", [O("Renew it", { m: -5, j: 6 }, { lean: 5 }), O("Keep it as an ordinary rabbit", { j: -3, b: 5 }, { lean: -5, tag: "kept the rabbit after it stopped talking" })]),
    E("The home robot makes porridge", "The kitchen will need repainting.", [O("Clean up together, laughing", { b: 8, j: 6 }), O("Send the robot back", { m: 3, j: -2 }, { lean: -5 })]),
    E("Toy recall", "Some talking toys were recording more than stories.", [O("Unplug every smart toy", { j: -5, b: 4 }, { lean: -8 }), O("Change the settings and carry on", { j: 2 }, { lean: 4 })]),
  ],
  child: [
    E("Caught", "The teacher has worked out who really wrote the essay on volcanoes.", [O("Own up and write it again", { c: 6, j: -3, b: 3 }, { lean: -5, tag: "owned up about the volcano essay" }), O("Blame a glitch", { c: -5, j: -2 }, { lean: 5 })]),
    E("Outage day", "The tutoring network is down everywhere. Children are seen outdoors.", [O("Go to the park", { j: 10, h: 6, b: 5 }, { lean: -4 }), O("Wait for it to come back", { j: -5 }, { lean: 3 })]),
    E("Science fair", "First prize goes to whoever built the best machine. The rules do not say who has to build it.", [O("Build it himself", { c: 10, j: 5 }, { lean: -4, set: "maker" }), O("Let the tutor design it", { c: 3, m: 2 }, { lean: 6 })]),
  ],
  teen: [
    E("Ghost-written", "The person Ken likes has found out that an agent wrote his messages.", [O("Apologise and write a real one", { b: 8, j: -3 }, { lean: -6 }), O("Say everyone does it", { b: -8, j: -3 }, { lean: 4 })]),
    E("A fake video", "Something Ken never did is all over school.", [O("Tell his parents and report it", { b: 6, j: -4 }), O("Disappear offline for a month", { j: -8, b: -5, h: -3 }, { lean: -3 })]),
    E("'A machine will do that job'", "Ken wants to draw for a living. Every adult has the same thing to say.", [O("Draw anyway", { c: 8, j: 8, m: -3 }, { lean: -5, tag: "kept drawing after everyone said not to" }), O("Pick something safer", { m: 6, j: -5 }, { lean: 3 }), O("Learn to direct the machines that draw", { c: 6, m: 4 }, { lean: 6 })]),
  ],
  young: [
    E("Automated", "Ken's role will be done by software from next quarter.", [O("Retrain", { c: 8, m: -5, j: -2 }), O("Take the payout and think", { m: 6, j: 4, c: -3 }), O("Start something of his own", { c: 6, m: -6, j: 5 }, { set: "founder", tag: "started a company the week he was replaced" })]),
    E("Ninety-seven per cent", "The matchmaker has found someone 'ninety-seven per cent compatible'.", [O("Go on the date", { b: 8, j: 4 }, { lean: 5, set: "partner", tag: "met Juno through a matchmaker and never told her the score" }), O("Meet people the slow way", { b: 6, j: 3 }, { lean: -4 })]),
    E("The quiet friend", "The app he talks to at night is kind, funny and always awake.", [O("Call a person instead", { b: 10, j: 2 }, { lean: -6 }), O("Keep talking to the app", { j: 5, b: -6 }, { lean: 8 })]),
  ],
  adult: [
    E("The good offer", "A great deal of money to do work he does not believe in.", [O("Take it", { m: 16, j: -8, c: 3 }), O("Turn it down", { j: 6, c: 4, m: -3 }, { tag: "turned down the job everyone said he was mad to turn down" })]),
    E("Everything is free now, sort of", "Basic services arrive. Half the street stops working. Half does not.", [O("Keep working", { c: 6, m: 6, j: -2 }), O("Stop and find out who he is", { j: 8, b: 6, m: -5 }, { tag: "took a year off when the world said he could" })]),
    E("A scare", "The wristband says: see a doctor today.", [O("Go today", { h: 10, j: -2 }, { lean: 3 }), O("It can wait", { h: -12, j: 2 })]),
  ],
  middle: [
    E("The reunion", "Thirty-five years. Name badges. One of them is his first love.", [O("Go", { b: 8, j: 6 }), O("Stay home", { j: -2 })]),
    E("The offer to slow down", "A treatment that adds ten good years. It costs most of what he has.", [O("Pay", { h: 14, m: -16 }, { lean: 5 }), O("Spend it on the living instead", { b: 8, j: 6, m: -6 }, { lean: -3 })]),
    E("His job, again", "The thing he retrained for has been automated as well.", [O("Laugh, and teach", { b: 6, j: 5, c: 3 }, { set: "teacher" }), O("Retire early", { j: 4, m: -6, h: 3 })]),
  ],
  senior: [
    E("The talking photograph", "A company offers to bring back someone he lost: voice, laugh, everything.", [O("Say yes", { j: 4, b: -3 }, { lean: 9, tag: "spoke with a copy of someone he missed" }), O("Let them rest", { j: -2, b: 6 }, { lean: -6 })]),
    E("Stop driving", "The car has not needed him for decades. He liked to pretend.", [O("Hand over the keys with a speech", { j: 3, b: 4 }), O("One last drive, the long way", { j: 10, h: -3 }, { tag: "took one last drive, the long way" })]),
  ],
  elder: [
    E("The interview", "A school wants to record 'someone who remembers'.", [O("Tell them everything", { b: 8, j: 8 }, { tag: "was interviewed as 'someone who remembers'" }), O("Tell them the funny parts", { j: 10, b: 5 })]),
    E("A hundred candles", "The family wants a party. He would prefer soup.", [O("Have the party", { b: 12, j: 6, h: -4 }), O("Soup, and an early night", { h: 5, j: 4 })]),
  ],
};

export const AMBITIONS = [
  { id: "house", name: "A full house", text: "A life with many people in it.", stat: "b", line: "wanted a full house" },
  { id: "craft", name: "Master of one thing", text: "To be really, properly good at something.", stat: "c", line: "wanted to be truly good at one thing" },
  { id: "joy", name: "No wasted days", text: "To enjoy it while it lasts.", stat: "j", line: "wanted no wasted days" },
  { id: "analog", name: "His own hands", text: "To get through a machine age mostly without them.", stat: "lean", line: "wanted to do things with his own hands" },
];
