import {
  setCompletionResponseSchema,
  type SetCompletionRequest,
} from "@tcgtycoon/ai-contracts";
import { z } from "zod";

export const setCompletionJsonSchema = z.toJSONSchema(
  setCompletionResponseSchema,
  { io: "input", target: "draft-07" },
);

export function buildSetCompletionPrompt(input: SetCompletionRequest): string {
  return [
    "Complete every supplied set slot with a legal Core Rules v1 CardDefinition.",
    "Preserve each slot ID, Card ID, faction, rarity, and card type.",
    "Use only keywords, triggers, selectors, and effects permitted by the JSON Schema.",
    `Set input: ${JSON.stringify(input)}`,
  ].join("\n");
}
