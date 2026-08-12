import {
  cardId,
  deckId,
  expansionId,
  factionId,
  operationId,
  playerId,
  printingId,
  printRunId,
  productId,
  tournamentId,
  type CardDefinition,
  type OperationProject,
  type PersistentPlayer,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { recordMilestones } from "../history/milestones";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { scheduleCampaign } from "../operations/marketing";
import { DEFAULT_BALANCE_CONFIG } from "./day-context";
import { simulateDay } from "./simulate-day";
import { validateWorldInvariants } from "./world-invariants";

const setId = expansionId("set-publisher-day");
const releaseProductId = productId("product-publisher-day");
const duePrintRunId = printRunId("print-run-publisher-day");
const policyCardId = cardId("card-publisher-policy-target");

function createPlayer(
  id: string,
  deck: ReturnType<typeof deckId>,
): PersistentPlayer {
  return {
    id: playerId(id),
    motivation: {
      competitive: 0.8,
      brewer: 0.2,
      casual: 0.2,
      collector: 0.1,
      budgetSensitivity: 0.5,
      whale: 0,
    },
    skill: 0.5,
    loyalty: 0.5,
    tenureDays: 20,
    tcgWallet: 0,
    activity: "ACTIVE",
    collection: {},
    deckIds: [deck],
    knowledge: { knownCardIds: [], knownDeckIds: [deck] },
    satisfaction: 0.7,
  };
}

function createPublisherDayWorld(seed = "publisher-day-order"): WorldState {
  const cards: CardDefinition[] = [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: cardId(`card-publisher-unit-${index}`),
      name: `Publisher Unit ${index}`,
      type: "UNIT" as const,
      factionId: factionId("fire"),
      rarity: "COMMON" as const,
      cost: 2,
      attack: 2,
      health: 2,
      keywords: [],
      triggers: [],
    })),
    {
      id: policyCardId,
      name: "Policy Target",
      type: "UNIT",
      factionId: factionId("water"),
      rarity: "RARE",
      cost: 2,
      attack: 2,
      health: 2,
      keywords: [],
      triggers: [],
    },
  ];
  const deckAId = deckId("deck-publisher-a");
  const deckBId = deckId("deck-publisher-b");
  const playerA = createPlayer("player-publisher-a", deckAId);
  const playerB = createPlayer("player-publisher-b", deckBId);
  const productCards = cards.slice(0, 10);
  const printings = productCards.map((card) => ({
    id: printingId(`printing-${card.id}-first-edition-normal`),
    cardId: card.id,
    expansionId: setId,
    edition: "FIRST_EDITION" as const,
    sourceProductId: releaseProductId,
    sourceExpansionId: setId,
  }));
  for (const printing of printings) {
    playerA.collection[printing.id] = 2;
    playerB.collection[printing.id] = 2;
  }
  playerA.knowledge.knownCardIds = productCards.map((card) => card.id);
  playerB.knowledge.knownCardIds = productCards.map((card) => card.id);

  const policyOperation: OperationProject = {
    id: operationId("operation-publisher-policy"),
    type: "POLICY_CHANGE",
    createdDay: 17,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { kind: "BAN", cardId: policyCardId },
  };
  const playtestOperation: OperationProject = {
    id: operationId("operation-publisher-playtest"),
    type: "PLAYTEST",
    createdDay: 20,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { expansionId: setId, tier: "QUICK" },
  };
  const tournamentOperation: OperationProject = {
    id: operationId("operation-publisher-tournament"),
    type: "TOURNAMENT",
    createdDay: 10,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { tournamentId: tournamentId("tournament-publisher-major") },
  };
  const world: WorldState = {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: seed,
    day: 20,
    status: "LIVE",
    operations: {
      [policyOperation.id]: policyOperation,
      [playtestOperation.id]: playtestOperation,
      [tournamentOperation.id]: tournamentOperation,
    },
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    printings: Object.fromEntries(
      printings.map((printing) => [printing.id, printing]),
    ),
    expansions: { [setId]: { id: setId, name: "Publisher Day Set" } },
    products: {
      [releaseProductId]: {
        id: releaseProductId,
        expansionId: setId,
        name: "Publisher Day Booster",
        kind: "BOOSTER",
        msrp: 5,
        cardIds: productCards.map((card) => card.id),
        releaseStatus: "ANNOUNCED",
        internalReleaseDay: 20,
        announcedReleaseDay: 20,
      },
    },
    printRuns: {
      [duePrintRunId]: {
        id: duePrintRunId,
        productId: releaseProductId,
        sourceExpansionId: setId,
        productKind: "BOOSTER",
        cardIds: productCards.map((card) => card.id),
        orderedQuantity: 100,
        quantity: 0,
        orderedDay: 15,
        completionDay: 20,
        unitCost: 1,
        totalCost: 100,
        status: "PRINTING",
        printingIds: [],
      },
    },
    players: { [playerA.id]: playerA, [playerB.id]: playerB },
    agents: {},
    decks: {
      [deckAId]: {
        id: deckAId,
        factionId: factionId("fire"),
        cards: productCards.map((card) => ({ cardId: card.id, count: 2 })),
        strategy: { aggression: 0.7, value: 0.5, preservation: 0.3 },
        originPlayerId: playerA.id,
        parentDeckIds: [],
        generation: 0,
        createdDay: 0,
      },
      [deckBId]: {
        id: deckBId,
        factionId: factionId("fire"),
        cards: productCards.map((card) => ({ cardId: card.id, count: 2 })),
        strategy: { aggression: 0.3, value: 0.7, preservation: 0.7 },
        originPlayerId: playerB.id,
        parentDeckIds: [],
        generation: 0,
        createdDay: 0,
      },
    },
    cohorts: [{ id: "cohort-publisher", count: 1_200 }],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 1_000,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 1_000,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 100_000, ledger: [] },
    history: {
      events: [
        {
          id: "tournament-scheduled-publisher-major",
          day: 10,
          type: "TOURNAMENT_SCHEDULED_MAJOR",
          context: {
            reason: JSON.stringify({
              tournamentId: "tournament-publisher-major",
              name: "Publisher Major",
            }),
          },
        },
      ],
    },
  };
  scheduleCampaign(world, {
    id: operationId("operation-publisher-campaign"),
    campaignType: "NEW_PLAYER_CAMPAIGN",
    durationDays: 3,
    createdDay: 19,
    startDay: 20,
  });
  return world;
}

