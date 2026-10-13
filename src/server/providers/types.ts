import type { z } from "zod";

/** What the app can ask a provider to do. Program scope: no face swap of other people. */
export const capabilities = [
  "generate",
  "replace-character",
  "motion",
  "change-action",
  "voice",
  "lipsync",
] as const;
export type CapabilityId = (typeof capabilities)[number];

/** A file the provider produced, either downloadable or already on disk. */
export type ProviderOutput =
  | { type: "url"; url: string; mimeType: string }
  | { type: "file"; path: string; mimeType: string };

export type PollResult =
  | { state: "pending"; retryAfterMs?: number }
  | { state: "succeeded"; outputs: ProviderOutput[]; costUsd: number }
  | { state: "failed"; error: string; rejectedByModeration?: boolean };

export type ProviderRef = Record<string, unknown>;

export interface AdapterContext {
  /** Scratch folder for this job's files. */
  workDir: string;
  now: () => number;
}

/**
 * One model at one provider for one capability. Every AI call in the app goes
 * through this interface so a model can be swapped without touching the rest.
 */
export interface Adapter<P = Record<string, unknown>> {
  id: string;
  provider: string;
  capability: CapabilityId;
  label: string;
  params: z.ZodType<P>;
  estimateCostUsd(params: P): number;
  submit(params: P, ctx: AdapterContext): Promise<ProviderRef>;
  poll(ref: ProviderRef, ctx: AdapterContext): Promise<PollResult>;
}
