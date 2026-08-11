import type { ProductionConfig } from "@tcgtycoon/balance";
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
  type DeckGenome,
  type PersistentPlayer,
  type PrintingId,
  type WorldState,
} from "@tcgtycoon/domain";
import { validateDeck } from "@tcgtycoon/rules-engine";
import { describe, expect, it } from "vitest";
import {
  ownedCardCounts,
  playerOwnsGenome,
} from "../deck-evolution/deck-builder";
import { toDeckDefinition } from "../deck-evolution/deck-genome";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { advancePrintRuns } from "./production";
import {
  createProductReprintOrder,
  createTargetedReprintPrinting,
} from "./reprints";

const originalExpansionId = expansionId("set-reprint-original");
const laterExpansionId = expansionId("set-reprint-later");
const originalProductId = productId("product-reprint-original");
const laterStarterId = productId("product-reprint-later-starter");
const originalRunId = printRunId("print-run-reprint-original");
const reprintRunId = printRunId("print-run-reprint-later");
const reprintPlayerId = playerId("player-reprint-test");

const productionConfig: ProductionConfig = {
  leadDays: 2,
  baseUnitCostByKind: { BOOSTER: 2, STARTER: 5 },
  quantityTiers: [{ upToQuantity: null, unitCostMultiplier: 1 }],
};

