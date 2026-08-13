import {
  setCompletionRequestSchema,
  setCompletionResponseSchema,
} from "@tcgtycoon/ai-contracts";
import type { Hono } from "hono";
import type { GenerativeProvider } from "../providers/types";

export function registerSetsRoute(
  app: Hono,
  provider: GenerativeProvider,
): void {
  app.post("/v1/sets/complete", async (context) => {
    const input = setCompletionRequestSchema.parse(await context.req.json());
    const output = await provider.completeSet(input);
    return context.json(setCompletionResponseSchema.parse(output));
  });
}
