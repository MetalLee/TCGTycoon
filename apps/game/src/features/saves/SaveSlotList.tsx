import { useEffect, useState } from "react";
import type {
  SaveId,
  SaveMetadata,
} from "../../../../../packages/domain/src/index";
import type { SaveRepository } from "../../../../../packages/persistence/src/index";

export type SaveSlotListProps = {
  repository: SaveRepository;
  refreshToken?: number;
  onLoad?: (saveId: SaveId) => void | Promise<void>;
};

export function SaveSlotList({
  repository,
  refreshToken = 0,
  onLoad,
}: SaveSlotListProps) {
  const [slots, setSlots] = useState<SaveMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository
      .list()
      .then((listed) => {
        if (!cancelled) setSlots(listed);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repository, refreshToken]);

  async function deleteSlot(saveId: SaveId): Promise<void> {
    await repository.delete(saveId);
    setSlots((current) => current.filter((slot) => slot.saveId !== saveId));
  }

  if (error !== null) return <p className="text-red-300">{error}</p>;
  if (slots.length === 0) {
    return <p className="text-sm text-slate-400">No saved games yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {slots.map((slot) => (
        <li
          key={slot.saveId}
          className="flex items-center justify-between gap-4 rounded border border-slate-800 p-3"
        >
          <div>
            <p className="font-medium">{slot.saveId}</p>
            <p className="text-xs text-slate-400">Updated {slot.updatedAt}</p>
          </div>
          <div className="flex gap-2">
            {onLoad !== undefined && (
              <button
                type="button"
                onClick={() => void onLoad(slot.saveId)}
                className="rounded border border-emerald-500 px-3 py-1 text-sm text-emerald-300"
              >
                Load
              </button>
            )}
            <button
              type="button"
              onClick={() => void deleteSlot(slot.saveId)}
              className="rounded border border-red-900 px-3 py-1 text-sm text-red-300"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
