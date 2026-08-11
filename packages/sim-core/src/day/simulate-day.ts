import {
  DECK_EVOLUTION_CONFIG,
  META_CONFIG,
  METRICS_CONFIG,
  RULES_CONFIG,
} from "@tcgtycoon/balance";
import {
  parsePublisherCommands,
  printRunId,
  type DeckId,
  type PublisherCommand,
  type WorldEvent,
  type WorldState,
} from "@tcgtycoon/domain";
import { validateDeck } from "@tcgtycoon/rules-engine";
import {
  mutateDeck,
  generateCandidateDecks,
  playerOwnsGenome,
} from "../deck-evolution/deck-builder";
import { calculateAdoptionScore } from "../deck-evolution/adoption";
import { toDeckDefinition } from "../deck-evolution/deck-genome";
import { appendCashEntry, toCurrency } from "../economy/cash-ledger";
import { createDailyReport, type DailyReport } from "../history/daily-report";
import {
  applyMarketTrades,
  clearPrintingAuction,
} from "../market/call-auction";
import { generateMarketIntents } from "../market/market-intents";
import {
  updateMetaState,
  type MetaAggregationResult,
} from "../meta/meta-aggregation";
import {
  sampleDailyMatches,
  type SampledMatchResult,
} from "../meta/sample-matches";
import { calculateAccessibility } from "../metrics/accessibility";
import {
  evaluateEcosystemRisk,
  type EcosystemRiskState,
} from "../metrics/ecosystem-risk";
import {
  calculateSatisfactionTarget,
  updateSatisfaction,
} from "../metrics/satisfaction";
import {
  activeLifecyclePopulation,
  calculateMetaHealth,
  updateWorldMetrics,
} from "../metrics/world-metrics";
import { processLifecycleDay } from "../population/lifecycle";
import { openBooster, openStarter } from "../products/open-product";
import {
  completePrintRunsDueToday,
  generatePrimaryDemand,
  getAvailableProductInventory,
  resolvePrimarySales,
  type CompletedPrintRun,
  type PrimarySalesResult,
} from "../products/primary-market";
import { type BalanceConfig, hashWorldState, phaseRng } from "./day-context";
import { validateWorldInvariants } from "./world-invariants";

export type DaySimulationResult = {
  nextState: WorldState;
  report: DailyReport;
  notableEvents: WorldEvent[];
  stateHash: string;
};

