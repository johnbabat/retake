import type { Config } from "@/server/config";
import type { Db } from "@/server/db/client";
import { jobs } from "@/server/db/schema";
import { defaultAdapter } from "@/server/providers/registry";
import type { CapabilityId } from "@/server/providers/types";
import { checkBudget } from "./budget";

export type CreateJobInput = {
  projectId: string;
  shotId?: string;
  capability: CapabilityId;
  params: Record<string, unknown>;
  /** Set once the user has approved a job above the confirmation threshold. */
  confirmed?: boolean;
};

export type CreateJobResult =
  | { status: "queued"; jobId: string; estimateUsd: number }
  | { status: "needs-confirmation"; estimateUsd: number }
  | { status: "over-budget"; estimateUsd: number; reason: string };

/** Validate, price and budget-check a job, then put it on the queue. */
export async function createJob(
  db: Db,
  cfg: Pick<Config, "providers" | "budget">,
  input: CreateJobInput,
): Promise<CreateJobResult> {
  const adapter = defaultAdapter(input.capability, cfg);
  const params = adapter.params.parse(input.params) as Record<string, unknown>;
  const estimateUsd = round2(adapter.estimateCostUsd(params));

  const budget = await checkBudget(db, estimateUsd, cfg.budget);
  if (!budget.ok) return { status: "over-budget", estimateUsd, reason: budget.reason };
  if (budget.needsConfirmation && !input.confirmed) {
    return { status: "needs-confirmation", estimateUsd };
  }

  const [job] = await db
    .insert(jobs)
    .values({
      projectId: input.projectId,
      shotId: input.shotId,
      capability: input.capability,
      adapterId: adapter.id,
      params,
      costEstimateUsd: estimateUsd,
    })
    .returning({ id: jobs.id });
  return { status: "queued", jobId: job.id, estimateUsd };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
