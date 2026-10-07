import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDatabase, runMigrations } from "./client";
import { jobs, projects } from "./schema";

async function freshDb() {
  const handle = openDatabase(":memory:");
  await runMigrations(handle);
  return handle.db;
}

describe("database", () => {
  it("migrates and round-trips rows with defaults", async () => {
    const db = await freshDb();
    const [project] = await db.insert(projects).values({ name: "Test" }).returning();
    expect(project.id).toMatch(/[0-9a-f-]{36}/);
    expect(project.createdAt).toBeInstanceOf(Date);

    const [job] = await db
      .insert(jobs)
      .values({
        projectId: project.id,
        capability: "generate",
        adapterId: "mock:generate",
        params: { prompt: "a sunset" },
        costEstimateUsd: 0.5,
      })
      .returning();
    expect(job.status).toBe("queued");

    const found = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(found?.params).toEqual({ prompt: "a sunset" });
  });

  it("returns undefined for a missing row", async () => {
    const db = await freshDb();
    const found = await db.query.projects.findFirst({ where: eq(projects.id, "nope") });
    expect(found).toBeUndefined();
  });

  it("enforces foreign keys", async () => {
    const db = await freshDb();
    await expect(
      db.insert(jobs).values({
        projectId: "missing",
        capability: "generate",
        adapterId: "mock:generate",
        params: {},
        costEstimateUsd: 0,
      }),
    ).rejects.toThrow();
  });
});
