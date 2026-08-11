import { describe, expect, it } from "vitest";
import { validateWorldInvariants } from "../../packages/sim-core/src/index";
import {
  BasicPublisherBot,
  createBalancedWorld,
} from "../../packages/testkit/src/index";
import {
  parseSimulationArgs,
  runSimulation,
  SCENARIO_NAMES,
} from "../../scripts/simulate-days";

describe("headless world simulation", () => {
  it("parses a positive day count, string seed, and named scenario", () => {
    expect(
      parseSimulationArgs([
        "--days",
        "30",
        "--seed",
        "launch-alpha",
        "--scenario",
        "balanced-world",
      ]),
    ).toEqual({
      days: 30,
      seed: "launch-alpha",
      scenario: "balanced-world",
    });
  });

  it("rejects non-positive days and unknown scenarios", () => {
    expect(() =>
      parseSimulationArgs(["--days", "0", "--seed", "12345"]),
    ).toThrow(/positive integer/i);
    expect(() =>
      parseSimulationArgs([
        "--days",
        "1",
        "--seed",
        "12345",
        "--scenario",
        "not-a-world",
      ]),
    ).toThrow(/scenario/i);
  });

  it("orders modest reprints without changing MSRP", () => {
    const scenario = createBalancedWorld("bot-low-stock");
    for (const printRun of Object.values(scenario.world.printRuns)) {
      printRun.quantity = 0;
    }

    const commands = new BasicPublisherBot(scenario.botConfig).decide(
      scenario.world,
    );

    expect(commands.length).toBeGreaterThan(0);
    expect(
      commands.every((command) => command.type === "ORDER_PRINT_RUN"),
    ).toBe(true);
  });

  it("runs a balanced world for 30 days with finite summary metrics", () => {
    const result = runSimulation({
      days: 30,
      seed: "balanced-30-days",
      scenario: "balanced-world",
    });

    expect(result.summary.finalDay).toBe(31);
    expect(result.summary.stateHash).toMatch(/^[0-9a-f]{16}$/);
    for (const metric of [
      result.summary.activePlayers,
      result.summary.hype,
      result.summary.metaHealth,
      result.summary.brandTrust,
      result.summary.cash,
      result.summary.marketListings,
      result.summary.deckCount,
    ]) {
      expect(Number.isFinite(metric)).toBe(true);
    }
    validateWorldInvariants(result.finalState);
  });

  it.each(SCENARIO_NAMES)("constructs a valid %s fixture", (scenario) => {
    const result = runSimulation({
      days: 1,
      seed: `smoke-${scenario}`,
      scenario,
    });

    expect(result.summary.stateHash).toMatch(/^[0-9a-f]{16}$/);
    validateWorldInvariants(result.finalState);
  });
});
