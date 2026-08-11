# TCGTycoon Foundation & Rules Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository foundation and a deterministic, headless, fully executable Core Rules v1 match engine for the fixed 20-card TCG.

**Architecture:** Create a pnpm TypeScript monorepo whose domain schemas and deterministic rules engine are independent from React, persistence and networking. Card gameplay is represented by a validated structured DSL; `simulateMatch()` consumes legal decks, a seed and strategy descriptors and returns a deterministic result plus optional compact action log.

**Tech Stack:** TypeScript, pnpm workspaces, Zod, Vitest, ESLint, Prettier, tsx.

## Global Constraints

- Hero health is exactly 20.
- Constructed deck size is exactly 20 cards; normal copy limit is 2.
- A deck is exactly one faction plus Neutral cards.
- Card types are Unit and Spell only.
- Maximum battlefield unit slots is 5.
- Permanent resource grows by 1 per turn and caps at 8.
- First player starts with 3 cards; second player starts with 4 plus one Coin.
- Hand size caps at 10.
- MVP supports exactly these semantic keywords: TAUNT, CHARGE, RUSH, BATTLECRY, DEATHRATTLE, DIVINE_SHIELD, LIFESTEAL, WINDFURY, STEALTH, POISONOUS.
- The executable Card DSL, not display text, is the gameplay source of truth.
- `MAX_ACTIONS_PER_CHAIN = 100`, `MAX_TRIGGER_DEPTH = 20`, `MAX_SUMMONS_PER_CHAIN = 30`.
- No `Math.random()` may appear in `packages/rules-engine`.
- Same match input and engine versions must produce the same deterministic result hash.

---

## Planned file map

```text
package.json                         root scripts/tooling
pnpm-workspace.yaml                 workspace discovery
tsconfig.base.json                  shared TS strictness
eslint.config.mjs                   lint configuration
prettier.config.mjs                 formatting

packages/domain/
  package.json
  tsconfig.json
  src/index.ts
  src/ids.ts                        branded entity IDs
  src/cards.ts                      CardDefinition DSL/domain schemas
  src/decks.ts                      Deck definitions
  src/rules.ts                      Core rule enums/version constants

packages/balance/
  package.json
  tsconfig.json
  src/index.ts
  src/rules-config.ts               Core numeric safety/rule config

packages/rules-engine/
  package.json
  tsconfig.json
  src/index.ts
  src/rng/deterministic-rng.ts
  src/validation/card-validation.ts
  src/validation/deck-validation.ts
  src/battle/types.ts
  src/battle/create-match-state.ts
  src/battle/targeting.ts
  src/battle/effects.ts
  src/battle/triggers.ts
  src/battle/state-check.ts
  src/battle/turn.ts
  src/battle/match-engine.ts
  src/ai/battle-ai.ts
  src/replay/action-log.ts
  src/replay/hash-result.ts

packages/testkit/
  package.json
  tsconfig.json
  src/index.ts
  src/cards/core-fixtures.ts
  src/decks/core-fixtures.ts

scripts/
  simulate-match.ts

tests/
  rules/
  determinism/
```

---

### Task 1: Bootstrap workspace and typed domain IDs

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `.gitignore`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/rules.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/ids.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: branded ID types and constructors `CardId`, `DeckId`, `FactionId`, `PlayerId`, `MatchId`, `PrintingId`; constants `RULE_VERSION = "1"` and the ten-keyword `Keyword` union used by every later task.

- [x] **Step 1: Create the workspace manifests and install test/tool dependencies**

Root `package.json` must include these scripts:

```json
{
  "name": "tcgtycoon",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:rules": "vitest run packages/rules-engine packages/domain",
    "sim:match": "tsx scripts/simulate-match.ts"
  },
  "devDependencies": {
    "@eslint/js": "latest",
    "@types/node": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "typescript-eslint": "latest",
    "vitest": "latest"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Run:

```bash
pnpm install
```

Expected: lockfile created and install exits 0.

- [x] **Step 2: Write the failing branded-ID test**

Create `packages/domain/src/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cardId, deckId } from "./ids";

