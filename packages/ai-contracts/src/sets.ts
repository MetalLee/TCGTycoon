import {
  cardDefinitionSchema,
  cardId,
  expansionId,
  factionId,
} from "@tcgtycoon/domain";
import { z } from "zod";
import { cardDraftProposalSchema } from "./cards";

const cardIdSchema = z.string().min(1).transform(cardId);
const expansionIdSchema = z.string().min(1).transform(expansionId);
const factionIdSchema = z.string().min(1).transform(factionId);

export const setCompletionSlotSchema = z
  .object({
    slotId: z.string().min(1).max(120),
    cardId: cardIdSchema,
    factionId: factionIdSchema,
    rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "LEGENDARY"]),
    type: z.enum(["UNIT", "SPELL"]),
    designRole: z.string().min(1).max(500),
  })
  .strict();

export const setCompletionRequestSchema = z
  .object({
    expansionId: expansionIdSchema,
    setName: z.string().min(1).max(120),
    setBrief: z.string().min(1).max(4_000),
    visualKeywords: z.array(z.string().min(1).max(80)).max(12),
    existingCards: z.array(cardDefinitionSchema).max(48),
    openSlots: z.array(setCompletionSlotSchema).min(1).max(48),
  })
  .strict();

export const setCardProposalSchema = cardDraftProposalSchema.extend({
  slotId: z.string().min(1).max(120),
});

export const setCompletionResponseSchema = z
  .object({
    proposals: z.array(setCardProposalSchema).min(1).max(48),
  })
  .strict();

export type SetCompletionSlot = z.infer<typeof setCompletionSlotSchema>;
export type SetCompletionRequest = z.infer<typeof setCompletionRequestSchema>;
export type SetCardProposal = z.infer<typeof setCardProposalSchema>;
export type SetCompletionResponse = z.infer<typeof setCompletionResponseSchema>;
