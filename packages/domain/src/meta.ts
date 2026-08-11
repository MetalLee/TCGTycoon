import type { DeckCardEntry } from "./decks";
import type { DeckId, FactionId, PlayerId } from "./ids";

export type StrategyVector = Record<string, number>;

export type DeckGenome = {
  id: DeckId;
  factionId: FactionId;
  cards: DeckCardEntry[];
  strategy: StrategyVector;
  originPlayerId: PlayerId;
  parentDeckIds: DeckId[];
  generation: number;
  createdDay: number;
};

export type MetaDeckStats = {
  matches: number;
  wins: number;
  losses: number;
};

export type MetaState = {
  deckStats: Record<string, MetaDeckStats>;
};
