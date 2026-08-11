import { playerId } from "../../packages/domain/src/index";
import {
  applyMarketTrades,
  clearPrintingAuction,
  countWorldSupply,
  openStarter,
  validateWorldInvariants,
} from "../../packages/sim-core/src/index";
import {
  createBalancedWorld,
  createProductFixtureWorld,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

describe("physical supply conservation", () => {
  it("preserves total Printing supply across a secondary-market trade", () => {
    const { starterPrintingIds, world } = createProductFixtureWorld(
      "supply-conservation",
    );
    const seller = world.players[playerId("player-0001")]!;
    const buyer = world.players[playerId("player-0002")]!;
    seller.tcgWallet = 0;
    buyer.tcgWallet = 100;
    openStarter(world, launchFireStarterProductId, seller, starterPrintingIds);
    const tradedPrintingId = starterPrintingIds[0]!;
    const before = countWorldSupply(world, tradedPrintingId);
    world.market.listings.push({
      ownerId: seller.id,
      printingId: tradedPrintingId,
      quantity: 1,
      price: 10,
    });

    const auction = clearPrintingAuction({
      printingId: tradedPrintingId,
      buys: [{ ownerId: buyer.id, quantity: 1, maxPrice: 12 }],
      sells: [{ ownerId: seller.id, quantity: 1, minPrice: 10 }],
    });
    const applied = applyMarketTrades(world, [auction]);

    expect(applied).toHaveLength(1);
    expect(countWorldSupply(world, tradedPrintingId)).toBe(before);
    expect(seller.collection[tradedPrintingId]).toBe(before - 1);
    expect(buyer.collection[tradedPrintingId]).toBe(1);
  });

  it("does not sell copies reserved by a registered deck", () => {
    const { world } = createBalancedWorld("registered-deck-reserve");
    const seller = world.players[playerId("player-0001")]!;
    const buyer = world.players[playerId("player-0002")]!;
    const deck = world.decks[seller.deckIds[0]!]!;
    const requiredCard = deck.cards[0]!;
    const tradedPrintingId = Object.keys(seller.collection).find(
      (id) => world.printings[id]?.cardId === requiredCard.cardId,
    )!;
    buyer.tcgWallet = 1_000;

    const auction = clearPrintingAuction({
      printingId: tradedPrintingId,
      buys: [{ ownerId: buyer.id, quantity: 1, maxPrice: 10 }],
      sells: [{ ownerId: seller.id, quantity: 1, minPrice: 10 }],
    });
    const applied = applyMarketTrades(world, [auction]);

    expect(applied).toEqual([]);
    validateWorldInvariants(world);
  });
});
