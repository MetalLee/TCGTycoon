import {
  BALANCE_VERSION,
  POPULATION_CONFIG,
  PRODUCTION_CONFIG,
} from "../../../../../packages/balance/src/index";
import {
  RULE_VERSION,
  parseCardDefinition,
  printRunId,
  productId,
  type CardDefinition,
  type DeckDefinition,
  type ProductSku,
  type WorldState,
} from "../../../../../packages/domain/src/index";
import {
  SIMULATION_VERSION,
  advancePrintRuns,
  createInitialPopulation,
  createInitialWorldMetrics,
  orderPrintRun,
  validateWorldInvariants,
} from "../../../../../packages/sim-core/src/index";
import {
  createLaunchSetFixture,
  type LaunchFactionFixture,
} from "../../../../../packages/testkit/src/index";

export type OfflineLaunchInput = {
  seed: string;
  gameName: string;
  setting: string;
  visualKeywords: readonly string[];
  boosterPrintQuantity: number;
  starterPrintQuantity: number;
  cards?: readonly CardDefinition[];
};

export type OfflineLaunchResult = {
  brand: {
    gameName: string;
    setting: string;
    visualKeywords: string[];
  };
  factions: LaunchFactionFixture[];
  starterDecks: DeckDefinition[];
  world: WorldState;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireText(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${name} is required`);
  return trimmed;
}

function requireQuantity(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

function launchCards(input: OfflineLaunchInput): CardDefinition[] {
  const fixture = createLaunchSetFixture();
  const cards = (input.cards ?? fixture.cards).map((card) =>
    parseCardDefinition(structuredClone(card)),
  );
  if (cards.length !== fixture.cards.length) {
    throw new Error("Launch Set must contain exactly 48 cards");
  }
  const expectedIds = fixture.cards.map((card) => card.id).sort(compareIds);
  const actualIds = cards.map((card) => card.id).sort(compareIds);
  if (actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error("Edited Launch cards must preserve the 48-slot skeleton");
  }
  return cards.sort((left, right) => compareIds(left.id, right.id));
}

function starterDecksFor(
  cards: readonly CardDefinition[],
  factions: readonly LaunchFactionFixture[],
): DeckDefinition[] {
  const neutral = cards.filter((card) => card.factionId === "neutral");
  return factions.map((faction) => {
    const factionCards = cards.filter((card) => card.factionId === faction.id);
    if (factionCards.length !== 10 || neutral.length !== 8) {
      throw new Error(
        "Launch Set requires ten cards per faction and eight neutral cards",
      );
    }
    return {
      id: createLaunchSetFixture().starterDecks.find(
        (deck) => deck.factionId === faction.id,
      )!.id,
      name: `${faction.name} Starter`,
      factionId: faction.id,
      cards: [...factionCards.slice(0, 8), ...neutral.slice(0, 2)].map(
        (card) => ({ cardId: card.id, count: 2 }),
      ),
    };
  });
}

function starterProduct(
  expansionId: ProductSku["expansionId"],
  deck: DeckDefinition,
): ProductSku {
  return {
    id: productId(`product-launch-starter-${deck.factionId}`),
    expansionId,
    name: deck.name,
    kind: "STARTER",
    msrp: 15,
    cardIds: deck.cards.map((entry) => entry.cardId),
    releaseStatus: "UNANNOUNCED",
    internalReleaseDay: 1,
  };
}

function createSetupWorld(input: OfflineLaunchInput): {
  world: WorldState;
  factions: LaunchFactionFixture[];
  starterDecks: DeckDefinition[];
} {
  const fixture = createLaunchSetFixture();
  const cards = launchCards(input);
  const factions = fixture.factions.map((faction) => ({ ...faction }));
  const starterDecks = starterDecksFor(cards, factions);
  const population = createInitialPopulation(input.seed);
  const world: WorldState = {
    schemaVersion: 5,
    simulationVersion: SIMULATION_VERSION,
    ruleVersion: RULE_VERSION,
    balanceVersion: BALANCE_VERSION,
    worldSeed: input.seed,
    day: 0,
    status: "SETUP",
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    printings: {},
    expansions: {
      [fixture.expansion.id]: {
        ...fixture.expansion,
        name: `${requireText(input.gameName, "Game name")} Launch Set`,
      },
    },
    products: {},
    printRuns: {},
    players: population.players,
    agents: population.agents,
    decks: {},
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
    cash: { balance: POPULATION_CONFIG.initialPublisherCash, ledger: [] },
    history: { events: [] },
  };

  const booster: ProductSku = {
    id: productId("product-launch-booster"),
    expansionId: fixture.expansion.id,
    name: `${input.gameName.trim()} Launch Booster`,
    kind: "BOOSTER",
    msrp: POPULATION_CONFIG.launchBoosterMsrp,
    cardIds: cards.map((card) => card.id),
    releaseStatus: "UNANNOUNCED",
    internalReleaseDay: 1,
  };
  const products = [
    booster,
    ...starterDecks.map((deck) => starterProduct(fixture.expansion.id, deck)),
  ];
  world.products = Object.fromEntries(
    products.map((product) => [product.id, product]),
  );
  return { world, factions, starterDecks };
}

export function createOfflineLaunch(
  input: OfflineLaunchInput,
): OfflineLaunchResult {
  const gameName = requireText(input.gameName, "Game name");
  const setting = requireText(input.setting, "Setting");
  const visualKeywords = input.visualKeywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
  const boosterQuantity = requireQuantity(
    input.boosterPrintQuantity,
    "Booster print quantity",
  );
  const starterQuantity = requireQuantity(
    input.starterPrintQuantity,
    "Starter print quantity",
  );
  const { world, factions, starterDecks } = createSetupWorld(input);

  for (const product of Object.values(world.products).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    const run = orderPrintRun(
      world,
      {
        id: printRunId(`print-run-setup-${product.id}`),
        productId: product.id,
        quantity:
          product.kind === "BOOSTER" ? boosterQuantity : starterQuantity,
      },
      PRODUCTION_CONFIG,
    );
    advancePrintRuns(world, run.completionDay);
    product.releaseStatus = "LIVE";
    product.internalReleaseDay = 1;
    product.announcedReleaseDay = 1;
    product.releasedDay = 1;
  }
  world.status = "LIVE";
  world.day = 1;
  world.history.events.push({
    id: "setup-launch-completed",
    day: 1,
    type: "GAME_LAUNCHED",
    context: {
      reason: JSON.stringify({ gameName, setting, visualKeywords }),
      publicCommitment: true,
      trustSignal: "NONE",
    },
  });
  validateWorldInvariants(world);

  return {
    brand: { gameName, setting, visualKeywords },
    factions,
    starterDecks,
    world,
  };
}
