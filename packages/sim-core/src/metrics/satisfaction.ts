import { METRICS_CONFIG } from "@tcgtycoon/balance";

export type SatisfactionDimensions = {
  gameplayQuality: number;
  affordability: number;
  novelty: number;
  trust: number;
  socialActivity: number;
  collectionExperience: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function calculateSatisfactionTarget(
  dimensions: SatisfactionDimensions,
): number {
  return clampUnit(
    Object.entries(METRICS_CONFIG.satisfaction.weights).reduce(
      (total, [dimension, weight]) =>
        total +
        clampUnit(dimensions[dimension as keyof SatisfactionDimensions]) *
          weight,
      0,
    ),
  );
}

export function updateSatisfaction(current: number, target: number): number {
  const boundedCurrent = clampUnit(current);
  const boundedTarget = clampUnit(target);
  return (
    boundedCurrent +
    (boundedTarget - boundedCurrent) * METRICS_CONFIG.responseSpeed.satisfaction
  );
}
