# TCGTycoon Agent Instructions

This repository implements the approved TCGTycoon MVP publisher simulation.

## Source of truth

Read these before substantial work:

1. `docs/superpowers/specs/2026-08-11-tcgtycoon-mvp-design.md` — authoritative product and architecture specification.
2. `docs/codex/IMPLEMENTATION_ROADMAP.md` — phase order and exit gates.
3. The matching task plan under `docs/superpowers/plans/` — exact files, interfaces, TDD steps and commands for the current phase.

If code, a plan and the product spec disagree, stop and reconcile the discrepancy. Do not silently reinterpret the product spec.

## Mandatory architecture rules

1. **Simulation Core is deterministic.**
2. **Never use `Math.random()` in rules-engine or simulation-runtime code.** Use the versioned deterministic RNG.
3. **React components never mutate canonical `WorldState` directly.** Publisher actions become typed `PublisherCommand`s and deterministic simulation transitions.
4. **TCG match rules belong in `packages/rules-engine`.** Do not put match semantics in UI, sim-core or AI prompts.
5. **World/day simulation belongs in `packages/sim-core`.**
6. **AI/LLM/network calls never enter deterministic simulation runtime or the Simulation Worker transaction.**
7. **Display text is not executable rules.** The structured Card DSL is the gameplay source of truth.
8. **Do not invent unsupported Card DSL semantics.** MVP has exactly the rules/keywords/effects approved in the spec.
9. **Every new rule/effect behavior requires focused rules-engine tests.**
10. **Every persisted-schema change requires an explicit save migration and migration test.**
11. **Balance constants belong in `packages/balance`, not scattered magic numbers.**
12. **Physical card supply is conserved.** No live-world card appears without a Print Run/Product opening path.
13. **Important historical replays must remain playable after later Battle AI changes.** Persist compact action logs for durable playback.
14. **Existing save files are durable product data.** Do not solve development problems by invalidating saves without a migration.
15. **Booster Packs contain exactly five cards in MVP.**
16. **A live-world player must own the physical CardDefinitions required by a deck.** Internal Playtest bots are the exception.
17. **Generative AI may render narrative or propose legal content, but it cannot decide simulation facts.**

## TDD workflow

For behavior changes:

1. Write a focused failing test.
2. Run that exact test and confirm the expected failure.
3. Implement the minimum change.
4. Run the focused test until green.
5. Run the relevant package suite.
6. Run typecheck/lint for affected code.
7. Review the diff for scope creep.
8. Commit the independently testable task.

Do not implement future plan tasks “while already in the file.”

## Task scope

- Work on the first unchecked task in the active implementation plan unless the user explicitly asks for another task.
- A task's `Interfaces` section is a contract. Match exact exported names/types unless the plan is deliberately amended first.
- Avoid unrelated refactoring.
- Prefer small, focused modules. If a file starts combining independent responsibilities, split it before adding more logic.

## Required verification habits

Never claim completion without running the commands listed in the current task.

Simulation changes should usually run some combination of:

```bash
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:scenarios
```

Long-run/world changes also use headless simulation once those scripts exist.

UI changes use Playwright once E2E is introduced.

## Determinism and ordering

- Derive randomness from stable seed inputs.
- Process entity collections in stable explicit order.
- Match jobs receive independent derived seeds so later parallelization cannot change outcomes.
- Do not use wall-clock time, locale-dependent ordering, random UUID generation or network results to decide simulation state.

## Persistence

Canonical state, derived state and caches are different:

- Persist canonical ownership, products, cash, player/world state and history.
- Recompute derived selectors when reasonable.
- Treat caches as disposable unless the plan explicitly persists them.

End Day is atomic: simulate -> validate -> persist -> expose next state. A failed simulation/save leaves the old day intact.

## AI integration

AI clients consume/produce schemas from `packages/ai-contracts`.

Development and tests must work with a deterministic mock provider. Network/provider failures must degrade creation/narrative features without preventing End Day.

## UI

The UI is a publisher workbench, not a card-game lobby. Keep FACT, ESTIMATE and OPINION visually distinct.

The user never directly plays a match. Important matches are inspectable through replay/action timelines.

## Git

Use narrow commits aligned to implementation-plan tasks. Recommended branch naming is documented in `docs/codex/IMPLEMENTATION_ROADMAP.md`.
