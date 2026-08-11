import { ECONOMY_CONFIG } from "../../packages/balance/src/index";
import { printRunId } from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  calculateProductExpectedValue,
  countWorldSupply,
  generatePrimaryDemand,
  openBooster,
  resolvePrimarySales,
  simulateDay,
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
      sourceExpansionId: product.expansionId,
      productKind: product.kind,
      cardIds: [...product.cardIds],
      orderedQuantity: 50,
      quantity: 50,
      orderedDay: 0,
      completionDay: 1,
      unitCost: 1,
      totalCost: 50,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds,
    },
  };
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
  const seedBuyers = Object.values(world.players).slice(0, 20);
  const seedSales = resolvePrimarySales(
    world,
    seedBuyers.map((player) => ({
      buyerId: player.id,
      productId: product.id,
      quantity: 1,
    })),
    new DeterministicRng(20n),
  );
  seedSales.openingRequests.forEach((request, index) => {
    openBooster(
      world,
      request.productId,
      request.buyerId,
      new DeterministicRng(BigInt(1_000 + index)),
      request.printingIds,
    );
  });

  for (const printing of normalProductPrintings(world)) {
    const owner = seedBuyers.find(
      (player) => (player.collection[printing.id] ?? 0) > 0,
    );
    if (owner === undefined) {
      continue;
    }
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
    world.market.listings.push({
      ownerId: owner.id,
      printingId: printing.id,
      quantity: 1,
      price,
    });
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

    let state = high.world;
    let unitsSold = 0;
    let productsOpened = 0;
    for (let day = 0; day < 5; day += 1) {
      const result = simulateDay(state, [], DEFAULT_BALANCE_CONFIG);
      state = result.nextState;
      unitsSold += result.report.unitsSold;
      productsOpened += result.report.productsOpened;
    }

    expect(unitsSold).toBeGreaterThan(0);
    expect(productsOpened).toBe(unitsSold);
    expect(totalProductSupply(state)).toBeGreaterThan(supplyBefore);
    const endogenousListings = state.market.listings.filter(
      (listing) =>
        state.printings[listing.printingId]?.sourceProductId ===
        launchBoosterProductId,
    );
    expect(endogenousListings.length).toBeGreaterThan(0);
    expect(
      endogenousListings.every(
        (listing) =>
          (state.players[listing.ownerId]?.collection[listing.printingId] ??
            0) >= listing.quantity,
      ),
    ).toBe(true);

    const laterGap =
      calculateProductExpectedValue(state, launchBoosterProductId) -
      state.products[launchBoosterProductId]!.msrp;
    expect(laterGap).toBeLessThan(initialGap);
  });
});
