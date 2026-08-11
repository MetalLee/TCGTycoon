# TCGTycoon World Simulation & Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic headless TCG world that advances one complete day with physical card ownership, product sales, secondary-market clearing, deck evolution, real match-derived Meta, player lifecycle metrics, cash flow, saves and Game Over risk states.

**Architecture:** Add a normalized canonical `WorldState` and versioned save layer around the Phase 1 match engine. `simulateDay()` executes fixed deterministic phases and accepts typed `PublisherCommand`s; it produces a new state, structured events and a Daily Report without React or generative AI. Physical card supply is conserved from Product openings through Collections and market transfers.

**Tech Stack:** TypeScript, Zod, Vitest, Phase 1 `@tcgtycoon/domain`, `@tcgtycoon/rules-engine`, `@tcgtycoon/balance`, `@tcgtycoon/testkit`, tsx.

## Global Constraints

- Booster Packs contain exactly **5** physical cards: default 3 Common + 1 Uncommon + 1 Rare+.
- Live-world players must own every CardDefinition required by their Deck; internal Playtest is not part of this phase.
- Physical card supply may only enter through Print Run/Product opening paths.
- Persistent Sim Player fixture begins around 400 and the architecture supports approximately 300–1000 representatives.
- Named Agents are structural persistent players in this phase; LLM prose is excluded.
- Ground Truth and player/public knowledge are separate.
- Active Players is derived from population lifecycle state, not directly modified by scripted events.
- Hype measures attention; negative events may increase Hype.
- Meta Health is derived from actual sufficiently sampled match data and accessibility.
- Cash uses a real ledger and is never smoothed.
- `simulateDay()` is deterministic and atomic from caller perspective.
- Generative AI/network calls do not exist in `packages/sim-core`.

---

## Planned file map

```text
packages/domain/src/
  world.ts
  players.ts
  products.ts
  market.ts
  meta.ts
  events.ts
  saves.ts
  commands.ts
  metrics.ts

packages/balance/src/
  world-config.ts
  economy-config.ts
  population-config.ts
  metrics-config.ts

packages/sim-core/
  package.json
  tsconfig.json
  src/index.ts
  src/day/simulate-day.ts
  src/day/day-context.ts
  src/day/world-invariants.ts
  src/population/create-population.ts
  src/population/lifecycle.ts
  src/products/open-product.ts
  src/products/primary-market.ts
  src/economy/cash-ledger.ts
  src/market/call-auction.ts
  src/market/market-intents.ts
  src/deck-evolution/deck-genome.ts
  src/deck-evolution/deck-builder.ts
  src/deck-evolution/adoption.ts
  src/society/knowledge.ts
  src/meta/sample-matches.ts
  src/meta/meta-aggregation.ts
  src/metrics/accessibility.ts
  src/metrics/satisfaction.ts
  src/metrics/world-metrics.ts
  src/metrics/ecosystem-risk.ts
  src/history/daily-report.ts

packages/persistence/
  package.json
  tsconfig.json
  src/index.ts
  src/contracts/save-repository.ts
  src/serialization/canonical-json.ts
  src/migrations/migrate-save.ts
  src/migrations/v1.ts
  src/memory/memory-save-repository.ts

packages/testkit/src/
  worlds/create-test-world.ts
  scenarios/*.ts
  publisher/basic-publisher-bot.ts

scripts/
  simulate-days.ts

tests/scenarios/
tests/determinism/world-determinism.test.ts
```

---

### Task 1: Define normalized WorldState and PublisherCommand envelope

**Files:**
- Create: `packages/domain/src/world.ts`
- Create: `packages/domain/src/players.ts`
- Create: `packages/domain/src/products.ts`
- Create: `packages/domain/src/market.ts`
- Create: `packages/domain/src/meta.ts`
- Create: `packages/domain/src/events.ts`
- Create: `packages/domain/src/metrics.ts`
- Create: `packages/domain/src/commands.ts`
- Modify: `packages/domain/src/ids.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/world.test.ts`

**Interfaces:**
- Consumes: Phase 1 IDs/cards/decks/rules.
- Produces: normalized `WorldState`, new entity ID types, `PublisherCommand`, `WorldEvent`, `WorldMetrics`, product/player/market/meta core types.

