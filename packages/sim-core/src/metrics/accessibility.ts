import { METRICS_CONFIG } from "@tcgtycoon/balance";

export type AccessibilityInput = {
  starterAvailability: number;
  starterPrice: number;
  cheapestCompetitiveDeckCost: number;
  medianMetaDeckCost: number;
  coreCardScarcity: number;
  budgetDeckViability: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function affordability(cost: number, comfortableCost: number): number {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new RangeError(
      "Accessibility costs must be finite and non-negative.",
    );
  }
  return clampUnit(2 - cost / comfortableCost);
}

export function calculateAccessibility(input: AccessibilityInput): number {
  const config = METRICS_CONFIG.accessibility;
  const weights = config.weights;
  const normalized =
    clampUnit(input.starterAvailability) * weights.starterAvailability +
    affordability(input.starterPrice, config.comfortableStarterPrice) *
      weights.starterAffordability +
    affordability(
      input.cheapestCompetitiveDeckCost,
      config.comfortableCompetitiveDeckCost,
    ) *
      weights.cheapestCompetitiveDeck +
    affordability(
      input.medianMetaDeckCost,
      config.comfortableMedianMetaDeckCost,
    ) *
      weights.medianMetaDeck +
    (1 - clampUnit(input.coreCardScarcity)) * weights.coreCardAvailability +
    clampUnit(input.budgetDeckViability) * weights.budgetDeckViability;

  return clampUnit(normalized) * 100;
}
