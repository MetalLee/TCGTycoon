import { z } from "zod";

export const ASSET_PURPOSES = [
  "CARD_ART",
  "PRODUCT_ART",
  "SET_ART",
  "FACTION_ART",
] as const;

export const artVisualBriefSchema = z
  .object({
    subject: z.string().min(1).max(2_000),
    composition: z.string().min(1).max(1_000),
    styleKeywords: z.array(z.string().min(1).max(120)).max(12),
    colorPalette: z.array(z.string().min(1).max(120)).max(8),
  })
  .strict();

export const artGenerateRequestSchema = z
  .object({
    assetPurpose: z.enum(ASSET_PURPOSES),
    visualBrief: artVisualBriefSchema,
    referenceEntityIds: z.array(z.string().min(1).max(200)).max(8),
  })
  .strict();

export const artGenerateResponseSchema = z
  .object({
    mediaType: z.enum(["image/png", "image/webp"]),
    base64Data: z.string().min(1),
    revisedPrompt: z.string().min(1).max(4_000).optional(),
  })
  .strict();

export type AssetPurpose = (typeof ASSET_PURPOSES)[number];
export type ArtVisualBrief = z.infer<typeof artVisualBriefSchema>;
export type ArtGenerateRequest = z.infer<typeof artGenerateRequestSchema>;
export type ArtGenerateResponse = z.infer<typeof artGenerateResponseSchema>;