- [x] **Step 1: Add stable IDs required by the world**

Add branded types and constructors for:

```ts
ExpansionId
ProductId
PrintRunId
TransactionId
TournamentId
OperationId
AgentId
SaveId
```

No random ID generator is added.

- [x] **Step 2: Write a failing normalization test**

```ts
it("stores canonical entities by ID and references related entities by ID", () => {
  const world = createEmptyWorldFixture();
  expect(world.cards["card-fire-cub"].id).toBe("card-fire-cub");
  expect(world.products["product-launch-booster"].expansionId).toBe("set-launch");
  expect(world.products["product-launch-booster"]).not.toHaveProperty("expansion");
});
```

- [x] **Step 3: Run and verify failure**

```bash
pnpm vitest run packages/domain/src/world.test.ts
```

- [x] **Step 4: Implement canonical type families**

Minimum `WorldState` shape:

```ts
export type WorldState = {
  schemaVersion: number;
  simulationVersion: string;
  ruleVersion: string;
  balanceVersion: string;
  worldSeed: string;
  day: number;
  status: "SETUP" | "LIVE" | "GAME_OVER";

  cards: Record<string, CardDefinition>;
  printings: Record<string, Printing>;
  expansions: Record<string, Expansion>;
  products: Record<string, ProductSku>;
  printRuns: Record<string, PrintRun>;
  players: Record<string, PersistentPlayer>;
  agents: Record<string, NamedAgent>;
  decks: Record<string, DeckGenome>;

  cohorts: PopulationCohort[];
  market: MarketState;
  meta: MetaState;
  metrics: WorldMetrics;
  cash: CashState;
  history: WorldHistory;
};
```

`PublisherCommand` begins as an extensible discriminated union with Phase 2 commands:

```ts
export type PublisherCommand =
  | { type: "ADJUST_MSRP"; productId: ProductId; newMsrp: number }
  | { type: "ORDER_PRINT_RUN"; productId: ProductId; quantity: number; completionDay: number };
```

Phase 3 will extend this union in the authoritative domain module rather than creating parallel command types.

- [x] **Step 5: Run domain tests and typecheck**

```bash
pnpm vitest run packages/domain/src/world.test.ts
pnpm typecheck
```

- [x] **Step 6: Commit**

```bash
git add packages/domain
 git commit -m "feat: define normalized world state"
```

---

### Task 2: Add versioned SaveEnvelope, canonical serialization and in-memory repository

**Files:**
- Create: `packages/domain/src/saves.ts`
- Create: `packages/persistence/package.json`
- Create: `packages/persistence/tsconfig.json`
- Create: `packages/persistence/src/contracts/save-repository.ts`
- Create: `packages/persistence/src/serialization/canonical-json.ts`
- Create: `packages/persistence/src/migrations/v1.ts`
- Create: `packages/persistence/src/migrations/migrate-save.ts`
- Create: `packages/persistence/src/memory/memory-save-repository.ts`
- Create: `packages/persistence/src/index.ts`
- Test: `packages/persistence/src/migrations/migrate-save.test.ts`
- Test: `packages/persistence/src/memory/memory-save-repository.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `SaveId`.
- Produces:

```ts
export type SaveEnvelope = {
  saveId: SaveId;
  schemaVersion: number;
  simulationVersion: string;
  ruleVersion: string;
  balanceVersion: string;
  appVersion: string;
  worldSeed: string;
  createdAt: string;
  updatedAt: string;
  state: WorldState;
};

export interface SaveRepository {
  list(): Promise<SaveMetadata[]>;
  load(id: SaveId): Promise<SaveEnvelope>;
  save(save: SaveEnvelope): Promise<void>;
  delete(id: SaveId): Promise<void>;
}

