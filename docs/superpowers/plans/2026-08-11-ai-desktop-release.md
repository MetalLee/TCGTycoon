# TCGTycoon AI, Desktop & Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add schema-validated AI assistance/narrative/art as a non-authoritative enhancement layer, package the same game as a Tauri desktop application with SQLite persistence, and harden the MVP with parity, migration, long-run and performance tests.

**Architecture:** `apps/api` is a thin Hono server that owns provider API keys and implements shared contracts from `packages/ai-contracts`. Simulation generates deterministic structured intents first; AI text/art arrives after state commit and cannot mutate canonical WorldState. `apps/desktop` wraps the existing `apps/game` build and supplies platform persistence/assets through the same interfaces used by Web.

**Tech Stack:** TypeScript, Hono, Zod, official OpenAI JavaScript SDK using the Responses API for text/structured outputs, GPT Image generation adapter, React/Vite game from Phase 3, Tauri v2, SQLite via Tauri SQL plugin, Vitest, Playwright.

## Global Constraints

- End Day must remain fully playable when AI is unavailable or disabled.
- AI receives only allowed Fact Packets and structured design inputs.
- AI cannot invent official future actions or hidden Meta facts.
- AI card/set output must validate against the same Card DSL used by the Rules Engine.
- AI output is rejected/retried on schema/domain validation failure; invalid rules never enter canonical content.
- AI prose is presentation data and must not change numerical simulation results.
- Development/test mode must provide a deterministic MockGenerativeProvider.
- Web clients never contain provider secret API keys.
- Generated binary artwork is stored outside canonical WorldState and referenced by AssetId.
- Web and Desktop must produce identical deterministic simulation results for the same canonical save and commands.

---

## Planned file map

```text
packages/ai-contracts/
  package.json
  tsconfig.json
  src/index.ts
  src/world.ts
  src/cards.ts
  src/sets.ts
  src/community.ts
  src/art.ts
  src/fact-packets.ts

apps/api/
  package.json
  tsconfig.json
  src/index.ts
  src/app.ts
  src/config.ts
  src/routes/world.ts
  src/routes/cards.ts
  src/routes/sets.ts
  src/routes/community.ts
  src/routes/art.ts
  src/providers/types.ts
  src/providers/mock-provider.ts
  src/providers/openai-provider.ts
  src/providers/provider-factory.ts
  src/prompts/*.ts
  src/middleware/errors.ts

apps/game/src/services/ai/
  ai-client.ts
  ai-enrichment-queue.ts

packages/domain/src/assets.ts
packages/persistence/src/contracts/asset-repository.ts

apps/desktop/
  package.json
  src-tauri/Cargo.toml
  src-tauri/tauri.conf.json
  src-tauri/src/lib.rs
  src-tauri/src/main.rs

packages/persistence/src/sqlite/
  sqlite-save-repository.ts
  sqlite-asset-repository.ts

scripts/
  benchmark-matches.ts
  benchmark-day.ts
  run-long-simulations.ts
  validate-balance.ts

tests/parity/
tests/long-run/
tests/ai/
```

---

### Task 1: Define shared AI contracts and Fact Packets

**Files:**

- Create: `packages/ai-contracts/package.json`
- Create: `packages/ai-contracts/tsconfig.json`
- Create: `packages/ai-contracts/src/world.ts`
- Create: `packages/ai-contracts/src/cards.ts`
- Create: `packages/ai-contracts/src/sets.ts`
- Create: `packages/ai-contracts/src/community.ts`
- Create: `packages/ai-contracts/src/art.ts`
- Create: `packages/ai-contracts/src/fact-packets.ts`
- Create: `packages/ai-contracts/src/index.ts`
- Test: `packages/ai-contracts/src/contracts.test.ts`

**Interfaces:**

- Consumes: Card DSL schemas and relevant Domain IDs.
- Produces: Zod request/response contracts for all five AI capabilities and finite FactPacket structures.

