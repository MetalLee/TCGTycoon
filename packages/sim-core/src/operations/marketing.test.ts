import { MARKETING_CONFIG } from "@tcgtycoon/balance";
import {
  ANNOUNCEMENT_TOPICS,
  CAMPAIGN_TYPES,
  expansionId,
  operationId,
  productId,
  type CampaignType,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import {
  COMMITMENT_TYPES,
  createAnnouncementState,
  evaluateCommitments,
  publishOfficialAnnouncement,
} from "./announcements";
import { advanceCampaignExposure, scheduleCampaign } from "./marketing";

function createMarketingWorld(seed = "marketing-unit"): WorldState {
  return {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: seed,
    day: 1,
    status: "LIVE",
    operations: {},
    cards: {},
    printings: {},
    expansions: {
      "set-launch": {
        id: expansionId("set-launch"),
        name: "Launch Set",
      },
    },
    products: {},
    printRuns: {},
    players: {},
    agents: {},
    decks: {},
    cohorts: [
      { id: "cohort-new", count: 600 },
      { id: "cohort-competitive", count: 300 },
      { id: "cohort-collector", count: 100 },
    ],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 1_000,
      interested: 200,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 100,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 100_000, ledger: [] },
    history: { events: [] },
  };
}

describe("marketing campaigns", () => {
  it("supports all five campaign types and only 3, 7 or 14 day durations", () => {
    expect(MARKETING_CONFIG.durationDays).toEqual([3, 7, 14]);
    expect(Object.keys(MARKETING_CONFIG.campaigns).sort()).toEqual(
      [...CAMPAIGN_TYPES].sort(),
    );
  });

  it.each(CAMPAIGN_TYPES)(
    "%s produces its relevant daily exposure without directly changing Active Players or Hype",
    (campaignType: CampaignType) => {
      const world = createMarketingWorld(`marketing-${campaignType}`);
      const activeBefore = world.metrics.activePlayers;
      const lifecycleActiveBefore = world.metrics.lifecycle.active;
      const hypeBefore = world.metrics.hype;
      scheduleCampaign(world, {
        id: operationId(`campaign-${campaignType}`),
        campaignType,
        durationDays: 3,
        createdDay: 0,
        startDay: 1,
      });

      const dayOne = advanceCampaignExposure(world, 1);
      const dayTwo = advanceCampaignExposure(world, 2);
      const dayThree = advanceCampaignExposure(world, 3);
      const afterCompletion = advanceCampaignExposure(world, 4);

      expect(dayOne).toEqual([
        expect.objectContaining({
          campaignType,
          audience: MARKETING_CONFIG.campaigns[campaignType].audience,
          exposureCount: expect.any(Number),
        }),
      ]);
      expect(dayOne[0]!.exposureCount).toBeGreaterThan(0);
      expect(dayTwo).toHaveLength(1);
      expect(dayThree).toHaveLength(1);
      expect(afterCompletion).toEqual([]);
      expect(world.metrics.activePlayers).toBe(activeBefore);
      expect(world.metrics.lifecycle.active).toBe(lifecycleActiveBefore);
      expect(world.metrics.hype).toBe(hypeBefore);
    },
  );
});

