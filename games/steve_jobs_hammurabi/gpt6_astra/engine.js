// The Grok 3 v6 economy and event probabilities, separated from the interface.
export const RULES = Object.freeze({
  years: 10,
  foodPerPerson: 20,
  acresPerPerson: 10,
  minYield: 3,
  maxYield: 7,
  riskIncrease: 0.4,
  riskRecovery: 0.35,
  deathThreshold: 0.85,
  deathRate: 0.2,
  maxDeathFraction: 0.45,
});
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const price = (random) => Math.floor(random() * 11) + 18;
export function initialState(random = Math.random) {
  return {
    year: 0,
    food: 4000,
    land: 100,
    pawns: 100,
    landPrice: price(random),
    starvationRisk: 0,
  };
}
export function riskAfter(risk, feed) {
  return feed < 20 ? risk + ((20 - feed) / 20) * 0.4 : Math.max(0, risk - 0.35);
}
export function wellbeing(risk) {
  if (risk < 0.1) return { label: "Well fed", tone: "good" };
  if (risk < 0.5) return { label: "Content", tone: "good" };
  if (risk < 0.85) return { label: "Concerned", tone: "warning" };
  if (risk < 1.2) return { label: "High risk", tone: "danger" };
  return { label: "Critical", tone: "danger" };
}
export function forecast(state, plan) {
  const errors = [];
  for (const key of ["buy", "sell", "plant", "feed"]) {
    if (!integer(plan[key]))
      errors.push({
        field: key,
        message: "Use whole numbers of zero or more.",
      });
  }
  if (state.year >= 10 || state.pawns <= 0)
    errors.push({
      field: "year",
      message: "This reign has ended. Begin a new reign to play again.",
    });
  if (errors.length) return { valid: false, errors };
  const { buy, sell, plant, feed } = plan;
  const land = state.land + buy - sell;
  const trade = (sell - buy) * state.landPrice;
  const available = state.food + trade;
  const foodForPeople = feed * state.pawns;
  const reserve = available - plant - foodForPeople;
  const plantLimit = Math.max(0, Math.min(land, state.pawns * 10, available));
  if (buy > 0 && sell > 0)
    errors.push({
      field: "buy",
      message: "Buy or sell land in a year, never both.",
    });
  if (sell > state.land)
    errors.push({
      field: "sell",
      message: `You own only ${state.land} acres.`,
    });
  if (available < 0)
    errors.push({
      field: "buy",
      message: `Land costs ${buy * state.landPrice} bushels. You have ${state.food}.`,
    });
  if (plant > land)
    errors.push({
      field: "plant",
      message: `Only ${Math.max(0, land)} acres are available after this trade.`,
    });
  if (plant > state.pawns * 10)
    errors.push({
      field: "plant",
      message: `Your people can tend at most ${state.pawns * 10} acres.`,
    });
  if (plant > available)
    errors.push({
      field: "plant",
      message: "There is not enough food left for these seeds.",
    });
  if (reserve < 0)
    errors.push({
      field: "feed",
      message: `Your plan needs ${-reserve} more bushels before the harvest. Reduce spending or sell land.`,
    });
  return {
    valid: errors.length === 0,
    errors,
    land,
    trade,
    available,
    foodForPeople,
    reserve,
    plantLimit,
    harvestMin: plant * 3,
    harvestMax: plant * 7,
    risk: riskAfter(state.starvationRisk, feed),
  };
}
export function advanceYear(state, plan, random = Math.random) {
  const budget = forecast(state, plan);
  if (!budget.valid) return { ok: false, errors: budget.errors, state };
  const next = {
    ...state,
    land: budget.land,
    food: budget.reserve,
    starvationRisk: budget.risk,
  };
  const report = {
    year: state.year + 1,
    trade: budget.trade,
    seed: plan.plant,
    feeding: budget.foodForPeople,
    yield: Math.floor(random() * 5) + 3,
    starved: 0,
    arrivals: 0,
    left: 0,
    rats: 0,
    bonus: 0,
    plague: 0,
    events: [],
  };
  report.harvest = plan.plant * report.yield;
  next.food += report.harvest;
  if (next.starvationRisk > 0.85 && next.pawns > 0) {
    report.starved = Math.min(
      next.pawns,
      Math.ceil(
        next.pawns * Math.min(0.45, (next.starvationRisk - 0.85) * 0.2),
      ),
    );
    next.pawns -= report.starved;
    if (report.starved)
      report.events.push({
        tone: "danger",
        title: "Hunger takes its toll",
        text: `${report.starved} people died. Sustained feeding is needed to restore health.`,
      });
  }
  if (next.pawns > 0) {
    if (random() < plan.feed / 30) {
      report.arrivals = Math.min(
        50,
        Math.floor(random() * (next.pawns * 0.1 + next.land * 0.01) + 1),
      );
      next.pawns += report.arrivals;
      report.events.push({
        tone: "good",
        title: "New arrivals",
        text: `${report.arrivals} people have joined your kingdom.`,
      });
    }
    if (plan.feed < 10 && random() < 0.05) {
      report.left = Math.min(
        next.pawns,
        Math.floor(random() * (next.pawns * 0.05) + 1),
      );
      next.pawns -= report.left;
      report.events.push({
        tone: "warning",
        title: "A difficult departure",
        text: `${report.left} people left in search of better conditions.`,
      });
    }
    const event = random();
    if (event < 0.15 && next.food > 10) {
      report.rats = Math.max(
        1,
        Math.floor(next.food * (random() * 0.15 + 0.05)),
      );
      next.food -= report.rats;
      report.events.push({
        tone: "warning",
        title: "Rats in the granary",
        text: `An infestation destroyed ${report.rats} bushels.`,
      });
    } else if (event >= 0.15 && event < 0.25 && report.harvest > 0) {
      report.bonus = Math.max(
        1,
        Math.floor(report.harvest * (random() * 0.1 + 0.05)),
      );
      next.food += report.bonus;
      report.events.push({
        tone: "good",
        title: "A gift from the river",
        text: `Favorable weather brought ${report.bonus} extra bushels.`,
      });
    } else if (event >= 0.3 && event < 0.4 && next.pawns > 10) {
      report.plague = Math.min(
        next.pawns,
        Math.max(1, Math.floor(next.pawns * (random() * 0.15 + 0.05))),
      );
      next.pawns -= report.plague;
      report.events.push({
        tone: "danger",
        title: "Plague strikes",
        text: `Disease took ${report.plague} lives this year.`,
      });
    }
  }
  // Count the year that just resolved, even when it was the final year of a collapse.
  next.year++;
  next.pawns = Math.max(0, next.pawns);
  next.landPrice = price(random);
  report.foodChange = next.food - state.food;
  report.populationChange = next.pawns - state.pawns;
  if (!report.events.length)
    report.events.push({
      tone: "neutral",
      title: "A quiet year",
      text: "No unexpected events. The kingdom carries on.",
    });
  return {
    ok: true,
    state: next,
    report,
    ended: next.year >= 10 || next.pawns === 0,
  };
}
