import { OPERATIONS_CONFIG, type OperationsConfig } from "@tcgtycoon/balance";
import type {
  CardDefinition,
  CardId,
  DeckDefinition,
  ExpansionId,
  OperationId,
  OperationProject,
  PolicyTiming,
  WorldState,
} from "@tcgtycoon/domain";
import {
  validateDeck,
  type ValidationIssue,
  type ValidationResult,
} from "@tcgtycoon/rules-engine";
import { advanceScheduledOperations } from "./scheduler";

export type PolicyChangeKind = "BAN" | "RESTRICTION";

export type BanlistVersion = Readonly<{
  id: string;
  effectiveDay: number;
  bannedCardIds: readonly CardId[];
  restrictedCardIds: readonly CardId[];
}>;

export type ScheduledPolicyChange = {
  id: OperationId;
  kind: PolicyChangeKind;
  cardId: CardId;
  createdDay: number;
  effectiveDay: number;
  timing: PolicyTiming;
  operation: OperationProject;
  activatedVersionId?: string;
};

export type PolicyState = {
  banlistVersions: BanlistVersion[];
  scheduledChanges: ScheduledPolicyChange[];
};

export type SchedulePolicyChangeInput = {
  id: OperationId;
  kind: PolicyChangeKind;
  cardId: CardId;
  createdDay: number;
  timing: PolicyTiming;
};

export type StandardRotationState = {
  activeExpansionIds: ExpansionId[];
  rotatedExpansionIds: ExpansionId[];
};

