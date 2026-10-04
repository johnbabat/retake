import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

describe("parseConfig", () => {
  it("defaults to mock providers and the standard caps", () => {
    const c = parseConfig({});
    expect(c.providers).toBe("mock");
    expect(c.budget).toEqual({ dailyUsd: 15, monthlyUsd: 150, confirmOverUsd: 2 });
    expect(c.keys.fal).toBeUndefined();
  });

  it("reads caps and keys from the environment", () => {
    const c = parseConfig({
      PROVIDERS: "live",
      BUDGET_DAILY_USD: "5",
      BUDGET_MONTHLY_USD: "50",
      FAL_KEY: "test-key",
    });
    expect(c.providers).toBe("live");
    expect(c.budget.dailyUsd).toBe(5);
    expect(c.budget.monthlyUsd).toBe(50);
    expect(c.keys.fal).toBe("test-key");
  });

  it("treats empty keys as missing", () => {
    expect(parseConfig({ FAL_KEY: "" }).keys.fal).toBeUndefined();
  });

  it("rejects an unknown provider mode", () => {
    expect(() => parseConfig({ PROVIDERS: "real" })).toThrow();
  });

  it("rejects a daily cap above the monthly cap", () => {
    expect(() =>
      parseConfig({ BUDGET_DAILY_USD: "200", BUDGET_MONTHLY_USD: "150" }),
    ).toThrow(/cannot be larger/);
  });
});
