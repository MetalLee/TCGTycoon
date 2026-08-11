import { PRODUCTION_CONFIG, type ProductionConfig } from "@tcgtycoon/balance";
import type { PrintingId, WorldState } from "@tcgtycoon/domain";
import { DeterministicRng, deriveSeed } from "@tcgtycoon/rules-engine";

export type BalanceConfig = {
  starterContents: Readonly<Record<string, readonly PrintingId[]>>;
  dailyOperatingCost: number;
  inventoryHoldingCostPerUnit: number;
  production: ProductionConfig;
};

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  starterContents: {},
  dailyOperatingCost: 0,
  inventoryHoldingCostPerUnit: 0,
  production: PRODUCTION_CONFIG,
};

export function phaseRng(
  world: Pick<WorldState, "worldSeed" | "day">,
  phase: string,
  sequence: string | number = 0,
): DeterministicRng {
  return new DeterministicRng(
    deriveSeed([world.worldSeed, world.day, "simulate-day", phase, sequence]),
  );
}

function canonicalStringify(value: unknown, seen = new Set<object>()): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("World hash does not support NaN or Infinity.");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`World hash does not support ${typeof value}.`);
  }
  if (seen.has(value)) {
    throw new TypeError("World hash does not support circular references.");
  }
  seen.add(value);
  const result = Array.isArray(value)
    ? `[${value.map((entry) => canonicalStringify(entry, seen)).join(",")}]`
    : `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${canonicalStringify(
              (value as Record<string, unknown>)[key],
              seen,
            )}`,
        )
        .join(",")}}`;
  seen.delete(value);
  return result;
}

export function hashWorldState(world: WorldState): string {
  return deriveSeed(["world-state", canonicalStringify(world)])
    .toString(16)
    .padStart(16, "0");
}
