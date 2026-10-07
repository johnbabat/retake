import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const projects = sqliteTable("projects", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const assetKinds = [
  "upload",
  "proxy",
  "thumbnail",
  "generated",
  "reference",
  "export",
] as const;

/** Any media file on disk: uploads, proxies, AI outputs, exports. */
export const assets = sqliteTable("assets", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: assetKinds }).notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type"),
  durationMs: integer("duration_ms"),
  fps: real("fps"),
  width: integer("width"),
  height: integer("height"),
  hasAudio: integer("has_audio", { mode: "boolean" }),
  createdAt: createdAt(),
});

/** A shot detected inside an uploaded video. */
export const shots = sqliteTable("shots", {
  id: id(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  thumbnailAssetId: text("thumbnail_asset_id").references(() => assets.id),
});

/**
 * People or characters that can be inserted into shots.
 * While in the CC-CLI program only "self" and "fictional" are allowed.
 */
export const identities = sqliteTable("identities", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["self", "fictional"] }).notNull(),
  referenceAssetIds: text("reference_asset_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  voiceId: text("voice_id"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const jobStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "rejected",
  "cancelled",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

/** One AI operation. The jobs table doubles as the worker's queue. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shotId: text("shot_id").references(() => shots.id, { onDelete: "set null" }),
    capability: text("capability").notNull(),
    adapterId: text("adapter_id").notNull(),
    params: text("params", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: jobStatuses }).notNull().default("queued"),
    costEstimateUsd: real("cost_estimate_usd").notNull(),
    costActualUsd: real("cost_actual_usd"),
    providerRef: text("provider_ref", { mode: "json" }).$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: createdAt(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    nextPollAt: integer("next_poll_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

/** An output of a job that can be placed on the timeline. */
export const takes = sqliteTable("takes", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  finalised: integer("finalised", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** The edit: each item points at an original shot or a chosen take. */
export const timelineItems = sqliteTable("timeline_items", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  track: integer("track").notNull().default(0),
  position: integer("position").notNull(),
  sourceKind: text("source_kind", { enum: ["shot", "take"] }).notNull(),
  sourceId: text("source_id").notNull(),
  inMs: integer("in_ms").notNull(),
  outMs: integer("out_ms").notNull(),
});

/** Every dollar spent with a provider. */
export const ledger = sqliteTable(
  "ledger",
  {
    id: id(),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    amountUsd: real("amount_usd").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_created_at_idx").on(t.createdAt)],
);
