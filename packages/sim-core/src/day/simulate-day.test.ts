import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  printRunId,
  productId,
  type CardDefinition,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "./day-context";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { simulateDay } from "./simulate-day";
import {
  validateWorldInvariants,
  WorldInvariantError,
} from "./world-invariants";

const launchExpansionId = expansionId("set-day-test");
const boosterProductId = productId("product-day-test-booster");
const duePrintRunId = printRunId("print-run-day-test-due");
const buyerId = playerId("player-day-test-buyer");

function createCard(
  id: string,
  rarity: CardDefinition["rarity"],
): CardDefinition {
  return {
    id: cardId(id),
    name: id,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity,
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    triggers: [],
  };
}

function createDayWorld(): WorldState {
  const cards = [
    createCard("card-day-common", "COMMON"),
    createCard("card-day-uncommon", "UNCOMMON"),
    createCard("card-day-rare", "RARE"),
    createCard("card-day-legendary", "LEGENDARY"),
  ];
  const printings = cards.map((card) => ({
    id: printingId(`printing-${card.id}-normal`),
    cardId: card.id,
    expansionId: launchExpansionId,
    edition: "FIRST_EDITION" as const,
    sourceProductId: boosterProductId,
    sourceExpansionId: launchExpansionId,
  }));

  return {
    schemaVersion: 4,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "simulate-day-test",
    day: 1,
    status: "LIVE",
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    printings: Object.fromEntries(
      printings.map((printing) => [printing.id, printing]),
    ),
    expansions: {
      [launchExpansionId]: {
        id: launchExpansionId,
        name: "Day Test Set",
      },
    },
    products: {
      [boosterProductId]: {
        id: boosterProductId,
        expansionId: launchExpansionId,
        name: "Day Test Booster",
        kind: "BOOSTER",
        msrp: 5,
        cardIds: cards.map((card) => card.id),
        releaseStatus: "LIVE",
        internalReleaseDay: 0,
        releasedDay: 0,
      },
    },
    printRuns: {
      [duePrintRunId]: {
        id: duePrintRunId,
        productId: boosterProductId,
        orderedQuantity: 1,
        quantity: 0,
        orderedDay: 0,
        completionDay: 1,
        unitCost: 0,
        totalCost: 0,
        status: "PRINTING",
        printingIds: [],
      },
    },
    players: {
      [buyerId]: {
        id: buyerId,
        motivation: {
          competitive: 1,
          brewer: 1,
          casual: 1,
          collector: 1,
          budgetSensitivity: 0,
          whale: 0,
        },
        skill: 0.5,
        loyalty: 0.5,
        tenureDays: 10,
        tcgWallet: 100,
        activity: "ACTIVE",
        collection: {},
        deckIds: [],
        knowledge: { knownCardIds: [], knownDeckIds: [] },
        satisfaction: 0.6,
      },
    },
    agents: {},
    decks: {},
    cohorts: [{ id: "cohort-active", count: 1 }],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 1,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  Object.freeze(value);
}

describe("simulateDay", () => {
  it("orders Print Runs through paid non-cancellable production", () => {
    const world = createDayWorld();
    world.printRuns = {};
    world.cash = { balance: 1_000, ledger: [] };

    const result = simulateDay(
      world,
      [
        {
          type: "ORDER_PRINT_RUN",
          productId: boosterProductId,
          quantity: 10,
        },
      ],
      DEFAULT_BALANCE_CONFIG,
    );
    const orderedRun = Object.values(result.nextState.printRuns)[0]!;

    expect(orderedRun).toMatchObject({
      productId: boosterProductId,
      orderedQuantity: 10,
      quantity: 0,
      status: "PRINTING",
    });
    expect(result.nextState.cash.balance).toBeLessThan(1_000);
    expect(result.nextState.cash.ledger).toContainEqual(
      expect.objectContaining({
        category: "PRINTING",
        sourceId: orderedRun.id,
        amount: expect.any(Number),
      }),
    );
  });

  it("makes a Print Run completing today available for sales and opening today", () => {
    const world = createDayWorld();

    const result = simulateDay(world, [], DEFAULT_BALANCE_CONFIG);
    const collectionSize = Object.values(
      result.nextState.players[buyerId]!.collection,
    ).reduce((total, count) => total + count, 0);

    expect(result.nextState.printRuns[duePrintRunId]!.quantity).toBe(0);
    expect(collectionSize).toBe(5);
    expect(result.report.unitsSold).toBe(1);
    expect(result.report.productsOpened).toBe(1);
    expect(result.nextState.cash.balance).toBeGreaterThan(0);
  });

  it("leaves its source state unchanged and returns exactly the next day", () => {
    const world = createDayWorld();
    const before = structuredClone(world);
    deepFreeze(world);

    const result = simulateDay(world, [], DEFAULT_BALANCE_CONFIG);

    expect(world).toEqual(before);
    expect(result.nextState).not.toBe(world);
    expect(result.nextState.day).toBe(world.day + 1);
  });

  it("commits lifecycle flows and core health metrics to canonical state", () => {
    const world = createDayWorld();
    world.metrics.lifecycle.potential = 1_000;
    const result = simulateDay(world, [], DEFAULT_BALANCE_CONFIG);
    const metrics = result.nextState.metrics as unknown as Record<
      string,
      unknown
    >;

    expect(metrics).toEqual(
      expect.objectContaining({
        hype: expect.any(Number),
        collectorHeat: expect.any(Number),
        metaHealth: expect.any(Number),
        brandTrust: expect.any(Number),
        sentiment: expect.any(Number),
        lifecycle: expect.any(Object),
        lifecycleDeltas: expect.any(Object),
        ecosystemRisk: expect.any(String),
      }),
    );
    expect(result.report).toEqual(
      expect.objectContaining({
        hype: expect.any(Number),
        brandTrust: expect.any(Number),
        lifecycleDeltas: expect.any(Object),
      }),
    );
    expect(
      result.nextState.metrics.lifecycleDeltas.potentialToInterested,
    ).toBeGreaterThan(0);
    expect(result.report.lifecycleDeltas).toEqual(
      result.nextState.metrics.lifecycleDeltas,
    );
  });

  it("rejects unknown runtime PublisherCommands", () => {
    expect(() =>
      simulateDay(
        createDayWorld(),
        [{ type: "DELETE_WORLD" }] as never,
        DEFAULT_BALANCE_CONFIG,
      ),
    ).toThrow();
  });
});

describe("validateWorldInvariants", () => {
  it.each([
    {
      name: "negative inventories",
      code: "NEGATIVE_QUANTITY",
      mutate: (world: WorldState) => {
        world.printRuns[duePrintRunId]!.quantity = -1;
      },
    },
    {
      name: "negative physical holdings",
      code: "NEGATIVE_QUANTITY",
      mutate: (world: WorldState) => {
        world.players[buyerId]!.collection[
          printingId("printing-card-day-common-normal")
        ] = -1;
      },
    },
    {
      name: "missing canonical IDs",
      code: "MISSING_ID",
      mutate: (world: WorldState) => {
        world.products[boosterProductId]!.id = productId("product-wrong-id");
      },
    },
    {
      name: "missing references",
      code: "MISSING_REFERENCE",
      mutate: (world: WorldState) => {
        world.printings["printing-card-day-common-normal"]!.cardId =
          cardId("card-missing");
      },
    },
    {
      name: "illegal stored decks",
      code: "ILLEGAL_DECK",
      mutate: (world: WorldState) => {
        const invalidDeckId = deckId("deck-invalid-size");
        world.decks[invalidDeckId] = {
          id: invalidDeckId,
          factionId: factionId("fire"),
          cards: [{ cardId: cardId("card-day-common"), count: 1 }],
          strategy: {},
          originPlayerId: buyerId,
          parentDeckIds: [],
          generation: 0,
          createdDay: 1,
        };
      },
    },
    {
      name: "non-finite cash",
      code: "NON_FINITE_NUMBER",
      mutate: (world: WorldState) => {
        world.cash.balance = Number.NaN;
      },
    },
    {
      name: "non-finite metrics",
      code: "NON_FINITE_NUMBER",
      mutate: (world: WorldState) => {
        world.metrics.activePlayers = Number.POSITIVE_INFINITY;
      },
    },
    {
      name: "non-finite prices",
      code: "NON_FINITE_NUMBER",
      mutate: (world: WorldState) => {
        world.products[boosterProductId]!.msrp = Number.POSITIVE_INFINITY;
      },
    },
    {
      name: "negative prices",
      code: "NEGATIVE_PRICE",
      mutate: (world: WorldState) => {
        world.products[boosterProductId]!.msrp = -1;
      },
    },
    {
      name: "duplicate IDs in arrays",
      code: "DUPLICATE_ID",
      mutate: (world: WorldState) => {
        const known = cardId("card-day-common");
        world.players[buyerId]!.knowledge.knownCardIds = [known, known];
      },
    },
  ])("throws a structured error for $name", ({ code, mutate }) => {
    const world = createDayWorld();
    mutate(world);

    try {
      validateWorldInvariants(world, 0);
      throw new Error("Expected validateWorldInvariants to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WorldInvariantError);
      expect(error).toMatchObject({ code });
    }
  });

  it("rejects an incorrect day increment", () => {
    const world = createDayWorld();

    expect(() => validateWorldInvariants(world, world.day)).toThrowError(
      expect.objectContaining({
        name: "WorldInvariantError",
        code: "INCORRECT_DAY_INCREMENT",
      }),
    );
  });
});
