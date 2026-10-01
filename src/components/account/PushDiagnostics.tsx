import React, { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw, Send } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import {
  notificationTemplates,
  pushPreflight,
  sendTestNotification,
  type NotificationTemplate,
  type Preflight,
  type TestSendResult,
} from "../../lib/push";

import { translate } from "../../lib/i18n";
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
/**
 * One check's verdict, in three states rather than two.
 *
 * `null` is "could not be run", and it needs its own word. The reachability
 * check needs a real registered browser to validate a message against, and on a
 * deployment where nobody has turned notifications on there is not one — which
 * used to be drawn as a red FAIL directly above the words "not checked". That
 * sends an operator hunting a fault that does not exist. Grey and "SKIP" says
 * the true thing: this half cannot be proved yet.
 */
const Verdict: React.FC<{ ok: boolean | null }> = ({ ok }) => (
  /* The word, not only the colour: a state encoded in colour alone is a state
     somebody cannot read. */
  <span
    className={`shrink-0 font-mono text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border ${
      ok === null
        ? "text-slate-600 dark:text-slate-300 border-line bg-surface-muted"
        : ok
          ? "text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
          : "text-rose-700 dark:text-rose-300 border-rose-500/40 bg-rose-500/10"
    }`}
  >
    {ok === null ? translate("admin.pushDiagnostics.skip") : ok ? translate("admin.pushDiagnostics.pass") : translate("admin.pushDiagnostics.fail")}
  </span>
);

export const PushDiagnostics: React.FC = () => {
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [test, setTest] = useState<TestSendResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * Which wording to try. Empty means the plain "Test notification", which is
   * the right default: most of the time the question is "does push work at
   * all?", not "how does this sentence read?".
   */
  const [kind, setKind] = useState("");
  const [kinds, setKinds] = useState<NotificationTemplate[]>([]);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setPreflight(await pushPreflight());
    } catch {
      setError(translate("admin.pushDiagnostics.couldNotReachTheServiceTo"));
    }
    setChecking(false);
  }, []);

  // An operator opening this page is already asking the question, and the
  // check delivers nothing to anybody.
  useEffect(() => {
    void check();
    void notificationTemplates()
      .then(setKinds)
      .catch(() => setKinds([]));
  }, [check]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setTest(await sendTestNotification(kind || undefined));
      // A send can retire a dead token, so the counts above may have moved.
      await check();
    } catch {
      setError(translate("admin.pushDiagnostics.theTestCouldNotBeSent"));
    }
    setSending(false);
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={translate("admin.pushDiagnostics.notifications")}
        subtitle={translate("admin.pushDiagnostics.whetherPushActuallyWorksHereProved")}
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
                    {row.ok === null ? translate("admin.pushDiagnostics.next") : translate("admin.pushDiagnostics.fix")}
                  </span>
                  {row.fix}
                </p>
              )}
            </div>
            <Verdict ok={row.ok} />
          </div>
        ))}
        {!preflight && !error && (
          <p className="text-xs text-muted">{translate("admin.pushDiagnostics.checking")}</p>
        )}
      </div>

      {test && (
        <div className="bg-surface-muted border border-line rounded-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink font-mono">
              {translate("admin.pushDiagnostics.sentSentDriverDriver", { sent: test.sent, driver: test.driver })}
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
          {checking ? translate("admin.pushDiagnostics.checking") : translate("admin.pushDiagnostics.checkSetup")}
        </button>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label={translate("admin.pushDiagnostics.whichNotificationToPreview")}
          className="bg-surface border border-line rounded-2xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
        >
          <option value="">{translate("admin.pushDiagnostics.plainTestMessage")}</option>
          {kinds.map((row) => (
            <option key={row.id} value={row.id}>
              {translate("admin.pushDiagnostics.previewLabel", { label: row.label })}
            </option>
          ))}
        </select>
        <button
          disabled={sending}
          onClick={() => void send()}
          className={themeSystem.button("primary", "sm")}
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? translate("admin.pushDiagnostics.sending") : translate("admin.pushDiagnostics.sendTestToMyDevices")}
        </button>
      </div>

      <p className="text-xs text-muted">
        {translate("admin.pushDiagnostics.pickingAKindSends")}{" "}<em>{translate("admin.pushDiagnostics.thatKindSWording")}</em>{translate("admin.pushDiagnostics.filledWithSampleValuesSoYou")}
      </p>
    </section>
  );
};