function createCards(): CardDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-reprint-${String(index + 1).padStart(2, "0")}`),
    name: `Reprint Card ${index + 1}`,
    type: "UNIT" as const,
    factionId: factionId("fire"),
    rarity: "COMMON" as const,
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    triggers: [],
  }));
}

function firstPrintingId(card: CardDefinition): PrintingId {
  return printingId(`printing-original-${card.id}-first-edition-normal`);
}

function createReprintWorld(): WorldState {
  const cards = createCards();
  const printingIds = cards.map(firstPrintingId);
  return {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "reprint-test",
    day: 5,
    status: "LIVE",
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    printings: Object.fromEntries(
      cards.map((card) => {
        const id = firstPrintingId(card);
        return [
          id,
          {
            id,
            cardId: card.id,
            expansionId: originalExpansionId,
            edition: "FIRST_EDITION" as const,
            sourceProductId: originalProductId,
            sourceExpansionId: originalExpansionId,
          },
        ];
      }),
    ),
    expansions: {
      [originalExpansionId]: {
        id: originalExpansionId,
        name: "Original Set",
      },
      [laterExpansionId]: { id: laterExpansionId, name: "Later Set" },
    },
    products: {
      [originalProductId]: {
        id: originalProductId,
        expansionId: originalExpansionId,
        name: "Original Booster",
        kind: "BOOSTER",
        msrp: 5,
        cardIds: cards.map((card) => card.id),
        releaseStatus: "LIVE",
        internalReleaseDay: 1,
        releasedDay: 1,
      },
      [laterStarterId]: {
        id: laterStarterId,
        expansionId: laterExpansionId,
        name: "Later Starter",
        kind: "STARTER",
        msrp: 15,
        cardIds: [cards[0]!.id],
        releaseStatus: "UNANNOUNCED",
        internalReleaseDay: 10,
      },
    },
    printRuns: {
      [originalRunId]: {
        id: originalRunId,
        productId: originalProductId,
        sourceExpansionId: originalExpansionId,
        productKind: "BOOSTER",
        cardIds: cards.map((card) => card.id),
        orderedQuantity: 100,
        quantity: 100,
        orderedDay: 0,
        completionDay: 1,
        unitCost: 2,
        totalCost: 200,
        status: "COMPLETED",
        edition: "FIRST_EDITION",
        printingIds,
      },
    },
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

function addReprintPlayer(world: WorldState): PersistentPlayer {
  const cards = Object.values(world.cards).sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const player: PersistentPlayer = {
    id: reprintPlayerId,
    motivation: {
      competitive: 1,
      brewer: 0,
      casual: 0,
      collector: 0,
      budgetSensitivity: 0,
      whale: 0,
    },
    skill: 0.5,
    loyalty: 0.5,
    tenureDays: 1,
    tcgWallet: 100,
    activity: "ACTIVE",
    collection: Object.fromEntries(
      cards.map((card) => [firstPrintingId(card), 2]),
    ),
    deckIds: [],
    knowledge: {
      knownCardIds: cards.map((card) => card.id),
      knownDeckIds: [],
    },
    satisfaction: 0.5,
  };
  world.players[player.id] = player;
  return player;
}

describe("physical card reprints", () => {
  it("product reprint keeps the original CardDefinitions and creates non-First-Edition supply", () => {
    const world = createReprintWorld();
    const originalCards = structuredClone(world.cards);
    const firstEditionSupply = world.printRuns[originalRunId]!.quantity;

    const run = createProductReprintOrder(
      world,
      {
        id: reprintRunId,
        productId: originalProductId,
        quantity: 50,
      },
      productionConfig,
    );
    advancePrintRuns(world, run.completionDay);

    expect(world.cards).toEqual(originalCards);
    expect(world.printRuns[reprintRunId]).toMatchObject({
      status: "COMPLETED",
      edition: "UNLIMITED",
      quantity: 50,
    });
    expect(
      world.printRuns[reprintRunId]!.printingIds.map(
        (id) => world.printings[id]!.edition,
      ),
    ).toEqual(Array.from({ length: 10 }, () => "UNLIMITED"));
    expect(world.printRuns[originalRunId]!.quantity).toBe(firstEditionSupply);
    expect(world.history.events).toContainEqual(
      expect.objectContaining({
        type: "PRODUCT_REPRINT_ORDERED",
        context: expect.objectContaining({ productId: originalProductId }),
      }),
    );
  });

  it("targeted reprint creates a new PrintingId linked to the same CardDefinition", () => {
    const world = createReprintWorld();
    const source = world.printings[firstPrintingId(createCards()[0]!)]!;
    const originalCard = structuredClone(world.cards[source.cardId]);

    const reprint = createTargetedReprintPrinting(
      world,
      source.id,
      laterStarterId,
    );

    expect(reprint.id).not.toBe(source.id);
    expect(reprint).toMatchObject({
      cardId: source.cardId,
      edition: "REPRINT",
      sourceProductId: laterStarterId,
      sourceExpansionId: laterExpansionId,
    });
    expect(world.cards[source.cardId]).toEqual(originalCard);
    expect(world.history.events).toContainEqual(
      expect.objectContaining({
        type: "TARGETED_REPRINT_CREATED",
        context: expect.objectContaining({ productId: laterStarterId }),
      }),
    );
  });

  it("competitive deck legality treats old and new Printing as the same CardDefinition", () => {
    const world = createReprintWorld();
    const cards = Object.values(world.cards).sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    const source = world.printings[firstPrintingId(cards[0]!)]!;
    const reprint = createTargetedReprintPrinting(
      world,
      source.id,
      laterStarterId,
    );
    const player = addReprintPlayer(world);
    player.collection[source.id] = 1;
    player.collection[reprint.id] = 1;
    const genome: DeckGenome = {
      id: deckId("deck-reprint-test"),
      factionId: factionId("fire"),
      cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
      strategy: {},
      originPlayerId: player.id,
      parentDeckIds: [],
      generation: 0,
      createdDay: world.day,
    };

    expect(ownedCardCounts(player, world).get(source.cardId)).toBe(2);
    expect(playerOwnsGenome(player, world, genome)).toBe(true);
    expect(
      validateDeck(toDeckDefinition(genome), Object.values(world.cards)).valid,
    ).toBe(true);
  });

  it("collector market keeps First Edition and Reprint as independent price series", () => {
    const world = createReprintWorld();
    const source = world.printings[firstPrintingId(createCards()[0]!)]!;
    const reprint = createTargetedReprintPrinting(
      world,
      source.id,
      laterStarterId,
    );
    world.market.snapshots[source.id] = {
      printingId: source.id,
      lastPrice: 100,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.1,
      priceHistory: [{ day: 4, price: 100, volume: 1 }],
    };
    world.market.snapshots[reprint.id] = {
      printingId: reprint.id,
      lastPrice: 5,
      dailyVolume: 10,
      availableSupply: 50,
      liquidity: 0.8,
      priceHistory: [{ day: 5, price: 5, volume: 10 }],
    };

    expect(world.market.snapshots[source.id]).toMatchObject({
      printingId: source.id,
      lastPrice: 100,
      priceHistory: [{ day: 4, price: 100, volume: 1 }],
    });
    expect(world.market.snapshots[reprint.id]).toMatchObject({
      printingId: reprint.id,
      lastPrice: 5,
      priceHistory: [{ day: 5, price: 5, volume: 10 }],
    });
  });
});
