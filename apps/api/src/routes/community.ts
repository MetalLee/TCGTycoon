import {
  communityRenderRequestSchema,
  communityRenderResponseSchema,
} from "@tcgtycoon/ai-contracts";
import type { Hono } from "hono";
import type { GenerativeProvider } from "../providers/types";

export function registerCommunityRoute(
  app: Hono,
  provider: GenerativeProvider,
): void {
  app.post("/v1/community/render", async (context) => {
    const input = communityRenderRequestSchema.parse(await context.req.json());
    const output = await provider.renderCommunityPost(input);
    return context.json(communityRenderResponseSchema.parse(output));
  });
}
