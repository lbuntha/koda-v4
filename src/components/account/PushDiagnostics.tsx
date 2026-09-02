import React, { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw, Send } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import {
  pushPreflight,
  sendTestNotification,
  type Preflight,
  type TestSendResult,
} from "../../lib/push";

/**
 * Whether notifications actually work on this deployment.
 *
 * Push is the one feature here an operator cannot verify by looking at it: its
 * path runs through a Google service, a credential minted from a metadata
 * server, a certificate generated in a console, a browser permission and a
 * worker inside somebody else's phone. Six things that can each be individually
 * correct and still not add up — and whose failure mode is *silence*. Nothing
 * errors; parents simply never hear anything.
 *
 * So this screen answers it twice, and the difference matters:
 *
 * * **Check setup** proves the pipe and delivers nothing. It runs on open,
 *   because an operator on this page is already asking the question.
 * * **Send to my devices** delivers a real notification, to the person pressing
 *   it and nobody else. There is no recipient to choose here and there never
 *   will be: a test that can name a target is a way to put words on a
 *   stranger's lock screen.
 */
const Verdict: React.FC<{ ok: boolean }> = ({ ok }) => (
  /* The word, not only the colour: a state encoded in colour alone is a state
     somebody cannot read. */
  <span
    className={`shrink-0 font-mono text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border ${
      ok
        ? "text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
        : "text-rose-700 dark:text-rose-300 border-rose-500/40 bg-rose-500/10"
    }`}
  >
    {ok ? "PASS" : "FAIL"}
  </span>
);

export const PushDiagnostics: React.FC = () => {
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [test, setTest] = useState<TestSendResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setPreflight(await pushPreflight());
    } catch {
      setError("Could not reach the service to check.");
    }
    setChecking(false);
  }, []);

  // An operator opening this page is already asking the question, and the
  // check delivers nothing to anybody.
  useEffect(() => {
    void check();
  }, [check]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setTest(await sendTestNotification());
      // A send can retire a dead token, so the counts above may have moved.
      await check();
    } catch {
      setError("The test could not be sent. Try again in a minute.");
    }
    setSending(false);
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Notifications"
        subtitle="Whether push actually works here — proved rather than assumed"
        icon={<Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <div className="space-y-2">
        {(preflight?.checks ?? []).map((row) => (
          <div
            key={row.check}
            className="bg-surface-muted border border-line rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-ink font-mono">{row.check}</h4>
              <p className="text-xs text-muted mt-0.5 break-words">{row.detail}</p>
              {row.fix && (
                <p className="text-xs text-ink mt-1 break-words">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Fix{" "}
                  </span>
                  {row.fix}
                </p>
              )}
            </div>
            <Verdict ok={row.ok} />
          </div>
        ))}
        {!preflight && !error && (
          <p className="text-xs text-muted">Checking…</p>
        )}
      </div>

      {test && (
        <div className="bg-surface-muted border border-line rounded-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink font-mono">
              {test.sent} sent · driver {test.driver}
            </h4>
            <Verdict ok={test.sent > 0} />
          </div>
          {test.note && <p className="text-xs text-muted">{test.note}</p>}
          {test.results.map((row, index) => (
            <div key={`${row.device}-${index}`} className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink truncate">
                {row.device}
                {row.error ? ` — ${row.error}` : ""}
              </p>
              <Verdict ok={row.ok} />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          disabled={checking}
          onClick={() => void check()}
          className={themeSystem.button("secondary", "sm")}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {checking ? "Checking…" : "Check setup"}
        </button>
        <button
          disabled={sending}
          onClick={() => void send()}
          className={themeSystem.button("primary", "sm")}
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? "Sending…" : "Send test to my devices"}
        </button>
      </div>

      <p className="text-xs text-muted">
        The test rings only the browsers you have turned notifications on in — it takes no
        recipient. Checking delivers nothing to anybody.
      </p>
    </section>
  );
};
