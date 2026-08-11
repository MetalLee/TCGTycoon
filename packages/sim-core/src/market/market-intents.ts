import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  type CardId,
  type PlayerId,
  type PrintingId,
  type WorldState,
} from "@tcgtycoon/domain";
import { toCurrency } from "../economy/cash-ledger";

export type BuyIntent = {
  ownerId: PlayerId;
  printingId: PrintingId;
  quantity: number;
  maxPrice: number;
  reason: "COMPETITIVE_NEED" | "COLLECTOR_INTEREST";
};

export type SellIntent = {
  ownerId: PlayerId;
  printingId: PrintingId;
  quantity: number;
  minPrice: number;
  reason: "LISTING" | "BUDGET_RELEASE";
};

export type MarketIntents = {
  buys: BuyIntent[];
  sells: SellIntent[];
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownedCardCount(
  world: WorldState,
  playerId: PlayerId,
  cardId: CardId,
): number {
  const player = world.players[playerId];
  if (player === undefined) {
    return 0;
  }

  return Object.entries(player.collection).reduce(
    (total, [printingId, quantity]) =>
      world.printings[printingId]?.cardId === cardId ? total + quantity : total,
    0,
  );
}

function requiredCardCounts(
  world: WorldState,
  playerId: PlayerId,
): Map<CardId, number> {
  const required = new Map<CardId, number>();
  const player = world.players[playerId];
  if (player === undefined) {
    return required;
  }

  for (const deckId of [...player.deckIds].sort(compareIds)) {
    const deck = world.decks[deckId];
    if (deck === undefined) {
      continue;
    }
    for (const entry of deck.cards) {
      required.set(
        entry.cardId,
        Math.max(required.get(entry.cardId) ?? 0, entry.count),
      );
    }
  }
  return required;
}

function validListings(world: WorldState) {
  return world.market.listings
    .filter((listing) => {
      const owner = world.players[listing.ownerId];
      return (
        owner !== undefined &&
        Number.isInteger(listing.quantity) &&
        listing.quantity > 0 &&
        Number.isFinite(listing.price) &&
        listing.price >= 0 &&
        (owner.collection[listing.printingId] ?? 0) > 0 &&
        world.printings[listing.printingId] !== undefined
      );
    })
    .sort(
      (left, right) =>
        left.price - right.price ||
        compareIds(left.printingId, right.printingId) ||
        compareIds(left.ownerId, right.ownerId),
    );
}

function generateCompetitiveBuys(world: WorldState): BuyIntent[] {
  const listings = validListings(world);
  const buys: BuyIntent[] = [];

  for (const player of Object.values(world.players).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    if (player.activity === "CHURNED") {
      continue;
    }
    let remainingBudget = player.tcgWallet;
    const required = requiredCardCounts(world, player.id);
    for (const [cardId, requiredQuantity] of [...required.entries()].sort(
      ([left], [right]) => compareIds(left, right),
    )) {
      let missing = requiredQuantity - ownedCardCount(world, player.id, cardId);
      if (missing <= 0) {
        continue;
      }

      const candidates = listings.filter(
        (listing) =>
          listing.ownerId !== player.id &&
          world.printings[listing.printingId]?.cardId === cardId,
      );
      const usedPrintingIds = new Set<PrintingId>();
      for (const listing of candidates) {
        if (missing === 0 || remainingBudget < listing.price) {
          break;
        }
        if (usedPrintingIds.has(listing.printingId)) {
          continue;
        }

        const available = candidates
          .filter((candidate) => candidate.printingId === listing.printingId)
          .reduce((total, candidate) => total + candidate.quantity, 0);
        const affordable =
          listing.price === 0
            ? missing
            : Math.floor(remainingBudget / listing.price);
        const quantity = Math.min(missing, available, affordable);
        if (quantity <= 0) {
          continue;
        }

        buys.push({
          ownerId: player.id,
          printingId: listing.printingId,
          quantity,
          maxPrice: listing.price,
          reason: "COMPETITIVE_NEED",
        });
        usedPrintingIds.add(listing.printingId);
        missing -= quantity;
        remainingBudget = toCurrency(
          remainingBudget - quantity * listing.price,
        );
      }
    }
  }

  return buys;
}

function isPremiumPrinting(printingId: PrintingId): boolean {
  return (
    printingId.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.foil) ||
    printingId.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.altArt)
  );
}

