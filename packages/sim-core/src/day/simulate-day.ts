import {
  DECK_EVOLUTION_CONFIG,
  META_CONFIG,
  MARKETING_CONFIG,
  METRICS_CONFIG,
  OPERATIONS_CONFIG,
  POPULATION_CONFIG,
  RULES_CONFIG,
  TOURNAMENT_CONFIG,
} from "@tcgtycoon/balance";
import {
  operationId,
  parsePublisherCommands,
  printRunId,
  productId,
  type CardId,
  type DeckId,
  type OperationProject,
  type PublisherCommand,
  type TournamentSchedule,
  type WorldEvent,
  type WorldEventContext,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  mutateDeck,
  generateCandidateDecks,
  playerOwnsGenome,
} from "../deck-evolution/deck-builder";
import { calculateAdoptionScore } from "../deck-evolution/adoption";
import { toDeckDefinition } from "../deck-evolution/deck-genome";
import { appendCashEntry, toCurrency } from "../economy/cash-ledger";
import { recordMilestones } from "../history/milestones";
import { calculateDeckMarketCost } from "../market/deck-cost";
import { createDailyReport, type DailyReport } from "../history/daily-report";
import {
  applyMarketTrades,
  clearPrintingAuction,
} from "../market/call-auction";
import {
  generateMarketIntents,
  refreshEndogenousListings,
} from "../market/market-intents";
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
import {
  createAnnouncementState,
  evaluateCommitments,
  publishOfficialAnnouncement,
  type AnnouncementActionType,
} from "../operations/announcements";
import {
  applyCampaignExposureToLifecycleRates,
  advanceCampaignExposure,
  scheduleCampaign,
  type CampaignExposureDelta,
} from "../operations/marketing";
import {
  activatePolicyChanges,
  createPolicyState,
  getActiveBanlist,
  schedulePolicyChange,
  applyStandardRotation,
  validateDeckForBanlist,
  type BanlistVersion,
  type PolicyState,
  type ScheduledPolicyChange,
  type StandardRotationState,
} from "../operations/policies";
import { advanceScheduledOperations } from "../operations/scheduler";
import {
  advanceExpansionDesign,
  applyCardDraftUpdate,
  createExpansion,
  finalizeExpansion,
} from "../operations/expansion-pipeline";
import {
  advancePlaytest,
  completePlaytest,
  startPlaytest,
  validatePlaytestReportRevisions,
} from "../operations/playtest";
import {
  registerTournamentEntrants,
  simulateTournament,
  type TournamentResult,
} from "../operations/tournaments";
import { openBooster, openStarter } from "../products/open-product";
import { orderPrintRun } from "../products/production";
import {
  announceRelease,
  executeReleasesDueToday,
  rescheduleRelease,
} from "../products/releases";
import {
  completePrintRunsDueToday,
  generatePrimaryDemand,
  getSellableProductInventory,
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
  activeBanlist: BanlistVersion;
  standardRotation: StandardRotationState;
  campaignExposure: CampaignExposureDelta[];
  tournamentResults: TournamentResult[];
  marketTrades: number;
  accessibility: number;
  metaHealth: number;
  ecosystemRisk: EcosystemRiskState;
  previousEcosystemRisk: EcosystemRiskState;
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

function addNotableEvent(
  context: DayContext,
  type: string,
  eventContext?: WorldEventContext,
): WorldEvent {
  const event: WorldEvent = {
    id: `day-${context.previousDay}-event-${String(
      context.notableEvents.length + 1,
    ).padStart(4, "0")}`,
    day: context.previousDay,
    type,
    ...(eventContext === undefined ? {} : { context: { ...eventContext } }),
  };
  context.notableEvents.push(event);
  context.state.history.events.push(event);
  return event;
}

function recordReleaseEvents(
  context: DayContext,
  events: readonly WorldEvent[],
): void {
  context.notableEvents.push(
    ...events.map((event) => ({
      ...event,
      ...(event.context === undefined ? {} : { context: { ...event.context } }),
    })),
  );
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

function commandOperationId(
  context: DayContext,
  index: number,
  kind: string,
): ReturnType<typeof operationId> {
  return operationId(
    `operation-${context.previousDay}-${String(index + 1).padStart(4, "0")}-${kind}`,
  );
}

function announcementActionType(
  topic: Extract<PublisherCommand, { type: "PUBLISH_ANNOUNCEMENT" }>["topic"],
): AnnouncementActionType {
  switch (topic) {
    case "EXPANSION":
      return "EXPANSION_RELEASE";
    case "BALANCE":
      return "BALANCE_CHANGE";
    case "REPRINT":
      return "REPRINT_PLAN";
    case "TOURNAMENT":
      return "TOURNAMENT_PROMOTION";
    case "DEVELOPMENT":
      return "DEVELOPMENT_UPDATE";
    case "APOLOGY_RESPONSE":
      return "ISSUE_RESPONSE";
  }
}

function scheduleCommand(
  context: DayContext,
  command: PublisherCommand,
  index: number,
): void {
  const id = commandOperationId(context, index, command.type.toLowerCase());
  switch (command.type) {
    case "SCHEDULE_BAN":
    case "SCHEDULE_RESTRICTION": {
      const policy = restorePolicyState(context.state);
      const change = schedulePolicyChange(
        policy,
        {
          id,
          kind: command.type === "SCHEDULE_BAN" ? "BAN" : "RESTRICTION",
          cardId: command.cardId,
          createdDay: context.previousDay,
          timing: command.timing,
        },
        OPERATIONS_CONFIG,
      );
      context.state.operations ??= {};
      context.state.operations[id] = change.operation;
      break;
    }
    case "START_CAMPAIGN": {
      const cashCost =
        MARKETING_CONFIG.campaigns[command.campaignType].dailyCashCost *
        command.durationDays;
      if (context.state.cash.balance < cashCost) {
        throw new Error(`Insufficient cash to start Campaign ${id}`);
      }
      appendCashEntry(context.state.cash, {
        day: context.previousDay,
        category: "MARKETING",
        sourceId: id,
        amount: -cashCost,
      });
      scheduleCampaign(context.state, {
        id,
        campaignType: command.campaignType,
        durationDays: command.durationDays,
        createdDay: context.previousDay,
        startDay: command.startDay,
      });
      break;
    }
    case "CREATE_TOURNAMENT": {
      const preset = TOURNAMENT_CONFIG[command.preset];
      if (command.eventDay - context.previousDay < preset.prepDays) {
        throw new RangeError(
          `${command.preset} tournaments require ${preset.prepDays} preparation days`,
        );
      }
      if (context.state.cash.balance < preset.cashCost) {
        throw new Error(`Insufficient cash to schedule Tournament ${id}`);
      }
      appendCashEntry(context.state.cash, {
        day: context.previousDay,
        category: "TOURNAMENT",
        sourceId: id,
        amount: -preset.cashCost,
      });
      context.state.operations ??= {};
      context.state.operations[id] = {
        id,
        type: "TOURNAMENT",
        createdDay: context.previousDay,
        startDay: command.eventDay,
        completionDay: command.eventDay,
        status: "PLANNED",
        progressDays: 0,
        payload: { tournamentId: command.tournamentId },
      };
      context.state.history.events.push({
        id: `tournament-scheduled-${command.tournamentId}`,
        day: context.previousDay,
        type: `TOURNAMENT_SCHEDULED_${command.preset}`,
        context: {
          reason: JSON.stringify({
            tournamentId: command.tournamentId,
            name: command.name,
          }),
        },
      });
      break;
    }
    case "PUBLISH_ANNOUNCEMENT": {
      const subjectId = command.subjectId ?? `topic:${command.topic}`;
      context.state.announcementState ??= createAnnouncementState();
      publishOfficialAnnouncement(
        context.state,
        context.state.announcementState,
        {
          id,
          day: context.previousDay,
          topic: command.topic,
          text: command.text,
          boundAction: {
            type: announcementActionType(command.topic),
            subjectId,
          },
          ...(command.commitment === undefined
            ? {}
            : {
                commitment: {
                  id: `${id}-commitment`,
                  ...command.commitment,
                },
              }),
        },
      );
      break;
    }
  }
}

function policyOperations(
  world: WorldState,
): Extract<OperationProject, { type: "POLICY_CHANGE" }>[] {
  return Object.values(world.operations ?? {})
    .filter(
      (
        operation,
      ): operation is Extract<OperationProject, { type: "POLICY_CHANGE" }> =>
        operation.type === "POLICY_CHANGE",
    )
    .sort(
      (left, right) =>
        (left.completionDay ?? Number.MAX_SAFE_INTEGER) -
          (right.completionDay ?? Number.MAX_SAFE_INTEGER) ||
        compareIds(left.id, right.id),
    );
}

function restorePolicyState(world: WorldState): PolicyState {
  const state = createPolicyState();
  const banned = new Set<CardId>();
  const restricted = new Set<CardId>();
  for (const operation of policyOperations(world)) {
    const effectiveDay = operation.completionDay ?? operation.startDay;
    if (effectiveDay === undefined) {
      throw new Error(`Policy operation ${operation.id} has no effective day`);
    }
    const versionId = `banlist-${effectiveDay}-${operation.id}`;
    const activated = operation.status === "COMPLETED";
    const change: ScheduledPolicyChange = {
      id: operation.id,
      kind: operation.payload.kind,
      cardId: operation.payload.cardId,
      createdDay: operation.createdDay,
      effectiveDay,
      timing:
        effectiveDay - operation.createdDay <= 1 ? "EMERGENCY" : "SCHEDULED",
      operation,
      ...(activated ? { activatedVersionId: versionId } : {}),
    };
    state.scheduledChanges.push(change);
    if (!activated) {
      continue;
    }
    if (change.kind === "BAN") {
      banned.add(change.cardId);
      restricted.delete(change.cardId);
    } else if (!banned.has(change.cardId)) {
      restricted.add(change.cardId);
    }
    state.banlistVersions.push(
      Object.freeze({
        id: versionId,
        effectiveDay,
        bannedCardIds: Object.freeze([...banned].sort(compareIds)),
        restrictedCardIds: Object.freeze([...restricted].sort(compareIds)),
      }),
    );
  }
  return state;
}

function phase01ActivatePolicies(context: DayContext): void {
  const state = restorePolicyState(context.state);
  const activated = activatePolicyChanges(state, context.previousDay);
  context.activeBanlist = getActiveBanlist(state, context.previousDay);
  for (const version of activated) {
    const operation = policyOperations(context.state).find(
      (candidate) =>
        `banlist-${version.effectiveDay}-${candidate.id}` === version.id,
    )!;
    addNotableEvent(context, "POLICY_CHANGE_EFFECTIVE", {
      reason: `${operation.payload.kind}:${operation.payload.cardId}:${version.id}`,
      publicCommitment: true,
      trustSignal: "NONE",
    });
  }
}

function phase02AdvanceProjectsAndPlaytests(context: DayContext): void {
  const projects = Object.fromEntries(
    Object.entries(context.state.operations ?? {}).filter(
      ([, operation]) =>
        operation.type !== "POLICY_CHANGE" && operation.type !== "CAMPAIGN",
    ),
  );
  const previousStatuses = new Map(
    Object.values(projects).map((operation) => [
      operation.id,
      operation.status,
    ]),
  );
  advanceScheduledOperations(
    { status: context.state.status, operations: projects },
    context.previousDay,
  );
  for (const operation of Object.values(projects).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    if (operation.type === "PLAYTEST") {
      const run = context.state.operationEvidence?.playtests.runs[operation.id];
      if (run !== undefined && run.status !== "COMPLETED") {
        advancePlaytest(run, context.previousDay);
        context.state.operations![operation.id] = structuredClone(
          run.operation,
        );
        if (run.status === "READY") {
          const report = completePlaytest(run);
          context.state.operationEvidence!.playtests.reports[report.id] =
            report;
          context.state.operations![operation.id] = structuredClone(
            run.operation,
          );
          addNotableEvent(context, "PLAYTEST_COMPLETED", {
            reason: `${operation.payload.expansionId}:${operation.payload.tier}:${report.id}`,
          });
        }
        continue;
      }
    }
    if (operation.type === "EXPANSION_DESIGN") {
      const project =
        context.state.expansionProjects?.[operation.payload.expansionId];
      if (
        project !== undefined &&
        project.stage !== "PLAYTEST" &&
        project.stage !== "FINALIZED" &&
        project.stage !== "PRINTING" &&
        project.stage !== "RELEASED"
      ) {
        advanceExpansionDesign(project, operation);
      }
    }
    if (
      operation.type === "PLAYTEST" &&
      previousStatuses.get(operation.id) !== "COMPLETED" &&
      operation.status === "COMPLETED"
    ) {
      addNotableEvent(context, "PLAYTEST_COMPLETED", {
        reason: `${operation.payload.expansionId}:${operation.payload.tier}`,
      });
    }
  }
}

function scheduledTournament(
  context: DayContext,
  operation: Extract<OperationProject, { type: "TOURNAMENT" }>,
): TournamentSchedule {
  const scheduled = context.state.history.events.find((event) => {
    if (
      !event.type.startsWith("TOURNAMENT_SCHEDULED_") ||
      event.context?.reason === undefined ||
      event.day !== operation.createdDay
    ) {
      return false;
    }
    try {
      const metadata = JSON.parse(event.context.reason) as {
        tournamentId?: string;
      };
      return metadata.tournamentId === operation.payload.tournamentId;
    } catch {
      return false;
    }
  });
  const preset = scheduled?.type.slice("TOURNAMENT_SCHEDULED_".length);
  if (preset !== "LOCAL" && preset !== "REGIONAL" && preset !== "MAJOR") {
    throw new Error(
      `Tournament ${operation.payload.tournamentId} has no preset`,
    );
  }
  if (scheduled === undefined || scheduled.context?.reason === undefined) {
    throw new Error(
      `Tournament ${operation.payload.tournamentId} has no schedule metadata`,
    );
  }
  const metadata = JSON.parse(scheduled.context.reason) as { name?: string };
  if (metadata.name === undefined || metadata.name.length === 0) {
    throw new Error(`Tournament ${operation.payload.tournamentId} has no name`);
  }
  return {
    id: operation.payload.tournamentId,
    name: metadata.name,
    preset,
    createdDay: operation.createdDay,
    eventDay:
      operation.completionDay ?? operation.startDay ?? context.previousDay,
  };
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
      const id = printRunId(
        `print-run-${context.previousDay}-${command.productId}-${String(
          index + 1,
        ).padStart(4, "0")}`,
      );
      const run = orderPrintRun(
        context.state,
        {
          id,
          productId: command.productId,
          quantity: command.quantity,
        },
        context.config.production,
      );
      const project = context.state.expansionProjects?.[run.sourceExpansionId];
      if (project !== undefined) {
        project.stage = "PRINTING";
      }
      addNotableEvent(context, "PRINT_RUN_ORDERED");
      break;
    }
    case "ANNOUNCE_RELEASE": {
      recordReleaseEvents(context, [
        announceRelease(context.state, command.productId, command.releaseDay),
      ]);
      break;
    }
    case "SCHEDULE_RELEASE": {
      const product = context.state.products[command.productId];
      if (product === undefined) {
        throw new Error(`Unknown product ${command.productId}.`);
      }
      if (product.releaseStatus === "UNANNOUNCED") {
        recordReleaseEvents(context, [
          announceRelease(context.state, command.productId, command.releaseDay),
        ]);
      } else {
        recordReleaseEvents(
          context,
          rescheduleRelease(
            context.state,
            command.productId,
            command.releaseDay,
          ),
        );
      }
      const id = commandOperationId(context, index, "schedule-release");
      context.state.operations ??= {};
      context.state.operations[id] = {
        id,
        type: "RELEASE",
        createdDay: context.previousDay,
        startDay: command.releaseDay,
        completionDay: command.releaseDay,
        status: "PLANNED",
        progressDays: 0,
        payload: { productId: command.productId },
      };
      break;
    }
    case "RESCHEDULE_RELEASE": {
      recordReleaseEvents(
        context,
        rescheduleRelease(
          context.state,
          command.productId,
          command.newReleaseDay,
        ),
      );
      break;
    }
    case "SCHEDULE_BAN":
    case "SCHEDULE_RESTRICTION":
    case "CREATE_TOURNAMENT":
    case "START_CAMPAIGN":
    case "PUBLISH_ANNOUNCEMENT":
      scheduleCommand(context, command, index);
      break;
    case "CREATE_EXPANSION":
      context.state.expansionProjects ??= {};
      if (
        context.state.expansionProjects[command.expansionId] !== undefined ||
        context.state.expansions[command.expansionId] !== undefined
      ) {
        throw new Error(`Expansion ID already exists: ${command.expansionId}`);
      }
      {
        const designOperationId = commandOperationId(
          context,
          index,
          "expansion-design",
        );
        const designCost =
          OPERATIONS_CONFIG.expansionDesignCashCostBySize[command.size];
        if (context.state.cash.balance < designCost) {
          throw new Error(
            `Insufficient cash to create Expansion ${command.expansionId}`,
          );
        }
        appendCashEntry(context.state.cash, {
          day: context.previousDay,
          category: "EXPANSION_DESIGN",
          sourceId: designOperationId,
          amount: -designCost,
        });
        const project = createExpansion({
          id: command.expansionId,
          operationId: designOperationId,
          name: command.name,
          size: command.size,
          createdDay: context.previousDay,
          brief: command.brief,
        });
        context.state.expansionProjects[project.id] = project;
        context.state.expansions[project.id] = {
          id: project.id,
          name: project.name,
        };
        context.state.operations ??= {};
        context.state.operations[designOperationId] = {
          id: designOperationId,
          type: "EXPANSION_DESIGN",
          createdDay: context.previousDay,
          startDay: context.previousDay,
          completionDay: context.previousDay + project.designTargetDays - 1,
          status: "PLANNED",
          progressDays: 0,
          payload: { expansionId: project.id },
        };
      }
      break;
    case "UPDATE_EXPANSION_BRIEF": {
      const project = context.state.expansionProjects?.[command.expansionId];
      if (project === undefined) {
        throw new Error(`Unknown Expansion Project ${command.expansionId}`);
      }
      if (
        project.stage === "FINALIZED" ||
        project.stage === "PRINTING" ||
        project.stage === "RELEASED"
      ) {
        throw new Error(`Expansion ${project.id} gameplay rules are locked`);
      }
      project.brief = structuredClone(command.brief);
      break;
    }
    case "UPDATE_CARD_DRAFT": {
      const project = context.state.expansionProjects?.[command.expansionId];
      if (project === undefined) {
        throw new Error(`Unknown Expansion Project ${command.expansionId}`);
      }
      applyCardDraftUpdate(project, command.cardId, {
        definition: command.draft,
      });
      for (const report of Object.values(
        context.state.operationEvidence?.playtests.reports ?? {},
      )) {
        if (report.expansionId === project.id) {
          validatePlaytestReportRevisions(report, project);
        }
      }
      break;
    }
    case "START_PLAYTEST": {
      const project = context.state.expansionProjects?.[command.expansionId];
      if (project === undefined) {
        throw new Error(`Unknown Expansion Project ${command.expansionId}`);
      }
      const run = startPlaytest(project, command.tier, {
        startDay: context.previousDay,
        worldSeed: context.state.worldSeed,
      });
      if (context.state.cash.balance < run.cashCost) {
        throw new Error(`Insufficient cash to start Playtest ${run.id}`);
      }
      appendCashEntry(context.state.cash, {
        day: context.previousDay,
        category: "PLAYTEST",
        sourceId: run.id,
        amount: -run.cashCost,
      });
      context.state.operations ??= {};
      context.state.operations[run.operation.id] = run.operation;
      context.state.operationEvidence ??= {
        playtests: { runs: {}, reports: {} },
        tournamentAttention: [],
      };
      context.state.operationEvidence.playtests.runs[run.operation.id] = run;
      break;
    }
    case "FINALIZE_EXPANSION": {
      const project = context.state.expansionProjects?.[command.expansionId];
      if (project === undefined) {
        throw new Error(`Unknown Expansion Project ${command.expansionId}`);
      }
      const cards = finalizeExpansion(project);
      for (const card of cards) {
        if (context.state.cards[card.id] !== undefined) {
          throw new Error(`Card ID already exists: ${card.id}`);
        }
        context.state.cards[card.id] = structuredClone(card);
      }
      addNotableEvent(context, "EXPANSION_FINALIZED", {
        reason: project.id,
        publicCommitment: true,
        trustSignal: "NONE",
      });
      const boosterId = productId(`product-${project.id}-booster`);
      context.state.products[boosterId] = {
        id: boosterId,
        expansionId: project.id,
        name: `${project.name} Booster`,
        kind: "BOOSTER",
        msrp: POPULATION_CONFIG.launchBoosterMsrp,
        cardIds: cards.map((card) => card.id),
        releaseStatus: "UNANNOUNCED",
        internalReleaseDay: context.previousDay + 1,
      };
      break;
    }
  }
}

