import React, { useEffect, useState } from "react";
import { CalendarClock, Eye, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import {
  notificationJobs,
  runNotificationJob,
  type JobDefinition,
  type JobRun,
} from "../../lib/push";

/**
 * Running the scheduled work by hand.
 *
 * Cloud Scheduler owns the clock, and for the summary that clock is six on a
 * Sunday evening — which is a bad thing to have to wait for twice: once when a
 * deployment is being set up and "does this work?" should not mean waiting five
 * days, and again after an operator edits the wording and wants to see it
 * against real families rather than against `SAMPLES`.
 *
 * The screen therefore offers two different things, and the difference is the
 * whole design:
 *
 * * **Preview** answers "what would Sunday send?". It drops the day-and-hour
 *   filter — a preview that is empty six days out of seven answers nothing —
 *   reports the wording each parent would read, and claims nothing. Looking at
 *   Sunday must not stop Sunday from happening.
 * * **Run now** does the real thing. Safe to press twice, because the ledger
 *   that makes Cloud Scheduler's retries harmless does not care that this
 *   caller has hands. On a Tuesday it correctly does nothing, and says so.
 *
 * What a preview does *not* drop is the operator ceiling or a family's own
 * preference. A preview showing a summary somebody has switched off would be a
 * preview of a different product.
 */
const Pill: React.FC<{ tone: "on" | "off"; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`shrink-0 font-mono text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border ${
      tone === "on"
        ? "text-violet-700 dark:text-violet-300 border-violet-500/40 bg-violet-500/10"
        : "text-slate-600 dark:text-slate-300 border-line bg-surface-muted"
    }`}
  >
    {children}
  </span>
);

/** The report, in the words an operator is actually asking in. */
const Outcome: React.FC<{ run: JobRun }> = ({ run }) => {
  const r = run.report;

  if (r.skipped) {
    return <p className="text-xs text-muted">Nothing sent — {r.skipped}.</p>;
  }

  if (run.job === "token-sweep") {
    return (
      <p className="text-xs text-ink">
        Deleted {r.tokens ?? 0} dead {r.tokens === 1 ? "token" : "tokens"}, {r.notifications ?? 0}{" "}
        old {r.notifications === 1 ? "notice" : "notices"} and {r.runs ?? 0} spent{" "}
        {r.runs === 1 ? "claim" : "claims"}.
      </p>
    );
  }

  if (run.preview) {
    const lines = r.would_send ?? [];
    if (lines.length === 0) {
      return (
        <p className="text-xs text-muted">
          Nothing to summarise. Looked at {r.families ?? 0}{" "}
          {r.families === 1 ? "family" : "families"} with a browser registered — a child who has
          not practised this week is deliberately left out.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">
          {lines.length} {lines.length === 1 ? "summary" : "summaries"} across {r.families ?? 0}{" "}
          {r.families === 1 ? "family" : "families"}. Nothing was sent and nothing was claimed.
        </p>
        {lines.map((line) => (
          <div
            key={`${line.familyId}-${line.learnerId}`}
            className="bg-surface border border-line rounded-2xl px-3 py-2 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <h5 className="text-sm font-bold text-ink truncate">{line.title}</h5>
              <p className="text-xs text-muted break-words">{line.body}</p>
              <p className="text-[10px] font-mono text-muted mt-1">
                due {new Date(line.theirSundayEvening).toLocaleString()} their time
              </p>
            </div>
            {line.alreadySent && <Pill tone="off">SENT</Pill>}
          </div>
        ))}
      </div>
    );
  }

  // A real run that found nobody due is the *normal* answer six days out of
  // seven, and "0 summaries" reads like a failure. Say what happened, say when
  // it will happen, and point at the button that answers something today —
  // otherwise pressing this is a dead end with no next step.
  if (r.due === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-ink">
          Nothing was due. It is nobody&rsquo;s Sunday evening right now, which is this job
          working rather than failing.
        </p>
        {r.nextDue && (
          <p className="text-xs text-muted">
            Next due {new Date(r.nextDue).toLocaleString()} — that family&rsquo;s own time, not
            yours. Press <strong>Preview</strong> to read what it will say.
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-xs text-ink">
      {r.summaries ?? 0} {r.summaries === 1 ? "summary" : "summaries"} composed, {r.sent ?? 0}{" "}
      delivered.
    </p>
  );
};

export const PushJobs: React.FC = () => {
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [run, setRun] = useState<JobRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void notificationJobs()
      .then(setJobs)
      .catch(() => setJobs([]));
  }, []);

  const go = async (job: string, preview: boolean) => {
    setBusy(`${job}:${preview}`);
    setError(null);
    try {
      setRun(await runNotificationJob(job, preview));
    } catch {
      setError("The job could not be run. Try again in a minute.");
    }
    setBusy(null);
  };

  if (jobs.length === 0) return null;

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Scheduled notifications"
        subtitle="Run the work the clock normally does — or see what it would do"
        icon={<CalendarClock className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
      />

      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-surface-muted border border-line rounded-2xl px-4 py-3 space-y-2"
          >
            <div>
              <h4 className="text-sm font-bold text-ink font-mono">{job.id}</h4>
              <p className="text-xs text-muted mt-0.5">{job.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* The sweep has nothing to preview: it deletes rows nothing can
                  use again, and a count of them is what a real run reports. */}
              {job.id !== "token-sweep" && (
                <button
                  disabled={busy !== null}
                  onClick={() => void go(job.id, true)}
                  className={themeSystem.button("primary", "sm")}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {busy === `${job.id}:true` ? "Looking…" : "Preview"}
                </button>
              )}
              <button
                disabled={busy !== null}
                onClick={() => void go(job.id, false)}
                className={themeSystem.button("secondary", "sm")}
              >
                <Play className="w-4 h-4 mr-2" />
                {busy === `${job.id}:false` ? "Running…" : "Run now"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {run && (
        <div className="bg-surface-muted border border-line rounded-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink font-mono">{run.job}</h4>
            <Pill tone={run.preview ? "off" : "on"}>{run.preview ? "PREVIEW" : "RAN"}</Pill>
          </div>
          <Outcome run={run} />
        </div>
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <p className="text-xs text-muted">
        <strong>Preview</strong> is the one to reach for on any day that is not Sunday: it sends
        nothing and claims nothing, so looking at Sunday does not stop Sunday from happening.{" "}
        <em>Run now</em> does the real thing, and on a weekday it correctly does nothing — the
        clock, not the button, decides whose evening it is. It is safe to press twice either way:
        the same record that makes the scheduler&rsquo;s retries harmless applies here.
      </p>
    </section>
  );
};
