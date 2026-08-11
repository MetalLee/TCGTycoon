import { describe, expect, it } from "vitest";
import { migrateSave } from "../index";

const v1Fixture = {
  saveId: "save-launch",
  schemaVersion: 1,
  simulationVersion: "1",
  ruleVersion: "1",
  balanceVersion: "1",
  appVersion: "0.1.0",
  worldSeed: "launch-seed",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  state: {
    schemaVersion: 1,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "launch-seed",
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
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  },
};

describe("migrateSave", () => {
  it("migrates a structurally valid v1 save to schema v2", () => {
    const migrated = migrateSave(v1Fixture);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.state.schemaVersion).toBe(2);
    expect(migrated.state.metrics).toEqual(
      expect.objectContaining({
        activePlayers: 0,
        hype: expect.any(Number),
        lifecycle: expect.any(Object),
      }),
    );
    expect(migrated.state.market).toEqual(
      expect.objectContaining({ snapshots: {} }),
    );
  });

  it.each([
    { ...v1Fixture, state: undefined },
    (() => {
      const saveWithoutState = { ...v1Fixture };
      Reflect.deleteProperty(saveWithoutState, "state");
      return saveWithoutState;
    })(),
  ])("rejects a v1 fixture without a defined state", (invalidSave) => {
    expect(() => migrateSave(invalidSave)).toThrow();
  });

  it.each([
    { ...v1Fixture, state: null },
    { ...v1Fixture, state: { schemaVersion: 1, day: 0 } },
    {
      ...v1Fixture,
      state: { ...v1Fixture.state, worldSeed: "different-seed" },
    },
    {
      ...v1Fixture,
      state: {
        ...v1Fixture.state,
        cash: { balance: Number.POSITIVE_INFINITY, ledger: [] },
      },
    },
    {
      ...v1Fixture,
      state: {
        ...v1Fixture.state,
        market: {
          listings: [
            {
              ownerId: "missing-player",
              printingId: "missing-printing",
              quantity: 1,
              price: 1,
            },
          ],
        },
      },
    },
  ])("rejects a malformed or inconsistent WorldState", (invalidSave) => {
    expect(() => migrateSave(invalidSave)).toThrow();
  });
});
