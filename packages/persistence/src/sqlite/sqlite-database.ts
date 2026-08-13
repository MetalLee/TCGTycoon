export type SqliteValue = string | number | null;

export type SqliteExecuteResult = {
  rowsAffected: number;
  lastInsertId?: number;
};

export interface SqliteDatabase {
  execute(sql: string, values?: SqliteValue[]): Promise<SqliteExecuteResult>;
  select<T>(sql: string, values?: SqliteValue[]): Promise<T[]>;
}

const migrations = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS save_slots (
        save_id TEXT PRIMARY KEY NOT NULL,
        schema_version INTEGER NOT NULL,
        simulation_version TEXT NOT NULL,
        rule_version TEXT NOT NULL,
        balance_version TEXT NOT NULL,
        app_version TEXT NOT NULL,
        world_seed TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        current_payload TEXT NOT NULL,
        previous_payload TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS save_slots_updated_at
        ON save_slots(updated_at DESC, save_id ASC)`,
      `CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY NOT NULL,
        media_type TEXT NOT NULL,
        bytes_base64 TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      )`,
    ],
  },
] as const;

const initializationByDatabase = new WeakMap<object, Promise<void>>();

export function initializeSqliteDatabase(
  database: SqliteDatabase,
): Promise<void> {
  const cached = initializationByDatabase.get(database);
  if (cached !== undefined) return cached;

  const initialization = runMigrations(database);
  initializationByDatabase.set(database, initialization);
  return initialization;
}

async function runMigrations(database: SqliteDatabase): Promise<void> {
  await database.execute(`CREATE TABLE IF NOT EXISTS persistence_migrations (
    version INTEGER PRIMARY KEY NOT NULL
  )`);

  const applied = new Set(
    (
      await database.select<{ version: number }>(
        "SELECT version FROM persistence_migrations",
      )
    ).map(({ version }) => version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    for (const statement of migration.statements) {
      await database.execute(statement);
    }
    await database.execute(
      "INSERT OR IGNORE INTO persistence_migrations (version) VALUES ($1)",
      [migration.version],
    );
  }
}
