# TCGTycoon Publisher Operations & Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 2 headless world into the first complete playable offline Web MVP with expansion development, playtests, printing/releases, balance policies, tournaments, marketing, daily reports, multi-save persistence and all primary publisher workbench screens.

**Architecture:** Extend the existing authoritative `simulateDay()` with scheduled publisher operations while preserving deterministic phase order. Build one React/Vite SPA that talks to a typed `GameSessionController`; heavy world simulation executes in a Web Worker and Web saves use a `SaveRepository` Dexie adapter. UI renders selectors/view models and emits `PublisherCommand`s instead of mutating `WorldState`.

**Tech Stack:** TypeScript, React, Vite, React Router, Tailwind CSS, shadcn/ui-style local components, Zustand for UI-only preferences, Dexie, Web Workers, Vitest, Playwright.

## Global Constraints

- New Game Setup ends at Launch; the first public/live day is Day 1.
- Launch Set contains 48 cards.
- Later expansion sizes are 24/32/36 cards; Standard 32 is the common/default choice.
- Later expansion Design progress targets are 4/6/8 live days for 24/32/36 cards.
- Playtests are Quick 1 day/~2k matches, Standard 3 days/~15k, Deep 7 days/~75k by default BalanceConfig.
- Finalize irreversibly locks gameplay DSL; MVP has no gameplay Errata.
- Standard contains the five most recent eligible sets.
- Scheduled Ban/Restrict defaults to 3-day lead; Emergency becomes effective next live day.
- Tournament presets: Local 32/2-day prep, Regional 128/5-day prep, Major 512/10-day prep.
- Marketing types: Social Media Ads, Streamer Sponsorship, New Player Campaign, Collector Campaign, Tournament Promotion.
- AI is not required in this phase; every flow must work with deterministic fixtures/manual structured editing.
- React components never mutate canonical WorldState.
- End Day remains atomic: worker result validates/persists before UI exposes the next day.

---

## Planned file map

```text
packages/domain/src/
  expansions.ts
  operations.ts
  tournaments.ts
  community.ts

packages/balance/src/
  operations-config.ts
  playtest-config.ts
  tournament-config.ts
  marketing-config.ts

packages/sim-core/src/
  operations/scheduler.ts
  operations/expansion-pipeline.ts
  operations/playtest.ts
  operations/policies.ts
  operations/tournaments.ts
  operations/marketing.ts
  operations/announcements.ts
  history/milestones.ts

packages/persistence/src/indexeddb/
  dexie-db.ts
  dexie-save-repository.ts

apps/game/
  package.json
  vite.config.ts
  index.html
  src/main.tsx
  src/app/router.tsx
  src/app/GameApp.tsx
  src/app/game-session/*
  src/workers/simulation.worker.ts
  src/platform/save-repository.ts
  src/state/ui-store.ts
  src/selectors/*
  src/components/*
  src/pages/*
  src/features/*

packages/testkit/src/setup/*

tests/e2e/*
```

---

### Task 1: Add operations scheduler and typed publisher project models

**Files:**

- Create: `packages/domain/src/expansions.ts`
- Create: `packages/domain/src/operations.ts`
- Create: `packages/domain/src/tournaments.ts`
- Create: `packages/domain/src/community.ts`
- Modify: `packages/domain/src/commands.ts`
- Modify: `packages/domain/src/world.ts`
- Create: `packages/balance/src/operations-config.ts`
- Create: `packages/sim-core/src/operations/scheduler.ts`
- Test: `packages/sim-core/src/operations/scheduler.test.ts`

**Interfaces:**

- Consumes: WorldState/PublisherCommand from Phase 2.
- Produces: `ExpansionProject`, `OperationProject`, `OperationStatus`, typed schedule records, expanded `PublisherCommand` union and `advanceScheduledOperations(world, day)`.

- [x] **Step 1: Write failing scheduler tests**

Cover:

```ts
it("activates a planned operation on its start day", () => {});
it("increments an active operation once per live day", () => {});
it("completes an operation exactly on its configured completion day", () => {});
it("does not progress projects during Setup unless the setup service explicitly requests setup playtest progress", () => {});
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/operations/scheduler.test.ts
```

