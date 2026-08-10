# TCGTycoon Codex Implementation Roadmap

**Authoritative product spec:** `docs/superpowers/specs/2026-08-11-tcgtycoon-mvp-design.md`

This roadmap translates the approved MVP design into an execution sequence optimized for local Codex development. It is intentionally vertical-slice first: each phase must leave the repository in a runnable, testable state.

## Execution rules

1. Read the authoritative MVP spec before starting any implementation phase.
2. Read the matching `docs/superpowers/plans/*.md` plan before editing code.
3. Work on one phase branch at a time; recommended branch names are listed below.
4. Use TDD for domain/simulation/rules behavior.
5. Commit after each independently testable task.
6. Do not begin the next phase until the current phase exit gate is green.
7. Never move simulation behavior into React components, network handlers or AI prompts.
8. Never use `Math.random()` inside rules or simulation code.
9. Never create new Card DSL semantics that are not in the approved spec.
10. Any persisted-state schema change must ship with a migration test.

## Phase map

| Phase | Plan | Primary deliverable | Recommended branch |
|---|---|---|---|
| 1 | `2026-08-11-foundation-rules-engine.md` | Deterministic playable headless TCG match engine | `agent/phase-1-foundation-rules` |
| 2 | `2026-08-11-world-simulation-economy.md` | Headless Day loop with players, products, collections, market, Meta and saves | `agent/phase-2-world-simulation` |
| 3A | `2026-08-11-production-release-reprints.md` | Real production/release/reprint lifecycle and physical-economy regression gate | `agent/phase-3a-production-release` |
| 3B | `2026-08-11-publisher-operations-web-ui.md` | Fully playable offline Web publisher simulation from New Game through long-run play | `agent/phase-3b-publisher-web` |
| 4 | `2026-08-11-ai-desktop-release.md` | AI-assisted creation/community + Tauri/SQLite desktop parity + release hardening | `agent/phase-4-ai-desktop` |

---

# Phase 1 — Foundation & Rules Engine

## Goal

Prove that the fixed TCG itself is deterministic, executable, testable and independent of UI/network code.

## Required outcomes

- pnpm workspace initialized.
- `packages/domain`, `packages/rules-engine`, `packages/balance`, `packages/testkit` exist.
- Fixed Core Rules v1 represented as typed domain data.
- Card DSL runtime validation exists.
- Deck validation exists.
- Deterministic RNG exists.
- Unit/Spell execution works.
- Ten MVP keywords work.
- Trigger resolution and infinite-chain safety limits work.
- Baseline local Battle AI can play a legal game.
- Match replay/action logs exist for notable matches.
- A headless command can run fixed fixture matches.
- Determinism tests prove identical match inputs produce identical hashes.

## Phase 1 exit gate

All must pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm sim:match --seed 12345
```

The final command must produce the same deterministic result/hash on repeated runs.

Do **not** build the dashboard before this gate passes.

---

# Phase 2 — World Simulation & Economy

## Goal

Turn the isolated match engine into a persistent physical-TCG world where a complete Day can advance without React or generative AI.

## Required outcomes

- Normalized `WorldState`.
- `PublisherCommand` model and command validation.
- Versioned `SaveEnvelope` and migrations.
- In-memory persistence implementation for tests/headless runs.
- Population Cohorts.
- 300–1000 Persistent Sim Player model; default fixture begins at 400.
- Named Agent structural records, without requiring LLM prose.
- Physical Collections and Printing ownership.
- Booster SKU with **exactly five cards per pack**.
- Starter Deck SKU and opening into physical collection.
- Print Run -> Publisher Inventory flow.
- Primary-market demand and real Cash Ledger.
- Secondary-market buy/sell intents and daily clearing.
- Deck Genome, deck generation, mutation and adoption.
- Match sampling and Meta aggregation.
- Public knowledge vs ground truth separation.
- Cohort satisfaction and lifecycle transitions.
- Hype, Collector Heat, Meta Health, Brand Trust and Cash models.
- Ecosystem risk states and Game Over checks.
- Authoritative deterministic `simulateDay()` orchestration.
- World invariant validation.
- Headless publisher bot.
- Golden scenarios and 1000-day smoke simulation.

## Phase 2 exit gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scenarios
pnpm sim --days 100 --seed 12345
pnpm sim --days 1000 --seed 12345
```

Acceptance criteria:

- No negative inventory/holdings.
- No missing references.
- No NaN/Infinity values.
- Same initial save + commands => same next-state hash.
- Market supply is conserved across trades/opened-card holdings.
- Meta uses actual match results.
- Active-player changes come from lifecycle flows, not direct scripted modifiers.

---

# Phase 3A — Production, Release & Reprints

## Goal

Make the physical publishing chain complete before the UI depends on it.

## Required outcomes

- Costed Print Run quotations with scale economy.
- Cash charged at production order time.
- Non-cancellable PRINTING state.
- First Edition identity on the first product run only.
- Unlimited/Reprint identity on later production.
- Announced release dates and delay events.
- Low-inventory launch versus zero-inventory delay behavior.
- Product Reprint and Targeted Reprint.
- Reprints create new Printing identities while preserving immutable CardDefinition semantics.
- Product Freshness and cross-release Product Fatigue.
- Starter-arbitrage, overprint, shortage, Pack-EV and reprint-accessibility scenario tests.

## Phase 3A exit gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scenarios
```

Do not build UI flows that schedule printing/reprints until this gate is green.

---

# Phase 3B — Publisher Operations & Web Game

## Goal

Produce the first complete playable MVP: a player can create a TCG, launch it, operate it daily, develop new expansions, respond to Meta/economic problems, save, reload and eventually succeed, decline or go bankrupt.

## Required outcomes

### Operations domain

- Expansion pipeline: Concept -> Design -> Playtest -> Finalize -> Printing -> Release -> Live.
- 24/32/36-card expansion sizes.
- Launch Set fixed at 48 cards.
- Quick/Standard/Deep playtests.
- Playtest reports and anomaly replays.
- Card revision invalidation.
- Ban/Restrict policy with effective-day versions.
- Standard Rotation: five most recent sets.
- Reprint and targeted reprint support from Phase 3A.
- Local Open / Regional / Major tournament simulation.
- Five marketing campaign types.
- Official announcement structure and commitments.
- Operations scheduler/calendar.

### Web application

- React + Vite application.
- Shared game-session controller.
- Simulation Web Worker protocol.
- Web IndexedDB/Dexie save repository.
- Multi-save slot UI.
- New Game / Setup Phase.
- Daily End Day flow and Daily Report.
- Dashboard.
- Cards / Card detail / Card Studio.
- Expansions / Set Review.
- Playtest Lab.
- Meta / Deck Detail / Watch Match.
- Market / Product Detail / Printing Detail.
- Community / Named Agent Profile.
- Tournaments.
- Operations Calendar / Policies.
- History and Settings.
- FACT / ESTIMATE / OPINION visual semantics.
- Global search/command palette.

## Phase 3B exit gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scenarios
pnpm test:e2e
pnpm build:web
```

Six required E2E flows:

1. New Game -> Launch -> Day 1.
2. Daily Report -> Meta problem -> Deck -> Card -> Replay -> Ban/Restrict action.
3. Community price complaint -> Card -> Market -> Product -> Reprint -> Operations Calendar.
4. Expansion Concept -> Draft -> Set Review -> Playtest -> edit -> Finalize -> Print -> Release.
5. Tournament scheduling -> simulated result -> winning deck -> next-day Meta/market reaction.
6. Dashboard -> decisions -> End Day -> Daily Report -> save/reload.

At this gate the game must already be playable **with `AI_MODE=mock/offline`**.

---

# Phase 4 — AI, Desktop & Release Hardening

## Goal

Add generative assistance/narrative without compromising deterministic simulation, then provide desktop parity and production-quality regression/performance tooling.

## Required outcomes

### AI Gateway

- Hono TypeScript gateway.
- Shared Zod contracts in `packages/ai-contracts`.
- Mock provider used by tests/local offline mode.
- Provider abstraction.
- World/faction assist.
- Card proposal -> validated Card DSL draft.
- Expansion completion -> validated set proposals.
- Named Agent community text rendering from Fact Packets.
- Key-card/product artwork asset generation adapter.
- Retry/schema rejection without modifying deterministic WorldState.

### Desktop

- Tauri shell using the same `apps/game` frontend.
- SQLite `SaveRepository` adapter.
- Asset persistence adapter.
- Import/export save flow.
- Web/Desktop deterministic parity test fixtures.

### Release hardening

- 1000/3000-day long-run suites.
- 100-seed automated balance smoke runs.
- benchmark scripts for 10k matches, simulateDay, load time and save size.
- migration regression suite.
- crash-safe atomic save behavior.
- CI workflow for lint/typecheck/unit/scenario/E2E where appropriate.