export function migrateSave(input: unknown): SaveEnvelope;
export function canonicalStringify(value: unknown): string;
```

- [x] **Step 1: Write failing migration and round-trip tests**

Test a literal v1 fixture and assert `migrateSave` returns the current schema. Test `MemorySaveRepository.save/load` returns a deep-equal clone rather than the same object reference.

- [x] **Step 2: Run tests and confirm missing implementation**

```bash
pnpm vitest run packages/persistence
```

- [x] **Step 3: Implement canonical JSON with sorted object keys**

Arrays preserve order; object keys sort lexicographically. Throw on `undefined`, `NaN` and Infinity in canonical persisted state.

- [x] **Step 4: Implement v1 migration pipeline**

Use explicit sequential structure even though only v1 exists:

```ts
const CURRENT_SCHEMA_VERSION = 1;

export function migrateSave(input: unknown): SaveEnvelope {
  const parsed = saveEnvelopeV1Schema.parse(input);
  return parsed;
}
```

Later versions must append `v1 -> v2`, not replace the pipeline.

- [x] **Step 5: Run persistence tests and typecheck**

```bash
pnpm vitest run packages/persistence
pnpm typecheck
```

- [x] **Step 6: Commit**

```bash
git add packages/domain/src/saves.ts packages/persistence
 git commit -m "feat: add versioned save persistence contracts"
```

---

### Task 3: Create population cohorts, persistent players and named-agent structural data

**Files:**
- Create: `packages/balance/src/population-config.ts`
- Create: `packages/sim-core/package.json`
- Create: `packages/sim-core/tsconfig.json`
- Create: `packages/sim-core/src/population/create-population.ts`
- Create: `packages/sim-core/src/society/knowledge.ts`
- Create: `packages/sim-core/src/index.ts`
- Create: `packages/testkit/src/worlds/create-test-world.ts`
- Test: `packages/sim-core/src/population/create-population.test.ts`

**Interfaces:**
- Consumes: deterministic seed utilities and WorldState domain types.
- Produces: `createInitialPopulation(seed, count = 400)`, deterministic persistent player profiles, six motivation vectors, `KnowledgeState`, and 24 deterministic structural Named Agents for standard test fixtures.

- [x] **Step 1: Write failing deterministic population tests**

Required assertions:

```ts
expect(Object.keys(createInitialPopulation("seed-a").players)).toHaveLength(400);
expect(Object.keys(createInitialPopulation("seed-a").agents)).toHaveLength(24);
expect(createInitialPopulation("seed-a")).toEqual(createInitialPopulation("seed-a"));
```

Also verify motivation values are in `[0,1]` and no generated player owns cards yet.

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/population/create-population.test.ts
```

- [x] **Step 3: Implement player motivation/profile structures**

Each Persistent Player includes at least:

```ts
motivation: {
  competitive: number;
  brewer: number;
  casual: number;
  collector: number;
  budgetSensitivity: number;
  whale: number;
};
skill: number;
loyalty: number;
tenureDays: number;
tcgWallet: number;
activity: "NEW" | "ACTIVE" | "AT_RISK" | "CHURNED";
collection: Record<string, number>;
deckIds: DeckId[];
knowledge: KnowledgeState;
satisfaction: number;
```

NamedAgent adds role, influence, followers, brand attitude, recent structured memories and long-term summary string, but no LLM fields/calls.

- [x] **Step 4: Implement `createTestWorld(seed)`**

This fixture assembles Phase 1 cards/decks, Launch Expansion/Product skeleton, 400 players, 24 agents, empty ownership/market and starting company cash. It must be deterministic.

- [x] **Step 5: Run focused tests and typecheck**

```bash
pnpm vitest run packages/sim-core/src/population/create-population.test.ts
pnpm typecheck
```

- [x] **Step 6: Commit**

```bash
git add packages/balance packages/sim-core packages/testkit
 git commit -m "feat: create deterministic simulated population"
```

---

### Task 4: Implement physical Printings, five-card Boosters, Starters and Collection updates

**Files:**
- Create: `packages/balance/src/economy-config.ts`
- Create: `packages/sim-core/src/products/open-product.ts`
- Test: `packages/sim-core/src/products/open-product.test.ts`
- Create: `packages/testkit/src/scenarios/product-fixtures.ts`

**Interfaces:**
- Consumes: `ProductSku`, `Printing`, player/cohort holdings, `DeterministicRng`.
- Produces: `openBooster(world, productId, owner, rng): ProductOpenResult`, `openStarter(...)`, exact five-card output, and ownership deltas.

