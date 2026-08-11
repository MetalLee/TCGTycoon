import { describe, expect, it } from "vitest";
import {
  getAvailableProductInventory,
  validateWorldInvariants,
} from "../../packages/sim-core/src/index";
import {
  BasicPublisherBot,
  createScarceRareWorld,
  launchBoosterProductId,
} from "../../packages/testkit/src/index";
import { runSimulation } from "../../scripts/simulate-days";

describe("scarce rare golden scenario", () => {
  it("starts with scarce booster inventory and responds with a reprint", () => {
    const scenario = createScarceRareWorld("scarce-rare-smoke");

    expect(
      getAvailableProductInventory(scenario.world, launchBoosterProductId),
    ).toBeLessThanOrEqual(1);
    expect(
      new BasicPublisherBot(scenario.botConfig)
        .decide(scenario.world)
        .some(
          (command) =>
            command.type === "ORDER_PRINT_RUN" &&
            command.productId === launchBoosterProductId,
        ),
    ).toBe(true);
  });

  it("remains valid during a short headless run", () => {
    const result = runSimulation({
      days: 5,
      seed: "scarce-rare-five-days",
      scenario: "scarce-rare-world",
    });

    expect(Number.isFinite(result.summary.cash)).toBe(true);
    validateWorldInvariants(result.finalState);
  });
});
