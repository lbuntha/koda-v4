import React, { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import { notificationLog, type PushLog, type SendRecord } from "../../lib/push";

/**
 * What was sent, and what became of it.
 *
 * The screen for the question this feature could not answer. Preflight says
 * whether a notification *would* work; the job report says what one run did and
 * then scrolls away. Nothing said whether last Sunday's summary actually
 * reached anybody — the delivery outcome lived in a return value and a log line.
 *
 * Two readings, and the order matters. The **summary** is what an operator
 * scans: a kind that has sent forty notifications and delivered none is exactly
 * this feature's failure mode, and it is invisible in forty rows that each look
 * individually fine. The **list** underneath is for the question that arrives
 * as a support message — "did this parent get it?" — which is asked of one
 * notification, not of a total.
 */

/** Delivered out of attempted, with the reason when the two differ. */
const Result: React.FC<{ send: SendRecord }> = ({ send }) => {
  if (send.driver === "console") {
    // Not a failure, and it is every developer's normal state. Saying "0
    // delivered" without saying why reads as a fault on every dev machine.
    return <span className="font-mono text-[10px] text-muted">logged only · console driver</span>;
  }
  if (send.devices === 0) {
    return (
      <span className="font-mono text-[10px] text-muted">no browser registered to ring</span>
    );
  }
  const failed = Object.entries(send.outcomes).filter(([name]) => name !== "ok");
  return (
    <span
      className={`font-mono text-[10px] ${
        send.delivered > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {send.delivered}/{send.devices} delivered
      {failed.length > 0 && ` · ${failed.map(([name, n]) => `${n} ${name}`).join(", ")}`}
    </span>
  );
};

export const PushLogPanel: React.FC = () => {
  const [log, setLog] = useState<PushLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setLog(await notificationLog());
    } catch {
      setError("Could not read the send log.");
    }
    setBusy(false);
  }, []);

  // An operator opening this page is already asking the question, and reading
  // the log delivers nothing to anybody.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="What was sent"
        subtitle="Every notification this deployment sent, and whether it arrived"
        icon={<History className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
      />

      {log && log.summary.length > 0 && (
        <div className="space-y-2">
          {log.summary.map((row) => (
            <div
              key={row.kind}
              className="bg-surface-muted border border-line rounded-2xl px-4 py-2 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-ink font-mono truncate">{row.kind}</h4>
                <p className="text-[10px] font-mono text-muted">
                  last {new Date(row.last).toLocaleString()}
                </p>
              </div>
              <span
                className={`shrink-0 font-mono text-[10px] ${
                  row.delivered > 0 || row.devices === 0
                    ? "text-muted"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {row.sends} sent · {row.delivered}/{row.devices} delivered
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {(log?.sends ?? []).map((send) => (
          <div key={send.id} className="bg-surface-muted border border-line rounded-2xl px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-ink truncate">{send.title}</h4>
                <p className="text-xs text-muted break-words">{send.body}</p>
                <p className="text-[10px] font-mono text-muted mt-1">
                  {send.kind} · {new Date(send.at).toLocaleString()} ·{" "}
                  {send.people.length} {send.people.length === 1 ? "person" : "people"}
                </p>
              </div>
              <Result send={send} />
            </div>
          </div>
        ))}
        {log && log.sends.length === 0 && !error && (
          <p className="text-xs text-muted">
            Nothing has been sent yet. A sign-in, a met goal or a Sunday summary will appear here.
          </p>
        )}
        {!log && !error && <p className="text-xs text-muted">Reading…</p>}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <button
        disabled={busy}
        onClick={() => void load()}
        className={themeSystem.button("secondary", "sm")}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        {busy ? "Reading…" : "Refresh"}
      </button>
    </section>
  );
};