describe("domain ids", () => {
  it("preserves stable string identity without generating randomness", () => {
    expect(cardId("card-fire-cub")).toBe("card-fire-cub");
    expect(deckId("deck-fire-aggro-v1")).toBe("deck-fire-aggro-v1");
  });
});
```

- [x] **Step 3: Run the test and confirm it fails because the module does not exist**

Run:

```bash
pnpm vitest run packages/domain/src/ids.test.ts
```

Expected: FAIL resolving `./ids`.

- [x] **Step 4: Implement branded IDs and Core Rules enums**

`packages/domain/src/ids.ts` must use a lightweight brand rather than runtime UUID generation:

```ts
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardId = Brand<string, "CardId">;
export type DeckId = Brand<string, "DeckId">;
export type FactionId = Brand<string, "FactionId">;
export type PlayerId = Brand<string, "PlayerId">;
export type MatchId = Brand<string, "MatchId">;
export type PrintingId = Brand<string, "PrintingId">;

export const cardId = (value: string) => value as CardId;
export const deckId = (value: string) => value as DeckId;
export const factionId = (value: string) => value as FactionId;
export const playerId = (value: string) => value as PlayerId;
export const matchId = (value: string) => value as MatchId;
export const printingId = (value: string) => value as PrintingId;
```

`packages/domain/src/rules.ts` must export:

```ts
export const RULE_VERSION = "1" as const;

export const KEYWORDS = [
  "TAUNT",
  "CHARGE",
  "RUSH",
  "BATTLECRY",
  "DEATHRATTLE",
  "DIVINE_SHIELD",
  "LIFESTEAL",
  "WINDFURY",
  "STEALTH",
  "POISONOUS",
] as const;

export type Keyword = (typeof KEYWORDS)[number];
export type CardType = "UNIT" | "SPELL";
export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";
```

- [x] **Step 5: Run domain tests, typecheck and lint**

Run:

```bash
pnpm vitest run packages/domain/src/ids.test.ts
pnpm typecheck
pnpm lint
```

Expected: all PASS/exit 0.

- [x] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs prettier.config.mjs .gitignore packages/domain
git commit -m "chore: bootstrap typed domain workspace"
```

---

### Task 2: Define and validate the Card DSL

**Files:**
- Create: `packages/domain/src/cards.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/cards.test.ts`

**Interfaces:**
- Consumes: `CardId`, `FactionId`, `Keyword`, `CardType`, `Rarity` from Task 1.
- Produces: `CardDefinition`, `CardEffect`, `CardTrigger`, `TargetSelector`, `TriggerType`, `Condition`, `cardDefinitionSchema` and `parseCardDefinition(input: unknown): CardDefinition`.

- [x] **Step 1: Add Zod to the domain package**

Run:

```bash
pnpm --filter @tcgtycoon/domain add zod
```

Ensure `packages/domain/package.json` is named `@tcgtycoon/domain` and exports `./src/index.ts`.

- [x] **Step 2: Write failing tests for a legal unit and unsupported mechanic**

Create `packages/domain/src/cards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCardDefinition } from "./cards";

describe("CardDefinition DSL", () => {
  it("parses a legal Deathrattle unit", () => {
    const card = parseCardDefinition({
      id: "card-scrap-hound",
      name: "Scrap Hound",
      type: "UNIT",
      factionId: "machine",
      rarity: "COMMON",
      cost: 2,
      attack: 3,
      health: 2,
      keywords: ["DEATHRATTLE"],
      triggers: [
        {
          trigger: "ON_DEATH",
          conditions: [],
          effects: [{ type: "DRAW", amount: 1, target: "FRIENDLY_HERO" }]
        }
      ]
    });
    expect(card.cost).toBe(2);
  });

  it("rejects an unsupported SECRET keyword", () => {
    expect(() => parseCardDefinition({
      id: "card-invalid",
      name: "Invalid",
      type: "SPELL",
      factionId: "neutral",
      rarity: "COMMON",
      cost: 1,
      keywords: ["SECRET"],
      triggers: []
    })).toThrow();
  });
});
```

