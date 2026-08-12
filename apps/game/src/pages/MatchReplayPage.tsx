import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { MatchReplay } from "../features/matches/MatchReplay";
import type { MatchReplay as PersistedMatchReplay } from "../../../../packages/rules-engine/src/index";

function findReplay(
  world: NonNullable<GameSessionSnapshot["world"]>,
  id: string,
): PersistedMatchReplay | null {
  for (const report of Object.values(
    world.operationEvidence?.playtests.reports ?? {},
  )) {
    const replay = report.anomalies.find(
      (anomaly) => anomaly.id === id,
    )?.replay;
    if (replay !== undefined) return replay as PersistedMatchReplay;
  }
  for (const event of world.history.events) {
    if (
      event.type !== "TOURNAMENT_COMPLETED" ||
      event.context?.reason === undefined
    )
      continue;
    try {
      const result = JSON.parse(event.context.reason) as {
        matches?: Array<{ id?: string; replay?: PersistedMatchReplay }>;
      };
      const match = result.matches?.find((candidate) => candidate.id === id);
      if (match?.replay) return match.replay;
    } catch {
      continue;
    }
  }
  return null;
}

export function MatchReplayPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { matchId } = useParams();
  const replay =
    snapshot.world === null || matchId === undefined
      ? null
      : findReplay(snapshot.world, matchId);
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Match Replay</h1>
        <p className="mt-2 text-slate-400">
          Playback reads the durable Action Log and never re-runs Battle AI.
        </p>
      </header>
      {replay === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          No persisted replay is available for this match.
        </p>
      ) : (
        <MatchReplay replay={replay} />
      )}
    </section>
  );
}
