import {
  cardId,
  expansionId,
  factionId,
  printingId,
  productId,
  type CardDefinition,
  type CardId,
  type PersistentPlayer,
  type WorldState,
} from "@tcgtycoon/domain";
import { DeterministicRng, validateDeck } from "@tcgtycoon/rules-engine";
import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "../population/create-population";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { recordKnowledgeExposure } from "../society/knowledge";
import { generateCandidateDecks, mutateDeck } from "./deck-builder";
import { toDeckDefinition } from "./deck-genome";

function createUnit(
  id: string,
  faction: "fire" | "machine" | "neutral",
  power = 1,
): CardDefinition {
  return {
    id: cardId(id),
    name: id,
    type: "UNIT",
    factionId: factionId(faction),
    rarity: "COMMON",
    cost: 1,
    attack: power,
    health: power,
    keywords: [],
    triggers: [],
  };
}

function createDeckBuilderWorld(): {
  world: WorldState;
  player: PersistentPlayer;
  unownedCardId: CardId;
} {
  const fireCards = Array.from({ length: 12 }, (_, index) =>
    createUnit(`card-fire-builder-${index + 1}`, "fire", index + 1),
  );
  const machineCards = Array.from({ length: 12 }, (_, index) =>
    createUnit(`card-machine-builder-${index + 1}`, "machine", index + 1),
  );
  const neutralCards = Array.from({ length: 2 }, (_, index) =>
    createUnit(`card-neutral-builder-${index + 1}`, "neutral", 2),
  );
  const unownedCard = createUnit("card-fire-unowned-power", "fire", 100);
  const cards = [...fireCards, ...machineCards, ...neutralCards, unownedCard];
  const ownedCards = cards.filter((card) => card.id !== unownedCard.id);
  const population = createInitialPopulation("deck-builder-test");
  const sourceProductId = productId("product-deck-builder");
  const player = population.players["player-0001"]!;
  const printings = ownedCards.map((card) => ({
    id: printingId(`printing-${card.id}-normal`),
    cardId: card.id,
    expansionId: expansionId("set-deck-builder"),
    edition: "FIRST_EDITION" as const,
    sourceProductId,
    sourceExpansionId: expansionId("set-deck-builder"),
  }));
  for (const printing of printings) {
    player.collection[printing.id] = 2;
  }

  return {
    player,
    unownedCardId: unownedCard.id,
    world: {
      schemaVersion: 4,
      simulationVersion: "1",
      ruleVersion: "1",
      balanceVersion: "1",
      worldSeed: "deck-builder-test",
      day: 4,
      status: "LIVE",
      cards: Object.fromEntries(cards.map((card) => [card.id, card])),
      printings: Object.fromEntries(
        printings.map((printing) => [printing.id, printing]),
      ),
      expansions: {
        "set-deck-builder": {
          id: expansionId("set-deck-builder"),
          name: "Deck Builder Set",
        },
      },
      products: {
        [sourceProductId]: {
          id: sourceProductId,
          expansionId: expansionId("set-deck-builder"),
          name: "Deck Builder Booster",
          kind: "BOOSTER",
          msrp: 5,
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

function ownedCopiesByCard(
  player: PersistentPlayer,
  world: WorldState,
  targetCardId: CardId,
): number {
  return Object.entries(player.collection).reduce(
    (total, [printingId, quantity]) =>
      world.printings[printingId]?.cardId === targetCardId
        ? total + quantity
        : total,
    0,
  );
}

describe("generateCandidateDecks", () => {
  it("never places an unowned live-world card in a player deck", () => {
    const { player, unownedCardId, world } = createDeckBuilderWorld();

    const candidates = generateCandidateDecks(
      player,
      world,
      new DeterministicRng(11n),
    );

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.cards).not.toContainEqual(
        expect.objectContaining({ cardId: unownedCardId }),
      );
      for (const entry of candidate.cards) {
        expect(
          ownedCopiesByCard(player, world, entry.cardId),
        ).toBeGreaterThanOrEqual(entry.count);
      }
    }
  });

  it("never mixes two non-neutral factions and produces legal 20-card decks", () => {
    const { player, world } = createDeckBuilderWorld();

    const candidates = generateCandidateDecks(
      player,
      world,
      new DeterministicRng(12n),
    );

    for (const candidate of candidates) {
      const factions = new Set(
        candidate.cards
          .map((entry) => world.cards[entry.cardId]!.factionId)
          .filter((id) => id !== "neutral"),
      );
      expect([...factions]).toEqual([candidate.factionId]);
      expect(
        candidate.cards.reduce((total, entry) => total + entry.count, 0),
      ).toBe(20);
      expect(
        validateDeck(toDeckDefinition(candidate), Object.values(world.cards))
          .valid,
      ).toBe(true);
    }
  });

  it("mutates only a small bounded number of entries", () => {
    const { player, world } = createDeckBuilderWorld();
    const parent = generateCandidateDecks(
      player,
      world,
      new DeterministicRng(13n),
    )[0]!;

    const child = mutateDeck(parent, player, world, new DeterministicRng(14n));
    const parentCounts = new Map(
      parent.cards.map((entry) => [entry.cardId, entry.count]),
    );
    const childCounts = new Map(
      child.cards.map((entry) => [entry.cardId, entry.count]),
    );
    const changedEntries = new Set([
      ...parentCounts.keys(),
      ...childCounts.keys(),
    ]).size;
    const unchangedEntries = [...parentCounts].filter(
      ([id, count]) => childCounts.get(id) === count,
    ).length;

    expect(changedEntries - unchangedEntries).toBeGreaterThan(0);
    expect(changedEntries - unchangedEntries).toBeLessThanOrEqual(2);
    expect(child.parentDeckIds).toEqual([parent.id]);
    expect(child.generation).toBe(parent.generation + 1);
  });

  it("learns only owned cards or explicitly exposed knowledge", () => {
    const { player, unownedCardId, world } = createDeckBuilderWorld();

    generateCandidateDecks(player, world, new DeterministicRng(15n));
    expect(player.knowledge.knownCardIds).not.toContain(unownedCardId);

    recordKnowledgeExposure(player, {
      source: "MATCH",
      cardIds: [unownedCardId],
      deckIds: [],
    });
    expect(player.knowledge.knownCardIds).toContain(unownedCardId);
  });
});