- [x] **Step 1: Write failing five-card Booster tests**

Required:

```ts
it("opens exactly five physical cards", () => {
  const result = openLaunchBoosterFixture(123n);
  expect(result.printingIds).toHaveLength(5);
});

it("uses 3 Common, 1 Uncommon and 1 Rare+ base slots", () => {
  const result = openLaunchBoosterFixture(321n);
  expect(result.baseRarities).toEqual(["COMMON", "COMMON", "COMMON", "UNCOMMON", expect.stringMatching(/RARE|LEGENDARY/)]);
});
```

Also assert Foil/Alt-Art upgrades replace a selected Printing variant rather than increasing count beyond five.

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/products/open-product.test.ts
```

- [x] **Step 3: Implement product slot generation from BalanceConfig**

Default config:

```ts
booster: {
  cardsPerPack: 5,
  commonSlots: 3,
  uncommonSlots: 1,
  rarePlusSlots: 1,
  legendaryChanceInRarePlus: 0.125,
  foilUpgradeChance: 0.10,
  altArtUpgradeChance: 0.025,
}
```

Only eligible signature cards may receive Alt-Art variants. Product open chooses from Printings actually included in the product/set.

- [x] **Step 4: Implement Starter opening**

A Starter creates exactly the listed 20 physical Printings in the buyer collection. Cards are not bound and can later be sold.

- [x] **Step 5: Add physical supply accounting helper**

Export:

```ts
export function countWorldSupply(world: WorldState, printingId: PrintingId): number;
```

It must count publisher product/card inventory as modeled plus cohort/persistent ownership and market seller ownership without double counting.

- [x] **Step 6: Run tests**

```bash
pnpm vitest run packages/sim-core/src/products/open-product.test.ts
pnpm typecheck
```

- [x] **Step 7: Commit**

```bash
git add packages/balance/src/economy-config.ts packages/sim-core/src/products packages/testkit/src/scenarios/product-fixtures.ts
 git commit -m "feat: open five-card physical products"
