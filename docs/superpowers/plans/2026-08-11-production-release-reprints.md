# TCGTycoon Production, Release & Reprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the physical publisher pipeline between Finalize and live retail: costed delayed Print Runs, First Edition/Unlimited Printings, announced release dates, delay/short-supply behavior, product/targeted reprints, product freshness/fatigue and the core physical-economy regression scenarios.

**Architecture:** Production extends the Phase 2 physical Product/Printing model and Phase 3 expansion scheduler. A Print Run is a paid non-cancellable operation that produces product inventory after a deterministic lead time; release scheduling controls when inventory becomes sellable. Reprints create new Printing identities without altering CardDefinition semantics, and all economic consequences flow through existing product demand/market/collection systems.

**Tech Stack:** TypeScript, Vitest, existing Domain/Balance/Sim Core modules.

## Global Constraints

- Finalized gameplay rules cannot change after production begins.
- Print Run cost is charged when ordered.
- A Print Run cannot be cancelled after entering `PRINTING`.
- Initial normal production lead-time target is configurable in roughly the 7–14 day range.
- Larger Print Runs reduce unit manufacturing cost through BalanceConfig economies of scale but increase cash/inventory risk.
- First Product Print Run creates First Edition Printings; later product reprints do not create additional First Edition supply.
- Reprints never copy collector identity from First Edition.
- Reprint changes supply through real Products/Printings, never by setting a market price.
- Announced release dates are public commitments; changing them may affect Trust/Hype through structured events.
- A release may launch with low inventory if at least some sellable inventory exists.
- Booster still contains exactly five cards.

---

## Planned file map

```text
packages/domain/src/products.ts
packages/domain/src/expansions.ts
packages/domain/src/operations.ts
packages/balance/src/production-config.ts
packages/balance/src/product-lifecycle-config.ts
packages/sim-core/src/products/production.ts
packages/sim-core/src/products/releases.ts
packages/sim-core/src/products/reprints.ts
packages/sim-core/src/products/product-lifecycle.ts
packages/sim-core/src/day/simulate-day.ts
packages/testkit/src/scenarios/*
tests/scenarios/*
```

---

### Task 1: Implement costed non-cancellable Print Runs and edition identity

**Files:**

- Modify: `packages/domain/src/products.ts`
- Create: `packages/balance/src/production-config.ts`
- Create: `packages/sim-core/src/products/production.ts`
- Test: `packages/sim-core/src/products/production.test.ts`

**Interfaces:**

- Consumes: finalized ProductSku/Expansion, Cash Ledger, scheduler.
- Produces: `quotePrintRun`, `orderPrintRun`, `advancePrintRuns`, `completePrintRuns`, First Edition/Unlimited edition assignment.

- [x] **Step 1: Write failing production tests**

Required cases:

```ts
it("charges total production cost when the Print Run is ordered", () => {});
it("does not add sellable inventory before completion day", () => {});
it("refuses to cancel a PRINTING run", () => {});
it("first completed run of a product creates FIRST_EDITION identity", () => {});
it("later product reprint uses UNLIMITED/REPRINT identity without increasing First Edition supply", () => {});
it("larger quantity has lower unit cost but larger total cash commitment", () => {});
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/products/production.test.ts
```

- [x] **Step 3: Implement production quote**

Use a BalanceConfig function with explicit monotonic quantity tiers/curve. Example starting structure:

```ts
export type ProductionQuote = {
  quantity: number;
  unitCost: number;
  totalCost: number;
  leadDays: number;
};

export function quotePrintRun(
  product: ProductSku,
  quantity: number,
  config: ProductionConfig,
): ProductionQuote;
```

No hard-coded “free inventory.” `orderPrintRun` appends a negative `PRINTING` CashLedger entry immediately.

- [x] **Step 4: Implement edition identity**

`Printing` includes:

```ts
edition: "FIRST_EDITION" | "UNLIMITED" | "REPRINT";
sourceProductId: ProductId;
sourceExpansionId: ExpansionId;
```