- [x] **Step 3: Implement explicit project states**

Use:

```ts
export type OperationStatus =
  "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "DELAYED";
```

`OperationProject` includes stable ID, type, createdDay, optional startDay/completionDay, status and a typed `payload` discriminated by project type.

- [x] **Step 4: Extend PublisherCommand**

Add exact command variants for this phase:

```ts
CREATE_EXPANSION;
UPDATE_EXPANSION_BRIEF;
UPDATE_CARD_DRAFT;
START_PLAYTEST;
FINALIZE_EXPANSION;
ORDER_PRINT_RUN;
ANNOUNCE_RELEASE;
SCHEDULE_RELEASE;
SCHEDULE_BAN;
SCHEDULE_RESTRICTION;
CREATE_TOURNAMENT;
START_CAMPAIGN;
PUBLISH_ANNOUNCEMENT;
ADJUST_MSRP;
```

Each command carries only IDs/values; no React objects or callbacks.

- [x] **Step 5: Run tests/typecheck and commit**

```bash
pnpm vitest run packages/sim-core/src/operations/scheduler.test.ts
pnpm typecheck
git add packages/domain packages/balance/src/operations-config.ts packages/sim-core/src/operations/scheduler.ts
git commit -m "feat: model scheduled publisher operations"
```

---

### Task 2: Implement expansion pipeline, revisions and irreversible Finalize

**Files:**

- Create: `packages/sim-core/src/operations/expansion-pipeline.ts`
- Test: `packages/sim-core/src/operations/expansion-pipeline.test.ts`
- Create: `packages/testkit/src/setup/launch-set-fixture.ts`

**Interfaces:**

- Consumes: Expansion/CardDefinition domain, Card DSL validator, scheduler.
- Produces: `createExpansion`, `applyCardDraftUpdate`, `advanceExpansionDesign`, `finalizeExpansion`.

- [x] **Step 1: Write failing pipeline tests**

Required cases:

```ts
it("requires 24, 32 or 36 cards for post-launch expansions", () => {});
it("tracks 4/6/8 design progress targets by set size", () => {});
it("increments gameplay revision when DSL changes", () => {});
it("does not increment gameplay revision for flavor-only changes", () => {});
it("refuses gameplay edits after Finalize", () => {});
it("allows player to Finalize with warnings but never with invalid Card DSL", () => {});
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/operations/expansion-pipeline.test.ts
```

- [x] **Step 3: Implement exact stage model**

```ts
export type ExpansionStage =
  "CONCEPT" | "DESIGN" | "PLAYTEST" | "FINALIZED" | "PRINTING" | "RELEASED";
```

Card draft state stores `gameplayRevision`, `rulesLocked` and design-slot metadata. Finalized CardDefinitions become canonical immutable rule objects for later Printings.

- [x] **Step 4: Implement deterministic Launch Setup fixture service**