```

---

### Task 5: Add primary-market demand, Print Run completion, inventory and Cash Ledger

**Files:**
- Create: `packages/sim-core/src/products/primary-market.ts`
- Create: `packages/sim-core/src/economy/cash-ledger.ts`
- Test: `packages/sim-core/src/products/primary-market.test.ts`
- Test: `packages/sim-core/src/economy/cash-ledger.test.ts`

**Interfaces:**
- Consumes: product inventory, player budgets/preferences, World metrics inputs.
- Produces: `completePrintRunsDueToday(world)`, `generatePrimaryDemand(world, rng)`, `resolvePrimarySales(world, demand, rng)`, `appendCashEntry(state, entry)`, daily publisher revenue and product-opening requests.

- [x] **Step 1: Write failing inventory/sales tests**

Cover:

- Print Run adds inventory only on `completionDay`.
- Sales never exceed available Publisher Inventory.
- Revenue uses configurable `publisherShare`, not full MSRP.
- A sale reduces inventory and buyer budget and queues the matching product opening.
- Negative sale quantity is rejected.

- [x] **Step 2: Verify failure**

```bash
pnpm vitest run packages/sim-core/src/products/primary-market.test.ts packages/sim-core/src/economy/cash-ledger.test.ts
```

- [x] **Step 3: Implement Cash Ledger as source of cash changes**

```ts
export type CashLedgerEntry = {
  day: number;
  category: "BOOSTER_REVENUE" | "STARTER_REVENUE" | "PRINTING" | "OPERATING_COST" | "INVENTORY_COST";
  sourceId?: string;
  amount: number; // positive income, negative expense
};
```

`cash.balance` is updated only by applying ledger entries.

- [x] **Step 4: Implement deterministic primary-market resolution**

Demand uses player/cohort budget, product freshness placeholder input, competitive need, collector interest and price sensitivity. Do not directly modify Active Players or Hype here.

- [x] **Step 5: Run tests and commit**

```bash
pnpm vitest run packages/sim-core/src/products/primary-market.test.ts packages/sim-core/src/economy/cash-ledger.test.ts
pnpm typecheck
git add packages/sim-core/src/products packages/sim-core/src/economy
git commit -m "feat: resolve primary product sales and cash"
```

---

### Task 6: Implement secondary-market intents and daily call auction

**Files:**
- Create: `packages/sim-core/src/market/market-intents.ts`
- Create: `packages/sim-core/src/market/call-auction.ts`
- Test: `packages/sim-core/src/market/call-auction.test.ts`
- Test: `tests/scenarios/physical-supply-conservation.test.ts`

**Interfaces:**
- Consumes: actual Collection holdings, deck needs, collector preferences, market snapshots.
- Produces: `BuyIntent`, `SellIntent`, `clearPrintingAuction(input): AuctionResult`, `applyMarketTrades(world, results)`.

- [x] **Step 1: Write failing clearing-price tests**

Use a fixed order book and assert:

- Highest compatible buy/sell orders trade first under stable sorting.
- Result price is deterministic.
- Seller cannot transfer more copies than owned.
- Total world supply before and after trading is identical.

Example fixture:

```ts
const buys = [
  { ownerId: "p1", quantity: 10, maxPrice: 80 },
  { ownerId: "p2", quantity: 8, maxPrice: 72 },
];
const sells = [
  { ownerId: "p3", quantity: 7, minPrice: 54 },
  { ownerId: "p4", quantity: 15, minPrice: 63 },
];
```

- [x] **Step 2: Verify failure**

```bash
pnpm vitest run packages/sim-core/src/market/call-auction.test.ts
```

- [x] **Step 3: Implement stable call-auction clearing**

Sort buys by descending `maxPrice`, then owner ID; sells by ascending `minPrice`, then owner ID. Match while top bid >= top ask. Use a documented deterministic clearing-price rule, e.g. midpoint rounded to cents:

```ts
const price = Math.round(((buy.maxPrice + sell.minPrice) / 2) * 100) / 100;
```

Transfer actual Printing quantity and currency. Do not create an independent NPC market inventory.

- [x] **Step 4: Generate intents from competitive and collector needs**

Competitive demand prefers the cheapest legal Printing for a needed CardDefinition. Collector demand may target premium Printings. Budget-sensitive players may sell valuable cards and abandon/rebuild expensive decks later.

- [x] **Step 5: Run market and conservation tests**

```bash
pnpm vitest run packages/sim-core/src/market
pnpm vitest run tests/scenarios/physical-supply-conservation.test.ts
pnpm typecheck
```

- [x] **Step 6: Commit**

```bash
git add packages/sim-core/src/market tests/scenarios/physical-supply-conservation.test.ts
 git commit -m "feat: clear physical card secondary market"
