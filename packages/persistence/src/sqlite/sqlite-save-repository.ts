import {
  saveId,
  type SaveEnvelope,
  type SaveId,
  type SaveMetadata,
} from "@tcgtycoon/domain";
import type { SaveRepository } from "../contracts/save-repository";
import { migrateSave } from "../migrations/migrate-save";
import { canonicalStringify } from "../serialization/canonical-json";
import {
  initializeSqliteDatabase,
  type SqliteDatabase,
} from "./sqlite-database";

type SaveMetadataRow = {
  save_id: string;
  schema_version: number;
  simulation_version: string;
  rule_version: string;
  balance_version: string;
  app_version: string;
  world_seed: string;
  created_at: string;
  updated_at: string;
};

type SavePayloadRow = {
  current_payload: string;
  previous_payload: string | null;
};

function metadataFromRow(row: SaveMetadataRow): SaveMetadata {
  return {
    saveId: saveId(row.save_id),
    schemaVersion: row.schema_version,
    simulationVersion: row.simulation_version,
    ruleVersion: row.rule_version,
    balanceVersion: row.balance_version,
    appVersion: row.app_version,
    worldSeed: row.world_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serialize(save: SaveEnvelope): string {
  return canonicalStringify(migrateSave(save));
}

function deserialize(serialized: string): SaveEnvelope {
  return migrateSave(JSON.parse(serialized));
}

export class SqliteSaveRepository implements SaveRepository {
  readonly #ready: Promise<void>;

  constructor(readonly database: SqliteDatabase) {
    this.#ready = initializeSqliteDatabase(database);
  }

  async list(): Promise<SaveMetadata[]> {
    await this.#ready;
    const rows = await this.database.select<SaveMetadataRow>(
      `SELECT save_id, schema_version, simulation_version, rule_version,
        balance_version, app_version, world_seed, created_at, updated_at
      FROM save_slots
      ORDER BY updated_at DESC, save_id ASC`,
    );
    return rows.map(metadataFromRow);
  }

  async load(id: SaveId): Promise<SaveEnvelope> {
    const row = await this.loadPayload(id);
    return deserialize(row.current_payload);
  }

  async loadPrevious(id: SaveId): Promise<SaveEnvelope> {
    await this.#ready;
    const [row] = await this.database.select<SavePayloadRow>(
      `SELECT current_payload, previous_payload
      FROM save_slots WHERE save_id = $1`,
      [id],
    );
    if (row?.previous_payload == null) {
      throw new Error(`Previous autosave not found: ${id}`);
    }
    return deserialize(row.previous_payload);
  }

  async save(save: SaveEnvelope): Promise<void> {
    const current = deserialize(serialize(save));
    const payload = canonicalStringify(current);
    await this.#ready;
    await this.database.execute(
      `INSERT INTO save_slots (
        save_id, schema_version, simulation_version, rule_version,
        balance_version, app_version, world_seed, created_at, updated_at,
        current_payload, previous_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)
      ON CONFLICT(save_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        simulation_version = excluded.simulation_version,
        rule_version = excluded.rule_version,
        balance_version = excluded.balance_version,
        app_version = excluded.app_version,
        world_seed = excluded.world_seed,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        previous_payload = save_slots.current_payload,
        current_payload = excluded.current_payload`,
      [
        current.saveId,
        current.schemaVersion,
        current.simulationVersion,
        current.ruleVersion,
        current.balanceVersion,
        current.appVersion,
        current.worldSeed,
        current.createdAt,
        current.updatedAt,
        payload,
      ],
    );
  }

  async delete(id: SaveId): Promise<void> {
    await this.#ready;
    await this.database.execute("DELETE FROM save_slots WHERE save_id = $1", [
      id,
    ]);
  }

  private async loadPayload(id: SaveId): Promise<SavePayloadRow> {
    await this.#ready;
    const [row] = await this.database.select<SavePayloadRow>(
      `SELECT current_payload, previous_payload
      FROM save_slots WHERE save_id = $1`,
      [id],
    );
    if (row === undefined) throw new Error(`Save not found: ${id}`);
    return row;
  }
}
