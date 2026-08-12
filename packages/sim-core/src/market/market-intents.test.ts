import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  productId,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { calculateCheapestCardCost } from "./deck-cost";
import {
  generateMarketIntents,
  refreshEndogenousListings,
} from "./market-intents";

const marketCardId = cardId("card-market-supply");
const marketPrintingId = printingId("printing-market-supply-normal");
const marketExpansionId = expansionId("set-market-supply");
const marketProductId = productId("product-market-supply");
const sellerId = playerId("player-market-seller");
const buyerId = playerId("player-market-buyer");
const buyerDeckId = deckId("deck-market-buyer");

function createMarketWorld(): WorldState {
  return {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "market-supply-test",
    day: 10,
    status: "LIVE",
    cards: {
      [marketCardId]: {
        id: marketCardId,
        name: "Market Supply",
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
    printings: {
      [marketPrintingId]: {
        id: marketPrintingId,
        cardId: marketCardId,
        expansionId: marketExpansionId,
        edition: "REPRINT",
        sourceProductId: marketProductId,
        sourceExpansionId: marketExpansionId,
      },
    },
    expansions: {
      [marketExpansionId]: {
        id: marketExpansionId,
        name: "Market Supply Set",
      },
    },
    products: {
      [marketProductId]: {
        id: marketProductId,
        expansionId: marketExpansionId,
        name: "Market Supply Booster",
        kind: "BOOSTER",
        msrp: 5,
        cardIds: [marketCardId],
        releaseStatus: "LIVE",
        internalReleaseDay: 1,
        releasedDay: 1,
      },
    },
    printRuns: {},
    players: {
      [sellerId]: {
        id: sellerId,
        motivation: {
          competitive: 0,
          brewer: 0,
          casual: 0,
          collector: 0,
          budgetSensitivity: 1,
          whale: 0,
        },
        skill: 0.5,
        loyalty: 0.5,
        tenureDays: 5,
        tcgWallet: 0,
        activity: "ACTIVE",
        collection: { [marketPrintingId]: 2 },
        deckIds: [],
        knowledge: { knownCardIds: [marketCardId], knownDeckIds: [] },
        satisfaction: 0.5,
      },
      [buyerId]: {
        id: buyerId,
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
        tenureDays: 5,
        tcgWallet: 100,
        activity: "ACTIVE",
        collection: {},
        deckIds: [buyerDeckId],
        knowledge: {
          knownCardIds: [marketCardId],
          knownDeckIds: [buyerDeckId],
        },
        satisfaction: 0.5,
      },
    },
    agents: {},
    decks: {
      [buyerDeckId]: {
        id: buyerDeckId,
        factionId: factionId("fire"),
        cards: [{ cardId: marketCardId, count: 2 }],
        strategy: {},
        originPlayerId: buyerId,
        parentDeckIds: [],
        generation: 0,
        createdDay: 1,
      },
    },
    cohorts: [],
    market: {
      listings: [],
      snapshots: {
        [marketPrintingId]: {
          printingId: marketPrintingId,
          lastPrice: 20,
          dailyVolume: 0,
          availableSupply: 2,
          liquidity: 1,
          priceHistory: [{ day: 9, price: 20, volume: 1 }],
        },
      },
    },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 2,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };
}

describe("endogenous market supply", () => {
  it("does not treat an unbacked snapshot as available supply", () => {
    const world = createMarketWorld();
    world.players[sellerId]!.collection = {};

    expect(calculateCheapestCardCost(world, marketCardId)).toBeUndefined();
  });

  it("removes listings that would consume copies committed to a deck", () => {
    const world = createMarketWorld();
    world.players[sellerId]!.deckIds = [buyerDeckId];
    world.market.listings = [
      {
        ownerId: sellerId,
        printingId: marketPrintingId,
        quantity: 1,
        price: 10,
      },
    ];

    refreshEndogenousListings(world);

    expect(world.market.listings).toEqual([]);
    expect(calculateCheapestCardCost(world, marketCardId)).toBeUndefined();
  });

  it("lists newly opened surplus and exposes it to normal market intents", () => {
    const world = createMarketWorld();

    refreshEndogenousListings(world);
    const intents = generateMarketIntents(world);

    expect(world.market.listings).toContainEqual(
      expect.objectContaining({
        ownerId: sellerId,
        printingId: marketPrintingId,
        quantity: 1,
      }),
    );
    expect(calculateCheapestCardCost(world, marketCardId)).toBeLessThan(20);
    expect(intents.sells).toContainEqual(
      expect.objectContaining({
        ownerId: sellerId,
        printingId: marketPrintingId,
      }),
    );
    expect(intents.buys).toContainEqual(
      expect.objectContaining({
        ownerId: buyerId,
        printingId: marketPrintingId,
      }),
    );
  });

  it("turns public tournament deck attention into competitive card demand", () => {
    const world = createMarketWorld();
    world.players[buyerId]!.deckIds = [];
    world.players[buyerId]!.knowledge.knownDeckIds = [buyerDeckId];

    refreshEndogenousListings(world);
    const withoutAttention = generateMarketIntents(world);
    const withAttention = generateMarketIntents(world, {
      featuredDeckIds: [buyerDeckId],
    });

    expect(withoutAttention.buys).not.toContainEqual(
      expect.objectContaining({ ownerId: buyerId }),
    );
    expect(withAttention.buys).toContainEqual(
      expect.objectContaining({
        ownerId: buyerId,
        printingId: marketPrintingId,
        reason: "COMPETITIVE_NEED",
      }),
    );
  });
});
