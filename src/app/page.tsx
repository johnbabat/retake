import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { recentJobs, spendSummary } from "@/server/queries";
import { Dashboard } from "./dashboard";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Retake</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Job runner check: queue a job, watch the worker pick it up, and play the takes.
        </p>
      </header>
      <Suspense fallback={<p className="text-zinc-500">Loading jobs…</p>}>
        <LiveDashboard />
      </Suspense>
    </main>
  );
}

async function LiveDashboard() {
  await connection();
  return <Dashboard initialJobs={await recentJobs(db())} initialSpend={await spendSummary(db())} />;
}
