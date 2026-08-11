import type { PlayerId, PrintingId } from "./ids";

export type MarketListing = {
  ownerId: PlayerId;
  printingId: PrintingId;
  quantity: number;
  price: number;
};

export type MarketState = {
  listings: MarketListing[];
};
