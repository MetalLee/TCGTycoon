import { createTestWorld } from "../../packages/testkit/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  simulateDay,
} from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

describe("world determinism", () => {
  it("produces the same next state and hash across 25 identical executions", () => {
    const results = Array.from({ length: 25 }, () =>
      simulateDay(
        createTestWorld("world-determinism"),
        [],
        DEFAULT_BALANCE_CONFIG,
      ),
    );
    const baseline = results[0]!;

    for (const result of results.slice(1)) {
      expect(result.stateHash).toBe(baseline.stateHash);
      expect(result.nextState).toEqual(baseline.nextState);
      expect(result.report).toEqual(baseline.report);
    }
  });
});
