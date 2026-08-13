import {
  LongRunInvariantError,
  parseLongSimulationArgs,
  runManySimulations,
  summarizeLongSimulationReport,
} from "../../scripts/run-long-simulations";
import { describe, expect, it } from "vitest";

describe("multi-seed balance smoke runner", () => {
  it("parses bounded run, day, seed and concurrency options", () => {
    expect(
      parseLongSimulationArgs([
        "--runs",
        "3",
        "--days",
        "25",
        "--seed-prefix",
        "smoke",
        "--concurrency",
        "2",
      ]),
    ).toEqual({
      runs: 3,
      days: 25,
      seedPrefix: "smoke",
      concurrency: 2,
    });
    expect(() =>
      parseLongSimulationArgs(["--runs", "0", "--days", "25"]),
    ).toThrow(/runs.*positive/i);
    expect(() =>
      parseLongSimulationArgs(["--runs", "3", "--days", "0"]),
    ).toThrow(/days.*positive/i);
  });

  it("summarizes every required balance distribution", async () => {
    const report = await runManySimulations({
      runs: 3,
      days: 5,
      seedPrefix: "multi-seed-test",
      concurrency: 1,
    });
    const summary = summarizeLongSimulationReport(report);

    expect(report.results).toHaveLength(3);
    expect(report.invalidSeeds).toEqual([]);
    expect(report.crashedSeeds).toEqual([]);
    expect(summary).toMatchObject({
      runs: 3,
      completedRuns: 3,
      invalidSeeds: [],
      crashedSeeds: [],
      distributions: {
        lifespan: expect.any(Object),
        maxActivePlayers: expect.any(Object),
        endingCash: expect.any(Object),
        expansions: expect.any(Object),
        bans: expect.any(Object),
        topDeckDominance: expect.any(Object),
      },
    });
    for (const distribution of Object.values(summary.distributions)) {
      expect(Number.isFinite(distribution.minimum)).toBe(true);
      expect(Number.isFinite(distribution.median)).toBe(true);
      expect(Number.isFinite(distribution.maximum)).toBe(true);
      expect(Number.isFinite(distribution.mean)).toBe(true);
    }
  });

  it("separates invalid and crashed seeds for a nonzero CLI decision", async () => {
    const report = await runManySimulations(
      {
        runs: 3,
        days: 1,
        seedPrefix: "failure-classification",
        concurrency: 1,
      },
      ({ seed }) => {
        if (seed.endsWith("0001")) {
          throw new LongRunInvariantError("invalid fixture");
        }
        if (seed.endsWith("0002")) {
          throw new Error("crashed fixture");
        }
        return {
          seed,
          initialDay: 0,
          lifespan: 1,
          maxActivePlayers: 1,
          endingCash: 1,
          expansions: 1,
          bans: 0,
          topDeckDominance: 0.5,
          finalDay: 1,
          finalStatus: "LIVE",
        };
      },
    );

    expect(report.invalidSeeds).toEqual(["failure-classification-0001"]);
    expect(report.crashedSeeds).toEqual(["failure-classification-0002"]);
  });
});
