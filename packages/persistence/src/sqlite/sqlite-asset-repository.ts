import type { AssetId, AssetMetadata } from "@tcgtycoon/domain";
import type { AssetRepository } from "../contracts/asset-repository";
import { canonicalStringify } from "../serialization/canonical-json";
import {
  initializeSqliteDatabase,
  type SqliteDatabase,
} from "./sqlite-database";

type AssetRow = {
  media_type: string;
  bytes_base64: string;
  metadata_json: string;
};

function encodeBytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)),
    );
  }
  return btoa(chunks.join(""));
}

function decodeBytes(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

export class SqliteAssetRepository implements AssetRepository {
  readonly #ready: Promise<void>;

  constructor(readonly database: SqliteDatabase) {
    this.#ready = initializeSqliteDatabase(database);
  }

  async put(asset: {
    id: AssetId;
    mediaType: string;
    bytes: Uint8Array;
    metadata: AssetMetadata;
  }): Promise<void> {
    if (asset.mediaType !== asset.metadata.mediaType) {
      throw new Error("Asset mediaType must match metadata.mediaType");
    }
    await this.#ready;
    await this.database.execute(
      `INSERT INTO assets (asset_id, media_type, bytes_base64, metadata_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(asset_id) DO UPDATE SET
        media_type = excluded.media_type,
        bytes_base64 = excluded.bytes_base64,
        metadata_json = excluded.metadata_json`,
      [
        asset.id,
        asset.mediaType,
        encodeBytes(asset.bytes),
        canonicalStringify(asset.metadata),
      ],
    );
  }

  async get(
    id: AssetId,
  ): Promise<{ bytes: Uint8Array; metadata: AssetMetadata } | null> {
    await this.#ready;
    const [row] = await this.database.select<AssetRow>(
      `SELECT media_type, bytes_base64, metadata_json
      FROM assets WHERE asset_id = $1`,
      [id],
    );
    if (row === undefined) return null;
    const metadata = JSON.parse(row.metadata_json) as AssetMetadata;
    if (metadata.mediaType !== row.media_type) {
      throw new Error(`Corrupt asset metadata: ${id}`);
    }
    return { bytes: decodeBytes(row.bytes_base64), metadata };
  }

  async delete(id: AssetId): Promise<void> {
    await this.#ready;
    await this.database.execute("DELETE FROM assets WHERE asset_id = $1", [id]);
  }
}
