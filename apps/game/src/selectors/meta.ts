import { METRICS_CONFIG } from "../../../../packages/balance/src/index";
import type {
  CardId,
  DeckGenome,
  DeckId,
  MetaConfidence,
  WorldState,
} from "../../../../packages/domain/src/index";
import { calculateMetaHealth } from "../../../../packages/sim-core/src/index";

export type MetaHealthContributor = Readonly<{
  key: "diversity" | "dominance" | "winRate" | "matchup" | "accessibility";
  label: string;
  score: number;
  weight: number;
  measuredContribution: number;
  explanation: string;
}>;

export type MetaDeckView = Readonly<{
  id: DeckId;
  name: string;
  factionId: string;
  matches: number;
  observedWinRate: number;
  usageRate: number;
  sampleCount: number;
  confidence: MetaConfidence;
}>;

export type MetaOverviewView = Readonly<{
  metaHealth: number;
  contributors: readonly MetaHealthContributor[];
  decks: readonly MetaDeckView[];
}>;

export type DeckDetailView = Readonly<{
  deck: DeckGenome;
  name: string;
  stats: MetaDeckView | null;
  cards: readonly Readonly<{ cardId: CardId; name: string; count: number }>[];
  matchups: readonly Readonly<{
    opponentDeckId: DeckId;
    opponentName: string;
    observedWinRate: number;
    sampleCount: number;
    confidence: MetaConfidence;
  }>[];
}>;

export type PolicyCardContext = Readonly<{
  cardId: CardId;
  cardName: string;
  usageRate: number;
  observedWinRate: number;
  sampleCount: number;
  confidence: MetaConfidence;
  marketPrice: number | null;
  top8Appearances: number;
  completedTournamentCount: number;
}>;

const contributorDefinitions = [
  ["diversity", "Diversity"],
  ["dominance", "Dominance"],
  ["winRate", "Win-rate balance"],
  ["matchup", "Matchup balance"],
  ["accessibility", "Accessibility"],
] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deckName(deck: DeckGenome): string {
  return `${deck.factionId} deck ${deck.id}`;
}

function contributorScores(
  world: WorldState,
): Record<MetaHealthContributor["key"], number> {
  const components = calculateMetaHealth({
    deckStats: world.meta.deckStats,
    matchups: world.meta.matchups,
    accessibility: world.metrics.accessibility,
    staleDays: 0,
  }).components;
  return {
    diversity: components.diversity / 100,
    dominance: components.dominance / 100,
    winRate: components.winRate / 100,
    matchup: components.matchup / 100,
    accessibility: components.accessibility / 100,
  };
}

function confidenceLabel(confidence: MetaConfidence): string {
  const label = confidence.toLowerCase().replace("_", " ");
  return `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`;
}

function selectMetaDecks(world: WorldState): MetaDeckView[] {
  return Object.entries(world.meta.deckStats)
    .flatMap(([id, stats]) => {
      const deck = world.decks[id];
      return deck === undefined
        ? []
        : [
            {
              id: deck.id,
              name: deckName(deck),
              factionId: deck.factionId,
              matches: stats.matches,
              observedWinRate: stats.observedWinRate,
              usageRate: stats.usageRate,
              sampleCount: stats.sampleCount,
              confidence: stats.confidence,
            },
          ];
    })
    .sort(
      (left, right) =>
        right.usageRate - left.usageRate || compareText(left.id, right.id),
    );
}

export function selectMetaOverview(world: WorldState): MetaOverviewView {
  const scores = contributorScores(world);
  return {
    metaHealth: world.metrics.metaHealth,
    contributors: contributorDefinitions.map(([key, label]) => {
      const score = scores[key];
      const weight = METRICS_CONFIG.metaHealth.weights[key];
      return {
        key,
        label,
        score,
        weight,
        measuredContribution: score * weight,
        explanation: `${label} measured ${Math.round(score * 100)}% and contributes ${Math.round(score * weight * 100)} points at a ${Math.round(weight * 100)}% weight.`,
      };
    }),
    decks: selectMetaDecks(world),
  };
}

