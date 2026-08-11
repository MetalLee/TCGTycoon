import { playerId } from "@tcgtycoon/domain";
import { createBalancedWorld, type WorldScenario } from "./balanced-world";

export function createRevivalWorld(seed = "revival-world"): WorldScenario {
  const scenario = createBalancedWorld(seed);
  const returning = scenario.world.players[playerId("player-0001")]!;
  const fragile = scenario.world.players[playerId("player-0002")]!;
  returning.activity = "CHURNED";
  returning.satisfaction = 0.75;
  fragile.activity = "AT_RISK";
  fragile.satisfaction = 0.65;
  scenario.world.metrics.activePlayers = 1;

  return {
    ...scenario,
    name: "revival-world",
    purpose:
      "Healthy stock and cash surround a small lapsed audience for future recovery checks.",
    metricState: {
      hype: 30,
      collectorHeat: 35,
      metaHealth: 65,
      brandTrust: 55,
      sentiment: 60,
    },
  };
}
