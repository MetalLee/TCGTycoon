import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { ExpansionList } from "../features/expansions/ExpansionList";
import { selectExpansions } from "../selectors/expansions";

export function ExpansionsPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  return (
    <section className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Concept → Design → Playtest → Finalize → Print → Release
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Expansions</h1>
      </header>
      {snapshot.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          Load or create a save to inspect the expansion pipeline.
        </p>
      ) : (
        <ExpansionList expansions={selectExpansions(snapshot.world)} />
      )}
    </section>
  );
}
