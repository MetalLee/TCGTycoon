import { agentId, factionId } from "@tcgtycoon/domain";
import { z } from "zod";

const agentIdSchema = z.string().min(1).transform(agentId);
const factionIdSchema = z.string().min(1).transform(factionId);

export const namedAgentPromptProfileSchema = z
  .object({
    id: agentIdSchema,
    name: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    personalityTraits: z.array(z.string().min(1).max(120)).max(8),
    favoriteFactionId: factionIdSchema.optional(),
    riskTolerance: z.number().min(0).max(1),
    brandAttitude: z.number().min(-1).max(1),
    influence: z.number().min(0).max(1),
    longTermSummary: z.string().max(2_000).optional(),
  })
  .strict();

export const knownFactSchema = z
  .object({
    kind: z.string().min(1).max(120),
    entityId: z.string().min(1).max(200).optional(),
    statement: z.string().min(1).max(1_000),
  })
  .strict();

export const communityFactPacketSchema = z
  .object({
    day: z.number().int().positive(),
    agent: namedAgentPromptProfileSchema,
    knownFacts: z.array(knownFactSchema).max(32),
    recentMemories: z.array(z.string().min(1).max(1_000)).max(20),
    requestedTopic: z.string().min(1).max(500),
    requestedStance: z.string().min(1).max(120),
  })
  .strict();

export type NamedAgentPromptProfile = z.infer<
  typeof namedAgentPromptProfileSchema
>;
export type KnownFact = z.infer<typeof knownFactSchema>;
export type CommunityFactPacket = z.infer<typeof communityFactPacketSchema>;
