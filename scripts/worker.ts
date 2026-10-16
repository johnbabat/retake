import { config } from "@/server/config";
import { db } from "@/server/db/client";
import { tick } from "@/server/jobs/worker";

const cfg = config();
const deps = { db: db(), dataDir: cfg.dataDir, log: (m: string) => console.log(`[worker] ${m}`) };

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("[worker] stopping after the current pass…");
    stopping = true;
  });
}

console.log(`[worker] running in ${cfg.providers} mode, data in ${cfg.dataDir}/`);
while (!stopping) {
  let worked = false;
  try {
    worked = await tick(deps);
  } catch (err) {
    console.error("[worker] pass failed:", err);
  }
  await new Promise((r) => setTimeout(r, worked ? 200 : 1_000));
}
process.exit(0);
