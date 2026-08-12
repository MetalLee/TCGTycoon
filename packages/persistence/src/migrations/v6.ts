import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import type { SaveEnvelopeV5 } from "./v5";
import { worldStateV6Schema } from "./world-state-schemas";

export const saveEnvelopeV6Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(6),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV6Schema,
  })
  .strict()
  .superRefine((save, context) => {
    for (const key of [
      "simulationVersion",
      "ruleVersion",
      "balanceVersion",
      "worldSeed",
    ] as const) {
      if (save[key] !== save.state[key])
        context.addIssue({
          code: "custom",
          path: ["state", key],
          message: `Envelope ${key} must match state ${key}.`,
        });
    }
  });

export function migrateV5ToV6(save: SaveEnvelopeV5): SaveEnvelope {
  return parseSaveEnvelopeV6({
    ...save,
    schemaVersion: 6,
    state: {
      ...save.state,
      schemaVersion: 6,
      operations: {},
      expansionProjects: {},
    },
  });
}

export function parseSaveEnvelopeV6(input: unknown): SaveEnvelope {
  return saveEnvelopeV6Schema.parse(input) as unknown as SaveEnvelope;
}