- [x] **Step 3: Run the tests and verify the parser is missing**

```bash
pnpm vitest run packages/domain/src/cards.test.ts
```

Expected: FAIL resolving `./cards`.

- [x] **Step 4: Implement exact DSL unions and schema limits**

`cards.ts` must define these selector values at minimum:

```ts
export const targetSelectors = [
  "SELF",
  "FRIENDLY_UNIT",
  "ENEMY_UNIT",
  "ANY_UNIT",
  "FRIENDLY_HERO",
  "ENEMY_HERO",
  "ANY_CHARACTER",
  "RANDOM_FRIENDLY_UNIT",
  "RANDOM_ENEMY_UNIT",
  "ALL_FRIENDLY_UNITS",
  "ALL_ENEMY_UNITS"
] as const;
```

Use a discriminated `CardEffect` union for exactly the approved effect names:

```ts
type NumericTargetEffect = {
  amount: number;
  target: TargetSelector;
};

export type CardEffect =
  | ({ type: "DEAL_DAMAGE" } & NumericTargetEffect)
  | ({ type: "HEAL" } & NumericTargetEffect)
  | ({ type: "DRAW" } & NumericTargetEffect)
  | ({ type: "DISCARD" } & NumericTargetEffect)
  | { type: "SUMMON"; tokenCardId: CardId; amount: number }
  | { type: "DESTROY"; target: TargetSelector }
  | ({ type: "BUFF_ATTACK" } & NumericTargetEffect)
  | ({ type: "BUFF_HEALTH" } & NumericTargetEffect)
  | ({ type: "BUFF_STATS" } & NumericTargetEffect)
  | ({ type: "DEBUFF_ATTACK" } & NumericTargetEffect)
  | ({ type: "DEBUFF_HEALTH" } & NumericTargetEffect)
  | { type: "GAIN_KEYWORD"; keyword: Keyword; target: TargetSelector }
  | { type: "REMOVE_KEYWORD"; keyword: Keyword; target: TargetSelector }
  | { type: "CREATE_CARD"; cardId: CardId; amount: number }
  | { type: "COPY_CARD"; target: TargetSelector; destination: "HAND" }
  | { type: "RETURN_TO_HAND"; target: TargetSelector }
  | { type: "GAIN_MANA_THIS_TURN"; amount: number }
  | { type: "GAIN_MAX_MANA"; amount: number };
```

Supported triggers:

```ts
export type TriggerType =
  | "ON_PLAY"
  | "ON_DEATH"
  | "TURN_START"
  | "TURN_END"
  | "AFTER_ATTACK"
  | "AFTER_DAMAGE"
  | "AFTER_FRIENDLY_UNIT_DIES"
  | "AFTER_ENEMY_UNIT_DIES"
  | "AFTER_SPELL_PLAYED";
```

Conditions must be a discriminated union implementing the approved one-level conditions. The Zod schema must enforce:

- `cost` integer 0..8.
- Unit `attack` and `health` are non-negative integers, health >= 1 at definition time.
- Spell cards do not carry `attack`/`health`.
- Maximum 2 triggers per card.
- Maximum 3 effects per trigger.
- Keywords restricted to the ten approved values.

Export:

```ts
export function parseCardDefinition(input: unknown): CardDefinition {
  return cardDefinitionSchema.parse(input) as CardDefinition;
}
```

- [x] **Step 5: Run parser tests and typecheck**

```bash
pnpm vitest run packages/domain/src/cards.test.ts
pnpm typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/domain
 git commit -m "feat: define structured card DSL"
```

