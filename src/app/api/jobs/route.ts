import { connection } from "next/server";
import { db } from "@/server/db/client";
import { recentJobs, spendSummary } from "@/server/queries";

/** Polled by the dashboard while jobs are running. */
export async function GET() {
  await connection();
  return Response.json({ jobs: await recentJobs(db()), spend: await spendSummary(db()) });
}
