import type { AssetId, AssetMetadata } from "@tcgtycoon/domain";

export interface AssetRepository {
  put(asset: {
    id: AssetId;
    mediaType: string;
    bytes: Uint8Array;
    metadata: AssetMetadata;
  }): Promise<void>;
  get(
    id: AssetId,
  ): Promise<{ bytes: Uint8Array; metadata: AssetMetadata } | null>;
  delete(id: AssetId): Promise<void>;
}
