import type { WorldState } from "@tcgtycoon/domain";
import { validateDeck } from "@tcgtycoon/rules-engine";
import { playerOwnsGenome } from "../deck-evolution/deck-builder";
import { toDeckDefinition } from "../deck-evolution/deck-genome";

export type WorldInvariantCode =
  | "NEGATIVE_QUANTITY"
  | "MISSING_ID"
  | "MISSING_REFERENCE"
  | "ILLEGAL_DECK"
  | "NON_FINITE_NUMBER"
  | "NEGATIVE_PRICE"
  | "OUT_OF_RANGE"
  | "DUPLICATE_ID"
  | "INCORRECT_DAY_INCREMENT";

export class WorldInvariantError extends Error {
  readonly code: WorldInvariantCode;
  readonly path: string;

  constructor(code: WorldInvariantCode, path: string, message: string) {
    super(message);
    this.name = "WorldInvariantError";
    this.code = code;
    this.path = path;
  }
}

function fail(code: WorldInvariantCode, path: string, message: string): never {
  throw new WorldInvariantError(code, path, message);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireFinite(value: number, path: string): void {
  if (!Number.isFinite(value)) {
    fail("NON_FINITE_NUMBER", path, `${path} must be finite.`);
  }
}

function requireQuantity(value: number, path: string): void {
  requireFinite(value, path);
  if (!Number.isInteger(value) || value < 0) {
    fail("NEGATIVE_QUANTITY", path, `${path} must be a non-negative integer.`);
  }
}

function requirePrice(value: number, path: string): void {
  requireFinite(value, path);
  if (value < 0) {
    fail("NEGATIVE_PRICE", path, `${path} must not be negative.`);
  }
}

function requireRange(
  value: number,
  minimum: number,
  maximum: number,
  path: string,
): void {
  requireFinite(value, path);
  if (value < minimum || value > maximum) {
    fail(
      "OUT_OF_RANGE",
      path,
      `${path} must be between ${minimum} and ${maximum}.`,
    );
  }
}

function requireUnique(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      fail("DUPLICATE_ID", path, `${path} contains duplicate ID ${value}.`);
    }
    seen.add(value);
  }
}

function validateEntityMap(
  entities: Readonly<Record<string, { id: string }>>,
  path: string,
): void {
  for (const key of Object.keys(entities).sort(compareIds)) {
    const entity = entities[key];
    if (
      entity === undefined ||
      typeof entity.id !== "string" ||
      entity.id.length === 0 ||
      entity.id !== key
    ) {
      fail(
        "MISSING_ID",
        `${path}.${key}.id`,
        `${path}.${key} must contain its canonical map ID.`,
      );
    }
  }
}

function validateFiniteTree(value: unknown, path: string): void {
  if (typeof value === "number") {
    requireFinite(value, path);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      validateFiniteTree(entry, `${path}[${index}]`),
    );
    return;
  }
  for (const key of Object.keys(value).sort(compareIds)) {
    validateFiniteTree(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
  }
}

function requireReference(
  exists: boolean,
  path: string,
  referencedId: string,
): void {
  if (!exists) {
    fail(
      "MISSING_REFERENCE",
      path,
      `${path} references missing entity ${referencedId}.`,
    );
  }
}

