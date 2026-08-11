import { cardDefinitionSchema } from "@tcgtycoon/domain";
import { z } from "zod";

const idSchema = z.string().min(1);
const finiteNumberSchema = z.number().finite();
const nonNegativeNumberSchema = finiteNumberSchema.nonnegative();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const unitNumberSchema = finiteNumberSchema.min(0).max(1);
const metricNumberSchema = finiteNumberSchema.min(0).max(100);
const recordOf = <T extends z.ZodType>(schema: T) =>
  z.record(z.string(), schema);

const printingV2Schema = z
  .object({ id: idSchema, cardId: idSchema, expansionId: idSchema })
  .strict();
const expansionSchema = z.object({ id: idSchema, name: z.string() }).strict();
const productV2Schema = z
  .object({
    id: idSchema,
    expansionId: idSchema,
    name: z.string(),
    kind: z.enum(["BOOSTER", "STARTER"]),
    msrp: nonNegativeNumberSchema,
  })
  .strict();
const printRunV2Schema = z
  .object({
    id: idSchema,
    productId: idSchema,
    quantity: nonNegativeIntegerSchema,
    completionDay: nonNegativeIntegerSchema,
  })
  .strict();
const printingEditionSchema = z.enum(["FIRST_EDITION", "UNLIMITED", "REPRINT"]);
const printingV3Schema = z
  .object({
    id: idSchema,
    cardId: idSchema,
    expansionId: idSchema,
    edition: printingEditionSchema,
    sourceProductId: idSchema,
    sourceExpansionId: idSchema,
  })
  .strict();
const productV3Schema = productV2Schema.extend({
  cardIds: z.array(idSchema),
});
const printRunV3Schema = z
  .object({
    id: idSchema,
    productId: idSchema,
    orderedQuantity: nonNegativeIntegerSchema,
    quantity: nonNegativeIntegerSchema,
    orderedDay: nonNegativeIntegerSchema,
    completionDay: nonNegativeIntegerSchema,
    unitCost: nonNegativeNumberSchema,
    totalCost: nonNegativeNumberSchema,
    status: z.enum(["PRINTING", "COMPLETED"]),
    edition: printingEditionSchema.optional(),
    printingIds: z.array(idSchema),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === "PRINTING") {
      if (run.quantity !== 0) {
        context.addIssue({
          code: "custom",
          path: ["quantity"],
          message: "PRINTING runs cannot contain sellable inventory.",
        });
      }
      if (run.edition !== undefined || run.printingIds.length !== 0) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "PRINTING runs cannot have completed edition identity.",
        });
      }
    } else if (run.edition === undefined) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "COMPLETED runs require edition identity.",
      });
    }
  });
const knowledgeSchema = z
  .object({
    knownCardIds: z.array(idSchema),
    knownDeckIds: z.array(idSchema),
  })
  .strict();
const motivationSchema = z
  .object({
    competitive: unitNumberSchema,
    brewer: unitNumberSchema,
    casual: unitNumberSchema,
    collector: unitNumberSchema,
    budgetSensitivity: unitNumberSchema,
    whale: unitNumberSchema,
  })
  .strict();
const playerSchema = z
  .object({
    id: idSchema,
    motivation: motivationSchema,
    skill: unitNumberSchema,
    loyalty: unitNumberSchema,
    tenureDays: nonNegativeIntegerSchema,
    tcgWallet: nonNegativeNumberSchema,
    activity: z.enum(["NEW", "ACTIVE", "AT_RISK", "CHURNED"]),
    collection: recordOf(nonNegativeIntegerSchema),
    deckIds: z.array(idSchema),
    knowledge: knowledgeSchema,
    satisfaction: unitNumberSchema,
  })
  .strict();
const agentSchema = z
  .object({
    id: idSchema,
    playerId: idSchema,
    name: z.string(),
    role: z.string(),
    influence: unitNumberSchema,
    followers: nonNegativeIntegerSchema,
    brandAttitude: finiteNumberSchema.min(-1).max(1),
    recentMemories: z.array(z.string()),
    longTermSummary: z.string(),
  })
  .strict();
const deckEntrySchema = z
  .object({ cardId: idSchema, count: z.union([z.literal(1), z.literal(2)]) })
  .strict();
const deckGenomeSchema = z
  .object({
    id: idSchema,
    factionId: idSchema,
    cards: z.array(deckEntrySchema),
    strategy: recordOf(finiteNumberSchema),
    originPlayerId: idSchema,
    parentDeckIds: z.array(idSchema),
    generation: nonNegativeIntegerSchema,
    createdDay: nonNegativeIntegerSchema,
  })
  .strict();
