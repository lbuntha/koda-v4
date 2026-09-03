import React, { useCallback, useEffect, useState } from "react";
import { MessageSquare, RotateCcw } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UISectionHeader } from "../ui";
import {
  notificationTemplates,
  resetNotificationWording,
  rewordNotification,
  type NotificationTemplate,
} from "../../lib/push";

/**
 * What every notification says on this deployment.
 *
 * The code ships wording for each kind and this is where an operator changes
 * it — to say it their way, or in their language. A row exists in the database
 * only once somebody has edited it, which is what makes "Reset" a delete rather
 * than a second copy of the default: a release that improves the shipped words
 * still reaches every deployment that never touched them.
 *
 * The placeholders are listed rather than documented elsewhere, because the
 * failure they prevent is specific and public — a notification reading
 * "{learner} met today's goal" on a parent's lock screen.
 */
const LIMITS = { title: 60, body: 160 };

/**
 * What a placeholder is filled with while somebody is writing.
 *
 * Mirrors the server's own samples, so the preview here is what the test send
 * puts on a phone. "Mia met today's goal" tells an operator what a parent will
 * read in a way that "{learner} met today's goal" cannot.
 */
const SAMPLES: Record<string, string> = {
  device: "Chrome on Mac",
  learner: "Mia",
  rounds: "6",
  skill: "Counting",
  days: "4",
  name: "Sam",
  decision: "approved",
  message: "Koda is down for maintenance until 6pm.",
};

const filled = (text: string): string =>
  Object.entries(SAMPLES).reduce((out, [key, value]) => out.split(`{${key}}`).join(value), text);

export const PushTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTemplates(await notificationTemplates());
      setDrafts({});
    } catch {
      setError("Could not load the notification wording.");
    }
  }, []);

  useEffect(() => void load(), [load]);

  const draftFor = (row: NotificationTemplate) =>
    drafts[row.id] ?? { title: row.title, body: row.body };

  const save = async (row: NotificationTemplate) => {
    const draft = draftFor(row);
    setBusy(row.id);
    setError(null);
    try {
      setTemplates(await rewordNotification(row.id, draft));
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    } catch {
      setError("That wording could not be saved.");
    }
    setBusy(null);
  };

  const reset = async (row: NotificationTemplate) => {
    setBusy(row.id);
    try {
      setTemplates(await resetNotificationWording(row.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    } catch {
      setError("Could not restore the original wording.");
    }
    setBusy(null);
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Notification wording"
        subtitle="What each kind says on a parent's lock screen"
        icon={<MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="space-y-3">
        {(templates ?? []).map((row) => {
          const draft = draftFor(row);
          const changed = draft.title !== row.title || draft.body !== row.body;
          return (
            <div key={row.id} className="bg-surface-muted border border-line rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-ink font-mono">{row.label}</h4>
                {row.edited && <UIBadge variant="info">Edited</UIBadge>}
                {row.class === "account" && <UIBadge variant="neutral">Always sent</UIBadge>}
              </div>

              <input
                value={draft.title}
                maxLength={LIMITS.title}
                aria-label={`${row.label} title`}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [row.id]: { ...draft, title: e.target.value } }))
                }
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:border-indigo-500"
              />
              <textarea
                value={draft.body}
                maxLength={LIMITS.body}
                rows={2}
                aria-label={`${row.label} body`}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [row.id]: { ...draft, body: e.target.value } }))
                }
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
              />

              {/* What it will actually look like. A lock screen shows one line
                  of each and hides the rest, which is easier to believe when
                  you can see it than when it is written in a caption. */}
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Preview</p>
                <p className="mt-1 truncate text-sm font-bold text-ink">{filled(draft.title)}</p>
                <p className="truncate text-xs text-body">{filled(draft.body)}</p>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted">
                  {row.placeholders.length ? (
                    <>
                      You can use{" "}
                      {row.placeholders.map((name, index) => (
                        <React.Fragment key={name}>
                          {index > 0 && ", "}
                          <code className="font-mono text-ink">{`{${name}}`}</code>
                        </React.Fragment>
                      ))}
                    </>
                  ) : (
                    "No placeholders — this one is the same sentence every time."
                  )}
                </p>
                <div className="flex gap-2">
                  {row.edited && (
                    <button
                      disabled={busy === row.id}
                      onClick={() => void reset(row)}
                      className={themeSystem.button("secondary", "sm")}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </button>
                  )}
                  <button
                    disabled={busy === row.id || !changed}
                    onClick={() => void save(row)}
                    className={themeSystem.button("primary", "sm")}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Kept short on purpose: a lock screen shows about one line of each, and hides the rest.
      </p>
    </section>
  );
};
