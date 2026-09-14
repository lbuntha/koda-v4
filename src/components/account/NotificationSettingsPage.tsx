import React, { useState } from "react";

import { themeSystem } from "../../lib/themeSystem";
import { UIPageHeader, UITabs } from "../ui";
import { NotificationsSettings } from "./NotificationsSettings";
import { NotificationsAdmin } from "./NotificationsAdmin";

type NotificationTab = "settings" | "push" | "scheduled" | "wording" | "sent" | "email";

export const NotificationSettingsPage: React.FC = () => (
  <NotificationSettingsTabs />
);

const NotificationSettingsTabs: React.FC = () => {
  const [tab, setTab] = useState<NotificationTab>("settings");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <UIPageHeader
        title="Notification Settings"
        subtitle="Choose what Koda can send to this device."
      />
      <UITabs
        items={[
          { id: "settings", label: "Settings" },
          { id: "push", label: "Push" },
          { id: "scheduled", label: "Scheduled notifications" },
          { id: "wording", label: "Notification wording" },
          { id: "sent", label: "What was sent" },
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
      {tab === "scheduled" && <NotificationsAdmin channel="push" section="jobs" />}
      {tab === "wording" && <NotificationsAdmin channel="push" section="wording" />}
      {tab === "sent" && <NotificationsAdmin channel="push" section="log" />}
      {tab === "email" && <NotificationsAdmin channel="email" />}
    </div>
  );
};
