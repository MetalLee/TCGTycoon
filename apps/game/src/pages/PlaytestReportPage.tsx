import type { PlaytestReport } from "../../../../packages/sim-core/src/index";
import { useLocation } from "react-router";
import { PlaytestReportView } from "../features/playtest/PlaytestReportView";

function isPlaytestReport(value: unknown): value is PlaytestReport {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<PlaytestReport>;
  return (
    typeof candidate.id === "string" &&
    (candidate.status === "FRESH" || candidate.status === "STALE") &&
    Array.isArray(candidate.candidateDeckStats) &&
    Array.isArray(candidate.anomalies)
  );
}

export function PlaytestReportPage() {
  const location = useLocation();
  const report = isPlaytestReport(location.state) ? location.state : null;
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Playtest Report</h1>
      {report === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          This Playtest report is not available in the current session.
        </p>
      ) : (
        <PlaytestReportView report={report} />
      )}
    </section>
  );
}
