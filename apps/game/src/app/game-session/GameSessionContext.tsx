import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  GameSessionController,
  type GameSessionSnapshot,
} from "./GameSessionController";

const GameSessionContext = createContext<GameSessionController | null>(null);

export type GameSessionProviderProps = {
  controller: GameSessionController;
  children: ReactNode;
};

export function GameSessionProvider({
  controller,
  children,
}: GameSessionProviderProps) {
  return <GameSessionContext value={controller}>{children}</GameSessionContext>;
}

export function useGameSessionController(): GameSessionController {
  const controller = useContext(GameSessionContext);
  if (controller === null) {
    throw new Error("Game session hooks require GameSessionProvider");
  }
  return controller;
}

export function useGameSessionSnapshot(): GameSessionSnapshot {
  const controller = useGameSessionController();
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
