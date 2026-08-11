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
