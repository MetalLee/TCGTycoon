export type ProductionQuantityTier = {
  upToQuantity: number | null;
  unitCostMultiplier: number;
};

export type ProductionConfig = {
  leadDays: number;
  baseUnitCostByKind: {
    BOOSTER: number;
    STARTER: number;
  };
  quantityTiers: readonly ProductionQuantityTier[];
};

export const PRODUCTION_CONFIG: ProductionConfig = {
  leadDays: 10,
  baseUnitCostByKind: {
    BOOSTER: 1.5,
    STARTER: 4.5,
  },
  quantityTiers: [
    { upToQuantity: 500, unitCostMultiplier: 1 },
    { upToQuantity: 2_500, unitCostMultiplier: 0.9 },
    { upToQuantity: 10_000, unitCostMultiplier: 0.8 },
    { upToQuantity: null, unitCostMultiplier: 0.72 },
  ],
};
