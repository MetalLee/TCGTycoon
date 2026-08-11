import { describe, expect, it } from "vitest";
import {
  evaluateEcosystemRisk,
  type EcosystemRiskInput,
} from "./ecosystem-risk";
import {
  calculateSatisfactionTarget,
  updateSatisfaction,
} from "./satisfaction";
import {
  calculateMetaHealth,
  updateWorldMetrics,
  type WorldMetricSignals,
  type WorldMetricState,
} from "./world-metrics";
import {
  processLifecycleDay,
  type LifecyclePopulationState,
  type LifecycleRates,
} from "../population/lifecycle";

const currentMetrics: WorldMetricState = {
  hype: 20,
  collectorHeat: 20,
  metaHealth: 50,
  brandTrust: 20,
  sentiment: 50,
};

const positiveSignals: WorldMetricSignals = {
  positiveAttention: 0.8,
  negativeAttention: 0,
  sentimentTarget: 80,
  collector: {
    tradingVolume: 0.8,
    liquidity: 0.8,
    priceMomentum: 0.8,
    scarcityExcitement: 0.8,
    productFreshness: 0.8,
    collectorConfidence: 0.8,
  },
  metaHealthTarget: 50,
  brandTrustTarget: 80,
};

const zeroRates: LifecycleRates = {
  potentialToInterested: 0,
  interestedToNew: 0,
  newToActive: 0,
  activeToAtRisk: 0,
  atRiskToChurned: 0,
  churnedToReturning: 0,
  returningToActive: 0,
};

function populationTotal(state: LifecyclePopulationState): number {
  return (
    state.potential +
    state.interested +
    state.newByAge.reduce((total, count) => total + count, 0) +
    state.active +
    state.atRisk +
    state.churned +
    state.returning
  );
}

describe("world metric smoothing", () => {
  it("Brand Trust moves slower than Hype toward its target", () => {
    const next = updateWorldMetrics(currentMetrics, positiveSignals);

    expect(next.hype - currentMetrics.hype).toBeGreaterThan(
      next.collectorHeat - currentMetrics.collectorHeat,
    );
    expect(next.collectorHeat - currentMetrics.collectorHeat).toBeGreaterThan(
      next.brandTrust - currentMetrics.brandTrust,
    );
  });

  it("moves satisfaction gradually toward a weighted cohort target", () => {
    const target = calculateSatisfactionTarget({
      gameplayQuality: 0.9,
      affordability: 0.2,
      novelty: 0.7,
      trust: 0.8,
      socialActivity: 0.6,
      collectionExperience: 0.5,
    });
    const next = updateSatisfaction(0.4, target);

    expect(target).toBeGreaterThan(0.4);
    expect(next).toBeGreaterThan(0.4);
    expect(next).toBeLessThan(target);
  });
});

describe("Meta Health", () => {
  it("ignores insufficient win-rate samples and applies staleness separately", () => {
    const input = {
      deckStats: {
        reliable: {
          matches: 100,
          wins: 50,
          losses: 50,
          observedWinRate: 0.5,
          usageRate: 0.5,
          averageGameLength: 8,
          sampleCount: 100,
          confidence: "MEDIUM" as const,
        },
        tinyOutlier: {
          matches: 1,
          wins: 1,
          losses: 0,
          observedWinRate: 1,
          usageRate: 0.5,
          averageGameLength: 3,
          sampleCount: 1,
          confidence: "VERY_LOW" as const,
        },
      },
      matchups: {},
      accessibility: 100,
      staleDays: 0,
    };

    const fresh = calculateMetaHealth(input);
    const stale = calculateMetaHealth({ ...input, staleDays: 20 });

    expect(fresh.components.winRate).toBe(100);
    expect(stale.components).toEqual(fresh.components);
    expect(stale.stalenessPenalty).toBe(10);
    expect(stale.score).toBe(fresh.score - 10);
  });
});

describe("population lifecycle", () => {
  it("uses deterministic transition draws and conserves population", () => {
    const initial: LifecyclePopulationState = {
      potential: 20,
      interested: 10,
      newByAge: [0, 0, 0, 0, 0, 0, 5],
      active: 20,
      atRisk: 5,
      churned: 10,
      returning: 3,
    };
    const rates: LifecycleRates = {
      potentialToInterested: 0.4,
      interestedToNew: 0.3,
      newToActive: 0.5,
      activeToAtRisk: 0.2,
      atRiskToChurned: 0.4,
      churnedToReturning: 0.25,
      returningToActive: 0.5,
    };

    const first = processLifecycleDay(initial, {
      worldSeed: "lifecycle-determinism",
      day: 12,
      rates,
    });
    const second = processLifecycleDay(initial, {
      worldSeed: "lifecycle-determinism",
      day: 12,
      rates,
    });

    expect(first).toEqual(second);
    expect(populationTotal(first.population)).toBe(populationTotal(initial));
  });

  it("does not evaluate new-player activation before the 7-day onboarding window", () => {
    let population: LifecyclePopulationState = {
      potential: 0,
      interested: 0,
      newByAge: [5, 0, 0, 0, 0, 0, 0],
      active: 0,
      atRisk: 0,
      churned: 0,
      returning: 0,
    };
    const rates: LifecycleRates = { ...zeroRates, newToActive: 1 };

    for (let day = 1; day <= 6; day += 1) {
      population = processLifecycleDay(population, {
        worldSeed: "onboarding-window",
        day,
        rates,
      }).population;
    }
    expect(population.active).toBe(0);

    population = processLifecycleDay(population, {
      worldSeed: "onboarding-window",
      day: 7,
      rates,
    }).population;
    expect(population.active).toBe(5);
    expect(population.newByAge.reduce((sum, count) => sum + count, 0)).toBe(0);
  });
});

describe("ecosystem risk", () => {
  const stable: EcosystemRiskInput = {
    activePlayers: 10_000,
    hype: 60,
    brandTrust: 70,
    acquisitionToChurnRatio: 1.2,
    retentionRate: 0.8,
    activePlayerTrend: 0.01,
    consecutiveDeclineDays: 0,
    consecutiveLowActivityDays: 0,
    cash: 50_000,
  };

  it("derives risk from persisted trends without changing population or revenue", () => {
    expect(evaluateEcosystemRisk(stable)).toBe("STABLE");
    expect(
      evaluateEcosystemRisk({
        ...stable,
        activePlayers: 80,
        hype: 4,
        consecutiveLowActivityDays: 30,
      }),
    ).toBe("TERMINAL");
    expect(
      evaluateEcosystemRisk({
        ...stable,
        activePlayers: 1_000,
        hype: 15,
        brandTrust: 25,
        acquisitionToChurnRatio: 0.5,
        retentionRate: 0.4,
        activePlayerTrend: -0.05,
        consecutiveDeclineDays: 20,
      }),
    ).toBe("DEATH_SPIRAL");
  });
});
