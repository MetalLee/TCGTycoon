export const POPULATION_CONFIG = {
  standardPersistentPlayerCount: 400,
  standardNamedAgentCount: 24,
  initialWallet: {
    minimum: 40,
    maximumExclusive: 241,
  },
  initialSatisfaction: 0.6,
  initialPublisherCash: 100_000,
  launchBoosterMsrp: 5,
  maximumNamedAgentFollowersExclusive: 10_000,
  namedAgentRoles: [
    { role: "PROFESSIONAL_PLAYER", count: 5 },
    { role: "BREWER", count: 4 },
    { role: "STREAMER", count: 5 },
    { role: "COLLECTOR", count: 4 },
    { role: "STORE_PERSONALITY", count: 3 },
    { role: "COMMUNITY_COMMENTATOR", count: 3 },
  ],
} as const;

export const BALANCE_VERSION = "1" as const;

export const DECK_EVOLUTION_CONFIG = {
  candidateRandomness: 0.25,
  maxMutationReplacements: 1,
  explorationBaseChance: 0.1,
  brewerExplorationWeight: 0.4,
  parentNovelty: 0.2,
  childNovelty: 1,
  knownDeckSocialExposure: 1,
  inheritedDeckSocialExposure: 0.5,
  namedAgentInfluencerExposure: 1,
  adoption: {
    performanceWeight: 0.3,
    preferenceWeight: 0.2,
    socialExposureWeight: 0.1,
    tournamentPrestigeWeight: 0.1,
    influencerExposureWeight: 0.1,
    noveltyWeight: 0.1,
    deckCostPenaltyWeight: 0.25,
    missingCardPenaltyWeight: 0.35,
    complexityPenaltyWeight: 0.1,
  },
} as const;

export const META_CONFIG = {
  fullWorldMinimumPlayers: 300,
  fullWorldDailyMatchTarget: 5_000,
  smallWorldMatchesPerEligiblePlayer: 2,
  confidenceMinimumSamples: {
    low: 10,
    medium: 50,
    high: 200,
  },
} as const;
