import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mail, MessageSquare, RotateCcw, Send } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UISectionHeader } from "../ui";
import { ApiError } from "../../lib/sync";
import {
  notificationWording,
  resetEmailFrame,
  resetNotificationEmail,
  resetNotificationWording,
  rewordEmailFrame,
  rewordNotification,
  rewordNotificationEmail,
  sendTestEmail,
  type EmailFrame,
  type EmailFramePart,
  type NotificationTemplate,
  type NotificationWording,
} from "../../lib/push";

/**
 * What every notification says on this deployment — on a lock screen and in an
 * inbox.
 *
 * The code ships wording for each kind and this is where an operator changes
 * it. A row exists in the database only once somebody has edited it, which is
 * what makes "Reset" a delete rather than a second copy of the default: a
 * release that improves the shipped words still reaches every deployment that
 * never touched them.
 *
 * A kind this build also emails has a Push and an Email tab, and every email is
 * wrapped in one shared frame — the greeting and the footer — edited once at
 * the bottom. Placeholders are chips that write themselves in at the cursor,
 * and one that nothing fills is flagged as it is typed; the server refuses to
 * save it either way, because "{learnr} met today's goal" on a parent's lock
 * screen is the failure this whole screen exists to prevent.
 */
const LIMITS = { title: 60, body: 160, subject: 120, emailBody: 4000, frame: 1000 };

/**
 * What a placeholder is filled with while somebody is writing.
 *
 * Mirrors the server's own samples, so the preview here is what the test send
 * puts on a phone or in an inbox.
 */
const SAMPLES: Record<string, string> = {
  device: "Chrome on Mac",
  learner: "Mia",
  rounds: "6",
  skill: "Counting",
  days: "4",
  practice: "4 days",
  away: "3 days",
  name: "Sam",
  decision: "approved",
  message: "Koda is down for maintenance until 6pm.",
  title: "Koda",
  parent: "Dara",
  family: "The Riveras",
  app_link: "https://learn-with-koda.web.app",
  kind_label: "Announcements",
  unsubscribe_link: "https://learn-with-koda.web.app/v1/notifications/unsubscribe?token=…",
};

export const filled = (text: string): string =>
  Object.entries(SAMPLES).reduce((out, [key, value]) => out.split(`{${key}}`).join(value), text);

/** Placeholders in `text` that nothing will fill — the server's rule, run as somebody types. */
export const unknownPlaceholders = (text: string, allowed: string[]): string[] => {
  const unknown = new Set<string>();
  for (const match of text.matchAll(/\{([a-z_]+)\}/g)) {
    if (!allowed.includes(match[1])) unknown.add(match[1]);
  }
  return [...unknown].sort();
};

/** An email as a parent would read it: the kind's words inside the frame. */
export const framed = (frame: EmailFrame, row: NotificationTemplate, body: string): string => {
  const letter = frame.body.split("{message}").join(filled(body));
  const footer =
    row.class === "account" ? frame.accountFooter : frame.footer.split("{kind_label}").join(row.label);
  return `${filled(letter)}\n\n---\n${filled(footer)}`;
};

const describe = (error: unknown, fallback: string): string =>
  error instanceof ApiError && error.message ? error.message : fallback;

const INPUT =
  "w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500";

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Write `{name}` into a field at its cursor, then put the cursor after it. */
const insertAt = (el: Field | null | undefined, value: string, name: string, apply: (next: string) => void) => {
  const token = `{${name}}`;
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  apply(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(start + token.length, start + token.length);
  });
};

const Chips: React.FC<{ names: string[]; onPick(name: string): void }> = ({ names, onPick }) => (
  <div className="flex flex-wrap gap-1.5">
    {names.map((name) => (
      <button
        key={name}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(name)}
        className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-ink transition hover:border-indigo-400 cursor-pointer"
      >
        {`{${name}}`}
      </button>
    ))}
  </div>
);

const Unknown: React.FC<{ names: string[] }> = ({ names }) =>
  names.length ? (
    <p className="text-xs text-rose-600 dark:text-rose-400">
      {names.map((name) => `{${name}}`).join(", ")} {names.length === 1 ? "isn't" : "aren't"} a
      placeholder for this message.
    </p>
  ) : null;

type Channel = "push" | "email";
type Draft = { title: string; body: string; subject: string; emailBody: string };
type DraftKey = keyof Draft;

const draftOf = (row: NotificationTemplate): Draft => ({
  title: row.title,
  body: row.body,
  subject: row.email?.subject ?? "",
  emailBody: row.email?.body ?? "",
});

