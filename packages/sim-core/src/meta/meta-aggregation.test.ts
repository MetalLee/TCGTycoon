import { deckId, playerId, type WorldState } from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { matchupKey, updateMetaState } from "./meta-aggregation";
import type { SampledMatchResult } from "./sample-matches";

function createMetaWorld(): WorldState {
  return {
    schemaVersion: 4,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "meta-aggregation-test",
    day: 1,
    status: "LIVE",
    cards: {},
    printings: {},
    expansions: {},
    products: {},
    printRuns: {},
    players: {},
    agents: {},
    decks: {},
    cohorts: [],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 0,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };
}

const alpha = deckId("deck-alpha");
const beta = deckId("deck-beta");
const gamma = deckId("deck-gamma");

const samples: SampledMatchResult[] = [
  {
    sequence: 0,
    playerAId: playerId("player-a"),
    playerBId: playerId("player-b"),
    deckAId: alpha,
    deckBId: beta,
    winnerPlayerId: playerId("player-a"),
    winnerDeckId: alpha,
    loserDeckId: beta,
    turns: 6,
  },
  {
    sequence: 1,
    playerAId: playerId("player-a"),
    playerBId: playerId("player-b"),
    deckAId: alpha,
    deckBId: beta,
    winnerPlayerId: playerId("player-b"),
    winnerDeckId: beta,
    loserDeckId: alpha,
    turns: 8,
  },
  {
    sequence: 2,
    playerAId: playerId("player-c"),
    playerBId: playerId("player-a"),
    deckAId: gamma,
    deckBId: alpha,
    winnerPlayerId: playerId("player-a"),
    winnerDeckId: alpha,
    loserDeckId: gamma,
    turns: 10,
  },
];

describe("updateMetaState", () => {
  it("derives usage, records and observed win rates from actual samples", () => {
    const world = createMetaWorld();

    const result = updateMetaState(world, samples);

    expect(result.deckStats[alpha]).toEqual(
      expect.objectContaining({
        matches: 3,
        wins: 2,
        losses: 1,
        observedWinRate: 2 / 3,
        usageRate: 0.5,
        averageGameLength: 8,
        sampleCount: 3,
        confidence: "VERY_LOW",
      }),
    );
    expect(result.deckStats[beta]).toEqual(
      expect.objectContaining({
        matches: 2,
        wins: 1,
        losses: 1,
        observedWinRate: 0.5,
        usageRate: 2 / 6,
        sampleCount: 2,
      }),
    );
    expect(result.deckStats[gamma]).toEqual(
      expect.objectContaining({
        matches: 1,
        wins: 0,
        losses: 1,
        observedWinRate: 0,
        usageRate: 1 / 6,
        sampleCount: 1,
      }),
    );
    expect(world.meta.deckStats).toEqual(result.deckStats);
  });

  it("builds a stable matchup matrix with confidence metadata", () => {
    const world = createMetaWorld();

    const result = updateMetaState(world, samples);

    expect(result.matchups[matchupKey(alpha, beta)]).toEqual({
      deckAId: alpha,
      deckBId: beta,
      matches: 2,
      deckAWins: 1,
      deckBWins: 1,
      observedDeckAWinRate: 0.5,
      sampleCount: 2,
      confidence: "VERY_LOW",
    });
    expect(result.matchups[matchupKey(alpha, gamma)]).toEqual({
      deckAId: alpha,
      deckBId: gamma,
      matches: 1,
      deckAWins: 1,
      deckBWins: 0,
      observedDeckAWinRate: 1,
      sampleCount: 1,
      confidence: "VERY_LOW",
    });
  });

  it("records one win and one loss for a mirror match", () => {
    const world = createMetaWorld();
    const mirrorSample: SampledMatchResult = {
      sequence: 0,
      playerAId: playerId("player-a"),
      playerBId: playerId("player-b"),
      deckAId: alpha,
      deckBId: alpha,
      winnerPlayerId: playerId("player-a"),
      winnerDeckId: alpha,
      loserDeckId: alpha,
      turns: 7,
    };

    const result = updateMetaState(world, [mirrorSample]);

    expect(result.deckStats[alpha]).toEqual(
      expect.objectContaining({
        matches: 2,
        wins: 1,
        losses: 1,
        observedWinRate: 0.5,
      }),
    );
  });
});
