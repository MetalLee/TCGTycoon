import { Link } from "react-router";
import type { TournamentView } from "./tournament-model";

export type TournamentDetailProps = { tournament: TournamentView };

export function TournamentDetail({ tournament }: TournamentDetailProps) {
  const result = tournament.result;
  return (
    <article className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-400">
          {tournament.preset} · Day {tournament.eventDay} · {tournament.status}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{tournament.name}</h2>
      </header>
      {result === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Registration and results become available when deterministic
          tournament simulation completes.
        </p>
      ) : (
        <>
          <section className="rounded border border-slate-800 p-4">
            <h3 className="font-semibold">Top 8</h3>
            <ol className="mt-3 space-y-2 text-sm">
              {result.top8.map((placement) => (
                <li key={placement.placement}>
                  <span className="mr-2 text-slate-500">
                    #{placement.placement}
                  </span>
                  <Link
                    className="text-emerald-300"
                    to={`/meta/decks/${placement.deckId}`}
                  >
                    {placement.deckId}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded border border-slate-800 p-4">
            <h3 className="font-semibold">Notable matches</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {result.matches
                .filter((match) => match.replay !== undefined)
                .map((match) => (
                  <li key={match.id}>
                    <Link
                      className="text-emerald-300"
                      to={`/matches/${match.id}`}
                    >
                      {match.isFinal ? "Final" : `Round ${match.round}`} ·{" "}
                      {match.id}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </article>
  );
}