- [x] **Step 1: Write failing contract tests**

Tests must prove:

- Card proposal response contains a legal structured `CardDefinition` draft/proposal and risk metadata.
- Set completion response cannot contain unsupported keyword strings.
- Community request includes only supplied `facts`, `recentMemories`, agent profile and requested stance/topic.
- Community response is `{ topic, stance, sentiment, referencedEntityIds, text }` with sentiment `[-1,1]`.
- Art request carries a stable `assetPurpose` and visual brief, not WorldState.

- [x] **Step 2: Run and verify failure**

```bash
pnpm vitest run packages/ai-contracts
```

- [x] **Step 3: Implement contracts by reusing Card DSL schemas**

Do not duplicate keyword/effect enums as unrelated strings. Import/reuse domain schemas/types so provider validation cannot drift from Rules Engine legality.

- [x] **Step 4: Implement finite Fact Packets**

Example:

```ts
export const communityFactPacketSchema = z.object({
  day: z.number().int().positive(),
  agent: namedAgentPromptProfileSchema,
  knownFacts: z
    .array(
      z.object({
        kind: z.string(),
        entityId: z.string().optional(),
        statement: z.string(),
      }),
    )
    .max(32),
  recentMemories: z.array(z.string()).max(20),
  requestedTopic: z.string(),
  requestedStance: z.string(),
});
```

No hidden WorldState blob is accepted.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run packages/ai-contracts
pnpm typecheck
git add packages/ai-contracts
git commit -m "feat: define schema validated AI contracts"
```

---

### Task 2: Scaffold Hono AI Gateway and deterministic Mock provider

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/providers/types.ts`
- Create: `apps/api/src/providers/mock-provider.ts`
- Create: `apps/api/src/providers/provider-factory.ts`
- Create: `apps/api/src/routes/world.ts`
- Create: `apps/api/src/routes/cards.ts`
- Create: `apps/api/src/routes/sets.ts`
- Create: `apps/api/src/routes/community.ts`
- Create: `apps/api/src/routes/art.ts`
- Create: `apps/api/src/middleware/errors.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Test: `apps/api/src/app.test.ts`
- Modify: root `package.json`

**Interfaces:**

- Consumes: AI contracts.
- Produces: `GenerativeProvider` abstraction, `MockGenerativeProvider`, HTTP endpoints `/v1/world/assist`, `/v1/cards/propose`, `/v1/sets/complete`, `/v1/community/render`, `/v1/art/generate`.

- [x] **Step 1: Define provider interface in a failing test**

Expected shape:

```ts
export interface GenerativeProvider {
  assistWorld(input: WorldAssistRequest): Promise<WorldAssistResponse>;
  proposeCard(input: CardProposalRequest): Promise<CardProposalResponse>;
  completeSet(input: SetCompletionRequest): Promise<SetCompletionResponse>;
  renderCommunityPost(
    input: CommunityRenderRequest,
  ): Promise<CommunityRenderResponse>;
  generateArtwork(input: ArtGenerateRequest): Promise<ArtGenerateResponse>;
}
```

- [x] **Step 2: Add Hono and API test dependencies, run failing route tests**

Each route must return 400 for invalid input and legal deterministic JSON under `AI_MODE=mock`.

- [x] **Step 3: Implement deterministic Mock provider**

Mock output derives from stable request fields and uses fixture legal Card DSL; it must not call `Math.random()` or network APIs. Same request returns byte-equivalent JSON.

- [x] **Step 4: Implement route schema validation**

Pattern:

```ts
const input = cardProposalRequestSchema.parse(await c.req.json());
const output = await provider.proposeCard(input);
return c.json(cardProposalResponseSchema.parse(output));
```

- [x] **Step 5: Add root scripts and verify**

```json
{
  "dev:api": "pnpm --filter @tcgtycoon/api dev",
  "test:ai": "vitest run packages/ai-contracts apps/api"
}
```

Run:

```bash
AI_MODE=mock pnpm test:ai
pnpm typecheck
```

- [x] **Step 6: Commit**

```bash
git add apps/api packages/ai-contracts package.json pnpm-lock.yaml
git commit -m "feat: add mockable AI gateway"
```

---

### Task 3: Implement OpenAI structured-text provider adapter

**Files:**

- Create: `apps/api/src/providers/openai-provider.ts`
- Create: `apps/api/src/prompts/world.ts`
- Create: `apps/api/src/prompts/card.ts`
- Create: `apps/api/src/prompts/set.ts`
- Create: `apps/api/src/prompts/community.ts`
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/providers/provider-factory.ts`
- Modify: `.env.example`
- Test: `apps/api/src/providers/openai-provider.test.ts`