const cohortSchema = z
  .object({ id: idSchema, count: nonNegativeIntegerSchema })
  .strict();
const marketListingSchema = z
  .object({
    ownerId: idSchema,
    printingId: idSchema,
    quantity: nonNegativeIntegerSchema,
    price: nonNegativeNumberSchema,
  })
  .strict();
const priceHistorySchema = z
  .object({
    day: nonNegativeIntegerSchema,
    price: nonNegativeNumberSchema,
    volume: nonNegativeIntegerSchema,
  })
  .strict();
const printingMarketSnapshotSchema = z
  .object({
    printingId: idSchema,
    lastPrice: nonNegativeNumberSchema,
    dailyVolume: nonNegativeIntegerSchema,
    availableSupply: nonNegativeIntegerSchema,
    liquidity: unitNumberSchema,
    priceHistory: z.array(priceHistorySchema),
  })
  .strict();
const metaDeckStatsV1Schema = z
  .object({
    matches: nonNegativeIntegerSchema,
    wins: nonNegativeIntegerSchema,
    losses: nonNegativeIntegerSchema,
  })
  .strict();
const confidenceSchema = z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH"]);
const metaDeckStatsV2Schema = z
  .object({
    matches: nonNegativeIntegerSchema,
    wins: nonNegativeIntegerSchema,
    losses: nonNegativeIntegerSchema,
    observedWinRate: unitNumberSchema,
    usageRate: unitNumberSchema,
    averageGameLength: nonNegativeNumberSchema,
    sampleCount: nonNegativeIntegerSchema,
    confidence: confidenceSchema,
  })
  .strict();
const matchupStatsSchema = z
  .object({
    deckAId: idSchema,
    deckBId: idSchema,
    matches: nonNegativeIntegerSchema,
    deckAWins: nonNegativeIntegerSchema,
    deckBWins: nonNegativeIntegerSchema,
    observedDeckAWinRate: unitNumberSchema,
    sampleCount: nonNegativeIntegerSchema,
    confidence: confidenceSchema,
  })
  .strict();
const cashLedgerEntrySchema = z
  .object({
    day: nonNegativeIntegerSchema,
    category: z.enum([
      "BOOSTER_REVENUE",
      "STARTER_REVENUE",
      "PRINTING",
      "OPERATING_COST",
      "INVENTORY_COST",
    ]),
    sourceId: z.string().optional(),
    amount: finiteNumberSchema,
  })
  .strict();
const cashSchema = z
  .object({
    balance: finiteNumberSchema,
    ledger: z.array(cashLedgerEntrySchema),
  })
  .strict();
const eventSchema = z
  .object({ id: idSchema, day: nonNegativeIntegerSchema, type: idSchema })
  .strict();
const historySchema = z.object({ events: z.array(eventSchema) }).strict();
const lifecycleStateSchema = z
  .object({
    potential: nonNegativeIntegerSchema,
    interested: nonNegativeIntegerSchema,
    newByAge: z.array(nonNegativeIntegerSchema).length(7),
    active: nonNegativeIntegerSchema,
    atRisk: nonNegativeIntegerSchema,
    churned: nonNegativeIntegerSchema,
    returning: nonNegativeIntegerSchema,
  })
  .strict();
const lifecycleDeltasSchema = z
  .object({
    potentialToInterested: nonNegativeIntegerSchema,
    interestedToNew: nonNegativeIntegerSchema,
    newToActive: nonNegativeIntegerSchema,
    activeToAtRisk: nonNegativeIntegerSchema,
    atRiskToChurned: nonNegativeIntegerSchema,
    churnedToReturning: nonNegativeIntegerSchema,
    returningToActive: nonNegativeIntegerSchema,
  })
  .strict();

