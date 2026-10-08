import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type PoolConfig } from "pg";

type DatabaseGlobal = typeof globalThis & {
  __tackPool?: Pool;
};

export type QueryClient = Pick<PoolClient, "query">;

function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number.parseInt(process.env.PGPORT ?? "54329", 10),
    database: process.env.PGDATABASE ?? "tack",
    user: process.env.PGUSER ?? "tack",
    password: process.env.PGPASSWORD ?? "tack",
  };
}

export function getDatabase() {
  const databaseGlobal = globalThis as DatabaseGlobal;

  if (!databaseGlobal.__tackPool) {
    databaseGlobal.__tackPool = new Pool({
      ...getPoolConfig(),
      max: Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "10", 10),
    });
  }

  return databaseGlobal.__tackPool;
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
  pool = getDatabase(),
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function migrateDatabase(pool = getDatabase()) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('tack-schema-migrations'))",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDirectory = path.join(
      process.cwd(),
      "migrations",
      "postgres",
    );
    const { readdir } = await import("node:fs/promises");
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const applied = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations",
    );
    const appliedNames = new Set(applied.rows.map(({ name }) => name));

    for (const migrationFile of migrationFiles) {
      if (appliedNames.has(migrationFile)) {
        continue;
      }

      const sql = await readFile(
        path.join(migrationsDirectory, migrationFile),
        "utf8",
      );
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name) VALUES ($1)",
        [migrationFile],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  const databaseGlobal = globalThis as DatabaseGlobal;
  const pool = databaseGlobal.__tackPool;

  if (pool) {
    delete databaseGlobal.__tackPool;
    await pool.end();
  }
}
