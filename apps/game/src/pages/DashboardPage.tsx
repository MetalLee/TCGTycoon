import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { DashboardView } from "../features/dashboard/DashboardView";
import { selectDashboardView } from "../selectors/dashboard";

export function DashboardPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  return (
    <section className="space-y-8">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Publisher workbench
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          See ecosystem health, understand the current drivers, and prepare the
          next day’s decisions.
        </p>
      </header>
      {snapshot.world === null ? (
        <p className="rounded border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
          Load or create a save to view publisher health.
        </p>
      ) : (
        <DashboardView view={selectDashboardView(snapshot.world)} />
      )}
    </section>
  );
}
