import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import type { SaveEnvelopeV3 } from "./v3";
import { worldStateV4Schema } from "./world-state-schemas";

export const saveEnvelopeV4Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(4),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV4Schema,
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

export function migrateV3ToV4(save: SaveEnvelopeV3): SaveEnvelope {
  const products = Object.fromEntries(
    Object.entries(save.state.products).map(([id, product]) => [
      id,
      {
        ...product,
        releaseStatus: "LIVE" as const,
        internalReleaseDay: 0,
        releasedDay: 0,
      },
    ]),
  );

  return parseSaveEnvelopeV4({
    ...save,
    schemaVersion: 4,
    state: {
      ...save.state,
      schemaVersion: 4,
      products,
    },
  });
}

export function parseSaveEnvelopeV4(input: unknown): SaveEnvelope {
  return saveEnvelopeV4Schema.parse(input) as SaveEnvelope;
}
