import React, { useState } from "react";
import { Bell } from "lucide-react";

import { UISectionHeader, UITabs } from "../ui";
import { NotificationsSettings } from "./NotificationsSettings";
import { NotificationsAdmin } from "./NotificationsAdmin";
import { NotifyEventsPanel } from "./NotifyEventsPanel";
import { PushTokensPanel } from "./PushTokensPanel";
import { usePermissions } from "../../lib/sync";

import { translate } from "../../lib/i18n";
type NotificationTab = "settings" | "events" | "push" | "announce" | "scheduled" | "wording" | "sent" | "tokens" | "email";

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
        title={translate("admin.notificationSettingsPage.notificationSettings")}
        subtitle={translate("admin.notificationSettingsPage.chooseWhatKodaCanSendTo")}
        icon={<Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />
      <UITabs
        items={[
          { id: "settings", label: translate("admin.notificationSettingsPage.overview") },
          { id: "events", label: translate("admin.notificationSettingsPage.events") },
          { id: "push", label: translate("admin.notificationSettingsPage.push") },
          { id: "announce", label: translate("admin.notificationSettingsPage.announce") },
          { id: "scheduled", label: translate("admin.notificationSettingsPage.scheduled") },
          { id: "wording", label: translate("admin.notificationSettingsPage.wording") },
          { id: "sent", label: translate("admin.notificationSettingsPage.whatWasSent") },
          ...(seesTokens ? [{ id: "tokens", label: translate("admin.notificationSettingsPage.tokens") }] : []),
          { id: "email", label: translate("admin.notificationSettingsPage.email") },
        ]}
        value={tab}
        onChange={(value) => setTab(value as NotificationTab)}
        label={translate("admin.notificationSettingsPage.notificationSections")}
      />
      {tab === "settings" && (
        <section className="p-4 sm:p-5">
          <NotificationsSettings />
        </section>
      )}
      {tab === "events" && <NotifyEventsPanel />}
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
