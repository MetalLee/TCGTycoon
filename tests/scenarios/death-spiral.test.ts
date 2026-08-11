import { describe, expect, it } from "vitest";
import { validateWorldInvariants } from "../../packages/sim-core/src/index";
import { runSimulation } from "../../scripts/simulate-days";

describe("death spiral golden scenario", () => {
  it("reaches terminal risk and stops the headless runner", () => {
    const result = runSimulation({
      days: 10,
      seed: "terminal-world",
      scenario: "death-spiral-world",
    });

    expect(result.finalState.status).toBe("GAME_OVER");
    expect(result.summary.riskState).toBe("TERMINAL");
    expect(result.summary.finalDay).toBeLessThanOrEqual(11);
    expect(Number.isFinite(result.summary.cash)).toBe(true);
    validateWorldInvariants(result.finalState);
  });
});
