import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { config } from "@/server/config";
import * as schema from "./schema";

/**
 * Drizzle over Node's built-in SQLite (node:sqlite), via the sqlite-proxy
 * driver. This avoids native modules and their install scripts.
 */
export function openDatabase(file: string) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL;");

  const db = drizzle(
    async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const args = params as SQLInputValue[];
      if (method === "run") {
        stmt.run(...args);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === "get") {
        return { rows: stmt.get(...args) as unknown as unknown[] };
      }
      return { rows: stmt.all(...args) as unknown as unknown[] };
    },
    { schema },
  );

  return { db, sqlite };
}

export type Db = ReturnType<typeof openDatabase>["db"];

export const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

export async function runMigrations(handle: ReturnType<typeof openDatabase>) {
  await migrate(
    handle.db,
    async (queries) => {
      handle.sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const q of queries) handle.sqlite.exec(q);
        handle.sqlite.exec("COMMIT");
      } catch (err) {
        handle.sqlite.exec("ROLLBACK");
        throw err;
      }
    },
    { migrationsFolder: MIGRATIONS_DIR },
  );
}

let shared: ReturnType<typeof openDatabase> | undefined;

/** The app's database at <DATA_DIR>/retake.sqlite. Run `pnpm db:migrate` first. */
export function db(): Db {
  shared ??= openDatabase(join(config().dataDir, "retake.sqlite"));
  return shared.db;
}
