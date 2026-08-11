import {
  cardId,
  deckId,
  factionId,
  playerId,
  type PrintingId,
} from "../../packages/domain/src/index";
import { generateMarketIntents } from "../../packages/sim-core/src/index";
import { createProductFixtureWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

describe("ban shock and collector value", () => {
  it("removes competitive demand while First Edition Foil collector demand remains nonzero", () => {
    const { world } = createProductFixtureWorld("ban-collector-value");
    const card = world.cards[cardId("card-fire-cub")]!;
    const printings = Object.values(world.printings).filter(
      (printing) => printing.cardId === card.id,
    );
    const normal = printings.find((printing) =>
      printing.id.endsWith("-normal"),
    )!;
    const foil = printings.find((printing) => printing.id.endsWith("-foil"))!;
    const seller = world.players[playerId("player-0001")]!;
    const competitor = world.players[playerId("player-0002")]!;
    const collector = world.players[playerId("player-0003")]!;
    for (const player of Object.values(world.players)) {
      player.activity = "ACTIVE";
      player.tcgWallet = 200;
      player.collection = {};
      player.deckIds = [];
      player.motivation.collector = 0;
    }
    seller.collection[normal.id] = 2;
    seller.collection[foil.id] = 2;
    competitor.deckIds = [deckId("deck-ban-shock")];
    collector.motivation.collector = 1;
    world.decks[deckId("deck-ban-shock")] = {
      id: deckId("deck-ban-shock"),
      factionId: factionId("fire"),
      cards: [{ cardId: card.id, count: 2 }],
      strategy: { competitive: 1 },
      originPlayerId: competitor.id,
      parentDeckIds: [],
      generation: 0,
      createdDay: 0,
    };
    world.market.listings = [
      {
        ownerId: seller.id,
        printingId: normal.id,
        quantity: 2,
        price: 10,
      },
      {
        ownerId: seller.id,
        printingId: foil.id,
        quantity: 1,
        price: 50,
      },
    ];
    world.market.snapshots[foil.id] = {
      printingId: foil.id,
      lastPrice: 100,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.1,
      priceHistory: [{ day: 0, price: 100, volume: 1 }],
    };

    const beforeBan = generateMarketIntents(world);
    const afterBan = generateMarketIntents(world, {
      bannedCardIds: [card.id],
    });
    const competitiveForCard = (printingId: PrintingId) =>
      world.printings[printingId]?.cardId === card.id;

    expect(
      beforeBan.buys.filter(
        (intent) =>
          intent.reason === "COMPETITIVE_NEED" &&
          competitiveForCard(intent.printingId),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      afterBan.buys.filter(
        (intent) =>
          intent.reason === "COMPETITIVE_NEED" &&
          competitiveForCard(intent.printingId),
      ),
    ).toEqual([]);
    expect(afterBan.buys).toContainEqual(
      expect.objectContaining({
        ownerId: collector.id,
        printingId: foil.id,
        reason: "COLLECTOR_INTEREST",
        maxPrice: expect.any(Number),
      }),
    );
    expect(world.market.snapshots[foil.id]!.lastPrice).toBeGreaterThan(0);
  });
});
