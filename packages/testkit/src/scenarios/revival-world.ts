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
  scenario.world.metrics.previousActivePlayers = 1;
  scenario.world.metrics.lifecycle = {
    potential: 0,
    interested: 0,
    newByAge: [0, 0, 0, 0, 0, 0, 0],
    active: 0,
    atRisk: 1,
    churned: 1,
    returning: 0,
  };
  scenario.world.metrics.hype = 30;
  scenario.world.metrics.collectorHeat = 35;
  scenario.world.metrics.metaHealth = 65;
  scenario.world.metrics.brandTrust = 55;
  scenario.world.metrics.sentiment = 60;

  return {
    ...scenario,
    name: "revival-world",
    purpose:
      "Healthy stock and cash surround a small lapsed audience for future recovery checks.",
  };
}
