import type { SaveEnvelope, SaveId } from "@tcgtycoon/domain";
import Dexie, { type EntityTable } from "dexie";

export type SaveSlotRecord = {
  saveId: SaveId;
  updatedAt: string;
  current: SaveEnvelope;
  previous?: SaveEnvelope;
};

export class TcgTycoonDexie extends Dexie {
  readonly saveSlots!: EntityTable<SaveSlotRecord, "saveId">;

  constructor(name = "tcgtycoon") {
    super(name);
    this.version(1).stores({
      saveSlots: "&saveId, updatedAt",
    });
  }
}