type WorldReferenceShape = {
  cards: Record<string, { id: string }>;
  printings: Record<
    string,
    {
      id: string;
      cardId: string;
      expansionId: string;
      sourceProductId?: string;
      sourceExpansionId?: string;
      edition?: string | undefined;
    }
  >;
  expansions: Record<string, { id: string }>;
  products: Record<
    string,
    { id: string; expansionId: string; cardIds?: string[] }
  >;
  printRuns: Record<
    string,
    {
      id: string;
      productId: string;
      printingIds?: string[];
      edition?: string | undefined;
    }
  >;
  players: Record<
    string,
    {
      id: string;
      collection: Record<string, number>;
      deckIds: string[];
      knowledge: { knownCardIds: string[]; knownDeckIds: string[] };
    }
  >;
  agents: Record<string, { id: string; playerId: string }>;
  decks: Record<
    string,
    {
      id: string;
      originPlayerId: string;
      parentDeckIds: string[];
      cards: { cardId: string }[];
    }
  >;
  cohorts: { id: string }[];
  market: {
    listings: { ownerId: string; printingId: string }[];
    snapshots?: Record<string, { printingId: string }>;
  };
  meta: {
    deckStats: Record<string, unknown>;
    matchups?: Record<string, { deckAId: string; deckBId: string }>;
  };
  history: { events: { id: string }[] };
};

function addReferenceIssue(
  context: z.RefinementCtx,
  exists: boolean,
  path: (string | number)[],
  referencedId: string,
): void {
  if (!exists) {
    context.addIssue({
      code: "custom",
      path,
      message: `References missing entity ${referencedId}.`,
    });
  }
}

function validateMapIds(
  context: z.RefinementCtx,
  entities: Record<string, { id: string }>,
  path: string,
): void {
  for (const [key, entity] of Object.entries(entities)) {
    if (key !== entity.id) {
      context.addIssue({
        code: "custom",
        path: [path, key, "id"],
        message: `Map key ${key} must match entity ID ${entity.id}.`,
      });
    }
  }
}

function validateUniqueIds(
  context: z.RefinementCtx,
  ids: readonly string[],
  path: (string | number)[],
): void {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      path,
      message: "IDs must be unique.",
    });
  }
}