function phase03CommandsPrintCompletionAndReleases(context: DayContext): void {
  context.completedPrintRuns = completePrintRunsDueToday(context.state);
  context.completedPrintRuns.forEach((completed) => {
    addNotableEvent(context, "PRINT_RUN_COMPLETED", {
      productId: completed.productId,
    });
    const run = context.state.printRuns[completed.printRunId]!;
    const includesReprintPrinting = run.printingIds.some(
      (id) => context.state.printings[id]?.edition === "REPRINT",
    );
    if (run.edition === "UNLIMITED" || includesReprintPrinting) {
      addNotableEvent(context, "REPRINT_COMPLETED", {
        productId: completed.productId,
        publicCommitment: true,
        trustSignal: "NONE",
      });
    }
  });
  const releases = executeReleasesDueToday(
    context.state,
    context.config.release,
  );
  for (const release of releases) {
    if (release.type !== "PRODUCT_RELEASED") continue;
    const productId = release.context?.productId;
    if (productId === undefined) continue;
    const expansionId = context.state.products[productId]?.expansionId;
    if (expansionId !== undefined) {
      const project = context.state.expansionProjects?.[expansionId];
      if (project !== undefined) project.stage = "RELEASED";
    }
  }
  recordReleaseEvents(context, releases);
  const firstReleaseByExpansion = new Map<string, number>();
  for (const product of Object.values(context.state.products).sort(
    (left, right) => compareIds(left.id, right.id),
  )) {
    if (product.releasedDay === undefined) {
      continue;
    }
    firstReleaseByExpansion.set(
      product.expansionId,
      Math.min(
        firstReleaseByExpansion.get(product.expansionId) ??
          Number.MAX_SAFE_INTEGER,
        product.releasedDay,
      ),
    );
  }
  const releaseOrder = [...firstReleaseByExpansion.entries()]
    .sort(
      ([leftId, leftDay], [rightId, rightDay]) =>
        leftDay - rightDay || compareIds(leftId, rightId),
    )
    .map(([id]) => id as WorldState["expansions"][string]["id"]);
  context.standardRotation = applyStandardRotation(context.state, releaseOrder);
  if (
    releases.some((event) => event.type === "PRODUCT_RELEASED") &&
    context.standardRotation.rotatedExpansionIds.length > 0
  ) {
    addNotableEvent(context, "STANDARD_ROTATION", {
      reason: JSON.stringify(context.standardRotation),
    });
  }
}

