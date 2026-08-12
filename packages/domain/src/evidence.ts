import type { CardDefinition } from "./cards";
import type { CardId, DeckId, ExpansionId, TournamentId } from "./ids";
import type { OperationProject, PlaytestTier } from "./operations";
import type { DeckDefinition } from "./decks";
import type { LifecycleDeltas } from "./metrics";
import type { WorldEvent } from "./events";

export type ReplayMatchSide = "A" | "B";

export type ReplayActionLogEntry = {
  sequence: number;
  turn: number;
  side: ReplayMatchSide;
  type: string;
  cardId?: CardId;
  instanceId?: string;
  amount?: number;
  maxMana?: number;
  returnedCardIds?: CardId[];
  replacementCardIds?: CardId[];
  targetId?: string;
  attackerId?: string;
};

export type DurableMatchReplay = {
  seed: string;
  ruleVersion: string;
  battleAiVersion: string;
  deckA: DeckDefinition;
  deckB: DeckDefinition;
  actionLog: ReplayActionLogEntry[];
};

export type PlaytestRunState = {
  id: string;
  expansionId: ExpansionId;
  tier: PlaytestTier;
  startDay: number;
  completionDay: number;
  durationDays: number;
  elapsedDays: number;
  status: "PLANNED" | "ACTIVE" | "READY" | "COMPLETED";
  matchBudget: number;
  candidateDeckBudget: number;
  cashCost: number;
  worldSeed: string;
  setup: boolean;
  operation: Extract<OperationProject, { type: "PLAYTEST" }>;
  revisionSnapshot: Record<string, number>;
  cards: CardDefinition[];
  evidenceConfig: {
    comboMinimumActivations: number;
    comboMinimumObservedWinRate: number;
    highRiskMinimumMatches: number;
    highRiskObservedWinRate: number;
    anomalyReplayLimit: number;
    shortMatchTurnThreshold: number;
  };
};

export type PlaytestReportState = {
  id: string;
  expansionId: ExpansionId;
  tier: PlaytestTier;
  status: "FRESH" | "STALE";
  revisionSnapshot: Record<string, number>;
  candidatesEvaluated: number;
  matchesRun: number;
  candidateDeckStats: Array<{
    deckId: DeckDefinition["id"];
    cards: DeckDefinition["cards"];
    matches: number;
    wins: number;
    observedWinRate: number;
  }>;
  highRiskCards: Array<{
    cardId: CardId;
    observedMatches: number;
    observedWins: number;
    observedWinRate: number;
  }>;
  comboCandidates: Array<{
    cardIds: readonly [CardId, CardId];
    activations: number;
    winsAfterActivation: number;
    observedWinRate: number;
  }>;
  firstPlayerWinRate: number;
  averageTurns: number;
  diversityEstimate: number;
  triggerSafetyWarnings: Array<{
    code: string;
    limit: string;
    occurrences: number;
  }>;
  anomalies: Array<{
    id: string;
    type: "TRIGGER_SAFETY" | "SHORT_MATCH";
    matchSequence: number;
    reason: string;
    replay: DurableMatchReplay;
  }>;
  anomalyReplayReferences: string[];
};

export type TournamentAttentionState = {
  day: number;
  tournamentId: TournamentId;
  deckId: DeckId;
  socialExposure: number;
  tournamentPrestige: number;
};

export type PlaytestEvidenceState = {
  runs: Record<string, PlaytestRunState>;
  reports: Record<string, PlaytestReportState>;
};

export type OperationEvidence = {
  playtests: PlaytestEvidenceState;
  tournamentAttention: TournamentAttentionState[];
};

export type DailyReportRecord = {
  report: {
    day: number;
    completedPrintRuns: number;
    unitsSold: number;
    primaryRevenue: number;
    productsOpened: number;
    matchesSampled: number;
    marketTrades: number;
    activePlayers: number;
    accessibility: number;
    metaHealth: number;
    hype: number;
    collectorHeat: number;
    brandTrust: number;
    sentiment: number;
    lifecycleDeltas: LifecycleDeltas;
    cashBalance: number;
    ecosystemRisk:
      "STABLE" | "STRAINED" | "DECLINING" | "DEATH_SPIRAL" | "TERMINAL";
    notableEventCount: number;
  };
  notableEvents: WorldEvent[];
};
