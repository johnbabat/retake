import { z } from "zod";

const usd = z.coerce.number().nonnegative();
const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  PROVIDERS: z.enum(["mock", "live"]).default("mock"),
  BUDGET_DAILY_USD: usd.default(15),
  BUDGET_MONTHLY_USD: usd.default(150),
  CONFIRM_JOB_OVER_USD: usd.default(2),
  DATA_DIR: z.string().default("data"),
  FAL_KEY: optionalKey,
  GEMINI_API_KEY: optionalKey,
  RUNWAYML_API_SECRET: optionalKey,
  SYNC_API_KEY: optionalKey,
  ELEVENLABS_API_KEY: optionalKey,
});

export type Config = {
  providers: "mock" | "live";
  budget: { dailyUsd: number; monthlyUsd: number; confirmOverUsd: number };
  dataDir: string;
  keys: {
    fal?: string;
    gemini?: string;
    runway?: string;
    sync?: string;
    elevenlabs?: string;
  };
};

export function parseConfig(env: Record<string, string | undefined>): Config {
  const e = schema.parse(env);
  if (e.BUDGET_DAILY_USD > e.BUDGET_MONTHLY_USD) {
    throw new Error("BUDGET_DAILY_USD cannot be larger than BUDGET_MONTHLY_USD");
  }
  return {
    providers: e.PROVIDERS,
    budget: {
      dailyUsd: e.BUDGET_DAILY_USD,
      monthlyUsd: e.BUDGET_MONTHLY_USD,
      confirmOverUsd: e.CONFIRM_JOB_OVER_USD,
    },
    dataDir: e.DATA_DIR,
    keys: {
      fal: e.FAL_KEY,
      gemini: e.GEMINI_API_KEY,
      runway: e.RUNWAYML_API_SECRET,
      sync: e.SYNC_API_KEY,
      elevenlabs: e.ELEVENLABS_API_KEY,
    },
  };
}

let cached: Config | undefined;

export function config(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
