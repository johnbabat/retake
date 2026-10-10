import { openDatabase, runMigrations } from "./client";
import { projects } from "./schema";

/** A migrated in-memory database for tests. */
export async function testDb() {
  const handle = openDatabase(":memory:");
  await runMigrations(handle);
  return handle.db;
}

export async function testProject(db: Awaited<ReturnType<typeof testDb>>) {
  const [project] = await db.insert(projects).values({ name: "Test" }).returning();
  return project;
}
