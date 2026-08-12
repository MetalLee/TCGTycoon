import type { Brand } from "./ids";

export type AssetId = Brand<string, "AssetId">;

export const assetId = (value: string) => value as AssetId;

export type AssetPurpose =
  "CARD_ART" | "PRODUCT_ART" | "SET_ART" | "FACTION_ART";

export type AssetMetadata = {
  mediaType: string;
  purpose: AssetPurpose;
  referenceEntityIds: string[];
};
