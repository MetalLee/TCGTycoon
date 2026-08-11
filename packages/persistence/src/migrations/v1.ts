import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
export const saveEnvelopeV1Schema=z.object({saveId:z.string(),schemaVersion:z.literal(1),simulationVersion:z.string(),ruleVersion:z.string(),balanceVersion:z.string(),appVersion:z.string(),worldSeed:z.string(),createdAt:z.string(),updatedAt:z.string(),state:z.unknown().refine(value=>value!==undefined)});
export const parseSaveEnvelopeV1=(input:unknown):SaveEnvelope=>saveEnvelopeV1Schema.parse(input) as SaveEnvelope;
