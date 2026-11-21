// Steve Jobs – Hammurabi, Claude Fable 5.2 edition.
// The economy matches the site's earlier editions number for number. What is
// new: a reign's luck is drawn up front as a "fate", so the same fate can be
// ruled twice (by you and by the scribe) and shared by every player in a day.
import { rng, hashString, clamp } from "../../../js/fable/kit.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const RULES = Object.freeze({
  years: 10,
  food: 4000,
  land: 100,
  people: 100,
  acresPerPerson: 10,
  ration: 20, // bushels per person that hold hunger level
  fullRation: 30, // at this ration, new arrivals are certain
  priceMin: 18,
  priceMax: 28,
  yieldMin: 3,
  yieldMax: 7,
  riskStep: 0.4,
  riskRecovery: 0.35,
  starveAt: 0.85,
  arrivalCap: 50,
});

export const dailySeed = (day) => hashString(`hammurabi-fable:${day}`);

/** Every roll a ten-year reign can need, drawn once from a seed. */
export function fate(seed) {
  const r = rng(seed >>> 0),
    price = () => RULES.priceMin + Math.floor(r() * (RULES.priceMax - RULES.priceMin + 1));
  return {
    seed: seed >>> 0,
    firstPrice: price(),
    years: Array.from({ length: RULES.years }, () => ({
      yield: RULES.yieldMin + Math.floor(r() * (RULES.yieldMax - RULES.yieldMin + 1)),
      arrive: r(),
      arriveSize: r(),
      leave: r(),
      leaveSize: r(),
      event: r(),
      eventSize: r(),
      nextPrice: price(),
    })),
  };
}

export function initialState(f) {
  return { year: 0, food: RULES.food, land: RULES.land, people: RULES.people, price: f.firstPrice, risk: 0 };
}

export const riskAfter = (risk, feed) =>
  feed < RULES.ration
    ? risk + ((RULES.ration - feed) / RULES.ration) * RULES.riskStep
    : Math.max(0, risk - RULES.riskRecovery);

export function mood(risk) {
  if (risk < 0.1) return { label: "Well fed", tone: "good" };
  if (risk < 0.5) return { label: "Content", tone: "good" };
  if (risk < RULES.starveAt) return { label: "Hungry", tone: "warn" };
  return { label: "Starving", tone: "bad" };
}

/** Share of the people who will die of hunger at a given risk. */
export const starvationShare = (risk) =>
  risk > RULES.starveAt ? Math.min(0.45, (risk - RULES.starveAt) * 0.2) : 0;

const whole = (v) => Number.isSafeInteger(v);

/**
 * Checks a plan and works out its budget.
 * plan = { land: acres bought (+) or sold (−), plant: acres, feed: bushels per person }
 */
export function forecast(state, plan) {
  const errors = [];
  if (!whole(plan.land)) errors.push({ field: "land", message: "Trade whole acres." });
  if (!whole(plan.plant) || plan.plant < 0) errors.push({ field: "plant", message: "Plant a whole number of acres." });
  if (!whole(plan.feed) || plan.feed < 0) errors.push({ field: "feed", message: "Rations are whole bushels per person." });
  if (state.year >= RULES.years || state.people <= 0)
    errors.push({ field: "year", message: "This reign has ended." });
  if (errors.length) return { valid: false, errors };
  const land = state.land + plan.land,
    cost = plan.land * state.price,
    afterTrade = state.food - cost,
    rations = plan.feed * state.people,
    reserve = afterTrade - plan.plant - rations;
  if (land < 0) errors.push({ field: "land", message: `You own only ${state.land} acres.` });
  else if (afterTrade < 0)
    errors.push({ field: "land", message: `That land costs ${cost} bushels. The granary holds ${state.food}.` });
  if (plan.plant > Math.max(0, land))
    errors.push({ field: "plant", message: `Only ${Math.max(0, land)} acres are yours to plant.` });
  else if (plan.plant > state.people * RULES.acresPerPerson)
    errors.push({ field: "plant", message: `Your people can work ${state.people * RULES.acresPerPerson} acres at most.` });
  if (!errors.length && reserve < 0)
    errors.push({ field: "feed", message: `This plan is ${-reserve} bushels short. Plant less, feed less or sell land.` });
  const risk = riskAfter(state.risk, plan.feed);
  return {
    valid: errors.length === 0,
    errors,
    land,
    cost,
    afterTrade,
    rations,
    reserve,
    risk,
    plantLimit: Math.max(0, Math.min(land, state.people * RULES.acresPerPerson)),
    harvestMin: plan.plant * RULES.yieldMin,
    harvestMax: plan.plant * RULES.yieldMax,
    arrivalChance: clamp(plan.feed / RULES.fullRation, 0, 1),
    arrivalMax: Math.min(RULES.arrivalCap, Math.floor(state.people * 0.1 + land * 0.01 + 1)),
    starving: Math.ceil(state.people * starvationShare(risk)),
  };
}

