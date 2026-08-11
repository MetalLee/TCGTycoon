import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, migrateSave } from "../index";

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
  it("migrates a structurally valid v1 save to the current schema", () => {
    const migrated = migrateSave(v1Fixture);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
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

  it("migrates v2 production data to paid-production schema defaults", () => {
    const v2Fixture = {
      ...v1Fixture,
      schemaVersion: 2,
      state: {
        ...v1Fixture.state,
        schemaVersion: 2,
        cards: {
          "card-launch": {
            id: "card-launch",
            name: "Launch Card",
            type: "UNIT",
            factionId: "fire",
            rarity: "COMMON",
            cost: 1,
            attack: 1,
            health: 1,
            keywords: [],
            triggers: [],
          },
        },
        printings: {
          "printing-launch-normal": {
            id: "printing-launch-normal",
            cardId: "card-launch",
            expansionId: "set-launch",
          },
        },
        expansions: {
          "set-launch": { id: "set-launch", name: "Launch Set" },
        },
        products: {
          "product-launch": {
            id: "product-launch",
            expansionId: "set-launch",
            name: "Launch Booster",
            kind: "BOOSTER",
            msrp: 5,
          },
        },
        printRuns: {
          "print-run-launch": {
            id: "print-run-launch",
            productId: "product-launch",
            quantity: 100,
            completionDay: 7,
          },
        },
        market: { listings: [], snapshots: {} },
        meta: { deckStats: {}, matchups: {} },
        metrics: {
          activePlayers: 0,
          previousActivePlayers: 0,
          hype: 50,
          collectorHeat: 50,
          metaHealth: 50,
          brandTrust: 50,
          sentiment: 50,
          accessibility: 50,
          lifecycle: {
            potential: 0,
            interested: 0,
            newByAge: [0, 0, 0, 0, 0, 0, 0],
            active: 0,
            atRisk: 0,
            churned: 0,
            returning: 0,
          },
          lifecycleDeltas: {
            potentialToInterested: 0,
            interestedToNew: 0,
            newToActive: 0,
            activeToAtRisk: 0,
            atRiskToChurned: 0,
            churnedToReturning: 0,
            returningToActive: 0,
          },
          acquisitionToChurnRatio: 1,
          retentionRate: 1,
          activePlayerTrend: 0,
          consecutiveDeclineDays: 0,
          consecutiveLowActivityDays: 0,
          ecosystemRisk: "STABLE",
        },
      },
    };

    const migrated = migrateSave(v2Fixture);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.products["product-launch"]!.cardIds).toEqual([
      "card-launch",
    ]);
    expect(migrated.state.products["product-launch"]).toMatchObject({
      releaseStatus: "LIVE",
      internalReleaseDay: 0,
      releasedDay: 0,
    });
    expect(migrated.state.printings["printing-launch-normal"]).toMatchObject({
      edition: "FIRST_EDITION",
      sourceProductId: "product-launch",
      sourceExpansionId: "set-launch",
    });
    expect(migrated.state.printRuns["print-run-launch"]).toMatchObject({
      sourceExpansionId: "set-launch",
      productKind: "BOOSTER",
      cardIds: ["card-launch"],
      status: "PRINTING",
      orderedQuantity: 100,
      quantity: 0,
      orderedDay: 0,
      unitCost: 0,
      totalCost: 0,
      printingIds: [],
    });

    const migratedCompletedRuns = migrateSave({
      ...v2Fixture,
      state: {
        ...v2Fixture.state,
        day: 10,
        printRuns: {
          ...v2Fixture.state.printRuns,
          "print-run-launch-later": {
            id: "print-run-launch-later",
            productId: "product-launch",
            quantity: 50,
            completionDay: 8,
          },
        },
      },
    });
    const firstRun = migratedCompletedRuns.state.printRuns["print-run-launch"]!;
    const laterRun =
      migratedCompletedRuns.state.printRuns["print-run-launch-later"]!;

    expect(firstRun.edition).toBe("FIRST_EDITION");
    expect(laterRun.edition).toBe("UNLIMITED");
    expect(laterRun.printingIds).not.toEqual(firstRun.printingIds);
    expect(
      laterRun.printingIds.map(
        (id) => migratedCompletedRuns.state.printings[id]!.edition,
      ),
    ).toEqual(["UNLIMITED"]);
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
