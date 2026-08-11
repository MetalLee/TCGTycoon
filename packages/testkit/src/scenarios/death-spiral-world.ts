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
  scenario.world.metrics.previousActivePlayers = 0;
  scenario.world.metrics.lifecycle = {
    potential: 0,
    interested: 0,
    newByAge: [0, 0, 0, 0, 0, 0, 0],
    active: 0,
    atRisk: 0,
    churned: 2,
    returning: 0,
  };
  scenario.world.metrics.hype = 10;
  scenario.world.metrics.collectorHeat = 5;
  scenario.world.metrics.metaHealth = 10;
  scenario.world.metrics.brandTrust = 10;
  scenario.world.metrics.sentiment = 5;
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
  };
}
