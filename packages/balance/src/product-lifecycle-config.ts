export type ProductLifecycleConfig = {
  freshness: {
    launchValue: number;
    floorValue: number;
    halfLifeDays: number;
    attentionRecoveryFraction: number;
    agedMaximum: number;
  };
  fatigue: {
    lookbackDays: number;
    comfortableReleaseIntervalDays: number;
    releaseCadenceWeight: number;
    recentSpendWeight: number;
    maximum: number;
  };
  demand: {
    motivationWeight: number;
    affordabilityWeight: number;
    exposureWeight: number;
    freshnessWeight: number;
    fatiguePenaltyWeight: number;
    marketValueBonusWeight: number;
  };
};

export const PRODUCT_LIFECYCLE_CONFIG: ProductLifecycleConfig = {
  freshness: {
    launchValue: 1,
    floorValue: 0.15,
    halfLifeDays: 45,
    attentionRecoveryFraction: 0.2,
    agedMaximum: 0.99,
  },
  fatigue: {
    lookbackDays: 90,
    comfortableReleaseIntervalDays: 45,
    releaseCadenceWeight: 0.65,
    recentSpendWeight: 0.35,
    maximum: 0.8,
  },
  demand: {
    motivationWeight: 0.3,
    affordabilityWeight: 0.25,
    exposureWeight: 0.15,
    freshnessWeight: 0.3,
    fatiguePenaltyWeight: 1,
    marketValueBonusWeight: 0.25,
  },
};