Fixture helper produces a legal 48-card Launch Set and four legal Starter Decks for offline/E2E tests. This is test/setup content, not a hidden live AI generator.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/operations/expansion-pipeline.test.ts
pnpm typecheck
git add packages/sim-core/src/operations/expansion-pipeline.ts packages/testkit/src/setup
git commit -m "feat: implement expansion development pipeline"
```

---

### Task 3: Implement Quick/Standard/Deep Playtest and report invalidation

**Files:**

- Create: `packages/balance/src/playtest-config.ts`
- Create: `packages/sim-core/src/operations/playtest.ts`
- Test: `packages/sim-core/src/operations/playtest.test.ts`
- Test: `tests/scenarios/playtest-hidden-combo.test.ts`

**Interfaces:**

- Consumes: Rules Engine, Deck Evolution search utilities, unreleased expansion snapshot.
- Produces: `startPlaytest`, `advancePlaytest`, `completePlaytest`, `PlaytestReport`, `PlaytestAnomaly`, revision snapshot validation.

- [x] **Step 1: Write failing duration/cost/revision tests**

Default config:

```ts
quick: { durationDays: 1, matchBudget: 2_000 }
standard: { durationDays: 3, matchBudget: 15_000 }
deep: { durationDays: 7, matchBudget: 75_000 }
```

Test that gameplay revision changes mark an old report `STALE`.

- [x] **Step 2: Write a hidden-combo scenario**

A Deep Test must search more candidate decks/matches than Quick and should discover the prepared combo in the deterministic fixture where Quick does not, without reading a “hidden combo truth” flag.

- [x] **Step 3: Implement test search modes**

Report only discovered evidence:

- candidate deck stats,
- high-risk cards,
- combo candidates,
- first-player win rate,
- average turns,
- diversity estimate,
- trigger safety warnings,
- anomaly replay references.

Never add an undiscovered hidden issue field.

- [x] **Step 4: Verify and commit**

```bash
pnpm vitest run packages/sim-core/src/operations/playtest.test.ts
pnpm vitest run tests/scenarios/playtest-hidden-combo.test.ts
pnpm typecheck
git add packages/balance/src/playtest-config.ts packages/sim-core/src/operations/playtest.ts tests/scenarios/playtest-hidden-combo.test.ts
git commit -m "feat: run finite internal playtests"
```

---

### Task 4: Implement Ban, Restrict and five-set Standard Rotation

**Files:**

- Create: `packages/sim-core/src/operations/policies.ts`
- Test: `packages/sim-core/src/operations/policies.test.ts`
- Test: `tests/scenarios/restrict-combo.test.ts`

**Interfaces:**

- Consumes: BanlistVersion, Deck validator, scheduled operations, expansion release order.
- Produces: `schedulePolicyChange`, `activatePolicyChanges`, `getActiveBanlist`, `applyStandardRotation`, policy-aware deck legality.

- [x] **Step 1: Write failing policy tests**

Required:

```ts
it("scheduled restriction becomes active after three days by default", () => {});
it("emergency restriction becomes active next live day", () => {});
it("restricted card copy limit becomes one", () => {});
it("banned card makes a deck illegal", () => {});
it("sixth Standard set rotates the oldest set", () => {});
it("rotation does not delete physical cards or Printings", () => {});
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/sim-core/src/operations/policies.test.ts
```

- [x] **Step 3: Implement versioned policy snapshots**

Every change creates a new immutable BanlistVersion with `effectiveDay`, banned IDs and restricted IDs. Matches/tournaments store the active version ID.

- [x] **Step 4: Re-run Meta after policy effects through normal deck rebuild/match flow**

Do not implement `winRate -= X`. Tests should show restricting a 2-copy combo engine changes legal decks and therefore future simulated performance.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/operations/policies.test.ts tests/scenarios/restrict-combo.test.ts
pnpm typecheck
git add packages/sim-core/src/operations/policies.ts tests/scenarios/restrict-combo.test.ts
git commit -m "feat: version standard ban and rotation policy"
```

---

### Task 5: Implement real tournaments

**Files:**

- Create: `packages/balance/src/tournament-config.ts`
- Create: `packages/sim-core/src/operations/tournaments.ts`
- Test: `packages/sim-core/src/operations/tournaments.test.ts`
- Test: `tests/scenarios/tournament-shock.test.ts`

**Interfaces:**

- Consumes: persistent players, owned legal decks, Rules Engine, active BanlistVersion.
- Produces: tournament registration, bracket/match results, Top 8, winner, public deck-list knowledge events and structured attention events.

- [x] **Step 1: Write failing preset/registration tests**

Defaults:

```ts
LOCAL: { maxPlayers: 32, prepDays: 2 }
REGIONAL: { maxPlayers: 128, prepDays: 5 }
MAJOR: { maxPlayers: 512, prepDays: 10 }
```

Assert players without legal owned decks cannot register.

- [x] **Step 2: Write tournament-shock scenario**

A cold deck with low public knowledge wins a deterministic Regional/Major. Assert the tournament result creates a public knowledge event and later adoption/demand changes; do not directly set its usage rate.

- [x] **Step 3: Implement deterministic pairings/bracket**

Use stable seeded pairing order. Persist important match action logs for final and designated notable upsets.