export function validateWorldInvariants(
  world: WorldState,
  previousDay?: number,
): void {
  if (previousDay !== undefined && world.day !== previousDay + 1) {
    fail(
      "INCORRECT_DAY_INCREMENT",
      "day",
      `World day must increment from ${previousDay} to ${previousDay + 1}.`,
    );
  }

  validateEntityMap(world.cards, "cards");
  validateEntityMap(world.printings, "printings");
  validateEntityMap(world.expansions, "expansions");
  validateEntityMap(world.products, "products");
  validateEntityMap(world.printRuns, "printRuns");
  validateEntityMap(world.players, "players");
  validateEntityMap(world.agents, "agents");
  validateEntityMap(world.decks, "decks");

  requireFinite(world.cash.balance, "cash.balance");
  validateFiniteTree(world.metrics, "metrics");
  validateFiniteTree(world.meta, "meta");
  world.cash.ledger.forEach((entry, index) => {
    requireFinite(entry.amount, `cash.ledger[${index}].amount`);
    requireQuantity(entry.day, `cash.ledger[${index}].day`);
  });

  for (const productId of Object.keys(world.products).sort(compareIds)) {
    requirePrice(world.products[productId]!.msrp, `products.${productId}.msrp`);
  }
  world.market.listings.forEach((listing, index) => {
    requirePrice(listing.price, `market.listings[${index}].price`);
    requireQuantity(listing.quantity, `market.listings[${index}].quantity`);
  });
  for (const printingId of Object.keys(world.market.snapshots).sort(
    compareIds,
  )) {
    const snapshot = world.market.snapshots[printingId]!;
    if (snapshot.printingId !== printingId) {
      fail(
        "MISSING_ID",
        `market.snapshots.${printingId}.printingId`,
        `Market snapshot ${printingId} must contain its canonical map ID.`,
      );
    }
    requireReference(
      world.printings[printingId] !== undefined,
      `market.snapshots.${printingId}.printingId`,
      printingId,
    );
    requirePrice(
      snapshot.lastPrice,
      `market.snapshots.${printingId}.lastPrice`,
    );
    requireQuantity(
      snapshot.dailyVolume,
      `market.snapshots.${printingId}.dailyVolume`,
    );
    requireQuantity(
      snapshot.availableSupply,
      `market.snapshots.${printingId}.availableSupply`,
    );
    requireRange(
      snapshot.liquidity,
      0,
      1,
      `market.snapshots.${printingId}.liquidity`,
    );
    snapshot.priceHistory.forEach((entry, index) => {
      requireQuantity(
        entry.day,
        `market.snapshots.${printingId}.priceHistory[${index}].day`,
      );
      requirePrice(
        entry.price,
        `market.snapshots.${printingId}.priceHistory[${index}].price`,
      );
      requireQuantity(
        entry.volume,
        `market.snapshots.${printingId}.priceHistory[${index}].volume`,
      );
    });
  }

  for (const [name, value] of Object.entries({
    hype: world.metrics.hype,
    collectorHeat: world.metrics.collectorHeat,
    metaHealth: world.metrics.metaHealth,
    brandTrust: world.metrics.brandTrust,
    sentiment: world.metrics.sentiment,
    accessibility: world.metrics.accessibility,
  })) {
    requireRange(value, 0, 100, `metrics.${name}`);
  }
  requireQuantity(world.metrics.activePlayers, "metrics.activePlayers");
  requireQuantity(
    world.metrics.previousActivePlayers,
    "metrics.previousActivePlayers",
  );
  requirePrice(
    world.metrics.acquisitionToChurnRatio,
    "metrics.acquisitionToChurnRatio",
  );
  requireRange(world.metrics.retentionRate, 0, 1, "metrics.retentionRate");
  requireQuantity(
    world.metrics.consecutiveDeclineDays,
    "metrics.consecutiveDeclineDays",
  );
  requireQuantity(
    world.metrics.consecutiveLowActivityDays,
    "metrics.consecutiveLowActivityDays",
  );
  world.metrics.lifecycle.newByAge.forEach((count, index) =>
    requireQuantity(count, `metrics.lifecycle.newByAge[${index}]`),
  );
  const { newByAge, ...lifecycleCounts } = world.metrics.lifecycle;
  void newByAge;
  for (const [name, value] of Object.entries(lifecycleCounts)) {
    requireQuantity(value, `metrics.lifecycle.${name}`);
  }
  for (const [name, value] of Object.entries(world.metrics.lifecycleDeltas)) {
    requireQuantity(value, `metrics.lifecycleDeltas.${name}`);
  }
  for (const runId of Object.keys(world.printRuns).sort(compareIds)) {
    const run = world.printRuns[runId]!;
    requireQuantity(run.quantity, `printRuns.${runId}.quantity`);
    requireQuantity(run.completionDay, `printRuns.${runId}.completionDay`);
  }
  world.cohorts.forEach((cohort, index) =>
    requireQuantity(cohort.count, `cohorts[${index}].count`),
  );
  requireUnique(
    world.cohorts.map((cohort) => cohort.id),
    "cohorts",
  );
  requireUnique(
    world.history.events.map((event) => event.id),
    "history.events",
  );

  for (const printingId of Object.keys(world.printings).sort(compareIds)) {
    const printing = world.printings[printingId]!;
    requireReference(
      world.cards[printing.cardId] !== undefined,
      `printings.${printingId}.cardId`,
      printing.cardId,
    );
    requireReference(
      world.expansions[printing.expansionId] !== undefined,
      `printings.${printingId}.expansionId`,
      printing.expansionId,
    );
  }
  for (const productId of Object.keys(world.products).sort(compareIds)) {
    const product = world.products[productId]!;
    requireReference(
      world.expansions[product.expansionId] !== undefined,
      `products.${productId}.expansionId`,
      product.expansionId,
    );
  }
  for (const runId of Object.keys(world.printRuns).sort(compareIds)) {
    const run = world.printRuns[runId]!;
    requireReference(
      world.products[run.productId] !== undefined,
      `printRuns.${runId}.productId`,
      run.productId,
    );
  }

  const cards = Object.values(world.cards);
  for (const deckId of Object.keys(world.decks).sort(compareIds)) {
    const deck = world.decks[deckId]!;
    requireReference(
      world.players[deck.originPlayerId] !== undefined,
      `decks.${deckId}.originPlayerId`,
      deck.originPlayerId,
    );
    requireUnique(deck.parentDeckIds, `decks.${deckId}.parentDeckIds`);
    for (const parentId of deck.parentDeckIds) {
      requireReference(
        world.decks[parentId] !== undefined,
        `decks.${deckId}.parentDeckIds`,
        parentId,
      );
    }
    const validation = validateDeck(toDeckDefinition(deck), cards);
    if (!validation.valid) {
      fail(
        "ILLEGAL_DECK",
        `decks.${deckId}`,
        `Stored deck ${deckId} is illegal: ${validation.issues
          .map((issue) => issue.code)
          .join(", ")}.`,
      );
    }
  }

  for (const playerId of Object.keys(world.players).sort(compareIds)) {
    const player = world.players[playerId]!;
    requirePrice(player.tcgWallet, `players.${playerId}.tcgWallet`);
    requireFinite(player.skill, `players.${playerId}.skill`);
    requireFinite(player.loyalty, `players.${playerId}.loyalty`);
    requireQuantity(player.tenureDays, `players.${playerId}.tenureDays`);
    requireFinite(player.satisfaction, `players.${playerId}.satisfaction`);
    validateFiniteTree(player.motivation, `players.${playerId}.motivation`);
    requireUnique(player.deckIds, `players.${playerId}.deckIds`);
    requireUnique(
      player.knowledge.knownCardIds,
      `players.${playerId}.knowledge.knownCardIds`,
    );
    requireUnique(
      player.knowledge.knownDeckIds,
      `players.${playerId}.knowledge.knownDeckIds`,
    );
    for (const [printingId, quantity] of Object.entries(player.collection).sort(
      ([left], [right]) => compareIds(left, right),
    )) {
      requireReference(
        world.printings[printingId] !== undefined,
        `players.${playerId}.collection.${printingId}`,
        printingId,
      );
      requireQuantity(quantity, `players.${playerId}.collection.${printingId}`);
    }
    for (const cardId of player.knowledge.knownCardIds) {
      requireReference(
        world.cards[cardId] !== undefined,
        `players.${playerId}.knowledge.knownCardIds`,
        cardId,
      );
    }
    for (const deckId of player.knowledge.knownDeckIds) {
      requireReference(
        world.decks[deckId] !== undefined,
        `players.${playerId}.knowledge.knownDeckIds`,
        deckId,
      );
    }
    for (const deckId of player.deckIds) {
      const deck = world.decks[deckId];
      requireReference(
        deck !== undefined,
        `players.${playerId}.deckIds`,
        deckId,
      );
      if (deck !== undefined && !playerOwnsGenome(player, world, deck)) {
        fail(
          "ILLEGAL_DECK",
          `players.${playerId}.deckIds`,
          `Player ${playerId} does not own every card in deck ${deckId}.`,
        );
      }
    }
  }

  for (const agentId of Object.keys(world.agents).sort(compareIds)) {
    const agent = world.agents[agentId]!;
    requireFinite(agent.influence, `agents.${agentId}.influence`);
    requireQuantity(agent.followers, `agents.${agentId}.followers`);
    requireFinite(agent.brandAttitude, `agents.${agentId}.brandAttitude`);
    requireReference(
      world.players[agent.playerId] !== undefined,
      `agents.${agentId}.playerId`,
      agent.playerId,
    );
  }
  world.market.listings.forEach((listing, index) => {
    requireReference(
      world.players[listing.ownerId] !== undefined,
      `market.listings[${index}].ownerId`,
      listing.ownerId,
    );
    requireReference(
      world.printings[listing.printingId] !== undefined,
      `market.listings[${index}].printingId`,
      listing.printingId,
    );
  });
}
