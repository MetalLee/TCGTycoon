import type {
  AssetId,
  AssetMetadata,
  SaveEnvelope,
  SaveId,
} from "@tcgtycoon/domain";
import Dexie, { type EntityTable } from "dexie";

export type SaveSlotRecord = {
  saveId: SaveId;
  updatedAt: string;
  current: SaveEnvelope;
  previous?: SaveEnvelope;
};

export type AssetRecord = {
  assetId: AssetId;
  mediaType: string;
  bytes: Uint8Array;
  metadata: AssetMetadata;
};

export class TcgTycoonDexie extends Dexie {
  readonly saveSlots!: EntityTable<SaveSlotRecord, "saveId">;
  readonly assets!: EntityTable<AssetRecord, "assetId">;

  constructor(name = "tcgtycoon") {
    super(name);
    this.version(1).stores({
      saveSlots: "&saveId, updatedAt",
    });
    this.version(2).stores({
      saveSlots: "&saveId, updatedAt",
      assets: "&assetId",
    });
  }
}