First Edition eligibility is determined by product's first production run only and is persistent historical state.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/products/production.test.ts
pnpm typecheck
git add packages/domain/src/products.ts packages/balance/src/production-config.ts packages/sim-core/src/products/production.ts
git commit -m "feat: produce costed physical print runs"
```

---

### Task 2: Implement announced release dates, delays and short-supply launches

**Files:**

- Create: `packages/sim-core/src/products/releases.ts`
- Test: `packages/sim-core/src/products/releases.test.ts`
- Test: `tests/scenarios/release-delay.test.ts`

**Interfaces:**

- Consumes: release commands, Publisher Inventory, WorldEvent/Trust context.
- Produces: `announceRelease`, `rescheduleRelease`, `executeReleasesDueToday`, `ReleaseStatus`, structured delay/shortage events.

- [ ] **Step 1: Write failing release tests**

Required:

```ts
it("cannot execute a release with zero completed sellable inventory", () => {});
it("can launch with low nonzero inventory and emits SHORT_SUPPLY_LAUNCH", () => {});
it("rescheduling a publicly announced date emits RELEASE_DELAY", () => {});
it("rescheduling an unannounced internal target does not emit public trust penalty context", () => {});
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/products/releases.test.ts
```

- [ ] **Step 3: Implement explicit release state**

```ts
export type ReleaseStatus = "UNANNOUNCED" | "ANNOUNCED" | "LIVE" | "DELAYED";
```

Announcement stores the committed public day. Trust/Hype changes are still computed by metric systems from structured events, not directly inside release code.

- [ ] **Step 4: Integrate release before daily primary sales**

A product released today becomes sellable before today's demand phase. A product delayed/not released cannot generate primary sales even if warehouse inventory exists.

- [ ] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/products/releases.test.ts tests/scenarios/release-delay.test.ts
pnpm typecheck
git add packages/sim-core/src/products/releases.ts tests/scenarios/release-delay.test.ts
git commit -m "feat: schedule and execute physical releases"
```

---

### Task 3: Implement Product Reprint and Targeted Reprint

**Files:**

- Create: `packages/sim-core/src/products/reprints.ts`
- Test: `packages/sim-core/src/products/reprints.test.ts`
- Test: `tests/scenarios/targeted-reprint.test.ts`

**Interfaces:**

- Consumes: old Products/CardDefinitions, new Starter/Expansion product definitions, production flow.
- Produces: `createProductReprintOrder`, `createTargetedReprintPrinting`, reprint history, same gameplay CardDefinition with new Printing ID.

- [ ] **Step 1: Write failing reprint tests**

Required:

```ts
it("product reprint keeps the original CardDefinitions and creates non-First-Edition supply", () => {});
it("targeted reprint creates a new PrintingId linked to the same CardDefinition", () => {});
it("competitive deck legality treats old and new Printing as the same CardDefinition", () => {});
it("collector market keeps First Edition and Reprint as independent price series", () => {});
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/products/reprints.test.ts
```

- [ ] **Step 3: Implement product reprint path using normal Production**

Do not special-case market supply. Reprinted cards become available only after the relevant product is produced, sold and opened (or Starter opened).

- [ ] **Step 4: Implement Targeted Reprint inclusion**

A later Starter/Expansion may include a CardDefinition from an older set. It creates a new Printing tied to the new product/edition. The old CardDefinition `rulesLocked` remains unchanged.

- [ ] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/products/reprints.test.ts tests/scenarios/targeted-reprint.test.ts
pnpm typecheck
git add packages/sim-core/src/products/reprints.ts tests/scenarios/targeted-reprint.test.ts
git commit -m "feat: reprint cards without changing rules"
```

---

### Task 4: Implement Product Freshness and cross-release Product Fatigue

**Files:**

- Create: `packages/balance/src/product-lifecycle-config.ts`
- Create: `packages/sim-core/src/products/product-lifecycle.ts`
- Modify: `packages/sim-core/src/products/primary-market.ts`
- Test: `packages/sim-core/src/products/product-lifecycle.test.ts`
- Test: `tests/scenarios/product-cadence.test.ts`

**Interfaces:**

- Consumes: release history, recent cohort spend/budgets, product similarity tags if available.
- Produces: `calculateSetFreshness`, `calculateProductFatigue`, demand modifiers used by Primary Market.

- [ ] **Step 1: Write failing freshness tests**

Assert:

- Release day freshness is maximal/configured high.
- Freshness decays with age.
- Marketing attention may modify demand/exposure but cannot set an old set back to launch freshness.

- [ ] **Step 2: Write rapid-cadence fatigue scenario**

Compare otherwise equal worlds with expansions every ~15 days versus a moderate cadence. Rapid world should show higher recent player spend pressure/fatigue and lower later-product purchase propensity, not a direct arbitrary Trust subtraction.

- [ ] **Step 3: Implement lifecycle curves in BalanceConfig**

Keep functions pure and testable. Product Fatigue responds to recent release frequency and spending capacity; it does not mutate products.

- [ ] **Step 4: Integrate into product demand**

Primary demand reads freshness/fatigue as inputs alongside Need/Interest/Affordability/Exposure.

- [ ] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/products/product-lifecycle.test.ts tests/scenarios/product-cadence.test.ts
pnpm typecheck
git add packages/balance/src/product-lifecycle-config.ts packages/sim-core/src/products packages/testkit/src/scenarios tests/scenarios/product-cadence.test.ts
git commit -m "feat: model product freshness and fatigue"
```

