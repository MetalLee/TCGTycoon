import { POPULATION_CONFIG } from "../../packages/balance/src/index";
import {
  runSeedSimulation,
  validateLongRunState,
} from "../../scripts/run-long-simulations";
import { describe, expect, it } from "vitest";

describe("3000-day world regression", () => {
  it("does not stall or corrupt the mature economy", () => {
    const result = runSeedSimulation({
      days: 3_000,
      seed: "long-run-3000-days",
    });
    const metrics = result.finalState.metrics;
    const snapshots = Object.values(result.finalState.market.snapshots);

    expect(
      result.summary.lifespan === 3_000 ||
        result.finalState.status === "GAME_OVER",
    ).toBe(true);
    expect(result.finalState.day).toBe(
      result.summary.initialDay + result.summary.lifespan,
    );
    expect(metrics.activePlayers).toBeGreaterThanOrEqual(0);
    expect(metrics.activePlayers).toBeLessThanOrEqual(
      POPULATION_CONFIG.standardPersistentPlayerCount,
    );
    expect(metrics.retentionRate).toBeGreaterThanOrEqual(0);
    expect(metrics.retentionRate).toBeLessThanOrEqual(1);
    expect(result.summary.topDeckDominance).toBeGreaterThanOrEqual(0);
    expect(result.summary.topDeckDominance).toBeLessThanOrEqual(1);
    expect(
      snapshots.every((snapshot) =>
        snapshot.priceHistory.every(
          (entry) => entry.day <= result.finalState.day,
        ),
      ),
    ).toBe(true);

    validateLongRunState(result.finalState);
  }, 900_000);
});
