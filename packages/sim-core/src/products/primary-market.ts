import {
  ECONOMY_CONFIG,
  PRODUCT_LIFECYCLE_CONFIG,
  type ProductLifecycleConfig,
} from "@tcgtycoon/balance";
import {
  type PersistentPlayer,
  type PlayerId,
  type PrintRun,
  type PrintRunId,
  type PrintingId,
  type ProductId,
  type ProductSku,
  type WorldState,
} from "@tcgtycoon/domain";
import type { DeterministicRng } from "@tcgtycoon/rules-engine";
import { appendCashEntry, toCurrency } from "../economy/cash-ledger";
import {
  calculateProductFatigue,
  calculateSetFreshness,
} from "./product-lifecycle";
import { advancePrintRuns } from "./production";

export type CompletedPrintRun = {
  printRunId: PrintRunId;
  productId: ProductId;
  quantity: number;
};

export type PrimaryDemand = {
  buyerId: PlayerId;
  productId: ProductId;
  quantity: number;
};

export type ProductOpeningRequest = PrimaryDemand & {
  printRunId: PrintRunId;
  printingIds: PrintingId[];
};

export type PrimarySalesResult = {
  unitsSold: number;
  revenue: number;
  openingRequests: ProductOpeningRequest[];
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareBigInts(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function completedProductRuns(
  world: WorldState,
  productId: ProductId,
): PrintRun[] {
  return Object.values(world.printRuns)
    .filter((run) => run.productId === productId && run.status === "COMPLETED")
    .sort(
      (left, right) =>
        left.completionDay - right.completionDay ||
        compareIds(left.id, right.id),
    );
}

function sellableProductRuns(
  world: WorldState,
  productId: ProductId,
): PrintRun[] {
  return world.products[productId]?.releaseStatus === "LIVE"
    ? completedProductRuns(world, productId)
    : [];
}

function validatePrintRunQuantity(run: PrintRun): void {
  if (!Number.isInteger(run.quantity) || run.quantity < 0) {
    throw new RangeError(`Print Run ${run.id} quantity must be non-negative`);
  }
}

export function completePrintRunsDueToday(
  world: WorldState,
): CompletedPrintRun[] {
  return advancePrintRuns(world, world.day).map((id) => {
    const run = world.printRuns[id]!;
    validatePrintRunQuantity(run);
    return {
      printRunId: run.id,
      productId: run.productId,
      quantity: run.quantity,
    };
  });
}

export function getAvailableProductInventory(
  world: WorldState,
  productId: ProductId,
): number {
  return completedProductRuns(world, productId).reduce((total, run) => {
    validatePrintRunQuantity(run);
    return total + run.quantity;
  }, 0);
}

export function getSellableProductInventory(
  world: WorldState,
  productId: ProductId,
): number {
  return sellableProductRuns(world, productId).reduce((total, run) => {
    validatePrintRunQuantity(run);
    return total + run.quantity;
  }, 0);
}

function demandProbability(
  player: PersistentPlayer,
  product: ProductSku,
  exposure: number,
  freshness: number,
  fatigue: number,
  config: ProductLifecycleConfig,
): number {
  if (player.activity === "CHURNED" || player.tcgWallet < product.msrp) {
    return 0;
  }

  const pricePressure =
    player.tcgWallet === 0 ? 1 : Math.min(1, product.msrp / player.tcgWallet);
  const priceFit = 1 - player.motivation.budgetSensitivity * pricePressure;
  const motivationFit =
    product.kind === "BOOSTER"
      ? (player.motivation.competitive +
          player.motivation.collector +
          player.motivation.brewer) /
        3
      : (player.motivation.casual +
          player.motivation.budgetSensitivity +
          (player.activity === "NEW" ? 1 : 0)) /
        3;
  const baseProbability =
    motivationFit * config.demand.motivationWeight +
    priceFit * config.demand.affordabilityWeight +
    exposure * config.demand.exposureWeight +
    freshness * config.demand.freshnessWeight;
  return Math.min(
    1,
    Math.max(
      0,
      baseProbability * (1 - fatigue * config.demand.fatiguePenaltyWeight),
    ),
  );
}

function releaseDays(world: WorldState): number[] {
  return world.history.events
    .filter((event) => event.type === "PRODUCT_RELEASED")
    .map((event) => event.day);
}

function recentAveragePlayerSpend(
  world: WorldState,
  config: ProductLifecycleConfig,
): number {
  const earliestRecentDay = world.day - config.fatigue.lookbackDays;
  const primaryRevenue = world.cash.ledger
    .filter(
      (entry) =>
        entry.day > earliestRecentDay &&
        entry.day <= world.day &&
        (entry.category === "BOOSTER_REVENUE" ||
          entry.category === "STARTER_REVENUE") &&
        entry.amount > 0,
    )
    .reduce((total, entry) => total + entry.amount, 0);
  const activePlayerCount = Object.values(world.players).filter(
    (player) => player.activity !== "CHURNED",
  ).length;
  if (activePlayerCount === 0) {
    return 0;
  }
  return (
    primaryRevenue /
    ECONOMY_CONFIG.primaryMarket.publisherShare /
    activePlayerCount
  );
}

export function generatePrimaryDemand(
  world: WorldState,
  rng: DeterministicRng,
  config: ProductLifecycleConfig = PRODUCT_LIFECYCLE_CONFIG,
): PrimaryDemand[] {
  const players = Object.values(world.players).sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const products = Object.values(world.products)
    .filter((product) => product.releaseStatus === "LIVE")
    .sort((left, right) => compareIds(left.id, right.id));
  const demand: PrimaryDemand[] = [];
  const exposure = Math.min(1, Math.max(0, world.metrics.hype / 100));
  const recentReleases = releaseDays(world);
  const recentSpend = recentAveragePlayerSpend(world, config);
  const freshnessByProduct = new Map(
    products.map((product) => [
      product.id,
      calculateSetFreshness(
        {
          currentDay: world.day,
          releaseDay: product.releasedDay ?? world.day,
          marketingAttention: exposure,
        },
        config,
      ),
    ]),
  );

  for (const player of players) {
    const fatigue = calculateProductFatigue(
      {
        currentDay: world.day,
        releaseDays: recentReleases,
        recentSpend,
        spendingCapacity: player.tcgWallet + recentSpend,
      },
      config,
    );
    for (const product of products) {
      const probability = demandProbability(
        player,
        product,
        exposure,
        freshnessByProduct.get(product.id)!,
        fatigue,
        config,
      );
      if (rng.nextFloat() < probability) {
        demand.push({
          buyerId: player.id,
          productId: product.id,
          quantity: ECONOMY_CONFIG.primaryMarket.maxUnitsPerPlayerProductDemand,
        });
      }
    }
  }

  return demand;
}

function validateDemand(
  world: WorldState,
  demand: readonly PrimaryDemand[],
): void {
  for (const request of demand) {
    if (!Number.isInteger(request.quantity) || request.quantity < 0) {
      throw new RangeError(
        "Primary sale quantity must be a non-negative integer",
      );
    }
    const buyer = world.players[request.buyerId];
    if (buyer === undefined) {
      throw new Error(`Unknown primary-market buyer: ${request.buyerId}`);
    }
    if (!Number.isFinite(buyer.tcgWallet) || buyer.tcgWallet < 0) {
      throw new RangeError(
        `Buyer ${request.buyerId} wallet must be non-negative`,
      );
    }
    const product = world.products[request.productId];
    if (product === undefined) {
      throw new Error(`Unknown primary-market product: ${request.productId}`);
    }
    if (!Number.isFinite(product.msrp) || product.msrp < 0) {
      throw new RangeError(
        `Product ${request.productId} MSRP must be non-negative`,
      );
    }
  }
}

function orderedDemand(
  demand: readonly PrimaryDemand[],
  rng: DeterministicRng,
): PrimaryDemand[] {
  const stable = demand
    .map((request, index) => ({ request, index }))
    .sort(
      (left, right) =>
        compareIds(left.request.productId, right.request.productId) ||
        compareIds(left.request.buyerId, right.request.buyerId) ||
        left.index - right.index,
    );

  return stable
    .map(({ request }) => ({ request, priority: rng.nextUint64() }))
    .sort(
      (left, right) =>
        compareIds(left.request.productId, right.request.productId) ||
        compareBigInts(left.priority, right.priority) ||
        compareIds(left.request.buyerId, right.request.buyerId),
    )
    .map(({ request }) => request);
}

type InventoryAllocation = {
  run: PrintRun;
  quantity: number;
};

function removeInventory(
  world: WorldState,
  productId: ProductId,
  requestedQuantity: number,
): InventoryAllocation[] {
  let remaining = requestedQuantity;
  const allocations: InventoryAllocation[] = [];
  for (const run of sellableProductRuns(world, productId)) {
    validatePrintRunQuantity(run);
    const quantity = Math.min(run.quantity, remaining);
    run.quantity -= quantity;
    remaining -= quantity;
    if (quantity > 0) {
      allocations.push({ run, quantity });
    }
    if (remaining === 0) {
      break;
    }
  }
  return allocations;
}

export function resolvePrimarySales(
  world: WorldState,
  demand: readonly PrimaryDemand[],
  rng: DeterministicRng,
): PrimarySalesResult {
  validateDemand(world, demand);
  const openingRequests: ProductOpeningRequest[] = [];
  let unitsSold = 0;
  let revenue = 0;

  for (const request of orderedDemand(demand, rng)) {
    const buyer = world.players[request.buyerId]!;
    const product = world.products[request.productId]!;
    const affordableQuantity =
      product.msrp === 0
        ? request.quantity
        : Math.floor(buyer.tcgWallet / product.msrp);
    const quantity = Math.min(request.quantity, affordableQuantity);
    const allocations = removeInventory(world, product.id, quantity);
    const sold = allocations.reduce(
      (total, allocation) => total + allocation.quantity,
      0,
    );
    if (sold === 0) {
      continue;
    }

    const retailCost = toCurrency(sold * product.msrp);
    const publisherRevenue = toCurrency(
      retailCost * ECONOMY_CONFIG.primaryMarket.publisherShare,
    );
    buyer.tcgWallet = toCurrency(buyer.tcgWallet - retailCost);
    appendCashEntry(world.cash, {
      day: world.day,
      category:
        product.kind === "BOOSTER" ? "BOOSTER_REVENUE" : "STARTER_REVENUE",
      sourceId: product.id,
      amount: publisherRevenue,
    });
    for (const allocation of allocations) {
      openingRequests.push({
        buyerId: buyer.id,
        productId: product.id,
        quantity: allocation.quantity,
        printRunId: allocation.run.id,
        printingIds: [...allocation.run.printingIds],
      });
    }
    unitsSold += sold;
    revenue = toCurrency(revenue + publisherRevenue);
  }

  return { unitsSold, revenue, openingRequests };
}
