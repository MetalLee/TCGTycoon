import type { SaveEnvelope, SaveId, SaveMetadata } from "@tcgtycoon/domain";
import type { SaveRepository } from "../contracts/save-repository";
import { migrateSave } from "../migrations/migrate-save";
import { TcgTycoonDexie, type SaveSlotRecord } from "./dexie-db";

function compareMetadata(left: SaveMetadata, right: SaveMetadata): number {
  return (
    (right.updatedAt < left.updatedAt
      ? -1
      : right.updatedAt > left.updatedAt
        ? 1
        : 0) ||
    (left.saveId < right.saveId ? -1 : left.saveId > right.saveId ? 1 : 0)
  );
}

function metadataFor(save: SaveEnvelope): SaveMetadata {
  const { state, ...metadata } = save;
  void state;
  return structuredClone(metadata);
}

function canonicalEnvelope(save: unknown): SaveEnvelope {
  return structuredClone(migrateSave(save));
}

export class DexieSaveRepository implements SaveRepository {
  constructor(readonly database: TcgTycoonDexie = new TcgTycoonDexie()) {}

  async list(): Promise<SaveMetadata[]> {
    const records = await this.database.saveSlots.toArray();
    return records
      .map((record) => metadataFor(canonicalEnvelope(record.current)))
      .sort(compareMetadata);
  }

  async load(id: SaveId): Promise<SaveEnvelope> {
    const record = await this.database.saveSlots.get(id);
    if (record === undefined) throw new Error(`Save not found: ${id}`);
    return canonicalEnvelope(record.current);
  }

  async loadPrevious(id: SaveId): Promise<SaveEnvelope> {
    const record = await this.database.saveSlots.get(id);
    if (record?.previous === undefined) {
      throw new Error(`Previous autosave not found: ${id}`);
    }
    return canonicalEnvelope(record.previous);
  }

  async save(save: SaveEnvelope): Promise<void> {
    const current = canonicalEnvelope(save);
    await this.database.transaction("rw", this.database.saveSlots, async () => {
      const existing = await this.database.saveSlots.get(current.saveId);
      const record: SaveSlotRecord = {
        saveId: current.saveId,
        updatedAt: current.updatedAt,
        current,
        ...(existing === undefined
          ? {}
          : { previous: canonicalEnvelope(existing.current) }),
      };
      await this.database.saveSlots.put(record);
    });
  }

  async delete(id: SaveId): Promise<void> {
    await this.database.saveSlots.delete(id);
  }
}
