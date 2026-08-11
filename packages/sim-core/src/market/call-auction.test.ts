import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "../population/create-population";
import { applyMarketTrades, clearPrintingAuction } from "./call-auction";
import { generateMarketIntents } from "./market-intents";

const marketPrintingId = printingId("printing-market-normal");

function createMarketWorld(): WorldState {
  const population = createInitialPopulation("market-test");
  const buyer = population.players["player-0001"]!;
  const seller = population.players["player-0003"]!;
  buyer.tcgWallet = 1_000;
  seller.tcgWallet = 0;
  seller.collection[marketPrintingId] = 3;

  return {
    schemaVersion: 1,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "market-test",
    day: 1,
    status: "LIVE",
    cards: {
      "card-market": {
        id: cardId("card-market"),
        name: "Market Card",
        type: "UNIT",
        factionId: factionId("fire"),
        rarity: "RARE",
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
        cardId: cardId("card-market"),
        expansionId: expansionId("set-market"),
      },
      "printing-market-foil": {
        id: printingId("printing-market-foil"),
        cardId: cardId("card-market"),
        expansionId: expansionId("set-market"),
      },
    },
    expansions: {
      "set-market": {
        id: expansionId("set-market"),
        name: "Market Set",
      },
    },
    products: {},
    printRuns: {},
    players: population.players,
    agents: population.agents,
    decks: {},
    cohorts: population.cohorts,
    market: {
      listings: [
        {
          ownerId: seller.id,
          printingId: marketPrintingId,
          quantity: 3,
          price: 54,
        },
      ],
    },
    meta: { deckStats: {} },
    metrics: { activePlayers: 0 },
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };
}

describe("clearPrintingAuction", () => {
  it("matches compatible orders in stable price priority at one deterministic price", () => {
    const result = clearPrintingAuction({
      printingId: marketPrintingId,
      buys: [
        { ownerId: playerId("p2"), quantity: 8, maxPrice: 72 },
        { ownerId: playerId("p1"), quantity: 10, maxPrice: 80 },
      ],
      sells: [
        { ownerId: playerId("p4"), quantity: 15, minPrice: 63 },
        { ownerId: playerId("p3"), quantity: 7, minPrice: 54 },
      ],
    });

    expect(result.clearingPrice).toBe(67.5);
    expect(result.volume).toBe(18);
    expect(result.trades).toEqual([
      {
        printingId: marketPrintingId,
        buyerId: playerId("p1"),
        sellerId: playerId("p3"),
        quantity: 7,
        price: 67.5,
      },
      {
        printingId: marketPrintingId,
        buyerId: playerId("p1"),
        sellerId: playerId("p4"),
        quantity: 3,
        price: 67.5,
      },
      {
        printingId: marketPrintingId,
        buyerId: playerId("p2"),
        sellerId: playerId("p4"),
        quantity: 8,
        price: 67.5,
      },
    ]);
  });

  it("caps applied trades at the seller's real holding", () => {
    const world = createMarketWorld();
    const buyer = world.players["player-0001"]!;
    const seller = world.players["player-0003"]!;
    const result = clearPrintingAuction({
      printingId: marketPrintingId,
      buys: [{ ownerId: buyer.id, quantity: 10, maxPrice: 80 }],
      sells: [{ ownerId: seller.id, quantity: 7, minPrice: 54 }],
    });

    const applied = applyMarketTrades(world, [result]);

    expect(applied).toEqual([
      {
        printingId: marketPrintingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        quantity: 3,
        price: 67,
      },
    ]);
    expect(seller.collection[marketPrintingId]).toBe(0);
    expect(buyer.collection[marketPrintingId]).toBe(3);
    expect(seller.tcgWallet).toBe(201);
    expect(buyer.tcgWallet).toBe(799);
  });
});

describe("generateMarketIntents", () => {
  it("targets the cheapest listed Printing for a competitive deck need", () => {
    const world = createMarketWorld();
    const buyer = world.players["player-0001"]!;
    const foilSeller = world.players["player-0004"]!;
    const budgetSeller = world.players["player-0005"]!;
    foilSeller.collection[printingId("printing-market-foil")] = 2;
    budgetSeller.collection[printingId("printing-market-foil")] = 1;
    budgetSeller.motivation.budgetSensitivity = 1;
    world.market.listings.push({
      ownerId: foilSeller.id,
      printingId: printingId("printing-market-foil"),
      quantity: 2,
      price: 70,
    });
    buyer.deckIds = [deckId("deck-market")];
    buyer.motivation.competitive = 1;
    world.decks["deck-market"] = {
      id: deckId("deck-market"),
      factionId: factionId("fire"),
      cards: [{ cardId: cardId("card-market"), count: 2 }],
      strategy: {},
      originPlayerId: buyer.id,
      parentDeckIds: [],
      generation: 0,
      createdDay: 0,
    };

    const intents = generateMarketIntents(world);

    expect(intents.buys).toContainEqual({
      ownerId: buyer.id,
      printingId: marketPrintingId,
      quantity: 2,
      maxPrice: 54,
      reason: "COMPETITIVE_NEED",
    });
    expect(intents.sells).toContainEqual({
      ownerId: budgetSeller.id,
      printingId: printingId("printing-market-foil"),
      quantity: 1,
      minPrice: 70,
      reason: "BUDGET_RELEASE",
    });
  });
});
