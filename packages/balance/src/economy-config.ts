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
  printingVariantSuffixes: {
    normal: "-normal",
    foil: "-foil",
    altArt: "-alt-art",
  },
} as const;
