import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import { playerId, type PrintingId } from "@tcgtycoon/domain";
import { openBooster, resolvePrimarySales } from "@tcgtycoon/sim-core";
import { DeterministicRng, deriveSeed } from "@tcgtycoon/rules-engine";
import { createBalancedWorld, type WorldScenario } from "./balanced-world";
import { launchBoosterProductId } from "./product-fixtures";

function isPremium(printingId: string): boolean {
  return (
    printingId.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.foil) ||
    printingId.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.altArt)
  );
}

export function createCollectorBubbleWorld(
  seed = "collector-bubble-world",
): WorldScenario {
  const scenario = createBalancedWorld(seed);
  const seller = scenario.world.players[playerId("player-0001")]!;
  const collector = scenario.world.players[playerId("player-0002")]!;
  collector.motivation.collector = 1;
  collector.motivation.whale = 1;
  collector.tcgWallet = 2_000;

  const sale = resolvePrimarySales(
    scenario.world,
    [{ buyerId: seller.id, productId: launchBoosterProductId, quantity: 20 }],
    new DeterministicRng(deriveSeed([seed, "collector-product-sale"])),
  );
  const opened: PrintingId[] = [];
  for (let index = 0; index < sale.unitsSold; index += 1) {
    opened.push(
      ...openBooster(
        scenario.world,
        launchBoosterProductId,
        seller.id,
        new DeterministicRng(deriveSeed([seed, "collector-opening", index])),
      ).printingIds,
    );
  }
  const bubblePrinting = opened.find(isPremium) ?? opened[0];
  if (bubblePrinting === undefined) {
    throw new Error("Collector bubble scenario requires an opened card.");
  }
  scenario.world.market.listings.push({
    ownerId: seller.id,
    printingId: bubblePrinting,
    quantity: 1,
    price: 120,
  });

  return {
    ...scenario,
    name: "collector-bubble-world",
    purpose:
      "A product-opened collectible is listed at a speculative price for a whale collector.",
    metricState: { ...scenario.metricState, collectorHeat: 90 },
  };
}
