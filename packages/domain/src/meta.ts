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

export type MetaConfidence = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH";

export type MetaDeckStats = {
  matches: number;
  wins: number;
  losses: number;
  observedWinRate: number;
  usageRate: number;
  averageGameLength: number;
  sampleCount: number;
  confidence: MetaConfidence;
};

export type MatchupStats = {
  deckAId: DeckId;
  deckBId: DeckId;
  matches: number;
  deckAWins: number;
  deckBWins: number;
  observedDeckAWinRate: number;
  sampleCount: number;
  confidence: MetaConfidence;
};

export type MetaState = {
  deckStats: Record<string, MetaDeckStats>;
  matchups: Record<string, MatchupStats>;
};