/** Largest plan values that still fit, used by the sliders. */
export function limits(state, plan) {
  const maxBuy = Math.max(0, Math.floor(state.food / state.price)),
    land = clamp(plan.land, -state.land, maxBuy),
    after = state.food - land * state.price,
    plantMax = Math.max(0, Math.min(state.land + land, state.people * RULES.acresPerPerson, after)),
    plant = clamp(plan.plant, 0, plantMax),
    feedMax = state.people > 0 ? Math.max(0, Math.floor((after - plant) / state.people)) : 0;
  return { minLand: -state.land, maxLand: maxBuy, plantMax, feedMax };
}

/** Resolves one year. Never changes its arguments. */
export function resolve(state, plan, f) {
  const budget = forecast(state, plan);
  if (!budget.valid) return { ok: false, errors: budget.errors, state };
  const luck = f.years[state.year],
    next = { ...state, land: budget.land, food: budget.reserve, risk: budget.risk },
    report = {
      year: state.year + 1,
      plan: { ...plan },
      price: state.price,
      yield: luck.yield,
      harvest: plan.plant * luck.yield,
      starved: 0,
      arrivals: 0,
      left: 0,
      rats: 0,
      bonus: 0,
      plague: 0,
    };
  next.food += report.harvest;
  if (next.risk > RULES.starveAt && next.people > 0) {
    report.starved = Math.min(next.people, Math.ceil(next.people * starvationShare(next.risk)));
    next.people -= report.starved;
  }
  if (next.people > 0) {
    if (luck.arrive < plan.feed / RULES.fullRation) {
      report.arrivals = Math.min(RULES.arrivalCap, Math.floor(luck.arriveSize * (next.people * 0.1 + next.land * 0.01) + 1));
      next.people += report.arrivals;
    }
    if (plan.feed < 10 && luck.leave < 0.05) {
      report.left = Math.min(next.people, Math.floor(luck.leaveSize * next.people * 0.05 + 1));
      next.people -= report.left;
    }
    const e = luck.event;
    if (e < 0.15 && next.food > 10) {
      report.rats = Math.max(1, Math.floor(next.food * (luck.eventSize * 0.15 + 0.05)));
      next.food -= report.rats;
    } else if (e >= 0.15 && e < 0.25 && report.harvest > 0) {
      report.bonus = Math.max(1, Math.floor(report.harvest * (luck.eventSize * 0.1 + 0.05)));
      next.food += report.bonus;
    } else if (e >= 0.3 && e < 0.4 && next.people > 10) {
      report.plague = Math.min(next.people, Math.max(1, Math.floor(next.people * (luck.eventSize * 0.15 + 0.05))));
      next.people -= report.plague;
    }
  }
  next.year++;
  next.price = luck.nextPrice;
  report.people = next.people;
  report.food = next.food;
  report.land = next.land;
  report.peopleChange = next.people - state.people;
  report.foodChange = next.food - state.food;
  return { ok: true, state: next, report, ended: next.year >= RULES.years || next.people === 0 };
}

/* ------------------------------------------------------------ the scribe */

// What an average year does, used to look ahead without knowing the fate.
function expectedYear(s, plan) {
  const land = s.land + plan.land,
    risk = riskAfter(s.risk, plan.feed);
  let food = s.food - plan.land * s.price - plan.plant - plan.feed * s.people,
    people = s.people;
  const harvest = plan.plant * 5;
  food += harvest;
  people -= people * starvationShare(risk);
  people += clamp(plan.feed / RULES.fullRation, 0, 1) * Math.min(RULES.arrivalCap, 0.5 * (people * 0.1 + land * 0.01) + 1);
  food -= 0.15 * food * 0.125;
  food += 0.1 * harvest * 0.1;
  people -= 0.1 * people * 0.125;
  return { year: s.year + 1, food, land, people, price: 23, risk };
}
// A sensible default used beyond the first year of the look-ahead.
function routine(s) {
  const last = s.year >= RULES.years - 1,
    people = Math.floor(s.people);
  let food = Math.floor(s.food),
    land = 0;
  const want = people * RULES.acresPerPerson + (last ? 0 : 20);
  let feed = Math.min(RULES.fullRation, Math.floor(food / Math.max(1, people)));
  if (feed < RULES.ration && s.land > 0) {
    // sell just enough land to hold the standard ration
    land = -Math.min(Math.floor(s.land), Math.ceil(((RULES.ration - feed) * people) / s.price));
    feed = Math.min(RULES.fullRation, Math.floor((food - land * s.price) / Math.max(1, people)));
  }
  const afterFeed = food - land * s.price - feed * people;
  let plant = last ? 0 : Math.max(0, Math.min(Math.floor(s.land) + land, people * RULES.acresPerPerson, afterFeed));
  if (!last && land === 0 && s.land < want) {
    const spare = afterFeed - plant - people * 8;
    if (spare > s.price) land = Math.min(Math.ceil(want - s.land), Math.floor(spare / s.price));
  }
  return { land, plant, feed };
}
function outlook(s) {
  let cur = s;
  while (cur.year < RULES.years && cur.people >= 1) cur = expectedYear(cur, routine(cur));
  return cur.people + Math.min(cur.food, 4000) * 1e-5;
}

