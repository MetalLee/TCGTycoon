import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  playerId,
  printingId,
  productId,
  type CardDefinition,
  type ExpansionId,
  type Printing,
  type PrintingId,
  type Rarity,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  openBooster,
  openStarter,
  type ProductOpenResult,
} from "@tcgtycoon/sim-core";
import { DeterministicRng } from "@tcgtycoon/rules-engine";
import { coreCardFixtures } from "../cards/core-fixtures";
import { fireFixtureDeck } from "../decks/core-fixtures";
import { createTestWorld } from "../worlds/create-test-world";

export const launchBoosterProductId = productId("product-launch-booster");
export const launchFireStarterProductId = productId(
  "product-launch-starter-fire",
);

const rarityCounts = [
  { rarity: "COMMON", count: 10 },
  { rarity: "UNCOMMON", count: 6 },
  { rarity: "RARE", count: 6 },
  { rarity: "LEGENDARY", count: 2 },
] as const satisfies readonly { rarity: Rarity; count: number }[];

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fixtureRarities(): Rarity[] {
  return rarityCounts.flatMap(({ rarity, count }) =>
    Array.from({ length: count }, () => rarity),
  );
}

function launchCards(): CardDefinition[] {
  const rarities = fixtureRarities();
  return [...coreCardFixtures]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((card, index) => ({ ...card, rarity: rarities[index]! }));
}

function launchPrintings(
  cards: readonly CardDefinition[],
  expansionId: ExpansionId,
): Printing[] {
  return cards.flatMap((card, index) => {
    const prefix = `printing-${card.id}`;
    const normal: Printing = {
      id: printingId(
        `${prefix}${ECONOMY_CONFIG.printingVariantSuffixes.normal}`,
      ),
      cardId: card.id,
      expansionId,
    };
    const variants: Printing[] = [
      { ...normal, expansionId },
      {
        id: printingId(
          `${prefix}${ECONOMY_CONFIG.printingVariantSuffixes.foil}`,
        ),
        cardId: card.id,
        expansionId,
      },
    ];
    if (index < 8) {
      variants.push({
        id: printingId(
          `${prefix}${ECONOMY_CONFIG.printingVariantSuffixes.altArt}`,
        ),
        cardId: card.id,
        expansionId,
      });
    }
    return variants;
  });
}

function normalPrintingId(cardId: string): PrintingId {
  return printingId(
    `printing-${cardId}${ECONOMY_CONFIG.printingVariantSuffixes.normal}`,
  );
}

export type ProductFixture = {
  world: WorldState;
  owner: WorldState["players"][string];
  starterPrintingIds: PrintingId[];
};

export function createProductFixtureWorld(
  seed = "product-fixture",
): ProductFixture {
  const world = createTestWorld(seed);
  const cards = launchCards();
  const expansionId = world.products[launchBoosterProductId]!.expansionId;
  const printings = launchPrintings(cards, expansionId);
  world.cards = Object.fromEntries(cards.map((card) => [card.id, card]));
  world.printings = Object.fromEntries(
    printings.map((printing) => [printing.id, printing]),
  );
  world.products[launchFireStarterProductId] = {
    id: launchFireStarterProductId,
    expansionId: world.products[launchBoosterProductId]!.expansionId,
    name: "Launch Fire Starter",
    kind: "STARTER",
    msrp: 15,
  };

  const starterPrintingIds = fireFixtureDeck.cards.flatMap(
    ({ cardId, count }) =>
      Array.from({ length: count }, () => normalPrintingId(cardId)),
  );
  const owner = world.players[playerId("player-0001")]!;
  return { world, owner, starterPrintingIds };
}

export function openLaunchBoosterFixture(seed: bigint): ProductOpenResult {
  const { owner, world } = createProductFixtureWorld();
  return openBooster(
    world,
    launchBoosterProductId,
    owner,
    new DeterministicRng(seed),
  );
}

export function openLaunchStarterFixture(): ProductOpenResult {
  const { owner, starterPrintingIds, world } = createProductFixtureWorld();
  return openStarter(
    world,
    launchFireStarterProductId,
    owner,
    starterPrintingIds,
  );
}
