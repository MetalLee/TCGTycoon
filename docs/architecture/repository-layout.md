# TCGTycoon Repository Layout

This document defines the intended repository ownership boundaries. The implementation plans create these directories incrementally; empty folders are not required before their owning task begins.

```text
TCGTycoon/
├─ apps/
│  ├─ game/                     shared React/Vite Web game used by browser and Tauri
│  │  └─ src/
│  │     ├─ app/                router, GameSessionController, application composition
│  │     ├─ pages/              route-level composition only
│  │     ├─ features/           publisher-facing feature UIs
│  │     ├─ components/         reusable presentation components
│  │     ├─ selectors/          pure WorldState -> view-model projections
│  │     ├─ services/           AI/application services, never simulation rules
│  │     ├─ workers/            typed Simulation Worker boundary
│  │     ├─ platform/           Web/Tauri persistence/asset adapter selection
│  │     ├─ state/              UI-only state
│  │     └─ styles/
│  ├─ api/                      online generative-AI gateway only
│  │  └─ src/
│  │     ├─ routes/
│  │     ├─ providers/
│  │     ├─ prompts/
│  │     ├─ schemas/
│  │     └─ middleware/
│  └─ desktop/                  Tauri shell; does not duplicate React UI
│     └─ src-tauri/
├─ packages/
│  ├─ domain/                   canonical types, schemas, IDs; no simulation execution
│  ├─ rules-engine/             Card DSL validation, match rules, Battle AI, replay
│  ├─ sim-core/                 deterministic world/day simulation
│  ├─ balance/                  all tunable numeric/config curves
│  ├─ persistence/              SaveRepository/AssetRepository + Memory/Dexie/SQLite adapters
│  ├─ ai-contracts/             shared request/response/fact schemas for generative layer
│  └─ testkit/                  deterministic fixtures, scenarios, Publisher Bot
├─ docs/
│  ├─ superpowers/specs/        authoritative approved product design
│  ├─ superpowers/plans/        task-by-task implementation plans
│  ├─ architecture/
│  ├─ gameplay/
│  └─ codex/
├─ scripts/                     headless simulation/benchmark/balance tools
└─ tests/
   ├─ determinism/
   ├─ scenarios/
   ├─ e2e/
   ├─ parity/
   └─ long-run/
```

## Dependency direction

Preferred dependency graph:

```text
balance ───────────────┐
domain ────────────────┼──> rules-engine
  │                    │
  ├────────────────────┼──> sim-core <── testkit
  │                    │       │
  ├──> persistence     │       │
  └──> ai-contracts    │       │
                        │       ▼
                        └──> apps/game
                              │   │
                              │   └──> platform adapters
                              ▼
                            apps/desktop

ai-contracts ───────────────> apps/api
apps/game ──HTTP only───────> apps/api
```

Rules:

- `rules-engine` must not import `sim-core`, React, persistence, Hono or OpenAI.
- `sim-core` may import domain, balance and rules-engine; it must not import React, Hono, OpenAI or platform persistence implementations.
- `apps/game` may consume public APIs/selectors/contracts but must never reimplement game rules.
- `apps/api` may consume domain/ai-contract schemas for validation but never canonical live `WorldState` or simulation execution.
- `apps/desktop` is a host/platform adapter around `apps/game`, not a second game application.

## Canonical state ownership

`WorldState` belongs to the domain/simulation layer. UI has read-only snapshots through `GameSessionController` and emits typed `PublisherCommand`s.

Do not place canonical world state inside Zustand/Redux-like generic UI stores.

## Where new code goes

### New match mechanic

Only if approved by product spec:

1. `packages/domain` Card DSL schema/type.
2. `packages/rules-engine` executor/validation.
3. focused rules tests.
4. balance only when a numeric value is tunable.

### New daily simulation behavior

- Canonical type in `domain` if needed.
- Pure/config value in `balance` if tunable.
- State transition in focused `sim-core` module.
- Integrate once into authoritative `simulateDay()` phase ordering.
- Scenario/invariant tests.

### New page

- route composition in `pages`.
- behavior/presentation in `features`.
- data derivation in `selectors`.
- world mutation only through GameSession/PublisherCommand.

### New AI feature

- request/response contract in `ai-contracts`.
- provider/gateway implementation in `apps/api`.
- typed client/presentation integration in `apps/game`.
- no simulation call to the gateway.
