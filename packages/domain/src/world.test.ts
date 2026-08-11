import { describe, expect, it } from "vitest";
import { agentId, cardId, expansionId, factionId, playerId, productId } from "./ids";
import type { WorldState } from "./world";

const createEmptyWorldFixture = (): WorldState => ({
  schemaVersion: 1,
  simulationVersion: "2",
  ruleVersion: "1",
  balanceVersion: "1",
  worldSeed: "fixture-seed",
  day: 0,
  status: "SETUP",
  cards: {
    "card-fire-cub": {
      id: cardId("card-fire-cub"),
      name: "Fire Cub",
      type: "UNIT",
      factionId: factionId("fire"),
      rarity: "COMMON",
      cost: 1,
      attack: 1,
      health: 1,
      keywords: [],
      triggers: [],
    },
  },
  printings: {},
  expansions: {
    "set-launch": { id: expansionId("set-launch"), name: "Launch Set" },
  },
  products: {
    "product-launch-booster": {
      id: productId("product-launch-booster"),
      expansionId: expansionId("set-launch"),
      name: "Launch Booster",
      kind: "BOOSTER",
      msrp: 5,
    },
  },
  printRuns: {},
  players: {
    "player-ash": {
      id: playerId("player-ash"),
      motivation: {
        competitive: 0,
        brewer: 0,
        casual: 0,
        collector: 0,
        budgetSensitivity: 0,
        whale: 0,
      },
      skill: 0,
      loyalty: 0,
      tenureDays: 0,
      tcgWallet: 0,
      activity: "NEW",
      collection: {},
      deckIds: [],
      knowledge: { knownCardIds: [], knownDeckIds: [] },
      satisfaction: 0,
    },
  },
  agents: {
    "agent-ash": {
      id: agentId("agent-ash"),
      playerId: playerId("player-ash"),
      name: "Ash",
      role: "STREAMER",
      influence: 0,
      followers: 0,
      brandAttitude: 0,
      recentMemories: [],
      longTermSummary: "",
    },
  },
  decks: {},
  cohorts: [],
  market: { listings: [] },
  meta: { deckStats: {} },
  metrics: { activePlayers: 0 },
  cash: { balance: 0, ledger: [] },
  history: { events: [] },
});

describe("WorldState", () => {
  it("stores canonical entities by ID and references related entities by ID", () => {
    const world = createEmptyWorldFixture();

    expect(world.cards["card-fire-cub"]!.id).toBe("card-fire-cub");
    expect(world.products["product-launch-booster"]!.expansionId).toBe("set-launch");
    expect(world.products["product-launch-booster"]!).not.toHaveProperty("expansion");
  });

  it("stores named agents as references to persistent players and cash entries in a ledger", () => {
    const world = createEmptyWorldFixture();

    expect(world.agents["agent-ash"]!.playerId).toBe("player-ash");
    expect(world.cash.ledger).toEqual([]);
  });

  it("keys physical collections by PrintingId", () => {
    const player = createEmptyWorldFixture().players["player-ash"]!;
    const collection: Record<import("./ids").PrintingId, number> = player.collection;

    expect(collection).toEqual({});
  });
});
