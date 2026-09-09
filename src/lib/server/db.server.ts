import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg, { type QueryResultRow } from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;
let localDatabase: Promise<PGlite> | undefined;

type DatabaseResult<T extends QueryResultRow> = {
  rows: T[];
  rowCount: number | null;
};

export type DatabaseClient = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<DatabaseResult<T>>;
};

async function migrateLocalDatabase(database: PGlite) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.resolve("migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const exists = await database.query<{ name: string }>(
      "SELECT name FROM app_migrations WHERE name = $1",
      [file],
    );
    if (exists.rows.length > 0) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await database.transaction(async (localTransaction) => {
      await localTransaction.exec(sql);
      await localTransaction.query("INSERT INTO app_migrations (name) VALUES ($1)", [file]);
    });
  }
}

async function getLocalDatabase() {
  if (!localDatabase) {
    localDatabase = (async () => {
      // O diretorio e configuravel para que um teste possa rodar contra um
      // banco descartavel em vez do banco de demonstracao local. Sem isso, o
      // teste do caminho de pagamento so roda destruindo os dados com que a
      // Julia navega no sistema.
      const localDataDir = path.resolve(process.env.LOCAL_DB_DIR || ".local-data");
      await mkdir(localDataDir, { recursive: true });
      const database = await PGlite.create(path.join(localDataDir, "central-comerciante"));
      await migrateLocalDatabase(database);
      return database;
    })();
  }
  return localDatabase;
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const databasePool = getPool();
  if (databasePool) return databasePool.query<T>(text, values);

  const database = await getLocalDatabase();
  const result = await database.query<T>(text, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
}

export async function transaction<T>(run: (client: DatabaseClient) => Promise<T>) {
  const databasePool = getPool();
  if (!databasePool) {
    const database = await getLocalDatabase();
    return database.transaction(async (localTransaction) =>
      run({
        async query<R extends QueryResultRow>(text: string, values: unknown[] = []) {
          const result = await localTransaction.query<R>(text, values);
          return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
        },
      }),
    );
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
