# TCGTycoon Testing Guide

TCGTycoon is a simulation-heavy game. Tests must prove behavior and invariants, not only component rendering.

## Test layers

### 1. Domain/schema tests

Purpose: reject invalid content before it enters simulation.

Examples:

- Unsupported keyword/effect rejected.
- Unit requires valid health.
- Deck contains exactly 20 cards.
- Deck does not mix two non-Neutral factions.
- SaveEnvelope schema/migration validation.

### 2. Rules Engine tests

Purpose: prove one match behaves according to Core Rules v1.

Must cover:

- Starting hands and mulligan.
- Second-player Coin.
- Mana growth/refill to cap 8.
- Hand cap 10 and card burn.
- Fatigue escalation.
- Board cap 5.
- All ten keywords.
- Target legality.
- Simultaneous combat damage.
- Death/trigger ordering.
- Divine Shield + Poisonous edge case.
- Trigger/action/summon safety limits.

These tests use explicit stable seeds.

### 3. Determinism tests

Purpose: prove no hidden nondeterministic dependency.

Required patterns:

```ts
const hashes = new Set(Array.from({ length: 100 }, () => runAndHashSameInput()));
expect(hashes.size).toBe(1);
```

Test both:

- `simulateMatch()`.
- `simulateDay()`.

Also run with different mocked wall-clock/timezone settings when platform parity is added.

### 4. Scenario tests

Purpose: verify emergent cross-system direction rather than brittle exact values.

Good assertion:

```ts
expect(reprintWorld.accessibility).toBeGreaterThan(controlWorld.accessibility);
expect(reprintWorld.cheapestDeckCost).toBeLessThan(controlWorld.cheapestDeckCost);
```

Bad assertion:

```ts
expect(reprintWorld.activePlayers).toBe(18427);
```

unless the test specifically exists to lock determinism for a fixed fixture/hash.

Core scenarios are listed in the MVP spec and implementation plans.

### 5. Invariant/long-run tests

Purpose: ensure the system remains valid after hundreds/thousands of days.

Always check:

- All numbers finite.
- No negative holdings/inventory.
- No missing entity references.
- Decks remain legal under their intended policy version.
- No duplicate IDs.
- World day progresses correctly.
- Cash ledger reconciles cash.
- Physical market trades conserve opened-card supply.

### 6. UI component tests

Purpose: prove components emit the correct application actions and communicate semantics.

High-value examples:

- Card Studio queues `UPDATE_CARD_DRAFT` and does not mutate snapshot.
- Finalized card disables gameplay edits.
- End Day warning dialog still offers Proceed Anyway.
- Meta screen displays low-confidence sample warning.
- Policy dialog queues scheduled/emergency policy command.

Avoid exhaustive snapshot tests of styling.

### 7. E2E tests

Purpose: prove complete publisher user flows.

Required flows:

1. New Game -> Launch -> Day 1.
2. Meta problem -> evidence -> policy action.
3. Community complaint -> market/product evidence -> reprint.
4. Expansion -> Playtest -> Finalize -> Print -> Release.
5. Tournament -> actual result -> later Meta/market reaction.
6. End Day -> report -> autosave/reload.

Run with deterministic `AI_MODE=mock`.

### 8. Platform parity tests

Same canonical SaveEnvelope + same PublisherCommands must produce equal canonical next state/hash in Web-compatible and Desktop-compatible execution paths.

### 9. AI isolation tests

Tests must prove:

- Invalid structured AI output is rejected.
- Network failure does not block End Day.
- Different prose for one CommunityPostIntent does not alter world hash/metrics/market.
- No OpenAI/provider SDK import leaks into simulation/client bundle rules paths.

## Useful commands by phase

Phase 1:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm sim:match --seed 12345
```

Phase 2/3A:

```bash
pnpm test:scenarios
pnpm sim --days 100 --seed 12345 --scenario balanced-world
pnpm sim --days 1000 --seed 12345 --scenario balanced-world
```

Phase 3B:

```bash
AI_MODE=mock pnpm test:e2e
AI_MODE=mock pnpm build:web
```

Phase 4:

```bash
AI_MODE=mock pnpm test:ai
AI_MODE=mock pnpm test:long-run
pnpm benchmark
pnpm build:web
pnpm build:desktop
```

## Red/green discipline

Every behavior task should show this sequence in the Codex transcript/report:

1. Focused test written.
2. Focused test run and expected failure observed.
3. Minimal implementation.
4. Focused test passes.
5. Relevant package/scenario tests pass.
6. Typecheck/lint passes as required.
7. Task-level commit.

If a test unexpectedly passes before implementation, the test is not proving the new behavior; fix the test before proceeding.

## Scenario reproducibility

Every scenario has a stable fixture name and seed. Record scenario/seed in failure messages so regressions can be reproduced directly from headless CLI.

When randomized statistical behavior is needed, randomness still comes from deterministic seed streams; use multiple fixed seeds rather than nondeterministic tests.

## Performance tests

Benchmarks are measurements, not semantic correctness tests. Initially record baselines for:

- 10k matches.
- Typical `simulateDay()`.
- Save serialization/parse.
- Save size.

Do not invent brittle timing thresholds before obtaining baseline measurements. Once stable baselines exist, use tolerant regression comparisons.
