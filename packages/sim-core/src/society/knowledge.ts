import {
  type CardId,
  type DeckId,
  type KnowledgeState,
  type PersistentPlayer,
  type WorldState,
} from "@tcgtycoon/domain";

export type KnowledgeExposure = {
  source: "MATCH" | "PUBLIC_EVENT" | "SOCIAL";
  cardIds: readonly CardId[];
  deckIds: readonly DeckId[];
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mergeIds<T extends string>(
  existing: readonly T[],
  additions: readonly T[],
): T[] {
  return [...new Set([...existing, ...additions])].sort(compareIds);
}

export function createEmptyKnowledgeState(): KnowledgeState {
  return {
    knownCardIds: [],
    knownDeckIds: [],
  };
}

export function updateKnowledgeFromOwnedCards(
  player: PersistentPlayer,
  world: WorldState,
): void {
  const ownedCardIds = Object.entries(player.collection)
    .filter(([, quantity]) => quantity > 0)
    .flatMap(([printingId]) => {
      const printing = world.printings[printingId];
      return printing === undefined ? [] : [printing.cardId];
    });
  player.knowledge.knownCardIds = mergeIds(
    player.knowledge.knownCardIds,
    ownedCardIds,
  );
}

export function recordKnowledgeExposure(
  player: PersistentPlayer,
  exposure: KnowledgeExposure,
): void {
  player.knowledge.knownCardIds = mergeIds(
    player.knowledge.knownCardIds,
    exposure.cardIds,
  );
  player.knowledge.knownDeckIds = mergeIds(
    player.knowledge.knownDeckIds,
    exposure.deckIds,
  );
}
