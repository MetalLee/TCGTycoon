import { describe, expect, it } from "vitest";
import { cardId, expansionId, factionId, productId } from "./ids";
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
  players: {},
  agents: {},
  decks: {},
  cohorts: [],
  market: { listings: [] },
  meta: { deckStats: {} },
  metrics: { activePlayers: 0 },
  cash: { balance: 0 },
  history: { events: [] },
});

describe("WorldState", () => {
  it("stores canonical entities by ID and references related entities by ID", () => {
    const world = createEmptyWorldFixture();

    expect(world.cards["card-fire-cub"]!.id).toBe("card-fire-cub");
    expect(world.products["product-launch-booster"]!.expansionId).toBe("set-launch");
    expect(world.products["product-launch-booster"]!).not.toHaveProperty("expansion");
  });
});