---

### Task 3: Add deterministic RNG and rule balance constants

**Files:**
- Create: `packages/balance/package.json`
- Create: `packages/balance/tsconfig.json`
- Create: `packages/balance/src/rules-config.ts`
- Create: `packages/balance/src/index.ts`
- Create: `packages/rules-engine/package.json`
- Create: `packages/rules-engine/tsconfig.json`
- Create: `packages/rules-engine/src/rng/deterministic-rng.ts`
- Create: `packages/rules-engine/src/index.ts`
- Test: `packages/rules-engine/src/rng/deterministic-rng.test.ts`

**Interfaces:**
- Consumes: no simulation behavior.
- Produces: `DeterministicRng`, `deriveSeed(parts: readonly (string | number)[]): bigint`, `RULES_CONFIG`, and fixed chain limits.

- [x] **Step 1: Write deterministic sequence tests**

```ts
import { describe, expect, it } from "vitest";
import { DeterministicRng, deriveSeed } from "./deterministic-rng";

describe("DeterministicRng", () => {
  it("returns the same sequence for the same seed", () => {
    const seed = deriveSeed(["world-1", 7, "match-42"]);
    const a = new DeterministicRng(seed);
    const b = new DeterministicRng(seed);
    expect([a.nextInt(100), a.nextInt(100), a.nextFloat()])
      .toEqual([b.nextInt(100), b.nextInt(100), b.nextFloat()]);
  });

  it("derives different seeds for different stable parts", () => {
    expect(deriveSeed(["world", 1])).not.toBe(deriveSeed(["world", 2]));
  });
});
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/rules-engine/src/rng/deterministic-rng.test.ts
```

Expected: FAIL because implementation does not exist.

- [x] **Step 3: Implement a versioned integer PRNG without Math.random**

Use a self-contained 64-bit algorithm so browser and Node agree. Example API:

```ts
export const RNG_VERSION = "splitmix64-v1" as const;

export class DeterministicRng {
  #state: bigint;

  constructor(seed: bigint) {
    this.#state = BigInt.asUintN(64, seed);
  }

  nextUint64(): bigint {
    this.#state = BigInt.asUintN(64, this.#state + 0x9e3779b97f4a7c15n);
    let z = this.#state;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    return BigInt.asUintN(64, z ^ (z >> 31n));
  }

  nextFloat(): number {
    return Number(this.nextUint64() >> 11n) / 9007199254740992;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError("maxExclusive must be positive integer");
    return Math.floor(this.nextFloat() * maxExclusive);
  }
}
```

`deriveSeed()` must hash stable UTF-8 string representations and must not use runtime-specific randomized hashing.

`RULES_CONFIG`:

```ts
export const RULES_CONFIG = {
  heroHealth: 20,
  deckSize: 20,
  normalCopyLimit: 2,
  handLimit: 10,
  boardLimit: 5,
  maxMana: 8,
  maxActionsPerChain: 100,
  maxTriggerDepth: 20,
  maxSummonsPerChain: 30,
} as const;
```

- [x] **Step 4: Verify deterministic tests and grep for forbidden randomness**

```bash
pnpm vitest run packages/rules-engine/src/rng/deterministic-rng.test.ts
! grep -R "Math.random" packages/rules-engine/src
pnpm typecheck
```

Expected: PASS and grep finds nothing.

- [x] **Step 5: Commit**

```bash
git add packages/balance packages/rules-engine
 git commit -m "feat: add deterministic rules rng"
```

---

### Task 4: Implement Card and Deck legality validation

**Files:**
- Create: `packages/domain/src/decks.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/rules-engine/src/validation/card-validation.ts`
- Create: `packages/rules-engine/src/validation/deck-validation.ts`
- Test: `packages/rules-engine/src/validation/deck-validation.test.ts`
- Create: `packages/testkit/package.json`
- Create: `packages/testkit/tsconfig.json`
- Create: `packages/testkit/src/cards/core-fixtures.ts`
- Create: `packages/testkit/src/decks/core-fixtures.ts`
- Create: `packages/testkit/src/index.ts`

