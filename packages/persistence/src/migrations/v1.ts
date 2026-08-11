import { z } from "zod";
import { worldStateV1Schema } from "./world-state-schemas";

export const saveEnvelopeV1Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(1),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV1Schema,
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

export type SaveEnvelopeV1 = z.infer<typeof saveEnvelopeV1Schema>;

export function parseSaveEnvelopeV1(input: unknown): SaveEnvelopeV1 {
  return saveEnvelopeV1Schema.parse(input);
}
