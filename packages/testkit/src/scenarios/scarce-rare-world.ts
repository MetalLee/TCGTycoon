import { launchBoosterProductId } from "./product-fixtures";
import { createBalancedWorld, type WorldScenario } from "./balanced-world";

export function createScarceRareWorld(
  seed = "scarce-rare-world",
): WorldScenario {
  const scenario = createBalancedWorld(seed);
  for (const run of Object.values(scenario.world.printRuns)) {
    if (run.productId === launchBoosterProductId) {
      run.quantity = 1;
    }
  }

  return {
    ...scenario,
    name: "scarce-rare-world",
    purpose:
      "Near-empty Booster inventory exercises scarcity and deterministic reprints.",
  };
}
