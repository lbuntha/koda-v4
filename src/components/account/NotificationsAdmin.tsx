import React from "react";
import { Bell, Mail } from "lucide-react";
import { EmailPanel } from "./EmailPanel";
import { PushAnnounce } from "./PushAnnounce";
import { PushAudiencePanel } from "./PushAudiencePanel";
import { PushDiagnostics } from "./PushDiagnostics";
import { PushJobs } from "./PushJobs";
import { PushLogPanel } from "./PushLogPanel";
import { PushTemplates } from "./PushTemplates";

/**
 * Everything about how Koda reaches a person, in one place.
 *
 * It used to be three panels stacked at the bottom of the System tab, under the
 * deployment's switchboard — which is where a feature goes when nobody has
 * decided where it belongs. Notifications outgrew that: proving the pipe works,
 * writing the words a parent reads, and running the jobs that send them are
 * three different jobs, and none of them is a *system setting*. An operator
 * looking for any of them was reading past a list of switches to find it.
 *
 * **Organised by channel, not by screen.** Push is one way Koda reaches
 * somebody and mail is another, and the questions are the same for both: does
 * it work, what does it say, when does it go. Keeping the answer shaped that
 * way means a second channel is a section here rather than a fourth tab
 * somewhere else — which is the whole reason this page exists rather than a
 * longer System tab.
 *
 * The master switches stay on System, deliberately. `push.enabled` and its
 * neighbours are the deployment's ceiling, they live beside every other
 * ceiling, and they are set once and left. This page is what an operator opens
 * when they want to *know something*.
 */

/** A channel's heading, so the page reads as a list of ways to reach somebody. */
const Channel: React.FC<{
  name: string;
  icon: React.ReactNode;
  summary: string;
  children?: React.ReactNode;
}> = ({ name, icon, summary, children }) => (
  <section className="space-y-3">
    <header className="flex items-center gap-3">
      {icon}
      <div className="min-w-0">
        <h3 className="text-base font-black text-ink">{name}</h3>
        <p className="text-xs text-muted">{summary}</p>
      </div>
    </header>
    {children}
  </section>
);

export type NotificationAdminSection = "overview" | "announce" | "jobs" | "log" | "wording";

export const NotificationsAdmin: React.FC<{
  channel?: "all" | "push" | "email";
  section?: NotificationAdminSection;
}> = ({ channel = "all", section }) => {
  const show = (target: NotificationAdminSection) => !section || section === target;

  return (
    <div className="space-y-8">
      {(channel === "all" || channel === "push") && (
        <Channel
          name="Push"
          icon={<Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
          summary="A notification on a phone, through Firebase Cloud Messaging"
        >
          <div className="space-y-4">
            {show("overview") && <PushDiagnostics />}
            {show("announce") && <PushAnnounce />}
            {show("jobs") && <PushJobs />}
            {show("log") && <PushLogPanel />}
            {show("overview") && <PushAudiencePanel />}
            {show("wording") && <PushTemplates />}
          </div>
        </Channel>
      )}

      {(channel === "all" || channel === "email") && (
        <Channel
          name="Email"
          icon={<Mail className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />}
          summary="Notification emails, plus sign-in links and resets, through SMTP"
        >
          <EmailPanel />
        </Channel>
      )}
    </div>
  );
};
