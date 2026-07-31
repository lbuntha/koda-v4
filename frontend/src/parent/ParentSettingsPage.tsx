/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The parent's settings area, reached from the sidebar.
 *
 * One section today (notifications), laid out so more can join it without a
 * rewrite — hence the section list rather than the single card it could be. There
 * are deliberately no tabs yet: one tab is furniture, not navigation.
 *
 * Reading notifications is not here; that is the bell in the header. This page is
 * only about which of them a guardian wants to receive.
 */

import React from "react";
import { ParentNotificationSettings } from "./ParentNotificationSettings";

export const ParentSettingsPage: React.FC = () => (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 className="text-lg font-bold text-[#0E0B55] dark:text-[#E7E5F7]">Settings</h1>
      <p className="mt-0.5 text-xs text-[#6D6997]">Notifications and account preferences.</p>
    </div>
    <ParentNotificationSettings />
  </div>
);