- [x] **Step 4: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/operations/tournaments.test.ts
pnpm vitest run tests/scenarios/tournament-shock.test.ts
pnpm typecheck
git add packages/balance/src/tournament-config.ts packages/sim-core/src/operations/tournaments.ts tests/scenarios/tournament-shock.test.ts
git commit -m "feat: simulate official tournaments"
```

---

### Task 6: Implement campaigns, official announcements and structured commitments

**Files:**

- Create: `packages/balance/src/marketing-config.ts`
- Create: `packages/sim-core/src/operations/marketing.ts`
- Create: `packages/sim-core/src/operations/announcements.ts`
- Test: `packages/sim-core/src/operations/marketing.test.ts`
- Test: `tests/scenarios/marketing-stockout.test.ts`

**Interfaces:**

- Consumes: cohorts, product availability, operation scheduler, WorldEvent model.
- Produces: five campaign types, daily exposure deltas, `OfficialAnnouncement`, finite structured `Commitment` types and fulfillment/breach events.

- [x] **Step 1: Write failing campaign tests**

Campaign duration choices: 3, 7, 14 days. Assert campaign increases relevant exposure but never directly mutates Active Players.

- [x] **Step 2: Write stockout scenario**

New Player Campaign + all Starter products out of stock should increase Interested/awareness while Interested -> New conversion remains constrained.

- [x] **Step 3: Implement official announcement model**

Supported topics:

```ts
"EXPANSION" |
  "BALANCE" |
  "REPRINT" |
  "TOURNAMENT" |
  "DEVELOPMENT" |
  "APOLOGY_RESPONSE";
```

Free-form text is presentation data. Structured bound action/commitment drives future Trust evaluation.

- [x] **Step 4: Implement communication saturation as BalanceConfig attention decay**

Repeated low-impact announcements reduce incremental attention; they do not generate free Hype.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/sim-core/src/operations/marketing.test.ts tests/scenarios/marketing-stockout.test.ts
pnpm typecheck
git add packages/balance/src/marketing-config.ts packages/sim-core/src/operations/marketing.ts packages/sim-core/src/operations/announcements.ts tests/scenarios/marketing-stockout.test.ts
git commit -m "feat: model marketing and official communication"
```

---

### Task 7: Integrate full publisher operations into authoritative daily phases

**Files:**

- Modify: `packages/sim-core/src/day/simulate-day.ts`
- Modify: `packages/sim-core/src/day/world-invariants.ts`
- Create: `packages/sim-core/src/history/milestones.ts`
- Test: `packages/sim-core/src/day/publisher-day.test.ts`
- Test: `tests/determinism/publisher-world-determinism.test.ts`

**Interfaces:**

- Consumes: Tasks 1–6 plus Phase 2 subsystems.
- Produces: complete deterministic daily operations order matching the authoritative spec.

- [x] **Step 1: Write failing multi-operation ordering test**

Fixture day contains:

- policy becoming effective,
- playtest completing,
- Print Run completing,
- campaign active,
- tournament today,
- release today.

Assert all effects occur in the approved order and the resulting state is deterministic.

- [x] **Step 2: Integrate exact order**

The function must now explicitly execute:

```text
activate policies
advance projects/playtests
complete print runs / receive inventory
releases / rotation
campaign exposure
population/product/match flow
scheduled tournament
knowledge/adoption
market
satisfaction/churn/community intent
metrics/trust
cash
invariants/risk/game over/report
```

- [x] **Step 3: Add Milestones**

Record durable structured milestones such as first 1k players, first ban, first Major winner, first card above configured price milestones and Death-Spiral recovery. Milestones never modify outcomes themselves.

- [x] **Step 4: Verify determinism**

```bash
pnpm vitest run packages/sim-core/src/day/publisher-day.test.ts tests/determinism/publisher-world-determinism.test.ts
pnpm test:scenarios
pnpm typecheck
```

- [x] **Step 5: Commit**

```bash
git add packages/sim-core/src/day packages/sim-core/src/history tests/determinism
git commit -m "feat: integrate publisher operations into day loop"
```

---

### Task 8: Scaffold React/Vite game shell, routing and UI-only state

**Files:**

