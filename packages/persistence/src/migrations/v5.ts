import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import type { SaveEnvelopeV4 } from "./v4";
import { worldStateV5Schema } from "./world-state-schemas";

export const saveEnvelopeV5Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(5),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV5Schema,
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

export function migrateV4ToV5(save: SaveEnvelopeV4): SaveEnvelope {
  const printRuns = Object.fromEntries(
    Object.entries(save.state.printRuns).map(([id, run]) => {
      const product = save.state.products[run.productId];
      if (product === undefined) {
        throw new Error(`Cannot migrate Print Run ${id} without its Product`);
      }
      return [
        id,
        {
          ...run,
          sourceExpansionId: product.expansionId,
          productKind: product.kind,
          cardIds: [...product.cardIds],
        },
      ];
    }),
  );

  return parseSaveEnvelopeV5({
    ...save,
    schemaVersion: 5,
    state: {
      ...save.state,
      schemaVersion: 5,
      printRuns,
    },
  });
}

export function parseSaveEnvelopeV5(input: unknown): SaveEnvelope {
  return saveEnvelopeV5Schema.parse(input) as SaveEnvelope;
}
