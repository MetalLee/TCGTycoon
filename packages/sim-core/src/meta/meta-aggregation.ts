import { META_CONFIG } from "@tcgtycoon/balance";
import type {
  CardId,
  DeckId,
  MatchupStats,
  MetaConfidence,
  MetaDeckStats,
  PlayerId,
  WorldState,
} from "@tcgtycoon/domain";
import { recordKnowledgeExposure } from "../society/knowledge";
import type { SampledMatchResult } from "./sample-matches";

export type {
  MatchupStats,
  MetaConfidence,
  MetaDeckStats,
} from "@tcgtycoon/domain";

export type MatchKnowledgeEvent = {
  type: "MATCH_EXPOSURE";
  matchSequence: number;
  playerId: PlayerId;
  opponentPlayerId: PlayerId;
  deckId: DeckId;
  cardIds: CardId[];
};

export type MetaAggregationResult = {
  deckStats: Record<string, MetaDeckStats>;
  matchups: Record<string, MatchupStats>;
  knowledgeEvents: MatchKnowledgeEvent[];
};

type MutableDeckStats = {
  matches: number;
  wins: number;
  losses: number;
  totalTurns: number;
};

type MutableMatchupStats = {
  deckAId: DeckId;
  deckBId: DeckId;
  matches: number;
  deckAWins: number;
  deckBWins: number;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function confidenceForSampleCount(count: number): MetaConfidence {
  if (count >= META_CONFIG.confidenceMinimumSamples.high) {
    return "HIGH";
  }
  if (count >= META_CONFIG.confidenceMinimumSamples.medium) {
    return "MEDIUM";
  }
  if (count >= META_CONFIG.confidenceMinimumSamples.low) {
    return "LOW";
  }
  return "VERY_LOW";
}

export function matchupKey(left: DeckId, right: DeckId): string {
  return [left, right].sort(compareIds).join("::");
}

function deckStatsFor(
  stats: Map<DeckId, MutableDeckStats>,
  id: DeckId,
): MutableDeckStats {
  const existing = stats.get(id);
  if (existing !== undefined) {
    return existing;
  }
  const created = { matches: 0, wins: 0, losses: 0, totalTurns: 0 };
  stats.set(id, created);
  return created;
}

function addDeckAppearance(
  stats: Map<DeckId, MutableDeckStats>,
  deckId: DeckId,
  won: boolean,
  turns: number,
): void {
  const target = deckStatsFor(stats, deckId);
  target.matches += 1;
  target.totalTurns += turns;
  if (won) {
    target.wins += 1;
  } else {
    target.losses += 1;
  }
}

function matchupStatsFor(
  stats: Map<string, MutableMatchupStats>,
  left: DeckId,
  right: DeckId,
): MutableMatchupStats {
  const key = matchupKey(left, right);
  const existing = stats.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const [deckAId, deckBId] = [left, right].sort(compareIds) as [DeckId, DeckId];
  const created = {
    deckAId,
    deckBId,
    matches: 0,
    deckAWins: 0,
    deckBWins: 0,
  };
  stats.set(key, created);
  return created;
}

function applyKnowledgeExposure(
  world: WorldState,
  sample: SampledMatchResult,
): MatchKnowledgeEvent[] {
  const pairs = [
    {
      playerId: sample.playerAId,
      opponentPlayerId: sample.playerBId,
      deckId: sample.deckBId,
    },
    {
      playerId: sample.playerBId,
      opponentPlayerId: sample.playerAId,
      deckId: sample.deckAId,
    },
  ] as const;
  const events: MatchKnowledgeEvent[] = [];

  for (const pair of pairs) {
    const player = world.players[pair.playerId];
    const deck = world.decks[pair.deckId];
    if (player === undefined || deck === undefined) {
      continue;
    }
    const cardIds = [...new Set(deck.cards.map((entry) => entry.cardId))].sort(
      compareIds,
    );
    recordKnowledgeExposure(player, {
      source: "MATCH",
      cardIds,
      deckIds: [deck.id],
    });
    events.push({
      type: "MATCH_EXPOSURE",
      matchSequence: sample.sequence,
      playerId: pair.playerId,
      opponentPlayerId: pair.opponentPlayerId,
      deckId: deck.id,
      cardIds,
    });
  }

  return events;
}

export function updateMetaState(
  world: WorldState,
  matchResults: readonly SampledMatchResult[],
): MetaAggregationResult {
  const deckStats = new Map<DeckId, MutableDeckStats>();
  const matchupStats = new Map<string, MutableMatchupStats>();
  const knowledgeEvents: MatchKnowledgeEvent[] = [];

  for (const sample of matchResults) {
    const winnerIsA = sample.winnerPlayerId === sample.playerAId;
    const winnerIsB = sample.winnerPlayerId === sample.playerBId;
    if (winnerIsA === winnerIsB) {
      throw new RangeError("Winner player must be one match participant.");
    }
    const expectedWinnerDeck = winnerIsA ? sample.deckAId : sample.deckBId;
    const expectedLoserDeck = winnerIsA ? sample.deckBId : sample.deckAId;
    if (
      sample.winnerDeckId !== expectedWinnerDeck ||
      sample.loserDeckId !== expectedLoserDeck
    ) {
      throw new RangeError(
        "Winner and loser decks must match participant sides.",
      );
    }
    if (!Number.isFinite(sample.turns) || sample.turns <= 0) {
      throw new RangeError("Match turns must be a positive finite number.");
    }

    addDeckAppearance(deckStats, sample.deckAId, winnerIsA, sample.turns);
    addDeckAppearance(deckStats, sample.deckBId, winnerIsB, sample.turns);

    const matchup = matchupStatsFor(
      matchupStats,
      sample.deckAId,
      sample.deckBId,
    );
    matchup.matches += 1;
    if (
      sample.deckAId === sample.deckBId
        ? winnerIsA
        : sample.winnerDeckId === matchup.deckAId
    ) {
      matchup.deckAWins += 1;
    } else {
      matchup.deckBWins += 1;
    }
    knowledgeEvents.push(...applyKnowledgeExposure(world, sample));
  }

  const totalAppearances = matchResults.length * 2;
  const finalizedDeckStats = Object.fromEntries(
    [...deckStats.entries()]
      .sort(([left], [right]) => compareIds(left, right))
      .map(([id, stats]) => [
        id,
        {
          matches: stats.matches,
          wins: stats.wins,
          losses: stats.losses,
          observedWinRate: stats.wins / stats.matches,
          usageRate:
            totalAppearances === 0 ? 0 : stats.matches / totalAppearances,
          averageGameLength: stats.totalTurns / stats.matches,
          sampleCount: stats.matches,
          confidence: confidenceForSampleCount(stats.matches),
        },
      ]),
  );
  const finalizedMatchups = Object.fromEntries(
    [...matchupStats.entries()]
      .sort(([left], [right]) => compareIds(left, right))
      .map(([key, stats]) => [
        key,
        {
          deckAId: stats.deckAId,
          deckBId: stats.deckBId,
          matches: stats.matches,
          deckAWins: stats.deckAWins,
          deckBWins: stats.deckBWins,
          observedDeckAWinRate: stats.deckAWins / stats.matches,
          sampleCount: stats.matches,
          confidence: confidenceForSampleCount(stats.matches),
        },
      ]),
  );

  world.meta.deckStats = finalizedDeckStats;
  world.meta.matchups = finalizedMatchups;
  return {
    deckStats: finalizedDeckStats,
    matchups: finalizedMatchups,
    knowledgeEvents,
  };
}
