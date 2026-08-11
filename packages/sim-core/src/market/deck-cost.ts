import { METRICS_CONFIG } from "@tcgtycoon/balance";
import { type CardId, type WorldState } from "@tcgtycoon/domain";

export function calculateCheapestCardCost(
  world: WorldState,
  cardId: CardId,
): number | undefined {
  const printingIds = Object.values(world.printings)
    .filter((printing) => printing.cardId === cardId)
    .map((printing) => printing.id);
  const prices = [
    ...printingIds.flatMap((id) => {
      const snapshot = world.market.snapshots[id];
      return snapshot === undefined ? [] : [snapshot.lastPrice];
    }),
    ...world.market.listings
      .filter((listing) => printingIds.includes(listing.printingId))
      .map((listing) => listing.price),
  ].filter((price) => Number.isFinite(price) && price >= 0);
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