/** The scribe's counsel: the plan with the best expected ending. */
export function advise(state) {
  if (state.year >= RULES.years || state.people <= 0) return null;
  const maxBuy = Math.floor(state.food / state.price),
    trades = new Set([0]);
  for (const share of [0.1, 0.2, 0.35, 0.5, 0.75, 1]) {
    trades.add(Math.floor(maxBuy * share));
    trades.add(-Math.floor(state.land * share));
  }
  const target = state.people * RULES.acresPerPerson - state.land;
  for (const extra of [0, 10, 20, 40]) if (target + extra > 0 && target + extra <= maxBuy) trades.add(target + extra);
  let best = null;
  for (const land of trades)
    for (const feed of [30, 25, 20, 15, 10, 5, 0]) {
      const after = state.food - land * state.price - feed * state.people;
      if (after < 0 || state.land + land < 0) continue;
      const plantMax = Math.max(0, Math.min(state.land + land, state.people * RULES.acresPerPerson, after));
      for (const plant of state.year === RULES.years - 1 ? [0] : [plantMax, Math.floor(plantMax / 2)]) {
        const plan = { land, plant, feed },
          value = outlook(expectedYear(state, plan));
        if (!best || value > best.value + 1e-9) best = { plan, value };
      }
    }
  const p = best.plan,
    reasons = [];
  if (state.year === RULES.years - 1) reasons.push("It is the last year. Seed planted now is never harvested, so everything goes to the people.");
  if (p.feed >= RULES.fullRation) reasons.push("Thirty bushels a head makes new arrivals certain.");
  else if (p.feed >= RULES.ration) reasons.push("Twenty bushels a head keeps hunger from building.");
  else if (forecast(state, p).starving > 0)
    reasons.push("Some will starve this year. The scribe judges that the city still ends larger this way.");
  else
    reasons.push("Hunger stays short of the breaking point this year, so the grain goes into the fields instead of rations. Feed the people properly before it tips.");
  if (p.land > 0) reasons.push(`Land is ${state.price} bushels an acre. More acres mean bigger harvests and more arrivals.`);
  if (p.land < 0) reasons.push("Selling land turns idle acres into food.");
  if (p.plant > 0) reasons.push("Each planted acre costs one bushel and returns three to seven.");
  return { plan: p, reasons, expected: Math.round(best.value) };
}

/** Rules a whole fate with a policy. Returns the final state and reports. */
export function reign(f, policy = (s) => advise(s).plan) {
  let state = initialState(f);
  const reports = [];
  while (state.year < RULES.years && state.people > 0) {
    const out = resolve(state, policy(state), f);
    if (!out.ok) throw new Error(`Policy offered an invalid plan in year ${state.year + 1}`);
    state = out.state;
    reports.push(out.report);
  }
  return { state, reports };
}

export function epithet(people) {
  if (people <= 0) return "the Forgotten";
  if (people < 70) return "the Careless";
  if (people < 100) return "the Diminisher";
  if (people < 125) return "the Steward";
  if (people < 150) return "the Provider";
  if (people < 180) return "the Builder";
  if (people < 215) return "the Great";
  return "the Lawgiver";
}

/** One chronicle sentence per notable thing in a year's report. */
export function chronicle(r) {
  const lines = [],
    n = (v, one, many = `${one}s`) => `${v.toLocaleString("en-US")} ${v === 1 ? one : many}`;
  if (r.plan.land > 0) lines.push({ tone: "plain", text: `Bought ${n(r.plan.land, "acre")} at ${r.price} bushels each.` });
  if (r.plan.land < 0) lines.push({ tone: "plain", text: `Sold ${n(-r.plan.land, "acre")} at ${r.price} bushels each.` });
  if (r.plan.plant > 0)
    lines.push({
      tone: r.yield >= 6 ? "good" : r.yield <= 3 ? "warn" : "plain",
      text: `The fields gave ${r.yield} bushels an acre: ${n(r.harvest, "bushel")} from ${n(r.plan.plant, "acre")}.`,
    });
  else lines.push({ tone: "warn", text: "Nothing was planted." });
  if (r.bonus) lines.push({ tone: "good", text: `The river was generous. ${n(r.bonus, "bushel")} more came in.` });
  if (r.rats) lines.push({ tone: "warn", text: `Rats got into the granary and ruined ${n(r.rats, "bushel")}.` });
  if (r.starved) lines.push({ tone: "bad", text: `${n(r.starved, "person", "people")} starved.` });
  if (r.plague) lines.push({ tone: "bad", text: `A plague took ${n(r.plague, "life", "lives")}.` });
  if (r.left) lines.push({ tone: "warn", text: `${n(r.left, "person", "people")} left to find a kinder ruler.` });
  if (r.arrivals) lines.push({ tone: "good", text: `${n(r.arrivals, "newcomer")} settled in the city.` });
  return lines;
}
