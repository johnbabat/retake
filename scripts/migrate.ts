import { join } from "node:path";
import { config } from "@/server/config";
import { openDatabase, runMigrations } from "@/server/db/client";

const file = join(config().dataDir, "retake.sqlite");
const handle = openDatabase(file);
await runMigrations(handle);
handle.sqlite.close();
console.log(`Database ready: ${file}`);
