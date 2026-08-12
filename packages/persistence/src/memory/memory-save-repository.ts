import type { SaveEnvelope, SaveId, SaveMetadata } from "@tcgtycoon/domain";
import type { SaveRepository } from "../contracts/save-repository";
import { migrateSave } from "../migrations/migrate-save";
import { canonicalStringify } from "../serialization/canonical-json";

export class MemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<
    SaveId,
    { current: string; previous?: string }
  >();

  async list(): Promise<SaveMetadata[]> {
    return [...this.saves.values()]
      .map(({ current }) => {
        const { state, ...metadata } = this.deserialize(current);
        void state;
        return metadata;
      })
      .sort(
        (left, right) =>
          (right.updatedAt < left.updatedAt
            ? -1
            : right.updatedAt > left.updatedAt
              ? 1
              : 0) ||
          (left.saveId < right.saveId
            ? -1
            : left.saveId > right.saveId
              ? 1
              : 0),
      );
  }

  async load(id: SaveId): Promise<SaveEnvelope> {
    const record = this.saves.get(id);
    if (record === undefined) {
      throw new Error(`Save not found: ${id}`);
    }
    return this.deserialize(record.current);
  }

  async loadPrevious(id: SaveId): Promise<SaveEnvelope> {
    const previous = this.saves.get(id)?.previous;
    if (previous === undefined) {
      throw new Error(`Previous autosave not found: ${id}`);
    }
    return this.deserialize(previous);
  }

  async save(save: SaveEnvelope): Promise<void> {
    const validated = migrateSave(save);
    const existing = this.saves.get(validated.saveId);
    this.saves.set(validated.saveId, {
      current: canonicalStringify(validated),
      ...(existing === undefined ? {} : { previous: existing.current }),
    });
  }

  async delete(id: SaveId): Promise<void> {
    this.saves.delete(id);
  }

  private deserialize(serialized: string): SaveEnvelope {
    return migrateSave(JSON.parse(serialized));
  }
}
