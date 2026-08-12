import { createTestWorld } from "../../../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";
import { selectDashboardView } from "./dashboard";

describe("selectDashboardView", () => {
  it("selects health facts, conservative runway, and ranked current drivers without mutation", () => {
    const world = createTestWorld("dashboard-selector");
    world.day = 10;
    world.status = "LIVE";
    world.metrics.activePlayers = 1_250;
    world.metrics.previousActivePlayers = 1_136;
    world.metrics.activePlayerTrend = 0.1;
    world.metrics.hype = 70;
    world.metrics.collectorHeat = 65;
    world.metrics.metaHealth = 20;
    world.metrics.brandTrust = 85;
    world.metrics.sentiment = 35;
    world.metrics.accessibility = 40;
    world.metrics.acquisitionToChurnRatio = 1.4;
    world.metrics.retentionRate = 0.65;
    world.cash.balance = 12_000;
    world.cash.ledger = Array.from({ length: 7 }, (_, index) => ({
      day: index + 4,
      category: "OPERATING_COST" as const,
      amount: -1_000,
    }));
    const before = structuredClone(world);

    const selected = selectDashboardView(world);

    expect(selected.healthOverview).toEqual({
      activePlayers: {
        label: "Active Players",
        value: 1_250,
        semantic: "FACT",
      },
      hype: { label: "Hype", value: 70, semantic: "FACT" },
      collectorHeat: {
        label: "Collector Heat",
        value: 65,
        semantic: "FACT",
      },
      metaHealth: {
        label: "Meta Health",
        value: 20,
        semantic: "FACT",
      },
      brandTrust: {
        label: "Brand Trust",
        value: 85,
        semantic: "FACT",
      },
      cash: { label: "Cash", value: 12_000, semantic: "FACT" },
    });
    expect(selected.conservativeRunway).toEqual({
      label: "Conservative Cash Runway",
      value: 12,
      unit: "days",
      semantic: "ESTIMATE",
      basis: "7-day average recorded cash outflow",
    });
    expect(selected.currentDrivers.positive).toEqual([
      { key: "brandTrust", label: "Brand Trust", impact: 35 },
      { key: "hype", label: "Hype", impact: 20 },
      { key: "collectorHeat", label: "Collector Heat", impact: 15 },
    ]);
    expect(selected.currentDrivers.negative).toEqual([
      { key: "metaHealth", label: "Meta Health", impact: -30 },
      { key: "sentiment", label: "Sentiment", impact: -15 },
      { key: "accessibility", label: "Accessibility", impact: -10 },
    ]);
    expect(world).toEqual(before);
  });
});
