import { and, gte, inArray, sql } from "drizzle-orm";
import type { Config } from "@/server/config";
import type { Db } from "@/server/db/client";
import { jobs, ledger } from "@/server/db/schema";

export type BudgetCheck =
  | { ok: true; needsConfirmation: boolean; spentTodayUsd: number; spentMonthUsd: number }
  | { ok: false; reason: string; spentTodayUsd: number; spentMonthUsd: number };

export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Money committed since `since`: charges already recorded in the ledger plus
 * the estimates of jobs that are queued or running and not yet charged.
 */
export async function committedSince(db: Db, since: Date): Promise<number> {
  const [charged] = await db
    .select({ total: sql<number>`coalesce(sum(${ledger.amountUsd}), 0)` })
    .from(ledger)
    .where(gte(ledger.createdAt, since));
  const [reserved] = await db
    .select({ total: sql<number>`coalesce(sum(${jobs.costEstimateUsd}), 0)` })
    .from(jobs)
    .where(and(inArray(jobs.status, ["queued", "running"]), gte(jobs.createdAt, since)));
  return round(Number(charged.total) + Number(reserved.total));
}

/** Decide whether a new job with this estimate may be queued. */
export async function checkBudget(
  db: Db,
  estimateUsd: number,
  budget: Config["budget"],
  now = new Date(),
): Promise<BudgetCheck> {
  const spentTodayUsd = await committedSince(db, startOfDay(now));
  const spentMonthUsd = await committedSince(db, startOfMonth(now));
  const spent = { spentTodayUsd, spentMonthUsd };

  if (spentTodayUsd + estimateUsd > budget.dailyUsd) {
    return {
      ok: false,
      reason: `This job (~$${fmt(estimateUsd)}) would pass today's cap of $${fmt(budget.dailyUsd)} ($${fmt(spentTodayUsd)} used).`,
      ...spent,
    };
  }
  if (spentMonthUsd + estimateUsd > budget.monthlyUsd) {
    return {
      ok: false,
      reason: `This job (~$${fmt(estimateUsd)}) would pass this month's cap of $${fmt(budget.monthlyUsd)} ($${fmt(spentMonthUsd)} used).`,
      ...spent,
    };
  }
  return { ok: true, needsConfirmation: estimateUsd > budget.confirmOverUsd, ...spent };
}

export async function recordCharge(
  db: Db,
  charge: { jobId: string; provider: string; amountUsd: number },
) {
  if (charge.amountUsd <= 0) return;
  await db.insert(ledger).values(charge);
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

function fmt(n: number) {
  return n.toFixed(2);
}