function phase04CampaignExposure(context: DayContext): void {
  context.campaignExposure = advanceCampaignExposure(
    context.state,
    context.previousDay,
  );
  for (const exposure of context.campaignExposure) {
    addNotableEvent(context, "CAMPAIGN_EXPOSURE", {
      reason: JSON.stringify(exposure),
    });
  }
}

function phase05PopulationExposureAndLifecycle(context: DayContext): void {
  const metrics = context.state.metrics;
  const rates = METRICS_CONFIG.lifecycle.rates;
  const satisfaction = averagePlayerSatisfaction(context.state);
  const campaignRates = applyCampaignExposureToLifecycleRates(
    context.state,
    {
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
    context.campaignExposure,
  );
  const lifecycle = processLifecycleDay(metrics.lifecycle, {
    worldSeed: context.state.worldSeed,
    day: context.previousDay,
    rates: campaignRates,
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
          request.printingIds,
        );
      } else {
        const contents = context.config.starterContents[product.id];
        if (contents === undefined) {
          throw new Error(
            `Starter product ${product.id} has no configured physical contents.`,
          );
        }
        openStarter(
          context.state,
          product.id,
          request.buyerId,
          contents,
          request.printingIds,
        );
      }
      openingSequence += 1;
      context.productsOpened += 1;
    }
  }
}