**Interfaces:**
- Consumes: `CardDefinition`, branded IDs, `RULES_CONFIG`.
- Produces: `DeckDefinition`, `validateCardDefinition(card)`, `validateDeck(deck, cards): ValidationResult`, and deterministic legal fixture decks used throughout later plans.

- [x] **Step 1: Write failing deck legality tests**

Tests must cover:

```ts
it("accepts exactly 20 cards from one faction plus neutral", () => { /* fixture */ });
it("rejects 19-card decks", () => { /* expect DECK_SIZE */ });
it("rejects three copies of a normal card", () => { /* expect COPY_LIMIT */ });
it("rejects cards from a second non-neutral faction", () => { /* expect FACTION_MISMATCH */ });
```

Use an explicit result shape:

```ts
type ValidationIssue = { code: string; message: string; entityId?: string };
type ValidationResult = { valid: true; issues: [] } | { valid: false; issues: ValidationIssue[] };
```

- [x] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run packages/rules-engine/src/validation/deck-validation.test.ts
```

Expected: FAIL because validators/fixtures are missing.

- [x] **Step 3: Implement `DeckDefinition` and validators**

Deck domain shape:

```ts
export type DeckCardEntry = { cardId: CardId; count: 1 | 2 };

export type DeckDefinition = {
  id: DeckId;
  name: string;
  factionId: FactionId;
  cards: DeckCardEntry[];
};
```

`validateDeck` must expand counts to exactly 20, verify referenced cards, copy limit and faction legality. Neutral faction uses the stable fixture ID `neutral`.

- [x] **Step 4: Add at least 24 simple legal fixture CardDefinitions and two legal decks**

Fixtures should deliberately cover the ten keywords/effects over the suite without trying to model the full 48-card Launch Set yet. Use stable IDs such as `card-fire-cub`, `card-machine-guard`, `card-neutral-scout`.

- [x] **Step 5: Run focused and package tests**

```bash
pnpm vitest run packages/rules-engine/src/validation/deck-validation.test.ts
pnpm test:rules
pnpm typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/domain packages/rules-engine packages/testkit
 git commit -m "feat: validate legal constructed decks"
```

---

### Task 5: Build match state, mulligan, resources, draw and fatigue

**Files:**
- Create: `packages/rules-engine/src/battle/types.ts`
- Create: `packages/rules-engine/src/battle/create-match-state.ts`
- Create: `packages/rules-engine/src/battle/turn.ts`
- Create: `packages/rules-engine/src/replay/action-log.ts`
- Test: `packages/rules-engine/src/battle/turn.test.ts`

**Interfaces:**
- Consumes: legal decks, CardDefinitions, `DeterministicRng`, `RULES_CONFIG`.
- Produces: `MatchState`, `MatchPlayerState`, `BattleAction`, `ActionLogEntry`, `createMatchState(input)`, `startTurn(state)`, `drawCard(state, side)`, `endTurn(state)`.

- [x] **Step 1: Write failing tests for start hands, Coin, mana and fatigue**

Include these exact behaviors:

```ts
it("deals 3 cards to first player and 4 plus Coin to second player", () => {});
it("increases and refills permanent mana up to 8", () => {});
it("deals 1 then 2 fatigue damage when drawing from an empty deck", () => {});
it("burns a drawn card when hand already contains 10 cards", () => {});
```

Use stable seeds in every test.

- [x] **Step 2: Verify focused tests fail**

```bash
pnpm vitest run packages/rules-engine/src/battle/turn.test.ts
```

- [x] **Step 3: Implement normalized battle state**

Use per-match ephemeral instance IDs derived from match seed + sequence, not random UUIDs.

Minimum state:

```ts
export type MatchPlayerState = {
  heroHealth: number;
  deck: CardId[];
  hand: CardInstance[];
  board: UnitInstance[];
  discard: CardInstance[];
  maxMana: number;
  mana: number;
  fatigue: number;
};

