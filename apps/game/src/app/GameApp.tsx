import { RouterProvider } from "react-router";
import { saveRepository } from "../platform/save-repository";
import { DEFAULT_BALANCE_CONFIG } from "../../../../packages/sim-core/src/index";
import { GameSessionController } from "./game-session/GameSessionController";
import { createOfflineLaunchBalanceConfig } from "../features/new-game/setup-service";
import { createAppRouter } from "./router";

const simulationWorker = new Worker(
  new URL("../workers/simulation.worker.ts", import.meta.url),
  { type: "module" },
);

const gameSessionController = new GameSessionController({
  repository: saveRepository,
  worker: simulationWorker,
  config: DEFAULT_BALANCE_CONFIG,
  configForWorld: createOfflineLaunchBalanceConfig,
});

const gameRouter = createAppRouter(gameSessionController, saveRepository);

export function GameApp() {
  return <RouterProvider router={gameRouter} />;
}
