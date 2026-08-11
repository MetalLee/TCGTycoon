import type { ProductId } from "./ids";

export type PublisherCommand =
  | { type: "ADJUST_MSRP"; productId: ProductId; newMsrp: number }
  | {
      type: "ORDER_PRINT_RUN";
      productId: ProductId;
      quantity: number;
      completionDay: number;
    };
