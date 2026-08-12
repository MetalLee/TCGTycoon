import { OPERATIONS_CONFIG } from "../../../../../packages/balance/src/index";
import type {
  CardId,
  ExpansionId,
  OperationProject,
  WorldState,
} from "../../../../../packages/domain/src/index";

export type CalendarItem = Readonly<{
  id: string;
  day: number;
  label: string;
  type: OperationProject["type"] | "PRINT_RUN";
  status: string;
}>;

export type ActivePolicyView = Readonly<{
  bannedCardIds: readonly CardId[];
  restrictedCardIds: readonly CardId[];
  activeExpansionIds: readonly ExpansionId[];
  rotatedExpansionIds: readonly ExpansionId[];
}>;

export type OperationsView = Readonly<{
  calendar: readonly CalendarItem[];
  projects: readonly OperationProject[];
  policies: ActivePolicyView;
}>;

function operationLabel(
  world: WorldState,
  operation: OperationProject,
): string {
  switch (operation.type) {
    case "POLICY_CHANGE":
      return `${operation.payload.kind}: ${world.cards[operation.payload.cardId]?.name ?? operation.payload.cardId}`;
    case "TOURNAMENT":
      return `Tournament ${operation.payload.tournamentId}`;
    case "CAMPAIGN":
      return operation.payload.campaignType.replaceAll("_", " ");
    case "EXPANSION_DESIGN":
      return `Design ${world.expansions[operation.payload.expansionId]?.name ?? operation.payload.expansionId}`;
    case "PLAYTEST":
      return `${operation.payload.tier} playtest`;
    case "PRINT_RUN":
      return `Print run ${operation.payload.printRunId}`;
    case "RELEASE":
      return `Release ${world.products[operation.payload.productId]?.name ?? operation.payload.productId}`;
    case "ANNOUNCEMENT":
      return `Announcement ${operation.payload.announcementId}`;
    case "MSRP_ADJUSTMENT":
      return `MSRP ${world.products[operation.payload.productId]?.name ?? operation.payload.productId}`;
  }
}

function releaseOrder(world: WorldState): ExpansionId[] {
  const firstRelease = new Map<ExpansionId, number>();
  for (const event of world.history.events) {
    if (
      event.type !== "PRODUCT_RELEASED" ||
      event.context?.productId === undefined
    )
      continue;
    const expansionId = world.products[event.context.productId]?.expansionId;
    if (
      expansionId !== undefined &&
      (!firstRelease.has(expansionId) ||
        event.day < firstRelease.get(expansionId)!)
    )
      firstRelease.set(expansionId, event.day);
  }
  return [...firstRelease.entries()]
    .sort(
      ([leftId, leftDay], [rightId, rightDay]) =>
        leftDay - rightDay || (leftId < rightId ? -1 : 1),
    )
    .map(([id]) => id);
}

export function selectOperationsView(world: WorldState): OperationsView {
  const projects = Object.values(world.operations ?? {}).sort(
    (left, right) =>
      (left.completionDay ?? Number.MAX_SAFE_INTEGER) -
        (right.completionDay ?? Number.MAX_SAFE_INTEGER) ||
      (left.id < right.id ? -1 : 1),
  );
  const operationCalendar = projects
    .filter((operation) => {
      const day = operation.completionDay ?? operation.startDay;
      return day !== undefined && day >= world.day && day <= world.day + 30;
    })
    .map((operation) => ({
      id: operation.id,
      day: operation.completionDay ?? operation.startDay!,
      label: operationLabel(world, operation),
      type: operation.type,
      status: operation.status,
    }));
  const printRunCalendar: CalendarItem[] = Object.values(world.printRuns)
    .filter(
      (run) =>
        run.status === "PRINTING" &&
        run.completionDay >= world.day &&
        run.completionDay <= world.day + 30,
    )
    .sort(
      (left, right) =>
        left.completionDay - right.completionDay ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    )
    .map((run) => ({
      id: run.id,
      day: run.completionDay,
      label: `Print run ${run.id}`,
      type: "PRINT_RUN",
      status: run.status,
    }));
  const calendar = [...operationCalendar, ...printRunCalendar].sort(
    (left, right) => left.day - right.day || (left.id < right.id ? -1 : 1),
  );
  const banned = new Set<CardId>();
  const restricted = new Set<CardId>();
  for (const operation of projects) {
    if (operation.type !== "POLICY_CHANGE" || operation.status !== "COMPLETED")
      continue;
    if (operation.payload.kind === "BAN") {
      banned.add(operation.payload.cardId);
      restricted.delete(operation.payload.cardId);
    } else if (!banned.has(operation.payload.cardId))
      restricted.add(operation.payload.cardId);
  }
  const released = releaseOrder(world);
  const rotationIndex = Math.max(
    0,
    released.length - OPERATIONS_CONFIG.standardSetLimit,
  );
  return {
    calendar,
    projects,
    policies: {
      bannedCardIds: [...banned].sort(),
      restrictedCardIds: [...restricted].sort(),
      activeExpansionIds: released.slice(rotationIndex),
      rotatedExpansionIds: released.slice(0, rotationIndex),
    },
  };
}
