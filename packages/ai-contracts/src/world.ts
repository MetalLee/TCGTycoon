import { factionId } from "@tcgtycoon/domain";
import { z } from "zod";

const factionIdSchema = z.string().min(1).transform(factionId);

export const worldAssistRequestSchema = z
  .object({
    gameName: z.string().min(1).max(120),
    settingPrompt: z.string().min(1).max(2_000),
    visualKeywords: z.array(z.string().min(1).max(80)).max(12),
  })
  .strict();

export const factionConceptSchema = z
  .object({
    id: factionIdSchema,
    name: z.string().min(1).max(120),
    concept: z.string().min(1).max(1_000),
    visualKeywords: z.array(z.string().min(1).max(80)).max(8),
  })
  .strict();

export const worldAssistResponseSchema = z
  .object({
    settingSummary: z.string().min(1).max(2_000),
    factions: z.array(factionConceptSchema).length(4),
  })
  .strict();

export type WorldAssistRequest = z.infer<typeof worldAssistRequestSchema>;
export type FactionConcept = z.infer<typeof factionConceptSchema>;
export type WorldAssistResponse = z.infer<typeof worldAssistResponseSchema>;
