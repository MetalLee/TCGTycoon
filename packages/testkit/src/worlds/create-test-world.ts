import { BALANCE_VERSION, POPULATION_CONFIG } from "@tcgtycoon/balance";
import {
  RULE_VERSION,
  expansionId,
  operationId,
  playerId,
  printingId,
  printRunId,
  productId,
  saveId,
  tournamentId,
  type DeckGenome,
  type SaveEnvelope,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  SIMULATION_VERSION,
  createInitialWorldMetrics,
  createInitialPopulation,
  openStarter,
} from "@tcgtycoon/sim-core";
import { coreCardFixtures } from "../cards/core-fixtures";
import {
  coreFixtureDecks,
  fireFixtureDeck,
  machineFixtureDeck,
} from "../decks/core-fixtures";

function compareIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function byId<T extends { id: string }>(
  entities: readonly T[],
): Record<string, T> {
  return Object.fromEntries(
    [...entities]
      .sort((left, right) => compareIds(left.id, right.id))
      .map((entity) => [entity.id, entity]),
  );
}

export function createTestWorld(seed: string): WorldState {
  const population = createInitialPopulation(seed);
  const originPlayer = Object.values(population.players).sort((left, right) =>
    compareIds(left.id, right.id),
  )[0];
  if (originPlayer === undefined) {
    throw new Error("The standard test world requires at least one player");
  }

  const deckGenomes: DeckGenome[] = coreFixtureDecks.map((deck) => ({
    id: deck.id,
    factionId: deck.factionId,
    cards: deck.cards.map((entry) => ({ ...entry })),
    strategy: {},
    originPlayerId: originPlayer.id,
    parentDeckIds: [],
    generation: 0,
    createdDay: 0,
  }));

  return {
    schemaVersion: 5,
    simulationVersion: SIMULATION_VERSION,
    ruleVersion: RULE_VERSION,
    balanceVersion: BALANCE_VERSION,
    worldSeed: seed,
    day: 0,
    status: "SETUP",
    cards: byId(coreCardFixtures),
    printings: {},
    expansions: {
      "set-launch": {
        id: expansionId("set-launch"),
        name: "Launch Set",
      },
    },
    products: {
      "product-launch-booster": {
        id: productId("product-launch-booster"),
        expansionId: expansionId("set-launch"),
        name: "Launch Booster",
        kind: "BOOSTER",
        msrp: POPULATION_CONFIG.launchBoosterMsrp,
        cardIds: coreCardFixtures.map((card) => card.id),
        releaseStatus: "UNANNOUNCED",
        internalReleaseDay: 0,
      },
    },
    printRuns: {},
    players: population.players,
    agents: population.agents,
    decks: byId(deckGenomes),
    cohorts: population.cohorts,
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [
        POPULATION_CONFIG.standardPersistentPlayerCount,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
      active: 0,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: {
      balance: POPULATION_CONFIG.initialPublisherCash,
      ledger: [],
    },
    history: { events: [] },
  };
}

const PARITY_FIXTURE_SEED = "web-desktop-simulation-parity";
const PARITY_FIXTURE_TIMESTAMP = "2026-08-13T00:00:00.000Z";

export function createParityTestSave(): SaveEnvelope {
  const world = createTestWorld(PARITY_FIXTURE_SEED);
  const firePlayer = world.players[playerId("player-0001")]!;
  const machinePlayer = world.players[playerId("player-0002")]!;
  world.schemaVersion = 7;
  world.day = 20;
  world.status = "LIVE";
  world.players = {
    [firePlayer.id]: firePlayer,
    [machinePlayer.id]: machinePlayer,
  };
  world.agents = Object.fromEntries(
    Object.values(world.agents)
      .filter((agent) => world.players[agent.playerId] !== undefined)
      .sort((left, right) => compareIds(left.id, right.id))
      .map((agent) => [agent.id, agent]),
  );
  world.cohorts = [{ id: "cohort-parity", count: 2 }];
  world.operations = {};
  world.operationEvidence = {
    playtests: { runs: {}, reports: {} },
    tournamentAttention: [],
  };
  world.announcementState = { announcements: [] };
  world.dailyReports = {};
  world.expansionProjects = {};

  const expansion = world.expansions[expansionId("set-launch")]!;
  const starterFixtures = [
    {
      suffix: "fire",
      deck: fireFixtureDeck,
      player: firePlayer,
      openedQuantity: 2,
    },
    {
      suffix: "machine",
      deck: machineFixtureDeck,
      player: machinePlayer,
      openedQuantity: 1,
    },
  ] as const;

  for (const fixture of starterFixtures) {
    const starterId = productId(`product-parity-starter-${fixture.suffix}`);
    const uniqueCardIds = [
      ...new Set(fixture.deck.cards.map((entry) => entry.cardId)),
    ].sort(compareIds);
    world.products[starterId] = {
      id: starterId,
      expansionId: expansion.id,
      name: `Parity ${fixture.suffix} Starter`,
      kind: "STARTER",
      msrp: 15,
      cardIds: uniqueCardIds,
      releaseStatus: "UNANNOUNCED",
      internalReleaseDay: 0,
    };
    const printingIds = uniqueCardIds.map((cardId) => {
      const id = printingId(`printing-parity-${fixture.suffix}-${cardId}`);
      world.printings[id] = {
        id,
        cardId,
        expansionId: expansion.id,
        edition: "FIRST_EDITION",
        sourceProductId: starterId,
        sourceExpansionId: expansion.id,
      };
      return id;
    });
    const runId = printRunId(`print-run-parity-${fixture.suffix}`);
    world.printRuns[runId] = {
      id: runId,
      productId: starterId,
      sourceExpansionId: expansion.id,
      productKind: "STARTER",
      cardIds: uniqueCardIds,
      orderedQuantity: 100,
      quantity: 100 - fixture.openedQuantity,
      orderedDay: 1,
      completionDay: 10,
      unitCost: 4.5,
      totalCost: 450,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds,
    };
    const starterContents = fixture.deck.cards.flatMap(({ cardId, count }) =>
      Array.from({ length: count }, () =>
        printingId(`printing-parity-${fixture.suffix}-${cardId}`),
      ),
    );
    for (let opened = 0; opened < fixture.openedQuantity; opened += 1) {
      openStarter(world, starterId, fixture.player.id, starterContents);
    }
    fixture.player.activity = "ACTIVE";
    fixture.player.tenureDays = 20;
    fixture.player.deckIds = [fixture.deck.id];
    fixture.player.knowledge = {
      knownCardIds: uniqueCardIds,
      knownDeckIds: [fixture.deck.id],
    };
    fixture.player.satisfaction = 0.8;
  }

  world.metrics = createInitialWorldMetrics({
    potential: 0,
    interested: 0,
    newByAge: [0, 0, 0, 0, 0, 0, 0],
    active: 2,
    atRisk: 0,
    churned: 0,
    returning: 0,
  });
  world.metrics.hype = 55;
  world.metrics.collectorHeat = 45;
  world.metrics.brandTrust = 65;
  world.metrics.sentiment = 60;
  world.meta = {
    deckStats: {
      [fireFixtureDeck.id]: {
        matches: 10,
        wins: 6,
        losses: 4,
        observedWinRate: 0.6,
        usageRate: 0.5,
        averageGameLength: 8,
        sampleCount: 10,
        confidence: "LOW",
      },
      [machineFixtureDeck.id]: {
        matches: 10,
        wins: 4,
        losses: 6,
        observedWinRate: 0.4,
        usageRate: 0.5,
        averageGameLength: 8,
        sampleCount: 10,
        confidence: "LOW",
      },
    },
    matchups: {
      [`${fireFixtureDeck.id}::${machineFixtureDeck.id}`]: {
        deckAId: fireFixtureDeck.id,
        deckBId: machineFixtureDeck.id,
        matches: 10,
        deckAWins: 6,
        deckBWins: 4,
        observedDeckAWinRate: 0.6,
        sampleCount: 10,
        confidence: "LOW",
      },
    },
  };

  const listedPrintingId = printingId(
    `printing-parity-fire-${fireFixtureDeck.cards[0]!.cardId}`,
  );
  world.market = {
    listings: [
      {
        ownerId: firePlayer.id,
        printingId: listedPrintingId,
        quantity: 1,
        price: 2.5,
      },
    ],
    snapshots: {
      [listedPrintingId]: {
        printingId: listedPrintingId,
        lastPrice: 2.5,
        dailyVolume: 0,
        availableSupply: 1,
        liquidity: 0.25,
        priceHistory: [{ day: 19, price: 2.5, volume: 1 }],
      },
    },
  };

  const parityTournamentId = tournamentId("tournament-parity-open");
  const tournamentOperationId = operationId("operation-parity-tournament");
  const policyOperationId = operationId("operation-parity-policy");
  world.operations = {
    [tournamentOperationId]: {
      id: tournamentOperationId,
      type: "TOURNAMENT",
      createdDay: 18,
      startDay: 20,
      completionDay: 20,
      status: "PLANNED",
      progressDays: 0,
      payload: { tournamentId: parityTournamentId },
    },
    [policyOperationId]: {
      id: policyOperationId,
      type: "POLICY_CHANGE",
      createdDay: 20,
      startDay: 23,
      completionDay: 23,
      status: "PLANNED",
      progressDays: 0,
      payload: {
        kind: "RESTRICTION",
        cardId: machineFixtureDeck.cards[0]!.cardId,
      },
    },
  };
  world.history.events.push({
    id: `tournament-scheduled-${parityTournamentId}`,
    day: 18,
    type: "TOURNAMENT_SCHEDULED_LOCAL",
    context: {
      reason: JSON.stringify({
        tournamentId: parityTournamentId,
        name: "Parity Open",
      }),
    },
  });

  return {
    saveId: saveId("save-web-desktop-simulation-parity"),
    schemaVersion: world.schemaVersion,
    simulationVersion: world.simulationVersion,
    ruleVersion: world.ruleVersion,
    balanceVersion: world.balanceVersion,
    appVersion: "parity-fixture",
    worldSeed: world.worldSeed,
    createdAt: PARITY_FIXTURE_TIMESTAMP,
    updatedAt: PARITY_FIXTURE_TIMESTAMP,
    state: world,
  };
}
