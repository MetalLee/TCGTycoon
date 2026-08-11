import { METRICS_CONFIG } from "@tcgtycoon/balance";
import { type CardId, type WorldState } from "@tcgtycoon/domain";

export function calculateCheapestCardCost(
  world: WorldState,
  cardId: CardId,
): number | undefined {
  const printingIds = new Set(
    Object.values(world.printings)
      .filter((printing) => printing.cardId === cardId)
      .map((printing) => printing.id),
  );
  const prices = world.market.listings
    .filter((listing) => {
      const owner = world.players[listing.ownerId];
      return (
        printingIds.has(listing.printingId) &&
        owner !== undefined &&
        Number.isInteger(listing.quantity) &&
        listing.quantity > 0 &&
        (owner.collection[listing.printingId] ?? 0) > 0 &&
        Number.isFinite(listing.price) &&
        listing.price >= 0
      );
    })
    .map((listing) => listing.price);
  return prices.length === 0 ? undefined : Math.min(...prices);
}

export function calculateDeckMarketCost(
  world: WorldState,
  deckId: string,
  missingCardFallback = METRICS_CONFIG.accessibility
    .comfortableMedianMetaDeckCost * 2,
): number {
  const deck = world.decks[deckId];
  if (deck === undefined) {
    return missingCardFallback;
  }
  return deck.cards.reduce(
    (total, entry) =>
      total +
      (calculateCheapestCardCost(world, entry.cardId) ?? missingCardFallback) *
        entry.count,
    0,
  );
}
