import { METRICS_CONFIG } from "@tcgtycoon/balance";
import { DeterministicRng, deriveSeed } from "@tcgtycoon/rules-engine";

export type LifecyclePopulationState = {
  potential: number;
  interested: number;
  newByAge: number[];
  active: number;
  atRisk: number;
  churned: number;
  returning: number;
};

export type LifecycleRates = {
  potentialToInterested: number;
  interestedToNew: number;
  newToActive: number;
  activeToAtRisk: number;
  atRiskToChurned: number;
  churnedToReturning: number;
  returningToActive: number;
};

export type LifecycleDeltas = {
  potentialToInterested: number;
  interestedToNew: number;
  newToActive: number;
  activeToAtRisk: number;
  atRiskToChurned: number;
  churnedToReturning: number;
  returningToActive: number;
};

export type LifecycleDayInput = {
  worldSeed: string;
  day: number;
  rates: LifecycleRates;
};

export type LifecycleDayResult = {
  population: LifecyclePopulationState;
  deltas: LifecycleDeltas;
};

function validateCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

function validatePopulation(state: LifecyclePopulationState): void {
  if (state.newByAge.length !== METRICS_CONFIG.lifecycle.onboardingDays) {
    throw new RangeError(
      `newByAge must contain ${METRICS_CONFIG.lifecycle.onboardingDays} age buckets.`,
    );
  }
  validateCount("potential", state.potential);
  validateCount("interested", state.interested);
  validateCount("active", state.active);
  validateCount("atRisk", state.atRisk);
  validateCount("churned", state.churned);
  validateCount("returning", state.returning);
  state.newByAge.forEach((count, age) =>
    validateCount(`newByAge[${age}]`, count),
  );
}

function validateRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite probability from 0 to 1.`);
  }
}

function drawTransitions(
  count: number,
  probability: number,
  worldSeed: string,
  day: number,
  transition: keyof LifecycleDeltas,
): number {
  validateRate(transition, probability);
  const rng = new DeterministicRng(
    deriveSeed([worldSeed, day, "lifecycle", transition]),
  );
  let transitions = 0;
  for (let index = 0; index < count; index += 1) {
    if (rng.nextFloat() < probability) {
      transitions += 1;
    }
  }
  return transitions;
}

export function processLifecycleDay(
  state: LifecyclePopulationState,
  input: LifecycleDayInput,
): LifecycleDayResult {
  validatePopulation(state);
  const finalOnboardingAge = METRICS_CONFIG.lifecycle.onboardingDays - 1;
  const deltas: LifecycleDeltas = {
    potentialToInterested: drawTransitions(
      state.potential,
      input.rates.potentialToInterested,
      input.worldSeed,
      input.day,
      "potentialToInterested",
    ),
    interestedToNew: drawTransitions(
      state.interested,
      input.rates.interestedToNew,
      input.worldSeed,
      input.day,
      "interestedToNew",
    ),
    newToActive: drawTransitions(
      state.newByAge[finalOnboardingAge]!,
      input.rates.newToActive,
      input.worldSeed,
      input.day,
      "newToActive",
    ),
    activeToAtRisk: drawTransitions(
      state.active,
      input.rates.activeToAtRisk,
      input.worldSeed,
      input.day,
      "activeToAtRisk",
    ),
    atRiskToChurned: drawTransitions(
      state.atRisk,
      input.rates.atRiskToChurned,
      input.worldSeed,
      input.day,
      "atRiskToChurned",
    ),
    churnedToReturning: drawTransitions(
      state.churned,
      input.rates.churnedToReturning,
      input.worldSeed,
      input.day,
      "churnedToReturning",
    ),
    returningToActive: drawTransitions(
      state.returning,
      input.rates.returningToActive,
      input.worldSeed,
      input.day,
      "returningToActive",
    ),
  };
  const newByAge = Array.from(
    { length: METRICS_CONFIG.lifecycle.onboardingDays },
    () => 0,
  );
  newByAge[0] = deltas.interestedToNew;
  for (let age = 0; age < finalOnboardingAge; age += 1) {
    newByAge[age + 1] = state.newByAge[age]!;
  }
  newByAge[finalOnboardingAge]! +=
    state.newByAge[finalOnboardingAge]! - deltas.newToActive;

  return {
    population: {
      potential: state.potential - deltas.potentialToInterested,
      interested:
        state.interested +
        deltas.potentialToInterested -
        deltas.interestedToNew,
      newByAge,
      active:
        state.active +
        deltas.newToActive +
        deltas.returningToActive -
        deltas.activeToAtRisk,
      atRisk: state.atRisk + deltas.activeToAtRisk - deltas.atRiskToChurned,
      churned:
        state.churned + deltas.atRiskToChurned - deltas.churnedToReturning,
      returning:
        state.returning + deltas.churnedToReturning - deltas.returningToActive,
    },
    deltas,
  };
}
