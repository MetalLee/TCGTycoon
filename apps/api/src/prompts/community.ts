import {
  communityRenderResponseSchema,
  type CommunityRenderRequest,
} from "@tcgtycoon/ai-contracts";
import { z } from "zod";

export const communityRenderJsonSchema = z.toJSONSchema(
  communityRenderResponseSchema,
  { io: "input", target: "draft-07" },
);

export function buildCommunityRenderPrompt(
  input: CommunityRenderRequest,
): string {
  return [
    "Render a community post using only the supplied finite Fact Packet.",
    "Do not invent hidden facts, future official actions, or new referenced entities.",
    `Fact Packet: ${JSON.stringify(input)}`,
  ].join("\n");
}
