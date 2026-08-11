import { PLAYTEST_CONFIG, type PlaytestConfig } from "@tcgtycoon/balance";
import {
  cardId,
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
  type ExpansionBrief,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import {
  applyCardDraftUpdate,
  createExpansion,
  type ExpansionPipelineProject,
} from "./expansion-pipeline";
import {
  advancePlaytest,
  completePlaytest,
  startPlaytest,
  validatePlaytestReportRevisions,
} from "./playtest";

const brief: ExpansionBrief = {
  theme: "Playtest fixture",
  focusFactionIds: [factionId("fire")],
  strategicDirections: ["Unit combat"],
  productPositioning: "Test only",
};

function createCard(index: number): CardDefinition {
  return {
    id: cardId(`card-playtest-${String(index).padStart(2, "0")}`),
    name: `Playtest Unit ${index}`,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: (index % 6) + 1,
    attack: (index % 4) + 1,
    health: (index % 5) + 1,
    keywords: [],
    triggers: [],
  };
}

function createProject(): ExpansionPipelineProject {
  return createExpansion({
    id: expansionId("set-playtest"),
    operationId: operationId("operation-set-playtest"),
    name: "Playtest Set",
    size: 24,
    createdDay: 10,
    brief,
    cards: Array.from({ length: 24 }, (_, index) => createCard(index)),
  });
}

const FAST_CONFIG: PlaytestConfig = {
  ...PLAYTEST_CONFIG,
  quick: {
    ...PLAYTEST_CONFIG.quick,
    matchBudget: 12,
    candidateDeckBudget: 4,
  },
};

describe("internal playtests", () => {
  it("uses configured Quick/Standard/Deep duration, match budget and cost", () => {
    expect(PLAYTEST_CONFIG.quick).toMatchObject({
      durationDays: 1,
      matchBudget: 2_000,
    });
    expect(PLAYTEST_CONFIG.standard).toMatchObject({
      durationDays: 3,
      matchBudget: 15_000,
    });
    expect(PLAYTEST_CONFIG.deep).toMatchObject({
      durationDays: 7,
      matchBudget: 75_000,
    });
    expect(PLAYTEST_CONFIG.quick.cashCost).toBeLessThan(
      PLAYTEST_CONFIG.standard.cashCost,
    );
    expect(PLAYTEST_CONFIG.standard.cashCost).toBeLessThan(
      PLAYTEST_CONFIG.deep.cashCost,
    );

    const quick = startPlaytest(
      createProject(),
      "QUICK",
      { startDay: 20, worldSeed: "quick-duration" },
      PLAYTEST_CONFIG,
    );
    const standard = startPlaytest(
      createProject(),
      "STANDARD",
      { startDay: 20, worldSeed: "standard-duration" },
      PLAYTEST_CONFIG,
    );
    const deep = startPlaytest(
      createProject(),
      "DEEP",
      { startDay: 20, worldSeed: "deep-duration" },
      PLAYTEST_CONFIG,
    );

    expect(quick).toMatchObject({ completionDay: 20, matchBudget: 2_000 });
    expect(standard).toMatchObject({ completionDay: 22, matchBudget: 15_000 });
    expect(deep).toMatchObject({ completionDay: 26, matchBudget: 75_000 });
  });

  it("advances through the scheduler and becomes ready on its completion day", () => {
    const run = startPlaytest(
      createProject(),
      "STANDARD",
      { startDay: 20, worldSeed: "standard-progress" },
      PLAYTEST_CONFIG,
    );

    advancePlaytest(run, 20);
    expect(run).toMatchObject({ status: "ACTIVE", elapsedDays: 1 });

    advancePlaytest(run, 22);
    expect(run).toMatchObject({ status: "READY", elapsedDays: 3 });
  });

  it("marks a completed report stale after a gameplay revision changes", () => {
    const project = createProject();
    const run = startPlaytest(
      project,
      "QUICK",
      { startDay: 20, worldSeed: "revision-invalidation" },
      FAST_CONFIG,
    );
    advancePlaytest(run, run.completionDay);
    const report = completePlaytest(run);
    const draft = project.cardDrafts[cardId("card-playtest-00")]!;

    expect(report.status).toBe("FRESH");

    applyCardDraftUpdate(project, draft.definition.id, {
      definition: { ...draft.definition, cost: draft.definition.cost + 1 },
    });
    validatePlaytestReportRevisions(report, project);

    expect(report.status).toBe("STALE");
  });
});
