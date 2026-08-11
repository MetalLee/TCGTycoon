import { METRICS_CONFIG } from "@tcgtycoon/balance";
import type { MatchupStats, MetaDeckStats } from "../meta/meta-aggregation";

export type MetaHealthInput = {
  deckStats: Readonly<Record<string, MetaDeckStats>>;
  matchups: Readonly<Record<string, MatchupStats>>;
  accessibility: number;
  staleDays: number;
};

export type MetaHealthComponents = {
  diversity: number;
  dominance: number;
  winRate: number;
  matchup: number;
  accessibility: number;
};

export type MetaHealthResult = {
  score: number;
  components: MetaHealthComponents;
  stalenessPenalty: number;
};

export type WorldMetricState = {
  hype: number;
  collectorHeat: number;
  metaHealth: number;
  brandTrust: number;
  sentiment: number;
};

export type CollectorSignals = {
  tradingVolume: number;
  liquidity: number;
  priceMomentum: number;
  scarcityExcitement: number;
  productFreshness: number;
  collectorConfidence: number;
};

export type WorldMetricSignals = {
  positiveAttention: number;
  negativeAttention: number;
  sentimentTarget: number;
  collector: CollectorSignals;
  metaHealthTarget: number;
  brandTrustTarget: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampMetric(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function normalizedEntropy(usages: readonly number[]): number {
  if (usages.length <= 1) {
    return 0;
  }
  const total = usages.reduce((sum, usage) => sum + usage, 0);
  if (total <= 0) {
    return 0;
  }
  const entropy = usages.reduce((sum, usage) => {
    const probability = usage / total;
    return probability <= 0 ? sum : sum - probability * Math.log(probability);
  }, 0);
  return clampUnit(entropy / Math.log(usages.length));
}

function dominanceHealth(usages: readonly number[]): number {
  if (usages.length <= 1) {
    return 0;
  }
  const total = usages.reduce((sum, usage) => sum + usage, 0);
  if (total <= 0) {
    return 0;
  }
  const maximumUsage = Math.max(...usages.map((usage) => usage / total));
  const uniformUsage = 1 / usages.length;
  return clampUnit((1 - maximumUsage) / (1 - uniformUsage));
}

function weightedAverage(
  values: readonly { value: number; weight: number }[],
  fallback: number,
): number {
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return fallback;
  }
  return (
    values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) /
    totalWeight
  );
}

export function calculateMetaHealth(input: MetaHealthInput): MetaHealthResult {
  const config = METRICS_CONFIG.metaHealth;
  const decks = Object.values(input.deckStats);
  const usages = decks.map((stats) => clampUnit(stats.usageRate));
  const reliableDecks = decks.filter(
    (stats) => stats.sampleCount >= config.minimumReliableSamples,
  );
  const reliableMatchups = Object.values(input.matchups).filter(
    (stats) => stats.sampleCount >= config.minimumReliableSamples,
  );
  const winRateHealth = weightedAverage(
    reliableDecks.map((stats) => ({
      value: clampUnit(
        1 -
          Math.abs(stats.observedWinRate - 0.5) / config.winRateOutlierDistance,
      ),
      weight: stats.sampleCount,
    })),
    config.insufficientSampleNeutralScore,
  );
  const matchupHealth = weightedAverage(
    reliableMatchups.map((stats) => ({
      value: clampUnit(1 - Math.abs(stats.observedDeckAWinRate - 0.5) * 2),
      weight: stats.sampleCount,
    })),
    config.insufficientSampleNeutralScore,
  );
  const components: MetaHealthComponents = {
    diversity: normalizedEntropy(usages) * 100,
    dominance: dominanceHealth(usages) * 100,
    winRate: winRateHealth * 100,
    matchup: matchupHealth * 100,
    accessibility: clampMetric(input.accessibility),
  };
  const weightedScore =
    components.diversity * config.weights.diversity +
    components.dominance * config.weights.dominance +
    components.winRate * config.weights.winRate +
    components.matchup * config.weights.matchup +
    components.accessibility * config.weights.accessibility;
  const stalenessPenalty = Math.min(
    config.maximumStalenessPenalty,
    Math.max(0, input.staleDays) * config.stalenessPenaltyPerDay,
  );

  return {
    score: clampMetric(weightedScore - stalenessPenalty),
    components,
    stalenessPenalty,
  };
}

function smooth(current: number, target: number, speed: number): number {
  const boundedCurrent = clampMetric(current);
  return clampMetric(
    boundedCurrent + (clampMetric(target) - boundedCurrent) * speed,
  );
}

function collectorHeatTarget(signals: CollectorSignals): number {
  return (
    Object.entries(METRICS_CONFIG.collectorHeat.weights).reduce(
      (total, [signal, weight]) =>
        total + clampUnit(signals[signal as keyof CollectorSignals]) * weight,
      0,
    ) * 100
  );
}

export function updateWorldMetrics(
  current: WorldMetricState,
  signals: WorldMetricSignals,
): WorldMetricState {
  const speeds = METRICS_CONFIG.responseSpeed;
  const hypeTarget =
    clampUnit(signals.positiveAttention + signals.negativeAttention) * 100;

  return {
    hype: smooth(current.hype, hypeTarget, speeds.hype),
    collectorHeat: smooth(
      current.collectorHeat,
      collectorHeatTarget(signals.collector),
      speeds.collectorHeat,
    ),
    metaHealth: smooth(
      current.metaHealth,
      signals.metaHealthTarget,
      speeds.metaHealth,
    ),
    brandTrust: smooth(
      current.brandTrust,
      signals.brandTrustTarget,
      speeds.brandTrust,
    ),
    sentiment: smooth(
      current.sentiment,
      signals.sentimentTarget,
      speeds.sentiment,
    ),
  };
}