**Interfaces:**

- Consumes: `GenerativeProvider`, AI contracts.
- Produces: `OpenAIGenerativeProvider` using server-side official OpenAI SDK; text operations use the Responses API and strict JSON-schema structured output, then Zod/domain validation.

- [x] **Step 1: Add server-only OpenAI SDK dependency**

```bash
pnpm --filter @tcgtycoon/api add openai
```

The dependency must not appear in `apps/game` or simulation packages.

- [x] **Step 2: Write provider tests against an injected fake OpenAI client**

Do not hit the real network. Assert provider sends:

- configured model,
- task prompt/input,
- strict JSON-schema response format,
- `store: false` for these stateless generation calls,

and rejects output that fails the shared Zod contract.

- [x] **Step 3: Implement injectable OpenAI client adapter**

Use a constructor accepting `OpenAI`-compatible client and config. Text call shape should use the official Responses API pattern:

```ts
const response = await client.responses.create({
  model: config.textModel,
  store: false,
  input: promptMessages,
  text: {
    format: {
      type: "json_schema",
      name: schemaName,
      strict: true,
      schema: jsonSchema,
    },
  },
});

const parsedJson = JSON.parse(response.output_text);
return responseSchema.parse(parsedJson);
```

Keep explicit JSON Schema objects alongside each shared contract for provider strict-output requests; Zod remains the final runtime validator.

- [x] **Step 4: Configure models via environment**

`.env.example`:

```text
AI_MODE=mock
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-1
```

Do not expose these as `VITE_*` variables.

- [x] **Step 5: Implement bounded retry on schema/domain failure**

At most two provider attempts for invalid model output. Retry prompt includes the validation error summary but never relaxes the Card DSL schema. Provider/API errors return typed gateway failures rather than fallback simulation mutations.

- [x] **Step 6: Verify server/client isolation and commit**

```bash
AI_MODE=mock pnpm test:ai
! grep -R "from \"openai\"" apps/game packages/sim-core packages/rules-engine
pnpm typecheck
git add apps/api .env.example pnpm-lock.yaml
git commit -m "feat: add structured OpenAI generation provider"
```

---

### Task 4: Implement artwork provider and AssetRepository boundary

**Files:**

- Create: `packages/domain/src/assets.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/persistence/src/contracts/asset-repository.ts`
- Modify: `packages/persistence/src/index.ts`
- Modify: `apps/api/src/providers/openai-provider.ts`
- Create: `apps/api/src/prompts/art.ts`
- Test: `apps/api/src/providers/openai-art.test.ts`
- Test: `packages/persistence/src/contracts/asset-repository.test.ts`

**Interfaces:**

- Consumes: Art AI contract and provider config.
- Produces: `AssetId`, `AssetMetadata`, `AssetRepository`, artwork response bytes/base64 transfer contract without embedding binary data in WorldState.

- [x] **Step 1: Write AssetRepository contract test**

Interface:

```ts
export interface AssetRepository {
  put(asset: {
    id: AssetId;
    mediaType: string;
    bytes: Uint8Array;
    metadata: AssetMetadata;
  }): Promise<void>;
  get(
    id: AssetId,
  ): Promise<{ bytes: Uint8Array; metadata: AssetMetadata } | null>;
  delete(id: AssetId): Promise<void>;
}
```

