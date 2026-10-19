import { desc, eq, inArray } from "drizzle-orm";
import { config } from "@/server/config";
import type { Db } from "@/server/db/client";
import { jobs, projects, takes } from "@/server/db/schema";
import { committedSince, startOfDay, startOfMonth } from "@/server/jobs/budget";

const SANDBOX = "Sandbox";

/** M0 has no project UI yet; everything goes into one sandbox project. */
export async function sandboxProject(db: Db) {
  const existing = await db.query.projects.findFirst({ where: eq(projects.name, SANDBOX) });
  if (existing) return existing;
  const [created] = await db.insert(projects).values({ name: SANDBOX }).returning();
  return created;
}

export type JobView = {
  id: string;
  capability: string;
  adapterId: string;
  status: string;
  costEstimateUsd: number;
  costActualUsd: number | null;
  error: string | null;
  createdAt: number;
  takeAssetIds: string[];
};

export async function recentJobs(db: Db, limit = 20): Promise<JobView[]> {
  const rows = await db.query.jobs.findMany({ orderBy: desc(jobs.createdAt), limit });
  const outputs = rows.length
    ? await db.select().from(takes).where(inArray(takes.jobId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({
    id: r.id,
    capability: r.capability,
    adapterId: r.adapterId,
    status: r.status,
    costEstimateUsd: r.costEstimateUsd,
    costActualUsd: r.costActualUsd,
    error: r.error,
    createdAt: r.createdAt.getTime(),
    takeAssetIds: outputs.filter((t) => t.jobId === r.id).map((t) => t.assetId),
  }));
}

export type SpendView = {
  mode: "mock" | "live";
  todayUsd: number;
  monthUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
};

export async function spendSummary(db: Db, now = new Date()): Promise<SpendView> {
  const cfg = config();
  return {
    mode: cfg.providers,
    todayUsd: await committedSince(db, startOfDay(now)),
    monthUsd: await committedSince(db, startOfMonth(now)),
    dailyCapUsd: cfg.budget.dailyUsd,
    monthlyCapUsd: cfg.budget.monthlyUsd,
  };
}
