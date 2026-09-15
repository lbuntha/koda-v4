import React, { useState } from "react";
import { Megaphone } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../ui";
import {
  sendAnnouncement,
  type AnnouncementAudience,
  type AnnouncementReport,
} from "../../lib/push";

/**
 * An operator's own message, pushed to phones the moment they press Send.
 *
 * Two presses rather than one, and the first is not an "are you sure": it asks
 * the server who the audience actually is, so the button that sends reads
 * "Send to 212 people" rather than a plain Send. Editing anything after that
 * withdraws the count, because it no longer describes what would go.
 */
const LIMITS = { title: 60, message: 160 };

const AUDIENCES: { id: AnnouncementAudience; label: string; hint: string }[] = [
  { id: "families", label: "Families", hint: "Every parent and caregiver" },
  { id: "staff", label: "Staff", hint: "People who run this deployment" },
  { id: "everyone", label: "Everyone", hint: "Families and staff" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function reachOf(report: AnnouncementReport): string {
  const groups: string[] = [];
  if (report.audience !== "staff") groups.push(plural(report.families, "family", "families"));
  if (report.audience !== "families") {
    groups.push(plural(report.staff, "member of staff", "members of staff"));
  }
  const emails =
    report.emails !== undefined
      ? ` and ${plural(report.emails, "verified email address", "verified email addresses")}`
      : "";
  return (
    `${plural(report.people, "person", "people")} across ${groups.join(" and ")}, ` +
    `with ${plural(report.devices ?? 0, "browser")} to ring${emails}.`
  );
}

type Stage =
  | { name: "writing" }
  | { name: "checking" }
  | { name: "confirming"; reach: AnnouncementReport }
  | { name: "sending"; reach: AnnouncementReport }
  | { name: "sent"; result: AnnouncementReport };

export const PushAnnounce: React.FC = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("families");
  const [email, setEmail] = useState(false);
  const [stage, setStage] = useState<Stage>({ name: "writing" });
  const [error, setError] = useState<string | null>(null);

  const draft = { title: title.trim(), message: message.trim(), audience, email };
  const busy = stage.name === "checking" || stage.name === "sending";

  const edit = (apply: () => void) => {
    apply();
    setError(null);
    if (stage.name !== "writing") setStage({ name: "writing" });
  };

  const check = async () => {
    setStage({ name: "checking" });
    setError(null);
    try {
      const reach = await sendAnnouncement(draft, true);
      if (reach.skipped) {
        setStage({ name: "writing" });
        setError(`Nothing can be sent: ${reach.skipped}.`);
      } else if (!reach.people) {
        setStage({ name: "writing" });
        setError("Nobody is in that audience yet.");
      } else {
        setStage({ name: "confirming", reach });
      }
    } catch {
      setStage({ name: "writing" });
      setError("Could not check who this reaches. Try again.");
    }
  };

  const send = async (reach: AnnouncementReport) => {
    setStage({ name: "sending", reach });
    setError(null);
    try {
      const result = await sendAnnouncement(draft, false);
      if (result.skipped) {
        setStage({ name: "writing" });
        setError(`Nothing was sent: ${result.skipped}.`);
        return;
      }
      setTitle("");
      setMessage("");
      setStage({ name: "sent", result });
    } catch {
      // A timeout is not proof it failed: the server may still be ringing
      // phones. Sending again blind is how a family gets it twice.
      setStage({ name: "confirming", reach });
      setError("The announcement may not have gone out. Check What was sent before trying again.");
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Announce"
        subtitle="Write a message and push it to phones now"
        icon={<Megaphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <div className="space-y-2">
        <input
          value={title}
          maxLength={LIMITS.title}
          placeholder="Title (optional — Koda)"
          aria-label="Announcement title"
          disabled={busy}
          onChange={(e) => edit(() => setTitle(e.target.value))}
          className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:border-indigo-500"
        />
        <textarea
          value={message}
          maxLength={LIMITS.message}
          rows={3}
          placeholder="What do you want to tell people?"
          aria-label="Announcement message"
          disabled={busy}
          onChange={(e) => edit(() => setMessage(e.target.value))}
          className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
        />
        <p className="text-right text-[11px] text-muted">
          {message.length}/{LIMITS.message}
        </p>
      </div>

      <div role="radiogroup" aria-label="Audience" className="grid gap-2 sm:grid-cols-3">
        {AUDIENCES.map((option) => {
          const selected = option.id === audience;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => edit(() => setAudience(option.id))}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                  : "border-line bg-surface hover:border-indigo-300"
              }`}
            >
              <span className="block text-sm font-bold text-ink">{option.label}</span>
              <span className="block text-xs text-muted">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={email}
          disabled={busy}
          onChange={(e) => edit(() => setEmail(e.target.checked))}
          className="h-4 w-4 accent-indigo-600"
        />
        Also send by email
      </label>

      {/* A lock screen shows about one line of each. */}
      <div className="rounded-xl border border-line bg-surface-muted px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Preview</p>
        <p className="mt-1 truncate text-sm font-bold text-ink">{draft.title || "Koda"}</p>
        <p className="truncate text-xs text-body">{draft.message || "Your message"}</p>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {stage.name === "confirming" || stage.name === "sending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2">
          <p className="text-sm text-ink">This reaches {reachOf(stage.reach)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={stage.name === "sending"}
              onClick={() => setStage({ name: "writing" })}
              className={themeSystem.button("secondary", "sm")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={stage.name === "sending"}
              onClick={() => void send(stage.reach)}
              className={themeSystem.button("primary", "sm")}
            >
              {stage.name === "sending"
                ? "Sending…"
                : `Send to ${plural(stage.reach.people, "person", "people")}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {stage.name === "sent" ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Sent to {plural(stage.result.people, "person", "people")}, and{" "}
              {plural(stage.result.sent, "browser")} rang.
              {stage.result.sent === 0 &&
                " It is still under everyone's bell — if phones should have rung, check Overview."}
              {stage.result.emailed !== undefined && ` ${plural(stage.result.emailed, "email")} sent.`}
              {stage.result.emailSkipped && ` Email was not sent: ${stage.result.emailSkipped}.`}
            </p>
          ) : (
            <p className="text-xs text-muted">
              Everyone also finds it under the bell. Parents who switched announcements off are not rung.
            </p>
          )}
          <button
            type="button"
            disabled={busy || !draft.message}
            onClick={() => void check()}
            className={themeSystem.button("primary", "sm")}
          >
            {stage.name === "checking" ? "Checking…" : "Send…"}
          </button>
        </div>
      )}
    </section>
  );
};
