import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { assets, jobs, takes } from "@/server/db/schema";
import { probe } from "@/server/media/ffmpeg";
import { getAdapter } from "@/server/providers/registry";
import type { Adapter, AdapterContext, ProviderOutput } from "@/server/providers/types";
import { recordCharge } from "./budget";

type Job = typeof jobs.$inferSelect;

export type WorkerDeps = {
  db: Db;
  dataDir: string;
  now?: () => number;
  log?: (msg: string) => void;
};

const MAX_ATTEMPTS = 2;
const MIN_POLL_MS = 1_000;
const MAX_POLL_MS = 30_000;

/**
 * One pass of the worker: start the oldest queued job, then poll every
 * running job that is due. Returns true if it did any work.
 */
export async function tick(deps: WorkerDeps): Promise<boolean> {
  const now = deps.now ?? Date.now;
  let worked = false;

  const queued = await deps.db.query.jobs.findFirst({
    where: eq(jobs.status, "queued"),
    orderBy: asc(jobs.createdAt),
  });
  if (queued) {
    await start(deps, queued, now);
    worked = true;
  }

  const due = await deps.db.query.jobs.findMany({
    where: and(
      eq(jobs.status, "running"),
      or(isNull(jobs.nextPollAt), lte(jobs.nextPollAt, new Date(now()))),
    ),
  });
  for (const job of due) {
    await check(deps, job, now);
    worked = true;
  }
  return worked;
}

async function start(deps: WorkerDeps, job: Job, now: () => number) {
  const adapter = getAdapter(job.adapterId);
  if (!adapter) return fail(deps, job, `Unknown provider "${job.adapterId}"`, now);

  const [claimed] = await deps.db
    .update(jobs)
    .set({ status: "running", attempts: job.attempts + 1, startedAt: new Date(now()), error: null })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
    .returning();
  if (!claimed) return;

  try {
    const ref = await adapter.submit(adapter.params.parse(job.params), await context(deps, job, now));
    await deps.db
      .update(jobs)
      .set({ providerRef: ref, nextPollAt: new Date(now()) })
      .where(eq(jobs.id, job.id));
    deps.log?.(`started ${job.id} on ${adapter.id}`);
  } catch (err) {
    await retryOrFail(deps, claimed, err, now);
  }
}

async function check(deps: WorkerDeps, job: Job, now: () => number) {
  const adapter = getAdapter(job.adapterId);
  if (!adapter) return fail(deps, job, `Unknown provider "${job.adapterId}"`, now);
  // Running without a provider reference means we crashed mid-submit: start over.
  if (!job.providerRef) return retryOrFail(deps, job, new Error("Lost track of the provider job"), now);

  try {
    const ctx = await context(deps, job, now);
    const result = await adapter.poll(job.providerRef, ctx);
    if (result.state === "pending") {
      const wait = clamp(result.retryAfterMs ?? 5_000, MIN_POLL_MS, MAX_POLL_MS);
      await deps.db.update(jobs).set({ nextPollAt: new Date(now() + wait) }).where(eq(jobs.id, job.id));
      return;
    }
    if (result.state === "failed") {
      return fail(deps, job, result.error, now, result.rejectedByModeration ? "rejected" : "failed");
    }
    await finish(deps, job, adapter, ctx, result.outputs, result.costUsd, now);
  } catch (err) {
    await retryOrFail(deps, job, err, now);
  }
}

async function finish(
  deps: WorkerDeps,
  job: Job,
  adapter: Adapter,
  ctx: AdapterContext,
  outputs: ProviderOutput[],
  costUsd: number,
  now: () => number,
) {
  // Record the charge first: if saving outputs fails we have still paid.
  await recordCharge(deps.db, { jobId: job.id, provider: adapter.provider, amountUsd: costUsd });

  for (const [i, output] of outputs.entries()) {
    const path =
      output.type === "file" ? output.path : await download(output.url, join(ctx.workDir, `output-${i + 1}.mp4`));
    const meta = output.mimeType.startsWith("video/") ? await probe(path) : null;
    const [asset] = await deps.db
      .insert(assets)
      .values({
        projectId: job.projectId,
        kind: "generated",
        path: relative(deps.dataDir, path),
        mimeType: output.mimeType,
        ...meta,
      })
      .returning({ id: assets.id });
    await deps.db.insert(takes).values({ jobId: job.id, assetId: asset.id });
  }

  await deps.db
    .update(jobs)
    .set({ status: "succeeded", costActualUsd: costUsd, finishedAt: new Date(now()), nextPollAt: null })
    .where(eq(jobs.id, job.id));
  deps.log?.(`finished ${job.id}: ${outputs.length} take(s), $${costUsd.toFixed(2)}`);
}

async function retryOrFail(deps: WorkerDeps, job: Job, err: unknown, now: () => number) {
  const message = err instanceof Error ? err.message : String(err);
  if (job.attempts < MAX_ATTEMPTS) {
    await deps.db
      .update(jobs)
      .set({ status: "queued", error: message, providerRef: null, nextPollAt: null })
      .where(eq(jobs.id, job.id));
    deps.log?.(`retrying ${job.id}: ${message}`);
    return;
  }
  await fail(deps, job, message, now);
}

async function fail(
  deps: WorkerDeps,
  job: Job,
  error: string,
  now: () => number,
  status: "failed" | "rejected" = "failed",
) {
  await deps.db
    .update(jobs)
    .set({ status, error, finishedAt: new Date(now()), nextPollAt: null })
    .where(eq(jobs.id, job.id));
  deps.log?.(`${status} ${job.id}: ${error}`);
}

async function context(deps: WorkerDeps, job: Job, now: () => number): Promise<AdapterContext> {
  const workDir = join(deps.dataDir, "projects", job.projectId, "jobs", job.id);
  await mkdir(workDir, { recursive: true });
  return { workDir, now };
}

async function download(url: string, path: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${url}`);
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(path));
  return path;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
