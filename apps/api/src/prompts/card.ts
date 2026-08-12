import {
  cardProposalResponseSchema,
  type CardProposalRequest,
} from "@tcgtycoon/ai-contracts";
import { z } from "zod";

export const cardProposalJsonSchema = z.toJSONSchema(
  cardProposalResponseSchema,
  { io: "input", target: "draft-07" },
);

export function buildCardProposalPrompt(input: CardProposalRequest): string {
  return [
    "Propose one legal Core Rules v1 CardDefinition for the supplied design intent.",
    "Use only keywords, triggers, selectors, and effects permitted by the JSON Schema.",
    "Do not invent executable conditions or arbitrary rule text.",
    `Design input: ${JSON.stringify(input)}`,
  ].join("\n");
}
