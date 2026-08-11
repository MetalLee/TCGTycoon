import { BALANCE_VERSION, POPULATION_CONFIG } from "@tcgtycoon/balance";
import {
  RULE_VERSION,
  expansionId,
  productId,
  type DeckGenome,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  SIMULATION_VERSION,
  createInitialWorldMetrics,
  createInitialPopulation,
} from "@tcgtycoon/sim-core";
import { coreCardFixtures } from "../cards/core-fixtures";
import { coreFixtureDecks } from "../decks/core-fixtures";

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
    schemaVersion: 3,
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
