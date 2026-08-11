export const ECONOMY_CONFIG = {
  booster: {
    cardsPerPack: 5,
    commonSlots: 3,
    uncommonSlots: 1,
    rarePlusSlots: 1,
    legendaryChanceInRarePlus: 0.125,
    foilUpgradeChance: 0.1,
    altArtUpgradeChance: 0.025,
  },
  starter: {
    cardsPerProduct: 20,
  },
  primaryMarket: {
    publisherShare: 0.65,
    productFreshnessPlaceholder: 1,
    maxUnitsPerPlayerProductDemand: 1,
  },
  secondaryMarket: {
    collectorIntentThreshold: 0.75,
    collectorBidMultiplier: 1.1,
    maxCollectorQuantity: 1,
    budgetSellerThreshold: 0.75,
    maxBudgetSellerQuantity: 1,
    maxPriceHistoryDays: 365,
  },
  printingVariantSuffixes: {
    normal: "-normal",
    foil: "-foil",
    altArt: "-alt-art",
  },
} as const;
