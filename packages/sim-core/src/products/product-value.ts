import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  type CardId,
  type PrintingId,
  type ProductId,
  type Rarity,
  type WorldState,
} from "@tcgtycoon/domain";

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function printingReferenceValue(
  world: WorldState,
  printingId: PrintingId,
): number | undefined {
  const prices = [
    world.market.snapshots[printingId]?.lastPrice,
    ...world.market.listings
      .filter((listing) => listing.printingId === printingId)
      .map((listing) => listing.price),
  ].filter(
    (price): price is number =>
      typeof price === "number" && Number.isFinite(price) && price >= 0,
  );
  return prices.length === 0 ? undefined : Math.min(...prices);
}

function cardReferenceValue(
  world: WorldState,
  cardId: CardId,
  productId: ProductId,
): number {
  const productPrintingIds = Object.values(world.printings)
    .filter(
      (printing) =>
        printing.cardId === cardId &&
        printing.sourceProductId === productId &&
        printing.id.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.normal),
    )
    .map((printing) => printing.id);
  const allNormalPrintingIds = Object.values(world.printings)
    .filter(
      (printing) =>
        printing.cardId === cardId &&
        printing.id.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.normal),
    )
    .map((printing) => printing.id);
  const values = productPrintingIds
    .map((id) => printingReferenceValue(world, id))
    .filter((value): value is number => value !== undefined);
  const fallbackValues = allNormalPrintingIds
    .map((id) => printingReferenceValue(world, id))
    .filter((value): value is number => value !== undefined);
  const available = values.length > 0 ? values : fallbackValues;
  return available.length === 0 ? 0 : Math.min(...available);
}

function averageRarityValue(
  world: WorldState,
  cardIds: readonly CardId[],
  rarity: Rarity,
  productId: ProductId,
): number {
  return average(
    cardIds
      .filter((id) => world.cards[id]?.rarity === rarity)
      .map((id) => cardReferenceValue(world, id, productId)),
  );
}

export function calculateProductExpectedValue(
  world: WorldState,
  productId: ProductId,
  starterContents?: readonly PrintingId[],
): number {
  const product = world.products[productId];
  if (product === undefined) {
    throw new Error(`Unknown product ${productId}`);
  }
  const cardIds = [...new Set(product.cardIds)];
  if (product.kind === "STARTER") {
    if (starterContents !== undefined) {
      return starterContents.reduce((total, printingId) => {
        const printing = world.printings[printingId];
        if (printing === undefined) {
          throw new Error(`Starter references unknown Printing ${printingId}`);
        }
        return (
          total +
          (printingReferenceValue(world, printingId) ??
            cardReferenceValue(world, printing.cardId, product.id))
        );
      }, 0);
    }
    return cardIds.reduce(
      (total, id) => total + cardReferenceValue(world, id, product.id),
      0,
    );
  }

  const commonValue = averageRarityValue(world, cardIds, "COMMON", product.id);
  const uncommonValue = averageRarityValue(
    world,
    cardIds,
    "UNCOMMON",
    product.id,
  );
  const rareValue = averageRarityValue(world, cardIds, "RARE", product.id);
  const legendaryValue = averageRarityValue(
    world,
    cardIds,
    "LEGENDARY",
    product.id,
  );
  const hasRare = cardIds.some((id) => world.cards[id]?.rarity === "RARE");
  const hasLegendary = cardIds.some(
    (id) => world.cards[id]?.rarity === "LEGENDARY",
  );
  const rarePlusRareValue = hasRare ? rareValue : legendaryValue;
  const rarePlusLegendaryValue = hasLegendary ? legendaryValue : rareValue;
  return (
    commonValue * ECONOMY_CONFIG.booster.commonSlots +
    uncommonValue * ECONOMY_CONFIG.booster.uncommonSlots +
    (rarePlusRareValue *
      (1 - ECONOMY_CONFIG.booster.legendaryChanceInRarePlus) +
      rarePlusLegendaryValue *
        ECONOMY_CONFIG.booster.legendaryChanceInRarePlus) *
      ECONOMY_CONFIG.booster.rarePlusSlots
  );
}