- [x] **Step 2: Write artwork-provider fake-client test**

Assert `generateArtwork` returns one image asset payload and uses configured image model. The game domain receives only an AssetId after client persistence.

- [x] **Step 3: Implement OpenAI image-generation adapter**

Use the current official image generation capability behind `OpenAIGenerativeProvider`; isolate API response parsing in this provider. Do not make image generation a prerequisite for Finalize/Release. A failed image call returns a typed error so the client can use faction placeholder art.

- [x] **Step 4: Verify and commit**

```bash
pnpm vitest run apps/api/src/providers/openai-art.test.ts packages/persistence/src/contracts/asset-repository.test.ts
pnpm typecheck
git add packages/domain/src/assets.ts packages/persistence apps/api/src/providers/openai-provider.ts apps/api/src/prompts/art.ts
git commit -m "feat: isolate generated artwork assets"
```

---

### Task 5: Integrate AI creation assistance into Web without making it authoritative

**Files:**

- Create: `apps/game/src/services/ai/ai-client.ts`
- Create: `apps/game/src/services/ai/ai-enrichment-queue.ts`
- Modify: `apps/game/src/features/new-game/NewGameWizard.tsx`
- Modify: `apps/game/src/features/cards/CardStudio.tsx`
- Modify: `apps/game/src/features/expansions/SetReview.tsx`
- Modify: `apps/game/src/features/expansions/ExpansionDetail.tsx`
- Modify: `apps/game/vite.config.ts`
- Test: `apps/game/src/services/ai/ai-client.test.ts`
- Test: `apps/game/src/features/cards/CardStudio.ai.test.tsx`

**Interfaces:**

- Consumes: Gateway endpoints/contracts and existing PublisherCommand flow.
- Produces: optional world/faction suggestions, card proposals and set-completion proposals that require player acceptance before queuing canonical edits.

- [x] **Step 1: Write failing Card Studio AI acceptance test**

Flow:

1. User submits natural-language design intent.
2. Gateway returns legal structured proposal.
3. UI shows proposal/DSL preview.
4. World snapshot remains unchanged.
5. Only clicking Accept queues `UPDATE_CARD_DRAFT`.

- [x] **Step 2: Implement typed `AiClient`**

Every response passes shared contract parse in the browser even though the server already validated it. Network timeout/error returns UI status, never a simulation command.

- [x] **Step 3: Integrate New Game/Set Review**

AI can propose four faction concepts and complete set slots, but offline manual/Mock flow remains available.

- [x] **Step 4: Verify AI-offline fallback**

Run component tests with AiClient rejecting all requests; structured editing and Launch remain usable.

- [x] **Step 5: Commit**

```bash
pnpm --filter @tcgtycoon/game test -- CardStudio.ai ai-client
pnpm build:web
git add apps/game/src/services/ai apps/game/src/features/new-game apps/game/src/features/cards apps/game/src/features/expansions
git commit -m "feat: add optional AI design assistance"
```

---

### Task 6: Render Named Agent community prose after deterministic state commit

**Files:**

- Create: `packages/sim-core/src/society/community-intents.ts`
- Modify: `packages/sim-core/src/day/simulate-day.ts`
- Modify: `packages/sim-core/src/index.ts`
- Modify: `apps/game/src/services/ai/ai-client.ts`
- Modify: `apps/game/src/services/ai/ai-client.test.ts`
- Modify: `apps/game/src/services/ai/ai-enrichment-queue.ts`
- Modify: `apps/game/src/app/game-session/GameSessionController.ts`
- Modify: `apps/game/src/app/game-session/GameSessionController.test.ts`
- Modify: `apps/game/src/features/community/CommunityFeed.tsx`
- Modify: `apps/game/src/selectors/community.ts`
- Modify: `apps/game/src/features/cards/CardStudio.ai.test.tsx`
- Test: `tests/determinism/community-ai-isolation.test.ts`
- Test: `apps/game/src/services/ai/ai-enrichment-queue.test.ts`