function generateCollectorBuys(
  world: WorldState,
  existing: readonly BuyIntent[],
): BuyIntent[] {
  const listings = validListings(world).filter((listing) =>
    isPremiumPrinting(listing.printingId),
  );
  const buys: BuyIntent[] = [];

  for (const player of Object.values(world.players).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    if (
      player.activity === "CHURNED" ||
      player.motivation.collector <
        ECONOMY_CONFIG.secondaryMarket.collectorIntentThreshold
    ) {
      continue;
    }

    const listing = listings.find(
      (candidate) =>
        candidate.ownerId !== player.id &&
        (player.collection[candidate.printingId] ?? 0) === 0 &&
        !existing.some(
          (intent) =>
            intent.ownerId === player.id &&
            intent.printingId === candidate.printingId,
        ) &&
        candidate.price <= player.tcgWallet,
    );
    if (listing === undefined) {
      continue;
    }

    buys.push({
      ownerId: player.id,
      printingId: listing.printingId,
      quantity: ECONOMY_CONFIG.secondaryMarket.maxCollectorQuantity,
      maxPrice: toCurrency(
        listing.price * ECONOMY_CONFIG.secondaryMarket.collectorBidMultiplier,
      ),
      reason: "COLLECTOR_INTEREST",
    });
  }

  return buys;
}

function generateListedSells(world: WorldState): SellIntent[] {
  return validListings(world).map((listing) => ({
    ownerId: listing.ownerId,
    printingId: listing.printingId,
    quantity: Math.min(
      listing.quantity,
      world.players[listing.ownerId]!.collection[listing.printingId]!,
    ),
    minPrice: listing.price,
    reason: "LISTING",
  }));
}

function generateBudgetSells(
  world: WorldState,
  listedSells: readonly SellIntent[],
): SellIntent[] {
  const listings = validListings(world);
  const sells: SellIntent[] = [];

  for (const player of Object.values(world.players).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    if (
      player.motivation.budgetSensitivity <
      ECONOMY_CONFIG.secondaryMarket.budgetSellerThreshold
    ) {
      continue;
    }

    const premiumHolding = (
      Object.entries(player.collection) as [PrintingId, number][]
    )
      .filter(
        ([printingId, quantity]) =>
          quantity > 0 &&
          isPremiumPrinting(printingId) &&
          !listedSells.some(
            (intent) =>
              intent.ownerId === player.id && intent.printingId === printingId,
          ),
      )
      .sort(([left], [right]) => compareIds(left, right))[0];
    if (premiumHolding === undefined) {
      continue;
    }

    const [printingId, owned] = premiumHolding;
    const reference = listings.find(
      (listing) =>
        listing.printingId === printingId && listing.ownerId !== player.id,
    );
    if (reference === undefined) {
      continue;
    }

    sells.push({
      ownerId: player.id,
      printingId,
      quantity: Math.min(
        owned,
        ECONOMY_CONFIG.secondaryMarket.maxBudgetSellerQuantity,
      ),
      minPrice: reference.price,
      reason: "BUDGET_RELEASE",
    });
  }

  return sells;
}

export function generateMarketIntents(world: WorldState): MarketIntents {
  const competitiveBuys = generateCompetitiveBuys(world);
  const collectorBuys = generateCollectorBuys(world, competitiveBuys);
  const listedSells = generateListedSells(world);
  return {
    buys: [...competitiveBuys, ...collectorBuys],
    sells: [...listedSells, ...generateBudgetSells(world, listedSells)],
  };
}
