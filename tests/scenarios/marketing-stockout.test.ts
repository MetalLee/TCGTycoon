import {
  operationId,
  printRunId,
  type WorldState,
} from "../../packages/domain/src/index";
import {
  advanceCampaignExposure,
  applyCampaignExposureToLifecycleRates,
  createInitialWorldMetrics,
  getSellableProductInventory,
  processLifecycleDay,
  scheduleCampaign,
  type LifecycleRates,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

const BASE_RATES: LifecycleRates = {
  potentialToInterested: 0,
  interestedToNew: 0.2,
  newToActive: 0,
  activeToAtRisk: 0,
  atRiskToChurned: 0,
  churnedToReturning: 0,
  returningToActive: 0,
};

function createCampaignWorld(stockStarter: boolean): WorldState {
  const fixture = createProductFixtureWorld(
    stockStarter ? "marketing-stocked" : "marketing-stockout",
  );
  const { world } = fixture;
  world.status = "LIVE";
  world.day = 1;
  world.operations = {};
  world.cohorts = [{ id: "cohort-new", count: 1_300 }];
  world.metrics = createInitialWorldMetrics({
    potential: 1_000,
    interested: 300,
    newByAge: [0, 0, 0, 0, 0, 0, 0],
    active: 100,
    atRisk: 0,
    churned: 0,
    returning: 0,
  });
  const starter = world.products[launchFireStarterProductId]!;
  starter.releaseStatus = "LIVE";
  starter.releasedDay = 0;
  if (stockStarter) {
    const id = printRunId("print-run-marketing-stocked-starter");
    world.printRuns[id] = {
      id,
      productId: starter.id,
      sourceExpansionId: starter.expansionId,
      productKind: "STARTER",
      cardIds: [...starter.cardIds],
      orderedQuantity: 100,
      quantity: 100,
      orderedDay: 0,
      completionDay: 0,
      unitCost: 1,
      totalCost: 100,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds: [...fixture.starterPrintingIds],
    };
  }
  scheduleCampaign(world, {
    id: operationId("campaign-new-player-stockout"),
    campaignType: "NEW_PLAYER_CAMPAIGN",
    durationDays: 7,
    createdDay: 0,
    startDay: 1,
  });
  return world;
}

function runCampaignLifecycle(world: WorldState) {
  const exposure = advanceCampaignExposure(world, world.day);
  const rates = applyCampaignExposureToLifecycleRates(
    world,
    BASE_RATES,
    exposure,
  );
  return {
    exposure,
    rates,
    lifecycle: processLifecycleDay(world.metrics.lifecycle, {
      worldSeed: world.worldSeed,
      day: world.day,
      rates,
    }),
  };
}

describe("new-player marketing during Starter stockout", () => {
  it("raises awareness and Interested population while constraining Interested-to-New conversion", () => {
    const stockoutWorld = createCampaignWorld(false);
    const stockedWorld = createCampaignWorld(true);
    const activeBefore = stockoutWorld.metrics.activePlayers;

    const stockout = runCampaignLifecycle(stockoutWorld);
    const stocked = runCampaignLifecycle(stockedWorld);

    expect(
      getSellableProductInventory(stockoutWorld, launchFireStarterProductId),
    ).toBe(0);
    expect(stockout.exposure).toEqual([
      expect.objectContaining({
        campaignType: "NEW_PLAYER_CAMPAIGN",
        audience: "NEW_PLAYERS",
        exposureCount: expect.any(Number),
      }),
    ]);
    expect(stockout.exposure[0]!.exposureCount).toBeGreaterThan(0);
    expect(stockout.lifecycle.deltas.potentialToInterested).toBeGreaterThan(0);
    expect(stockout.lifecycle.population.interested).toBeGreaterThan(
      stockoutWorld.metrics.lifecycle.interested,
    );
    expect(stockout.rates.interestedToNew).toBeLessThan(
      stocked.rates.interestedToNew,
    );
    expect(stockout.lifecycle.deltas.interestedToNew).toBeLessThan(
      stocked.lifecycle.deltas.interestedToNew,
    );
    expect(stockout.lifecycle.population.active).toBe(
      stockoutWorld.metrics.lifecycle.active,
    );
    expect(stockoutWorld.metrics.activePlayers).toBe(activeBefore);
  });
});
