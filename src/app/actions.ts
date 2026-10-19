"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { config } from "@/server/config";
import { db } from "@/server/db/client";
import { createJob, type CreateJobResult } from "@/server/jobs/service";
import { sandboxProject } from "@/server/queries";
import { capabilities } from "@/server/providers/types";

const form = z.object({
  capability: z.enum(capabilities),
  prompt: z.string().max(2000).default(""),
  durationS: z.coerce.number().int().min(1).max(15),
  takes: z.coerce.number().int().min(1).max(3),
  mockOutcome: z.enum(["succeed", "fail", "reject"]).default("succeed"),
  confirmed: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export type QueueState = CreateJobResult | { status: "invalid"; message: string } | null;

export async function queueJob(_prev: QueueState, data: FormData): Promise<QueueState> {
  const parsed = form.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0].message };

  const { capability, confirmed, ...params } = parsed.data;
  const project = await sandboxProject(db());
  const result = await createJob(db(), config(), {
    projectId: project.id,
    capability,
    params,
    confirmed,
  });
  refresh();
  return result;
}
