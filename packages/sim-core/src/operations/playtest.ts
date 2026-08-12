import {
  PLAYTEST_CONFIG,
  type PlaytestConfig,
  type PlaytestTierConfig,
} from "@tcgtycoon/balance";
import {
  deckId,
  operationId,
  type CardDefinition,
  type CardId,
  type DeckDefinition,
  type FactionId,
  type OperationProject,
  type PlaytestReportState,
  type PlaytestRunState,
  type PlaytestTier,
} from "@tcgtycoon/domain";
import {
  deriveSeed,
  simulateMatch,
  validateDeck,
  type MatchReplay,
  type MatchSide,
  type MatchWarning,
} from "@tcgtycoon/rules-engine";
import type { ExpansionPipelineProject } from "./expansion-pipeline";
import { advanceScheduledOperations } from "./scheduler";

const NEUTRAL_FACTION_ID = "neutral";
const CARDS_PER_PLAYTEST_DECK = 10;

export type PlaytestStatus = "PLANNED" | "ACTIVE" | "READY" | "COMPLETED";
export type PlaytestReportStatus = "FRESH" | "STALE";

export type PlaytestRun = PlaytestRunState;

export type PlaytestCandidateDeckStats = {
  deckId: DeckDefinition["id"];
  cards: DeckDefinition["cards"];
  matches: number;
  wins: number;
  observedWinRate: number;
};

export type PlaytestHighRiskCard = {
  cardId: CardId;
  observedMatches: number;
  observedWins: number;
  observedWinRate: number;
};

export type PlaytestComboCandidate = {
  cardIds: readonly [CardId, CardId];
  activations: number;
  winsAfterActivation: number;
  observedWinRate: number;
};

export type PlaytestTriggerSafetyWarning = {
  code: MatchWarning["code"];
  limit: MatchWarning["limit"];
  occurrences: number;
};

export type PlaytestAnomaly = {
  id: string;
  type: "TRIGGER_SAFETY" | "SHORT_MATCH";
  matchSequence: number;
  reason: string;
  replay: MatchReplay;
};

export type PlaytestReport = PlaytestReportState;

export type StartPlaytestOptions = {
  startDay: number;
  worldSeed: string;
  setup?: boolean;
};

type MutableCandidateStats = {
  deck: DeckDefinition;
  matches: number;
  wins: number;
};

