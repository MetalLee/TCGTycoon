import type { WorldEvent } from "../../../../packages/domain/src/index";
import type { DailyReport } from "../../../../packages/sim-core/src/index";
import { useLocation, useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { DailyReportView } from "../features/daily-report/DailyReportView";

export type DailyReportRouteState = {
  report: DailyReport;
  notableEvents: WorldEvent[];
  previousReport?: DailyReport | undefined;
};

function isDailyReportRouteState(
  value: unknown,
): value is DailyReportRouteState {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<DailyReportRouteState>;
  return (
    candidate.report !== undefined &&
    typeof candidate.report.day === "number" &&
    Array.isArray(candidate.notableEvents)
  );
}

export function DailyReportPage() {
  const { day } = useParams();
  const location = useLocation();
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const persisted =
    day === undefined ? undefined : snapshot.world?.dailyReports?.[day];
  const state = isDailyReportRouteState(location.state)
    ? location.state
    : persisted === undefined
      ? null
      : { report: persisted.report, notableEvents: persisted.notableEvents };

  return (
    <section className="space-y-8">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Day {day ?? state?.report.day ?? "—"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Daily Report</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          The highest-impact structured events first, followed by the day’s
          measured publisher and ecosystem outcomes.
        </p>
      </header>
      {state === null ? (
        <p className="rounded border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
          This report is not available in the current session.
        </p>
      ) : (
        <DailyReportView
          report={state.report}
          notableEvents={state.notableEvents}
          {...("previousReport" in state && state.previousReport !== undefined
            ? { previousReport: state.previousReport }
            : {})}
        />
      )}
    </section>
  );
}
