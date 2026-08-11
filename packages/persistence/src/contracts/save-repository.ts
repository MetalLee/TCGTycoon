import type { SaveEnvelope, SaveId, SaveMetadata } from "@tcgtycoon/domain";
export interface SaveRepository { list(): Promise<SaveMetadata[]>; load(id: SaveId): Promise<SaveEnvelope>; save(save: SaveEnvelope): Promise<void>; delete(id: SaveId): Promise<void>; }