describe("official announcements", () => {
  it("supports the approved topics and finite commitment types", () => {
    expect(ANNOUNCEMENT_TOPICS).toEqual([
      "EXPANSION",
      "BALANCE",
      "REPRINT",
      "TOURNAMENT",
      "DEVELOPMENT",
      "APOLOGY_RESPONSE",
    ]);
    expect(COMMITMENT_TYPES).toEqual([
      "RELEASE_PRODUCT",
      "COMPLETE_REPRINT",
      "ENACT_POLICY",
      "RUN_TOURNAMENT",
      "FINALIZE_EXPANSION",
    ]);
  });

  it("treats prose as presentation data and decays repeated low-impact attention without granting free Hype", () => {
    const world = createMarketingWorld("announcement-saturation");
    const hypeBefore = world.metrics.hype;
    const trustBefore = world.metrics.brandTrust;
    const state = createAnnouncementState();
    const first = publishOfficialAnnouncement(world, state, {
      id: "announcement-development-1",
      day: 1,
      topic: "DEVELOPMENT",
      text: "Short update.",
      boundAction: {
        type: "DEVELOPMENT_UPDATE",
        subjectId: "set-launch",
      },
    });
    const second = publishOfficialAnnouncement(world, state, {
      id: "announcement-development-2",
      day: 2,
      topic: "DEVELOPMENT",
      text: "A very long and persuasive update that changes no simulation fact.",
      boundAction: {
        type: "DEVELOPMENT_UPDATE",
        subjectId: "set-launch",
      },
    });
    const comparisonWorld = createMarketingWorld("announcement-comparison");
    const comparison = publishOfficialAnnouncement(
      comparisonWorld,
      createAnnouncementState(),
      {
        id: "announcement-development-comparison",
        day: 1,
        topic: "DEVELOPMENT",
        text: "Completely different prose.",
        boundAction: {
          type: "DEVELOPMENT_UPDATE",
          subjectId: "set-launch",
        },
      },
    );

    expect(comparison.attention).toBe(first.attention);
    expect(second.attention).toBeLessThan(first.attention);
    expect(world.metrics.hype).toBe(hypeBefore);
    expect(world.metrics.brandTrust).toBe(trustBefore);
    expect(world.history.events.at(-1)).toMatchObject({
      type: "OFFICIAL_ANNOUNCEMENT",
      context: { trustSignal: "NONE" },
    });
  });

  it("emits fulfillment and breach events from structured commitments without trusting the prose", () => {
    const world = createMarketingWorld("announcement-commitments");
    const state = createAnnouncementState();
    const promisedProductId = productId("product-promised");
    publishOfficialAnnouncement(world, state, {
      id: "announcement-release-promise",
      day: 1,
      topic: "EXPANSION",
      text: "We absolutely promise this will be ready.",
      boundAction: {
        type: "EXPANSION_RELEASE",
        subjectId: promisedProductId,
      },
      commitment: {
        id: "commitment-release",
        type: "RELEASE_PRODUCT",
        subjectId: promisedProductId,
        dueDay: 5,
      },
    });
    publishOfficialAnnouncement(world, state, {
      id: "announcement-reprint-promise",
      day: 1,
      topic: "REPRINT",
      text: "Reprint soon.",
      boundAction: {
        type: "REPRINT_PLAN",
        subjectId: "product-missed-reprint",
      },
      commitment: {
        id: "commitment-reprint",
        type: "COMPLETE_REPRINT",
        subjectId: "product-missed-reprint",
        dueDay: 5,
      },
    });
    const trustBefore = world.metrics.brandTrust;
    const outcomes = evaluateCommitments(
      state,
      [
        ...world.history.events,
        {
          id: "event-product-released-before-promise",
          day: 0,
          type: "PRODUCT_RELEASED",
          context: { productId: promisedProductId },
        },
        {
          id: "event-product-released",
          day: 5,
          type: "PRODUCT_RELEASED",
          context: { productId: promisedProductId },
        },
      ],
      6,
    );

    expect(outcomes).toEqual([
      expect.objectContaining({
        day: 5,
        type: "COMMITMENT_FULFILLED",
        context: expect.objectContaining({ trustSignal: "POSITIVE" }),
      }),
      expect.objectContaining({
        type: "COMMITMENT_BREACHED",
        context: expect.objectContaining({ trustSignal: "NEGATIVE" }),
      }),
    ]);
    expect(state.announcements[0]!.commitment?.status).toBe("FULFILLED");
    expect(state.announcements[1]!.commitment?.status).toBe("BREACHED");
    expect(world.metrics.brandTrust).toBe(trustBefore);
  });
});
