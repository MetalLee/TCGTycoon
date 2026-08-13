import { assetId, type AssetId, type AssetMetadata } from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import type { AssetRepository } from "../index";

class ContractAssetRepository implements AssetRepository {
  private readonly assets = new Map<
    AssetId,
    { bytes: Uint8Array; metadata: AssetMetadata }
  >();

  async put(asset: {
    id: AssetId;
    mediaType: string;
    bytes: Uint8Array;
    metadata: AssetMetadata;
  }): Promise<void> {
    expect(asset.mediaType).toBe(asset.metadata.mediaType);
    this.assets.set(asset.id, {
      bytes: asset.bytes,
      metadata: asset.metadata,
    });
  }

  async get(
    id: AssetId,
  ): Promise<{ bytes: Uint8Array; metadata: AssetMetadata } | null> {
    return this.assets.get(id) ?? null;
  }

  async delete(id: AssetId): Promise<void> {
    this.assets.delete(id);
  }
}

describe("AssetRepository contract", () => {
  it("stores binary artwork outside the domain reference", async () => {
    const repository: AssetRepository = new ContractAssetRepository();
    const id = assetId("asset-card-scrap-hound");
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    const metadata: AssetMetadata = {
      mediaType: "image/png",
      purpose: "CARD_ART",
      referenceEntityIds: ["card-scrap-hound"],
    };

    await repository.put({
      id,
      mediaType: metadata.mediaType,
      bytes,
      metadata,
    });

    await expect(repository.get(id)).resolves.toEqual({ bytes, metadata });

    const domainArtworkReference: AssetId = id;
    expect(domainArtworkReference).toBe("asset-card-scrap-hound");

    await repository.delete(id);
    await expect(repository.get(id)).resolves.toBeNull();
  });
});
