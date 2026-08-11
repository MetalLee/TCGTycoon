import {
  ECONOMY_CONFIG,
  PRODUCT_LIFECYCLE_CONFIG,
} from "../../packages/balance/src/index";
import {
  expansionId,
  productId,
  type WorldState,
} from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  calculateProductFatigue,
  generatePrimaryDemand,
} from "../../packages/sim-core/src/index";
import { createProductFixtureWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

const currentDay = 180;
const retailSpendPerRelease = 10_000;
const targetProductId = productId("product-cadence-05");

function createCadenceWorld(seed: string, releaseDays: readonly number[]) {
  const { world } = createProductFixtureWorld(seed);
  const template = world.products["product-launch-booster"]!;
  world.day = currentDay;
  world.status = "LIVE";
  world.products = {};
  world.printings = {};
  world.printRuns = {};
  world.market = { listings: [], snapshots: {} };
  world.history.events = [];
  world.cash.ledger = [];

  releaseDays.forEach((releaseDay, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const id = productId(`product-cadence-${sequence}`);
    const setId = expansionId(`set-cadence-${sequence}`);
    world.expansions[setId] = { id: setId, name: `Cadence Set ${sequence}` };
    world.products[id] = {
      ...template,
      id,
      expansionId: setId,
      name: `Cadence Booster ${sequence}`,
      releaseStatus: "LIVE",
      internalReleaseDay: releaseDay,
      releasedDay: releaseDay,
    };
    world.history.events.push({
      id: `product-release-${sequence}`,
      day: releaseDay,
      type: "PRODUCT_RELEASED",
      context: { productId: id },
    });
    world.cash.ledger.push({
      day: releaseDay,
      category: "BOOSTER_REVENUE",
      sourceId: id,
      amount:
        retailSpendPerRelease * ECONOMY_CONFIG.primaryMarket.publisherShare,
    });
  });

  for (const player of Object.values(world.players)) {
    player.activity = "ACTIVE";
    player.tcgWallet = 100;
    player.motivation.competitive = 0.6;
    player.motivation.collector = 0.6;
    player.motivation.brewer = 0.6;
    player.motivation.budgetSensitivity = 0.5;
  }
  world.metrics.hype = 50;
  return world;
}

function targetDemandCount(world: WorldState): number {
  return generatePrimaryDemand(world, new DeterministicRng(20260811n)).filter(
    (request) => request.productId === targetProductId,
  ).length;
}

describe("cross-release product fatigue", () => {
  it("makes rapid 15-day releases more fatiguing and lowers later-product purchase propensity", () => {
    const moderateReleaseDays = [0, 45, 90, 135, 180];
    const rapidReleaseDays = [120, 135, 150, 165, 180];
    const moderate = createCadenceWorld(
      "moderate-cadence",
      moderateReleaseDays,
    );
    const rapid = createCadenceWorld("rapid-cadence", rapidReleaseDays);
    const trustBefore = {
      moderate: moderate.metrics.brandTrust,
      rapid: rapid.metrics.brandTrust,
    };

    const moderateFatigue = calculateProductFatigue(
      {
        currentDay,
        releaseDays: moderateReleaseDays,
        recentSpend: 50,
        spendingCapacity: 150,
      },
      PRODUCT_LIFECYCLE_CONFIG,
    );
    const rapidFatigue = calculateProductFatigue(
      {
        currentDay,
        releaseDays: rapidReleaseDays,
        recentSpend: 125,
        spendingCapacity: 225,
      },
      PRODUCT_LIFECYCLE_CONFIG,
    );

    expect(rapidFatigue).toBeGreaterThan(moderateFatigue);
    expect(targetDemandCount(rapid)).toBeLessThan(targetDemandCount(moderate));
    expect(moderate.metrics.brandTrust).toBe(trustBefore.moderate);
    expect(rapid.metrics.brandTrust).toBe(trustBefore.rapid);
  });
});
