import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mockAdapter } from "./mock";
import { defaultAdapter, getAdapter } from "./registry";

const dirs: string[] = [];
function ctx(now: number) {
  const workDir = mkdtempSync(join(tmpdir(), "retake-test-"));
  dirs.push(workDir);
  return { workDir, now: () => now };
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("mock adapter", () => {
  const adapter = mockAdapter("generate");

  it("estimates like a Fast-tier model", () => {
    const p = adapter.params.parse({ durationS: 5, takes: 2 });
    expect(adapter.estimateCostUsd(p)).toBeCloseTo(1.0);
  });

  it("stays pending until the delay passes, then renders real clips", async () => {
    const p = adapter.params.parse({ durationS: 1, takes: 2, mockDelayMs: 1000 });
    const ref = await adapter.submit(p, ctx(0));

    expect(await adapter.poll(ref, ctx(500))).toMatchObject({ state: "pending", retryAfterMs: 500 });

    const done = await adapter.poll(ref, ctx(1000));
    expect(done.state).toBe("succeeded");
    if (done.state !== "succeeded") return;
    expect(done.outputs).toHaveLength(2);
    expect(done.costUsd).toBe(0);
    for (const o of done.outputs) {
      expect(o.type === "file" && existsSync(o.path)).toBe(true);
    }
  }, 30_000);

  it("can simulate a moderation rejection", async () => {
    const p = adapter.params.parse({ mockOutcome: "reject", mockDelayMs: 0 });
    const ref = await adapter.submit(p, ctx(0));
    expect(await adapter.poll(ref, ctx(0))).toMatchObject({
      state: "failed",
      rejectedByModeration: true,
    });
  });
});

describe("registry", () => {
  it("uses mocks in mock mode", () => {
    expect(defaultAdapter("lipsync", { providers: "mock" }).id).toBe("mock:lipsync");
    expect(getAdapter("mock:generate")?.capability).toBe("generate");
  });

  it("explains when live mode has no provider yet", () => {
    expect(() => defaultAdapter("generate", { providers: "live" })).toThrow(/No live provider/);
  });
});
