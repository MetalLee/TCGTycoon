import "fake-indexeddb/auto";

import { DatabaseSync, type StatementSync } from "node:sqlite";

import { saveId, type SaveEnvelope } from "../../packages/domain/src/index";
import {
  DexieSaveRepository,
  MemorySaveRepository,
  SqliteSaveRepository,
  TcgTycoonDexie,
  migrateSave,
  type SaveRepository,
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

type RepositoryHarness = {
  repository: SaveRepository;
  close(): void | Promise<void>;
};

type RepositoryFactory = () => RepositoryHarness;

let databaseSequence = 0;

const repositories: Array<[string, RepositoryFactory]> = [
  [
    "Memory",
    () => ({
      repository: new MemorySaveRepository(),
      close() {},
    }),
  ],
  [
    "Dexie",
    () => {
      const database = new TcgTycoonDexie(
        `save-contract-${databaseSequence++}`,
      );
      return {
        repository: new DexieSaveRepository(database),
        close: () => database.delete(),
      };
    },
  ],
  [
    "SQLite",
    () => {
      const database = new NodeSqliteDatabase();
      return {
        repository: new SqliteSaveRepository(database),
        close: () => database.close(),
      };
    },
  ],
];

function createSave(id: string, day: number): SaveEnvelope {
  const state = createTestWorld(`repository-${id}`);
  state.day = day;
  return migrateSave({
    saveId: saveId(id),
    schemaVersion: state.schemaVersion,
    simulationVersion: state.simulationVersion,
    ruleVersion: state.ruleVersion,
    balanceVersion: state.balanceVersion,
    appVersion: "contract-test",
    worldSeed: state.worldSeed,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: `2026-08-13T${String(day).padStart(2, "0")}:00:00.000Z`,
    state,
  });
}

function describeSaveRepositoryContract(
  name: string,
  createRepository: RepositoryFactory,
): void {
  describe(`${name} SaveRepository`, () => {
    it("lists, loads and deletes detached canonical saves", async () => {
      const harness = createRepository();
      const alpha = createSave(`${name.toLowerCase()}-alpha`, 1);
      const beta = createSave(`${name.toLowerCase()}-beta`, 2);

      try {
        expect(await harness.repository.list()).toEqual([]);

        await harness.repository.save(alpha);
        await harness.repository.save(beta);

        expect(
          (await harness.repository.list()).map((metadata) => metadata.saveId),
        ).toEqual([beta.saveId, alpha.saveId]);

        const loaded = await harness.repository.load(alpha.saveId);
        expect(loaded).toEqual(alpha);
        expect(loaded).not.toBe(alpha);
        expect(loaded.state).not.toBe(alpha.state);

        await harness.repository.delete(alpha.saveId);
        await expect(harness.repository.load(alpha.saveId)).rejects.toThrow(
          "Save not found",
        );
      } finally {
        await harness.close();
      }
    });

    it("atomically rotates current and previous autosaves", async () => {
      const harness = createRepository();
      const day1 = createSave(`${name.toLowerCase()}-autosave`, 1);
      const day2 = createSave(`${name.toLowerCase()}-autosave`, 2);
      const day3 = createSave(`${name.toLowerCase()}-autosave`, 3);

      try {
        await harness.repository.save(day1);
        await expect(
          harness.repository.loadPrevious(day1.saveId),
        ).rejects.toThrow("Previous autosave not found");

        await harness.repository.save(day2);
        await harness.repository.save(day3);

        expect((await harness.repository.load(day3.saveId)).state.day).toBe(3);
        expect(
          (await harness.repository.loadPrevious(day3.saveId)).state.day,
        ).toBe(2);

        await harness.repository.delete(day3.saveId);
        await expect(
          harness.repository.loadPrevious(day3.saveId),
        ).rejects.toThrow("Previous autosave not found");
      } finally {
        await harness.close();
      }
    });
  });
}

for (const [name, createRepository] of repositories) {
  describeSaveRepositoryContract(name, createRepository);
}
