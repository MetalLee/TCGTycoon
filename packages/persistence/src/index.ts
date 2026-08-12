export type { AssetRepository } from "./contracts/asset-repository";
export type { SaveRepository } from "./contracts/save-repository";
export { MemorySaveRepository } from "./memory/memory-save-repository";
export { migrateSave } from "./migrations/migrate-save";
export { CURRENT_SCHEMA_VERSION } from "./migrations/migrate-save";
export { canonicalStringify } from "./serialization/canonical-json";
export {
  TcgTycoonDexie,
  type AssetRecord,
  type SaveSlotRecord,
} from "./indexeddb/dexie-db";
export { DexieSaveRepository } from "./indexeddb/dexie-save-repository";
export { DexieAssetRepository } from "./indexeddb/dexie-asset-repository";
export {
  initializeSqliteDatabase,
  type SqliteDatabase,
  type SqliteExecuteResult,
  type SqliteValue,
} from "./sqlite/sqlite-database";
export { SqliteSaveRepository } from "./sqlite/sqlite-save-repository";
export { SqliteAssetRepository } from "./sqlite/sqlite-asset-repository";
