import { deckId } from "../../packages/domain/src/index";
import {
  calculateAccessibility,
  calculateMetaHealth,
  matchupKey,
  type MatchupStats,
  type MetaDeckStats,
} from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

const alpha = deckId("deck-healthy-alpha");
const beta = deckId("deck-healthy-beta");

const deckStats: Record<string, MetaDeckStats> = {
  [alpha]: {
    matches: 100,
    wins: 50,
    losses: 50,
    observedWinRate: 0.5,
    usageRate: 0.5,
    averageGameLength: 8,
    sampleCount: 100,
    confidence: "MEDIUM",
  },
  [beta]: {
    matches: 100,
    wins: 50,
    losses: 50,
    observedWinRate: 0.5,
    usageRate: 0.5,
    averageGameLength: 8,
    sampleCount: 100,
    confidence: "MEDIUM",
  },
};

const matchups: Record<string, MatchupStats> = {
  [matchupKey(alpha, beta)]: {
    deckAId: alpha,
    deckBId: beta,
    matches: 100,
    deckAWins: 50,
    deckBWins: 50,
    observedDeckAWinRate: 0.5,
    sampleCount: 100,
    confidence: "MEDIUM",
  },
};

describe("expensive healthy Meta", () => {
  it("healthy win rates with unaffordable decks lowers Accessibility without fabricating poor match balance", () => {
    const expensiveAccessibility = calculateAccessibility({
      starterAvailability: 1,
      starterPrice: 60,
      cheapestCompetitiveDeckCost: 400,
      medianMetaDeckCost: 500,
      coreCardScarcity: 0.9,
      budgetDeckViability: 0.8,
    });
    const affordableAccessibility = calculateAccessibility({
      starterAvailability: 1,
      starterPrice: 15,
      cheapestCompetitiveDeckCost: 60,
      medianMetaDeckCost: 80,
      coreCardScarcity: 0.1,
      budgetDeckViability: 0.8,
    });
    const expensiveMeta = calculateMetaHealth({
      deckStats,
      matchups,
      accessibility: expensiveAccessibility,
      staleDays: 0,
    });
    const affordableMeta = calculateMetaHealth({
      deckStats,
      matchups,
      accessibility: affordableAccessibility,
      staleDays: 0,
    });

    expect(expensiveAccessibility).toBeLessThan(30);
    expect(expensiveMeta.components.winRate).toBe(100);
    expect(expensiveMeta.components.matchup).toBe(100);
    expect(expensiveMeta.components.accessibility).toBeCloseTo(
      expensiveAccessibility,
    );
    expect(expensiveMeta.score).toBeLessThan(affordableMeta.score);
  });
});
