import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { MetaOverview } from "../features/meta/MetaOverview";
import { selectMetaOverview } from "../selectors/meta";

export function MetaPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Meta</h1>
        <p className="mt-2 text-slate-400">
          Observed decks, sample confidence, and the measured contributors to
          ecosystem health.
        </p>
      </header>
      {snapshot.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Load a save to inspect the live Meta.
        </p>
      ) : (
        <MetaOverview view={selectMetaOverview(snapshot.world as never)} />
      )}
    </section>
  );
}