**Interfaces:**

- Consumes: deterministic `CommunityPostIntent`, FactPacket builder, AI renderer.
- Produces: stable post intent IDs, template fallback text and optional enriched prose stored as presentation/history enrichment without changing deterministic state hash inputs.

- [x] **Step 1: Write isolation test**

Run identical `simulateDay()` twice. Feed one run two completely different valid rendered text strings for the same intent. Assert the canonical deterministic next-state hash, metrics, prices, players and Meta remain identical.

- [x] **Step 2: Implement deterministic intent generation before commit**

Intent contains author/topic/stance/sentiment/facts/influence and precomputed numerical social impact. `simulateDay` output includes enrichment requests but does not await them.

- [x] **Step 3: Implement template fallback**

Example deterministic fallback:

```text
Mika expressed concern about Grave Loop's current Meta presence.
```

This remains visible if gateway fails.

- [x] **Step 4: Implement enrichment queue**

After successful save/day commit, queue `/v1/community/render` requests and attach prose to presentation history/cache by stable intent ID. Do not dispatch a second simulation action.

- [x] **Step 5: Verify/commit**

```bash
pnpm vitest run tests/determinism/community-ai-isolation.test.ts apps/game/src/services/ai/ai-enrichment-queue.test.ts
pnpm test:scenarios
pnpm typecheck
git add packages/sim-core/src/society packages/sim-core/src/day apps/game/src/services/ai apps/game/src/features/community tests/determinism/community-ai-isolation.test.ts
git commit -m "feat: enrich community narrative after simulation"
```

---

### Task 7: Scaffold Tauri desktop shell using the same game frontend

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Modify: root `package.json`
- Test: `tests/parity/desktop-config.test.ts`

**Interfaces:**

- Consumes: `apps/game` dev server/build output.
- Produces: Tauri desktop wrapper with no duplicate React application.

- [x] **Step 1: Write config parity test**

Parse `tauri.conf.json` and assert desktop `beforeDevCommand`/`beforeBuildCommand` use the shared game app and configured frontend URL/dist path; there is no separate desktop React source tree.

- [x] **Step 2: Initialize Tauri v2 configuration**

Desktop package scripts should conceptually provide:

```json
{
  "dev": "tauri dev",
  "build": "tauri build"
}
```

Root:

```json
{
  "dev:desktop": "pnpm --filter @tcgtycoon/desktop dev",
  "build:desktop": "pnpm --filter @tcgtycoon/desktop build"
}
```

- [x] **Step 3: Run desktop dev/build configuration verification**

At minimum run Tauri config check/build prerequisite command available in the installed toolchain plus root typecheck.

- [x] **Step 4: Commit**

```bash
git add apps/desktop package.json pnpm-lock.yaml tests/parity/desktop-config.test.ts
git commit -m "feat: wrap shared game in Tauri desktop shell"
```

---

### Task 8: Implement SQLite SaveRepository and desktop AssetRepository

**Files:**

- Create: `packages/persistence/src/sqlite/sqlite-save-repository.ts`
- Create: `packages/persistence/src/sqlite/sqlite-asset-repository.ts`
- Modify: `packages/persistence/src/index.ts`
- Modify: `apps/game/src/platform/save-repository.ts`
- Create: `apps/game/src/platform/asset-repository.ts`
- Test: `tests/parity/save-repository-contract.test.ts`
- Test: `tests/parity/web-desktop-save-roundtrip.test.ts`

**Interfaces:**

- Consumes: shared SaveRepository/AssetRepository contracts.
- Produces: SQLite-backed desktop implementations and runtime platform adapter selection.

- [ ] **Step 1: Define one repository contract test suite used by Memory, Dexie and SQLite adapters**

Test list/save/load/delete and autosave/current+previous semantics through the same behavior function.

