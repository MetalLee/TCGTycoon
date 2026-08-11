import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  expansionId,
  printRunId,
  productId,
  type WorldState,
} from "@tcgtycoon/domain";
import { DeterministicRng } from "@tcgtycoon/rules-engine";
import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "../population/create-population";
import {
  completePrintRunsDueToday,
  generatePrimaryDemand,
  getAvailableProductInventory,
  resolvePrimarySales,
} from "./primary-market";

const boosterProductId = productId("product-primary-booster");
const boosterPrintRunId = printRunId("print-run-primary-booster");

function createPrimaryMarketWorld(): WorldState {
  const population = createInitialPopulation("primary-market-test");
  return {
    schemaVersion: 1,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "primary-market-test",
    day: 1,
    status: "LIVE",
    cards: {},
    printings: {},
    expansions: {
      "set-primary": {
        id: expansionId("set-primary"),
        name: "Primary Market Set",
      },
    },
    products: {
      [boosterProductId]: {
        id: boosterProductId,
        expansionId: expansionId("set-primary"),
        name: "Primary Market Booster",
        kind: "BOOSTER",
        msrp: 10,
      },
    },
    printRuns: {
      [boosterPrintRunId]: {
        id: boosterPrintRunId,
        productId: boosterProductId,
        quantity: 5,
        completionDay: 2,
      },
    },
    players: population.players,
    agents: population.agents,
    decks: {},
    cohorts: population.cohorts,
    market: { listings: [] },
    meta: { deckStats: {} },
    metrics: { activePlayers: 0 },
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };
}

describe("primary product inventory", () => {
  it("makes a Print Run available only on its completion day", () => {
    const world = createPrimaryMarketWorld();

    expect(completePrintRunsDueToday(world)).toEqual([]);
    expect(getAvailableProductInventory(world, boosterProductId)).toBe(0);

    world.day = 2;
    expect(completePrintRunsDueToday(world)).toEqual([
      {
        printRunId: boosterPrintRunId,
        productId: boosterProductId,
        quantity: 5,
      },
    ]);
    expect(getAvailableProductInventory(world, boosterProductId)).toBe(5);
  });
});

describe("primary product demand and sales", () => {
  it("resolves deterministically without directly changing World metrics", () => {
    const firstWorld = createPrimaryMarketWorld();
    const secondWorld = createPrimaryMarketWorld();

    const first = generatePrimaryDemand(firstWorld, new DeterministicRng(99n));
    const second = generatePrimaryDemand(
      secondWorld,
      new DeterministicRng(99n),
    );

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(firstWorld.metrics).toEqual({ activePlayers: 0 });
    expect(secondWorld.metrics).toEqual({ activePlayers: 0 });
  });

  it("caps sales at inventory, charges the buyer and queues opening requests", () => {
    const world = createPrimaryMarketWorld();
    world.day = 2;
    const buyer = world.players["player-0001"]!;
    buyer.tcgWallet = 100;

    const result = resolvePrimarySales(
      world,
      [{ buyerId: buyer.id, productId: boosterProductId, quantity: 10 }],
      new DeterministicRng(7n),
    );

    expect(result.unitsSold).toBe(5);
    expect(getAvailableProductInventory(world, boosterProductId)).toBe(0);
    expect(buyer.tcgWallet).toBe(50);
    expect(result.revenue).toBe(
      5 * 10 * ECONOMY_CONFIG.primaryMarket.publisherShare,
    );
    expect(world.cash.balance).toBe(result.revenue);
    expect(world.cash.ledger).toEqual([
      {
        day: 2,
        category: "BOOSTER_REVENUE",
        sourceId: boosterProductId,
        amount: result.revenue,
      },
    ]);
    expect(result.openingRequests).toEqual([
      { buyerId: buyer.id, productId: boosterProductId, quantity: 5 },
    ]);
  });

  it("rejects negative sale quantities before mutating the world", () => {
    const world = createPrimaryMarketWorld();
    world.day = 2;
    const buyer = world.players["player-0001"]!;
    const before = structuredClone(world);

    expect(() =>
      resolvePrimarySales(
        world,
        [{ buyerId: buyer.id, productId: boosterProductId, quantity: -1 }],
        new DeterministicRng(7n),
      ),
    ).toThrow(/non-negative/);
    expect(world).toEqual(before);
  });
});