const EMPTY_BANLIST = freezeBanlist({
  id: "banlist-initial",
  effectiveDay: 0,
  bannedCardIds: [],
  restrictedCardIds: [],
});

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireDay(day: number, name: string): void {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function sortedCardIds(ids: Iterable<CardId>): CardId[] {
  return [...new Set(ids)].sort(compareIds);
}

function freezeBanlist(version: {
  id: string;
  effectiveDay: number;
  bannedCardIds: readonly CardId[];
  restrictedCardIds: readonly CardId[];
}): BanlistVersion {
  return Object.freeze({
    id: version.id,
    effectiveDay: version.effectiveDay,
    bannedCardIds: Object.freeze([...version.bannedCardIds]),
    restrictedCardIds: Object.freeze([...version.restrictedCardIds]),
  });
}

export function createPolicyState(): PolicyState {
  return { banlistVersions: [], scheduledChanges: [] };
}

export function schedulePolicyChange(
  state: PolicyState,
  input: SchedulePolicyChangeInput,
  config: OperationsConfig = OPERATIONS_CONFIG,
): ScheduledPolicyChange {
  requireDay(input.createdDay, "createdDay");
  if (state.scheduledChanges.some((change) => change.id === input.id)) {
    throw new Error(`Duplicate Policy Change ID ${input.id}`);
  }
  const leadDays =
    input.timing === "EMERGENCY"
      ? config.emergencyPolicyLeadDays
      : config.scheduledPolicyLeadDays;
  if (!Number.isInteger(leadDays) || leadDays <= 0) {
    throw new RangeError("Policy lead time must be a positive integer");
  }
  const effectiveDay = input.createdDay + leadDays;
  const operation: OperationProject = {
    id: input.id,
    type: "POLICY_CHANGE",
    createdDay: input.createdDay,
    startDay: effectiveDay,
    completionDay: effectiveDay,
    status: "PLANNED",
    progressDays: 0,
    payload: { kind: input.kind, cardId: input.cardId },
  };
  const change: ScheduledPolicyChange = {
    ...input,
    effectiveDay,
    operation,
  };
  state.scheduledChanges.push(change);
  return change;
}

export function getActiveBanlist(
  state: PolicyState,
  day: number,
): BanlistVersion {
  requireDay(day, "day");
  return (
    state.banlistVersions
      .filter((version) => version.effectiveDay <= day)
      .sort(
        (left, right) =>
          left.effectiveDay - right.effectiveDay ||
          compareIds(left.id, right.id),
      )
      .at(-1) ?? EMPTY_BANLIST
  );
}

function nextBanlistVersion(
  previous: BanlistVersion,
  change: ScheduledPolicyChange,
): BanlistVersion {
  const banned = new Set(previous.bannedCardIds);
  const restricted = new Set(previous.restrictedCardIds);
  if (change.kind === "BAN") {
    banned.add(change.cardId);
    restricted.delete(change.cardId);
  } else if (!banned.has(change.cardId)) {
    restricted.add(change.cardId);
  }
  return freezeBanlist({
    id: `banlist-${change.effectiveDay}-${change.id}`,
    effectiveDay: change.effectiveDay,
    bannedCardIds: sortedCardIds(banned),
    restrictedCardIds: sortedCardIds(restricted),
  });
}

export function activatePolicyChanges(
  state: PolicyState,
  day: number,
): BanlistVersion[] {
  requireDay(day, "day");
  const due = state.scheduledChanges
    .filter(
      (change) =>
        change.activatedVersionId === undefined && change.effectiveDay <= day,
    )
    .sort(
      (left, right) =>
        left.effectiveDay - right.effectiveDay || compareIds(left.id, right.id),
    );
  const activated: BanlistVersion[] = [];

  for (const change of due) {
    advanceScheduledOperations(
      {
        status: "LIVE",
        operations: { [change.operation.id]: change.operation },
      },
      day,
    );
    if (change.operation.status !== "COMPLETED") {
      continue;
    }
    const version = nextBanlistVersion(
      getActiveBanlist(state, change.effectiveDay),
      change,
    );
    state.banlistVersions.push(version);
    change.activatedVersionId = version.id;
    activated.push(version);
  }
  return activated;
}

export function validateDeckForBanlist(
  deck: DeckDefinition,
  cards: readonly CardDefinition[],
  banlist: BanlistVersion,
): ValidationResult {
  const base = validateDeck(deck, cards);
  const issues: ValidationIssue[] = [...base.issues];
  const banned = new Set(banlist.bannedCardIds);
  const restricted = new Set(banlist.restrictedCardIds);
  const counts = new Map<CardId, number>();

  for (const entry of deck.cards) {
    counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + entry.count);
  }
  for (const [cardId, count] of [...counts.entries()].sort(([left], [right]) =>
    compareIds(left, right),
  )) {
    if (banned.has(cardId)) {
      issues.push({
        code: "BANNED_CARD",
        message: `Deck contains banned card ${cardId}.`,
        entityId: cardId,
      });
    } else if (restricted.has(cardId) && count > 1) {
      issues.push({
        code: "RESTRICTED_COPY_LIMIT",
        message: `Deck contains ${count} copies of restricted card ${cardId}; maximum is 1.`,
        entityId: cardId,
      });
    }
  }

  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}

export function applyStandardRotation(
  world: Pick<WorldState, "cards" | "expansions" | "printings">,
  releaseOrder: readonly ExpansionId[],
  config: Pick<OperationsConfig, "standardSetLimit"> = OPERATIONS_CONFIG,
): StandardRotationState {
  if (
    !Number.isInteger(config.standardSetLimit) ||
    config.standardSetLimit <= 0
  ) {
    throw new RangeError("Standard set limit must be a positive integer");
  }
  const seen = new Set<ExpansionId>();
  for (const id of releaseOrder) {
    if (world.expansions[id] === undefined) {
      throw new Error(
        `Standard release order references unknown Expansion ${id}`,
      );
    }
    if (seen.has(id)) {
      throw new Error(
        `Standard release order contains duplicate Expansion ${id}`,
      );
    }
    seen.add(id);
  }
  const rotationIndex = Math.max(
    0,
    releaseOrder.length - config.standardSetLimit,
  );
  return {
    activeExpansionIds: [...releaseOrder.slice(rotationIndex)],
    rotatedExpansionIds: [...releaseOrder.slice(0, rotationIndex)],
  };
}
