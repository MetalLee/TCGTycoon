import { z } from "zod";
import type { SaveEnvelopeV1 } from "./v1";
import { worldStateV2Schema } from "./world-state-schemas";

export const saveEnvelopeV2Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(2),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV2Schema,
  })
  .strict()
  .superRefine((save, context) => {
    for (const key of [
      "simulationVersion",
      "ruleVersion",
      "balanceVersion",
      "worldSeed",
    ] as const) {
      if (save[key] !== save.state[key]) {
        context.addIssue({
          code: "custom",
          path: ["state", key],
          message: `Envelope ${key} must match state ${key}.`,
        });
      }
    }
  });

export type SaveEnvelopeV2 = z.infer<typeof saveEnvelopeV2Schema>;

function confidenceForSamples(samples: number) {
  return samples >= 200
    ? "HIGH"
    : samples >= 50
      ? "MEDIUM"
      : samples >= 10
        ? "LOW"
        : "VERY_LOW";
}

export function migrateV1ToV2(save: SaveEnvelopeV1): SaveEnvelopeV2 {
  const activePlayers = save.state.metrics.activePlayers;
  const deckStats = Object.fromEntries(
    Object.entries(save.state.meta.deckStats).map(([id, stats]) => [
      id,
      {
        ...stats,
        observedWinRate: stats.matches === 0 ? 0 : stats.wins / stats.matches,
        usageRate: 0,
        averageGameLength: 0,
        sampleCount: stats.matches,
        confidence: confidenceForSamples(stats.matches),
      },
    ]),
  );

  return parseSaveEnvelopeV2({
    ...save,
    schemaVersion: 2,
    state: {
      ...save.state,
      schemaVersion: 2,
      market: { ...save.state.market, snapshots: {} },
      meta: { deckStats, matchups: {} },
      metrics: {
        activePlayers,
        previousActivePlayers: activePlayers,
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
          active: activePlayers,
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
  });
}

export function parseSaveEnvelopeV2(input: unknown): SaveEnvelopeV2 {
  return saveEnvelopeV2Schema.parse(input);
}