- [ ] **Step 2: Implement SQLite schema/migrations**

Store save metadata separately from canonical save payload. Assets are stored separately from WorldState. Use database transactions for save replacement and previous-autosave rotation.

- [ ] **Step 3: Implement platform selection without leaking Tauri into game domain**

`apps/game/src/platform/*` chooses browser vs Tauri adapter. Feature components consume repositories through application context/services.

- [ ] **Step 4: Add Web/Desktop round-trip fixture test**

Serialize canonical SaveEnvelope through Dexie-compatible/canonical representation and SQLite representation and assert `migrateSave/load` produces deep-equal canonical state.

- [ ] **Step 5: Verify/commit**

```bash
pnpm vitest run tests/parity
pnpm typecheck
git add packages/persistence apps/game/src/platform tests/parity
git commit -m "feat: persist desktop saves and artwork in SQLite"
```

---

### Task 9: Add cross-platform deterministic parity tests

**Files:**

- Create: `tests/parity/simulation-parity.test.ts`
- Create: `tests/parity/fixture-save.json`
- Modify: `packages/testkit/src/worlds/create-test-world.ts`

**Interfaces:**

- Consumes: canonical fixture save and simulation core.
- Produces: stable parity regression hash used by Web/Desktop builds.

- [ ] **Step 1: Generate a committed canonical fixture from code**

Fixture includes real Cards, Products, Players, Collections, Meta and pending operations but no AI-rendered binary/text cache required for simulation.

- [ ] **Step 2: Run the same command set through browser-compatible and Node/desktop-compatible execution paths**

Assert identical:

- next canonical JSON,
- state hash,
- important match hashes,
- Cash/metrics/market quantities.

- [ ] **Step 3: Verify no wall-clock dependence**

Run parity tests with different mocked system times/timezones; outputs must remain identical.

- [ ] **Step 4: Commit**

```bash
pnpm vitest run tests/parity/simulation-parity.test.ts
pnpm typecheck
git add tests/parity packages/testkit/src/worlds/create-test-world.ts
git commit -m "test: lock web desktop simulation parity"
```

---

### Task 10: Add migration, long-run and economic regression suites

**Files:**

- Create: `tests/long-run/1000-days.test.ts`
- Create: `tests/long-run/3000-days.test.ts`
- Create: `tests/long-run/multi-seed.test.ts`
- Create: `tests/long-run/save-migrations.test.ts`
- Create: `scripts/run-long-simulations.ts`
- Create: `scripts/validate-balance.ts`
- Modify: root `package.json`

**Interfaces:**

- Consumes: Phase 2/3 headless simulator, migrations and Publisher Bot.
- Produces: `pnpm test:long-run` and multi-seed balance smoke runner.

- [ ] **Step 1: Add test scripts**

```json
{
  "test:long-run": "vitest run tests/long-run",
  "sim:many": "tsx scripts/run-long-simulations.ts",
  "balance:validate": "tsx scripts/validate-balance.ts"
}
```

- [ ] **Step 2: Implement 1000/3000-day invariant tests**

Tests assert finite values, valid references, no negative supply, valid day progression and no stuck simulation. Do not assert one exact player count; assert configured sane bounds/trends for prepared scenarios.

- [ ] **Step 3: Implement 100-seed smoke runner**

Summarize distributions for lifespan, max Active Players, ending Cash, number of expansions/bans, top deck dominance and invalid/crashed seeds. Exit nonzero if any invariant/crash occurs.

- [ ] **Step 4: Add migration fixture regression**

Keep at least one committed old-schema SaveEnvelope fixture once schema v2 exists; until then round-trip the current fixture and assert the migration API is invoked.

- [ ] **Step 5: Commit**

```bash
pnpm test:long-run
pnpm sim:many -- --runs 10 --days 1000
pnpm typecheck
git add tests/long-run scripts package.json
git commit -m "test: harden long running world saves"
```