---

### Task 5: Lock physical-economy regression scenarios

**Files:**

- Create: `tests/scenarios/starter-arbitrage.test.ts`
- Create: `tests/scenarios/overprint.test.ts`
- Create: `tests/scenarios/shortage.test.ts`
- Create: `tests/scenarios/pack-ev.test.ts`
- Create: `tests/scenarios/ban-collector-value.test.ts`
- Create: `tests/scenarios/reprint-accessibility.test.ts`

**Interfaces:**

- Consumes: production/release/reprint + Phase 2 economy + Phase 3 policies when available.
- Produces: stable regression coverage for the primary physical-economy stories required by the product spec.

- [ ] **Step 1: Implement Starter arbitrage scenario**

A Starter priced below the contained competitive singles' prevailing aggregate market value must attract existing player demand, sell through more rapidly and increase supply of those single-card Printings after opening. Do not assert an exact price; assert direction and physical supply change.

- [ ] **Step 2: Implement overprint scenario**

A low-demand product ordered at 10x reasonable quantity must consume more cash, leave larger unsold inventory and incur higher holding cost than control world.

- [ ] **Step 3: Implement prolonged shortage scenario**

Extremely low Starter/Booster supply may initially raise scarcity attention but must reduce accessibility and new-player conversion if stockout persists.

- [ ] **Step 4: Implement Pack EV scenario**

A product whose expected singles value substantially exceeds MSRP should receive stronger market-aware demand; increased opening raises singles supply and reduces the EV gap over subsequent simulated days.

- [ ] **Step 5: Implement Ban + collector-value scenario**

After a competitive core card is banned, competitive demand must fall. A historically significant First Edition/Foil may retain nonzero or stronger relative collector demand; no direct `price = 0` rule is allowed.

- [ ] **Step 6: Implement reprint-accessibility scenario**

Targeted reprint must lower the cheapest legal CardDefinition acquisition cost/deck cost and permit increased deck adoption while preserving separate First Edition market history.

- [ ] **Step 7: Run the suite and commit**

```bash
pnpm vitest run tests/scenarios/starter-arbitrage.test.ts tests/scenarios/overprint.test.ts tests/scenarios/shortage.test.ts tests/scenarios/pack-ev.test.ts tests/scenarios/ban-collector-value.test.ts tests/scenarios/reprint-accessibility.test.ts
pnpm test:scenarios
pnpm typecheck
git add tests/scenarios
git commit -m "test: lock physical publisher economy scenarios"
```

---

## Production/Release completion review

Before calling the Web publisher loop complete:

1. Ordering production charges cash immediately.
2. Inventory cannot sell before production completion and product release.
3. Print Runs cannot be silently cancelled after printing begins.
4. First Edition supply cannot be increased by later reprints.
5. Targeted Reprint links to the same immutable CardDefinition but a new Printing.
6. Reprint affects market only through real new supply.
7. Public release delays create structured events; unannounced internal rescheduling does not fake public outrage.
8. Low-stock launches and full stockouts behave differently.
9. Product freshness decays with time; rapid releases create budget/fatigue pressure.
10. Starter arbitrage, overprint, shortage, Pack EV and reprint-accessibility scenario tests all pass.
