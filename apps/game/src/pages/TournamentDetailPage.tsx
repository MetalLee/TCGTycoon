import { tournamentId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { TournamentDetail } from "../features/tournaments/TournamentDetail";
import { selectTournaments } from "../features/tournaments/tournament-model";

export function TournamentDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { tournamentId: routeTournamentId } = useParams();
  const tournament =
    snapshot.world === null || routeTournamentId === undefined
      ? undefined
      : selectTournaments(snapshot.world as never).find(
          (item) => item.id === tournamentId(routeTournamentId),
        );
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Tournament Details</h1>
      {tournament === undefined ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          This tournament is not available in the current session.
        </p>
      ) : (
        <TournamentDetail tournament={tournament} />
      )}
    </section>
  );
}
