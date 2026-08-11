import type { PlayerId, PrintingId } from "./ids";

export type MarketListing = {
  ownerId: PlayerId;
  printingId: PrintingId;
  quantity: number;
  price: number;
};

export type MarketPriceHistoryEntry = {
  day: number;
  price: number;
  volume: number;
};

export type PrintingMarketSnapshot = {
  printingId: PrintingId;
  lastPrice: number;
  dailyVolume: number;
  availableSupply: number;
  liquidity: number;
  priceHistory: MarketPriceHistoryEntry[];
};

export type MarketState = {
  listings: MarketListing[];
  snapshots: Record<string, PrintingMarketSnapshot>;
};