function validateWorldReferences(
  world: WorldReferenceShape,
  context: z.RefinementCtx,
): void {
  for (const [path, entities] of Object.entries({
    cards: world.cards,
    printings: world.printings,
    expansions: world.expansions,
    products: world.products,
    printRuns: world.printRuns,
    players: world.players,
    agents: world.agents,
    decks: world.decks,
  })) {
    validateMapIds(context, entities, path);
  }

  for (const [id, printing] of Object.entries(world.printings)) {
    addReferenceIssue(
      context,
      world.cards[printing.cardId] !== undefined,
      ["printings", id, "cardId"],
      printing.cardId,
    );
    addReferenceIssue(
      context,
      world.expansions[printing.expansionId] !== undefined,
      ["printings", id, "expansionId"],
      printing.expansionId,
    );
    if (printing.sourceProductId !== undefined) {
      const sourceProduct = world.products[printing.sourceProductId];
      addReferenceIssue(
        context,
        sourceProduct !== undefined,
        ["printings", id, "sourceProductId"],
        printing.sourceProductId,
      );
      if (
        sourceProduct !== undefined &&
        printing.sourceExpansionId !== undefined &&
        sourceProduct.expansionId !== printing.sourceExpansionId
      ) {
        context.addIssue({
          code: "custom",
          path: ["printings", id, "sourceExpansionId"],
          message: "Printing source Product and Expansion must agree.",
        });
      }
    }
    if (printing.sourceExpansionId !== undefined) {
      addReferenceIssue(
        context,
        world.expansions[printing.sourceExpansionId] !== undefined,
        ["printings", id, "sourceExpansionId"],
        printing.sourceExpansionId,
      );
    }
  }
  for (const [id, product] of Object.entries(world.products)) {
    addReferenceIssue(
      context,
      world.expansions[product.expansionId] !== undefined,
      ["products", id, "expansionId"],
      product.expansionId,
    );
    for (const cardId of product.cardIds ?? []) {
      addReferenceIssue(
        context,
        world.cards[cardId] !== undefined,
        ["products", id, "cardIds"],
        cardId,
      );
    }
    if (product.cardIds !== undefined) {
      validateUniqueIds(context, product.cardIds, ["products", id, "cardIds"]);
    }
  }
  for (const [id, run] of Object.entries(world.printRuns)) {
    addReferenceIssue(
      context,
      world.products[run.productId] !== undefined,
      ["printRuns", id, "productId"],
      run.productId,
    );
    for (const printingId of run.printingIds ?? []) {
      const printing = world.printings[printingId];
      addReferenceIssue(
        context,
        printing !== undefined,
        ["printRuns", id, "printingIds"],
        printingId,
      );
      if (
        printing !== undefined &&
        run.edition !== undefined &&
        printing.edition !== run.edition
      ) {
        context.addIssue({
          code: "custom",
          path: ["printRuns", id, "printingIds"],
          message: `Printing ${printingId} must match run edition ${run.edition}.`,
        });
      }
      if (
        printing !== undefined &&
        printing.sourceProductId !== undefined &&
        printing.sourceProductId !== run.productId
      ) {
        context.addIssue({
          code: "custom",
          path: ["printRuns", id, "printingIds"],
          message: `Printing ${printingId} must belong to Product ${run.productId}.`,
        });
      }
    }
    if (run.printingIds !== undefined) {
      validateUniqueIds(context, run.printingIds, [
        "printRuns",
        id,
        "printingIds",
      ]);
    }
  }
  for (const [id, player] of Object.entries(world.players)) {
    for (const printingId of Object.keys(player.collection)) {
      addReferenceIssue(
        context,
        world.printings[printingId] !== undefined,
        ["players", id, "collection", printingId],
        printingId,
      );
    }
    for (const deckId of player.deckIds) {
      addReferenceIssue(
        context,
        world.decks[deckId] !== undefined,
        ["players", id, "deckIds"],
        deckId,
      );
    }
    for (const cardId of player.knowledge.knownCardIds) {
      addReferenceIssue(
        context,
        world.cards[cardId] !== undefined,
        ["players", id, "knowledge", "knownCardIds"],
        cardId,
      );
    }
    for (const deckId of player.knowledge.knownDeckIds) {
      addReferenceIssue(
        context,
        world.decks[deckId] !== undefined,
        ["players", id, "knowledge", "knownDeckIds"],
        deckId,
      );
    }
    validateUniqueIds(context, player.deckIds, ["players", id, "deckIds"]);
    validateUniqueIds(context, player.knowledge.knownCardIds, [
      "players",
      id,
      "knowledge",
      "knownCardIds",
    ]);
    validateUniqueIds(context, player.knowledge.knownDeckIds, [
      "players",
      id,
      "knowledge",
      "knownDeckIds",
    ]);
  }
  for (const [id, agent] of Object.entries(world.agents)) {
    addReferenceIssue(
      context,
      world.players[agent.playerId] !== undefined,
      ["agents", id, "playerId"],
      agent.playerId,
    );
  }
  for (const [id, deck] of Object.entries(world.decks)) {
    addReferenceIssue(
      context,
      world.players[deck.originPlayerId] !== undefined,
      ["decks", id, "originPlayerId"],
      deck.originPlayerId,
    );
    for (const parentId of deck.parentDeckIds) {
      addReferenceIssue(
        context,
        world.decks[parentId] !== undefined,
        ["decks", id, "parentDeckIds"],
        parentId,
      );
    }
    for (const entry of deck.cards) {
      addReferenceIssue(
        context,
        world.cards[entry.cardId] !== undefined,
        ["decks", id, "cards"],
        entry.cardId,
      );
    }
    validateUniqueIds(context, deck.parentDeckIds, [
      "decks",
      id,
      "parentDeckIds",
    ]);
  }
  world.market.listings.forEach((listing, index) => {
    addReferenceIssue(
      context,
      world.players[listing.ownerId] !== undefined,
      ["market", "listings", index, "ownerId"],
      listing.ownerId,
    );
    addReferenceIssue(
      context,
      world.printings[listing.printingId] !== undefined,
      ["market", "listings", index, "printingId"],
      listing.printingId,
    );
  });
  for (const [id, snapshot] of Object.entries(world.market.snapshots ?? {})) {
    if (id !== snapshot.printingId) {
      context.addIssue({
        code: "custom",
        path: ["market", "snapshots", id, "printingId"],
        message: `Map key ${id} must match snapshot Printing ID ${snapshot.printingId}.`,
      });
    }
    addReferenceIssue(
      context,
      world.printings[snapshot.printingId] !== undefined,
      ["market", "snapshots", id, "printingId"],
      snapshot.printingId,
    );
  }
  for (const deckId of Object.keys(world.meta.deckStats)) {
    addReferenceIssue(
      context,
      world.decks[deckId] !== undefined,
      ["meta", "deckStats", deckId],
      deckId,
    );
  }
  for (const [key, matchup] of Object.entries(world.meta.matchups ?? {})) {
    for (const [side, deckId] of [
      ["deckAId", matchup.deckAId],
      ["deckBId", matchup.deckBId],
    ] as const) {
      addReferenceIssue(
        context,
        world.decks[deckId] !== undefined,
        ["meta", "matchups", key, side],
        deckId,
      );
    }
  }
  validateUniqueIds(
    context,
    world.cohorts.map((cohort) => cohort.id),
    ["cohorts"],
  );
  validateUniqueIds(
    context,
    world.history.events.map((event) => event.id),
    ["history", "events"],
  );
}