- Create: `apps/game/package.json`
- Create: `apps/game/vite.config.ts`
- Create: `apps/game/tsconfig.json`
- Create: `apps/game/index.html`
- Create: `apps/game/src/main.tsx`
- Create: `apps/game/src/app/GameApp.tsx`
- Create: `apps/game/src/app/router.tsx`
- Create: `apps/game/src/state/ui-store.ts`
- Create: `apps/game/src/styles/globals.css`
- Create: `apps/game/src/pages/PlaceholderPage.tsx`
- Modify: root `package.json`
- Test: `apps/game/src/app/router.test.tsx`

**Interfaces:**

- Consumes: no WorldState mutation yet.
- Produces: Web app routes matching the spec and `UiStore` containing presentation-only state.

- [x] **Step 1: Add app dependencies**

Use workspace commands to add React, React DOM, React Router, Zustand, Tailwind/Vite integration and testing-library dependencies. Use current compatible releases and commit the lockfile.

- [x] **Step 2: Write failing route smoke test**

Assert routes exist for:

```text
/new-game
/dashboard
/cards
/cards/:cardId
/expansions
/expansions/:setId
/playtest/:reportId
/meta
/meta/decks/:deckId
/matches/:matchId
/market
/products/:productId
/community
/agents/:agentId
/tournaments
/tournaments/:tournamentId
/operations
/daily-report/:day
/history
/settings
```

- [x] **Step 3: Run and verify failure**

```bash
pnpm --filter @tcgtycoon/game test -- router.test.tsx
```

- [x] **Step 4: Implement app shell and route placeholders**

`UiStore` may hold sidebar collapsed state, active table view and theme; it must not contain canonical cash/cards/players/world state.

- [x] **Step 5: Add root scripts**

```json
{
  "dev:web": "pnpm --filter @tcgtycoon/game dev",
  "build:web": "pnpm --filter @tcgtycoon/game build"
}
```

- [x] **Step 6: Verify/commit**

```bash
pnpm typecheck
pnpm lint
pnpm build:web
git add apps/game package.json pnpm-lock.yaml
git commit -m "feat: scaffold publisher web application"
```

---

### Task 9: Add GameSessionController, Simulation Worker and atomic End Day

**Files:**

- Create: `apps/game/src/app/game-session/GameSessionController.ts`
- Create: `apps/game/src/app/game-session/GameSessionContext.tsx`
- Create: `apps/game/src/workers/protocol.ts`
- Create: `apps/game/src/workers/simulation.worker.ts`
- Create: `apps/game/src/app/game-session/end-day.ts`
- Test: `apps/game/src/app/game-session/GameSessionController.test.ts`

**Interfaces:**

- Consumes: `simulateDay`, WorldState, PublisherCommand, SaveRepository contract.
- Produces: `GameSessionController.load`, `queueCommand`, `discardPendingCommand`, `endDay`, `subscribe`; worker protocol `SIMULATE_DAY_REQUEST|PROGRESS|RESULT|ERROR`.

- [x] **Step 1: Write failing atomic End Day test**

With a fake worker/repository:

- result is not exposed until repository `save` resolves,
- save failure leaves current state/day unchanged,
- pending commands clear only after successful commit.

- [x] **Step 2: Implement the worker protocol**

Worker receives a structured clone of canonical state/commands/config and returns deterministic result. No AI/network imports.

- [x] **Step 3: Implement controller as the only mutable application-session boundary**

React pages read snapshots and dispatch typed commands. Do not expose `setWorldState()` to feature components.

- [x] **Step 4: Verify and commit**

```bash
pnpm --filter @tcgtycoon/game test -- GameSessionController.test.ts
pnpm typecheck
pnpm build:web
git add apps/game/src/app/game-session apps/game/src/workers
git commit -m "feat: run atomic end day in simulation worker"
```

---

### Task 10: Implement Dexie Web saves, multi-slot UI and New Game Setup

**Files:**

