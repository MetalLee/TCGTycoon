import type { PublisherCommand, WorldState } from "@tcgtycoon/domain";

export type BasicPublisherBotConfig = {
  stockThreshold: number;
  reprintQuantity: number;
  minimumCashReserve: number;
  estimatedPrintCostPerUnit: number;
};

export const DEFAULT_BASIC_PUBLISHER_BOT_CONFIG: BasicPublisherBotConfig = {
  stockThreshold: 8,
  reprintQuantity: 12,
  minimumCashReserve: 1_000,
  estimatedPrintCostPerUnit: 2,
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`);
  }
}

function validateConfig(config: BasicPublisherBotConfig): void {
  assertNonNegativeFinite(config.stockThreshold, "stockThreshold");
  assertNonNegativeFinite(config.minimumCashReserve, "minimumCashReserve");
  assertNonNegativeFinite(
    config.estimatedPrintCostPerUnit,
    "estimatedPrintCostPerUnit",
  );
  if (
    !Number.isInteger(config.reprintQuantity) ||
    config.reprintQuantity <= 0
  ) {
    throw new RangeError("reprintQuantity must be a positive integer.");
  }
}

function projectedStock(world: WorldState, productId: string): number {
  return Object.values(world.printRuns)
    .filter((run) => run.productId === productId)
    .reduce(
      (total, run) =>
        total +
        (run.status === "PRINTING" ? run.orderedQuantity : run.quantity),
      0,
    );
}

export class BasicPublisherBot {
  readonly config: BasicPublisherBotConfig;

  constructor(
    config: BasicPublisherBotConfig = DEFAULT_BASIC_PUBLISHER_BOT_CONFIG,
  ) {
    validateConfig(config);
    this.config = { ...config };
  }

  decide(world: WorldState): PublisherCommand[] {
    if (world.status === "GAME_OVER") {
      return [];
    }

    const commands: PublisherCommand[] = [];
    const estimatedOrderCost =
      this.config.reprintQuantity * this.config.estimatedPrintCostPerUnit;
    let availableCash = world.cash.balance;

    for (const product of Object.values(world.products).sort((left, right) =>
      compareIds(left.id, right.id),
    )) {
      if (projectedStock(world, product.id) >= this.config.stockThreshold) {
        continue;
      }
      if (availableCash - estimatedOrderCost < this.config.minimumCashReserve) {
        continue;
      }

      commands.push({
        type: "ORDER_PRINT_RUN",
        productId: product.id,
        quantity: this.config.reprintQuantity,
      });
      availableCash -= estimatedOrderCost;
    }

    return commands;
  }
}
