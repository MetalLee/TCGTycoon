import { useOutletContext } from "react-router";
import type { PublisherCommand } from "../../../../packages/domain/src/index";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { TournamentCreateDialog } from "../features/tournaments/TournamentCreateDialog";
import { TournamentOverview } from "../features/tournaments/TournamentOverview";
import { selectTournaments } from "../features/tournaments/tournament-model";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function TournamentsPage() {
  const outlet = useOutletContext<Outlet>();
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Tournaments</h1>
        <p className="mt-2 text-slate-400">
          Schedule official events and inspect deterministic results.
        </p>
      </header>
      {outlet.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Load a save to view tournaments.
        </p>
      ) : (
        <>
          {outlet.queueCommand && (
            <TournamentCreateDialog
              currentDay={outlet.world.day}
              queueCommand={outlet.queueCommand}
            />
          )}
          <TournamentOverview
            tournaments={selectTournaments(outlet.world as never)}
          />
        </>
      )}
    </section>
  );
}