type ComboEvidence = {
  sourceCardId: CardId;
  referencedCardId: CardId;
  activations: number;
  wins: number;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function requireNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function requireUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between zero and one`);
  }
}

function tierConfig(
  tier: PlaytestTier,
  config: PlaytestConfig,
): PlaytestTierConfig {
  switch (tier) {
    case "QUICK":
      return config.quick;
    case "STANDARD":
      return config.standard;
    case "DEEP":
      return config.deep;
  }
}

function validateConfig(config: PlaytestConfig): void {
  for (const [name, tier] of [
    ["quick", config.quick],
    ["standard", config.standard],
    ["deep", config.deep],
  ] as const) {
    requirePositiveInteger(tier.durationDays, `${name}.durationDays`);
    requirePositiveInteger(tier.matchBudget, `${name}.matchBudget`);
    requirePositiveInteger(
      tier.candidateDeckBudget,
      `${name}.candidateDeckBudget`,
    );
    if (!Number.isFinite(tier.cashCost) || tier.cashCost < 0) {
      throw new RangeError(`${name}.cashCost must be finite and non-negative`);
    }
  }
  requirePositiveInteger(
    config.comboMinimumActivations,
    "comboMinimumActivations",
  );
  requireUnit(
    config.comboMinimumObservedWinRate,
    "comboMinimumObservedWinRate",
  );
  requirePositiveInteger(
    config.highRiskMinimumMatches,
    "highRiskMinimumMatches",
  );
  requireUnit(config.highRiskObservedWinRate, "highRiskObservedWinRate");
  requireNonNegativeInteger(config.anomalyReplayLimit, "anomalyReplayLimit");
  requirePositiveInteger(
    config.shortMatchTurnThreshold,
    "shortMatchTurnThreshold",
  );
}

function revisionSnapshot(
  project: ExpansionPipelineProject,
): Record<string, number> {
  return Object.fromEntries(
    Object.values(project.cardDrafts)
      .sort((left, right) =>
        compareIds(left.definition.id, right.definition.id),
      )
      .map((draft) => [draft.definition.id, draft.gameplayRevision]),
  );
}

export function startPlaytest(
  project: ExpansionPipelineProject,
  tier: PlaytestTier,
  options: StartPlaytestOptions,
  config: PlaytestConfig = PLAYTEST_CONFIG,
): PlaytestRun {
  validateConfig(config);
  requireNonNegativeInteger(options.startDay, "startDay");
  if (
    project.stage === "FINALIZED" ||
    project.stage === "PRINTING" ||
    project.stage === "RELEASED"
  ) {
    throw new Error(`Cannot start a Playtest during ${project.stage}`);
  }
  if (Object.keys(project.cardDrafts).length < CARDS_PER_PLAYTEST_DECK) {
    throw new Error(
      "A Playtest requires enough Card Drafts to build a legal deck",
    );
  }

  const selected = tierConfig(tier, config);
  const completionDay = options.startDay + selected.durationDays - 1;
  const id = `playtest-${project.id}-${options.startDay}-${tier.toLowerCase()}`;
  const playtestOperationId = operationId(`operation-${id}`);
  const operation: Extract<OperationProject, { type: "PLAYTEST" }> = {
    id: playtestOperationId,
    type: "PLAYTEST",
    createdDay: options.startDay,
    startDay: options.startDay,
    completionDay,
    status: "PLANNED",
    progressDays: 0,
    payload: { expansionId: project.id, tier },
  };
  project.stage = "PLAYTEST";

  return {
    id,
    expansionId: project.id,
    tier,
    startDay: options.startDay,
    completionDay,
    durationDays: selected.durationDays,
    elapsedDays: 0,
    status: "PLANNED",
    matchBudget: selected.matchBudget,
    candidateDeckBudget: selected.candidateDeckBudget,
    cashCost: selected.cashCost,
    worldSeed: options.worldSeed,
    setup: options.setup ?? false,
    operation,
    revisionSnapshot: revisionSnapshot(project),
    cards: Object.values(project.cardDrafts)
      .sort((left, right) => left.slot.index - right.slot.index)
      .map((draft) => structuredClone(draft.definition)),
    evidenceConfig: {
      comboMinimumActivations: config.comboMinimumActivations,
      comboMinimumObservedWinRate: config.comboMinimumObservedWinRate,
      highRiskMinimumMatches: config.highRiskMinimumMatches,
      highRiskObservedWinRate: config.highRiskObservedWinRate,
      anomalyReplayLimit: config.anomalyReplayLimit,
      shortMatchTurnThreshold: config.shortMatchTurnThreshold,
    },
  };
}

export function advancePlaytest(
  run: PlaytestRun,
  throughDay: number,
): PlaytestRun {
  requireNonNegativeInteger(throughDay, "throughDay");
  if (run.status === "COMPLETED") {
    return run;
  }
  if (throughDay < run.startDay) {
    return run;
  }

  const firstDay = Math.max(
    run.startDay,
    (run.operation.lastAdvancedDay ?? run.startDay - 1) + 1,
  );
  for (let day = firstDay; day <= throughDay; day += 1) {
    advanceScheduledOperations(
      {
        status: run.setup ? "SETUP" : "LIVE",
        operations: { [run.operation.id]: run.operation },
      },
      day,
      { progressSetupPlaytests: run.setup },
    );
    if (run.operation.status === "COMPLETED") {
      break;
    }
  }

  run.elapsedDays = Math.min(run.durationDays, run.operation.progressDays);
  run.status =
    run.operation.status === "COMPLETED"
      ? "READY"
      : run.operation.status === "ACTIVE"
        ? "ACTIVE"
        : "PLANNED";
  return run;
}

function candidateFactions(cards: readonly CardDefinition[]): FactionId[] {
  return [
    ...new Set(
      cards
        .map((card) => card.factionId)
        .filter((id) => id !== NEUTRAL_FACTION_ID),
    ),
  ].sort(compareIds) as FactionId[];
}

function createCandidateDecks(run: PlaytestRun): DeckDefinition[] {
  const cards = [...run.cards].sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const factions = candidateFactions(cards);
  const candidates: DeckDefinition[] = [];
  const seen = new Set<string>();
  let sequence = 0;

  const maximumAttempts = Math.max(
    run.candidateDeckBudget,
    factions.reduce((total, faction) => {
      return (
        total +
        cards.filter(
          (card) =>
            card.factionId === faction || card.factionId === NEUTRAL_FACTION_ID,
        ).length
      );
    }, 0),
  );

  while (
    candidates.length < run.candidateDeckBudget &&
    sequence < maximumAttempts &&
    factions.length > 0
  ) {
    const faction = factions[sequence % factions.length]!;
    const rotation = Math.floor(sequence / factions.length);
    const pool = cards.filter(
      (card) =>
        card.factionId === faction || card.factionId === NEUTRAL_FACTION_ID,
    );
    if (pool.length >= CARDS_PER_PLAYTEST_DECK) {
      const selected = Array.from(
        { length: CARDS_PER_PLAYTEST_DECK },
        (_, offset) => pool[(rotation + offset) % pool.length]!,
      ).sort((left, right) => compareIds(left.id, right.id));
      const signature = `${faction}:${selected.map((card) => card.id).join(",")}`;
      if (!seen.has(signature)) {
        seen.add(signature);
        const deck: DeckDefinition = {
          id: deckId(
            `deck-${run.id}-${String(candidates.length).padStart(4, "0")}`,
          ),
          name: `${run.tier} Candidate ${candidates.length + 1}`,
          factionId: faction,
          cards: selected.map((card) => ({ cardId: card.id, count: 2 })),
        };
        if (validateDeck(deck, cards).valid) {
          candidates.push(deck);
        }
      }
    }
    sequence += 1;
  }

  if (candidates.length < 2) {
    throw new Error(
      "Playtest search could not build two legal candidate decks",
    );
  }
  return candidates;
}

function referencedCards(card: CardDefinition): CardId[] {
  const references = new Set<CardId>();
  for (const trigger of card.triggers) {
    for (const effect of trigger.effects) {
      if (effect.type === "SUMMON") {
        references.add(effect.tokenCardId);
      } else if (effect.type === "CREATE_CARD") {
        references.add(effect.cardId);
      }
    }
  }
  return [...references].sort(compareIds);
}

function comboEvidenceBySource(
  cards: readonly CardDefinition[],
): Map<CardId, ComboEvidence[]> {
  const known = new Set(cards.map((card) => card.id));
  return new Map(
    cards
      .map(
        (card) =>
          [
            card.id,
            referencedCards(card)
              .filter((id) => known.has(id))
              .map((id) => ({
                sourceCardId: card.id,
                referencedCardId: id,
                activations: 0,
                wins: 0,
              })),
          ] as const,
      )
      .filter(([, evidence]) => evidence.length > 0),
  );
}

function playedCardsBySide(
  replay: MatchReplay,
): Record<MatchSide, Set<CardId>> {
  const played: Record<MatchSide, Set<CardId>> = {
    A: new Set<CardId>(),
    B: new Set<CardId>(),
  };
  for (const entry of replay.actionLog) {
    if (entry.type === "PLAY_CARD") {
      played[entry.side].add(entry.cardId);
    }
  }
  return played;
}

function updateComboEvidence(
  evidenceBySource: Map<CardId, ComboEvidence[]>,
  replay: MatchReplay,
  winner: MatchSide,
): void {
  const played = playedCardsBySide(replay);
  for (const side of ["A", "B"] as const) {
    for (const sourceCardId of played[side]) {
      for (const evidence of evidenceBySource.get(sourceCardId) ?? []) {
        evidence.activations += 1;
        if (side === winner) {
          evidence.wins += 1;
        }
      }
    }
  }
}

function calculateDiversity(stats: readonly MutableCandidateStats[]): number {
  if (stats.length <= 1) {
    return 0;
  }
  const totalWins = stats.reduce(
    (total, candidate) => total + candidate.wins,
    0,
  );
  if (totalWins === 0) {
    return 0;
  }
  const entropy = stats.reduce((total, candidate) => {
    if (candidate.wins === 0) return total;
    const share = candidate.wins / totalWins;
    return total - share * Math.log(share);
  }, 0);
  return Math.min(1, Math.max(0, entropy / Math.log(stats.length)));
}

function highRiskCards(
  stats: readonly MutableCandidateStats[],
  config: PlaytestRun["evidenceConfig"],
): PlaytestHighRiskCard[] {
  const observations = new Map<
    CardId,
    { observedMatches: number; observedWins: number }
  >();
  for (const candidate of stats) {
    for (const entry of candidate.deck.cards) {
      const current = observations.get(entry.cardId) ?? {
        observedMatches: 0,
        observedWins: 0,
      };
      current.observedMatches += candidate.matches;
      current.observedWins += candidate.wins;
      observations.set(entry.cardId, current);
    }
  }
  return [...observations.entries()]
    .map(([cardId, observation]) => ({
      cardId,
      ...observation,
      observedWinRate:
        observation.observedWins / Math.max(1, observation.observedMatches),
    }))
    .filter(
      (card) =>
        card.observedMatches >= config.highRiskMinimumMatches &&
        card.observedWinRate >= config.highRiskObservedWinRate,
    )
    .sort(
      (left, right) =>
        right.observedWinRate - left.observedWinRate ||
        compareIds(left.cardId, right.cardId),
    );
}

export function completePlaytest(run: PlaytestRun): PlaytestReport {
  if (run.status !== "READY") {
    throw new Error(
      "A Playtest can complete only after its configured duration",
    );
  }
  const candidates = createCandidateDecks(run);
  const stats = new Map<DeckDefinition["id"], MutableCandidateStats>(
    candidates.map((deck) => [deck.id, { deck, matches: 0, wins: 0 }]),
  );
  const cards = new Map(run.cards.map((card) => [card.id, card]));
  const evidenceBySource = comboEvidenceBySource(run.cards);
  const warningCounts = new Map<string, PlaytestTriggerSafetyWarning>();
  const anomalies: PlaytestAnomaly[] = [];
  let firstPlayerWins = 0;
  let totalTurns = 0;

  for (let sequence = 0; sequence < run.matchBudget; sequence += 1) {
    const deckAIndex = sequence % candidates.length;
    const round = Math.floor(sequence / candidates.length);
    const offset = 1 + (round % (candidates.length - 1));
    const deckBIndex = (deckAIndex + offset) % candidates.length;
    const deckA = candidates[deckAIndex]!;
    const deckB = candidates[deckBIndex]!;
    const result = simulateMatch({
      seed: deriveSeed([
        run.worldSeed,
        run.expansionId,
        run.tier,
        sequence,
        deckA.id,
        deckB.id,
      ]),
      deckA,
      deckB,
      cards,
      strategyA: { aggression: 0.6, value: 0.6, preservation: 0.4 },
      strategyB: { aggression: 0.6, value: 0.6, preservation: 0.4 },
      recordActionLog: true,
    });
    const replay = result.replay!;
    const winnerDeck = result.winner === "A" ? deckA : deckB;
    stats.get(deckA.id)!.matches += 1;
    stats.get(deckB.id)!.matches += 1;
    stats.get(winnerDeck.id)!.wins += 1;
    if (result.winner === "A") firstPlayerWins += 1;
    totalTurns += result.turns;
    updateComboEvidence(evidenceBySource, replay, result.winner);

    for (const warning of result.warnings) {
      const key = `${warning.code}:${warning.limit}`;
      const current = warningCounts.get(key);
      if (current === undefined) {
        warningCounts.set(key, {
          code: warning.code,
          limit: warning.limit,
          occurrences: 1,
        });
      } else {
        current.occurrences += 1;
      }
    }

    if (anomalies.length < run.evidenceConfig.anomalyReplayLimit) {
      const warning = result.warnings[0];
      const isShort =
        result.turns <= run.evidenceConfig.shortMatchTurnThreshold;
      if (warning !== undefined || isShort) {
        const type = warning === undefined ? "SHORT_MATCH" : "TRIGGER_SAFETY";
        anomalies.push({
          id: `${run.id}-anomaly-${String(anomalies.length + 1).padStart(4, "0")}`,
          type,
          matchSequence: sequence,
          reason:
            warning?.message ??
            `Match ended in ${result.turns} turns, at or below the anomaly threshold.`,
          replay,
        });
      }
    }
  }

  const orderedStats = [...stats.values()].sort((left, right) =>
    compareIds(left.deck.id, right.deck.id),
  );
  const candidateDeckStats = orderedStats.map((candidate) => ({
    deckId: candidate.deck.id,
    cards: candidate.deck.cards.map((entry) => ({ ...entry })),
    matches: candidate.matches,
    wins: candidate.wins,
    observedWinRate: candidate.wins / Math.max(1, candidate.matches),
  }));
  const comboCandidates = [...evidenceBySource.values()]
    .flat()
    .filter(
      (evidence) =>
        evidence.activations >= run.evidenceConfig.comboMinimumActivations &&
        evidence.wins / evidence.activations >=
          run.evidenceConfig.comboMinimumObservedWinRate,
    )
    .map((evidence) => ({
      cardIds: [evidence.sourceCardId, evidence.referencedCardId] as const,
      activations: evidence.activations,
      winsAfterActivation: evidence.wins,
      observedWinRate: evidence.wins / evidence.activations,
    }))
    .sort(
      (left, right) =>
        right.observedWinRate - left.observedWinRate ||
        compareIds(left.cardIds.join(":"), right.cardIds.join(":")),
    );
  const triggerSafetyWarnings = [...warningCounts.values()].sort(
    (left, right) =>
      compareIds(`${left.code}:${left.limit}`, `${right.code}:${right.limit}`),
  );

  run.status = "COMPLETED";
  return {
    id: `${run.id}-report`,
    expansionId: run.expansionId,
    tier: run.tier,
    status: "FRESH",
    revisionSnapshot: { ...run.revisionSnapshot },
    candidatesEvaluated: candidates.length,
    matchesRun: run.matchBudget,
    candidateDeckStats,
    highRiskCards: highRiskCards(orderedStats, run.evidenceConfig),
    comboCandidates,
    firstPlayerWinRate: firstPlayerWins / run.matchBudget,
    averageTurns: totalTurns / run.matchBudget,
    diversityEstimate: calculateDiversity(orderedStats),
    triggerSafetyWarnings,
    anomalies,
    anomalyReplayReferences: anomalies.map((anomaly) => anomaly.id),
  };
}

export function validatePlaytestReportRevisions(
  report: PlaytestReport,
  project: ExpansionPipelineProject,
): PlaytestReportStatus {
  const current = revisionSnapshot(project);
  const reportEntries = Object.entries(report.revisionSnapshot).sort(
    ([left], [right]) => compareIds(left, right),
  );
  const currentEntries = Object.entries(current).sort(([left], [right]) =>
    compareIds(left, right),
  );
  report.status =
    JSON.stringify(reportEntries) === JSON.stringify(currentEntries)
      ? "FRESH"
      : "STALE";
  return report.status;
}
