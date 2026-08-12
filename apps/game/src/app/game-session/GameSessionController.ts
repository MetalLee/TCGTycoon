import type {
  PublisherCommand,
  SaveEnvelope,
  SaveId,
  WorldState,
} from "../../../../../packages/domain/src/index";
import type { SaveRepository } from "../../../../../packages/persistence/src/index";
import type { BalanceConfig } from "../../../../../packages/sim-core/src/index";
import type { SimulationWorkerTransport } from "../../workers/protocol";
import { runEndDaySimulation } from "./end-day";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

export type GameSessionStatus =
  "UNLOADED" | "LOADING" | "IDLE" | "SIMULATING" | "SAVING";

export type GameSessionSnapshot = Readonly<{
  status: GameSessionStatus;
  saveId: SaveId | null;
  world: DeepReadonly<WorldState> | null;
  pendingCommands: readonly DeepReadonly<PublisherCommand>[];
  progress: number | null;
  error: string | null;
}>;

export type GameSessionControllerOptions = {
  repository: SaveRepository;
  worker: SimulationWorkerTransport;
  config: BalanceConfig;
  configForWorld?: (world: WorldState) => BalanceConfig;
  now?: () => string;
};

function deepFreeze<T>(value: T, seen = new Set<object>()): DeepReadonly<T> {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value) as DeepReadonly<T>;
}

function immutableClone<T>(value: T): DeepReadonly<T> {
  return deepFreeze(structuredClone(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class GameSessionController {
  readonly #repository: SaveRepository;
  readonly #worker: SimulationWorkerTransport;
  readonly #config: BalanceConfig;
  readonly #configForWorld: ((world: WorldState) => BalanceConfig) | undefined;
  readonly #now: () => string;
  readonly #listeners = new Set<() => void>();
  #save: SaveEnvelope | null = null;
  #requestSequence = 0;
  #snapshot: GameSessionSnapshot = immutableClone({
    status: "UNLOADED" as const,
    saveId: null,
    world: null,
    pendingCommands: [],
    progress: null,
    error: null,
  });

  constructor(options: GameSessionControllerOptions) {
    this.#repository = options.repository;
    this.#worker = options.worker;
    this.#config = structuredClone(options.config);
    this.#configForWorld = options.configForWorld;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  getSnapshot = (): GameSessionSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async load(id: SaveId): Promise<void> {
    this.#requireNotBusy("load");
    this.#update({ status: "LOADING", error: null });
    try {
      const loaded = await this.#repository.load(id);
      this.#save = structuredClone(loaded);
      this.#snapshot = immutableClone({
        status: "IDLE" as const,
        saveId: loaded.saveId,
        world: loaded.state,
        pendingCommands: [],
        progress: null,
        error: null,
      });
      this.#emit();
    } catch (error) {
      this.#save = null;
      this.#snapshot = immutableClone({
        status: "UNLOADED" as const,
        saveId: null,
        world: null,
        pendingCommands: [],
        progress: null,
        error: errorMessage(error),
      });
      this.#emit();
      throw error;
    }
  }

  queueCommand(command: PublisherCommand): void {
    this.#requireIdle("queue a command");
    this.#update({
      pendingCommands: [
        ...this.#snapshot.pendingCommands,
        immutableClone(command),
      ],
      error: null,
    });
  }

  discardPendingCommand(index: number): void {
    this.#requireIdle("discard a command");
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.#snapshot.pendingCommands.length
    ) {
      throw new RangeError(`Pending command index ${index} is out of range`);
    }
    this.#update({
      pendingCommands: this.#snapshot.pendingCommands.filter(
        (_, commandIndex) => commandIndex !== index,
      ),
      error: null,
    });
  }

  async endDay(): Promise<void> {
    this.#requireIdle("end the day");
    if (this.#save === null || this.#snapshot.world === null) {
      throw new Error("Cannot end day before loading a save");
    }
    const currentSave = structuredClone(this.#save);
    const currentWorld = structuredClone(this.#snapshot.world) as WorldState;
    const commands = structuredClone(
      this.#snapshot.pendingCommands,
    ) as PublisherCommand[];
    const requestId = `simulate-day-${++this.#requestSequence}`;
    this.#update({ status: "SIMULATING", progress: 0, error: null });

    try {
      const result = await runEndDaySimulation(this.#worker, {
        requestId,
        state: currentWorld,
        commands,
        config: this.#configForWorld?.(currentWorld) ?? this.#config,
        onProgress: (progress) => {
          if (this.#snapshot.status === "SIMULATING") {
            this.#update({ progress });
          }
        },
      });
      this.#update({ status: "SAVING", progress: 1 });
      const committed: SaveEnvelope = {
        ...currentSave,
        schemaVersion: result.nextState.schemaVersion,
        simulationVersion: result.nextState.simulationVersion,
        ruleVersion: result.nextState.ruleVersion,
        balanceVersion: result.nextState.balanceVersion,
        worldSeed: result.nextState.worldSeed,
        updatedAt: this.#now(),
        state: result.nextState,
      };
      await this.#repository.save(structuredClone(committed));
      this.#save = structuredClone(committed);
      this.#snapshot = immutableClone({
        status: "IDLE" as const,
        saveId: committed.saveId,
        world: committed.state,
        pendingCommands: [],
        progress: null,
        error: null,
      });
      this.#emit();
    } catch (error) {
      this.#save = currentSave;
      this.#snapshot = immutableClone({
        status: "IDLE" as const,
        saveId: currentSave.saveId,
        world: currentSave.state,
        pendingCommands: commands,
        progress: null,
        error: errorMessage(error),
      });
      this.#emit();
      throw error;
    }
  }

  #requireIdle(action: string): void {
    if (this.#snapshot.status !== "IDLE") {
      throw new Error(
        `Cannot ${action} while session is ${this.#snapshot.status}`,
      );
    }
  }

  #requireNotBusy(action: string): void {
    if (
      this.#snapshot.status === "LOADING" ||
      this.#snapshot.status === "SIMULATING" ||
      this.#snapshot.status === "SAVING"
    ) {
      throw new Error(
        `Cannot ${action} while session is ${this.#snapshot.status}`,
      );
    }
  }

  #update(patch: Partial<GameSessionSnapshot>): void {
    this.#snapshot = immutableClone({ ...this.#snapshot, ...patch });
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
