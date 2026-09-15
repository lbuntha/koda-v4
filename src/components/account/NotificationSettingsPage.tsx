import React, { useState } from "react";
import { Bell } from "lucide-react";

import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader, UITabs } from "../ui";
import { NotificationsSettings } from "./NotificationsSettings";
import { NotificationsAdmin } from "./NotificationsAdmin";
import { PushTokensPanel } from "./PushTokensPanel";
import { usePermissions } from "../../lib/sync";

type NotificationTab = "settings" | "push" | "announce" | "scheduled" | "wording" | "sent" | "tokens" | "email";

export const NotificationSettingsPage: React.FC = () => (
  <NotificationSettingsTabs />
);

const NotificationSettingsTabs: React.FC = () => {
  const [tab, setTab] = useState<NotificationTab>("settings");
  // Tokens are the means to ring a browser; only platform admins hold `user:manage`.
  const { can } = usePermissions();
  const seesTokens = can("user:manage");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <UISectionHeader
        title="Notification Settings"
        subtitle="Choose what Koda can send to this device."
        icon={<Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />
      <UITabs
        items={[
          { id: "settings", label: "Overview" },
          { id: "push", label: "Push" },
          { id: "announce", label: "Announce" },
          { id: "scheduled", label: "Scheduled" },
          { id: "wording", label: "Wording" },
          { id: "sent", label: "What was sent" },
          ...(seesTokens ? [{ id: "tokens", label: "Tokens" }] : []),
          { id: "email", label: "Email" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as NotificationTab)}
        label="Notification sections"
      />
      {tab === "settings" && (
        <section className={themeSystem.card("default", "p-4 sm:p-5")}>
          <NotificationsSettings />
        </section>
      )}
      {tab === "push" && <NotificationsAdmin channel="push" section="overview" />}
      {tab === "announce" && <NotificationsAdmin channel="push" section="announce" />}
      {tab === "scheduled" &&<NotificationsAdmin channel="push" section="jobs" />}
      {tab === "wording" && <NotificationsAdmin channel="push" section="wording" />}
      {tab === "sent" && <NotificationsAdmin channel="push" section="log" />}
      {tab === "tokens" && seesTokens && <PushTokensPanel />}
      {tab === "email" && <NotificationsAdmin channel="email" />}
    </div>
  );
};
