import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import type { PublisherCommand } from "../../../../packages/domain/src/index";
import {
  createOfflineExpansionCommands,
  OFFLINE_EXPANSION_ID,
} from "../features/expansions/offline-expansion-fixture";
import { ExpansionList } from "../features/expansions/ExpansionList";
import { selectExpansions } from "../selectors/expansions";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function ExpansionsPage() {
  const snapshot = useOutletContext<Outlet>();
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
        <>
          {snapshot.queueCommand !== undefined &&
            snapshot.world.expansions[OFFLINE_EXPANSION_ID] === undefined && (
              <section className="rounded-xl border border-slate-800 p-5">
                <h2 className="font-semibold">Offline manual content path</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Queue a deterministic legal 24-card fixture through typed
                  publisher commands. No network AI is used.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950"
                  onClick={() =>
                    createOfflineExpansionCommands().forEach((command) =>
                      snapshot.queueCommand?.(command),
                    )
                  }
                >
                  Queue offline fixture expansion
                </button>
              </section>
            )}
          <ExpansionList expansions={selectExpansions(snapshot.world)} />
        </>
      )}
    </section>
  );
}