```

---

### Task 7: Implement Deck Genome, ownership-aware construction, knowledge and adoption

**Files:**
- Create: `packages/sim-core/src/deck-evolution/deck-genome.ts`
- Create: `packages/sim-core/src/deck-evolution/deck-builder.ts`
- Create: `packages/sim-core/src/deck-evolution/adoption.ts`
- Modify: `packages/sim-core/src/society/knowledge.ts`
- Test: `packages/sim-core/src/deck-evolution/deck-builder.test.ts`
- Test: `packages/sim-core/src/deck-evolution/adoption.test.ts`

**Interfaces:**
- Consumes: CardDefinitions, player Collections, known cards/decks, Phase 1 deck validator and match engine.
- Produces: `DeckGenome`, `generateCandidateDecks(player, world, rng)`, `mutateDeck(parent, player, world, rng)`, `calculateAdoptionScore(player, deck, context)`.

- [x] **Step 1: Write ownership and single-faction failing tests**

Required:

```ts
it("never places an unowned live-world card in a player deck", () => {});
it("never mixes two non-neutral factions", () => {});
it("mutates only a small bounded number of entries", () => {});
```

- [x] **Step 2: Write adoption-score tests**

Construct a Competitive and Budget player. For the same strong expensive deck:

- Competitive score should be higher than a weak deck if affordable/owned.
- Budget player's score should drop materially with high missing-card/price penalty.

- [x] **Step 3: Implement DeckGenome lineage**

```ts
export type DeckGenome = {
  id: DeckId;
  factionId: FactionId;
  cards: DeckCardEntry[];
  strategy: StrategyVector;
  originPlayerId: PlayerId;
  parentDeckIds: DeckId[];
  generation: number;
  createdDay: number;
};
```

- [x] **Step 4: Implement heuristic candidate generation and bounded mutation**

Use Card DSL features to derive simple card-role/synergy scores. Do not call LLMs and do not hard-code final named archetypes.

- [x] **Step 5: Implement KnowledgeState updates**

A player learns decks/cards only through owned cards, matches, public tournament-style events (Phase 3), or structured social exposure. World Ground Truth does not automatically enter player knowledge.

- [x] **Step 6: Run focused tests and commit**

```bash
pnpm vitest run packages/sim-core/src/deck-evolution
pnpm typecheck
git add packages/sim-core/src/deck-evolution packages/sim-core/src/society/knowledge.ts
git commit -m "feat: evolve ownership-aware player decks"
```

---

### Task 8: Sample real matches and aggregate observable Meta

**Files:**
- Create: `packages/sim-core/src/meta/sample-matches.ts`
- Create: `packages/sim-core/src/meta/meta-aggregation.ts`
- Test: `packages/sim-core/src/meta/meta-aggregation.test.ts`
- Test: `tests/scenarios/hidden-combo-discovery.test.ts`

**Interfaces:**
- Consumes: legal owned player Decks, player activity, `simulateMatch()`.
- Produces: `sampleDailyMatches(world, rng)`, `MetaDeckStats`, `MatchupStats`, `updateMetaState(world, matchResults)` and discovery/knowledge events.

- [x] **Step 1: Write failing Meta aggregation tests**

Use explicit match results and assert usage, wins/losses, observed win rate and matchup matrix are computed from actual samples.

- [x] **Step 2: Write hidden-discovery scenario**

Fixture includes a high-synergy deck known by only one brewer. Assert Day 1 public knowledge does not instantly include it for all players. After repeated match exposure, public knowledge/adoption may grow.

- [x] **Step 3: Implement deterministic match sampling**

Normal daily sampling target comes from BalanceConfig, beginning in the 5k–15k range for full worlds but tests may use reduced deterministic counts. Do not simulate a Cartesian product of all players/decks.

- [x] **Step 4: Aggregate confidence metadata**

Meta stats include sample count and a qualitative confidence bucket such as `VERY_LOW | LOW | MEDIUM | HIGH` so UI can later avoid false precision.

- [x] **Step 5: Run tests and commit**

```bash
pnpm vitest run packages/sim-core/src/meta
pnpm vitest run tests/scenarios/hidden-combo-discovery.test.ts
pnpm typecheck
git add packages/sim-core/src/meta tests/scenarios/hidden-combo-discovery.test.ts
git commit -m "feat: derive live meta from real matches"
```

---

### Task 9: Implement accessibility, satisfaction, lifecycle and core world metrics

**Files:**
- Create: `packages/balance/src/metrics-config.ts`
- Create: `packages/sim-core/src/metrics/accessibility.ts`
- Create: `packages/sim-core/src/metrics/satisfaction.ts`
- Create: `packages/sim-core/src/population/lifecycle.ts`
- Create: `packages/sim-core/src/metrics/world-metrics.ts`
- Create: `packages/sim-core/src/metrics/ecosystem-risk.ts`
- Test: `packages/sim-core/src/metrics/world-metrics.test.ts`
- Test: `tests/scenarios/negative-hype.test.ts`
- Test: `tests/scenarios/expensive-healthy-meta.test.ts`

**Interfaces:**
- Consumes: market prices/supply, product availability, Meta samples, population/cohort state, publisher history/cash.
- Produces: Accessibility, cohort target satisfaction, lifecycle deltas, Hype/CollectorHeat/MetaHealth/BrandTrust updates, `EcosystemRiskState`.

- [ ] **Step 1: Write failing smoothing and independence tests**

Required:

```ts
it("negative controversy can raise Hype while lowering sentiment", () => {});
it("Brand Trust moves slower than Hype toward its target", () => {});
it("healthy win rates with unaffordable decks lowers Accessibility without fabricating poor match balance", () => {});
```

- [ ] **Step 2: Implement Accessibility**

Use Starter availability/price, cheapest competitive deck, median Meta deck cost and core-card scarcity. Return normalized 0–100.

- [ ] **Step 3: Implement Meta Health components**

Default conceptual weights:

```ts
{
  diversity: 0.25,
  dominance: 0.25,
  winRate: 0.20,
  matchup: 0.15,
  accessibility: 0.15,
}
```

Apply a configurable staleness penalty separately. Ignore/discount insufficiently sampled decks for win-rate outlier health.

- [ ] **Step 4: Implement target/smoothing metrics**

Use:

```ts
next = current + (target - current) * responseSpeed;
```

Hype response speed > Collector Heat > Brand Trust.

- [ ] **Step 5: Implement cohort lifecycle transitions**

Track Potential -> Interested -> New -> Active -> At Risk -> Churned and Churned -> Returning. Use deterministic Bernoulli draws from derived RNG sub-seeds. New-player onboarding/retention uses a 7-day age window.

- [ ] **Step 6: Implement ecosystem risk states**

Return one of `STABLE | STRAINED | DECLINING | DEATH_SPIRAL | TERMINAL` based on persisted trends/thresholds. Do not apply a blanket state multiplier to revenue or players.

- [ ] **Step 7: Run metric/scenario tests and commit**

```bash
pnpm vitest run packages/sim-core/src/metrics
pnpm vitest run tests/scenarios/negative-hype.test.ts tests/scenarios/expensive-healthy-meta.test.ts
pnpm typecheck
git add packages/balance/src/metrics-config.ts packages/sim-core/src/metrics packages/sim-core/src/population/lifecycle.ts tests/scenarios
git commit -m "feat: model player lifecycle and world health"
```

---

### Task 10: Implement authoritative `simulateDay()` ordering and world invariants

**Files:**
- Create: `packages/sim-core/src/day/day-context.ts`
- Create: `packages/sim-core/src/day/world-invariants.ts`
- Create: `packages/sim-core/src/day/simulate-day.ts`
- Create: `packages/sim-core/src/history/daily-report.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/src/day/simulate-day.test.ts`
- Test: `tests/determinism/world-determinism.test.ts`

**Interfaces:**
- Consumes: every Phase 2 subsystem and `PublisherCommand[]`.
- Produces:

```ts
export type DaySimulationResult = {
  nextState: WorldState;
  report: DailyReport;
  notableEvents: WorldEvent[];
  stateHash: string;
};

