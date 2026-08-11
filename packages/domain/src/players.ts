import type { AgentId, CardId, DeckId, PlayerId, PrintingId } from "./ids";

export type KnowledgeState = {
  knownCardIds: CardId[];
  knownDeckIds: DeckId[];
};

export type PersistentPlayer = {
  id: PlayerId;
  motivation: {
    competitive: number;
    brewer: number;
    casual: number;
    collector: number;
    budgetSensitivity: number;
    whale: number;
  };
  skill: number;
  loyalty: number;
  tenureDays: number;
  tcgWallet: number;
  activity: "NEW" | "ACTIVE" | "AT_RISK" | "CHURNED";
  collection: Record<PrintingId, number>;
  deckIds: DeckId[];
  knowledge: KnowledgeState;
  satisfaction: number;
};

export type PopulationCohort = {
  id: string;
  count: number;
};

export type NamedAgent = {
  id: AgentId;
  playerId: PlayerId;
  name: string;
  role: string;
  influence: number;
  followers: number;
  brandAttitude: number;
  recentMemories: string[];
  longTermSummary: string;
};
