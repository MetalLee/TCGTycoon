import type {
  OperationProject,
  TournamentId,
  TournamentPreset,
  WorldState,
} from "../../../../../packages/domain/src/index";
import type { TournamentResult } from "../../../../../packages/sim-core/src/index";

export type TournamentView = Readonly<{
  id: TournamentId;
  name: string;
  preset: TournamentPreset;
  eventDay: number;
  status: "UPCOMING" | "RUNNING" | "COMPLETED";
  operation: Extract<OperationProject, { type: "TOURNAMENT" }> | null;
  result: TournamentResult | null;
}>;

function parseResult(reason: string | undefined): TournamentResult | null {
  if (reason === undefined) return null;
  try {
    const result = JSON.parse(reason) as TournamentResult;
    return typeof result.tournamentId === "string" &&
      Array.isArray(result.matches)
      ? result
      : null;
  } catch {
    return null;
  }
}

function scheduleMetadata(
  world: WorldState,
  id: TournamentId,
): { name: string; preset: TournamentPreset } | null {
  for (const event of world.history.events) {
    if (
      !event.type.startsWith("TOURNAMENT_SCHEDULED_") ||
      event.context?.reason === undefined
    )
      continue;
    try {
      const metadata = JSON.parse(event.context.reason) as {
        tournamentId?: string;
        name?: string;
      };
      const preset = event.type.slice("TOURNAMENT_SCHEDULED_".length);
      if (
        metadata.tournamentId === id &&
        metadata.name &&
        (preset === "LOCAL" || preset === "REGIONAL" || preset === "MAJOR")
      )
        return { name: metadata.name, preset };
    } catch {
      continue;
    }
  }
  return null;
}

export function selectTournaments(world: WorldState): TournamentView[] {
  const operations = Object.values(world.operations ?? {}).filter(
    (
      operation,
    ): operation is Extract<OperationProject, { type: "TOURNAMENT" }> =>
      operation.type === "TOURNAMENT",
  );
  const completed = new Map<TournamentId, TournamentResult>();
  for (const event of world.history.events) {
    if (event.type !== "TOURNAMENT_COMPLETED") continue;
    const result = parseResult(event.context?.reason);
    if (result) completed.set(result.tournamentId, result);
  }
  return operations
    .map((operation) => {
      const id = operation.payload.tournamentId;
      const result = completed.get(id) ?? null;
      const metadata = scheduleMetadata(world, id);
      const eventDay =
        operation.completionDay ?? operation.startDay ?? world.day;
      const status: TournamentView["status"] = result
        ? "COMPLETED"
        : operation.status === "COMPLETED"
          ? "COMPLETED"
          : operation.status === "ACTIVE"
            ? "RUNNING"
            : "UPCOMING";
      return {
        id,
        name: result?.name ?? metadata?.name ?? id,
        preset: result?.preset ?? metadata?.preset ?? "LOCAL",
        eventDay,
        status,
        operation,
        result,
      };
    })
    .sort(
      (left, right) =>
        left.eventDay - right.eventDay || (left.id < right.id ? -1 : 1),
    );
}
