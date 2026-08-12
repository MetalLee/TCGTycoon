import { cardDefinitionSchema, cardId, factionId } from "@tcgtycoon/domain";
import { z } from "zod";

export const CARD_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "EXTREME"] as const;

export const CARD_RISK_CATEGORIES = [
  "MANA_EFFICIENCY",
  "STATS_EFFICIENCY",
  "CARD_ADVANTAGE",
  "TEMPO",
  "REMOVAL_REACH",
  "SCALING",
  "SYNERGY_LOOP",
  "COMPLEXITY",
] as const;

const cardIdSchema = z.string().min(1).transform(cardId);
const factionIdSchema = z.string().min(1).transform(factionId);

export const cardProposalRequestSchema = z
  .object({
    cardId: cardIdSchema,
    factionId: factionIdSchema,
    designIntent: z.string().min(1).max(2_000),
    setTheme: z.string().min(1).max(500),
    visualKeywords: z.array(z.string().min(1).max(80)).max(12),
  })
  .strict();

export const cardRiskMetadataSchema = z
  .object({
    level: z.enum(CARD_RISK_LEVELS),
    categories: z.array(z.enum(CARD_RISK_CATEGORIES)).max(8),
    explanation: z.string().min(1).max(2_000),
  })
  .strict();

export const cardDraftProposalSchema = z
  .object({
    proposal: cardDefinitionSchema,
    displayText: z.string().min(1).max(1_000),
    risk: cardRiskMetadataSchema,
    translationNotes: z.array(z.string().min(1).max(500)).max(8),
  })
  .strict();

export const cardProposalResponseSchema = cardDraftProposalSchema;

export type CardProposalRequest = z.infer<typeof cardProposalRequestSchema>;
export type CardRiskMetadata = z.infer<typeof cardRiskMetadataSchema>;
export type CardDraftProposal = z.infer<typeof cardDraftProposalSchema>;
export type CardProposalResponse = z.infer<typeof cardProposalResponseSchema>;
