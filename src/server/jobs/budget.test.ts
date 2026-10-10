import { describe, expect, it } from "vitest";
import { jobs, ledger } from "@/server/db/schema";
import { testDb, testProject } from "@/server/db/testing";
import { checkBudget, committedSince, recordCharge, startOfDay } from "./budget";

const budget = { dailyUsd: 15, monthlyUsd: 150, confirmOverUsd: 2 };

describe("budget", () => {
  it("allows a job inside the caps", async () => {
    const db = await testDb();
    const result = await checkBudget(db, 1, budget);
    expect(result).toMatchObject({ ok: true, needsConfirmation: false, spentTodayUsd: 0 });
  });

  it("asks for confirmation above the threshold", async () => {
    const db = await testDb();
    const result = await checkBudget(db, 2.5, budget);
    expect(result).toMatchObject({ ok: true, needsConfirmation: true });
  });

  it("counts charges and reserved estimates toward the daily cap", async () => {
    const db = await testDb();
    const project = await testProject(db);
    const [job] = await db
      .insert(jobs)
      .values({
        projectId: project.id,
        capability: "generate",
        adapterId: "mock:generate",
        params: {},
        costEstimateUsd: 6,
      })
      .returning();
    await recordCharge(db, { jobId: job.id, provider: "mock", amountUsd: 5 });

    expect(await committedSince(db, startOfDay(new Date()))).toBe(11);

    const result = await checkBudget(db, 5, budget);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/today's cap of \$15\.00/);
  });

  it("ignores finished jobs' estimates, since their cost is in the ledger", async () => {
    const db = await testDb();
    const project = await testProject(db);
    await db.insert(jobs).values({
      projectId: project.id,
      capability: "generate",
      adapterId: "mock:generate",
      params: {},
      costEstimateUsd: 9,
      status: "succeeded",
    });
    expect(await committedSince(db, startOfDay(new Date()))).toBe(0);
  });

  it("enforces the monthly cap using earlier days' spend", async () => {
    const db = await testDb();
    const now = new Date(2026, 9, 20, 12);
    await db.insert(ledger).values({
      provider: "mock",
      amountUsd: 148,
      createdAt: new Date(2026, 9, 5),
    });
    const result = await checkBudget(db, 3, budget, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/this month's cap/);
  });

  it("does not record zero charges", async () => {
    const db = await testDb();
    await recordCharge(db, { jobId: "x", provider: "mock", amountUsd: 0 });
    expect(await db.select().from(ledger)).toHaveLength(0);
  });
});