function phase06PrimarySalesAndProductOpening(context: DayContext): void {
  const demand = generatePrimaryDemand(
    context.state,
    phaseRng(context.state, "primary-demand"),
    context.config.productLifecycle,
    context.config.starterContents,
  );
  context.sales = resolvePrimarySales(
    context.state,
    demand,
    phaseRng(context.state, "primary-sales"),
  );
  openPurchasedProducts(context);
}

function deckIsStandardLegal(
  context: DayContext,
  deck: WorldState["decks"][string],
): boolean {
  if (context.standardRotation.activeExpansionIds.length === 0) {
    return true;
  }
  const active = new Set(context.standardRotation.activeExpansionIds);
  return deck.cards.every((entry) => {
    const cardExpansionIds = Object.values(context.state.printings)
      .filter((printing) => printing.cardId === entry.cardId)
      .map((printing) => printing.sourceExpansionId);
    return (
      cardExpansionIds.length === 0 ||
      cardExpansionIds.some((expansionId) => active.has(expansionId))
    );
  });
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
  const recentTournamentPrestige = Math.max(
    0,
    ...(context.state.operationEvidence?.tournamentAttention ?? [])
      .filter(
        (event) =>
          event.deckId === deckId &&
          event.day >= context.previousDay - 7 &&
          event.day <= context.previousDay,
      )
      .map((event) => event.tournamentPrestige),
  );
  return {
    performance: stats?.observedWinRate ?? 0.5,
    socialExposure: player.knowledge.knownDeckIds.includes(deckId)
      ? DECK_EVOLUTION_CONFIG.knownDeckSocialExposure
      : DECK_EVOLUTION_CONFIG.inheritedDeckSocialExposure,
    tournamentPrestige: Math.max(
      recentTournamentPrestige,
      clampUnit(
        (stats?.sampleCount ?? 0) / META_CONFIG.confidenceMinimumSamples.high,
      ),
    ),
    influencerExposure: Object.values(context.state.agents).some(
      (agent) => agent.playerId === player.id,
    )
      ? DECK_EVOLUTION_CONFIG.namedAgentInfluencerExposure
      : 0,
    novelty,
    deckPrice: calculateDeckMarketCost(context.state, deckId),
    missingCardCount: 0,
    complexity: deckComplexity(context, deckId),
  };
}