describe("authoritative publisher day", () => {
  it("executes simultaneous publisher operations in the approved order", () => {
    const world = createPublisherDayWorld();

    const result = simulateDay(world, [], DEFAULT_BALANCE_CONFIG);
    const orderedTypes = result.notableEvents.map((event) => event.type);

    expect(orderedTypes).toEqual(
      expect.arrayContaining([
        "POLICY_CHANGE_EFFECTIVE",
        "PLAYTEST_COMPLETED",
        "PRINT_RUN_COMPLETED",
        "PRODUCT_RELEASED",
        "CAMPAIGN_EXPOSURE",
        "TOURNAMENT_COMPLETED",
      ]),
    );
    expect(
      [
        "POLICY_CHANGE_EFFECTIVE",
        "PLAYTEST_COMPLETED",
        "PRINT_RUN_COMPLETED",
        "PRODUCT_RELEASED",
        "CAMPAIGN_EXPOSURE",
        "TOURNAMENT_COMPLETED",
      ].map((type) => orderedTypes.indexOf(type)),
    ).toEqual(
      [...orderedTypes]
        .map((_, index) => index)
        .filter((index) =>
          [
            "POLICY_CHANGE_EFFECTIVE",
            "PLAYTEST_COMPLETED",
            "PRINT_RUN_COMPLETED",
            "PRODUCT_RELEASED",
            "CAMPAIGN_EXPOSURE",
            "TOURNAMENT_COMPLETED",
          ].includes(orderedTypes[index]!),
        ),
    );
    expect(result.nextState.products[releaseProductId]!.releaseStatus).toBe(
      "LIVE",
    );
    expect(
      result.nextState.metrics.lifecycleDeltas.potentialToInterested,
    ).toBeGreaterThan(0);
    expect(result.nextState.history.events).toContainEqual(
      expect.objectContaining({ type: "MILESTONE_ACTIVE_PLAYERS_1000" }),
    );
    expect(result.nextState.history.events).toContainEqual(
      expect.objectContaining({ type: "MILESTONE_FIRST_BAN" }),
    );
    expect(result.nextState.history.events).toContainEqual(
      expect.objectContaining({ type: "MILESTONE_FIRST_MAJOR_WINNER" }),
    );
  });

  it("records milestones idempotently without changing simulation outcomes", () => {
    const world = createPublisherDayWorld("publisher-milestone-passive");
    const pricedPrinting = Object.values(world.printings)[0]!;
    world.market.snapshots[pricedPrinting.id] = {
      printingId: pricedPrinting.id,
      lastPrice: 125,
      dailyVolume: 1,
      availableSupply: 1,
      liquidity: 0.5,
      priceHistory: [{ day: world.day, price: 125, volume: 1 }],
    };
    world.metrics.ecosystemRisk = "STABLE";
    const control = structuredClone(world);
    const previousRisk = "DEATH_SPIRAL" as const;

    const milestones = recordMilestones(world, previousRisk);
    const repeated = recordMilestones(world, previousRisk);

    expect(milestones.map((event) => event.type)).toContain(
      "MILESTONE_ACTIVE_PLAYERS_1000",
    );
    expect(milestones.map((event) => event.type)).toContain(
      "MILESTONE_CARD_PRICE_100",
    );
    expect(milestones.map((event) => event.type)).toContain(
      "MILESTONE_DEATH_SPIRAL_RECOVERY",
    );
    expect(repeated).toEqual([]);
    expect({ ...world, history: control.history }).toEqual(control);
  });

  it("rejects scheduled operations with missing canonical references", () => {
    const world = createPublisherDayWorld("publisher-operation-invariant");
    const operation =
      world.operations![operationId("operation-publisher-tournament")]!;
    if (operation.type !== "TOURNAMENT") {
      throw new Error("Expected tournament fixture operation");
    }
    operation.payload.tournamentId = tournamentId("tournament-missing");

    expect(() => validateWorldInvariants(world)).toThrowError(
      expect.objectContaining({
        name: "WorldInvariantError",
        code: "MISSING_REFERENCE",
      }),
    );
  });

  it("turns publisher scheduling commands into canonical operations and events", () => {
    const world = createPublisherDayWorld("publisher-command-bridge");
    world.operations = {};
    world.history.events = [];

    const result = simulateDay(
      world,
      [
        { type: "SCHEDULE_BAN", cardId: policyCardId, timing: "EMERGENCY" },
        {
          type: "START_CAMPAIGN",
          campaignType: "NEW_PLAYER_CAMPAIGN",
          durationDays: 3,
          startDay: world.day,
        },
        {
          type: "CREATE_TOURNAMENT",
          tournamentId: tournamentId("tournament-command-major"),
          name: "Command Major",
          preset: "MAJOR",
          eventDay: world.day + 10,
        },
        {
          type: "PUBLISH_ANNOUNCEMENT",
          topic: "BALANCE",
          text: "A policy update is scheduled.",
          subjectId: policyCardId,
        },
      ],
      DEFAULT_BALANCE_CONFIG,
    );

    expect(
      Object.values(result.nextState.operations ?? {}).map(
        (operation) => operation.type,
      ),
    ).toEqual(
      expect.arrayContaining(["POLICY_CHANGE", "CAMPAIGN", "TOURNAMENT"]),
    );
    expect(result.nextState.history.events).toContainEqual(
      expect.objectContaining({ type: "OFFICIAL_ANNOUNCEMENT" }),
    );
  });
});
