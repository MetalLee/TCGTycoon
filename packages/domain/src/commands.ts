import { z } from "zod";
import { productId, type ProductId } from "./ids";

export type PublisherCommand =
  | { type: "ADJUST_MSRP"; productId: ProductId; newMsrp: number }
  | {
      type: "ORDER_PRINT_RUN";
      productId: ProductId;
      quantity: number;
      completionDay: number;
    };

const productIdSchema = z.string().min(1).transform(productId);

export const publisherCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ADJUST_MSRP"),
      productId: productIdSchema,
      newMsrp: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ORDER_PRINT_RUN"),
      productId: productIdSchema,
      quantity: z.number().int().positive(),
      completionDay: z.number().int().nonnegative(),
    })
    .strict(),
]);

export function parsePublisherCommand(input: unknown): PublisherCommand {
  return publisherCommandSchema.parse(input) as PublisherCommand;
}

export function parsePublisherCommands(
  input: readonly unknown[],
): PublisherCommand[] {
  return input.map(parsePublisherCommand);
}