---

### Task 11: Add performance benchmarks and regression reporting

**Files:**

- Create: `scripts/benchmark-matches.ts`
- Create: `scripts/benchmark-day.ts`
- Create: `scripts/benchmark-save.ts`
- Create: `scripts/benchmark.ts`
- Modify: root `package.json`

**Interfaces:**

- Consumes: rules engine, balanced-world fixture, persistence serialization.
- Produces: `pnpm benchmark` JSON/console report for 10k matches, `simulateDay`, canonical save size and load/parse time.

- [ ] **Step 1: Implement benchmark harness without artificial pass thresholds**

Record environment metadata and timings. Initial implementation establishes a baseline rather than guessing arbitrary milliseconds before measurement.

- [ ] **Step 2: Benchmark exactly these workloads**

- 10,000 deterministic simple matches.
- One typical balanced-world live day.
- Canonical save serialized size at Day 100/1000 fixture when available.
- Parse/migration/load time of canonical test save.

- [ ] **Step 3: Add optional baseline comparison**

Persist benchmark JSON artifact in CI, not canonical game state. Later PRs can compare regressions; do not fail on tiny timing noise.

- [ ] **Step 4: Verify/commit**

```bash
pnpm benchmark
pnpm typecheck
git add scripts/benchmark* package.json
git commit -m "chore: benchmark simulation and persistence"
```

---

### Task 12: Final release-candidate verification and CI gate

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `docs/codex/RELEASE_CHECKLIST.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: all MVP phases.
- Produces: reproducible release checks and concise developer/user bootstrap documentation.

- [ ] **Step 1: Expand CI gates**

Normal PR CI:

```text
lint
typecheck
unit/rules tests
scenario tests
AI mock tests
Web build
selected Playwright E2E
```

Long-run/performance may run on main/nightly/manual workflow if too expensive for every PR.

- [ ] **Step 2: Write release checklist**

Checklist must explicitly verify:

- `AI_MODE=mock/offline` End Day works.
- Web and Desktop canonical parity test passes.
- Migration tests pass.
- 1000/3000-day tests pass.
- Booster opens exactly five cards.
- No `Math.random()` in rules/sim packages.
- No provider secret exposed through `VITE_*` or client bundle config.
- Full Web build and Desktop build succeed.

- [ ] **Step 3: Run final MVP gate**

```bash
AI_MODE=mock pnpm lint
AI_MODE=mock pnpm typecheck
AI_MODE=mock pnpm test
AI_MODE=mock pnpm test:scenarios
AI_MODE=mock pnpm test:ai
AI_MODE=mock pnpm test:e2e
AI_MODE=mock pnpm test:long-run
pnpm benchmark
pnpm build:web
pnpm build:desktop
```

Expected: all applicable commands exit 0.

- [ ] **Step 4: Run architecture leak checks**

```bash
! grep -R "Math.random" packages/rules-engine/src packages/sim-core/src
! grep -R -E "from \"openai\"|OPENAI_API_KEY" apps/game packages/rules-engine packages/sim-core
```

Expected: no forbidden matches.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml docs/codex/RELEASE_CHECKLIST.md README.md
git commit -m "chore: add MVP release verification gate"
```

---

## Phase 4 completion review

The project is a release-candidate MVP only when:

1. OpenAI/provider output is schema-validated and never executed as arbitrary rules text.
2. The official AI Gateway can be disabled and all simulation/gameplay continues.
3. Named Agent prose variations cannot alter deterministic state hashes.
4. Web clients contain no provider secret.
5. Generated images are separate assets referenced by ID.
6. Desktop uses the same React game app, Rules Engine and Simulation Core as Web.
7. Dexie and SQLite implement the same SaveRepository semantics.
8. Web/Desktop parity fixtures produce identical simulation hashes.
9. 1000/3000-day suites keep world invariants valid.
10. Release gate builds both Web and Desktop and passes offline/mock-AI E2E.