export function simulateDay(
  state: WorldState,
  commands: readonly PublisherCommand[],
  config: BalanceConfig,
): DaySimulationResult;
```

- [ ] **Step 1: Write failing phase-order test**

Construct a Print Run completing today and demand for that product. Assert completed inventory can be sold/opened **today**, proving completion occurs before primary sales.

- [ ] **Step 2: Write failing atomic-source test**

Call `simulateDay` and verify input state is unchanged/frozen from caller perspective while result has `day + 1`.

- [ ] **Step 3: Implement explicit phases in the approved order**

For Phase 2 implement only currently available operations but preserve numbered phase functions. The order must cover:

```text
commands / print completion
population exposure/lifecycle pre-sales
primary sales and product opening
collection update
deck build/mutation
normal matches
knowledge propagation
secondary market
accessibility/satisfaction/churn
structured community events
Hype / Collector Heat / Meta Health / Brand Trust
cash expenses
invariants
risk / game over
daily report
```

Phase 3 will insert tournaments/marketing/expansion operations into their approved positions rather than creating another `simulateDay`.

- [ ] **Step 4: Implement `validateWorldInvariants()`**

It must throw a structured `WorldInvariantError` on:

- Negative inventories/holdings.
- Missing IDs.
- Illegal stored Decks.
- NaN/Infinity cash/metrics/prices.
- Negative prices.
- Duplicate IDs where represented as arrays.
- Incorrect day increment.

- [ ] **Step 5: Add deterministic world hash test**

```ts
const a = simulateDay(worldFixture(), [], config);
const b = simulateDay(worldFixture(), [], config);
expect(a.stateHash).toBe(b.stateHash);
expect(a.nextState).toEqual(b.nextState);
```

Run at least 25 repeated identical executions in the test.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm vitest run packages/sim-core/src/day
pnpm vitest run tests/determinism/world-determinism.test.ts
pnpm typecheck
! grep -R -E "fetch\(|openai|anthropic|Math.random" packages/sim-core/src
git add packages/sim-core/src/day packages/sim-core/src/history tests/determinism/world-determinism.test.ts
git commit -m "feat: orchestrate deterministic daily simulation"
```