export function selectDeckDetail(
  world: WorldState,
  id: DeckId,
): DeckDetailView | null {
  const deck = world.decks[id];
  if (deck === undefined) return null;
  const stats =
    selectMetaDecks(world).find((candidate) => candidate.id === id) ?? null;
  const matchups = Object.values(world.meta.matchups)
    .filter((matchup) => matchup.deckAId === id || matchup.deckBId === id)
    .map((matchup) => {
      const isA = matchup.deckAId === id;
      const opponentDeckId = isA ? matchup.deckBId : matchup.deckAId;
      const opponent = world.decks[opponentDeckId];
      return {
        opponentDeckId,
        opponentName:
          opponent === undefined ? opponentDeckId : deckName(opponent),
        observedWinRate: isA
          ? matchup.observedDeckAWinRate
          : 1 - matchup.observedDeckAWinRate,
        sampleCount: matchup.sampleCount,
        confidence: matchup.confidence,
      };
    })
    .sort((left, right) =>
      compareText(left.opponentDeckId, right.opponentDeckId),
    );
  return {
    deck,
    name: deckName(deck),
    stats,
    cards: deck.cards
      .map((entry) => ({
        cardId: entry.cardId,
        name: world.cards[entry.cardId]?.name ?? entry.cardId,
        count: entry.count,
      }))
      .sort((left, right) => compareText(left.name, right.name)),
    matchups,
  };
}

type TournamentSummary = { top8?: Array<{ deckId?: string }> };

export function selectPolicyCardContext(
  world: WorldState,
  cardId: CardId,
): PolicyCardContext {
  const relevantDeckIds = new Set(
    Object.values(world.decks)
      .filter((deck) => deck.cards.some((entry) => entry.cardId === cardId))
      .map((deck) => deck.id),
  );
  const relevantStats = [...relevantDeckIds]
    .map((id) => world.meta.deckStats[id])
    .filter((stats) => stats !== undefined);
  const sampleCount = relevantStats.reduce(
    (sum, stats) => sum + stats.sampleCount,
    0,
  );
  const usageRate = relevantStats.reduce(
    (sum, stats) => sum + stats.usageRate,
    0,
  );
  const observedWinRate =
    sampleCount === 0
      ? 0
      : relevantStats.reduce(
          (sum, stats) => sum + stats.observedWinRate * stats.sampleCount,
          0,
        ) / sampleCount;
  const confidence =
    relevantStats.sort((left, right) => right.sampleCount - left.sampleCount)[0]
      ?.confidence ?? "VERY_LOW";
  const prices = Object.values(world.printings)
    .filter((printing) => printing.cardId === cardId)
    .map((printing) => world.market.snapshots[printing.id]?.lastPrice)
    .filter((price): price is number => price !== undefined);
  let top8Appearances = 0;
  let completedTournamentCount = 0;
  for (const event of world.history.events) {
    if (
      event.type !== "TOURNAMENT_COMPLETED" ||
      event.context?.reason === undefined
    )
      continue;
    completedTournamentCount += 1;
    try {
      const result = JSON.parse(event.context.reason) as TournamentSummary;
      top8Appearances += (result.top8 ?? []).filter(
        (placement) =>
          placement.deckId !== undefined &&
          relevantDeckIds.has(placement.deckId as DeckId),
      ).length;
    } catch {
      // Malformed historical metadata cannot contribute to observed context.
    }
  }
  return {
    cardId,
    cardName: world.cards[cardId]?.name ?? cardId,
    usageRate,
    observedWinRate,
    sampleCount,
    confidence,
    marketPrice: prices.length === 0 ? null : Math.min(...prices),
    top8Appearances,
    completedTournamentCount,
  };
}

export function formatMetaConfidence(confidence: MetaConfidence): string {
  return `${confidenceLabel(confidence)} confidence`;
}
