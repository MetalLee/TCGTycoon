# TCGTycoon Codex Development Guide

## Start here

Before changing code, read in this order:

1. `/AGENTS.md`
2. `docs/superpowers/specs/2026-08-11-tcgtycoon-mvp-design.md`
3. `docs/codex/IMPLEMENTATION_ROADMAP.md`
4. The current `docs/superpowers/plans/*.md` phase plan
5. Only the source/tests referenced by the current task

## Recommended local workflow

For each phase:

```bash
git checkout main
git pull
git checkout -b agent/<phase-name>
```

Then give Codex:

```text
Read AGENTS.md, the authoritative MVP design spec, the implementation roadmap, and the full plan for the current phase. Execute only the first unchecked task. Follow its exact Interfaces and Files contract, use TDD, run all commands listed by the task, review the diff for scope creep, then commit the independently testable task. Do not implement future tasks.
```

For subsequent tasks:

```text
Continue from the first unchecked task in the active plan. Re-read that task's Interfaces and Files sections first. Write the failing test, verify the expected failure, implement the minimum code, run the focused and required package tests, then commit only the intended task scope.
```

## What Codex must never improvise

- New gameplay keywords/effects not in the MVP DSL.
- Alternative deck size/resource/hero rules.
- A second independent simulation engine for UI.
- Direct `WorldState` mutation from components.
- `Math.random()` in deterministic code.
- LLM-determined win rates, prices, player counts or events.
- “Temporary” save formats without migration support.
- A sixth Booster card.

If a plan appears impossible or inconsistent, stop implementation and propose a plan/spec amendment rather than silently creating a new rule.

## Phase sequence

1. Foundation & Rules Engine.
2. World Simulation & Economy.
3A. Production, Release & Reprints.
3B. Publisher Operations & Web UI.
4. AI, Desktop & Release hardening.

Do not start Phase 3 UI because it is visually attractive before Phase 2/3A systems are proven headlessly.

## Definition of a good task completion

A task completion message should include:

- What behavior was implemented.
- Exact files changed.
- Focused failing test observed before implementation.
- Tests/commands run after implementation.
- Any measured output relevant to the task, such as result hash or benchmark.
- Commit SHA/message.
- First remaining unchecked task.

Do not say “tests should pass.” Run them.

## Review questions by subsystem

### Rules Engine

- Does behavior execute exclusively from DSL data?
- Is all randomness deterministic?
- Are action/trigger limits respected?
- Does the replay log explain the result?

### Economy

- Where did every new physical card come from?
- Is the price an outcome of demand/supply rather than a setter?
- Does any transfer exceed actual holdings?
- Is Cash represented by ledger entries?

### AI Society

- Is knowledge local/public rather than omniscient?
- Did actual matches establish power/performance?
- Is adoption separated from strength?
- Are LLMs absent from deck building and simulation?

### Operations

- Does the action require the correct preparation/production time?
- Can Finalized printed rules accidentally change?
- Are policy effects executed via legality and future matches rather than direct win-rate edits?

### UI

- Is the rendered data FACT, ESTIMATE or OPINION?
- Does the action queue a typed command?
- Is there a direct navigation path to the underlying entity/evidence?

## Debugging deterministic bugs

When a scenario diverges:

1. Record initial save/state hash.
2. Record pending command list.
3. Enable `SIM_DEBUG=1` when available.
4. Compare phase hashes in authoritative `simulateDay()` order.
5. Identify the first phase whose state differs.
6. Reproduce that phase with the smallest deterministic fixture.
7. Add the failing regression test before the fix.

Do not “fix” a deterministic bug by adding another random draw.

## Balance changes

A balance change is code/config work, not a gameplay redesign.

- Modify only `packages/balance` values/curves when semantics remain unchanged.
- Add/adjust scenario assertions that express direction/range, not brittle exact long-run counts.
- Run multi-seed simulations before accepting a global balance change.
- Do not use balance config to smuggle in a new mechanic.
