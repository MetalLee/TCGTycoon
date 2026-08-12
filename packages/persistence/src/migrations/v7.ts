import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import type { SaveEnvelope as SaveEnvelopeV6 } from "@tcgtycoon/domain";
import { worldStateV7Schema } from "./world-state-schemas";

export const saveEnvelopeV7Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(7),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV7Schema,
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

export function migrateV6ToV7(save: SaveEnvelopeV6): SaveEnvelope {
  return parseSaveEnvelopeV7({
    ...save,
    schemaVersion: 7,
    state: {
      ...save.state,
      schemaVersion: 7,
      operationEvidence: save.state.operationEvidence ?? {
        playtests: { runs: {}, reports: {} },
        tournamentAttention: [],
      },
      announcementState: save.state.announcementState ?? { announcements: [] },
      dailyReports: save.state.dailyReports ?? {},
    },
  });
}

export function parseSaveEnvelopeV7(input: unknown): SaveEnvelope {
  return saveEnvelopeV7Schema.parse(input) as unknown as SaveEnvelope;
}
