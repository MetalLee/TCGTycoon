import type { ReleaseConfig } from "@tcgtycoon/balance";
import {
  cardId,
  expansionId,
  factionId,
  printingId,
  printRunId,
  productId,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import {
  announceRelease,
  executeReleasesDueToday,
  rescheduleRelease,
} from "./releases";

const releaseExpansionId = expansionId("set-release-test");
const releaseProductId = productId("product-release-test");
const releaseCardId = cardId("card-release-test");
const releasePrintingId = printingId("printing-release-test-normal");
const releaseRunId = printRunId("print-run-release-test");

const releaseConfig: ReleaseConfig = {
  shortSupplyThreshold: 10,
};

function createReleaseWorld(inventory = 0): WorldState {
  return {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: "release-test",
    day: 5,
    status: "LIVE",
    cards: {
      [releaseCardId]: {
        id: releaseCardId,
        name: "Release Card",
        type: "UNIT",
        factionId: factionId("fire"),
        rarity: "COMMON",
        cost: 1,
        attack: 1,
        health: 1,
        keywords: [],
        triggers: [],
      },
    },
    printings: {
      [releasePrintingId]: {
        id: releasePrintingId,
        cardId: releaseCardId,
        expansionId: releaseExpansionId,
        edition: "FIRST_EDITION",
        sourceProductId: releaseProductId,
        sourceExpansionId: releaseExpansionId,
      },
    },
    expansions: {
      [releaseExpansionId]: {
        id: releaseExpansionId,
        name: "Release Test Set",
      },
    },
    products: {
      [releaseProductId]: {
        id: releaseProductId,
        expansionId: releaseExpansionId,
        name: "Release Test Booster",
        kind: "BOOSTER",
        msrp: 5,
        cardIds: [releaseCardId],
        releaseStatus: "UNANNOUNCED",
        internalReleaseDay: 5,
      },
    },
    printRuns:
      inventory === 0
        ? {}
        : {
            [releaseRunId]: {
              id: releaseRunId,
              productId: releaseProductId,
              sourceExpansionId: releaseExpansionId,
              productKind: "BOOSTER",
              cardIds: [releaseCardId],
              orderedQuantity: inventory,
              quantity: inventory,
              orderedDay: 1,
              completionDay: 4,
              unitCost: 1,
              totalCost: inventory,
              status: "COMPLETED",
              edition: "FIRST_EDITION",
              printingIds: [releasePrintingId],
            },
          },
    players: {},
    agents: {},
    decks: {},
    cohorts: [],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 0,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 1_000, ledger: [] },
    history: { events: [] },
  };
}

describe("physical product releases", () => {
  it("cannot execute a release with zero completed sellable inventory", () => {
    const world = createReleaseWorld();
    announceRelease(world, releaseProductId, 5);

    const events = executeReleasesDueToday(world, releaseConfig);

    expect(world.products[releaseProductId]!.releaseStatus).toBe("DELAYED");
    expect(world.products[releaseProductId]!.releasedDay).toBeUndefined();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "RELEASE_DELAY",
        context: expect.objectContaining({
          productId: releaseProductId,
          reason: "ZERO_INVENTORY",
          publicCommitment: true,
        }),
      }),
    );
  });

  it("can launch with low nonzero inventory and emits SHORT_SUPPLY_LAUNCH", () => {
    const world = createReleaseWorld(2);
    announceRelease(world, releaseProductId, 5);

    const events = executeReleasesDueToday(world, releaseConfig);

    expect(world.products[releaseProductId]).toMatchObject({
      releaseStatus: "LIVE",
      releasedDay: 5,
    });
    expect(events.map((event) => event.type)).toEqual([
      "PRODUCT_RELEASED",
      "SHORT_SUPPLY_LAUNCH",
    ]);
    expect(events[1]!.context).toMatchObject({
      productId: releaseProductId,
      availableInventory: 2,
      shortSupplyThreshold: 10,
    });
  });

  it("rescheduling a publicly announced date emits RELEASE_DELAY", () => {
    const world = createReleaseWorld();
    announceRelease(world, releaseProductId, 7);
    const trustBefore = world.metrics.brandTrust;

    const events = rescheduleRelease(world, releaseProductId, 9);

    expect(world.products[releaseProductId]).toMatchObject({
      releaseStatus: "DELAYED",
      announcedReleaseDay: 9,
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "RELEASE_DELAY",
        context: expect.objectContaining({
          previousReleaseDay: 7,
          newReleaseDay: 9,
          publicCommitment: true,
          trustSignal: "NEGATIVE",
        }),
      }),
    );
    expect(world.metrics.brandTrust).toBe(trustBefore);
  });

  it("does not let ANNOUNCE_RELEASE overwrite an existing public date", () => {
    const world = createReleaseWorld();
    announceRelease(world, releaseProductId, 7);

    expect(() => announceRelease(world, releaseProductId, 9)).toThrow(
      /already announced/i,
    );
    expect(world.products[releaseProductId]!.announcedReleaseDay).toBe(7);
  });

  it("treats an unchanged public date as a no-op", () => {
    const world = createReleaseWorld();
    announceRelease(world, releaseProductId, 7);

    const events = rescheduleRelease(world, releaseProductId, 7);

    expect(events).toEqual([]);
    expect(world.products[releaseProductId]).toMatchObject({
      releaseStatus: "ANNOUNCED",
      announcedReleaseDay: 7,
    });
  });

  it("moves an announced date earlier without recording a delay", () => {
    const world = createReleaseWorld();
    announceRelease(world, releaseProductId, 7);

    const events = rescheduleRelease(world, releaseProductId, 6);

    expect(events.map((event) => event.type)).not.toContain("RELEASE_DELAY");
    expect(world.products[releaseProductId]).toMatchObject({
      releaseStatus: "ANNOUNCED",
      announcedReleaseDay: 6,
    });
  });

  it("rescheduling an unannounced internal target does not emit public trust penalty context", () => {
    const world = createReleaseWorld();
    const trustBefore = world.metrics.brandTrust;

    const events = rescheduleRelease(world, releaseProductId, 8);

    expect(world.products[releaseProductId]).toMatchObject({
      releaseStatus: "UNANNOUNCED",
      internalReleaseDay: 8,
    });
    expect(events).toEqual([]);
    expect(world.history.events).toEqual([]);
    expect(world.metrics.brandTrust).toBe(trustBefore);
  });
});
