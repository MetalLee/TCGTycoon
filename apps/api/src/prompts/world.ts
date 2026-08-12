import {
  worldAssistResponseSchema,
  type WorldAssistRequest,
} from "@tcgtycoon/ai-contracts";
import { z } from "zod";

export const worldAssistJsonSchema = z.toJSONSchema(worldAssistResponseSchema, {
  io: "input",
  target: "draft-07",
});

export function buildWorldAssistPrompt(input: WorldAssistRequest): string {
  return [
    "Propose exactly four distinct faction concepts for the supplied TCG world.",
    "Return only facts and creative suggestions requested by the response schema.",
    `Design input: ${JSON.stringify(input)}`,
  ].join("\n");
}
