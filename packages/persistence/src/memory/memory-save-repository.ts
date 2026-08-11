import type { SaveEnvelope, SaveId, SaveMetadata } from "@tcgtycoon/domain";
import type { SaveRepository } from "../contracts/save-repository";
import { migrateSave } from "../migrations/migrate-save";
import { canonicalStringify } from "../serialization/canonical-json";

export class MemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<SaveId, string>();

  async list(): Promise<SaveMetadata[]> {
    return [...this.saves.values()].map((serialized) => {
      const { state, ...metadata } = this.deserialize(serialized);
      void state;
      return metadata;
    });
  }

  async load(id: SaveId): Promise<SaveEnvelope> {
    const serialized = this.saves.get(id);
    if (serialized === undefined) {
      throw new Error(`Save not found: ${id}`);
    }
    return this.deserialize(serialized);
  }

  async save(save: SaveEnvelope): Promise<void> {
    const validated = migrateSave(save);
    this.saves.set(validated.saveId, canonicalStringify(validated));
  }

  async delete(id: SaveId): Promise<void> {
    this.saves.delete(id);
  }

  private deserialize(serialized: string): SaveEnvelope {
    return migrateSave(JSON.parse(serialized));
  }
}
