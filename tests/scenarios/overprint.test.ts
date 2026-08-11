import { printRunId, type WorldState } from "../../packages/domain/src/index";
import {
  advancePrintRuns,
  orderPrintRun,
  simulateDay,
} from "../../packages/sim-core/src/index";
import {
  createBalancedWorld,
  launchBoosterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

function inventoryCost(world: WorldState): number {
  return Math.abs(
    world.cash.ledger
      .filter((entry) => entry.category === "INVENTORY_COST")
      .reduce((total, entry) => total + entry.amount, 0),
  );
}

function runPrintQuantity(quantity: number) {
  const scenario = createBalancedWorld(`overprint-${quantity}`);
  const world = scenario.world;
  world.cash = { balance: 100_000, ledger: [] };
  world.printRuns = {};
  for (const player of Object.values(world.players)) {
    player.activity = "CHURNED";
  }
  const run = orderPrintRun(
    world,
    {
      id: printRunId(`print-run-overprint-${quantity}`),
      productId: launchBoosterProductId,
      quantity,
    },
    scenario.balanceConfig.production,
  );
  const cashAfterOrder = world.cash.balance;
  advancePrintRuns(world, run.completionDay);
  world.day = run.completionDay;
  const result = simulateDay(world, [], {
    ...scenario.balanceConfig,
    dailyOperatingCost: 0,
    inventoryHoldingCostPerUnit: 0.25,
  });
  return {
    cashAfterOrder,
    nextState: result.nextState,
    unsoldInventory: result.nextState.printRuns[run.id]!.quantity,
  };
}

describe("overprinting", () => {
  it("makes a 10x order consume more cash and leave more costly unsold inventory", () => {
    const control = runPrintQuantity(20);
    const overprint = runPrintQuantity(200);

    expect(overprint.cashAfterOrder).toBeLessThan(control.cashAfterOrder);
    expect(overprint.unsoldInventory).toBeGreaterThan(control.unsoldInventory);
    expect(inventoryCost(overprint.nextState)).toBeGreaterThan(
      inventoryCost(control.nextState),
    );
  });
});