function phase07BuildOrRepairDecks(context: DayContext): void {
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
          deckIsStandardLegal(context, deck) &&
          validateDeckForBanlist(
            toDeckDefinition(deck),
            cards,
            context.activeBanlist,
          ).valid
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
      if (
        !deckIsStandardLegal(context, child) ||
        !validateDeckForBanlist(
          toDeckDefinition(child),
          cards,
          context.activeBanlist,
        ).valid
      ) {
        continue;
      }
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
      if (
        deckIsStandardLegal(context, candidate) &&
        validateDeckForBanlist(
          toDeckDefinition(candidate),
          cards,
          context.activeBanlist,
        ).valid
      ) {
        context.state.decks[candidate.id] = candidate;
        player.deckIds = [candidate.id];
      } else {
        player.deckIds = [];
      }
    } else {
      player.deckIds = [];
    }
  }
}

function phase08SampleNormalMatches(context: DayContext): void {
  context.matches = sampleDailyMatches(
    context.state,
    phaseRng(context.state, "normal-matches"),
    (deck) =>
      deckIsStandardLegal(context, deck) &&
      validateDeckForBanlist(
        toDeckDefinition(deck),
        Object.values(context.state.cards),
        context.activeBanlist,
      ).valid,
  );
}

function phase09RunScheduledTournaments(context: DayContext): void {
  const due = Object.values(context.state.operations ?? {})
    .filter(
      (
        operation,
      ): operation is Extract<OperationProject, { type: "TOURNAMENT" }> =>
        operation.type === "TOURNAMENT" &&
        operation.status === "COMPLETED" &&
        operation.completionDay === context.previousDay,
    )
    .sort((left, right) => compareIds(left.id, right.id));

  for (const operation of due) {
    const schedule = scheduledTournament(context, operation);
    const registration = registerTournamentEntrants(
      context.state,
      schedule,
      context.activeBanlist,
      (deck) => deckIsStandardLegal(context, deck),
    );
    if (registration.entrants.length < 2) {
      addNotableEvent(context, "TOURNAMENT_CANCELLED", {
        reason: `${schedule.id}:INSUFFICIENT_ENTRANTS`,
      });
      continue;
    }
    const result = simulateTournament(context.state, registration);
    context.tournamentResults.push(result);
    context.state.operationEvidence ??= {
      playtests: { runs: {}, reports: {} },
      tournamentAttention: [],
    };
    context.state.operationEvidence.tournamentAttention = [
      ...context.state.operationEvidence.tournamentAttention.filter(
        (event) => event.day >= context.previousDay - 30,
      ),
      ...result.attentionEvents.map((event) => ({
        day: event.day,
        tournamentId: event.tournamentId,
        deckId: event.deckId,
        socialExposure: event.socialExposure,
        tournamentPrestige: event.tournamentPrestige,
      })),
    ];
    const sequenceOffset = context.matches.length;
    context.matches.push(
      ...result.matches.map((match, index) => ({
        sequence: sequenceOffset + index,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        deckAId: match.deckAId,
        deckBId: match.deckBId,
        winnerPlayerId: match.winnerPlayerId,
        winnerDeckId: match.winnerDeckId,
        loserDeckId: match.loserDeckId,
        turns: match.turns,
      })),
    );
    addNotableEvent(context, "TOURNAMENT_COMPLETED", {
      reason: JSON.stringify(result),
      publicCommitment: true,
      trustSignal: "NONE",
    });
  }
}

