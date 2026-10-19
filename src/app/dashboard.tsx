"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { JobView, SpendView } from "@/server/queries";
import { queueJob, type QueueState } from "./actions";

const CAPABILITIES = [
  ["generate", "Generate a shot"],
  ["replace-character", "Replace a character"],
  ["motion", "Copy a motion"],
  ["change-action", "Change the action"],
  ["voice", "Voice"],
  ["lipsync", "Lip sync"],
] as const;

const ACTIVE = new Set(["queued", "running"]);

export function Dashboard(props: { initialJobs: JobView[]; initialSpend: SpendView }) {
  const [jobs, setJobs] = useState(props.initialJobs);
  const [spend, setSpend] = useState(props.initialSpend);
  const [state, action, pending] = useActionState<QueueState, FormData>(queueJob, null);
  // What was last submitted, so "Confirm" re-sends exactly that.
  const lastSubmitted = useRef<FormData | null>(null);

  const active = jobs.some((j) => ACTIVE.has(j.status));
  const justQueued = state?.status === "queued";

  // Poll while something is in flight (or right after queueing).
  useEffect(() => {
    if (!active && !justQueued) return;
    async function load() {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs: JobView[]; spend: SpendView };
      setJobs(data.jobs);
      setSpend(data.spend);
    }
    void load();
    const timer = setInterval(load, 1500);
    return () => clearInterval(timer);
  }, [active, justQueued, state]);

  function submit(data: FormData) {
    lastSubmitted.current = data;
    startTransition(() => action(data));
  }

  function confirmAndQueue() {
    if (!lastSubmitted.current) return;
    const data = new FormData();
    lastSubmitted.current.forEach((value, key) => data.set(key, value));
    data.set("confirmed", "true");
    submit(data);
  }

  return (
    <div className="flex flex-col gap-8">
      <SpendBar spend={spend} />

      <form
        // onSubmit instead of action={...}: keeps the fields filled in after queueing.
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        <Field label="Feature">
          <select name="capability" className={input}>
            {CAPABILITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mock result">
          <select name="mockOutcome" className={input}>
            <option value="succeed">Succeed</option>
            <option value="fail">Fail</option>
            <option value="reject">Moderation rejection</option>
          </select>
        </Field>
        <Field label="Prompt" wide>
          <input name="prompt" placeholder="A slow pan across a beach at sunset" className={input} />
        </Field>
        <Field label="Seconds">
          <input name="durationS" type="number" min={1} max={15} defaultValue={5} className={input} />
        </Field>
        <Field label="Takes">
          <input name="takes" type="number" min={1} max={3} defaultValue={2} className={input} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Queueing…" : "Queue job"}
          </button>
          <Feedback state={state} onConfirm={confirmAndQueue} />
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent jobs</h2>
        {jobs.length === 0 && <p className="text-zinc-500">No jobs yet. Start the worker with <code>pnpm worker</code>.</p>}
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      </section>
    </div>
  );
}

const input =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

function Field(props: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${props.wide ? "sm:col-span-2" : ""}`}>
      <span className="text-zinc-600 dark:text-zinc-400">{props.label}</span>
      {props.children}
    </label>
  );
}

function Feedback({ state, onConfirm }: { state: QueueState; onConfirm: () => void }) {
  if (!state) return null;
  switch (state.status) {
    case "queued":
      return <span className="text-sm text-green-700 dark:text-green-400">Queued (~${state.estimateUsd.toFixed(2)})</span>;
    case "needs-confirmation":
      return (
        <span className="flex items-center gap-2 text-sm">
          This job costs ~${state.estimateUsd.toFixed(2)}.
          <button type="button" onClick={onConfirm} className="underline">
            Confirm and queue
          </button>
        </span>
      );
    case "over-budget":
      return <span className="text-sm text-red-700 dark:text-red-400">{state.reason}</span>;
    case "invalid":
      return <span className="text-sm text-red-700 dark:text-red-400">{state.message}</span>;
  }
}

function SpendBar({ spend }: { spend: SpendView }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        Mode: <strong className="text-zinc-900 dark:text-zinc-100">{spend.mode}</strong>
      </span>
      <span>
        Today: ${spend.todayUsd.toFixed(2)} / ${spend.dailyCapUsd.toFixed(2)}
      </span>
      <span>
        This month: ${spend.monthUsd.toFixed(2)} / ${spend.monthlyCapUsd.toFixed(2)}
      </span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  succeeded: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  rejected: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  cancelled: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

function JobCard({ job }: { job: JobView }) {
  const cost = job.costActualUsd ?? job.costEstimateUsd;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status] ?? ""}`}>
          {job.status}
        </span>
        <span className="font-medium">{job.capability}</span>
        <span className="text-zinc-500">{job.adapterId}</span>
        <span className="ml-auto text-zinc-500">
          {job.costActualUsd === null ? "est. " : ""}${cost.toFixed(2)}
        </span>
      </div>
      {job.error && <p className="text-sm text-red-700 dark:text-red-400">{job.error}</p>}
      {job.takeAssetIds.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {job.takeAssetIds.map((id, i) => (
            <figure key={id} className="flex flex-col gap-1">
              <video src={`/api/assets/${id}`} controls preload="metadata" className="w-full rounded bg-black" />
              <figcaption className="text-xs text-zinc-500">Take {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </li>
  );
}