const WordingCard: React.FC<{
  row: NotificationTemplate;
  frame: EmailFrame;
  onTemplates(templates: NotificationTemplate[]): void;
  onWording(wording: NotificationWording): void;
}> = ({ row, frame, onTemplates, onWording }) => {
  const [channel, setChannel] = useState<Channel>("push");
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fields = useRef<Partial<Record<DraftKey, Field | null>>>({});
  const lastField = useRef<DraftKey | null>(null);

  // A save hands back the stored words; the draft follows them.
  useEffect(() => {
    setDraft(draftOf(row));
  }, [row.title, row.body, row.email?.subject, row.email?.body]); // eslint-disable-line react-hooks/exhaustive-deps

  const email = channel === "email" && row.email ? row.email : null;
  const keys: DraftKey[] = email ? ["subject", "emailBody"] : ["title", "body"];
  const original = draftOf(row);
  const changed = keys.some((key) => draft[key] !== original[key]);
  const allowed = email ? email.placeholders : row.placeholders;
  const unknown = unknownPlaceholders(keys.map((key) => draft[key]).join("\n"), allowed);
  const edited = email ? email.edited : row.edited;

  const set = (key: DraftKey, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const bind = (key: DraftKey) => ({
    ref: (el: Field | null) => {
      fields.current[key] = el;
    },
    onFocus: () => {
      lastField.current = key;
    },
  });

  const pick = (name: string) => {
    const key = lastField.current && keys.includes(lastField.current) ? lastField.current : keys[1];
    insertAt(fields.current[key], draft[key], name, (next) => set(key, next));
  };

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await work();
    } catch (e) {
      setError(describe(e, fallback));
    }
    setBusy(false);
  };

  const save = () =>
    run(async () => {
      if (email) {
        onWording(await rewordNotificationEmail(row.id, { subject: draft.subject, body: draft.emailBody }));
      } else {
        onTemplates(await rewordNotification(row.id, { title: draft.title, body: draft.body }));
      }
    }, "That wording could not be saved.");

  const reset = () =>
    run(async () => {
      if (email) onWording(await resetNotificationEmail(row.id));
      else onTemplates(await resetNotificationWording(row.id));
    }, "Could not restore the original wording.");

  const test = () =>
    run(async () => {
      const result = await sendTestEmail(row.id);
      setNote(result.sent ? `Sent to ${result.to}, using the saved wording.` : (result.note ?? "Nothing was sent."));
    }, "The test email could not be sent.");

  return (
    <div data-wording={row.id} className="space-y-3 rounded-2xl border border-line bg-surface-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-ink">{row.label}</h4>
        {edited && <UIBadge variant="info">Edited</UIBadge>}
        {row.class === "account" && <UIBadge variant="neutral">Always sent</UIBadge>}
        {row.email && (
          <div
            role="tablist"
            aria-label={`${row.label} channel`}
            className="ml-auto inline-flex rounded-full border border-line bg-surface p-0.5"
          >
            {(["push", "email"] as Channel[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={channel === option}
                onClick={() => {
                  setChannel(option);
                  setError(null);
                  setNote(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  channel === option ? "bg-indigo-600 text-white" : "text-muted hover:text-ink"
                }`}
              >
                {option === "push" ? "Push" : "Email"}
              </button>
            ))}
          </div>
        )}
      </div>

      {email ? (
        <>
          <input
            {...bind("subject")}
            value={draft.subject}
            maxLength={LIMITS.subject}
            aria-label={`${row.label} email subject`}
            onChange={(e) => set("subject", e.target.value)}
            className={`${INPUT} font-bold`}
          />
          <textarea
            {...bind("emailBody")}
            value={draft.emailBody}
            maxLength={LIMITS.emailBody}
            rows={6}
            aria-label={`${row.label} email body`}
            onChange={(e) => set("emailBody", e.target.value)}
            className={INPUT}
          />
        </>
      ) : (
        <>
          <input
            {...bind("title")}
            value={draft.title}
            maxLength={LIMITS.title}
            aria-label={`${row.label} title`}
            onChange={(e) => set("title", e.target.value)}
            className={`${INPUT} font-bold`}
          />
          <textarea
            {...bind("body")}
            value={draft.body}
            maxLength={LIMITS.body}
            rows={2}
            aria-label={`${row.label} body`}
            onChange={(e) => set("body", e.target.value)}
            className={INPUT}
          />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowed.length ? (
          <Chips names={allowed} onPick={pick} />
        ) : (
          <p className="text-xs text-muted">No placeholders — this one is the same sentence every time.</p>
        )}
        {!email && (
          <p className="font-mono text-[11px] text-muted">
            {draft.title.length}/{LIMITS.title} · {draft.body.length}/{LIMITS.body}
          </p>
        )}
      </div>

      <Unknown names={unknown} />

      {/* What it will actually look like. A lock screen shows one line of each
          and hides the rest, which is easier to believe when you can see it. */}
      <div className="rounded-xl border border-line bg-surface px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Preview</p>
        {email ? (
          <>
            <p className="mt-1 break-words text-sm font-bold text-ink">{filled(draft.subject)}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs text-body">
              {framed(frame, row, draft.emailBody)}
            </pre>
          </>
        ) : (
          <>
            <p className="mt-1 truncate text-sm font-bold text-ink">{filled(draft.title)}</p>
            <p className="truncate text-xs text-body">{filled(draft.body)}</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {note && <p className="text-xs text-ink">{note}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {email && (
          <button type="button" disabled={busy} onClick={() => void test()} className={themeSystem.button("secondary", "sm")}>
            <Send className="w-4 h-4 mr-2" />
            Send test to me
          </button>
        )}
        {edited && (
          <button type="button" disabled={busy} onClick={() => void reset()} className={themeSystem.button("secondary", "sm")}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
        )}
        <button
          type="button"
          disabled={busy || !changed}
          onClick={() => void save()}
          className={themeSystem.button("primary", "sm")}
        >
          Save
        </button>
      </div>
    </div>
  );
};

const FRAME_PARTS: { part: EmailFramePart; label: string; rows: number }[] = [
  { part: "body", label: "Greeting", rows: 5 },
  { part: "footer", label: "Footer on updates", rows: 3 },
  { part: "accountFooter", label: "Footer on account notices", rows: 2 },
];

const FrameEditor: React.FC<{ frame: EmailFrame; onWording(wording: NotificationWording): void }> = ({
  frame,
  onWording,
}) => {
  const original = { body: frame.body, footer: frame.footer, accountFooter: frame.accountFooter };
  const [draft, setDraft] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = useRef<Partial<Record<EmailFramePart, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    setDraft({ body: frame.body, footer: frame.footer, accountFooter: frame.accountFooter });
  }, [frame.body, frame.footer, frame.accountFooter]);

  const changed = FRAME_PARTS.some(({ part }) => draft[part] !== original[part]);
  const missing = FRAME_PARTS.filter(({ part }) => {
    const required = frame.required[part];
    return required && !draft[part].includes(`{${required}}`);
  });

  const run = async (work: () => Promise<NotificationWording>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      onWording(await work());
    } catch (e) {
      setError(describe(e, fallback));
    }
    setBusy(false);
  };

  return (
    <div data-frame className="space-y-4">
      {FRAME_PARTS.map(({ part, label, rows }) => {
        const required = frame.required[part];
        const lacking = Boolean(required && !draft[part].includes(`{${required}}`));
        return (
          <div key={part} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor={`frame-${part}`} className="text-xs font-bold text-ink">
                {label}
              </label>
              {required && (
                <span className={`text-[11px] ${lacking ? "text-rose-600 dark:text-rose-400" : "text-muted"}`}>
                  Must keep {`{${required}}`}
                </span>
              )}
            </div>
            <textarea
              id={`frame-${part}`}
              ref={(el) => {
                fields.current[part] = el;
              }}
              value={draft[part]}
              maxLength={part === "body" ? LIMITS.emailBody : LIMITS.frame}
              rows={rows}
              onChange={(e) => setDraft((current) => ({ ...current, [part]: e.target.value }))}
              className={INPUT}
            />
            <Chips
              names={frame.placeholders[part]}
              onPick={(name) =>
                insertAt(fields.current[part], draft[part], name, (next) =>
                  setDraft((current) => ({ ...current, [part]: next })),
                )
              }
            />
            <Unknown names={unknownPlaceholders(draft[part], frame.placeholders[part])} />
          </div>
        );
      })}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {frame.edited && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(resetEmailFrame, "Could not restore the original frame.")}
            className={themeSystem.button("secondary", "sm")}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
        )}
        <button
          type="button"
          disabled={busy || !changed || missing.length > 0}
          onClick={() => void run(() => rewordEmailFrame(draft), "That frame could not be saved.")}
          className={themeSystem.button("primary", "sm")}
        >
          Save frame
        </button>
      </div>
    </div>
  );
};

export const PushTemplates: React.FC = () => {
  const [wording, setWording] = useState<NotificationWording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWording(await notificationWording());
    } catch {
      setError("Could not load the notification wording.");
    }
  }, []);

  useEffect(() => void load(), [load]);

  const onTemplates = (templates: NotificationTemplate[]) =>
    setWording((current) => (current ? { ...current, templates } : current));

  return (
    <div className="space-y-4">
      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title="Notification wording"
          subtitle="What each notification says — on a lock screen and in an inbox"
          icon={<MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {!wording && !error && <p className="text-xs text-muted">Reading…</p>}

        <div className="space-y-3">
          {wording?.templates.map((row) => (
            <WordingCard
              key={row.id}
              row={row}
              frame={wording.frame}
              onTemplates={onTemplates}
              onWording={setWording}
            />
          ))}
        </div>

        <p className="text-xs text-muted">
          Kept short on purpose: a lock screen shows about one line of each, and hides the rest.
        </p>
      </section>

      {wording && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Email frame"
            subtitle="The greeting and footer around every notification email"
            icon={<Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          />
          <FrameEditor frame={wording.frame} onWording={setWording} />
        </section>
      )}
    </div>
  );
};
