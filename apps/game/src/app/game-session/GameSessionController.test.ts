import {
  saveId,
  type PublisherCommand,
  type SaveEnvelope,
  type SaveId,
  type SaveMetadata,
} from "../../../../../packages/domain/src/index";
import type { SaveRepository } from "../../../../../packages/persistence/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  simulateDay,
} from "../../../../../packages/sim-core/src/index";
import { createTestWorld } from "../../../../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
  SimulationWorkerTransport,
} from "../../workers/protocol";
import { GameSessionController } from "./GameSessionController";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class FakeWorker implements SimulationWorkerTransport {
  readonly requests: SimulationWorkerRequest[] = [];
  readonly listeners = new Set<
    (event: MessageEvent<SimulationWorkerResponse>) => void
  >();

  postMessage(message: SimulationWorkerRequest): void {
    this.requests.push(structuredClone(message));
  }

  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SimulationWorkerResponse>) => void,
  ): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<SimulationWorkerResponse>) => void,
  ): void {
    if (type === "message") this.listeners.delete(listener);
  }

  respond(message: SimulationWorkerResponse): void {
    for (const listener of this.listeners) {
      listener({
        data: structuredClone(message),
      } as MessageEvent<SimulationWorkerResponse>);
    }
  }
}

class DeferredSaveRepository implements SaveRepository {
  readonly saved: SaveEnvelope[] = [];
  nextSave = deferred<void>();

  constructor(private readonly initial: SaveEnvelope) {}

  async list(): Promise<SaveMetadata[]> {
    const { state, ...metadata } = this.initial;
    void state;
    return [metadata];
  }

  async load(id: SaveId): Promise<SaveEnvelope> {
    if (id !== this.initial.saveId) throw new Error(`Unknown save ${id}`);
    return structuredClone(this.initial);
  }

  async save(save: SaveEnvelope): Promise<void> {
    this.saved.push(structuredClone(save));
    return this.nextSave.promise;
  }

  async delete(): Promise<void> {}
}

const pendingCommand: PublisherCommand = {
  type: "PUBLISH_ANNOUNCEMENT",
  topic: "DEVELOPMENT",
  text: "Development continues.",
};

function createSave(): SaveEnvelope {
  const state = createTestWorld("atomic-end-day");
  return {
    saveId: saveId("save-atomic-end-day"),
    schemaVersion: state.schemaVersion,
    simulationVersion: state.simulationVersion,
    ruleVersion: state.ruleVersion,
    balanceVersion: state.balanceVersion,
    appVersion: "test",
    worldSeed: state.worldSeed,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    state,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("GameSessionController atomic End Day", () => {
  it("does not expose the simulated result or clear commands until save resolves", async () => {
    const save = createSave();
    const repository = new DeferredSaveRepository(save);
    const worker = new FakeWorker();
    const controller = new GameSessionController({
      repository,
      worker,
      config: DEFAULT_BALANCE_CONFIG,
      now: () => "2026-08-12T01:00:00.000Z",
    });
    await controller.load(save.saveId);
    controller.queueCommand(pendingCommand);

    const endDay = controller.endDay();
    const request = worker.requests[0];
    expect(request).toMatchObject({
      type: "SIMULATE_DAY_REQUEST",
      state: { day: save.state.day },
      commands: [pendingCommand],
    });
    if (request?.type !== "SIMULATE_DAY_REQUEST") {
      throw new Error("Expected a simulation request");
    }
    const result = simulateDay(request.state, request.commands, request.config);
    worker.respond({
      type: "SIMULATE_DAY_RESULT",
      requestId: request.requestId,
      result,
    });
    await flushMicrotasks();

    expect(repository.saved).toHaveLength(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: "SAVING",
      world: { day: save.state.day },
      pendingCommands: [pendingCommand],
    });

    repository.nextSave.resolve();
    await expect(endDay).resolves.toEqual(result);

    expect(controller.getSnapshot()).toMatchObject({
      status: "IDLE",
      world: { day: result.nextState.day },
      pendingCommands: [],
    });
  });

  it("keeps the current day and pending commands when save fails", async () => {
    const save = createSave();
    const repository = new DeferredSaveRepository(save);
    const worker = new FakeWorker();
    const controller = new GameSessionController({
      repository,
      worker,
      config: DEFAULT_BALANCE_CONFIG,
      now: () => "2026-08-12T01:00:00.000Z",
    });
    await controller.load(save.saveId);
    controller.queueCommand(pendingCommand);

    const endDay = controller.endDay();
    const request = worker.requests[0];
    if (request?.type !== "SIMULATE_DAY_REQUEST") {
      throw new Error("Expected a simulation request");
    }
    worker.respond({
      type: "SIMULATE_DAY_RESULT",
      requestId: request.requestId,
      result: simulateDay(request.state, request.commands, request.config),
    });
    await flushMicrotasks();
    repository.nextSave.reject(new Error("disk full"));

    await expect(endDay).rejects.toThrow("disk full");
    expect(controller.getSnapshot()).toMatchObject({
      status: "IDLE",
      world: { day: save.state.day },
      pendingCommands: [pendingCommand],
      error: "disk full",
    });
  });
});
