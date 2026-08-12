import { OPERATIONS_CONFIG, type OperationsConfig } from "@tcgtycoon/balance";
import {
  type CardDefinition,
  type CardId,
  type CardDraftFlavor,
  type ExpansionBrief,
  type ExpansionCardDraft,
  type ExpansionId,
  type ExpansionPipelineProject,
  type OperationId,
  type OperationProject,
} from "@tcgtycoon/domain";
import { validateCardDefinition } from "@tcgtycoon/rules-engine";

export type PostLaunchExpansionSize = 24 | 32 | 36;
export type {
  CardDraftFlavor,
  DesignSlotMetadata,
  ExpansionCardDraft,
  ExpansionPipelineProject,
  ExpansionStage,
} from "@tcgtycoon/domain";

export type CreateExpansionInput = {
  id: ExpansionId;
  operationId: OperationId;
  name: string;
  size: number;
  createdDay: number;
  brief: ExpansionBrief;
  cards?: readonly CardDefinition[];
};

export type CardDraftUpdate = {
  definition?: CardDefinition;
  flavor?: Partial<CardDraftFlavor>;
};

function requirePostLaunchSize(
  size: number,
): asserts size is PostLaunchExpansionSize {
  if (size !== 24 && size !== 32 && size !== 36) {
    throw new RangeError("Post-launch expansions require 24, 32 or 36 cards");
  }
}

function requireNonNegativeDay(day: number): void {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError("Expansion createdDay must be a non-negative integer");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function gameplayEquals(left: CardDefinition, right: CardDefinition): boolean {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

function cloneDefinition(definition: CardDefinition): CardDefinition {
  return structuredClone(definition);
}

function createDraft(
  definition: CardDefinition,
  index: number,
): ExpansionCardDraft {
  return {
    definition: cloneDefinition(definition),
    gameplayRevision: 1,
    rulesLocked: false,
    slot: {
      index,
      intendedFactionId: definition.factionId,
      intendedRarity: definition.rarity,
      intendedCardType: definition.type,
    },
    flavor: {
      displayText: definition.name,
      flavorText: "",
    },
  };
}

export function createExpansion(
  input: CreateExpansionInput,
  config: OperationsConfig = OPERATIONS_CONFIG,
): ExpansionPipelineProject {
  requirePostLaunchSize(input.size);
  requireNonNegativeDay(input.createdDay);
  const designTargetDays = config.expansionDesignDaysBySize[input.size];
  if (!Number.isInteger(designTargetDays) || designTargetDays <= 0) {
    throw new RangeError(
      "Expansion design duration must be a positive integer",
    );
  }

  const cards = input.cards ?? [];
  if (cards.length > input.size) {
    throw new RangeError(
      "Expansion drafts cannot exceed the selected set size",
    );
  }
  const cardIds = new Set<string>();
  const cardDrafts: Record<string, ExpansionCardDraft> = {};
  cards.forEach((card, index) => {
    if (cardIds.has(card.id)) {
      throw new Error(`Expansion contains duplicate Card ID ${card.id}`);
    }
    cardIds.add(card.id);
    cardDrafts[card.id] = createDraft(card, index);
  });

  return {
    id: input.id,
    operationId: input.operationId,
    name: input.name,
    size: input.size,
    createdDay: input.createdDay,
    brief: structuredClone(input.brief),
    cardIds: cards.map((card) => card.id),
    stage: "CONCEPT",
    designProgressDays: 0,
    designTargetDays,
    cardDrafts,
    riskWarnings: [],
    finalizedCards: {},
  };
}

export function advanceExpansionDesign(
  project: ExpansionPipelineProject,
  operation: OperationProject,
): ExpansionPipelineProject {
  if (
    operation.type !== "EXPANSION_DESIGN" ||
    operation.id !== project.operationId ||
    operation.payload.expansionId !== project.id
  ) {
    throw new Error(
      "Expansion design requires its matching scheduled operation",
    );
  }
  if (
    project.stage === "FINALIZED" ||
    project.stage === "PRINTING" ||
    project.stage === "RELEASED"
  ) {
    throw new Error(`Expansion design cannot advance during ${project.stage}`);
  }
  if (operation.status !== "ACTIVE" && operation.status !== "COMPLETED") {
    return project;
  }

  project.stage = "DESIGN";
  project.designProgressDays = Math.min(
    project.designTargetDays,
    operation.status === "COMPLETED"
      ? project.designTargetDays
      : Math.max(project.designProgressDays, operation.progressDays),
  );
  return project;
}

export function applyCardDraftUpdate(
  project: ExpansionPipelineProject,
  id: CardId,
  update: CardDraftUpdate,
): ExpansionCardDraft {
  const draft = project.cardDrafts[id];
  if (draft === undefined) {
    if (update.definition === undefined) {
      throw new Error(`Unknown expansion Card Draft ${id}`);
    }
    if (update.definition.id !== id) {
      throw new Error("A Card Draft update cannot change its stable Card ID");
    }
    if (project.cardIds.length >= project.size) {
      throw new Error(`Expansion already contains ${project.size} Card Drafts`);
    }
    const added = createDraft(update.definition, project.cardIds.length);
    if (update.flavor !== undefined) {
      added.flavor = { ...added.flavor, ...update.flavor };
    }
    project.cardDrafts[id] = added;
    project.cardIds.push(id);
    project.stage = "DESIGN";
    return added;
  }

  if (update.definition !== undefined) {
    if (draft.rulesLocked) {
      throw new Error(`Card Draft ${id} gameplay rules are locked`);
    }
    if (update.definition.id !== id) {
      throw new Error("A Card Draft update cannot change its stable Card ID");
    }
    if (!gameplayEquals(draft.definition, update.definition)) {
      draft.definition = cloneDefinition(update.definition);
      draft.gameplayRevision += 1;
    }
  }

  if (update.flavor !== undefined) {
    draft.flavor = { ...draft.flavor, ...update.flavor };
  }
  if (project.stage === "CONCEPT") {
    project.stage = "DESIGN";
  }
  return draft;
}

export function finalizeExpansion(
  project: ExpansionPipelineProject,
): readonly CardDefinition[] {
  const drafts = Object.values(project.cardDrafts).sort(
    (left, right) => left.slot.index - right.slot.index,
  );
  if (drafts.length !== project.size) {
    throw new Error(
      `Expansion requires ${project.size} Card Drafts before Finalize; found ${drafts.length}`,
    );
  }

  const issues = drafts.flatMap((draft) => {
    const result = validateCardDefinition(draft.definition);
    return result.valid ? [] : result.issues;
  });
  if (issues.length > 0) {
    throw new Error(
      `Cannot Finalize expansion with invalid Card DSL: ${issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  const finalized = drafts.map((draft) =>
    deepFreeze(cloneDefinition(draft.definition)),
  );
  project.finalizedCards = Object.fromEntries(
    finalized.map((definition) => [definition.id, definition]),
  );
  drafts.forEach((draft) => {
    draft.definition = project.finalizedCards[draft.definition.id]!;
    draft.rulesLocked = true;
  });
  project.stage = "FINALIZED";
  return finalized;
}
