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
  }));

  return {
    schemaVersion: 1,
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
      },
    },
    printRuns: {
      [duePrintRunId]: {
        id: duePrintRunId,
        productId: boosterProductId,
        quantity: 1,
        completionDay: 1,
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
    market: { listings: [] },
    meta: { deckStats: {} },
    metrics: { activePlayers: 1 },
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