---

### Task 11: Add golden scenarios, headless Publisher Bot and long-run CLI

**Files:**
- Create: `packages/testkit/src/publisher/basic-publisher-bot.ts`
- Create: `packages/testkit/src/scenarios/balanced-world.ts`
- Create: `packages/testkit/src/scenarios/broken-combo-world.ts`
- Create: `packages/testkit/src/scenarios/scarce-rare-world.ts`
- Create: `packages/testkit/src/scenarios/collector-bubble-world.ts`
- Create: `packages/testkit/src/scenarios/death-spiral-world.ts`
- Create: `packages/testkit/src/scenarios/revival-world.ts`
- Create: `scripts/simulate-days.ts`
- Create: `tests/scenarios/balanced-growth.test.ts`
- Create: `tests/scenarios/scarce-rare.test.ts`
- Create: `tests/scenarios/death-spiral.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `simulateDay()`, Phase 2 commands, test fixtures.
- Produces: `BasicPublisherBot.decide(world): PublisherCommand[]`, named deterministic scenarios, CLI `pnpm sim --days N --seed S`.

- [ ] **Step 1: Write failing CLI parser and scenario smoke tests**

The CLI must accept:

```text
--days positive integer
--seed integer/string seed
--scenario balanced-world|broken-combo-world|scarce-rare-world|collector-bubble-world|death-spiral-world|revival-world
```

Test 30-day balanced scenario returns finite metrics and valid state.

- [ ] **Step 2: Implement BasicPublisherBot**

Its rules are intentionally simple and deterministic:

- If projected product stock is below a configured threshold and cash permits, order a modest reprint.
- Do not arbitrarily change MSRP every day.
- Do not implement Phase 3 Ban/Expansion decisions yet.

- [ ] **Step 3: Implement scenario fixtures with explicit purposes**

Each scenario must be constructed from legal world state, not by bypassing physical ownership invariants.

- [ ] **Step 4: Add scripts**

Root package scripts:

```json
{
  "sim": "tsx scripts/simulate-days.ts",
  "test:scenarios": "vitest run tests/scenarios"
}
```

CLI summary at minimum prints final day, Active Players, Hype, Meta Health, Brand Trust, Cash, market/deck counts, risk state and state hash.

- [ ] **Step 5: Run Phase 2 exit gate**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scenarios
pnpm sim --days 100 --seed 12345 --scenario balanced-world
pnpm sim --days 1000 --seed 12345 --scenario balanced-world
```

Then repeat the 100-day command and confirm identical final `stateHash`.

- [ ] **Step 6: Commit**

```bash
git add packages/testkit scripts tests/scenarios package.json
 git commit -m "test: add headless world simulation scenarios"
```

---

## Phase 2 completion review

Do not move to Publisher Operations/Web UI until all are true:

1. A player never uses an unowned live-world card.
2. A Booster always opens exactly five cards.
3. Buying/opening products and market transfers conserve physical supply.
4. Secondary-market price changes are caused by buy/sell intents, not direct scripted price setters.
5. Meta statistics come from actual Phase 1 match results.
6. Hidden strong decks are not globally known on creation.
7. Active Players changes can be decomposed into lifecycle flows.
8. Hype can rise from negative attention while Trust/Sentiment fall.
9. `simulateDay()` has one authoritative order and does not mutate the input state.
10. 1000-day headless simulation completes with valid finite state.
11. Identical initial state + commands produces identical final hash.
