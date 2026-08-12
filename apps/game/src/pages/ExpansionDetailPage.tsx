import { expansionId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { selectExpansions } from "../selectors/expansions";

export function ExpansionDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { setId } = useParams();
  const expansion =
    snapshot.world === null || setId === undefined
      ? undefined
      : selectExpansions(snapshot.world).find(
          (candidate) => candidate.id === expansionId(setId),
        );
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Expansion Details</h1>
      {expansion === undefined ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          This expansion is not available in the current session.
        </p>
      ) : (
        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {expansion.stage}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{expansion.name}</h2>
          <p className="mt-3 text-sm text-slate-400">
            {expansion.cardCount} printed CardDefinitions · Design{" "}
            {expansion.designProgressDays}/{expansion.designTargetDays ?? "—"}{" "}
            days
          </p>
        </article>
      )}
    </section>
  );
}
