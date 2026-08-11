import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  type PersistentPlayer,
  type PlayerId,
  type Printing,
  type PrintingId,
  type ProductId,
  type Rarity,
  type WorldState,
} from "@tcgtycoon/domain";
import type { DeterministicRng } from "@tcgtycoon/rules-engine";

type PrintingVariant = "NORMAL" | "FOIL" | "ALT_ART";

export type PhysicalCardOwner = Pick<PersistentPlayer, "collection">;
export type ProductOwner = PlayerId | PhysicalCardOwner;

export type ProductOpenResult = {
  printingIds: PrintingId[];
  baseRarities: Rarity[];
  ownershipDeltas: Record<PrintingId, number>;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function resolveOwner(
  world: WorldState,
  owner: ProductOwner,
): PhysicalCardOwner {
  if (typeof owner !== "string") {
    return owner;
  }

  const player = world.players[owner];
  if (player === undefined) {
    throw new Error(`Unknown product owner: ${owner}`);
  }
  return player;
}

function printingVariant(printing: Printing): PrintingVariant {
  if (printing.id.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.altArt)) {
    return "ALT_ART";
  }
  if (printing.id.endsWith(ECONOMY_CONFIG.printingVariantSuffixes.foil)) {
    return "FOIL";
  }
  return "NORMAL";
}

function productPrintings(
  world: WorldState,
  productId: ProductId,
  expectedKind: "BOOSTER" | "STARTER",
): Printing[] {
  const product = world.products[productId];
  if (product === undefined) {
    throw new Error(`Unknown product: ${productId}`);
  }
  if (product.kind !== expectedKind) {
    throw new Error(`Product ${productId} is not a ${expectedKind}`);
  }

  return Object.values(world.printings)
    .filter((printing) => printing.expansionId === product.expansionId)
    .sort((left, right) => compareIds(left.id, right.id));
}

function cardRarity(world: WorldState, printing: Printing): Rarity {
  const card = world.cards[printing.cardId];
  if (card === undefined) {
    throw new Error(`Printing ${printing.id} references a missing card`);
  }
  return card.rarity;
}

function choosePrinting(
  pool: readonly Printing[],
  rng: DeterministicRng,
  slot: string,
): Printing {
  if (pool.length === 0) {
    throw new Error(`Product has no eligible Printing for ${slot}`);
  }
  return pool[rng.nextInt(pool.length)]!;
}

function buildOwnershipDeltas(
  printingIds: readonly PrintingId[],
): Record<PrintingId, number> {
  const deltas: Record<PrintingId, number> = {};
  for (const id of printingIds) {
    deltas[id] = (deltas[id] ?? 0) + 1;
  }
  return deltas;
}

function applyOwnershipDeltas(
  owner: PhysicalCardOwner,
  deltas: Readonly<Record<PrintingId, number>>,
): void {
  for (const id of Object.keys(deltas).sort(compareIds) as PrintingId[]) {
    owner.collection[id] = (owner.collection[id] ?? 0) + deltas[id]!;
  }
}

function findVariant(
  printings: readonly Printing[],
  base: Printing,
  variant: Exclude<PrintingVariant, "NORMAL">,
): Printing | undefined {
  return printings.find(
    (printing) =>
      printing.cardId === base.cardId && printingVariant(printing) === variant,
  );
}

function applyBoosterUpgrade(
  selected: Printing[],
  printings: readonly Printing[],
  rng: DeterministicRng,
): void {
  const roll = rng.nextFloat();
  const altArtThreshold = ECONOMY_CONFIG.booster.altArtUpgradeChance;
  const foilThreshold =
    altArtThreshold + ECONOMY_CONFIG.booster.foilUpgradeChance;
  const variant =
    roll < altArtThreshold
      ? "ALT_ART"
      : roll < foilThreshold
        ? "FOIL"
        : undefined;
  if (variant === undefined) {
    return;
  }

  const eligible = selected.flatMap((base, index) => {
    const upgrade = findVariant(printings, base, variant);
    return upgrade === undefined ? [] : [{ index, upgrade }];
  });
  if (eligible.length === 0) {
    return;
  }

  const replacement = eligible[rng.nextInt(eligible.length)]!;
  selected[replacement.index] = replacement.upgrade;
}

