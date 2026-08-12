import type {
  PrintingId,
  ProductId,
  WorldState,
} from "../../../../packages/domain/src/index";
import {
  calculateProductExpectedValue,
  getAvailableProductInventory,
} from "../../../../packages/sim-core/src/index";

export type ProductMarketView = Readonly<{
  id: ProductId;
  name: string;
  kind: "BOOSTER" | "STARTER";
  status: string;
  msrp: number;
  inventory: number;
  salesRevenue: number;
  packExpectedValue: number;
}>;

export type PrintingMarketView = Readonly<{
  id: PrintingId;
  cardId: string;
  cardName: string;
  productId: ProductId;
  edition: string;
  lastPrice: number | null;
  dailyVolume: number;
  availableSupply: number;
  liquidity: number;
  priceHistory: readonly Readonly<{
    day: number;
    price: number;
    volume: number;
  }>[];
}>;

export type MarketOverviewView = Readonly<{
  products: readonly ProductMarketView[];
  printings: readonly PrintingMarketView[];
}>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function productView(
  world: WorldState,
  id: ProductId,
): ProductMarketView | null {
  const product = world.products[id];
  if (product === undefined) return null;
  const salesRevenue = world.cash.ledger
    .filter(
      (entry) =>
        entry.sourceId === id &&
        (entry.category === "BOOSTER_REVENUE" ||
          entry.category === "STARTER_REVENUE"),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  return {
    id,
    name: product.name,
    kind: product.kind,
    status: product.releaseStatus,
    msrp: product.msrp,
    inventory: getAvailableProductInventory(world, id),
    salesRevenue,
    packExpectedValue: calculateProductExpectedValue(world, id),
  };
}

function printingView(
  world: WorldState,
  id: PrintingId,
): PrintingMarketView | null {
  const printing = world.printings[id];
  if (printing === undefined) return null;
  const snapshot = world.market.snapshots[id];
  return {
    id,
    cardId: printing.cardId,
    cardName: world.cards[printing.cardId]?.name ?? printing.cardId,
    productId: printing.sourceProductId,
    edition: printing.edition,
    lastPrice: snapshot?.lastPrice ?? null,
    dailyVolume: snapshot?.dailyVolume ?? 0,
    availableSupply: snapshot?.availableSupply ?? 0,
    liquidity: snapshot?.liquidity ?? 0,
    priceHistory: [...(snapshot?.priceHistory ?? [])].sort(
      (left, right) => left.day - right.day,
    ),
  };
}

export function selectMarketOverview(world: WorldState): MarketOverviewView {
  return {
    products: Object.keys(world.products)
      .sort(compareText)
      .flatMap((id) => {
        const view = productView(world, id as ProductId);
        return view === null ? [] : [view];
      }),
    printings: Object.keys(world.printings)
      .sort(compareText)
      .flatMap((id) => {
        const view = printingView(world, id as PrintingId);
        return view === null ? [] : [view];
      }),
  };
}

export function selectProductDetail(
  world: WorldState,
  id: ProductId,
): ProductMarketView | null {
  return productView(world, id);
}

export function selectPrintingDetail(
  world: WorldState,
  id: PrintingId,
): PrintingMarketView | null {
  return printingView(world, id);
}
