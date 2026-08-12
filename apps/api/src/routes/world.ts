import {
  worldAssistRequestSchema,
  worldAssistResponseSchema,
} from "@tcgtycoon/ai-contracts";
import type { Hono } from "hono";
import type { GenerativeProvider } from "../providers/types";

export function registerWorldRoute(
  app: Hono,
  provider: GenerativeProvider,
): void {
  app.post("/v1/world/assist", async (context) => {
    const input = worldAssistRequestSchema.parse(await context.req.json());
    const output = await provider.assistWorld(input);
    return context.json(worldAssistResponseSchema.parse(output));
  });
}
