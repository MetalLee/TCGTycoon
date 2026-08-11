import { PRODUCT_LIFECYCLE_CONFIG } from "@tcgtycoon/balance";
import { describe, expect, it } from "vitest";
import {
  calculateProductFatigue,
  calculateSetFreshness,
} from "./product-lifecycle";

describe("set freshness", () => {
  it("is maximal on release day", () => {
    expect(
      calculateSetFreshness(
        { currentDay: 30, releaseDay: 30, marketingAttention: 0 },
        PRODUCT_LIFECYCLE_CONFIG,
      ),
    ).toBe(PRODUCT_LIFECYCLE_CONFIG.freshness.launchValue);
  });

  it("decays as the set ages", () => {
    const releaseDay = 10;
    const launch = calculateSetFreshness(
      { currentDay: releaseDay, releaseDay },
      PRODUCT_LIFECYCLE_CONFIG,
    );
    const monthOld = calculateSetFreshness(
      { currentDay: releaseDay + 30, releaseDay },
      PRODUCT_LIFECYCLE_CONFIG,
    );
    const quarterOld = calculateSetFreshness(
      { currentDay: releaseDay + 90, releaseDay },
      PRODUCT_LIFECYCLE_CONFIG,
    );

    expect(monthOld).toBeLessThan(launch);
    expect(quarterOld).toBeLessThan(monthOld);
    expect(quarterOld).toBeGreaterThanOrEqual(
      PRODUCT_LIFECYCLE_CONFIG.freshness.floorValue,
    );
  });

  it("allows attention to lift an old product without restoring launch freshness", () => {
    const oldWithoutAttention = calculateSetFreshness(
      { currentDay: 180, releaseDay: 0, marketingAttention: 0 },
      PRODUCT_LIFECYCLE_CONFIG,
    );
    const oldWithMaximumAttention = calculateSetFreshness(
      { currentDay: 180, releaseDay: 0, marketingAttention: 1 },
      PRODUCT_LIFECYCLE_CONFIG,
    );

    expect(oldWithMaximumAttention).toBeGreaterThan(oldWithoutAttention);
    expect(oldWithMaximumAttention).toBeLessThan(
      PRODUCT_LIFECYCLE_CONFIG.freshness.launchValue,
    );
  });
});

describe("product fatigue", () => {
  it("rises with rapid release frequency and recent spend pressure without mutating inputs", () => {
    const moderateInput = {
      currentDay: 180,
      releaseDays: [0, 45, 90, 135, 180],
      recentSpend: 50,
      spendingCapacity: 150,
    };
    const rapidInput = {
      currentDay: 180,
      releaseDays: [120, 135, 150, 165, 180],
      recentSpend: 125,
      spendingCapacity: 225,
    };
    const before = structuredClone(rapidInput);

    const moderate = calculateProductFatigue(
      moderateInput,
      PRODUCT_LIFECYCLE_CONFIG,
    );
    const rapid = calculateProductFatigue(rapidInput, PRODUCT_LIFECYCLE_CONFIG);

    expect(rapid).toBeGreaterThan(moderate);
    expect(rapid).toBeLessThanOrEqual(PRODUCT_LIFECYCLE_CONFIG.fatigue.maximum);
    expect(rapidInput).toEqual(before);
  });
});
