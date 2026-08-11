import {
  cardId,
  deckId,
  factionId,
  type CardDefinition,
  type DeckDefinition,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import {
  simulateMatch,
  type BattleStrategy,
  type MatchInput,
} from "./match-engine";

const baselineStrategy: BattleStrategy = {
  aggression: 0.5,
  value: 0.5,
  preservation: 0.5,
};

function fixtureCards(faction: string): CardDefinition[] {
  const id = factionId(faction);
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-${faction}-${index + 1}`),
    name: `${faction} unit ${index + 1}`,
    type: "UNIT" as const,
    factionId: id,
    rarity: "COMMON" as const,
    cost: (index % 4) + 1,
    attack: (index % 3) + 1,
    health: (index % 4) + 2,
    keywords: [],
    triggers: [],
  }));
}

function fixtureDeck(
  faction: string,
  cards: readonly CardDefinition[],
): DeckDefinition {
  return {
    id: deckId(`deck-${faction}-fixture`),
    name: `${faction} fixture`,
    factionId: factionId(faction),
    cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
  };
}

const fireCards = fixtureCards("fire");
const machineCards = fixtureCards("machine");
const fireFixtureDeck = fixtureDeck("fire", fireCards);
const machineFixtureDeck = fixtureDeck("machine", machineCards);
const fixtureCardsById = new Map(
  [...fireCards, ...machineCards].map((card) => [card.id, card]),
);

function fixtureMatchInput(seed: bigint): MatchInput {
  return {
    seed,
    deckA: fireFixtureDeck,
    deckB: machineFixtureDeck,
    cards: fixtureCardsById,
    strategyA: baselineStrategy,
    strategyB: baselineStrategy,
  };
}

describe("simulateMatch", () => {
  it("finishes a match between two simple legal fixture decks", () => {
    const result = simulateMatch(fixtureMatchInput(12345n));

    expect(["A", "B"]).toContain(result.winner);
    expect(result.turns).toBeGreaterThan(0);
    expect(result.turns).toBeLessThan(100);
  });
});