export function openBooster(
  world: WorldState,
  productId: ProductId,
  owner: ProductOwner,
  rng: DeterministicRng,
): ProductOpenResult {
  const printings = productPrintings(world, productId, "BOOSTER");
  const normalPrintings = printings.filter(
    (printing) => printingVariant(printing) === "NORMAL",
  );
  const byRarity = (rarity: Rarity) =>
    normalPrintings.filter(
      (printing) => cardRarity(world, printing) === rarity,
    );
  const selected: Printing[] = [];
  const baseRarities: Rarity[] = [];

  for (let slot = 0; slot < ECONOMY_CONFIG.booster.commonSlots; slot += 1) {
    selected.push(choosePrinting(byRarity("COMMON"), rng, "COMMON"));
    baseRarities.push("COMMON");
  }
  for (let slot = 0; slot < ECONOMY_CONFIG.booster.uncommonSlots; slot += 1) {
    selected.push(choosePrinting(byRarity("UNCOMMON"), rng, "UNCOMMON"));
    baseRarities.push("UNCOMMON");
  }
  for (let slot = 0; slot < ECONOMY_CONFIG.booster.rarePlusSlots; slot += 1) {
    const legendary =
      rng.nextFloat() < ECONOMY_CONFIG.booster.legendaryChanceInRarePlus;
    const requestedRarity: Rarity = legendary ? "LEGENDARY" : "RARE";
    const fallbackRarity: Rarity = legendary ? "RARE" : "LEGENDARY";
    const requestedPool = byRarity(requestedRarity);
    const chosenRarity =
      requestedPool.length > 0 ? requestedRarity : fallbackRarity;
    selected.push(
      choosePrinting(byRarity(chosenRarity), rng, `${chosenRarity} rare+`),
    );
    baseRarities.push(chosenRarity);
  }

  if (selected.length !== ECONOMY_CONFIG.booster.cardsPerPack) {
    throw new Error(
      "Booster slot configuration must produce exactly five cards",
    );
  }

  applyBoosterUpgrade(selected, printings, rng);
  const printingIds = selected.map((printing) => printing.id);
  const ownershipDeltas = buildOwnershipDeltas(printingIds);
  applyOwnershipDeltas(resolveOwner(world, owner), ownershipDeltas);

  return { printingIds, baseRarities, ownershipDeltas };
}

export function openStarter(
  world: WorldState,
  productId: ProductId,
  owner: ProductOwner,
  listedPrintingIds: readonly PrintingId[],
): ProductOpenResult {
  const printings = productPrintings(world, productId, "STARTER");
  if (listedPrintingIds.length !== ECONOMY_CONFIG.starter.cardsPerProduct) {
    throw new Error("Starter products must list exactly 20 physical Printings");
  }

  const includedById = new Map(
    printings.map((printing) => [printing.id, printing] as const),
  );
  const listedPrintings = listedPrintingIds.map((id) => {
    const printing = includedById.get(id);
    if (printing === undefined) {
      throw new Error(
        `Starter lists a Printing outside its product set: ${id}`,
      );
    }
    return printing;
  });
  const printingIds = listedPrintings.map((printing) => printing.id);
  const baseRarities = listedPrintings.map((printing) =>
    cardRarity(world, printing),
  );
  const ownershipDeltas = buildOwnershipDeltas(printingIds);
  applyOwnershipDeltas(resolveOwner(world, owner), ownershipDeltas);

  return { printingIds, baseRarities, ownershipDeltas };
}

export function countWorldSupply(
  world: WorldState,
  printingId: PrintingId,
): number {
  let supply = 0;
  for (const playerId of Object.keys(world.players).sort(compareIds)) {
    supply += world.players[playerId]!.collection[printingId] ?? 0;
  }

  // Market listings reference quantities already held in seller collections, so
  // adding them again would double count physical supply. Publisher inventory
  // and cohort holdings are not yet fields in the current WorldState schema.
  return supply;
}
