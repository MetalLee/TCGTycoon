import {
  type DeckCardEntry,
  type DeckDefinition,
  type DeckGenome,
  type DeckId,
  type StrategyVector,
} from "@tcgtycoon/domain";

export type { DeckGenome } from "@tcgtycoon/domain";

export function toDeckDefinition(genome: DeckGenome): DeckDefinition {
  return {
    id: genome.id,
    name: genome.id,
    factionId: genome.factionId,
    cards: genome.cards.map((entry) => ({ ...entry })),
  };
}

export function createChildGenome(
  parent: DeckGenome,
  id: DeckId,
  cards: readonly DeckCardEntry[],
  strategy: StrategyVector,
  createdDay: number,
): DeckGenome {
  return {
    id,
    factionId: parent.factionId,
    cards: cards.map((entry) => ({ ...entry })),
    strategy: { ...strategy },
    originPlayerId: parent.originPlayerId,
    parentDeckIds: [parent.id],
    generation: parent.generation + 1,
    createdDay,
  };
}
