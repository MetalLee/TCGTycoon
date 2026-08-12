import { Link } from "react-router";
import type { ExpansionSummary } from "../../selectors/expansions";

export type ExpansionListProps = {
  expansions: readonly ExpansionSummary[];
};

export function ExpansionList({ expansions }: ExpansionListProps) {
  return (
    <section className="space-y-4" aria-labelledby="expansion-list-title">
      <h2 id="expansion-list-title" className="text-xl font-semibold">
        Expansion Pipeline
      </h2>
      {expansions.length === 0 ? (
        <p className="text-sm text-slate-400">No expansion exists yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {expansions.map((expansion) => (
            <li
              key={expansion.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {expansion.stage}
              </p>
              <Link
                to={`/expansions/${expansion.id}`}
                className="mt-2 block text-lg font-semibold text-slate-100"
              >
                {expansion.name}
              </Link>
              <p className="mt-2 text-sm text-slate-400">
                {expansion.cardCount} cards · Design{" "}
                {expansion.designProgressDays}/
                {expansion.designTargetDays ?? "—"} days
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
