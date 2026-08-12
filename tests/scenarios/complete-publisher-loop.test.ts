import { describe, expect, it } from "vitest";
import { validateWorldInvariants } from "../../packages/sim-core/src/index";
import { runSimulation } from "../../scripts/simulate-days";

describe("complete publisher operations fixture", () => {
  it("exercises the canonical expansion-to-live-product loop", () => {
    const { finalState } = runSimulation({
      days: 20,
      seed: "complete-publisher-loop",
      scenario: "balanced-world",
      operationsFixture: true,
    });
    const project = Object.values(finalState.expansionProjects ?? {}).find(
      (candidate) => candidate.name === "Completion Bot Expansion",
    );
    const operationTypes = Object.values(finalState.operations ?? {}).map(
      (operation) => operation.type,
    );
    const commitments =
      finalState.announcementState?.announcements.flatMap((announcement) =>
        announcement.commitment === undefined ? [] : [announcement.commitment],
      ) ?? [];

    expect(finalState.status).toBe("LIVE");
    expect(project?.stage).toBe("RELEASED");
    expect(
      Object.keys(finalState.operationEvidence?.playtests.reports ?? {}),
    ).not.toHaveLength(0);
    expect(operationTypes).toEqual(
      expect.arrayContaining([
        "EXPANSION_DESIGN",
        "PLAYTEST",
        "CAMPAIGN",
        "TOURNAMENT",
        "POLICY_CHANGE",
      ]),
    );
    expect(commitments).toContainEqual(
      expect.objectContaining({
        type: "FINALIZE_EXPANSION",
        status: "FULFILLED",
      }),
    );
    expect(finalState.history.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "EXPANSION_FINALIZED",
        "PLAYTEST_COMPLETED",
        "TOURNAMENT_COMPLETED",
        "COMMITMENT_FULFILLED",
        "PRODUCT_RELEASED",
      ]),
    );
    expect(finalState.cash.ledger.map((entry) => entry.category)).toEqual(
      expect.arrayContaining([
        "EXPANSION_DESIGN",
        "PLAYTEST",
        "MARKETING",
        "TOURNAMENT",
        "PRINTING",
      ]),
    );
    validateWorldInvariants(finalState);
  }, 60_000);
});
