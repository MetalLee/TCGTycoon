import { Link } from "react-router";
import type { ActivePolicyView } from "./operations-model";

export type PoliciesViewProps = { policies: ActivePolicyView };

export function PoliciesView({ policies }: PoliciesViewProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="font-semibold">Active Banlist</h2>
        <h3 className="mt-4 text-sm text-slate-400">Banned</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {policies.bannedCardIds.length === 0 ? (
            <li>None</li>
          ) : (
            policies.bannedCardIds.map((id) => (
              <li key={id}>
                <Link className="text-emerald-300" to={`/cards/${id}`}>
                  {id}
                </Link>
              </li>
            ))
          )}
        </ul>
        <h3 className="mt-4 text-sm text-slate-400">Restricted</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {policies.restrictedCardIds.length === 0 ? (
            <li>None</li>
          ) : (
            policies.restrictedCardIds.map((id) => (
              <li key={id}>
                <Link className="text-emerald-300" to={`/cards/${id}`}>
                  {id}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="font-semibold">Standard Rotation</h2>
        <h3 className="mt-4 text-sm text-slate-400">Active sets</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {policies.activeExpansionIds.length === 0 ? (
            <li>No released Standard sets</li>
          ) : (
            policies.activeExpansionIds.map((id) => (
              <li key={id}>
                <Link className="text-emerald-300" to={`/expansions/${id}`}>
                  {id}
                </Link>
              </li>
            ))
          )}
        </ul>
        <h3 className="mt-4 text-sm text-slate-400">Rotated sets</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {policies.rotatedExpansionIds.length === 0 ? (
            <li>None</li>
          ) : (
            policies.rotatedExpansionIds.map((id) => <li key={id}>{id}</li>)
          )}
        </ul>
      </div>
    </section>
  );
}
