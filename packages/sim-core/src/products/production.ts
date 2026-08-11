import {
  ECONOMY_CONFIG,
  type ProductionConfig,
  type ProductionQuantityTier,
} from "@tcgtycoon/balance";
import {
  printingId,
  type PrintRun,
  type PrintRunId,
  type Printing,
  type PrintingEdition,
  type PrintingId,
  type ProductId,
  type ProductSku,
  type WorldState,
} from "@tcgtycoon/domain";
import { appendCashEntry, toCurrency } from "../economy/cash-ledger";

export type ProductionQuote = {
  quantity: number;
  unitCost: number;
  totalCost: number;
  leadDays: number;
};

export type PrintRunOrder = {
  id: PrintRunId;
  productId: ProductId;
  quantity: number;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive`);
  }
}

function validateTiers(
  tiers: readonly ProductionQuantityTier[],
): readonly ProductionQuantityTier[] {
  if (tiers.length === 0) {
    throw new RangeError("Production quantity tiers cannot be empty");
  }

  let previousLimit = 0;
  let previousMultiplier = Number.POSITIVE_INFINITY;
  let sawOpenEndedTier = false;
  for (const [index, tier] of tiers.entries()) {
    assertPositiveFinite(tier.unitCostMultiplier, "unitCostMultiplier");
    if (tier.unitCostMultiplier > previousMultiplier) {
      throw new RangeError(
        "Production tier unit-cost multipliers must be non-increasing",
      );
    }
    if (tier.upToQuantity === null) {
      if (index !== tiers.length - 1) {
        throw new RangeError("The open-ended production tier must be last");
      }
      sawOpenEndedTier = true;
    } else if (
      !Number.isInteger(tier.upToQuantity) ||
      tier.upToQuantity <= previousLimit
    ) {
      throw new RangeError(
        "Production tier quantity limits must be strictly increasing integers",
      );
    } else {
      previousLimit = tier.upToQuantity;
    }
    previousMultiplier = tier.unitCostMultiplier;
  }
  if (!sawOpenEndedTier) {
    throw new RangeError(
      "Production quantity tiers must end with an open tier",
    );
  }
  return tiers;
}

export function quotePrintRun(
  product: ProductSku,
  quantity: number,
  config: ProductionConfig,
): ProductionQuote {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("Print Run quantity must be a positive integer");
  }
  if (!Number.isInteger(config.leadDays) || config.leadDays <= 0) {
    throw new RangeError("Production leadDays must be a positive integer");
  }
  const baseUnitCost = config.baseUnitCostByKind[product.kind];
  assertPositiveFinite(baseUnitCost, `${product.kind} base unit cost`);
  const tiers = validateTiers(config.quantityTiers);

  let remaining = quantity;
  let previousLimit = 0;
  let unroundedTotal = 0;
  for (const tier of tiers) {
    const tierCapacity =
      tier.upToQuantity === null
        ? remaining
        : tier.upToQuantity - previousLimit;
    const units = Math.min(remaining, tierCapacity);
    unroundedTotal += units * baseUnitCost * tier.unitCostMultiplier;
    remaining -= units;
    if (tier.upToQuantity !== null) {
      previousLimit = tier.upToQuantity;
    }
    if (remaining === 0) {
      break;
    }
  }

  const totalCost = toCurrency(unroundedTotal);
  return {
    quantity,
    unitCost: Math.round((totalCost / quantity) * 10_000) / 10_000,
    totalCost,
    leadDays: config.leadDays,
  };
}

export function orderPrintRun(
  world: WorldState,
  order: PrintRunOrder,
  config: ProductionConfig,
): PrintRun {
  if (world.printRuns[order.id] !== undefined) {
    throw new Error(`Print Run ID already exists: ${order.id}`);
  }
  const product = world.products[order.productId];
  if (product === undefined) {
    throw new Error(`Unknown product ${order.productId}`);
  }
  if (world.expansions[product.expansionId] === undefined) {
    throw new Error(
      `Product ${product.id} references missing expansion ${product.expansionId}`,
    );
  }
  if (product.cardIds.length === 0) {
    throw new Error(`Product ${product.id} cannot be printed without cards`);
  }
  if (new Set(product.cardIds).size !== product.cardIds.length) {
    throw new Error(`Product ${product.id} contains duplicate card IDs`);
  }
  for (const cardId of product.cardIds) {
    if (world.cards[cardId] === undefined) {
      throw new Error(
        `Product ${product.id} references unknown card ${cardId}`,
      );
    }
  }

  const quote = quotePrintRun(product, order.quantity, config);
  if (world.cash.balance < quote.totalCost) {
    throw new Error(`Insufficient cash to order Print Run ${order.id}`);
  }

  const run: PrintRun = {
    id: order.id,
    productId: product.id,
    orderedQuantity: quote.quantity,
    quantity: 0,
    orderedDay: world.day,
    completionDay: world.day + quote.leadDays,
    unitCost: quote.unitCost,
    totalCost: quote.totalCost,
    status: "PRINTING",
    printingIds: [],
  };
  appendCashEntry(world.cash, {
    day: world.day,
    category: "PRINTING",
    sourceId: run.id,
    amount: -quote.totalCost,
  });
  world.printRuns[run.id] = run;
  return run;
}

export function cancelPrintRun(world: WorldState, id: PrintRunId): never {
  const run = world.printRuns[id];
  if (run === undefined) {
    throw new Error(`Unknown Print Run ${id}`);
  }
  if (run.status === "PRINTING") {
    throw new Error(`PRINTING run ${id} cannot be cancelled`);
  }
  throw new Error(`Completed Print Run ${id} cannot be cancelled`);
}

function editionToken(edition: PrintingEdition): string {
  return edition.toLowerCase().replaceAll("_", "-");
}

function variantSuffix(id: PrintingId): string {
  for (const suffix of [
    ECONOMY_CONFIG.printingVariantSuffixes.altArt,
    ECONOMY_CONFIG.printingVariantSuffixes.foil,
    ECONOMY_CONFIG.printingVariantSuffixes.normal,
  ]) {
    if (id.endsWith(suffix)) {
      return suffix;
    }
  }
  return ECONOMY_CONFIG.printingVariantSuffixes.normal;
}

function createPrintingId(
  product: ProductSku,
  cardId: string,
  edition: PrintingEdition,
  suffix: string,
): PrintingId {
  return printingId(
    `printing-${product.id}-${cardId}-${editionToken(edition)}${suffix}`,
  );
}

function existingEditionPrintings(
  world: WorldState,
  product: ProductSku,
  edition: PrintingEdition,
): Printing[] {
  return Object.values(world.printings)
    .filter(
      (printing) =>
        printing.sourceProductId === product.id &&
        printing.edition === edition &&
        product.cardIds.includes(printing.cardId),
    )
    .sort((left, right) => compareIds(left.id, right.id));
}

function ensureEditionPrintings(
  world: WorldState,
  product: ProductSku,
  edition: PrintingEdition,
): PrintingId[] {
  const existing = existingEditionPrintings(world, product, edition);
  const existingCardIds = new Set(existing.map((printing) => printing.cardId));
  if (product.cardIds.every((cardId) => existingCardIds.has(cardId))) {
    return existing.map((printing) => printing.id);
  }

  const templates = Object.values(world.printings)
    .filter(
      (printing) =>
        printing.sourceProductId === product.id &&
        product.cardIds.includes(printing.cardId),
    )
    .sort((left, right) => compareIds(left.id, right.id));

  for (const cardId of [...product.cardIds].sort(compareIds)) {
    if (existingCardIds.has(cardId)) {
      continue;
    }
    const cardTemplates = templates.filter(
      (printing) => printing.cardId === cardId,
    );
    const suffixes =
      cardTemplates.length === 0
        ? [ECONOMY_CONFIG.printingVariantSuffixes.normal]
        : [
            ...new Set(
              cardTemplates.map((printing) => variantSuffix(printing.id)),
            ),
          ];
    for (const suffix of suffixes) {
      const id = createPrintingId(product, cardId, edition, suffix);
      const printing: Printing = {
        id,
        cardId,
        expansionId: product.expansionId,
        edition,
        sourceProductId: product.id,
        sourceExpansionId: product.expansionId,
      };
      const current = world.printings[id];
      if (
        current !== undefined &&
        (current.cardId !== printing.cardId ||
          current.expansionId !== printing.expansionId ||
          current.edition !== printing.edition ||
          current.sourceProductId !== printing.sourceProductId ||
          current.sourceExpansionId !== printing.sourceExpansionId)
      ) {
        throw new Error(`Printing ID collision: ${id}`);
      }
      world.printings[id] = printing;
    }
  }

  return existingEditionPrintings(world, product, edition).map(
    (printing) => printing.id,
  );
}

export function completePrintRuns(
  world: WorldState,
  throughDay: number = world.day,
): PrintRunId[] {
  if (!Number.isInteger(throughDay) || throughDay < world.day) {
    throw new RangeError(
      "Print Runs can only advance to the current or a future integer day",
    );
  }

  const dueRuns = Object.values(world.printRuns)
    .filter(
      (run) => run.status === "PRINTING" && run.completionDay <= throughDay,
    )
    .sort(
      (left, right) =>
        left.completionDay - right.completionDay ||
        compareIds(left.id, right.id),
    );

  for (const run of dueRuns) {
    const product = world.products[run.productId];
    if (product === undefined) {
      throw new Error(`Print Run ${run.id} references unknown product`);
    }
    const hasCompletedRun = Object.values(world.printRuns).some(
      (candidate) =>
        candidate.productId === run.productId &&
        candidate.status === "COMPLETED",
    );
    const edition: PrintingEdition = hasCompletedRun
      ? "UNLIMITED"
      : "FIRST_EDITION";
    const printingIds = ensureEditionPrintings(world, product, edition);
    if (printingIds.length === 0) {
      throw new Error(`Print Run ${run.id} produced no Printing identities`);
    }
    run.edition = edition;
    run.printingIds = printingIds;
    run.quantity = run.orderedQuantity;
    run.status = "COMPLETED";
  }

  return dueRuns.map((run) => run.id);
}

export function advancePrintRuns(
  world: WorldState,
  throughDay: number = world.day,
): PrintRunId[] {
  return completePrintRuns(world, throughDay);
}