export type MatchState = {
  matchId: MatchId;
  turnNumber: number;
  activeSide: "A" | "B";
  players: { A: MatchPlayerState; B: MatchPlayerState };
  actionLog: ActionLogEntry[];
  winner: "A" | "B" | null;
};
```

Implement deterministic shuffle and mulligan helpers in this module; no library random shuffle.

- [x] **Step 4: Run tests, rules suite and forbidden randomness check**

```bash
pnpm vitest run packages/rules-engine/src/battle/turn.test.ts
pnpm test:rules
! grep -R "Math.random" packages/rules-engine/src
```

- [x] **Step 5: Commit**

```bash
git add packages/rules-engine/src/battle packages/rules-engine/src/replay
 git commit -m "feat: add deterministic match turn state"
```

---

### Task 6: Implement targeting, effects, triggers and all ten keywords

**Files:**
- Create: `packages/rules-engine/src/battle/targeting.ts`
- Create: `packages/rules-engine/src/battle/effects.ts`
- Create: `packages/rules-engine/src/battle/triggers.ts`
- Create: `packages/rules-engine/src/battle/state-check.ts`
- Test: `packages/rules-engine/src/battle/effects.test.ts`
- Test: `packages/rules-engine/src/battle/keywords.test.ts`
- Test: `packages/rules-engine/src/battle/trigger-chain.test.ts`

**Interfaces:**
- Consumes: `MatchState`, Card DSL effects/triggers, `RULES_CONFIG`.
- Produces: `getLegalTargets(state, source, selector)`, `resolveEffect(ctx, effect)`, `enqueueTriggers(ctx, event)`, `resolveTriggerQueue(ctx)`, `checkStateBasedDeaths(ctx)`, `performAttack(ctx, attackerId, targetId)`.

- [x] **Step 1: Write failing keyword tests**

Cover every keyword with focused tests. Required edge cases:

```ts
it("TAUNT prevents attacks on other units and hero", () => {});
it("CHARGE can attack hero immediately", () => {});
it("RUSH can attack unit but not hero immediately", () => {});
it("BATTLECRY triggers only when normally played from hand", () => {});
it("DEATHRATTLE triggers after the unit leaves board", () => {});
it("DIVINE_SHIELD prevents the first damage instance", () => {});
it("LIFESTEAL heals by actual damage dealt", () => {});
it("WINDFURY allows exactly two attacks per turn", () => {});
it("STEALTH blocks enemy targeted effects and attacks until it attacks", () => {});
it("POISONOUS destroys a unit only after positive damage; Divine Shield prevention does not poison", () => {});
```

- [x] **Step 2: Write failing trigger safety-limit tests**

Construct fixture cards that intentionally loop and assert the match produces a structured warning instead of hanging:

```ts
expect(result.warnings).toContainEqual(expect.objectContaining({ code: "POTENTIAL_INFINITE_COMBO" }));
```

Also assert action count never exceeds configured limit.

- [x] **Step 3: Run tests and verify expected failures**

```bash
pnpm vitest run packages/rules-engine/src/battle/keywords.test.ts packages/rules-engine/src/battle/trigger-chain.test.ts
```

- [x] **Step 4: Implement selector resolution and effect executors**

Each effect executor must be a named function or switch branch over the discriminated union. Do not interpret display text.

Damage flow must record actual prevented/dealt damage so Divine Shield, Lifesteal and Poisonous interact correctly.

- [x] **Step 5: Implement event/trigger queue with explicit depth/action/summon counters**

Use a resolution context containing:

```ts
type ResolutionContext = {
  state: MatchState;
  queue: PendingTrigger[];
  actionCount: number;
  triggerDepth: number;
  summonsThisChain: number;
  warnings: MatchWarning[];
};
```

When a configured safety limit is crossed, append the warning and terminate the chain deterministically.

- [x] **Step 6: Run all focused rule tests**

```bash
pnpm vitest run packages/rules-engine/src/battle/effects.test.ts
pnpm vitest run packages/rules-engine/src/battle/keywords.test.ts
pnpm vitest run packages/rules-engine/src/battle/trigger-chain.test.ts
pnpm test:rules
pnpm typecheck
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add packages/rules-engine/src/battle packages/rules-engine/src/replay
 git commit -m "feat: resolve core card effects and keywords"
