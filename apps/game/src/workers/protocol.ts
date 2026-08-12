import type {
  PublisherCommand,
  WorldState,
} from "../../../../packages/domain/src/index";
import type {
  BalanceConfig,
  DaySimulationResult,
} from "../../../../packages/sim-core/src/index";

export type SimulateDayRequest = {
  type: "SIMULATE_DAY_REQUEST";
  requestId: string;
  state: WorldState;
  commands: PublisherCommand[];
  config: BalanceConfig;
};

export type SimulateDayProgress = {
  type: "SIMULATE_DAY_PROGRESS";
  requestId: string;
  progress: number;
};

export type SimulateDayResult = {
  type: "SIMULATE_DAY_RESULT";
  requestId: string;
  result: DaySimulationResult;
};

export type SimulateDayError = {
  type: "SIMULATE_DAY_ERROR";
  requestId: string;
  error: {
    name: string;
    message: string;
  };
};

export type SimulationWorkerRequest = SimulateDayRequest;

export type SimulationWorkerResponse =
  SimulateDayProgress | SimulateDayResult | SimulateDayError;

export interface SimulationWorkerTransport {
  postMessage(message: SimulationWorkerRequest): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SimulationWorkerResponse>) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<SimulationWorkerResponse>) => void,
  ): void;
}
