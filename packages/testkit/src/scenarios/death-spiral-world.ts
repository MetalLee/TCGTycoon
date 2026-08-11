import { playerId } from "@tcgtycoon/domain";
import { appendCashEntry } from "@tcgtycoon/sim-core";
import { createBalancedWorld, type WorldScenario } from "./balanced-world";

export function createDeathSpiralWorld(
  seed = "death-spiral-world",
): WorldScenario {
  const scenario = createBalancedWorld(seed);
  for (const id of [playerId("player-0001"), playerId("player-0002")]) {
    const player = scenario.world.players[id]!;
    player.activity = "CHURNED";
    player.satisfaction = 0.05;
  }
  scenario.world.metrics.activePlayers = 0;
  appendCashEntry(scenario.world.cash, {
    day: scenario.world.day,
    category: "OPERATING_COST",
    amount: -scenario.world.cash.balance - 10_001,
  });

  return {
    ...scenario,
    name: "death-spiral-world",
    purpose:
      "An insolvent, fully churned world exercises terminal risk and atomic stop behavior.",
    metricState: {
      hype: 10,
      collectorHeat: 5,
      metaHealth: 10,
      brandTrust: 10,
      sentiment: 5,
    },
  };
}
