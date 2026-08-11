import {
  cardId,
  expansionId,
  factionId,
  printingId,
  productId,
  type CardDefinition,
  type Printing,
  type Rarity,
  type WorldState,
} from "@tcgtycoon/domain";
import { DeterministicRng } from "@tcgtycoon/rules-engine";
import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "../population/create-population";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { countWorldSupply, openBooster, openStarter } from "./open-product";

const launchExpansionId = expansionId("set-product-test");
const boosterProductId = productId("product-test-booster");
const starterProductId = productId("product-test-starter");

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createCard(index: number, rarity: Rarity): CardDefinition {
  return {
    id: cardId(`card-product-${index}`),
    name: `Product Card ${index}`,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity,
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    triggers: [],
  };
}

function createProductWorld(): {
  world: WorldState;
  owner: WorldState["players"][string];
  starterPrintingIds: ReturnType<typeof printingId>[];
} {
  const cards = [
    createCard(1, "COMMON"),
    createCard(2, "COMMON"),
    createCard(3, "COMMON"),
    createCard(4, "UNCOMMON"),
    createCard(5, "UNCOMMON"),
    createCard(6, "RARE"),
    createCard(7, "RARE"),
    createCard(8, "LEGENDARY"),
  ];
  const boosterPrintings: Printing[] = cards.flatMap((card, index) => {
    const variants =
      index === 0 ? ["normal", "foil", "alt-art"] : ["normal", "foil"];
    return variants.map((variant) => ({
      id: printingId(`printing-${card.id}-${variant}`),
      cardId: card.id,
      expansionId: launchExpansionId,
      edition: "FIRST_EDITION",
      sourceProductId: boosterProductId,
      sourceExpansionId: launchExpansionId,
    }));
  });
  const starterPrintings: Printing[] = cards.map((card) => ({
    id: printingId(`printing-starter-${card.id}-normal`),
    cardId: card.id,
    expansionId: launchExpansionId,
    edition: "FIRST_EDITION",
    sourceProductId: starterProductId,
    sourceExpansionId: launchExpansionId,
  }));
  const printings = [...boosterPrintings, ...starterPrintings];
  const population = createInitialPopulation("product-test");
  const owner = population.players["player-0001"]!;
  const normalPrintingIds = printings
    .filter(
      (printing) =>
        printing.sourceProductId === starterProductId &&
        printing.id.endsWith("-normal"),
    )
    .map((printing) => printing.id)
    .sort(compareIds);
  const starterPrintingIds = Array.from(
    { length: 20 },
    (_, index) => normalPrintingIds[index % normalPrintingIds.length]!,
  );

  return {
    owner,
    starterPrintingIds,
    world: {
      schemaVersion: 5,
      simulationVersion: "1",
      ruleVersion: "1",
      balanceVersion: "1",
      worldSeed: "product-test",
      day: 0,
      status: "SETUP",
      cards: Object.fromEntries(cards.map((card) => [card.id, card])),
      printings: Object.fromEntries(
        printings.map((printing) => [printing.id, printing]),
      ),
      expansions: {
        [launchExpansionId]: {
          id: launchExpansionId,
          name: "Product Test Set",
        },
      },
      products: {
        [boosterProductId]: {
          id: boosterProductId,
          expansionId: launchExpansionId,
          name: "Product Test Booster",
          kind: "BOOSTER",
          msrp: 5,
          cardIds: cards.map((card) => card.id),
          releaseStatus: "LIVE",
          internalReleaseDay: 0,
          releasedDay: 0,
        },
        [starterProductId]: {
          id: starterProductId,
          expansionId: launchExpansionId,
          name: "Product Test Starter",
          kind: "STARTER",
          msrp: 15,
          cardIds: cards.map((card) => card.id),
          releaseStatus: "LIVE",
          internalReleaseDay: 0,
          releasedDay: 0,
        },
      },
      printRuns: {},
      players: population.players,
      agents: population.agents,
      decks: {},
      cohorts: population.cohorts,
      market: { listings: [], snapshots: {} },
      meta: { deckStats: {}, matchups: {} },
      metrics: createInitialWorldMetrics({
        potential: 0,
        interested: 0,
        newByAge: [0, 0, 0, 0, 0, 0, 0],
        active: 0,
        atRisk: 0,
        churned: 0,
        returning: 0,
      }),
      cash: { balance: 0, ledger: [] },
      history: { events: [] },
    },
  };
}

function openTestBooster(seed: bigint) {
  const { owner, world } = createProductWorld();
  return openBooster(
    world,
    boosterProductId,
    owner,
    new DeterministicRng(seed),
  );
}

describe("physical product opening", () => {
  it("opens exactly five physical cards", () => {
    const result = openTestBooster(123n);

    expect(result.printingIds).toHaveLength(5);
    expect(Object.values(result.ownershipDeltas)).toSatisfy(
      (quantities: number[]) =>
        quantities.reduce((total, quantity) => total + quantity, 0) === 5,
    );
  });

  it("uses 3 Common, 1 Uncommon and 1 Rare+ base slots", () => {
    const result = openTestBooster(321n);

    expect(result.baseRarities).toEqual([
      "COMMON",
      "COMMON",
      "COMMON",
      "UNCOMMON",
      expect.stringMatching(/RARE|LEGENDARY/),
    ]);
  });

  it("replaces a selected Printing for Foil and Alt-Art upgrades", () => {
    const foilResult = openTestBooster(11n);
    const altArtResult = openTestBooster(14n);

    expect(foilResult.printingIds).toHaveLength(5);
    expect(foilResult.printingIds.some((id) => id.endsWith("-foil"))).toBe(
      true,
    );
    expect(altArtResult.printingIds).toHaveLength(5);
    expect(
      altArtResult.printingIds.includes(
        printingId("printing-card-product-1-alt-art"),
      ),
    ).toBe(true);
  });

  it("opens the Starter's listed 20 physical Printings into the collection", () => {
    const { owner, starterPrintingIds, world } = createProductWorld();

    const result = openStarter(
      world,
      starterProductId,
      owner,
      starterPrintingIds,
    );

    expect(result.printingIds).toEqual(starterPrintingIds);
    expect(result.printingIds).toHaveLength(20);
    expect(
      Object.values(owner.collection).reduce(
        (total, quantity) => total + quantity,
        0,
      ),
    ).toBe(20);
  });

  it("counts listed seller cards once because listings reference owner holdings", () => {
    const { owner, starterPrintingIds, world } = createProductWorld();
    openStarter(world, starterProductId, owner, starterPrintingIds);
    const listedPrintingId = starterPrintingIds[0]!;
    world.market.listings.push({
      ownerId: owner.id,
      printingId: listedPrintingId,
      quantity: 1,
      price: 3,
    });

    expect(countWorldSupply(world, listedPrintingId)).toBe(
      owner.collection[listedPrintingId],
    );
  });
});
