import { PRODUCT_LIFECYCLE_CONFIG } from "../../packages/balance/src/index";
import { printRunId, type PrintingId } from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  countWorldSupply,
  generatePrimaryDemand,
  getSellableProductInventory,
  openStarter,
  resolvePrimarySales,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

function createStarterWorld(referencePrice: number) {
  const fixture = createProductFixtureWorld("starter-arbitrage");
  const { world } = fixture;
  world.day = 1;
  world.status = "LIVE";
  for (const product of Object.values(world.products)) {
    product.releaseStatus =
      product.id === launchFireStarterProductId ? "LIVE" : "UNANNOUNCED";
    product.internalReleaseDay = 1;
    if (product.releaseStatus === "LIVE") {
      product.releasedDay = 1;
    } else {
      delete product.releasedDay;
    }
  }
  const printingIds = [
    ...new Set(fixture.starterPrintingIds),
  ].sort() as PrintingId[];
  const runId = printRunId("print-run-starter-arbitrage");
  world.printRuns = {
    [runId]: {
      id: runId,
      productId: launchFireStarterProductId,
      orderedQuantity: 400,
      quantity: 400,
      orderedDay: 0,
      completionDay: 1,
      unitCost: 1,
      totalCost: 400,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds,
    },
  };
  for (const id of printingIds) {
    world.market.snapshots[id] = {
      printingId: id,
      lastPrice: referencePrice,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.1,
      priceHistory: [{ day: 0, price: referencePrice, volume: 1 }],
    };
  }
  for (const player of Object.values(world.players)) {
    player.activity = "ACTIVE";
    player.tcgWallet = 200;
    player.motivation.competitive = 1;
    player.motivation.collector = 1;
    player.motivation.whale = 1;
    player.motivation.casual = 0.5;
    player.motivation.budgetSensitivity = 0.5;
  }
  world.metrics.hype = 50;
  return { ...fixture, printingIds };
}

function openSoldStarters(
  fixture: ReturnType<typeof createStarterWorld>,
  requests: ReturnType<typeof resolvePrimarySales>["openingRequests"],
): void {
  for (const request of requests) {
    for (let unit = 0; unit < request.quantity; unit += 1) {
      openStarter(
        fixture.world,
        request.productId,
        request.buyerId,
        fixture.starterPrintingIds,
        request.printingIds,
      );
    }
  }
}

function containedSupply(
  fixture: ReturnType<typeof createStarterWorld>,
): number {
  return fixture.printingIds.reduce(
    (total, id) => total + countWorldSupply(fixture.world, id),
    0,
  );
}

describe("Starter arbitrage", () => {
  it("raises demand, sell-through and real singles supply when contents exceed MSRP", () => {
    const valuable = createStarterWorld(10);
    const control = createStarterWorld(0.1);
    const valuableDemand = generatePrimaryDemand(
      valuable.world,
      new DeterministicRng(11n),
      PRODUCT_LIFECYCLE_CONFIG,
      { [launchFireStarterProductId]: valuable.starterPrintingIds },
    );
    const controlDemand = generatePrimaryDemand(
      control.world,
      new DeterministicRng(11n),
      PRODUCT_LIFECYCLE_CONFIG,
      { [launchFireStarterProductId]: control.starterPrintingIds },
    );
    const supplyBefore = containedSupply(valuable);

    expect(valuableDemand.length).toBeGreaterThan(controlDemand.length);

    const valuableSales = resolvePrimarySales(
      valuable.world,
      valuableDemand,
      new DeterministicRng(12n),
    );
    const controlSales = resolvePrimarySales(
      control.world,
      controlDemand,
      new DeterministicRng(12n),
    );
    openSoldStarters(valuable, valuableSales.openingRequests);
    openSoldStarters(control, controlSales.openingRequests);

    expect(valuableSales.unitsSold).toBeGreaterThan(controlSales.unitsSold);
    expect(
      getSellableProductInventory(valuable.world, launchFireStarterProductId),
    ).toBeLessThan(
      getSellableProductInventory(control.world, launchFireStarterProductId),
    );
    expect(containedSupply(valuable)).toBeGreaterThan(supplyBefore);
    expect(containedSupply(valuable)).toBeGreaterThan(containedSupply(control));
  });
});
