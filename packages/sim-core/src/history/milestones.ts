import { METRICS_CONFIG } from "@tcgtycoon/balance";
import type {
  EcosystemRiskState,
  WorldEvent,
  WorldState,
} from "@tcgtycoon/domain";

export const MILESTONE_CONFIG = {
  activePlayerThresholds: [1_000] as const,
  cardPriceThresholds: [
    METRICS_CONFIG.accessibility.comfortableCompetitiveDeckCost,
  ] as const,
} as const;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function milestoneEvent(
  world: WorldState,
  type: string,
  reason?: string,
): WorldEvent {
  return {
    id: `milestone-${type.toLowerCase().replaceAll("_", "-")}`,
    day: world.day,
    type,
    ...(reason === undefined ? {} : { context: { reason } }),
  };
}

function hasMilestone(world: WorldState, type: string): boolean {
  return world.history.events.some((event) => event.type === type);
}

function parseTournamentSummary(event: WorldEvent): {
  preset?: string;
  winnerPlayerId?: string;
  winnerDeckId?: string;
} {
  if (event.context?.reason === undefined) {
    return {};
  }
  try {
    const parsed = JSON.parse(event.context.reason) as {
      preset?: string;
      winnerPlayerId?: string;
      winnerDeckId?: string;
      winner?: { playerId?: string; deckId?: string };
    };
    const winnerPlayerId = parsed.winnerPlayerId ?? parsed.winner?.playerId;
    const winnerDeckId = parsed.winnerDeckId ?? parsed.winner?.deckId;
    return {
      ...(parsed.preset === undefined ? {} : { preset: parsed.preset }),
      ...(winnerPlayerId === undefined ? {} : { winnerPlayerId }),
      ...(winnerDeckId === undefined ? {} : { winnerDeckId }),
    };
  } catch {
    return {};
  }
}

export function recordMilestones(
  world: WorldState,
  previousRisk: EcosystemRiskState,
  achievedDay: number = world.day,
): WorldEvent[] {
  const milestones: WorldEvent[] = [];
  for (const threshold of MILESTONE_CONFIG.activePlayerThresholds) {
    const type = `MILESTONE_ACTIVE_PLAYERS_${threshold}`;
    if (
      world.metrics.activePlayers >= threshold &&
      !hasMilestone(world, type)
    ) {
      milestones.push({
        ...milestoneEvent(world, type, String(threshold)),
        day: achievedDay,
      });
    }
  }

  if (
    !hasMilestone(world, "MILESTONE_FIRST_BAN") &&
    world.history.events.some(
      (event) =>
        event.type === "POLICY_CHANGE_EFFECTIVE" &&
        event.context?.reason?.startsWith("BAN:"),
    )
  ) {
    milestones.push({
      ...milestoneEvent(world, "MILESTONE_FIRST_BAN"),
      day: achievedDay,
    });
  }

  if (!hasMilestone(world, "MILESTONE_FIRST_MAJOR_WINNER")) {
    const firstMajor = world.history.events
      .filter((event) => event.type === "TOURNAMENT_COMPLETED")
      .sort(
        (left, right) => left.day - right.day || compareIds(left.id, right.id),
      )
      .map(parseTournamentSummary)
      .find((summary) => summary.preset === "MAJOR");
    if (firstMajor !== undefined) {
      milestones.push({
        ...milestoneEvent(
          world,
          "MILESTONE_FIRST_MAJOR_WINNER",
          JSON.stringify(firstMajor),
        ),
        day: achievedDay,
      });
    }
  }

  const snapshots = Object.values(world.market.snapshots).sort((left, right) =>
    compareIds(left.printingId, right.printingId),
  );
  for (const threshold of MILESTONE_CONFIG.cardPriceThresholds) {
    const type = `MILESTONE_CARD_PRICE_${threshold}`;
    if (hasMilestone(world, type)) {
      continue;
    }
    const firstAbove = snapshots.find(
      (snapshot) => snapshot.lastPrice >= threshold,
    );
    if (firstAbove !== undefined) {
      const cardId = world.printings[firstAbove.printingId]?.cardId;
      milestones.push({
        ...milestoneEvent(
          world,
          type,
          JSON.stringify({
            printingId: firstAbove.printingId,
            cardId,
            threshold,
            price: firstAbove.lastPrice,
          }),
        ),
        day: achievedDay,
      });
    }
  }

  if (
    previousRisk === "DEATH_SPIRAL" &&
    world.metrics.ecosystemRisk !== "DEATH_SPIRAL" &&
    world.metrics.ecosystemRisk !== "TERMINAL" &&
    !hasMilestone(world, "MILESTONE_DEATH_SPIRAL_RECOVERY")
  ) {
    milestones.push({
      ...milestoneEvent(world, "MILESTONE_DEATH_SPIRAL_RECOVERY"),
      day: achievedDay,
    });
  }

  world.history.events.push(...milestones);
  return milestones;
}
