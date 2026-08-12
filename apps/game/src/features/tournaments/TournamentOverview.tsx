import { useState } from "react";
import { Link } from "react-router";
import type { TournamentView } from "./tournament-model";

export type TournamentOverviewProps = {
  tournaments: readonly TournamentView[];
};
const statuses = ["UPCOMING", "RUNNING", "COMPLETED"] as const;

export function TournamentOverview({ tournaments }: TournamentOverviewProps) {
  const [status, setStatus] = useState<(typeof statuses)[number]>("UPCOMING");
  const visible = tournaments.filter(
    (tournament) => tournament.status === status,
  );
  return (
    <section className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Tournament status">
        {statuses.map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={status === item}
            onClick={() => setStatus(item)}
            className={`rounded px-3 py-2 text-sm ${status === item ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400"}`}
          >
            {item.slice(0, 1) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          No {status.toLowerCase()} tournaments.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((tournament) => (
            <li
              key={tournament.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {tournament.preset} · Day {tournament.eventDay}
              </p>
              <Link
                className="mt-2 block font-semibold text-emerald-300"
                to={`/tournaments/${tournament.id}`}
              >
                {tournament.name}
              </Link>
              <p className="mt-2 text-sm text-slate-400">
                {tournament.result
                  ? `${tournament.result.top8.length} Top 8 decks · ${tournament.result.matches.length} matches`
                  : tournament.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
