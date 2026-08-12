import {
  expansionId,
  operationId,
  type OperationProject,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { advanceScheduledOperations } from "./scheduler";

type SchedulerWorld = Pick<WorldState, "status"> & {
  operations: Record<string, OperationProject>;
};

function createExpansionOperation(
  overrides: Partial<OperationProject> = {},
): OperationProject {
  return {
    id: operationId("operation-expansion-design"),
    type: "EXPANSION_DESIGN",
    createdDay: 1,
    startDay: 3,
    completionDay: 5,
    status: "PLANNED",
    progressDays: 0,
    payload: { expansionId: expansionId("set-future") },
    ...overrides,
  } as OperationProject;
}

function createWorld(
  operation: OperationProject,
  status: WorldState["status"] = "LIVE",
): SchedulerWorld {
  return {
    status,
    operations: { [operation.id]: operation },
  };
}

describe("advanceScheduledOperations", () => {
  it("activates a planned operation on its start day", () => {
    const operation = createExpansionOperation();
    const world = createWorld(operation);

    advanceScheduledOperations(world, operation.startDay!);

    expect(operation.status).toBe("ACTIVE");
  });

  it("increments an active operation once per live day", () => {
    const operation = createExpansionOperation({
      status: "ACTIVE",
      progressDays: 2,
      lastAdvancedDay: 3,
    });
    const world = createWorld(operation);

    advanceScheduledOperations(world, 4);
    advanceScheduledOperations(world, 4);

    expect(operation.progressDays).toBe(3);
    expect(operation.lastAdvancedDay).toBe(4);
  });

  it("completes an operation exactly on its configured completion day", () => {
    const operation = createExpansionOperation({ status: "ACTIVE" });
    const world = createWorld(operation);

    advanceScheduledOperations(world, operation.completionDay! - 1);
    expect(operation.status).toBe("ACTIVE");

    advanceScheduledOperations(world, operation.completionDay!);
    expect(operation.status).toBe("COMPLETED");
  });

  it("does not progress projects during Setup unless the setup service explicitly requests setup playtest progress", () => {
    const design = createExpansionOperation({ status: "ACTIVE" });
    const world = createWorld(design, "SETUP");

    advanceScheduledOperations(world, 4);

    expect(design).toMatchObject({ status: "ACTIVE", progressDays: 0 });

    const playtest: OperationProject = {
      id: operationId("operation-setup-playtest"),
      type: "PLAYTEST",
      createdDay: 0,
      startDay: 0,
      completionDay: 2,
      status: "ACTIVE",
      progressDays: 0,
      payload: {
        expansionId: expansionId("set-launch"),
        tier: "QUICK",
      },
    };
    const setupPlaytestWorld = createWorld(playtest, "SETUP");

    advanceScheduledOperations(setupPlaytestWorld, 1, {
      progressSetupPlaytests: true,
    });

    expect(playtest.progressDays).toBe(1);
  });
});
