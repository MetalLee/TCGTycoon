import type { ProductId } from "./ids";

export type WorldEventContext = {
  productId?: ProductId;
  reason?: string;
  publicCommitment?: boolean;
  trustSignal?: "NEGATIVE" | "POSITIVE" | "NONE";
  previousReleaseDay?: number;
  newReleaseDay?: number;
  availableInventory?: number;
  shortSupplyThreshold?: number;
};

export type WorldEvent = {
  id: string;
  day: number;
  type: string;
  context?: WorldEventContext;
};

export type WorldHistory = {
  events: WorldEvent[];
};