```

---

### Task 7: Implement deterministic Battle AI and `simulateMatch()`

**Files:**
- Create: `packages/rules-engine/src/ai/battle-ai.ts`
- Create: `packages/rules-engine/src/battle/match-engine.ts`
- Modify: `packages/rules-engine/src/index.ts`
- Test: `packages/rules-engine/src/battle/match-engine.test.ts`

**Interfaces:**
- Consumes: all Task 1–6 rules interfaces.
- Produces:

```ts
export type BattleStrategy = {
  aggression: number;   // 0..1
  value: number;        // 0..1
  preservation: number; // 0..1
};

export type MatchInput = {
  seed: bigint;
  deckA: DeckDefinition;
  deckB: DeckDefinition;
  cards: ReadonlyMap<CardId, CardDefinition>;
  strategyA: BattleStrategy;
  strategyB: BattleStrategy;
  recordActionLog?: boolean;
};

export type MatchResult = {
  winner: "A" | "B";
  turns: number;
  actionCount: number;
  warnings: MatchWarning[];
  statistics: MatchStatistics;
  actionLog?: ActionLogEntry[];
};

export function simulateMatch(input: MatchInput): MatchResult;
```

- [x] **Step 1: Write a failing test that two simple legal fixture decks finish a match**

```ts
const result = simulateMatch(fixtureMatchInput(12345n));
expect(["A", "B"]).toContain(result.winner);
expect(result.turns).toBeGreaterThan(0);
expect(result.turns).toBeLessThan(100);
```

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/rules-engine/src/battle/match-engine.test.ts
```

- [x] **Step 3: Implement legal-action enumeration**

The Battle AI may only choose from explicit legal actions:

- Play affordable legal Unit/Spell.
- Attack with an eligible unit against a legal target.
- End turn.

No LLM call or stochastic hidden heuristic outside `DeterministicRng` is allowed.

- [x] **Step 4: Implement baseline action scoring**

Keep MVP Battle AI intentionally simple and deterministic:

- Lethal hero attack receives highest score.
- Legal favorable unit trades score by attack/health swing.
- Playing cards scores by resource use, board presence and strategy weights.
- Aggressive strategy weights hero damage more strongly.
- Value strategy weights card/board preservation more strongly.
- Ties are broken using stable action ordering then seeded RNG only when necessary.

- [x] **Step 5: Implement match loop with a safety turn ceiling used only as engine guard**

Fatigue should normally end games. Add a high guard such as 200 turns to throw/flag an invariant failure rather than silently declaring a winner.

- [x] **Step 6: Run match-engine and rule suites**

```bash
pnpm vitest run packages/rules-engine/src/battle/match-engine.test.ts
pnpm test:rules
pnpm typecheck
```

- [x] **Step 7: Commit**

```bash
git add packages/rules-engine
 git commit -m "feat: simulate complete deterministic matches"
```

---

### Task 8: Add durable action logs, result hashing and determinism regression tests

**Files:**
- Create: `packages/rules-engine/src/replay/hash-result.ts`
- Modify: `packages/rules-engine/src/replay/action-log.ts`
- Test: `tests/determinism/match-determinism.test.ts`
- Test: `tests/determinism/browser-safe-rng.test.ts`

