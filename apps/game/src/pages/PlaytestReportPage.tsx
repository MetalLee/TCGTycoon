import type { PlaytestReport } from "../../../../packages/sim-core/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
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
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { reportId } = useParams();
  const candidate =
    reportId === undefined
      ? undefined
      : snapshot.world?.operationEvidence?.playtests.reports[reportId];
  const report = isPlaytestReport(candidate) ? candidate : null;
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Playtest Report</h1>
      {report === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          This Playtest report is not available in the current session.
        </p>
      ) : (
        <PlaytestReportView
          report={report}
          {...(snapshot.world === null
            ? {}
            : { cards: snapshot.world.cards as never })}
        />
      )}
    </section>
  );
}
