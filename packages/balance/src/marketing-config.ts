export type MarketingAudience =
  "GENERAL" | "COMPETITIVE" | "NEW_PLAYERS" | "COLLECTORS";

export type CampaignBalance = {
  dailyCashCost: number;
  audience: MarketingAudience;
  dailyExposureRate: number;
  potentialToInterestedRateDelta: number;
  interestedToNewRateDelta: number;
};

export type MarketingConfig = {
  durationDays: readonly [3, 7, 14];
  campaigns: Readonly<
    Record<
      | "SOCIAL_MEDIA_ADS"
      | "STREAMER_SPONSORSHIP"
      | "NEW_PLAYER_CAMPAIGN"
      | "COLLECTOR_CAMPAIGN"
      | "TOURNAMENT_PROMOTION",
      CampaignBalance
    >
  >;
  starterStockoutConversionMultiplier: number;
  maximumAwarenessRateDelta: number;
  announcements: {
    baseAttention: number;
    structuredCommitmentBonus: number;
    saturationLookbackDays: number;
    lowImpactDecayFactor: number;
    minimumAttentionMultiplier: number;
  };
};

export const MARKETING_CONFIG: MarketingConfig = {
  durationDays: [3, 7, 14],
  campaigns: {
    SOCIAL_MEDIA_ADS: {
      dailyCashCost: 500,
      audience: "GENERAL",
      dailyExposureRate: 0.03,
      potentialToInterestedRateDelta: 0.01,
      interestedToNewRateDelta: 0,
    },
    STREAMER_SPONSORSHIP: {
      dailyCashCost: 900,
      audience: "COMPETITIVE",
      dailyExposureRate: 0.025,
      potentialToInterestedRateDelta: 0.008,
      interestedToNewRateDelta: 0,
    },
    NEW_PLAYER_CAMPAIGN: {
      dailyCashCost: 700,
      audience: "NEW_PLAYERS",
      dailyExposureRate: 0.08,
      potentialToInterestedRateDelta: 0.08,
      interestedToNewRateDelta: 0.05,
    },
    COLLECTOR_CAMPAIGN: {
      dailyCashCost: 650,
      audience: "COLLECTORS",
      dailyExposureRate: 0.04,
      potentialToInterestedRateDelta: 0.004,
      interestedToNewRateDelta: 0,
    },
    TOURNAMENT_PROMOTION: {
      dailyCashCost: 800,
      audience: "COMPETITIVE",
      dailyExposureRate: 0.035,
      potentialToInterestedRateDelta: 0.005,
      interestedToNewRateDelta: 0,
    },
  },
  starterStockoutConversionMultiplier: 0.05,
  maximumAwarenessRateDelta: 0.25,
  announcements: {
    baseAttention: 0.2,
    structuredCommitmentBonus: 0.15,
    saturationLookbackDays: 7,
    lowImpactDecayFactor: 0.6,
    minimumAttentionMultiplier: 0.2,
  },
};
