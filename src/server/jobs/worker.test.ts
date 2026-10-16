import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { assets, jobs, ledger, takes } from "@/server/db/schema";
import { testDb, testProject } from "@/server/db/testing";
import { createJob } from "./service";
import { tick } from "./worker";

const cfg = { providers: "mock" as const, budget: { dailyUsd: 15, monthlyUsd: 150, confirmOverUsd: 2 } };

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

async function setup() {
  const db = await testDb();
  const project = await testProject(db);
  const dataDir = mkdtempSync(join(tmpdir(), "retake-data-"));
  dirs.push(dataDir);
  return { db, project, dataDir };
}

async function jobRow(db: Awaited<ReturnType<typeof testDb>>, id: string) {
  return (await db.query.jobs.findFirst({ where: eq(jobs.id, id) }))!;
}

describe("createJob", () => {
  it("queues a job with its estimate", async () => {
    const { db, project } = await setup();
    const result = await createJob(db, cfg, {
      projectId: project.id,
      capability: "generate",
      params: { prompt: "sunset", durationS: 5 },
    });
    expect(result).toMatchObject({ status: "queued", estimateUsd: 0.5 });
  });

  it("asks for confirmation above the threshold, then queues once confirmed", async () => {
    const { db, project } = await setup();
    const input = {
      projectId: project.id,
      capability: "generate" as const,
      params: { durationS: 10, takes: 3 },
    };
    expect(await createJob(db, cfg, input)).toMatchObject({ status: "needs-confirmation", estimateUsd: 3 });
    expect(await createJob(db, cfg, { ...input, confirmed: true })).toMatchObject({ status: "queued" });
  });

  it("refuses a job that would break the daily cap", async () => {
    const { db, project } = await setup();
    const tight = { ...cfg, budget: { ...cfg.budget, dailyUsd: 1 } };
    const result = await createJob(db, tight, {
      projectId: project.id,
      capability: "generate",
      params: { durationS: 15 },
      confirmed: true,
    });
    expect(result.status).toBe("over-budget");
  });

  it("rejects invalid params", async () => {
    const { db, project } = await setup();
    await expect(
      createJob(db, cfg, { projectId: project.id, capability: "generate", params: { durationS: 99 } }),
    ).rejects.toThrow();
  });
});

describe("worker", () => {
  it("runs a mock job through to takes on disk", async () => {
    const { db, project, dataDir } = await setup();
    const created = await createJob(db, cfg, {
      projectId: project.id,
      capability: "generate",
      params: { durationS: 1, takes: 2, mockDelayMs: 0 },
    });
    if (created.status !== "queued") throw new Error("not queued");

    await tick({ db, dataDir }); // submit, then first poll renders the clips
    const job = await jobRow(db, created.jobId);
    expect(job.status).toBe("succeeded");
    expect(job.attempts).toBe(1);
    expect(job.costActualUsd).toBe(0);

    const made = await db.select().from(takes).where(eq(takes.jobId, job.id));
    expect(made).toHaveLength(2);
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, made[0].assetId) });
    expect(asset).toMatchObject({ kind: "generated", width: 1280, height: 720, hasAudio: true });
    expect(asset!.durationMs).toBeGreaterThan(900);
    expect(existsSync(join(dataDir, asset!.path))).toBe(true);
    expect(await db.select().from(ledger)).toHaveLength(0); // mock is free
  }, 30_000);

  it("keeps polling while the provider is busy", async () => {
    const { db, project, dataDir } = await setup();
    let t = 1_000_000;
    const now = () => t;
    const created = await createJob(db, cfg, {
      projectId: project.id,
      capability: "generate",
      params: { durationS: 1, mockDelayMs: 10_000 },
    });
    if (created.status !== "queued") throw new Error("not queued");

    await tick({ db, dataDir, now });
    let job = await jobRow(db, created.jobId);
    expect(job.status).toBe("running");
    expect(job.nextPollAt!.getTime()).toBe(t + 10_000);

    expect(await tick({ db, dataDir, now })).toBe(false); // not due yet
    t += 10_000;
    await tick({ db, dataDir, now });
    job = await jobRow(db, created.jobId);
    expect(job.status).toBe("succeeded");
  }, 30_000);

  it("marks moderation rejections separately from failures", async () => {
    const { db, project, dataDir } = await setup();
    const created = await createJob(db, cfg, {
      projectId: project.id,
      capability: "generate",
      params: { mockOutcome: "reject", mockDelayMs: 0 },
    });
    if (created.status !== "queued") throw new Error("not queued");
    await tick({ db, dataDir });
    const job = await jobRow(db, created.jobId);
    expect(job.status).toBe("rejected");
    expect(job.error).toMatch(/moderation/);
  });

  it("releases the reserved budget once a job ends", async () => {
    const { db, project, dataDir } = await setup();
    const tight = { ...cfg, budget: { ...cfg.budget, dailyUsd: 1 } };
    const first = await createJob(db, tight, {
      projectId: project.id,
      capability: "generate",
      params: { durationS: 8, mockOutcome: "fail", mockDelayMs: 0 },
    });
    expect(first.status).toBe("queued");
    const second = { projectId: project.id, capability: "generate" as const, params: { durationS: 8 } };
    expect((await createJob(db, tight, second)).status).toBe("over-budget");

    await tick({ db, dataDir });
    expect((await createJob(db, tight, second)).status).toBe("queued");
  });
});
