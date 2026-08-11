import {
  expansionId,
  playerId,
  productId,
} from "../../packages/domain/src/index";
import {
  calculateAdoptionScore,
  calculateCheapestCardCost,
  calculateDeckMarketCost,
  createTargetedReprintPrinting,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  fireFixtureDeck,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

describe("targeted reprint accessibility", () => {
  it("lowers legal card/deck cost and raises adoption while preserving First Edition history", () => {
    const { world } = createProductFixtureWorld("reprint-accessibility");
    const deck = world.decks[fireFixtureDeck.id]!;
    const coreCardId = fireFixtureDeck.cards[0]!.cardId;
    const original = Object.values(world.printings).find(
      (printing) =>
        printing.sourceProductId === launchFireStarterProductId &&
        printing.cardId === coreCardId &&
        printing.id.endsWith("-normal"),
    )!;
    for (const entry of deck.cards) {
      const printing = Object.values(world.printings).find(
        (candidate) =>
          candidate.sourceProductId === launchFireStarterProductId &&
          candidate.cardId === entry.cardId &&
          candidate.id.endsWith("-normal"),
      )!;
      const price = entry.cardId === coreCardId ? 100 : 5;
      world.market.snapshots[printing.id] = {
        printingId: printing.id,
        lastPrice: price,
        dailyVolume: 1,
        availableSupply: 1,
        liquidity: 0.1,
        priceHistory: [{ day: 0, price, volume: 1 }],
      };
    }
    const originalHistory = structuredClone(
      world.market.snapshots[original.id]!.priceHistory,
    );
    const cardCostBefore = calculateCheapestCardCost(world, coreCardId)!;
    const deckCostBefore = calculateDeckMarketCost(world, deck.id);
    const targetExpansionId = expansionId("set-accessibility-reprint");
    const targetProductId = productId("product-accessibility-reprint");
    world.expansions[targetExpansionId] = {
      id: targetExpansionId,
      name: "Accessibility Reprint Set",
    };
    world.products[targetProductId] = {
      id: targetProductId,
      expansionId: targetExpansionId,
      name: "Accessibility Reprint Starter",
      kind: "STARTER",
      msrp: 15,
      cardIds: [coreCardId],
      releaseStatus: "UNANNOUNCED",
      internalReleaseDay: world.day,
    };
    const reprint = createTargetedReprintPrinting(
      world,
      original.id,
      targetProductId,
    );
    world.market.snapshots[reprint.id] = {
      printingId: reprint.id,
      lastPrice: 5,
      dailyVolume: 1,
      availableSupply: 20,
      liquidity: 0.8,
      priceHistory: [{ day: 1, price: 5, volume: 1 }],
    };
    const cardCostAfter = calculateCheapestCardCost(world, coreCardId)!;
    const deckCostAfter = calculateDeckMarketCost(world, deck.id);
    const player = world.players[playerId("player-0001")]!;
    player.tcgWallet = 200;
    player.motivation.competitive = 1;
    player.motivation.budgetSensitivity = 1;
    const adoptionContext = {
      performance: 1,
      socialExposure: 0.5,
      tournamentPrestige: 0.5,
      influencerExposure: 0.5,
      novelty: 0.5,
      missingCardCount: 0,
      complexity: 0,
    };
    const adoptionBefore = calculateAdoptionScore(player, deck, {
      ...adoptionContext,
      deckPrice: deckCostBefore,
    });
    const adoptionAfter = calculateAdoptionScore(player, deck, {
      ...adoptionContext,
      deckPrice: deckCostAfter,
    });

    expect(cardCostAfter).toBeLessThan(cardCostBefore);
    expect(deckCostAfter).toBeLessThan(deckCostBefore);
    expect(adoptionAfter).toBeGreaterThan(adoptionBefore);
    expect(world.market.snapshots[original.id]!.priceHistory).toEqual(
      originalHistory,
    );
    expect(world.market.snapshots[reprint.id]!.priceHistory).not.toEqual(
      originalHistory,
    );
  });
});
