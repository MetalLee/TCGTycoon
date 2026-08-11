import { describe, expect, it } from "vitest";
import { simulateDay } from "../../packages/sim-core/src/index";
import {
  createBalancedWorld,
  launchBoosterProductId,
} from "../../packages/testkit/src/index";

function createReleaseScenario(inventory: number) {
  const scenario = createBalancedWorld(`release-delay-${inventory}`);
  for (const product of Object.values(scenario.world.products)) {
    product.releaseStatus = "UNANNOUNCED";
    product.internalReleaseDay = scenario.world.day;
    delete product.announcedReleaseDay;
    delete product.releasedDay;
  }
  for (const run of Object.values(scenario.world.printRuns)) {
    run.quantity = run.productId === launchBoosterProductId ? inventory : 0;
  }
  for (const player of Object.values(scenario.world.players)) {
    player.tcgWallet = 100;
    player.motivation.competitive = 1;
    player.motivation.collector = 1;
    player.motivation.brewer = 1;
    player.motivation.budgetSensitivity = 0;
  }
  return scenario;
}

describe("release delay scenario", () => {
  it("distinguishes zero-inventory delay from a low-inventory same-day launch", () => {
    const delayed = createReleaseScenario(0);
    const launched = createReleaseScenario(1);

    const delayedResult = simulateDay(
      delayed.world,
      [
        {
          type: "ANNOUNCE_RELEASE",
          productId: launchBoosterProductId,
          releaseDay: delayed.world.day,
        },
      ],
      delayed.balanceConfig,
    );
    const launchedResult = simulateDay(
      launched.world,
      [
        {
          type: "ANNOUNCE_RELEASE",
          productId: launchBoosterProductId,
          releaseDay: launched.world.day,
        },
      ],
      launched.balanceConfig,
    );

    expect(
      delayedResult.nextState.products[launchBoosterProductId]!.releaseStatus,
    ).toBe("DELAYED");
    expect(delayedResult.report.unitsSold).toBe(0);
    expect(delayedResult.notableEvents).toContainEqual(
      expect.objectContaining({ type: "RELEASE_DELAY" }),
    );

    expect(
      launchedResult.nextState.products[launchBoosterProductId]!.releaseStatus,
    ).toBe("LIVE");
    expect(launchedResult.report.unitsSold).toBe(1);
    expect(launchedResult.notableEvents).toContainEqual(
      expect.objectContaining({ type: "SHORT_SUPPLY_LAUNCH" }),
    );
  });
});
