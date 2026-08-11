import {
  type CardId,
  type PlayerId,
  type PrintingId,
  type WorldState,
} from "@tcgtycoon/domain";
import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import { toCurrency } from "../economy/cash-ledger";

export type AuctionBuyOrder = {
  ownerId: PlayerId;
  quantity: number;
  maxPrice: number;
};

export type AuctionSellOrder = {
  ownerId: PlayerId;
  quantity: number;
  minPrice: number;
};

export type PrintingAuctionInput = {
  printingId: PrintingId;
  buys: AuctionBuyOrder[];
  sells: AuctionSellOrder[];
};

export type AuctionTrade = {
  printingId: PrintingId;
  buyerId: PlayerId;
  sellerId: PlayerId;
  quantity: number;
  price: number;
};

export type AuctionResult = {
  printingId: PrintingId;
  clearingPrice: number | null;
  volume: number;
  trades: AuctionTrade[];
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateOrder(quantity: number, price: number, side: string): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`${side} quantity must be a non-negative integer`);
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError(`${side} price must be non-negative and finite`);
  }
}

export function clearPrintingAuction(
  input: PrintingAuctionInput,
): AuctionResult {
  for (const buy of input.buys) {
    validateOrder(buy.quantity, buy.maxPrice, "Buy");
  }
  for (const sell of input.sells) {
    validateOrder(sell.quantity, sell.minPrice, "Sell");
  }

  const buys = input.buys
    .filter((order) => order.quantity > 0)
    .map((order) => ({ ...order, remaining: order.quantity }))
    .sort(
      (left, right) =>
        right.maxPrice - left.maxPrice ||
        compareIds(left.ownerId, right.ownerId),
    );
  const sells = input.sells
    .filter((order) => order.quantity > 0)
    .map((order) => ({ ...order, remaining: order.quantity }))
    .sort(
      (left, right) =>
        left.minPrice - right.minPrice ||
        compareIds(left.ownerId, right.ownerId),
    );
  const provisional: Omit<AuctionTrade, "price">[] = [];
  let buyIndex = 0;
  let sellIndex = 0;
  let marginalBid: number | undefined;
  let marginalAsk: number | undefined;

  while (buyIndex < buys.length && sellIndex < sells.length) {
    const buy = buys[buyIndex]!;
    const sell = sells[sellIndex]!;
    if (buy.maxPrice < sell.minPrice) {
      break;
    }

    const quantity = Math.min(buy.remaining, sell.remaining);
    provisional.push({
      printingId: input.printingId,
      buyerId: buy.ownerId,
      sellerId: sell.ownerId,
      quantity,
    });
    marginalBid = buy.maxPrice;
    marginalAsk = sell.minPrice;
    buy.remaining -= quantity;
    sell.remaining -= quantity;
    if (buy.remaining === 0) {
      buyIndex += 1;
    }
    if (sell.remaining === 0) {
      sellIndex += 1;
    }
  }

  if (marginalBid === undefined || marginalAsk === undefined) {
    return {
      printingId: input.printingId,
      clearingPrice: null,
      volume: 0,
      trades: [],
    };
  }

  const clearingPrice = toCurrency((marginalBid + marginalAsk) / 2);
  const trades = provisional.map((trade) => ({
    ...trade,
    price: clearingPrice,
  }));
  return {
    printingId: input.printingId,
    clearingPrice,
    volume: trades.reduce((total, trade) => total + trade.quantity, 0),
    trades,
  };
}

function validateTrade(world: WorldState, trade: AuctionTrade): void {
  if (world.printings[trade.printingId] === undefined) {
    throw new Error(`Unknown traded Printing: ${trade.printingId}`);
  }
  if (world.players[trade.buyerId] === undefined) {
    throw new Error(`Unknown market buyer: ${trade.buyerId}`);
  }
  if (world.players[trade.sellerId] === undefined) {
    throw new Error(`Unknown market seller: ${trade.sellerId}`);
  }
  validateOrder(trade.quantity, trade.price, "Trade");
}

function requiredCardCount(
  world: WorldState,
  ownerId: PlayerId,
  cardId: CardId,
): number {
  const player = world.players[ownerId];
  if (player === undefined) {
    return 0;
  }
  return [...player.deckIds].sort(compareIds).reduce((required, id) => {
    const deck = world.decks[id];
    const entry = deck?.cards.find((candidate) => candidate.cardId === cardId);
    return Math.max(required, entry?.count ?? 0);
  }, 0);
}

function worldPrintingSupply(
  world: WorldState,
  printingId: PrintingId,
): number {
  return Object.values(world.players).reduce(
    (total, player) => total + (player.collection[printingId] ?? 0),
    0,
  );
}

