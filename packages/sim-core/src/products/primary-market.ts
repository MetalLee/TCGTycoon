import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  type PersistentPlayer,
  type PlayerId,
  type PrintRun,
  type PrintRunId,
  type ProductId,
  type WorldState,
} from "@tcgtycoon/domain";
import type { DeterministicRng } from "@tcgtycoon/rules-engine";
import { appendCashEntry, toCurrency } from "../economy/cash-ledger";

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

export type ProductOpeningRequest = PrimaryDemand;

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

function productRuns(world: WorldState, productId: ProductId): PrintRun[] {
  // Until the production phase adds richer warehouse state, quantity on a
  // completed PrintRun is its remaining sellable product inventory.
  return Object.values(world.printRuns)
    .filter(
      (run) => run.productId === productId && run.completionDay <= world.day,
    )
    .sort(
      (left, right) =>
        left.completionDay - right.completionDay ||
        compareIds(left.id, right.id),
    );
}

function validatePrintRunQuantity(run: PrintRun): void {
  if (!Number.isInteger(run.quantity) || run.quantity < 0) {
    throw new RangeError(`Print Run ${run.id} quantity must be non-negative`);
  }
}

export function completePrintRunsDueToday(
  world: WorldState,
): CompletedPrintRun[] {
  return Object.values(world.printRuns)
    .filter((run) => run.completionDay === world.day)
    .sort((left, right) => compareIds(left.id, right.id))
    .map((run) => {
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
  return productRuns(world, productId).reduce((total, run) => {
    validatePrintRunQuantity(run);
    return total + run.quantity;
  }, 0);
}

function demandProbability(
  player: PersistentPlayer,
  kind: "BOOSTER" | "STARTER",
  msrp: number,
): number {
  if (player.activity === "CHURNED" || player.tcgWallet < msrp) {
    return 0;
  }

  const pricePressure =
    player.tcgWallet === 0 ? 1 : Math.min(1, msrp / player.tcgWallet);
  const priceFit = 1 - player.motivation.budgetSensitivity * pricePressure;
  const motivationFit =
    kind === "BOOSTER"
      ? (player.motivation.competitive +
          player.motivation.collector +
          player.motivation.brewer) /
        3
      : (player.motivation.casual +
          player.motivation.budgetSensitivity +
          (player.activity === "NEW" ? 1 : 0)) /
        3;

  return Math.min(
    1,
    Math.max(
      0,
      (motivationFit +
        priceFit +
        ECONOMY_CONFIG.primaryMarket.productFreshnessPlaceholder) /
        3,
    ),
  );
}

export function generatePrimaryDemand(
  world: WorldState,
  rng: DeterministicRng,
): PrimaryDemand[] {
  const players = Object.values(world.players).sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const products = Object.values(world.products).sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const demand: PrimaryDemand[] = [];

  for (const player of players) {
    for (const product of products) {
      const probability = demandProbability(player, product.kind, product.msrp);
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

function removeInventory(
  world: WorldState,
  productId: ProductId,
  requestedQuantity: number,
): number {
  let remaining = requestedQuantity;
  for (const run of productRuns(world, productId)) {
    validatePrintRunQuantity(run);
    const quantity = Math.min(run.quantity, remaining);
    run.quantity -= quantity;
    remaining -= quantity;
    if (remaining === 0) {
      break;
    }
  }
  return requestedQuantity - remaining;
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
    const sold = removeInventory(world, product.id, quantity);
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
    openingRequests.push({
      buyerId: buyer.id,
      productId: product.id,
      quantity: sold,
    });
    unitsSold += sold;
    revenue = toCurrency(revenue + publisherRevenue);
  }

  return { unitsSold, revenue, openingRequests };
}
