import { simulateDay } from "../../../../packages/sim-core/src/index";
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from "./protocol";

type SimulationWorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SimulationWorkerRequest>) => void,
  ): void;
  postMessage(message: SimulationWorkerResponse): void;
};

const workerScope = self as unknown as SimulationWorkerScope;

function serializeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: String(error) };
}

export function handleSimulationRequest(
  request: SimulationWorkerRequest,
): SimulationWorkerResponse {
  try {
    return {
      type: "SIMULATE_DAY_RESULT",
      requestId: request.requestId,
      result: simulateDay(
        structuredClone(request.state),
        structuredClone(request.commands),
        structuredClone(request.config),
      ),
    };
  } catch (error) {
    return {
      type: "SIMULATE_DAY_ERROR",
      requestId: request.requestId,
      error: serializeError(error),
    };
  }
}

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  workerScope.postMessage({
    type: "SIMULATE_DAY_PROGRESS",
    requestId: request.requestId,
    progress: 0,
  });
  const response = handleSimulationRequest(request);
  if (response.type === "SIMULATE_DAY_RESULT") {
    workerScope.postMessage({
      type: "SIMULATE_DAY_PROGRESS",
      requestId: request.requestId,
      progress: 1,
    });
  }
  workerScope.postMessage(response);
});
