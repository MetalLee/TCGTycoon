import { ECONOMY_CONFIG } from "../../packages/balance/src/index";
import { printRunId } from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  applyMarketTrades,
  calculateProductExpectedValue,
  clearPrintingAuction,
  countWorldSupply,
  generatePrimaryDemand,
  openBooster,
  resolvePrimarySales,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  launchBoosterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

function normalProductPrintings(
  world: ReturnType<typeof createProductFixtureWorld>["world"],
) {
  return Object.values(world.printings).filter(
    (printing) =>
      printing.sourceProductId === launchBoosterProductId &&
      printing.id.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.normal),
  );
}

function createPackEvWorld(priceScale: number) {
  const fixture = createProductFixtureWorld("pack-ev");
  const { world } = fixture;
  world.day = 1;
  world.status = "LIVE";
  const product = world.products[launchBoosterProductId]!;
  product.releaseStatus = "LIVE";
  product.internalReleaseDay = 1;
  product.releasedDay = 1;
  const printingIds = Object.values(world.printings)
    .filter((printing) => printing.sourceProductId === product.id)
    .map((printing) => printing.id)
    .sort();
  const runId = printRunId("print-run-pack-ev");
  world.printRuns = {
    [runId]: {
      id: runId,
      productId: product.id,
      orderedQuantity: 30,
      quantity: 30,
      orderedDay: 0,
      completionDay: 1,
      unitCost: 1,
      totalCost: 30,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds,
    },
  };
  for (const printing of normalProductPrintings(world)) {
    const rarity = world.cards[printing.cardId]!.rarity;
    const basePrice =
      rarity === "COMMON"
        ? 2
        : rarity === "UNCOMMON"
          ? 4
          : rarity === "RARE"
            ? 25
            : 50;
    const price = basePrice * priceScale;
    world.market.snapshots[printing.id] = {
      printingId: printing.id,
      lastPrice: price,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.1,
      priceHistory: [{ day: 0, price, volume: 1 }],
    };
  }
  for (const player of Object.values(world.players)) {
    player.activity = "ACTIVE";
    player.tcgWallet = 2_000;
    player.motivation.competitive = 1;
    player.motivation.collector = 1;
    player.motivation.whale = 1;
    player.motivation.brewer = 1;
    player.motivation.budgetSensitivity = 0;
    player.deckIds = [];
  }
  return fixture;
}

function totalProductSupply(
  world: ReturnType<typeof createProductFixtureWorld>["world"],
): number {
  return Object.values(world.printings)
    .filter((printing) => printing.sourceProductId === launchBoosterProductId)
    .reduce(
      (total, printing) => total + countWorldSupply(world, printing.id),
      0,
    );
}

describe("Pack EV equilibrium", () => {
  it("drives stronger demand and opening supply, then narrows the EV gap through lower market clears", () => {
    const high = createPackEvWorld(1);
    const control = createPackEvWorld(0.05);
    const initialExpectedValue = calculateProductExpectedValue(
      high.world,
      launchBoosterProductId,
    );
    const initialGap =
      initialExpectedValue - high.world.products[launchBoosterProductId]!.msrp;
    const highDemand = generatePrimaryDemand(
      high.world,
      new DeterministicRng(21n),
    );
    const controlDemand = generatePrimaryDemand(
      control.world,
      new DeterministicRng(21n),
    );
    const supplyBefore = totalProductSupply(high.world);

    expect(initialGap).toBeGreaterThan(0);
    expect(highDemand.length).toBeGreaterThan(controlDemand.length);

    const sales = resolvePrimarySales(
      high.world,
      highDemand.slice(0, 20),
      new DeterministicRng(22n),
    );
    let openingSequence = 0n;
    for (const request of sales.openingRequests) {
      for (let unit = 0; unit < request.quantity; unit += 1) {
        openBooster(
          high.world,
          request.productId,
          request.buyerId,
          new DeterministicRng(100n + openingSequence),
          request.printingIds,
        );
        openingSequence += 1n;
      }
    }
    expect(totalProductSupply(high.world)).toBeGreaterThan(supplyBefore);

    const players = Object.values(high.world.players);
    let lowerClears = 0;
    for (const printing of normalProductPrintings(high.world)) {
      const seller = players.find(
        (player) => (player.collection[printing.id] ?? 0) > 0,
      );
      const buyer = players.find((player) => player.id !== seller?.id);
      const oldPrice = high.world.market.snapshots[printing.id]?.lastPrice;
      if (
        seller === undefined ||
        buyer === undefined ||
        oldPrice === undefined
      ) {
        continue;
      }
      const clearingPrice = oldPrice * 0.25;
      high.world.market.listings.push({
        ownerId: seller.id,
        printingId: printing.id,
        quantity: 1,
        price: clearingPrice,
      });
      const auction = clearPrintingAuction({
        printingId: printing.id,
        buys: [{ ownerId: buyer.id, quantity: 1, maxPrice: clearingPrice }],
        sells: [{ ownerId: seller.id, quantity: 1, minPrice: clearingPrice }],
      });
      if (applyMarketTrades(high.world, [auction]).length > 0) {
        lowerClears += 1;
      }
    }

    const laterGap =
      calculateProductExpectedValue(high.world, launchBoosterProductId) -
      high.world.products[launchBoosterProductId]!.msrp;
    expect(lowerClears).toBeGreaterThan(0);
    expect(laterGap).toBeLessThan(initialGap);
  });
});
