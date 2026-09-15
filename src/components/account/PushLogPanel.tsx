import React, { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIDataTable, UISectionHeader } from "../ui";
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
  const email = send.channel === "email";
  if (send.devices === 0) {
    return (
      <span className="font-mono text-[10px] text-muted">
        {email ? "no verified address to write to" : "no browser registered to ring"}
      </span>
    );
  }
  const failed = Object.entries(send.outcomes).filter(([name]) => name !== "ok" && name !== "sent");
  return (
    <span
      className={`font-mono text-[10px] ${
        send.delivered > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {send.delivered}/{send.devices} {email ? "emailed" : "delivered"}
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
        <UIDataTable
          caption="Notification summary"
          rows={log.summary}
          rowKey={(row) => `${row.kind}:${row.channel ?? "push"}`}
          pageSize={8}
          defaultSort={{ key: "last", direction: "desc" }}
          columns={[
            {
              key: "kind",
              header: "Kind",
              render: (row) => <span className="font-mono font-semibold text-ink">{row.kind}</span>,
              sortValue: (row) => row.kind,
            },
            {
              key: "channel",
              header: "Channel",
              render: (row) => (row.channel === "email" ? "Email" : "Push"),
              sortValue: (row) => row.channel ?? "push",
              muted: true,
              nowrap: true,
            },
            {
              key: "last",
              header: "Last sent",
              render: (row) => new Date(row.last).toLocaleString(),
              sortValue: (row) => row.last,
              nowrap: true,
              muted: true,
            },
            {
              key: "delivery",
              header: "Delivery",
              render: (row) => (
                <span className={row.delivered > 0 || row.devices === 0 ? "text-muted" : "text-rose-600 dark:text-rose-400"}>
                  {row.sends} sent · {row.delivered}/{row.devices}
                </span>
              ),
              sortValue: (row) => row.delivered,
              align: "right",
              nowrap: true,
            },
          ]}
        />
      )}

      <div>
        {log && log.sends.length > 0 && (
          <UIDataTable
            caption="Notification sends"
            rows={log.sends}
            rowKey={(send) => send.id}
            pageSize={10}
            defaultSort={{ key: "at", direction: "desc" }}
            columns={[
              {
                key: "notification",
                header: "Notification",
                render: (send) => (
                  <div className="min-w-44">
                    <p className="font-semibold text-ink truncate">{send.title}</p>
                    <p className="text-[11px] text-muted break-words">{send.body}</p>
                  </div>
                ),
              },
              {
                key: "kind",
                header: "Kind",
                render: (send) => send.kind,
                sortValue: (send) => send.kind,
                muted: true,
                nowrap: true,
              },
              {
                key: "channel",
                header: "Channel",
                render: (send) => (send.channel === "email" ? "Email" : "Push"),
                sortValue: (send) => send.channel ?? "push",
                muted: true,
                nowrap: true,
              },
              {
                key: "at",
                header: "Sent",
                render: (send) => new Date(send.at).toLocaleString(),
                sortValue: (send) => send.at,
                muted: true,
                nowrap: true,
              },
              {
                key: "result",
                header: "Result",
                render: (send) => <Result send={send} />,
                align: "right",
                nowrap: true,
              },
            ]}
          />
        )}
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