## Phase 4 exit gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scenarios
pnpm test:e2e
pnpm test:long-run
pnpm benchmark
pnpm build:web
pnpm build:desktop
```

The MVP is release-candidate ready when the same canonical fixture save produces the same deterministic next-state hash on Web and Desktop and all AI network access can be disabled without breaking End Day.

---

# Dependency order

Use this dependency chain. Do not skip forward because a later UI looks easier:

```text
Tooling / workspace
  -> Domain IDs and schemas
  -> Card DSL
  -> Deterministic RNG
  -> Rules validation
  -> Match engine
  -> Battle AI / replay
  -> WorldState / commands / saves
  -> Physical products / collections
  -> Economy / market
  -> Deck evolution / Meta
  -> Population / metrics / Death Spiral
  -> simulateDay
  -> Production / release / reprint lifecycle
  -> Expansion / Playtest / Operations
  -> Tournaments / Marketing
  -> React game shell / Worker
  -> Web persistence
  -> Feature UI flows
  -> AI Gateway
  -> Tauri / SQLite
  -> Long-run tuning / release
```

---

# Codex task protocol

For each plan task, local Codex should use this pattern:

1. Read `AGENTS.md`.
2. Read the authoritative MVP spec section referenced by the task.
3. Read only the current task plus the listed interfaces from prerequisite tasks.
4. Write the failing test first.
5. Run the narrow test and capture the expected failure.
6. Implement the minimum production code required.
7. Run the narrow test.
8. Run the relevant package test suite.
9. Run typecheck for changed packages.
10. Review the diff for accidental scope expansion.
11. Commit with the exact task-level commit description from the plan or a terse equivalent.
12. Move to the next task only when green.

Recommended prompt to start a phase in local Codex:

```text
Read AGENTS.md, docs/superpowers/specs/2026-08-11-tcgtycoon-mvp-design.md, docs/codex/IMPLEMENTATION_ROADMAP.md, and the complete matching implementation plan(s) in docs/superpowers/plans. Execute only the next unchecked task using TDD. Do not implement future tasks. Preserve deterministic simulation and the module boundaries in the plan. Run every command listed in the task before claiming completion, then summarize changed files, tests run, and the resulting commit.
```

Recommended prompt for continuing:

```text
Continue the current TCGTycoon implementation plan from the first unchecked task. Re-read that task's Interfaces and Files sections before editing. Use TDD, make no speculative features, run the task's verification commands, and commit only the task's intended files.
```

---

# Review checkpoints

Require a human/Codex review at these points:

1. **After Card DSL schemas** — changing DSL later has broad cost.
2. **After Rules Engine core** — verify rules semantics and deterministic replay.
3. **After WorldState/SaveEnvelope** — verify normalized state and versioning.
4. **After Market clearing** — verify physical supply conservation.
5. **After `simulateDay()`** — verify authoritative phase ordering.
6. **After Production/Release/Reprint** — verify edition identity and physical supply paths.
7. **After Expansion/Playtest pipeline** — verify irreversible Finalize behavior.
8. **After Web vertical slice** — verify the game is usable without AI.
9. **After AI integration** — prove AI prose cannot mutate simulation facts.
10. **Before desktop release** — run migration/long-run/parity suites.

---

# Definition of complete playable MVP

Do not declare MVP complete because all pages render. The MVP is complete only when all of the following can happen in one save:

- Player creates a themed four-faction TCG.
- Launch Set has 48 legal CardDefinitions.
- Booster contains exactly 5 cards.
- Four Starter Decks provide legal 20-card decks.
- AI players physically acquire cards and cannot use cards they do not own.
- Deck builders discover and mutate strategies through real deterministic matches.
- Meta usage and win rates emerge from matches and knowledge spread.
- Secondary-market card prices emerge from supply/demand clearing.
- New players, churn and return flows affect Active Players.
- Named Agents can express simulation facts without creating new facts.
- Player can develop, test, finalize, print and release another expansion.
- First Edition identity survives later reprints.
- Player can run tournaments and marketing.
- Player can Ban, Restrict, Reprint and experience actual downstream consequences.
- Cash can run out and ecosystem decline can become a Death Spiral.
- Save/reload works over long simulation runs.
- The game still advances with all generative AI disabled.
- Web and Desktop use the same deterministic core.
