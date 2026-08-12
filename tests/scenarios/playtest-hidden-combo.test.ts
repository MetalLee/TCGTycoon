import {
  PLAYTEST_CONFIG,
  type PlaytestConfig,
} from "../../packages/balance/src/index";
import {
  cardId,
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
  type ExpansionBrief,
} from "../../packages/domain/src/index";
import {
  advancePlaytest,
  completePlaytest,
  createExpansion,
  startPlaytest,
} from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

const comboEngineId = cardId("card-playtest-z-engine");
const comboPayoffId = cardId("card-playtest-z-payoff");

const scenarioConfig: PlaytestConfig = {
  ...PLAYTEST_CONFIG,
  quick: {
    ...PLAYTEST_CONFIG.quick,
    matchBudget: 24,
    candidateDeckBudget: 4,
  },
  deep: {
    ...PLAYTEST_CONFIG.deep,
    matchBudget: 192,
    candidateDeckBudget: 16,
  },
  comboMinimumActivations: 2,
  comboMinimumObservedWinRate: 0.5,
};

function baselineCard(index: number): CardDefinition {
  return {
    id: cardId(`card-playtest-baseline-${String(index).padStart(2, "0")}`),
    name: `Baseline Unit ${index}`,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    triggers: [],
  };
}

function scenarioCards(): CardDefinition[] {
  return [
    ...Array.from({ length: 22 }, (_, index) => baselineCard(index)),
    {
      id: comboEngineId,
      name: "Hidden Assembly Engine",
      type: "UNIT",
      factionId: factionId("fire"),
      rarity: "RARE",
      cost: 1,
      attack: 1,
      health: 2,
      keywords: ["BATTLECRY"],
      triggers: [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [{ type: "SUMMON", tokenCardId: comboPayoffId, amount: 2 }],
        },
      ],
    },
    {
      id: comboPayoffId,
      name: "Hidden Assembly Colossus",
      type: "UNIT",
      factionId: factionId("fire"),
      rarity: "LEGENDARY",
      cost: 8,
      attack: 8,
      health: 8,
      keywords: [],
      triggers: [],
    },
  ];
}

function createScenarioProject() {
  const brief: ExpansionBrief = {
    theme: "A buried assembly line",
    focusFactionIds: [factionId("fire")],
    strategicDirections: ["Summon synergies"],
    productPositioning: "Combo discovery fixture",
  };
  return createExpansion({
    id: expansionId("set-playtest-hidden-combo"),
    operationId: operationId("operation-playtest-hidden-combo"),
    name: "Hidden Combo Set",
    size: 24,
    createdDay: 5,
    brief,
    cards: scenarioCards(),
  });
}

function runPlaytest(tier: "QUICK" | "DEEP") {
  const project = createScenarioProject();
  const run = startPlaytest(
    project,
    tier,
    { startDay: 10, worldSeed: "playtest-hidden-combo" },
    scenarioConfig,
  );
  advancePlaytest(run, run.completionDay);
  return completePlaytest(run);
}

describe("playtest hidden combo", () => {
  it("lets Deep discover match-supported combo evidence that Quick does not sample", () => {
    const quick = runPlaytest("QUICK");
    const deep = runPlaytest("DEEP");
    const repeatedDeep = runPlaytest("DEEP");
    const hasPreparedCombo = (report: typeof quick) =>
      report.comboCandidates.some(
        (candidate) =>
          candidate.cardIds[0] === comboEngineId &&
          candidate.cardIds[1] === comboPayoffId,
      );

    expect(deep.candidatesEvaluated).toBeGreaterThan(quick.candidatesEvaluated);
    expect(deep.matchesRun).toBeGreaterThan(quick.matchesRun);
    expect(deep).toEqual(repeatedDeep);
    expect(hasPreparedCombo(quick)).toBe(false);
    expect(hasPreparedCombo(deep)).toBe(true);
    expect(deep).not.toHaveProperty("hiddenComboTruth");
  });
});
