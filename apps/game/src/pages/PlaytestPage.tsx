import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { PlaytestLab } from "../features/playtest/PlaytestLab";

export function PlaytestPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const expansion = snapshot.world
    ? Object.values(snapshot.world.expansions).sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      )[0]
    : undefined;
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Playtest</h1>
      {expansion === undefined ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          Load a session with an expansion to configure a Playtest.
        </p>
      ) : (
        <PlaytestLab
          expansionId={expansion.id}
          expansionName={expansion.name}
          disabled
          queueCommand={() => undefined}
        />
      )}
    </section>
  );
}
