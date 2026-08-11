import {
  expansionId,
  playerId,
  printRunId,
  productId,
} from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  advancePrintRuns,
  calculateAdoptionScore,
  calculateCheapestCardCost,
  calculateDeckMarketCost,
  countWorldSupply,
  createTargetedReprintPrinting,
  openStarter,
  orderPrintRun,
  resolvePrimarySales,
  simulateDay,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  fireFixtureDeck,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

describe("targeted reprint accessibility", () => {
  it("lowers physical card/deck cost and raises adoption while preserving First Edition history", () => {
    const fixture = createProductFixtureWorld("reprint-accessibility");
    const { world } = fixture;
    world.status = "LIVE";
    const deck = world.decks[fireFixtureDeck.id]!;
    const coreCardId = fireFixtureDeck.cards[0]!.cardId;
    const original = Object.values(world.printings).find(
      (printing) =>
        printing.sourceProductId === launchFireStarterProductId &&
        printing.cardId === coreCardId &&
        printing.id.endsWith("-normal"),
    )!;
    const originalProduct = world.products[launchFireStarterProductId]!;
    originalProduct.releaseStatus = "LIVE";
    originalProduct.internalReleaseDay = world.day;
    originalProduct.releasedDay = world.day;

    const originalRun = orderPrintRun(
      world,
      {
        id: printRunId("print-run-accessibility-original"),
        productId: originalProduct.id,
        quantity: 1,
      },
      DEFAULT_BALANCE_CONFIG.production,
    );
    advancePrintRuns(world, originalRun.completionDay);
    world.day = originalRun.completionDay;

    const originalSeller = world.players[playerId("player-0001")]!;
    originalSeller.activity = "CHURNED";
    originalSeller.deckIds = [];
    originalSeller.tcgWallet = 100;
    const originalSale = resolvePrimarySales(
      world,
      [
        {
          buyerId: originalSeller.id,
          productId: originalProduct.id,
          quantity: 1,
        },
      ],
      new DeterministicRng(1n),
    );
    openStarter(
      world,
      originalProduct.id,
      originalSeller.id,
      fixture.starterPrintingIds,
      originalSale.openingRequests[0]!.printingIds,
    );

    for (const entry of deck.cards) {
      const printing = Object.values(world.printings).find(
        (candidate) =>
          candidate.sourceProductId === launchFireStarterProductId &&
          candidate.cardId === entry.cardId &&
          candidate.id.endsWith("-normal"),
      )!;
      world.market.listings.push({
        ownerId: originalSeller.id,
        printingId: printing.id,
        quantity: 1,
        price: entry.cardId === coreCardId ? 100 : 5,
      });
    }
    world.market.snapshots[original.id] = {
      printingId: original.id,
      lastPrice: 100,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.5,
      priceHistory: [{ day: world.day, price: 100, volume: 1 }],
    };
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
      releaseStatus: "LIVE",
      internalReleaseDay: world.day,
      releasedDay: world.day,
    };
    const reprint = createTargetedReprintPrinting(
      world,
      original.id,
      targetProductId,
    );
    const reprintRun = orderPrintRun(
      world,
      {
        id: printRunId("print-run-accessibility-reprint"),
        productId: targetProductId,
        quantity: 1,
      },
      DEFAULT_BALANCE_CONFIG.production,
    );
    advancePrintRuns(world, reprintRun.completionDay);
    world.day = reprintRun.completionDay;

    const reprintSeller = world.players[playerId("player-0002")]!;
    reprintSeller.activity = "ACTIVE";
    reprintSeller.deckIds = [];
    reprintSeller.tcgWallet = 100;
    const reprintSale = resolvePrimarySales(
      world,
      [
        {
          buyerId: reprintSeller.id,
          productId: targetProductId,
          quantity: 1,
        },
      ],
      new DeterministicRng(2n),
    );
    openStarter(
      world,
      targetProductId,
      reprintSeller.id,
      Array.from({ length: 20 }, () => reprint.id),
      reprintSale.openingRequests[0]!.printingIds,
    );
    expect(countWorldSupply(world, reprint.id)).toBe(20);

    const simulated = simulateDay(world, [], DEFAULT_BALANCE_CONFIG);
    const nextWorld = simulated.nextState;
    const reprintListing = nextWorld.market.listings.find(
      (listing) => listing.printingId === reprint.id,
    )!;
    const cardCostAfter = calculateCheapestCardCost(nextWorld, coreCardId)!;
    const deckCostAfter = calculateDeckMarketCost(nextWorld, deck.id);
    const adoptionPlayer = nextWorld.players[playerId("player-0003")]!;
    adoptionPlayer.tcgWallet = 200;
    adoptionPlayer.motivation.competitive = 1;
    adoptionPlayer.motivation.budgetSensitivity = 1;
    const adoptionContext = {
      performance: 1,
      socialExposure: 0.5,
      tournamentPrestige: 0.5,
      influencerExposure: 0.5,
      novelty: 0.5,
      missingCardCount: 0,
      complexity: 0,
    };
    const adoptionBefore = calculateAdoptionScore(adoptionPlayer, deck, {
      ...adoptionContext,
      deckPrice: deckCostBefore,
    });
    const adoptionAfter = calculateAdoptionScore(adoptionPlayer, deck, {
      ...adoptionContext,
      deckPrice: deckCostAfter,
    });

    expect(reprintListing.ownerId).toBe(reprintSeller.id);
    expect(
      nextWorld.players[reprintListing.ownerId]!.collection[reprint.id],
    ).toBe(20);
    expect(nextWorld.market.snapshots[reprint.id]).toBeUndefined();
    expect(cardCostAfter).toBeLessThan(cardCostBefore);
    expect(deckCostAfter).toBeLessThan(deckCostBefore);
    expect(adoptionAfter).toBeGreaterThan(adoptionBefore);
    expect(nextWorld.market.snapshots[original.id]!.priceHistory).toEqual(
      originalHistory,
    );
  });
});
