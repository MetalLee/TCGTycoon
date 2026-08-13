import { z } from "zod";
import { communityFactPacketSchema } from "./fact-packets";

export const communityRenderRequestSchema = communityFactPacketSchema;

export const communityRenderResponseSchema = z
  .object({
    topic: z.string().min(1).max(500),
    stance: z.string().min(1).max(120),
    sentiment: z.number().min(-1).max(1),
    referencedEntityIds: z.array(z.string().min(1).max(200)).max(16),
    text: z.string().min(1).max(4_000),
  })
  .strict();

export type CommunityRenderRequest = z.infer<
  typeof communityRenderRequestSchema
>;
export type CommunityRenderResponse = z.infer<
  typeof communityRenderResponseSchema
>;
