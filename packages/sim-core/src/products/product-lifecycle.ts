import type { ProductLifecycleConfig } from "@tcgtycoon/balance";

export type SetFreshnessInput = {
  currentDay: number;
  releaseDay: number;
  marketingAttention?: number;
};

export type ProductFatigueInput = {
  currentDay: number;
  releaseDays: readonly number[];
  recentSpend: number;
  spendingCapacity: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function requireDay(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function requireUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between zero and one`);
  }
}

function requireNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be non-negative and finite`);
  }
}

function validateFreshnessConfig(config: ProductLifecycleConfig): void {
  requireUnit(config.freshness.launchValue, "freshness.launchValue");
  requireUnit(config.freshness.floorValue, "freshness.floorValue");
  requireUnit(
    config.freshness.attentionRecoveryFraction,
    "freshness.attentionRecoveryFraction",
  );
  requireUnit(config.freshness.agedMaximum, "freshness.agedMaximum");
  if (
    config.freshness.floorValue > config.freshness.launchValue ||
    config.freshness.agedMaximum >= config.freshness.launchValue
  ) {
    throw new RangeError(
      "Freshness floor and aged maximum must remain below launch freshness",
    );
  }
  if (
    !Number.isInteger(config.freshness.halfLifeDays) ||
    config.freshness.halfLifeDays <= 0
  ) {
    throw new RangeError("freshness.halfLifeDays must be a positive integer");
  }
}

function validateFatigueConfig(config: ProductLifecycleConfig): void {
  if (
    !Number.isInteger(config.fatigue.lookbackDays) ||
    config.fatigue.lookbackDays <= 0
  ) {
    throw new RangeError("fatigue.lookbackDays must be a positive integer");
  }
  if (
    !Number.isInteger(config.fatigue.comfortableReleaseIntervalDays) ||
    config.fatigue.comfortableReleaseIntervalDays <= 0
  ) {
    throw new RangeError(
      "fatigue.comfortableReleaseIntervalDays must be a positive integer",
    );
  }
  requireUnit(
    config.fatigue.releaseCadenceWeight,
    "fatigue.releaseCadenceWeight",
  );
  requireUnit(config.fatigue.recentSpendWeight, "fatigue.recentSpendWeight");
  requireUnit(config.fatigue.maximum, "fatigue.maximum");
  if (
    config.fatigue.releaseCadenceWeight + config.fatigue.recentSpendWeight !==
    1
  ) {
    throw new RangeError("Product fatigue weights must sum to one");
  }
}

export function calculateSetFreshness(
  input: SetFreshnessInput,
  config: ProductLifecycleConfig,
): number {
  validateFreshnessConfig(config);
  requireDay(input.currentDay, "currentDay");
  requireDay(input.releaseDay, "releaseDay");
  if (input.currentDay < input.releaseDay) {
    throw new RangeError("currentDay cannot precede releaseDay");
  }
  const attention = input.marketingAttention ?? 0;
  requireUnit(attention, "marketingAttention");
  const ageDays = input.currentDay - input.releaseDay;
  if (ageDays === 0) {
    return config.freshness.launchValue;
  }

  const decay = 0.5 ** (ageDays / config.freshness.halfLifeDays);
  const base =
    config.freshness.floorValue +
    (config.freshness.launchValue - config.freshness.floorValue) * decay;
  const attentionLift =
    (config.freshness.launchValue - base) *
    attention *
    config.freshness.attentionRecoveryFraction;
  return Math.min(config.freshness.agedMaximum, base + attentionLift);
}

export function calculateProductFatigue(
  input: ProductFatigueInput,
  config: ProductLifecycleConfig,
): number {
  validateFatigueConfig(config);
  requireDay(input.currentDay, "currentDay");
  input.releaseDays.forEach((day) => requireDay(day, "releaseDays entry"));
  requireNonNegativeFinite(input.recentSpend, "recentSpend");
  requireNonNegativeFinite(input.spendingCapacity, "spendingCapacity");

  const earliestRecentDay = input.currentDay - config.fatigue.lookbackDays;
  const recentReleaseWaves = new Set(
    input.releaseDays.filter(
      (day) => day > earliestRecentDay && day <= input.currentDay,
    ),
  ).size;
  const comfortableReleaseWaves = Math.max(
    1,
    Math.floor(
      config.fatigue.lookbackDays /
        config.fatigue.comfortableReleaseIntervalDays,
    ),
  );
  const releasePressure = clampUnit(
    (recentReleaseWaves - comfortableReleaseWaves) / comfortableReleaseWaves,
  );
  const spendPressure =
    input.spendingCapacity === 0
      ? input.recentSpend > 0
        ? 1
        : 0
      : clampUnit(input.recentSpend / input.spendingCapacity);
  const fatigue =
    releasePressure * config.fatigue.releaseCadenceWeight +
    spendPressure * config.fatigue.recentSpendWeight;
  return Math.min(config.fatigue.maximum, clampUnit(fatigue));
}