- Create: `packages/persistence/src/indexeddb/dexie-db.ts`
- Create: `packages/persistence/src/indexeddb/dexie-save-repository.ts`
- Modify: `packages/persistence/src/index.ts`
- Create: `apps/game/src/platform/save-repository.ts`
- Create: `apps/game/src/features/new-game/NewGameWizard.tsx`
- Create: `apps/game/src/features/new-game/setup-service.ts`
- Create: `apps/game/src/features/saves/SaveSlotList.tsx`
- Create: `apps/game/src/pages/NewGamePage.tsx`
- Test: `packages/persistence/src/indexeddb/dexie-save-repository.test.ts`
- Test: `apps/game/src/features/new-game/setup-service.test.ts`

**Interfaces:**

- Consumes: SaveRepository contract, deterministic Launch fixture/manual structured card editor paths.
- Produces: Web `SaveRepository`, multiple save slots, Setup Phase service ending at Day 1 launch.

- [x] **Step 1: Add Dexie and fake IndexedDB test dependency**

Use `fake-indexeddb` for Vitest adapter tests.

- [x] **Step 2: Write failing save repository tests**

Cover list/save/load/delete and current+previous autosave snapshots. Persist canonical envelopes, not React/UI state.

- [x] **Step 3: Write Setup service test**

Offline deterministic Setup must create:

- 4 factions,
- 48 legal Launch CardDefinitions,
- 4 legal 20-card Starters,
- selected initial Print Runs/products,
- `status = LIVE`, `day = 1` after Launch.

- [x] **Step 4: Implement wizard steps**

