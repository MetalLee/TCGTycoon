import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  expansionId,
  factionId,
  printRunId,
  productId,
  type WorldState,
} from "@tcgtycoon/domain";
import { DeterministicRng } from "@tcgtycoon/rules-engine";
import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "../population/create-population";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
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
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "primary-market-test",
    day: 1,
    status: "LIVE",
    cards: {
      "card-primary": {
        id: cardId("card-primary"),
        name: "Primary Card",
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
        cardIds: [cardId("card-primary")],
        releaseStatus: "LIVE",
        internalReleaseDay: 0,
        releasedDay: 0,
      },
    },
    printRuns: {
      [boosterPrintRunId]: {
        id: boosterPrintRunId,
        productId: boosterProductId,
        sourceExpansionId: expansionId("set-primary"),
        productKind: "BOOSTER",
        cardIds: [cardId("card-primary")],
        orderedQuantity: 5,
        quantity: 0,
        orderedDay: 0,
        completionDay: 2,
        unitCost: 0,
        totalCost: 0,
        status: "PRINTING",
        printingIds: [],
      },
    },
    players: population.players,
    agents: population.agents,
    decks: {},
    cohorts: population.cohorts,
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
    const initialMetrics = structuredClone(firstWorld.metrics);

    const first = generatePrimaryDemand(firstWorld, new DeterministicRng(99n));
    const second = generatePrimaryDemand(
      secondWorld,
      new DeterministicRng(99n),
    );

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(firstWorld.metrics).toEqual(initialMetrics);
    expect(secondWorld.metrics).toEqual(initialMetrics);
  });

  it("caps sales at inventory, charges the buyer and queues opening requests", () => {
    const world = createPrimaryMarketWorld();
    world.day = 2;
    completePrintRunsDueToday(world);
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
      {
        buyerId: buyer.id,
        productId: boosterProductId,
        quantity: 5,
        printRunId: boosterPrintRunId,
        printingIds: world.printRuns[boosterPrintRunId]!.printingIds,
      },
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