**Interfaces:**
- Consumes: `MatchResult`, action log, deterministic RNG.
- Produces: `hashMatchResult(result): string`, serializable compact `ActionLogEntry` structures suitable for later replay UI.

- [x] **Step 1: Write a failing 100-run determinism test**

```ts
it("produces one result hash across 100 identical runs", () => {
  const hashes = new Set(
    Array.from({ length: 100 }, () => hashMatchResult(simulateMatch(fixtureMatchInput(999n))))
  );
  expect(hashes.size).toBe(1);
});
```

Also serialize/deserialize the action log with JSON and assert equality.

- [x] **Step 2: Verify failure before hash helper exists**

```bash
pnpm vitest run tests/determinism/match-determinism.test.ts
```

- [x] **Step 3: Implement canonical serialization and SHA-256-compatible deterministic hash**

In Node tests use `node:crypto`; keep canonical serialization helper independent so Web later can use `crypto.subtle`. Sort object keys explicitly; do not rely on insertion order.

- [x] **Step 4: Run determinism and rules tests**

```bash
pnpm vitest run tests/determinism
pnpm test:rules
! grep -R "Math.random" packages/rules-engine/src
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/rules-engine/src/replay tests/determinism
 git commit -m "test: lock match determinism and replay format"
```

---

### Task 9: Add headless match CLI and Phase 1 verification gate

**Files:**
- Create: `scripts/simulate-match.ts`
- Modify: `package.json`
- Create: `.github/workflows/ci.yml`
- Test: `tests/rules/headless-match.test.ts`

**Interfaces:**
- Consumes: `simulateMatch()`, fixture decks/cards, result hashing.
- Produces: `pnpm sim:match --seed <integer>` CLI that prints JSON summary with `winner`, `turns`, `warnings`, and deterministic `resultHash`.

- [ ] **Step 1: Write failing CLI argument/parser test**

Factor the CLI's pure argument parsing into exported helper:

```ts
export function parseSeedArg(argv: string[]): bigint;
```

Test:

```ts
expect(parseSeedArg(["--seed", "12345"])).toBe(12345n);
expect(() => parseSeedArg(["--seed", "abc"])).toThrow();
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
pnpm vitest run tests/rules/headless-match.test.ts
```

- [ ] **Step 3: Implement the CLI**

The CLI must not use wall-clock data in the result. Example output shape:

```json
{
  "seed": "12345",
  "winner": "A",
  "turns": 12,
  "warnings": [],
  "resultHash": "..."
}
```

- [ ] **Step 4: Add CI for Phase 1 checks**

`.github/workflows/ci.yml` should run checkout, pnpm setup, install with frozen lockfile, lint, typecheck and test on pushes/PRs.

- [ ] **Step 5: Run the complete Phase 1 exit gate twice**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm sim:match --seed 12345
pnpm sim:match --seed 12345
```

Expected: both CLI runs print the same `resultHash`.

- [ ] **Step 6: Verify forbidden architecture imports**

At Phase 1 there must be no React, HTTP or AI provider dependency in `packages/rules-engine`.

Run:

```bash
! grep -R -E "react|fetch\(|axios|openai|anthropic" packages/rules-engine/src
```

Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add scripts package.json .github tests/rules
 git commit -m "chore: add headless rules verification gate"
```

---

## Phase 1 completion review

Before moving to Phase 2, review the complete diff against these questions:

1. Can the match engine run with zero React/network/persistence dependencies?
2. Is every random decision supplied by `DeterministicRng`?
3. Are all ten keyword semantics covered by focused tests?
4. Is visible card text completely irrelevant to execution?
5. Does an intentional trigger loop terminate with `POTENTIAL_INFINITE_COMBO`?
6. Do the exact same match inputs produce an identical hash 100 times?
7. Are deck legality and 20-card/single-faction constraints enforced before simulation?

If any answer is no, do not begin Phase 2.