The wizard may use manual/fixture card completion in Phase 3; AI buttons are disabled/Mock until Phase 4. Player can edit structured cards.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/persistence/src/indexeddb apps/game/src/features/new-game/setup-service.test.ts
pnpm build:web
git add packages/persistence apps/game/src/features/new-game apps/game/src/features/saves apps/game/src/pages/NewGamePage.tsx apps/game/src/platform
git commit -m "feat: create web saves and launch setup flow"
```

---

### Task 11: Build Dashboard, global shell, End Day review and Daily Report

**Files:**

- Create: `apps/game/src/components/layout/AppShell.tsx`
- Create: `apps/game/src/components/layout/GlobalHeader.tsx`
- Create: `apps/game/src/components/semantics/FactValue.tsx`
- Create: `apps/game/src/components/semantics/EstimateValue.tsx`
- Create: `apps/game/src/components/semantics/OpinionBlock.tsx`
- Create: `apps/game/src/selectors/dashboard.ts`
- Create: `apps/game/src/features/dashboard/DashboardView.tsx`
- Create: `apps/game/src/features/daily-report/DailyReportView.tsx`
- Create: `apps/game/src/features/end-day/EndDayDialog.tsx`
- Create: `apps/game/src/pages/DashboardPage.tsx`
- Create: `apps/game/src/pages/DailyReportPage.tsx`
- Test: `apps/game/src/selectors/dashboard.test.ts`
- Test: `apps/game/src/features/end-day/EndDayDialog.test.tsx`

**Interfaces:**

- Consumes: WorldState/report/session controller.
- Produces: pure selectors `selectDashboardView(world)`, UI semantics and End Day warnings/Proceed Anyway flow.

- [ ] **Step 1: Write selector tests for Health Overview and Current Drivers**

Assert selector returns Active Players, Hype, Collector Heat, Meta Health, Brand Trust, Cash, conservative runway and top positive/negative contributors without mutating world.

- [ ] **Step 2: Implement shell with required primary nav/header**

Primary nav: Dashboard, Cards, Expansions, Playtest, Meta, Market, Community, Tournaments, Operations. Header includes Players, Hype, Meta, Trust, Cash, Day and End Day.

- [ ] **Step 3: Implement End Day review**

Warnings may mention low stock, critical Meta, completed Playtest and near tournament, but `Proceed Anyway` always exists unless simulation is currently running.

- [ ] **Step 4: Implement Daily Report**

Render 3–6 sorted notable stories plus metric deltas. Each story has entity-navigation metadata; do not create dead text cards.

- [ ] **Step 5: Verify/commit**

```bash
pnpm --filter @tcgtycoon/game test -- dashboard EndDayDialog
pnpm build:web
git add apps/game/src/components apps/game/src/selectors apps/game/src/features/dashboard apps/game/src/features/daily-report apps/game/src/features/end-day apps/game/src/pages
git commit -m "feat: add publisher dashboard and daily report"
```

---

### Task 12: Build Cards, Card Studio, Expansions and Playtest Lab

**Files:**

- Create: `apps/game/src/selectors/cards.ts`
- Create: `apps/game/src/selectors/expansions.ts`
- Create: `apps/game/src/features/cards/CardDatabase.tsx`
- Create: `apps/game/src/features/cards/CardDetail.tsx`
- Create: `apps/game/src/features/cards/CardStudio.tsx`
- Create: `apps/game/src/features/expansions/ExpansionList.tsx`
- Create: `apps/game/src/features/expansions/ExpansionDetail.tsx`
- Create: `apps/game/src/features/expansions/SetReview.tsx`
- Create: `apps/game/src/features/playtest/PlaytestLab.tsx`
- Create: `apps/game/src/features/playtest/PlaytestReportView.tsx`
- Create/modify matching page files.
- Test: `apps/game/src/features/cards/CardStudio.test.tsx`
- Test: `apps/game/src/features/expansions/SetReview.test.tsx`

**Interfaces:**

- Consumes: card/expansion/playtest selectors and GameSession queued commands.
- Produces: full structured manual design path for offline MVP.

- [ ] **Step 1: Write Card Studio command test**

Editing cost/effect must queue `UPDATE_CARD_DRAFT`; component must never alter session snapshot directly. Rules-locked card disables gameplay editor.

- [ ] **Step 2: Implement Card Database/Detail tabs**

Overview, Performance, Market, History. Known Synergy data only comes from public knowledge selectors.

- [ ] **Step 3: Implement Set Review**

Table supports accept, edit, delete/regenerate placeholder/manual replacement and bulk low-risk acceptance where legal.

- [ ] **Step 4: Implement Playtest Lab/Report**

Expose Quick/Standard/Deep cost/duration, report freshness, risks, Decks/Cards/Matchups/Anomalies/Replays tabs. Wording must say “not discovered” rather than “does not exist.”

- [ ] **Step 5: Verify/commit**

```bash
pnpm --filter @tcgtycoon/game test -- CardStudio SetReview
pnpm build:web
git add apps/game/src/selectors apps/game/src/features/cards apps/game/src/features/expansions apps/game/src/features/playtest apps/game/src/pages
git commit -m "feat: add card and expansion workbench"
```

---

### Task 13: Build Meta, replay, Market, Community, Tournaments, Operations and search

**Files:**

- Create: `apps/game/src/selectors/meta.ts`
- Create: `apps/game/src/selectors/market.ts`
- Create: `apps/game/src/selectors/community.ts`
- Create: `apps/game/src/features/meta/MetaOverview.tsx`
- Create: `apps/game/src/features/meta/DeckDetail.tsx`
- Create: `apps/game/src/features/matches/MatchReplay.tsx`
- Create: `apps/game/src/features/market/MarketOverview.tsx`
- Create: `apps/game/src/features/market/ProductDetail.tsx`
- Create: `apps/game/src/features/market/PrintingDetail.tsx`
- Create: `apps/game/src/features/community/CommunityFeed.tsx`
- Create: `apps/game/src/features/community/AgentProfile.tsx`
- Create: `apps/game/src/features/community/OfficialAnnouncementDialog.tsx`
- Create: `apps/game/src/features/tournaments/*`
- Create: `apps/game/src/features/operations/*`
- Create: `apps/game/src/features/search/CommandPalette.tsx`
- Create/modify matching pages.
- Test: `apps/game/src/features/meta/MetaOverview.test.tsx`
- Test: `apps/game/src/features/operations/PolicyDialog.test.tsx`

**Interfaces:**

- Consumes: canonical selectors and PublisherCommands.
- Produces: remaining publisher workflows and entity cross-navigation.

- [ ] **Step 1: Write Meta diagnostic tests**

Assert low-confidence decks render sample confidence and Meta Health explanations include actual contributors instead of a Tier-list-only view.

- [ ] **Step 2: Implement deterministic MatchReplay from persisted Action Log**

Support play/pause/step and 1x/2x/4x presentation speed. Playback does not re-run Battle AI.

- [ ] **Step 3: Implement Market**

Show Primary vs Secondary views, product inventory/sales/Pack EV, Printing price/volume/supply/history. No Buy/Sell action exists for the publisher.

- [ ] **Step 4: Implement Community and Agent Profile**

Phase 3 uses deterministic/template post text from structured CommunityPostIntents. Posts navigate to referenced cards/decks/tournaments/market objects.

- [ ] **Step 5: Implement Tournament and Operations flows**

Creation forms queue commands; Calendar shows next 30 days and Policies shows active Banlist/Rotation. Policy dialog displays current usage/win-rate/price/tournament context without recommending an “optimal” choice.

- [ ] **Step 6: Implement Ctrl/Cmd+K command palette**

Search cards, expansions, agents, decks and tournaments using local selectors/index. No remote search.

- [ ] **Step 7: Verify/commit**

```bash
pnpm --filter @tcgtycoon/game test -- MetaOverview PolicyDialog
pnpm build:web
git add apps/game/src/selectors apps/game/src/features apps/game/src/pages
git commit -m "feat: complete publisher workbench views"
```

---

### Task 14: Add Playwright E2E and Phase 3 offline-playable gate

**Files:**

- Create: `apps/game/playwright.config.ts`
- Create: `tests/e2e/new-game-launch.spec.ts`
- Create: `tests/e2e/meta-policy.spec.ts`
- Create: `tests/e2e/market-reprint.spec.ts`
- Create: `tests/e2e/expansion-release.spec.ts`
- Create: `tests/e2e/tournament-shock.spec.ts`
- Create: `tests/e2e/end-day-save.spec.ts`
- Modify: root `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: complete Phase 3 Web app.
- Produces: six required user-flow regressions and `pnpm test:e2e`.

- [ ] **Step 1: Add Playwright and root scripts**

```json
{
  "test:e2e": "playwright test",
  "build:web": "pnpm --filter @tcgtycoon/game build"
}
```

Use deterministic seeded fixture/new-game shortcuts only through supported application setup APIs, not direct mutation of IndexedDB internals inside feature assertions.

- [ ] **Step 2: Implement all six required E2E flows**

Each spec asserts final user-visible and canonical effects, not only button presence.

Examples:

- After Reprint scheduling, Operations Calendar contains the due Print Run.
- After policy command and effective day, affected deck legality changes.
- After tournament completion, winning deck appears in results and subsequent public knowledge.

- [ ] **Step 3: Run complete offline Phase 3 gate**

Set AI mode explicitly offline/mock:

```bash
AI_MODE=mock pnpm lint
AI_MODE=mock pnpm typecheck
AI_MODE=mock pnpm test
AI_MODE=mock pnpm test:scenarios
AI_MODE=mock pnpm test:e2e
AI_MODE=mock pnpm build:web
```

Expected: all green with no external AI/API requirement.

- [ ] **Step 4: Run a 100-day headless regression after UI/operations work**

```bash
pnpm sim --days 100 --seed 12345 --scenario balanced-world
```

Compare state hash with a second identical run.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e apps/game/playwright.config.ts package.json .github/workflows/ci.yml
git commit -m "test: verify complete offline publisher flows"
```

---

## Phase 3 completion review

Before Phase 4:

1. New Game can reach a valid Day 1 without network access.
2. End Day runs through Worker and save commit atomically.
3. A player can operate at least 100 days with manual/fixture card content.
4. Expansion Finalize truly prevents gameplay edits.
5. Tournament results come from Rules Engine matches.
6. Ban/Restrict changes policy legality rather than directly changing win rates.
7. Reprint changes supply through real Printings/Products.
8. Marketing changes exposure/conversion inputs, not direct Active Players.
9. All key UI actions queue PublisherCommands.
10. FACT, ESTIMATE and OPINION are visually/semantically distinguishable.
11. The six E2E flows pass with `AI_MODE=mock`.
12. The core Web MVP is already a complete playable game before generative AI/Tauri are added.
