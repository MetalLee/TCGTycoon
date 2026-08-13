import type { ArtGenerateRequest } from "@tcgtycoon/ai-contracts";

export function buildArtworkPrompt(input: ArtGenerateRequest): string {
  return [
    `Create ${input.assetPurpose.toLowerCase().replaceAll("_", " ")} for a trading card game.`,
    `Subject: ${input.visualBrief.subject}`,
    `Composition: ${input.visualBrief.composition}`,
    `Style: ${input.visualBrief.styleKeywords.join(", ")}`,
    `Color palette: ${input.visualBrief.colorPalette.join(", ")}`,
    `Referenced entity IDs: ${input.referenceEntityIds.join(", ")}`,
    "Do not add card frames, rules text, logos, or watermarks.",
  ].join("\n");
}
