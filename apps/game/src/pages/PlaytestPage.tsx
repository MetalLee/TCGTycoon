import { Link, useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import type { PublisherCommand } from "../../../../packages/domain/src/index";
import { PlaytestLab } from "../features/playtest/PlaytestLab";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function PlaytestPage() {
  const snapshot = useOutletContext<Outlet>();
  const expansion = snapshot.world
    ? Object.values(snapshot.world.expansionProjects ?? {}).sort(
        (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
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
        <>
          <PlaytestLab
            expansionId={expansion.id}
            expansionName={expansion.name}
            disabled={snapshot.queueCommand === undefined}
            queueCommand={snapshot.queueCommand ?? (() => undefined)}
          />
          {snapshot.world?.operationEvidence !== undefined && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Completed reports</h2>
              {Object.values(
                snapshot.world.operationEvidence.playtests.reports,
              ).map((report) => (
                <Link
                  key={report.id}
                  className="block rounded border border-slate-800 p-4 text-emerald-300"
                  to={`/playtest/${report.id}`}
                >
                  {report.tier} report · {report.matchesRun} matches ·{" "}
                  {report.status}
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
