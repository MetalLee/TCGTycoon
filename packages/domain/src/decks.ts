import type { CardId, DeckId, FactionId } from "./ids";

export type DeckCardEntry = {
  cardId: CardId;
  count: 1 | 2;
};

export type DeckDefinition = {
  id: DeckId;
  name: string;
  factionId: FactionId;
  cards: DeckCardEntry[];
};
