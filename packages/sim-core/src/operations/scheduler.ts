import type {
  OperationId,
  OperationProject,
  WorldState,
} from "@tcgtycoon/domain";

type SchedulableWorld = Pick<WorldState, "status" | "operations">;

export type AdvanceScheduledOperationsOptions = {
  progressSetupPlaytests?: boolean;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canProgress(
  world: SchedulableWorld,
  operation: OperationProject,
  options: AdvanceScheduledOperationsOptions,
): boolean {
  if (world.status !== "SETUP") {
    return true;
  }
  return (
    options.progressSetupPlaytests === true && operation.type === "PLAYTEST"
  );
}

export function advanceScheduledOperations(
  world: SchedulableWorld,
  day: number,
  options: AdvanceScheduledOperationsOptions = {},
): OperationId[] {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(
      "Scheduled operations require a non-negative integer day",
    );
  }

  const changed: OperationId[] = [];
  const operations = Object.values(world.operations ?? {}).sort((left, right) =>
    compareIds(left.id, right.id),
  );

  for (const operation of operations) {
    if (!canProgress(world, operation, options)) {
      continue;
    }

    let didChange = false;
    if (
      operation.status === "PLANNED" &&
      operation.startDay !== undefined &&
      operation.startDay <= day
    ) {
      operation.status = "ACTIVE";
      didChange = true;
    }

    if (operation.status !== "ACTIVE") {
      if (didChange) {
        changed.push(operation.id);
      }
      continue;
    }

    if (operation.lastAdvancedDay !== day) {
      operation.progressDays += 1;
      operation.lastAdvancedDay = day;
      didChange = true;
    }

    if (
      operation.completionDay !== undefined &&
      operation.completionDay <= day
    ) {
      operation.status = "COMPLETED";
      didChange = true;
    }

    if (didChange) {
      changed.push(operation.id);
    }
  }

  return changed;
}
