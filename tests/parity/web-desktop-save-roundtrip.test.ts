import "fake-indexeddb/auto";

import { DatabaseSync, type StatementSync } from "node:sqlite";

import {
  assetId,
  saveId,
  type AssetMetadata,
  type SaveEnvelope,
} from "../../packages/domain/src/index";
import {
  DexieSaveRepository,
  DexieAssetRepository,
  SqliteAssetRepository,
  SqliteSaveRepository,
  TcgTycoonDexie,
  migrateSave,
  type SqliteDatabase,
  type SqliteValue,
} from "../../packages/persistence/src/index";
import { createTestWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

class NodeSqliteDatabase implements SqliteDatabase {
  readonly #database = new DatabaseSync(":memory:");

  async execute(sql: string, values: SqliteValue[] = []) {
    const result = this.#database
      .prepare(sql.replace(/\$\d+/g, "?"))
      .run(...(values as Parameters<StatementSync["run"]>));
    return {
      rowsAffected: Number(result.changes),
      lastInsertId: Number(result.lastInsertRowid),
    };
  }

  async select<T>(sql: string, values: SqliteValue[] = []): Promise<T[]> {
    return this.#database
      .prepare(sql.replace(/\$\d+/g, "?"))
      .all(...(values as Parameters<StatementSync["all"]>)) as T[];
  }

  close(): void {
    this.#database.close();
  }
}

function createCanonicalSave(): SaveEnvelope {
  const state = createTestWorld("web-desktop-roundtrip");
  return {
    saveId: saveId("save-web-desktop-roundtrip"),
    schemaVersion: state.schemaVersion,
    simulationVersion: state.simulationVersion,
    ruleVersion: state.ruleVersion,
    balanceVersion: state.balanceVersion,
    appVersion: "parity-test",
    worldSeed: state.worldSeed,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T01:00:00.000Z",
    state,
  };
}

describe("Web/Desktop persistence parity", () => {
  it("round-trips the same canonical save through Dexie and SQLite", async () => {
    const dexie = new TcgTycoonDexie("web-desktop-save-roundtrip");
    const webRepository = new DexieSaveRepository(dexie);
    const sqlite = new NodeSqliteDatabase();
    const desktopRepository = new SqliteSaveRepository(sqlite);
    const canonical = migrateSave(createCanonicalSave());

    try {
      await webRepository.save(canonical);
      const webLoaded = migrateSave(await webRepository.load(canonical.saveId));

      await desktopRepository.save(webLoaded);
      const desktopLoaded = migrateSave(
        await desktopRepository.load(canonical.saveId),
      );

      expect(webLoaded).toEqual(canonical);
      expect(desktopLoaded).toEqual(canonical);
    } finally {
      await dexie.delete();
      sqlite.close();
    }
  });

  it("stores desktop artwork separately from canonical save payloads", async () => {
    const sqlite = new NodeSqliteDatabase();
    const saveRepository = new SqliteSaveRepository(sqlite);
    const webAssetDatabase = new TcgTycoonDexie("web-asset-roundtrip");
    const webAssetRepository = new DexieAssetRepository(webAssetDatabase);
    const desktopAssetRepository = new SqliteAssetRepository(sqlite);
    const save = createCanonicalSave();
    const id = assetId("asset-roundtrip-card");
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    const metadata: AssetMetadata = {
      mediaType: "image/png",
      purpose: "CARD_ART",
      referenceEntityIds: ["card-roundtrip"],
    };

    try {
      await saveRepository.save(save);
      await webAssetRepository.put({
        id,
        mediaType: metadata.mediaType,
        bytes,
        metadata,
      });
      const webAsset = await webAssetRepository.get(id);
      expect(webAsset).toEqual({ bytes, metadata });
      await desktopAssetRepository.put({
        id,
        mediaType: metadata.mediaType,
        bytes: webAsset!.bytes,
        metadata: webAsset!.metadata,
      });

      expect(await desktopAssetRepository.get(id)).toEqual({ bytes, metadata });
      expect(await saveRepository.load(save.saveId)).toEqual(migrateSave(save));

      const tables = await sqlite.select<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      );
      expect(tables.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["assets", "save_slots"]),
      );

      await desktopAssetRepository.delete(id);
      expect(await desktopAssetRepository.get(id)).toBeNull();
    } finally {
      await webAssetDatabase.delete();
      sqlite.close();
    }
  });
});
