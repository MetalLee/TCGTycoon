import {
  artGenerateRequestSchema,
  artGenerateResponseSchema,
} from "@tcgtycoon/ai-contracts";
import type { Hono } from "hono";
import type { GenerativeProvider } from "../providers/types";

export function registerArtRoute(
  app: Hono,
  provider: GenerativeProvider,
): void {
  app.post("/v1/art/generate", async (context) => {
    const input = artGenerateRequestSchema.parse(await context.req.json());
    const output = await provider.generateArtwork(input);
    return context.json(artGenerateResponseSchema.parse(output));
  });
}
