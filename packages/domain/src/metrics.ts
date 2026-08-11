export type EcosystemRiskState =
  "STABLE" | "STRAINED" | "DECLINING" | "DEATH_SPIRAL" | "TERMINAL";

export type LifecyclePopulationState = {
  potential: number;
  interested: number;
  newByAge: number[];
  active: number;
  atRisk: number;
  churned: number;
  returning: number;
};

export type LifecycleDeltas = {
  potentialToInterested: number;
  interestedToNew: number;
  newToActive: number;
  activeToAtRisk: number;
  atRiskToChurned: number;
  churnedToReturning: number;
  returningToActive: number;
};

export type WorldMetrics = {
  activePlayers: number;
  previousActivePlayers: number;
  hype: number;
  collectorHeat: number;
  metaHealth: number;
  brandTrust: number;
  sentiment: number;
  accessibility: number;
  lifecycle: LifecyclePopulationState;
  lifecycleDeltas: LifecycleDeltas;
  acquisitionToChurnRatio: number;
  retentionRate: number;
  activePlayerTrend: number;
  consecutiveDeclineDays: number;
  consecutiveLowActivityDays: number;
  ecosystemRisk: EcosystemRiskState;
};
