import { join } from "node:path";
import { z } from "zod";
import { renderTestPattern } from "@/server/media/ffmpeg";
import type { Adapter, CapabilityId } from "./types";

/** What a real Fast-tier model roughly costs, so mock estimates look realistic. */
const MOCK_USD_PER_SECOND = 0.1;

const mockParams = z.object({
  prompt: z.string().default(""),
  durationS: z.number().int().min(1).max(15).default(5),
  takes: z.number().int().min(1).max(3).default(1),
  /** Lets tests and the UI exercise failure paths. */
  mockOutcome: z.enum(["succeed", "fail", "reject"]).default("succeed"),
  mockDelayMs: z.number().int().min(0).max(60_000).default(3_000),
});
type MockParams = z.infer<typeof mockParams>;

/** A free stand-in for any capability: waits, then renders a test-pattern clip. */
export function mockAdapter(capability: CapabilityId): Adapter<MockParams> {
  return {
    id: `mock:${capability}`,
    provider: "mock",
    capability,
    label: `Mock ${capability} (free)`,
    params: mockParams,
    estimateCostUsd: (p) => p.durationS * p.takes * MOCK_USD_PER_SECOND,
    async submit(p, ctx) {
      return { readyAt: ctx.now() + p.mockDelayMs, ...p };
    },
    async poll(ref, ctx) {
      const p = mockParams.parse(ref);
      const readyAt = Number(ref.readyAt);
      if (ctx.now() < readyAt) return { state: "pending", retryAfterMs: readyAt - ctx.now() };
      if (p.mockOutcome === "fail") return { state: "failed", error: "Mock failure" };
      if (p.mockOutcome === "reject") {
        return { state: "failed", error: "Mock moderation rejection", rejectedByModeration: true };
      }
      const outputs = [];
      for (let i = 0; i < p.takes; i++) {
        const path = join(ctx.workDir, `take-${i + 1}.mp4`);
        await renderTestPattern(path, { seconds: p.durationS });
        outputs.push({ type: "file" as const, path, mimeType: "video/mp4" });
      }
      // Real spend is $0; the ledger records only what we actually pay.
      return { state: "succeeded", outputs, costUsd: 0 };
    },
  };
}