function updateMarketSnapshots(
  world: WorldState,
  results: readonly AuctionResult[],
  applied: readonly AuctionTrade[],
): void {
  for (const snapshot of Object.values(world.market.snapshots)) {
    snapshot.dailyVolume = 0;
    snapshot.availableSupply = world.market.listings
      .filter((listing) => listing.printingId === snapshot.printingId)
      .reduce((total, listing) => total + listing.quantity, 0);
    const totalSupply = worldPrintingSupply(world, snapshot.printingId);
    snapshot.liquidity =
      totalSupply === 0
        ? 0
        : Math.min(1, snapshot.availableSupply / totalSupply);
  }

  for (const result of [...results].sort((left, right) =>
    compareIds(left.printingId, right.printingId),
  )) {
    const trades = applied.filter(
      (trade) => trade.printingId === result.printingId,
    );
    const volume = trades.reduce((total, trade) => total + trade.quantity, 0);
    const previous = world.market.snapshots[result.printingId];
    const lastPrice = trades.at(-1)?.price ?? previous?.lastPrice;
    if (lastPrice === undefined) {
      continue;
    }
    const availableSupply = world.market.listings
      .filter((listing) => listing.printingId === result.printingId)
      .reduce((total, listing) => total + listing.quantity, 0);
    const totalSupply = worldPrintingSupply(world, result.printingId);
    const priceHistory =
      volume === 0
        ? [...(previous?.priceHistory ?? [])]
        : [
            ...(previous?.priceHistory ?? []),
            { day: world.day, price: lastPrice, volume },
          ].slice(-ECONOMY_CONFIG.secondaryMarket.maxPriceHistoryDays);
    world.market.snapshots[result.printingId] = {
      printingId: result.printingId,
      lastPrice,
      dailyVolume: volume,
      availableSupply,
      liquidity:
        totalSupply === 0 ? 0 : Math.min(1, availableSupply / totalSupply),
      priceHistory,
    };
  }
}

export function applyMarketTrades(
  world: WorldState,
  results: readonly AuctionResult[],
): AuctionTrade[] {
  const orderedTrades = [...results]
    .sort((left, right) => compareIds(left.printingId, right.printingId))
    .flatMap((result) => result.trades);
  for (const trade of orderedTrades) {
    validateTrade(world, trade);
  }

  const virtualWallets = new Map<PlayerId, number>();
  const virtualHoldings = new Map<string, number>();
  const holdingKey = (ownerId: PlayerId, printingId: PrintingId) =>
    `${ownerId}\u0000${printingId}`;
  const wallet = (ownerId: PlayerId) =>
    virtualWallets.get(ownerId) ?? world.players[ownerId]!.tcgWallet;
  const holding = (ownerId: PlayerId, printingId: PrintingId) =>
    virtualHoldings.get(holdingKey(ownerId, printingId)) ??
    world.players[ownerId]!.collection[printingId] ??
    0;
  const cardHolding = (ownerId: PlayerId, cardId: CardId) =>
    Object.keys(world.printings)
      .sort(compareIds)
      .reduce((total, printingId) => {
        const printing = world.printings[printingId]!;
        return printing.cardId === cardId
          ? total + holding(ownerId, printing.id)
          : total;
      }, 0);
  const applied: AuctionTrade[] = [];

  for (const trade of orderedTrades) {
    if (trade.buyerId === trade.sellerId) {
      continue;
    }
    const sellerHolding = holding(trade.sellerId, trade.printingId);
    const cardId = world.printings[trade.printingId]!.cardId;
    const sellerTradable = Math.max(
      0,
      cardHolding(trade.sellerId, cardId) -
        requiredCardCount(world, trade.sellerId, cardId),
    );
    const buyerWallet = wallet(trade.buyerId);
    const affordable =
      trade.price === 0
        ? trade.quantity
        : Math.floor(buyerWallet / trade.price);
    const quantity = Math.min(
      trade.quantity,
      sellerHolding,
      sellerTradable,
      affordable,
    );
    if (quantity <= 0) {
      continue;
    }

    const cost = toCurrency(quantity * trade.price);
    virtualHoldings.set(
      holdingKey(trade.sellerId, trade.printingId),
      sellerHolding - quantity,
    );
    virtualHoldings.set(
      holdingKey(trade.buyerId, trade.printingId),
      holding(trade.buyerId, trade.printingId) + quantity,
    );
    virtualWallets.set(trade.buyerId, toCurrency(buyerWallet - cost));
    virtualWallets.set(
      trade.sellerId,
      toCurrency(wallet(trade.sellerId) + cost),
    );
    applied.push({ ...trade, quantity });
  }

  for (const [ownerId, nextWallet] of virtualWallets) {
    world.players[ownerId]!.tcgWallet = nextWallet;
  }
  for (const [key, quantity] of virtualHoldings) {
    const [ownerId, printingId] = key.split("\u0000") as [PlayerId, PrintingId];
    world.players[ownerId]!.collection[printingId] = quantity;
  }
  for (const trade of applied) {
    let remaining = trade.quantity;
    for (const listing of world.market.listings) {
      if (
        remaining > 0 &&
        listing.ownerId === trade.sellerId &&
        listing.printingId === trade.printingId
      ) {
        const removed = Math.min(listing.quantity, remaining);
        listing.quantity -= removed;
        remaining -= removed;
      }
    }
  }
  world.market.listings = world.market.listings.filter(
    (listing) => listing.quantity > 0,
  );
  updateMarketSnapshots(world, results, applied);

  return applied;
}
