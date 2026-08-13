import type { AssetId, AssetMetadata } from "@tcgtycoon/domain";
import type { AssetRepository } from "../contracts/asset-repository";
import { TcgTycoonDexie, type AssetRecord } from "./dexie-db";

function cloneRecord(record: AssetRecord): AssetRecord {
  return {
    assetId: record.assetId,
    mediaType: record.mediaType,
    bytes: Uint8Array.from(record.bytes),
    metadata: structuredClone(record.metadata),
  };
}

export class DexieAssetRepository implements AssetRepository {
  constructor(readonly database: TcgTycoonDexie = new TcgTycoonDexie()) {}

  async put(asset: {
    id: AssetId;
    mediaType: string;
    bytes: Uint8Array;
    metadata: AssetMetadata;
  }): Promise<void> {
    if (asset.mediaType !== asset.metadata.mediaType) {
      throw new Error("Asset mediaType must match metadata.mediaType");
    }
    await this.database.assets.put(
      cloneRecord({
        assetId: asset.id,
        mediaType: asset.mediaType,
        bytes: asset.bytes,
        metadata: asset.metadata,
      }),
    );
  }

  async get(
    id: AssetId,
  ): Promise<{ bytes: Uint8Array; metadata: AssetMetadata } | null> {
    const record = await this.database.assets.get(id);
    if (record === undefined) return null;
    const cloned = cloneRecord(record);
    return { bytes: cloned.bytes, metadata: cloned.metadata };
  }

  async delete(id: AssetId): Promise<void> {
    await this.database.assets.delete(id);
  }
}