type DayContext = {
  state: WorldState;
  previousDay: number;
  commands: readonly PublisherCommand[];
  config: BalanceConfig;
  notableEvents: WorldEvent[];
  completedPrintRuns: CompletedPrintRun[];
  sales: PrimarySalesResult;
  productsOpened: number;
  matches: SampledMatchResult[];
  meta: MetaAggregationResult;
  marketTrades: number;
  accessibility: number;
  metaHealth: number;
  ecosystemRisk: EcosystemRiskState;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function averagePlayerSatisfaction(world: WorldState): number {
  const players = Object.values(world.players);
  if (players.length === 0) {
    return 0;
  }
  return (
    players.reduce((total, player) => total + player.satisfaction, 0) /
    players.length
  );
}

function emptyMetaResult(): MetaAggregationResult {
  return { deckStats: {}, matchups: {}, knowledgeEvents: [] };
}

function addNotableEvent(context: DayContext, type: string): void {
  const event: WorldEvent = {
    id: `day-${context.previousDay}-event-${String(
      context.notableEvents.length + 1,
    ).padStart(4, "0")}`,
    day: context.previousDay,
    type,
  };
  context.notableEvents.push(event);
  context.state.history.events.push(event);
}

function validateBalanceConfig(config: BalanceConfig): void {
  for (const [name, value] of [
    ["dailyOperatingCost", config.dailyOperatingCost],
    ["inventoryHoldingCostPerUnit", config.inventoryHoldingCostPerUnit],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be finite and non-negative.`);
    }
  }
}

function applyPublisherCommand(
  context: DayContext,
  command: PublisherCommand,
  index: number,
): void {
  switch (command.type) {
    case "ADJUST_MSRP": {
      const product = context.state.products[command.productId];
      if (product === undefined) {
        throw new Error(`Unknown product ${command.productId}.`);
      }
      if (!Number.isFinite(command.newMsrp) || command.newMsrp < 0) {
        throw new RangeError("Adjusted MSRP must be finite and non-negative.");
      }
      product.msrp = command.newMsrp;
      addNotableEvent(context, "MSRP_ADJUSTED");
      break;
    }
    case "ORDER_PRINT_RUN": {
      if (context.state.products[command.productId] === undefined) {
        throw new Error(`Unknown product ${command.productId}.`);
      }
      if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
        throw new RangeError("Print Run quantity must be a positive integer.");
      }
      if (
        !Number.isInteger(command.completionDay) ||
        command.completionDay < context.previousDay
      ) {
        throw new RangeError(
          "Print Run completion day must be today or a future integer day.",
        );
      }
      const id = printRunId(
        `print-run-${context.previousDay}-${command.productId}-${String(
          index + 1,
        ).padStart(4, "0")}`,
      );
      if (context.state.printRuns[id] !== undefined) {
        throw new Error(`Print Run ID collision: ${id}.`);
      }
      context.state.printRuns[id] = {
        id,
        productId: command.productId,
        quantity: command.quantity,
        completionDay: command.completionDay,
      };
      addNotableEvent(context, "PRINT_RUN_ORDERED");
      break;
    }
  }
}

function phase01CommandsAndPrintCompletion(context: DayContext): void {
  context.commands.forEach((command, index) =>
    applyPublisherCommand(context, command, index),
  );
  context.completedPrintRuns = completePrintRunsDueToday(context.state);
  context.completedPrintRuns.forEach(() =>
    addNotableEvent(context, "PRINT_RUN_COMPLETED"),
  );
}

function phase02PopulationExposureAndLifecycle(context: DayContext): void {
  const metrics = context.state.metrics;
  const rates = METRICS_CONFIG.lifecycle.rates;
  const satisfaction = averagePlayerSatisfaction(context.state);
  const lifecycle = processLifecycleDay(metrics.lifecycle, {
    worldSeed: context.state.worldSeed,
    day: context.previousDay,
    rates: {
      potentialToInterested: clampUnit(
        rates.potentialToInterestedBase +
          (metrics.hype / 100) * rates.potentialToInterestedHypeWeight,
      ),
      interestedToNew: clampUnit(
        rates.interestedToNewBase +
          (metrics.accessibility / 100) *
            rates.interestedToNewAccessibilityWeight,
      ),
      newToActive: clampUnit(
        rates.newToActiveBase +
          satisfaction * rates.newToActiveSatisfactionWeight,
      ),
      activeToAtRisk: clampUnit(
        rates.activeToAtRiskBase +
          (1 - satisfaction) * rates.activeToAtRiskDissatisfactionWeight,
      ),
      atRiskToChurned: clampUnit(
        rates.atRiskToChurnedBase +
          (1 - satisfaction) * rates.atRiskToChurnedDissatisfactionWeight,
      ),
      churnedToReturning: clampUnit(
        rates.churnedToReturningBase +
          ((metrics.hype + metrics.brandTrust) / 200) *
            rates.churnedToReturningHypeTrustWeight,
      ),
      returningToActive: clampUnit(
        rates.returningToActiveBase +
          satisfaction * rates.returningToActiveSatisfactionWeight,
      ),
    },
  });
  metrics.previousActivePlayers = metrics.activePlayers;
  metrics.lifecycle = lifecycle.population;
  metrics.lifecycleDeltas = lifecycle.deltas;
  metrics.activePlayers = activeLifecyclePopulation(lifecycle.population);

  for (const playerId of Object.keys(context.state.players).sort(compareIds)) {
    const player = context.state.players[playerId]!;
    if (player.activity !== "CHURNED") {
      player.tenureDays += 1;
    }
  }
}

function openPurchasedProducts(context: DayContext): void {
  let openingSequence = 0;
  for (const request of context.sales.openingRequests) {
    const product = context.state.products[request.productId]!;
    for (let unit = 0; unit < request.quantity; unit += 1) {
      if (product.kind === "BOOSTER") {
        openBooster(
          context.state,
          product.id,
          request.buyerId,
          phaseRng(context.state, "product-opening", openingSequence),
        );
      } else {
        const contents = context.config.starterContents[product.id];
        if (contents === undefined) {
          throw new Error(
            `Starter product ${product.id} has no configured physical contents.`,
          );
        }
        openStarter(context.state, product.id, request.buyerId, contents);
      }
      openingSequence += 1;
      context.productsOpened += 1;
    }
  }
}

function phase03PrimarySalesAndProductOpening(context: DayContext): void {
  const demand = generatePrimaryDemand(
    context.state,
    phaseRng(context.state, "primary-demand"),
  );
  context.sales = resolvePrimarySales(
    context.state,
    demand,
    phaseRng(context.state, "primary-sales"),
  );
  openPurchasedProducts(context);
}

function deckComplexity(context: DayContext, deckId: DeckId): number {
  const deck = context.state.decks[deckId];
  if (deck === undefined) {
    return 0;
  }
  const totalEffects = deck.cards.reduce((total, entry) => {
    const card = context.state.cards[entry.cardId];
    return (
      total +
      (card?.keywords.length ?? 0) +
      (card?.triggers.reduce(
        (triggerTotal, trigger) => triggerTotal + trigger.effects.length,
        0,
      ) ?? 0)
    );
  }, 0);
  return clampUnit(totalEffects / RULES_CONFIG.deckSize);
}

function adoptionContext(
  context: DayContext,
  playerId: string,
  deckId: DeckId,
  novelty: number,
) {
  const player = context.state.players[playerId]!;
  const stats = context.state.meta.deckStats[deckId];
  return {
    performance: stats?.observedWinRate ?? 0.5,
    socialExposure: player.knowledge.knownDeckIds.includes(deckId)
      ? DECK_EVOLUTION_CONFIG.knownDeckSocialExposure
      : DECK_EVOLUTION_CONFIG.inheritedDeckSocialExposure,
    tournamentPrestige: clampUnit(
      (stats?.sampleCount ?? 0) / META_CONFIG.confidenceMinimumSamples.high,
    ),
    influencerExposure: Object.values(context.state.agents).some(
      (agent) => agent.playerId === player.id,
    )
      ? DECK_EVOLUTION_CONFIG.namedAgentInfluencerExposure
      : 0,
    novelty,
    deckPrice: deckMarketCost(context, deckId),
    missingCardCount: 0,
    complexity: deckComplexity(context, deckId),
  };
}

function phase04BuildOrRepairDecks(context: DayContext): void {
  const cards = Object.values(context.state.cards);
  for (const playerId of Object.keys(context.state.players).sort(compareIds)) {
    const player = context.state.players[playerId]!;
    if (player.activity === "CHURNED") {
      continue;
    }
    const ownedLegalDeck = player.deckIds
      .map((id) => context.state.decks[id])
      .find((deck) => {
        return (
          deck !== undefined &&
          playerOwnsGenome(player, context.state, deck) &&
          validateDeck(toDeckDefinition(deck), cards).valid
        );
      });
    if (ownedLegalDeck !== undefined) {
      const rng = phaseRng(context.state, "deck-evolution", playerId);
      const explorationChance = clampUnit(
        DECK_EVOLUTION_CONFIG.explorationBaseChance +
          player.motivation.brewer *
            DECK_EVOLUTION_CONFIG.brewerExplorationWeight,
      );
      if (rng.nextFloat() >= explorationChance) {
        continue;
      }
      const child = mutateDeck(ownedLegalDeck, player, context.state, rng);
      context.state.decks[child.id] = child;
      const parentScore = calculateAdoptionScore(
        player,
        ownedLegalDeck,
        adoptionContext(
          context,
          playerId,
          ownedLegalDeck.id,
          DECK_EVOLUTION_CONFIG.parentNovelty,
        ),
      );
      const childScore = calculateAdoptionScore(
        player,
        child,
        adoptionContext(
          context,
          playerId,
          child.id,
          DECK_EVOLUTION_CONFIG.childNovelty,
        ),
      );
      if (childScore >= parentScore) {
        player.deckIds = player.deckIds.map((id) =>
          id === ownedLegalDeck.id ? child.id : id,
        );
        player.knowledge.knownDeckIds = [
          ...new Set([...player.knowledge.knownDeckIds, child.id]),
        ].sort(compareIds);
      } else {
        delete context.state.decks[child.id];
      }
      continue;
    }
    const candidate = generateCandidateDecks(
      player,
      context.state,
      phaseRng(context.state, "deck-building", playerId),
    )[0];
    if (candidate !== undefined) {
      context.state.decks[candidate.id] = candidate;
      player.deckIds = [candidate.id];
    }
  }
}

function phase05SampleNormalMatches(context: DayContext): void {
  context.matches = sampleDailyMatches(
    context.state,
    phaseRng(context.state, "normal-matches"),
  );
}

function phase06AggregateMetaAndKnowledge(context: DayContext): void {
  context.meta = updateMetaState(context.state, context.matches);
}

function phase07ClearSecondaryMarket(context: DayContext): void {
  const intents = generateMarketIntents(context.state);
  const printingIds = [
    ...new Set([
      ...intents.buys.map((intent) => intent.printingId),
      ...intents.sells.map((intent) => intent.printingId),
    ]),
  ].sort(compareIds);
  const auctions = printingIds.map((printingId) =>
    clearPrintingAuction({
      printingId,
      buys: intents.buys
        .filter((intent) => intent.printingId === printingId)
        .map((intent) => ({
          ownerId: intent.ownerId,
          quantity: intent.quantity,
          maxPrice: intent.maxPrice,
        })),
      sells: intents.sells
        .filter((intent) => intent.printingId === printingId)
        .map((intent) => ({
          ownerId: intent.ownerId,
          quantity: intent.quantity,
          minPrice: intent.minPrice,
        })),
    }),
  );
  context.marketTrades = applyMarketTrades(context.state, auctions).length;
}

function physicalCardSupply(context: DayContext, cardId: string): number {
  return Object.values(context.state.players).reduce(
    (worldTotal, player) =>
      worldTotal +
      Object.entries(player.collection).reduce(
        (playerTotal, [printingId, quantity]) =>
          context.state.printings[printingId]?.cardId === cardId
            ? playerTotal + quantity
            : playerTotal,
        0,
      ),
    0,
  );
}

function deckMarketCost(context: DayContext, deckId: string): number {
  const deck = context.state.decks[deckId];
  if (deck === undefined) {
    return METRICS_CONFIG.accessibility.comfortableMedianMetaDeckCost * 2;
  }
  return deck.cards.reduce((total, entry) => {
    const printingIds = Object.values(context.state.printings)
      .filter((printing) => printing.cardId === entry.cardId)
      .map((printing) => printing.id);
    const prices = [
      ...printingIds.flatMap((printingId) => {
        const snapshot = context.state.market.snapshots[printingId];
        return snapshot === undefined ? [] : [snapshot.lastPrice];
      }),
      ...context.state.market.listings
        .filter((listing) => printingIds.includes(listing.printingId))
        .map((listing) => listing.price),
    ];
    const price =
      prices.length === 0
        ? METRICS_CONFIG.accessibility.comfortableMedianMetaDeckCost * 2
        : Math.min(...prices);
    return total + price * entry.count;
  }, 0);
}

function median(values: readonly number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function deriveAccessibility(context: DayContext): number {
  const starterProducts = Object.values(context.state.products)
    .filter((product) => product.kind === "STARTER")
    .sort((left, right) => compareIds(left.id, right.id));
  const starterAvailability =
    starterProducts.length === 0
      ? 0
      : starterProducts.filter(
          (product) =>
            getAvailableProductInventory(context.state, product.id) > 0,
        ).length / starterProducts.length;
  const starterPrice =
    starterProducts.length === 0
      ? METRICS_CONFIG.accessibility.comfortableStarterPrice * 2
      : Math.min(...starterProducts.map((product) => product.msrp));
  const metaDeckIds = Object.keys(context.meta.deckStats).sort(compareIds);
  const deckIds =
    metaDeckIds.length === 0
      ? Object.keys(context.state.decks).sort(compareIds)
      : metaDeckIds;
  const deckCosts = deckIds.map((id) => deckMarketCost(context, id));
  const deckEntries = deckIds.flatMap(
    (id) => context.state.decks[id]?.cards ?? [],
  );
  const coreCardScarcity =
    deckEntries.length === 0
      ? 1
      : deckEntries.filter(
          (entry) => physicalCardSupply(context, entry.cardId) < entry.count,
        ).length / deckEntries.length;
  const fallbackDeckCost =
    METRICS_CONFIG.accessibility.comfortableMedianMetaDeckCost * 2;
  const cheapestCompetitiveDeckCost =
    deckCosts.length === 0 ? fallbackDeckCost : Math.min(...deckCosts);
  const medianMetaDeckCost = median(deckCosts, fallbackDeckCost);
  const budgetDeckViability =
    deckCosts.length === 0
      ? 0
      : deckCosts.filter(
          (cost) =>
            cost <= METRICS_CONFIG.accessibility.comfortableCompetitiveDeckCost,
        ).length / deckCosts.length;

  return calculateAccessibility({
    starterAvailability,
    starterPrice,
    cheapestCompetitiveDeckCost,
    medianMetaDeckCost,
    coreCardScarcity,
    budgetDeckViability,
  });
}

function phase08AccessibilitySatisfactionAndChurn(context: DayContext): void {
  context.accessibility = deriveAccessibility(context);
  context.metaHealth = calculateMetaHealth({
    deckStats: context.meta.deckStats,
    matchups: context.meta.matchups,
    accessibility: context.accessibility,
    staleDays: 0,
  }).score;
  const players = Object.values(context.state.players).sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const activePlayers = players.filter(
    (player) => player.activity !== "CHURNED",
  ).length;
  const socialActivity =
    players.length === 0 ? 0 : activePlayers / players.length;
  for (const player of players) {
    const ownedCards = Object.values(player.collection).reduce(
      (total, quantity) => total + quantity,
      0,
    );
    const target = calculateSatisfactionTarget({
      gameplayQuality: context.metaHealth / 100,
      affordability: context.accessibility / 100,
      novelty: 0.5,
      trust: 0.5,
      socialActivity,
      collectionExperience: Math.min(1, ownedCards / RULES_CONFIG.deckSize),
    });
    player.satisfaction = updateSatisfaction(player.satisfaction, target);

    const rng = phaseRng(
      context.state,
      "persistent-player-lifecycle",
      player.id,
    );
    const rates = METRICS_CONFIG.lifecycle.rates;
    if (
      player.activity === "NEW" &&
      player.tenureDays >= METRICS_CONFIG.lifecycle.onboardingDays &&
      rng.nextFloat() <
        clampUnit(
          rates.newToActiveBase +
            player.satisfaction * rates.newToActiveSatisfactionWeight,
        )
    ) {
      player.activity = "ACTIVE";
    } else if (
      player.activity === "ACTIVE" &&
      rng.nextFloat() <
        clampUnit(
          rates.activeToAtRiskBase +
            (1 - player.satisfaction) *
              rates.activeToAtRiskDissatisfactionWeight,
        )
    ) {
      player.activity = "AT_RISK";
    } else if (
      player.activity === "AT_RISK" &&
      rng.nextFloat() <
        clampUnit(
          rates.atRiskToChurnedBase +
            (1 - player.satisfaction) *
              rates.atRiskToChurnedDissatisfactionWeight,
        )
    ) {
      player.activity = "CHURNED";
    } else if (
      player.activity === "CHURNED" &&
      rng.nextFloat() <
        clampUnit(
          rates.churnedToReturningBase +
            ((context.state.metrics.hype + context.state.metrics.brandTrust) /
              200) *
              rates.churnedToReturningHypeTrustWeight,
        )
    ) {
      player.activity = "ACTIVE";
      player.tenureDays += 1;
    }
  }
}

function phase09StructuredCommunityEvents(context: DayContext): void {
  if (context.sales.unitsSold > 0) {
    addNotableEvent(context, "PRIMARY_PRODUCT_SALES");
  }
  if (context.marketTrades > 0) {
    addNotableEvent(context, "SECONDARY_MARKET_TRADES");
  }
}

function average(values: readonly number[], fallback: number): number {
  return values.length === 0
    ? fallback
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function marketPriceMomentum(context: DayContext): number {
  const movements = Object.values(context.state.market.snapshots).flatMap(
    (snapshot) => {
      const history = snapshot.priceHistory;
      if (history.length < 2) {
        return [];
      }
      const previous = history[history.length - 2]!.price;
      const current = history[history.length - 1]!.price;
      return [
        clampUnit(
          METRICS_CONFIG.signals.neutralPriceMomentum +
            (current - previous) / Math.max(1, previous),
        ),
      ];
    },
  );
  return average(movements, METRICS_CONFIG.signals.neutralPriceMomentum);
}

function phase10UpdateCoreWorldMetrics(context: DayContext): void {
  const metrics = context.state.metrics;
  const satisfaction = averagePlayerSatisfaction(context.state);
  const playerCount = Math.max(1, metrics.activePlayers);
  const snapshots = Object.values(context.state.market.snapshots);
  const nextHealth = updateWorldMetrics(metrics, {
    positiveAttention: clampUnit(
      (context.sales.unitsSold +
        context.matches.length / METRICS_CONFIG.signals.matchAttentionDivisor) /
        playerCount,
    ),
    negativeAttention: clampUnit(
      (1 - satisfaction) *
        METRICS_CONFIG.signals.dissatisfactionAttentionWeight,
    ),
    sentimentTarget: satisfaction * 100,
    collector: {
      tradingVolume: clampUnit(context.marketTrades / playerCount),
      liquidity: average(
        snapshots.map((snapshot) => snapshot.liquidity),
        0,
      ),
      priceMomentum: marketPriceMomentum(context),
      scarcityExcitement: 1 - context.accessibility / 100,
      productFreshness:
        context.sales.unitsSold > 0
          ? METRICS_CONFIG.signals.productFreshnessWithSales
          : METRICS_CONFIG.signals.productFreshnessWithoutSales,
      collectorConfidence: satisfaction,
    },
    metaHealthTarget: context.metaHealth,
    brandTrustTarget: satisfaction * 100,
  });
  Object.assign(metrics, nextHealth);
  metrics.accessibility = context.accessibility;

  const deltas = metrics.lifecycleDeltas;
  const acquisition = deltas.interestedToNew + deltas.churnedToReturning;
  const churn = deltas.atRiskToChurned;
  metrics.acquisitionToChurnRatio = acquisition / Math.max(1, churn);
  metrics.retentionRate = clampUnit(
    (metrics.previousActivePlayers - churn) /
      Math.max(1, metrics.previousActivePlayers),
  );
  metrics.activePlayerTrend =
    (metrics.activePlayers - metrics.previousActivePlayers) /
    Math.max(1, metrics.previousActivePlayers);
  metrics.consecutiveDeclineDays =
    metrics.activePlayerTrend < 0 ? metrics.consecutiveDeclineDays + 1 : 0;
  metrics.consecutiveLowActivityDays =
    metrics.activePlayers <
      METRICS_CONFIG.ecosystemRisk.terminalActivePlayers &&
    metrics.hype < METRICS_CONFIG.ecosystemRisk.terminalHype
      ? metrics.consecutiveLowActivityDays + 1
      : 0;
}

function phase11ApplyCashExpenses(context: DayContext): void {
  if (context.config.dailyOperatingCost > 0) {
    appendCashEntry(context.state.cash, {
      day: context.previousDay,
      category: "OPERATING_COST",
      amount: -context.config.dailyOperatingCost,
    });
  }
  const inventoryUnits = Object.values(context.state.printRuns).reduce(
    (total, run) =>
      run.completionDay <= context.previousDay ? total + run.quantity : total,
    0,
  );
  const holdingCost = toCurrency(
    inventoryUnits * context.config.inventoryHoldingCostPerUnit,
  );
  if (holdingCost > 0) {
    appendCashEntry(context.state.cash, {
      day: context.previousDay,
      category: "INVENTORY_COST",
      amount: -holdingCost,
    });
  }
}

function phase12Increment(context: DayContext): void {
  context.state.day = context.previousDay + 1;
}

function phase13EvaluateRiskAndGameOver(context: DayContext): void {
  const metrics = context.state.metrics;
  context.ecosystemRisk = evaluateEcosystemRisk({
    activePlayers: metrics.activePlayers,
    hype: metrics.hype,
    brandTrust: metrics.brandTrust,
    acquisitionToChurnRatio: metrics.acquisitionToChurnRatio,
    retentionRate: metrics.retentionRate,
    activePlayerTrend: metrics.activePlayerTrend,
    consecutiveDeclineDays: metrics.consecutiveDeclineDays,
    consecutiveLowActivityDays: metrics.consecutiveLowActivityDays,
    cash: context.state.cash.balance,
  });
  metrics.ecosystemRisk = context.ecosystemRisk;
  if (context.ecosystemRisk === "TERMINAL") {
    context.state.status = "GAME_OVER";
  }
  validateWorldInvariants(context.state, context.previousDay);
}

function phase14CreateReport(context: DayContext): DailyReport {
  return createDailyReport({
    day: context.previousDay,
    completedPrintRuns: context.completedPrintRuns.length,
    unitsSold: context.sales.unitsSold,
    primaryRevenue: context.sales.revenue,
    productsOpened: context.productsOpened,
    matchesSampled: context.matches.length,
    marketTrades: context.marketTrades,
    activePlayers: context.state.metrics.activePlayers,
    accessibility: context.accessibility,
    metaHealth: context.state.metrics.metaHealth,
    hype: context.state.metrics.hype,
    collectorHeat: context.state.metrics.collectorHeat,
    brandTrust: context.state.metrics.brandTrust,
    sentiment: context.state.metrics.sentiment,
    lifecycleDeltas: { ...context.state.metrics.lifecycleDeltas },
    cashBalance: context.state.cash.balance,
    ecosystemRisk: context.ecosystemRisk,
    notableEventCount: context.notableEvents.length,
  });
}

export function simulateDay(
  state: WorldState,
  commands: readonly PublisherCommand[],
  config: BalanceConfig,
): DaySimulationResult {
  validateBalanceConfig(config);
  const context: DayContext = {
    state: structuredClone(state),
    previousDay: state.day,
    commands: parsePublisherCommands(commands),
    config,
    notableEvents: [],
    completedPrintRuns: [],
    sales: { unitsSold: 0, revenue: 0, openingRequests: [] },
    productsOpened: 0,
    matches: [],
    meta: emptyMetaResult(),
    marketTrades: 0,
    accessibility: 0,
    metaHealth: 0,
    ecosystemRisk: "STABLE",
  };

  phase01CommandsAndPrintCompletion(context);
  phase02PopulationExposureAndLifecycle(context);
  phase03PrimarySalesAndProductOpening(context);
  phase04BuildOrRepairDecks(context);
  phase05SampleNormalMatches(context);
  phase06AggregateMetaAndKnowledge(context);
  phase07ClearSecondaryMarket(context);
  phase08AccessibilitySatisfactionAndChurn(context);
  phase09StructuredCommunityEvents(context);
  phase10UpdateCoreWorldMetrics(context);
  phase11ApplyCashExpenses(context);
  phase12Increment(context);
  phase13EvaluateRiskAndGameOver(context);
  const report = phase14CreateReport(context);

  return {
    nextState: context.state,
    report,
    notableEvents: context.notableEvents.map((event) => ({ ...event })),
    stateHash: hashWorldState(context.state),
  };
}
