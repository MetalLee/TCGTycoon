import { METRICS_CONFIG, RULES_CONFIG } from "@tcgtycoon/balance";
import {
  printRunId,
  type PublisherCommand,
  type WorldEvent,
  type WorldState,
} from "@tcgtycoon/domain";
import { validateDeck } from "@tcgtycoon/rules-engine";
import {
  generateCandidateDecks,
  playerOwnsGenome,
} from "../deck-evolution/deck-builder";
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
import { calculateMetaHealth } from "../metrics/world-metrics";
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

function phase04BuildOrRepairDecks(context: DayContext): void {
  const cards = Object.values(context.state.cards);
  for (const playerId of Object.keys(context.state.players).sort(compareIds)) {
    const player = context.state.players[playerId]!;
    if (player.activity === "CHURNED") {
      continue;
    }
    const hasOwnedLegalDeck = player.deckIds.some((id) => {
      const deck = context.state.decks[id];
      return (
        deck !== undefined &&
        playerOwnsGenome(player, context.state, deck) &&
        validateDeck(toDeckDefinition(deck), cards).valid
      );
    });
    if (hasOwnedLegalDeck) {
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
    const prices = context.state.market.listings
      .filter(
        (listing) =>
          context.state.printings[listing.printingId]?.cardId === entry.cardId,
      )
      .map((listing) => listing.price);
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
  const players = Object.values(context.state.players);
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
  }
  context.state.metrics.activePlayers = activePlayers;
}

function phase09StructuredCommunityEvents(context: DayContext): void {
  if (context.sales.unitsSold > 0) {
    addNotableEvent(context, "PRIMARY_PRODUCT_SALES");
  }
  if (context.marketTrades > 0) {
    addNotableEvent(context, "SECONDARY_MARKET_TRADES");
  }
}

function phase10UpdateCoreWorldMetrics(): void {
  // Canonical WorldMetrics currently stores Active Players only. Abstract
  // metric targets are calculated above and exposed in the Daily Report.
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

function phase12IncrementAndValidate(context: DayContext): void {
  context.state.day = context.previousDay + 1;
  validateWorldInvariants(context.state, context.previousDay);
}

function phase13EvaluateRiskAndGameOver(context: DayContext): void {
  const playerCount = Object.keys(context.state.players).length;
  const activePlayers = context.state.metrics.activePlayers;
  context.ecosystemRisk = evaluateEcosystemRisk({
    activePlayers,
    hype: 50,
    brandTrust: 50,
    acquisitionToChurnRatio: 1,
    retentionRate: playerCount === 0 ? 0 : activePlayers / playerCount,
    activePlayerTrend: 0,
    consecutiveDeclineDays: 0,
    consecutiveLowActivityDays: 0,
    cash: context.state.cash.balance,
  });
  if (context.ecosystemRisk === "TERMINAL") {
    context.state.status = "GAME_OVER";
  }
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
    metaHealth: context.metaHealth,
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
    commands,
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
  phase10UpdateCoreWorldMetrics();
  phase11ApplyCashExpenses(context);
  phase12IncrementAndValidate(context);
  phase13EvaluateRiskAndGameOver(context);
  const report = phase14CreateReport(context);

  return {
    nextState: context.state,
    report,
    notableEvents: context.notableEvents.map((event) => ({ ...event })),
    stateHash: hashWorldState(context.state),
  };
}
