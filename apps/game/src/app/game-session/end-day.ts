import type {
  PublisherCommand,
  WorldState,
} from "../../../../../packages/domain/src/index";
import type {
  BalanceConfig,
  DaySimulationResult,
} from "../../../../../packages/sim-core/src/index";
import type {
  SimulationWorkerResponse,
  SimulationWorkerTransport,
} from "../../workers/protocol";

export type RunEndDayInput = {
  requestId: string;
  state: WorldState;
  commands: readonly PublisherCommand[];
  config: BalanceConfig;
  onProgress?: (progress: number) => void;
};

export function runEndDaySimulation(
  worker: SimulationWorkerTransport,
  input: RunEndDayInput,
): Promise<DaySimulationResult> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<SimulationWorkerResponse>) => {
      const message = event.data;
      if (message.requestId !== input.requestId) return;
      if (message.type === "SIMULATE_DAY_PROGRESS") {
        input.onProgress?.(message.progress);
        return;
      }
      worker.removeEventListener("message", handleMessage);
      if (message.type === "SIMULATE_DAY_ERROR") {
        const error = new Error(message.error.message);
        error.name = message.error.name;
        reject(error);
        return;
      }
      resolve(structuredClone(message.result));
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      type: "SIMULATE_DAY_REQUEST",
      requestId: input.requestId,
      state: structuredClone(input.state),
      commands: structuredClone([...input.commands]),
      config: structuredClone(input.config),
    });
  });
}
