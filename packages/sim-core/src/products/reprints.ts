import { ECONOMY_CONFIG, type ProductionConfig } from "@tcgtycoon/balance";
import {
  printingId,
  type PrintRun,
  type Printing,
  type PrintingId,
  type ProductId,
  type WorldEvent,
  type WorldState,
} from "@tcgtycoon/domain";
import { orderPrintRun, type PrintRunOrder } from "./production";

function appendReprintEvent(
  world: WorldState,
  type: string,
  productId: ProductId,
  reason: string,
): WorldEvent {
  const event: WorldEvent = {
    id: `reprint-event-${world.day}-${String(
      world.history.events.length + 1,
    ).padStart(4, "0")}`,
    day: world.day,
    type,
    context: { productId, reason },
  };
  world.history.events.push(event);
  return event;
}

export function createProductReprintOrder(
  world: WorldState,
  order: PrintRunOrder,
  config: ProductionConfig,
): PrintRun {
  const product = world.products[order.productId];
  if (product === undefined) {
    throw new Error(`Unknown product ${order.productId}`);
  }
  const hasCompletedOriginal = Object.values(world.printRuns).some(
    (run) => run.productId === product.id && run.status === "COMPLETED",
  );
  if (!hasCompletedOriginal) {
    throw new Error(
      `Product ${product.id} cannot be reprinted before its original run completes`,
    );
  }

  const run = orderPrintRun(world, order, config);
  appendReprintEvent(
    world,
    "PRODUCT_REPRINT_ORDERED",
    product.id,
    `PRINT_RUN:${run.id}`,
  );
  return run;
}

function targetedReprintId(
  targetProductId: ProductId,
  source: Printing,
): PrintingId {
  return printingId(
    `printing-${targetProductId}-${source.cardId}-reprint${ECONOMY_CONFIG.printingVariantSuffixes.normal}`,
  );
}

function matchesTargetedReprint(
  printing: Printing,
  source: Printing,
  targetProductId: ProductId,
  targetExpansionId: Printing["sourceExpansionId"],
): boolean {
  return (
    printing.cardId === source.cardId &&
    printing.expansionId === targetExpansionId &&
    printing.edition === "REPRINT" &&
    printing.sourceProductId === targetProductId &&
    printing.sourceExpansionId === targetExpansionId
  );
}

export function createTargetedReprintPrinting(
  world: WorldState,
  sourcePrintingId: PrintingId,
  targetProductId: ProductId,
): Printing {
  const source = world.printings[sourcePrintingId];
  if (source === undefined) {
    throw new Error(`Unknown source Printing ${sourcePrintingId}`);
  }
  if (world.cards[source.cardId] === undefined) {
    throw new Error(
      `Source Printing ${source.id} references unknown CardDefinition`,
    );
  }
  const targetProduct = world.products[targetProductId];
  if (targetProduct === undefined) {
    throw new Error(`Unknown target product ${targetProductId}`);
  }
  if (targetProduct.id === source.sourceProductId) {
    throw new Error("A targeted reprint must belong to a later product");
  }
  if (world.expansions[targetProduct.expansionId] === undefined) {
    throw new Error(
      `Target product ${targetProduct.id} references unknown expansion`,
    );
  }
  if (!targetProduct.cardIds.includes(source.cardId)) {
    throw new Error(
      `Target product ${targetProduct.id} does not include CardDefinition ${source.cardId}`,
    );
  }

  const id = targetedReprintId(targetProduct.id, source);
  const current = world.printings[id];
  if (current !== undefined) {
    if (
      !matchesTargetedReprint(
        current,
        source,
        targetProduct.id,
        targetProduct.expansionId,
      )
    ) {
      throw new Error(`Printing ID collision: ${id}`);
    }
    return current;
  }

  const printing: Printing = {
    id,
    cardId: source.cardId,
    expansionId: targetProduct.expansionId,
    edition: "REPRINT",
    sourceProductId: targetProduct.id,
    sourceExpansionId: targetProduct.expansionId,
  };
  world.printings[id] = printing;
  appendReprintEvent(
    world,
    "TARGETED_REPRINT_CREATED",
    targetProduct.id,
    `SOURCE_PRINTING:${source.id}`,
  );
  return printing;
}
