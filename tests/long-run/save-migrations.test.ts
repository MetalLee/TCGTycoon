import {
  CURRENT_SCHEMA_VERSION,
  canonicalStringify,
  migrateSave,
} from "../../packages/persistence/src/index";
import { validateWorldInvariants } from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

const committedV1SaveFixture = {
  saveId: "save-long-run-v1",
  schemaVersion: 1,
  simulationVersion: "1",
  ruleVersion: "1",
  balanceVersion: "1",
  appVersion: "0.1.0",
  worldSeed: "long-run-migration",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  state: {
    schemaVersion: 1,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "long-run-migration",
    day: 0,
    status: "SETUP",
    cards: {},
    printings: {},
    expansions: {},
    products: {},
    printRuns: {},
    players: {},
    agents: {},
    decks: {},
    cohorts: [],
    market: { listings: [] },
    meta: { deckStats: {} },
    metrics: { activePlayers: 0 },
    cash: { balance: 100_000, ledger: [] },
    history: { events: [] },
  },
} as const;

describe("long-run save migration regression", () => {
  it("migrates the committed old-schema envelope and stays idempotent", () => {
    const migrated = migrateSave(structuredClone(committedV1SaveFixture));
    const roundTripped = migrateSave(JSON.parse(canonicalStringify(migrated)));

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.worldSeed).toBe(committedV1SaveFixture.worldSeed);
    expect(canonicalStringify(roundTripped)).toBe(canonicalStringify(migrated));
    validateWorldInvariants(roundTripped.state);
  });
});
