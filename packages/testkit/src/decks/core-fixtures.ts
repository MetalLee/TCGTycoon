import {
  cardId,
  deckId,
  factionId,
  type DeckCardEntry,
  type DeckDefinition,
} from "@tcgtycoon/domain";

function pairs(cardIds: readonly string[]): DeckCardEntry[] {
  return cardIds.map((id) => ({ cardId: cardId(id), count: 2 }));
}

export const fireFixtureDeck: DeckDefinition = {
  id: deckId("deck-fire-fixture"),
  name: "Fire Fixture",
  factionId: factionId("fire"),
  cards: pairs([
    "card-fire-cub",
    "card-fire-charger",
    "card-fire-runner",
    "card-fire-herald",
    "card-fire-phoenix",
    "card-fire-guardian",
    "card-fire-drinker",
    "card-fire-twins",
    "card-fire-stalker",
    "card-neutral-scout",
  ]),
};

export const machineFixtureDeck: DeckDefinition = {
  id: deckId("deck-machine-fixture"),
  name: "Machine Fixture",
  factionId: factionId("machine"),
  cards: pairs([
    "card-machine-guard",
    "card-machine-rocket",
    "card-machine-repairer",
    "card-machine-salvager",
    "card-machine-buffer",
    "card-machine-disruptor",
    "card-machine-bolt",
    "card-machine-recall",
    "card-machine-fabricate",
    "card-neutral-scout",
  ]),
};

export const coreFixtureDecks: DeckDefinition[] = [
  fireFixtureDeck,
  machineFixtureDeck,
];
