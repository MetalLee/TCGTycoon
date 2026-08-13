import { POPULATION_CONFIG } from "../../packages/balance/src/index";
import { validateWorldInvariants } from "../../packages/sim-core/src/index";
import {
  runSeedSimulation,
  validateLongRunState,
} from "../../scripts/run-long-simulations";
import { describe, expect, it } from "vitest";

describe("1000-day world regression", () => {
  it("keeps the balanced world finite, referenced, supplied and progressing", () => {
    const result = runSeedSimulation({
      days: 1_000,
      seed: "long-run-1000-days",
    });

    expect(
      result.summary.lifespan === 1_000 ||
        result.finalState.status === "GAME_OVER",
    ).toBe(true);
    expect(result.finalState.day).toBe(
      result.summary.initialDay + result.summary.lifespan,
    );
    expect(result.summary.maxActivePlayers).toBeGreaterThanOrEqual(0);
    expect(result.summary.maxActivePlayers).toBeLessThanOrEqual(
      POPULATION_CONFIG.standardPersistentPlayerCount,
    );
    expect(result.finalState.metrics.activePlayers).toBeGreaterThanOrEqual(0);
    expect(result.finalState.metrics.activePlayers).toBeLessThanOrEqual(
      POPULATION_CONFIG.standardPersistentPlayerCount,
    );
    expect(Number.isFinite(result.finalState.metrics.activePlayerTrend)).toBe(
      true,
    );
    expect(Number.isFinite(result.summary.endingCash)).toBe(true);

    validateLongRunState(result.finalState);
    validateWorldInvariants(result.finalState);
  }, 900_000);
});
