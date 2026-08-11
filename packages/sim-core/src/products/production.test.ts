import {
  cardId,
  expansionId,
  factionId,
  printRunId,
  productId,
  type ProductSku,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import {
  advancePrintRuns,
  cancelPrintRun,
  orderPrintRun,
  quotePrintRun,
} from "./production";
import type { ProductionConfig } from "@tcgtycoon/balance";

const launchExpansionId = expansionId("set-production-test");
const boosterProductId = productId("product-production-booster");
const firstRunId = printRunId("print-run-production-first");
const laterRunId = printRunId("print-run-production-later");
const productionCardId = cardId("card-production-common");

const productionConfig: ProductionConfig = {
  leadDays: 7,
  baseUnitCostByKind: {
    BOOSTER: 2,
    STARTER: 5,
  },
  quantityTiers: [
    { upToQuantity: 100, unitCostMultiplier: 1 },
    { upToQuantity: 1_000, unitCostMultiplier: 0.8 },
    { upToQuantity: null, unitCostMultiplier: 0.65 },
  ],
};

function createProduct(): ProductSku {
  return {
    id: boosterProductId,
    expansionId: launchExpansionId,
    name: "Production Test Booster",
    kind: "BOOSTER",
    msrp: 5,
    cardIds: [productionCardId],
    releaseStatus: "UNANNOUNCED",
    internalReleaseDay: 10,
  };
}

function createProductionWorld(): WorldState {
  const product = createProduct();
  return {
    schemaVersion: 4,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "production-test",
    day: 10,
    status: "LIVE",
    cards: {
      [productionCardId]: {
        id: productionCardId,
        name: "Production Common",
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
      [launchExpansionId]: {
        id: launchExpansionId,
        name: "Production Test Set",
      },
    },
    products: { [product.id]: product },
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
    cash: { balance: 10_000, ledger: [] },
    history: { events: [] },
  };
}

function orderFirstRun(world: WorldState, quantity = 100) {
  return orderPrintRun(
    world,
    { id: firstRunId, productId: boosterProductId, quantity },
    productionConfig,
  );
}

describe("physical production", () => {
  it("charges total production cost when the Print Run is ordered", () => {
    const world = createProductionWorld();
    const quote = quotePrintRun(createProduct(), 100, productionConfig);

    const run = orderFirstRun(world);

    expect(world.cash.balance).toBe(10_000 - quote.totalCost);
    expect(world.cash.ledger).toEqual([
      {
        day: 10,
        category: "PRINTING",
        sourceId: firstRunId,
        amount: -quote.totalCost,
      },
    ]);
    expect(run.totalCost).toBe(quote.totalCost);
  });

  it("does not add sellable inventory before completion day", () => {
    const world = createProductionWorld();
    const run = orderFirstRun(world);

    expect(run.status).toBe("PRINTING");
    expect(run.quantity).toBe(0);
    expect(advancePrintRuns(world, run.completionDay - 1)).toEqual([]);
    expect(world.printRuns[firstRunId]!.quantity).toBe(0);
  });

  it("refuses to cancel a PRINTING run", () => {
    const world = createProductionWorld();
    orderFirstRun(world);

    expect(() => cancelPrintRun(world, firstRunId)).toThrow(
      /cannot be cancelled/i,
    );
    expect(world.printRuns[firstRunId]!.status).toBe("PRINTING");
  });

  it("first completed run of a product creates FIRST_EDITION identity", () => {
    const world = createProductionWorld();
    const run = orderFirstRun(world);

    expect(advancePrintRuns(world, run.completionDay)).toEqual([firstRunId]);
    const completed = world.printRuns[firstRunId]!;
    expect(completed).toMatchObject({
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      quantity: 100,
    });
    expect(completed.printingIds).toHaveLength(1);
    expect(world.printings[completed.printingIds[0]!]).toMatchObject({
      edition: "FIRST_EDITION",
      sourceProductId: boosterProductId,
      sourceExpansionId: launchExpansionId,
    });
  });

  it("later product reprint uses UNLIMITED/REPRINT identity without increasing First Edition supply", () => {
    const world = createProductionWorld();
    const firstRun = orderFirstRun(world, 100);
    advancePrintRuns(world, firstRun.completionDay);
    const firstPrintingIds = [...world.printRuns[firstRunId]!.printingIds];
    const firstEditionSupply = world.printRuns[firstRunId]!.quantity;

    world.day = firstRun.completionDay;
    const laterRun = orderPrintRun(
      world,
      { id: laterRunId, productId: boosterProductId, quantity: 250 },
      productionConfig,
    );
    advancePrintRuns(world, laterRun.completionDay);

    expect(world.printRuns[laterRunId]).toMatchObject({
      status: "COMPLETED",
      edition: "UNLIMITED",
      quantity: 250,
    });
    expect(world.printRuns[laterRunId]!.printingIds).not.toEqual(
      firstPrintingIds,
    );
    expect(
      world.printRuns[laterRunId]!.printingIds.map(
        (id) => world.printings[id]!.edition,
      ),
    ).toEqual(["UNLIMITED"]);
    expect(world.printRuns[firstRunId]!.quantity).toBe(firstEditionSupply);
  });

  it("larger quantity has lower unit cost but larger total cash commitment", () => {
    const product = createProduct();

    const small = quotePrintRun(product, 100, productionConfig);
    const large = quotePrintRun(product, 1_000, productionConfig);

    expect(large.unitCost).toBeLessThan(small.unitCost);
    expect(large.totalCost).toBeGreaterThan(small.totalCost);
  });
});
