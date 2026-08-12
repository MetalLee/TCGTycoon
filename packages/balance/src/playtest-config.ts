export type PlaytestTierConfig = {
  durationDays: number;
  matchBudget: number;
  candidateDeckBudget: number;
  cashCost: number;
};

export type PlaytestConfig = {
  quick: PlaytestTierConfig;
  standard: PlaytestTierConfig;
  deep: PlaytestTierConfig;
  comboMinimumActivations: number;
  comboMinimumObservedWinRate: number;
  highRiskMinimumMatches: number;
  highRiskObservedWinRate: number;
  anomalyReplayLimit: number;
  shortMatchTurnThreshold: number;
};

export const PLAYTEST_CONFIG: PlaytestConfig = {
  quick: {
    durationDays: 1,
    matchBudget: 2_000,
    candidateDeckBudget: 4,
    cashCost: 2_000,
  },
  standard: {
    durationDays: 3,
    matchBudget: 15_000,
    candidateDeckBudget: 12,
    cashCost: 12_000,
  },
  deep: {
    durationDays: 7,
    matchBudget: 75_000,
    candidateDeckBudget: 24,
    cashCost: 50_000,
  },
  comboMinimumActivations: 5,
  comboMinimumObservedWinRate: 0.6,
  highRiskMinimumMatches: 10,
  highRiskObservedWinRate: 0.65,
  anomalyReplayLimit: 8,
  shortMatchTurnThreshold: 5,
};
