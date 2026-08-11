import type { WorldState } from "../../packages/domain/src/index";
import { simulateDay } from "../../packages/sim-core/src/index";
import { createBalancedWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

function createSupplyWorld(quantity: number) {
  const scenario = createBalancedWorld(`shortage-${quantity}`);
  for (const run of Object.values(scenario.world.printRuns)) {
    run.quantity = quantity;
    run.orderedQuantity = Math.max(run.orderedQuantity, quantity);
  }
  for (const player of Object.values(scenario.world.players)) {
    player.activity = "ACTIVE";
    player.tcgWallet = 1_000;
    player.motivation.competitive = 1;
    player.motivation.collector = 1;
    player.motivation.brewer = 1;
    player.motivation.casual = 1;
    player.motivation.budgetSensitivity = 0;
  }
  scenario.world.metrics.lifecycle = {
    potential: 198,
    interested: 200,
    newByAge: [0, 0, 0, 0, 0, 0, 0],
    active: 2,
    atRisk: 0,
    churned: 0,
    returning: 0,
  };
  return scenario;
}

function simulateShortage(quantity: number, days: number) {
  const scenario = createSupplyWorld(quantity);
  let world: WorldState = scenario.world;
  let conversions = 0;
  let firstDayCollectorHeat = world.metrics.collectorHeat;
  for (let day = 0; day < days; day += 1) {
    const result = simulateDay(world, [], scenario.balanceConfig);
    world = result.nextState;
    conversions += world.metrics.lifecycleDeltas.interestedToNew;
    if (day === 0) {
      firstDayCollectorHeat = world.metrics.collectorHeat;
    }
  }
  return { conversions, firstDayCollectorHeat, world };
}

describe("prolonged product shortage", () => {
  it("turns initial scarcity attention into lower accessibility and new-player conversion", () => {
    const shortage = simulateShortage(1, 10);
    const stocked = simulateShortage(500, 10);

    expect(shortage.firstDayCollectorHeat).toBeGreaterThanOrEqual(
      stocked.firstDayCollectorHeat,
    );
    expect(shortage.world.metrics.accessibility).toBeLessThan(
      stocked.world.metrics.accessibility,
    );
    expect(shortage.conversions).toBeLessThan(stocked.conversions);
  });
});
