import {
  updateWorldMetrics,
  type WorldMetricSignals,
  type WorldMetricState,
} from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

describe("negative attention", () => {
  it("negative controversy can raise Hype while lowering sentiment", () => {
    const current: WorldMetricState = {
      hype: 40,
      collectorHeat: 50,
      metaHealth: 60,
      brandTrust: 60,
      sentiment: 60,
    };
    const controversy: WorldMetricSignals = {
      positiveAttention: 0,
      negativeAttention: 0.9,
      sentimentTarget: 15,
      collector: {
        tradingVolume: 0.5,
        liquidity: 0.5,
        priceMomentum: 0.5,
        scarcityExcitement: 0.5,
        productFreshness: 0.5,
        collectorConfidence: 0.5,
      },
      metaHealthTarget: 45,
      brandTrustTarget: 30,
    };

    const next = updateWorldMetrics(current, controversy);

    expect(next.hype).toBeGreaterThan(current.hype);
    expect(next.sentiment).toBeLessThan(current.sentiment);
    expect(next.brandTrust).toBeLessThan(current.brandTrust);
  });
});