const commonWorldShapeV2 = {
  simulationVersion: idSchema,
  ruleVersion: idSchema,
  balanceVersion: idSchema,
  worldSeed: idSchema,
  day: nonNegativeIntegerSchema,
  status: z.enum(["SETUP", "LIVE", "GAME_OVER"]),
  cards: recordOf(cardDefinitionSchema),
  printings: recordOf(printingV2Schema),
  expansions: recordOf(expansionSchema),
  products: recordOf(productV2Schema),
  printRuns: recordOf(printRunV2Schema),
  players: recordOf(playerSchema),
  agents: recordOf(agentSchema),
  decks: recordOf(deckGenomeSchema),
  cohorts: z.array(cohortSchema),
  cash: cashSchema,
  history: historySchema,
};

export const worldStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    ...commonWorldShapeV2,
    market: z.object({ listings: z.array(marketListingSchema) }).strict(),
    meta: z.object({ deckStats: recordOf(metaDeckStatsV1Schema) }).strict(),
    metrics: z.object({ activePlayers: nonNegativeIntegerSchema }).strict(),
  })
  .strict()
  .superRefine(validateWorldReferences);

export const worldStateV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    ...commonWorldShapeV2,
    market: z
      .object({
        listings: z.array(marketListingSchema),
        snapshots: recordOf(printingMarketSnapshotSchema),
      })
      .strict(),
    meta: z
      .object({
        deckStats: recordOf(metaDeckStatsV2Schema),
        matchups: recordOf(matchupStatsSchema),
      })
      .strict(),
    metrics: z
      .object({
        activePlayers: nonNegativeIntegerSchema,
        previousActivePlayers: nonNegativeIntegerSchema,
        hype: metricNumberSchema,
        collectorHeat: metricNumberSchema,
        metaHealth: metricNumberSchema,
        brandTrust: metricNumberSchema,
        sentiment: metricNumberSchema,
        accessibility: metricNumberSchema,
        lifecycle: lifecycleStateSchema,
        lifecycleDeltas: lifecycleDeltasSchema,
        acquisitionToChurnRatio: nonNegativeNumberSchema,
        retentionRate: unitNumberSchema,
        activePlayerTrend: finiteNumberSchema,
        consecutiveDeclineDays: nonNegativeIntegerSchema,
        consecutiveLowActivityDays: nonNegativeIntegerSchema,
        ecosystemRisk: z.enum([
          "STABLE",
          "STRAINED",
          "DECLINING",
          "DEATH_SPIRAL",
          "TERMINAL",
        ]),
      })
      .strict(),
  })
  .strict()
  .superRefine(validateWorldReferences);

export type WorldStateV1 = z.infer<typeof worldStateV1Schema>;

export const worldStateV3Schema = z
  .object({
    schemaVersion: z.literal(3),
    ...commonWorldShapeV2,
    printings: recordOf(printingV3Schema),
    products: recordOf(productV3Schema),
    printRuns: recordOf(printRunV3Schema),
    market: z
      .object({
        listings: z.array(marketListingSchema),
        snapshots: recordOf(printingMarketSnapshotSchema),
      })
      .strict(),
    meta: z
      .object({
        deckStats: recordOf(metaDeckStatsV2Schema),
        matchups: recordOf(matchupStatsSchema),
      })
      .strict(),
    metrics: z
      .object({
        activePlayers: nonNegativeIntegerSchema,
        previousActivePlayers: nonNegativeIntegerSchema,
        hype: metricNumberSchema,
        collectorHeat: metricNumberSchema,
        metaHealth: metricNumberSchema,
        brandTrust: metricNumberSchema,
        sentiment: metricNumberSchema,
        accessibility: metricNumberSchema,
        lifecycle: lifecycleStateSchema,
        lifecycleDeltas: lifecycleDeltasSchema,
        acquisitionToChurnRatio: nonNegativeNumberSchema,
        retentionRate: unitNumberSchema,
        activePlayerTrend: finiteNumberSchema,
        consecutiveDeclineDays: nonNegativeIntegerSchema,
        consecutiveLowActivityDays: nonNegativeIntegerSchema,
        ecosystemRisk: z.enum([
          "STABLE",
          "STRAINED",
          "DECLINING",
          "DEATH_SPIRAL",
          "TERMINAL",
        ]),
      })
      .strict(),
  })
  .strict()
  .superRefine(validateWorldReferences);