function phase10AggregateMetaAndKnowledge(context: DayContext): void {
  context.meta = updateMetaState(context.state, context.matches);
  context.state.meta = {
    deckStats: structuredClone(context.meta.deckStats),
    matchups: structuredClone(context.meta.matchups),
  };
}

function phase11ClearSecondaryMarket(context: DayContext): void {
  refreshEndogenousListings(context.state);
  const intents = generateMarketIntents(context.state, {
    bannedCardIds: context.activeBanlist.bannedCardIds,
    featuredDeckIds: (
      context.state.operationEvidence?.tournamentAttention ?? []
    )
      .filter(
        (event) =>
          event.day >= context.previousDay - 7 &&
          event.day <= context.previousDay,
      )
      .sort(
        (left, right) =>
          right.tournamentPrestige - left.tournamentPrestige ||
          compareIds(left.deckId, right.deckId),
      )
      .map((event) => event.deckId),
  });
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

function sealedStarterDeckCost(
  context: DayContext,
  deckId: string,
): number | undefined {
  const deck = context.state.decks[deckId];
  if (deck === undefined) {
    return undefined;
  }

  const required = new Map(
    deck.cards.map((entry) => [entry.cardId, entry.count] as const),
  );
  const prices = Object.entries(context.config.starterContents).flatMap(
    ([productId, printingIds]) => {
      const product = context.state.products[productId];
      if (
        product?.kind !== "STARTER" ||
        product.releaseStatus !== "LIVE" ||
        getSellableProductInventory(context.state, product.id) <= 0
      ) {
        return [];
      }
      const contents = new Map<string, number>();
      for (const printingId of printingIds) {
        const cardId = context.state.printings[printingId]?.cardId;
        if (cardId !== undefined) {
          contents.set(cardId, (contents.get(cardId) ?? 0) + 1);
        }
      }
      return [...required].every(
        ([cardId, count]) => (contents.get(cardId) ?? 0) >= count,
      )
        ? [product.msrp]
        : [];
    },
  );
  return prices.length === 0 ? undefined : Math.min(...prices);
}

function availableSealedStarterPrices(context: DayContext): number[] {
  return Object.keys(context.config.starterContents).flatMap((productId) => {
    const product = context.state.products[productId];
    const contents = context.config.starterContents[productId]!;
    return product?.kind === "STARTER" &&
      product.releaseStatus === "LIVE" &&
      contents.length === RULES_CONFIG.deckSize &&
      getSellableProductInventory(context.state, product.id) > 0
      ? [product.msrp]
      : [];
  });
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
            getSellableProductInventory(context.state, product.id) > 0,
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
  const deckCosts = [
    ...deckIds.map((id) =>
      Math.min(
        calculateDeckMarketCost(context.state, id),
        sealedStarterDeckCost(context, id) ?? Number.POSITIVE_INFINITY,
      ),
    ),
    ...availableSealedStarterPrices(context),
  ];
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

function phase12AccessibilitySatisfactionAndChurn(context: DayContext): void {
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

function phase13StructuredCommunityEvents(context: DayContext): void {
  if (context.sales.unitsSold > 0) {
    addNotableEvent(context, "PRIMARY_PRODUCT_SALES");
  }
  if (context.marketTrades > 0) {
    addNotableEvent(context, "SECONDARY_MARKET_TRADES");
  }
  if (context.state.announcementState !== undefined) {
    const outcomes = evaluateCommitments(
      context.state.announcementState,
      context.state.history.events,
      context.previousDay,
    );
    for (const event of outcomes) {
      context.state.history.events.push(event);
      context.notableEvents.push(event);
    }
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

function releaseTrustSignals(context: DayContext): {
  negative: number;
  positive: number;
} {
  return context.notableEvents.reduce(
    (counts, event) => {
      if (event.context?.trustSignal === "NEGATIVE") {
        counts.negative += 1;
      } else if (event.context?.trustSignal === "POSITIVE") {
        counts.positive += 1;
      }
      return counts;
    },
    { negative: 0, positive: 0 },
  );
}

function phase14UpdateCoreWorldMetrics(context: DayContext): void {
  const metrics = context.state.metrics;
  const satisfaction = averagePlayerSatisfaction(context.state);
  const playerCount = Math.max(1, metrics.activePlayers);
  const snapshots = Object.values(context.state.market.snapshots);
  const releaseSignals = releaseTrustSignals(context);
  const nextHealth = updateWorldMetrics(metrics, {
    positiveAttention: clampUnit(
      (context.sales.unitsSold +
        context.matches.length / METRICS_CONFIG.signals.matchAttentionDivisor) /
        playerCount,
    ),
    negativeAttention: clampUnit(
      (1 - satisfaction) *
        METRICS_CONFIG.signals.dissatisfactionAttentionWeight +
        releaseSignals.negative *
          METRICS_CONFIG.signals.releaseNegativeAttentionPerEvent,
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
    brandTrustTarget:
      satisfaction * 100 -
      releaseSignals.negative *
        METRICS_CONFIG.signals.releaseTrustPenaltyPerEvent +
      releaseSignals.positive *
        METRICS_CONFIG.signals.releaseTrustBonusPerEvent,
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

function phase15ApplyCashExpenses(context: DayContext): void {
  if (context.config.dailyOperatingCost > 0) {
    appendCashEntry(context.state.cash, {
      day: context.previousDay,
      category: "OPERATING_COST",
      amount: -context.config.dailyOperatingCost,
    });
  }
  const inventoryUnits = Object.values(context.state.printRuns).reduce(
    (total, run) => (run.status === "COMPLETED" ? total + run.quantity : total),
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

function phase16Increment(context: DayContext): void {
  context.state.day = context.previousDay + 1;
}

function phase17EvaluateRiskGameOverMilestonesAndInvariants(
  context: DayContext,
): void {
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
  context.notableEvents.push(
    ...recordMilestones(
      context.state,
      context.previousEcosystemRisk,
      context.previousDay,
    ),
  );
  validateWorldInvariants(context.state, context.previousDay);
}

function phase18CreateReport(context: DayContext): DailyReport {
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
    activeBanlist: getActiveBanlist(createPolicyState(), state.day),
    standardRotation: { activeExpansionIds: [], rotatedExpansionIds: [] },
    campaignExposure: [],
    tournamentResults: [],
    marketTrades: 0,
    accessibility: 0,
    metaHealth: 0,
    ecosystemRisk: "STABLE",
    previousEcosystemRisk: state.metrics.ecosystemRisk,
  };

  context.commands.forEach((command, index) =>
    applyPublisherCommand(context, command, index),
  );
  phase01ActivatePolicies(context);
  phase02AdvanceProjectsAndPlaytests(context);
  phase03CommandsPrintCompletionAndReleases(context);
  phase04CampaignExposure(context);
  phase05PopulationExposureAndLifecycle(context);
  phase06PrimarySalesAndProductOpening(context);
  phase07BuildOrRepairDecks(context);
  phase08SampleNormalMatches(context);
  phase09RunScheduledTournaments(context);
  phase10AggregateMetaAndKnowledge(context);
  phase11ClearSecondaryMarket(context);
  phase12AccessibilitySatisfactionAndChurn(context);
  phase13StructuredCommunityEvents(context);
  phase14UpdateCoreWorldMetrics(context);
  phase15ApplyCashExpenses(context);
  phase16Increment(context);
  phase17EvaluateRiskGameOverMilestonesAndInvariants(context);
  const report = phase18CreateReport(context);
  context.state.dailyReports ??= {};
  context.state.dailyReports[String(report.day)] = {
    report: structuredClone(report),
    notableEvents: context.notableEvents.map((event) => structuredClone(event)),
  };

  return {
    nextState: context.state,
    report,
    notableEvents: context.notableEvents.map((event) => ({ ...event })),
    stateHash: hashWorldState(context.state),
  };
}
