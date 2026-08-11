import { cardId } from "@tcgtycoon/domain";
import { createBalancedWorld, type WorldScenario } from "./balanced-world";

export function createBrokenComboWorld(
  seed = "broken-combo-world",
): WorldScenario {
  const scenario = createBalancedWorld(seed);
  const comboCard = scenario.world.cards[cardId("card-fire-cub")];
  if (comboCard === undefined || comboCard.type !== "UNIT") {
    throw new Error("Broken combo scenario requires the Fire Cub unit.");
  }
  scenario.world.cards[comboCard.id] = {
    ...comboCard,
    attack: comboCard.attack + 5,
    health: comboCard.health + 5,
  };

  return {
    ...scenario,
    name: "broken-combo-world",
    purpose:
      "A legal but overtuned known Fire card stresses observable Meta dominance.",
  };
}
