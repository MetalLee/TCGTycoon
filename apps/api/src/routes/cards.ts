import {
  cardProposalRequestSchema,
  cardProposalResponseSchema,
} from "@tcgtycoon/ai-contracts";
import type { Hono } from "hono";
import type { GenerativeProvider } from "../providers/types";

export function registerCardsRoute(
  app: Hono,
  provider: GenerativeProvider,
): void {
  app.post("/v1/cards/propose", async (context) => {
    const input = cardProposalRequestSchema.parse(await context.req.json());
    const output = await provider.proposeCard(input);
    return context.json(cardProposalResponseSchema.parse(output));
  });
}
