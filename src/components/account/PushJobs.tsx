import React, { useEffect, useState } from "react";
import { CalendarClock, Eye, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIDataTable, UISectionHeader } from "../ui";
import {
  notificationJobs,
  runNotificationJob,
  type AbsenceLine,
  type AnnouncementLine,
  type DigestLine,
  type JobDefinition,
  type JobRun,
  type ReminderLine,
  type SummaryLine,
  type WouldSend,
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

/**
 * Why a preview came back with nothing. Two different reasons, and telling them
 * apart is the whole value of the message: on a fresh deployment nobody has
 * turned notifications on, and saying "no child practised" then sends an
 * operator to look at the learning data when the answer is that there is nobody
 * to send to yet.
 */
const EmptyPreview: React.FC<{ job: string; families?: number }> = ({ job, families }) => {
  if (!families) {
    return (
      <p className="text-xs text-muted">
        Nobody has notifications turned on yet, so there is no one to reach. Turn them on for one
        browser in Settings → Notifications, then look again. A browser signed in to an account
        with no family counts for nothing here — the jobs read families, not people.
      </p>
    );
  }
  const reason =
    job === "daily-reminders"
      ? "a child who has already practised today is deliberately left out — a reminder is for the one who has not"
      : job === "skill-announcements"
        ? "every family here has already been told about what was published"
        : job === "absence-check"
          ? "no child has been away longer than the threshold set in Events"
          : job === "daily-digest"
            ? "nobody who asked for a digest has a child who practised today"
            : "a child who has not practised this week is deliberately left out";
  return (
    <p className="text-xs text-muted">
      Nothing to send. Looked at {families} {families === 1 ? "family" : "families"} — {reason}.
    </p>
  );
};

/**
 * The one line under a preview card that is different for every job.
 *
 * Three jobs compose three different things and say so in three different
 * shapes, so the screen asks which job it is reading rather than reaching for
 * fields that are only ever on one of them. Reading a summary's Sunday off a
 * reminder is what put a literal "Invalid Date" in front of an operator.
 */
const lineNote = (job: string, line: WouldSend): { key: string; note: string; sent: boolean } => {
  if (job === "daily-reminders") {
    const l = line as ReminderLine;
    const why = l.streak > 0 ? `${l.streak}-day streak at stake` : "has not practised today";
    return {
      key: `${l.familyId}-${l.learnerId}`,
      // `people` is the number of adults whose chosen hour this is *and* who
      // have the kind switched on. Zero is not a rounding error — it is the
      // answer to "why did nothing arrive?", so it is shown rather than hidden.
      note: `${why} · ${l.people} ${l.people === 1 ? "parent" : "parents"} would be told`,
      sent: false,
    };
  }
  if (job === "skill-announcements") {
    const l = line as AnnouncementLine;
    return {
      key: `${l.familyId}-${l.skillId}`,
      note: `${l.skill} · ${String(l.theirLocalHour).padStart(2, "0")}:00 their time`,
      sent: l.alreadySent,
    };
  }
  if (job === "absence-check") {
    const l = line as AbsenceLine;
    return {
      key: `${l.familyId}-${l.learnerId}`,
      note: `away ${l.away} ${l.away === 1 ? "day" : "days"}`,
      sent: l.alreadySent,
    };
  }
  if (job === "daily-digest") {
    const l = line as DigestLine;
    return {
      key: l.familyId,
      note: `${l.people} ${l.people === 1 ? "parent" : "parents"} asked for it`,
      sent: false,
    };
  }
  const l = line as SummaryLine;
  return {
    key: `${l.familyId}-${l.learnerId}`,
    note: `due ${new Date(l.theirSundayEvening).toLocaleString()} their time`,
    sent: l.alreadySent,
  };
};

/** What a run composed but could not deliver, when that gap needs explaining. */
const Undelivered: React.FC<{ composed: number; sent?: number }> = ({ composed, sent }) =>
  composed > 0 && (sent ?? 0) === 0 ? (
    <p className="text-xs text-muted">
      Nothing actually left the process. That is what the console push driver does — it logs the
      notification instead of sending it — so on a deployment with <code>PUSH_DRIVER=console</code>{" "}
      this is the job working.
    </p>
  ) : null;

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
    if (lines.length === 0) return <EmptyPreview job={run.job} families={r.families} />;

    const noun =
      run.job === "daily-reminders"
        ? lines.length === 1
          ? "reminder"
          : "reminders"
        : run.job === "skill-announcements"
          ? lines.length === 1
            ? "announcement"
            : "announcements"
          : run.job === "absence-check"
            ? lines.length === 1
              ? "absence message"
              : "absence messages"
            : run.job === "daily-digest"
              ? lines.length === 1
                ? "digest"
                : "digests"
              : lines.length === 1
                ? "summary"
                : "summaries";

    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">
          {lines.length} {noun} across {r.families ?? 0}{" "}
          {r.families === 1 ? "family" : "families"}. Nothing was sent and nothing was claimed.
        </p>
        <UIDataTable<WouldSend>
          caption="Notification preview"
          rows={lines}
          rowKey={(line) => lineNote(run.job, line).key}
          pageSize={10}
          defaultSort={{ key: "title", direction: "asc" }}
          columns={[
            {
              key: "title",
              header: "Notification",
              render: (line) => (
                <div className="min-w-44">
                  <p className="font-semibold text-ink truncate">{line.title}</p>
                  <p className="text-[11px] text-muted break-words">{line.body}</p>
                </div>
              ),
              sortValue: (line) => line.title,
            },
            {
              key: "note",
              header: "Details",
              render: (line) => lineNote(run.job, line).note,
              muted: true,
            },
            {
              key: "status",
              header: "Status",
              render: (line) => lineNote(run.job, line).sent ? <Pill tone="off">SENT</Pill> : "Ready",
              align: "right",
              nowrap: true,
            },
          ]}
        />
      </div>
    );
  }

  // A real run that found nobody due is the *normal* answer nearly every hour,
  // and a row of zeroes reads like a failure. Say what happened, say when it
  // will happen, and point at the button that answers something today —
  // otherwise pressing this is a dead end with no next step.
  //
  // The fork below is the same in all three jobs: "nothing was due" and "there
  // is nobody registered" are different answers, and only one of them is about
  // the clock. A deployment where notifications have never been turned on
  // should not be told to wait until Sunday.
  const nobody = !r.families && (
    <p className="text-xs text-ink">
      Nothing to do — no browser on this deployment has notifications turned on yet. Turn them on
      for one in Settings → Notifications, and this job will have somebody to reach.
    </p>
  );

  if (run.job === "daily-reminders") {
    if (r.due === 0) {
      return (
        nobody || (
          <p className="text-xs text-ink">
            Nothing was due. It is nobody&rsquo;s chosen hour right now — the reminder goes at the
            hour each parent picked, so this is the job working rather than failing. Press{" "}
            <strong>Preview</strong> to read what it would say at that hour.
          </p>
        )
      );
    }
    const composed = (r.reminders ?? 0) + (r.streaks ?? 0);
    return (
      <div className="space-y-1">
        <p className="text-xs text-ink">
          {r.reminders ?? 0} {r.reminders === 1 ? "reminder" : "reminders"} and {r.streaks ?? 0}{" "}
          streak {r.streaks === 1 ? "warning" : "warnings"} composed, {r.sent ?? 0} delivered.
        </p>
        <Undelivered composed={composed} sent={r.sent} />
      </div>
    );
  }

  if (run.job === "skill-announcements") {
    if (!r.announcements) {
      return (
        nobody || (
          <p className="text-xs text-ink">
            {r.skills ?? 0} {r.skills === 1 ? "skill" : "skills"} published recently, and every
            family that can be reached has already been told. Nothing to say twice.
          </p>
        )
      );
    }
    return (
      <div className="space-y-1">
        <p className="text-xs text-ink">
          {r.skills ?? 0} {r.skills === 1 ? "skill" : "skills"} announced to {r.announcements}{" "}
          {r.announcements === 1 ? "family" : "families"}, {r.sent ?? 0} delivered.
        </p>
        <Undelivered composed={r.announcements ?? 0} sent={r.sent} />
      </div>
    );
  }

  if (run.job === "absence-check") {
    return r.absences ? (
      <p className="text-xs text-ink">
        {r.absences} absence {r.absences === 1 ? "message" : "messages"} composed, {r.sent ?? 0} pushed and{" "}
        {r.emailed ?? 0} emailed.
      </p>
    ) : (
      <p className="text-xs text-ink">
        Nobody is due one. It goes once, at each parent&rsquo;s reminder hour, for a child away longer
        than the threshold in Events. Press <strong>Preview</strong> to see who would be told.
      </p>
    );
  }

  if (run.job === "daily-digest") {
    return r.digests ? (
      <p className="text-xs text-ink">
        {r.digests} {r.digests === 1 ? "digest" : "digests"} composed, {r.emailed ?? 0} emailed.
      </p>
    ) : (
      <p className="text-xs text-ink">
        No digest was due. It goes at each parent&rsquo;s digest hour, only to parents who asked, and
        only on a day a child practised.
      </p>
    );
  }

  if (r.due === 0) {
    return (
      nobody || (
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
      )
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-ink">
        {r.summaries ?? 0} {r.summaries === 1 ? "summary" : "summaries"} composed, {r.sent ?? 0}{" "}
        delivered.
      </p>
      <Undelivered composed={r.summaries ?? 0} sent={r.sent} />
    </div>
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
        <strong>Preview</strong> is the one to reach for at almost any hour: it drops the clock
        these jobs are waiting on, sends nothing and claims nothing, so looking at Sunday does not
        stop Sunday from happening. <em>Run now</em> does the real thing, and most of the time it
        correctly does nothing — the clock, not the button, decides whose evening or whose chosen
        hour it is. It is safe to press twice either way: the same record that makes the
        scheduler&rsquo;s retries harmless applies here.
      </p>
    </section>
  );
};
