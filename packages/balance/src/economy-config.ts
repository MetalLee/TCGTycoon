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
    maxUnitsPerPlayerProductDemand: 1,
  },
  secondaryMarket: {
    collectorIntentThreshold: 0.75,
    collectorBidMultiplier: 1.1,
    maxCollectorQuantity: 1,
    budgetSellerThreshold: 0.75,
    maxBudgetSellerQuantity: 1,
    maxEndogenousListingQuantity: 1,
    endogenousAskDiscount: 0.8,
    minimumEndogenousAsk: 0.25,
    fallbackAskByRarity: {
      COMMON: 1,
      UNCOMMON: 2,
      RARE: 5,
      LEGENDARY: 10,
    },
    maxPriceHistoryDays: 365,
  },
  printingVariantSuffixes: {
    normal: "-normal",
    foil: "-foil",
    altArt: "-alt-art",
  },
} as const;
