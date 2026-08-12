import {
  cardId,
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
  type ExpansionBrief,
  type ExpansionSize,
  type OperationProject,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import {
  advanceExpansionDesign,
  applyCardDraftUpdate,
  createExpansion,
  finalizeExpansion,
  type ExpansionPipelineProject,
} from "./expansion-pipeline";

const brief: ExpansionBrief = {
  theme: "Clockwork wilds",
  focusFactionIds: [factionId("fire")],
  strategicDirections: ["Midrange units"],
  productPositioning: "First post-launch expansion",
};

function createCard(index: number): CardDefinition {
  return {
    id: cardId(`card-expansion-${index}`),
    name: `Expansion Unit ${index}`,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: (index % 8) + 1,
    attack: (index % 5) + 1,
    health: (index % 6) + 1,
    keywords: [],
    triggers: [],
  };
}

function createCards(count: number): CardDefinition[] {
  return Array.from({ length: count }, (_, index) => createCard(index));
}

function createProject(
  size: ExpansionSize = 24,
  cards: readonly CardDefinition[] = createCards(size),
): ExpansionPipelineProject {
  return createExpansion({
    id: expansionId(`set-${size}`),
    operationId: operationId(`operation-set-${size}`),
    name: `${size}-card set`,
    size,
    createdDay: 10,
    brief,
    cards,
  });
}

function createDesignOperation(
  project: ExpansionPipelineProject,
  progressDays: number,
): OperationProject {
  return {
    id: project.operationId,
    type: "EXPANSION_DESIGN",
    createdDay: project.createdDay,
    startDay: project.createdDay,
    completionDay: project.createdDay + project.designTargetDays - 1,
    status: "ACTIVE",
    progressDays,
    payload: { expansionId: project.id },
  };
}

describe("expansion pipeline", () => {
  it("requires 24, 32 or 36 cards for post-launch expansions", () => {
    expect(createProject(24).size).toBe(24);
    expect(createProject(32).size).toBe(32);
    expect(createProject(36).size).toBe(36);

    expect(() =>
      createExpansion({
        id: expansionId("set-invalid"),
        operationId: operationId("operation-set-invalid"),
        name: "Invalid set",
        size: 48 as ExpansionSize,
        createdDay: 10,
        brief,
        cards: createCards(48),
      }),
    ).toThrow(/24, 32 or 36/);
  });

  it("tracks 4/6/8 design progress targets by set size", () => {
    const cases: Array<[ExpansionSize, number]> = [
      [24, 4],
      [32, 6],
      [36, 8],
    ];

    for (const [size, target] of cases) {
      const project = createProject(size);
      const operation = createDesignOperation(project, target - 1);

      advanceExpansionDesign(project, operation);

      expect(project).toMatchObject({
        stage: "DESIGN",
        designProgressDays: target - 1,
        designTargetDays: target,
      });
    }
  });

  it("increments gameplay revision when DSL changes", () => {
    const project = createProject();
    const draft = project.cardDrafts[cardId("card-expansion-0")]!;

    applyCardDraftUpdate(project, draft.definition.id, {
      definition: { ...draft.definition, cost: draft.definition.cost + 1 },
    });

    expect(draft.gameplayRevision).toBe(2);
  });

  it("does not increment gameplay revision for flavor-only changes", () => {
    const project = createProject();
    const draft = project.cardDrafts[cardId("card-expansion-0")]!;

    applyCardDraftUpdate(project, draft.definition.id, {
      flavor: { flavorText: "The gears remember every season." },
    });

    expect(draft.gameplayRevision).toBe(1);
    expect(draft.flavor.flavorText).toBe("The gears remember every season.");
  });

  it("refuses gameplay edits after Finalize", () => {
    const project = createProject();
    const draft = project.cardDrafts[cardId("card-expansion-0")]!;
    if (draft.definition.type !== "UNIT") {
      throw new Error("Expected the test Card Draft to be a Unit");
    }
    const editedDefinition: CardDefinition = {
      ...draft.definition,
      attack: draft.definition.attack + 1,
    };
    finalizeExpansion(project);

    expect(() =>
      applyCardDraftUpdate(project, draft.definition.id, {
        definition: editedDefinition,
      }),
    ).toThrow(/locked/);
  });

  it("allows player to Finalize with warnings but never with invalid Card DSL", () => {
    const warnedProject = createProject();
    warnedProject.riskWarnings.push("High static power estimate");

    const finalized = finalizeExpansion(warnedProject);

    expect(warnedProject.stage).toBe("FINALIZED");
    expect(finalized).toHaveLength(24);
    expect(
      Object.values(warnedProject.cardDrafts).every(
        (draft) => draft.rulesLocked,
      ),
    ).toBe(true);
    expect(Object.isFrozen(finalized[0])).toBe(true);

    const invalidCards = createCards(24);
    invalidCards[0] = {
      ...invalidCards[0]!,
      cost: 99,
    } as CardDefinition;
    const invalidProject = createProject(24, invalidCards);

    expect(() => finalizeExpansion(invalidProject)).toThrow(/invalid Card DSL/);
    expect(invalidProject.stage).not.toBe("FINALIZED");
  });
});
