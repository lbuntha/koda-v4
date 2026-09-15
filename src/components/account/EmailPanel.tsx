import React, { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import { ApiError } from "../../lib/sync";
import { emailStatus, notificationWording, sendTestEmail, type EmailStatus } from "../../lib/push";

/**
 * Whether notification email works here, answered on a screen.
 *
 * The same two questions the push overview answers: how is it set up, and does
 * a message actually arrive. The test goes to the caller's own address and
 * nowhere else, and naming a kind previews that kind's saved wording inside the
 * frame a parent would read.
 */
export const EmailPanel: React.FC = () => {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [kinds, setKinds] = useState<{ id: string; label: string }[]>([]);
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void emailStatus()
      .then(setStatus)
      .catch(() => setError("Could not read how email is set up."));
    void notificationWording()
      .then((wording) =>
        setKinds(wording.templates.filter((row) => row.email).map((row) => ({ id: row.id, label: row.label }))),
      )
      .catch(() => setKinds([]));
  }, []);

  const test = async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const sent = await sendTestEmail(kind || undefined);
      setResult(sent.sent ? `Sent to ${sent.to}.` : (sent.note ?? "Nothing was sent."));
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : "The test email could not be sent.");
    }
    setBusy(false);
  };

  const rows: [string, string][] = status
    ? [
        [
          "Sending",
          status.driver === "console"
            ? "Console — emails are written to the service log, not sent"
            : `SMTP through ${status.host ?? "the configured server"}`,
        ],
        ["From", status.from],
        ["Notification emails", status.enabled ? "On" : "Off — switch them on in Events"],
        [
          "Your address",
          status.you
            ? `${status.you}${status.youVerified ? "" : " (not verified, so nothing is sent to it)"}`
            : "This account has no email address",
        ],
      ]
    : [];

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Email"
        subtitle="Notification emails, and whether they arrive"
        icon={<Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {status && (
        <dl className="divide-y divide-line rounded-2xl border-2 border-line">
          {rows.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-xs font-bold text-muted">{term}</dt>
              <dd className="break-words text-sm text-ink sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!status && !error && <p className="text-xs text-muted">Reading…</p>}

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-ink">Send a test to yourself</h4>
        <p className="text-xs text-muted">
          It goes to your own address only. Pick a message to preview its saved wording, filled with
          sample values.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="Message to test"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={themeSystem.field("lg", "sm:flex-1")}
          >
            <option value="">A plain test email</option>
            {kinds.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void test()}
            className={themeSystem.button("primary", "sm", "shrink-0")}
          >
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Sending…" : "Send test"}
          </button>
        </div>
        {result && <p className="text-xs text-ink">{result}</p>}
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </section>
  );
};
